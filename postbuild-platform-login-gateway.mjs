import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicDir = path.resolve(root, "public");

function copy(source, destination = source) {
  const from = path.resolve(root, source);
  const to = path.resolve(publicDir, destination);
  if (!fs.existsSync(from)) throw new Error(`Gateway source missing: ${source}`);
  fs.mkdirSync(path.dirname(to), { recursive:true });
  fs.copyFileSync(from, to);
}
function patch(relative, transform) {
  const file = path.resolve(publicDir, relative);
  if (!fs.existsSync(file)) throw new Error(`Gateway build file missing: ${relative}`);
  const before = fs.readFileSync(file, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`Gateway patch no-op: ${relative}`);
  fs.writeFileSync(file, after, "utf8");
}

copy("admin/login.html", "admin/login.html");
copy("admin/login.js", "admin/login.js");

const gatewayGuard = `<script data-shop-gateway-guard>(function(){try{var p=new URLSearchParams(location.search);if(!p.get("shop")){location.replace("/admin/login.html");}}catch(e){location.replace("/admin/login.html");}})();</script>`;
const jerryGatewayGuard = `<script data-shop-gateway-guard>(function(){try{var p=new URLSearchParams(location.search);if(!p.get("shop")){location.replace("/admin/login.html?shop=jerry");}}catch(e){location.replace("/admin/login.html?shop=jerry");}})();</script>`;
const switchLink = '<a href="/admin/login.html" data-switch-shop class="bg-slate-800 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30">切換商家</a>';

patch("admin/index.html", (input) => {
  let html = input;
  if (!html.includes("data-shop-gateway-guard")) html = html.replace("</head>", `${gatewayGuard}\n</head>`);
  if (!html.includes("data-switch-shop")) {
    html = html.replace('<span id="adminIdentity"', `${switchLink}<span id="adminIdentity"`);
  }
  return html;
});

patch("jerry/admin.html", (input) => {
  let html = input;
  if (!html.includes("data-shop-gateway-guard")) html = html.replace("</head>", `${jerryGatewayGuard}\n</head>`);
  if (!html.includes("data-switch-shop")) {
    const candidate = '<div id="headerActions"';
    if (html.includes(candidate)) html = html.replace(candidate, `<a href="/admin/login.html" data-switch-shop class="text-xs font-bold text-amber-300 border border-amber-500/30 bg-slate-900 px-3 py-2 rounded-xl">切換商家</a>${candidate}`);
    else html = html.replace("</header>", `<a href="/admin/login.html" data-switch-shop style="position:absolute;right:16px;top:16px;color:#fcd34d;font-weight:800;font-size:12px">切換商家</a></header>`);
  }
  return html;
});

console.log("Platform shop login gateway deployed: merchant selection is now the default admin entry.");
