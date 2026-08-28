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

const OFFICIAL_IDS = [
  ["大偉士", "jerry-vespa-big"],
  ["z3", "jerry-z3"],
  ["天鵝座", "jerry-z3"],
  ["正 9 號", "jerry-nine"],
  ["正9號", "jerry-nine"],
  ["小偉士", "jerry-vespa-small"],
  ["極酷", "jerry-cool"]
];

let lastProductId = "";
let lastProductName = "";

function resolveFromModal() {
  const title = String($("#editModalProductTitle")?.textContent || "").trim();
  if (!title) return null;
  const name = title.split("｜")[0].trim();
  const lowered = name.toLowerCase();
  const found = OFFICIAL_IDS.find(([needle]) => lowered.includes(needle.toLowerCase()));
  return found ? { id:found[1], name } : null;
}

function currentContext() {
  if (lastProductId) return { id:lastProductId, name:lastProductName || "傑瑞車款" };
  return resolveFromModal();
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

async function uploadFiles(files) {
  const user = auth.currentUser;
  if (!user) throw new Error("請先登入管理員");
  const ctx = currentContext();
  if (!ctx?.id) throw new Error("無法判斷目前車款，請關閉照片視窗後重新按一次「管理照片」");
  const selected = [...files].filter((f) => f?.type?.startsWith("image/"));
  if (!selected.length) throw new Error("請選擇圖片檔");

  const progress = $("#uploadProgressText");
  const ref = doc(db, "shops", SHOP_ID, "products", ctx.id);
  const snap = await getDoc(ref);
  const data = snap.exists() ? (snap.data() || {}) : {};
  const images = Array.isArray(data.images)
    ? data.images.map((x) => typeof x === "string" ? {url:x} : x).filter((x) => x?.url)
    : [];

  for (let i = 0; i < selected.length; i += 1) {
    if (progress) progress.textContent = `上傳 ${i + 1}/${selected.length}…`;
    const item = await uploadImage(selected[i], ctx.id);
    images.push({ ...item, isPrimary:images.length === 0 });
  }

  await setDoc(ref, {
    ...(snap.exists() ? {} : { name:ctx.name, visible:true }),
    shopId:SHOP_ID,
    approvedForJerry:true,
    images,
    updatedAt:serverTimestamp(),
    updatedBy:user.uid
  }, { merge:true });

  if (progress) progress.textContent = "上傳完成 ✓";
  alert(`已上傳 ${selected.length} 張商品照`);
  location.reload();
}

document.addEventListener("click", (event) => {
  const manage = event.target.closest?.(".jerry-manage[data-product-id], .edit-product[data-product-id]");
  if (manage) {
    lastProductId = manage.dataset.productId || "";
    lastProductName = manage.closest("tr")?.children?.[1]?.textContent?.trim() || "";
    return;
  }

  const choose = event.target.closest?.("#chooseImagesBtn");
  if (!choose) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const inferred = resolveFromModal();
  if (!lastProductId && inferred) {
    lastProductId = inferred.id;
    lastProductName = inferred.name;
  }
  $("#imageFileInput")?.click();
}, true);

document.addEventListener("change", async (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.id !== "imageFileInput") return;
  event.stopImmediatePropagation();
  const files = [...(input.files || [])];
  input.value = "";
  if (!files.length) return;
  try {
    await uploadFiles(files);
  } catch (error) {
    console.error("Jerry forced product photo upload", error);
    const progress = $("#uploadProgressText");
    if (progress) progress.textContent = error?.message || "照片上傳失敗";
    alert(error?.message || "照片上傳失敗");
  }
}, true);
