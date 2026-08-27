(() => {
  const BRANDS = {
    xiaoyu:{ name:"小宇微電E-BIKE", short:"小宇微電", logo:"../assets/brand/logo-round.webp", front:"../index.html" },
    jerry:{ name:"傑瑞電動車", short:"傑瑞電動車", logo:"../jerry/admin-logo.png", front:"../jerry/" }
  };
  const storageKey = "luckyGarageAdminBrand";
  const byHost = /(^|\.)jerrye-bike\.com$/i.test(location.hostname) ? "jerry" : null;
  let selected = byHost || localStorage.getItem(storageKey) || "xiaoyu";

  function applyBrand(shopId, persist = true) {
    const brand = BRANDS[shopId] || BRANDS.xiaoyu;
    selected = shopId in BRANDS ? shopId : "xiaoyu";
    if (persist) localStorage.setItem(storageKey, selected);
    document.querySelectorAll(".backend-logo-img,.admin-login-logo").forEach(img => { img.src=brand.logo; img.alt=`${brand.name} Logo`; });
    const title = document.querySelector(".backend-brand strong");
    if (title) title.textContent=`${brand.name} 後台管理系統`;
    const publisher = document.querySelector(".backend-brand small");
    if (publisher) publisher.textContent="小宇微電E-BIKE 出品・歡迎代理";
    const front = document.querySelector(".header-front-link");
    if (front) front.href=brand.front;
    document.querySelectorAll("[data-shop-choice]").forEach(button => button.classList.toggle("is-active",button.dataset.shopChoice===selected));
    const loginTitle = document.querySelector("#loginCard h2");
    if (loginTitle) loginTitle.textContent=`${brand.short}管理員登入`;
  }

  function installSelector() {
    const card=document.querySelector("#loginCard");
    if (!card || card.querySelector(".shop-choice")) return;
    const selector=document.createElement("div");
    selector.className="shop-choice";
    selector.innerHTML='<p>請先選擇管理車行</p><div><button type="button" data-shop-choice="xiaoyu"><img src="../assets/brand/logo-round.webp" alt=""><span>小宇微電</span></button><button type="button" data-shop-choice="jerry"><img src="../jerry/admin-logo.png" alt=""><span>傑瑞電動車</span></button></div><small>登入後仍會依帳號權限自動切換，不會看到其他車行資料。</small>';
    const loginButton=card.querySelector("#loginBtn");
    (loginButton?.parentElement?.id === "loginCard" ? loginButton : card.querySelector("h2")?.parentElement)?.after(selector);
    selector.addEventListener("click",event=>{const button=event.target.closest("[data-shop-choice]");if(button)applyBrand(button.dataset.shopChoice);});
  }

  const style=document.createElement("style");
  style.textContent='.shop-choice{padding:14px;border:1px solid #dce5e9;border-radius:18px;background:#f8fafb}.shop-choice>p{margin:0 0 10px;font-size:13px;font-weight:900;color:#334155}.shop-choice>div{display:grid;grid-template-columns:1fr 1fr;gap:10px}.shop-choice button{display:flex;align-items:center;gap:9px;padding:10px;border:2px solid transparent;border-radius:14px;background:#fff;color:#334155;font-weight:900;cursor:pointer}.shop-choice button.is-active{border-color:#22c55e;background:#effdf5}.shop-choice img{width:38px;height:38px;object-fit:contain;border-radius:10px}.shop-choice small{display:block;margin-top:9px;color:#64748b;font-size:10px;line-height:1.5}.admin-login-logo[src*="admin-logo"],.backend-logo-img[src*="admin-logo"]{object-fit:contain;background:#fff}';
  document.head.append(style);
  installSelector();
  applyBrand(selected,false);

  const identity=document.querySelector("#adminIdentity");
  if (identity) new MutationObserver(()=>{const text=identity.textContent.toLowerCase();if(text.includes("jerry")||text.includes("傑瑞"))applyBrand("jerry");else if(text.includes("xiaoyu")||text.includes("小宇"))applyBrand("xiaoyu");}).observe(identity,{childList:true,subtree:true,characterData:true});
})();
