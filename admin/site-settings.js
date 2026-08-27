import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { getDoc, getFirestore, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { resolveShopContext, shopDoc } from "../multi-shop-core.js";

const app = initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG || {});
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (selector) => document.querySelector(selector);
let context = null;

const JERRY_DEFAULTS = {
  brandName:"傑瑞電動車",
  heroTitle:"Gogoro 維修、保養、改裝\n一次處理好",
  heroSubtitle:"從日常保養、故障檢修，到外觀與性能改裝，讓你不用到處找店家。",
  announcement:"",
  phone:"02-8686-0669",
  hours:"每日 12:00–21:00",
  address:"新北市樹林區保安街一段366號 1樓",
  lineUrl:"https://lin.ee/XWKMkhd",
  mapUrl:"https://www.google.com/maps/search/?api=1&query=%E5%82%91%E7%91%9E%E9%9B%BB%E5%8B%95%E8%BB%8A%20%E6%A8%B9%E6%9E%97",
  primaryColor:"#86efac"
};

function field(id, value) { const el = $(id); if (el) el.value = value ?? ""; }
function status(message, ok = false) {
  const box = $("#status");
  box.classList.remove("hidden", "text-emerald-400", "text-rose-400");
  box.classList.add(ok ? "text-emerald-400" : "text-rose-400");
  box.textContent = message;
}

async function loadEditor(user) {
  context = await resolveShopContext(db, user);
  $("#shopName").textContent = context.shop?.name || context.shop?.displayName || context.shopId;
  const ref = shopDoc(db, context, "siteSettings", "general");
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : {};
  const defaults = context.shopId === "jerry" ? JERRY_DEFAULTS : {};
  const data = { ...defaults, ...existing };
  field("#brandName", data.brandName || context.shop?.displayName || context.shop?.name || "");
  field("#heroTitle", data.heroTitle || "");
  field("#heroSubtitle", data.heroSubtitle || "");
  field("#announcement", data.announcement || "");
  field("#phone", data.phone || "");
  field("#hours", data.hours || "");
  field("#address", data.address || "");
  field("#lineUrl", data.lineUrl || "");
  field("#mapUrl", data.mapUrl || "");
  field("#primaryColor", data.primaryColor || "#86efac");
  $("#gate").classList.add("hidden");
  $("#editor").classList.remove("hidden");
}

$("#saveBtn").addEventListener("click", async () => {
  if (!context) return;
  const button = $("#saveBtn");
  button.disabled = true;
  button.textContent = "儲存中…";
  try {
    await setDoc(shopDoc(db, context, "siteSettings", "general"), {
      brandName:$("#brandName").value.trim(),
      heroTitle:$("#heroTitle").value.trim(),
      heroSubtitle:$("#heroSubtitle").value.trim(),
      announcement:$("#announcement").value.trim(),
      phone:$("#phone").value.trim(),
      hours:$("#hours").value.trim(),
      address:$("#address").value.trim(),
      lineUrl:$("#lineUrl").value.trim(),
      mapUrl:$("#mapUrl").value.trim(),
      primaryColor:$("#primaryColor").value,
      shopId:context.shopId,
      updatedAt:serverTimestamp(),
      updatedBy:auth.currentUser.uid
    }, { merge:true });
    status("網站內容已儲存", true);
  } catch (error) {
    console.error(error);
    status(error?.message || "儲存失敗");
  } finally {
    button.disabled = false;
    button.textContent = "儲存網站設定";
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    $("#gate").textContent = "請先回管理員後台登入。";
    return;
  }
  try { await loadEditor(user); }
  catch (error) {
    console.error(error);
    $("#gate").textContent = error?.message || "沒有權限讀取這家店。";
  }
});