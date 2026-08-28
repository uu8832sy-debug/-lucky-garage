(() => {
  const style = document.createElement('style');
  style.textContent = `
    #caseGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
    #caseGrid .jerry-static-case{position:relative;overflow:hidden;border-radius:24px;background:#fff;box-shadow:0 14px 40px rgba(15,23,42,.09);min-height:320px}
    #caseGrid .jerry-static-case img{display:block;width:100%;height:100%;min-height:320px;object-fit:cover}
    #caseGrid .jerry-static-case .case-body{position:absolute;left:12px;right:12px;bottom:12px;padding:12px 14px;border-radius:16px;background:rgba(8,15,28,.84);backdrop-filter:blur(10px);color:#fff}
    #caseGrid .jerry-static-case .case-body h3{margin:0;font-size:15px;line-height:1.35;color:#fff}
    #caseGrid .jerry-static-case .case-body p{margin:5px 0 0;font-size:11px;line-height:1.5;color:#d7e3f6}
    #caseGrid .jerry-static-case.workshop{grid-column:span 2}
    .contact-actions{align-items:stretch}
    .contact-actions .nav-photo-btn{position:relative;display:grid;grid-template-columns:112px minmax(0,1fr);align-items:stretch;min-height:104px;padding:0!important;overflow:hidden;border-radius:22px;background:#08111f;color:#fff!important;text-decoration:none!important;border:1px solid rgba(8,105,223,.24);box-shadow:0 14px 34px rgba(8,17,31,.16)}
    .nav-photo-btn img{width:112px;height:100%;min-height:104px;object-fit:cover}
    .nav-photo-copy{display:flex;flex-direction:column;justify-content:center;gap:4px;padding:15px 16px;text-align:left}
    .nav-photo-copy small{font-size:11px;font-weight:800;letter-spacing:.08em;color:#79b8ff}
    .nav-photo-copy strong{font-size:18px;line-height:1.25;color:#fff}
    .nav-photo-copy em{font-size:12px;font-style:normal;color:#b9c6d8}
    @media(max-width:860px){
      #caseGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      #caseGrid .jerry-static-case,#caseGrid .jerry-static-case img{min-height:250px}
      #caseGrid .jerry-static-case.workshop{grid-column:span 2;min-height:220px}
      #caseGrid .jerry-static-case.workshop img{min-height:220px}
    }
    @media(max-width:520px){
      #caseGrid .jerry-static-case{border-radius:20px;min-height:220px}
      #caseGrid .jerry-static-case img{min-height:220px}
      #caseGrid .jerry-static-case.workshop,#caseGrid .jerry-static-case.workshop img{min-height:190px}
      #caseGrid .jerry-static-case .case-body{left:9px;right:9px;bottom:9px;padding:10px 11px;border-radius:14px}
      .contact-actions{display:grid!important;grid-template-columns:1fr!important}
      .contact-actions .nav-photo-btn{width:100%;grid-template-columns:120px minmax(0,1fr);min-height:110px}
      .nav-photo-btn img{width:120px;min-height:110px}
    }
  `;
  document.head.appendChild(style);

  const defaultCases = `
    <article class="case-card jerry-static-case" data-jerry-static-case="wheel">
      <img src="/jerry/wheel.svg?v=2" alt="煞車與前輪檢修施工照" loading="lazy">
      <div class="case-body"><h3>煞車・前輪檢修</h3><p>實際施工照片</p></div>
    </article>
    <article class="case-card jerry-static-case" data-jerry-static-case="mechanic">
      <img src="/jerry/mechanic.svg?v=2" alt="Gogoro 維修施工照" loading="lazy">
      <div class="case-body"><h3>維修施工</h3><p>實際施工照片</p></div>
    </article>
    <article class="case-card jerry-static-case workshop" data-jerry-static-case="workshop">
      <img src="/jerry/workshop.svg?v=2" alt="店內維修施工照" loading="lazy">
      <div class="case-body"><h3>店內施工現場</h3><p>實際維修工位</p></div>
    </article>
    <article class="case-card jerry-static-case" data-jerry-static-case="thumbs">
      <img src="/jerry/thumbs.svg?v=2" alt="維修完成施工照" loading="lazy">
      <div class="case-body"><h3>完工確認</h3><p>實際服務紀錄</p></div>
    </article>`;

  const ensureDefaultCases = () => {
    const grid = document.querySelector('#caseGrid');
    if (!grid || grid.querySelector('[data-jerry-static-case]')) return;
    grid.querySelectorAll('.loading-card,.empty-card').forEach((el) => el.remove());
    grid.insertAdjacentHTML('afterbegin', defaultCases);
  };

  const caseGrid = document.querySelector('#caseGrid');
  if (caseGrid) {
    ensureDefaultCases();
    const observer = new MutationObserver(() => ensureDefaultCases());
    observer.observe(caseGrid, { childList:true });
  }

  const mapBtn = document.querySelector('#mapBtn');
  if (mapBtn) {
    mapBtn.className = 'nav-photo-btn';
    mapBtn.innerHTML = `
      <img src="/jerry/storefront.svg?v=2" alt="傑瑞電動車店門口">
      <span class="nav-photo-copy">
        <small>STORE LOCATION</small>
        <strong>開啟導航</strong>
        <em>保安街郵局正對面</em>
      </span>`;
    mapBtn.setAttribute('aria-label', '開啟傑瑞電動車門市導航');
  }
})();
