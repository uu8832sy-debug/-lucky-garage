import fs from "node:fs";
import path from "node:path";

const file = path.resolve("public/jerry/index.html");
if (!fs.existsSync(file)) throw new Error("Jerry storefront missing for share metadata");
let html = fs.readFileSync(file, "utf8");

html = html
  .replace(/\s*<!-- JERRY_SHARE_META_V1 -->[\s\S]*?<!-- \/JERRY_SHARE_META_V1 -->/g, "")
  .replace(/\s*<meta[^>]+(?:property|name)=["'](?:og:[^"']+|twitter:[^"']+)["'][^>]*>/gi, "")
  .replace(/\s*<link[^>]+rel=["']canonical["'][^>]*>/gi, "");

const meta = `<!-- JERRY_SHARE_META_V1 -->
  <link rel="canonical" href="https://www.jerrye-bike.com/" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Gogoro社區店－傑瑞電動車" />
  <meta property="og:title" content="Gogoro社區店－傑瑞電動車" />
  <meta property="og:description" content="樹林 Gogoro 維修、保養、改裝、電動車銷售｜新北市樹林區保安街一段366號" />
  <meta property="og:url" content="https://www.jerrye-bike.com/" />
  <meta property="og:image" content="https://www.jerrye-bike.com/jerry/admin-logo.png?v=share1" />
  <meta property="og:image:alt" content="Gogoro社區店－傑瑞電動車" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Gogoro社區店－傑瑞電動車" />
  <meta name="twitter:description" content="樹林 Gogoro 維修、保養、改裝、電動車銷售" />
  <meta name="twitter:image" content="https://www.jerrye-bike.com/jerry/admin-logo.png?v=share1" />
  <!-- /JERRY_SHARE_META_V1 -->`;

html = html.replace("</title>", `</title>\n  ${meta}`);
fs.writeFileSync(file, html, "utf8");
console.log("Jerry social share metadata applied.");
