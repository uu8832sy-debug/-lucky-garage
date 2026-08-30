import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicDir = path.resolve(root, "public");

function copy(source, destination = source) {
  const from = path.resolve(root, source);
  const to = path.resolve(publicDir, destination);
  if (!fs.existsSync(from)) throw new Error(`DEMO source missing: ${source}`);
  fs.mkdirSync(path.dirname(to), { recursive:true });
  fs.copyFileSync(from, to);
}
function patch(relative, transform) {
  const file = path.resolve(publicDir, relative);
  if (!fs.existsSync(file)) throw new Error(`DEMO build file missing: ${relative}`);
  const before = fs.readFileSync(file, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`DEMO patch no-op: ${relative}`);
  fs.writeFileSync(file, after, "utf8");
}
function replaceOnce(text, search, replacement, label) {
  if (!text.includes(search)) throw new Error(`DEMO marker missing: ${label}`);
  return text.replace(search, replacement);
}

copy("demo/index.html", "demo/index.html");
copy("admin/demo-bootstrap.js", "admin/demo-bootstrap.js");

patch("admin/login.js", (input) => {
  let js = input;
  if (!js.includes('const DEMO = { id:"demo"')) {
    js = replaceOnce(js,
      'const JERRY = { id:"jerry", name:"傑瑞電動車", displayName:"傑瑞電動車", logoUrl:"/jerry/admin-logo.png", enabled:true, public:true };',
      'const JERRY = { id:"jerry", name:"傑瑞電動車", displayName:"傑瑞電動車", logoUrl:"/jerry/admin-logo.png", enabled:true, public:true };\nconst DEMO = { id:"demo", name:"小宇車行系統｜DEMO 展示店", displayName:"小宇車行系統｜DEMO 展示店", logoUrl:"/assets/brand/logo-round.webp", siteUrl:"/demo/", enabled:true, public:true, demo:true };',
      "login DEMO constant"
    );
  }
  js = js.replace('let shops = [XIAOYU, JERRY];', 'let shops = [XIAOYU, JERRY, DEMO];');
  js = js.replace('const map = new Map([["xiaoyu", XIAOYU], ["jerry", JERRY]]);', 'const map = new Map([["xiaoyu", XIAOYU], ["jerry", JERRY], ["demo", DEMO]]);');
  return js;
});

patch("admin/shop-selector.js", (input) => {
  let js = input;
  if (!js.includes('const DEMO_FALLBACK = { id:"demo"')) {
    js = replaceOnce(js,
      'const JERRY_FALLBACK = { id:"jerry", name:"傑瑞電動車", displayName:"傑瑞電動車", logoUrl:"/jerry/admin-logo.png", enabled:true, public:true };',
      'const JERRY_FALLBACK = { id:"jerry", name:"傑瑞電動車", displayName:"傑瑞電動車", logoUrl:"/jerry/admin-logo.png", enabled:true, public:true };\nconst DEMO_FALLBACK = { id:"demo", name:"小宇車行系統｜DEMO 展示店", displayName:"小宇車行系統｜DEMO 展示店", logoUrl:"/assets/brand/logo-round.webp", siteUrl:"/demo/", enabled:true, public:true, demo:true };',
      "selector DEMO constant"
    );
  }
  js = js.replace('let shops = [XIAOYU, JERRY_FALLBACK];', 'let shops = [XIAOYU, JERRY_FALLBACK, DEMO_FALLBACK];');
  js = js.replace('const map = new Map([["xiaoyu", XIAOYU], ["jerry", JERRY_FALLBACK]]);', 'const map = new Map([["xiaoyu", XIAOYU], ["jerry", JERRY_FALLBACK], ["demo", DEMO_FALLBACK]]);');
  js = replaceOnce(js,
    '  if (shop?.id === "jerry") return "/jerry/";\n  return String(shop?.siteUrl || "").trim() || "/";',
    '  if (shop?.id === "jerry") return "/jerry/";\n  if (shop?.id === "demo") return "/demo/";\n  return String(shop?.siteUrl || "").trim() || "/";',
    "DEMO storefront route"
  );
  return js;
});

patch("admin/index.html", (input) => {
  if (input.includes("/admin/demo-bootstrap.js")) return input;
  return input.replace("</body>", '  <script type="module" src="/admin/demo-bootstrap.js?v=1"></script>\n</body>');
});

console.log("✓ DEMO showroom published: /demo/ + isolated shops/demo tenant bootstrap + shop selector entry");
