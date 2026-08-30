import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const passes = [];

function filePath(relative) { return path.resolve(root, relative); }
function read(relative) {
  const file = filePath(relative);
  if (!fs.existsSync(file)) { failures.push(`缺少檔案：${relative}`); return ""; }
  return fs.readFileSync(file, "utf8");
}
function ok(label, condition, detail = "") {
  if (condition) passes.push(label);
  else failures.push(`${label}${detail ? `｜${detail}` : ""}`);
}
function includesAll(label, text, values) {
  const missing = values.filter((value) => !text.includes(value));
  ok(label, missing.length === 0, missing.length ? `缺少：${missing.join("、")}` : "");
}
function excludesAll(label, text, values) {
  const found = values.filter((value) => text.includes(value));
  ok(label, found.length === 0, found.length ? `不該出現：${found.join("、")}` : "");
}

const front = read("public/index.html");
const home = read("public/home.js");
const admin = read("public/admin/index.html");
const shorts = read("public/xiaoyu-short-videos.js");
const media = read("public/xiaoyu-media-admin.js");
const cases = read("public/admin/cases.html");

includesAll("小宇前台必要模組完整", front, [
  "</body>", "</html>", "/xiaoyu-short-videos.js", "/products.html", "/plate.html", "/warranty.html"
]);
includesAll("小宇短影音使用自己的 legacy 資料區", shorts, [
  'doc(db,"siteSettings","shortVideos")', 'collection(db,"deliveryCases")', "YU SHORTS", "IntersectionObserver", "pauseOthers"
]);
excludesAll("小宇短影音沒有誤接傑瑞資料", shorts, [
  'shops",SHOP_ID', 'shops","jerry', "JERRY SHORTS", "@882npfrm"
]);

includesAll("小宇後台主要入口完整", admin, [
  'orders.html?shop=xiaoyu', 'site-settings.html?shop=xiaoyu', 'cases.html?shop=xiaoyu',
  'platform.html?shop=xiaoyu', 'payment-settings.html?shop=xiaoyu', 'audit-log.html?shop=xiaoyu',
  "/xiaoyu-media-admin.js"
]);
excludesAll("已退休抽獎入口不會被 build 蓋回來", admin, ["href=\"draw.html", "href='draw.html"]);
ok("操作紀錄 HTML 已進正式輸出", fs.existsSync(filePath("public/admin/audit-log.html")));
ok("操作紀錄 JS 已進正式輸出", fs.existsSync(filePath("public/admin/audit-log.js")));

includesAll("案例後台與首頁資料格式已對齊", home, [
  "c?.visible!==false", "Array.isArray(c?.images)", "c.description||c.note", "imageOf=(c)=>"
]);
includesAll("案例後台可設定顯示、照片與說明", cases, ["id=\"visible\"", "id=\"photo\"", "id=\"description\""]);

includesAll("小宇短影音後台具備上傳與 CRUD", media, [
  "xiaoyuShortsTab", "yuShortVideoUploadBtn", "yuShortPosterUploadBtn", "saveShort", "removeShort", "toggleShort", "moveShort",
  'doc(db, "siteSettings", "shortVideos")', "shops/xiaoyu/short-videos"
]);
excludesAll("小宇短影音後台不寫傑瑞 Firestore 租戶", media, [
  'doc(db, "shops", "jerry"', 'SHOP_ID = "jerry"', "JERRY SHORT VIDEOS"
]);

function resolveStatic(page, raw) {
  const clean = raw.split("#")[0].split("?")[0];
  if (!clean || clean === "/") return null;
  if (/^(https?:|tel:|mailto:|javascript:)/i.test(clean)) return null;
  if (clean.startsWith("/")) {
    const relative = clean.slice(1);
    if (!relative) return null;
    return path.resolve(root, "public", relative.endsWith("/") ? `${relative}index.html` : relative);
  }
  return path.resolve(path.dirname(filePath(page)), clean);
}

function checkStaticLinks(page) {
  const html = read(page);
  const refs = [
    ...[...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)].map((match) => ["href", match[1]]),
    ...[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => ["src", match[1]])
  ];
  for (const [kind, target] of refs) {
    if (target.startsWith("#")) {
      if (kind === "href") ok(`${page}｜${target}`, html.includes(`id="${target.slice(1)}"`) || html.includes(`id='${target.slice(1)}'`), "頁內目標不存在");
      continue;
    }
    const destination = resolveStatic(page, target);
    if (!destination) continue;
    ok(`${page}｜${kind}｜${target}`, fs.existsSync(destination), `目標不存在：${destination}`);
  }
}

for (const page of [
  "public/index.html", "public/products.html", "public/plate.html", "public/warranty.html", "public/installment.html",
  "public/admin/index.html", "public/admin/cases.html", "public/admin/platform.html", "public/admin/payment-settings.html", "public/admin/audit-log.html"
]) checkStaticLinks(page);

console.log(`\nXiaoyu parity QA：${passes.length} 項通過`);
if (failures.length) {
  console.error(`Xiaoyu parity QA 失敗：${failures.length} 項`);
  failures.forEach((failure) => console.error(`  ✗ ${failure}`));
  process.exit(1);
}
passes.forEach((label) => console.log(`  ✓ ${label}`));
console.log("\n✓ Xiaoyu storefront/admin parity and link QA passed.\n");
