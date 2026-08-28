import fs from "node:fs";
import path from "node:path";

const pub = path.resolve("public/jerry");
fs.mkdirSync(pub,{recursive:true});
for (const name of ["product-photo-fix.js","firestore-image-upload.js"]) {
  const src=path.resolve("jerry",name), dst=path.join(pub,name);
  if(!fs.existsSync(src)) throw new Error(`Missing Jerry photo file: ${src}`);
  fs.copyFileSync(src,dst);
}

const adminPath=path.resolve("public/jerry/admin.html");
if(!fs.existsSync(adminPath)) throw new Error("Jerry admin missing");
let html=fs.readFileSync(adminPath,"utf8");

// Any legacy Firestore uploader reference is redirected to the single Cloudinary uploader.
html=html.replace(/<script([^>]*?)src=["']\/jerry\/firestore-image-upload\.js[^"']*["']([^>]*)><\/script>/gi,'<script type="module" src="/jerry/product-photo-fix.js?v=5"></script>');
html=html.replace(/\s*<script[^>]+src=["']\/jerry\/product-photo-fix\.js[^"']*["'][^>]*><\/script>/gi,"");
html=html.replace("</body>",'  <script type="module" src="/jerry/product-photo-fix.js?v=5"></script>\n</body>');
fs.writeFileSync(adminPath,html,"utf8");

// Disable the older Firestore-inline image interceptor in the built runtime.
// Jerry product and case uploads now use Cloudinary, so the old capture listener must not block them.
const corePath=path.resolve("public/multi-shop-core.js");
if(!fs.existsSync(corePath)) throw new Error("multi-shop-core.js missing");
let core=fs.readFileSync(corePath,"utf8");
core=core.replace(/\ninstallJerryFirestoreImageUpload\(\);\s*$/,"\n// Jerry inline Firestore image uploader disabled; Cloudinary uploader is active.\n");
fs.writeFileSync(corePath,core,"utf8");

// Keep Jerry cases editable from the backend while product cards remain controlled by the fixed official catalog.
const appPath=path.resolve("public/jerry/app.js");
if(!fs.existsSync(appPath)) throw new Error("Jerry app.js missing");
let appJs=fs.readFileSync(appPath,"utf8");
appJs=appJs.replace("Promise.allSettled([loadSettings(), loadPaymentSettings()]);","Promise.allSettled([loadSettings(), loadPaymentSettings(), loadCases()]);");
appJs=appJs.replace('$("#mapBtn").href = safeUrl(s.mapUrl || DEFAULTS.mapUrl);','$("#mapBtn").href = DEFAULTS.mapUrl;');
appJs=appJs.replace("${DEFAULTS.lineUrl}?text=${encodeURIComponent(","https://line.me/R/oaMessage/%40882npfrm/?${encodeURIComponent(");
fs.writeFileSync(appPath,appJs,"utf8");

// Fix LINE prefilled-message links in the final storefront runtime.
for (const fileName of ["commerce.js","catalog.js"]) {
  const filePath=path.join(pub,fileName);
  if(!fs.existsSync(filePath)) throw new Error(`Jerry runtime missing: ${fileName}`);
  let text=fs.readFileSync(filePath,"utf8");
  text=text.replaceAll("https://line.me/R/ti/p/@882npfrm?text=${encodeURIComponent(","https://line.me/R/oaMessage/%40882npfrm/?${encodeURIComponent(");
  fs.writeFileSync(filePath,text,"utf8");
}

// Force Jerry storefront navigation to the real store address and ignore stale Firestore mapUrl values.
const frontPath=path.resolve("public/jerry/index.html");
if(!fs.existsSync(frontPath)) throw new Error("Jerry storefront missing");
let front=fs.readFileSync(frontPath,"utf8");
front=front.replace(/\s*<script[^>]*data-jerry-fixed-nav[^>]*>[\s\S]*?<\/script>/gi,"");
const navScript=`<script data-jerry-fixed-nav>(function(){var u='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent('新北市樹林區保安街一段366號');function f(){var b=document.getElementById('mapBtn');if(!b)return;if(b.getAttribute('href')!==u)b.setAttribute('href',u);b.setAttribute('target','_blank');b.setAttribute('rel','noopener');b.setAttribute('aria-label','導航至傑瑞電動車｜新北市樹林區保安街一段366號');}f();document.addEventListener('DOMContentLoaded',f,{once:true});setTimeout(f,500);setTimeout(f,1500);var o=new MutationObserver(f);o.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['href']});})();</script>`;
front=front.replace("</body>",`${navScript}\n</body>`);
fs.writeFileSync(frontPath,front,"utf8");
console.log("Jerry final overrides applied: complete storefront, Cloudinary uploads, editable cases, LINE prefills, fixed navigation.");
