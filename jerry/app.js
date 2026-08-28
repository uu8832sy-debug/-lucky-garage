import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { collection, doc, getDoc, getDocs, getFirestore } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const SHOP_ID = "jerry";
const app = initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG || {});
const db = getFirestore(app);
const $ = (selector) => document.querySelector(selector);
const PAYMENT_DEFAULTS = { cardSurcharge:3.5, minimumCardAmount:1500, defaultDownPayment:0, roundAmounts:true, plans:{3:{enabled:true,feePercent:3},6:{enabled:true,feePercent:5},12:{enabled:true,feePercent:8},18:{enabled:false,feePercent:10},24:{enabled:true,feePercent:12},30:{enabled:false,feePercent:15},36:{enabled:false,feePercent:18}} };
let paymentSettings = PAYMENT_DEFAULTS;
let selectedTerm = 12;

const DEFAULTS = {
  brandName: "傑瑞電動自行車",
  heroTitle: "銷售、維修、保養、改裝\n一間店處理好",
  heroSubtitle: "樹林實體門市，Gogoro 維修保養、電動車銷售與客製改裝，都可以直接到店詢問。",
  contactTitle: "直接來店，或先 LINE 問",
  contactText: "保安街郵局正對面。維修與保養基本上不用預約，依現場工位安排。",
  address: "新北市樹林區保安街一段366號",
  phone: "(02) 8686-0669",
  hours: "週一至週日 12:00–21:00",
  lineUrl: "https://line.me/R/ti/p/@882npfrm",
  mapUrl: "https://www.google.com/maps/search/?api=1&query=%E6%96%B0%E5%8C%97%E5%B8%82%E6%A8%B9%E6%9E%97%E5%8D%80%E4%BF%9D%E5%AE%89%E8%A1%97%E4%B8%80%E6%AE%B5366%E8%99%9F",
  primaryColor: "#e8ad4d"
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}
function multilineHtml(value) { return escapeHtml(value).replace(/\n/g, "<br>"); }
function money(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `NT$ ${Math.round(n).toLocaleString("zh-TW")}` : "請洽店家";
}
function plainMoney(value) { return `NT$ ${Number(value || 0).toLocaleString("zh-TW", {maximumFractionDigits:0})}`; }
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
  document.title = `${s.brandName}｜銷售・維修・保養・改裝`;
  $("#brandName").textContent = s.brandName;
  $("#footerBrand").textContent = s.brandName;
  $("#storeName").textContent = s.brandName;
  $("#heroTitle").innerHTML = multilineHtml(s.heroTitle || DEFAULTS.heroTitle);
  $("#heroSubtitle").textContent = s.heroSubtitle || DEFAULTS.heroSubtitle;
  $("#contactTitle").textContent = s.contactTitle || DEFAULTS.contactTitle;
  $("#contactText").textContent = s.contactText || DEFAULTS.contactText;
  $("#storeAddress").textContent = s.address || DEFAULTS.address;
  $("#storeHours").textContent = s.hours || DEFAULTS.hours;
  const phone = s.phone || DEFAULTS.phone;
  $("#storePhone").textContent = phone;
  $("#storePhone").href = `tel:${phone.replace(/[^0-9+]/g, "")}`;
  $("#lineBtn").href = safeUrl(s.lineUrl || DEFAULTS.lineUrl);
  $("#reservationLineBtn").href = safeUrl(s.lineUrl || DEFAULTS.lineUrl);
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
  try {
    const [shopSnap, settingsSnap] = await Promise.all([
      getDoc(doc(db, "shops", SHOP_ID)),
      getDoc(doc(db, "shops", SHOP_ID, "siteSettings", "general"))
    ]);
    const shop = shopSnap.exists() ? shopSnap.data() : {};
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    applySettings({ ...shop, ...settings, brandName: settings.brandName || shop.displayName || shop.name || DEFAULTS.brandName });
  } catch (error) {
    console.warn("Using Jerry defaults until tenant settings are available.", error);
    applySettings(DEFAULTS);
  }
}

async function loadPaymentSettings() {
  try { const snap = await getDoc(doc(db,"shops",SHOP_ID,"siteSettings","payment")); const data=snap.exists()?snap.data():{}; paymentSettings={...PAYMENT_DEFAULTS,...data,plans:{...PAYMENT_DEFAULTS.plans,...(data.plans||{})}}; }
  catch(error) { console.warn("Using default payment settings.",error); }
  const enabled = Object.entries(paymentSettings.plans).filter(([,p])=>p?.enabled).map(([t])=>Number(t)).sort((a,b)=>a-b);
  if (enabled.length && !enabled.includes(selectedTerm)) selectedTerm=enabled[0];
}

function rounded(value){ return paymentSettings.roundAmounts===false ? Math.round(value*100)/100 : Math.round(value); }
function renderTerms(){ const enabled=Object.entries(paymentSettings.plans).filter(([,p])=>p?.enabled).sort((a,b)=>Number(a[0])-Number(b[0])); $("#financeTerms").innerHTML=enabled.map(([term,p])=>`<button type="button" class="${Number(term)===selectedTerm?'active':''}" data-finance-term="${term}">${term} 期<small>總費率 ${Number(p.feePercent)||0}%</small></button>`).join("") || '<span class="finance-note">目前未開放分期方案</span>'; }
function calculateFinance(){ const basePrice=Math.max(0,Number($("#financePrice").value)||0), licenseFee=$("#financeLicense")?.checked?2500:0, price=basePrice+licenseFee, down=Math.min(price,Math.max(0,Number($("#financeDownPayment").value)||0)), surcharge=Number(paymentSettings.cardSurcharge)||0, cardTotal=rounded(price*(1+surcharge/100)), cardDown=price?rounded(down*(cardTotal/price)):0, principal=Math.max(0,cardTotal-cardDown), plan=paymentSettings.plans[selectedTerm], fee=Number(plan?.feePercent)||0, financed=rounded(principal*(1+fee/100)), grand=rounded(cardDown+financed), monthly=selectedTerm?rounded(financed/selectedTerm):0; $("#cardTotal").textContent=plainMoney(cardTotal);$("#installmentTotal").textContent=plan?.enabled?plainMoney(grand):"未開放";$("#monthlyPayment").textContent=plan?.enabled?plainMoney(monthly):"—";const minimum=Number(paymentSettings.minimumCardAmount)||0;$("#financeNote").textContent=price<minimum?`信用卡最低消費 ${plainMoney(minimum)}，此金額未達門檻。`:`代辦領牌 ${plainMoney(licenseFee)}；刷卡加價 ${surcharge}%；頭期款 ${plainMoney(down)}。此為試算，實際金額與核准條件以門市為準。`;const name=$("#financeProduct").textContent;$("#financeLine").href=`${DEFAULTS.lineUrl}?text=${encodeURIComponent(`${name}｜含領牌費 ${plainMoney(price)}｜${selectedTerm}期｜月付約 ${plainMoney(monthly)}`)}`; }
function openFinance(price,name){$("#financeProduct").textContent=name||"車款試算";$("#financePrice").value=Number(price)||0;$("#financeDownPayment").value=Math.min(Number(price)||0,Number(paymentSettings.defaultDownPayment)||0);renderTerms();calculateFinance();$("#financeModal").hidden=false;document.body.classList.add("modal-open");}
function closeFinance(){$("#financeModal").hidden=true;document.body.classList.remove("modal-open");}
document.addEventListener("click",event=>{const trigger=event.target.closest("[data-finance-price]");if(trigger)openFinance(trigger.dataset.financePrice,trigger.dataset.financeName);const term=event.target.closest("[data-finance-term]");if(term){selectedTerm=Number(term.dataset.financeTerm);renderTerms();calculateFinance();}if(event.target.closest("[data-close-finance]"))closeFinance();});
[$("#financePrice"),$("#financeDownPayment"),$("#financeLicense")].forEach(el=>el?.addEventListener("input",calculateFinance));
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!$("#financeModal").hidden)closeFinance();});

async function loadProducts() {
  const grid = $("#productGrid");
  try {
    const snap = await getDocs(collection(db, "shops", SHOP_ID, "products"));
    const products = snap.docs.map((item) => ({ id:item.id, ...item.data() }))
      .filter((item) => item.visible !== false)
      .sort((a,b) => Number(a.order || 999) - Number(b.order || 999));
    if (!products.length) {
      grid.innerHTML = '<div class="empty-card">目前現車由店家整理中。新車公開價格可先看上方價目表，實際庫存請直接 LINE 詢問。</div>';
      return;
    }
    const heroImage = firstImage(products[0]);
    if (heroImage) { $("#heroVisual").style.backgroundImage = `linear-gradient(180deg,rgba(12,24,28,.04),rgba(12,24,28,.72)),url("${String(heroImage).replace(/["\\]/g,"\\$&")}")`; $("#heroVisual").classList.add("has-photo"); }
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
          ${Number(price)>0?`<button class="product-finance-btn" data-finance-price="${Number(price)}" data-finance-name="${escapeHtml(item.name||'車款')}">查看詳情與分期試算</button>`:""}
        </div>
      </article>`;
    }).join("");
  } catch (error) {
    console.warn(error);
    grid.innerHTML = '<div class="empty-card">目前現車資料尚未開放。新車價格請先看上方價目表，庫存可直接 LINE 詢問。</div>';
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
      grid.innerHTML = '<div class="empty-card">維修與改裝案例正在整理中，之後店家從後台新增就會自動顯示。</div>';
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
    console.warn(error);
    grid.innerHTML = '<div class="empty-card">案例正在整理中。</div>';
  }
}

$("#year").textContent = new Date().getFullYear();
Promise.allSettled([loadSettings(), loadPaymentSettings(), loadProducts(), loadCases()]);
