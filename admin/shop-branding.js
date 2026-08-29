(() => {
  const BRANDS = {
    xiaoyu:{ name:"小宇微電E-BIKE", short:"小宇微電", logo:"../assets/brand/logo-round.webp", front:"../index.html" },
    jerry:{ name:"傑瑞電動車", short:"傑瑞電動車", logo:"../jerry/admin-logo.png", front:"../jerry/" }
  };
  const storageKey = "luckyGarageAdminBrand";
  const ownerShopKey = "luckyGarageAdminShop";
  const ownerEmail = "uu8832sr@gmail.com";
  const queryShop = new URLSearchParams(location.search).get("shop");
  const byHost = /(^|\.)jerrye-bike\.com$/i.test(location.hostname);
  const byJerryPath = /^\/jerry(?:\/|$)/i.test(location.pathname);
  const explicitJerry = byHost || byJerryPath || queryShop === "jerry";

  // 小宇後台使用根目錄 legacy 資料。不能再用 localStorage/sessionStorage
  // 決定目前店家，否則曾經切到傑瑞後，回 /admin/ 會誤讀 shops/jerry/*。
  let selected = explicitJerry ? "jerry" : "xiaoyu";

  function persistShop(shopId){
    localStorage.setItem(storageKey,shopId);
    sessionStorage.setItem(ownerShopKey,shopId);
  }

  function routeJerry(){
    persistShop("jerry");
    if (!byJerryPath) location.replace("/jerry/admin.html?shop=jerry");
  }

  // 只要是在標準 /admin/ 小宇後台，先清掉任何舊的傑瑞記憶。
  if (!explicitJerry) persistShop("xiaoyu");

  function applyBrand(shopId, persist = true) {
    const brand = BRANDS[shopId] || BRANDS.xiaoyu;
    selected = shopId in BRANDS ? shopId : "xiaoyu";
    if (persist) persistShop(selected);
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
  }

  function switchShop(shopId) {
    if (!BRANDS[shopId]) return;
    if (shopId === "jerry") return routeJerry();
    persistShop("xiaoyu");
    const url = new URL(location.href);
    url.pathname = "/admin/index.html";
    url.search = "?shop=xiaoyu";
    location.assign(url.href);
  }

  if (explicitJerry) {
    routeJerry();
    return;
  }

  function installSelector() {
    const card=document.querySelector("#loginCard");
    if (!card || card.querySelector(".shop-choice")) return;
    const selector=document.createElement("div");
    selector.className="shop-choice";
    selector.innerHTML='<p>目前管理：小宇微電</p><div><button type="button" data-shop-choice="xiaoyu"><img src="../assets/brand/logo-round.webp" alt=""><span>小宇微電</span></button><button type="button" data-shop-choice="jerry"><img src="../jerry/admin-logo.png" alt=""><span>傑瑞電動車</span></button></div><small>小宇與傑瑞使用不同資料區；此頁預設固定為小宇微電。</small>';
    const loginButton=card.querySelector("#loginBtn");
    (loginButton?.parentElement?.id === "loginCard" ? loginButton : card.querySelector("h2")?.parentElement)?.after(selector);
    selector.addEventListener("click",event=>{const button=event.target.closest("[data-shop-choice]");if(button)switchShop(button.dataset.shopChoice);});
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
    select.value = "xiaoyu";
  }

  const style=document.createElement("style");
  style.textContent='.shop-choice{padding:14px;border:1px solid #dce5e9;border-radius:18px;background:#f8fafb}.shop-choice>p{margin:0 0 10px;font-size:13px;font-weight:900;color:#334155}.shop-choice>div{display:grid;grid-template-columns:1fr 1fr;gap:10px}.shop-choice button{display:flex;align-items:center;gap:9px;padding:10px;border:2px solid transparent;border-radius:14px;background:#fff;color:#334155;font-weight:900;cursor:pointer}.shop-choice button.is-active{border-color:#22c55e;background:#effdf5}.shop-choice img{width:38px;height:38px;object-fit:contain;border-radius:10px}.shop-choice small{display:block;margin-top:9px;color:#64748b;font-size:10px;line-height:1.5}.owner-shop-switcher{background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:999px;padding:5px 28px 5px 10px;font-size:12px;font-weight:800;max-width:145px}@media(max-width:720px){.owner-shop-switcher{max-width:112px;font-size:11px;padding-left:8px}}';
  document.head.append(style);
  installSelector();
  applyBrand("xiaoyu",false);
  syncOwnerHeader();
})();
