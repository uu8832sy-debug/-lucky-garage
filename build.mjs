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
const removeRetiredPublicUi=(html)=>html
  .replace(/<a\b[^>]*href=["']\/garage(?:\.html)?[^"']*["'][^>]*>.*?<\/a>/g,"")
  .replace(/<article class="feature-card"><span class="feature-icon">🎁<\/span><b>成交限定幸運車庫<\/b>.*?<\/article>/g,'<article class="feature-card"><span class="feature-icon">📱</span><b>線上看車與訂購</b><p>車款、電池、價格與交期集中展示，選好規格即可送出訂購需求並由客服確認。</p></article>')
  .replaceAll("訂購需求、幸運抽獎與保固查詢","展示牌訂製與保固查詢")
  .replaceAll("紀念展示牌、幸運車庫抽獎、訂單與保固服務","紀念展示牌、線上訂單與保固服務")
  .replaceAll("32.1.1","32.1.2");
for(const file of ["index.html","products.html","plate.html","warranty.html"]){patchText(file,removeRetiredPublicUi);}
patchText("index.html",(html)=>html.replace('<a class="btn btn-amber" href="/garage.html">使用抽獎碼</a>',""));
patchText("admin/index.html",(html)=>html
  .replace(/<button[^>]*data-shell-view="draw"[^>]*>.*?<\/button>/g,"")
  .replace(/<section id="shell-draw".*?<\/section>/g,"")
  .replace("、交車案例與抽獎。","與交車案例。")
  .replaceAll("32.1.1","32.1.2"));
patchText("home.js",(js)=>js
  .replace(".filter((p)=>p.visible!==false).sort", ".filter((p)=>p.visible!==false&&String(p.name||'').trim()!=='重機車牌').sort")
  .replace("訂購需求、幸運抽獎與保固查詢","展示牌訂製與保固查詢")
  .replace("...data};const announcement=", "...data};const retired=/幸運車庫|抽獎碼|抽獎活動|開庫/;if(retired.test(String(s.heroDescription||'')))s.heroDescription='全台到府交車、線上看車、展示牌訂製與保固查詢，一站完成。';if(retired.test([s.promoTitle,s.promoText,s.promoButtonUrl].join(' ')))s.promoEnabled=false;if(retired.test(String(s.announcementText||'')))s.announcementEnabled=false;const announcement="));
patchText("products.js",(js)=>js.replace(".filter((item) => item.visible !== false)", ".filter((item) => item.visible !== false && String(item.name || \"\").trim() !== \"重機車牌\")"));
patchText("public.css",(css)=>css.replaceAll("grid-template-columns:repeat(5,1fr)","grid-template-columns:repeat(4,1fr)"));
patchText("warranty.css",(css)=>css.replaceAll("grid-template-columns:repeat(5,1fr)","grid-template-columns:repeat(4,1fr)"));
patchText("manifest.webmanifest",(text)=>text.replace("紀念展示車牌、幸運車庫與售後保固","紀念展示牌、線上訂單與售後保固"));
fs.writeFileSync(path.join(outDir,"BUILD_VERSION.txt"),"32.1.2\n","utf8");
const required=["index.html","products.html","plate.html","garage.html","warranty.html","admin/index.html","assets/brand/logo-round.webp","public-theme-v32.css","admin/admin-theme-v32.css"];
for(const file of required){ if(!fs.existsSync(path.join(outDir,file))) throw new Error(`Deployment payload missing: ${file}`); }
console.log(`Extracted ${count} runtime files to ${outDir}`);

