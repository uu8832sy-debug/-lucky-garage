import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const failures=[];
const passes=[];
let staticLinkCount=0;

function read(rel){const p=path.resolve(root,rel);if(!fs.existsSync(p)){failures.push(`缺少檔案｜${rel}`);return "";}return fs.readFileSync(p,"utf8");}
function ok(label,condition,detail=""){if(condition)passes.push(label);else failures.push(`${label}${detail?`｜${detail}`:""}`);}
function has(label,text,needle){ok(label,text.includes(needle),`缺少 ${needle}`);}
function hasAll(label,text,needles){const missing=needles.filter(x=>!text.includes(x));ok(label,!missing.length,missing.length?`缺少 ${missing.join("、")}`:"");}

function resolveInternal(page,href){
  const clean=href.split("#")[0].split("?")[0];
  if(!clean)return null;
  if(clean.startsWith("/")){
    const rel=`public${clean}${clean.endsWith("/")?"index.html":""}`;
    return path.resolve(root,rel);
  }
  const p=path.resolve(path.dirname(path.resolve(root,page)),clean);
  return clean.endsWith("/")?path.join(p,"index.html"):p;
}

function checkHtml(page,{jerryBack=false}={}){
  const html=read(page);
  const ids=new Set([...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(m=>m[1]));
  const anchors=[...html.matchAll(/<a\b([^>]*)>/gi)];
  ok(`${page} 有可點連結`,anchors.length>0);
  anchors.forEach((m,i)=>{
    staticLinkCount++;
    const attrs=m[1];
    const href=(attrs.match(/\bhref=["']([^"']*)["']/i)||[])[1]||"";
    const target=(attrs.match(/\btarget=["']([^"']*)["']/i)||[])[1]||"";
    const rel=(attrs.match(/\brel=["']([^"']*)["']/i)||[])[1]||"";
    const id=(attrs.match(/\bid=["']([^"']*)["']/i)||[])[1]||String(i+1);
    const label=`${page}｜${id}｜${href||"空連結"}`;
    if(!href){ok(label,false,"href 為空");return;}
    if(href==="#"){ok(label,false,"href 仍是 #");return;}
    if(href.startsWith("#")){ok(label,ids.has(href.slice(1)),`找不到頁內目標 ${href}`);return;}
    if(href.startsWith("tel:")){const digits=href.replace(/\D/g,"");ok(label,/^0\d{8,9}$/.test(digits),`電話格式 ${digits}`);return;}
    if(/^https?:\/\//i.test(href)){
      try{
        const u=new URL(href);
        ok(label,u.protocol==="https:","外部連結必須 HTTPS");
        if(target==="_blank")ok(`${label}｜noopener`,/\bnoopener\b/i.test(rel),"target=_blank 缺 rel=noopener");
        if(u.hostname==="line.me")ok(`${label}｜LINE格式`,!(u.pathname.includes("/R/ti/p/")&&u.search.includes("text=")),"ti/p 不能用 ?text= 預填");
      }catch(e){ok(label,false,`URL 無法解析 ${e.message}`);}
      return;
    }
    const dest=resolveInternal(page,href);
    ok(label,Boolean(dest&&fs.existsSync(dest)),`內部目標不存在 ${dest||href}`);
  });
  if(jerryBack)hasAll(`${page}｜Jerry 回後台`,html,["JERRY_ADMIN_BACK_LINK_V1","/jerry/admin.html?shop=jerry"]);
}

checkHtml("public/jerry/index.html");
checkHtml("public/jerry/admin.html");
checkHtml("public/admin/orders.html");
checkHtml("public/admin/site-settings.html",{jerryBack:true});
checkHtml("public/admin/payment-settings.html",{jerryBack:true});
checkHtml("public/admin/cases.html",{jerryBack:true});

const front=read("public/jerry/index.html");
const mapHref=(front.match(/<a\b[^>]*id=["']mapBtn["'][^>]*href=["']([^"']+)["']/i)||[])[1]||"";
ok("導航按鈕直接是 Google Maps directions",mapHref.startsWith("https://www.google.com/maps/dir/?api=1&destination="),mapHref);
ok("導航目的地固定保安街一段366號",decodeURIComponent(mapHref).includes("新北市樹林區保安街一段366號"),decodeURIComponent(mapHref||""));

const adminHtml=read("public/jerry/admin.html");
hasAll("Jerry 後台主要入口完整",adminHtml,[
  "/jerry/",
  "/admin/site-settings.html?shop=jerry",
  "/admin/payment-settings.html?shop=jerry",
  "/admin/cases.html?shop=jerry",
  "/admin/orders.html?shop=jerry"
]);

const app=read("public/jerry/app.js");
has("頁首 LINE 綁官方 LINE",app,'$("#headerCta").href = safeUrl(s.lineUrl || DEFAULTS.lineUrl');
has("Hero LINE 綁官方 LINE",app,'$("#heroPrimary").href = safeUrl(s.lineUrl || DEFAULTS.lineUrl');
has("門市 LINE 綁官方 LINE",app,'$("#lineBtn").href = safeUrl(s.lineUrl || DEFAULTS.lineUrl)');
has("電話連結使用 tel",app,'$("#storePhone").href = `tel:${phone.replace(/[^0-9+]/g, "")}`');
has("導航不吃 Firestore 舊 mapUrl",app,'$("#mapBtn").href = DEFAULTS.mapUrl;');
ok("app.js 沒有舊 LINE ?text 格式",!app.includes("/R/ti/p/@882npfrm?text="));

const reservation=read("public/jerry/reservation.js");
has("預約送出事件存在",reservation,"form.addEventListener('submit'");
hasAll("預約 LINE 自動帶文字",reservation,["/R/oaMessage/","【網站預約】","reservationPhone"]);

const catalog=read("public/jerry/catalog.js");
hasAll("價目表每個價格可點下單",catalog,["data-order-model","addEventListener('click'","window.JerryCommerce?.order"]);
has("價目表備援 LINE 預填正確",catalog,"/R/oaMessage/%40882npfrm/?");
ok("價目表沒有舊 LINE ?text 格式",!catalog.includes("/R/ti/p/@882npfrm?text="));

const installment=read("public/jerry/installment.js");
hasAll("分期所有操作都有事件",installment,[
  "line.addEventListener('click'",
  "model.addEventListener('change'",
  "battery.addEventListener('change'",
  "edition.addEventListener('change'",
  "license.addEventListener('change'",
  "phone.addEventListener('input'"
]);
hasAll("分期手機驗證與 LINE 預填",installment,["^09\\d{8}$","/R/oaMessage/%40882npfrm/?"]);

const social=read("public/jerry/social-links.js");
hasAll("官方社群四個連結完整",social,[
  "line.me/R/ti/p/@882npfrm",
  "tiktok.com/@jerry950114",
  "instagram.com/jerryebike",
  "facebook.com/share/",
  'rel="noopener noreferrer"'
]);

const shorts=read("public/jerry/short-videos.js");
hasAll("短影音導覽與播放可點",shorts,["section.id = \"short-videos\"","link.href = \"#short-videos\"","play?.addEventListener(\"click\""]);

const commerce=read("public/jerry/commerce.js");
hasAll("商品詳情／下單／關閉都有 click",commerce,[".view-bike",".order-bike","[data-close-order]","addEventListener(\"click\""]);
has("訂單 LINE 預填正確",commerce,"/R/oaMessage/%40882npfrm/?");
ok("訂單沒有舊 LINE ?text 格式",!commerce.includes("/R/ti/p/@882npfrm?text="));

const review=read("public/jerry/online-review.js");
hasAll("線上訂單確認／拒絕可點",review,[".confirm-online","confirmOrder",".reject-online","rejectOrder"]);

const photo=read("public/jerry/product-photo-fix.js");
ok("商品照片按鈕會開啟檔案選擇",photo.includes("input.click()")||photo.includes('$("#imageFileInput")?.click()'));
hasAll("商品照片 change 與上傳處理完整",photo,["imageFileInput","uploadFiles(files)"]);

const media=read("public/jerry/media-admin.js");
hasAll("短影音後台所有按鈕 handler 完整",media,[
  "#shortVideoUploadBtn","#shortVideoFile","uploadShortVideoFile",
  "#shortPosterUploadBtn","uploadShortPosterFile",
  "saveShortFromForm","editShort","toggleShort","deleteShort","moveShort"
]);

const products=read("public/jerry/admin-products.js");
hasAll("商品管理照片／主圖／刪除可點",products,[".jerry-manage","openFixedModal",".jerry-primary",".jerry-delete"]);

const orders=read("public/admin/orders.html");
hasAll("完整訂單 Jerry 導覽正確",orders,["/jerry/admin.html?shop=jerry","href=\"/jerry/\""]);

console.log(`\nJerry 點擊驗收：${staticLinkCount} 個靜態連結，${passes.length} 項通過`);
if(failures.length){
  console.error(`Jerry 點擊驗收失敗：${failures.length} 項`);
  failures.forEach(x=>console.error(`  ✗ ${x}`));
  process.exit(1);
}
passes.forEach(x=>console.log(`  ✓ ${x}`));
console.log("\n✓ Jerry 所有可驗證點擊／連結路徑通過。\n");
