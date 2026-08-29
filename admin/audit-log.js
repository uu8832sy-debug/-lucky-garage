import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { getDocs, getFirestore } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { resolveShopContext, shopCollection } from "../multi-shop-core.js";

const app = initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG || {});
const auth = getAuth(app);
const db = getFirestore(app);
const body = document.querySelector("#auditBody");
const status = document.querySelector("#status");

function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function millis(v){if(typeof v?.toMillis==="function") return v.toMillis(); if(v?.seconds) return v.seconds*1000; const p=Date.parse(v||""); return Number.isNaN(p)?0:p;}
function fmt(v){const m=millis(v); return m?new Intl.DateTimeFormat("zh-TW",{dateStyle:"short",timeStyle:"medium"}).format(new Date(m)):"—";}
function summary(v){if(v==null||v==="") return "—"; if(typeof v==="string") return v; try{return JSON.stringify(v);}catch{return String(v);}}

onAuthStateChanged(auth, async (user)=>{
  if(!user){ location.href="index.html"; return; }
  try{
    const context = await resolveShopContext(db,user);
    if(!["platformOwner","owner","admin"].includes(context.role)) throw new Error("只有管理員可查看操作紀錄");
    const snap = await getDocs(shopCollection(db,context,"auditLogs"));
    const rows = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>millis(b.createdAt)-millis(a.createdAt));
    status.textContent = rows.length?`共 ${rows.length} 筆紀錄`:`尚無操作紀錄`;
    body.innerHTML = rows.length?rows.map(r=>`<tr><td class="p-3 text-slate-400">${fmt(r.createdAt)}</td><td class="p-3"><strong class="text-white block">${esc(r.actorEmail||r.actorUid||"未知")}</strong></td><td class="p-3">${esc(r.role||"—")}</td><td class="p-3 text-emerald-400 font-bold">${esc(r.action||"—")}</td><td class="p-3">${esc(r.targetLabel||r.targetId||"—")}</td><td class="p-3 max-w-72 break-words text-slate-400">${esc(summary(r.before))}</td><td class="p-3 max-w-72 break-words text-slate-200">${esc(summary(r.after))}</td></tr>`).join(""):`<tr><td colspan="7" class="p-6 text-center text-slate-500">尚無紀錄</td></tr>`;
  }catch(error){
    console.error(error);
    status.textContent = error?.message || "無法讀取操作紀錄";
    body.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-rose-400">${esc(error?.message||"讀取失敗")}</td></tr>`;
  }
});
