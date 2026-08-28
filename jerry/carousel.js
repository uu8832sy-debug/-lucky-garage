(() => {
  if (document.querySelector('#jerryCarousel')) return;
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const slides = [
    {src:'/jerry/workshop.svg?v=3', eyebrow:'JERRY WORKSHOP', title:'店內施工現場', text:'維修、保養、改裝，直接看實際工位。'},
    {src:'/jerry/mechanic.svg?v=3', eyebrow:'SERVICE', title:'實際維修施工', text:'現場檢查、施工與完工確認。'},
    {src:'/jerry/wheel.svg?v=3', eyebrow:'MAINTENANCE', title:'煞車・前輪檢修', text:'耗材與安全項目依實際狀況處理。'},
    {src:'/jerry/storefront.svg?v=3', eyebrow:'SHULIN STORE', title:'樹林實體門市', text:'新北市樹林區保安街一段 366 號。'},
    {src:'/jerry/thumbs.svg?v=3', eyebrow:'AFTER SERVICE', title:'完工確認', text:'施工內容確認後再交車。'}
  ];
  const style = document.createElement('style');
  style.textContent = `
    .jerry-carousel-section{background:#fff;padding:34px 0 52px}
    .jerry-carousel{position:relative;overflow:hidden;border-radius:34px;background:#07101e;box-shadow:0 22px 70px rgba(13,45,93,.18)}
    .jerry-carousel-track{display:flex;transition:transform .48s cubic-bezier(.22,.61,.36,1);will-change:transform}
    .jerry-carousel-slide{position:relative;min-width:100%;height:520px;overflow:hidden}
    .jerry-carousel-slide img{width:100%;height:100%;display:block;object-fit:cover}
    .jerry-carousel-slide:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,12,25,.82),rgba(3,12,25,.15) 58%,rgba(3,12,25,.05))}
    .jerry-carousel-copy{position:absolute;z-index:2;left:42px;bottom:38px;max-width:500px;color:#fff}
    .jerry-carousel-copy small{display:block;color:#7fb8ff;font-weight:900;letter-spacing:.15em;font-size:11px}
    .jerry-carousel-copy h2{font-size:38px;line-height:1.05;margin:8px 0 8px}.jerry-carousel-copy p{margin:0;color:#d8e5f7}
    .jerry-carousel-dots{position:absolute;z-index:3;right:24px;bottom:22px;display:flex;gap:7px}
    .jerry-carousel-dots button{width:9px;height:9px;border-radius:50%;border:0;background:rgba(255,255,255,.38);padding:0}.jerry-carousel-dots button.active{background:#fff;transform:scale(1.25)}
    .jerry-carousel-arrow{position:absolute;z-index:3;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.28);background:rgba(0,0,0,.34);color:#fff;font-size:24px;display:grid;place-items:center}.jerry-carousel-arrow.prev{left:16px}.jerry-carousel-arrow.next{right:16px}
    @media(max-width:680px){.jerry-carousel-section{padding:18px 0 34px}.jerry-carousel{border-radius:24px}.jerry-carousel-slide{height:360px}.jerry-carousel-copy{left:22px;right:22px;bottom:26px}.jerry-carousel-copy h2{font-size:30px}.jerry-carousel-copy p{font-size:13px;max-width:270px}.jerry-carousel-arrow{width:38px;height:38px;font-size:20px}.jerry-carousel-dots{right:18px;bottom:16px}}
  `;
  document.head.appendChild(style);
  const section = document.createElement('section');
  section.className = 'jerry-carousel-section';
  section.id = 'jerryCarousel';
  section.innerHTML = `<div class="wrap"><div class="jerry-carousel" aria-label="傑瑞電動車門市與施工輪播"><div class="jerry-carousel-track">${slides.map(s=>`<article class="jerry-carousel-slide"><img src="${s.src}" alt="${s.title}"><div class="jerry-carousel-copy"><small>${s.eyebrow}</small><h2>${s.title}</h2><p>${s.text}</p></div></article>`).join('')}</div><button class="jerry-carousel-arrow prev" type="button" aria-label="上一張">‹</button><button class="jerry-carousel-arrow next" type="button" aria-label="下一張">›</button><div class="jerry-carousel-dots">${slides.map((_,i)=>`<button type="button" data-slide="${i}" class="${i===0?'active':''}" aria-label="第 ${i+1} 張"></button>`).join('')}</div></div></div>`;
  hero.insertAdjacentElement('afterend', section);
  const track = section.querySelector('.jerry-carousel-track');
  const dots = [...section.querySelectorAll('.jerry-carousel-dots button')];
  let index = 0, timer;
  const go = (next) => { index = (next + slides.length) % slides.length; track.style.transform = `translateX(-${index*100}%)`; dots.forEach((d,i)=>d.classList.toggle('active',i===index)); };
  const restart = () => { clearInterval(timer); timer=setInterval(()=>go(index+1),4500); };
  section.querySelector('.prev').addEventListener('click',()=>{go(index-1);restart();});
  section.querySelector('.next').addEventListener('click',()=>{go(index+1);restart();});
  dots.forEach(d=>d.addEventListener('click',()=>{go(Number(d.dataset.slide));restart();}));
  let startX=0;
  track.addEventListener('touchstart',e=>{startX=e.touches[0].clientX;},{passive:true});
  track.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-startX;if(Math.abs(dx)>45){go(index+(dx<0?1:-1));restart();}},{passive:true});
  restart();
})();
