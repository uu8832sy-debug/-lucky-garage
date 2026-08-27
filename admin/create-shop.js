import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { doc, getFirestore, serverTimestamp, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const app = initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG || {});
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (s) => document.querySelector(s);

function showResult(message, ok = false) {
  const box = $("#result");
  box.classList.remove("hidden");
  box.classList.toggle("text-emerald-400", ok);
  box.classList.toggle("text-rose-400", !ok);
  box.textContent = message;
}

function normalizeShopId(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
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
  const shopId = normalizeShopId($("#shopId").value.trim());
  const email = $("#adminEmail").value.trim().toLowerCase();
  if (!name || !shopId || !email) return showResult("資料還沒填完整");
  if (!/^[a-z0-9-]{2,40}$/.test(shopId)) return showResult("shopId 只能用英文小寫、數字與 -");
  if (!/^\S+@\S+\.\S+$/.test(email)) return showResult("Email 格式不正確");

  const btn = $("#createBtn");
  btn.disabled = true;
  btn.textContent = "建立中…";
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, "shops", shopId), {
      name,
      displayName: name,
      enabled: true,
      public: true,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid
    }, { merge: true });
    batch.set(doc(db, "shopInvites", email), {
      email,
      shopId,
      shopName: name,
      enabled: true,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid
    });
    await batch.commit();

    const registerUrl = `${location.origin}${location.pathname.replace(/create-shop\.html$/, "register.html")}?email=${encodeURIComponent(email)}`;
    showResult(`代理店邀請已建立\n店家：${name}\nshopId：${shopId}\n管理員：${email}\n\n把這個註冊網址傳給對方：\n${registerUrl}`, true);
  } catch (error) {
    console.error(error);
    showResult(error?.message || "建立失敗");
  } finally {
    btn.disabled = false;
    btn.textContent = "建立代理店邀請";
  }
});

onAuthStateChanged(auth, (user) => {
  $("#loginCard").classList.toggle("hidden", !!user);
  $("#formCard").classList.toggle("hidden", !user);
  $("#identity").textContent = user?.email || "";
  $("#loginStatus").textContent = "";
});
