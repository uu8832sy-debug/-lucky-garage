(() => {
  const style = document.createElement('style');
  style.textContent = `
    .real-shop-section{background:#f4f7fb}
    .real-shop-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
    .real-shop-card{position:relative;margin:0;overflow:hidden;border-radius:24px;background:#fff;box-shadow:0 14px 40px rgba(15,23,42,.09);min-height:320px}
    .real-shop-card img{display:block;width:100%;height:100%;min-height:320px;object-fit:cover}
    .real-shop-card figcaption{position:absolute;left:12px;right:12px;bottom:12px;padding:12px 14px;border-radius:16px;background:rgba(8,15,28,.82);backdrop-filter:blur(10px);color:#fff}
    .real-shop-card figcaption b{display:block;font-size:15px;line-height:1.3}
    .real-shop-card figcaption span{display:block;margin-top:4px;font-size:11px;color:#d7e3f6}
    .real-shop-card.workshop-card{grid-column:span 2}
    .real-shop-card.workshop-card img{object-position:center}
    .contact-actions{align-items:stretch}
    .contact-actions .nav-photo-btn{position:relative;display:grid;grid-template-columns:112px minmax(0,1fr);align-items:stretch;min-height:104px;padding:0!important;overflow:hidden;border-radius:22px;background:#08111f;color:#fff!important;text-decoration:none!important;border:1px solid rgba(8,105,223,.24);box-shadow:0 14px 34px rgba(8,17,31,.16)}
    .nav-photo-btn img{width:112px;height:100%;min-height:104px;object-fit:cover}
    .nav-photo-copy{display:flex;flex-direction:column;justify-content:center;gap:4px;padding:15px 16px;text-align:left}
    .nav-photo-copy small{font-size:11px;font-weight:800;letter-spacing:.08em;color:#79b8ff}
    .nav-photo-copy strong{font-size:18px;line-height:1.25;color:#fff}
    .nav-photo-copy em{font-size:12px;font-style:normal;color:#b9c6d8}
    @media(max-width:860px){
      .real-shop-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .real-shop-card,.real-shop-card img{min-height:250px}
      .real-shop-card.workshop-card{grid-column:span 2;min-height:220px}
      .real-shop-card.workshop-card img{min-height:220px}
    }
    @media(max-width:520px){
      .real-shop-card{border-radius:20px;min-height:220px}
      .real-shop-card img{min-height:220px}
      .real-shop-card.workshop-card,.real-shop-card.workshop-card img{min-height:190px}
      .real-shop-card figcaption{left:9px;right:9px;bottom:9px;padding:10px 11px;border-radius:14px}
      .contact-actions{display:grid!important;grid-template-columns:1fr!important}
      .contact-actions .nav-photo-btn{width:100%;grid-template-columns:120px minmax(0,1fr);min-height:110px}
      .nav-photo-btn img{width:120px;min-height:110px}
    }
  `;
  document.head.appendChild(style);

  const cases = document.querySelector('#cases');
  if (cases && !document.querySelector('#realShopPhotos')) {
    const section = document.createElement('section');
    section.id = 'realShopPhotos';
    section.className = 'section real-shop-section';
    section.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <div><p class="eyebrow">REAL SHOP</p><h2>門市實拍。<br>維修不是只說說。</h2></div>
          <p>店內環境、檢修與施工都是實際現場，讓您來之前就看得到。</p>
        </div>
        <div class="real-shop-grid">
          <figure class="real-shop-card">
            <img src="/jerry/wheel.svg?v=1" alt="傑瑞電動車煞車與前輪檢修實拍" loading="lazy">
            <figcaption><b>檢修細節</b><span>煞車・輪組・日常檢查</span></figcaption>
          </figure>
          <figure class="real-shop-card">
            <img src="/jerry/mechanic.svg?v=1" alt="傑瑞電動車維修施工實拍" loading="lazy">
            <figcaption><b>現場施工</b><span>維修保養實際作業</span></figcaption>
          </figure>
          <figure class="real-shop-card workshop-card">
            <img src="/jerry/workshop.svg?v=1" alt="傑瑞電動車店內維修環境" loading="lazy">
            <figcaption><b>樹林實體門市</b><span>現場工位與維修空間</span></figcaption>
          </figure>
          <figure class="real-shop-card">
            <img src="/jerry/thumbs.svg?v=1" alt="傑瑞電動車服務實拍" loading="lazy">
            <figcaption><b>用心服務</b><span>有問題直接來店處理</span></figcaption>
          </figure>
        </div>
      </div>`;
    cases.insertAdjacentElement('afterend', section);
  }

  const mapBtn = document.querySelector('#mapBtn');
  if (mapBtn) {
    mapBtn.className = 'nav-photo-btn';
    mapBtn.innerHTML = `
      <img src="/jerry/storefront.svg?v=1" alt="傑瑞電動車店門口">
      <span class="nav-photo-copy">
        <small>STORE LOCATION</small>
        <strong>開啟導航</strong>
        <em>保安街郵局正對面</em>
      </span>`;
    mapBtn.setAttribute('aria-label', '開啟傑瑞電動車門市導航');
  }
})();
