import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { collection, doc, getDocs, getFirestore, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const firebaseConfig = window.LUCKY_GARAGE_FIREBASE_CONFIG || {};
const storeConfig = window.YU_STORE_CONFIG || {};
const defaults = Array.isArray(window.YU_PRODUCT_CATALOG) ? window.YU_PRODUCT_CATALOG : [];
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
let products = defaults.map((p) => structuredClone(p));
let currentProduct = null;
let captchaValue = 0;
let currentFilter = "all";

const money = (value) => `NT$${Math.max(0, Number(value) || 0).toLocaleString("zh-TW")}`;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
function cleanPhone(value){ let digits=String(value||"").replace(/\D/g,""); if(digits.startsWith("886")) digits=`0${digits.slice(3)}`; return digits; }
function makeOrderId(){ const d=new Date(); const ymd=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`; const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const bytes=new Uint32Array(4); crypto.getRandomValues(bytes); return `YU-${ymd}-${[...bytes].map(v=>chars[v%chars.length]).join("")}`; }
function showToast(message){ const t=$("#toast"); t.textContent=message; t.classList.add("show"); clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>t.classList.remove("show"),3200); }
function imageUrls(product){ const items=Array.isArray(product.images)?product.images:[]; return items.map((item)=>typeof item==="string"?item:item?.url).filter(Boolean); }
function mergeProducts(remote){
  const map=new Map(defaults.map((p)=>[p.id,structuredClone(p)]));
  for(const item of remote){
    const base=map.get(item.id) || {};
    const remoteImages=imageUrls(item);
    map.set(item.id,{...base,...item,images:remoteImages.length?remoteImages:imageUrls(base)});
  }
  return [...map.values()].filter((p)=>p.visible!==false).sort((a,b)=>Number(a.order||999)-Number(b.order||999));
}
function productMatches(p){ if(currentFilter==="all") return true; if(currentFilter==="展示") return String(p.tag||"").includes("展示")||String(p.name||"").includes("三輪"); return String(p.tag||"").includes(currentFilter); }
function card(p){ const images=imageUrls(p); return `<article class="product-card" id="${escapeHtml(p.id)}"><button class="product-photo open-product" type="button" data-id="${escapeHtml(p.id)}"><img src="${escapeHtml(images[0]||"")}" alt="${escapeHtml(p.name)} 實車照片" loading="lazy"><span class="tag">${escapeHtml(p.tag||"微型電動")}</span></button><div class="product-body"><div><span class="product-style">${escapeHtml(p.style||"")}</span><h3>${escapeHtml(p.name)}</h3></div><div class="spec-row"><span>🔋 ${escapeHtml(p.battery||"規格洽詢")}</span><span>⚡ ${escapeHtml(p.motor||"規格洽詢")}</span><span>🏁 ${escapeHtml(p.speed||"洽客服")}</span><span>🛣️ ${escapeHtml(p.range||"洽客服")}</span></div><div class="price-row"><div><small>售價起</small><strong class="price">${money(p.priceLead)}</strong></div><button class="btn btn-primary open-product" type="button" data-id="${escapeHtml(p.id)}">看詳情／訂購</button></div></div></article>`; }
function render(){ const list=products.filter(productMatches); $("#productGrid").innerHTML=list.length?list.map(card).join(""):'<p class="empty">此分類目前沒有商品。</p>'; $$(".open-product").forEach((b)=>b.addEventListener("click",()=>openProduct(b.dataset.id))); }
async function loadProducts(){
  render();
  try{ const snap=await getDocs(collection(db,"products")); products=mergeProducts(snap.docs.map((d)=>({id:d.id,...d.data()}))); render(); }
  catch(error){ console.warn("Firebase 商品資料無法讀取，使用網站內建商品。",error); products=mergeProducts([]); render(); }
  const hash=decodeURIComponent(location.hash.replace(/^#/,"")); if(hash&&products.some((p)=>p.id===hash)) setTimeout(()=>openProduct(hash),50);
}
function newCaptcha(){ const a=Math.floor(Math.random()*8)+2,b=Math.floor(Math.random()*8)+2; captchaValue=a+b; $("#captchaQuestion").textContent=`人類驗證：${a} + ${b} = ?`; $("#captchaAnswer").value=""; }
function setMainPhoto(url,index=0){ $("#mainPhoto").src=url||""; $$(".thumb").forEach((b,i)=>b.classList.toggle("active",i===index)); }
function updateTotal(){ const opt=$("#variant").selectedOptions[0]; $("#total").textContent=money(opt?.dataset.price||0); }
function openProduct(id){
  currentProduct=products.find((p)=>p.id===id); if(!currentProduct) return;
  const images=imageUrls(currentProduct); $("#modalTitle").textContent=`${currentProduct.name}｜商品詳情`; $("#modalStyle").textContent=`${currentProduct.tag||""}・${currentProduct.style||""}`; $("#modalName").textContent=currentProduct.name; $("#modalNote").textContent=currentProduct.note||"實際規格與現車請洽客服確認。"; $("#modalBattery").textContent=currentProduct.battery||"洽客服"; $("#modalMotor").textContent=currentProduct.motor||"洽客服"; $("#modalSpeed").textContent=currentProduct.speed||"洽客服"; $("#modalRange").textContent=currentProduct.range||"洽客服";
  $("#thumbs").innerHTML=images.map((url,i)=>`<button class="thumb ${i===0?'active':''}" type="button" data-index="${i}"><img src="${escapeHtml(url)}" alt="${escapeHtml(currentProduct.name)} 圖片 ${i+1}"></button>`).join(""); $$(".thumb").forEach((b)=>b.addEventListener("click",()=>setMainPhoto(images[Number(b.dataset.index)],Number(b.dataset.index)))); setMainPhoto(images[0]||"");
  const variants=[{label:"鉛酸版",price:Number(currentProduct.priceLead||0)}]; if(Number(currentProduct.priceLithium||0)>0) variants.push({label:"鋰鐵30Ah版",price:Number(currentProduct.priceLithium)}); $("#variant").innerHTML=variants.map((v)=>`<option data-price="${v.price}">${escapeHtml(v.label)}</option>`).join(""); $("#color").innerHTML=(currentProduct.colors||["顏色請洽客服"]).map((c)=>`<option>${escapeHtml(c)}</option>`).join("");
  $("#orderForm").reset(); updateTotal(); newCaptcha(); $("#productModal").classList.add("open"); $("#productModal").setAttribute("aria-hidden","false"); document.body.style.overflow="hidden"; history.replaceState(null,"",`#${id}`);
}
function closeProduct(){ $("#productModal").classList.remove("open"); $("#productModal").setAttribute("aria-hidden","true"); document.body.style.overflow=""; currentProduct=null; history.replaceState(null,"",location.pathname+location.search); }
async function submitOrder(event){
  event.preventDefault(); if(!currentProduct||$("#website").value) return;
  if(Number($("#captchaAnswer").value)!==captchaValue){ newCaptcha(); showToast("驗證答案錯誤，請重新計算。"); return; }
  const customerName=$("#customerName").value.trim(), phone=cleanPhone($("#phone").value), address=$("#address").value.trim(), customerNote=$("#customerNote").value.trim();
  if(!customerName||phone.length<9||address.length<3){ showToast("請確認姓名、手機與送車地址。"); return; }
  const option=$("#variant").selectedOptions[0], variant=option.textContent, price=Math.round(Number(option.dataset.price||0)), color=$("#color").value, orderId=makeOrderId();
  const data={orderNo:orderId,orderId,source:"official-store",customerName,custName:customerName,phone,custPhone:phone,address,custAddress:address,model:currentProduct.name,itemName:`${currentProduct.name} ${currentProduct.style||""}`.trim(),color,vehicleVariant:variant,battery:variant.includes("鋰")?"鋰鐵30Ah":"鉛酸",price,totalAmount:money(price),cost:0,netProfit:price,deposit:0,balancePaid:0,licenseMode:"代辦",deliveryMode:"到府交車",paymentMethod:"待確認",paymentTerms:"待客服確認",status:"待訂金",deliveredAt:"",notes:`官方商城送出，待客服確認規格、交期與訂金。${customerNote?` 客戶備註：${customerNote}`:""}`,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),timestamp:serverTimestamp(),createdBy:"public-store",updatedBy:"public-store"};
  const btn=$("#submitOrder"); btn.disabled=true; btn.textContent="訂單送出中…";
  try{ await setDoc(doc(db,"orders",orderId),data); const message=`您好小宇，我已從官方商城送出訂單：\n訂單編號：${orderId}\n車款：${currentProduct.name}（${currentProduct.style||""}）\n規格：${variant}\n顏色：${color}\n參考售價：${money(price)}\n姓名：${customerName}\n電話：${phone}\n地址：${address}${customerNote?`\n備註：${customerNote}`:""}\n請協助確認訂金與交車安排。`; try{await navigator.clipboard.writeText(message);}catch{} showToast(`訂單 ${orderId} 已建立，正在開啟 LINE。`); setTimeout(()=>window.location.href=(storeConfig.lineUrl||"https://line.me/R/ti/p/@762eqvlg"),650); closeProduct(); }
  catch(error){ console.error(error); showToast(String(error?.code||"").includes("permission-denied")?"訂單未送出：請確認 Firestore 規則已發布。":"訂單送出失敗，請直接聯絡官方 LINE。"); }
  finally{ btn.disabled=false; btn.textContent="送出訂單需求並開啟 LINE"; }
}
$$(".filter-btn").forEach((b)=>b.addEventListener("click",()=>{currentFilter=b.dataset.filter; $$(".filter-btn").forEach((x)=>x.classList.toggle("active",x===b)); render();}));
$("#closeModal").addEventListener("click",closeProduct); $("#productModal").addEventListener("click",(e)=>{if(e.target===$("#productModal")) closeProduct();}); $("#variant").addEventListener("change",updateTotal); $("#orderForm").addEventListener("submit",submitOrder); document.addEventListener("keydown",(e)=>{if(e.key==="Escape") closeProduct();});
loadProducts();
