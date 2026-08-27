import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, reload, sendEmailVerification } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const app = initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG || {});
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (s) => document.querySelector(s);

const invitedEmail = new URLSearchParams(location.search).get("email") || "";
$("#emailInput").value = invitedEmail;

function showResult(message, ok = false) {
  const box = $("#result");
  box.classList.remove("hidden");
  box.classList.toggle("text-emerald-400", ok);
  box.classList.toggle("text-rose-400", !ok);
  box.textContent = message;
}

async function claimInvite() {
  const user = auth.currentUser;
  if (!user) return showResult("找不到登入帳號");
  await reload(user);
  await user.getIdToken(true);
  if (!user.emailVerified) return showResult("Email 還沒有完成驗證，請先到信箱點驗證連結");

  const email = String(user.email || "").toLowerCase();
  const inviteSnap = await getDoc(doc(db, "shopInvites", email));
  if (!inviteSnap.exists()) return showResult("找不到這個 Email 的代理店邀請");
  const invite = inviteSnap.data() || {};
  if (invite.enabled !== true || !invite.shopId) return showResult("這個邀請已停用或資料不完整");

  await setDoc(doc(db, "adminAccounts", user.uid), {
    enabled: true,
    role: "admin",
    email,
    shopId: invite.shopId,
    createdAt: serverTimestamp()
  });

  showResult(`設定完成\n店家：${invite.shopName || invite.shopId}\n管理員：${email}\n\n現在登入後台只會看到這家店自己的資料。`, true);
  $("#registerForm").classList.add("hidden");
  $("#verifyBox").classList.add("hidden");
  $("#adminLink").classList.remove("hidden");
}

$("#registerBtn").addEventListener("click", async () => {
  const email = $("#emailInput").value.trim().toLowerCase();
  const password = $("#passwordInput").value;
  if (!email || password.length < 8) return showResult("請確認 Email，密碼至少 8 碼");
  if (invitedEmail && email !== invitedEmail.toLowerCase()) return showResult("請使用邀請連結指定的 Email");

  const btn = $("#registerBtn");
  btn.disabled = true;
  btn.textContent = "建立中…";
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(credential.user);
    $("#registerForm").classList.add("hidden");
    $("#verifyBox").classList.remove("hidden");
    showResult(`驗證信已寄到 ${email}\n請完成驗證後回來按「我已完成 Email 驗證」`, true);
  } catch (error) {
    console.error(error);
    showResult(error?.message || "建立帳號失敗");
  } finally {
    btn.disabled = false;
    btn.textContent = "建立帳號並寄驗證信";
  }
});

$("#verifyBtn").addEventListener("click", () => claimInvite().catch((error) => {
  console.error(error);
  showResult(error?.message || "綁定代理店失敗");
}));

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  $("#emailInput").value = user.email || $("#emailInput").value;
  if (user.emailVerified) {
    claimInvite().catch((error) => {
      console.error(error);
      showResult(error?.message || "綁定代理店失敗");
    });
  } else {
    $("#registerForm").classList.add("hidden");
    $("#verifyBox").classList.remove("hidden");
  }
});
