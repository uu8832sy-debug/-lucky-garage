import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import {
  deriveDrawResult,
  escapeHtml,
  normalizeCode,
  sha256Hex
} from "./draw-core.js";

const firebaseConfig = window.LUCKY_GARAGE_FIREBASE_CONFIG || {};
const uiConfig = window.LUCKY_GARAGE_UI_CONFIG || {};
const $ = (selector) => document.querySelector(selector);

const setupView = $("#setupView");
const entryView = $("#entryView");
const garageView = $("#garageView");
const resultView = $("#resultView");
const codeForm = $("#codeForm");
const codeInput = $("#drawCode");
const verifyBtn = $("#verifyBtn");
const codeMessage = $("#codeMessage");
const garageGrid = $("#garageGrid");
const prizeTitle = $("#prizeTitle");
const prizeDescription = $("#prizeDescription");
const resultCode = $("#resultCode");
const resultGarage = $("#resultGarage");
const resultSerial = $("#resultSerial");
const resultTime = $("#resultTime");
const copyResultBtn = $("#copyResultBtn");
const oddsList = $("#oddsList");
const oddsPlaceholder = $("#oddsPlaceholder");
const lineLink = $("#lineLink");
const toast = $("#toast");

let auth;
let db;
let activeCode = "";
let activeHash = "";
let activeStatus = null;
let activeCampaign = null;
let currentUser = null;
let drawInProgress = false;
let latestResult = null;

function hasRealFirebaseConfig(config) {
  return Boolean(
    config.apiKey &&
    config.projectId &&
    config.appId &&
    !Object.values(config).some((value) => String(value).includes("YOUR_"))
  );
}

function showSetupError(message = "尚未連接 Firebase。") {
  setupView.classList.remove("hidden");
  setupView.querySelector("p").textContent = message;
  entryView.classList.add("hidden");
}

function setCodeMessage(message, success = false) {
  codeMessage.textContent = message;
  codeMessage.classList.toggle("success", success);
}

function setBusy(isBusy, label = "驗證資格") {
  verifyBtn.disabled = isBusy;
  codeInput.disabled = isBusy;
  verifyBtn.textContent = isBusy ? "連線中…" : label;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1900);
}

function renderGarages() {
  garageGrid.innerHTML = "";
  for (let number = 1; number <= 9; number += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "garage-door";
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-label", `開啟第 ${number} 號車庫`);
    button.dataset.garage = String(number);
    button.innerHTML = `
      <div class="garage-inside"><span>🛵</span></div>
      <div class="door-face">
        <span class="door-number">${number}</span>
        <span class="door-handle"></span>
      </div>
    `;
    button.addEventListener("click", () => claimCodeAndDraw(button, number));
    garageGrid.appendChild(button);
  }
}

function renderOdds(campaign) {
  if (!campaign?.prizes?.length) return;
  const total = campaign.prizes.reduce((sum, prize) => sum + Number(prize.weight || 0), 0);
  oddsPlaceholder.classList.add("hidden");
  oddsList.innerHTML = campaign.prizes
    .map((prize) => {
      const percent = ((Number(prize.weight || 0) / total) * 100).toFixed(1).replace(".0", "");
      return `<li>${escapeHtml(prize.title)}：${percent}%</li>`;
    })
    .join("");
}

async function ensureAnonymousUser() {
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

async function loadCampaign(campaignId) {
  const snapshot = await getDoc(doc(db, "campaigns", campaignId));
  if (!snapshot.exists()) throw new Error("找不到活動設定，請聯絡小宇。");
  const campaign = { id: snapshot.id, ...snapshot.data() };
  if (campaign.active === false) throw new Error("本活動目前已結束。");
  return campaign;
}

async function showExistingResult(status) {
  const campaign = activeCampaign || await loadCampaign(status.campaignId);
  renderOdds(campaign);
  const derived = await deriveDrawResult(campaign, status);
  latestResult = {
    code: status.code,
    garage: status.selectedGarage,
    prize: derived.prize,
    serial: derived.serial,
    formattedTime: derived.formattedTime,
    proofHash: derived.proofHash
  };
  showResult(latestResult);
}

codeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = normalizeCode(codeInput.value);

  if (!code) {
    setCodeMessage("請輸入抽獎碼。");
    codeInput.focus();
    return;
  }

  setBusy(true);
  setCodeMessage("正在向 Firebase 驗證抽獎資格…", true);

  try {
    currentUser = await ensureAnonymousUser();
    const codeHash = await sha256Hex(code);
    const statusSnapshot = await getDoc(doc(db, "drawCodes", codeHash));

    if (!statusSnapshot.exists()) {
      throw new Error("找不到這組抽獎碼，請確認後再試一次。");
    }

    const status = statusSnapshot.data();
    if (status.code !== code) throw new Error("抽獎碼驗證失敗。");
    if (status.active !== true) throw new Error("這組抽獎碼目前無法使用。");

    activeCode = code;
    activeHash = codeHash;
    activeStatus = status;
    activeCampaign = await loadCampaign(status.campaignId);
    renderOdds(activeCampaign);

    if (status.used === true) {
      if (status.usedBy === currentUser.uid) {
        setCodeMessage("這組抽獎碼已抽過，正在顯示原本結果。", true);
        await showExistingResult(status);
        return;
      }
      throw new Error("這組抽獎碼已經使用過了。");
    }

    setCodeMessage("驗證成功！請挑一座車庫。", true);
    window.setTimeout(() => {
      entryView.classList.add("hidden");
      garageView.classList.remove("hidden");
      garageView.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 320);
  } catch (error) {
    console.error(error);
    const denied = error?.code === "permission-denied" || error?.code === "firestore/permission-denied";
    setCodeMessage(denied ? "這組抽獎碼已使用、無效，或 Firebase 權限尚未設定完成。" : (error.message || "驗證失敗，請稍後再試。"));
  } finally {
    setBusy(false);
  }
});

async function claimCodeAndDraw(selectedDoor, garageNumber) {
  if (drawInProgress || !activeCode || !activeHash || !currentUser) return;
  drawInProgress = true;

  const doors = [...garageGrid.querySelectorAll(".garage-door")];
  doors.forEach((door) => {
    door.disabled = true;
    if (door !== selectedDoor) door.classList.add("dimmed");
  });
  selectedDoor.classList.add("opening");
  if (navigator.vibrate) navigator.vibrate([35, 30, 60]);

  try {
    const statusRef = doc(db, "drawCodes", activeHash);
    await updateDoc(statusRef, {
      used: true,
      usedBy: currentUser.uid,
      usedAt: serverTimestamp(),
      selectedGarage: garageNumber
    });

    const statusSnapshot = await getDoc(statusRef);
    const completedStatus = statusSnapshot.data();
    activeStatus = completedStatus;

    const derived = await deriveDrawResult(activeCampaign, completedStatus);
    latestResult = {
      code: activeCode,
      garage: garageNumber,
      prize: derived.prize,
      serial: derived.serial,
      formattedTime: derived.formattedTime,
      proofHash: derived.proofHash
    };

    window.setTimeout(() => showResult(latestResult), 1200);
  } catch (error) {
    console.error(error);
    selectedDoor.classList.remove("opening");
    doors.forEach((door) => {
      door.disabled = false;
      door.classList.remove("dimmed");
    });
    drawInProgress = false;

    try {
      const retrySnapshot = await getDoc(doc(db, "drawCodes", activeHash));
      if (retrySnapshot.exists() && retrySnapshot.data().usedBy === currentUser.uid) {
        await showExistingResult(retrySnapshot.data());
        return;
      }
    } catch {
      // 權限拒絕時直接顯示統一訊息。
    }

    setCodeMessage("抽獎碼可能已被使用，請回到上一頁重新確認或聯絡小宇。");
    garageView.classList.add("hidden");
    entryView.classList.remove("hidden");
    entryView.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function showResult(result) {
  prizeTitle.textContent = result.prize.title;
  prizeDescription.textContent = result.prize.description;
  resultCode.textContent = result.code;
  resultGarage.textContent = `第 ${result.garage} 號`;
  resultSerial.textContent = result.serial;
  resultTime.textContent = result.formattedTime;

  entryView.classList.add("hidden");
  garageView.classList.add("hidden");
  resultView.classList.remove("hidden");
  resultView.scrollIntoView({ behavior: "smooth", block: "start" });
  if (navigator.vibrate) navigator.vibrate([70, 45, 120]);
}

copyResultBtn.addEventListener("click", async () => {
  if (!latestResult) return;
  const text = [
    `${uiConfig.brandName || "小宇微電"}｜${uiConfig.campaignName || "幸運車庫"}`,
    `抽獎結果：${latestResult.prize.title}`,
    `抽獎碼：${latestResult.code}`,
    `車庫號碼：第 ${latestResult.garage} 號`,
    `兌換序號：${latestResult.serial}`,
    `Firebase 時間：${latestResult.formattedTime}`,
    `驗證雜湊：${latestResult.proofHash.slice(0, 16).toUpperCase()}`,
    `官方 LINE：${uiConfig.lineId || "@762eqvlg"}`
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    showToast("兌換資訊已複製");
  } catch {
    showToast("請直接截圖保存結果");
  }
});

codeInput.addEventListener("input", () => {
  codeInput.value = normalizeCode(codeInput.value);
  setCodeMessage("");
});

async function start() {
  renderGarages();
  lineLink.href = uiConfig.lineUrl || lineLink.href;
  lineLink.textContent = `開啟官方 LINE：${uiConfig.lineId || "@762eqvlg"}`;
  verifyBtn.disabled = true;

  if (!hasRealFirebaseConfig(firebaseConfig)) {
    showSetupError("請先在 firebase-config.js 貼上 Firebase Web 設定。");
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    await setPersistence(auth, browserLocalPersistence);
    currentUser = await ensureAnonymousUser();
    verifyBtn.disabled = false;
  } catch (error) {
    console.error(error);
    showSetupError(`Firebase 連線失敗：${error.message || "請檢查設定。"}`);
  }
}

start();
