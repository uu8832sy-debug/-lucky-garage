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
jerryHtml = jerryHtml
  .replace(/\s*<script[^>]+src=["']\/jerry\/reservation\.js[^"']*["'][^>]*><\/script>/gi, "")
  .replace(/\s*<script[^>]+src=["']\/jerry\/shop-photos\.js[^"']*["'][^>]*><\/script>/gi, "")
  .replace(/\s*<script[^>]+src=["']\/jerry\/catalog\.js[^"']*["'][^>]*><\/script>/gi, "");
jerryHtml = jerryHtml.replace("</body>",'  <script src="/jerry/reservation.js?v=3"></script>\n  <script src="/jerry/shop-photos.js?v=2"></script>\n  <script type="module" src="/jerry/catalog.js?v=2"></script>\n</body>');
fs.writeFileSync(jerryIndexPath, jerryHtml, "utf8");

const jerryAdminPath = path.resolve("public/jerry/admin.html");
if (!fs.existsSync(jerryAdminPath)) throw new Error("public/jerry/admin.html missing after build");
let jerryAdminHtml = fs.readFileSync(jerryAdminPath, "utf8");
jerryAdminHtml = jerryAdminHtml.replace(/\/admin\/admin\.js\?v=[^\"']+/g, "/admin/admin.js?v=32.3");
if (!jerryAdminHtml.includes('/jerry/orders.html')) {
  jerryAdminHtml = jerryAdminHtml.replace('lg:grid-cols-5','lg:grid-cols-6');
  jerryAdminHtml = jerryAdminHtml.replace('</nav>', '<a href="/jerry/orders.html" class="bg-slate-900 border border-slate-800 text-fuchsia-300 font-black rounded-xl p-3 text-xs text-center"><i class="fa-solid fa-clipboard-list mr-1"></i>完整訂單管理</a></nav>');
}
fs.writeFileSync(jerryAdminPath, jerryAdminHtml, "utf8");

console.log("Jerry fixed five-model catalog, 3-field reservation, construction photos, navigation photo, full order manager, and admin cache bust injected");
