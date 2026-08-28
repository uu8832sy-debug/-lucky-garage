import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { collection, doc, getDoc, getDocs, getFirestore } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const SHOP_ID = "jerry";
const app = getApps().length ? getApp() : initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG || {});
const db = getFirestore(app);
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const esc = (value) => String(value ?? "").replace(/[&<>'\"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':"&quot;"}[c]));

const placeholderItems = [
  { title:"維修施工", caption:"實際維修與施工紀錄", poster:"/jerry/mechanic.svg?v=2" },
  { title:"保養紀錄", caption:"日常保養與檢修分享", poster:"/jerry/wheel.svg?v=2" },
  { title:"店內實拍", caption:"門市現場與完工實拍", poster:"/jerry/workshop.svg?v=2" }
];

function injectStyles() {
  if ($("#jerryShortVideoStyles")) return;
  const style = document.createElement("style");
  style.id = "jerryShortVideoStyles";
  style.textContent = `
    #short-videos{background:#07111f;color:#fff;overflow:hidden;content-visibility:auto;contain-intrinsic-size:760px}
    #short-videos .short-video-head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:24px}
    #short-videos .short-video-head .eyebrow{color:#63a8ff}
    #short-videos .short-video-head h2{margin:5px 0 0;font-size:clamp(30px,4vw,52px);line-height:1.04;color:#fff}
    #short-videos .short-video-head>p{max-width:430px;margin:0;color:#a9b8ca;font-size:14px;line-height:1.8}
    .short-video-track{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(230px,300px);gap:16px;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x mandatory;padding:2px 2px 16px;scrollbar-width:none}
    .short-video-track::-webkit-scrollbar{display:none}
    .short-video-card{position:relative;scroll-snap-align:start;aspect-ratio:9/16;border-radius:26px;overflow:hidden;background:#111c2a;border:1px solid rgba(255,255,255,.09);box-shadow:0 18px 50px rgba(0,0,0,.28)}
    .short-video-card video,.short-video-card .short-video-poster{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#0d1724}
    .short-video-card video{z-index:1}
    .short-video-card .short-video-poster{z-index:0}
    .short-video-card::after{content:"";position:absolute;z-index:2;left:0;right:0;bottom:0;height:42%;background:linear-gradient(transparent,rgba(2,8,18,.94));pointer-events:none}
    .short-video-copy{position:absolute;z-index:3;left:17px;right:17px;bottom:17px;pointer-events:none}
    .short-video-copy small{display:block;color:#75b6ff;font-size:10px;font-weight:900;letter-spacing:.12em;margin-bottom:5px}
    .short-video-copy strong{display:block;color:#fff;font-size:19px;line-height:1.25}
    .short-video-copy span{display:block;color:#c6d1df;font-size:11px;line-height:1.5;margin-top:5px}
    .short-video-play{position:absolute;z-index:4;left:50%;top:50%;translate:-50% -50%;width:62px;height:62px;border:0;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.94);color:#07111f;font-size:23px;box-shadow:0 12px 34px rgba(0,0,0,.28);cursor:pointer}
    .short-video-card.is-playing .short-video-play{opacity:0;pointer-events:none}
    .short-video-card.is-placeholder .short-video-play{display:none}
    .short-video-card.is-placeholder::before{content:"即將上架";position:absolute;z-index:4;top:16px;left:16px;padding:7px 10px;border-radius:99px;background:rgba(4,12,24,.82);color:#fff;font-size:10px;font-weight:900;letter-spacing:.08em}
    .short-video-tip{display:flex;align-items:center;gap:8px;margin-top:8px;color:#8293a8;font-size:11px}
    @media(min-width:1080px){.short-video-track{grid-auto-columns:minmax(240px,1fr);grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-flow:row;overflow:visible}.short-video-card:nth-child(n+5){display:none}}
    @media(max-width:720px){#short-videos .short-video-head{display:block;margin-bottom:18px}#short-videos .short-video-head>p{margin-top:10px}.short-video-track{margin-right:calc(var(--page-pad,20px) * -1);padding-right:20px;grid-auto-columns:72vw;max-width:none}.short-video-card{border-radius:22px}}
  `;
  document.head.appendChild(style);
}

function normalizeItem(raw, index) {
  const url = String(raw?.url || raw?.videoUrl || raw?.video || raw?.shortVideoUrl || "").trim();
  const poster = String(raw?.poster || raw?.posterUrl || raw?.imageUrl || raw?.cover || raw?.thumbnail || "").trim();
  return {
    id:String(raw?.id || `short-${index + 1}`),
    url,
    poster,
    title:String(raw?.title || raw?.name || "施工短影音"),
    caption:String(raw?.caption || raw?.description || "傑瑞電動車現場紀錄"),
    visible:raw?.visible !== false
  };
}

async function loadVideoItems() {
  const items = [];
  try {
    const settings = await getDoc(doc(db,"shops",SHOP_ID,"siteSettings","shortVideos"));
    const data = settings.exists() ? settings.data() : null;
    const list = Array.isArray(data?.items) ? data.items : [];
    list.forEach((item,index) => items.push(normalizeItem(item,index)));
  } catch (error) {
    console.warn("Jerry short-video settings unavailable.", error);
  }
  if (items.some((item) => item.url && item.visible)) return items.filter((item) => item.visible && item.url);
  try {
    const snap = await getDocs(collection(db,"shops",SHOP_ID,"deliveryCases"));
    snap.docs.forEach((document,index) => {
      const data = document.data() || {};
      const normalized = normalizeItem({ id:document.id, ...data, poster:data.poster || data.imageUrl || data.images?.[0]?.url || data.images?.[0] }, index);
      if (normalized.url && normalized.visible) items.push(normalized);
    });
  } catch (error) {
    console.warn("Jerry case videos unavailable.", error);
  }
  return items.filter((item) => item.visible && item.url);
}

function cardHtml(item, index, placeholder = false) {
  const poster = item.poster || placeholderItems[index % placeholderItems.length].poster;
  if (placeholder) {
    return `<article class="short-video-card is-placeholder"><img class="short-video-poster" src="${esc(poster)}" alt="${esc(item.title)}" loading="lazy"><div class="short-video-copy"><small>JERRY SHORTS</small><strong>${esc(item.title)}</strong><span>${esc(item.caption)}</span></div></article>`;
  }
  return `<article class="short-video-card" data-video-card><img class="short-video-poster" src="${esc(poster)}" alt="${esc(item.title)} 封面" loading="lazy"><video playsinline webkit-playsinline preload="none" data-src="${esc(item.url)}" poster="${esc(poster)}"></video><button class="short-video-play" type="button" aria-label="播放 ${esc(item.title)}">▶</button><div class="short-video-copy"><small>JERRY SHORTS</small><strong>${esc(item.title)}</strong><span>${esc(item.caption)}</span></div></article>`;
}

function ensureSection(items) {
  if ($("#short-videos")) return $("#short-videos");
  const anchor = $("#products") || $("#cases") || $("#contact");
  if (!anchor) return null;
  const section = document.createElement("section");
  section.id = "short-videos";
  section.className = "section";
  const hasVideos = items.length > 0;
  const displayItems = hasVideos ? items.slice(0,8) : placeholderItems;
  section.innerHTML = `<div class="wrap"><div class="short-video-head"><div><p class="eyebrow">JERRY SHORTS</p><h2>短影音。<br>施工現場直接看。</h2></div><p>維修、保養、改裝與實車紀錄，直接看現場。</p></div><div class="short-video-track">${displayItems.map((item,index)=>cardHtml(item,index,!hasVideos)).join("")}</div><div class="short-video-tip">↔ 手機可左右滑動查看更多</div></div>`;
  anchor.before(section);
  const nav = $(".nav-links");
  if (nav && !nav.querySelector('a[href="#short-videos"]')) {
    const link = document.createElement("a");
    link.href = "#short-videos";
    link.textContent = "短影音";
    const productLink = nav.querySelector('a[href="#products"]');
    nav.insertBefore(link, productLink || null);
  }
  return section;
}

function setupPlayback() {
  const cards = $$("[data-video-card]");
  if (!cards.length) return;
  const videos = cards.map((card) => card.querySelector("video")).filter(Boolean);
  const pauseOthers = (active) => videos.forEach((video) => { if (video !== active && !video.paused) video.pause(); });
  const ensureSrc = (video) => {
    if (!video || video.src || !video.dataset.src) return;
    video.src = video.dataset.src;
    video.preload = "metadata";
    video.load();
  };
  const nearObserver = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target.querySelector("video");
      if (!video) return;
      if (entry.isIntersecting) ensureSrc(video);
      else if (!video.paused) video.pause();
    });
  }, { rootMargin:"280px 0px", threshold:0.01 }) : null;
  cards.forEach((card) => {
    const video = card.querySelector("video");
    const play = card.querySelector(".short-video-play");
    nearObserver?.observe(card);
    if (!nearObserver) ensureSrc(video);
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

init().catch((error) => console.warn("Jerry short-video section failed.", error));
