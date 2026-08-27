(() => {
  const BRANDS = {
    xiaoyu:{ name:"小宇微電E-BIKE", short:"小宇微電", logo:"../assets/brand/logo-round.webp", front:"../index.html" },
    jerry:{ name:"傑瑞電動車", short:"傑瑞電動車", logo:"../jerry/admin-logo.png", front:"../jerry/" }
  };
  const storageKey = "luckyGarageAdminBrand";
  const ownerShopKey = "luckyGarageAdminShop";
  const ownerEmail = "uu8832sr@gmail.com";
  const byHost = /(^|\.)jerrye-bike\.com$/i.test(location.hostname) ? "jerry" : null;
  const queryShop = new URLSearchParams(location.search).get("shop");
  let selected = (queryShop && BRANDS[queryShop] ? queryShop : null) || byHost || sessionStorage.getItem(ownerShopKey) || localStorage.getItem(storageKey) || "xiaoyu";

  function applyBrand(shopId, persist = true) {
    const brand = BRANDS[shopId] || BRANDS.xiaoyu;
    selected = shopId in BRANDS ? shopId : "xiaoyu";
    if (persist) {
      localStorage.setItem(storageKey, selected);
      sessionStorage.setItem(ownerShopKey, selected);
    }
    document.querySelectorAll(".backend-logo-img,.admin-login-logo").forEach(img => { img.src=brand.logo; img.alt=`${brand.name} Logo`; });
    const title = document.querySelector(".backend-brand strong");
    if (title) title.textContent=`${brand.name} 後台管理系統`;
    const publisher = document.querySelector(".backend-brand small");
    if (publisher) publisher.textContent="小宇微電E-BIKE 出品・歡迎代理";
    const front = document.querySelector(".header-front-link") || [...document.querySelectorAll('#headerActions a')].find(a=>/查看前台/.test(a.textContent));
    if (front) front.href=brand.front;
    document.querySelectorAll("[data-shop-choice]").forEach(button => button.classList.toggle("is-active",button.dataset.shopChoice===selected));
    const loginTitle = document.querySelector("#loginCard h2");
    if (loginTitle) loginTitle.textContent=`${brand.short}管理員登入`;
    const headerSelect = document.querySelector("#ownerShopSwitcher");
    if (headerSelect) headerSelect.value = selected;
    document.querySelectorAll('a[href="orders.html"],a[href="draw.html"]').forEach(link=>link.classList.toggle("hidden",selected==="jerry"));
  }

  function switchShop(shopId) {
    if (!BRANDS[shopId]) return;
    applyBrand(shopId, true);
    const url = new URL(location.href);
    url.pathname = url.pathname.replace(/\/admin\/.*$/, "/admin/index.html");
    url.search = "";
    url.searchParams.set("shop", shopId);
    location.assign(url.href);
  }

  function installSelector() {
    const card=document.querySelector("#loginCard");
    if (!card || card.querySelector(".shop-choice")) return;
    const selector=document.createElement("div");
    selector.className="shop-choice";
    selector.innerHTML='<p>請先選擇管理車行</p><div><button type="button" data-shop-choice="xiaoyu"><img src="../assets/brand/logo-round.webp" alt=""><span>小宇微電</span></button><button type="button" data-shop-choice="jerry"><img src="../jerry/admin-logo.png" alt=""><span>傑瑞電動車</span></button></div><small>平台管理員可直接切換店家；一般店家帳號仍只會看到自己車行資料。</small>';
    const loginButton=card.querySelector("#loginBtn");
    (loginButton?.parentElement?.id === "loginCard" ? loginButton : card.querySelector("h2")?.parentElement)?.after(selector);
    selector.addEventListener("click",event=>{const button=event.target.closest("[data-shop-choice]");if(button)applyBrand(button.dataset.shopChoice,true);});
  }

  function syncOwnerHeader() {
    const identity=document.querySelector("#adminIdentity");
    const actions=document.querySelector("#headerActions");
    if (!identity || !actions) return;
    const text=identity.textContent.toLowerCase();
    if (!text.includes(ownerEmail)) return;
    let select=document.querySelector("#ownerShopSwitcher");
    if (!select) {
      select=document.createElement("select");
      select.id="ownerShopSwitcher";
      select.className="owner-shop-switcher";
      select.innerHTML='<option value="xiaoyu">小宇微電</option><option value="jerry">傑瑞電動車</option>';
      select.addEventListener("change",()=>switchShop(select.value));
      actions.prepend(select);
    }
    select.value = selected;
  }

  const style=document.createElement("style");
  style.textContent='.shop-choice{padding:14px;border:1px solid #dce5e9;border-radius:18px;background:#f8fafb}.shop-choice>p{margin:0 0 10px;font-size:13px;font-weight:900;color:#334155}.shop-choice>div{display:grid;grid-template-columns:1fr 1fr;gap:10px}.shop-choice button{display:flex;align-items:center;gap:9px;padding:10px;border:2px solid transparent;border-radius:14px;background:#fff;color:#334155;font-weight:900;cursor:pointer}.shop-choice button.is-active{border-color:#22c55e;background:#effdf5}.shop-choice img{width:38px;height:38px;object-fit:contain;border-radius:10px}.shop-choice small{display:block;margin-top:9px;color:#64748b;font-size:10px;line-height:1.5}.admin-login-logo[src*="admin-logo"],.backend-logo-img[src*="admin-logo"]{object-fit:contain;background:#fff}.owner-shop-switcher{background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:999px;padding:5px 28px 5px 10px;font-size:12px;font-weight:800;max-width:145px}@media(max-width:720px){.owner-shop-switcher{max-width:112px;font-size:11px;padding-left:8px}}';
  document.head.append(style);
  installSelector();
  applyBrand(selected,false);

  const identity=document.querySelector("#adminIdentity");
  if (identity) new MutationObserver(()=>{
    const text=identity.textContent.toLowerCase();
    if(text.includes("jerry")||text.includes("傑瑞"))applyBrand("jerry",false);
    else if(text.includes("xiaoyu")||text.includes("小宇"))applyBrand("xiaoyu",false);
    syncOwnerHeader();
  }).observe(identity,{childList:true,subtree:true,characterData:true});
  syncOwnerHeader();
})();
