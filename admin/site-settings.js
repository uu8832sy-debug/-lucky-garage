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
  heroTitle:"銷售、維修、保養、改裝\n一間店處理好",
  heroSubtitle:"樹林實體門市，Gogoro 維修保養、電動車銷售與客製改裝，都可以直接到店詢問。",
  announcement:"",
  phone:"(02) 8686-0669",
  hours:"週一至週日 12:00–21:00",
  address:"新北市樹林區保安街一段366號",
  lineUrl:"https://line.me/R/ti/p/@882npfrm",
  mapUrl:"https://www.google.com/maps/dir/?api=1&destination=%E6%96%B0%E5%8C%97%E5%B8%82%E6%A8%B9%E6%9E%97%E5%8D%80%E4%BF%9D%E5%AE%89%E8%A1%97%E4%B8%80%E6%AE%B5366%E8%99%9F",
  primaryColor:"#0869df"
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
  field("#primaryColor", data.primaryColor || "#0869df");
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
