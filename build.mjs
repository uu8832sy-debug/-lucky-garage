import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const payload = "site_payload_v32_1.zip";
const input = fs.readFileSync(payload);
const outDir = path.resolve("public");
fs.rmSync(outDir,{recursive:true,force:true});
fs.mkdirSync(outDir,{recursive:true});
let offset=0,count=0;
while(offset+4<=input.length){
  const sig=input.readUInt32LE(offset);
  if(sig!==0x04034b50) break;
  const flags=input.readUInt16LE(offset+6);
  const method=input.readUInt16LE(offset+8);
  const compressedSize=input.readUInt32LE(offset+18);
  const fileNameLength=input.readUInt16LE(offset+26);
  const extraLength=input.readUInt16LE(offset+28);
  if(flags&0x08) throw new Error("ZIP data descriptors are not supported.");
  const nameStart=offset+30;
  const dataStart=nameStart+fileNameLength+extraLength;
  const name=input.subarray(nameStart,nameStart+fileNameLength).toString("utf8");
  const safeName=name.replaceAll("\\","/");
  if(safeName.startsWith("/")||safeName.split("/").includes("..")) throw new Error(`Unsafe ZIP path: ${name}`);
  const data=input.subarray(dataStart,dataStart+compressedSize);
  const target=path.join(outDir,safeName);
  if(safeName.endsWith("/")) fs.mkdirSync(target,{recursive:true});
  else {
    fs.mkdirSync(path.dirname(target),{recursive:true});
    const output=method===0?data:method===8?zlib.inflateRawSync(data):(()=>{throw new Error(`Unsupported ZIP method ${method}`)})();
    fs.writeFileSync(target,output); count++;
  }
  offset=dataStart+compressedSize;
}

const patchText=(relative,transform)=>{
  const file=path.join(outDir,relative);
  if(!fs.existsSync(file))return;
  fs.writeFileSync(file,transform(fs.readFileSync(file,"utf8")),"utf8");
};
const copyBrandAsset=(source,relative)=>{
  const from=path.resolve(source),to=path.join(outDir,relative);
  if(!fs.existsSync(from))throw new Error(`Brand asset missing: ${source}`);
  fs.mkdirSync(path.dirname(to),{recursive:true});
  fs.copyFileSync(from,to);
};
const copyRuntimeFile=(source,relative=source)=>{
  const from=path.resolve(source),to=path.join(outDir,relative);
  if(!fs.existsSync(from))throw new Error(`Runtime file missing: ${source}`);
  fs.mkdirSync(path.dirname(to),{recursive:true});
  fs.copyFileSync(from,to);
};
const copyRuntimeDir=(source,relative=source)=>{
  const from=path.resolve(source),to=path.join(outDir,relative);
  if(!fs.existsSync(from))throw new Error(`Runtime directory missing: ${source}`);
  fs.mkdirSync(path.dirname(to),{recursive:true});
  fs.cpSync(from,to,{recursive:true,force:true});
};
copyBrandAsset("brand-logo-round-v2.webp","assets/brand/logo-round.webp");
copyBrandAsset("brand-logo-round-v2.webp","assets/brand/logo-round-v2.webp");
copyBrandAsset("brand-logo-horizontal-v2.webp","assets/brand/logo-horizontal-v2.webp");
for(const icon of ["apple-touch-icon.png","icon-192.png","icon-512.png","favicon-32.png"]){copyBrandAsset("brand-logo-round-v2.png",icon);}
copyBrandAsset("brand-favicon-v2.ico","favicon.ico");
const removeRetiredPublicUi=(html)=>html
  .replace(/<a\b[^>]*href=["']\/garage(?:\.html)?[^"']*["'][^>]*>.*?<\/a>/g,"")
  .replace(/<article class="feature-card"><span class="feature-icon">🎁<\/span><b>成交限定幸運車庫<\/b>.*?<\/article>/g,'<article class="feature-card"><span class="feature-icon">📱</span><b>線上看車與訂購</b><p>車款、電池、價格與交期集中展示，選好規格即可送出訂購需求並由客服確認。</p></article>')
  .replaceAll("訂購需求、幸運抽獎與保固查詢","展示牌訂製與保固查詢")
  .replaceAll("紀念展示牌、幸運車庫抽獎、訂單與保固服務","紀念展示牌、線上訂單與保固服務")
  .replaceAll("工廠直營・全台到府交車","工廠直營．市場最低")
  .replace(/(<a href="\/warranty\.html"[^>]*>保固查詢<\/a>)(?!<a href="\/installment\.html")/g,'$1<a href="/installment.html">無卡分期試算</a>')
  .replace(/(<a href="\/warranty\.html"><span>🛡<\/span><small>保固<\/small><\/a>)(?!\s*<a href="\/installment\.html")/g,'$1\n  <a href="/installment.html"><span>＄</span><small>分期</small></a>')
  .replaceAll("32.1.0","32.1.4")
  .replaceAll("32.1.1","32.1.4")
  .replaceAll("32.1.2","32.1.4")
  .replaceAll("32.1.3","32.1.4")
  .replace(/<img class="brand-logo-img" src="\/assets\/brand\/logo-round\.webp" alt="([^"]+)">/g,'<picture class="brand-logo-lockup"><source media="(max-width:760px)" srcset="/assets/brand/logo-round-v2.webp"><img class="brand-logo-img brand-logo-img--horizontal" src="/assets/brand/logo-horizontal-v2.webp" alt="$1"></picture>');
for(const file of ["index.html","products.html","plate.html","warranty.html"]){patchText(file,removeRetiredPublicUi);}
patchText("index.html",(html)=>html
  .replace('<a class="btn btn-amber" href="/garage.html">使用抽獎碼</a>',"")
  .replace(/<img class="hero-brand-logo" src="\/assets\/brand\/logo-round\.webp" alt="([^"]+)">/,'<img class="hero-brand-logo hero-brand-logo--horizontal" src="/assets/brand/logo-horizontal-v2.webp" alt="$1">'));
patchText("admin/index.html",(html)=>html
  .replace(/<button[^>]*data-shell-view="draw"[^>]*>.*?<\/button>/g,"")
  .replace(/<section id="shell-draw".*?<\/section>/g,"")
  .replace("、交車案例與抽獎。","與交車案例。")
  .replaceAll("32.1.0","32.1.4")
  .replaceAll("32.1.1","32.1.4")
  .replaceAll("32.1.2","32.1.4")
  .replaceAll("32.1.3","32.1.4"));
patchText("home.js",(js)=>js
  .replace(".filter((p)=>p.visible!==false).sort", ".filter((p)=>p.visible!==false&&String(p.name||'').trim()!=='重機車牌').sort")
  .replace("工廠直營・全台到府交車","工廠直營．市場最低")
  .replace("訂購需求、幸運抽獎與保固查詢","展示牌訂製與保固查詢")
  .replace("const retired=/幸運車庫|抽獎碼|抽獎活動|開庫/;","const retired=/幸運車庫|抽獎|開庫/;")
  .replace("...data};const announcement=", "...data};const retired=/幸運車庫|抽獎|開庫/;if(retired.test(String(s.heroDescription||'')))s.heroDescription='全台到府交車、線上看車、展示牌訂製與保固查詢，一站完成。';if(retired.test([s.promoTitle,s.promoText,s.promoButtonUrl].join(' ')))s.promoEnabled=false;if(retired.test(String(s.announcementText||'')))s.announcementEnabled=false;const announcement=")
  .replace("const announcement=", "s.heroEyebrow='工廠直營．市場最低';const announcement="));
patchText("products.js",(js)=>js.replace(".filter((item) => item.visible !== false)", ".filter((item) => item.visible !== false && String(item.name || \"\").trim() !== \"重機車牌\")"));
patchText("public.css",(css)=>css.replace(/(\.mobile-dock\{[^}]*grid-template-columns:)repeat\(4,1fr\)/g,"$1repeat(5,1fr)"));
patchText("warranty.css",(css)=>css.replace(/(\.mobile-dock\{[^}]*grid-template-columns:)repeat\(4,1fr\)/g,"$1repeat(5,1fr)"));
patchText("manifest.webmanifest",(text)=>text.replace("紀念展示車牌、幸運車庫與售後保固","紀念展示牌、線上訂單與售後保固"));
patchText("public.css",(css)=>css.includes("V32.1.3 horizontal brand")?css:css+`\n/* V32.1.3 horizontal brand */\n.brand-logo-lockup{display:block;line-height:0}body .brand-logo-img--horizontal{width:220px;height:58px;max-width:36vw;object-fit:contain;object-position:left center;border:0;border-radius:0;box-shadow:none;background:transparent}body .hero-brand-logo--horizontal{width:min(520px,100%);height:auto;max-height:180px;object-fit:contain;object-position:left center;border:0;border-radius:0;box-shadow:none;background:transparent;margin:0 0 20px}.footer-brand-logo{width:190px;height:auto;object-fit:contain;border:0}.footer-row{align-items:center}@media(min-width:761px){.brand>.brand-logo-lockup+span{display:none}}@media(max-width:760px){body .brand-logo-img--horizontal{width:48px;height:48px;max-width:none;border-radius:50%}body .hero-brand-logo--horizontal{width:min(360px,100%);margin-bottom:16px}.footer-brand-logo{width:150px}}\n`);
patchText("public.css",(css)=>css.includes("V32.1.4 standalone installment")?css:css+`\n/* V32.1.4 standalone installment */\n.installment-page main{min-height:calc(100vh - 230px);padding-top:22px}.installment-standalone{max-width:1080px}.installment-standalone .installment-shell{grid-template-columns:.72fr 1.28fr}@media(max-width:900px){.installment-standalone .installment-shell{grid-template-columns:1fr}}@media(max-width:760px){body .mobile-dock{grid-template-columns:repeat(5,1fr)}}\n`);
patchText("public.css",(css)=>css.includes("V32.1.4 installment contrast")?css:css+`\n/* V32.1.4 installment contrast */\n.installment-shell .installment-intro h1,.installment-shell .installment-intro h2{color:#f8fafc}.installment-shell .installment-intro>p{color:#cbd5e1}.installment-shell .installment-eligibility b{color:#f8fafc}.installment-shell .installment-eligibility small,.installment-shell .installment-summary small,.installment-shell .installment-disclaimer{color:#aab7c7}.installment-shell .installment-calculator .field span{color:#cbd5e1}.installment-shell .installment-summary>div:not(.installment-monthly)>strong{color:#f8fafc}.installment-shell .installment-monthly strong{color:#ff625c}\n`);
for(const file of ["index.html","products.html","plate.html","warranty.html"]){patchText(file,(html)=>html.replace('<footer class="footer"><div class="wrap footer-row">','<footer class="footer"><div class="wrap footer-row"><img class="footer-brand-logo" src="/assets/brand/logo-horizontal-v2.webp" alt="小宇微電E-BIKE">'));}
const homeHtml=fs.readFileSync(path.join(outDir,"index.html"),"utf8");
const extract=(pattern,label)=>{const match=homeHtml.match(pattern);if(!match)throw new Error(`Unable to create installment page: ${label} missing`);return match[0];};
const installmentHead=extract(/<head>[\s\S]*?<\/head>/,"head")
  .replace(/<title>[\s\S]*?<\/title>/,'<title>無卡分期試算｜小宇微電E-BIKE</title>')
  .replace('小宇微電E-BIKE官方網站｜微型電動二輪車、紀念展示牌、線上訂單與保固服務。','小宇微電E-BIKE無卡分期試算｜選擇車款、電池、領牌方式與期數，立即查看預估月繳。');
const installmentHeader=extract(/<header class="site-header">[\s\S]*?<\/header>/,"header")
  .replace(' aria-current="page"','')
  .replace('href="/installment.html"','href="/installment.html" aria-current="page"');
const installmentSection=extract(/<section class="wrap section installment-section"[\s\S]*?<\/section>/,"calculator")
  .replace('class="wrap section installment-section"','class="wrap section installment-section installment-standalone"')
  .replace('<h2>無卡分期試算</h2>','<h1>無卡分期試算</h1>');
const installmentFooter=extract(/<footer class="footer">[\s\S]*?<\/footer>/,"footer");
const installmentFloating=extract(/<div class="floating-sales-cta"[\s\S]*?<\/div>/,"floating actions");
const installmentDock=extract(/<nav class="mobile-dock"[\s\S]*?<\/nav>/,"mobile menu")
  .replace('href="/installment.html"','href="/installment.html" aria-current="page"');
fs.writeFileSync(path.join(outDir,"installment.html"),`<!doctype html>\n<html lang="zh-Hant">\n${installmentHead}\n<body class="installment-page">\n${installmentHeader}\n<main>\n${installmentSection}\n</main>\n${installmentFooter}\n<script src="config.js?v=32.1.4"></script><script src="firebase-config.js?v=32.1.4"></script><script src="catalog.js?v=32.1.4"></script><script src="home.js?v=32.1.4"></script>\n${installmentFloating}\n${installmentDock}\n</body></html>\n`,"utf8");

// Overlay multi-shop runtime files that are intentionally maintained outside the legacy ZIP payload.
copyRuntimeFile("multi-shop-core.js");
copyRuntimeFile("admin/admin.js");
copyRuntimeFile("admin/shop-branding.js");
for(const file of [
  "platform.html","platform.js",
  "site-settings.html","site-settings.js",
  "cases.html","cases.js",
  "payment-settings.html","payment-settings.js"
]) copyRuntimeFile(`admin/${file}`);
copyRuntimeDir("jerry");

// Add direct management links to the existing admin shell without replacing its current UI.
patchText("admin/index.html",(html)=>{
  if(html.includes("site-settings.html")) return html;
  return html.replace(
    '<a href="orders.html"',
    '<a href="site-settings.html" class="bg-slate-900 border border-slate-800 text-emerald-400 font-bold rounded-xl p-3 text-xs text-center">網站設定</a><a href="cases.html" class="bg-slate-900 border border-slate-800 text-amber-400 font-bold rounded-xl p-3 text-xs text-center">案例管理</a><a href="platform.html" class="bg-slate-900 border border-slate-800 text-sky-400 font-bold rounded-xl p-3 text-xs text-center">代理店管理</a><a href="orders.html"'
  );
});
patchText("admin/index.html",(html)=>html.includes("shop-branding.js")?html.replace(/shop-branding\.js\?v=\d+/,"shop-branding.js?v=2"):html.replace('</body>','<script src="shop-branding.js?v=2"></script></body>'));

fs.writeFileSync(path.join(outDir,"BUILD_VERSION.txt"),"32.1.4-multishop\n","utf8");
const required=[
  "index.html","products.html","plate.html","installment.html","garage.html","warranty.html",
  "admin/index.html","admin/admin.js","admin/shop-branding.js","admin/platform.html","admin/site-settings.html","admin/cases.html","admin/payment-settings.html","admin/payment-settings.js",
  "multi-shop-core.js","jerry/index.html","jerry/app.js","jerry/style.css","jerry/finance.css","jerry/hero.css","jerry/admin-logo.png",
  "assets/brand/logo-round.webp","public-theme-v32.css","admin/admin-theme-v32.css"
];
for(const file of required){ if(!fs.existsSync(path.join(outDir,file))) throw new Error(`Deployment payload missing: ${file}`); }
console.log(`Extracted ${count} runtime files to ${outDir}`);
