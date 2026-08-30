import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const passes = [];
const read = (relative) => {
  const file = path.resolve(root, relative);
  if (!fs.existsSync(file)) { failures.push(`缺少檔案：${relative}`); return ""; }
  return fs.readFileSync(file, "utf8");
};
const ok = (label, condition, detail = "") => condition ? passes.push(label) : failures.push(`${label}${detail ? `｜${detail}` : ""}`);
const includesAll = (label, text, values) => {
  const missing = values.filter((value) => !text.includes(value));
  ok(label, missing.length === 0, missing.length ? `缺少：${missing.join("、")}` : "");
};
const excludesAll = (label, text, values) => {
  const found = values.filter((value) => text.includes(value));
  ok(label, found.length === 0, found.length ? `不該出現：${found.join("、")}` : "");
};

const gateway = read("public/admin/login.html");
const gatewayJs = read("public/admin/login.js");
const admin = read("public/admin/index.html");
const jerry = read("public/jerry/admin.html");
const core = read("public/multi-shop-core.js");

includesAll("共用後台登入頁具備選店 UI", gateway, [
  "電動車商家後台平台", "先選擇要登入的商家", "shopGrid", "shopSelect", "emailLoginBtn", "googleLoginBtn", "enterSelectedBtn"
]);
excludesAll("共用登入頁不是傑瑞品牌登入頁", gateway, ["JERRY ADMINISTRATION", "傑瑞電動車管理員登入"]);

includesAll("共用登入頁會自動載入多店家", gatewayJs, [
  'collection(db, "shops")', 'where("public", "==", true)', 'id:"xiaoyu"', 'id:"jerry"', "resolveShopContext", "setOwnerShop"
]);
includesAll("一般店家帳號依實際 shopId 導流", gatewayJs, [
  "const actualId = safeId(context.shopId)", 'context.role !== "platformOwner"', "routeFor(actualId)"
]);
includesAll("小宇與其他租戶共用後台，Jerry 保留獨立後台", gatewayJs, [
  'if (id === "jerry") return "/jerry/admin.html?shop=jerry";', '/admin/index.html?shop=${encodeURIComponent(id)}'
]);

includesAll("直接開主後台未指定店家會先回選店頁", admin, ["data-shop-gateway-guard", 'location.replace("/admin/login.html")', "data-switch-shop"]);
includesAll("直接開 Jerry 後台未指定店家也先回選店頁", jerry, ["data-shop-gateway-guard", '/admin/login.html?shop=jerry', "data-switch-shop"]);
includesAll("小宇 legacy 資料仍由 multi-shop core 保留", core, [
  'shopId:"xiaoyu"', 'legacy:true', 'return context.legacy ? collection(db, name)'
]);

console.log(`\nPlatform login gateway QA：${passes.length} 項通過`);
if (failures.length) {
  console.error(`Platform login gateway QA 失敗：${failures.length} 項`);
  failures.forEach((failure) => console.error(`  ✗ ${failure}`));
  process.exit(1);
}
passes.forEach((label) => console.log(`  ✓ ${label}`));
console.log("\n✓ Shared merchant selection login gateway passed.\n");
