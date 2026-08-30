import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { collection, doc, getDoc, getDocs, getFirestore } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const app = getApps().length ? getApp() : initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG || {});
const db = getFirestore(app);
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const esc = (value) => String(value ?? "").replace(/[&<>'\"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':"&quot;"}[c]));

const placeholders = [
  { title:"實車交付", caption:"交車與實車環繞紀錄", poster:"/assets/brand/logo-round-v2.webp" },
  { title:"車款介紹", caption:"車款細節與配備分享", poster:"/assets/brand/logo-round-v2.webp" },
  { title:"改裝紀錄", caption:"施工、配備與完成實拍", poster:"/assets/brand/logo-round-v2.webp" }
];

function injectStyles() {
  if ($("#xiaoyuShortVideoStyles")) return;
  const style = document.createElement("style");
  style.id = "xiaoyuShortVideoStyles";
  style.textContent = `
    #short-videos{background:#08101a;color:#fff;overflow:hidden;content-visibility:auto;contain-intrinsic-size:720px;padding:64px 0}
    #short-videos .short-video-wrap{width:min(1180px,calc(100% - 32px));margin:0 auto}
    #short-videos .short-video-head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:24px}
    #short-videos .short-video-head .eyebrow{margin:0 0 6px;color:#34d399;font-size:11px;font-weight:900;letter-spacing:.13em}
    #short-videos .short-video-head h2{margin:0;font-size:clamp(28px,4vw,48px);line-height:1.06;color:#fff}
    #short-videos .short-video-head>p{max-width:440px;margin:0;color:#aab7c7;font-size:14px;line-height:1.8}
    .yu-short-video-track{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(220px,300px);gap:16px;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x mandatory;padding:2px 2px 16px;scrollbar-width:none}
    .yu-short-video-track::-webkit-scrollbar{display:none}
    .yu-short-video-card{position:relative;scroll-snap-align:start;aspect-ratio:9/16;border-radius:24px;overflow:hidden;background:#111c2a;border:1px solid rgba(255,255,255,.09);box-shadow:0 18px 50px rgba(0,0,0,.28)}
    .yu-short-video-card video,.yu-short-video-card .yu-short-video-poster{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#0d1724}
    .yu-short-video-card video{z-index:1}.yu-short-video-card .yu-short-video-poster{z-index:0}
    .yu-short-video-card::after{content:"";position:absolute;z-index:2;left:0;right:0;bottom:0;height:44%;background:linear-gradient(transparent,rgba(2,8,18,.95));pointer-events:none}
    .yu-short-video-copy{position:absolute;z-index:3;left:16px;right:16px;bottom:16px;pointer-events:none}
    .yu-short-video-copy small{display:block;color:#6ee7b7;font-size:10px;font-weight:900;letter-spacing:.12em;margin-bottom:5px}
    .yu-short-video-copy strong{display:block;color:#fff;font-size:18px;line-height:1.25}.yu-short-video-copy span{display:block;color:#c6d1df;font-size:11px;line-height:1.5;margin-top:5px}
    .yu-short-video-play{position:absolute;z-index:4;left:50%;top:50%;translate:-50% -50%;width:60px;height:60px;border:0;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.94);color:#07111f;font-size:22px;box-shadow:0 12px 34px rgba(0,0,0,.28);cursor:pointer}
    .yu-short-video-card.is-playing .yu-short-video-play{opacity:0;pointer-events:none}.yu-short-video-card.is-placeholder .yu-short-video-play{display:none}
    .yu-short-video-card.is-placeholder::before{content:"即將上架";position:absolute;z-index:4;top:15px;left:15px;padding:7px 10px;border-radius:99px;background:rgba(4,12,24,.82);color:#fff;font-size:10px;font-weight:900;letter-spacing:.08em}
    .yu-short-video-tip{display:flex;align-items:center;gap:8px;margin-top:8px;color:#8293a8;font-size:11px}
    @media(min-width:1080px){.yu-short-video-track{grid-auto-columns:minmax(220px,1fr);grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-flow:row;overflow:visible}.yu-short-video-card:nth-child(n+5){display:none}}
    @media(max-width:720px){#short-videos{padding:46px 0}#short-videos .short-video-head{display:block;margin-bottom:18px}#short-videos .short-video-head>p{margin-top:10px}.yu-short-video-track{margin-right:-16px;padding-right:16px;grid-auto-columns:72vw}.yu-short-video-card{border-radius:21px}}
  `;
  document.head.appendChild(style);
}

function normalizeItem(raw, index) {
  const url = String(raw?.url || raw?.videoUrl || raw?.video || raw?.shortVideoUrl || "").trim();
  const poster = String(raw?.poster || raw?.posterUrl || raw?.imageUrl || raw?.cover || raw?.thumbnail || raw?.images?.find?.((x) => x?.isPrimary)?.url || raw?.images?.[0]?.url || raw?.images?.[0] || "").trim();
  return {
    id:String(raw?.id || `short-${index + 1}`),
    url,
    poster,
    title:String(raw?.title || raw?.name || "小宇微電實拍"),
    caption:String(raw?.caption || raw?.description || raw?.note || "實車、交車與施工紀錄"),
    order:Number(raw?.order || index + 1),
    visible:raw?.visible !== false && raw?.published !== false
  };
}

async function loadVideoItems() {
  const items = [];
  try {
    const settings = await getDoc(doc(db,"siteSettings","shortVideos"));
    const list = settings.exists() && Array.isArray(settings.data()?.items) ? settings.data().items : [];
    list.forEach((item,index) => items.push(normalizeItem(item,index)));
  } catch (error) {
    console.warn("Xiaoyu short-video settings unavailable.", error);
  }
  if (items.some((item) => item.url && item.visible)) return items.filter((item) => item.visible && item.url).sort((a,b)=>a.order-b.order);
  try {
    const snap = await getDocs(collection(db,"deliveryCases"));
    snap.docs.forEach((entry,index) => items.push(normalizeItem({ id:entry.id, ...entry.data() }, index)));
  } catch (error) {
    console.warn("Xiaoyu case videos unavailable.", error);
  }
  return items.filter((item) => item.visible && item.url).sort((a,b)=>a.order-b.order);
}

function cardHtml(item, index, placeholder = false) {
  const poster = item.poster || placeholders[index % placeholders.length].poster;
  if (placeholder) {
    return `<article class="yu-short-video-card is-placeholder"><img class="yu-short-video-poster" src="${esc(poster)}" alt="${esc(item.title)}" loading="lazy"><div class="yu-short-video-copy"><small>YU SHORTS</small><strong>${esc(item.title)}</strong><span>${esc(item.caption)}</span></div></article>`;
  }
  return `<article class="yu-short-video-card" data-yu-video-card><img class="yu-short-video-poster" src="${esc(poster)}" alt="${esc(item.title)} 封面" loading="lazy"><video playsinline webkit-playsinline preload="none" data-src="${esc(item.url)}" poster="${esc(poster)}"></video><button class="yu-short-video-play" type="button" aria-label="播放 ${esc(item.title)}">▶</button><div class="yu-short-video-copy"><small>YU SHORTS</small><strong>${esc(item.title)}</strong><span>${esc(item.caption)}</span></div></article>`;
}

function ensureSection(items) {
  if ($("#short-videos")) return $("#short-videos");
  const anchor = $("#deliverySection") || document.querySelector("footer");
  if (!anchor) return null;
  const hasVideos = items.length > 0;
  const displayItems = hasVideos ? items.slice(0,8) : placeholders;
  const section = document.createElement("section");
  section.id = "short-videos";
  section.innerHTML = `<div class="short-video-wrap"><div class="short-video-head"><div><p class="eyebrow">YU SHORTS</p><h2>實車短影音。<br>直接看細節。</h2></div><p>交車、實車環繞、車款介紹與施工紀錄，直接用影片看現場。</p></div><div class="yu-short-video-track">${displayItems.map((item,index)=>cardHtml(item,index,!hasVideos)).join("")}</div><div class="yu-short-video-tip">↔ 手機可左右滑動查看更多</div></div>`;
  anchor.before(section);
  return section;
}

function setupPlayback() {
  const cards = $$("[data-yu-video-card]");
  if (!cards.length) return;
  const videos = cards.map((card) => card.querySelector("video")).filter(Boolean);
  const pauseOthers = (active) => videos.forEach((video) => { if (video !== active && !video.paused) video.pause(); });
  const ensureSrc = (video) => {
    if (!video || video.src || !video.dataset.src) return;
    video.src = video.dataset.src;
    video.preload = "metadata";
    video.load();
  };
  const observer = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target.querySelector("video");
      if (!video) return;
      if (entry.isIntersecting) ensureSrc(video);
      else if (!video.paused) video.pause();
    });
  }, { rootMargin:"280px 0px", threshold:0.01 }) : null;
  cards.forEach((card) => {
    const video = card.querySelector("video");
    const play = card.querySelector(".yu-short-video-play");
    observer?.observe(card);
    if (!observer) ensureSrc(video);
    play?.addEventListener("click", async () => {
      ensureSrc(video);
      pauseOthers(video);
      video.controls = true;
      try { await video.play(); } catch (error) { console.warn("Video play blocked.", error); }
    });
    video?.addEventListener("play", () => { pauseOthers(video); card.classList.add("is-playing"); });
    video?.addEventListener("pause", () => card.classList.remove("is-playing"));
    video?.addEventListener("ended", () => { card.classList.remove("is-playing"); video.controls = false; });
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) videos.forEach((video) => video.pause()); });
}

async function init() {
  injectStyles();
  const items = await loadVideoItems();
  ensureSection(items);
  setupPlayback();
}

init().catch((error) => console.warn("Xiaoyu short-video section failed.", error));
