import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { collection, getDocs, getFirestore } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const SHOP_ID = "jerry";
const app = getApps().length ? getApp() : initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG || {});
const db = getFirestore(app);

const CATALOG = [
  {
    id:"vespa-big", name:"大偉士", aliases:["大偉士"], dual:true,
    rows:[
      ["鉛酸電池","表定 40km",38000,43000],
      ["72V 30Ah 鋰電","表定 60km",53000,58000],
      ["72V 40Ah 鋰電","表定 80km",59000,64000],
      ["72V 50Ah 鋰電","表定 100km",64000,69000],
      ["72V 65Ah 鋰電","表定 130km",69000,74000],
      ["72V 80Ah 鋰電","表定 160km",75000,80000]
    ]
  },
  {
    id:"z3", name:"Z3 天鵝座", aliases:["z3天鵝座","z3","天鵝座"], dual:true,
    rows:[
      ["鉛酸電池","表定 40km",43000,48000],
      ["72V 30Ah 鋰電","表定 60km",58000,63000],
      ["72V 40Ah 鋰電","表定 80km",64000,69000],
      ["72V 50Ah 鋰電","表定 100km",69000,74000],
      ["72V 65Ah 鋰電","表定 130km",74000,79000],
      ["72V 80Ah 鋰電","表定 160km",80000,85000]
    ]
  },
  {
    id:"nine", name:"正 9 號", aliases:["正9號","正九號"], dual:true,
    rows:[
      ["鉛酸電池","表定 40km",45000,50000],
      ["72V 30Ah 鋰電","表定 60km",60000,65000],
      ["72V 40Ah 鋰電","表定 80km",66000,71000],
      ["72V 50Ah 鋰電","表定 100km",71000,76000],
      ["72V 65Ah 鋰電","表定 130km",76000,81000],
      ["72V 80Ah 鋰電","表定 160km",82000,87000]
    ]
  },
  {
    id:"vespa-small", name:"小偉士", aliases:["小偉士"], dual:false,
    rows:[
      ["48V 20Ah 鉛酸","表定 40km",32000],
      ["60V 20Ah 鉛酸","表定 45km",33000],
      ["48V 20Ah 鋰電","表定 40km",43000],
      ["60V 30Ah 鋰電","表定 60km",49000],
      ["72V 30Ah 鋰電","表定 65km",52000]
    ]
  },
  {
    id:"cool", name:"極酷", aliases:["極酷"], dual:false,
    rows:[
      ["48V 12Ah 鉛酸","表定 20km",20000],
      ["48V 20Ah 鉛酸","表定 40km",23000],
      ["48V 20Ah 鋰電","表定 40km",29000],
      ["48V 30Ah 鋰電","表定 60km",33000]
    ]
  }
];

const money = (n) => `NT$ ${Number(n).toLocaleString("zh-TW")}`;
const esc = (v) => String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const norm = (v) => String(v || "").toLowerCase().replace(/[\s\-＿_]/g, "");

function firstImage(item) {
  const list = Array.isArray(item?.images) ? item.images : [];
  const primary = list.find(x => x?.isPrimary) || list[0];
  return typeof primary === "string" ? primary : primary?.url || item?.imageUrl || item?.photoUrl || "";
}

function findProduct(products, model) {
  return products.find(item => {
    const name = norm(item.name || item.title || item.model || item.id);
    return model.aliases.some(alias => name.includes(norm(alias)) || norm(alias).includes(name));
  });
}

function injectStyles() {
  if (document.querySelector('#jerryCatalogStyles')) return;
  const style = document.createElement('style');
  style.id = 'jerryCatalogStyles';
  style.textContent = `
    #productGrid.jerry-catalog-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
    .jerry-model-card{overflow:hidden;border-radius:26px;background:#fff;color:#111827;box-shadow:0 18px 50px rgba(0,0,0,.12)}
    .jerry-model-card.wide{grid-column:span 2}
    .jerry-model-media{height:260px;background:linear-gradient(135deg,#eef3f8,#dfe7f1);display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}
    .jerry-model-media img{width:100%;height:100%;object-fit:cover;display:block}
    .jerry-model-placeholder{text-align:center;color:#718096;padding:28px}
    .jerry-model-placeholder b{display:block;font-size:28px;color:#111827;margin-bottom:8px}
    .jerry-model-placeholder span{font-size:13px}
    .jerry-model-body{padding:22px}
    .jerry-model-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:16px}
    .jerry-model-head h3{margin:0;font-size:28px;line-height:1.1;color:#111827}
    .jerry-model-head small{font-size:12px;color:#6b7280;font-weight:700}
    .jerry-price-wrap{overflow:auto;border:1px solid #e5e7eb;border-radius:16px}
    .jerry-price-table{width:100%;border-collapse:collapse;min-width:520px;background:#fff}
    .jerry-price-table th,.jerry-price-table td{padding:11px 12px;border-bottom:1px solid #edf0f3;text-align:left;font-size:13px;white-space:nowrap}
    .jerry-price-table th{background:#0b1728;color:#fff;font-size:12px;letter-spacing:.03em}
    .jerry-price-table th.price-special{background:#9a5600}
    .jerry-price-table td strong{display:block;color:#111827;font-size:13px}
    .jerry-price-table td span{display:block;color:#6b7280;font-size:11px;margin-top:2px}
    .jerry-price-table td.price{font-weight:900;color:#0b1728}
    .jerry-price-table tr:last-child td{border-bottom:0}
    .jerry-model-note{margin:14px 0 0;color:#6b7280;font-size:12px;line-height:1.6}
    @media(max-width:760px){
      #productGrid.jerry-catalog-grid{grid-template-columns:1fr;gap:16px}
      .jerry-model-card.wide{grid-column:auto}
      .jerry-model-media{height:210px}
      .jerry-model-body{padding:18px}
      .jerry-model-head h3{font-size:24px}
      .jerry-price-table{min-width:470px}
    }
  `;
  document.head.appendChild(style);
}

function renderCatalog(products = []) {
  const grid = document.querySelector('#productGrid');
  if (!grid) return;
  injectStyles();
  grid.className = 'product-grid jerry-catalog-grid';
  grid.dataset.jerryCatalog = '1';
  grid.innerHTML = CATALOG.map((model, index) => {
    const product = findProduct(products, model);
    const image = firstImage(product);
    const tableHead = model.dual
      ? '<tr><th>電池規格</th><th>一般版</th><th class="price-special">特仕版</th></tr>'
      : '<tr><th>電池規格</th><th>售價</th></tr>';
    const rows = model.rows.map(row => model.dual
      ? `<tr><td><strong>${esc(row[0])}</strong><span>${esc(row[1])}</span></td><td class="price">${money(row[2])}</td><td class="price">${money(row[3])}</td></tr>`
      : `<tr><td><strong>${esc(row[0])}</strong><span>${esc(row[1])}</span></td><td class="price">${money(row[2])}</td></tr>`
    ).join('');
    return `<article class="jerry-model-card ${index < 3 ? 'wide' : ''}">
      <div class="jerry-model-media">${image ? `<img src="${esc(image)}" alt="${esc(model.name)}" loading="lazy">` : `<div class="jerry-model-placeholder"><b>${esc(model.name)}</b><span>車款照片由店家後台上傳</span></div>`}</div>
      <div class="jerry-model-body">
        <div class="jerry-model-head"><h3>${esc(model.name)}</h3><small>新車價目</small></div>
        <div class="jerry-price-wrap"><table class="jerry-price-table"><thead>${tableHead}</thead><tbody>${rows}</tbody></table></div>
        <p class="jerry-model-note">表定里程僅供參考，實際續航依騎乘方式、載重、路況與電池狀態而異。</p>
      </div>
    </article>`;
  }).join('');
}

async function loadCatalog() {
  let products = [];
  try {
    const snap = await getDocs(collection(db, 'shops', SHOP_ID, 'products'));
    products = snap.docs.map(doc => ({ id:doc.id, ...doc.data() })).filter(item => item.visible !== false);
  } catch (error) {
    console.warn('Jerry catalog photos unavailable; showing prices without photos.', error);
  }
  renderCatalog(products);
}

const grid = document.querySelector('#productGrid');
if (grid) {
  const observer = new MutationObserver(() => {
    if (!grid.dataset.jerryCatalog) loadCatalog();
  });
  observer.observe(grid, { childList:true });
}

setTimeout(loadCatalog, 250);
