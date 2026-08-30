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

const admin = read("public/admin/index.html");
const selector = read("public/admin/shop-selector.js");
const routes = read("public/admin/shop-route.js");
const core = read("public/multi-shop-core.js");
const products = read("public/products.js");
const plate = read("public/plate.js");
const adminJs = read("public/admin/admin.js");
const casesJs = read("public/admin/cases.js");
const platform = read("public/admin/platform.html");
const firestore = read("firestore.rules");
const storage = read("storage.rules");

includesAll("登入頁具備可擴充店家選擇器", admin, ["/admin/shop-selector.js"]);
includesAll("店家選擇器從 Firestore 自動載入公開店家", selector, [
  'collection(db, "shops")', 'where("public", "==", true)', "loginShopSelect", "ownerShopSwitcher", "syncAdminLinks", "resolveShopContext"
]);
includesAll("店家選擇器保留小宇與傑瑞且支援任意 shopId", selector, [
  'id:"xiaoyu"', 'id:"jerry"', '/admin/index.html?shop=${encodeURIComponent(id)}'
]);
includesAll("多店家核心接受動態 shopId 且直進主後台預設小宇", core, [
  "const queryShop = String(new URLSearchParams", "if (queryShop)", "const rootAdmin", 'return "xiaoyu";'
]);
includesAll("Jerry 特殊上傳只在 Jerry 路徑或網域啟用", core, ["return hostJerry || pathJerry;"]);
excludesAll("Jerry 特殊頁判斷不再吃舊 session", core, ["const savedJerry =", "queryJerry || savedJerry"]);

for (const page of ["orders.html","site-settings.html","cases.html","platform.html","payment-settings.html","audit-log.html"]) {
  const html = read(`public/admin/${page}`);
  includesAll(`${page} 保留目前店家`, html, ["shop-route.js"]);
}
includesAll("子頁路由腳本會保留 shop query", routes, ["luckyGarageAdminShop", 'searchParams.set("shop", shopId)']);

includesAll("車輛官網訂單統一進完整 orders", products, ['doc(db, "orders", orderId)', "price:totalPrice", "vehiclePrice, licenseFee", "netProfit:0"]);
excludesAll("車輛官網不再建立 onlineOrders", products, ['doc(db, "onlineOrders", orderId)']);
includesAll("展示牌訂單統一進完整 orders", plate, ['doc(db, "orders", orderId)', 'status:"待驗證"']);
excludesAll("展示牌不再建立 onlineOrders", plate, ['doc(db, "onlineOrders", orderId)']);

includesAll("商品圖片上傳有型別與 10MB 防呆", adminJs, ["只支援圖片檔", "單張圖片不可超過 10MB", "10 * 1024 * 1024"]);
includesAll("案例圖片上傳有型別與 10MB 防呆", casesJs, ["只支援圖片檔", "案例照片不可超過 10MB", "10 * 1024 * 1024"]);
includesAll("Storage 同時支援小宇與多店家商品案例", storage, [
  "match /products/{productId}/{fileName}", "match /cases/{caseId}/{fileName}", "match /shops/{shopId}/products/{productId}/{fileName}", "match /shops/{shopId}/cases/{caseId}/{fileName}"
]);
includesAll("Firestore 多店家核心資料皆按 shopId 隔離", firestore, [
  "match /shops/{shopId}", "match /products/{productId}", "match /orders/{orderId}", "match /deliveryCases/{caseId}", "match /siteSettings/{docId}"
]);

excludesAll("新增代理店畫面不再預填 Jerry", platform, ['value="jerry"', 'value="傑瑞電動車"']);

console.log(`\nXiaoyu hardening QA：${passes.length} 項通過`);
if (failures.length) {
  console.error(`Xiaoyu hardening QA 失敗：${failures.length} 項`);
  failures.forEach((failure) => console.error(`  ✗ ${failure}`));
  process.exit(1);
}
passes.forEach((label) => console.log(`  ✓ ${label}`));
console.log("\n✓ Multishop login, tenant routing, order pipeline and upload hardening passed.\n");
