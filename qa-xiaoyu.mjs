import fs from "node:fs";
import path from "node:path";

const root = path.resolve("public");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const catalog = read("catalog.js");
const products = read("products.js");
const home = read("home.js");
const ordersJs = read("admin/orders.js");
const ordersHtml = read("admin/orders.html");
const productsHtml = read("products.html");
const branding = read("admin/shop-branding.js");
const multiShopCore = read("multi-shop-core.js");

function expect(condition, message) {
  if (!condition) throw new Error(`XIAOYU QA FAILED: ${message}`);
}
function containsAll(text, values, label) {
  values.forEach((value) => expect(text.includes(String(value)), `${label} missing ${value}`));
}

// 5 頁正式價目表核心價格：每個價格至少要出現在正式 catalog。
containsAll(catalog, [
  33000,49800,54800,60800,67800,
  35000,51800,56800,62800,69800,
  36000,52800,57800,63800,70800,
  38000,59800,65800,72800,
  27400,45800,50800,63800,
  29000,47400,52400,58400,65400,
  30000,48400,53400,59400,66400,
  18500
], "official price catalog");
containsAll(catalog, ["7230 鋰電","7240 鋰電","7250 鋰電","7265 鋰電","車款顏色依現貨為主","小紅豆｜電輔車","H1"], "official catalog labels");

// 前台下單必須直接進後台 orders，不得再分流 onlineOrders。
expect(products.includes('doc(db, "orders", orderId)'), "storefront must write orders collection");
expect(!products.includes('doc(db, "onlineOrders", orderId)'), "storefront still writes onlineOrders");
expect(products.includes('status:"待驗證"'), "public order initial status must be 待驗證");
expect(products.includes("batteryOptionsFor"), "storefront must use multi-capacity battery options");
expect(products.includes("車款顏色依現貨為主"), "storefront color must be inventory-based");
expect(!products.includes("請協助確認訂金、領牌方式與交車安排"), "storefront still contains old deposit wording");

// 首頁與分期同一份正式價格結構。
expect(home.includes("batteryOptionsFor"), "home/installment must use official battery options");
expect(home.includes("batteryKey:(r.battery?.key==='lead'?'lead':'ternary')"), "installment lead compatibility mapping missing");

// 後台訂單須有正式價格表與正確代辦費。
containsAll(ordersJs, ["XIAOYU_PRICE_TABLE","大偉士","Z3 天鵝座","正9號","小偉士","神盾","DIO","拿鐵","QC","小紅豆｜電輔車","H1"], "admin order price table");
containsAll(ordersJs, [33000,49800,27400,45800,29000,47400,30000,48400,18500,72800], "admin official prices");
expect(ordersHtml.includes("代辦（另加 NT$3,000）"), "admin license fee must be 3000");
expect(!ordersHtml.includes("代辦（另加 NT$2,500）"), "admin still shows old 2500 fee");
expect(ordersJs.includes("lithiumBattery ? 12 : 6"), "battery warranty month logic missing");

// 前台不再出現舊等待／待訂金交付話術。
expect(!productsHtml.includes("送出後會建立「待訂金」訂單"), "products page still says 待訂金");
expect(!productsHtml.includes("實際訂金、交期及配備由客服再次確認"), "products page still says deposit/waiting");

// 小宇管理後台必須永遠固定在 legacy 根目錄，不能被瀏覽器上次的傑瑞選擇帶走。
expect(branding.includes('let selected = explicitJerry ? "jerry" : "xiaoyu"'), "xiaoyu admin routing is not pinned");
expect(branding.includes('if (!explicitJerry) persistShop("xiaoyu")'), "xiaoyu admin does not clear stale Jerry state");
expect(!branding.includes('sessionStorage.getItem(ownerShopKey) || localStorage.getItem(storageKey)'), "xiaoyu admin still trusts stale browser shop state");
expect(branding.includes('orders.html') && branding.includes('?shop=xiaoyu'), "xiaoyu child admin links are not pinned to xiaoyu");

// 新人 adminAccounts 綁 xiaoyu 必須走舊根目錄 orders/products，不得走 shops/xiaoyu/* 空資料區。
expect(multiShopCore.includes('if (accountShopId === "xiaoyu")'), "staff xiaoyu legacy branch missing");
expect(multiShopCore.includes('shopId:"xiaoyu"') && multiShopCore.includes('legacy:true'), "staff xiaoyu context must be legacy");
expect(multiShopCore.includes('return context.legacy ? collection(db, name) : collection(db, "shops", context.shopId, name)'), "legacy collection routing missing");

console.log("Xiaoyu QA passed: prices, storefront orders, legacy order visibility, staff routing, warranty and inventory color are aligned.");
