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
const expectedCost = $("#expectedCost");
const codePrefixInput = $("#codePrefix");
const codeCountInput = $("#codeCount");
const generateCodesBtn = $("#generateCodesBtn");
const codesMessage = $("#codesMessage");
const generatedCodes = $("#generatedCodes");
const copyCodesBtn = $("#copyCodesBtn");
const downloadCodesBtn = $("#downloadCodesBtn");
const refreshBtn = $("#refreshBtn");
const codeList = $("#codeList");
const codeStats = $("#codeStats");
const codeSearch = $("#codeSearch");
const toast = $("#toast");
const totalCodesMetric = $("#totalCodesMetric");
const readyCodesMetric = $("#readyCodesMetric");
const usedCodesMetric = $("#usedCodesMetric");

let auth;
let db;
let currentUser = null;
let currentCodes = [];
let latestRows = [];
let clearingAnonymousUser = false;
const campaignCache = new Map();

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
  await refreshCodes();
}

function prizeAmount(prize) {
  const match = String(prize?.title || "").replace(/,/g, "").match(/(?:NT\$)?(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function renderPrizePreview() {
  const prizes = uiConfig.defaultPrizes || [];
  const total = prizes.reduce((sum, prize) => sum + Number(prize.weight || 0), 0);
  const expected = total > 0
    ? prizes.reduce((sum, prize) => sum + prizeAmount(prize) * Number(prize.weight || 0), 0) / total
    : 0;

  prizePreview.innerHTML = prizes.map((prize) => {
    const percent = total > 0
      ? ((Number(prize.weight || 0) / total) * 100).toFixed(1).replace(".0", "")
      : "0";
    return `<div class="prize-item"><strong>${escapeHtml(prize.icon || "🎁")} ${escapeHtml(prize.title)}</strong><span>後台機率 ${percent}%</span></div>`;
  }).join("");

  if (expectedCost) {
    expectedCost.textContent = `平均折扣成本：約 NT$${Math.round(expected).toLocaleString("zh-TW")}／次`;
  }
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

function updateStats(rows) {
  if (!codeStats) return;
  const total = rows.length;
  const used = rows.filter((row) => row.status.used).length;
  const ready = rows.filter((row) => !row.status.used && row.status.active).length;
  const disabled = rows.filter((row) => !row.status.used && !row.status.active).length;
  codeStats.innerHTML = `<strong>共 ${total} 碼</strong><span>可用 ${ready}</span><span>已使用 ${used}</span><span>已停用 ${disabled}</span>`;
  if (totalCodesMetric) totalCodesMetric.textContent = total.toLocaleString("zh-TW");
  if (readyCodesMetric) readyCodesMetric.textContent = ready.toLocaleString("zh-TW");
  if (usedCodesMetric) usedCodesMetric.textContent = used.toLocaleString("zh-TW");
}

function bindCodeRowActions() {
  codeList.querySelectorAll(".copy-one-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.code || "");
        showToast("抽獎碼已複製");
      } catch {
        showToast("請長按抽獎碼手動複製");
      }
    });
  });

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
}

function renderCodeRows() {
  const keyword = String(codeSearch?.value || "").trim().toLowerCase();
  const filtered = latestRows.filter(({ status, resultText }) => {
    if (!keyword) return true;
    return String(status.code || "").toLowerCase().includes(keyword)
      || String(resultText || "").toLowerCase().includes(keyword)
      || String(status.campaignId || "").toLowerCase().includes(keyword);
  });

  updateStats(latestRows);

  if (!filtered.length) {
    codeList.innerHTML = '<p class="empty">找不到符合的抽獎碼。</p>';
    return;
  }

  codeList.innerHTML = filtered.map(({ hash, status, resultText }) => `
    <div class="code-row">
      <div class="code-main">
        <code>${escapeHtml(status.code)}</code>
        <small>${escapeHtml(status.campaignId || "")}</small>
      </div>
      <span class="badge ${status.used ? "used" : "ready"}">${status.used ? "已使用" : (status.active ? "可使用" : "已停用")}</span>
      <small class="result">${escapeHtml(resultText)}</small>
      <div class="row-actions">
        <button class="copy-one-btn" data-code="${escapeHtml(status.code)}">複製</button>
        ${!status.used ? `<button class="disable-btn" data-hash="${hash}" data-active="${status.active}">${status.active ? "停用" : "啟用"}</button>` : ""}
      </div>
    </div>
  `).join("");

  bindCodeRowActions();
}

if (codeSearch) codeSearch.addEventListener("input", renderCodeRows);

refreshBtn.addEventListener("click", refreshCodes);

async function refreshCodes() {
  if (!currentUser || !isGoogleOwner(currentUser)) return;
  codeList.innerHTML = '<p class="empty">讀取中…</p>';

  try {
    const snapshot = await getDocs(
      query(collection(db, "drawCodes"), orderBy("createdAt", "desc"), limit(200))
    );

    if (snapshot.empty) {
      latestRows = [];
      updateStats([]);
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

    latestRows = rows;
    renderCodeRows();
  } catch (error) {
    console.error(error);
    codeList.innerHTML = `<p class="empty">讀取失敗：${escapeHtml(error?.message || "請檢查規則")}</p>`;
  }
}

function start() {
  renderPrizePreview();

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
