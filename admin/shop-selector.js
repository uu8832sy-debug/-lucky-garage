import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { collection, getDocs, getFirestore, query, where } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { resolveShopContext, setOwnerShop } from "../multi-shop-core.js";

const app = getApps().length ? getApp() : initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG || {});
const auth = getAuth(app);
const db = getFirestore(app);
const SESSION_KEY = "luckyGarageAdminShop";
const LOCAL_KEY = "luckyGarageAdminBrand";
const XIAOYU = { id:"xiaoyu", name:"小宇微電", displayName:"小宇微電", logoUrl:"/assets/brand/logo-round.webp", legacy:true, enabled:true, public:true };
const JERRY_FALLBACK = { id:"jerry", name:"傑瑞電動車", displayName:"傑瑞電動車", logoUrl:"/jerry/admin-logo.png", enabled:true, public:true };
let shops = [XIAOYU, JERRY_FALLBACK];

function safeId(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64);
}
function requestedShopId() {
  const queryId = safeId(new URLSearchParams(location.search).get("shop"));
  if (queryId) return queryId;
  return "xiaoyu";
}
function saveShop(shopId) {
  const id = safeId(shopId) || "xiaoyu";
  try { sessionStorage.setItem(SESSION_KEY, id); } catch {}
  try { localStorage.setItem(LOCAL_KEY, id); } catch {}
  try { setOwnerShop(id); } catch {}
}
function shopById(id) {
  return shops.find((shop) => shop.id === safeId(id)) || (safeId(id) === "xiaoyu" ? XIAOYU : null);
}
function routeFor(shopId) {
  const id = safeId(shopId) || "xiaoyu";
  if (id === "jerry") return "/jerry/admin.html?shop=jerry";
  return `/admin/index.html?shop=${encodeURIComponent(id)}`;
}
function frontFor(shop) {
  if (shop?.id === "xiaoyu") return "/";
  if (shop?.id === "jerry") return "/jerry/";
  return String(shop?.siteUrl || "").trim() || "/";
}
function applyBrand(shop) {
  if (!shop) return;
  const name = shop.displayName || shop.name || shop.id;
  document.title = `${name}｜管理員後台`;
  const headerTitle = document.querySelector("header h1");
  if (headerTitle) headerTitle.textContent = `${name}後台管理系統`;
  const loginTitle = document.querySelector("#loginCard h2");
  if (loginTitle) loginTitle.textContent = `${name}管理員登入`;
  const front = document.querySelector(".header-front-link") || [...document.querySelectorAll("#headerActions a")].find((a) => /查看前台/.test(a.textContent));
  if (front) front.href = frontFor(shop);
  document.querySelectorAll(".backend-logo-img,.admin-login-logo").forEach((img) => {
    img.src = shop.logoUrl || (shop.id === "xiaoyu" ? XIAOYU.logoUrl : "/icon-192.png");
    img.alt = `${name} Logo`;
  });
}
function syncAdminLinks(shopId) {
  const id = safeId(shopId) || "xiaoyu";
  const pages = new Set(["orders.html","site-settings.html","cases.html","platform.html","payment-settings.html","audit-log.html"]);
  document.querySelectorAll("a[href]").forEach((anchor) => {
    const raw = String(anchor.getAttribute("href") || "");
    const clean = raw.split(/[?#]/)[0].replace(/^\.\//, "");
    if (!pages.has(clean)) return;
    const url = new URL(anchor.href, location.href);
    url.searchParams.set("shop", id);
    anchor.setAttribute("href", `${clean}?${url.searchParams.toString()}`);
  });
}

async function loadShops() {
  const map = new Map([["xiaoyu", XIAOYU], ["jerry", JERRY_FALLBACK]]);
  try {
    const snap = await getDocs(query(collection(db, "shops"), where("public", "==", true)));
    snap.forEach((item) => {
      const data = item.data() || {};
      if (data.enabled === false) return;
      const id = safeId(item.id);
      if (!id) return;
      map.set(id, { id, ...data, name:data.name || data.displayName || id, displayName:data.displayName || data.name || id });
    });
  } catch (error) {
    console.warn("公開店家清單讀取失敗，使用內建選項：", error);
  }
  shops = [...map.values()].sort((a,b) => {
    if (a.id === "xiaoyu") return -1;
    if (b.id === "xiaoyu") return 1;
    return String(a.displayName || a.name).localeCompare(String(b.displayName || b.name), "zh-Hant");
  });
  return shops;
}

function renderLoginSelector() {
  const card = document.querySelector("#loginCard");
  if (!card) return;
  let wrap = card.querySelector(".shop-choice");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "shop-choice";
    const loginButton = card.querySelector("#loginBtn");
    loginButton?.before(wrap);
  }
  const selected = shopById(requestedShopId()) || XIAOYU;
  wrap.innerHTML = `
    <p style="margin:0 0 8px;font-size:12px;font-weight:900;color:#cbd5e1">選擇登入店家</p>
    <div style="display:grid;grid-template-columns:1fr auto;gap:8px">
      <select id="loginShopSelect" style="width:100%;background:#020617;color:#e2e8f0;border:1px solid #334155;border-radius:12px;padding:11px;font-weight:800"></select>
      <button id="loginShopApply" type="button" style="border:0;border-radius:12px;padding:0 14px;background:#22c55e;color:#052e16;font-weight:900">選擇</button>
    </div>
    <small style="display:block;margin-top:8px;color:#64748b;font-size:10px;line-height:1.5">每家店的商品、圖片、訂單與設定分開儲存。店家帳號登入後只會進入自己被授權的店家。</small>`;
  const select = wrap.querySelector("#loginShopSelect");
  select.innerHTML = shops.map((shop) => `<option value="${shop.id}">${shop.displayName || shop.name || shop.id}</option>`).join("");
  select.value = selected.id;
  applyBrand(selected);
  syncAdminLinks(selected.id);
  select.addEventListener("change", () => {
    const next = shopById(select.value) || XIAOYU;
    applyBrand(next);
  });
  wrap.querySelector("#loginShopApply")?.addEventListener("click", () => {
    const id = safeId(select.value) || "xiaoyu";
    saveShop(id);
    if (id === "jerry") {
      location.assign(routeFor(id));
      return;
    }
    const url = new URL(location.href);
    url.pathname = "/admin/index.html";
    url.search = "";
    url.searchParams.set("shop", id);
    history.replaceState(null, "", url.href);
    const shop = shopById(id) || XIAOYU;
    applyBrand(shop);
    syncAdminLinks(id);
  });
}

function renderOwnerSwitcher(activeId) {
  const identity = document.querySelector("#adminIdentity");
  const actions = document.querySelector("#headerActions");
  if (!identity || !actions || !/uu8832sr@gmail\.com/i.test(identity.textContent || "")) return;
  let select = document.querySelector("#ownerShopSwitcher");
  if (!select) {
    select = document.createElement("select");
    select.id = "ownerShopSwitcher";
    select.className = "owner-shop-switcher";
    actions.prepend(select);
  }
  select.innerHTML = shops.map((shop) => `<option value="${shop.id}">${shop.displayName || shop.name || shop.id}</option>`).join("");
  select.value = shopById(activeId)?.id || "xiaoyu";
  select.onchange = () => {
    const id = safeId(select.value) || "xiaoyu";
    saveShop(id);
    location.assign(routeFor(id));
  };
}

async function syncAuthenticatedContext(user) {
  if (!user) return;
  try {
    const context = await resolveShopContext(db, user);
    const actualId = safeId(context.shopId) || "xiaoyu";
    saveShop(actualId);
    if (actualId === "jerry" && !/^\/jerry(?:\/|$)/i.test(location.pathname)) {
      location.replace(routeFor("jerry"));
      return;
    }
    let shop = shopById(actualId);
    if (!shop) shop = { id:actualId, ...(context.shop || {}), name:context.shop?.name || context.shop?.displayName || actualId };
    applyBrand(shop);
    syncAdminLinks(actualId);
    setTimeout(() => renderOwnerSwitcher(actualId), 0);
  } catch (error) {
    console.warn("登入店家同步失敗：", error);
  }
}

await loadShops();
renderLoginSelector();
onAuthStateChanged(auth, (user) => syncAuthenticatedContext(user));
