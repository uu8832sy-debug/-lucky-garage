import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const firebaseConfig = window.LUCKY_GARAGE_FIREBASE_CONFIG || {};
const app = getApps().find((item) => item.name === "[DEFAULT]") || initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const OWNER_EMAIL = "uu8832sr@gmail.com";
const $ = (selector) => document.querySelector(selector);

function setStatus(message, type = "info") {
  const box = $("#status");
  box.classList.remove("hidden", "border-emerald-500/30", "bg-emerald-500/10", "text-emerald-300", "border-rose-500/30", "bg-rose-500/10", "text-rose-300", "border-slate-700", "bg-slate-900", "text-slate-300");
  if (type === "success") box.classList.add("border-emerald-500/30", "bg-emerald-500/10", "text-emerald-300");
  else if (type === "error") box.classList.add("border-rose-500/30", "bg-rose-500/10", "text-rose-300");
  else box.classList.add("border-slate-700", "bg-slate-900", "text-slate-300");
  box.textContent = message;
}

async function isPlatformOwner(user) {
  if (!user) return false;
  if (String(user.email || "").toLowerCase() === OWNER_EMAIL) return true;
  const snap = await getDoc(doc(db, "adminAccounts", user.uid));
  return snap.exists() && snap.data()?.enabled === true && snap.data()?.role === "platformOwner";
}

async function createTenantAccount(email, password) {
  const secondaryName = `tenant-create-${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryName);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    return credential.user;
  } finally {
    try { await signOut(secondaryAuth); } catch {}
  }
}

async function createShop() {
  const shopId = $("#shopId").value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const shopName = $("#shopName").value.trim();
  const adminEmail = $("#adminEmail").value.trim().toLowerCase();
  const adminPassword = $("#adminPassword").value;
  const siteUrl = $("#siteUrl").value.trim();

  if (!shopId || !shopName || !adminEmail || adminPassword.length < 6) {
    return setStatus("請填完整 shopId、店名、管理員 Email，密碼至少 6 碼。", "error");
  }

  const button = $("#createShopBtn");
  button.disabled = true;
  button.textContent = "建立中…";
  setStatus("正在建立 Firebase Auth 帳號與車行資料…");

  try {
    const shopRef = doc(db, "shops", shopId);
    const existingShop = await getDoc(shopRef);
    if (existingShop.exists()) throw new Error(`shopId「${shopId}」已存在`);

    const newUser = await createTenantAccount(adminEmail, adminPassword);

    await setDoc(shopRef, {
      name:shopName,
      displayName:shopName,
      enabled:true,
      public:true,
      siteUrl:siteUrl || "",
      createdAt:serverTimestamp(),
      createdBy:auth.currentUser.uid
    });

    await setDoc(doc(db, "adminAccounts", newUser.uid), {
      enabled:true,
      shopId,
      role:"admin",
      email:adminEmail,
      createdAt:serverTimestamp(),
      createdBy:auth.currentUser.uid
    });

    await setDoc(doc(db, "shops", shopId, "siteSettings", "general"), {
      shopId,
      brandName:shopName,
      siteUrl:siteUrl || "",
      createdAt:serverTimestamp(),
      updatedAt:serverTimestamp()
    });

    setStatus(`建立完成：${shopName}（${shopId}）\n管理員：${adminEmail}\nUID：${newUser.uid}`, "success");
    $("#adminPassword").value = "";
  } catch (error) {
    console.error(error);
    const code = String(error?.code || "");
    let message = error?.message || "建立失敗";
    if (code.includes("operation-not-allowed")) message = "Firebase 尚未啟用 Email/Password 登入，請先在 Authentication → Sign-in method 開啟 Email/Password。";
    if (code.includes("email-already-in-use")) message = "這個 Email 已經有 Firebase 帳號，請換一個 Email 或改用既有 UID 綁定。";
    setStatus(message, "error");
  } finally {
    button.disabled = false;
    button.innerHTML = '<i class="fa-solid fa-store mr-2"></i>建立車行＋管理員帳號';
  }
}

$("#createShopBtn").addEventListener("click", createShop);

onAuthStateChanged(auth, async (user) => {
  const gate = $("#authGate");
  const appEl = $("#platformApp");
  if (!user) {
    gate.textContent = "請先回管理員後台登入平台主帳號。";
    return;
  }
  try {
    if (!(await isPlatformOwner(user))) {
      gate.textContent = `目前帳號 ${user.email || user.uid} 沒有平台管理權限。`;
      return;
    }
    gate.classList.add("hidden");
    appEl.classList.remove("hidden");
  } catch (error) {
    console.error(error);
    gate.textContent = "平台權限確認失敗。";
  }
});