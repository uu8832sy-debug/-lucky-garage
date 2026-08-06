const products = Array.isArray(window.YU_PRODUCT_CATALOG) ? window.YU_PRODUCT_CATALOG.filter((p) => p.visible !== false) : [];
const grid = document.querySelector('#featuredProducts');
const money = (value) => `NT$${Math.max(0, Number(value) || 0).toLocaleString('zh-TW')}`;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const card = (p) => `<article class="product-card">
  <a class="product-photo" href="/products.html#${escapeHtml(p.id)}" aria-label="查看 ${escapeHtml(p.name)}">
    <img src="${escapeHtml(p.images?.[0] || '')}" alt="${escapeHtml(p.name)} 實車照片" loading="lazy"><span class="tag">${escapeHtml(p.tag || '微型電動')}</span>
  </a>
  <div class="product-body"><div><span class="product-style">${escapeHtml(p.style || '')}</span><h3>${escapeHtml(p.name)}</h3></div>
    <div class="spec-row"><span>🔋 ${escapeHtml(p.battery || '規格洽詢')}</span><span>⚡ ${escapeHtml(p.motor || '規格洽詢')}</span></div>
    <div class="price-row"><div><small>售價起</small><strong class="price">${money(p.priceLead)}</strong></div><a class="btn btn-primary" href="/products.html#${escapeHtml(p.id)}">看詳情</a></div>
  </div>
</article>`;
if (grid) grid.innerHTML = products.slice(0, 6).map(card).join('');
