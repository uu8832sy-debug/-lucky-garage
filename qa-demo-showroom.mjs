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

const selectorPage = read("public/demo/index.html");
const styles = read("public/demo/templates.css");
const basic = read("public/demo/basic/index.html");
const performance = read("public/demo/performance/index.html");
const premium = read("public/demo/premium/index.html");
const login = read("public/admin/login.js");
const selector = read("public/admin/shop-selector.js");
const bootstrap = read("public/admin/demo-bootstrap.js");
const admin = read("public/admin/index.html");
const core = read("public/multi-shop-core.js");
const rules = read("firestore.rules");

includesAll("DEMO 模板選擇頁已發布", selectorPage, [
  "小宇車行系統｜模板展示中心", "3 套完整前台模板", "/demo/basic/", "/demo/performance/", "/demo/premium/", "/admin/login.html?shop=demo"
]);
includesAll("Template A 極簡商務版完整發布", basic, [
  "TEMPLATE A", "極簡商務", "熱門車款", "線上訂單流程", "店家確認／拒絕", "建立完整訂單", "/admin/login.html?shop=demo"
]);
includesAll("Template B 性能暗黑版完整發布", performance, [
  "TEMPLATE B", "DARK PERFORMANCE", "FEATURED MACHINES", "ORDER FLOW", "確認／拒絕", "正式訂單", "/admin/login.html?shop=demo"
]);
includesAll("Template C 品牌旗艦版完整發布", premium, [
  "TEMPLATE C", "PREMIUM BRAND", "Signature Collection", "Recent Deliveries", "店家審核", "正式訂單", "/admin/login.html?shop=demo"
]);
includesAll("三套模板具備獨立視覺樣式", styles, [
  "body.basic", "body.performance", "body.premium", "minimal business", "performance dark", "premium brand"
]);
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
console.log("\n✓ DEMO selector + three visual storefront templates + isolated tenant bootstrap passed.\n");
