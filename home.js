(() => {
  "use strict";
  const defaults = Array.isArray(window.YU_PRODUCT_CATALOG) ? JSON.parse(JSON.stringify(window.YU_PRODUCT_CATALOG)) : [];
  const $ = (s) => document.querySelector(s);
  const money = (value) => `NT$${Math.max(0, Number(value) || 0).toLocaleString('zh-TW')}`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const imageUrls = (p) => {
    const arr = Array.isArray(p?.images) ? p.images.slice() : [];
    arr.sort((a,b) => Number(!!(typeof b==='object'&&b?.isPrimary)) - Number(!!(typeof a==='object'&&a?.isPrimary)));
    return arr.map((x)=>typeof x==='string'?x:x?.url).filter(Boolean);
  };
  function normalize(items){return (Array.isArray(items)?items:[]).map((p,i)=>({...p,id:String(p.id||`p-${i}`),order:Number(p.order||i+1),visible:p.visible!==false,images:imageUrls(p)})).filter((p)=>p.visible!==false && String(p.name||'').trim()!=='重機車牌').sort((a,b)=>a.order-b.order);}
  function mergeRemote(remote){const map=new Map(defaults.map((p)=>[p.id,{...p}]));for(const r of remote||[]){if(!r?.id||String(r.id).startsWith('__'))continue;const base=map.get(r.id);const imgs=imageUrls(r);if(base)map.set(r.id,{...base,...r,images:imgs.length?imgs:imageUrls(base)});else map.set(r.id,{...r,images:imgs});}return normalize([...map.values()]);}
  function hasTernary(p){return Number(p.priceTernary||0)>0;}
  function hasLiFePO4(p){return Number(p.priceLithium||0)>0;}
  function batterySummary(p){const parts=['鉛酸'];if(hasTernary(p))parts.push('三元鋰 30Ah');if(hasLiFePO4(p))parts.push('鋰鐵 30Ah');return parts.length>1?parts.join('／'):'鉛酸版';}
  function rangeSummary(p){const parts=[`鉛酸 ${p.rangeLead||'請洽客服確認'}`];if(hasTernary(p))parts.push(`三元鋰 ${p.rangeTernary||'請洽客服確認'}`);if(hasLiFePO4(p))parts.push(`鋰鐵 ${p.rangeLithium||'請洽客服確認'}`);return parts.join('｜');}
  function badgeText(p){if(hasTernary(p)&&hasLiFePO4(p))return '三種電池可選';if(hasTernary(p))return '可選三元鋰 30Ah';if(hasLiFePO4(p))return '可選鋰鐵 30Ah';return '鉛酸版';}
  function card(p){const img=imageUrls(p)[0]||'/icon-512.png';const priceBlocks=[`<div><small>鉛酸版</small><strong>${money(p.priceLead)}</strong></div>`];if(hasTernary(p))priceBlocks.push(`<div><small>三元鋰 30Ah</small><strong>${money(p.priceTernary)}</strong></div>`);if(hasLiFePO4(p))priceBlocks.push(`<div><small>鋰鐵 30Ah</small><strong>${money(p.priceLithium)}</strong></div>`);return `<article class="product-card"><a class="product-photo" href="/products.html#${escapeHtml(p.id)}"><img src="${escapeHtml(img)}" alt="${escapeHtml(p.name)} 實車照片" loading="lazy" onerror="this.onerror=null;this.src='/icon-512.png'"><span class="tag">${escapeHtml(badgeText(p))}</span></a><div class="product-body"><div><span class="product-style">${escapeHtml(p.style||'')}</span><h3>${escapeHtml(p.name)}</h3></div><div class="spec-row"><span>🔋 ${escapeHtml(batterySummary(p))}</span><span>🛣️ ${escapeHtml(rangeSummary(p))}</span></div><div class="model-prices">${priceBlocks.join('')}</div><div class="price-note">車價不含領牌保險代辦；代辦另加 NT$3,000。</div><div class="price-row"><a class="btn btn-primary full-width" href="/products.html#${escapeHtml(p.id)}">看詳情</a></div></div></article>`;}
  function renderProducts(products){const grid=$('#featuredProducts');if(grid)grid.innerHTML=products.slice(0,6).map(card).join('');}
  function applySettings(data={}){const s={announcementEnabled:false,announcementText:'',heroEyebrow:'工廠直營・全台到府交車',heroTitle:'找小宇買微電，',heroAccent:'不走彎路',heroDescription:'全台到府交車、線上看車、展示牌訂製與保固查詢，一站完成。',promoEnabled:false,promoTitle:'',promoText:'',promoButtonText:'立即了解',promoButtonUrl:'/products.html',...data};const retired=/幸運車庫|抽獎碼|抽獎活動|開庫/;if(retired.test(String(s.heroDescription||'')))s.heroDescription='全台到府交車、線上看車、展示牌訂製與保固查詢，一站完成。';if(retired.test([s.promoTitle,s.promoText,s.promoButtonUrl].join(' ')))s.promoEnabled=false;if(retired.test(String(s.announcementText||'')))s.announcementEnabled=false;const announcement=$('#announcementBar');if(announcement){announcement.hidden=!s.announcementEnabled||!s.announcementText;announcement.textContent=s.announcementText||'';}if($('#heroEyebrow'))$('#heroEyebrow').textContent=s.heroEyebrow||'';if($('#heroTitle'))$('#heroTitle').textContent=s.heroTitle||'';if($('#heroAccent'))$('#heroAccent').textContent=s.heroAccent||'';if($('#heroDescription'))$('#heroDescription').textContent=s.heroDescription||'';const promo=$('#promoSection');if(promo){promo.hidden=!s.promoEnabled;if($('#promoTitle'))$('#promoTitle').textContent=s.promoTitle||'';if($('#promoText'))$('#promoText').textContent=s.promoText||'';const btn=$('#promoButton');if(btn){btn.textContent=s.promoButtonText||'立即了解';btn.href=s.promoButtonUrl||'/products.html';}}}

  function initHeroSlider(){
    const root=$('#heroSlider');
    if(!root)return;
    const track=root.querySelector('.hero-slider-track');
    const slides=[...root.querySelectorAll('.hero-slide')];
    const dots=[...root.querySelectorAll('.hero-slider-dot')];
    if(!track||slides.length<2)return;
    let current=0,startX=0,deltaX=0,dragging=false,timer=null;
    const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const desktop=()=>window.matchMedia&&window.matchMedia('(min-width: 901px)').matches;
    function sync(){
      track.style.transform=`translateX(-${current*100}%)`;
      slides.forEach((slide,index)=>slide.classList.toggle('is-active',index===current));
      dots.forEach((dot,index)=>{const active=index===current;dot.classList.toggle('is-active',active);dot.setAttribute('aria-current',active?'true':'false');});
    }
    function goTo(index){current=(index+slides.length)%slides.length;sync();}
    function stopAuto(){if(timer){clearInterval(timer);timer=null;}}
    function startAuto(){stopAuto();if(reduced||!desktop())return;timer=setInterval(()=>{if(document.hidden)return;goTo(current+1);},4500);}
    dots.forEach((dot)=>dot.addEventListener('click',()=>{goTo(Number(dot.dataset.slideTo||0));startAuto();}));
    root.addEventListener('mouseenter',stopAuto);
    root.addEventListener('mouseleave',startAuto);
    root.addEventListener('touchstart',(event)=>{dragging=true;startX=event.touches[0].clientX;deltaX=0;stopAuto();},{passive:true});
    root.addEventListener('touchmove',(event)=>{if(!dragging)return;deltaX=event.touches[0].clientX-startX;},{passive:true});
    root.addEventListener('touchend',()=>{if(!dragging)return;dragging=false;if(Math.abs(deltaX)>45)goTo(current+(deltaX<0?1:-1));startAuto();});
    root.addEventListener('pointerdown',(event)=>{if(event.pointerType!=='mouse')return;dragging=true;startX=event.clientX;deltaX=0;stopAuto();});
    root.addEventListener('pointerup',(event)=>{if(!dragging)return;deltaX=event.clientX-startX;dragging=false;if(Math.abs(deltaX)>60)goTo(current+(deltaX<0?1:-1));startAuto();});
    root.addEventListener('keydown',(event)=>{if(event.key==='ArrowRight'){goTo(current+1);startAuto();}if(event.key==='ArrowLeft'){goTo(current-1);startAuto();}});
    document.addEventListener('visibilitychange',()=>document.hidden?stopAuto():startAuto());
    window.addEventListener('resize',startAuto);
    sync();
    startAuto();
  }

  function renderDelivery(cases){const section=$('#deliverySection'),grid=$('#deliveryCasesGrid');if(!section||!grid)return;const list=(cases||[]).filter((c)=>c.published!==false).sort((a,b)=>Number(a.order||999)-Number(b.order||999)).slice(0,6);section.hidden=!list.length;grid.innerHTML=list.map((c)=>`<article class="delivery-case-card">${c.imageUrl?`<img src="${escapeHtml(c.imageUrl)}" alt="${escapeHtml(c.title||'交車紀錄')}" loading="lazy">`:`<div class="delivery-case-placeholder">🚚</div>`}<div><small>${escapeHtml(c.location||'全台到府交車')}</small><h3>${escapeHtml(c.title||'交車完成')}</h3><b>${escapeHtml(c.model||'')}</b><p>${escapeHtml(c.note||'感謝客人的信任。')}</p></div></article>`).join('');}
  renderProducts(normalize(defaults));
  initHeroSlider();
  const config=window.LUCKY_GARAGE_FIREBASE_CONFIG||{};if(!config.apiKey||!config.projectId)return;
  Promise.all([import('https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js')]).then(([appM,fs])=>{const app=appM.initializeApp(config,'home-v32-2');const db=fs.getFirestore(app);fs.onSnapshot(fs.collection(db,'products'),(snap)=>renderProducts(mergeRemote(snap.docs.map((d)=>({id:d.id,...d.data()})))),(e)=>console.warn('products sync',e));fs.onSnapshot(fs.doc(db,'siteSettings','main'),(snap)=>applySettings(snap.exists()?snap.data():{}),(e)=>console.warn('site settings sync',e));fs.onSnapshot(fs.collection(db,'deliveryCases'),(snap)=>renderDelivery(snap.docs.map((d)=>({id:d.id,...d.data()}))),(e)=>console.warn('delivery sync',e));}).catch((e)=>console.warn('Firebase home enhancement unavailable',e));
})();
