import { doc, getDoc, collection } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

/**
 * Multi-shop tenant core.
 * Each Firebase Auth user is mapped by /adminAccounts/{uid} => { enabled, shopId, role }.
 * Shop-owned content lives under /shops/{shopId}/...
 */
export async function resolveShopContext(db, user) {
  if (!user || user.isAnonymous) throw new Error("尚未登入");

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
    uid: user.uid,
    email: user.email || "",
    shopId: account.shopId,
    role: account.role || "admin",
    shop: { id: account.shopId, ...shop }
  };
}

export function shopCollection(db, context, name) {
  if (!context?.shopId) throw new Error("缺少 shop context");
  return collection(db, "shops", context.shopId, name);
}

export function shopDoc(db, context, name, id) {
  if (!context?.shopId) throw new Error("缺少 shop context");
  return doc(db, "shops", context.shopId, name, id);
}

export function shopStoragePrefix(context) {
  if (!context?.shopId) throw new Error("缺少 shop context");
  return `shops/${context.shopId}`;
}
