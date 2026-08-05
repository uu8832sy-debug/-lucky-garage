import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import {
  deriveDrawResult,
  escapeHtml,
  normalizeCode,
  sha256Hex
} from "./draw-core.js";

const firebaseConfig = window.LUCKY_GARAGE_FIREBASE_CONFIG || {};
const uiConfig = window.LUCKY_GARAGE_UI_CONFIG || {};
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

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
const soundToggle = $("#soundToggle");
const cinematicOverlay = $("#cinematicOverlay");
const cinematicGarage = $("#cinematicGarage");
const cinematicGarageNumber = $("#cinematicGarageNumber");
const cinematicEyebrow = $("#cinematicEyebrow");
const cinematicTitle = $("#cinematicTitle");
const cinematicStatus = $("#cinematicStatus");
const cinematicPrize = $("#cinematicPrize");
const countdown = $("#countdown");
const fxCanvas = $("#fxCanvas");
const veoCutscene = $("#veoCutscene");

let auth;
let db;
let activeCode = "";
let activeHash = "";
let activeStatus = null;
let activeCampaign = null;
let currentUser = null;
let drawInProgress = false;
let latestResult = null;
let fxAnimationFrame = null;

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem("lucky-garage-sound") !== "off";
  }

  async prime() {
    if (!this.enabled) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!this.ctx) this.ctx = new AudioContextClass();
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    localStorage.setItem("lucky-garage-sound", enabled ? "on" : "off");
    updateSoundButton();
  }

  tone({ frequency = 440, endFrequency = null, duration = .15, type = "sine", volume = .05, delay = 0 }) {
    if (!this.enabled || !this.ctx) return;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .018);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + duration + .03);
  }

  noise({ duration = .35, volume = .035, delay = 0, frequency = 800 }) {
    if (!this.enabled || !this.ctx) return;
    const start = this.ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(this.ctx.destination);
    source.start(start);
  }

  verify() {
    this.tone({ frequency: 520, endFrequency: 760, duration: .13, type: "sine", volume: .04 });
    this.tone({ frequency: 820, duration: .12, type: "sine", volume: .025, delay: .12 });
  }

  select() {
    this.tone({ frequency: 150, endFrequency: 92, duration: .34, type: "sawtooth", volume: .055 });
    this.noise({ duration: .25, volume: .03, frequency: 520 });
  }

  count(number) {
    const frequency = number === 1 ? 740 : number === 2 ? 620 : 520;
    this.tone({ frequency, duration: .12, type: "square", volume: .035 });
  }

  door() {
    this.noise({ duration: 1.05, volume: .075, frequency: 420 });
    this.tone({ frequency: 90, endFrequency: 42, duration: 1.1, type: "sawtooth", volume: .08 });
    this.tone({ frequency: 185, endFrequency: 80, duration: .72, type: "triangle", volume: .03, delay: .15 });
  }

  reveal(amount) {
    const jackpot = amount >= 3000;
    const notes = jackpot ? [392, 523.25, 659.25, 783.99] : amount >= 2000 ? [349.23, 440, 587.33] : [329.63, 415.30, 523.25];
    notes.forEach((frequency, index) => {
      this.tone({ frequency, duration: jackpot ? .8 : .55, type: "sine", volume: jackpot ? .05 : .038, delay: index * .09 });
    });
    this.noise({ duration: .38, volume: jackpot ? .07 : .045, frequency: 2400, delay: .08 });
  }
}

const audio = new AudioEngine();

function updateSoundButton() {
  soundToggle.textContent = audio.enabled ? "🔊" : "🔇";
  soundToggle.setAttribute("aria-label", audio.enabled ? "關閉音效" : "開啟音效");
  soundToggle.title = audio.enabled ? "關閉音效" : "開啟音效";
}

soundToggle.addEventListener("click", async () => {
  audio.setEnabled(!audio.enabled);
  if (audio.enabled) {
    await audio.prime();
    audio.verify();
  }
});

document.addEventListener("pointerdown", () => audio.prime(), { once: true });

function hasRealFirebaseConfig(config) {
  return Boolean(
    config.apiKey && config.projectId && config.appId &&
    !Object.values(config).some((value) => String(value).includes("YOUR_"))
  );
}

function setStep(stepNumber) {
  $$(".step").forEach((step) => {
    const current = Number(step.dataset.step);
    step.classList.toggle("is-active", current === stepNumber);
    step.classList.toggle("is-done", current < stepNumber);
  });
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
  verifyBtn.querySelector("span").textContent = isBusy ? "連線驗證中…" : label;
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
      <div class="garage-inside"><span class="garage-logo">⚡</span></div>
      <div class="garage-frame"></div>
      <div class="garage-light"></div>
      <div class="door-face">
        <span class="door-number">${number}</span>
        <span class="door-handle"></span>
      </div>
      <span class="garage-caption">點擊開庫</span>
    `;
    button.addEventListener("click", () => claimCodeAndDraw(button, number));
    garageGrid.appendChild(button);
  }
}

function renderOdds(campaign) {
  if (!campaign?.prizes?.length) return;
  const total = campaign.prizes.reduce((sum, prize) => sum + Number(prize.weight || 0), 0);
  oddsPlaceholder.classList.add("hidden");
  oddsList.innerHTML = campaign.prizes.map((prize) => {
    const percent = ((Number(prize.weight || 0) / total) * 100).toFixed(1).replace(".0", "");
    return `<li>${escapeHtml(prize.title)}：${percent}%</li>`;
  }).join("");
}

async function ensureAnonymousUser() {
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
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
    throw new Error("網站正式機率設定不完整，請聯絡小宇。");
  }
  return prizes.map((prize) => ({
    id: String(prize.id),
    title: String(prize.title),
    description: String(prize.description || ""),
    icon: String(prize.icon || "🎁"),
    weight: Number(prize.weight)
  }));
}

async function loadCampaign(campaignId) {
  const requiredCampaignId = String(uiConfig.activeCampaignId || "").trim();
  if (requiredCampaignId && campaignId !== requiredCampaignId) {
    throw new Error("此為舊活動抽獎碼，請聯絡小宇更換新版抽獎碼。");
  }
  const snapshot = await getDoc(doc(db, "campaigns", campaignId));
  if (!snapshot.exists()) throw new Error("找不到活動設定，請聯絡小宇。");
  const campaign = { id: snapshot.id, ...snapshot.data() };
  if (campaign.active === false) throw new Error("本活動目前已結束。");

  // Firestore 只保存活動身分、啟用狀態與固定種子；實際獎項及機率
  // 一律取自隨網站部署的正式 config.js，避免手機手動建檔造成字串、ID、
  // 順序或數字型別差異，卻又不會讓機率偏離 80 / 16 / 3 / 1。
  return {
    ...campaign,
    algorithm: String(campaign.algorithm || "sha256-v1"),
    seed: String(campaign.seed || campaign.id || requiredCampaignId || "yu-lucky-garage"),
    prizes: getOfficialPrizes()
  };
}

function prizeAmount(prize) {
  const match = String(prize?.title || "").replaceAll(",", "").match(/(?:NT\$)?(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function tierForPrize(prize) {
  const amount = prizeAmount(prize);
  if (amount >= 3000) return "jackpot";
  if (amount >= 2000) return "elite";
  if (amount >= 1000) return "silver";
  return "standard";
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
  showResult(latestResult, false);
}

codeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await audio.prime();
  const code = normalizeCode(codeInput.value);

  if (!code) {
    setCodeMessage("請輸入抽獎碼。");
    codeInput.focus();
    return;
  }

  setBusy(true);
  setCodeMessage("正在連線 Firebase 驗證資格…", true);

  try {
    currentUser = await ensureAnonymousUser();
    const codeHash = await sha256Hex(code);
    const statusSnapshot = await getDoc(doc(db, "drawCodes", codeHash));

    if (!statusSnapshot.exists()) throw new Error("找不到這組抽獎碼，請確認後再試一次。");

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

    audio.verify();
    setCodeMessage("驗證成功，請選擇一座幸運車庫。", true);
    await sleep(380);
    entryView.classList.add("hidden");
    garageView.classList.remove("hidden");
    setStep(2);
    garageView.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error(error);
    const denied = error?.code === "permission-denied" || error?.code === "firestore/permission-denied";
    setCodeMessage(denied ? "抽獎碼已使用、無效，或 Firebase 權限尚未完成。" : (error.message || "驗證失敗，請稍後再試。"));
  } finally {
    setBusy(false);
  }
});

function resetCinematic() {
  cinematicOverlay.className = "cinematic-overlay hidden";
  cinematicOverlay.setAttribute("aria-hidden", "true");
  cinematicPrize.querySelector("strong").textContent = "";
  countdown.textContent = "";
  if (veoCutscene) {
    veoCutscene.pause();
    veoCutscene.currentTime = 0;
    veoCutscene.classList.add("hidden");
  }
  stopFx();
}

async function playOptionalVeoVideo() {
  const source = String(uiConfig.cinematicVideoUrl || "").trim();
  if (!source || !veoCutscene) return false;
  try {
    if (veoCutscene.src !== new URL(source, window.location.href).href) veoCutscene.src = source;
    veoCutscene.muted = true;
    veoCutscene.currentTime = 0;
    veoCutscene.classList.remove("hidden");
    await veoCutscene.play();
    return true;
  } catch (error) {
    console.warn("Veo cutscene could not play; using native animation.", error);
    veoCutscene.classList.add("hidden");
    return false;
  }
}

async function beginCinematic(garageNumber) {
  cinematicGarageNumber.textContent = String(garageNumber);
  cinematicEyebrow.textContent = "正在鎖定幸運車庫";
  cinematicTitle.textContent = `第 ${garageNumber} 號車庫`;
  cinematicStatus.textContent = "正在取得 Firebase 伺服器時間…";
  cinematicPrize.querySelector("strong").textContent = "";
  cinematicOverlay.className = "cinematic-overlay";
  cinematicOverlay.classList.remove("hidden");
  cinematicOverlay.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => cinematicOverlay.classList.add("is-visible"));
  await playOptionalVeoVideo();
  audio.select();
  if (navigator.vibrate) navigator.vibrate([35, 30, 65]);

  await sleep(500);
  for (const value of [3, 2, 1]) {
    countdown.textContent = String(value);
    countdown.classList.remove("pop");
    void countdown.offsetWidth;
    countdown.classList.add("pop");
    audio.count(value);
    cinematicStatus.textContent = value === 1 ? "結果即將鎖定…" : "伺服器驗證中…";
    await sleep(720);
  }

  countdown.textContent = "";
  cinematicOverlay.classList.add("is-opening");
  cinematicEyebrow.textContent = "車庫開啟中";
  cinematicStatus.textContent = "正在完成不可逆開獎紀錄…";
  audio.door();
  startSparks();
  if (navigator.vibrate) navigator.vibrate([55, 25, 90, 35, 120]);
}

async function revealCinematic(result) {
  const amount = prizeAmount(result.prize);
  cinematicPrize.querySelector("strong").textContent = result.prize.title;
  cinematicEyebrow.textContent = "開獎完成";
  cinematicStatus.textContent = "Firebase 已完成結果登記";
  cinematicOverlay.classList.add("is-reveal");
  audio.reveal(amount);
  runConfetti(amount >= 3000 ? 180 : amount >= 2000 ? 130 : 90);
  if (navigator.vibrate) navigator.vibrate(amount >= 3000 ? [90,40,160,50,220] : [80,40,140]);
  await sleep(amount >= 3000 ? 2300 : 1900);
  cinematicOverlay.classList.remove("is-visible");
  await sleep(360);
  resetCinematic();
}

async function claimCodeAndDraw(selectedDoor, garageNumber) {
  if (drawInProgress || !activeCode || !activeHash || !currentUser) return;
  drawInProgress = true;
  await audio.prime();

  const doors = [...garageGrid.querySelectorAll(".garage-door")];
  doors.forEach((door) => {
    door.disabled = true;
    if (door !== selectedDoor) door.classList.add("dimmed");
  });
  selectedDoor.classList.add("opening");

  const cinematicPromise = beginCinematic(garageNumber);

  try {
    const statusRef = doc(db, "drawCodes", activeHash);
    const firebasePromise = (async () => {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(statusRef);
        if (!snapshot.exists()) throw new Error("找不到這組抽獎碼。");
        const latest = snapshot.data();
        if (latest.code !== activeCode) throw new Error("抽獎碼驗證失敗。");
        if (latest.active !== true) throw new Error("這組抽獎碼目前無法使用。");
        if (latest.used === true) {
          if (latest.usedBy === currentUser.uid) return;
          throw new Error("這組抽獎碼已經使用過了。");
        }
        transaction.update(statusRef, {
          used: true,
          usedBy: currentUser.uid,
          usedAt: serverTimestamp(),
          selectedGarage: garageNumber
        });
      });

      const statusSnapshot = await getDoc(statusRef);
      if (!statusSnapshot.exists()) throw new Error("找不到開獎紀錄。");
      const completedStatus = statusSnapshot.data();
      if (completedStatus.usedBy !== currentUser.uid) throw new Error("這組抽獎碼已被其他使用者使用。");
      activeStatus = completedStatus;
      const derived = await deriveDrawResult(activeCampaign, completedStatus);
      return {
        code: activeCode,
        garage: completedStatus.selectedGarage,
        prize: derived.prize,
        serial: derived.serial,
        formattedTime: derived.formattedTime,
        proofHash: derived.proofHash
      };
    })();

    await cinematicPromise;
    latestResult = await firebasePromise;
    await revealCinematic(latestResult);
    showResult(latestResult, true);
  } catch (error) {
    console.error(error);
    resetCinematic();
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
      // 統一顯示錯誤訊息。
    }

    setCodeMessage("抽獎碼可能已被使用，請重新確認或聯絡小宇。");
    garageView.classList.add("hidden");
    entryView.classList.remove("hidden");
    setStep(1);
    entryView.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function showResult(result, animate = true) {
  prizeTitle.textContent = result.prize.title;
  prizeDescription.textContent = result.prize.description;
  resultCode.textContent = result.code;
  resultGarage.textContent = `第 ${result.garage} 號`;
  resultSerial.textContent = result.serial;
  resultTime.textContent = result.formattedTime;
  resultView.dataset.tier = tierForPrize(result.prize);

  entryView.classList.add("hidden");
  garageView.classList.add("hidden");
  resultView.classList.remove("hidden");
  setStep(3);
  resultView.scrollIntoView({ behavior: animate ? "smooth" : "auto", block: "start" });
  drawInProgress = false;
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

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  fxCanvas.width = Math.floor(window.innerWidth * ratio);
  fxCanvas.height = Math.floor(window.innerHeight * ratio);
  fxCanvas.style.width = `${window.innerWidth}px`;
  fxCanvas.style.height = `${window.innerHeight}px`;
}

function stopFx() {
  if (fxAnimationFrame) cancelAnimationFrame(fxAnimationFrame);
  fxAnimationFrame = null;
  const ctx = fxCanvas.getContext("2d");
  ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
}

function startSparks() {
  resizeCanvas();
  const ctx = fxCanvas.getContext("2d");
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const particles = Array.from({ length: 34 }, () => ({
    x: fxCanvas.width * (.42 + Math.random() * .16),
    y: fxCanvas.height * (.58 + Math.random() * .08),
    vx: (Math.random() - .5) * 8 * ratio,
    vy: (-2 - Math.random() * 7) * ratio,
    life: 35 + Math.random() * 45,
    size: (1 + Math.random() * 2.5) * ratio
  }));
  let frame = 0;
  const draw = () => {
    ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    ctx.globalCompositeOperation = "lighter";
    particles.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += .13 * ratio;
      particle.life -= 1;
      if (particle.life <= 0) {
        particle.x = fxCanvas.width * (.44 + Math.random() * .12);
        particle.y = fxCanvas.height * .65;
        particle.vx = (Math.random() - .5) * 8 * ratio;
        particle.vy = (-2 - Math.random() * 7) * ratio;
        particle.life = 30 + Math.random() * 45;
      }
      ctx.fillStyle = `rgba(255,${150 + Math.random() * 100},20,${Math.min(1,particle.life / 25)})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });
    frame += 1;
    if (frame < 150 && cinematicOverlay.classList.contains("is-visible")) fxAnimationFrame = requestAnimationFrame(draw);
  };
  draw();
}

function runConfetti(count = 100) {
  resizeCanvas();
  const ctx = fxCanvas.getContext("2d");
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const colors = ["#ffd343", "#ffffff", "#ff8b38", "#72a6ff", "#b98bff"];
  const pieces = Array.from({ length: count }, () => ({
    x: fxCanvas.width * (.15 + Math.random() * .7),
    y: -Math.random() * fxCanvas.height * .22,
    vx: (Math.random() - .5) * 5 * ratio,
    vy: (3 + Math.random() * 6) * ratio,
    gravity: (.045 + Math.random() * .08) * ratio,
    rotate: Math.random() * Math.PI,
    vr: (Math.random() - .5) * .22,
    w: (4 + Math.random() * 8) * ratio,
    h: (7 + Math.random() * 10) * ratio,
    color: colors[Math.floor(Math.random() * colors.length)],
    life: 150 + Math.random() * 80
  }));
  const draw = () => {
    ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    pieces.forEach((piece) => {
      piece.x += piece.vx;
      piece.y += piece.vy;
      piece.vy += piece.gravity;
      piece.rotate += piece.vr;
      piece.life -= 1;
      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.rotate);
      ctx.globalAlpha = Math.max(0, Math.min(1, piece.life / 35));
      ctx.fillStyle = piece.color;
      ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
      ctx.restore();
    });
    if (pieces.some((piece) => piece.life > 0) && cinematicOverlay.classList.contains("is-visible")) {
      fxAnimationFrame = requestAnimationFrame(draw);
    }
  };
  draw();
}

window.addEventListener("resize", () => {
  if (cinematicOverlay.classList.contains("is-visible")) resizeCanvas();
});

async function start() {
  if (!codeForm || !codeInput || !verifyBtn || !entryView || !garageView || !resultView) {
    console.error("幸運車庫頁面檔案版本不一致：請同步覆蓋 garage.html、garage.js、garage.css。 ");
    document.body.insertAdjacentHTML("afterbegin", `<div style="position:fixed;z-index:99999;inset:12px 12px auto;padding:14px;border-radius:12px;background:#7f1d1d;color:#fff;font-weight:800">網站檔案版本不一致，請重新上傳 v19 完整穩定版。</div>`);
    return;
  }
  setCodeMessage("系統連線中，請稍候…", true);
  renderGarages();
  updateSoundButton();
  setStep(1);
  lineLink.href = uiConfig.lineUrl || lineLink.href;
  lineLink.textContent = `開啟官方 LINE：${uiConfig.lineId || "@762eqvlg"}`;
  verifyBtn.disabled = true;

  if (!hasRealFirebaseConfig(firebaseConfig)) {
    showSetupError("請先確認 firebase-config.js 的 Firebase Web 設定。");
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    await setPersistence(auth, browserLocalPersistence);
    currentUser = await ensureAnonymousUser();
    verifyBtn.disabled = false;
    setCodeMessage("");
  } catch (error) {
    console.error(error);
    showSetupError(`Firebase 連線失敗：${error.message || "請檢查設定。"}`);
  }
}

start();
