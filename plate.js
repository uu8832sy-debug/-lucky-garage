import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { doc, getFirestore, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = window.LUCKY_GARAGE_FIREBASE_CONFIG || {};
const config = window.YU_STORE_CONFIG || {};
const db = getFirestore(initializeApp(firebaseConfig));
const $ = (selector) => document.querySelector(selector);
const money = (value) => `NT$${Math.max(0, Number(value) || 0).toLocaleString("zh-TW")}`;
let captcha = 0;

function cleanPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("886")) digits = `0${digits.slice(3)}`;
  return digits;
}
function taipeiDayKey() {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Taipei", year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}${values.month}${values.day}`;
  } catch {
    const date = new Date();
    return `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}`;
  }
}
async function fingerprintToken(value) {
  const input = String(value || "");
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return [...new Uint8Array(digest)].slice(0, 6).map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  } catch {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return Math.abs(hash >>> 0).toString(16).padStart(8, "0").toUpperCase();
  }
}
async function makeId(fingerprint) {
  return `PLATE-${taipeiDayKey()}-${await fingerprintToken(fingerprint)}`;
}
function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 3200);
}
function lineChatUrl() {
  return config.lineUrl || "https://line.me/R/ti/p/%40762eqvlg";
}
function linePrefilledMessageUrl(message) {
  const lineId = String(config.lineId || "@762eqvlg");
  return `https://line.me/R/oaMessage/${encodeURIComponent(lineId)}/?${encodeURIComponent(String(message || ""))}`;
}
async function copyTextRobust(text) {
  const value = String(text || ""); if (!value) return false;
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(value); return true; } } catch {}
  try { const ta=document.createElement("textarea"); ta.value=value; ta.setAttribute("readonly",""); ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0,value.length); const ok=document.execCommand("copy"); ta.remove(); return !!ok; } catch { return false; }
}
function compactPlateLineMessage({ orderId, plateType, plateNumber, customerName, phone }) {
  return `官網訂製 ${orderId}\n${plateType}｜${plateNumber}\n${customerName} ${phone}\n請協助確認付款。`;
}
let latestPlateFullMessage = "";
function showOrderSuccess(orderId, lineUrl, fullMessage, prefillMessage, duplicate = false) {
  const screen = $("#orderSuccessScreen");
  if (!screen) return;
  latestPlateFullMessage = String(fullMessage || prefillMessage || "");
  $("#orderSuccessTitle").textContent = duplicate ? "已沿用上一筆訂製需求" : "訂製需求已建立";
  $("#orderSuccessText").textContent = duplicate
    ? "短時間內相同資料不重複建單。點下方按鈕會開啟官方 LINE，並把完整訂單直接帶入輸入框。"
    : "資料已送進小宇微電車牌線上訂單。點下方按鈕會開啟官方 LINE，並把完整訂單直接帶入輸入框。";
  $("#orderSuccessId").textContent = orderId;
  const preview = $("#orderSuccessPreview");
  if (preview) preview.textContent = latestPlateFullMessage;
  $("#orderSuccessLine").href = linePrefilledMessageUrl(latestPlateFullMessage) || lineUrl || lineChatUrl();
  screen.classList.add("show");
  screen.setAttribute("aria-hidden", "false");
}
function newCaptcha() {
  const a = Math.floor(Math.random()*8)+2;
  const b = Math.floor(Math.random()*8)+2;
  captcha = a+b;
  $("#captchaQuestion").textContent = `人類驗證：${a} + ${b} = ?`;
  $("#captchaAnswer").value = "";
}

const price = Number(config.platePrice || 9500);
const deposit = Number(config.plateDeposit || 5500);
const balance = Number(config.plateBalance || 4000);
$("#priceText").textContent = money(price);
$("#depositText").textContent = money(deposit);
$("#balanceText").textContent = money(balance);

$("#plateNumber").addEventListener("input", () => {
  const value = $("#plateNumber").value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0,12);
  $("#plateNumber").value = value;
  $("#platePreview").textContent = value || "ABC-1234";
});

const PLATE_DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
function plateFingerprint({ plateType, plateNumber, phone, address }) {
  return [plateType, plateNumber, phone, address].map((value) => String(value || "").trim().toLowerCase()).join("|");
}
function recentPlateSubmission(fingerprint) {
  try {
    const item = JSON.parse(sessionStorage.getItem("YU_RECENT_PLATE_ORDER") || "null");
    if (!item || item.fingerprint !== fingerprint || !item.orderId || !item.message) return null;
    if (Date.now() - Number(item.time || 0) > PLATE_DUPLICATE_WINDOW_MS) return null;
    return item;
  } catch { return null; }
}
function rememberPlateSubmission(payload) {
  try { sessionStorage.setItem("YU_RECENT_PLATE_ORDER", JSON.stringify({ ...payload, time:Date.now() })); } catch {}
}

$("#plateForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if ($("#website").value) return;
  if (Number($("#captchaAnswer").value) !== captcha) { newCaptcha(); toast("驗證答案錯誤，請重新計算。"); return; }

  const customerName = $("#name").value.trim();
  const phone = cleanPhone($("#phone").value);
  const address = $("#address").value.trim();
  const plateNumber = $("#plateNumber").value.trim().toUpperCase();
  const plateType = $("#plateType").value;
  if (!customerName || phone.length < 9 || address.length < 3 || !plateNumber) { toast("請完整填寫訂製資料。"); return; }

  const fingerprint = plateFingerprint({ plateType, plateNumber, phone, address });
  const recent = recentPlateSubmission(fingerprint);
  if (recent) {
    const recentPrefill = recent.prefillMessage || recent.message;
    const recentLineUrl = lineChatUrl();
    toast(`已沿用訂製需求 ${recent.orderId}，避免重複建立。`);
    showOrderSuccess(recent.orderId, recentLineUrl, recent.message, recentPrefill, true);
    return;
  }

  const orderId = await makeId(fingerprint);
  const data = {
    orderNo:orderId, orderId, source:"official-store-plate", customerName, custName:customerName, phone, custPhone:phone, address, custAddress:address,
    model:"紀念展示車牌", itemName:`${plateType}｜${plateNumber}`, color:"依訂製樣式", vehicleVariant:plateType, battery:"不適用", price, totalAmount:money(price),
    cost:0, netProfit:price, deposit:0, balancePaid:0, licenseMode:"自行辦理", deliveryMode:"物流寄送", paymentMethod:"轉帳",
    paymentTerms:`訂金 ${money(deposit)}／尾款 ${money(balance)}（貨到付款）`, status:"待審核", reviewStatus:"pending", deliveredAt:"",
    notes:`訂製號碼：${plateNumber}。僅供紀念展示，不可上路使用。待後台接受確認。`, createdAt:serverTimestamp(), updatedAt:serverTimestamp(), timestamp:serverTimestamp(), createdBy:"public-store", updatedBy:"public-store"
  };

  const button = $("#submitBtn");
  button.disabled = true;
  button.textContent = "送出中…";
  try {
    await setDoc(doc(db, "onlineOrders", orderId), data);
    const message = `您好小宇，我要訂製紀念展示牌：\n訂單編號：${orderId}\n類型：${plateType}\n號碼：${plateNumber}\n姓名：${customerName}\n電話：${phone}\n收件資料：${address}\n付款方式：訂金 ${money(deposit)}／尾款 ${money(balance)}（貨到付款）\n請協助確認付款。`;
    const prefillMessage = compactPlateLineMessage({ orderId, plateType, plateNumber, customerName, phone });
    const targetLineUrl = lineChatUrl();
    try { await copyTextRobust(message); } catch {}
    rememberPlateSubmission({ fingerprint, orderId, message, prefillMessage });
    toast(`訂製需求 ${orderId} 已送出，等待店家確認。`);
    showOrderSuccess(orderId, targetLineUrl, message, prefillMessage);
    event.target.reset();
    $("#plateNumber").value = "ABC-1234";
    $("#platePreview").textContent = "ABC-1234";
    newCaptcha();
  } catch (error) {
    console.error(error);
    const code = String(error?.code || "");
    const duplicateBlocked = code.includes("permission-denied") || code.includes("already-exists");
    if (duplicateBlocked) {
      const message = `您好小宇，我要訂製紀念展示牌：\n訂單編號：${orderId}\n類型：${plateType}\n號碼：${plateNumber}\n姓名：${customerName}\n電話：${phone}\n收件資料：${address}\n付款方式：訂金 ${money(deposit)}／尾款 ${money(balance)}（貨到付款）\n請協助確認付款。`;
      const prefillMessage = compactPlateLineMessage({ orderId, plateType, plateNumber, customerName, phone });
      rememberPlateSubmission({ fingerprint, orderId, message, prefillMessage });
      toast("相同訂製需求今天已送出，系統已阻止重複建立。");
      showOrderSuccess(orderId, lineChatUrl(), message, prefillMessage, true);
    } else {
      toast("送出失敗，請直接聯絡官方 LINE。");
    }
  } finally {
    button.disabled = false;
    button.textContent = "送出訂製需求";
  }
});

const successLineButton = $("#orderSuccessLine");
if (successLineButton) {
  successLineButton.addEventListener("click", (event) => {
    event.preventDefault();
    if (!latestPlateFullMessage) return;
    const href = linePrefilledMessageUrl(latestPlateFullMessage);
    toast("正在開啟官方 LINE，完整訂單會自動帶入輸入框。確認內容後按送出即可。");
    window.location.href = href;
  });
}
const successCopyButton = $("#orderSuccessCopy");
if (successCopyButton) {
  successCopyButton.addEventListener("click", async () => {
    if (!latestPlateFullMessage) return;
    const copied = await copyTextRobust(latestPlateFullMessage);
    toast(copied ? "完整訂製內容已複製，回 LINE 長按貼上即可。" : "瀏覽器未允許複製，請長按上方內容複製。");
  });
}

newCaptcha();
