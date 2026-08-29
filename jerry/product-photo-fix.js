import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const SHOP_ID = "jerry";
const CLOUD_NAME = "k6e9e4bl";
const UPLOAD_PRESET = "jerry_products_unsigned";
const app = getApps().length ? getApp() : initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG || {});
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

const OFFICIAL_IDS = [
  ["大偉士", "jerry-vespa-big"],
  ["z3", "jerry-z3"],
  ["天鵝座", "jerry-z3"],
  ["正 9 號", "jerry-nine"],
  ["正9號", "jerry-nine"],
  ["小偉士", "jerry-vespa-small"],
  ["極酷", "jerry-cool"]
];

let currentProductId = "";
let currentProductName = "";
let replaceIndex = null;
let busy = false;

const normalizeImages = (value) => (Array.isArray(value) ? value : [])
  .map((item) => typeof item === "string" ? { url:item } : { ...(item || {}) })
  .filter((item) => item?.url);

function progress(text) {
  const el = $("#uploadProgressText");
  if (el) el.textContent = text || "";
}

function resolveFromModal() {
  const title = String($("#editModalProductTitle")?.textContent || "").trim();
  if (!title) return null;
  const name = title.split("｜")[0].trim();
  const lowered = name.toLowerCase();
  const found = OFFICIAL_IDS.find(([needle]) => lowered.includes(needle.toLowerCase()));
  return found ? { id:found[1], name } : null;
}

function ensureContext() {
  if (currentProductId) return { id:currentProductId, name:currentProductName || "傑瑞車款" };
  const inferred = resolveFromModal();
  if (inferred) {
    currentProductId = inferred.id;
    currentProductName = inferred.name;
  }
  return inferred;
}

function ensureOnePrimary(images) {
  if (!images.length) return images;
  const firstPrimary = images.findIndex((img) => img.isPrimary === true);
  return images.map((img, index) => ({ ...img, isPrimary:index === (firstPrimary >= 0 ? firstPrimary : 0) }));
}

async function readProduct() {
  const user = auth.currentUser;
  if (!user) throw new Error("請先登入管理員");
  const ctx = ensureContext();
  if (!ctx?.id) throw new Error("無法判斷目前車款，請關閉視窗後重新按一次「管理照片」");
  const ref = doc(db, "shops", SHOP_ID, "products", ctx.id);
  const snap = await getDoc(ref);
  const data = snap.exists() ? (snap.data() || {}) : {};
  return { user, ctx, ref, snap, data, images:ensureOnePrimary(normalizeImages(data.images)) };
}

async function saveImages(images) {
  const { user, ctx, ref, snap } = await readProduct();
  const clean = ensureOnePrimary(normalizeImages(images));
  await setDoc(ref, {
    ...(snap.exists() ? {} : { name:ctx.name, visible:true }),
    shopId:SHOP_ID,
    approvedForJerry:true,
    images:clean,
    updatedAt:serverTimestamp(),
    updatedBy:user.uid
  }, { merge:true });
  renderGallery(clean);
  updateCount(clean.length);
  document.dispatchEvent(new CustomEvent("jerry-product-images-updated", {
    detail:{ productId:ctx.id, images:clean }
  }));
  return clean;
}

async function uploadImage(file, productId) {
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", UPLOAD_PRESET);
  form.append("folder", `shops/${SHOP_ID}/products/${productId}`);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method:"POST", body:form });
  let result = {};
  try { result = await response.json(); } catch (_) {}
  if (!response.ok || !result.secure_url) throw new Error(result?.error?.message || "圖片上傳失敗");
  return { url:result.secure_url, publicId:result.public_id || "", provider:"cloudinary" };
}

function updateCount(count) {
  const button = document.querySelector(`.jerry-manage[data-product-id="${CSS.escape(currentProductId)}"]`);
  const row = button?.closest("tr");
  if (row?.children?.[0]) row.children[0].textContent = `${count} 張`;
}

function renderGallery(images) {
  const grid = $("#productGalleryGrid");
  if (!grid) return;
  if (!images.length) {
    grid.innerHTML = '<div class="col-span-full text-slate-500 text-center py-4">尚無車款照片，請直接從手機／電腦選圖上傳。</div>';
    return;
  }
  grid.innerHTML = images.map((img, i) => `
    <div class="relative rounded-xl overflow-hidden border ${img.isPrimary ? 'border-emerald-500' : 'border-slate-800'}" data-jerry-photo-card="${i}">
      <img src="${esc(img.url)}" class="w-full h-28 object-cover" alt="車款照片 ${i + 1}">
      <div class="absolute inset-x-0 bottom-0 bg-slate-950/90 p-1.5 flex flex-wrap gap-1 justify-center">
        ${img.isPrimary ? '<span class="text-[9px] text-emerald-400 px-1.5 py-1">主圖</span>' : `<button type="button" class="jerry-primary bg-emerald-500 text-slate-950 px-2 py-1 rounded text-[9px] font-bold" data-index="${i}">設主圖</button>`}
        <button type="button" class="jerry-replace bg-sky-500 text-white px-2 py-1 rounded text-[9px] font-bold" data-index="${i}">更換</button>
        <button type="button" class="jerry-delete bg-rose-500 text-white px-2 py-1 rounded text-[9px] font-bold" data-index="${i}">刪除</button>
      </div>
    </div>`).join("");
}

async function refreshGallery() {
  if (!currentProductId) return;
  try {
    const { images } = await readProduct();
    renderGallery(images);
    updateCount(images.length);
  } catch (error) {
    console.error("Jerry product photo refresh", error);
    progress(error?.message || "照片讀取失敗");
  }
}

async function uploadFiles(files) {
  if (busy) return;
  const selected = [...files].filter((file) => file?.type?.startsWith("image/"));
  if (!selected.length) throw new Error("請選擇圖片檔");
  busy = true;
  try {
    const { ctx, images:latest } = await readProduct();
    let images = [...latest];
    if (replaceIndex !== null) {
      const index = replaceIndex;
      const old = images[index];
      if (!old) throw new Error("找不到要更換的照片，請重新開啟照片管理");
      progress("更換照片上傳中…");
      const uploaded = await uploadImage(selected[0], ctx.id);
      images[index] = { ...uploaded, isPrimary:Boolean(old.isPrimary) };
      if (selected.length > 1) {
        for (let i = 1; i < selected.length; i += 1) {
          progress(`另外上傳 ${i}/${selected.length - 1}…`);
          images.push({ ...(await uploadImage(selected[i], ctx.id)), isPrimary:false });
        }
      }
    } else {
      for (let i = 0; i < selected.length; i += 1) {
        progress(`上傳 ${i + 1}/${selected.length}…`);
        const uploaded = await uploadImage(selected[i], ctx.id);
        images.push({ ...uploaded, isPrimary:images.length === 0 });
      }
    }
    await saveImages(images);
    progress(replaceIndex !== null ? "照片已更換 ✓" : "上傳完成 ✓");
  } finally {
    replaceIndex = null;
    busy = false;
  }
}

async function setPrimary(index) {
  if (busy) return;
  busy = true;
  try {
    progress("正在設定主圖…");
    const { images } = await readProduct();
    if (!images[index]) throw new Error("找不到這張照片，請重新開啟照片管理");
    const next = images.map((img, i) => ({ ...img, isPrimary:i === index }));
    await saveImages(next);
    progress("主圖已更新 ✓");
  } finally { busy = false; }
}

async function removeImage(index) {
  if (busy) return;
  if (!confirm("確定刪除這張照片？刪除後前台也會立即移除。")) return;
  busy = true;
  try {
    progress("正在刪除照片…");
    const { images } = await readProduct();
    if (!images[index]) throw new Error("找不到這張照片，請重新開啟照片管理");
    const wasPrimary = Boolean(images[index].isPrimary);
    images.splice(index, 1);
    if (images.length && (wasPrimary || !images.some((img) => img.isPrimary))) {
      images.forEach((img, i) => { img.isPrimary = i === 0; });
    }
    await saveImages(images);
    progress("照片已刪除 ✓");
  } finally { busy = false; }
}

document.addEventListener("click", (event) => {
  const manage = event.target.closest?.(".jerry-manage[data-product-id], .edit-product[data-product-id]");
  if (manage) {
    currentProductId = manage.dataset.productId || "";
    currentProductName = manage.closest("tr")?.children?.[1]?.textContent?.trim() || "";
    replaceIndex = null;
    setTimeout(refreshGallery, 80);
    return;
  }

  const choose = event.target.closest?.("#chooseImagesBtn");
  const primary = event.target.closest?.(".jerry-primary[data-index]");
  const replace = event.target.closest?.(".jerry-replace[data-index]");
  const remove = event.target.closest?.(".jerry-delete[data-index]");
  if (!choose && !primary && !replace && !remove) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const inferred = ensureContext();
  if (!inferred?.id && !currentProductId) {
    alert("無法判斷目前車款，請關閉視窗後重新按一次「管理照片」");
    return;
  }

  if (choose) {
    replaceIndex = null;
    $("#imageFileInput")?.click();
    return;
  }
  if (replace) {
    replaceIndex = Number(replace.dataset.index);
    $("#imageFileInput")?.click();
    return;
  }
  if (primary) {
    setPrimary(Number(primary.dataset.index)).catch(handleError);
    return;
  }
  if (remove) removeImage(Number(remove.dataset.index)).catch(handleError);
}, true);

document.addEventListener("change", async (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.id !== "imageFileInput") return;
  event.stopImmediatePropagation();
  const files = [...(input.files || [])];
  input.value = "";
  if (!files.length) {
    replaceIndex = null;
    return;
  }
  try {
    await uploadFiles(files);
  } catch (error) {
    handleError(error);
  }
}, true);

function handleError(error) {
  console.error("Jerry product photo manager", error);
  progress(error?.message || "照片操作失敗");
  alert(error?.message || "照片操作失敗");
  replaceIndex = null;
  busy = false;
}
