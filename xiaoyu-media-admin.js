import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { resolveShopContext } from "./multi-shop-core.js";

const CLOUD_NAME = "k6e9e4bl";
const UPLOAD_PRESET = "jerry_products_unsigned";
const app = getApps().length ? getApp() : initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG || {});
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const esc = (value) => String(value ?? "").replace(/[&<>'\"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':"&quot;"}[c]));

let currentUser = null;
let shorts = [];
let editingId = null;

function toast(message) {
  const text = $("#toastMsg"), wrap = $("#toast");
  if (!text || !wrap) return alert(message);
  text.textContent = message;
  wrap.classList.remove("translate-y-20", "opacity-0");
  setTimeout(() => wrap.classList.add("translate-y-20", "opacity-0"), 2600);
}

async function uploadCloudinary(file, resourceType, folder) {
  if (!file) throw new Error("請先選擇檔案");
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", UPLOAD_PRESET);
  form.append("folder", folder);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, { method:"POST", body:form });
  let result = {};
  try { result = await response.json(); } catch (_) {}
  if (!response.ok || !result.secure_url) throw new Error(result?.error?.message || `${resourceType === "video" ? "影片" : "圖片"}上傳失敗`);
  return result;
}

function autoPoster(videoUrl) {
  const url = String(videoUrl || "");
  if (!url.includes("res.cloudinary.com") || !url.includes("/video/upload/")) return "";
  return url.replace("/video/upload/", "/video/upload/so_0,f_jpg/").replace(/\.(mp4|mov|webm)(\?.*)?$/i, ".jpg$2");
}

function progress(message) {
  const el = $("#yuShortUploadProgress");
  if (el) el.textContent = message;
}

function resetForm() {
  editingId = null;
  if ($("#yuShortTitle")) $("#yuShortTitle").value = "";
  if ($("#yuShortCaption")) $("#yuShortCaption").value = "";
  if ($("#yuShortVideoUrl")) $("#yuShortVideoUrl").value = "";
  if ($("#yuShortPosterUrl")) $("#yuShortPosterUrl").value = "";
  if ($("#yuShortOrder")) $("#yuShortOrder").value = String(shorts.length + 1);
  if ($("#yuShortVisible")) $("#yuShortVisible").checked = true;
  progress("");
}

async function loadShorts() {
  const snap = await getDoc(doc(db, "siteSettings", "shortVideos"));
  shorts = snap.exists() && Array.isArray(snap.data()?.items)
    ? snap.data().items.map((item,index) => ({ ...item, id:item.id || `short-${index + 1}` }))
    : [];
  shorts.sort((a,b) => Number(a.order || 999) - Number(b.order || 999));
  renderShorts();
}

async function persistShorts() {
  if (!currentUser) throw new Error("請先登入管理員");
  shorts.sort((a,b) => Number(a.order || 999) - Number(b.order || 999));
  await setDoc(doc(db, "siteSettings", "shortVideos"), {
    items:shorts,
    updatedAt:serverTimestamp(),
    updatedBy:currentUser.uid
  }, { merge:true });
}

function editShort(id) {
  const item = shorts.find((entry) => entry.id === id);
  if (!item) return;
  editingId = id;
  $("#yuShortTitle").value = item.title || "";
  $("#yuShortCaption").value = item.caption || "";
  $("#yuShortVideoUrl").value = item.url || "";
  $("#yuShortPosterUrl").value = item.poster || "";
  $("#yuShortOrder").value = String(Number(item.order || 1));
  $("#yuShortVisible").checked = item.visible !== false;
  progress("正在編輯這支短影音");
}

async function saveShort() {
  const title = $("#yuShortTitle")?.value.trim() || "";
  const caption = $("#yuShortCaption")?.value.trim() || "";
  const url = $("#yuShortVideoUrl")?.value.trim() || "";
  const poster = $("#yuShortPosterUrl")?.value.trim() || autoPoster(url);
  if (!title) throw new Error("請輸入短影音標題");
  if (!url) throw new Error("請先上傳影片或填入影片網址");
  const id = editingId || `short-${Date.now()}`;
  const next = { id, title, caption, url, poster, order:Number($("#yuShortOrder")?.value || shorts.length + 1), visible:$("#yuShortVisible")?.checked !== false };
  const index = shorts.findIndex((entry) => entry.id === id);
  if (index >= 0) shorts[index] = next; else shorts.push(next);
  await persistShorts();
  await loadShorts();
  resetForm();
  toast("短影音已儲存");
}

async function removeShort(id) {
  if (!confirm("確定刪除這支短影音？")) return;
  shorts = shorts.filter((entry) => entry.id !== id);
  await persistShorts();
  await loadShorts();
  if (editingId === id) resetForm();
}

async function toggleShort(id) {
  const item = shorts.find((entry) => entry.id === id);
  if (!item) return;
  item.visible = item.visible === false;
  await persistShorts();
  await loadShorts();
}

async function moveShort(id, direction) {
  const ordered = [...shorts].sort((a,b) => Number(a.order || 999) - Number(b.order || 999));
  const index = ordered.findIndex((entry) => entry.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length) return;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  ordered.forEach((entry,i) => { entry.order = i + 1; });
  shorts = ordered;
  await persistShorts();
  await loadShorts();
}

function renderShorts() {
  const list = $("#yuShortList");
  if (!list) return;
  if (!shorts.length) {
    list.innerHTML = '<div class="glass-card rounded-2xl p-8 text-center text-slate-500 text-xs">目前還沒有短影音，左邊選影片上傳後即可建立。</div>';
    return;
  }
  list.innerHTML = shorts.map((item) => `
    <article class="glass-card rounded-2xl p-4 flex gap-4 items-start">
      <div class="w-20 aspect-[9/16] bg-slate-950 rounded-xl overflow-hidden shrink-0">${item.poster ? `<img src="${esc(item.poster)}" class="w-full h-full object-cover" alt="">` : '<div class="w-full h-full grid place-items-center text-slate-600">▶</div>'}</div>
      <div class="min-w-0 flex-1"><div class="flex justify-between gap-3"><div><strong class="block text-white">${esc(item.title || "未命名")}</strong><span class="text-[11px] text-slate-500">排序 ${Number(item.order || 0)}｜${item.visible === false ? "已隱藏" : "前台顯示"}</span></div><span class="text-[10px] ${item.visible === false ? "text-rose-400" : "text-emerald-400"}">${item.visible === false ? "隱藏" : "顯示"}</span></div><p class="text-xs text-slate-400 mt-2 line-clamp-2">${esc(item.caption || "")}</p>
      <div class="flex flex-wrap gap-2 mt-3"><button data-yu-short-edit="${esc(item.id)}" class="bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-[11px]">編輯</button><button data-yu-short-toggle="${esc(item.id)}" class="bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-[11px]">${item.visible === false ? "顯示" : "隱藏"}</button><button data-yu-short-up="${esc(item.id)}" class="bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-[11px]">↑</button><button data-yu-short-down="${esc(item.id)}" class="bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-[11px]">↓</button><button data-yu-short-delete="${esc(item.id)}" class="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-3 py-2 rounded-lg text-[11px]">刪除</button></div></div>
    </article>`).join("");
  $$('[data-yu-short-edit]').forEach((button) => button.addEventListener("click", () => editShort(button.dataset.yuShortEdit)));
  $$('[data-yu-short-toggle]').forEach((button) => button.addEventListener("click", () => toggleShort(button.dataset.yuShortToggle).catch((error) => alert(error?.message || "更新失敗"))));
  $$('[data-yu-short-up]').forEach((button) => button.addEventListener("click", () => moveShort(button.dataset.yuShortUp,-1).catch((error) => alert(error?.message || "排序失敗"))));
  $$('[data-yu-short-down]').forEach((button) => button.addEventListener("click", () => moveShort(button.dataset.yuShortDown,1).catch((error) => alert(error?.message || "排序失敗"))));
  $$('[data-yu-short-delete]').forEach((button) => button.addEventListener("click", () => removeShort(button.dataset.yuShortDelete).catch((error) => alert(error?.message || "刪除失敗"))));
}

async function uploadVideo(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    progress(`影片上傳中：${file.name}…`);
    const result = await uploadCloudinary(file, "video", "shops/xiaoyu/short-videos");
    $("#yuShortVideoUrl").value = result.secure_url || "";
    if (!$("#yuShortPosterUrl").value) $("#yuShortPosterUrl").value = autoPoster(result.secure_url || "");
    progress("影片上傳完成 ✓");
  } catch (error) {
    progress(error?.message || "影片上傳失敗");
  }
}

async function uploadPoster(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    progress(`封面上傳中：${file.name}…`);
    const result = await uploadCloudinary(file, "image", "shops/xiaoyu/short-videos/posters");
    $("#yuShortPosterUrl").value = result.secure_url || "";
    progress("封面上傳完成 ✓");
  } catch (error) {
    progress(error?.message || "封面上傳失敗");
  }
}

function injectUi() {
  if ($("#xiaoyuShortsTab")) return;
  const appRoot = $("#adminApp");
  const nav = appRoot?.querySelector("nav");
  if (!appRoot || !nav) return;
  const tab = document.createElement("button");
  tab.id = "xiaoyuShortsTab";
  tab.type = "button";
  tab.className = "bg-slate-900 border border-slate-800 text-violet-300 font-bold rounded-xl p-3 text-xs";
  tab.innerHTML = '<i class="fa-solid fa-circle-play mr-1"></i>短影音管理';
  nav.appendChild(tab);
  const section = document.createElement("section");
  section.id = "admin-section-yu-shorts";
  section.className = "hidden space-y-4";
  section.innerHTML = `
    <div class="flex flex-wrap items-end justify-between gap-3"><div><p class="text-xs text-violet-400 font-bold">YU SHORT VIDEOS</p><h2 class="text-xl font-black">短影音管理</h2><p class="text-xs text-slate-500 mt-1">跟傑瑞後台一樣，可直接上傳影片與封面、排序及控制前台顯示。</p></div><button id="yuShortNewBtn" type="button" class="bg-violet-500 text-white font-black px-4 py-2 rounded-xl text-xs">新增短影音</button></div>
    <div class="grid lg:grid-cols-[360px_1fr] gap-4"><div class="glass-card rounded-2xl p-4 space-y-3">
      <input id="yuShortTitle" placeholder="標題，例如：大偉士交車實拍" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs"><textarea id="yuShortCaption" rows="2" placeholder="短說明" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs"></textarea>
      <input id="yuShortVideoFile" type="file" accept="video/mp4,video/quicktime,video/webm,video/*" class="hidden"><button id="yuShortVideoUploadBtn" type="button" class="w-full bg-slate-800 border border-violet-500/30 text-violet-300 rounded-xl p-3 text-xs font-bold"><i class="fa-solid fa-upload mr-1"></i>上傳影片</button><input id="yuShortVideoUrl" placeholder="影片網址（上傳完成自動填入）" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-[11px]">
      <input id="yuShortPosterFile" type="file" accept="image/*" class="hidden"><button id="yuShortPosterUploadBtn" type="button" class="w-full bg-slate-800 border border-sky-500/30 text-sky-300 rounded-xl p-3 text-xs font-bold"><i class="fa-solid fa-image mr-1"></i>上傳封面</button><input id="yuShortPosterUrl" placeholder="未上傳時會嘗試自動抓影片首幀" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-[11px]">
      <div class="grid grid-cols-2 gap-3"><label><span class="font-bold text-xs block mb-1">排序</span><input id="yuShortOrder" type="number" value="1" min="1" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs"></label><label class="flex items-center gap-2 pt-5"><input id="yuShortVisible" type="checkbox" checked class="accent-violet-500"><span class="font-bold text-xs">前台顯示</span></label></div><p id="yuShortUploadProgress" class="text-[11px] text-slate-400 min-h-4"></p><button id="yuShortSaveBtn" type="button" class="w-full bg-violet-500 text-white font-black rounded-xl py-3 text-xs">儲存短影音</button>
    </div><div id="yuShortList" class="space-y-3"></div></div>`;
  appRoot.appendChild(section);
  tab.addEventListener("click", () => {
    $("#admin-section-orders")?.classList.add("hidden");
    $("#admin-section-products")?.classList.add("hidden");
    section.classList.remove("hidden");
    tab.className = "bg-violet-500 text-white font-black rounded-xl p-3 text-xs";
    loadShorts().catch((error) => progress(error?.message || "短影音讀取失敗"));
  });
  $$(".admin-tab").forEach((button) => button.addEventListener("click", () => { section.classList.add("hidden"); tab.className = "bg-slate-900 border border-slate-800 text-violet-300 font-bold rounded-xl p-3 text-xs"; }));
  $("#yuShortNewBtn")?.addEventListener("click", resetForm);
  $("#yuShortVideoUploadBtn")?.addEventListener("click", () => $("#yuShortVideoFile")?.click());
  $("#yuShortPosterUploadBtn")?.addEventListener("click", () => $("#yuShortPosterFile")?.click());
  $("#yuShortVideoFile")?.addEventListener("change", uploadVideo);
  $("#yuShortPosterFile")?.addEventListener("change", uploadPoster);
  $("#yuShortSaveBtn")?.addEventListener("click", () => saveShort().catch((error) => { progress(error?.message || "儲存失敗"); alert(error?.message || "儲存失敗"); }));
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    const context = await resolveShopContext(db, user);
    if (!context?.legacy || context.shopId !== "xiaoyu") return;
    if (!['platformOwner','owner','admin'].includes(context.role || '')) return;
    currentUser = user;
    injectUi();
  } catch (error) {
    console.warn("Xiaoyu media admin unavailable.", error);
  }
});
