import fs from "node:fs";
import path from "node:path";

const indexPath = path.resolve("public/index.html");
if (!fs.existsSync(indexPath)) throw new Error("public/index.html missing after build");

let html = fs.readFileSync(indexPath, "utf8");
const marker = "JERRY_DOMAIN_REDIRECT_V1";
if (!html.includes(marker)) {
  const redirectScript = `<script>/* ${marker} */(function(){var h=String(location.hostname||'').toLowerCase();if((h==='jerrye-bike.com'||h==='www.jerrye-bike.com')&&!location.pathname.startsWith('/jerry/')){location.replace('/jerry/'+location.search+location.hash);}})();</script>`;
  html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}${redirectScript}`);
  fs.writeFileSync(indexPath, html, "utf8");
}

const publicJerryDir = path.resolve("public/jerry");
fs.mkdirSync(publicJerryDir, { recursive:true });
const jerryStaticFiles = ["reservation.js","shop-photos.js","catalog.js","orders.html","orders.js","wheel.svg","mechanic.svg","workshop.svg","thumbs.svg","storefront.svg"];
for (const fileName of jerryStaticFiles) {
  const source = path.resolve("jerry", fileName);
  const target = path.join(publicJerryDir, fileName);
  if (!fs.existsSync(source)) throw new Error(`Jerry static file missing: ${source}`);
  fs.copyFileSync(source, target);
}

const jerryIndexPath = path.resolve("public/jerry/index.html");
if (!fs.existsSync(jerryIndexPath)) throw new Error("public/jerry/index.html missing after build");
let jerryHtml = fs.readFileSync(jerryIndexPath, "utf8");
if (!/rel=["']icon["']/i.test(jerryHtml)) {
  jerryHtml = jerryHtml.replace("</title>", '</title>\n  <link rel="icon" type="image/png" href="/jerry/admin-logo.png" />\n  <link rel="apple-touch-icon" href="/jerry/admin-logo.png" />');
}
jerryHtml = jerryHtml
  .replace(/\s*<script[^>]+src=["']\/jerry\/reservation\.js[^"']*["'][^>]*><\/script>/gi, "")
  .replace(/\s*<script[^>]+src=["']\/jerry\/shop-photos\.js[^"']*["'][^>]*><\/script>/gi, "")
  .replace(/\s*<script[^>]+src=["']\/jerry\/catalog\.js[^"']*["'][^>]*><\/script>/gi, "");
jerryHtml = jerryHtml.replace("</body>",'  <script src="/jerry/reservation.js?v=3"></script>\n  <script src="/jerry/shop-photos.js?v=2"></script>\n  <script type="module" src="/jerry/catalog.js?v=2"></script>\n</body>');
fs.writeFileSync(jerryIndexPath, jerryHtml, "utf8");

const jerryAdminPath = path.resolve("public/jerry/admin.html");
if (!fs.existsSync(jerryAdminPath)) throw new Error("public/jerry/admin.html missing after build");
let jerryAdminHtml = fs.readFileSync(jerryAdminPath, "utf8");
jerryAdminHtml = jerryAdminHtml.replace(/\/admin\/admin\.js\?v=[^\"']+/g, "/admin/admin.js?v=32.4");
if (!/rel=["']icon["']/i.test(jerryAdminHtml)) {
  jerryAdminHtml = jerryAdminHtml.replace("</title>", '</title>\n  <link rel="icon" type="image/png" href="/jerry/admin-logo.png" />\n  <link rel="apple-touch-icon" href="/jerry/admin-logo.png" />');
}
if (!jerryAdminHtml.includes('/admin/orders.html?shop=jerry')) {
  jerryAdminHtml = jerryAdminHtml.replace('lg:grid-cols-5','lg:grid-cols-6');
  jerryAdminHtml = jerryAdminHtml.replace('</nav>', '<a href="/admin/orders.html?shop=jerry" class="bg-slate-900 border border-slate-800 text-fuchsia-300 font-black rounded-xl p-3 text-xs text-center"><i class="fa-solid fa-clipboard-list mr-1"></i>完整訂單管理</a></nav>');
}
jerryAdminHtml = jerryAdminHtml.replace(/href=["']\/jerry\/orders\.html["']/g,'href="/admin/orders.html?shop=jerry"');
fs.writeFileSync(jerryAdminPath, jerryAdminHtml, "utf8");

const sharedOrdersPath = path.resolve("public/admin/orders.html");
if (!fs.existsSync(sharedOrdersPath)) throw new Error("public/admin/orders.html missing after build");
let sharedOrdersHtml = fs.readFileSync(sharedOrdersPath, "utf8");
const ordersBrandMarker = "JERRY_SHARED_ORDERS_BRANDING_V1";
if (!sharedOrdersHtml.includes(ordersBrandMarker)) {
  const brandingScript = `<script>/* ${ordersBrandMarker} */(function(){var q=new URLSearchParams(location.search);if(q.get('shop')!=='jerry')return;try{sessionStorage.setItem('luckyGarageAdminShop','jerry');localStorage.setItem('luckyGarageAdminBrand','jerry')}catch(e){}document.title='傑瑞電動車｜訂單・收據・保固管理';var icon=document.createElement('link');icon.rel='icon';icon.type='image/png';icon.href='/jerry/admin-logo.png';document.head.appendChild(icon);var touch=document.createElement('link');touch.rel='apple-touch-icon';touch.href='/jerry/admin-logo.png';document.head.appendChild(touch);document.addEventListener('DOMContentLoaded',function(){var eye=document.querySelector('.topbar .eyebrow');if(eye)eye.textContent='傑瑞電動車';var h=document.querySelector('.topbar h1');if(h)h.textContent='訂單・收據・保固管理';var nav=document.querySelector('.topnav');if(nav)nav.innerHTML='<a href="/jerry/admin.html?shop=jerry">後台首頁</a><a href="/jerry/" target="_blank" rel="noopener">查看前台</a>';var loginTitle=document.querySelector('#loginCard h2');if(loginTitle)loginTitle.textContent='傑瑞電動車管理員登入';var deniedNote=document.querySelector('#deniedCard .note');if(deniedNote)deniedNote.textContent='請確認此登入帳號已綁定傑瑞電動車管理權限。';});})();</script>`;
  sharedOrdersHtml = sharedOrdersHtml.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n  ${brandingScript}`);
}
fs.writeFileSync(sharedOrdersPath, sharedOrdersHtml, "utf8");

console.log("Jerry fixed catalog, reservation, photos, navigation, shared full orders backend, favicon, and admin branding injected");
