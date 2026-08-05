import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { doc, getDoc, getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = window.LUCKY_GARAGE_FIREBASE_CONFIG || {};
const uiConfig = window.LUCKY_GARAGE_UI_CONFIG || {};
const $ = (selector) => document.querySelector(selector);
const input = $("#warrantyId");
const queryBtn = $("#queryBtn");
const queryMessage = $("#queryMessage");
const resultCard = $("#resultCard");
const notFoundCard = $("#notFoundCard");
let db;

function hasConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}
function cleanId(value) {
  return String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
}
function displayDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-TW").format(date);
}
function isExpired(dateValue) {
  if (!dateValue) return false;
  const end = new Date(`${dateValue}T23:59:59`);
  return Date.now() > end.getTime();
}
async function queryWarranty() {
  const id = cleanId(input.value);
  resultCard.classList.add("hidden");
  notFoundCard.classList.add("hidden");
  if (!id) {
    queryMessage.textContent = "請輸入保固卡編號。";
    return;
  }
  queryBtn.disabled = true;
  queryMessage.textContent = "查詢中…";
  try {
    const snapshot = await getDoc(doc(db, "warranties", id));
    if (!snapshot.exists() || snapshot.data().published !== true) {
      notFoundCard.classList.remove("hidden");
      queryMessage.textContent = "";
      return;
    }
    const data = snapshot.data();
    const expired = isExpired(data.vehicleWarrantyEnd);
    $("#statusBadge").textContent = expired ? "整車保固已到期" : "保固中";
    $("#statusBadge").classList.toggle("expired", expired);
    $("#resultId").textContent = id;
    $("#vehicleName").textContent = data.model || "—";
    $("#vehicleColor").textContent = data.color || "—";
    $("#ownerName").textContent = data.customerDisplayName || "—";
    $("#chassisMasked").textContent = data.chassisMasked || "未登錄";
    $("#batteryType").textContent = data.battery || "—";
    $("#deliveryDate").textContent = displayDate(data.deliveryDate);
    $("#vehicleWarrantyEnd").textContent = displayDate(data.vehicleWarrantyEnd);
    $("#batteryWarrantyEnd").textContent = displayDate(data.batteryWarrantyEnd);
    $("#termsText").textContent = data.terms || "保固依小宇微電交車時提供之條款辦理；人為損壞、泡水、事故及自行改裝不在保固範圍內。";
    resultCard.classList.remove("hidden");
    queryMessage.textContent = "查詢成功。";
  } catch (error) {
    console.error(error);
    notFoundCard.classList.remove("hidden");
    queryMessage.textContent = "目前無法讀取資料，請稍後再試。";
  } finally {
    queryBtn.disabled = false;
  }
}

queryBtn.addEventListener("click", queryWarranty);
input.addEventListener("keydown", (event) => { if (event.key === "Enter") queryWarranty(); });

if (!hasConfig()) {
  queryMessage.textContent = "網站尚未完成 Firebase 設定。";
  queryBtn.disabled = true;
} else {
  db = getFirestore(initializeApp(firebaseConfig));
  const urlId = cleanId(new URLSearchParams(location.search).get("id"));
  if (urlId) {
    input.value = urlId;
    queryWarranty();
  }
}
$("#lineLink").href = uiConfig.lineUrl || "https://line.me/R/ti/p/@762eqvlg";
$("#lineLink").textContent = `聯絡官方 LINE：${uiConfig.lineId || "@762eqvlg"}`;
