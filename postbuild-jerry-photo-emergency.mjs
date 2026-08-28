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
console.log("Jerry photo emergency override applied: legacy uploader removed; Cloudinary uploader v5 forced last.");
