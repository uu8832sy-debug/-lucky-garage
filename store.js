import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const firebaseConfig = window.LUCKY_GARAGE_FIREBASE_CONFIG || {};
const storeConfig = window.YU_STORE_CONFIG || {};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
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

let products = [...DEFAULT_PRODUCTS];
let currentProduct = null;
let captchaAnswer = 0;
let plateCaptchaAnswer = 0;

function money(value) {
  return `NT$${Math.max(0, Number(value) || 0).toLocaleString("zh-TW")}`;
}
function cleanPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("886")) digits = `0${digits.slice(3)}`;
  return digits;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
}
function makeOrderId(prefix = "YU") {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  return `${prefix}-${ymd}-${[...bytes].map(v => chars[v % chars.length]).join("")}`;
}
function showToast(message) {
  $("#toastMsg").textContent = message;
  const toast = $("#toast");
  toast.classList.remove("translate-y-20", "opacity-0");
  window.setTimeout(() => toast.classList.add("translate-y-20", "opacity-0"), 2800);
}
function switchTab(tab) {
  $$(".tab-content").forEach((node) => node.classList.add("hidden"));
  $("#tab-" + tab)?.classList.remove("hidden");
  $$(".nav-btn").forEach((button) => {
    const active = button.dataset.tabTarget === tab;
    button.classList.toggle("bg-slate-800", active);
    button.classList.toggle("text-emerald-400", active);
    button.classList.toggle("text-slate-400", !active);
  });
  $("#mobileMenu").classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadProducts() {
  try {
    const snapshot = await getDocs(collection(db, "products"));
    if (!snapshot.empty) {
      products = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    }
  } catch (error) {
    console.warn("產品資料載入失敗，使用內建資料。", error);
  }
  products = products
    .filter((product) => product.visible !== false)
    .sort((a, b) => Number(a.order || 999) - Number(b.order || 999));
  renderProducts();
}

function primaryImage(product) {
  const list = Array.isArray(product.images) ? product.images : [];
  return list.find((image) => image.isPrimary)?.url || list[0]?.url || "";
}
function productCard(product) {
  const image = primaryImage(product);
  const visual = image
    ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" class="w-full h-full object-cover" loading="lazy" />`
    : `<div class="text-center text-emerald-400"><i class="fa-solid fa-motorcycle text-5xl"></i><p class="text-[10px] text-slate-500 mt-3">實車照片陸續更新</p></div>`;
  return `<article class="ev-card rounded-3xl p-5 flex flex-col gap-4">
    <div class="w-full h-48 bg-slate-950 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-800 relative">${visual}<span class="absolute top-3 right-3 text-[10px] bg-slate-950/80 text-emerald-400 font-bold px-2.5 py-1 rounded-full border border-emerald-500/20">${escapeHtml(product.tag || "微型電動")}</span></div>
    <div><span class="text-[10px] text-slate-400 font-bold">${escapeHtml(product.style || "")}</span><h3 class="text-xl font-black text-white">${escapeHtml(product.name)}</h3></div>
    <div class="flex justify-between items-center border-t border-slate-800 pt-3"><div><small class="text-slate-500 block">售價起</small><strong class="text-2xl font-black text-white">${money(product.priceLead)}</strong></div><button class="open-product bg-emerald-500 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs" data-product-id="${escapeHtml(product.id)}">訂購／試算</button></div>
  </article>`;
}
function renderProducts() {
  const html = products.map(productCard).join("");
  $("#scooterGrid").innerHTML = html || '<p class="text-slate-400">目前沒有上架商品。</p>';
  $("#homeScootersPreview").innerHTML = products.slice(0, 3).map(productCard).join("");
  $$(".open-product").forEach((button) => button.addEventListener("click", () => openCheckout(button.dataset.productId)));
}

function setMainPhoto(url) {
  const container = $("#modalPhotoSwiper");
  container.innerHTML = url
    ? `<img src="${escapeHtml(url)}" class="w-full h-full object-cover" alt="車款照片" />`
    : `<div class="text-center text-slate-500"><i class="fa-solid fa-motorcycle text-4xl mb-2"></i><p>實車照片陸續更新</p></div>`;
}
function renderProductModal() {
  if (!currentProduct) return;
  $("#modalItemTitle").textContent = `${currentProduct.name}（${currentProduct.style || ""}）`;
  const images = Array.isArray(currentProduct.images) ? currentProduct.images : [];
  setMainPhoto(primaryImage(currentProduct));
  $("#modalThumbs").innerHTML = images.map((image) => `<button type="button" class="modal-thumb shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-slate-700" data-url="${escapeHtml(image.url)}"><img src="${escapeHtml(image.url)}" class="w-full h-full object-cover" /></button>`).join("");
  $$(".modal-thumb").forEach((button) => button.addEventListener("click", () => setMainPhoto(button.dataset.url)));

  const variants = [{ value:"LEAD_ACID", label:"鉛酸版", price:Number(currentProduct.priceLead || 0) }];
  if (Number(currentProduct.priceLithium || 0) > 0) variants.push({ value:"LITHIUM", label:"鋰鐵30Ah版", price:Number(currentProduct.priceLithium) });
  $("#modalBatteryOpt").innerHTML = variants.map((variant) => `<option value="${variant.value}" data-price="${variant.price}">${variant.label}</option>`).join("");
  const colors = Array.isArray(currentProduct.colors) && currentProduct.colors.length ? currentProduct.colors : ["顏色請洽客服"];
  $("#modalColorOpt").innerHTML = colors.map((color) => `<option>${escapeHtml(color)}</option>`).join("");
  recalcModal();
}
function newCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  captchaAnswer = a + b;
  $("#mathCaptchaQuestion").textContent = `${a} + ${b} = ?`;
  $("#mathCaptchaAnswer").value = "";
}
function newPlateCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  plateCaptchaAnswer = a + b;
  $("#plateMathCaptchaQuestion").textContent = `${a} + ${b} = ?`;
  $("#plateMathCaptchaAnswer").value = "";
}
function openCheckout(productId) {
  currentProduct = products.find((product) => product.id === productId);
  if (!currentProduct) return;
  $("#checkoutSubmitForm").reset();
  renderProductModal();
  newCaptcha();
  const modal = $("#checkoutModal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}
function closeCheckout() {
  const modal = $("#checkoutModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}
function recalcModal() {
  const option = $("#modalBatteryOpt").selectedOptions[0];
  const price = Number(option?.dataset.price || 0);
  $("#modalFinalTotalText").textContent = money(price);
  $("#modalVariantText").textContent = `${option?.textContent || ""}｜${$("#modalColorOpt").value || ""}`;
}

async function submitVehicleOrder(event) {
  event.preventDefault();
  if (!currentProduct) return;
  if ($("#hpSecurityCheck").value) return;
  if (Number($("#mathCaptchaAnswer").value) !== captchaAnswer) {
    newCaptcha();
    showToast("人類驗證答案錯誤，請重新計算。");
    return;
  }
  const customerName = $("#formCustName").value.trim();
  const phone = cleanPhone($("#formCustPhone").value);
  const address = $("#formCustAddress").value.trim();
  if (!customerName || phone.length < 9 || !address) {
    showToast("請確認姓名、手機號碼與配送地址。");
    return;
  }
  const variantOption = $("#modalBatteryOpt").selectedOptions[0];
  const price = Number(variantOption.dataset.price || 0);
  const variant = variantOption.textContent;
  const color = $("#modalColorOpt").value;
  const orderId = makeOrderId("YU");
  const orderData = {
    orderNo: orderId,
    orderId,
    source: "official-store",
    customerName,
    custName: customerName,
    phone,
    custPhone: phone,
    address,
    custAddress: address,
    model: currentProduct.name,
    itemName: `${currentProduct.name} ${currentProduct.style || ""}`.trim(),
    color,
    vehicleVariant: variant,
    battery: variant.includes("鋰") ? "鋰鐵30Ah" : "鉛酸",
    price,
    totalAmount: money(price),
    cost: 0,
    netProfit: price,
    deposit: 0,
    balancePaid: 0,
    licenseMode: "代辦",
    deliveryMode: "到府交車",
    paymentMethod: "待確認",
    paymentTerms: "待客服確認",
    status: "待訂金",
    deliveredAt: "",
    notes: "官方商城送出，待客服確認規格、交期與訂金。",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    timestamp: serverTimestamp(),
    createdBy: "public-store",
    updatedBy: "public-store"
  };

  const submitButton = event.submitter;
  submitButton.disabled = true;
  submitButton.textContent = "訂單送出中…";
  try {
    await setDoc(doc(db, "orders", orderId), orderData);
    const message = `您好小宇，我已從官方商城送出訂單：\n訂單編號：${orderId}\n車款：${currentProduct.name}（${currentProduct.style || ""}）\n規格：${variant}\n顏色：${color}\n金額：${money(price)}\n姓名：${customerName}\n電話：${phone}\n地址：${address}\n請協助確認訂金與交車安排。`;
    try { await navigator.clipboard.writeText(message); } catch {}
    closeCheckout();
    showToast(`訂單 ${orderId} 已建立，資料已複製，正在開啟 LINE。`);
    window.setTimeout(() => window.open(storeConfig.lineUrl || "https://line.me/R/ti/p/@762eqvlg", "_blank", "noopener"), 700);
  } catch (error) {
    console.error(error);
    showToast(String(error?.code || "").includes("permission-denied") ? "訂單送出失敗：請發布 v12.2 Firestore 規則。" : "訂單送出失敗，請改用官方 LINE 聯絡。" );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "送出訂單並開啟 LINE";
  }
}

async function submitPlateOrder(event) {
  event.preventDefault();
  if ($("#plateHpSecurityCheck").value) return;
  if (Number($("#plateMathCaptchaAnswer").value) !== plateCaptchaAnswer) {
    newPlateCaptcha();
    showToast("人類驗證答案錯誤，請重新計算。");
    return;
  }
  const customerName = $("#plateCustName").value.trim();
  const phone = cleanPhone($("#plateCustPhone").value);
  const address = $("#plateCustAddress").value.trim();
  const plateNumber = $("#plateNumberInput").value.trim().toUpperCase();
  const plateType = $("#plateTypeInput").value;
  if (!customerName || phone.length < 9 || !address || !plateNumber) return showToast("請完整填寫訂製資料。");
  const orderId = makeOrderId("PLATE");
  const price = Number(storeConfig.platePrice || 9500);
  const deposit = Number(storeConfig.plateDeposit || 5500);
  const data = {
    orderNo: orderId, orderId, source:"official-store-plate",
    customerName, custName:customerName, phone, custPhone:phone, address, custAddress:address,
    model:"紀念展示車牌", itemName:`${plateType}｜${plateNumber}`, color:"依訂製樣式", vehicleVariant:plateType, battery:"不適用",
    price, totalAmount:money(price), cost:0, netProfit:price, deposit:0, balancePaid:0,
    licenseMode:"自行辦理", deliveryMode:"物流寄送", paymentMethod:"轉帳", paymentTerms:`訂金 ${money(deposit)}／尾款 ${money(Number(storeConfig.plateBalance || 4000))}（貨到付款）`,
    status:"待訂金", deliveredAt:"", notes:`訂製號碼：${plateNumber}。僅供紀念展示，不可上路使用。`,
    createdAt:serverTimestamp(), updatedAt:serverTimestamp(), timestamp:serverTimestamp(), createdBy:"public-store", updatedBy:"public-store"
  };
  const button = event.submitter;
  button.disabled = true;
  button.textContent = "送出中…";
  try {
    await setDoc(doc(db,"orders",orderId),data);
    const message=`您好小宇，我要訂製紀念展示牌：\n訂單編號：${orderId}\n類型：${plateType}\n號碼：${plateNumber}\n姓名：${customerName}\n電話：${phone}\n收件資料：${address}\n付款方式：訂金 ${money(deposit)}／尾款 ${money(Number(storeConfig.plateBalance || 4000))}（貨到付款）
請協助確認付款。`;
    try { await navigator.clipboard.writeText(message); } catch {}
    showToast(`訂製需求 ${orderId} 已建立，正在開啟 LINE。`);
    window.setTimeout(() => window.open(storeConfig.lineUrl || "https://line.me/R/ti/p/@762eqvlg", "_blank", "noopener"), 700);
    event.target.reset();
    newPlateCaptcha();
  } catch (error) {
    console.error(error);
    showToast("送出失敗，請改用官方 LINE 聯絡。");
  } finally {
    button.disabled = false;
    button.textContent = "送出訂製需求";
  }
}

function updatePlatePreview() {
  const number = $("#plateNumberInput").value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12) || "ABC-1234";
  $("#plateNumberInput").value = number;
  $("#platePreviewNumber").textContent = number;
}
function updateFinance() {
  const amount = Math.max(0, Number($("#financeAmount").value) || 0);
  const term = Math.max(1, Number($("#financeTerm").value) || 12);
  const rate = Math.max(0, Number($("#financeRate").value) || 0) / 100;
  const total = Math.round(amount * (1 + rate));
  const monthly = Math.ceil(total / term);
  $("#financeTotal").textContent = money(total);
  $("#financeMonthly").textContent = money(monthly);
}

$$('[data-tab-target]').forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tabTarget)));
$("#mobileMenuBtn").addEventListener("click", () => $("#mobileMenu").classList.toggle("hidden"));
$("#closeCheckoutBtn").addEventListener("click", closeCheckout);
$("#checkoutModal").addEventListener("click", (event) => { if (event.target === $("#checkoutModal")) closeCheckout(); });
$("#modalBatteryOpt").addEventListener("change", recalcModal);
$("#modalColorOpt").addEventListener("change", recalcModal);
$("#checkoutSubmitForm").addEventListener("submit", submitVehicleOrder);
$("#plateOrderForm").addEventListener("submit", submitPlateOrder);
$("#plateNumberInput").addEventListener("input", updatePlatePreview);
["#financeAmount", "#financeTerm", "#financeRate"].forEach((selector) => $(selector).addEventListener("input", updateFinance));

$("#platePriceText").textContent = money(storeConfig.platePrice || 9500);
$("#plateDepositText").textContent = money(storeConfig.plateDeposit || 5500);
$("#plateBalanceText").textContent = money(storeConfig.plateBalance || 4000);
updatePlatePreview();
updateFinance();
newPlateCaptcha();
loadProducts();
