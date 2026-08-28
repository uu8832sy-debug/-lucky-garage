import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { collection, doc, getDocs, getFirestore, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const SHOP_ID = "jerry";
const CLOUDINARY_CLOUD_NAME = "k6e9e4bl";
const CLOUDINARY_UPLOAD_PRESET = "jerry_products_unsigned";
const app = getApps().length ? getApp() : initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG || {});
const auth = getAuth(app);
const db = getFirestore(app);

const CATALOG = [
  { key:"vespa-big", id:"jerry-vespa-big", name:"大偉士", aliases:["大偉士"], style:"一般版／特仕版", rows:[
    ["鉛酸電池","表定 40km",38000,43000],
    ["72V 30Ah 鋰電","表定 60km",53000,58000],
    ["72V 40Ah 鋰電","表定 80km",59000,64000],
    ["72V 50Ah 鋰電","表定 100km",64000,69000],
    ["72V 65Ah 鋰電","表定 130km",69000,74000],
    ["72V 80Ah 鋰電","表定 160km",75000,80000]
  ]},
  { key:"z3", id:"jerry-z3", name:"Z3 天鵝座", aliases:["z3天鵝座","z3","天鵝座"], style:"一般版／特仕版", rows:[
    ["鉛酸電池","表定 40km",43000,48000],
    ["72V 30Ah 鋰電","表定 60km",58000,63000],
    ["72V 40Ah 鋰電","表定 80km",64000,69000],
    ["72V 50Ah 鋰電","表定 100km",69000,74000],
    ["72V 65Ah 鋰電","表定 130km",74000,79000],
    ["72V 80Ah 鋰電","表定 160km",80000,85000]
  ]},
  { key:"nine", id:"jerry-nine", name:"正 9 號", aliases:["正9號","正九號"], style:"一般版／特仕版", rows:[
    ["鉛酸電池","表定 40km",45000,50000],
    ["72V 30Ah 鋰電","表定 60km",60000,65000],
    ["72V 40Ah 鋰電","表定 80km",66000,71000],
    ["72V 50Ah 鋰電","表定 100km",71000,76000],
    ["72V 65Ah 鋰電","表定 130km",76000,81000],
    ["72V 80Ah 鋰電","表定 160km",82000,87000]
  ]},
  { key:"vespa-small", id:"jerry-vespa-small", name:"小偉士", aliases:["小偉士"], style:"5 種電池規格", rows:[
    ["48V 20Ah 鉛酸","表定 40km",32000],
    ["60V 20Ah 鉛酸","表定 45km",33000],
    ["48V 20Ah 鋰電","表定 40km",43000],
    ["60V 30Ah 鋰電","表定 60km",49000],
    ["72V 30Ah 鋰電","表定 65km",52000]
  ]},
  { key:"cool", id:"jerry-cool", name:"極酷", aliases:["極酷"], style:"4 種電池規格", rows:[
    ["48V 12Ah 鉛酸","表定 20km",20000],
    ["48V 20Ah 鉛酸","表定 40km",23000],
    ["48V 20Ah 鋰電","表定 40km",29000],
    ["48V 30Ah 鋰電","表定 60km",33000]
  ]}
];

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const money = (n) => `NT$${Number(n || 0).toLocaleString("zh-TW")}`;
const esc = (v) => String(v ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const norm = (v) => String(v || "").toLowerCase().replace(/[\s\-＿_]/g, "");
const normalizeImages = (value) => (Array.isArray(value) ? value : []).map((item) => typeof item === "string" ? { url:item } : item).filter((item) => item?.url);

let currentUser = null;
let fixedProducts = [];
let editing = null;
let observerBusy = false;

function injectStyle() {
  if ($("#jerryFixedAdminStyle")) return;
  const style = document.createElement("style");
  style.id = "jerryFixedAdminStyle";
  style.textContent = `
    .jerry-official-detail td{padding:0 12px 14px!important;background:#07101c}
    .jerry-official-prices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;padding:10px;border:1px solid #24364e;border-radius:14px;background:#0a1321}
    .jerry-price-chip{padding:8px 9px;border-radius:10px;background:#101d30;border:1px solid #223650;font-size:10px;line-height:1.55;color:#a9bad0}
    .jerry-price-chip b{display:block;color:#fff;font-size:11px}.jerry-price-chip strong{color:#59e6b2}
    .jerry-fixed-note{margin:0 0 14px;padding:13px 15px;border-radius:14px;background:#0a1728;border:1px solid #284565;color:#c8d8eb;font-size:12px;line-height:1.65}
    .jerry-fixed-note b{color:#59e6b2}.jerry-fixed-price-table{width:100%;border-collapse:collapse;margin-top:9px}.jerry-fixed-price-table td{padding:6px;border-top:1px solid #24364e;font-size:11px}.jerry-fixed-price-table td:last-child{text-align:right;color:#fff;font-weight:800}
    @media(max-width:850px){.jerry-official-prices{grid-template-columns:1fr 1fr}}
    @media(max-width:560px){.jerry-official-prices{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function hideLegacyControls() {
  $("#newProductBtn")?.classList.add("hidden");
  $("#seedProductsBtn")?.classList.add("hidden");
  const title = $("#admin-section-products h2");
  if (title) title.textContent = "傑瑞 5 款正式車款・照片管理";
  const eyebrow = $("#admin-section-products .text-sky-400");
  if (eyebrow) eyebrow.textContent = "JERRY OFFICIAL PRODUCTS";
  const heads = $$("#admin-section-products thead th");
  const labels = ["圖庫","車款","正式規格","鉛酸售價","鋰電售價","前台","照片管理"];
  heads.forEach((th, i) => { if (labels[i]) th.textContent = labels[i]; });
}

function findBestSource(docs, model) {
  const exact = docs.find((item) => item.id === model.id);
  if (exact) return exact;
  const candidates = docs.filter((item) => {
    const name = norm(item.name || item.title || item.model || item.id);
    return model.aliases.some((alias) => name.includes(norm(alias)) || norm(alias).includes(name));
  });
  candidates.sort((a,b) => normalizeImages(b.images).length - normalizeImages(a.images).length);
  return candidates[0] || null;
}

function buildFixedProducts(docs) {
  return CATALOG.map((model, index) => {
    const source = findBestSource(docs, model);
    return {
      ...(source || {}),
      id: source?.id || model.id,
      modelKey:model.key,
      name:model.name,
      style:model.style,
      officialRows:model.rows,
      order:index + 1,
      images:normalizeImages(source?.images),
      visible:source?.visible !== false
    };
  });
}

function leadSummary(model) {
  const rows = model.rows.filter((row) => /鉛酸/.test(row[0]));
  if (!rows.length) return "—";
  if (rows[0].length >= 4) return `${money(rows[0][2])} / ${money(rows[0][3])}`;
  const values = rows.map((r) => r[2]);
  return values.length === 1 ? money(values[0]) : `${money(Math.min(...values))}～${money(Math.max(...values))}`;
}
function lithiumSummary(model) {
  const rows = model.rows.filter((row) => /鋰電/.test(row[0]));
  if (!rows.length) return "—";
  const values = rows.flatMap((r) => r.slice(2).filter((v) => Number.isFinite(Number(v))).map(Number));
  return `${rows.length} 規格｜${money(Math.min(...values))}～${money(Math.max(...values))}`;
}
function priceChips(model) {
  return model.rows.map((row) => `<div class="jerry-price-chip"><b>${esc(row[0])} <span>${esc(row[1])}</span></b>${row.length >= 4 ? `<strong>一般 ${money(row[2])}</strong>　特仕 ${money(row[3])}` : `<strong>${money(row[2])}</strong>`}</div>`).join("");
}

function renderFixedTable() {
  const tbody = $("#adminProductTableBody");
  if (!tbody || !fixedProducts.length) return;
  observerBusy = true;
  tbody.innerHTML = fixedProducts.map((p) => {
    const model = CATALOG.find((m) => m.key === p.modelKey);
    return `<tr class="jerry-fixed-row hover:bg-slate-900/50" data-jerry-fixed-row="${esc(p.modelKey)}">
      <td class="p-3 text-emerald-400">${p.images.length} 張</td>
      <td class="p-3 font-bold text-white">${esc(model.name)}</td>
      <td class="p-3 text-slate-400">${esc(model.style)}</td>
      <td class="p-3">${leadSummary(model)}</td>
      <td class="p-3">${lithiumSummary(model)}</td>
      <td class="p-3">${p.visible ? '<span class="text-emerald-400">顯示</span>' : '<span class="text-rose-400">隱藏</span>'}</td>
      <td class="p-3 text-right"><button class="jerry-manage text-emerald-400 underline font-bold" data-product-id="${esc(p.id)}">管理照片</button></td>
    </tr><tr class="jerry-official-detail"><td colspan="7"><div class="jerry-official-prices">${priceChips(model)}</div></td></tr>`;
  }).join("");
  $$(".jerry-manage").forEach((button) => button.addEventListener("click", () => openFixedModal(button.dataset.productId)));
  setTimeout(() => { observerBusy = false; }, 30);
}

async function loadFixedProducts() {
  hideLegacyControls();
  try {
    const snap = await getDocs(collection(db, "shops", SHOP_ID, "products"));
    const docs = snap.docs.map((item) => ({ id:item.id, ...item.data() }));
    fixedProducts = buildFixedProducts(docs);
    renderFixedTable();
  } catch (error) {
    console.error("Jerry fixed products", error);
    fixedProducts = buildFixedProducts([]);
    renderFixedTable();
  }
}

function modelOf(product) { return CATALOG.find((m) => m.key === product?.modelKey); }
function hideEditableFields() {
  ["#editNameInput","#editStyleInput","#editTagInput","#editColorsInput","#editDescriptionInput","#editPriceLeadInput","#editPriceLithiumInput"].forEach((selector) => {
    const el = $(selector);
    const label = el?.closest("label");
    if (label) label.style.display = "none";
  });
}
function ensurePriceNotice(product) {
  const model = modelOf(product);
  let note = $("#jerryFixedPriceNotice");
  if (!note) {
    note = document.createElement("div");
    note.id = "jerryFixedPriceNotice";
    note.className = "jerry-fixed-note";
    const galleryBox = $("#chooseImagesBtn")?.closest("div.bg-slate-950");
    galleryBox?.parentElement?.insertBefore(note, galleryBox);
  }
  note.innerHTML = `<b>傑瑞正式價目固定由系統管理</b><br>這裡只管理「車款照片」與「前台顯示／隱藏」，不會再出現或修改小宇價格。<table class="jerry-fixed-price-table">${model.rows.map((row) => `<tr><td>${esc(row[0])}｜${esc(row[1])}</td><td>${row.length >= 4 ? `一般 ${money(row[2])}・特仕 ${money(row[3])}` : money(row[2])}</td></tr>`).join("")}</table>`;
}
function renderFixedGallery(product) {
  const grid = $("#productGalleryGrid");
  if (!grid) return;
  if (!product.images.length) {
    grid.innerHTML = '<div class="col-span-full text-slate-500 text-center py-4">尚無車款照片，請直接從手機／電腦選圖上傳。</div>';
    return;
  }
  grid.innerHTML = product.images.map((img, i) => `<div class="relative rounded-xl overflow-hidden border ${img.isPrimary ? 'border-emerald-500' : 'border-slate-800'}"><img src="${esc(img.url)}" class="w-full h-24 object-cover"><div class="absolute inset-x-0 bottom-0 bg-slate-950/90 p-1 flex gap-1 justify-center">${img.isPrimary ? '<span class="text-[9px] text-emerald-400 px-1">主圖</span>' : `<button type="button" class="jerry-primary bg-emerald-500 text-slate-950 px-1.5 rounded text-[9px]" data-index="${i}">設主圖</button>`}<button type="button" class="jerry-delete bg-rose-500 text-white px-1.5 rounded text-[9px]" data-index="${i}">刪除</button></div></div>`).join("");
  $$(".jerry-primary").forEach((button) => button.addEventListener("click", () => setPrimary(Number(button.dataset.index))));
  $$(".jerry-delete").forEach((button) => button.addEventListener("click", () => removeImage(Number(button.dataset.index))));
}
function openFixedModal(productId) {
  editing = fixedProducts.find((p) => p.id === productId);
  if (!editing) return;
  hideEditableFields();
  ensurePriceNotice(editing);
  if ($("#editModalProductTitle")) $("#editModalProductTitle").textContent = `${editing.name}｜照片管理`;
  if ($("#editVisibleInput")) $("#editVisibleInput").checked = editing.visible;
  if ($("#saveProductBtn")) $("#saveProductBtn").textContent = "儲存前台顯示設定";
  if ($("#chooseImagesBtn")) $("#chooseImagesBtn").innerHTML = '<i class="fa-solid fa-images mr-1"></i>選擇車款照片';
  renderFixedGallery(editing);
  const modal = $("#editProductModal");
  modal?.classList.remove("hidden");
  modal?.classList.add("flex");
}
function closeFixedModal() { editing = null; }

async function persistProduct(extra = {}) {
  if (!editing || !currentUser) return;
  const model = modelOf(editing);
  const payload = {
    name:model.name,
    style:model.style,
    tag:"JERRY E-BIKE",
    officialJerryModel:model.key,
    officialPriceRows:model.rows,
    approvedForJerry:true,
    shopId:SHOP_ID,
    visible:editing.visible,
    images:editing.images,
    updatedAt:serverTimestamp(),
    updatedBy:currentUser.uid,
    ...extra
  };
  await setDoc(doc(db, "shops", SHOP_ID, "products", editing.id), payload, { merge:true });
}
async function uploadToCloudinary(file) {
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  body.append("folder", `shops/${SHOP_ID}/products/${editing.id}`);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method:"POST", body });
  const result = await response.json();
  if (!response.ok || !result.secure_url) throw new Error(result?.error?.message || "圖片上傳失敗");
  return { url:result.secure_url, publicId:result.public_id, provider:"cloudinary" };
}
async function uploadFiles(files) {
  if (!editing || !files.length) return;
  const progress = $("#uploadProgressText");
  try {
    for (let i = 0; i < files.length; i += 1) {
      if (progress) progress.textContent = `上傳 ${i + 1}/${files.length}`;
      const item = await uploadToCloudinary(files[i]);
      editing.images.push({ ...item, isPrimary:editing.images.length === 0 });
    }
    await persistProduct();
    if (progress) progress.textContent = "上傳完成";
    renderFixedGallery(editing);
    renderFixedTable();
  } catch (error) {
    console.error(error);
    if (progress) progress.textContent = error?.message || "上傳失敗";
  }
}
async function setPrimary(index) {
  if (!editing) return;
  editing.images = editing.images.map((img, i) => ({ ...img, isPrimary:i === index }));
  await persistProduct();
  renderFixedGallery(editing);
  renderFixedTable();
}
async function removeImage(index) {
  if (!editing || !confirm("確定刪除這張照片？")) return;
  editing.images.splice(index, 1);
  if (editing.images.length && !editing.images.some((img) => img.isPrimary)) editing.images[0].isPrimary = true;
  await persistProduct();
  renderFixedGallery(editing);
  renderFixedTable();
}
async function saveVisible() {
  if (!editing) return;
  editing.visible = Boolean($("#editVisibleInput")?.checked);
  await persistProduct();
  renderFixedTable();
  $("#editProductModal")?.classList.add("hidden");
  $("#editProductModal")?.classList.remove("flex");
  editing = null;
}

injectStyle();
hideLegacyControls();

$("#refreshProductsBtn")?.addEventListener("click", () => setTimeout(loadFixedProducts, 20));
$("#imageFileInput")?.addEventListener("change", (event) => {
  if (!editing) return;
  uploadFiles([...event.target.files]);
  event.target.value = "";
});
$("#saveProductBtn")?.addEventListener("click", () => { if (editing) saveVisible(); });
$("#closeProductModalBtn")?.addEventListener("click", closeFixedModal);

const tbody = $("#adminProductTableBody");
if (tbody) {
  new MutationObserver(() => {
    if (observerBusy || !fixedProducts.length) return;
    if (!tbody.querySelector("[data-jerry-fixed-row]")) setTimeout(renderFixedTable, 25);
  }).observe(tbody, { childList:true });
}

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
  if (!user) return;
  setTimeout(loadFixedProducts, 500);
});
