(() => {
  const SOCIALS = [
    { label: 'LINE', icon: 'fa-line', url: 'https://line.me/R/ti/p/@882npfrm' },
    { label: 'TikTok', icon: 'fa-tiktok', url: 'https://www.tiktok.com/@jerry950114?_r=1&_t=ZS-99GAGnlhh3q' },
    { label: 'Instagram', icon: 'fa-instagram', url: 'https://www.instagram.com/jerryebike?igsi=d3JnZzBrOHB4NXp5' },
    { label: 'Facebook', icon: 'fa-facebook-f', url: 'https://www.facebook.com/share/1DcGyHGAoq/?mibextid=wwXIfr' }
  ];

  if (!document.querySelector('link[data-jerry-fa]')) {
    const fa = document.createElement('link');
    fa.rel = 'stylesheet';
    fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
    fa.dataset.jerryFa = '1';
    document.head.appendChild(fa);
  }

  if (!document.querySelector('#jerrySocialStyles')) {
    const style = document.createElement('style');
    style.id = 'jerrySocialStyles';
    style.textContent = `
      .jerry-social-block{margin-top:22px;padding-top:20px;border-top:1px solid #d8dce2}
      .jerry-social-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
      .jerry-social-title strong{font-size:15px;color:#111827}
      .jerry-social-title span{font-size:11px;color:#6b7280}
      .jerry-social-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .jerry-social-link{display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;border-radius:15px;background:#fff;border:1px solid #dfe4ea;color:#111827;font-size:12px;font-weight:900;box-shadow:0 8px 20px rgba(15,23,42,.05);transition:.16s ease}
      .jerry-social-link:hover{transform:translateY(-1px);border-color:#aeb9c7}
      .jerry-social-link i{font-size:20px}
      .jerry-social-footer{display:flex;align-items:center;gap:8px;margin-left:auto}
      .jerry-social-footer a{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#151515;color:#fff!important;border:1px solid #303030;font-size:17px}
      @media(max-width:620px){
        .jerry-social-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        .jerry-social-link{min-height:52px;font-size:13px}
        .jerry-social-footer{justify-content:center;margin:14px 0 0}
      }
    `;
    document.head.appendChild(style);
  }

  const linksHtml = SOCIALS.map(item => `
    <a class="jerry-social-link" href="${item.url}" target="_blank" rel="noopener noreferrer" aria-label="開啟傑瑞電動車 ${item.label}">
      <i class="fa-brands ${item.icon}" aria-hidden="true"></i><span>${item.label}</span>
    </a>`).join('');

  const contactCard = document.querySelector('.contact-card');
  if (contactCard && !contactCard.querySelector('.jerry-social-block')) {
    contactCard.insertAdjacentHTML('beforeend', `
      <div class="jerry-social-block">
        <div class="jerry-social-title"><strong>追蹤傑瑞電動車</strong><span>官方社群</span></div>
        <div class="jerry-social-grid">${linksHtml}</div>
      </div>`);
  }

  const footerRow = document.querySelector('.footer-row');
  if (footerRow && !footerRow.querySelector('.jerry-social-footer')) {
    const compact = SOCIALS.map(item => `<a href="${item.url}" target="_blank" rel="noopener noreferrer" aria-label="${item.label}"><i class="fa-brands ${item.icon}" aria-hidden="true"></i></a>`).join('');
    footerRow.insertAdjacentHTML('beforeend', `<div class="jerry-social-footer">${compact}</div>`);
  }
})();
