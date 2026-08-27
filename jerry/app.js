import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { collection, doc, getDoc, getDocs, getFirestore } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const SHOP_ID = "jerry";
const app = initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG || {});
const db = getFirestore(app);
const $ = (selector) => document.querySelector(selector);

const DEFAULTS = {
  brandName: "傑瑞電動車",
  heroTitle: "Gogoro 維修、保養、改裝<br>一次處理好",
  heroSubtitle: "從日常保養、故障檢修，到外觀與性能改裝，讓你不用到處找店家。",
  contactTitle: "要維修、保養、改裝，先直接問",
  contactText: "把車況、需求、預算先說清楚，到店會比較快。",
  address: "新北市樹林區保安街一段366號 1樓",
  phone: "02-8686-0669",
  hours: "每日 12:00–21:00",
  lineUrl: "https://lin.ee/XWKMkhd",
  mapUrl: "https://www.google.com/maps/search/?api=1&query=%E5%82%91%E7%91%9E%E9%9B%BB%E5%8B%95%E8%BB%8A%20%E6%A8%B9%E6%9E%97",
  primaryColor: "#86efac"
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}
function money(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `NT$${Math.round(n).toLocaleString("zh-TW")}` : "請洽店家";
}
function safeUrl(value, fallback = "#") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  try {
    const url = new URL(text, location.href);
    if (["http:", "https:", "tel:"].includes(url.protocol)) return url.href;
  } catch {}
  return fallback;
}
function firstImage(item) {
  const list = Array.isArray(item?.images) ? item.images : [];
  const primary = list.find((image) => image?.isPrimary) || list[0];
  return typeof primary === "string" ? primary : primary?.url || item?.imageUrl || item?.photoUrl || "";
}

function applySettings(settings) {
  const s = { ...DEFAULTS, ...settings };
  document.documentElement.style.setProperty("--accent", s.primaryColor || DEFAULTS.primaryColor);
  document.title = `${s.brandName}｜Gogoro 維修・保養・改裝・銷售`;
  $("#brandName").textContent = s.brandName;
  $("#footerBrand").textContent = s.brandName;
  $("#storeName").textContent = s.brandName;
  $("#heroTitle").innerHTML = String(s.heroTitle || DEFAULTS.heroTitle);
  $("#heroSubtitle").textContent = s.heroSubtitle || DEFAULTS.heroSubtitle;
  $("#contactTitle").textContent = s.contactTitle || DEFAULTS.contactTitle;
  $("#contactText").textContent = s.contactText || DEFAULTS.contactText;
  $("#storeAddress").textContent = s.address || DEFAULTS.address;
  $("#storeHours").textContent = s.hours || DEFAULTS.hours;
  const phone = s.phone || DEFAULTS.phone;
  $("#storePhone").textContent = phone;
  $("#storePhone").href = `tel:${phone.replace(/[^0-9+]/g, "")}`;
  $("#lineBtn").href = safeUrl(s.lineUrl || DEFAULTS.lineUrl);
  $("#mapBtn").href = safeUrl(s.mapUrl || DEFAULTS.mapUrl);
  $("#mapBtn").target = "_blank";
  $("#lineBtn").target = "_blank";
  $("#headerCta").href = safeUrl(s.lineUrl || DEFAULTS.lineUrl, "#contact");
  $("#headerCta").target = "_blank";
  $("#heroPrimary").href = safeUrl(s.lineUrl || DEFAULTS.lineUrl, "#contact");
  $("#heroPrimary").target = "_blank";
  if (s.announcement) {
    $("#announcement").textContent = s.announcement;
    $("#announcement").hidden = false;
  }
}

async function loadSettings() {
  const [shopSnap, settingsSnap] = await Promise.all([
    getDoc(doc(db, "shops", SHOP_ID)),
    getDoc(doc(db, "shops", SHOP_ID, "siteSettings", "general"))
  ]);
  const shop = shopSnap.exists() ? shopSnap.data() : {};
  const settings = settingsSnap.exists() ? settingsSnap.data() : {};
  applySettings({ ...shop, ...settings, brandName: settings.brandName || shop.displayName || shop.name || DEFAULTS.brandName });
}

async function loadProducts() {
  const grid = $("#productGrid");
  try {
    const snap = await getDocs(collection(db, "shops", SHOP_ID, "products"));
    const products = snap.docs.map((item) => ({ id:item.id, ...item.data() }))
      .filter((item) => item.visible !== false)
      .sort((a,b) => Number(a.order || 999) - Number(b.order || 999));
    if (!products.length) {
      grid.innerHTML = '<div class="empty-card">目前還沒有公開車款。店家從後台建立商品後，這裡會自動出現。</div>';
      return;
    }
    grid.innerHTML = products.map((item) => {
      const image = firstImage(item);
      const price = item.priceLead || item.price || item.priceLithium;
      return `<article class="product-card">
        <div class="product-media">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.name || "車款")}" loading="lazy">` : `<span class="brand-mark">${escapeHtml(String(item.name || "J").slice(0,1))}</span>`}</div>
        <div class="product-body">
          <span class="product-tag">${escapeHtml(item.tag || "現場車款")}</span>
          <h3>${escapeHtml(item.name || "未命名車款")}</h3>
          <div class="product-style">${escapeHtml(item.style || "")}</div>
          <div class="product-price">${money(price)}</div>
          <div class="product-meta">實際車況、規格與交車內容請以店內確認為準。</div>
        </div>
      </article>`;
    }).join("");
  } catch (error) {
    console.error(error);
    grid.innerHTML = '<div class="empty-card">車款暫時讀取失敗，請稍後再試。</div>';
  }
}

async function loadCases() {
  const grid = $("#caseGrid");
  try {
    const snap = await getDocs(collection(db, "shops", SHOP_ID, "deliveryCases"));
    const cases = snap.docs.map((item) => ({ id:item.id, ...item.data() }))
      .filter((item) => item.visible !== false)
      .sort((a,b) => Number(a.order || 999) - Number(b.order || 999));
    if (!cases.length) {
      grid.innerHTML = '<div class="empty-card">案例正在整理中。之後從後台新增維修、改裝或交車案例，就會顯示在這裡。</div>';
      return;
    }
    grid.innerHTML = cases.map((item) => {
      const image = firstImage(item);
      return `<article class="case-card">
        ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.title || "案例")}" loading="lazy">` : ""}
        <div class="case-body"><h3>${escapeHtml(item.title || item.name || "服務案例")}</h3><p>${escapeHtml(item.description || item.text || item.subtitle || "")}</p></div>
      </article>`;
    }).join("");
  } catch (error) {
    console.error(error);
    grid.innerHTML = '<div class="empty-card">案例暫時讀取失敗，請稍後再試。</div>';
  }
}

$("#year").textContent = new Date().getFullYear();
Promise.allSettled([loadSettings(), loadProducts(), loadCases()]);