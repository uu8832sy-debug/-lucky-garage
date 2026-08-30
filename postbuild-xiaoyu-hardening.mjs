import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicDir = path.resolve(root, "public");

function ensureSource(relative) {
  const file = path.resolve(root, relative);
  if (!fs.existsSync(file)) throw new Error(`Hardening source missing: ${relative}`);
  return file;
}
function copy(source, destination = source) {
  const from = ensureSource(source);
  const to = path.resolve(publicDir, destination);
  fs.mkdirSync(path.dirname(to), { recursive:true });
  fs.copyFileSync(from, to);
}
function patch(relative, transform) {
  const file = path.resolve(publicDir, relative);
  if (!fs.existsSync(file)) throw new Error(`Hardening build file missing: ${relative}`);
  const before = fs.readFileSync(file, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`Hardening no-op: ${relative}`);
  fs.writeFileSync(file, after, "utf8");
}
function mustReplace(text, search, replacement, label) {
  if (!text.includes(search)) throw new Error(`Hardening marker missing: ${label}`);
  return text.replace(search, replacement);
}
function mustRegex(text, pattern, replacement, label) {
  if (!pattern.test(text)) throw new Error(`Hardening marker missing: ${label}`);
  pattern.lastIndex = 0;
  return text.replace(pattern, replacement);
}

copy("admin/shop-selector.js", "admin/shop-selector.js");
copy("admin/shop-route.js", "admin/shop-route.js");

// Shared multishop core: owner can choose any real shopId; direct /admin/ without a query defaults to Xiaoyu,
// so an old Jerry session can no longer make the Xiaoyu admin unexpectedly open Jerry data.
patch("multi-shop-core.js", (input) => {
  let js = input;
  js = mustRegex(js, /function requestedOwnerShop\(\) \{[\s\S]*?\n\}/, `function requestedOwnerShop() {
  try {
    const pathname = String(globalThis.location?.pathname || "");
    const queryShop = String(new URLSearchParams(globalThis.location?.search || "").get("shop") || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64);
    if (queryShop) {
      globalThis.sessionStorage?.setItem(OWNER_SHOP_KEY, queryShop);
      return queryShop;
    }
    const rootAdmin = /^\\/admin(?:\\/index\\.html)?\\/?$/i.test(pathname);
    if (rootAdmin) {
      globalThis.sessionStorage?.setItem(OWNER_SHOP_KEY, "xiaoyu");
      return "xiaoyu";
    }
    const saved = String(globalThis.sessionStorage?.getItem(OWNER_SHOP_KEY) || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64);
    if (saved) return saved;
  } catch {}
  return "xiaoyu";
}`, "dynamic owner shop selection");

  js = mustRegex(js, /function isJerryAdminPage\(\) \{[\s\S]*?\n\}/, `function isJerryAdminPage() {
  try {
    const hostJerry = /(^|\\.)jerrye-bike\\.com$/i.test(globalThis.location?.hostname || "");
    const pathJerry = /^\\/jerry(?:\\/|$)/i.test(globalThis.location?.pathname || "");
    return hostJerry || pathJerry;
  } catch {
    return false;
  }
}`, "Jerry page must be path/host scoped");
  return js;
});

// Main shared admin gets a scalable Firestore-backed shop selector.
patch("admin/index.html", (input) => {
  let html = input;
  if (!html.includes("/admin/shop-selector.js")) {
    html = html.replace("</body>", '  <script type="module" src="/admin/shop-selector.js?v=1"></script>\n</body>');
  }
  return html;
});

// Child pages preserve the selected shopId instead of hard-jumping to Xiaoyu.
for (const page of ["orders.html","site-settings.html","cases.html","platform.html","payment-settings.html","audit-log.html"]) {
  patch(`admin/${page}`, (input) => {
    let html = input;
    if (!html.includes("shop-route.js")) html = html.replace("</body>", '  <script src="shop-route.js?v=1"></script>\n</body>');
    return html;
  });
}

// Public vehicle checkout must land in the same collection the complete order backend reads.
// Also store the actual payable amount including license/insurance handling fee.
patch("products.js", (input) => {
  let js = input;
  js = js.replaceAll('doc(db, "onlineOrders", orderId)', 'doc(db, "orders", orderId)');
  js = mustReplace(js,
    'price:vehiclePrice, totalAmount:money(totalPrice), cost:0, netProfit:vehiclePrice, deposit:0, balancePaid:0,',
    'price:totalPrice, totalAmount:money(totalPrice), vehiclePrice, licenseFee, cost:0, netProfit:0, deposit:0, balancePaid:0,',
    "vehicle checkout payable amount"
  );
  return js;
});

// Plate orders must appear in the same complete-orders backend too.
patch("plate.js", (input) => {
  let js = input.replaceAll('doc(db, "onlineOrders", orderId)', 'doc(db, "orders", orderId)');
  js = js.replaceAll('status:"待審核", reviewStatus:"pending"', 'status:"待驗證", reviewStatus:"pending"');
  return js;
});

// Fail fast for invalid/oversized image files before Firebase/Cloudinary upload.
patch("admin/admin.js", (input) => {
  let js = input;
  js = mustReplace(js,
    'async function uploadImages(files) {\n  const context = requireContext();',
    'async function uploadImages(files) {\n  const list = [...files];\n  for (const file of list) {\n    if (!String(file?.type || "").startsWith("image/")) throw new Error("只支援圖片檔");\n    if (Number(file?.size || 0) > 10 * 1024 * 1024) throw new Error("單張圖片不可超過 10MB");\n  }\n  files = list;\n  const context = requireContext();',
    "product image validation"
  );
  return js;
});

patch("admin/cases.js", (input) => {
  let js = input;
  js = mustReplace(js,
    '  if (file) {\n    if (context.legacy) {',
    '  if (file) {\n    if (!String(file.type || "").startsWith("image/")) throw new Error("只支援圖片檔");\n    if (Number(file.size || 0) > 10 * 1024 * 1024) throw new Error("案例照片不可超過 10MB");\n    if (context.legacy) {',
    "case image validation"
  );
  return js;
});

// New tenant form should be blank; hard-coded Jerry defaults are unsafe once this becomes a sellable platform.
patch("admin/platform.html", (input) => input
  .replace('id="shopId" value="jerry"', 'id="shopId"')
  .replace('id="shopName" value="傑瑞電動車"', 'id="shopName"'));

console.log("Xiaoyu hardening complete: scalable shop selector, tenant-safe routing, unified orders and upload checks.");
