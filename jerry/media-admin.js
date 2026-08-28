import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const SHOP_ID = "jerry";
const CLOUD_NAME = "k6e9e4bl";
const UPLOAD_PRESET = "jerry_products_unsigned";
const app = getApps().length ? getApp() : initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG || {});
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>'\"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':"&quot;"}[c]));

let currentUser = null;
let currentProductId = null;
let currentProductName = "";
let shorts = [];
let editingShortId = null;

function toast(message) {
  const el = $("#toastMsg"), wrap = $("#toast");
  if (!el || !wrap) return alert(message);
  el.textContent = message;
  wrap.classList.remove("translate-y-20", "opacity-0");
  setTimeout(() => wrap.classList.add("translate-y-20", "opacity-0"), 2600);
}

async function uploadCloudinary(file, resourceType, folder) {
  if (!file) throw new Error("請先選擇檔案");
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", UPLOAD_PRESET);
  form.append("folder", folder);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
    method:"POST",
    body:form
  });
  let result = {};
  try { result = await response.json(); } catch (_) {}
  if (!response.ok || !result.secure_url) {
    throw new Error(result?.error?.message || `${resourceType === "video" ? "影片" : "圖片"}上傳失敗`);
  }
  return result;
}

function productProgress(text) {
  const el = $("#uploadProgressText");
  if (el) el.textContent = text;
}

async function uploadProductPhotos(files) {
  if (!currentUser) throw new Error("請先登入管理員");
  if (!currentProductId) throw new Error("請先從車款列表按「管理照片」");
  const selected = [...files].filter((f) => f?.type?.startsWith("image/"));
  if (!selected.length) throw new Error("請選擇圖片檔");

  const ref = doc(db, "shops", SHOP_ID, "products", currentProductId);
  const snap = await getDoc(ref);
  const data = snap.exists() ? (snap.data() || {}) : {};
  const images = Array.isArray(data.images) ? data.images.map((x) => typeof x === "string" ? {url:x} : x).filter((x) => x?.url) : [];

  for (let i = 0; i < selected.length; i += 1) {
    productProgress(`上傳照片 ${i + 1}/${selected.length}…`);
    const result = await uploadCloudinary(selected[i], "image", `shops/${SHOP_ID}/products/${currentProductId}`);
    images.push({
      url:result.secure_url,
      publicId:result.public_id || "",
      provider:"cloudinary",
      isPrimary:images.length === 0
    });
  }

  await setDoc(ref, {
    ...(snap.exists() ? {} : {name:currentProductName || "傑瑞車款", approvedForJerry:true, visible:true}),
    shopId:SHOP_ID,
    approvedForJerry:true,
    images,
    updatedAt:serverTimestamp(),
    updatedBy:currentUser.uid
  }, {merge:true});

  productProgress("上傳完成 ✓");
  toast(`已上傳 ${selected.length} 張商品照`);
  setTimeout(() => location.reload(), 700);
}

function installProductUploadOverride() {
  document.addEventListener("click", (event) => {
    const manage = event.target.closest?.(".jerry-manage[data-product-id], .edit-product[data-product-id]");
    if (manage) {
      currentProductId = manage.dataset.productId || null;
      const row = manage.closest("tr");
      currentProductName = row?.children?.[1]?.textContent?.trim() || "";
    }

    const choose = event.target.closest?.("#chooseImagesBtn");
    if (choose) {
      const input = $("#imageFileInput");
      if (!input) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      input.click();
    }
  }, true);

  document.addEventListener("change", async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.id !== "imageFileInput") return;
    event.stopImmediatePropagation();
    const files = [...(input.files || [])];
    input.value = "";
    if (!files.length) return;
    try {
      await uploadProductPhotos(files);
    } catch (error) {
      console.error("Jerry product photo upload", error);
      productProgress(error?.message || "照片上傳失敗");
      alert(error?.message || "照片上傳失敗");
    }
  }, true);
}

function autoPoster(videoUrl) {
  const url = String(videoUrl || "");
  if (!url.includes("res.cloudinary.com") || !url.includes("/video/upload/")) return "";
  return url.replace("/video/upload/", "/video/upload/so_0,f_jpg/").replace(/\.(mp4|mov|webm)(\?.*)?$/i, ".jpg$2");
}

function injectShortsUI() {
  if ($("#jerryShortsTab")) return;
  const adminApp = $("#adminApp");
  const nav = adminApp?.querySelector("nav");
  if (!adminApp || !nav) return;

  const tab = document.createElement("button");
  tab.id = "jerryShortsTab";
  tab.type = "button";
  tab.className = "bg-slate-900 border border-slate-800 text-violet-300 font-bold rounded-xl p-3 text-xs";
  tab.innerHTML = '<i class="fa-solid fa-circle-play mr-1"></i>短影音管理';
  nav.appendChild(tab);

  const section = document.createElement("section");
  section.id = "admin-section-shorts";
  section.className = "hidden space-y-4";
  section.innerHTML = `
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div><p class="text-xs text-violet-400 font-bold">JERRY SHORT VIDEOS</p><h2 class="text-xl font-black">短影音管理</h2><p class="text-xs text-slate-500 mt-1">影片與封面直接上傳 Cloudinary，不使用 Firebase Storage。</p></div>
      <button id="shortNewBtn" type="button" class="bg-violet-500 text-white font-black px-4 py-2 rounded-xl text-xs">新增短影音</button>
    </div>
    <div class="grid lg:grid-cols-[360px_1fr] gap-4">
      <div class="glass-card rounded-2xl p-4 space-y-3">
        <input id="shortTitle" placeholder="標題，例如：Z3 改裝實拍" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs">
        <textarea id="shortCaption" rows="2" placeholder="短說明" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs"></textarea>
        <div class="space-y-2">
          <label class="font-bold text-xs">影片</label>
          <input id="shortVideoFile" type="file" accept="video/mp4,video/quicktime,video/webm,video/*" class="hidden">
          <button id="shortVideoUploadBtn" type="button" class="w-full bg-slate-800 border border-violet-500/30 text-violet-300 rounded-xl p-3 text-xs font-bold"><i class="fa-solid fa-upload mr-1"></i>從手機／電腦上傳影片</button>
          <input id="shortVideoUrl" placeholder="影片網址（上傳完成會自動填入）" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-[11px]">
        </div>
        <div class="space-y-2">
          <label class="font-bold text-xs">封面（可選）</label>
          <input id="shortPosterFile" type="file" accept="image/*" class="hidden">
          <button id="shortPosterUploadBtn" type="button" class="w-full bg-slate-800 border border-sky-500/30 text-sky-300 rounded-xl p-3 text-xs font-bold"><i class="fa-solid fa-image mr-1"></i>上傳封面圖片</button>
          <input id="shortPosterUrl" placeholder="沒上傳封面會自動抓影片第一秒" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-[11px]">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label><span class="font-bold text-xs block mb-1">排序</span><input id="shortOrder" type="number" value="1" min="1" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs"></label>
          <label class="flex items-center gap-2 pt-5"><input id="shortVisible" type="checkbox" checked class="accent-violet-500"><span class="font-bold text-xs">前台顯示</span></label>
        </div>
        <p id="shortUploadProgress" class="text-[11px] text-slate-400 min-h-4"></p>
        <button id="shortSaveBtn" type="button" class="w-full bg-violet-500 text-white font-black rounded-xl py-3 text-xs">儲存短影音</button>
      </div>
      <div id="shortList" class="space-y-3"></div>
    </div>`;
  adminApp.appendChild(section);

  tab.addEventListener("click", () => {
    $("#admin-section-orders")?.classList.add("hidden");
    $("#admin-section-products")?.classList.add("hidden");
    section.classList.remove("hidden");
    tab.className = "bg-violet-500 text-white font-black rounded-xl p-3 text-xs";
    loadShorts();
  });

  $$(".admin-tab").forEach((button) => button.addEventListener("click", () => {
    section.classList.add("hidden");
    tab.className = "bg-slate-900 border border-slate-800 text-violet-300 font-bold rounded-xl p-3 text-xs";
  }));

  $("#shortNewBtn")?.addEventListener("click", resetShortForm);
  $("#shortVideoUploadBtn")?.addEventListener("click", () => $("#shortVideoFile")?.click());
  $("#shortPosterUploadBtn")?.addEventListener("click", () => $("#shortPosterFile")?.click());
  $("#shortVideoFile")?.addEventListener("change", uploadShortVideoFile);
  $("#shortPosterFile")?.addEventListener("change", uploadShortPosterFile);
  $("#shortSaveBtn")?.addEventListener("click", saveShortFromForm);
}

function shortProgress(text) {
  const el = $("#shortUploadProgress");
  if (el) el.textContent = text;
}

async function uploadShortVideoFile(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    if (!currentUser) throw new Error("請先登入管理員");
    shortProgress(`影片上傳中：${file.name}…`);
    const result = await uploadCloudinary(file, "video", `shops/${SHOP_ID}/short-videos`);
    const url = result.secure_url || "";
    $("#shortVideoUrl").value = url;
    if (!$("#shortPosterUrl").value) $("#shortPosterUrl").value = autoPoster(url);
    shortProgress("影片上傳完成 ✓");
  } catch (error) {
    console.error("Jerry short video upload", error);
    shortProgress(error?.message || "影片上傳失敗");
    alert(error?.message || "影片上傳失敗");
  }
}

async function uploadShortPosterFile(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    if (!currentUser) throw new Error("請先登入管理員");
    shortProgress(`封面上傳中：${file.name}…`);
    const result = await uploadCloudinary(file, "image", `shops/${SHOP_ID}/short-videos/posters`);
    $("#shortPosterUrl").value = result.secure_url || "";
    shortProgress("封面上傳完成 ✓");
  } catch (error) {
    console.error("Jerry short poster upload", error);
    shortProgress(error?.message || "封面上傳失敗");
    alert(error?.message || "封面上傳失敗");
  }
}

async function loadShorts() {
  try {
    const snap = await getDoc(doc(db, "shops", SHOP_ID, "siteSettings", "shortVideos"));
    shorts = snap.exists() && Array.isArray(snap.data()?.items) ? snap.data().items.map((x, i) => ({...x, id:x.id || `short-${i+1}`})) : [];
    shorts.sort((a,b) => Number(a.order || 999) - Number(b.order || 999));
    renderShorts();
  } catch (error) {
    console.error("Load Jerry shorts", error);
    shortProgress(error?.message || "短影音讀取失敗");
  }
}

async function persistShorts() {
  if (!currentUser) throw new Error("請先登入管理員");
  shorts.sort((a,b) => Number(a.order || 999) - Number(b.order || 999));
  await setDoc(doc(db, "shops", SHOP_ID, "siteSettings", "shortVideos"), {
    items:shorts,
    updatedAt:serverTimestamp(),
    updatedBy:currentUser.uid
  }, {merge:true});
}

function renderShorts() {
  const list = $("#shortList");
  if (!list) return;
  if (!shorts.length) {
    list.innerHTML = '<div class="glass-card rounded-2xl p-8 text-center text-slate-500 text-xs">目前還沒有短影音，左邊直接選影片上傳即可。</div>';
    return;
  }
  list.innerHTML = shorts.map((item, index) => `
    <article class="glass-card rounded-2xl p-4 flex gap-4 items-start">
      <div class="w-20 aspect-[9/16] bg-slate-950 rounded-xl overflow-hidden shrink-0">${item.poster ? `<img src="${esc(item.poster)}" class="w-full h-full object-cover">` : '<div class="w-full h-full grid place-items-center text-slate-600 text-xl">▶</div>'}</div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap justify-between gap-2"><div><strong class="text-white block">${esc(item.title || "未命名短影音")}</strong><span class="text-[10px] ${item.visible === false ? "text-rose-400" : "text-emerald-400"}">${item.visible === false ? "已隱藏" : "前台顯示"}｜排序 ${Number(item.order || index + 1)}</span></div></div>
        <p class="text-[11px] text-slate-400 mt-2 line-clamp-2">${esc(item.caption || "")}</p>
        <div class="flex flex-wrap gap-2 mt-3">
          <button class="short-edit bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[10px]" data-id="${esc(item.id)}">編輯</button>
          <button class="short-up bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[10px]" data-index="${index}">上移</button>
          <button class="short-down bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[10px]" data-index="${index}">下移</button>
          <button class="short-toggle bg-sky-950 border border-sky-700 text-sky-300 rounded-lg px-3 py-2 text-[10px]" data-id="${esc(item.id)}">${item.visible === false ? "顯示" : "隱藏"}</button>
          <button class="short-delete bg-rose-950 border border-rose-800 text-rose-300 rounded-lg px-3 py-2 text-[10px]" data-id="${esc(item.id)}">刪除</button>
        </div>
      </div>
    </article>`).join("");

  $$(".short-edit").forEach((b) => b.addEventListener("click", () => editShort(b.dataset.id)));
  $$(".short-toggle").forEach((b) => b.addEventListener("click", () => toggleShort(b.dataset.id)));
  $$(".short-delete").forEach((b) => b.addEventListener("click", () => deleteShort(b.dataset.id)));
  $$(".short-up").forEach((b) => b.addEventListener("click", () => moveShort(Number(b.dataset.index), -1)));
  $$(".short-down").forEach((b) => b.addEventListener("click", () => moveShort(Number(b.dataset.index), 1)));
}

function resetShortForm() {
  editingShortId = null;
  if ($("#shortTitle")) $("#shortTitle").value = "";
  if ($("#shortCaption")) $("#shortCaption").value = "";
  if ($("#shortVideoUrl")) $("#shortVideoUrl").value = "";
  if ($("#shortPosterUrl")) $("#shortPosterUrl").value = "";
  if ($("#shortOrder")) $("#shortOrder").value = String(shorts.length + 1);
  if ($("#shortVisible")) $("#shortVisible").checked = true;
  shortProgress("");
}

function editShort(id) {
  const item = shorts.find((x) => x.id === id);
  if (!item) return;
  editingShortId = id;
  $("#shortTitle").value = item.title || "";
  $("#shortCaption").value = item.caption || "";
  $("#shortVideoUrl").value = item.url || item.videoUrl || "";
  $("#shortPosterUrl").value = item.poster || item.posterUrl || "";
  $("#shortOrder").value = String(item.order || 1);
  $("#shortVisible").checked = item.visible !== false;
  shortProgress("編輯中");
  $("#shortTitle")?.scrollIntoView({behavior:"smooth", block:"center"});
}

async function saveShortFromForm() {
  try {
    const title = $("#shortTitle")?.value.trim() || "";
    const url = $("#shortVideoUrl")?.value.trim() || "";
    if (!title) throw new Error("請輸入短影音標題");
    if (!url) throw new Error("請先上傳影片或填入影片網址");
    const item = {
      id:editingShortId || `short-${Date.now()}`,
      title,
      caption:$("#shortCaption")?.value.trim() || "",
      url,
      videoUrl:url,
      poster:$("#shortPosterUrl")?.value.trim() || autoPoster(url),
      order:Math.max(1, Number($("#shortOrder")?.value) || shorts.length + 1),
      visible:Boolean($("#shortVisible")?.checked)
    };
    const index = shorts.findIndex((x) => x.id === item.id);
    if (index >= 0) shorts[index] = item; else shorts.push(item);
    await persistShorts();
    renderShorts();
    resetShortForm();
    toast("短影音已儲存");
  } catch (error) {
    console.error(error);
    shortProgress(error?.message || "儲存失敗");
    alert(error?.message || "儲存失敗");
  }
}

async function toggleShort(id) {
  const item = shorts.find((x) => x.id === id);
  if (!item) return;
  item.visible = item.visible === false;
  await persistShorts();
  renderShorts();
}

async function deleteShort(id) {
  const item = shorts.find((x) => x.id === id);
  if (!item || !confirm(`確定刪除「${item.title || "這支短影音"}」？`)) return;
  shorts = shorts.filter((x) => x.id !== id);
  shorts.forEach((x, i) => x.order = i + 1);
  await persistShorts();
  renderShorts();
  if (editingShortId === id) resetShortForm();
}

async function moveShort(index, delta) {
  const next = index + delta;
  if (index < 0 || next < 0 || index >= shorts.length || next >= shorts.length) return;
  [shorts[index], shorts[next]] = [shorts[next], shorts[index]];
  shorts.forEach((x, i) => x.order = i + 1);
  await persistShorts();
  renderShorts();
}

function init() {
  installProductUploadOverride();
  injectShortsUI();
  onAuthStateChanged(auth, (user) => {
    currentUser = user || null;
    if (user) loadShorts();
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
else init();
