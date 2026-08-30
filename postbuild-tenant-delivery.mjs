import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = path.resolve(root,'public');

function copy(source,destination=source){
  const from = path.resolve(root,source);
  const to = path.resolve(out,destination);
  if(!fs.existsSync(from)) throw new Error(`tenant delivery source missing: ${source}`);
  fs.mkdirSync(path.dirname(to),{recursive:true});
  fs.copyFileSync(from,to);
}
function patch(relative,transform){
  const file = path.resolve(out,relative);
  if(!fs.existsSync(file)) throw new Error(`tenant delivery build file missing: ${relative}`);
  const before = fs.readFileSync(file,'utf8');
  const after = transform(before);
  if(after===before) throw new Error(`tenant delivery patch no-op: ${relative}`);
  fs.writeFileSync(file,after,'utf8');
}

copy('admin/tenant-delivery.css','admin/tenant-delivery.css');
copy('admin/tenant-delivery.js','admin/tenant-delivery.js');

patch('admin/index.html',(html)=>{
  let next = html;
  if(!next.includes('/admin/tenant-delivery.css')){
    next = next.replace('</head>','  <link rel="stylesheet" href="/admin/tenant-delivery.css?v=1" />\n</head>');
  }
  if(!next.includes('/admin/tenant-delivery.js')){
    next = next.replace('</body>','  <script type="module" src="/admin/tenant-delivery.js?v=1"></script>\n</body>');
  }
  return next;
});

console.log('✓ Standard tenant delivery backend published for demo/future shops');
