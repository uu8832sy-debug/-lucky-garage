import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { collection, deleteDoc, getDocs, getFirestore, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { getDownloadURL, getStorage, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-storage.js";
import { resolveShopContext, shopCollection, shopDoc, shopStoragePrefix } from "../multi-shop-core.js";

const app = initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG || {});
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const CLOUDINARY_CLOUD_NAME = "k6e9e4bl";
const CLOUDINARY_UPLOAD_PRESET = "jerry_products_unsigned";
const $ = (selector) => document.querySelector(selector);
let context = null;
let cases = [];

async function uploadToCloudinary(file, folder) {
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  body.append("folder", folder);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method:"POST", body });
  const result = await response.json();
  if (!response.ok || !result.secure_url) throw new Error(result?.error?.message || "Cloudinary 圖片上傳失敗");
  return { url:result.secure_url, publicId:result.public_id, provider:"cloudinary", isPrimary:true };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}
function showStatus(message, ok = false) {
  const box = $("#status");
  box.classList.remove("hidden", "text-emerald-400", "text-rose-400");
  box.classList.add(ok ? "text-emerald-400" : "text-rose-400");
  box.textContent = message;
}
function resetForm() {
  $("#caseId").value = "";
  $("#title").value = "";
  $("#description").value = "";
  $("#order").value = 100;
  $("#visible").checked = true;
  $("#photo").value = "";
  $("#preview").src = "";
  $("#preview").classList.add("hidden");
}
function editCase(id) {
  const item = cases.find((entry) => entry.id === id);
  if (!item) return;
  $("#caseId").value = item.id;
  $("#title").value = item.title || "";
  $("#description").value = item.description || "";
  $("#order").value = Number(item.order || 100);
  $("#visible").checked = item.visible !== false;
  const image = Array.isArray(item.images) ? (item.images.find((img) => img?.isPrimary) || item.images[0]) : null;
  const url = typeof image === "string" ? image : image?.url || item.imageUrl || "";
  if (url) {
    $("#preview").src = url;
    $("#preview").classList.remove("hidden");
  } else {
    $("#preview").classList.add("hidden");
  }
  window.scrollTo({ top:0, behavior:"smooth" });
}
async function removeCase(id) {
  if (!confirm("確定刪除這筆案例？")) return;
  await deleteDoc(shopDoc(db, context, "deliveryCases", id));
  await loadCases();
}
async function loadCases() {
  const snap = await getDocs(shopCollection(db, context, "deliveryCases"));
  cases = snap.docs.map((item) => ({ id:item.id, ...item.data() }))
    .sort((a,b) => Number(a.order || 999) - Number(b.order || 999));
  const list = $("#caseList");
  if (!cases.length) {
    list.innerHTML = '<div class="sm:col-span-2 border border-dashed border-slate-700 rounded-2xl p-8 text-center text-slate-500 text-sm">尚未建立案例</div>';
    return;
  }
  list.innerHTML = cases.map((item) => {
    const image = Array.isArray(item.images) ? (item.images.find((img) => img?.isPrimary) || item.images[0]) : null;
    const url = typeof image === "string" ? image : image?.url || item.imageUrl || "";
    return `<article class="border border-slate-800 bg-slate-950 rounded-2xl overflow-hidden">
      ${url ? `<img src="${escapeHtml(url)}" class="w-full aspect-video object-cover" alt="${escapeHtml(item.title || "案例")}">` : ""}
      <div class="p-4 space-y-2"><div class="flex justify-between gap-3"><h3 class="font-black">${escapeHtml(item.title || "未命名案例")}</h3><span class="text-[10px] ${item.visible===false ? "text-rose-400" : "text-emerald-400"}">${item.visible===false ? "隱藏" : "顯示"}</span></div><p class="text-xs text-slate-400">${escapeHtml(item.description || "")}</p><div class="flex gap-2 pt-2"><button class="editBtn flex-1 bg-slate-800 border border-slate-700 rounded-lg py-2 text-xs" data-id="${escapeHtml(item.id)}">編輯</button><button class="deleteBtn flex-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg py-2 text-xs" data-id="${escapeHtml(item.id)}">刪除</button></div></div>
    </article>`;
  }).join("");
  document.querySelectorAll(".editBtn").forEach((btn) => btn.addEventListener("click", () => editCase(btn.dataset.id)));
  document.querySelectorAll(".deleteBtn").forEach((btn) => btn.addEventListener("click", () => removeCase(btn.dataset.id).catch((error) => showStatus(error?.message || "刪除失敗"))));
}

async function saveCase() {
  if (!context) return;
  const title = $("#title").value.trim();
  if (!title) return showStatus("請先輸入案例標題");
  const id = $("#caseId").value || `case-${Date.now()}`;
  const existing = cases.find((item) => item.id === id) || {};
  let images = Array.isArray(existing.images) ? existing.images : [];
  const file = $("#photo").files?.[0];
  if (file) {
    if (context.legacy) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `cases/${id}/${Date.now()}_${safeName}`;
      const objectRef = ref(storage, path);
      await uploadBytes(objectRef, file, { contentType:file.type || "image/jpeg" });
      const url = await getDownloadURL(objectRef);
      images = [{ url, path, provider:"firebase", isPrimary:true }];
    } else {
      images = [await uploadToCloudinary(file, `shops/${context.shopId}/cases/${id}`)];
    }
  }
  await setDoc(shopDoc(db, context, "deliveryCases", id), {
    title,
    description:$("#description").value.trim(),
    order:Number($("#order").value || 100),
    visible:$("#visible").checked,
    images,
    shopId:context.shopId,
    updatedAt:serverTimestamp(),
    updatedBy:auth.currentUser.uid
  }, { merge:true });
  showStatus("案例已儲存", true);
  resetForm();
  await loadCases();
}

$("#saveBtn").addEventListener("click", () => saveCase().catch((error) => { console.error(error); showStatus(error?.message || "儲存失敗"); }));
$("#resetBtn").addEventListener("click", resetForm);
$("#refreshBtn").addEventListener("click", () => loadCases().catch((error) => showStatus(error?.message || "讀取失敗")));
$("#photo").addEventListener("change", () => {
  const file = $("#photo").files?.[0];
  if (!file) return;
  $("#preview").src = URL.createObjectURL(file);
  $("#preview").classList.remove("hidden");
});

onAuthStateChanged(auth, async (user) => {
  if (!user) { $("#gate").textContent = "請先回管理員後台登入。"; return; }
  try {
    context = await resolveShopContext(db, user);
    $("#shopName").textContent = context.shop?.name || context.shop?.displayName || context.shopId;
    $("#gate").classList.add("hidden");
    $("#app").classList.remove("hidden");
    await loadCases();
  } catch (error) {
    console.error(error);
    $("#gate").textContent = error?.message || "沒有權限讀取這家店。";
  }
});
