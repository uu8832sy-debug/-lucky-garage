import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { collection, getDocs, getFirestore, query, where } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { resolveShopContext, setOwnerShop } from "../multi-shop-core.js";

const app = getApps().length ? getApp() : initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG || {});
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (selector) => document.querySelector(selector);
const SESSION_KEY = "luckyGarageAdminShop";
const LOCAL_KEY = "luckyGarageAdminBrand";
const AFTER_AUTH_KEY = "luckyGarageEnterAfterAuth";
const XIAOYU = { id:"xiaoyu", name:"小宇微電", displayName:"小宇微電", logoUrl:"/assets/brand/logo-round.webp", enabled:true, public:true, legacy:true };
const JERRY = { id:"jerry", name:"傑瑞電動車", displayName:"傑瑞電動車", logoUrl:"/jerry/admin-logo.png", enabled:true, public:true };
let shops = [XIAOYU, JERRY];
let selectedId = "xiaoyu";
let currentUser = null;
let routing = false;

function safeId(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64);
}
function esc(value) {
  return String(value ?? "").replace(/[&<>'\"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':"&quot;"}[c]));
}
function selectedShop() {
  return shops.find((shop) => shop.id === selectedId) || XIAOYU;
}
function routeFor(shopId) {
  const id = safeId(shopId) || "xiaoyu";
  if (id === "jerry") return "/jerry/admin.html?shop=jerry";
  return `/admin/index.html?shop=${encodeURIComponent(id)}`;
}
function rememberSelection(shopId) {
  selectedId = safeId(shopId) || "xiaoyu";
  try { sessionStorage.setItem(SESSION_KEY, selectedId); } catch {}
  try { localStorage.setItem(LOCAL_KEY, selectedId); } catch {}
  try { setOwnerShop(selectedId); } catch {}
}
function setStatus(message, type = "info") {
  const box = $("#status");
  if (!box) return;
  box.className = "rounded-2xl border p-4 text-sm leading-6";
  if (type === "error") box.classList.add("border-rose-500/30", "bg-rose-500/10", "text-rose-300");
  else if (type === "success") box.classList.add("border-emerald-500/30", "bg-emerald-500/10", "text-emerald-300");
  else box.classList.add("border-slate-700", "bg-slate-900", "text-slate-300");
  box.textContent = message;
  box.classList.remove("hidden");
}
function friendlyAuthError(error) {
  const code = String(error?.code || "");
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "帳號或密碼錯誤。";
  if (code.includes("too-many-requests")) return "登入嘗試次數過多，請稍後再試。";
  if (code.includes("unauthorized-domain")) return `目前網域 ${location.hostname} 尚未加入 Firebase 授權網域。`;
  if (code.includes("popup-closed-by-user")) return "Google 登入視窗已關閉。";
  if (code.includes("popup-blocked")) return "瀏覽器封鎖登入視窗，請允許彈出視窗後重試。";
  return error?.message || "登入失敗。";
}
async function loadShops() {
  const map = new Map([["xiaoyu", XIAOYU], ["jerry", JERRY]]);
  try {
    const snap = await getDocs(query(collection(db, "shops"), where("public", "==", true)));
    snap.forEach((item) => {
      const data = item.data() || {};
      if (data.enabled === false) return;
      const id = safeId(item.id);
      if (!id) return;
      map.set(id, {
        id,
        ...data,
        name:data.name || data.displayName || id,
        displayName:data.displayName || data.name || id,
        logoUrl:data.logoUrl || data.logo || ""
      });
    });
  } catch (error) {
    console.warn("店家清單讀取失敗，使用內建店家：", error);
  }
  shops = [...map.values()].sort((a,b) => {
    if (a.id === "xiaoyu") return -1;
    if (b.id === "xiaoyu") return 1;
    return String(a.displayName || a.name).localeCompare(String(b.displayName || b.name), "zh-Hant");
  });
}
function renderShops() {
  const requested = safeId(new URLSearchParams(location.search).get("shop"));
  const saved = safeId(sessionStorage.getItem(SESSION_KEY));
  const candidate = requested || saved || "xiaoyu";
  selectedId = shops.some((shop) => shop.id === candidate) ? candidate : "xiaoyu";

  const select = $("#shopSelect");
  select.innerHTML = shops.map((shop) => `<option value="${esc(shop.id)}">${esc(shop.displayName || shop.name || shop.id)}</option>`).join("");
  select.value = selectedId;

  const grid = $("#shopGrid");
  grid.innerHTML = shops.map((shop) => {
    const logo = shop.logoUrl || (shop.id === "xiaoyu" ? XIAOYU.logoUrl : (shop.id === "jerry" ? JERRY.logoUrl : ""));
    const initial = esc((shop.displayName || shop.name || shop.id).slice(0, 1));
    return `<button type="button" class="shop-card rounded-2xl p-4 text-left flex items-center gap-3" data-shop-id="${esc(shop.id)}" data-active="${shop.id === selectedId}">
      <span class="shop-logo w-14 h-14 rounded-2xl overflow-hidden grid place-items-center shrink-0 text-slate-900 font-black">${logo ? `<img src="${esc(logo)}" alt="" class="w-full h-full object-contain">` : initial}</span>
      <span class="min-w-0"><strong class="block text-base text-white truncate">${esc(shop.displayName || shop.name || shop.id)}</strong><small class="text-slate-500">${shop.id === "xiaoyu" ? "主店資料" : `shopId：${esc(shop.id)}`}</small></span>
      <i class="fa-solid fa-circle-check ml-auto text-emerald-400 ${shop.id === selectedId ? "" : "opacity-0"}"></i>
    </button>`;
  }).join("");
  $("#shopLoading")?.classList.add("hidden");
  grid.classList.remove("hidden");
  bindShopControls();
  updateSelectionUi();
}
function bindShopControls() {
  document.querySelectorAll("[data-shop-id]").forEach((button) => {
    button.onclick = () => {
      rememberSelection(button.dataset.shopId);
      $("#shopSelect").value = selectedId;
      updateSelectionUi();
    };
  });
  $("#shopSelect").onchange = () => {
    rememberSelection($("#shopSelect").value);
    updateSelectionUi();
  };
}
function updateSelectionUi() {
  const shop = selectedShop();
  document.querySelectorAll("[data-shop-id]").forEach((button) => {
    const active = button.dataset.shopId === selectedId;
    button.dataset.active = String(active);
    button.querySelector(".fa-circle-check")?.classList.toggle("opacity-0", !active);
  });
  $("#shopSelect").value = selectedId;
  $("#loginHeading").textContent = `登入 ${shop.displayName || shop.name || shop.id}`;
  $("#selectedShopHint").textContent = `目前選擇：${shop.displayName || shop.name || shop.id}`;
}
async function routeAuthenticatedUser(user) {
  if (!user || routing) return;
  routing = true;
  try {
    rememberSelection(selectedId);
    const context = await resolveShopContext(db, user);
    const actualId = safeId(context.shopId) || "xiaoyu";
    if (actualId !== selectedId && context.role !== "platformOwner") {
      const name = context.shop?.displayName || context.shop?.name || actualId;
      setStatus(`這個帳號綁定的是「${name}」，系統會帶你進自己的店家。`, "info");
      rememberSelection(actualId);
    }
    location.assign(routeFor(actualId));
  } catch (error) {
    console.error(error);
    setStatus(error?.message || "無法確認這個帳號的店家權限。", "error");
    routing = false;
  }
}
async function emailLogin() {
  const email = $("#emailInput").value.trim();
  const password = $("#passwordInput").value;
  if (!email || !password) return setStatus("請輸入 Email 與密碼。", "error");
  rememberSelection(selectedId);
  try { sessionStorage.setItem(AFTER_AUTH_KEY, "1"); } catch {}
  const button = $("#emailLoginBtn");
  button.disabled = true;
  button.textContent = "登入中…";
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    try { sessionStorage.removeItem(AFTER_AUTH_KEY); } catch {}
    await routeAuthenticatedUser(credential.user);
  } catch (error) {
    try { sessionStorage.removeItem(AFTER_AUTH_KEY); } catch {}
    setStatus(friendlyAuthError(error), "error");
    button.disabled = false;
    button.innerHTML = '<i class="fa-solid fa-right-to-bracket mr-2"></i>Email／密碼登入';
  }
}
async function googleLogin() {
  rememberSelection(selectedId);
  try { sessionStorage.setItem(AFTER_AUTH_KEY, "1"); } catch {}
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt:"select_account" });
  try {
    const credential = await signInWithPopup(auth, provider);
    try { sessionStorage.removeItem(AFTER_AUTH_KEY); } catch {}
    await routeAuthenticatedUser(credential.user);
  } catch (error) {
    const code = String(error?.code || "");
    if (code.includes("popup-blocked") || code.includes("operation-not-supported")) {
      await signInWithRedirect(auth, provider);
      return;
    }
    try { sessionStorage.removeItem(AFTER_AUTH_KEY); } catch {}
    setStatus(friendlyAuthError(error), "error");
  }
}
function renderAuthState(user) {
  currentUser = user || null;
  $("#signedInBox").classList.toggle("hidden", !user);
  $("#loginFields").classList.toggle("hidden", !!user);
  if (user) $("#signedInEmail").textContent = user.email || user.uid;
}

$("#emailLoginBtn").addEventListener("click", emailLogin);
$("#passwordInput").addEventListener("keydown", (event) => { if (event.key === "Enter") emailLogin(); });
$("#googleLoginBtn").addEventListener("click", googleLogin);
$("#enterSelectedBtn").addEventListener("click", () => routeAuthenticatedUser(currentUser));
$("#signOutBtn").addEventListener("click", async () => {
  await signOut(auth);
  routing = false;
  setStatus("已登出，可以選擇商家後用另一個帳號登入。", "success");
});

await loadShops();
renderShops();
onAuthStateChanged(auth, async (user) => {
  renderAuthState(user);
  let enterAfterAuth = false;
  try { enterAfterAuth = sessionStorage.getItem(AFTER_AUTH_KEY) === "1"; } catch {}
  if (user && enterAfterAuth) {
    try { sessionStorage.removeItem(AFTER_AUTH_KEY); } catch {}
    await routeAuthenticatedUser(user);
  }
});
