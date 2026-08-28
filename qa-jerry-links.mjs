import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const failures=[];
const passes=[];
const checked=[];

function read(relative){
  const file=path.resolve(root,relative);
  if(!fs.existsSync(file)){failures.push(`缺少檔案：${relative}`);return "";}
  return fs.readFileSync(file,"utf8");
}
function pass(label){passes.push(label);}
function fail(label,detail=""){failures.push(`${label}${detail?`｜${detail}`:""}`);}
function ok(label,condition,detail=""){condition?pass(label):fail(label,detail);}
function idsOf(html){return new Set([...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(m=>m[1]));}
function anchorsOf(html){
  return [...html.matchAll(/<a\b([^>]*)>/gi)].map((m,index)=>{
    const attrs=m[1];
    const href=(attrs.match(/\bhref=["']([^"']*)["']/i)||[])[1]??"";
    const target=(attrs.match(/\btarget=["']([^"']*)["']/i)||[])[1]??"";
    const rel=(attrs.match(/\brel=["']([^"']*)["']/i)||[])[1]??"";
    const id=(attrs.match(/\bid=["']([^"']*)["']/i)||[])[1]??"";
    return{index,href,target,rel,id,raw:m[0]};
  });
}
function internalTarget(pageRelative,href){
  const clean=href.split("#")[0].split("?")[0];
  if(!clean)return null;
  if(clean.startsWith("/")){
    let rel=`public${clean}`;
    if(clean.endsWith("/"))rel+=`index.html`;
    return path.resolve(root,rel.replace(/^\/+/,""));
  }
  const pagePath=path.resolve(root,pageRelative);
  const target=path.resolve(path.dirname(pagePath),clean);
  return clean.endsWith("/")?path.join(target,"index.html"):target;
}
function checkHtmlLinks(pageRelative,{jerryBack=false}={}){
  const html=read(pageRelative);
  if(!html)return;
  const ids=idsOf(html);
  const anchors=anchorsOf(html);
  ok(`${pageRelative} 有可點連結`,anchors.length>0,`找不到 <a>`);
  for(const a of anchors){
    const label=`${pageRelative} 連結 ${a.id?`#${a.id}`:`${a.index+1}`} ${a.href||"(空)"}`;
    checked.push(label);
    if(!a.href){fail(label,"href 為空");continue;}
    if(a.href==="#"){fail(label,"href 仍是 #");continue;}
    if(a.href.startsWith("#")){
      ok(label,ids.has(a.href.slice(1)),`頁內目標 ${a.href} 不存在`);
      continue;
    }
    if(a.href.startsWith("tel:")){
      const digits=a.href.replace(/\D/g,"");
      ok(label,/^0\d{8,9}$/.test(digits),`電話格式不正確：${digits}`);
      continue;
    }
    if(/^https?:\/\//i.test(a.href)){
      try{
        const u=new URL(a.href);
        ok(label,u.protocol==="https:","外部連結不是 HTTPS");
        if(a.target==="_blank")ok(`${label} 安全開新頁`,/\bnoopener\b/i.test(a.rel),"target=_blank 缺 rel=noopener");
        if(/line\.me$/i.test(u.hostname)){
          ok(`${label} LINE 網域`,u.hostname==="line.me","LINE 網域錯誤");
          ok(`${label} LINE 預填格式`,!(u.pathname.includes("/R/ti/p/")&&u.search.includes("text=")),"ti/p 不支援 ?text= 預填");
        }
      }catch(e){fail(label,`URL 無法解析：${e.message}`);}
      continue;
    }
    const target=internalTarget(pageRelative,a.href);
    ok(label,Boolean(target&&fs.existsSync(target)),`內部頁不存在：${target||a.href}`);
  }
  if(jerryBack){
    ok(`${pageRelative} Jerry 回後台腳本`,html.includes("JERRY_ADMIN_BACK_LINK_V1")&&html.includes("/jerry/admin.html?shop=jerry"),"Jerry 可能回到共用後台");
  }
}

checkHtmlLinks("public/jerry/index.html");
checkHtmlLinks("public/jerry/admin.html");
checkHtmlLinks("public/admin/orders.html");
checkHtmlLinks("public/admin/site-settings.html",{jerryBack:true});
checkHtmlLinks("public/admin/payment-settings.html",{jerryBack:true});
checkHtmlLinks("public/admin/cases.html",{jerryBack:true});

const front=read("public/jerry/index.html");
const mapHref=(front.match(/<a\b[^>]*id=["']mapBtn["'][^>]*href=["']([^"']+)["'][^>]*>/i)||[])[1]||"";
ok("開啟導航直接有正確 href",mapHref.startsWith("https://www.google.com/maps/dir/?api=1&destination="),`目前：${mapHref}`);
ok("導航目的地是保安街一段366號",decodeURIComponent(mapHref).includes("新北市樹林區保安街一段366號"),`目前：${decodeURIComponent(mapHref||"")}`);
ok("Jerry 後台 5 個主要入口",[
  "/jerry/",
  "/admin/site-settings.html?shop=jerry",
  "/admin/payment-settings.html?shop=jerry",
  "/admin/cases.html?shop=jerry",
  "/admin/orders.html?shop=jerry"
].every(x=>front||true) && [
  "/jerry/",
  "/admin/site-settings.html?shop=jerry",
  "/admin/payment-settings.html?shop=jerry",
  "/admin/cases.html?shop=jerry",
  "/admin/orders.html?shop=jerry"
].every(x=>read("public/jerry/admin.html").includes(x)),"Jerry 後台入口缺漏");

const app=read("public/jerry/app.js");
ok("頁首 LINE 會改成官方 LINE",app.includes('$("#headerCta").href = safeUrl(s.lineUrl || DEFAULTS.lineUrl')));
ok("Hero LINE 會改成官方 LINE",app.includes('$("#heroPrimary").href = safeUrl(s.lineUrl || DEFAULTS.lineUrl')));
ok("門市 LINE 會改成官方 LINE",app.includes('$("#lineBtn").href = safeUrl(s.lineUrl || DEFAULTS.lineUrl)'));
ok("電話按鈕使用 tel:",app.includes('$("#storePhone").href = `tel:${phone.replace(/[^0-9+]/g, "")}`'));
ok("導航不吃後台錯誤 mapUrl",app.includes('$("#mapBtn").href = DEFAULTS.mapUrl;'));
ok("舊 LINE ?text 格式已清除",!app.includes("/R/ti/p/@882npfrm?text="),"app.js 還有錯誤 LINE 預填格式");

const reservation=read("public/jerry/reservation.js");
ok("預約送出有綁 click/submit",reservation.includes('form.addEventListener(\'submit\'')||reservation.includes('form.addEventListener("submit"'));
ok("預約 LINE 會預填文字",reservation.includes("/R/oaMessage/")&&reservation.includes("【網站預約】"));

const catalog=read("public/jerry/catalog.js");
ok("每個價目點擊有事件",catalog.includes("querySelectorAll('[data-order-model]')")&&catalog.includes("addEventListener('click'"));
ok("價目備援 LINE 預填正確",catalog.includes("/R/oaMessage/%40882npfrm/?")&&!catalog.includes("/R/ti/p/@882npfrm?text="));

const installment=read("public/jerry/installment.js");
ok("分期詢問按鈕有 click 驗證",installment.includes("line.addEventListener('click'")&&installment.includes("^09\\d{8}$"));
ok("分期 LINE 預填正確",installment.includes("/R/oaMessage/%40882npfrm/?"));
ok("分期所有選單都有 change 事件",["model.addEventListener('change'","battery.addEventListener('change'","edition.addEventListener('change'","license.addEventListener('change'"].every(x=>installment.includes(x)));

const social=read("public/jerry/social-links.js");
for(const [name,needle] of [["LINE","line.me/R/ti/p/@882npfrm"],["TikTok","tiktok.com/@jerry950114"],["Instagram","instagram.com/jerryebike"],["Facebook","facebook.com/share/"]]){
  ok(`社群 ${name} 連結已設定`,social.includes(needle),`缺少 ${needle}`);
}
ok("社群外連都有 noopener",social.includes('rel="noopener noreferrer"'));

const shorts=read("public/jerry/short-videos.js");
ok("短影音導覽新增後有對應 section",shorts.includes('section.id = "short-videos"')&&shorts.includes('link.href = "#short-videos"'));
ok("短影音播放按鈕有 click 事件",shorts.includes('play?.addEventListener("click"'));

const commerce=read("public/jerry/commerce.js");
ok("商品詳情／下單按鈕都有 click",commerce.includes('querySelector(".view-bike")?.addEventListener("click"')&&commerce.includes('querySelector(".order-bike")?.addEventListener("click"'));
ok("訂單 modal 關閉按鈕都有 click",commerce.includes('querySelectorAll("[data-close-order]")')&&commerce.includes('addEventListener("click"'));
ok("訂單 LINE 預填格式正確",commerce.includes("/R/oaMessage/%40882npfrm/?")&&!commerce.includes("/R/ti/p/@882npfrm?text="));

const review=read("public/jerry/online-review.js");
ok("線上訂單確認按鈕有 click",review.includes(".confirm-online")&&review.includes("confirmOrder"));
ok("線上訂單拒絕按鈕有 click",review.includes(".reject-online")&&review.includes("rejectOrder"));

const photo=read("public/jerry/product-photo-fix.js");
ok("商品照片選擇按鈕有 capture click",photo.includes("#chooseImagesBtn")&&photo.includes("input.click()"));
ok("商品照片 change 有上傳處理",photo.includes('input.id !== "imageFileInput"')&&photo.includes("uploadFiles(files)"));

const media=read("public/jerry/media-admin.js");
ok("短影音上傳按鈕會開檔案選擇",media.includes("#shortVideoUploadBtn")&&media.includes("#shortVideoFile")&&media.includes(".click()"));
ok("短影音影片選擇後有 upload handler",media.includes("uploadShortVideoFile"));
ok("短影音封面選擇後有 upload handler",media.includes("uploadShortPosterFile"));
ok("短影音儲存／編輯／顯示／刪除都有 handler",["saveShortFromForm","editShort","toggleShort","deleteShort","moveShort"].every(x=>media.includes(x)));

const adminProducts=read("public/jerry/admin-products.js");
ok("商品管理照片按鈕有 click",adminProducts.includes(".jerry-manage")&&adminProducts.includes("openFixedModal"));
ok("主圖／刪除照片都有 click",adminProducts.includes(".jerry-primary")&&adminProducts.includes(".jerry-delete"));

const orders=read("public/admin/orders.html");
ok("完整訂單 Jerry 導覽回後台正確",orders.includes('/jerry/admin.html?shop=jerry'));
ok("完整訂單 Jerry 查看前台正確",orders.includes('href=\"/jerry/\"')||orders.includes('href="/jerry/"'));

console.log(`\nJerry 點擊連結驗收：檢查 ${checked.length} 個靜態連結，${passes.length} 項通過`);
passes.forEach(x=>console.log(`  ✓ ${x}`));
if(failures.length){
  console.error(`\nJerry 點擊連結驗收失敗：${failures.length} 項`);
  failures.forEach(x=>console.error(`  ✗ ${x}`));
  process.exit(1);
}
console.log("\n✓ Jerry 所有可驗證點擊／連結路徑通過。\n");
