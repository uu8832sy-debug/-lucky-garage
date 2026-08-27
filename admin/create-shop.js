import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-functions.js";

const app = initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG || {});
const auth = getAuth(app);
const functions = getFunctions(app, "asia-east1");
const createShopAdmin = httpsCallable(functions, "createShopAdmin");
const $ = (s) => document.querySelector(s);

function showResult(message, ok = false) {
  const box = $("#result");
  box.classList.remove("hidden");
  box.classList.toggle("text-emerald-400", ok);
  box.classList.toggle("text-rose-400", !ok);
  box.textContent = message;
}

$("#loginBtn").addEventListener("click", async () => {
  $("#loginStatus").textContent = "登入中…";
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  } catch (error) {
    $("#loginStatus").textContent = error?.message || "登入失敗";
  }
});

$("#logoutBtn").addEventListener("click", () => signOut(auth));

$("#createBtn").addEventListener("click", async () => {
  const name = $("#shopName").value.trim();
  const shopId = $("#shopId").value.trim();
  const email = $("#adminEmail").value.trim();
  const password = $("#adminPassword").value;
  if (!name || !shopId || !email || !password) return showResult("資料還沒填完整");

  const btn = $("#createBtn");
  btn.disabled = true;
  btn.textContent = "建立中…";
  try {
    const response = await createShopAdmin({ name, shopId, email, password });
    const data = response.data || {};
    showResult(`建立完成\n店家：${data.name}\nshopId：${data.shopId}\n管理員：${data.email}\nUID：${data.uid}`, true);
    $("#adminPassword").value = "";
  } catch (error) {
    console.error(error);
    showResult(error?.message || "建立失敗");
  } finally {
    btn.disabled = false;
    btn.textContent = "建立代理店";
  }
});

onAuthStateChanged(auth, (user) => {
  $("#loginCard").classList.toggle("hidden", !!user);
  $("#formCard").classList.toggle("hidden", !user);
  $("#identity").textContent = user?.email || "";
  $("#loginStatus").textContent = "";
});
