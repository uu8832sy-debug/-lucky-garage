import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const SHOP_ID = "jerry";
const OWNER_EMAIL = "uu8832sr@gmail.com";
const JERRY_EMAIL = "a0975607339@gmail.com";
const app = initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG || {});
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (s) => document.querySelector(s);
const money = (n) => `NT$${Math.max(0, Number(n) || 0).toLocaleString("zh-TW")}`;
const esc = (v) => String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

const CATALOG = {
  "大偉士": [
    ["鉛酸電池｜一般版",38000],["鉛酸電池｜特仕版",43000],["72V 30Ah 鋰電｜一般版",53000],["72V 30Ah 鋰電｜特仕版",58000],["72V 40Ah 鋰電｜一般版",59000],["72V 40Ah 鋰電｜特仕版",64000],["72V 50Ah 鋰電｜一般版",64000],["72V 50Ah 鋰電｜特仕版",69000],["72V 65Ah 鋰電｜一般版",69000],["72V 65Ah 鋰電｜特仕版",74000],["72V 80Ah 鋰電｜一般版",75000],["72V 80Ah 鋰電｜特仕版",80000]
  ],
  "Z3 天鵝座": [
    ["鉛酸電池｜一般版",43000],["鉛酸電池｜特仕版",48000],["72V 30Ah 鋰電｜一般版",58000],["72V 30Ah 鋰電｜特仕版",63000],["72V 40Ah 鋰電｜一般版",64000],["72V 40Ah 鋰電｜特仕版",69000],["72V 50Ah 鋰電｜一般版",69000],["72V 50Ah 鋰電｜特仕版",74000],["72V 65Ah 鋰電｜一般版",74000],["72V 65Ah 鋰電｜特仕版",79000],["72V 80Ah 鋰電｜一般版",80000],["72V 80Ah 鋰電｜特仕版",85000]
  ],
  "正 9 號": [
    ["鉛酸電池｜一般版",45000],["鉛酸電池｜特仕版",50000],["72V 30Ah 鋰電｜一般版",60000],["72V 30Ah 鋰電｜特仕版",65000],["72V 40Ah 鋰電｜一般版",66000],["72V 40Ah 鋰電｜特仕版",71000],["72V 50Ah 鋰電｜一般版",71000],["72V 50Ah 鋰電｜特仕版",76000],["72V 65Ah 鋰電｜一般版",76000],["72V 65Ah 鋰電｜特仕版",81000],["72V 80Ah 鋰電｜一般版",82000],["72V 80Ah 鋰電｜特仕版",87000]
  ],
  "小偉士": [["48V 20Ah 鉛酸",32000],["60V 20Ah 鉛酸",33000],["48V 20Ah 鋰電",43000],["60V 30Ah 鋰電",49000],["72V 30Ah 鋰電",52000]],
  "極酷": [["48V 12Ah 鉛酸",20000],["48V 20Ah 鉛酸",23000],["48V 20Ah 鋰電",29000],["48V 30Ah 鋰電",33000]]
};
const STATUSES = ["待驗證","待訂金","已付訂金","備車中","待交車","已交車","取消"];
let orders = [];
let currentUser = null;

function toast(text){const el=$("#toast");el.textContent=text;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),1800);}
function cleanPhone(v){let d=String(v||"").replace(/\D/g,"");if(d.startsWith("886"))d=`0${d.slice(3)}`;return d;}
function ts(v){if(typeof v?.toMillis==="function")return v.toMillis();if(v?.seconds)return v.seconds*1000;return Date.parse(v||"")||0;}
function formatDate(v){const m=ts(v);return m?new Intl.DateTimeFormat("zh-TW",{dateStyle:"short",timeStyle:"short"}).format(new Date(m)):"—";}
function received(o){return Math.max(0,Number(o.deposit)||0)+Math.max(0,Number(o.balancePaid)||0);}
function due(o){return Math.max(0,(Number(o.price)||0)-received(o));}
function makeId(){const d=new Date(),p=n=>String(n).padStart(2,"0");return `JE${String(d.getFullYear()).slice(-2)}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${Math.floor(10+Math.random()*90)}`;}
function orderRef(id){return doc(db,"shops",SHOP_ID,"orders",id);}

async function canAccess(user){
  const email=String(user?.email||"").toLowerCase();
  if(email===OWNER_EMAIL||email===JERRY_EMAIL)return true;
  try{const snap=await getDoc(doc(db,"adminAccounts",user.uid));const d=snap.exists()?snap.data():{};return d.enabled===true&&d.shopId===SHOP_ID;}catch{return false;}
}
function showLogin(){currentUser=null;$("#loginCard").classList.remove("hidden");$("#deniedCard").classList.add("hidden");$("#app").classList.add("hidden");$("#logoutBtn").classList.add("hidden");}
function showDenied(user){$("#loginCard").classList.add("hidden");$("#deniedCard").classList.remove("hidden");$("#deniedText").textContent=user?.email||user?.uid||"未知帳號";$("#app").classList.add("hidden");}
async function showApp(user){currentUser=user;$("#loginCard").classList.add("hidden");$("#deniedCard").classList.add("hidden");$("#app").classList.remove("hidden");$("#logoutBtn").classList.remove("hidden");await loadOrders();}

async function loadOrders(){
  $("#orderBody").innerHTML='<tr><td colspan="8" class="empty">讀取中…</td></tr>';
  try{const snap=await getDocs(collection(db,"shops",SHOP_ID,"orders"));orders=snap.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>ts(b.updatedAt||b.createdAt)-ts(a.updatedAt||a.createdAt));render();}
  catch(e){console.error(e);$("#orderBody").innerHTML=`<tr><td colspan="8" class="empty">讀取失敗：${esc(e?.message||"請檢查 Firestore 規則")}</td></tr>`;}
}
function filtered(){const q=$("#searchInput").value.trim().toLowerCase(),s=$("#filterStatus").value;return orders.filter(o=>{const h=[o.id,o.orderNo,o.customerName,o.phone,o.model,o.vehicleVariant,o.variant,o.address].join(" ").toLowerCase();return(!q||h.includes(q))&&(!s||o.status===s);});}
function render(){
  const active=orders.filter(o=>o.status!=="取消");$("#statTotal").textContent=orders.length;$("#statPending").textContent=active.filter(o=>o.status!=="已交車").length;$("#statReceived").textContent=money(active.reduce((a,o)=>a+received(o),0));$("#statDue").textContent=money(active.reduce((a,o)=>a+due(o),0));
  const list=filtered();if(!list.length){$("#orderBody").innerHTML='<tr><td colspan="8" class="empty">目前沒有符合條件的訂單</td></tr>';return;}
  $("#orderBody").innerHTML=list.map(o=>`<tr><td><strong>${esc(o.orderNo||o.id)}</strong><small>${formatDate(o.createdAt)}</small></td><td><strong>${esc(o.customerName||"未命名")}</strong><small>${esc(o.phone||"—")}</small></td><td><strong>${esc(o.model||"—")}</strong><small>${esc(o.vehicleVariant||o.variant||"")}</small></td><td class="money">${money(o.price)}</td><td><strong>${money(received(o))}</strong><small class="due">待收 ${money(due(o))}</small></td><td>${esc(o.paymentMethod||"—")}</td><td><select class="status" data-status-id="${esc(o.id)}">${STATUSES.map(s=>`<option ${s===(o.status||"待訂金")?"selected":""}>${s}</option>`).join("")}</select></td><td><div class="rowactions"><button class="btn dark" data-edit="${esc(o.id)}">編輯</button></div></td></tr>`).join("");
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
  document.querySelectorAll("[data-status-id]").forEach(s=>s.onchange=async()=>{s.disabled=true;try{await updateDoc(orderRef(s.dataset.statusId),{status:s.value,updatedAt:serverTimestamp(),updatedBy:currentUser.uid});const o=orders.find(x=>x.id===s.dataset.statusId);if(o)o.status=s.value;render();toast("狀態已更新");}catch(e){toast("更新失敗");}finally{s.disabled=false;}});
}

function fillModels(){const m=$("#model");m.innerHTML=Object.keys(CATALOG).map(x=>`<option>${x}</option>`).join("");fillVariants();}
function fillVariants(selected=""){const model=$("#model").value,rows=CATALOG[model]||[];$("#variant").innerHTML=rows.map(([label,price])=>`<option value="${esc(label)}" data-price="${price}" ${selected===label?"selected":""}>${esc(label)}｜${money(price)}</option>`).join("");if(!selected)syncVariantPrice();}
function syncVariantPrice(){const opt=$("#variant").selectedOptions[0];if(opt)$("#price").value=opt.dataset.price||0;updateDue();}
function updateDue(){$("#duePreview").textContent=money(Math.max(0,(Number($("#price").value)||0)-(Number($("#deposit").value)||0)-(Number($("#balancePaid").value)||0)));}
function resetForm(){$("#orderForm").reset();$("#editId").value="";$("#formTitle").textContent="建立訂單";fillModels();$("#color").value="待確認";$("#address").value="門市自取";$("#status").value="待訂金";$("#licenseMode").value="代辦";$("#deposit").value=0;$("#balancePaid").value=0;$("#verificationCode").value="";$("#deleteBtn").classList.add("hidden");$("#formMessage").textContent="";updateDue();}
function openNew(){resetForm();$("#orderModal").classList.remove("hidden");}
function openEdit(id){const o=orders.find(x=>x.id===id);if(!o)return;resetForm();$("#editId").value=o.id;$("#formTitle").textContent=`編輯訂單｜${o.orderNo||o.id}`;$("#customerName").value=o.customerName||"";$("#phone").value=o.phone||"";$("#address").value=o.address||"";let model=Object.keys(CATALOG).find(x=>String(o.model||"").replace(/\s/g,"").includes(x.replace(/\s/g,"")))||Object.keys(CATALOG)[0];$("#model").value=model;fillVariants(o.vehicleVariant||o.variant||"");$("#color").value=o.color||"待確認";$("#price").value=Number(o.price)||0;$("#licenseMode").value=String(o.licenseMode||"").includes("自行")?"自行辦理":"代辦";$("#deliveryMode").value=String(o.deliveryMode||o.deliveryMethod||"").includes("自取")||o.deliveryMethod==="pickup"?"門市自取":"配送／送車";$("#paymentMethod").value=[...$("#paymentMethod").options].some(x=>x.value===o.paymentMethod)?o.paymentMethod:"現金／轉帳";$("#status").value=STATUSES.includes(o.status)?o.status:"待訂金";$("#deposit").value=Number(o.deposit)||0;$("#balancePaid").value=Number(o.balancePaid)||0;$("#deliveredAt").value=o.deliveredAt||"";$("#verificationCode").value=o.verificationCode||"";$("#notes").value=o.notes||o.note||"";$("#deleteBtn").classList.remove("hidden");updateDue();$("#orderModal").classList.remove("hidden");}
function closeModal(){$("#orderModal").classList.add("hidden");}
function formData(){const id=$("#editId").value||makeId();const model=$("#model").value,variant=$("#variant").value;return{id,orderNo:id,orderId:id,shopId:SHOP_ID,source:"admin",customerName:$("#customerName").value.trim(),phone:cleanPhone($("#phone").value),address:$("#address").value.trim(),model,vehicleVariant:variant,variant,color:$("#color").value.trim()||"待確認",price:Math.max(0,Math.round(Number($("#price").value)||0)),licenseMode:$("#licenseMode").value,deliveryMode:$("#deliveryMode").value,paymentMethod:$("#paymentMethod").value,status:$("#status").value,deposit:Math.max(0,Math.round(Number($("#deposit").value)||0)),balancePaid:Math.max(0,Math.round(Number($("#balancePaid").value)||0)),deliveredAt:$("#deliveredAt").value||"",notes:$("#notes").value.trim()};}
async function saveOrder(e){e.preventDefault();const d=formData();if(!d.customerName||d.phone.length<9||!d.address){$("#formMessage").textContent="請確認姓名、手機與地址／取車資訊。";return;}const editing=Boolean($("#editId").value);$("#saveBtn").disabled=true;$("#formMessage").textContent="儲存中…";try{if(editing)await updateDoc(orderRef(d.id),{...d,updatedAt:serverTimestamp(),updatedBy:currentUser.uid});else await setDoc(orderRef(d.id),{...d,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),createdBy:currentUser.uid,updatedBy:currentUser.uid});$("#formMessage").textContent="已儲存";toast("訂單已儲存");await loadOrders();setTimeout(closeModal,350);}catch(err){console.error(err);$("#formMessage").textContent=err?.message||"儲存失敗";}finally{$("#saveBtn").disabled=false;}}
async function removeOrder(){const id=$("#editId").value;if(!id||!confirm(`確定刪除訂單 ${id}？`))return;try{await deleteDoc(orderRef(id));toast("訂單已刪除");closeModal();await loadOrders();}catch(e){toast("刪除失敗");}}
async function copySummary(){const d=formData();const text=`【傑瑞訂單】\n訂單：${d.orderNo}\n客戶：${d.customerName}\n手機：${d.phone}\n車款：${d.model}\n規格：${d.vehicleVariant}\n成交：${money(d.price)}\n已收：${money(d.deposit+d.balancePaid)}\n待收：${money(Math.max(0,d.price-d.deposit-d.balancePaid))}\n狀態：${d.status}`;try{await navigator.clipboard.writeText(text);toast("LINE 摘要已複製");}catch{toast("複製失敗");}}

$("#loginBtn").onclick=async()=>{const email=$("#emailInput").value.trim(),password=$("#passwordInput").value;if(!email||!password){$("#loginMessage").textContent="請輸入 Email 與密碼";return;}$("#loginBtn").disabled=true;$("#loginMessage").textContent="登入中…";try{await signInWithEmailAndPassword(auth,email,password);}catch(e){$("#loginMessage").textContent="登入失敗，請確認帳號與密碼";}finally{$("#loginBtn").disabled=false;}};
$("#passwordInput").onkeydown=e=>{if(e.key==="Enter")$("#loginBtn").click();};$("#logoutBtn").onclick=()=>signOut(auth);$("#refreshBtn").onclick=loadOrders;$("#newBtn").onclick=openNew;$("#closeBtn").onclick=closeModal;$("#orderModal").onclick=e=>{if(e.target===$("#orderModal"))closeModal();};$("#searchInput").oninput=render;$("#filterStatus").onchange=render;$("#model").onchange=()=>fillVariants();$("#variant").onchange=syncVariantPrice;["#price","#deposit","#balancePaid"].forEach(x=>$(x).oninput=updateDue);$("#orderForm").onsubmit=saveOrder;$("#deleteBtn").onclick=removeOrder;$("#copyBtn").onclick=copySummary;

onAuthStateChanged(auth,async user=>{if(!user)return showLogin();if(await canAccess(user))return showApp(user);showDenied(user);});