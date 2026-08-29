import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  addDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-storage.js";
import {
  resolveShopContext,
  shopCollection,
  shopDoc,
  shopStoragePrefix
} from "../multi-shop-core.js";

const firebaseConfig = window.LUCKY_GARAGE_FIREBASE_CONFIG || {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const CLOUDINARY_CLOUD_NAME = "k6e9e4bl";
const CLOUDINARY_UPLOAD_PRESET = "jerry_products_unsigned";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const DEFAULT_PRODUCTS = [
  { id:"scooter-1", order:1, name:"大偉士", style:"頂規改裝版", tag:"72V", visible:true, priceLead:35000, priceLithium:58800, colors:["黑色","白色","灰色"], images:[] },
  { id:"scooter-2", order:2, name:"小偉士", style:"經典款", tag:"60V", visible:true, priceLead:28000, priceLithium:45600, colors:["白色","黑色","紅色"], images:[] },
  { id:"scooter-3", order:3, name:"神盾", style:"鋼鐵戰艦版", tag:"60V", visible:true, priceLead:29000, priceLithium:48000, colors:["白色","黑色","綠色"], images:[] },
  { id:"scooter-4", order:4, name:"Z3", style:"普通版", tag:"72V", visible:true, priceLead:35000, priceLithium:58800, colors:["白色","黑色","灰色"], images:[] },
  { id:"scooter-5", order:5, name:"Z3", style:"暗魂版", tag:"72V", visible:true, priceLead:38000, priceLithium:62000, colors:["消光黑"], images:[] },
  { id:"scooter-6", order:6, name:"正9號", style:"曠達版", tag:"72V", visible:true, priceLead:35000, priceLithium:58800, colors:["紫色","白色","黑色"], images:[] },
  { id:"scooter-7", order:7, name:"正9號", style:"金大力版", tag:"72V", visible:true, priceLead:35000, priceLithium:58800, colors:["金色","黑色","白色"], images:[] },
  { id:"scooter-8", order:8, name:"小可愛（拿鐵）", style:"可愛馬卡龍版", tag:"60V", visible:true, priceLead:30000, priceLithium:null, colors:["奶茶色","粉色","白色"], images:[] },
  { id:"scooter-9", order:9, name:"Dio", style:"經典二行程外型", tag:"60V", visible:true, priceLead:30000, priceLithium:48000, colors:["白色","黑色"], images:[] },
  { id:"scooter-10", order:10, name:"QC", style:"時尚 QC 款", tag:"72V", visible:true, priceLead:32000, priceLithium:56400, colors:["白色","黑色","灰色"], images:[] },
  { id:"scooter-11", order:11, name:"小酷龍", style:"檔車造型款", tag:"48V", visible:true, priceLead:21000, priceLithium:null, colors:["黑色","紅色"], images:[] },
  { id:"scooter-12", order:12, name:"微型三輪", style:"載物長者三輪版", tag:"非領牌版", visible:true, priceLead:33000, priceLithium:null, colors:["紅色","藍色"], images:[] }
];

let currentUser = null;
let currentContext = null;
let products = [];
let orders = [];
let editingProductId = null;

function money(value) { return `NT$${Math.max(0, Number(value) || 0).toLocaleString("zh-TW")}`; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function timestampMillis(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  const parsed = Date.parse(value || "");
  return Number.isNaN(parsed) ? 0 : parsed;
}
function formatDate(value) {
  const ms = timestampMillis(value);
  return ms ? new Intl.DateTimeFormat("zh-TW", { dateStyle:"short", timeStyle:"short" }).format(new Date(ms)) : "—";
}
function showToast(message) {
  const msg = $("#toastMsg");
  const t = $("#toast");
  if (!msg || !t) return;
  msg.textContent = message;
  t.classList.remove("translate-y-20", "opacity-0");
  setTimeout(() => t.classList.add("translate-y-20", "opacity-0"), 2600);
}
function requireContext() {
  if (!currentContext?.shopId) throw new Error("尚未載入車行權限");
  return currentContext;
}
function isOwnerLike() {
  return ["platformOwner","owner","admin"].includes(currentContext?.role || "");
}
function isStaff() { return currentContext?.role === "staff"; }
function compactProduct(p = {}) {
  return {
    name:p.name || "", style:p.style || "", tag:p.tag || "", description:p.description || "",
    colors:Array.isArray(p.colors)?p.colors:[], priceLead:Number(p.priceLead||0),
    priceLithium:p.priceLithium == null ? null : Number(p.priceLithium||0), visible:p.visible !== false,
    imageCount:Array.isArray(p.images)?p.images.length:0
  };
}
async function logAudit(action, targetId, targetLabel, before = null, after = null) {
  try {
    const context = requireContext();
    await addDoc(shopCollection(db, context, "auditLogs"), {
      action,
      targetId:targetId || "",
      targetLabel:targetLabel || "",
      before,
      after,
      actorUid:currentUser?.uid || "",
      actorEmail:currentUser?.email || "",
      role:context.role || "",
      shopId:context.shopId,
      createdAt:serverTimestamp()
    });
  } catch (error) {
    console.warn("Audit log failed:", error);
  }
}
function applyRoleUi() {
  $$('[data-owner-only]').forEach((el) => el.classList.toggle("hidden", !isOwnerLike()));
  if (isStaff()) {
    $("#seedProductsBtn")?.classList.add("hidden");
  }
}

function installPasswordLogin() {
  const card = $("#loginCard");
  const googleBtn = $("#loginBtn");
  if (!card || !googleBtn || $("#emailLoginBtn")) return;
  const wrap = document.createElement("div");
  wrap.className = "space-y-3 text-left";
  wrap.innerHTML = `
    <input id="adminEmailInput" type="email" autocomplete="username" placeholder="管理員 Email" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm" />
    <input id="adminPasswordInput" type="password" autocomplete="current-password" placeholder="密碼" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm" />
    <button id="emailLoginBtn" class="w-full bg-emerald-500 text-slate-950 font-black py-3 rounded-xl"><i class="fa-solid fa-right-to-bracket mr-2"></i>Email／密碼登入</button>
    <div class="text-center text-[10px] text-slate-500">或使用 Google 管理員登入</div>`;
  googleBtn.before(wrap);
  $("#emailLoginBtn")?.addEventListener("click", beginEmailLogin);
  $("#adminPasswordInput")?.addEventListener("keydown", (event) => { if (event.key === "Enter") beginEmailLogin(); });
}

async function beginEmailLogin() {
  const email = $("#adminEmailInput")?.value.trim() || "";
  const password = $("#adminPasswordInput")?.value || "";
  if (!email || !password) return showToast("請輸入 Email 與密碼");
  const message = $("#loginMessage");
  const button = $("#emailLoginBtn");
  if (message) message.textContent = "登入中…";
  if (button) button.disabled = true;
  try {
    await Promise.race([
      signInWithEmailAndPassword(auth, email, password),
      new Promise((_, reject) => setTimeout(() => reject(new Error("登入逾時，請重新整理後再試一次")), 12000))
    ]);
  } catch (error) {
    console.error(error);
    const code = String(error?.code || "");
    let text = error?.message || "登入失敗";
    if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) text = "帳號或密碼錯誤";
    else if (code.includes("operation-not-allowed")) text = "Firebase 尚未啟用 Email／密碼登入";
    else if (code.includes("too-many-requests")) text = "嘗試次數過多，請稍後再試";
    if (message) message.textContent = text;
  } finally {
    if (button) button.disabled = false;
  }
}
async function beginGoogleLogin() {
  const message = $("#loginMessage");
  const button = $("#loginBtn");
  if (message) message.textContent = "正在開啟 Google 登入…";
  if (button) button.disabled = true;
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt:"select_account" });
    await signInWithPopup(auth, provider);
  } catch (error) {
    const code = String(error?.code || "");
    if (code.includes("popup-blocked") || code.includes("operation-not-supported")) {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt:"select_account" });
      await signInWithRedirect(auth, provider);
      return;
    }
    if (message) message.textContent = error?.message || "登入失敗。";
  } finally {
    if (button) button.disabled = false;
  }
}
function showLoggedOut() {
  currentUser = null;
  currentContext = null;
  $("#loginCard")?.classList.remove("hidden");
  $("#deniedCard")?.classList.add("hidden");
  $("#adminApp")?.classList.add("hidden");
  $("#headerActions")?.classList.add("hidden");
  $("#headerActions")?.classList.remove("flex");
}
function showDenied(user, message = "此帳號沒有管理權限") {
  currentUser = user;
  currentContext = null;
  $("#loginCard")?.classList.add("hidden");
  $("#deniedCard")?.classList.remove("hidden");
  $("#adminApp")?.classList.add("hidden");
  const denied = $("#deniedMessage");
  if (denied) denied.textContent = `${message}｜${user?.email || user?.uid || "未知帳號"}`;
}
async function showAdmin(user, context) {
  currentUser = user;
  currentContext = context;
  $("#loginCard")?.classList.add("hidden");
  $("#deniedCard")?.classList.add("hidden");
  $("#adminApp")?.classList.remove("hidden");
  $("#headerActions")?.classList.remove("hidden");
  $("#headerActions")?.classList.add("flex");
  const shopName = context.shop?.name || context.shop?.displayName || context.shopId;
  $("#seedProductsBtn")?.classList.toggle("hidden", !context.legacy);
  if ($("#adminIdentity")) $("#adminIdentity").textContent = `${shopName}｜${context.role || "admin"}｜${user.email || user.uid}`;
  document.title = `${shopName}｜管理員後台`;
  applyRoleUi();
  await Promise.all([loadOrders(), loadProducts()]);
}

function normalizeOrder(item) {
  const data = item.data();
  return {
    id:item.id,
    orderNo:data.orderNo || data.orderId || item.id,
    customerName:data.customerName || data.custName || "未命名",
    phone:data.phone || data.custPhone || "—",
    address:data.address || data.custAddress || "—",
    model:data.model || data.itemName || "—",
    variant:data.vehicleVariant || data.battery || "",
    price:Number(data.price || String(data.totalAmount || "").replace(/\D/g, "")) || 0,
    status:data.status || "待訂金",
    createdAt:data.createdAt || data.timestamp || ""
  };
}
async function loadOrders() {
  const context = requireContext();
  const tbody = $("#adminOrderTableBody");
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="p-5 text-center text-slate-500">讀取訂單中…</td></tr>';
  try {
    const snap = await getDocs(shopCollection(db, context, "orders"));
    orders = snap.docs.map(normalizeOrder).sort((a,b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
    renderOrders();
  } catch (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="7" class="p-5 text-center text-rose-400">載入失敗：${escapeHtml(error?.message || "請檢查規則")}</td></tr>`;
  }
}
function renderOrders() {
  const search = $("#orderSearch");
  const tbody = $("#adminOrderTableBody");
  if (!search || !tbody) return;
  const keyword = search.value.trim().toLowerCase();
  const list = orders.filter((o) => [o.orderNo,o.customerName,o.phone,o.address,o.model].join(" ").toLowerCase().includes(keyword));
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-5 text-center text-slate-500">沒有符合的訂單</td></tr>';
    return;
  }
  const statuses = ["待驗證","待訂金","已付訂金","備車中","待交車","已交車","取消"];
  tbody.innerHTML = list.map((o) => `<tr class="hover:bg-slate-900/50">
    <td class="p-3 text-emerald-400 font-bold">${escapeHtml(o.orderNo)}</td>
    <td class="p-3"><strong class="text-white block">${escapeHtml(o.customerName)}</strong><small class="text-slate-500">${escapeHtml(o.phone)}</small></td>
    <td class="p-3"><strong class="block">${escapeHtml(o.model)}</strong><small class="text-slate-500">${escapeHtml(o.variant)}</small></td>
    <td class="p-3 max-w-56">${escapeHtml(o.address)}</td>
    <td class="p-3 font-bold">${money(o.price)}</td>
    <td class="p-3"><select class="order-status bg-slate-950 border border-slate-700 rounded-lg p-2" data-order-id="${escapeHtml(o.id)}">${statuses.map((s) => `<option ${s===o.status?"selected":""}>${s}</option>`).join("")}</select></td>
    <td class="p-3 text-slate-500">${formatDate(o.createdAt)}</td>
  </tr>`).join("");
  $$(".order-status").forEach((select) => select.addEventListener("change", async () => {
    const found = orders.find((o) => o.id === select.dataset.orderId);
    const before = found?.status || "";
    select.disabled = true;
    try {
      await updateDoc(shopDoc(db, requireContext(), "orders", select.dataset.orderId), { status:select.value, updatedAt:serverTimestamp(), updatedBy:currentUser.uid });
      if (found) found.status = select.value;
      await logAudit("update_order_status", select.dataset.orderId, found?.orderNo || select.dataset.orderId, {status:before}, {status:select.value});
      showToast("訂單狀態已更新");
    } catch (error) {
      console.error(error); showToast("狀態更新失敗");
    } finally { select.disabled = false; }
  }));
}

async function loadProducts() {
  const context = requireContext();
  const tbody = $("#adminProductTableBody");
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="p-5 text-center text-slate-500">讀取商品中…</td></tr>';
  try {
    const snap = await getDocs(shopCollection(db, context, "products"));
    products = snap.docs.map((item) => ({ id:item.id, ...item.data() })).filter((item) => context.legacy || item.approvedForJerry === true).sort((a,b) => Number(a.order||999)-Number(b.order||999));
    renderProducts();
  } catch (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="7" class="p-5 text-center text-rose-400">載入失敗：${escapeHtml(error?.message || "請檢查規則")}</td></tr>`;
  }
}
function renderProducts() {
  const tbody = $("#adminProductTableBody");
  if (!tbody) return;
  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-5 text-center text-slate-500">尚未建立商品。</td></tr>';
    return;
  }
  tbody.innerHTML = products.map((p) => `<tr class="hover:bg-slate-900/50"><td class="p-3 text-emerald-400">${Array.isArray(p.images)?p.images.length:0} 張</td><td class="p-3 font-bold text-white">${escapeHtml(p.name)}</td><td class="p-3 text-slate-400">${escapeHtml(p.style||"")}</td><td class="p-3">${money(p.priceLead)}</td><td class="p-3">${Number(p.priceLithium||0)>0?money(p.priceLithium):"不提供"}</td><td class="p-3">${p.visible===false?'<span class="text-rose-400">隱藏</span>':'<span class="text-emerald-400">顯示</span>'}</td><td class="p-3 text-right"><button class="edit-product text-emerald-400 underline" data-product-id="${escapeHtml(p.id)}">管理</button></td></tr>`).join("");
  $$(".edit-product").forEach((button) => button.addEventListener("click", () => openProductModal(button.dataset.productId)));
}
async function seedProducts() {
  if (!isOwnerLike()) throw new Error("此功能限管理員使用");
  const context = requireContext();
  const batch = writeBatch(db);
  const existing = new Set(products.map((p) => p.id));
  let count = 0;
  for (const product of DEFAULT_PRODUCTS) {
    if (!existing.has(product.id)) {
      batch.set(shopDoc(db, context, "products", product.id), { ...product, shopId:context.shopId, createdAt:serverTimestamp(), updatedAt:serverTimestamp(), updatedBy:currentUser.uid });
      count += 1;
    }
  }
  if (!count) return showToast("預設商品已經齊全");
  await batch.commit();
  await logAudit("seed_products", "products", `補齊 ${count} 款商品`, null, {count});
  showToast(`已補齊 ${count} 款商品`);
  await loadProducts();
}
function openProductModal(productId) {
  editingProductId = productId;
  const p = products.find((item) => item.id === productId);
  if (!p) return;
  if ($("#editModalProductTitle")) $("#editModalProductTitle").textContent = `管理 ${p.name}（${p.style || ""}）`;
  if ($("#editNameInput")) $("#editNameInput").value = p.name || "";
  if ($("#editStyleInput")) $("#editStyleInput").value = p.style || "";
  if ($("#editTagInput")) $("#editTagInput").value = p.tag || "";
  if ($("#editColorsInput")) $("#editColorsInput").value = Array.isArray(p.colors) ? p.colors.join("、") : "";
  if ($("#editDescriptionInput")) $("#editDescriptionInput").value = p.description || "";
  if ($("#editPriceLeadInput")) $("#editPriceLeadInput").value = Number(p.priceLead || 0);
  if ($("#editPriceLithiumInput")) $("#editPriceLithiumInput").value = Number(p.priceLithium || 0) || "";
  if ($("#editVisibleInput")) $("#editVisibleInput").checked = p.visible !== false;
  renderGallery(p);
  const modal = $("#editProductModal");
  if (modal) { modal.classList.remove("hidden"); modal.classList.add("flex"); }
}
function closeProductModal() {
  const modal = $("#editProductModal");
  if (modal) { modal.classList.add("hidden"); modal.classList.remove("flex"); }
  editingProductId = null;
}
function renderGallery(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  const grid = $("#productGalleryGrid");
  if (!grid) return;
  if (!images.length) { grid.innerHTML = '<div class="col-span-full text-slate-500 text-center py-4">尚無圖片</div>'; return; }
  grid.innerHTML = images.map((img,i) => `<div class="relative rounded-xl overflow-hidden border ${img.isPrimary?'border-emerald-500':'border-slate-800'}"><img src="${escapeHtml(img.url)}" class="w-full h-24 object-cover" /><div class="absolute inset-x-0 bottom-0 bg-slate-950/90 p-1 flex gap-1 justify-center">${img.isPrimary?'<span class="text-[9px] text-emerald-400 px-1">主圖</span>':`<button class="set-primary bg-emerald-500 text-slate-950 px-1.5 rounded text-[9px]" data-index="${i}">設主圖</button>`}<button class="delete-image bg-rose-500 text-white px-1.5 rounded text-[9px]" data-index="${i}">刪除</button></div></div>`).join("");
  $$(".set-primary").forEach((button) => button.addEventListener("click", () => setPrimaryImage(Number(button.dataset.index))));
  $$(".delete-image").forEach((button) => button.addEventListener("click", () => deleteImage(Number(button.dataset.index))));
}
async function createProduct() {
  const context = requireContext();
  const id = `${context.shopId}-${Date.now()}`;
  await setDoc(shopDoc(db, context, "products", id), {
    name:"新車款", style:"", tag:"", description:"", colors:[], priceLead:0, priceLithium:null, images:[], visible:false,
    approvedForJerry:!context.legacy, shopId:context.shopId, createdAt:serverTimestamp(), updatedAt:serverTimestamp(), updatedBy:currentUser.uid
  });
  await logAudit("create_product", id, "新車款", null, {name:"新車款", visible:false});
  await loadProducts();
  openProductModal(id);
}
async function uploadToCloudinary(file, folder) {
  const body = new FormData(); body.append("file", file); body.append("upload_preset", CLOUDINARY_UPLOAD_PRESET); body.append("folder", folder);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method:"POST", body });
  const result = await response.json();
  if (!response.ok || !result.secure_url) throw new Error(result?.error?.message || "Cloudinary 圖片上傳失敗");
  return { url:result.secure_url, publicId:result.public_id, provider:"cloudinary" };
}
async function uploadImages(files) {
  const context = requireContext();
  const product = products.find((p) => p.id === editingProductId);
  if (!product || !files.length) return;
  const before = compactProduct(product);
  if (!Array.isArray(product.images)) product.images = [];
  for (let i=0;i<files.length;i+=1) {
    const file = files[i];
    if ($("#uploadProgressText")) $("#uploadProgressText").textContent = `上傳 ${i+1}/${files.length}`;
    if (context.legacy) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
      const path = `products/${product.id}/${Date.now()}_${i}_${safeName}`;
      const objectRef = ref(storage,path);
      await uploadBytes(objectRef,file,{ contentType:file.type || "image/jpeg" });
      const url = await getDownloadURL(objectRef);
      product.images.push({ url, path, provider:"firebase", isPrimary:product.images.length===0 });
    } else {
      const uploaded = await uploadToCloudinary(file, `shops/${context.shopId}/products/${product.id}`);
      product.images.push({ ...uploaded, isPrimary:product.images.length===0 });
    }
  }
  await setDoc(shopDoc(db, context, "products", product.id), { images:product.images, shopId:context.shopId, updatedAt:serverTimestamp(), updatedBy:currentUser.uid }, { merge:true });
  await logAudit("upload_product_images", product.id, product.name, before, compactProduct(product));
  if ($("#uploadProgressText")) $("#uploadProgressText").textContent = "上傳完成";
  renderGallery(product); renderProducts();
}
async function setPrimaryImage(index) {
  const context = requireContext(); const product = products.find((p) => p.id === editingProductId); if (!product) return;
  const before = compactProduct(product);
  product.images = (product.images || []).map((img,i) => ({...img,isPrimary:i===index}));
  await setDoc(shopDoc(db, context, "products", product.id), { images:product.images, shopId:context.shopId, updatedAt:serverTimestamp(), updatedBy:currentUser.uid }, { merge:true });
  await logAudit("set_primary_image", product.id, product.name, before, compactProduct(product));
  renderGallery(product); renderProducts();
}
async function deleteImage(index) {
  const context = requireContext(); const product = products.find((p) => p.id === editingProductId); const image = product?.images?.[index];
  if (!product || !image || !confirm("確定刪除這張照片？")) return;
  const before = compactProduct(product);
  if (image.path && image.provider !== "cloudinary") { try { await deleteObject(ref(storage,image.path)); } catch (error) { console.warn(error); } }
  product.images.splice(index,1);
  if (product.images.length && !product.images.some((img) => img.isPrimary)) product.images[0].isPrimary = true;
  await setDoc(shopDoc(db, context, "products", product.id), { images:product.images, shopId:context.shopId, updatedAt:serverTimestamp(), updatedBy:currentUser.uid }, { merge:true });
  await logAudit("delete_product_image", product.id, product.name, before, compactProduct(product));
  renderGallery(product); renderProducts();
}
async function saveProduct() {
  const context = requireContext(); const product = products.find((p) => p.id === editingProductId); if (!product) return;
  const before = compactProduct(product);
  const colors = ($("#editColorsInput")?.value || "").split(/[、,，]/).map((v) => v.trim()).filter(Boolean);
  const update = {
    name:$("#editNameInput")?.value.trim() || "", style:$("#editStyleInput")?.value.trim() || "", tag:$("#editTagInput")?.value.trim() || "",
    description:$("#editDescriptionInput")?.value.trim() || "", colors,
    priceLead:Math.max(0,Number($("#editPriceLeadInput")?.value)||0), priceLithium:$("#editPriceLithiumInput")?.value===""?null:Math.max(0,Number($("#editPriceLithiumInput")?.value)||0),
    visible:Boolean($("#editVisibleInput")?.checked), approvedForJerry:context.legacy ? Boolean(product.approvedForJerry) : true,
    shopId:context.shopId, updatedAt:serverTimestamp(), updatedBy:currentUser.uid
  };
  await setDoc(shopDoc(db, context, "products", product.id), update, { merge:true });
  Object.assign(product,update);
  await logAudit("update_product", product.id, product.name, before, compactProduct(product));
  renderProducts(); closeProductModal(); showToast("商品設定已儲存");
}
function switchTab(tab) {
  $("#admin-section-orders")?.classList.toggle("hidden",tab!=="orders");
  $("#admin-section-products")?.classList.toggle("hidden",tab!=="products");
  $$(".admin-tab").forEach((button) => { const active = button.dataset.adminTab===tab; button.className = `admin-tab ${active?'bg-emerald-500 text-slate-950 font-black':'bg-slate-900 border border-slate-800 text-slate-300 font-bold'} rounded-xl p-3 text-xs`; });
}

installPasswordLogin();
$("#loginBtn")?.addEventListener("click",beginGoogleLogin);
$("#switchAccountBtn")?.addEventListener("click",async()=>{await signOut(auth);showLoggedOut();});
$("#logoutBtn")?.addEventListener("click",()=>signOut(auth));
$("#refreshOrdersBtn")?.addEventListener("click",loadOrders);
$("#orderSearch")?.addEventListener("input",renderOrders);
$("#refreshProductsBtn")?.addEventListener("click",loadProducts);
$("#newProductBtn")?.addEventListener("click",()=>createProduct().catch((e)=>{console.error(e);showToast("新增車款失敗");}));
$("#seedProductsBtn")?.addEventListener("click",()=>seedProducts().catch((e)=>{console.error(e);showToast(e?.message || "建立商品失敗");}));
$$(".admin-tab").forEach((button)=>button.addEventListener("click",()=>switchTab(button.dataset.adminTab)));
$("#closeProductModalBtn")?.addEventListener("click",closeProductModal);
$("#chooseImagesBtn")?.addEventListener("click",()=>$("#imageFileInput")?.click());
$("#imageFileInput")?.addEventListener("change",(event)=>uploadImages([...event.target.files]).catch((e)=>{console.error(e);showToast("圖片上傳失敗");}));
$("#saveProductBtn")?.addEventListener("click",()=>saveProduct().catch((e)=>{console.error(e);showToast("商品儲存失敗");}));

onAuthStateChanged(auth, async (user) => {
  if (!user) return showLoggedOut();
  try {
    const context = await resolveShopContext(db, user);
    await showAdmin(user, context);
  } catch (error) {
    console.error(error);
    showDenied(user, error?.message || "此帳號沒有管理權限");
  }
});
