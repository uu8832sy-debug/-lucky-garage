import { doc, getDoc, collection } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const LEGACY_OWNER_EMAIL = "uu8832sr@gmail.com";
const JERRY_ADMIN_EMAIL = "a0975607339@gmail.com";
const OWNER_SHOPS = {
  xiaoyu:{ id:"xiaoyu", name:"小宇微電", displayName:"小宇微電", enabled:true },
  jerry:{ id:"jerry", name:"傑瑞電動車", displayName:"傑瑞電動車", enabled:true }
};
const OWNER_SHOP_KEY = "luckyGarageAdminShop";

function requestedOwnerShop() {
  try {
    const queryShop = new URLSearchParams(globalThis.location?.search || "").get("shop");
    if (queryShop && OWNER_SHOPS[queryShop]) {
      globalThis.sessionStorage?.setItem(OWNER_SHOP_KEY, queryShop);
      return queryShop;
    }
    const saved = globalThis.sessionStorage?.getItem(OWNER_SHOP_KEY);
    if (saved && OWNER_SHOPS[saved]) return saved;
  } catch {}
  return "xiaoyu";
}

export function setOwnerShop(shopId) {
  if (!OWNER_SHOPS[shopId]) throw new Error("不支援的店家");
  try { globalThis.sessionStorage?.setItem(OWNER_SHOP_KEY, shopId); } catch {}
}

export async function resolveShopContext(db, user) {
  if (!user || user.isAnonymous) throw new Error("尚未登入");

  const email = String(user.email || "").toLowerCase();
  const isPlatformOwner = email === LEGACY_OWNER_EMAIL;
  const isJerryAdmin = email === JERRY_ADMIN_EMAIL;

  if (isJerryAdmin) {
    let remoteShop = {};
    try {
      const shopSnap = await getDoc(doc(db, "shops", "jerry"));
      if (shopSnap.exists()) remoteShop = shopSnap.data() || {};
    } catch (error) {
      console.warn("Jerry admin shop metadata fallback:", error);
    }
    const shop = { ...OWNER_SHOPS.jerry, ...remoteShop, id:"jerry" };
    if (shop.enabled === false) throw new Error("此車行目前已停用");
    return {
      uid:user.uid,
      email:user.email || "",
      shopId:"jerry",
      role:"admin",
      legacy:false,
      shop
    };
  }

  if (isPlatformOwner) {
    const shopId = requestedOwnerShop();
    if (shopId === "xiaoyu") {
      return {
        uid:user.uid,
        email:user.email || "",
        shopId:"xiaoyu",
        role:"platformOwner",
        legacy:true,
        shop:OWNER_SHOPS.xiaoyu
      };
    }

    let remoteShop = {};
    try {
      const shopSnap = await getDoc(doc(db, "shops", shopId));
      if (shopSnap.exists()) remoteShop = shopSnap.data() || {};
    } catch (error) {
      console.warn("Platform owner shop metadata fallback:", error);
    }
    const shop = { ...OWNER_SHOPS[shopId], ...remoteShop, id:shopId };
    if (shop.enabled === false) throw new Error("此車行目前已停用");
    return {
      uid:user.uid,
      email:user.email || "",
      shopId,
      role:"platformOwner",
      legacy:false,
      shop
    };
  }

  const accountSnap = await getDoc(doc(db, "adminAccounts", user.uid));
  if (!accountSnap.exists()) throw new Error("此帳號尚未綁定車行");

  const account = accountSnap.data() || {};
  if (account.enabled !== true) throw new Error("此帳號已停用");
  if (!account.shopId || typeof account.shopId !== "string") throw new Error("此帳號缺少 shopId");

  const shopSnap = await getDoc(doc(db, "shops", account.shopId));
  if (!shopSnap.exists()) throw new Error("找不到對應車行");

  const shop = shopSnap.data() || {};
  if (shop.enabled === false) throw new Error("此車行目前已停用");

  return {
    uid:user.uid,
    email:user.email || "",
    shopId:account.shopId,
    role:account.role || "admin",
    legacy:false,
    shop:{ id:account.shopId, ...shop }
  };
}

export function shopCollection(db, context, name) {
  if (!context?.shopId) throw new Error("缺少 shop context");
  return context.legacy ? collection(db, name) : collection(db, "shops", context.shopId, name);
}

export function shopDoc(db, context, name, id) {
  if (!context?.shopId) throw new Error("缺少 shop context");
  return context.legacy ? doc(db, name, id) : doc(db, "shops", context.shopId, name, id);
}

export function shopStoragePrefix(context) {
  if (!context?.shopId) throw new Error("缺少 shop context");
  return context.legacy ? "" : `shops/${context.shopId}`;
}
