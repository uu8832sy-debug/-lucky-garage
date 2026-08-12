import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";

const OWNER_EMAIL = "uu8832sr@gmail.com";
const VERSION = "32.0.0";
const firebaseConfig = window.LUCKY_GARAGE_FIREBASE_CONFIG || {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const clone = (value) => JSON.parse(JSON.stringify(value));

const DEFAULT_PRODUCTS = (Array.isArray(window.YU_PRODUCT_CATALOG) ? window.YU_PRODUCT_CATALOG : []).map((product, idx) => ({
  ...clone(product),
  order:Number(product.order || idx + 1),
  visible:product.visible !== false,
  images:normalizeAdminImages(product.images)
}));
const DEFAULT_SITE_SETTINGS = {
  announcementEnabled:false,
  announcementText:"",
  heroEyebrow:"工廠直營・全台到府交車",
  heroTitle:"找小宇買微電，",
  heroAccent:"不走彎路",
  heroDescription:"全台到府交車、線上看車、展示牌訂製與保固查詢，一站完成。",
  promoEnabled:false,
  promoTitle:"",
  promoText:"",
  promoButtonText:"立即了解",
  promoButtonUrl:"/products.html"
};

let currentUser = null;
let products = [];
let allOrders = [];
let websiteOrders = [];
let editingProductId = null;
let creatingProduct = false;
let storedProductIds = new Set();
let siteSettings = { ...DEFAULT_SITE_SETTINGS };
let deliveryCases = [];
let editingDeliveryId = null;
let deliveryImageDraft = "";

function normalizeAdminImages(items) {
  const arr = Array.isArray(items) ? items : [];
  const normalized = arr.map((image, index) => {
    if (typeof image === "string") return { url:String(image || "").trim(), path:"", isPrimary:false, static:true, _index:index };
    return {
      ...image,
      url:String(image?.url || image?.imageUrl || image?.src || "").trim(),
      path:String(image?.path || ""),
      isPrimary:image?.isPrimary === true,
      _index:index
    };
  }).filter((image) => image.url);
  if (!normalized.length) return [];
  let primaryIndex = normalized.findIndex((image) => image.isPrimary);
  if (primaryIndex < 0) primaryIndex = 0;
  normalized.forEach((image, index) => { image.isPrimary = index === primaryIndex; });
  const ordered = [normalized[primaryIndex], ...normalized.filter((_, index) => index !== primaryIndex)];
  return ordered.map(({ _index, ...image }) => image);
}
function normalizeEmail(value) { return String(value || "").trim().toLowerCase(); }
function money(value) { return `NT$${Math.max(0, Number(value) || 0).toLocaleString("zh-TW")}`; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function timestampMillis(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  const parsed = Date.parse(value || "");
  return Number.isNaN(parsed) ? 0 : parsed;
}
function formatDate(value) {
  const ms = timestampMillis(value);
  return ms ? new Intl.DateTimeFormat("zh-TW", { dateStyle:"short", timeStyle:"short" }).format(new Date(ms)) : "—";
}
function showToast(message, error = false) {
  const msg = $("#toastMsg");
  const toast = $("#toast");
  if (!msg || !toast) return;
  msg.textContent = message;
  toast.dataset.error = error ? "1" : "0";
  toast.classList.remove("translate-y-20", "opacity-0");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("translate-y-20", "opacity-0"), 3200);
}
function friendlyFirebaseError(error, action = "操作") {
  const code = String(error?.code || "");
  if (code.includes("permission-denied")) return `${action}被 Firebase 權限拒絕。請確認目前 Firebase Rules 已正確發布。`;
  if (code.includes("unauthenticated")) return "登入狀態已失效，請重新登入。";
  if (code.includes("unavailable")) return "Firebase 暫時無法連線，請稍後再試。";
  return error?.message || `${action}失敗`;
}
function setSystemStatus(key, ok, text) {
  const el = $(`[data-system-status="${key}"]`);
  if (!el) return;
  el.classList.toggle("status-ok", !!ok);
  el.classList.toggle("status-error", !ok);
  const label = el.querySelector("b");
  const desc = el.querySelector("small");
  if (label) label.textContent = ok ? "正常" : "需要處理";
  if (desc) desc.textContent = text;
}

async function isAdminUser(user) {
  if (!user || user.isAnonymous) return false;
  if (user.emailVerified && normalizeEmail(user.email) === OWNER_EMAIL) return true;
  try {
    const snap = await getDoc(doc(db, "admins", user.uid));
    return snap.exists() && snap.data().enabled === true;
  } catch {
    return false;
  }
}
async function beginLogin() {
  $("#loginMessage").textContent = "正在開啟 Google 登入…";
  $("#loginBtn").disabled = true;
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt:"select_account" });
    await signInWithPopup(auth, provider);
  } catch (error) {
    const code = String(error?.code || "");
    if (code.includes("popup-blocked") || code.includes("operation-not-supported")) {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt:"select_account" });
      await signInWithRedirect(auth, provider);
      return;
    }
    $("#loginMessage").textContent = error?.message || "登入失敗。";
  } finally {
    $("#loginBtn").disabled = false;
  }
}
function showLoggedOut() {
  currentUser = null;
  $("#loginCard")?.classList.remove("hidden");
  $("#deniedCard")?.classList.add("hidden");
  $("#adminApp")?.classList.add("hidden");
  $("#headerActions")?.classList.add("hidden");
}
function showDenied(user) {
  currentUser = user;
  $("#loginCard")?.classList.add("hidden");
  $("#deniedCard")?.classList.remove("hidden");
  $("#adminApp")?.classList.add("hidden");
  $("#deniedMessage").textContent = `目前登入：${user.email || user.uid}`;
}
async function showAdmin(user) {
  currentUser = user;
  $("#loginCard")?.classList.add("hidden");
  $("#deniedCard")?.classList.add("hidden");
  $("#adminApp")?.classList.remove("hidden");
  $("#headerActions")?.classList.remove("hidden");
  $("#headerActions")?.classList.add("flex");
  $("#adminIdentity").textContent = user.email || user.uid;
  setSystemStatus("auth", true, `管理員：${user.email || user.uid}`);
  await Promise.allSettled([loadOrders(), loadProducts(), loadSiteSettings(), loadDeliveryCases()]);
}

function normalizeOrder(item, sourceCollection = "orders") {
  const data = item.data();
  const total = Number(String(data.totalAmount || "").replace(/\D/g, "")) || Number(data.price || 0) || 0;
  return {
    id:item.id,
    orderNo:data.orderNo || data.orderId || item.id,
    customerName:data.customerName || data.custName || "未命名",
    phone:data.phone || data.custPhone || "—",
    address:data.address || data.custAddress || "—",
    model:data.model || data.itemName || "—",
    itemName:data.itemName || data.model || "—",
    variant:data.vehicleVariant || data.battery || "",
    color:data.color || "",
    price:total,
    status:data.status || (sourceCollection === "onlineOrders" ? "待審核" : "待訂金"),
    reviewStatus:String(data.reviewStatus || ""),
    source:String(data.source || ""),
    sourceCollection,
    createdAt:data.createdAt || data.timestamp || "",
    reviewedAt:data.reviewedAt || data.acceptedAt || data.rejectedAt || "",
    notes:data.notes || "",
    raw:data
  };
}
function isWebsiteCheckoutOrder(order) {
  const data = order?.raw || {};
  return String(data.source || "").startsWith("official-store") && String(data.createdBy || "") === "public-store";
}
function isAcceptedWebsiteOrder(order) {
  const data = order?.raw || {};
  return String(data.reviewStatus || "") === "accepted" || !!data.acceptedAt || data.migratedFromOnlineOrder === true;
}
function isRejectedWebsiteOrder(order) {
  const data = order?.raw || {};
  return String(data.reviewStatus || "") === "rejected" || !!data.rejectedAt;
}
function isPendingOnlineOrder(order) {
  const status = String(order?.reviewStatus || order?.raw?.reviewStatus || "pending");
  return status !== "accepted" && status !== "rejected";
}
async function loadOrders() {
  const tbody = $("#adminOrderTableBody");
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="p-5 text-center text-slate-500">讀取待審核訂單中…</td></tr>';
  try {
    const [historySnap, onlineSnap] = await Promise.all([
      getDocs(collection(db, "orders")),
      getDocs(collection(db, "onlineOrders"))
    ]);
    const rawHistory = historySnap.docs.map((item) => normalizeOrder(item, "orders"));
    const online = onlineSnap.docs.map((item) => normalizeOrder(item, "onlineOrders"));

    // 歷史訂單：手動建立的一律保留；官網訂單必須經過「接受」才算正式歷史訂單。
    allOrders = rawHistory
      .filter((order) => !isWebsiteCheckoutOrder(order) || isAcceptedWebsiteOrder(order))
      .sort((a,b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));

    // 相容 V30 以前已直接寫進 orders 的官網單：先重新當成待審核，不讓它直接出現在歷史訂單。
    const legacyPending = rawHistory
      .filter((order) => isWebsiteCheckoutOrder(order) && !isAcceptedWebsiteOrder(order) && !isRejectedWebsiteOrder(order))
      .map((order) => ({ ...order, reviewStatus:"pending", legacyPending:true }));

    websiteOrders = [
      ...online.filter(isPendingOnlineOrder).map((order) => ({ ...order, reviewStatus:"pending" })),
      ...legacyPending
    ].sort((a,b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));

    renderOrders();
    renderPlateOrders();
    renderDashboardStats();
    renderCustomers();
    setSystemStatus("orders", true, `${websiteOrders.length} 筆待審核；${allOrders.length} 筆正式歷史訂單`);
  } catch (error) {
    console.error(error);
    setSystemStatus("orders", false, friendlyFirebaseError(error, "訂單讀取"));
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="p-5 text-center text-rose-400">${escapeHtml(friendlyFirebaseError(error, "訂單載入"))}</td></tr>`;
  }
}
function renderDashboardStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const vehicle = websiteOrders.filter((o) => o.source === "official-store").length;
  const plate = websiteOrders.filter((o) => o.source === "official-store-plate").length;
  const today = websiteOrders.filter((o) => timestampMillis(o.createdAt) >= todayStart).length;
  const pendingAmount = websiteOrders.reduce((sum,o) => sum + Number(o.price || 0),0);
  const stats = { total:websiteOrders.length, open:vehicle, month:plate, today, revenue:money(pendingAmount) };
  Object.entries(stats).forEach(([key,value]) => { const el = $(`[data-stat="${key}"]`); if (el) el.textContent = value; });
}
function bindPendingOrderActions(scope = document) {
  scope.querySelectorAll(".view-order").forEach((button) => button.addEventListener("click", () => openOrderDetail(button.dataset.orderId)));
  scope.querySelectorAll(".accept-order").forEach((button) => button.addEventListener("click", async () => {
    const id = button.dataset.orderId;
    const order = websiteOrders.find((item) => item.id === id);
    if (!order) return;
    if (!window.confirm(`確定接受 ${order.orderNo}？\n接受後會正式移到「完整訂單／歷史訂單」。`)) return;
    await reviewOnlineOrder(id, "accept", button);
  }));
  scope.querySelectorAll(".reject-order").forEach((button) => button.addEventListener("click", async () => {
    const id = button.dataset.orderId;
    const order = websiteOrders.find((item) => item.id === id);
    if (!order) return;
    if (!window.confirm(`確定拒絕 ${order.orderNo}？\n拒絕後不會進入歷史訂單。`)) return;
    await reviewOnlineOrder(id, "reject", button);
  }));
}
function renderOrders() {
  const keyword = String($("#orderSearch")?.value || "").trim().toLowerCase();
  const list = websiteOrders.filter((o) => o.source === "official-store" && [o.orderNo,o.customerName,o.phone,o.address,o.model,o.variant,o.color].join(" ").toLowerCase().includes(keyword));
  const tbody = $("#adminOrderTableBody");
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-5 text-center text-slate-500">目前沒有待審核的微電線上訂單</td></tr>';
    return;
  }
  tbody.innerHTML = list.map((o) => `<tr data-review-row="${escapeHtml(o.id)}">
    <td class="p-3 text-emerald-400 font-bold">${escapeHtml(o.orderNo)}</td>
    <td class="p-3"><strong class="text-white block">${escapeHtml(o.customerName)}</strong><a class="admin-phone" href="tel:${escapeHtml(o.phone)}">${escapeHtml(o.phone)}</a></td>
    <td class="p-3"><strong class="block">${escapeHtml(o.model)}</strong><small class="text-slate-500">${escapeHtml([o.variant,o.color].filter(Boolean).join("｜"))}</small></td>
    <td class="p-3 order-address">${escapeHtml(o.address)}</td>
    <td class="p-3 font-bold">${money(o.price)}</td>
    <td class="p-3"><span class="review-badge pending">待審核</span></td>
    <td class="p-3 text-slate-500">${formatDate(o.createdAt)}</td>
    <td class="p-3 text-right"><div class="row-actions"><button class="view-order tiny-btn secondary" data-order-id="${escapeHtml(o.id)}" type="button">查看</button><button class="accept-order tiny-btn accept" data-order-id="${escapeHtml(o.id)}" type="button">接受</button><button class="reject-order tiny-btn danger" data-order-id="${escapeHtml(o.id)}" type="button">拒絕</button></div></td>
  </tr>`).join("");
  bindPendingOrderActions(tbody);
}
function renderPlateOrders() {
  const keyword = String($("#plateOrderSearch")?.value || "").trim().toLowerCase();
  const plateOrders = websiteOrders.filter((o) => o.source === "official-store-plate");
  const list = plateOrders.filter((o) => [o.orderNo,o.customerName,o.phone,o.address,o.itemName,o.variant,o.notes].join(" ").toLowerCase().includes(keyword));
  const tbody = $("#plateOrderTableBody");
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const stats = {
    total:plateOrders.length,
    today:plateOrders.filter((o) => timestampMillis(o.createdAt) >= todayStart).length,
    revenue:money(plateOrders.reduce((sum,o) => sum + Number(o.price || 0),0))
  };
  Object.entries(stats).forEach(([key,value]) => { const el=$(`[data-plate-stat="${key}"]`); if(el) el.textContent=value; });
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-5 text-center text-slate-500">目前沒有待審核的車牌線上訂單</td></tr>';
    return;
  }
  tbody.innerHTML = list.map((o) => `<tr data-review-row="${escapeHtml(o.id)}">
    <td class="p-3 text-emerald-400 font-bold">${escapeHtml(o.orderNo)}</td>
    <td class="p-3"><strong class="text-white block">${escapeHtml(o.customerName)}</strong><a class="admin-phone" href="tel:${escapeHtml(o.phone)}">${escapeHtml(o.phone)}</a></td>
    <td class="p-3"><strong class="block">${escapeHtml(o.itemName)}</strong><small class="text-slate-500">${escapeHtml(o.variant || "紀念展示")}</small></td>
    <td class="p-3 order-address">${escapeHtml(o.address)}</td>
    <td class="p-3 font-bold">${money(o.price)}</td>
    <td class="p-3 text-slate-500">${formatDate(o.createdAt)}</td>
    <td class="p-3 text-right"><div class="row-actions"><button class="view-order tiny-btn secondary" data-order-id="${escapeHtml(o.id)}" type="button">查看</button><button class="accept-order tiny-btn accept" data-order-id="${escapeHtml(o.id)}" type="button">接受</button><button class="reject-order tiny-btn danger" data-order-id="${escapeHtml(o.id)}" type="button">拒絕</button></div></td>
  </tr>`).join("");
  bindPendingOrderActions(tbody);
}
async function reviewOnlineOrder(id, action, triggerButton) {
  const order = websiteOrders.find((item) => item.id === id);
  if (!order) return;
  const row = document.querySelector(`[data-review-row="${CSS.escape(id)}"]`);
  const buttons = row ? [...row.querySelectorAll("button")] : [triggerButton].filter(Boolean);
  buttons.forEach((button) => { button.disabled = true; });
  try {
    if (order.legacyPending) {
      // V30 以前的官網訂單已經在 orders 裡，因此接受時只補上核准標記；拒絕則標記為 rejected。
      await updateDoc(doc(db, "orders", id), action === "accept" ? {
        reviewStatus:"accepted",
        acceptedAt:serverTimestamp(),
        reviewedAt:serverTimestamp(),
        reviewedBy:currentUser.uid,
        updatedAt:serverTimestamp(),
        updatedBy:currentUser.uid
      } : {
        reviewStatus:"rejected",
        rejectedAt:serverTimestamp(),
        reviewedAt:serverTimestamp(),
        reviewedBy:currentUser.uid,
        updatedAt:serverTimestamp(),
        updatedBy:currentUser.uid
      });
    } else if (action === "accept") {
      await runTransaction(db, async (transaction) => {
        const pendingRef = doc(db, "onlineOrders", id);
        const historyRef = doc(db, "orders", id);
        const pendingSnap = await transaction.get(pendingRef);
        if (!pendingSnap.exists()) throw new Error("這筆待審訂單已不存在，請重新整理。");
        const pendingData = pendingSnap.data();
        if (String(pendingData.reviewStatus || "pending") !== "pending") throw new Error("這筆訂單已經處理過。請重新整理。");
        const historySnap = await transaction.get(historyRef);
        if (historySnap.exists()) throw new Error("歷史訂單已有相同訂單編號，已阻止重複轉入。");

        const historyData = { ...pendingData };
        delete historyData.reviewedAt;
        delete historyData.reviewedBy;
        delete historyData.rejectedAt;
        delete historyData.historicalOrderId;
        transaction.set(historyRef, {
          ...historyData,
          status:"待訂金",
          reviewStatus:"accepted",
          acceptedAt:serverTimestamp(),
          reviewedAt:serverTimestamp(),
          reviewedBy:currentUser.uid,
          migratedFromOnlineOrder:true,
          updatedAt:serverTimestamp(),
          updatedBy:currentUser.uid
        });
        transaction.update(pendingRef, {
          reviewStatus:"accepted",
          historicalOrderId:id,
          reviewedAt:serverTimestamp(),
          reviewedBy:currentUser.uid,
          updatedAt:serverTimestamp(),
          updatedBy:currentUser.uid
        });
      });
    } else {
      await updateDoc(doc(db, "onlineOrders", id), {
        reviewStatus:"rejected",
        rejectedAt:serverTimestamp(),
        reviewedAt:serverTimestamp(),
        reviewedBy:currentUser.uid,
        updatedAt:serverTimestamp(),
        updatedBy:currentUser.uid
      });
    }
    showToast(action === "accept" ? "已接受訂單，已轉入歷史訂單。" : "已拒絕訂單，不會進入歷史訂單。");
    await loadOrders();
    if (action === "accept") refreshFullOrdersFrame();
  } catch (error) {
    console.error(error);
    showToast(friendlyFirebaseError(error, action === "accept" ? "接受訂單" : "拒絕訂單"), true);
    buttons.forEach((button) => { button.disabled = false; });
  }
}
function refreshFullOrdersFrame() {
  const frame = $("#ordersFrame");
  const src = frame?.getAttribute("src");
  if (!frame || !src) return;
  try {
    const url = new URL(src, location.href);
    url.searchParams.set("refresh", String(Date.now()));
    frame.src = url.toString();
  } catch { frame.src = src; }
}
function openOrderDetail(id) {
  const o = websiteOrders.find((item) => item.id === id);
  if (!o) return;
  const type = o.source === "official-store-plate" ? "紀念展示牌" : "微型電動二輪";
  $("#orderDetailContent").innerHTML = `
    <div class="detail-grid"><span>訂單編號</span><b>${escapeHtml(o.orderNo)}</b><span>審核狀態</span><b>待審核</b><span>類型</span><b>${escapeHtml(type)}</b><span>客戶</span><b>${escapeHtml(o.customerName)}</b><span>電話</span><b>${escapeHtml(o.phone)}</b><span>車款／項目</span><b>${escapeHtml(o.itemName)}</b><span>版本／顏色</span><b>${escapeHtml([o.variant,o.color].filter(Boolean).join("｜"))}</b><span>地址</span><b>${escapeHtml(o.address)}</b><span>總額</span><b>${money(o.price)}</b><span>建立</span><b>${escapeHtml(formatDate(o.createdAt))}</b></div>
    ${o.notes ? `<div class="detail-note">${escapeHtml(o.notes)}</div>` : ""}`;
  const modal = $("#orderDetailModal");
  modal.classList.remove("hidden"); modal.classList.add("flex");
}
function closeOrderDetail() { const modal=$("#orderDetailModal"); modal?.classList.add("hidden"); modal?.classList.remove("flex"); }

function renderCustomers() {
  const tbody = $("#customerTableBody");
  if (!tbody) return;
  const keyword = String($("#customerSearch")?.value || "").trim().toLowerCase();
  const map = new Map();
  for (const o of allOrders) {
    const key = String(o.phone || o.customerName || o.id).replace(/\s+/g, "");
    if (!map.has(key)) map.set(key, { name:o.customerName, phone:o.phone, address:o.address, count:0, total:0, lastAt:o.createdAt, lastModel:o.model });
    const c = map.get(key);
    c.count += 1;
    c.total += Number(o.price || 0);
    if (timestampMillis(o.createdAt) > timestampMillis(c.lastAt)) { c.name=o.customerName; c.address=o.address; c.lastAt=o.createdAt; c.lastModel=o.model; }
  }
  const list = [...map.values()].filter((c) => [c.name,c.phone,c.address,c.lastModel].join(" ").toLowerCase().includes(keyword)).sort((a,b) => timestampMillis(b.lastAt)-timestampMillis(a.lastAt));
  tbody.innerHTML = list.length ? list.map((c) => `<tr><td class="p-3"><b>${escapeHtml(c.name)}</b></td><td class="p-3"><a class="admin-phone" href="tel:${escapeHtml(c.phone)}">${escapeHtml(c.phone)}</a></td><td class="p-3 order-address">${escapeHtml(c.address)}</td><td class="p-3">${c.count}</td><td class="p-3">${money(c.total)}</td><td class="p-3">${escapeHtml(c.lastModel)}</td><td class="p-3 text-slate-500">${formatDate(c.lastAt)}</td></tr>`).join("") : '<tr><td colspan="7" class="p-5 text-center text-slate-500">目前沒有客戶資料</td></tr>';
  const count = $("#customerCount"); if (count) count.textContent = `${list.length} 位`;
}

async function loadProducts() {
  const tbody = $("#adminProductTableBody");
  if (tbody) tbody.innerHTML = '<tr><td colspan="10" class="p-5 text-center text-slate-500">讀取商品中…</td></tr>';
  try {
    const snap = await getDocs(collection(db,"products"));
    const remote = snap.docs.map((item) => ({ id:item.id, ...item.data() })).filter((item) => !String(item.id).startsWith("__"));
    storedProductIds = new Set(remote.map((item) => item.id));
    const remoteMap = new Map(remote.map((item) => [item.id, item]));
    products = DEFAULT_PRODUCTS.map((item) => {
      const remoteItem = remoteMap.get(item.id);
      if (!remoteItem) return { ...clone(item), builtInOnly:true };
      return { ...clone(item), ...remoteItem, images:normalizeAdminImages(Array.isArray(remoteItem.images) && remoteItem.images.length ? remoteItem.images : item.images), builtInOnly:false };
    });
    for (const item of remote) {
      if (!products.some((product) => product.id === item.id)) products.push({ ...item, images:normalizeAdminImages(item.images), builtInOnly:false });
    }
    products.sort((a,b) => Number(a.order||999)-Number(b.order||999));
    renderProducts();
    setSystemStatus("products", true, `${remote.length} 款已存雲端，${products.length} 款可管理`);
  } catch (error) {
    console.error(error);
    setSystemStatus("products", false, friendlyFirebaseError(error, "商品讀取"));
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="p-5 text-center text-rose-400">${escapeHtml(friendlyFirebaseError(error, "商品載入"))}</td></tr>`;
  }
}
function renderProducts() {
  const tbody = $("#adminProductTableBody");
  if (!tbody) return;
  const keyword = String($("#productSearch")?.value || "").trim().toLowerCase();
  const list = products.filter((p) => [p.name,p.style,(p.colors||[]).join(" ")].join(" ").toLowerCase().includes(keyword));
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="10" class="p-5 text-center text-slate-500">沒有符合條件的商品</td></tr>'; return; }
  tbody.innerHTML = list.map((p, idx) => `<tr>
    <td class="p-3 text-slate-400"><div class="sort-actions"><button class="move-product" data-dir="up" data-product-id="${escapeHtml(p.id)}" ${idx===0?"disabled":""}>↑</button><span>${Number(p.order||0)}</span><button class="move-product" data-dir="down" data-product-id="${escapeHtml(p.id)}" ${idx===list.length-1?"disabled":""}>↓</button></div></td>
    <td class="p-3"><div class="product-thumb-admin">${p.images?.[0]?.url ? `<img src="${escapeHtml(p.images[0].url)}" alt="">` : "—"}<small>${p.images?.length||0} 張</small></div></td>
    <td class="p-3 font-bold text-white">${escapeHtml(p.name)}${p.builtInOnly?'<small class="builtin-badge">內建</small>':''}</td>
    <td class="p-3 text-slate-400">${escapeHtml(p.style||"")}</td>
    <td class="p-3">${money(p.priceLead)}</td>
    <td class="p-3">${Number(p.priceTernary||0)>0?money(p.priceTernary):"不提供"}</td>
    <td class="p-3">${Number(p.priceLithium||0)>0?money(p.priceLithium):"不提供"}</td>
    <td class="p-3"><button class="quick-visible ${p.visible===false?'is-off':''}" data-product-id="${escapeHtml(p.id)}" type="button">${p.visible===false?"已下架":"上架中"}</button></td>
    <td class="p-3 text-slate-500">${escapeHtml((p.colors||[]).slice(0,3).join("、"))}</td>
    <td class="p-3 text-right"><div class="row-actions"><button class="edit-product tiny-btn" data-product-id="${escapeHtml(p.id)}">編輯</button><button class="duplicate-product tiny-btn secondary" data-product-id="${escapeHtml(p.id)}">複製</button></div></td>
  </tr>`).join("");
  $$(".edit-product").forEach((button) => button.addEventListener("click", () => openProductModal(button.dataset.productId)));
  $$(".duplicate-product").forEach((button) => button.addEventListener("click", () => duplicateProduct(button.dataset.productId).catch((e)=>showToast(friendlyFirebaseError(e,"商品複製"),true))));
  $$(".quick-visible").forEach((button) => button.addEventListener("click", () => toggleProductVisible(button.dataset.productId).catch((e)=>showToast(friendlyFirebaseError(e,"上下架"),true))));
  $$(".move-product").forEach((button) => button.addEventListener("click", () => moveProduct(button.dataset.productId, button.dataset.dir).catch((e)=>showToast(friendlyFirebaseError(e,"排序"),true))));
}
async function seedProducts() {
  const batch = writeBatch(db); let count = 0;
  for (const product of DEFAULT_PRODUCTS) {
    if (!storedProductIds.has(product.id)) {
      batch.set(doc(db,"products",product.id), { ...clone(product), schemaVersion:32, createdAt:serverTimestamp(), updatedAt:serverTimestamp(), createdBy:currentUser.uid, updatedBy:currentUser.uid });
      count += 1;
    }
  }
  if (!count) return showToast("預設商品已全部存在雲端");
  await batch.commit();
  showToast(`已同步 ${count} 款商品到雲端`);
  await loadProducts();
}
function fillProductForm(p, title) {
  $("#editModalProductTitle").textContent = title;
  $("#editProductIdInput").value = p.id || "";
  $("#editOrderInput").value = Number(p.order || 999);
  $("#editNameInput").value = p.name || "";
  $("#editStyleInput").value = p.style || "";
  $("#editColorsInput").value = Array.isArray(p.colors) ? p.colors.join("、") : "";
  $("#editPriceLeadInput").value = Number(p.priceLead || 0) || "";
  $("#editPriceTernaryInput").value = Number(p.priceTernary || 0) || "";
  $("#editPriceLithiumInput").value = Number(p.priceLithium || 0) || "";
  $("#editRangeLeadInput").value = p.rangeLead || "";
  $("#editRangeTernaryInput").value = p.rangeTernary || "";
  $("#editRangeLithiumInput").value = p.rangeLithium || "";
  $("#editLifeLeadInput").value = p.lifeLead || "約 2 年";
  $("#editLifeTernaryInput").value = p.lifeTernary || "";
  $("#editLifeLithiumInput").value = p.lifeLithium || "";
  $("#editDescriptionInput").value = p.description || "";
  $("#editFeaturesInput").value = Array.isArray(p.features) ? p.features.join("\n") : "";
  $("#editNoteInput").value = p.note || "";
  $("#editVisibleInput").checked = p.visible !== false;
  renderGallery(p);
  const isDefault = DEFAULT_PRODUCTS.some((item)=>item.id===p.id);
  $("#deleteProductBtn").textContent = isDefault ? "恢復內建預設" : "刪除商品";
  const modal=$("#editProductModal"); modal.classList.remove("hidden"); modal.classList.add("flex");
}
function openProductModal(productId) {
  creatingProduct = false; editingProductId = productId;
  const p = products.find((item) => item.id === productId); if (!p) return;
  fillProductForm(p, `編輯 ${p.name}${p.style?`（${p.style}）`:""}`);
}
function newProduct() {
  creatingProduct = true;
  editingProductId = `custom-${Date.now()}`;
  const nextOrder = products.reduce((max,p)=>Math.max(max,Number(p.order||0)),0)+1;
  const p={ id:editingProductId,order:nextOrder,name:"",style:"",colors:[],priceLead:0,priceTernary:null,priceLithium:null,rangeLead:"",rangeTernary:"",rangeLithium:"",lifeLead:"約 2 年",lifeTernary:"",lifeLithium:"",description:"",features:[],note:"",visible:true,images:[],builtInOnly:false };
  products.push(p); fillProductForm(p,"新增商品");
}
function closeProductModal() {
  const modal=$("#editProductModal"); modal?.classList.add("hidden"); modal?.classList.remove("flex");
  if (creatingProduct && editingProductId && !storedProductIds.has(editingProductId)) { products=products.filter((p)=>p.id!==editingProductId); renderProducts(); }
  editingProductId=null; creatingProduct=false;
  if ($("#imageFileInput")) $("#imageFileInput").value="";
  if ($("#uploadProgressText")) $("#uploadProgressText").textContent="";
}
function renderGallery(product) {
  const images=normalizeAdminImages(product.images); product.images=images;
  const grid=$("#productGalleryGrid"); if (!grid) return;
  if (!images.length) { grid.innerHTML='<div class="col-span-full text-slate-500 text-center py-4">尚無圖片</div>'; return; }
  grid.innerHTML=images.map((img,i)=>`<div class="gallery-item ${img.isPrimary?'is-primary':''}"><img src="${escapeHtml(img.url)}" alt="${escapeHtml(product.name)} 圖片 ${i+1}"><div>${img.isPrimary?'<span>主圖</span>':`<button class="set-primary" data-index="${i}">設主圖</button>`}<button class="delete-image" data-index="${i}">刪除</button></div></div>`).join("");
  $$(".set-primary").forEach((b)=>b.addEventListener("click",()=>setPrimaryImage(Number(b.dataset.index)).catch((e)=>showToast(friendlyFirebaseError(e,"主圖設定"),true))));
  $$(".delete-image").forEach((b)=>b.addEventListener("click",()=>deleteImage(Number(b.dataset.index)).catch((e)=>showToast(friendlyFirebaseError(e,"圖片刪除"),true))));
}
async function compressImage(file, maxSide=1200, maxChars=250000) {
  const bitmap=await createImageBitmap(file); const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement("canvas"); canvas.width=Math.max(1,Math.round(bitmap.width*scale)); canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext("2d",{alpha:false}); ctx.drawImage(bitmap,0,0,canvas.width,canvas.height); if (bitmap.close) bitmap.close();
  let q=.82, data=canvas.toDataURL("image/jpeg",q); while(data.length>maxChars && q>.38){q-=.08;data=canvas.toDataURL("image/jpeg",q);} if(data.length>maxChars+60000) throw new Error("照片壓縮後仍過大，請先裁切再上傳。"); return data;
}
async function saveEmbeddedImage(product,file){const count=(product.images||[]).filter((img)=>img?.embedded).length;if(count>=3)throw new Error("未啟用 Storage 時，每台車最多直接存 3 張自訂照片。");const dataUrl=await compressImage(file,1100,210000);product.images.push({url:dataUrl,path:"",isPrimary:product.images.length===0,embedded:true});}
async function uploadImages(files) {
  const product=products.find((p)=>p.id===editingProductId); if(!product||!files.length)return;
  if(creatingProduct&&!storedProductIds.has(product.id)){showToast("請先儲存商品基本資料，再上傳圖片");return;}
  product.images=normalizeAdminImages(product.images);
  const newlyAdded=[];
  for(let i=0;i<files.length;i+=1){
    const file=files[i];
    $("#uploadProgressText").textContent=`處理 ${i+1}/${files.length}`;
    let imageRecord=null;
    try{
      const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
      const path=`products/${product.id}/${Date.now()}_${i}_${safe}`;
      const objectRef=ref(storage,path);
      await uploadBytes(objectRef,file,{contentType:file.type||"image/jpeg"});
      const url=await getDownloadURL(objectRef);
      imageRecord={url,path,isPrimary:false,uploadedAt:Date.now()};
    }catch(error){
      console.warn("Storage fallback",error);
      const before=product.images.length;
      await saveEmbeddedImage(product,file);
      imageRecord=product.images.splice(before,1)[0] || null;
      if(imageRecord) imageRecord.uploadedAt=Date.now();
    }
    if(imageRecord){ product.images.push(imageRecord); newlyAdded.push(imageRecord); }
  }
  if(!newlyAdded.length) throw new Error("沒有可儲存的圖片");
  // 每次新上傳時，第一張新照片自動成為主圖，讓前台商品卡立即看得到。
  const firstNew=newlyAdded[0];
  product.images=product.images.map((img)=>({...img,isPrimary:img===firstNew}));
  product.images=normalizeAdminImages(product.images);
  await setDoc(doc(db,"products",product.id),{images:product.images,primaryImageUrl:product.images[0]?.url||"",schemaVersion:32,updatedAt:serverTimestamp(),updatedBy:currentUser.uid},{merge:true});
  storedProductIds.add(product.id);
  // 重新讀雲端確認，避免畫面只更新本機但 Firestore 實際沒存成功。
  const verify=await getDoc(doc(db,"products",product.id));
  if(!verify.exists() || !Array.isArray(verify.data()?.images) || !verify.data().images.length) throw new Error("圖片未成功寫入商品資料，請確認 Firebase 權限。");
  $("#uploadProgressText").textContent="完成・新照片已設為主圖";
  await loadProducts();
  const refreshed=products.find((p)=>p.id===editingProductId);
  if(refreshed) renderGallery(refreshed);
  showToast("圖片已儲存，新上傳第一張已設為前台主圖");
}
async function setPrimaryImage(index){
  const product=products.find((p)=>p.id===editingProductId);if(!product)return;
  const normalized=normalizeAdminImages(product.images);
  if(!normalized[index])return;
  product.images=normalizeAdminImages(normalized.map((img,i)=>({...img,isPrimary:i===index})));
  await setDoc(doc(db,"products",product.id),{images:product.images,primaryImageUrl:product.images[0]?.url||"",updatedAt:serverTimestamp(),updatedBy:currentUser.uid},{merge:true});
  await loadProducts();
  const refreshed=products.find((p)=>p.id===editingProductId); if(refreshed) renderGallery(refreshed);
  showToast("主圖已更新，前台商品卡會同步顯示");
}
async function deleteImage(index){const product=products.find((p)=>p.id===editingProductId);product.images=normalizeAdminImages(product?.images);const image=product?.images?.[index];if(!product||!image||!confirm("確定移除這張商品照片？"))return;if(image.path){try{await deleteObject(ref(storage,image.path));}catch(e){console.warn(e);}}product.images.splice(index,1);product.images=normalizeAdminImages(product.images);await setDoc(doc(db,"products",product.id),{images:product.images,primaryImageUrl:product.images[0]?.url||"",updatedAt:serverTimestamp(),updatedBy:currentUser.uid},{merge:true});await loadProducts();const refreshed=products.find((p)=>p.id===editingProductId);if(refreshed)renderGallery(refreshed);showToast("圖片已移除，前台已同步");}
async function saveProduct() {
  const product=products.find((p)=>p.id===editingProductId);if(!product)return;
  const name=$("#editNameInput").value.trim(); if(!name)throw new Error("請填寫車款名稱");
  const colors=$("#editColorsInput").value.split(/[、,，]/).map((v)=>v.trim()).filter(Boolean);
  const payload={order:Math.max(1,Number($("#editOrderInput").value)||999),name,style:$("#editStyleInput").value.trim(),colors,priceLead:Math.max(0,Math.round(Number($("#editPriceLeadInput").value)||0)),priceTernary:$("#editPriceTernaryInput").value===""?null:Math.max(0,Math.round(Number($("#editPriceTernaryInput").value)||0)),priceLithium:$("#editPriceLithiumInput").value===""?null:Math.max(0,Math.round(Number($("#editPriceLithiumInput").value)||0)),rangeLead:$("#editRangeLeadInput").value.trim(),rangeTernary:$("#editRangeTernaryInput").value.trim(),rangeLithium:$("#editRangeLithiumInput").value.trim(),lifeLead:$("#editLifeLeadInput").value.trim()||"約 2 年",lifeTernary:$("#editLifeTernaryInput").value.trim(),lifeLithium:$("#editLifeLithiumInput").value.trim(),description:$("#editDescriptionInput").value.trim(),features:$("#editFeaturesInput").value.split(/\n+/).map((v)=>v.trim()).filter(Boolean),note:$("#editNoteInput").value.trim(),visible:$("#editVisibleInput").checked,images:normalizeAdminImages(product.images),primaryImageUrl:normalizeAdminImages(product.images)[0]?.url||"",schemaVersion:32,updatedAt:serverTimestamp(),updatedBy:currentUser.uid};
  if(!storedProductIds.has(product.id)){payload.createdAt=serverTimestamp();payload.createdBy=currentUser.uid;}
  const button=$("#saveProductBtn"), old=button.textContent;button.disabled=true;button.textContent="儲存中…";
  try{await setDoc(doc(db,"products",product.id),payload,{merge:true});storedProductIds.add(product.id);creatingProduct=false;closeProductModal();await loadProducts();showToast("商品已儲存，前台會自動同步");setSystemStatus("productWrite",true,"商品寫入權限正常");}
  catch(error){setSystemStatus("productWrite",false,friendlyFirebaseError(error,"商品寫入"));throw error;}
  finally{button.disabled=false;button.textContent=old;}
}
async function toggleProductVisible(id){const p=products.find((item)=>item.id===id);if(!p)return;const visible=p.visible===false;await setDoc(doc(db,"products",id),{visible,updatedAt:serverTimestamp(),updatedBy:currentUser.uid,...(!storedProductIds.has(id)?{...clone(p),visible,createdAt:serverTimestamp(),createdBy:currentUser.uid}: {})},{merge:true});storedProductIds.add(id);p.visible=visible;p.builtInOnly=false;renderProducts();showToast(visible?"商品已上架":"商品已下架");}
async function moveProduct(id,dir){const sorted=[...products].sort((a,b)=>Number(a.order||999)-Number(b.order||999));const i=sorted.findIndex((p)=>p.id===id);const j=dir==="up"?i-1:i+1;if(i<0||j<0||j>=sorted.length)return;const a=sorted[i],b=sorted[j];const ao=Number(a.order||i+1),bo=Number(b.order||j+1);const batch=writeBatch(db);for(const [p,order] of [[a,bo],[b,ao]]){const base=!storedProductIds.has(p.id)?{...clone(p),createdAt:serverTimestamp(),createdBy:currentUser.uid}:{};batch.set(doc(db,"products",p.id),{...base,order,updatedAt:serverTimestamp(),updatedBy:currentUser.uid},{merge:true});}await batch.commit();await loadProducts();showToast("商品排序已更新");}
async function duplicateProduct(id){const source=products.find((p)=>p.id===id);if(!source)return;const newId=`custom-${Date.now()}`;const nextOrder=products.reduce((m,p)=>Math.max(m,Number(p.order||0)),0)+1;const payload={...clone(source),id:undefined,name:`${source.name} 複製`,order:nextOrder,visible:false,images:normalizeAdminImages(source.images),schemaVersion:32,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),createdBy:currentUser.uid,updatedBy:currentUser.uid};delete payload.id;delete payload.builtInOnly;await setDoc(doc(db,"products",newId),payload);showToast("已建立複製商品（預設下架）");await loadProducts();openProductModal(newId);}
async function resetOrDeleteProduct(){const p=products.find((item)=>item.id===editingProductId);if(!p)return;const isDefault=DEFAULT_PRODUCTS.some((item)=>item.id===p.id);if(isDefault){if(!storedProductIds.has(p.id)){showToast("目前已是內建預設");return;}if(!confirm("確定清除這台車的後台自訂內容，恢復 V32 內建資料？"))return;await deleteDoc(doc(db,"products",p.id));showToast("已恢復內建預設");}else{if(!confirm("確定永久刪除這個自訂商品？"))return;for(const image of normalizeAdminImages(p.images)){if(image.path){try{await deleteObject(ref(storage,image.path));}catch(e){console.warn(e);}}}await deleteDoc(doc(db,"products",p.id));showToast("自訂商品已刪除");}closeProductModal();await loadProducts();}

async function loadSiteSettings(){try{const snap=await getDoc(doc(db,"siteSettings","main"));siteSettings={...DEFAULT_SITE_SETTINGS,...(snap.exists()?snap.data():{})};fillSiteSettings();setSystemStatus("content",true,snap.exists()?"網站內容設定已同步":"目前使用內建網站文字");}catch(error){console.error(error);siteSettings={...DEFAULT_SITE_SETTINGS};fillSiteSettings();setSystemStatus("content",false,friendlyFirebaseError(error,"網站設定讀取"));}}
function fillSiteSettings(){const fields={announcementEnabled:"siteAnnouncementEnabled",announcementText:"siteAnnouncementText",heroEyebrow:"siteHeroEyebrow",heroTitle:"siteHeroTitle",heroAccent:"siteHeroAccent",heroDescription:"siteHeroDescription",promoEnabled:"sitePromoEnabled",promoTitle:"sitePromoTitle",promoText:"sitePromoText",promoButtonText:"sitePromoButtonText",promoButtonUrl:"sitePromoButtonUrl"};for(const [key,id] of Object.entries(fields)){const el=$(`#${id}`);if(!el)continue;if(el.type==="checkbox")el.checked=!!siteSettings[key];else el.value=siteSettings[key]??"";}}
async function saveSiteSettings(){const payload={announcementEnabled:$("#siteAnnouncementEnabled").checked,announcementText:$("#siteAnnouncementText").value.trim(),heroEyebrow:$("#siteHeroEyebrow").value.trim(),heroTitle:$("#siteHeroTitle").value.trim(),heroAccent:$("#siteHeroAccent").value.trim(),heroDescription:$("#siteHeroDescription").value.trim(),promoEnabled:$("#sitePromoEnabled").checked,promoTitle:$("#sitePromoTitle").value.trim(),promoText:$("#sitePromoText").value.trim(),promoButtonText:$("#sitePromoButtonText").value.trim()||"立即了解",promoButtonUrl:$("#sitePromoButtonUrl").value.trim()||"/products.html",schemaVersion:32,updatedAt:serverTimestamp(),updatedBy:currentUser.uid};await setDoc(doc(db,"siteSettings","main"),payload,{merge:true});siteSettings={...siteSettings,...payload};showToast("首頁內容已儲存");setSystemStatus("content",true,"網站內容寫入權限正常");}

async function loadDeliveryCases(){const box=$("#deliveryCaseList");if(box)box.innerHTML='<div class="empty-admin">讀取交車案例中…</div>';try{const snap=await getDocs(collection(db,"deliveryCases"));deliveryCases=snap.docs.map((d)=>({id:d.id,...d.data()})).sort((a,b)=>Number(a.order||999)-Number(b.order||999));renderDeliveryCases();setSystemStatus("delivery",true,`${deliveryCases.length} 筆交車案例`);}catch(error){console.error(error);if(box)box.innerHTML=`<div class="empty-admin error">${escapeHtml(friendlyFirebaseError(error,"交車案例載入"))}</div>`;setSystemStatus("delivery",false,friendlyFirebaseError(error,"交車案例讀取"));}}
function renderDeliveryCases(){const box=$("#deliveryCaseList");if(!box)return;if(!deliveryCases.length){box.innerHTML='<div class="empty-admin">尚未建立交車案例</div>';return;}box.innerHTML=deliveryCases.map((c)=>`<article class="delivery-admin-card">${c.imageUrl?`<img src="${escapeHtml(c.imageUrl)}" alt="">`:'<div class="delivery-placeholder">🚚</div>'}<div><small>${c.published===false?'未發布':'前台顯示'}｜排序 ${Number(c.order||0)}</small><h3>${escapeHtml(c.title||"交車完成")}</h3><p>${escapeHtml([c.model,c.location].filter(Boolean).join("｜"))}</p><p>${escapeHtml(c.note||"")}</p></div><div class="row-actions"><button class="edit-delivery tiny-btn" data-id="${escapeHtml(c.id)}">編輯</button><button class="delete-delivery tiny-btn danger" data-id="${escapeHtml(c.id)}">刪除</button></div></article>`).join("");$$(".edit-delivery").forEach((b)=>b.addEventListener("click",()=>openDeliveryModal(b.dataset.id)));$$(".delete-delivery").forEach((b)=>b.addEventListener("click",()=>deleteDeliveryCase(b.dataset.id).catch((e)=>showToast(friendlyFirebaseError(e,"交車案例刪除"),true))));}
function openDeliveryModal(id=null){const existing=id?deliveryCases.find((c)=>c.id===id):null;editingDeliveryId=id||`delivery-${Date.now()}`;deliveryImageDraft=existing?.imageUrl||"";$("#deliveryModalTitle").textContent=existing?"編輯交車案例":"新增交車案例";$("#deliveryOrder").value=Number(existing?.order||deliveryCases.length+1);$("#deliveryTitle").value=existing?.title||"今日交車完成";$("#deliveryModel").value=existing?.model||"";$("#deliveryLocation").value=existing?.location||"";$("#deliveryNote").value=existing?.note||"";$("#deliveryPublished").checked=existing?.published!==false;renderDeliveryImagePreview();const modal=$("#deliveryModal");modal.classList.remove("hidden");modal.classList.add("flex");}
function closeDeliveryModal(){const modal=$("#deliveryModal");modal?.classList.add("hidden");modal?.classList.remove("flex");editingDeliveryId=null;deliveryImageDraft="";if($("#deliveryImageInput"))$("#deliveryImageInput").value="";}
function renderDeliveryImagePreview(){const box=$("#deliveryImagePreview");if(!box)return;box.innerHTML=deliveryImageDraft?`<img src="${escapeHtml(deliveryImageDraft)}" alt="交車案例圖片"><button id="clearDeliveryImage" type="button">移除圖片</button>`:'<span>尚未選擇圖片</span>';$("#clearDeliveryImage")?.addEventListener("click",()=>{deliveryImageDraft="";renderDeliveryImagePreview();});}
async function handleDeliveryImage(file){if(!file)return;deliveryImageDraft=await compressImage(file,1200,350000);renderDeliveryImagePreview();}
async function saveDeliveryCase(){if(!editingDeliveryId)return;const payload={order:Math.max(1,Number($("#deliveryOrder").value)||999),title:$("#deliveryTitle").value.trim()||"交車完成",model:$("#deliveryModel").value.trim(),location:$("#deliveryLocation").value.trim(),note:$("#deliveryNote").value.trim(),published:$("#deliveryPublished").checked,imageUrl:deliveryImageDraft,schemaVersion:32,updatedAt:serverTimestamp(),updatedBy:currentUser.uid};const exists=deliveryCases.some((c)=>c.id===editingDeliveryId);if(!exists){payload.createdAt=serverTimestamp();payload.createdBy=currentUser.uid;}await setDoc(doc(db,"deliveryCases",editingDeliveryId),payload,{merge:true});closeDeliveryModal();await loadDeliveryCases();showToast("交車案例已儲存");}
async function deleteDeliveryCase(id){if(!confirm("確定刪除這筆交車案例？"))return;await deleteDoc(doc(db,"deliveryCases",id));await loadDeliveryCases();showToast("交車案例已刪除");}

function bindEvents(){
  $("#loginBtn")?.addEventListener("click",beginLogin);
  $("#switchAccountBtn")?.addEventListener("click",async()=>{await signOut(auth);beginLogin();});
  $("#logoutBtn")?.addEventListener("click",()=>signOut(auth));
  $("#refreshOrdersBtn")?.addEventListener("click",loadOrders);
  $("#orderSearch")?.addEventListener("input",renderOrders);
  $("#refreshPlateOrdersBtn")?.addEventListener("click",loadOrders);
  $("#plateOrderSearch")?.addEventListener("input",renderPlateOrders);
  $("#customerSearch")?.addEventListener("input",renderCustomers);
  $("#refreshProductsBtn")?.addEventListener("click",loadProducts);
  $("#productSearch")?.addEventListener("input",renderProducts);
  $("#addProductBtn")?.addEventListener("click",newProduct);
  $("#seedProductsBtn")?.addEventListener("click",()=>seedProducts().catch((e)=>showToast(friendlyFirebaseError(e,"商品同步"),true)));
  $("#closeProductModalBtn")?.addEventListener("click",closeProductModal);
  $("#chooseImagesBtn")?.addEventListener("click",()=>$("#imageFileInput")?.click());
  $("#imageFileInput")?.addEventListener("change",(event)=>uploadImages([...event.target.files]).catch((e)=>showToast(friendlyFirebaseError(e,"圖片上傳"),true)));
  $("#saveProductBtn")?.addEventListener("click",()=>saveProduct().catch((e)=>showToast(friendlyFirebaseError(e,"商品儲存"),true)));
  $("#deleteProductBtn")?.addEventListener("click",()=>resetOrDeleteProduct().catch((e)=>showToast(friendlyFirebaseError(e,"商品處理"),true)));
  $("#saveSiteSettingsBtn")?.addEventListener("click",()=>saveSiteSettings().catch((e)=>showToast(friendlyFirebaseError(e,"網站內容儲存"),true)));
  $("#addDeliveryBtn")?.addEventListener("click",()=>openDeliveryModal());
  $("#refreshDeliveryBtn")?.addEventListener("click",loadDeliveryCases);
  $("#closeDeliveryModalBtn")?.addEventListener("click",closeDeliveryModal);
  $("#deliveryImageInput")?.addEventListener("change",(e)=>handleDeliveryImage(e.target.files?.[0]).catch((err)=>showToast(err.message||"圖片處理失敗",true)));
  $("#saveDeliveryBtn")?.addEventListener("click",()=>saveDeliveryCase().catch((e)=>showToast(friendlyFirebaseError(e,"交車案例儲存"),true)));
  $("#closeOrderDetailBtn")?.addEventListener("click",closeOrderDetail);
  $("#orderDetailModal")?.addEventListener("click",(e)=>{if(e.target===$("#orderDetailModal"))closeOrderDetail();});
  $("#editProductModal")?.addEventListener("click",(e)=>{if(e.target===$("#editProductModal"))closeProductModal();});
  $("#deliveryModal")?.addEventListener("click",(e)=>{if(e.target===$("#deliveryModal"))closeDeliveryModal();});
  document.addEventListener("keydown",(e)=>{if(e.key==="Escape"){closeOrderDetail();closeProductModal();closeDeliveryModal();}});
}

bindEvents();
onAuthStateChanged(auth, async (user) => {
  if (!user) return showLoggedOut();
  if (!(await isAdminUser(user))) return showDenied(user);
  await showAdmin(user);
});
console.info(`小宇微電後台 v${VERSION}`);
