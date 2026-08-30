const params = new URLSearchParams(location.search);
const shopId = String(params.get('shop') || '').trim().toLowerCase();
const isTenantDelivery = Boolean(shopId && shopId !== 'xiaoyu' && shopId !== 'jerry');

if (isTenantDelivery) {
  document.body.classList.add('tenant-delivery-admin');

  const withShop = (path) => {
    const url = new URL(path, location.href);
    url.searchParams.set('shop', shopId);
    return `${url.pathname.split('/').pop()}?${url.searchParams.toString()}`;
  };

  const adminApp = document.querySelector('#adminApp');
  if (adminApp && !document.querySelector('.tenant-delivery-hero')) {
    const hero = document.createElement('section');
    hero.className = 'tenant-delivery-hero';
    hero.innerHTML = `
      <div class="tenant-delivery-top">
        <div>
          <div class="tenant-delivery-kicker">DEALER CONTROL CENTER</div>
          <div class="tenant-delivery-title">店家營運總覽</div>
          <div class="tenant-delivery-desc">商品、線上訂單、正式訂單與網站設定集中管理。這套版型是合作店家標準交付後台。</div>
        </div>
        <div class="tenant-delivery-badge"><i class="fa-solid fa-circle-check"></i><span>標準交付版</span></div>
      </div>
      <div class="tenant-delivery-stats">
        <button type="button" class="tenant-stat" data-tenant-action="orders">
          <small>待處理</small><strong id="tenantPendingCount">0</strong><span>線上訂單</span>
        </button>
        <button type="button" class="tenant-stat" data-tenant-action="products">
          <small>目前上架</small><strong id="tenantProductCount">0</strong><span>商品／車款</span>
        </button>
        <a class="tenant-stat" href="${withShop('orders.html')}"><small>帳務管理</small><strong>完整訂單</strong><span>訂金／尾款／淨利</span></a>
        <a class="tenant-stat" href="${withShop('site-settings.html')}"><small>品牌管理</small><strong>網站設定</strong><span>店名／內容／前台</span></a>
      </div>
      <div class="tenant-delivery-guide"><b>標準流程</b><span>客戶送單</span><i class="fa-solid fa-arrow-right"></i><span>線上訂單審核</span><i class="fa-solid fa-arrow-right"></i><span>確認後進完整訂單</span><i class="fa-solid fa-arrow-right"></i><span>交車完成</span></div>`;
    adminApp.prepend(hero);
  }

  const nav = document.querySelector('#adminApp > nav');
  if (nav) {
    [...nav.querySelectorAll('a,button')].forEach((el) => {
      const href = String(el.getAttribute('href') || '');
      if (/draw\.html/i.test(href) || /抽獎管理/.test(el.textContent || '')) el.classList.add('tenant-obsolete');
    });
    const casesHref = withShop('cases.html');
    if (!nav.querySelector('[data-tenant-cases]')) {
      const cases = document.createElement('a');
      cases.href = casesHref;
      cases.dataset.tenantCases = '1';
      cases.className = 'bg-slate-900 border border-slate-800 text-amber-300 font-bold rounded-xl p-3 text-xs text-center';
      cases.innerHTML = '<i class="fa-solid fa-truck-ramp-box mr-1"></i>交車案例';
      nav.appendChild(cases);
    }
  }

  const headerTitle = document.querySelector('header h1');
  if (headerTitle) {
    const chip = document.createElement('span');
    chip.className = 'tenant-brand-chip ml-2';
    chip.textContent = '合作店家後台';
    headerTitle.insertAdjacentElement('afterend', chip);
  }

  const clickTab = (name) => {
    const button = document.querySelector(`[data-admin-tab="${name}"]`);
    button?.click();
    setTimeout(() => document.querySelector(`#admin-section-${name}`)?.scrollIntoView({behavior:'smooth',block:'start'}), 60);
  };
  document.querySelectorAll('[data-tenant-action="orders"]').forEach((el) => el.addEventListener('click', () => clickTab('orders')));
  document.querySelectorAll('[data-tenant-action="products"]').forEach((el) => el.addEventListener('click', () => clickTab('products')));

  const updateCounts = () => {
    const pending = [...document.querySelectorAll('#adminOrderTableBody tr')].filter((row) => {
      const text = row.textContent || '';
      return !/已拒絕|rejected/i.test(text);
    }).length;
    const products = [...document.querySelectorAll('#adminProductTableBody tr')].filter((row) => !/目前沒有|尚無/.test(row.textContent || '')).length;
    const pendingEl = document.querySelector('#tenantPendingCount');
    const productEl = document.querySelector('#tenantProductCount');
    if (pendingEl) pendingEl.textContent = String(pending);
    if (productEl) productEl.textContent = String(products);
  };

  const observer = new MutationObserver(updateCounts);
  const ordersBody = document.querySelector('#adminOrderTableBody');
  const productsBody = document.querySelector('#adminProductTableBody');
  if (ordersBody) observer.observe(ordersBody,{childList:true,subtree:true,characterData:true});
  if (productsBody) observer.observe(productsBody,{childList:true,subtree:true,characterData:true});
  updateCounts();
}
