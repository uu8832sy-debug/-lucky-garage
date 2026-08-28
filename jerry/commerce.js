import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { collection, doc, getDocs, getFirestore, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const SHOP_ID="jerry";
const app=getApps().length?getApp():initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG||{});
const db=getFirestore(app);
const grid=document.querySelector("#productGrid");
let products=[];
let selectedProduct=null;
let selectedVariant=null;
const money=n=>`NT$ ${Math.max(0,Number(n)||0).toLocaleString("zh-TW")}`;
const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

function imagesOf(p){
  const list=Array.isArray(p?.images)?p.images:[];
  const urls=list.map(x=>typeof x==="string"?x:x?.url).filter(Boolean);
  if(!urls.length && p?.imageUrl) urls.push(p.imageUrl);
  if(!urls.length && p?.photoUrl) urls.push(p.photoUrl);
  return [...new Set(urls)];
}
function variantsOf(p){
  const out=[];
  if(Number(p?.priceLead)>0) out.push({key:"lead",label:"鉛酸版",price:Number(p.priceLead)});
  if(Number(p?.priceLithium)>0) out.push({key:"lithium",label:"鋰電版",price:Number(p.priceLithium)});
  if(!out.length && Number(p?.price)>0) out.push({key:"default",label:p.style||"標準版",price:Number(p.price)});
  return out;
}
function injectModals(){
  if(document.querySelector("#bikeDetailModal")) return;
  document.body.insertAdjacentHTML("beforeend",`
  <div id="bikeDetailModal" class="store-modal" hidden>
    <div class="store-modal-backdrop" data-close-store></div>
    <section class="store-dialog"><button class="store-close" data-close-store aria-label="關閉">×</button>
      <div class="detail-grid"><div class="detail-gallery"><div id="detailMainPhoto" class="detail-main-photo"></div><div id="detailThumbs" class="detail-thumbs"></div></div>
      <div class="detail-info"><span class="detail-kicker">JERRY E-BIKE</span><h2 id="detailName"></h2><div id="detailStyle" class="detail-style"></div><p id="detailDescription" class="detail-description"></p><div id="detailPrice" class="detail-price"></div>
      <div class="detail-meta"><div><span>版本</span><select id="detailVariant" style="max-width:180px;border:1px solid #d6dbe1;border-radius:10px;padding:8px;background:#fff"></select></div><div><span>標籤</span><b id="detailTag"></b></div><div><span>可選顏色</span><b id="detailColors"></b></div><div><span>照片</span><b id="detailPhotoCount"></b></div></div>
      <div class="detail-actions"><button id="detailOrderBtn" class="detail-order">立即下單</button><button id="detailFinanceBtn" class="detail-finance">分期／刷卡試算</button></div></div></div>
    </section>
  </div>
  <div id="orderModal" class="store-modal" hidden>
    <div class="store-modal-backdrop" data-close-order></div>
    <section class="store-dialog order-dialog"><button class="store-close" data-close-order aria-label="關閉">×</button>
      <div id="orderContent"><div class="order-head"><small>ONLINE ORDER</small><h2>線上下單</h2><p id="orderProductText"></p></div>
      <form id="orderForm" class="order-form"><div class="order-summary"><span id="orderSummaryName"></span><b id="orderSummaryPrice"></b></div>
      <div class="order-form-grid"><label>姓名<input id="orderName" required maxlength="40" placeholder="請輸入姓名"></label><label>手機<input id="orderPhone" required maxlength="20" inputmode="tel" placeholder="09xxxxxxxx"></label></div>
      <div class="order-form-grid"><label>取車方式<select id="orderDelivery"><option value="pickup">門市自取</option><option value="delivery">配送／送車</option></select></label><label>付款方式<select id="orderPayment"><option>現金／轉帳</option><option>信用卡</option><option>分期</option><option>LINE Pay</option></select></label></div>
      <label>領牌方式<select id="orderLicense"><option value="agent">代辦領牌（+ NT$2,500）</option><option value="self">自行辦理</option></select></label><p id="orderPriceRule" class="order-price-rule"></p>
      <label>地址／取車資訊<input id="orderAddress" required maxlength="180" value="門市自取"></label><label>備註<textarea id="orderNote" maxlength="300" placeholder="顏色、交車時間、其他需求"></textarea></label>
      <label>真人驗證：<span id="orderChallengeLabel"></span><input id="orderChallenge" required inputmode="numeric" maxlength="3" placeholder="請輸入答案"></label>
      <button id="orderSubmit" class="order-submit" type="submit">送出訂單</button><div id="orderStatus" class="order-status"></div></form></div>
    </section>
  </div>`);

  document.querySelectorAll("[data-close-store]").forEach(el=>el.addEventListener("click",()=>closeModal("#bikeDetailModal")));
  document.querySelectorAll("[data-close-order]").forEach(el=>el.addEventListener("click",()=>closeModal("#orderModal")));
  document.querySelector("#detailVariant")?.addEventListener("change",e=>{selectedVariant=variantsOf(selectedProduct).find(v=>v.key===e.target.value)||variantsOf(selectedProduct)[0];syncDetailVariant();});
  document.querySelector("#detailOrderBtn")?.addEventListener("click",()=>openOrder(selectedProduct,selectedVariant));
  document.querySelector("#detailFinanceBtn")?.addEventListener("click",()=>{
    if(!selectedProduct||!selectedVariant) return;
    closeModal("#bikeDetailModal");
    const fake=document.createElement("button"); fake.dataset.financePrice=String(selectedVariant.price); fake.dataset.financeName=`${selectedProduct.name||"車款"} ${selectedVariant.label}`; fake.style.display="none"; document.body.append(fake); fake.click(); fake.remove();
  });
  document.querySelector("#orderDelivery")?.addEventListener("change",e=>{const a=document.querySelector("#orderAddress");if(e.target.value==="pickup")a.value="門市自取";else if(a.value==="門市自取")a.value="";});
  document.querySelector("#orderPayment")?.addEventListener("change",syncOrderTotal);
  document.querySelector("#orderLicense")?.addEventListener("change",syncOrderTotal);
  document.querySelector("#orderForm")?.addEventListener("submit",submitOrder);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal("#bikeDetailModal");closeModal("#orderModal");}});
}
function openModal(sel){const el=document.querySelector(sel);if(el){el.hidden=false;document.body.classList.add("store-modal-open");}}
function closeModal(sel){const el=document.querySelector(sel);if(el)el.hidden=true;if(![...document.querySelectorAll(".store-modal")].some(x=>!x.hidden))document.body.classList.remove("store-modal-open");}

function renderCards(){
  if(!grid) return;
  if(!products.length){grid.innerHTML='<div class="empty-card">目前現車資料整理中。店家可從後台「商品與圖片」上傳車照，上傳後這裡會自動顯示。</div>';return;}
  grid.innerHTML=products.map(p=>{const imgs=imagesOf(p),vars=variantsOf(p),v=vars[0];return `<article class="product-card commerce-card" data-commerce-card data-product-id="${esc(p.id)}">
    <div class="product-media">${imgs[0]?`<img src="${esc(imgs[0])}" alt="${esc(p.name||"車款")}" loading="lazy">`:`<img src="/jerry/admin-logo.png" alt="Jerry E-Bike">`}<span class="photo-count">${imgs.length?`${imgs.length} 張照片`:"待上傳車照"}</span></div>
    <div class="product-body"><span class="product-tag">${esc(p.tag||"JERRY E-BIKE")}</span><h3>${esc(p.name||"未命名車款")}</h3><div class="product-style">${esc(p.style||"")}</div>${p.description?`<p class="product-description">${esc(p.description)}</p>`:""}<div class="product-price">${v?`${money(v.price)} 起`:"請洽店家"}</div>
    <div class="product-colors">顏色：<b>${esc(Array.isArray(p.colors)?p.colors.join("、"):"請洽門市")}</b></div><div class="product-card-actions"><button class="view-bike" type="button">看車照／詳情</button><button class="order-bike" type="button">立即下單</button></div></div></article>`}).join("");
  grid.querySelectorAll("[data-product-id]").forEach(card=>{const p=products.find(x=>x.id===card.dataset.productId);card.querySelector(".view-bike")?.addEventListener("click",e=>{e.stopPropagation();openDetail(p)});card.querySelector(".order-bike")?.addEventListener("click",e=>{e.stopPropagation();openOrder(p,variantsOf(p)[0])});card.addEventListener("click",()=>openDetail(p));});
}
function renderPhoto(index){const imgs=imagesOf(selectedProduct),main=document.querySelector("#detailMainPhoto"),thumbs=document.querySelector("#detailThumbs");if(!imgs.length){main.innerHTML='<div class="no-photo"><img src="/jerry/admin-logo.png" alt="Jerry E-Bike" style="width:180px;max-width:70%;border-radius:50%"><p>尚未上傳實車照片</p></div>';thumbs.innerHTML="";return;}main.innerHTML=`<img src="${esc(imgs[index]||imgs[0])}" alt="${esc(selectedProduct?.name||"車款")}">`;thumbs.innerHTML=imgs.map((src,i)=>`<button type="button" class="${i===index?'active':''}" data-photo-index="${i}"><img src="${esc(src)}" alt=""></button>`).join("");thumbs.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>renderPhoto(Number(b.dataset.photoIndex))));}
function syncDetailVariant(){if(!selectedProduct||!selectedVariant)return;document.querySelector("#detailPrice").textContent=money(selectedVariant.price);document.querySelector("#detailVariant").value=selectedVariant.key;}
function openDetail(p){if(!p)return;injectModals();selectedProduct=p;const vars=variantsOf(p);selectedVariant=vars[0]||{key:"default",label:"請洽門市",price:0};document.querySelector("#detailName").textContent=p.name||"車款";document.querySelector("#detailStyle").textContent=p.style||"";document.querySelector("#detailDescription").textContent=p.description||"";document.querySelector("#detailTag").textContent=p.tag||"—";document.querySelector("#detailColors").textContent=Array.isArray(p.colors)&&p.colors.length?p.colors.join("、"):"請洽門市";document.querySelector("#detailPhotoCount").textContent=`${imagesOf(p).length} 張`;document.querySelector("#detailVariant").innerHTML=vars.length?vars.map(v=>`<option value="${v.key}">${esc(v.label)}｜${money(v.price)}</option>`).join(""):'<option value="default">請洽門市</option>';syncDetailVariant();renderPhoto(0);openModal("#bikeDetailModal");}
function orderPricing(){const base=Math.round(Number(selectedVariant?.price)||0),licenseMode=document.querySelector("#orderLicense")?.value||"agent",payment=document.querySelector("#orderPayment")?.value||"現金／轉帳",licenseFee=licenseMode==="agent"?2500:0,subtotal=base+licenseFee,cardFee=payment==="信用卡"?Math.round(subtotal*.035):0;return{base,licenseMode,licenseFee,payment,cardFee,total:subtotal+cardFee};}
function syncOrderTotal(){const pricing=orderPricing(),total=document.querySelector("#orderSummaryPrice"),rule=document.querySelector("#orderPriceRule");if(total)total.textContent=pricing.total?money(pricing.total):"門市報價";if(rule)rule.textContent=`車價 ${money(pricing.base)}${pricing.licenseFee?` ＋ 代辦領牌 ${money(pricing.licenseFee)}`:" ＋ 自行領牌"}${pricing.cardFee?` ＋ 刷卡 3.5% ${money(pricing.cardFee)}`:""}`;}
function newChallenge(){const a=2+Math.floor(Math.random()*8),b=1+Math.floor(Math.random()*9);document.querySelector("#orderChallengeLabel").textContent=`${a} + ${b} = ?`;document.querySelector("#orderChallenge").value="";document.querySelector("#orderChallenge").dataset.answer=String(a+b);}
function openOrder(p,v){if(!p)return;injectModals();selectedProduct=p;selectedVariant=v||variantsOf(p)[0]||{key:"default",label:p.style||"車款",price:Number(p.price)||0};document.querySelector("#orderProductText").textContent=`${p.name||"車款"}・${selectedVariant.label}`;document.querySelector("#orderSummaryName").textContent=`${p.name||"車款"} ${selectedVariant.label}`;document.querySelector("#orderLicense").value="agent";document.querySelector("#orderPayment").value="現金／轉帳";syncOrderTotal();newChallenge();document.querySelector("#orderStatus").textContent="";document.querySelector("#orderSubmit").disabled=false;document.querySelector("#orderSubmit").textContent="送出待驗證訂單";closeModal("#bikeDetailModal");openModal("#orderModal");}
function makeOrderId(){const d=new Date(),pad=n=>String(n).padStart(2,"0");return `JE${String(d.getFullYear()).slice(-2)}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${Math.floor(10+Math.random()*90)}`;}
async function submitOrder(e){e.preventDefault();if(!selectedProduct||!selectedVariant)return;const btn=document.querySelector("#orderSubmit"),status=document.querySelector("#orderStatus"),challenge=document.querySelector("#orderChallenge");const name=document.querySelector("#orderName").value.trim(),phone=document.querySelector("#orderPhone").value.trim(),delivery=document.querySelector("#orderDelivery").value,address=document.querySelector("#orderAddress").value.trim(),note=document.querySelector("#orderNote").value.trim(),pricing=orderPricing(),licenseMode=pricing.licenseMode==="agent"?"代辦":"自行辦理";if(name.length<1||phone.length<9||address.length<3){status.className="order-status error";status.textContent="請確認姓名、手機與地址／取車資訊。";return;}if(challenge.value.trim()!==challenge.dataset.answer){status.className="order-status error";status.textContent="真人驗證答案不正確，請重新計算。";newChallenge();return;}const orderId=makeOrderId(),verificationCode=String(Math.floor(100000+Math.random()*900000));btn.disabled=true;btn.textContent="送出中…";status.className="order-status";status.textContent="";try{await setDoc(doc(db,"shops",SHOP_ID,"orders",orderId),{orderId,orderNo:orderId,shopId:SHOP_ID,source:"official-store",customerName:name,phone,address,model:selectedProduct.name||"車款",variant:`${selectedProduct.style||""} ${selectedVariant.label}`.trim(),vehicleVariant:selectedVariant.label,color:"待確認",basePrice:pricing.base,licenseMode,licenseFee:pricing.licenseFee,cardSurchargePercent:pricing.payment==="信用卡"?3.5:0,cardSurchargeAmount:pricing.cardFee,price:pricing.total,status:"待驗證",verificationStatus:"pending",verificationCode,productId:selectedProduct.id||"",deliveryMethod:delivery,deliveryMode:delivery==="pickup"?"自取":"配送／送車",paymentMethod:pricing.payment,note,notes:note,deposit:0,balancePaid:0,createdAt:serverTimestamp()});const verifyUrl=`https://line.me/R/ti/p/@882npfrm?text=${encodeURIComponent(`訂單 ${orderId} 驗證碼 ${verificationCode}`)}`;document.querySelector("#orderContent").innerHTML=`<div class="order-success"><div class="check">✓</div><h2>訂單等待驗證</h2><p>請把以下驗證碼傳到傑瑞官方 LINE；店家核對後訂單才正式成立。</p><b>${verificationCode}</b><p>${esc(selectedProduct.name||"車款")}・${esc(selectedVariant.label)}・${money(pricing.total)}</p><a class="detail-order" href="${verifyUrl}" target="_blank" rel="noopener" style="display:inline-grid;place-items:center;min-height:48px;padding:0 20px;border-radius:13px;background:#06c755;color:#fff;font-weight:900;text-decoration:none">傳驗證碼到 LINE</a><br><button type="button" id="orderDone">稍後處理</button></div>`;document.querySelector("#orderDone")?.addEventListener("click",()=>closeModal("#orderModal"));}catch(err){console.error(err);status.className="order-status error";status.textContent="送出失敗，請先用 LINE 聯絡店家；若持續失敗需部署最新版 Firestore Rules。";btn.disabled=false;btn.textContent="重新送出";}}

async function renderCommerceProducts(){
  try{const snap=await getDocs(collection(db,"shops",SHOP_ID,"products"));products=snap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.visible!==false).sort((a,b)=>Number(a.order||999)-Number(b.order||999));renderCards();}catch(err){console.warn("commerce products",err);}
}
injectModals();
renderCommerceProducts();
if(grid){new MutationObserver(()=>{if(!grid.querySelector("[data-commerce-card]")&&!grid.querySelector(".loading-card"))setTimeout(renderCards,0);}).observe(grid,{childList:true});}
