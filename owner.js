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
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import {
  deriveDrawResult,
  escapeHtml,
  makeDrawCode,
  makeSeed,
  normalizeCode,
  sha256Hex
} from "./draw-core.js";

const OWNER_EMAIL = "uu8832sr@gmail.com";
const firebaseConfig = window.LUCKY_GARAGE_FIREBASE_CONFIG || {};
const uiConfig = window.LUCKY_GARAGE_UI_CONFIG || {};
const $ = (selector) => document.querySelector(selector);

const configWarning = $("#configWarning");
const loginCard = $("#loginCard");
const loginBtn = $("#loginBtn");
const loginMessage = $("#loginMessage");
const deniedCard = $("#deniedCard");
const deniedEmail = $("#deniedEmail");
const switchAccountBtn = $("#switchAccountBtn");
const adminArea = $("#adminArea");
const adminEmail = $("#adminEmail");
const logoutBtn = $("#logoutBtn");
const campaignIdInput = $("#campaignId");
const campaignNameInput = $("#campaignName");
const codeCampaignIdInput = $("#codeCampaignId");
const createCampaignBtn = $("#createCampaignBtn");
const campaignMessage = $("#campaignMessage");
const prizePreview = $("#prizePreview");
const codePrefixInput = $("#codePrefix");
const codeCountInput = $("#codeCount");
const generateCodesBtn = $("#generateCodesBtn");
const codesMessage = $("#codesMessage");
const generatedCodes = $("#generatedCodes");
const copyCodesBtn = $("#copyCodesBtn");
const downloadCodesBtn = $("#downloadCodesBtn");
const refreshBtn = $("#refreshBtn");
const codeList = $("#codeList");
const saleForm = $("#saleForm");
const saleCustomerInput = $("#saleCustomer");
const saleDeliveryDateInput = $("#saleDeliveryDate");
const saleVehicleModelInput = $("#saleVehicleModel");
const saleVehicleVariantInput = $("#saleVehicleVariant");
const saleVehicleNoteInput = $("#saleVehicleNote");
const saleInsuranceHandlingInput = $("#saleInsuranceHandling");
const saleCostHintInput = $("#saleCostHint");
const salePriceInput = $("#salePrice");
const saleCostInput = $("#saleCost");
const saleProfitInput = $("#saleProfit");
const saveSaleBtn = $("#saveSaleBtn");
const cancelSaleEditBtn = $("#cancelSaleEditBtn");
const refreshSalesBtn = $("#refreshSalesBtn");
const saleMessage = $("#saleMessage");
const saleList = $("#saleList");
const saleCount = $("#saleCount");
const totalRevenue = $("#totalRevenue");
const totalCost = $("#totalCost");
const totalProfit = $("#totalProfit");
const toast = $("#toast");

let auth;
let db;
let currentUser = null;
let currentCodes = [];
let editingSaleId = null;
let clearingAnonymousUser = false;
const campaignCache = new Map();


const VEHICLE_COSTS = {
  "大偉士改裝版": [
    { label: "鉛酸版", cost: 29000 },
    { label: "鋰鐵30Ah", cost: 49000 }
  ],
  "小偉士": [
    { label: "鉛酸版", cost: 23000 },
    { label: "鋰鐵30Ah", cost: 38000 }
  ],
  "神盾": [
    { label: "鉛酸版", cost: 24000 },
    { label: "鋰鐵30Ah", cost: 40000 }
  ],
  "Z3": [
    { label: "普通版（鉛酸）", cost: 30000 },
    { label: "暗魂版（鉛酸）", cost: 32000 },
    { label: "普通版（鋰鐵30Ah）", cost: 49000 },
    { label: "暗魂版（鋰鐵30Ah）", cost: 51000 }
  ],
  "正9號": [
    { label: "鉛酸版", cost: 29000 },
    { label: "鋰鐵30Ah", cost: 49000 }
  ],
  "小可愛（拿鐵）": [
    { label: "鉛酸版（無鋰鐵版）", cost: 25000 }
  ],
  "QC": [
    { label: "鉛酸版", cost: 27000 },
    { label: "鋰鐵30Ah", cost: 47000 }
  ],
  "小酷龍": [
    { label: "鉛酸版（無鋰鐵版）", cost: 16000 }
  ],
  "微型三輪": [
    { label: "鉛酸版（無鋰鐵版）", cost: 28000 }
  ],
  "Dio": [
    { label: "鉛酸版", cost: 25000 },
    { label: "鋰鐵30Ah", cost: 40000 }
  ],
  "其他車款": [
    { label: "自訂成本", cost: 0 }
  ]
};

function hasRealFirebaseConfig(config) {
  return Boolean(
    config.apiKey &&
    config.projectId &&
    config.appId &&
    !Object.values(config).some((value) => String(value).includes("YOUR_"))
  );
}

function cleanCampaignId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isGoogleOwner(user) {
  if (!user || user.isAnonymous) return false;
  const usesGoogle = Array.isArray(user.providerData)
    && user.providerData.some((provider) => provider?.providerId === "google.com");
  return usesGoogle
    && user.emailVerified === true
    && normalizeEmail(user.email) === OWNER_EMAIL;
}

function setMessage(element, message, success = false) {
  element.textContent = message;
  element.classList.toggle("success", success);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function setButtonBusy(button, busy, busyText, normalText) {
  button.disabled = busy;
  button.textContent = busy ? busyText : normalText;
}

function showLoggedOut(message = "") {
  currentUser = null;
  loginCard.classList.remove("hidden");
  deniedCard.classList.add("hidden");
  adminArea.classList.add("hidden");
  setMessage(loginMessage, message, false);
}

function showDenied(user) {
  currentUser = user;
  deniedEmail.textContent = user?.email || "匿名帳號";
  loginCard.classList.add("hidden");
  deniedCard.classList.remove("hidden");
  adminArea.classList.add("hidden");
}

async function showAdmin(user) {
  currentUser = user;
  adminEmail.textContent = user.email;
  loginCard.classList.add("hidden");
  deniedCard.classList.add("hidden");
  adminArea.classList.remove("hidden");
  await Promise.all([refreshCodes(), refreshSales()]);
}


function formatMoney(value) {
  const amount = Number(value || 0);
  return `NT$${new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 }).format(amount)}`;
}

function readAmount(input) {
  const amount = Number(input.value || 0);
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

function renderVehicleModelOptions() {
  const options = Object.keys(VEHICLE_COSTS)
    .map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`)
    .join("");
  saleVehicleModelInput.innerHTML = `<option value="">請選擇車款</option>${options}`;
}

function getSelectedVehicleOption() {
  const model = saleVehicleModelInput.value;
  const variant = saleVehicleVariantInput.value;
  return (VEHICLE_COSTS[model] || []).find((item) => item.label === variant) || null;
}

function updateVehicleVariants(selectedVariant = "", keepCurrentCost = false) {
  const model = saleVehicleModelInput.value;
  const variants = VEHICLE_COSTS[model] || [];

  if (variants.length === 0) {
    saleVehicleVariantInput.innerHTML = '<option value="">請先選擇車款</option>';
    saleVehicleVariantInput.disabled = true;
    saleCostHintInput.value = "請先選擇車款與版本";
    if (!keepCurrentCost) saleCostInput.value = "";
    updateSaleProfitPreview();
    return;
  }

  saleVehicleVariantInput.disabled = false;
  saleVehicleVariantInput.innerHTML = variants
    .map((item) => `<option value="${escapeHtml(item.label)}">${escapeHtml(item.label)}｜${escapeHtml(formatMoney(item.cost))}</option>`)
    .join("");

  if (selectedVariant && variants.some((item) => item.label === selectedVariant)) {
    saleVehicleVariantInput.value = selectedVariant;
  }

  applySelectedVehicleCost(keepCurrentCost);
}

function applySelectedVehicleCost(keepCurrentCost = false) {
  const option = getSelectedVehicleOption();
  if (!option) {
    saleCostHintInput.value = "請先選擇車款與版本";
    if (!keepCurrentCost) saleCostInput.value = "";
    updateSaleProfitPreview();
    return;
  }

  saleCostHintInput.value = `${saleVehicleModelInput.value}｜${option.label}｜成本 ${formatMoney(option.cost)}`;
  if (!keepCurrentCost) saleCostInput.value = String(option.cost);
  updateSaleProfitPreview();
}

function updateSaleProfitPreview() {
  const profit = readAmount(salePriceInput) - readAmount(saleCostInput);
  saleProfitInput.value = formatMoney(profit);
  saleProfitInput.style.color = profit < 0 ? "#ff7373" : "#ffd34d";
}

function resetSaleForm() {
  editingSaleId = null;
  saleForm.reset();
  saleVehicleModelInput.value = "";
  updateVehicleVariants();
  saleInsuranceHandlingInput.value = "代辦";
  saleProfitInput.value = "NT$0";
  saleProfitInput.style.color = "#ffd34d";
  saveSaleBtn.textContent = "新增成交紀錄";
  cancelSaleEditBtn.classList.add("hidden");
  setMessage(saleMessage, "");
}

function formatSaleDate(timestamp) {
  try {
    const date = timestamp?.toDate ? timestamp.toDate() : null;
    if (!date) return "時間讀取中";
    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  } catch {
    return "—";
  }
}

function formatDeliveryDate(value) {
  if (!value) return "尚未交車";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}/${match[2]}/${match[3]}` : String(value);
}

function buildVehicleDisplay(model, variant, note) {
  const main = [model, variant].filter(Boolean).join("｜");
  return note ? `${main}｜${note}` : main;
}

saleVehicleModelInput.addEventListener("change", () => updateVehicleVariants());
saleVehicleVariantInput.addEventListener("change", () => applySelectedVehicleCost());
salePriceInput.addEventListener("input", updateSaleProfitPreview);
saleCostInput.addEventListener("input", updateSaleProfitPreview);
cancelSaleEditBtn.addEventListener("click", resetSaleForm);
refreshSalesBtn.addEventListener("click", refreshSales);

saleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser || !isGoogleOwner(currentUser)) return;

  const customer = saleCustomerInput.value.trim();
  const deliveryDate = saleDeliveryDateInput.value;
  const vehicleModel = saleVehicleModelInput.value;
  const vehicleVariant = saleVehicleVariantInput.value;
  const vehicleNote = saleVehicleNoteInput.value.trim();
  const insuranceHandling = saleInsuranceHandlingInput.value;
  const vehicle = buildVehicleDisplay(vehicleModel, vehicleVariant, vehicleNote);
  const salePrice = readAmount(salePriceInput);
  const cost = readAmount(saleCostInput);
  const netProfit = salePrice - cost;
  const wasEditing = Boolean(editingSaleId);
  const normalButtonText = wasEditing ? "儲存修改" : "新增成交紀錄";

  if (!customer) {
    setMessage(saleMessage, "請輸入客戶姓名或備註。", false);
    saleCustomerInput.focus();
    return;
  }
  if (!vehicleModel || !vehicleVariant) {
    setMessage(saleMessage, "請選擇車款與版本。", false);
    saleVehicleModelInput.focus();
    return;
  }
  if (!["代辦", "自行辦理"].includes(insuranceHandling)) {
    setMessage(saleMessage, "請選擇領牌強制險辦理方式。", false);
    saleInsuranceHandlingInput.focus();
    return;
  }
  if (salePrice <= 0) {
    setMessage(saleMessage, "成交價必須大於 0。", false);
    salePriceInput.focus();
    return;
  }
  if (cost < 0) {
    setMessage(saleMessage, "成本不可小於 0。", false);
    saleCostInput.focus();
    return;
  }

  setButtonBusy(saveSaleBtn, true, "儲存中…", normalButtonText);
  setMessage(saleMessage, "正在儲存成交資料…", true);

  try {
    const payload = {
      customer,
      deliveryDate,
      vehicle,
      vehicleModel,
      vehicleVariant,
      vehicleNote,
      insuranceHandling,
      salePrice,
      cost,
      netProfit,
      updatedAt: serverTimestamp()
    };

    if (editingSaleId) {
      await updateDoc(doc(db, "sales", editingSaleId), payload);
      showToast("成交紀錄已更新");
    } else {
      await addDoc(collection(db, "sales"), {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid
      });
      showToast("成交紀錄已新增");
    }

    resetSaleForm();
    await refreshSales();
  } catch (error) {
    console.error(error);
    setMessage(saleMessage, error?.message || "儲存失敗，請檢查 Firestore 規則。", false);
  } finally {
    setButtonBusy(saveSaleBtn, false, "儲存中…", wasEditing ? "儲存修改" : "新增成交紀錄");
  }
});

async function refreshSales() {
  if (!currentUser || !isGoogleOwner(currentUser)) return;
  saleList.innerHTML = '<p class="empty">讀取中…</p>';

  try {
    const snapshot = await getDocs(
      query(collection(db, "sales"), orderBy("createdAt", "desc"))
    );

    const rows = snapshot.docs.map((documentSnapshot) => ({
      id: documentSnapshot.id,
      ...documentSnapshot.data()
    }));

    const revenueSum = rows.reduce((sum, row) => sum + Number(row.salePrice || 0), 0);
    const costSum = rows.reduce((sum, row) => sum + Number(row.cost || 0), 0);
    const profitSum = revenueSum - costSum;

    saleCount.textContent = String(rows.length);
    totalRevenue.textContent = formatMoney(revenueSum);
    totalCost.textContent = formatMoney(costSum);
    totalProfit.textContent = formatMoney(profitSum);
    totalProfit.style.color = profitSum < 0 ? "#ff7373" : "#ffd34d";

    if (rows.length === 0) {
      saleList.innerHTML = '<p class="empty">尚無成交紀錄。</p>';
      return;
    }

    saleList.innerHTML = rows.map((row) => {
      const profit = Number(row.salePrice || 0) - Number(row.cost || 0);
      const vehicleText = row.vehicle || buildVehicleDisplay(row.vehicleModel, row.vehicleVariant, row.vehicleNote);
      const insuranceText = row.insuranceHandling || "未設定";
      return `
        <div class="sale-row">
          <div class="sale-main">
            <strong>${escapeHtml(row.customer || "未填客戶")}${vehicleText ? `｜${escapeHtml(vehicleText)}` : ""}</strong>
            <small>實際交車日：${escapeHtml(formatDeliveryDate(row.deliveryDate))}｜領牌強制險：${escapeHtml(insuranceText)}</small>
            ${!row.deliveryDate && !row.insuranceHandling ? `<small>舊紀錄建檔時間：${escapeHtml(formatSaleDate(row.createdAt))}</small>` : ""}
          </div>
          <div class="sale-money">
            <span>成交價</span>
            <strong>${escapeHtml(formatMoney(row.salePrice))}</strong>
          </div>
          <div class="sale-money">
            <span>成本</span>
            <strong>${escapeHtml(formatMoney(row.cost))}</strong>
          </div>
          <div class="sale-money profit ${profit < 0 ? "negative" : ""}">
            <span>淨利</span>
            <strong>${escapeHtml(formatMoney(profit))}</strong>
          </div>
          <div class="sale-actions">
            <button class="secondary compact edit-sale-btn" type="button" data-id="${row.id}">修改</button>
            <button class="secondary compact danger delete-sale-btn" type="button" data-id="${row.id}">刪除</button>
          </div>
        </div>
      `;
    }).join("");

    const rowMap = new Map(rows.map((row) => [row.id, row]));

    saleList.querySelectorAll(".edit-sale-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const row = rowMap.get(button.dataset.id);
        if (!row) return;
        editingSaleId = row.id;
        saleCustomerInput.value = row.customer || "";
        saleDeliveryDateInput.value = row.deliveryDate || "";

        const knownModel = row.vehicleModel && VEHICLE_COSTS[row.vehicleModel];
        saleVehicleModelInput.value = knownModel ? row.vehicleModel : "其他車款";
        updateVehicleVariants(knownModel ? (row.vehicleVariant || "") : "自訂成本", true);
        saleVehicleNoteInput.value = row.vehicleNote || (!knownModel ? (row.vehicle || "") : "");
        saleInsuranceHandlingInput.value = row.insuranceHandling === "自行辦理" ? "自行辦理" : "代辦";
        salePriceInput.value = Number(row.salePrice || 0);
        saleCostInput.value = Number(row.cost || 0);
        applySelectedVehicleCost(true);
        updateSaleProfitPreview();
        saveSaleBtn.textContent = "儲存修改";
        cancelSaleEditBtn.classList.remove("hidden");
        saleForm.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });

    saleList.querySelectorAll(".delete-sale-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!window.confirm("確定要刪除這筆成交紀錄嗎？")) return;
        button.disabled = true;
        try {
          await deleteDoc(doc(db, "sales", button.dataset.id));
          if (editingSaleId === button.dataset.id) resetSaleForm();
          showToast("成交紀錄已刪除");
          await refreshSales();
        } catch (error) {
          console.error(error);
          showToast("刪除失敗");
          button.disabled = false;
        }
      });
    });
  } catch (error) {
    console.error(error);
    saleList.innerHTML = `<p class="empty">讀取失敗：${escapeHtml(error?.message || "請檢查規則")}</p>`;
  }
}

function renderPrizePreview() {
  const prizes = uiConfig.defaultPrizes || [];
  const total = prizes.reduce((sum, prize) => sum + Number(prize.weight || 0), 0);
  prizePreview.innerHTML = prizes.map((prize) => {
    const percent = total > 0
      ? ((Number(prize.weight || 0) / total) * 100).toFixed(1).replace(".0", "")
      : "0";
    return `<div class="prize-item"><strong>${escapeHtml(prize.icon || "🎁")} ${escapeHtml(prize.title)}</strong><span>機率 ${percent}%</span></div>`;
  }).join("");
}

async function beginGoogleLogin() {
  setMessage(loginMessage, "正在開啟 Google 登入…", true);
  loginBtn.disabled = true;

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
    setMessage(loginMessage, error?.message || "登入失敗，請使用 Safari 或 Chrome。", false);
  } finally {
    loginBtn.disabled = false;
  }
}

loginBtn.addEventListener("click", beginGoogleLogin);
switchAccountBtn.addEventListener("click", beginGoogleLogin);
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  showLoggedOut("已登出。");
});

createCampaignBtn.addEventListener("click", async () => {
  const campaignId = cleanCampaignId(campaignIdInput.value);
  const name = campaignNameInput.value.trim();
  const prizes = uiConfig.defaultPrizes || [];

  if (!campaignId || !name || prizes.length === 0) {
    setMessage(campaignMessage, "請確認活動 ID、名稱與獎項設定。");
    return;
  }

  setButtonBusy(createCampaignBtn, true, "建立中…", "建立活動");
  setMessage(campaignMessage, "正在寫入 Firebase…", true);

  try {
    await setDoc(doc(db, "campaigns", campaignId), {
      name,
      active: true,
      algorithm: "sha256-v1",
      seed: makeSeed(),
      prizes,
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    });
    campaignCache.delete(campaignId);
    codeCampaignIdInput.value = campaignId;
    setMessage(campaignMessage, `活動 ${campaignId} 已建立，獎項與機率已固定。`, true);
  } catch (error) {
    console.error(error);
    const denied = String(error?.code || "").includes("permission-denied");
    setMessage(
      campaignMessage,
      denied
        ? "建立失敗：請確認 Firestore 規則已換成 email-owner-final 版本，或活動 ID 已存在。"
        : (error?.message || "建立失敗。")
    );
  } finally {
    setButtonBusy(createCampaignBtn, false, "建立中…", "建立活動");
  }
});

async function loadCampaign(campaignId) {
  if (campaignCache.has(campaignId)) return campaignCache.get(campaignId);
  const snapshot = await getDoc(doc(db, "campaigns", campaignId));
  if (!snapshot.exists()) throw new Error("找不到活動 ID，請先建立活動。");
  const data = { id: snapshot.id, ...snapshot.data() };
  campaignCache.set(campaignId, data);
  return data;
}

generateCodesBtn.addEventListener("click", async () => {
  const campaignId = cleanCampaignId(codeCampaignIdInput.value);
  const prefix = normalizeCode(codePrefixInput.value).slice(0, 6) || "YU";
  const count = Math.max(1, Math.min(300, Number(codeCountInput.value) || 1));

  setButtonBusy(generateCodesBtn, true, "寫入中…", "產生並寫入 Firebase");
  setMessage(codesMessage, "正在建立一次性代碼…", true);

  try {
    await loadCampaign(campaignId);
    const codes = new Set();
    while (codes.size < count) codes.add(makeDrawCode(prefix, 8));

    const records = await Promise.all(
      [...codes].map(async (code) => ({ code, hash: await sha256Hex(code) }))
    );
    const batch = writeBatch(db);

    for (const record of records) {
      batch.set(doc(db, "drawCodes", record.hash), {
        code: record.code,
        campaignId,
        active: true,
        used: false,
        usedBy: null,
        usedAt: null,
        selectedGarage: null,
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid
      });
    }

    await batch.commit();
    currentCodes = records.map((record) => record.code);
    generatedCodes.value = currentCodes.join("\n");
    setMessage(codesMessage, `已建立 ${currentCodes.length} 組全網一次性抽獎碼。`, true);
    await refreshCodes();
  } catch (error) {
    console.error(error);
    const denied = String(error?.code || "").includes("permission-denied");
    setMessage(
      codesMessage,
      denied
        ? "寫入失敗：請確認管理員 Google 帳號及 Firestore 規則。"
        : (error?.message || "產生失敗。")
    );
  } finally {
    setButtonBusy(generateCodesBtn, false, "寫入中…", "產生並寫入 Firebase");
  }
});

copyCodesBtn.addEventListener("click", async () => {
  if (!generatedCodes.value.trim()) return;
  try {
    await navigator.clipboard.writeText(generatedCodes.value);
    showToast("抽獎碼已複製");
  } catch {
    showToast("請長按文字手動複製");
  }
});

downloadCodesBtn.addEventListener("click", () => {
  if (!currentCodes.length) return;
  const csv = "抽獎碼\n" + currentCodes.map((code) => `"${code}"`).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `lucky-garage-codes-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
});

refreshBtn.addEventListener("click", refreshCodes);

async function refreshCodes() {
  if (!currentUser || !isGoogleOwner(currentUser)) return;
  codeList.innerHTML = '<p class="empty">讀取中…</p>';

  try {
    const snapshot = await getDocs(
      query(collection(db, "drawCodes"), orderBy("createdAt", "desc"), limit(50))
    );

    if (snapshot.empty) {
      codeList.innerHTML = '<p class="empty">尚無抽獎碼。</p>';
      return;
    }

    const rows = await Promise.all(snapshot.docs.map(async (documentSnapshot) => {
      const status = documentSnapshot.data();
      let resultText = "尚未抽獎";

      if (status.used && status.usedAt) {
        try {
          const campaign = await loadCampaign(status.campaignId);
          const result = await deriveDrawResult(campaign, status);
          resultText = `${result.prize.title}｜${result.serial}`;
        } catch {
          resultText = "結果計算失敗";
        }
      }

      return { hash: documentSnapshot.id, status, resultText };
    }));

    codeList.innerHTML = rows.map(({ hash, status, resultText }) => `
      <div class="code-row">
        <code>${escapeHtml(status.code)}</code>
        <span class="badge ${status.used ? "used" : "ready"}">${status.used ? "已使用" : (status.active ? "可使用" : "已停用")}</span>
        <small class="result">${escapeHtml(resultText)}</small>
        ${!status.used ? `<button class="disable-btn" data-hash="${hash}" data-active="${status.active}">${status.active ? "停用" : "啟用"}</button>` : ""}
      </div>
    `).join("");

    codeList.querySelectorAll(".disable-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await updateDoc(doc(db, "drawCodes", button.dataset.hash), {
            active: button.dataset.active !== "true"
          });
          await refreshCodes();
        } catch (error) {
          console.error(error);
          showToast("更新失敗");
          button.disabled = false;
        }
      });
    });
  } catch (error) {
    console.error(error);
    codeList.innerHTML = `<p class="empty">讀取失敗：${escapeHtml(error?.message || "請檢查規則")}</p>`;
  }
}

function start() {
  renderPrizePreview();
  renderVehicleModelOptions();
  resetSaleForm();

  if (!hasRealFirebaseConfig(firebaseConfig)) {
    configWarning.classList.remove("hidden");
    loginCard.classList.add("hidden");
    return;
  }

  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showLoggedOut();
      return;
    }

    if (user.isAnonymous) {
      if (clearingAnonymousUser) return;
      clearingAnonymousUser = true;
      try {
        await signOut(auth);
      } finally {
        clearingAnonymousUser = false;
      }
      return;
    }

    if (!isGoogleOwner(user)) {
      showDenied(user);
      return;
    }

    await showAdmin(user);
  });
}

start();
