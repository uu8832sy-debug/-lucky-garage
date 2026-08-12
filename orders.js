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
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const OWNER_EMAIL = "uu8832sr@gmail.com";
const firebaseConfig = window.LUCKY_GARAGE_FIREBASE_CONFIG || {};
const uiConfig = window.LUCKY_GARAGE_UI_CONFIG || {};
const $ = (selector) => document.querySelector(selector);

const elements = {
  configWarning: $("#configWarning"), loginCard: $("#loginCard"), loginBtn: $("#loginBtn"), loginMessage: $("#loginMessage"),
  deniedCard: $("#deniedCard"), deniedEmail: $("#deniedEmail"), copyUidBtn: $("#copyUidBtn"), switchAccountBtn: $("#switchAccountBtn"),
  appArea: $("#appArea"), adminEmail: $("#adminEmail"), logoutBtn: $("#logoutBtn"), orderForm: $("#orderForm"),
  editingId: $("#editingId"), formTitle: $("#formTitle"), formMessage: $("#formMessage"), resetBtn: $("#resetBtn"),
  saveOrderBtn: $("#saveOrderBtn"), saveAndReceiptBtn: $("#saveAndReceiptBtn"), unpaidPreview: $("#unpaidPreview"), netProfitPreview: $("#netProfitPreview"), searchInput: $("#searchInput"),
  bulkOrdersInput: $("#bulkOrdersInput"), clearBulkBtn: $("#clearBulkBtn"), previewBulkBtn: $("#previewBulkBtn"), importBulkBtn: $("#importBulkBtn"),
  bulkPreview: $("#bulkPreview"), bulkMessage: $("#bulkMessage"),
  statusFilter: $("#statusFilter"), refreshOrdersBtn: $("#refreshOrdersBtn"), exportCsvBtn: $("#exportCsvBtn"), orderList: $("#orderList"),
  selectVisibleBtn: $("#selectVisibleBtn"), clearSelectionBtn: $("#clearSelectionBtn"), deleteSelectedBtn: $("#deleteSelectedBtn"), selectionCount: $("#selectionCount"),
  statOrders: $("#statOrders"), statPending: $("#statPending"), statDeposits: $("#statDeposits"), statBalance: $("#statBalance"),
  summaryScope: $("#summaryScope"), summaryEyebrow: $("#summaryEyebrow"), summaryNote: $("#summaryNote"),
  monthPickerWrap: $("#monthPickerWrap"), monthPicker: $("#monthPicker"), statMonthCountLabel: $("#statMonthCountLabel"),
  statMonthDelivered: $("#statMonthDelivered"), statMonthRevenue: $("#statMonthRevenue"),
  statMonthCost: $("#statMonthCost"), statMonthProfit: $("#statMonthProfit"), monthOrderList: $("#monthOrderList"),
  documentDialog: $("#documentDialog"), documentCanvas: $("#documentCanvas"), dialogTitle: $("#dialogTitle"),
  savePhotoBtn: $("#savePhotoBtn"), downloadPngBtn: $("#downloadPngBtn"), printBtn: $("#printBtn"), closeDialogBtn: $("#closeDialogBtn"),
  textDialog: $("#textDialog"), textDialogTitle: $("#textDialogTitle"), textTabs: $("#textTabs"), generatedText: $("#generatedText"),
  copyTextBtn: $("#copyTextBtn"), closeTextDialogBtn: $("#closeTextDialogBtn"), toast: $("#toast")
};

const fieldIds = [
  "customerName", "phone", "address", "lineName", "model", "color", "vehicleVariant", "battery", "chassisNo", "batteryNo",
  "licenseMode", "deliveryMode", "price", "cost", "netProfit", "deposit", "balancePaid", "paymentMethod", "status",
  "deliveredAt", "notes"
];
const fields = Object.fromEntries(fieldIds.map((id) => [id, $("#" + id)]));

let auth;
let db;
let currentUser = null;
let currentOrders = [];
let currentDocumentName = "小宇微電文件";
let currentTextMap = {};
const selectedOrderIds = new Set();


const VEHICLE_COSTS = {
  "大偉士改裝版": [
    { label: "鉛酸版", battery: "鉛酸", cost: 29000 },
    { label: "三元鋰30Ah", battery: "三元鋰30Ah", cost: 42000 },
    { label: "鋰鐵30Ah", battery: "鋰鐵30Ah", cost: 49000 }
  ],
  "大偉士": [
    { label: "鉛酸版", battery: "鉛酸", cost: 29000 },
    { label: "三元鋰30Ah", battery: "三元鋰30Ah", cost: 42000 },
    { label: "鋰鐵30Ah", battery: "鋰鐵30Ah", cost: 49000 }
  ],
  "小偉士": [
    { label: "鉛酸版", battery: "鉛酸", cost: 23000 },
    { label: "三元鋰30Ah", battery: "三元鋰30Ah", cost: 31600 },
    { label: "鋰鐵30Ah", battery: "鋰鐵30Ah", cost: 38000 }
  ],
  "神盾": [
    { label: "鉛酸版", battery: "鉛酸", cost: 24000 },
    { label: "三元鋰30Ah", battery: "三元鋰30Ah", cost: 32600 },
    { label: "鋰鐵30Ah", battery: "鋰鐵30Ah", cost: 40000 }
  ],
  "輕風": [
    { label: "鉛酸版", battery: "鉛酸", cost: 24000 },
    { label: "三元鋰30Ah", battery: "三元鋰30Ah", cost: 32600 },
    { label: "鋰鐵30Ah", battery: "鋰鐵30Ah", cost: 40000 }
  ],
  "Z3": [
    { label: "普通版（鉛酸）", battery: "鉛酸", cost: 30000 },
    { label: "暗魂版（鉛酸）", battery: "鉛酸", cost: 32000 },
    { label: "三元鋰30Ah", battery: "三元鋰30Ah", cost: 42000 },
    { label: "暗魂三元鋰30Ah", battery: "三元鋰30Ah", cost: 45000 },
    { label: "鋰鐵30Ah", battery: "鋰鐵30Ah", cost: 49000 },
    { label: "暗魂鋰鐵30Ah", battery: "鋰鐵30Ah", cost: 51000 }
  ],
  "正9號": [
    { label: "鉛酸版", battery: "鉛酸", cost: 29000 },
    { label: "三元鋰30Ah", battery: "三元鋰30Ah", cost: 43000 },
    { label: "鋰鐵30Ah", battery: "鋰鐵30Ah", cost: 49000 }
  ],
  "小可愛（拿鐵）": [
    { label: "鉛酸版", battery: "鉛酸", cost: 25000 },
    { label: "三元鋰30Ah", battery: "三元鋰30Ah", cost: 33600 }
  ],
  "QC": [
    { label: "鉛酸版", battery: "鉛酸", cost: 27000 },
    { label: "三元鋰30Ah", battery: "三元鋰30Ah", cost: 39000 },
    { label: "鋰鐵30Ah", battery: "鋰鐵30Ah", cost: 47000 }
  ],
  "小酷龍": [
    { label: "鉛酸版（無鋰電版）", battery: "鉛酸", cost: 16000 }
  ],
  "微型三輪": [
    { label: "鉛酸版（無鋰電版）", battery: "鉛酸", cost: 28000 }
  ],
  "Dio": [
    { label: "鉛酸版", battery: "鉛酸", cost: 25000 },
    { label: "三元鋰30Ah", battery: "三元鋰30Ah", cost: 33600 },
    { label: "鋰鐵30Ah", battery: "鋰鐵30Ah", cost: 40000 }
  ],
  "其他": [
    { label: "其他／手動輸入成本", battery: "其他", cost: 0 }
  ]
};

function hasRealFirebaseConfig(config) {
  return Boolean(config.apiKey && config.projectId && config.appId && !Object.values(config).some((value) => String(value).includes("YOUR_")));
}
function normalizeEmail(value) { return String(value || "").trim().toLowerCase(); }

function friendlyAuthError(error) {
  const code = String(error?.code || "");
  if (code.includes("unauthorized-domain")) {
    const host = window.location.hostname || "目前網站網域";
    return `目前網域 ${host} 尚未加入 Firebase 授權網域。請到 Firebase Authentication → 設定 → 授權網域，新增 ${host}。`;
  }
  if (code.includes("popup-closed-by-user")) return "Google 登入視窗已關閉，請重新點一次登入。";
  if (code.includes("popup-blocked")) return "瀏覽器封鎖了登入視窗，請允許彈出視窗後重試。";
  if (code.includes("network-request-failed")) return "網路連線失敗，請確認網路後再試。";
  return error?.message || "登入失敗，請改用 Safari 或 Chrome。";
}
function cleanName(value) {
  return String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ");
}
function normalizedNameKey(value) {
  return cleanName(value).replace(/\s+/g, "").toLowerCase();
}
function cleanPhone(value) {
  let digits = String(value || "").normalize("NFKC").replace(/\D/g, "");
  if (digits.startsWith("886") && digits.length >= 11) digits = `0${digits.slice(3)}`;
  return digits;
}
function customerKey(name, phone) {
  return `${normalizedNameKey(name)}|${cleanPhone(phone)}`;
}
function isWebsiteCheckoutRecord(order) {
  return String(order?.source || "").startsWith("official-store") && String(order?.createdBy || "") === "public-store";
}
function isAcceptedWebsiteRecord(order) {
  return String(order?.reviewStatus || "") === "accepted" || !!order?.acceptedAt || order?.migratedFromOnlineOrder === true;
}
function isVisibleHistoricalOrder(order) {
  return !isWebsiteCheckoutRecord(order) || isAcceptedWebsiteRecord(order);
}
function findDuplicateOrder(name, phone, excludeId = "") {
  const key = customerKey(name, phone);
  if (!key || key === "|") return null;
  return currentOrders.find((order) => order.id !== excludeId && customerKey(order.customerName, order.phone) === key) || null;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}
function numberValue(value) { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0; }
function integerValue(value) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.round(parsed) : 0; }
function formatMoney(value) { return `NT$${numberValue(value).toLocaleString("zh-TW")}`; }
function formatProfit(value) {
  const amount = integerValue(value);
  const sign = amount < 0 ? "-" : "";
  return `${sign}NT$${Math.abs(amount).toLocaleString("zh-TW")}`;
}
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
function calculateNetProfit(order) {
  return numberValue(order.price) - effectiveCost(order);
}
function normalizeInsuranceHandling(value) {
  return String(value || "").includes("代辦") ? "代辦" : "自行辦理";
}
function variantOptionsFor(model) {
  return VEHICLE_COSTS[model] || VEHICLE_COSTS["其他"];
}
function selectedVariantInfo() {
  return variantOptionsFor(fields.model.value).find((item) => item.label === fields.vehicleVariant.value) || variantOptionsFor(fields.model.value)[0];
}
function inferVariant(order) {
  const variants = variantOptionsFor(order.model);
  const text = `${order.vehicleVariant || ""} ${order.battery || ""}`;
  if (order.model === "Z3" && text.includes("暗魂") && text.includes("三元")) return "暗魂三元鋰30Ah";
  if (order.model === "Z3" && text.includes("暗魂") && (text.includes("鋰鐵") || (text.includes("鋰") && !text.includes("三元")))) return "暗魂鋰鐵30Ah";
  if (order.model === "Z3" && text.includes("暗魂")) return "暗魂版（鉛酸）";
  if (text.includes("三元")) return variants.find((item) => item.label.includes("三元"))?.label || variants[0].label;
  if (text.includes("鋰鐵") || text.includes("鋰")) return variants.find((item) => item.label.includes("鋰鐵"))?.label || variants[0].label;
  return variants[0].label;
}
function normalizedOrderModel(order) {
  if (VEHICLE_COSTS[order.model]) return order.model;
  return interpretVehicleText(order.model).model;
}
function effectiveCost(order) {
  const saved = numberValue(order.cost);
  if (saved > 0) return saved;
  const model = normalizedOrderModel(order);
  const variants = variantOptionsFor(model);
  const variant = inferVariant({ ...order, model });
  return variants.find((item) => item.label === variant)?.cost || interpretVehicleText(order.model).cost || 0;
}
function updateVariantOptions({ savedVariant = "", savedCost = null } = {}) {
  const variants = variantOptionsFor(fields.model.value);
  fields.vehicleVariant.innerHTML = variants.map((item) => `<option value="${escapeHtml(item.label)}">${escapeHtml(item.label)}</option>`).join("");
  const wanted = variants.some((item) => item.label === savedVariant) ? savedVariant : variants[0].label;
  fields.vehicleVariant.value = wanted;
  const info = selectedVariantInfo();
  fields.battery.value = info.battery;
  fields.cost.value = savedCost === null ? String(info.cost) : String(numberValue(savedCost));
  updateMoneyPreview();
}
function applySelectedVariantCost() {
  const info = selectedVariantInfo();
  fields.battery.value = info.battery;
  fields.cost.value = String(info.cost);
  updateMoneyPreview();
}
function orderFromForm() {
  const data = Object.fromEntries(fieldIds.map((id) => [id, fields[id].value.trim ? fields[id].value.trim() : fields[id].value]));
  data.customerName = cleanName(data.customerName);
  data.phone = cleanPhone(data.phone);
  data.address = String(data.address || "").normalize("NFKC").trim().replace(/\s+/g, " ");
  data.price = numberValue(fields.price.value);
  data.cost = numberValue(fields.cost.value);
  data.netProfit = calculateNetProfit(data);
  data.deposit = numberValue(fields.deposit.value);
  data.balancePaid = numberValue(fields.balancePaid.value);
  data.licenseMode = normalizeInsuranceHandling(fields.licenseMode.value);
  return data;
}
function updateMoneyPreview() {
  const data = orderFromForm();
  fields.netProfit.value = String(data.netProfit);
  elements.unpaidPreview.textContent = formatMoney(calculateUnpaid(data));
  elements.netProfitPreview.textContent = formatProfit(data.netProfit);
  elements.netProfitPreview.classList.toggle("negative", data.netProfit < 0);
}
function resetForm() {
  elements.orderForm.reset();
  elements.editingId.value = "";
  elements.formTitle.textContent = "建立訂單";
  fields.model.value = "小偉士";
  fields.price.value = "0";
  fields.deposit.value = "0";
  fields.balancePaid.value = "0";
  fields.licenseMode.value = "代辦";
  fields.deliveryMode.value = "到府交車";
  fields.paymentMethod.value = "轉帳";
  fields.status.value = "待訂金";
  updateVariantOptions();
  setMessage("");
  updateMoneyPreview();
}
function fillForm(order) {
  elements.editingId.value = order.id;
  const simpleFields = fieldIds.filter((id) => !["model", "vehicleVariant", "battery", "cost", "netProfit", "licenseMode"].includes(id));
  for (const id of simpleFields) fields[id].value = order[id] ?? "";
  const formModel = normalizedOrderModel(order);
  if (!Array.from(fields.model.options).some((option) => option.value === formModel)) {
    fields.model.add(new Option(formModel || "其他", formModel || "其他"));
  }
  fields.model.value = formModel || "其他";
  updateVariantOptions({ savedVariant: order.vehicleVariant || inferVariant({ ...order, model: formModel }), savedCost: effectiveCost(order) });
  fields.battery.value = order.battery || selectedVariantInfo().battery;
  fields.licenseMode.value = normalizeInsuranceHandling(order.licenseMode);
  fields.netProfit.value = String(calculateNetProfit(order));
  elements.formTitle.textContent = `編輯訂單｜${order.id}`;
  updateMoneyPreview();
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
  if (!auth) {
    elements.loginMessage.textContent = "登入程式尚未完成載入，請重新整理頁面後再試。";
    return;
  }
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
    elements.loginMessage.textContent = friendlyAuthError(error);
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


function splitBulkLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed) return [];
  if (trimmed.includes("\t")) return trimmed.split("\t").map((part) => part.trim());
  return trimmed.split(/\s*(?:,|，|、|\||｜)\s*/).map((part) => part.trim());
}
function parseBulkOrders() {
  const lines = String(elements.bulkOrdersInput?.value || "").split(/\r?\n/);
  const valid = [];
  const invalid = [];
  const duplicates = [];
  const batchKeys = new Set();

  lines.forEach((line, index) => {
    if (!line.trim()) return;
    const parts = splitBulkLine(line);
    const looksLikeHeader = index === 0 && parts.some((part) => /車主|姓名|電話|手機|車款/.test(part));
    if (looksLikeHeader) return;

    const [rawName = "", rawPhone = "", rawModel = "", rawAddress = ""] = parts;
    const customerName = cleanName(rawName);
    const phone = cleanPhone(rawPhone);
    const model = String(rawModel || "").normalize("NFKC").trim();
    const address = String(rawAddress || "").normalize("NFKC").trim().replace(/\s+/g, " ");

    if (!customerName || !phone || !model) {
      invalid.push({ lineNo: index + 1, line, reason: "需包含車主姓名、電話、車款" });
      return;
    }

    const key = customerKey(customerName, phone);
    const existing = findDuplicateOrder(customerName, phone);
    if (existing) {
      duplicates.push({ customerName, phone, model, address, lineNo: index + 1, reason: `既有訂單 ${existing.id}` });
      return;
    }
    if (batchKeys.has(key)) {
      duplicates.push({ customerName, phone, model, address, lineNo: index + 1, reason: "本批資料內重複" });
      return;
    }

    batchKeys.add(key);
    valid.push({ customerName, phone, model, address, lineNo: index + 1 });
  });

  return { valid, invalid, duplicates };
}
function renderBulkPreview() {
  const { valid, invalid, duplicates } = parseBulkOrders();
  if (!valid.length && !invalid.length && !duplicates.length) {
    elements.bulkPreview.innerHTML = '<p class="empty">尚未輸入批量資料。</p>';
    elements.bulkMessage.textContent = "";
    elements.bulkMessage.classList.remove("success");
    return { valid, invalid, duplicates };
  }

  const validHtml = valid.map((item) => `
    <article class="order-row">
      <div class="order-select-wrap"></div>
      <div class="order-main"><strong>${escapeHtml(item.customerName)}</strong><small>${escapeHtml(item.phone)}</small></div>
      <div class="order-car"><strong>${escapeHtml(item.model)}</strong><small>${escapeHtml(item.address || "地址待補")}</small></div>
      <div class="order-money"><span class="badge">可新增</span><small>第 ${item.lineNo} 行</small></div>
    </article>`).join("");
  const duplicateHtml = duplicates.map((item) => `
    <article class="order-row">
      <div class="order-select-wrap"></div>
      <div class="order-main"><strong>${escapeHtml(item.customerName)}｜重複</strong><small>${escapeHtml(item.phone)}</small></div>
      <div class="order-car"><strong>${escapeHtml(item.reason)}</strong><small>第 ${item.lineNo} 行</small></div>
      <div class="order-money"><span class="badge duplicate-badge">不新增</span></div>
    </article>`).join("");
  const invalidHtml = invalid.map((item) => `
    <article class="order-row">
      <div class="order-select-wrap"></div>
      <div class="order-main"><strong>第 ${item.lineNo} 行資料不完整</strong><small>${escapeHtml(item.line)}</small></div>
      <div class="order-car"><strong>${escapeHtml(item.reason)}</strong></div>
      <div class="order-money"><span class="badge duplicate-badge">略過</span></div>
    </article>`).join("");

  elements.bulkPreview.innerHTML = validHtml + duplicateHtml + invalidHtml;
  const messages = [`可新增 ${valid.length} 筆`];
  if (duplicates.length) messages.push(`重複 ${duplicates.length} 筆`);
  if (invalid.length) messages.push(`不完整 ${invalid.length} 筆`);
  elements.bulkMessage.textContent = `${messages.join("，")}。重複資料不會建立。`;
  elements.bulkMessage.classList.toggle("success", valid.length > 0 && invalid.length === 0 && duplicates.length === 0);
  return { valid, invalid, duplicates };
}
function interpretVehicleText(rawText) {
  const raw = String(rawText || "").trim();
  const aliases = [
    ["大偉士", "大偉士改裝版"], ["小偉士", "小偉士"], ["神盾", "神盾"], ["輕風", "輕風"],
    ["Z3", "Z3"], ["正9號", "正9號"], ["9號", "正9號"], ["小可愛", "小可愛（拿鐵）"],
    ["拿鐵", "小可愛（拿鐵）"], ["QC", "QC"], ["小酷龍", "小酷龍"], ["微型三輪", "微型三輪"], ["Dio", "Dio"]
  ];
  const found = aliases.find(([alias]) => raw.toLowerCase().includes(alias.toLowerCase()));
  const model = found?.[1] || raw || "其他";
  const variants = variantOptionsFor(model);
  let variant = variants[0].label;
  if (model === "Z3" && raw.includes("暗魂") && raw.includes("三元")) variant = "暗魂三元鋰30Ah";
  else if (model === "Z3" && raw.includes("暗魂") && (raw.includes("鋰鐵") || (raw.includes("鋰") && !raw.includes("三元")))) variant = "暗魂鋰鐵30Ah";
  else if (model === "Z3" && raw.includes("暗魂")) variant = "暗魂版（鉛酸）";
  else if (raw.includes("三元")) variant = variants.find((item) => item.label.includes("三元"))?.label || variant;
  else if (raw.includes("鋰鐵") || raw.includes("鋰")) variant = variants.find((item) => item.label.includes("鋰鐵"))?.label || variant;
  const info = variants.find((item) => item.label === variant) || variants[0];
  const colors = ["消光黑", "鐵灰色", "鐵灰", "深灰", "淺灰", "紫色", "紫", "黑色", "黑", "白色", "白", "綠色", "綠", "紅色", "紅", "藍色", "藍", "灰色", "灰", "銀色", "銀", "粉色", "粉"];
  const color = colors.find((item) => raw.includes(item)) || "待確認";
  return { model, vehicleVariant: info.label, battery: info.battery, cost: info.cost, color };
}
function bulkOrderDefaults(item) {
  const vehicle = interpretVehicleText(item.model);
  return {
    customerName: item.customerName,
    phone: item.phone,
    model: vehicle.model,
    vehicleVariant: vehicle.vehicleVariant,
    address: item.address || "待補資料",
    lineName: "",
    color: vehicle.color,
    battery: vehicle.battery,
    chassisNo: "",
    batteryNo: "",
    licenseMode: "代辦",
    deliveryMode: "到府交車",
    price: 0,
    cost: vehicle.cost,
    netProfit: -vehicle.cost,
    deposit: 0,
    balancePaid: 0,
    paymentMethod: "轉帳",
    status: "待訂金",
    deliveredAt: "",
    notes: item.address ? "批量新增" : "批量新增，送車地址待補"
  };
}
async function importBulkOrders() {
  const { valid, invalid, duplicates } = renderBulkPreview();
  if (!valid.length) {
    elements.bulkMessage.textContent = "沒有可新增的完整資料。";
    elements.bulkMessage.classList.remove("success");
    return;
  }
  if (valid.length > 300) {
    elements.bulkMessage.textContent = "一次最多新增 300 筆，請分批匯入。";
    elements.bulkMessage.classList.remove("success");
    return;
  }
  elements.importBulkBtn.disabled = true;
  elements.previewBulkBtn.disabled = true;
  elements.bulkMessage.textContent = `正在新增 ${valid.length} 筆訂單…`;
  elements.bulkMessage.classList.add("success");
  try {
    const batch = writeBatch(db);
    const generatedIds = new Set();
    valid.forEach((item) => {
      let id = createOrderId();
      while (generatedIds.has(id)) id = createOrderId();
      generatedIds.add(id);
      const data = bulkOrderDefaults(item);
      batch.set(doc(db, "orders", id), {
        ...data,
        orderNo: id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser.uid,
        updatedBy: currentUser.uid,
        importMode: "bulk"
      });
    });
    await batch.commit();
    elements.bulkOrdersInput.value = "";
    elements.bulkPreview.innerHTML = '<p class="empty">批量新增完成。</p>';
    const skipped = invalid.length + duplicates.length;
    elements.bulkMessage.textContent = `已成功新增 ${valid.length} 筆訂單${skipped ? `，略過 ${skipped} 筆重複或不完整資料` : ""}。`;
    elements.bulkMessage.classList.add("success");
    showToast(`已新增 ${valid.length} 筆訂單`);
    await loadOrders();
  } catch (error) {
    console.error(error);
    elements.bulkMessage.textContent = String(error?.code || "").includes("permission-denied")
      ? "批量新增失敗：請確認 Firestore 規則已發布。"
      : (error?.message || "批量新增失敗。");
    elements.bulkMessage.classList.remove("success");
  } finally {
    elements.importBulkBtn.disabled = false;
    elements.previewBulkBtn.disabled = false;
  }
}

async function saveOrder({ openDepositReceipt = false } = {}) {
  const data = orderFromForm();
  if (!data.customerName || !data.phone || !data.address || !data.model || !data.color) {
    setMessage("請填寫車主姓名、手機、送車地址、車款與顏色。", false);
    return null;
  }
  const editingId = elements.editingId.value;
  const duplicate = findDuplicateOrder(data.customerName, data.phone, editingId);
  if (duplicate) {
    setMessage(`此客戶已有訂單 ${duplicate.id}，請直接編輯原訂單，不會重複建立。`, false);
    return null;
  }
  const id = editingId || createOrderId();
  setMessage("正在儲存訂單…", true);
  elements.saveOrderBtn.disabled = true;
  elements.saveAndReceiptBtn.disabled = true;
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
  } finally {
    elements.saveOrderBtn.disabled = false;
    elements.saveAndReceiptBtn.disabled = false;
  }
}

async function loadOrders() {
  elements.orderList.innerHTML = '<p class="empty">讀取中…</p>';
  try {
    const snapshot = await getDocs(collection(db, "orders"));
    currentOrders = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter(isVisibleHistoricalOrder);
    const statusRank = { "待訂金": 1, "已付訂金": 2, "備車中": 3, "待交車": 4, "已交車": 5, "取消": 6 };
    currentOrders.sort((a, b) => {
      const statusDiff = (statusRank[a.status] || 99) - (statusRank[b.status] || 99);
      if (statusDiff !== 0) return statusDiff;
      const at = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
      const bt = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
      return bt - at;
    });
    const currentIds = new Set(currentOrders.map((order) => order.id));
    [...selectedOrderIds].forEach((id) => { if (!currentIds.has(id)) selectedOrderIds.delete(id); });
    renderOrders();
    renderStats();
    renderMonthlySummary();
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
function updateSelectionUi() {
  const count = selectedOrderIds.size;
  elements.selectionCount.textContent = `已選 ${count} 筆`;
  elements.deleteSelectedBtn.disabled = count === 0;
}
function renderOrders() {
  const orders = filteredOrders();
  if (!orders.length) {
    elements.orderList.innerHTML = '<p class="empty">目前沒有符合條件的訂單。</p>';
    updateSelectionUi();
    return;
  }
  elements.orderList.innerHTML = orders.map((order) => {
    const selected = selectedOrderIds.has(order.id);
    return `
    <article class="order-row ${selected ? "selected" : ""}" data-id="${escapeHtml(order.id)}">
      <label class="order-select-wrap" title="選取訂單"><input class="order-select" type="checkbox" data-order-id="${escapeHtml(order.id)}" ${selected ? "checked" : ""} aria-label="選取 ${escapeHtml(order.customerName || order.id)}" /></label>
      <div class="order-main"><strong>${escapeHtml(order.customerName || "未命名")}</strong><small>${escapeHtml(order.phone || "—")}｜${escapeHtml(order.id)}</small></div>
      <div class="order-car"><strong>${escapeHtml(order.color || "")} ${escapeHtml(order.model || "")}</strong><small>${escapeHtml(order.vehicleVariant || order.battery || "")}｜領牌強制險：${escapeHtml(normalizeInsuranceHandling(order.licenseMode))}</small></div>
      <div class="order-money"><span class="badge">${escapeHtml(order.status || "未設定")}</span><strong>${formatProfit(calculateNetProfit(order))}</strong><small>成交 ${formatMoney(order.price)}｜成本 ${formatMoney(effectiveCost(order))}｜待收 ${formatMoney(calculateUnpaid(order))}</small></div>
      <div class="row-actions">
        <button class="secondary" data-action="edit">編輯</button>
        <button class="secondary" data-action="deposit">訂金收據</button>
        <button class="secondary" data-action="balance">尾款收據</button>
        <button class="secondary" data-action="warranty">保固卡</button>
        <button class="secondary" data-action="delivery">交車卡</button>
        <button class="secondary" data-action="text">文案</button>
        <button class="secondary danger" data-action="delete">刪除</button>
      </div>
    </article>`;
  }).join("");
  updateSelectionUi();
}
async function deleteSelectedOrders() {
  const ids = [...selectedOrderIds];
  if (!ids.length) return;
  if (!confirm(`確定刪除已選取的 ${ids.length} 筆訂單？\n\n已開立的收據與保固卡不會自動刪除。`)) return;

  elements.deleteSelectedBtn.disabled = true;
  elements.deleteSelectedBtn.textContent = "刪除中…";
  try {
    for (let index = 0; index < ids.length; index += 450) {
      const batch = writeBatch(db);
      ids.slice(index, index + 450).forEach((id) => batch.delete(doc(db, "orders", id)));
      await batch.commit();
    }
    selectedOrderIds.clear();
    showToast(`已刪除 ${ids.length} 筆訂單`);
    await loadOrders();
  } catch (error) {
    console.error(error);
    showToast("批量刪除失敗，請重新整理後再試");
  } finally {
    elements.deleteSelectedBtn.textContent = "刪除已選訂單";
    updateSelectionUi();
  }
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

function currentMonthString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function summaryOrders() {
  const showAll = elements.summaryScope?.value === "all";
  if (showAll) return [...currentOrders];
  const month = elements.monthPicker.value || currentMonthString();
  return currentOrders.filter((order) => order.status !== "取消" && String(order.deliveredAt || "").startsWith(month));
}
function orderTimestamp(order) {
  if (order.deliveredAt) return new Date(`${order.deliveredAt}T00:00:00`).getTime() || 0;
  if (typeof order.updatedAt?.toMillis === "function") return order.updatedAt.toMillis();
  if (typeof order.createdAt?.toMillis === "function") return order.createdAt.toMillis();
  return (order.updatedAt?.seconds || order.createdAt?.seconds || 0) * 1000;
}
function renderMonthlySummary() {
  if (!elements.monthPicker.value) elements.monthPicker.value = currentMonthString();
  const showAll = elements.summaryScope?.value === "all";
  elements.monthPicker.disabled = showAll;
  elements.monthPickerWrap?.classList.toggle("disabled", showAll);
  elements.summaryEyebrow.textContent = showAll ? "所有訂單統計" : "每月交車統計";
  elements.statMonthCountLabel.textContent = showAll ? "訂單筆數" : "交車台數";
  elements.summaryNote.textContent = showAll
    ? "顯示全部訂單；取消訂單仍會列出，但不計入成交總額、成本與淨利。"
    : "每月統計只計入已填寫「實際交車日」的訂單；切換月份即可查看過去紀錄。";

  const orders = summaryOrders();
  const financialOrders = showAll ? orders.filter((order) => order.status !== "取消") : orders;
  const revenue = financialOrders.reduce((sum, order) => sum + numberValue(order.price), 0);
  const cost = financialOrders.reduce((sum, order) => sum + effectiveCost(order), 0);
  const profit = financialOrders.reduce((sum, order) => sum + calculateNetProfit(order), 0);
  elements.statMonthDelivered.textContent = orders.length.toLocaleString("zh-TW");
  elements.statMonthRevenue.textContent = formatMoney(revenue);
  elements.statMonthCost.textContent = formatMoney(cost);
  elements.statMonthProfit.textContent = formatProfit(profit);
  elements.statMonthProfit.classList.toggle("negative", profit < 0);
  if (!orders.length) {
    elements.monthOrderList.innerHTML = `<p class="empty">${showAll ? "目前尚無訂單。" : "該月份尚無實際交車紀錄。"}</p>`;
    return;
  }
  elements.monthOrderList.innerHTML = orders
    .sort((a, b) => orderTimestamp(b) - orderTimestamp(a))
    .map((order) => {
      const dateText = order.deliveredAt ? displayDate(order.deliveredAt) : "尚未交車";
      const statusText = order.status || "未設定";
      const profitText = order.status === "取消" ? "取消訂單" : `淨利 ${formatProfit(calculateNetProfit(order))}`;
      return `<div class="month-order-row"><span>${dateText}</span><strong>${escapeHtml(order.customerName || "未命名")}｜${escapeHtml(order.color || "")} ${escapeHtml(order.model || "")}<small class="summary-status">${escapeHtml(statusText)}</small></strong><span>${profitText}</span></div>`;
    })
    .join("");
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
        <div class="doc-field"><span>成交價</span><strong>${formatMoney(order.price)}</strong></div>
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
  const warrantyUrl = new URL(`../warranty.html?id=${encodeURIComponent(warrantyId)}`, location.href).href;
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
  const licenseText = normalizeInsuranceHandling(order.licenseMode) === "代辦" ? "可協助代辦領牌與強制險" : "由車主自行辦理領牌與強制險";
  return {
    "Facebook": `🎉 ${vehicle} ${action}！\n\n感謝車主對小宇微電的信任😊\n這次選擇的是 ${order.model}｜${order.color}｜${order.battery || "電池版本依訂單"}。\n\n✔ 全台可安排配送\n✔ 家用插座即可充電\n✔ ${licenseText}\n✔ 完整售後與保固服務\n\n想了解車款、現貨或最新優惠，歡迎加入官方 LINE：${uiConfig.lineId || "@762eqvlg"}\n\n#小宇微電 #微型電動二輪 #電動車 #${String(order.model || "").replaceAll(" ", "")} #到府交車`,
    "Instagram": `${vehicle} ${deliveryDone ? "交車成功" : "訂購完成"}🛵✨\n\n感謝車主支持！\n📍全台配送\n📍領牌強制險可代辦／自行辦理\n📍售後保固\n\n官方 LINE：${uiConfig.lineId || "@762eqvlg"}\n\n#小宇微電 #微型電動二輪 #電動車 #交車日常`,
    "Threads": `今天${deliveryDone ? "交了一台" : "接到一台訂單"} ${vehicle}。\n\n${order.color}實車真的很好看，照片跟現場的感覺又不太一樣。想看其他顏色或車款的，也可以直接留言或私訊我。`,
    "限時動態": `🎉 ${deliveryDone ? "今日交車" : "訂購完成"}\n${vehicle}\n${order.deliveryMode || "全台配送"}\n找小宇買微電，不走彎路\nLINE：${uiConfig.lineId || "@762eqvlg"}`,
    "影片口白": `今天跟大家分享的是${order.color}的${order.model}。這台已經${deliveryDone ? "順利完成交車" : "完成下訂，接下來會安排備車與配送"}。感謝車主選擇小宇微電，有車款、續航、領牌或分期問題，都可以直接加入官方 LINE 詢問。`,
    "收到訂金 LINE": `您好😊 已收到您的訂金，${order.color}${order.model}已正式為您保留。\n\n訂單編號：${order.id}\n已收訂金：${formatMoney(order.deposit)}\n待付尾款：${formatMoney(calculateUnpaid(order))}\n領牌強制險：${normalizeInsuranceHandling(order.licenseMode)}\n\n後續文件或送車安排確認後，我會再提前通知您，請留意陌生來電，謝謝您的信任🙏`,
    "送車提醒 LINE": `您好😊 您的${order.color}${order.model}即將安排送車。\n\n送車地址：${order.address}\n交車方式：${order.deliveryMode || "到府交車"}\n領牌強制險：${normalizeInsuranceHandling(order.licenseMode)}\n\n送車前會有專人電話聯繫，還請您留意陌生來電，避免漏接，謝謝您🙏`,
    "自行辦理領牌強制險 LINE": `您好😊 您本次選擇自行辦理領牌與強制險，請依監理機關規定完成辦理；如有資料問題可直接聯絡我協助確認。`
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
  const headers = ["訂單編號","車主姓名","電話","送車地址","車款","顏色","車款版本","電池","成交價","成本","淨利","訂金","已收尾款","未收金額","付款方式","領牌強制險","交車方式","狀態","實際交車日","車架號","電池編號","備註"];
  const rows = currentOrders.map((order) => [order.id,order.customerName,order.phone,order.address,order.model,order.color,order.vehicleVariant || "",order.battery,order.price,effectiveCost(order),calculateNetProfit(order),order.deposit,order.balancePaid,calculateUnpaid(order),order.paymentMethod,normalizeInsuranceHandling(order.licenseMode),order.deliveryMode,order.status,order.deliveredAt,order.chassisNo,order.batteryNo,order.notes]);
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
elements.previewBulkBtn?.addEventListener("click", renderBulkPreview);
elements.importBulkBtn?.addEventListener("click", importBulkOrders);
elements.clearBulkBtn?.addEventListener("click", () => {
  elements.bulkOrdersInput.value = "";
  renderBulkPreview();
});
elements.bulkOrdersInput?.addEventListener("input", () => {
  elements.bulkMessage.textContent = "";
  elements.bulkMessage.classList.remove("success");
});
fields.model.addEventListener("change", () => updateVariantOptions());
fields.vehicleVariant.addEventListener("change", applySelectedVariantCost);
fields.cost.addEventListener("input", updateMoneyPreview);
elements.summaryScope?.addEventListener("change", renderMonthlySummary);
elements.monthPicker.addEventListener("change", renderMonthlySummary);
fields.price.addEventListener("input", updateMoneyPreview);
fields.deposit.addEventListener("input", updateMoneyPreview);
fields.balancePaid.addEventListener("input", updateMoneyPreview);
elements.orderForm.addEventListener("submit", async (event) => { event.preventDefault(); await saveOrder(); });
elements.saveAndReceiptBtn.addEventListener("click", async () => { await saveOrder({ openDepositReceipt: true }); });
elements.resetBtn.addEventListener("click", resetForm);
elements.refreshOrdersBtn.addEventListener("click", loadOrders);
elements.searchInput.addEventListener("input", renderOrders);
elements.statusFilter.addEventListener("change", renderOrders);
elements.exportCsvBtn.addEventListener("click", exportCsv);
elements.selectVisibleBtn.addEventListener("click", () => {
  filteredOrders().forEach((order) => selectedOrderIds.add(order.id));
  renderOrders();
});
elements.clearSelectionBtn.addEventListener("click", () => {
  selectedOrderIds.clear();
  renderOrders();
});
elements.deleteSelectedBtn.addEventListener("click", deleteSelectedOrders);
elements.orderList.addEventListener("change", (event) => {
  const checkbox = event.target.closest("input.order-select");
  if (!checkbox) return;
  if (checkbox.checked) selectedOrderIds.add(checkbox.dataset.orderId);
  else selectedOrderIds.delete(checkbox.dataset.orderId);
  checkbox.closest(".order-row")?.classList.toggle("selected", checkbox.checked);
  updateSelectionUi();
});
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

function safeFileName(value) {
  return String(value || "小宇微電文件").replace(/[\\/:*?"<>|]/g, "-").trim() || "小宇微電文件";
}

async function renderCurrentDocumentToFile() {
  const sheet = elements.documentCanvas.querySelector(".doc-sheet");
  if (!sheet || !window.html2canvas) throw new Error("圖片工具尚未載入");

  if (document.fonts?.ready) await document.fonts.ready;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const scale = Math.max(2, Math.min(3, Number(window.devicePixelRatio || 1) * 2));
  const canvas = await window.html2canvas(sheet, {
    scale,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    imageTimeout: 15000
  });

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("圖片轉換失敗")), "image/png", 1);
  });

  return new File([blob], `${safeFileName(currentDocumentName)}.png`, {
    type: "image/png",
    lastModified: Date.now()
  });
}

async function withDocumentImage(button, action) {
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "圖片製作中…";
  try {
    const file = await renderCurrentDocumentToFile();
    await action(file);
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      showToast(error?.message || "圖片產生失敗，可改用列印存成 PDF");
    }
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

elements.savePhotoBtn?.addEventListener("click", async () => {
  await withDocumentImage(elements.savePhotoBtn, async (file) => {
    const shareData = { files: [file], title: currentDocumentName };
    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
      await navigator.share(shareData);
      showToast("請在分享選單點「儲存影像」");
      return;
    }

    const url = URL.createObjectURL(file);
    const opened = window.open(url, "_blank");
    if (opened) {
      showToast("圖片已開啟，請長按後選「儲存到照片」");
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }

    const link = document.createElement("a");
    link.download = file.name;
    link.href = url;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
    showToast("已下載到檔案 App，可再分享並儲存影像");
  });
});

elements.downloadPngBtn.addEventListener("click", async () => {
  await withDocumentImage(elements.downloadPngBtn, async (file) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.download = file.name;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
    showToast("圖片已下載到檔案 App");
  });
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
  try {
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
      try {
        if (!user) return showLoggedOut();
        if (user.isAnonymous) {
          await signOut(auth);
          return;
        }
        if (!(await isAdminUser(user))) return showDenied(user);
        await showApp(user);
      } catch (error) {
        console.error(error);
        showLoggedOut();
        elements.loginMessage.textContent = error?.message || "登入狀態讀取失敗，請重新整理後再試。";
      }
    });
  } catch (error) {
    console.error(error);
    elements.loginCard.classList.remove("hidden");
    elements.loginBtn.disabled = false;
    elements.loginMessage.textContent = error?.message || "系統載入失敗，請重新整理頁面。";
  }
}
start();
