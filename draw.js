import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  collection,
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
} from "../draw-core.js";

const firebaseConfig = window.LUCKY_GARAGE_FIREBASE_CONFIG || {};
const uiConfig = window.LUCKY_GARAGE_UI_CONFIG || {};
const $ = (selector) => document.querySelector(selector);

const configWarning = $("#configWarning");
const loginCard = $("#loginCard");
const loginBtn = $("#loginBtn");
const loginMessage = $("#loginMessage");
const bootstrapCard = $("#bootstrapCard");
const adminPath = $("#adminPath");
const copyUidBtn = $("#copyUidBtn");
const recheckBtn = $("#recheckBtn");
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
const toast = $("#toast");

let auth;
let db;
let currentUser = null;
let currentCodes = [];
const campaignCache = new Map();
const OWNER_UIDS = new Set([
  "rN911472GUXjc1IYToSPhgf6zbs2",
  "iRdFBpDpXcNklIQ2tzP8kP1lDu42",
  "azMaRtblP0VevIvEQQDG6OZj5wh1"
]);

function hasRealFirebaseConfig(config) {
  return Boolean(config.apiKey && config.projectId && config.appId && !Object.values(config).some((value) => String(value).includes("YOUR_")));
}

function cleanCampaignId(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
}

function setMessage(element, message, success = false) {
  element.textContent = message;
  element.classList.toggle("success", success);
}

function friendlyAuthError(error) {
  const code = String(error?.code || "");
  if (code.includes("unauthorized-domain")) {
    const host = window.location.hostname || "目前網站網域";
    return `目前網域 ${host} 尚未加入 Firebase 授權網域。請到 Firebase Authentication → 設定 → 授權網域，新增 ${host}。`;
  }
  if (code.includes("popup-closed-by-user")) return "Google 登入視窗已關閉，請重新點一次登入。";
  if (code.includes("network-request-failed")) return "網路連線失敗，請確認網路後再試。";
  return error?.message || "登入失敗，請改用 Safari 或 Chrome。";
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

function renderPrizePreview() {
  const prizes = uiConfig.defaultPrizes || [];
  const total = prizes.reduce((sum, prize) => sum + Number(prize.weight || 0), 0);
  prizePreview.innerHTML = prizes.map((prize) => {
    const percent = ((Number(prize.weight || 0) / total) * 100).toFixed(1).replace(".0", "");
    return `<div class="prize-item"><strong>${escapeHtml(prize.icon || "🎁")} ${escapeHtml(prize.title)}</strong><span>機率 ${percent}%</span></div>`;
  }).join("");
}

const OFFICIAL_ODDS = Object.freeze({
  "discount-500": 80,
  "discount-1000": 16,
  "discount-2000": 3,
  "discount-3000": 1
});

function getOfficialPrizes() {
  const prizes = Array.isArray(uiConfig.defaultPrizes) ? uiConfig.defaultPrizes : [];
  const valid = prizes.length === 4 && prizes.every((prize) => (
    OFFICIAL_ODDS[String(prize?.id || "")] === Number(prize?.weight)
  ));
  const total = prizes.reduce((sum, prize) => sum + Number(prize?.weight || 0), 0);
  if (!valid || total !== 100) {
    throw new Error("網站正式機率設定不完整，請重新上傳 config.js。");
  }
  return prizes.map((prize) => ({
    id: String(prize.id),
    title: String(prize.title),
    description: String(prize.description || ""),
    icon: String(prize.icon || "🎁"),
    weight: Number(prize.weight)
  }));
}

function normalizeOfficialCampaign(campaign) {
  return {
    ...campaign,
    algorithm: String(campaign?.algorithm || "sha256-v1"),
    seed: String(campaign?.seed || campaign?.id || uiConfig.activeCampaignId || "yu-lucky-garage"),
    prizes: getOfficialPrizes()
  };
}

async function checkAdminAccess(user) {
  currentUser = user;
  adminPath.textContent = `admins/${user.uid}`;
  adminEmail.textContent = user.email || user.uid;

  try {
    let enabled = OWNER_UIDS.has(user.uid) || (user.emailVerified === true && String(user.email || "").toLowerCase() === "uu8832sr@gmail.com");
    if (!enabled) {
      const snapshot = await getDoc(doc(db, "admins", user.uid));
      enabled = snapshot.exists() && snapshot.data().enabled === true;
    }
    loginCard.classList.add("hidden");
    bootstrapCard.classList.toggle("hidden", enabled);
    adminArea.classList.toggle("hidden", !enabled);
    if (enabled) await refreshCodes();
  } catch (error) {
    console.error(error);
    loginCard.classList.add("hidden");
    bootstrapCard.classList.remove("hidden");
    adminArea.classList.add("hidden");
  }
}

loginBtn.addEventListener("click", async () => {
  setMessage(loginMessage, "正在開啟 Google 登入…", true);
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    setMessage(loginMessage, friendlyAuthError(error), false);
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));
recheckBtn.addEventListener("click", () => currentUser && checkAdminAccess(currentUser));
copyUidBtn.addEventListener("click", async () => {
  if (!currentUser) return;
  await navigator.clipboard.writeText(currentUser.uid);
  showToast("UID 已複製");
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
    const existsMessage = error?.code?.includes("permission-denied") ? "建立失敗：活動 ID 可能已存在，或 Firestore 規則尚未發布。" : (error.message || "建立失敗。");
    setMessage(campaignMessage, existsMessage);
  } finally {
    setButtonBusy(createCampaignBtn, false, "建立中…", "建立活動");
  }
});

async function loadCampaign(campaignId) {
  if (campaignCache.has(campaignId)) return campaignCache.get(campaignId);
  const snapshot = await getDoc(doc(db, "campaigns", campaignId));
  if (!snapshot.exists()) throw new Error("找不到活動 ID，請先建立活動。");
  const data = normalizeOfficialCampaign({ id: snapshot.id, ...snapshot.data() });
  if (data.active === false) throw new Error("這個活動目前已停用。");
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

    const records = await Promise.all([...codes].map(async (code) => ({ code, hash: await sha256Hex(code) })));
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
    setMessage(codesMessage, `已建立 ${currentCodes.length} 組一次性抽獎碼；正式機率固定為 500=80%、1000=16%、2000=3%、3000=1%。`, true);
    await refreshCodes();
  } catch (error) {
    console.error(error);
    setMessage(codesMessage, error?.code?.includes("permission-denied") ? "寫入失敗：請確認管理員權限、活動 ID 與 Firestore 規則。" : (error.message || "產生失敗。"));
  } finally {
    setButtonBusy(generateCodesBtn, false, "寫入中…", "產生並寫入 Firebase");
  }
});

copyCodesBtn.addEventListener("click", async () => {
  if (!generatedCodes.value.trim()) return;
  await navigator.clipboard.writeText(generatedCodes.value);
  showToast("抽獎碼已複製");
});

downloadCodesBtn.addEventListener("click", () => {
  if (!currentCodes.length) return;
  const csv = "抽獎碼\n" + currentCodes.map((code) => `\"${code}\"`).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `lucky-garage-codes-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
});

refreshBtn.addEventListener("click", refreshCodes);

async function refreshCodes() {
  codeList.innerHTML = '<p class="empty">讀取中…</p>';
  try {
    const snapshot = await getDocs(query(collection(db, "drawCodes"), orderBy("createdAt", "desc"), limit(50)));
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
          await updateDoc(doc(db, "drawCodes", button.dataset.hash), { active: button.dataset.active !== "true" });
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
    codeList.innerHTML = `<p class="empty">讀取失敗：${escapeHtml(error.message || "請檢查規則")}</p>`;
  }
}

function start() {
  renderPrizePreview();
  const activeCampaignId = String(uiConfig.activeCampaignId || "main-2026-v12-final");
  campaignIdInput.value = activeCampaignId;
  codeCampaignIdInput.value = activeCampaignId;
  if (!hasRealFirebaseConfig(firebaseConfig)) {
    configWarning.classList.remove("hidden");
    loginCard.classList.add("hidden");
    return;
  }

  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      currentUser = null;
      loginCard.classList.remove("hidden");
      bootstrapCard.classList.add("hidden");
      adminArea.classList.add("hidden");
      return;
    }
    checkAdminAccess(user);
  });
}

start();
