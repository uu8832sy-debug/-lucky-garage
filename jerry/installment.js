import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { doc, getDoc, getFirestore } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const SHOP_ID = "jerry";
const app = getApps().length ? getApp() : initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG || {});
const db = getFirestore(app);

(() => {
  if (document.querySelector('#jerryInstallment')) return;
  const productsSection = document.querySelector('#products');
  if (!productsSection) return;

  const MODELS = {
    '大偉士': {dual:true, variants:[['鉛酸電池',38000,43000],['72V 30Ah 鋰電',53000,58000],['72V 40Ah 鋰電',59000,64000],['72V 50Ah 鋰電',64000,69000],['72V 65Ah 鋰電',69000,74000],['72V 80Ah 鋰電',75000,80000]]},
    'Z3 天鵝座': {dual:true, variants:[['鉛酸電池',43000,48000],['72V 30Ah 鋰電',58000,63000],['72V 40Ah 鋰電',64000,69000],['72V 50Ah 鋰電',69000,74000],['72V 65Ah 鋰電',74000,79000],['72V 80Ah 鋰電',80000,85000]]},
    '正 9 號': {dual:true, variants:[['鉛酸電池',45000,50000],['72V 30Ah 鋰電',60000,65000],['72V 40Ah 鋰電',66000,71000],['72V 50Ah 鋰電',71000,76000],['72V 65Ah 鋰電',76000,81000],['72V 80Ah 鋰電',82000,87000]]},
    '小偉士': {dual:false, variants:[['48V 20Ah 鉛酸',32000],['60V 20Ah 鉛酸',33000],['48V 20Ah 鋰電',43000],['60V 30Ah 鋰電',49000],['72V 30Ah 鋰電',52000]]},
    '極酷': {dual:false, variants:[['48V 12Ah 鉛酸',20000],['48V 20Ah 鉛酸',23000],['48V 20Ah 鋰電',29000],['48V 30Ah 鋰電',33000]]}
  };

  const DEFAULT_PLANS = {
    3:{enabled:true,feePercent:3},
    6:{enabled:true,feePercent:5},
    12:{enabled:true,feePercent:8},
    18:{enabled:false,feePercent:10},
    24:{enabled:true,feePercent:12},
    30:{enabled:false,feePercent:15},
    36:{enabled:false,feePercent:18}
  };
  let plans = {...DEFAULT_PLANS};
  let terms = [];
  let term = 12;
  const money=n=>`NT$${Math.round(Number(n)||0).toLocaleString('zh-TW')}`;

  const style=document.createElement('style');
  style.textContent=`
    .jerry-installment{background:#08111f;color:#fff;padding:76px 0}.jerry-installment-grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:34px;align-items:start}.jerry-installment-copy .eyebrow{color:#74b7ff}.jerry-installment-copy h2{font-size:clamp(40px,5vw,64px);line-height:1.03;margin:0 0 16px}.jerry-installment-copy>p{color:#c3d1e4;max-width:520px}.jerry-checks{display:grid;gap:10px;margin-top:24px}.jerry-checks div{border:1px solid rgba(51,196,157,.28);background:rgba(29,143,115,.12);border-radius:16px;padding:14px 16px}.jerry-checks b{display:block}.jerry-checks small{color:#9fb0c8}.jerry-calc{background:#0d1726;border:1px solid #2a3950;border-radius:28px;padding:24px}.jerry-calc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.jerry-calc label{display:grid;gap:6px;font-size:12px;font-weight:800;color:#b9c9de}.jerry-calc select,.jerry-calc input{width:100%;min-height:50px;border-radius:13px;border:1px solid #d7dde7;background:#fff;color:#111;padding:0 14px;font-size:15px;box-sizing:border-box}.jerry-result{margin-top:18px;display:grid;grid-template-columns:1.15fr .85fr .85fr;gap:10px}.jerry-result>div{background:#0a1422;border:1px solid #2c3d56;border-radius:16px;padding:14px}.jerry-result span{display:block;color:#8fb6ef;font-size:12px}.jerry-result strong{display:block;margin-top:5px;font-size:20px}.jerry-result .monthly strong{font-size:30px;color:#ff5d59}.jerry-term-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}.jerry-term-row button{min-height:42px;border-radius:12px;border:1px solid #355070;background:#101b2b;color:#dce8f8;font-weight:900}.jerry-term-row button.active{background:#ff625c;border-color:#ff625c;color:#111}.jerry-installment-line{display:flex;align-items:center;justify-content:center;min-height:52px;margin-top:14px;border-radius:14px;background:#ff5d57;color:#fff;font-weight:900;text-decoration:none}.jerry-calc-note{font-size:11px;color:#aab9cc;margin:12px 2px 0;line-height:1.6}@media(max-width:860px){.jerry-installment-grid{grid-template-columns:1fr}.jerry-result{grid-template-columns:1fr 1fr}.jerry-result .monthly{grid-column:1/-1}.jerry-calc-grid{grid-template-columns:1fr}}@media(max-width:560px){.jerry-installment{padding:58px 0}.jerry-calc{padding:18px;border-radius:22px}.jerry-term-row{grid-template-columns:repeat(4,1fr)}.jerry-term-row button{font-size:12px}.jerry-result strong{font-size:18px}.jerry-result .monthly strong{font-size:28px}}
  `;
  document.head.appendChild(style);

  const section=document.createElement('section');
  section.id='jerryInstallment';
  section.className='jerry-installment';
  section.innerHTML=`<div class="wrap jerry-installment-grid"><div class="jerry-installment-copy"><p class="eyebrow">INSTALLMENT CALCULATOR</p><h2>無卡分期試算</h2><p>選擇傑瑞車款、電池規格、版本、領牌方式與期數，立即查看預估月繳。</p><div class="jerry-checks"><div><b>年滿 18 歲</b><small>具工作收入</small></div><div><b>免信用卡</b><small>實際核准依審核</small></div><div><b>快速試算</b><small>不會直接送件</small></div></div></div><div class="jerry-calc"><div class="jerry-calc-grid"><label>車款<select id="jiModel"></select></label><label>電池規格<select id="jiBattery"></select></label><label id="jiEditionWrap">版本<select id="jiEdition"><option value="normal">一般版</option><option value="special">特仕版</option></select></label><label>領牌方式<select id="jiLicense"><option value="self">自行領牌</option><option value="agent">代辦領牌 + NT$2,500</option></select></label><label>手機號碼<input id="jiPhone" inputmode="numeric" autocomplete="tel" maxlength="10" placeholder="09XXXXXXXX"></label></div><div class="jerry-result"><div class="monthly"><span>預估每月</span><strong id="jiMonthly">—</strong><small id="jiTermText"></small></div><div><span>分期本金</span><strong id="jiPrincipal">—</strong></div><div><span>預估總額</span><strong id="jiTotal">—</strong></div></div><div id="jiTerms" class="jerry-term-row"></div><a id="jiLine" class="jerry-installment-line" href="#">詢問無卡分期</a><p class="jerry-calc-note">此為網站預估結果，實際額度、費率、月付金額與是否核准，以分期公司最終審核為準。</p></div></div>`;
  productsSection.insertAdjacentElement('afterend',section);

  const model=document.querySelector('#jiModel');
  const battery=document.querySelector('#jiBattery');
  const edition=document.querySelector('#jiEdition');
  const editionWrap=document.querySelector('#jiEditionWrap');
  const license=document.querySelector('#jiLicense');
  const phone=document.querySelector('#jiPhone');
  const termsBox=document.querySelector('#jiTerms');
  const line=document.querySelector('#jiLine');

  model.innerHTML=Object.keys(MODELS).map(x=>`<option>${x}</option>`).join('');

  const renderTerms=()=>{
    terms=Object.entries(plans).filter(([,value])=>value?.enabled).map(([key])=>Number(key)).filter(Number.isFinite).sort((a,b)=>a-b);
    if(!terms.length) terms=[12];
    if(!terms.includes(term)) term=terms.includes(12)?12:terms[0];
    termsBox.innerHTML=terms.map(t=>`<button type="button" data-term="${t}" class="${t===term?'active':''}">${t}期</button>`).join('');
    termsBox.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{term=Number(btn.dataset.term);termsBox.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===btn));calc();}));
  };

  const calc=()=>{
    const data=MODELS[model.value];
    const row=data.variants[Number(battery.value)||0];
    const special=data.dual&&edition.value==='special';
    const base=Number(row[special?2:1])||0;
    const principal=base+(license.value==='agent'?2500:0);
    const fee=Number(plans[term]?.feePercent)||0;
    const total=Math.round(principal*(1+fee/100));
    const monthly=Math.round(total/term);
    document.querySelector('#jiMonthly').textContent=money(monthly);
    document.querySelector('#jiPrincipal').textContent=money(principal);
    document.querySelector('#jiTotal').textContent=money(total);
    document.querySelector('#jiTermText').textContent=`${term} 期｜試算費率 ${fee}%`;
    const editionLabel=data.dual?(special?'特仕版':'一般版'):'無版本區分';
    const licenseLabel=license.value==='agent'?'代辦領牌 + NT$2,500':'自行領牌';
    const msg=[
      '您好，我想詢問傑瑞電動車無卡分期',
      `車款：${model.value}`,
      `版本：${editionLabel}`,
      `電池：${row[0]}`,
      `領牌：${licenseLabel}`,
      `車價：${money(base)}`,
      `期數：${term}期`,
      `預估月付：${money(monthly)}`,
      `預估總額：${money(total)}`,
      `手機：${phone.value.trim() || '未填'}`
    ].join('\n');
    line.href=`https://line.me/R/oaMessage/%40882npfrm/?${encodeURIComponent(msg)}`;
  };

  const fillBattery=()=>{
    const data=MODELS[model.value];
    battery.innerHTML=data.variants.map((v,i)=>`<option value="${i}">${v[0]}</option>`).join('');
    editionWrap.style.display=data.dual?'grid':'none';
    calc();
  };

  line.addEventListener('click',(event)=>{
    const value=phone.value.trim();
    if(!/^09\d{8}$/.test(value)){
      event.preventDefault();
      alert('請先輸入正確的 10 碼手機號碼');
      phone.focus();
      return;
    }
    calc();
  });

  model.addEventListener('change',fillBattery);
  battery.addEventListener('change',calc);
  edition.addEventListener('change',calc);
  license.addEventListener('change',calc);
  phone.addEventListener('input',()=>{phone.value=phone.value.replace(/\D/g,'').slice(0,10);calc();});

  async function loadPaymentSettings(){
    try{
      const snap=await getDoc(doc(db,'shops',SHOP_ID,'siteSettings','payment'));
      const data=snap.exists()?snap.data():{};
      const remote=data?.plans||{};
      plans={...DEFAULT_PLANS};
      Object.keys(DEFAULT_PLANS).forEach(key=>{plans[key]={...DEFAULT_PLANS[key],...(remote[key]||{})};});
    }catch(error){
      console.warn('Jerry installment settings fallback.',error);
      plans={...DEFAULT_PLANS};
    }
    renderTerms();
    calc();
  }

  renderTerms();
  fillBattery();
  loadPaymentSettings();
})();
