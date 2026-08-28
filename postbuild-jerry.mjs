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

const jerryIndexPath = path.resolve("public/jerry/index.html");
if (!fs.existsSync(jerryIndexPath)) throw new Error("public/jerry/index.html missing after build");
let jerryHtml = fs.readFileSync(jerryIndexPath, "utf8");
if (!jerryHtml.includes('/jerry/reservation.js')) {
  jerryHtml = jerryHtml.replace('</body>', '  <script src="/jerry/reservation.js?v=1"></script>\n</body>');
  fs.writeFileSync(jerryIndexPath, jerryHtml, "utf8");
}

console.log("Jerry custom-domain redirect and reservation LINE handoff injected");
