import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
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

const OWNER_EMAIL = "uu8832sr@gmail.com";
const firebaseConfig = window.LUCKY_GARAGE_FIREBASE_CONFIG || {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
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
let products = [];
let orders = [];
let editingProductId = null;

function normalizeEmail(value) { return String(value || "").trim().toLowerCase(); }
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
  $("#toastMsg").textContent = message;
  const t = $("#toast");
  t.classList.remove("translate-y-20", "opacity-0");
  setTimeout(() => t.classList.add("translate-y-20", "opacity-0"), 2600);
}

async function isAdminUser(user) {
  if (!user || user.isAnonymous) return false;
  if (user.emailVerified && normalizeEmail(user.email) === OWNER_EMAIL) return true;
  try {
    const snap = await getDoc(doc(db, "admins", user.uid));
    return snap.exists() && snap.data().enabled === true;
  } catch {
    return false;
  }
}
async function beginLogin() {
  $("#loginMessage").textContent = "正在開啟 Google 登入…";
  $("#loginBtn").disabled = true;
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
    $("#loginMessage").textContent = error?.message || "登入失敗。";
  } finally {
    $("#loginBtn").disabled = false;
  }
}
function showLoggedOut() {
  currentUser = null;
  $("#loginCard").classList.remove("hidden");
  $("#deniedCard").classList.add("hidden");
  $("#adminApp").classList.add("hidden");
  $("#headerActions").classList.add("hidden");
  $("#headerActions").classList.remove("flex");
}
function showDenied(user) {
  currentUser = user;
  $("#loginCard").classList.add("hidden");
  $("#deniedCard").classList.remove("hidden");
  $("#adminApp").classList.add("hidden");
  $("#deniedMessage").textContent = `目前登入：${user.email || user.uid}`;
}
async function showAdmin(user) {
  currentUser = user;
  $("#loginCard").classList.add("hidden");
  $("#deniedCard").classList.add("hidden");
  $("#adminApp").classList.remove("hidden");
  $("#headerActions").classList.remove("hidden");
  $("#headerActions").classList.add("flex");
  $("#adminIdentity").textContent = user.email || user.uid;
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
    createdAt:data.createdAt || data.timestamp || "",
    raw:data
  };
}
async function loadOrders() {
  const tbody = $("#adminOrderTableBody");
  tbody.innerHTML = '<tr><td colspan="7" class="p-5 text-center text-slate-500">讀取訂單中…</td></tr>';
  try {
    const snap = await getDocs(collection(db, "orders"));
    orders = snap.docs.map(normalizeOrder).sort((a,b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
    renderOrders();
  } catch (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="7" class="p-5 text-center text-rose-400">載入失敗：${escapeHtml(error?.message || "請檢查規則")}</td></tr>`;
  }
}
function renderOrders() {
  const keyword = $("#orderSearch").value.trim().toLowerCase();
  const list = orders.filter((o) => [o.orderNo,o.customerName,o.phone,o.address,o.model].join(" ").toLowerCase().includes(keyword));
  const tbody = $("#adminOrderTableBody");
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-5 text-center text-slate-500">沒有符合的訂單</td></tr>';
    return;
  }
  const statuses = ["待訂金","已付訂金","備車中","待交車","已交車","取消"];
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
    select.disabled = true;
    try {
      await updateDoc(doc(db,"orders",select.dataset.orderId), { status:select.value, updatedAt:serverTimestamp(), updatedBy:currentUser.uid });
      const found = orders.find((o) => o.id === select.dataset.orderId);
      if (found) found.status = select.value;
      showToast("訂單狀態已更新");
    } catch (error) {
      console.error(error); showToast("狀態更新失敗");
    } finally { select.disabled = false; }
  }));
}

async function loadProducts() {
  const tbody = $("#adminProductTableBody");
  tbody.innerHTML = '<tr><td colspan="7" class="p-5 text-center text-slate-500">讀取商品中…</td></tr>';
  try {
    const snap = await getDocs(collection(db,"products"));
    products = snap.docs.map((item) => ({ id:item.id, ...item.data() })).sort((a,b) => Number(a.order||999)-Number(b.order||999));
    renderProducts();
  } catch (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="7" class="p-5 text-center text-rose-400">載入失敗：${escapeHtml(error?.message || "請檢查規則")}</td></tr>`;
  }
}
function renderProducts() {
  const tbody = $("#adminProductTableBody");
  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-5 text-center text-slate-500">尚未建立商品，請按「建立／補齊 12 款預設商品」。</td></tr>';
    return;
  }
  tbody.innerHTML = products.map((p) => `<tr class="hover:bg-slate-900/50"><td class="p-3 text-emerald-400">${Array.isArray(p.images)?p.images.length:0} 張</td><td class="p-3 font-bold text-white">${escapeHtml(p.name)}</td><td class="p-3 text-slate-400">${escapeHtml(p.style||"")}</td><td class="p-3">${money(p.priceLead)}</td><td class="p-3">${Number(p.priceLithium||0)>0?money(p.priceLithium):"不提供"}</td><td class="p-3">${p.visible===false?'<span class="text-rose-400">隱藏</span>':'<span class="text-emerald-400">顯示</span>'}</td><td class="p-3 text-right"><button class="edit-product text-emerald-400 underline" data-product-id="${escapeHtml(p.id)}">管理</button></td></tr>`).join("");
  $$(".edit-product").forEach((button) => button.addEventListener("click", () => openProductModal(button.dataset.productId)));
}
async function seedProducts() {
  const batch = writeBatch(db);
  const existing = new Set(products.map((p) => p.id));
  let count = 0;
  for (const product of DEFAULT_PRODUCTS) {
    if (!existing.has(product.id)) {
      batch.set(doc(db,"products",product.id), { ...product, createdAt:serverTimestamp(), updatedAt:serverTimestamp(), updatedBy:currentUser.uid });
      count += 1;
    }
  }
  if (!count) return showToast("12 款商品已經齊全");
  await batch.commit();
  showToast(`已補齊 ${count} 款商品`);
  await loadProducts();
}
function openProductModal(productId) {
  editingProductId = productId;
  const p = products.find((item) => item.id === productId);
  if (!p) return;
  $("#editModalProductTitle").textContent = `管理 ${p.name}（${p.style || ""}）`;
  $("#editNameInput").value = p.name || "";
  $("#editStyleInput").value = p.style || "";
  $("#editTagInput").value = p.tag || "";
  $("#editColorsInput").value = Array.isArray(p.colors) ? p.colors.join("、") : "";
  $("#editPriceLeadInput").value = Number(p.priceLead || 0);
  $("#editPriceLithiumInput").value = Number(p.priceLithium || 0) || "";
  $("#editVisibleInput").checked = p.visible !== false;
  renderGallery(p);
  const modal = $("#editProductModal");
  modal.classList.remove("hidden"); modal.classList.add("flex");
}
function closeProductModal() {
  const modal = $("#editProductModal");
  modal.classList.add("hidden"); modal.classList.remove("flex");
  editingProductId = null;
}
function renderGallery(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  const grid = $("#productGalleryGrid");
  if (!images.length) { grid.innerHTML = '<div class="col-span-full text-slate-500 text-center py-4">尚無圖片</div>'; return; }
  grid.innerHTML = images.map((img,i) => `<div class="relative rounded-xl overflow-hidden border ${img.isPrimary?'border-emerald-500':'border-slate-800'}"><img src="${escapeHtml(img.url)}" class="w-full h-24 object-cover" /><div class="absolute inset-x-0 bottom-0 bg-slate-950/90 p-1 flex gap-1 justify-center">${img.isPrimary?'<span class="text-[9px] text-emerald-400 px-1">主圖</span>':`<button class="set-primary bg-emerald-500 text-slate-950 px-1.5 rounded text-[9px]" data-index="${i}">設主圖</button>`}<button class="delete-image bg-rose-500 text-white px-1.5 rounded text-[9px]" data-index="${i}">刪除</button></div></div>`).join("");
  $$(".set-primary").forEach((button) => button.addEventListener("click", () => setPrimaryImage(Number(button.dataset.index))));
  $$(".delete-image").forEach((button) => button.addEventListener("click", () => deleteImage(Number(button.dataset.index))));
}
async function uploadImages(files) {
  const product = products.find((p) => p.id === editingProductId);
  if (!product || !files.length) return;
  if (!Array.isArray(product.images)) product.images = [];
  for (let i=0;i<files.length;i+=1) {
    const file = files[i];
    $("#uploadProgressText").textContent = `上傳 ${i+1}/${files.length}`;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
    const path = `products/${product.id}/${Date.now()}_${i}_${safeName}`;
    const objectRef = ref(storage,path);
    await uploadBytes(objectRef,file,{ contentType:file.type || "image/jpeg" });
    const url = await getDownloadURL(objectRef);
    product.images.push({ url, path, isPrimary:product.images.length===0 });
  }
  await updateDoc(doc(db,"products",product.id), { images:product.images, updatedAt:serverTimestamp(), updatedBy:currentUser.uid });
  $("#uploadProgressText").textContent = "上傳完成";
  renderGallery(product); renderProducts();
}
async function setPrimaryImage(index) {
  const product = products.find((p) => p.id === editingProductId);
  if (!product) return;
  product.images = (product.images || []).map((img,i) => ({...img,isPrimary:i===index}));
  await updateDoc(doc(db,"products",product.id), { images:product.images, updatedAt:serverTimestamp(), updatedBy:currentUser.uid });
  renderGallery(product); renderProducts();
}
async function deleteImage(index) {
  const product = products.find((p) => p.id === editingProductId);
  const image = product?.images?.[index];
  if (!product || !image || !confirm("確定刪除這張照片？")) return;
  if (image.path) { try { await deleteObject(ref(storage,image.path)); } catch (error) { console.warn(error); } }
  product.images.splice(index,1);
  if (product.images.length && !product.images.some((img) => img.isPrimary)) product.images[0].isPrimary = true;
  await updateDoc(doc(db,"products",product.id), { images:product.images, updatedAt:serverTimestamp(), updatedBy:currentUser.uid });
  renderGallery(product); renderProducts();
}
async function saveProduct() {
  const product = products.find((p) => p.id === editingProductId);
  if (!product) return;
  const colors = $("#editColorsInput").value.split(/[、,，]/).map((v) => v.trim()).filter(Boolean);
  const update = {
    name:$("#editNameInput").value.trim(),
    style:$("#editStyleInput").value.trim(),
    tag:$("#editTagInput").value.trim(),
    colors,
    priceLead:Math.max(0,Number($("#editPriceLeadInput").value)||0),
    priceLithium:$("#editPriceLithiumInput").value===""?null:Math.max(0,Number($("#editPriceLithiumInput").value)||0),
    visible:$("#editVisibleInput").checked,
    updatedAt:serverTimestamp(),
    updatedBy:currentUser.uid
  };
  await updateDoc(doc(db,"products",product.id),update);
  Object.assign(product,update);
  renderProducts(); closeProductModal(); showToast("商品設定已儲存");
}
function switchTab(tab) {
  $("#admin-section-orders").classList.toggle("hidden",tab!=="orders");
  $("#admin-section-products").classList.toggle("hidden",tab!=="products");
  $$(".admin-tab").forEach((button) => {
    const active = button.dataset.adminTab===tab;
    button.className = `admin-tab ${active?'bg-emerald-500 text-slate-950 font-black':'bg-slate-900 border border-slate-800 text-slate-300 font-bold'} rounded-xl p-3 text-xs`;
  });
}

$("#loginBtn").addEventListener("click",beginLogin);
$("#switchAccountBtn").addEventListener("click",async()=>{await signOut(auth);beginLogin();});
$("#logoutBtn").addEventListener("click",()=>signOut(auth));
$("#refreshOrdersBtn").addEventListener("click",loadOrders);
$("#orderSearch").addEventListener("input",renderOrders);
$("#refreshProductsBtn").addEventListener("click",loadProducts);
$("#seedProductsBtn").addEventListener("click",()=>seedProducts().catch((e)=>{console.error(e);showToast("建立商品失敗");}));
$$(".admin-tab").forEach((button)=>button.addEventListener("click",()=>switchTab(button.dataset.adminTab)));
$("#closeProductModalBtn").addEventListener("click",closeProductModal);
$("#chooseImagesBtn").addEventListener("click",()=>$("#imageFileInput").click());
$("#imageFileInput").addEventListener("change",(event)=>uploadImages([...event.target.files]).catch((e)=>{console.error(e);showToast("圖片上傳失敗，請確認 Storage 規則");}));
$("#saveProductBtn").addEventListener("click",()=>saveProduct().catch((e)=>{console.error(e);showToast("商品儲存失敗");}));

onAuthStateChanged(auth, async (user) => {
  if (!user) return showLoggedOut();
  if (!(await isAdminUser(user))) return showDenied(user);
  await showAdmin(user);
});
