import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const passes = [];

function read(relative) {
  const file = path.resolve(root, relative);
  if (!fs.existsSync(file)) {
    failures.push(`缺少檔案：${relative}`);
    return "";
  }
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

const front = read("public/jerry/index.html");
includesAll("前台 HTML 完整", front, [
  "</body>", "</html>", 'id="services"', 'id="products"', 'id="cases"',
  'id="reservation"', 'id="contact"', 'id="financeModal"', 'id="mapBtn"',
  'id="reservationLineBtn"'
]);
includesAll("前台必要模組已掛載", front, [
  "/jerry/app.js", "/jerry/commerce.js", "/jerry/reservation.js",
  "/jerry/shop-photos.js", "/jerry/catalog.js", "/jerry/carousel.js",
  "/jerry/installment.js", "/jerry/short-videos.js",
  "/jerry/short-video-playback-fix.js", "/jerry/social-links.js",
  "/jerry/stability.css"
]);
includesAll("導航固定正確門市", front, [
  "data-jerry-fixed-nav", "新北市樹林區保安街一段366號",
  "https://www.google.com/maps/dir/?api=1&destination="
]);

const catalog = read("public/jerry/catalog.js");
includesAll("前台只有 5 款正式車款與正式價格", catalog, [
  'name:"大偉士"', 'name:"Z3 天鵝座"', 'name:"正 9 號"', 'name:"小偉士"', 'name:"極酷"',
  "38000,43000", "53000,58000", "75000,80000",
  "43000,48000", "80000,85000",
  "45000,50000", "82000,87000",
  "32000", "52000", "20000", "33000"
]);
excludesAll("前台不含小宇舊車款", catalog, ["神盾", "QC", "Dio", "小酷龍", "微型三輪", "小可愛（拿鐵）"]);
includesAll("前台下單 LINE 預填格式正確", catalog, ["https://line.me/R/oaMessage/%40882npfrm/?"]);

const app = read("public/jerry/app.js");
includesAll("前台設定與案例載入正常", app, [
  'address: "新北市樹林區保安街一段366號"',
  'lineUrl: "https://line.me/R/ti/p/@882npfrm"',
  "Promise.allSettled([loadSettings(), loadPaymentSettings(), loadCases()]);"
]);
ok("固定導航不再被 Firestore mapUrl 蓋掉", app.includes('$("#mapBtn").href = DEFAULTS.mapUrl;'));
ok("固定官方車款不被舊 Firestore 商品重畫", !app.includes("Promise.allSettled([loadSettings(), loadPaymentSettings(), loadProducts(), loadCases()]);"));

const reservation = read("public/jerry/reservation.js");
includesAll("預約只收日期／姓氏／手機並導 LINE", reservation, [
  "reservationDateTime", "reservationSurname", "reservationPhone",
  "^09\\d{8}$", "https://line.me/R/oaMessage/"
]);
excludesAll("預約沒有車牌欄位", reservation, ["reservationPlate", "車牌號碼"]);

const installment = read("public/jerry/installment.js");
includesAll("無卡分期含 5 款正式車款與 LINE", installment, [
  "'大偉士'", "'Z3 天鵝座'", "'正 9 號'", "'小偉士'", "'極酷'",
  "https://line.me/R/oaMessage/%40882npfrm/?"
]);
excludesAll("無卡分期不含小宇舊車款", installment, ["神盾", "QC", "Dio", "小酷龍", "微型三輪", "小可愛（拿鐵）"]);

const commerce = read("public/jerry/commerce.js");
includesAll("線上下單先進待審核區", commerce, [
  'doc(db,"shops",SHOP_ID,"onlineOrders",orderId)',
  'reviewStatus:"pending"',
  "window.JerryCommerce=",
  "訂單已送出，等待店家確認",
  "https://line.me/R/oaMessage/%40882npfrm/?"
]);
ok("線上下單不直接建立正式訂單", !commerce.includes('doc(db,"shops",SHOP_ID,"orders",orderId)'));

const adminHtml = read("public/jerry/admin.html");
includesAll("Jerry 後台必要管理模組完整", adminHtml, [
  "/jerry/admin-products.js", "/jerry/online-review.js",
  "/jerry/media-admin.js", "/jerry/product-photo-fix.js?v=5",
  "/admin/orders.html?shop=jerry"
]);

const adminProducts = read("public/jerry/admin-products.js");
includesAll("商品後台鎖定正式 5 款與 Cloudinary", adminProducts, [
  'name:"大偉士"', 'name:"Z3 天鵝座"', 'name:"正 9 號"', 'name:"小偉士"', 'name:"極酷"',
  'CLOUDINARY_UPLOAD_PRESET = "jerry_products_unsigned"',
  "傑瑞正式價目固定由系統管理"
]);
excludesAll("商品後台不顯示小宇舊車款", adminProducts, ["神盾", "QC", "Dio", "小酷龍", "微型三輪", "小可愛（拿鐵）"]);

const mediaAdmin = read("public/jerry/media-admin.js");
includesAll("圖片與短影音後台使用 Cloudinary", mediaAdmin, [
  'CLOUD_NAME = "k6e9e4bl"', 'UPLOAD_PRESET = "jerry_products_unsigned"',
  "uploadProductPhotos", "uploadShortVideoFile", "persistShorts"
]);

const core = read("public/multi-shop-core.js");
includesAll("Jerry 帳號與租戶隔離存在", core, [
  'JERRY_ADMIN_EMAIL = "a0975607339@gmail.com"',
  'shopId:"jerry"', 'role:"admin"'
]);
ok("舊 Firestore-inline 圖片攔截器已停用", !/\ninstallJerryFirestoreImageUpload\(\);\s*$/.test(core));

const onlineReview = read("public/jerry/online-review.js");
includesAll("線上訂單審核可確認／拒絕並轉正式訂單", onlineReview, [
  "onlineOrders", "confirmOrder", "rejectOrder", "reviewStatus:'confirmed'",
  "reviewStatus:'rejected'", "'orders'"
]);

const sharedAdmin = read("public/admin/admin.js");
includesAll("主後台支援 Email 密碼與 Jerry Cloudinary", sharedAdmin, [
  "signInWithEmailAndPassword", 'CLOUDINARY_UPLOAD_PRESET = "jerry_products_unsigned"',
  "shopCollection(db, context, \"orders\")", "shopCollection(db, context, \"products\")"
]);

const ordersHtml = read("public/admin/orders.html");
includesAll("完整訂單後台已套 Jerry 品牌入口", ordersHtml, [
  "JERRY_SHARED_ORDERS_BRANDING_V1", "/jerry/admin.html?shop=jerry", "/jerry/"
]);

const ordersJs = read("public/admin/orders.js");
includesAll("完整訂單後台有 Jerry 5 款正式價目與租戶隔離", ordersJs, [
  "signInWithEmailAndPassword", "const JERRY_CATALOG", '"大偉士"', '"Z3 天鵝座"',
  '"正9號"', '"小偉士"', '"極酷"', "shopCollection(db, currentContext, \"products\")"
]);

const siteSettings = read("public/admin/site-settings.js");
includesAll("網站設定預設資料已對齊 Jerry 官方資料", siteSettings, [
  'phone:"(02) 8686-0669"', 'hours:"週一至週日 12:00–21:00"',
  'address:"新北市樹林區保安街一段366號"',
  'lineUrl:"https://line.me/R/ti/p/@882npfrm"',
  "https://www.google.com/maps/dir/?api=1&destination="
]);

const cases = read("public/admin/cases.js");
includesAll("案例後台可 CRUD 並用 Cloudinary", cases, [
  "loadCases", "saveCase", "removeCase", 'CLOUDINARY_UPLOAD_PRESET = "jerry_products_unsigned"'
]);

const shortVideos = read("public/jerry/short-videos.js");
includesAll("前台短影音延遲載入與單支播放", shortVideos, [
  "IntersectionObserver", "pauseOthers", 'siteSettings","shortVideos"', "preload=\"none\""
]);

const social = read("public/jerry/social-links.js");
includesAll("官方社群連結完整", social, [
  "@882npfrm", "tiktok.com/@jerry950114", "instagram.com/jerryebike", "facebook.com/share/"
]);

const rules = read("firestore.rules");
includesAll("Firestore 規則涵蓋 Jerry 與待審核訂單", rules, [
  "a0975607339@gmail.com", "function belongsTo(shopId)",
  "match /shops/{shopId}", "match /onlineOrders/{orderId}", "validShopPublicOrder(orderId, shopId)"
]);

console.log(`\nJerry 交付驗收：${passes.length} 項通過`);
passes.forEach((label) => console.log(`  ✓ ${label}`));

if (failures.length) {
  console.error(`\nJerry 交付驗收失敗：${failures.length} 項`);
  failures.forEach((label) => console.error(`  ✗ ${label}`));
  process.exit(1);
}

console.log("\n✓ Jerry storefront/admin handoff QA passed.\n");
