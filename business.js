import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const OWNER_EMAIL = "uu8832sr@gmail.com";
const firebaseConfig = window.LUCKY_GARAGE_FIREBASE_CONFIG || {};
const uiConfig = window.LUCKY_GARAGE_UI_CONFIG || {};
const $ = (selector) => document.querySelector(selector);

const elements = {
  configWarning: $("#configWarning"), loginCard: $("#loginCard"), loginBtn: $("#loginBtn"), loginMessage: $("#loginMessage"),
  deniedCard: $("#deniedCard"), deniedEmail: $("#deniedEmail"), copyUidBtn: $("#copyUidBtn"), switchAccountBtn: $("#switchAccountBtn"),
  appArea: $("#appArea"), adminEmail: $("#adminEmail"), logoutBtn: $("#logoutBtn"), orderForm: $("#orderForm"),
  editingId: $("#editingId"), formTitle: $("#formTitle"), formMessage: $("#formMessage"), resetBtn: $("#resetBtn"),
  saveAndReceiptBtn: $("#saveAndReceiptBtn"), unpaidPreview: $("#unpaidPreview"), searchInput: $("#searchInput"),
  statusFilter: $("#statusFilter"), refreshOrdersBtn: $("#refreshOrdersBtn"), exportCsvBtn: $("#exportCsvBtn"), orderList: $("#orderList"),
  statOrders: $("#statOrders"), statPending: $("#statPending"), statDeposits: $("#statDeposits"), statBalance: $("#statBalance"),
  documentDialog: $("#documentDialog"), documentCanvas: $("#documentCanvas"), dialogTitle: $("#dialogTitle"),
  downloadPngBtn: $("#downloadPngBtn"), printBtn: $("#printBtn"), closeDialogBtn: $("#closeDialogBtn"),
  textDialog: $("#textDialog"), textDialogTitle: $("#textDialogTitle"), textTabs: $("#textTabs"), generatedText: $("#generatedText"),
  copyTextBtn: $("#copyTextBtn"), closeTextDialogBtn: $("#closeTextDialogBtn"), toast: $("#toast")
};

const fieldIds = [
  "customerName", "phone", "address", "lineName", "model", "color", "battery", "chassisNo", "batteryNo",
  "licenseMode", "deliveryMode", "price", "deposit", "balancePaid", "paymentMethod", "status", "deliveryDate",
  "deliveredAt", "documentStatus", "notes"
];
const fields = Object.fromEntries(fieldIds.map((id) => [id, $("#" + id)]));

let auth;
let db;
let currentUser = null;
let currentOrders = [];
let currentDocumentName = "小宇微電文件";
let currentTextMap = {};

function hasRealFirebaseConfig(config) {
  return Boolean(config.apiKey && config.projectId && config.appId && !Object.values(config).some((value) => String(value).includes("YOUR_")));
}
function normalizeEmail(value) { return String(value || "").trim().toLowerCase(); }
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}
function numberValue(value) { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0; }
function formatMoney(value) { return `NT$${numberValue(value).toLocaleString("zh-TW")}`; }
function todayString() { return new Date().toISOString().slice(0, 10); }
function dateCompact() { return todayString().replaceAll("-", ""); }
function randomCode(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return [...values].map((value) => chars[value % chars.length]).join("");
}
function createOrderId() { return `YU-${dateCompact()}-${randomCode(4)}`; }
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 1900);
}
function setMessage(message, success = false) {
  elements.formMessage.textContent = message;
  elements.formMessage.classList.toggle("success", success);
}
function displayDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-TW").format(date);
}
function addMonths(dateValue, months) {
  const base = dateValue ? new Date(`${dateValue}T12:00:00`) : new Date();
  base.setMonth(base.getMonth() + months);
  return base.toISOString().slice(0, 10);
}
function maskName(name) {
  const text = String(name || "").trim();
  return text ? `${text.slice(0, 1)}${"＊".repeat(Math.max(1, text.length - 1))}` : "—";
}
function maskSerial(value) {
  const text = String(value || "").trim();
  if (!text) return "未登錄";
  return text.length <= 4 ? `＊＊${text}` : `${text.slice(0, 2)}＊＊＊${text.slice(-4)}`;
}
function calculateUnpaid(order) {
  return Math.max(0, numberValue(order.price) - numberValue(order.deposit) - numberValue(order.balancePaid));
}
function orderFromForm() {
  const data = Object.fromEntries(fieldIds.map((id) => [id, fields[id].value.trim ? fields[id].value.trim() : fields[id].value]));
  data.price = numberValue(fields.price.value);
  data.deposit = numberValue(fields.deposit.value);
  data.balancePaid = numberValue(fields.balancePaid.value);
  return data;
}
function updateUnpaidPreview() {
  elements.unpaidPreview.textContent = formatMoney(calculateUnpaid(orderFromForm()));
}
function resetForm() {
  elements.orderForm.reset();
  elements.editingId.value = "";
  elements.formTitle.textContent = "建立訂單";
  fields.price.value = "0";
  fields.deposit.value = "0";
  fields.balancePaid.value = "0";
  fields.battery.value = "鉛酸";
  fields.licenseMode.value = "自行領牌";
  fields.deliveryMode.value = "到府交車";
  fields.paymentMethod.value = "轉帳";
  fields.status.value = "待訂金";
  fields.documentStatus.value = "尚未準備";
  setMessage("");
  updateUnpaidPreview();
}
function fillForm(order) {
  elements.editingId.value = order.id;
  for (const id of fieldIds) fields[id].value = order[id] ?? "";
  elements.formTitle.textContent = `編輯訂單｜${order.id}`;
  updateUnpaidPreview();
  document.querySelector(".form-card").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function isAdminUser(user) {
  if (!user || user.isAnonymous) return false;
  const emailOwner = user.emailVerified === true && normalizeEmail(user.email) === OWNER_EMAIL;
  if (emailOwner) return true;
  try {
    const snapshot = await getDoc(doc(db, "admins", user.uid));
    return snapshot.exists() && snapshot.data().enabled === true;
  } catch {
    return false;
  }
}
async function beginGoogleLogin() {
  elements.loginMessage.textContent = "正在開啟 Google 登入…";
  elements.loginBtn.disabled = true;
  try {
    if (auth.currentUser) await signOut(auth);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    const code = String(error?.code || "");
    if (code.includes("popup-blocked") || code.includes("operation-not-supported")) {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithRedirect(auth, provider);
      return;
    }
    elements.loginMessage.textContent = error?.message || "登入失敗，請改用 Safari 或 Chrome。";
  } finally {
    elements.loginBtn.disabled = false;
  }
}
function showLoggedOut() {
  currentUser = null;
  elements.loginCard.classList.remove("hidden");
  elements.deniedCard.classList.add("hidden");
  elements.appArea.classList.add("hidden");
}
function showDenied(user) {
  currentUser = user;
  elements.deniedEmail.textContent = user.email || user.uid;
  elements.loginCard.classList.add("hidden");
  elements.deniedCard.classList.remove("hidden");
  elements.appArea.classList.add("hidden");
}
async function showApp(user) {
  currentUser = user;
  elements.adminEmail.textContent = user.email || user.uid;
  elements.loginCard.classList.add("hidden");
  elements.deniedCard.classList.add("hidden");
  elements.appArea.classList.remove("hidden");
  await loadOrders();
}

async function saveOrder({ openDepositReceipt = false } = {}) {
  const data = orderFromForm();
  if (!data.customerName || !data.phone || !data.address || !data.model || !data.color) {
    setMessage("請填寫車主姓名、手機、送車地址、車款與顏色。", false);
    return null;
  }
  const editingId = elements.editingId.value;
  const id = editingId || createOrderId();
  setMessage("正在儲存訂單…", true);
  try {
    if (editingId) {
      await updateDoc(doc(db, "orders", id), { ...data, updatedAt: serverTimestamp(), updatedBy: currentUser.uid });
    } else {
      await setDoc(doc(db, "orders", id), {
        ...data,
        orderNo: id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser.uid,
        updatedBy: currentUser.uid
      });
    }
    const savedOrder = { id, orderNo: id, ...data };
    setMessage(`訂單 ${id} 已儲存。`, true);
    await loadOrders();
    if (openDepositReceipt) await createAndShowReceipt(savedOrder, "deposit");
    else resetForm();
    return savedOrder;
  } catch (error) {
    console.error(error);
    setMessage(String(error?.code || "").includes("permission-denied") ? "儲存失敗：請先發布新版 Firestore 規則。" : (error?.message || "儲存失敗。"));
    return null;
  }
}

async function loadOrders() {
  elements.orderList.innerHTML = '<p class="empty">讀取中…</p>';
  try {
    const snapshot = await getDocs(collection(db, "orders"));
    currentOrders = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    currentOrders.sort((a, b) => {
      const at = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
      const bt = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
      return bt - at;
    });
    renderOrders();
    renderStats();
  } catch (error) {
    console.error(error);
    elements.orderList.innerHTML = `<p class="empty">讀取失敗：${escapeHtml(error?.message || "請檢查 Firestore 規則")}</p>`;
  }
}
function filteredOrders() {
  const keyword = elements.searchInput.value.trim().toLowerCase();
  const status = elements.statusFilter.value;
  return currentOrders.filter((order) => {
    const haystack = [order.id, order.customerName, order.phone, order.model, order.color, order.address].join(" ").toLowerCase();
    return (!keyword || haystack.includes(keyword)) && (!status || order.status === status);
  });
}
function renderOrders() {
  const orders = filteredOrders();
  if (!orders.length) {
    elements.orderList.innerHTML = '<p class="empty">目前沒有符合條件的訂單。</p>';
    return;
  }
  elements.orderList.innerHTML = orders.map((order) => `
    <article class="order-row" data-id="${escapeHtml(order.id)}">
      <div class="order-main"><strong>${escapeHtml(order.customerName || "未命名")}</strong><small>${escapeHtml(order.phone || "—")}｜${escapeHtml(order.id)}</small></div>
      <div class="order-car"><strong>${escapeHtml(order.color || "")} ${escapeHtml(order.model || "")}</strong><small>${escapeHtml(order.battery || "")}｜${escapeHtml(order.licenseMode || "")}</small></div>
      <div class="order-money"><span class="badge">${escapeHtml(order.status || "未設定")}</span><strong>${formatMoney(calculateUnpaid(order))}</strong><small>待收金額</small></div>
      <div class="row-actions">
        <button class="secondary" data-action="edit">編輯</button>
        <button class="secondary" data-action="deposit">訂金收據</button>
        <button class="secondary" data-action="balance">尾款收據</button>
        <button class="secondary" data-action="warranty">保固卡</button>
        <button class="secondary" data-action="delivery">交車卡</button>
        <button class="secondary" data-action="text">文案</button>
        <button class="secondary danger" data-action="delete">刪除</button>
      </div>
    </article>
  `).join("");
}
function renderStats() {
  const active = currentOrders.filter((order) => order.status !== "取消");
  const pending = active.filter((order) => order.status !== "已交車").length;
  const deposits = active.reduce((sum, order) => sum + numberValue(order.deposit), 0);
  const unpaid = active.reduce((sum, order) => sum + calculateUnpaid(order), 0);
  elements.statOrders.textContent = currentOrders.length.toLocaleString("zh-TW");
  elements.statPending.textContent = pending.toLocaleString("zh-TW");
  elements.statDeposits.textContent = formatMoney(deposits);
  elements.statBalance.textContent = formatMoney(unpaid);
}

function receiptHtml(order, type, receiptId) {
  const depositReceipt = type === "deposit";
  const amount = depositReceipt ? order.deposit : order.balancePaid;
  const title = depositReceipt ? "訂金收據" : "尾款收據";
  const tilt = ((Math.random() - .5) * 1.4).toFixed(2) + "deg";
  return `
    <section class="doc-sheet receipt-sheet" data-file="${escapeHtml(receiptId)}">
      <div class="doc-brand"><p>找小宇買微電，不走彎路</p><h1>小宇微電</h1><h2>${title}</h2></div>
      <div class="doc-meta">
        <div class="doc-field"><span>收據編號</span><strong>${escapeHtml(receiptId)}</strong></div>
        <div class="doc-field"><span>開立日期</span><strong>${displayDate(todayString())}</strong></div>
        <div class="doc-field"><span>客戶姓名</span><strong class="handwriting" style="--tilt:${tilt}">${escapeHtml(order.customerName)}</strong></div>
        <div class="doc-field"><span>訂單編號</span><strong>${escapeHtml(order.id)}</strong></div>
        <div class="doc-field"><span>車款／顏色</span><strong class="handwriting" style="--tilt:${tilt}">${escapeHtml(order.model)}／${escapeHtml(order.color)}</strong></div>
        <div class="doc-field"><span>付款方式</span><strong>${escapeHtml(order.paymentMethod || "—")}</strong></div>
      </div>
      <div class="amount-box"><span>今收到款項</span><strong class="handwriting" style="--tilt:${tilt}">${formatMoney(amount)}</strong></div>
      <div class="doc-meta">
        <div class="doc-field"><span>總車價</span><strong>${formatMoney(order.price)}</strong></div>
        <div class="doc-field"><span>累計已收</span><strong>${formatMoney(numberValue(order.deposit) + numberValue(order.balancePaid))}</strong></div>
        <div class="doc-field"><span>尚未收款</span><strong>${formatMoney(calculateUnpaid(order))}</strong></div>
        <div class="doc-field"><span>款項用途</span><strong>${depositReceipt ? "車輛訂金／保留車輛" : "交車尾款"}</strong></div>
      </div>
      <p class="doc-note">本收據由「小宇微電｜訂單系統」依實際收款資料開立，請妥善保存。訂單內容、交車安排及退款條件依雙方實際約定辦理。</p>
      <div class="doc-footer"><div><strong>官方 LINE：${escapeHtml(uiConfig.lineId || "@762eqvlg")}</strong><br><small>系統開立・可依收據編號查核</small></div><div class="doc-stamp">小宇微電<br>收訖</div></div>
    </section>`;
}
async function createAndShowReceipt(order, type) {
  const suffix = type === "deposit" ? "D" : "B";
  const receiptId = `R-${order.id}-${suffix}`;
  const amount = type === "deposit" ? numberValue(order.deposit) : numberValue(order.balancePaid);
  if (amount <= 0) {
    showToast(type === "deposit" ? "這筆訂單尚未填寫訂金" : "這筆訂單尚未填寫已收尾款");
    return;
  }
  try {
    await setDoc(doc(db, "receipts", receiptId), {
      receiptId, orderId: order.id, type, amount, customerName: order.customerName, model: order.model, color: order.color,
      price: numberValue(order.price), deposit: numberValue(order.deposit), balancePaid: numberValue(order.balancePaid),
      paymentMethod: order.paymentMethod || "", issuedAt: serverTimestamp(), issuedBy: currentUser.uid
    }, { merge: true });
    currentDocumentName = `${receiptId}-${order.customerName}`;
    showDocument(type === "deposit" ? "訂金收據" : "尾款收據", receiptHtml(order, type, receiptId));
  } catch (error) {
    console.error(error);
    showToast("收據建立失敗，請檢查 Firestore 規則");
  }
}

function warrantyHtml(order, warrantyId, warrantyUrl, dates) {
  return `
    <section class="doc-sheet warranty-sheet" data-file="${escapeHtml(warrantyId)}">
      <div class="doc-brand"><p>找小宇買微電，不走彎路</p><h1>小宇微電</h1><h2>車輛保固卡</h2></div>
      <div class="warranty-layout">
        <div class="doc-meta">
          <div class="doc-field"><span>保固編號</span><strong>${escapeHtml(warrantyId)}</strong></div>
          <div class="doc-field"><span>訂單編號</span><strong>${escapeHtml(order.id)}</strong></div>
          <div class="doc-field"><span>車主姓名</span><strong>${escapeHtml(order.customerName)}</strong></div>
          <div class="doc-field"><span>車款／顏色</span><strong>${escapeHtml(order.model)}／${escapeHtml(order.color)}</strong></div>
          <div class="doc-field"><span>車架號</span><strong>${escapeHtml(order.chassisNo || "未登錄")}</strong></div>
          <div class="doc-field"><span>電池編號</span><strong>${escapeHtml(order.batteryNo || "未登錄")}</strong></div>
          <div class="doc-field"><span>交車日期</span><strong>${displayDate(dates.delivery)}</strong></div>
          <div class="doc-field"><span>電池類型</span><strong>${escapeHtml(order.battery || "—")}</strong></div>
        </div>
        <div><div id="warrantyQr" class="qr-box"></div><small>掃碼查看電子保固卡</small></div>
      </div>
      <div class="amount-box"><span>整車保固期限</span><strong>${displayDate(dates.delivery)} ～ ${displayDate(dates.vehicleEnd)}</strong><span style="margin-top:12px">電池保固期限</span><strong style="font-size:24px">${displayDate(dates.delivery)} ～ ${displayDate(dates.batteryEnd)}</strong></div>
      <div class="check-list"><strong>保固範圍：依交車時約定之整車、電機、控制器、儀表及線組保固內容辦理。</strong><span>不保固：人為損壞、泡水、事故、耗材自然磨損、非授權改裝或拆修。</span><span>維修前請先聯絡官方 LINE，未經確認自行拆修可能影響保固。</span></div>
      <p class="doc-note">QR Code 公開頁僅顯示遮蔽後的車主與車架資料，不顯示電話、地址、售價及收款資訊。</p>
      <div class="doc-footer"><div><strong>官方 LINE：${escapeHtml(uiConfig.lineId || "@762eqvlg")}</strong><br><small>${escapeHtml(warrantyUrl)}</small></div><div class="doc-stamp">保固<br>有效</div></div>
    </section>`;
}
async function createAndShowWarranty(order) {
  const delivery = order.deliveredAt || order.deliveryDate || todayString();
  const dates = { delivery, vehicleEnd: addMonths(delivery, 12), batteryEnd: addMonths(delivery, 6) };
  const warrantyId = `W-${order.id}`;
  const warrantyUrl = new URL(`warranty.html?id=${encodeURIComponent(warrantyId)}`, location.href).href;
  const publicWarranty = {
    published: true,
    warrantyId,
    orderRef: order.id,
    customerDisplayName: maskName(order.customerName),
    model: order.model,
    color: order.color,
    chassisMasked: maskSerial(order.chassisNo),
    battery: order.battery || "—",
    deliveryDate: dates.delivery,
    vehicleWarrantyEnd: dates.vehicleEnd,
    batteryWarrantyEnd: dates.batteryEnd,
    terms: "整車保固一年、電池保固六個月；人為損壞、泡水、事故、耗材自然磨損及非授權改裝或拆修不在保固範圍內。",
    lineId: uiConfig.lineId || "@762eqvlg",
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid
  };
  try {
    await setDoc(doc(db, "warranties", warrantyId), publicWarranty, { merge: true });
    await updateDoc(doc(db, "orders", order.id), { warrantyId, updatedAt: serverTimestamp(), updatedBy: currentUser.uid });
    currentDocumentName = `${warrantyId}-${order.customerName}`;
    showDocument("車輛保固卡", warrantyHtml(order, warrantyId, warrantyUrl, dates));
    requestAnimationFrame(() => {
      const qrTarget = $("#warrantyQr");
      if (qrTarget && window.QRCode) new window.QRCode(qrTarget, { text: warrantyUrl, width: 150, height: 150, correctLevel: window.QRCode.CorrectLevel.M });
    });
  } catch (error) {
    console.error(error);
    showToast("保固卡建立失敗，請檢查 Firestore 規則");
  }
}
function deliveryCardHtml(order) {
  const customer = order.customerName ? `${order.customerName.slice(0, 1)}先生／小姐` : "新車主";
  const date = order.deliveredAt || order.deliveryDate || todayString();
  return `<section class="doc-sheet delivery-card" data-file="delivery-${escapeHtml(order.id)}"><p>小宇微電｜交車紀錄</p><div class="big">🎉 恭喜交車 🎉</div><p>${escapeHtml(customer)}</p><div class="car-name">${escapeHtml(order.color)} ${escapeHtml(order.model)}</div><p>${escapeHtml(order.battery || "")}｜${escapeHtml(order.deliveryMode || "到府交車")}</p><p>${displayDate(date)}</p><div class="slogan">找小宇買微電，不走彎路</div><div class="line">官方 LINE：${escapeHtml(uiConfig.lineId || "@762eqvlg")}</div></section>`;
}
function showDeliveryCard(order) {
  currentDocumentName = `交車卡-${order.id}-${order.customerName}`;
  showDocument("交車卡", deliveryCardHtml(order));
}
function showDocument(title, html) {
  elements.dialogTitle.textContent = title;
  elements.documentCanvas.innerHTML = html;
  elements.documentDialog.showModal();
}

function buildTextMap(order) {
  const vehicle = `${order.color || ""}${order.model || ""}`;
  const deliveryDone = order.status === "已交車" || Boolean(order.deliveredAt);
  const action = deliveryDone ? "順利完成交車" : "已完成下訂，準備安排交車";
  const licenseText = order.licenseMode === "自行領牌" ? "領牌文件隨車提供，車主自行辦理" : (order.licenseMode === "代辦領牌" ? "可協助辦理領牌與強制險" : "領牌方式可依需求安排");
  return {
    "Facebook": `🎉 ${vehicle} ${action}！\n\n感謝車主對小宇微電的信任😊\n這次選擇的是 ${order.model}｜${order.color}｜${order.battery || "電池版本依訂單"}。\n\n✔ 全台可安排配送\n✔ 家用插座即可充電\n✔ ${licenseText}\n✔ 完整售後與保固服務\n\n想了解車款、現貨或最新優惠，歡迎加入官方 LINE：${uiConfig.lineId || "@762eqvlg"}\n\n#小宇微電 #微型電動二輪 #電動車 #${String(order.model || "").replaceAll(" ", "")} #到府交車`,
    "Instagram": `${vehicle} ${deliveryDone ? "交車成功" : "訂購完成"}🛵✨\n\n感謝車主支持！\n📍全台配送\n📍領牌文件／代辦服務\n📍售後保固\n\n官方 LINE：${uiConfig.lineId || "@762eqvlg"}\n\n#小宇微電 #微型電動二輪 #電動車 #交車日常`,
    "Threads": `今天${deliveryDone ? "交了一台" : "接到一台訂單"} ${vehicle}。\n\n${order.color}實車真的很好看，照片跟現場的感覺又不太一樣。想看其他顏色或車款的，也可以直接留言或私訊我。`,
    "限時動態": `🎉 ${deliveryDone ? "今日交車" : "訂購完成"}\n${vehicle}\n${order.deliveryMode || "全台配送"}\n找小宇買微電，不走彎路\nLINE：${uiConfig.lineId || "@762eqvlg"}`,
    "影片口白": `今天跟大家分享的是${order.color}的${order.model}。這台已經${deliveryDone ? "順利完成交車" : "完成下訂，接下來會安排備車與配送"}。感謝車主選擇小宇微電，有車款、續航、領牌或分期問題，都可以直接加入官方 LINE 詢問。`,
    "收到訂金 LINE": `您好😊 已收到您的訂金，${order.color}${order.model}已正式為您保留。\n\n訂單編號：${order.id}\n已收訂金：${formatMoney(order.deposit)}\n待付尾款：${formatMoney(calculateUnpaid(order))}\n領牌方式：${order.licenseMode || "未確認"}\n\n後續文件或送車安排確認後，我會再提前通知您，請留意陌生來電，謝謝您的信任🙏`,
    "送車提醒 LINE": `您好😊 您的${order.color}${order.model}即將安排送車。\n\n送車地址：${order.address}\n交車方式：${order.deliveryMode || "到府交車"}\n領牌方式：${order.licenseMode || "未確認"}\n\n送車前會有專人電話聯繫，還請您留意陌生來電，避免漏接，謝謝您🙏`,
    "自行領牌 LINE": `您好😊 因您選擇自行領牌，領牌所需文件會於交車時一併提供。收到文件後，請依監理機關規定辦理領牌及強制險；如有資料問題可直接聯絡我協助確認。`
  };
}
function openTextDialog(order) {
  currentTextMap = buildTextMap(order);
  elements.textDialogTitle.textContent = `${order.customerName}｜${order.model} 文案`;
  const names = Object.keys(currentTextMap);
  elements.textTabs.innerHTML = names.map((name, index) => `<button class="secondary compact ${index === 0 ? "active" : ""}" data-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join("");
  elements.generatedText.value = currentTextMap[names[0]];
  elements.textDialog.showModal();
}

function exportCsv() {
  if (!currentOrders.length) return showToast("目前沒有訂單可匯出");
  const headers = ["訂單編號","車主姓名","電話","送車地址","車款","顏色","電池","總車價","訂金","已收尾款","未收金額","付款方式","領牌方式","交車方式","狀態","預計交車日","實際交車日","車架號","電池編號","備註"];
  const rows = currentOrders.map((order) => [order.id,order.customerName,order.phone,order.address,order.model,order.color,order.battery,order.price,order.deposit,order.balancePaid,calculateUnpaid(order),order.paymentMethod,order.licenseMode,order.deliveryMode,order.status,order.deliveryDate,order.deliveredAt,order.chassisNo,order.batteryNo,order.notes]);
  const quote = (value) => `"${String(value ?? "").replaceAll('"','""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(quote).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `小宇微電訂單-${todayString()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function handleOrderAction(button) {
  const row = button.closest(".order-row");
  const order = currentOrders.find((item) => item.id === row?.dataset.id);
  if (!order) return;
  const action = button.dataset.action;
  if (action === "edit") return fillForm(order);
  if (action === "deposit") return createAndShowReceipt(order, "deposit");
  if (action === "balance") return createAndShowReceipt(order, "balance");
  if (action === "warranty") return createAndShowWarranty(order);
  if (action === "delivery") return showDeliveryCard(order);
  if (action === "text") return openTextDialog(order);
  if (action === "delete") {
    if (!confirm(`確定刪除訂單 ${order.id}？已開立的保固卡不會自動刪除。`)) return;
    try {
      await deleteDoc(doc(db, "orders", order.id));
      showToast("訂單已刪除");
      await loadOrders();
    } catch (error) {
      console.error(error);
      showToast("刪除失敗");
    }
  }
}

// 事件
fields.price.addEventListener("input", updateUnpaidPreview);
fields.deposit.addEventListener("input", updateUnpaidPreview);
fields.balancePaid.addEventListener("input", updateUnpaidPreview);
elements.orderForm.addEventListener("submit", async (event) => { event.preventDefault(); await saveOrder(); });
elements.saveAndReceiptBtn.addEventListener("click", async () => { await saveOrder({ openDepositReceipt: true }); });
elements.resetBtn.addEventListener("click", resetForm);
elements.refreshOrdersBtn.addEventListener("click", loadOrders);
elements.searchInput.addEventListener("input", renderOrders);
elements.statusFilter.addEventListener("change", renderOrders);
elements.exportCsvBtn.addEventListener("click", exportCsv);
elements.orderList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (button) handleOrderAction(button);
});
elements.loginBtn.addEventListener("click", beginGoogleLogin);
elements.switchAccountBtn.addEventListener("click", beginGoogleLogin);
elements.copyUidBtn.addEventListener("click", async () => {
  if (!auth.currentUser) return;
  await navigator.clipboard.writeText(auth.currentUser.uid);
  showToast("UID 已複製");
});
elements.logoutBtn.addEventListener("click", () => signOut(auth));
elements.closeDialogBtn.addEventListener("click", () => elements.documentDialog.close());
elements.printBtn.addEventListener("click", () => window.print());
elements.downloadPngBtn.addEventListener("click", async () => {
  const sheet = elements.documentCanvas.querySelector(".doc-sheet");
  if (!sheet || !window.html2canvas) return showToast("圖片工具尚未載入");
  elements.downloadPngBtn.disabled = true;
  try {
    const canvas = await window.html2canvas(sheet, { scale: 2, backgroundColor: null, useCORS: true });
    const link = document.createElement("a");
    link.download = `${currentDocumentName}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (error) {
    console.error(error);
    showToast("圖片產生失敗，可改用列印存成 PDF");
  } finally {
    elements.downloadPngBtn.disabled = false;
  }
});
elements.textTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-name]");
  if (!button) return;
  elements.textTabs.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
  elements.generatedText.value = currentTextMap[button.dataset.name] || "";
});
elements.copyTextBtn.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(elements.generatedText.value); showToast("文案已複製"); }
  catch { elements.generatedText.select(); showToast("已選取文字，請手動複製"); }
});
elements.closeTextDialogBtn.addEventListener("click", () => elements.textDialog.close());

async function start() {
  resetForm();
  if (!hasRealFirebaseConfig(firebaseConfig)) {
    elements.configWarning.classList.remove("hidden");
    elements.loginCard.classList.add("hidden");
    return;
  }
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  onAuthStateChanged(auth, async (user) => {
    if (!user) return showLoggedOut();
    if (user.isAnonymous) {
      await signOut(auth);
      return;
    }
    if (!(await isAdminUser(user))) return showDenied(user);
    await showApp(user);
  });
}
start();
