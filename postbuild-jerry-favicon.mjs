import fs from "node:fs";
import path from "node:path";

const publicDir = path.resolve("public");
const jerryDir = path.join(publicDir, "jerry");
const sourceLogo = path.join(jerryDir, "admin-logo.png");
const faviconName = "favicon-jerry-20260828.png";
const faviconPath = path.join(jerryDir, faviconName);

if (!fs.existsSync(sourceLogo)) throw new Error(`Jerry logo missing: ${sourceLogo}`);
fs.copyFileSync(sourceLogo, faviconPath);

const faviconHref = `/jerry/${faviconName}?v=20260828-4`;
const patchPage = (file) => {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, "utf8");
  html = html.replace(/\s*<link[^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["'][^>]*>/gi, "");
  const tags = `\n  <link rel="icon" type="image/png" href="${faviconHref}" />\n  <link rel="shortcut icon" type="image/png" href="${faviconHref}" />\n  <link rel="apple-touch-icon" href="${faviconHref}" />`;
  html = html.replace("</title>", `</title>${tags}`);
  fs.writeFileSync(file, html, "utf8");
};

patchPage(path.join(jerryDir, "index.html"));
patchPage(path.join(jerryDir, "admin.html"));
patchPage(path.join(publicDir, "admin", "orders.html"));

console.log("Jerry favicon forced to dedicated cache-busted asset");
