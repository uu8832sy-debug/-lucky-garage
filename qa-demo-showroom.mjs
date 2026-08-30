import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const passes = [];
function read(relative) {
  const file = path.resolve(root, relative);
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

const storefront = read("public/demo/index.html");
const login = read("public/admin/login.js");
const selector = read("public/admin/shop-selector.js");
const bootstrap = read("public/admin/demo-bootstrap.js");
const admin = read("public/admin/index.html");
const core = read("public/multi-shop-core.js");
const rules = read("firestore.rules");

includesAll("DEMO 前台已發布且清楚標示假資料", storefront, [
  "小宇車行系統｜DEMO 展示店", "DEMO 展示站", "所有車款、價格、訂單與客戶資料皆為展示假資料", "/admin/login.html?shop=demo"
]);
includesAll("DEMO 前台包含系統銷售流程展示", storefront, ["線上訂單怎麼走？", "店家確認／拒絕", "建立完整訂單", "模擬線上下單"]);
includesAll("共用登入入口固定包含 DEMO 店", login, [
  'id:"demo"', "小宇車行系統｜DEMO 展示店", '["demo", DEMO]'
]);
includesAll("後台店家切換器固定包含 DEMO 店與前台連結", selector, [
  'id:"demo"', "DEMO_FALLBACK", '["demo", DEMO_FALLBACK]', 'shop?.id === "demo"', 'return "/demo/"'
]);
includesAll("DEMO bootstrap 僅使用 shops/demo 隔離資料", bootstrap, [
  'const DEMO_SHOP_ID = "demo"', 'doc(db, "shops", DEMO_SHOP_ID)', '"onlineOrders"', '"orders"', '"products"', '"deliveryCases"'
]);
includesAll("DEMO bootstrap 只有平台主帳號可首次建立展示資料", bootstrap, [
  'context.role !== "platformOwner"', "demoSeedVersion", "public:true", "demo:true"
]);
includesAll("共用後台會載入 DEMO bootstrap", admin, ["/admin/demo-bootstrap.js"]);
includesAll("多店家核心已允許動態 shop query", core, ["const queryShop = String(new URLSearchParams", "if (queryShop)"]);
includesAll("Firestore 已支援 shops/{shopId} 隔離 collections", rules, [
  "match /shops/{shopId}", "match /products/{productId}", "match /orders/{orderId}", "match /onlineOrders/{orderId}"
]);

console.log(`\nDEMO showroom QA：${passes.length} 項通過`);
passes.forEach((label) => console.log(`  ✓ ${label}`));
if (failures.length) {
  console.error(`DEMO showroom QA 失敗：${failures.length} 項`);
  failures.forEach((failure) => console.error(`  ✗ ${failure}`));
  process.exit(1);
}
console.log("\n✓ DEMO storefront, selector, bootstrap and tenant isolation passed.\n");
