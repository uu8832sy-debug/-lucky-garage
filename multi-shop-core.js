import { doc, getDoc, collection, getFirestore, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";

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

function normalizeAccountShopId(account = {}) {
  const candidates = [account.shopId, account.shopID, account.shopid, account.shopld];
  const value = candidates.find((item) => typeof item === "string" && item.trim());
  return String(value || "").trim().toLowerCase();
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

  const accountShopId = normalizeAccountShopId(account);
  if (!accountShopId) throw new Error("此帳號缺少 shopId");
  const role = String(account.role || "admin");

  // 小宇微電目前仍使用根目錄的舊版資料結構；員工帳號也必須走 legacy context，
  // 否則會誤讀 shops/xiaoyu/* 的空資料區。
  if (accountShopId === "xiaoyu") {
    return {
      uid:user.uid,
      email:user.email || "",
      shopId:"xiaoyu",
      role,
      legacy:true,
      shop:OWNER_SHOPS.xiaoyu
    };
  }

  const shopSnap = await getDoc(doc(db, "shops", accountShopId));
  if (!shopSnap.exists()) throw new Error("找不到對應車行");

  const shop = shopSnap.data() || {};
  if (shop.enabled === false) throw new Error("此車行目前已停用");

  return {
    uid:user.uid,
    email:user.email || "",
    shopId:accountShopId,
    role,
    legacy:false,
    shop:{ id:accountShopId, ...shop }
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

function isJerryAdminPage() {
  try {
    const hostJerry = /(^|\.)jerrye-bike\.com$/i.test(globalThis.location?.hostname || "");
    const pathJerry = /\/jerry\/admin\.html$/i.test(globalThis.location?.pathname || "");
    const queryJerry = new URLSearchParams(globalThis.location?.search || "").get("shop") === "jerry";
    const savedJerry = globalThis.sessionStorage?.getItem(OWNER_SHOP_KEY) === "jerry";
    return hostJerry || pathJerry || queryJerry || savedJerry;
  } catch {
    return false;
  }
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("讀取圖片失敗"));
    reader.readAsDataURL(file);
  });
}

async function compressJerryImage(file) {
  if (!file?.type?.startsWith("image/")) throw new Error("只支援圖片檔");
  const src = await readImageAsDataUrl(file);
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("圖片解析失敗"));
    img.src = src;
  });
  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(image.width || 1, image.height || 1));
  const width = Math.max(1, Math.round((image.width || 1) * scale));
  const height = Math.max(1, Math.round((image.height || 1) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha:false });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  let quality = 0.68;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > 175000 && quality > 0.34) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrl.length > 220000) throw new Error("這張圖片壓縮後仍太大，請換一張較小的照片");
  return dataUrl;
}

function installJerryFirestoreImageUpload() {
  if (!isJerryAdminPage() || typeof document === "undefined") return;
  let currentProductId = "";

  document.addEventListener("click", (event) => {
    const editButton = event.target?.closest?.(".edit-product");
    if (editButton?.dataset?.productId) currentProductId = editButton.dataset.productId;
  }, true);

  document.addEventListener("change", async (event) => {
    const input = event.target;
    if (!input || input.id !== "imageFileInput") return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const files = [...(input.files || [])];
    if (!files.length) return;
    if (!currentProductId) {
      alert("請先從商品列表按「管理」，再上傳照片。");
      input.value = "";
      return;
    }

    const progress = document.querySelector("#uploadProgressText");
    try {
      const apps = getApps();
      const app = apps[0] || initializeApp(globalThis.LUCKY_GARAGE_FIREBASE_CONFIG || {});
      const auth = getAuth(app);
      const user = auth.currentUser;
      if (!user) throw new Error("尚未登入");
      const db = getFirestore(app);
      const productRef = doc(db, "shops", "jerry", "products", currentProductId);
      const snap = await getDoc(productRef);
      if (!snap.exists()) throw new Error("找不到這個商品");
      const product = snap.data() || {};
      const images = Array.isArray(product.images) ? [...product.images] : [];
      const remaining = Math.max(0, 4 - images.length);
      if (!remaining) throw new Error("每台車免費版最多 4 張照片，請先刪除舊照片");
      const selected = files.slice(0, remaining);

      for (let i = 0; i < selected.length; i += 1) {
        if (progress) progress.textContent = `壓縮並儲存 ${i + 1}/${selected.length}`;
        const dataUrl = await compressJerryImage(selected[i]);
        images.push({
          url:dataUrl,
          provider:"firestore-inline",
          isPrimary:images.length === 0,
          name:selected[i].name || `image-${Date.now()}-${i}.jpg`
        });
      }

      await setDoc(productRef, {
        images,
        shopId:"jerry",
        updatedAt:serverTimestamp(),
        updatedBy:user.uid
      }, { merge:true });

      if (progress) progress.textContent = files.length > selected.length ? `已儲存 ${selected.length} 張（上限 4 張）` : "已儲存，不需 Storage";
      input.value = "";
      setTimeout(() => globalThis.location?.reload(), 500);
    } catch (error) {
      console.error("Jerry Firestore image upload failed:", error);
      if (progress) progress.textContent = `失敗：${error?.message || "圖片儲存失敗"}`;
      alert(error?.message || "圖片儲存失敗");
      input.value = "";
    }
  }, true);

  const relabel = () => {
    const button = document.querySelector("#chooseImagesBtn");
    if (button) button.innerHTML = '<i class="fa-solid fa-images mr-1"></i>選擇照片（免費版）';
    const label = document.querySelector("#chooseImagesBtn")?.parentElement?.querySelector("label");
    if (label) label.innerHTML = '<i class="fa-solid fa-database text-sky-400 mr-2"></i>實車圖庫｜免 Storage';
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", relabel, { once:true });
  else relabel();
}

installJerryFirestoreImageUpload();
