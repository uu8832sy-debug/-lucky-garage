import { getApps, getApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const SHOP_ID = "jerry";
const MAX_IMAGES = 4;
const MAX_DATA_URL_CHARS = 175000;
let currentProductId = null;

function $(selector) { return document.querySelector(selector); }
function setProgress(text) {
  const el = $("#uploadProgressText");
  if (el) el.textContent = text;
}

async function fileToCompressedDataUrl(file) {
  const bitmap = await createImageBitmap(file);
  let maxSide = 1200;
  let quality = 0.72;
  let dataUrl = "";

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha:false });
    ctx.drawImage(bitmap, 0, 0, width, height);
    dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= MAX_DATA_URL_CHARS) break;
    if (quality > 0.46) quality -= 0.08;
    else maxSide = Math.max(720, Math.round(maxSide * 0.82));
  }

  bitmap.close?.();
  if (!dataUrl || dataUrl.length > 260000) throw new Error("圖片仍然太大，請換一張較小的照片");
  return dataUrl;
}

async function saveFiles(files) {
  if (!currentProductId) throw new Error("請先從商品列表按「管理」再上傳照片");
  const app = getApps().length ? getApp() : null;
  if (!app) throw new Error("Firebase 尚未初始化");
  const db = getFirestore(app);
  const ref = doc(db, "shops", SHOP_ID, "products", currentProductId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("找不到這個商品");

  const product = snap.data() || {};
  const images = Array.isArray(product.images) ? [...product.images] : [];
  const remaining = Math.max(0, MAX_IMAGES - images.length);
  if (!remaining) throw new Error(`每台車最多 ${MAX_IMAGES} 張照片`);

  const selected = [...files].slice(0, remaining);
  for (let i = 0; i < selected.length; i += 1) {
    setProgress(`壓縮照片 ${i + 1}/${selected.length}…`);
    const url = await fileToCompressedDataUrl(selected[i]);
    images.push({
      url,
      storage:"firestore",
      isPrimary: images.length === 0,
      name: selected[i].name || `photo-${Date.now()}.jpg`
    });
  }

  setProgress("儲存中…");
  await setDoc(ref, {
    images,
    shopId:SHOP_ID,
    updatedAt:serverTimestamp()
  }, { merge:true });
  setProgress("完成，正在重新載入…");
  setTimeout(() => location.reload(), 500);
}

function install() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest?.(".edit-product[data-product-id]");
    if (button) currentProductId = button.dataset.productId || null;
  }, true);

  const oldInput = $("#imageFileInput");
  if (!oldInput) return;
  const freshInput = oldInput.cloneNode(true);
  oldInput.replaceWith(freshInput);
  freshInput.addEventListener("change", async (event) => {
    const files = event.target.files;
    if (!files?.length) return;
    try {
      await saveFiles(files);
    } catch (error) {
      console.error(error);
      setProgress(error?.message || "照片儲存失敗");
      alert(error?.message || "照片儲存失敗");
    } finally {
      event.target.value = "";
    }
  });

  const hint = $("#chooseImagesBtn")?.parentElement;
  if (hint && !hint.querySelector("[data-firestore-photo-hint]")) {
    const note = document.createElement("p");
    note.dataset.firestorePhotoHint = "1";
    note.className = "text-[10px] text-slate-500 leading-relaxed";
    note.textContent = "免費模式：照片會自動壓縮後存入 Firestore，每台最多 4 張，不需要 Firebase Storage。";
    hint.appendChild(note);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
else install();
