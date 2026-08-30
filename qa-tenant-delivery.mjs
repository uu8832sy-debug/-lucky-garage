import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
const passes=[];
function read(relative){const file=path.resolve(root,relative);if(!fs.existsSync(file)){failures.push(`缺少檔案：${relative}`);return '';}return fs.readFileSync(file,'utf8');}
function ok(label,condition,detail=''){if(condition)passes.push(label);else failures.push(`${label}${detail?`｜${detail}`:''}`);}
function includesAll(label,text,values){const missing=values.filter((v)=>!text.includes(v));ok(label,missing.length===0,missing.length?`缺少：${missing.join('、')}`:'');}

const html=read('public/admin/index.html');
const css=read('public/admin/tenant-delivery.css');
const js=read('public/admin/tenant-delivery.js');

includesAll('標準交付後台資源已注入',html,['/admin/tenant-delivery.css','/admin/tenant-delivery.js']);
includesAll('交付版只套用非小宇／非 Jerry 租戶',js,["shopId !== 'xiaoyu'","shopId !== 'jerry'",'tenant-delivery-admin']);
includesAll('交付版包含營運總覽與核心模組',js,['店家營運總覽','線上訂單','商品／車款','完整訂單','網站設定','標準流程']);
includesAll('交付版保留正式多租戶 query',js,["url.searchParams.set('shop', shopId)",'orders.html','site-settings.html','cases.html']);
includesAll('交付版移除租戶不必要抽獎入口',js,['draw\\.html','抽獎管理','tenant-obsolete']);
includesAll('交付版具備手機版響應',css,['tenant-delivery-stats','@media(max-width:900px)','@media(max-width:560px)']);

console.log(`\nTenant delivery QA：${passes.length} 項通過`);
passes.forEach((label)=>console.log(`  ✓ ${label}`));
if(failures.length){console.error(`Tenant delivery QA 失敗：${failures.length} 項`);failures.forEach((f)=>console.error(`  ✗ ${f}`));process.exit(1);}
console.log('\n✓ Standard tenant backend delivery template passed.\n');
