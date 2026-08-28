import fs from "node:fs";
import path from "node:path";

const indexPath=path.resolve("public/index.html");
if(!fs.existsSync(indexPath))throw new Error("public/index.html missing after build");
let html=fs.readFileSync(indexPath,"utf8");
const marker="JERRY_DOMAIN_REDIRECT_V1";
if(!html.includes(marker)){
  const redirectScript=`<script>/* ${marker} */(function(){var h=String(location.hostname||'').toLowerCase();if((h==='jerrye-bike.com'||h==='www.jerrye-bike.com')&&!location.pathname.startsWith('/jerry/')){location.replace('/jerry/'+location.search+location.hash);}})();</script>`;
  html=html.replace(/<head(\s[^>]*)?>/i,m=>`${m}${redirectScript}`);
  fs.writeFileSync(indexPath,html,"utf8");
}

const publicJerryDir=path.resolve("public/jerry");
fs.mkdirSync(publicJerryDir,{recursive:true});
const jerryStaticFiles=["reservation.js","shop-photos.js","catalog.js","carousel.js","installment.js","online-review.js","media-admin.js","product-photo-fix.js","short-videos.js","short-video-playback-fix.js","social-links.js","stability.css","admin-products.js","orders.html","orders.js","wheel.svg","mechanic.svg","workshop.svg","thumbs.svg","storefront.svg"];
for(const fileName of jerryStaticFiles){
  const source=path.resolve("jerry",fileName),target=path.join(publicJerryDir,fileName);
  if(!fs.existsSync(source))throw new Error(`Jerry static file missing: ${source}`);
  fs.copyFileSync(source,target);
}

const jerryIndexPath=path.resolve("public/jerry/index.html");
if(!fs.existsSync(jerryIndexPath))throw new Error("public/jerry/index.html missing after build");
let jerryHtml=fs.readFileSync(jerryIndexPath,"utf8");
if(!/rel=["']icon["']/i.test(jerryHtml))jerryHtml=jerryHtml.replace("</title>",'</title>\n  <link rel="icon" type="image/png" href="/jerry/admin-logo.png" />\n  <link rel="apple-touch-icon" href="/jerry/admin-logo.png" />');
if(!jerryHtml.includes('/jerry/stability.css'))jerryHtml=jerryHtml.replace(/(<link rel="stylesheet" href="\/jerry\/styles\.css[^>]*>)/i,'$1\n  <link rel="stylesheet" href="/jerry/stability.css?v=2" />');
jerryHtml=jerryHtml
  .replace(/\s*<script[^>]+src=["']\/jerry\/(reservation|shop-photos|catalog|carousel|installment|short-videos|short-video-playback-fix|social-links)\.js[^"']*["'][^>]*><\/script>/gi,"");
jerryHtml=jerryHtml.replace("</body>",'  <script src="/jerry/carousel.js?v=1"></script>\n  <script src="/jerry/reservation.js?v=4"></script>\n  <script src="/jerry/shop-photos.js?v=3"></script>\n  <script type="module" src="/jerry/catalog.js?v=4"></script>\n  <script src="/jerry/installment.js?v=2"></script>\n  <script type="module" src="/jerry/short-videos.js?v=2"></script>\n  <script src="/jerry/short-video-playback-fix.js?v=1"></script>\n  <script src="/jerry/social-links.js?v=1"></script>\n</body>');
fs.writeFileSync(jerryIndexPath,jerryHtml,"utf8");

const appJsPath=path.resolve("public/jerry/app.js");
if(fs.existsSync(appJsPath)){
  let appJs=fs.readFileSync(appJsPath,"utf8");
  appJs=appJs.replace(/Promise\.allSettled\(\[loadSettings\(\),\s*loadPaymentSettings\(\),\s*loadProducts\(\),\s*loadCases\(\)\]\);/g,"Promise.allSettled([loadSettings(), loadPaymentSettings()]);");
  fs.writeFileSync(appJsPath,appJs,"utf8");
}
const commerceJsPath=path.resolve("public/jerry/commerce.js");
if(fs.existsSync(commerceJsPath)){
  let commerceJs=fs.readFileSync(commerceJsPath,"utf8");
  commerceJs=commerceJs.replace(/(async function renderCommerceProducts\(\)\{[\s\S]*?)renderCards\(\);(\}catch)/,"$1$2");
  commerceJs=commerceJs.replace(/if\(grid\)\{new MutationObserver\([\s\S]*?\.observe\(grid,\{childList:true\}\);\}/g,"");
  commerceJs=commerceJs.replace(/injectModals\(\);\s*renderCommerceProducts\(\);/,`injectModals();\nwindow.JerryCommerce={order:(name,label,price)=>{const key=String(name||'').replace(/\\s/g,'').toLowerCase();const p=products.find(x=>String(x.name||'').replace(/\\s/g,'').toLowerCase().includes(key))||{id:'catalog-fixed',name,style:'',images:[],colors:[]};openOrder(p,{key:'catalog',label,price:Number(price)||0});}};\nrenderCommerceProducts();`);
  commerceJs=commerceJs.replace(/doc\(db,"shops",SHOP_ID,"orders",orderId\)/g,'doc(db,"shops",SHOP_ID,"onlineOrders",orderId)');
  commerceJs=commerceJs.replace(/status:"待驗證"/g,'status:"待審核",reviewStatus:"pending"');
  commerceJs=commerceJs.replace(/<h2>訂單等待驗證<\/h2>/g,'<h2>訂單已送出，等待店家確認</h2>');
  commerceJs=commerceJs.replace(/店家核對後訂單才正式成立。/g,'店家會先在後台確認；確認後才會正式加入訂單管理。');
  fs.writeFileSync(commerceJsPath,commerceJs,"utf8");
}

const jerryAdminPath=path.resolve("public/jerry/admin.html");
if(!fs.existsSync(jerryAdminPath))throw new Error("public/jerry/admin.html missing after build");
let jerryAdminHtml=fs.readFileSync(jerryAdminPath,"utf8");
jerryAdminHtml=jerryAdminHtml.replace(/\/admin\/admin\.js\?v=[^\"']+/g,"/admin/admin.js?v=32.6");
if(!/rel=["']icon["']/i.test(jerryAdminHtml))jerryAdminHtml=jerryAdminHtml.replace("</title>",'</title>\n  <link rel="icon" type="image/png" href="/jerry/admin-logo.png" />\n  <link rel="apple-touch-icon" href="/jerry/admin-logo.png" />');
if(!jerryAdminHtml.includes('/admin/orders.html?shop=jerry')){
  jerryAdminHtml=jerryAdminHtml.replace('lg:grid-cols-5','lg:grid-cols-6');
  jerryAdminHtml=jerryAdminHtml.replace('</nav>','<a href="/admin/orders.html?shop=jerry" class="bg-slate-900 border border-slate-800 text-fuchsia-300 font-black rounded-xl p-3 text-xs text-center"><i class="fa-solid fa-clipboard-list mr-1"></i>完整訂單管理</a></nav>');
}
jerryAdminHtml=jerryAdminHtml.replace(/href=["']\/jerry\/orders\.html["']/g,'href="/admin/orders.html?shop=jerry"');
jerryAdminHtml=jerryAdminHtml
  .replace(/\s*<script[^>]+src=["']\/jerry\/admin-products\.js[^"']*["'][^>]*><\/script>/gi,"")
  .replace(/\s*<script[^>]+src=["']\/jerry\/online-review\.js[^"']*["'][^>]*><\/script>/gi,"")
  .replace(/\s*<script[^>]+src=["']\/jerry\/media-admin\.js[^"']*["'][^>]*><\/script>/gi,"")
  .replace(/\s*<script[^>]+src=["']\/jerry\/product-photo-fix\.js[^"']*["'][^>]*><\/script>/gi,"")
  .replace(/\s*<script[^>]+src=["']\/jerry\/firestore-image-upload\.js[^"']*["'][^>]*><\/script>/gi,"");
jerryAdminHtml=jerryAdminHtml.replace("</body>",'  <script type="module" src="/jerry/admin-products.js?v=3"></script>\n  <script type="module" src="/jerry/online-review.js?v=2"></script>\n  <script type="module" src="/jerry/product-photo-fix.js?v=1"></script>\n  <script type="module" src="/jerry/media-admin.js?v=2"></script>\n</body>');
fs.writeFileSync(jerryAdminPath,jerryAdminHtml,"utf8");

const sharedOrdersPath=path.resolve("public/admin/orders.html");
if(!fs.existsSync(sharedOrdersPath))throw new Error("public/admin/orders.html missing after build");
let sharedOrdersHtml=fs.readFileSync(sharedOrdersPath,"utf8");
const ordersBrandMarker="JERRY_SHARED_ORDERS_BRANDING_V1";
if(!sharedOrdersHtml.includes(ordersBrandMarker)){
  const brandingScript=`<script>/* ${ordersBrandMarker} */(function(){var q=new URLSearchParams(location.search);if(q.get('shop')!=='jerry')return;try{sessionStorage.setItem('luckyGarageAdminShop','jerry');localStorage.setItem('luckyGarageAdminBrand','jerry')}catch(e){}document.title='傑瑞電動車｜訂單・收據・保固管理';var icon=document.createElement('link');icon.rel='icon';icon.type='image/png';icon.href='/jerry/admin-logo.png';document.head.appendChild(icon);var touch=document.createElement('link');touch.rel='apple-touch-icon';touch.href='/jerry/admin-logo.png';document.head.appendChild(touch);document.addEventListener('DOMContentLoaded',function(){var eye=document.querySelector('.topbar .eyebrow');if(eye)eye.textContent='傑瑞電動車';var h=document.querySelector('.topbar h1');if(h)h.textContent='訂單・收據・保固管理';var nav=document.querySelector('.topnav');if(nav)nav.innerHTML='<a href="/jerry/admin.html?shop=jerry">後台首頁</a><a href="/jerry/" target="_blank" rel="noopener">查看前台</a>';var loginTitle=document.querySelector('#loginCard h2');if(loginTitle)loginTitle.textContent='傑瑞電動車管理員登入';});})();</script>`;
  sharedOrdersHtml=sharedOrdersHtml.replace(/<head(\s[^>]*)?>/i,m=>`${m}\n  ${brandingScript}`);
}
fs.writeFileSync(sharedOrdersPath,sharedOrdersHtml,"utf8");
console.log("Jerry storefront: photo upload override, Safari-safe shorts, installment phone + LINE prefill deployed");
