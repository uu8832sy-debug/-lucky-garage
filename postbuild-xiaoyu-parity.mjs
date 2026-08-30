import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicDir = path.resolve(root, "public");

function ensureFile(relative) {
  const file = path.resolve(root, relative);
  if (!fs.existsSync(file)) throw new Error(`Xiaoyu parity source missing: ${relative}`);
  return file;
}
function copy(source, destination = source) {
  const from = ensureFile(source);
  const to = path.resolve(publicDir, destination);
  fs.mkdirSync(path.dirname(to), { recursive:true });
  fs.copyFileSync(from, to);
}
function patch(relative, transform) {
  const file = path.resolve(publicDir, relative);
  if (!fs.existsSync(file)) throw new Error(`Xiaoyu parity build file missing: ${relative}`);
  const before = fs.readFileSync(file, "utf8");
  const after = transform(before);
  if (after === before) console.warn(`Xiaoyu parity: no change for ${relative}`);
  fs.writeFileSync(file, after, "utf8");
}

// Final-overlay files. These run after the legacy ZIP and the normal Xiaoyu overlay,
// so the deployed public/ folder always gets the maintained GitHub versions.
copy("admin/audit-log.html", "admin/audit-log.html");
copy("admin/audit-log.js", "admin/audit-log.js");
copy("xiaoyu-short-videos.js");
copy("xiaoyu-media-admin.js");

// The root admin shell is copied late in build.mjs. Fix the final shell rather than
// relying on an earlier patch that can be overwritten by that copy.
patch("admin/index.html", (input) => {
  let html = input;

  // Retired raffle/draw entry must not come back after the root admin overlay.
  html = html.replace(/<a\b[^>]*href=["']draw\.html(?:\?[^"']*)?["'][^>]*>[\s\S]*?<\/a>/gi, "");

  // Pin every Xiaoyu child route to the legacy Xiaoyu tenant.
  for (const page of ["orders.html","site-settings.html","cases.html","platform.html","payment-settings.html","audit-log.html"]) {
    const escaped = page.replace(".", "\\.");
    html = html.replace(new RegExp(`href=["']${escaped}(?:\\?[^"']*)?["']`, "g"), `href="${page}?shop=xiaoyu"`);
  }

  // Missing navigation entries were previously skipped just because site-settings already existed.
  const navEnd = "</nav>";
  if (!html.includes('href="cases.html?shop=xiaoyu"')) {
    html = html.replace(navEnd, '<a href="cases.html?shop=xiaoyu" class="bg-slate-900 border border-slate-800 text-amber-300 font-bold rounded-xl p-3 text-xs text-center"><i class="fa-solid fa-photo-film mr-1"></i>案例管理</a>' + navEnd);
  }
  if (!html.includes('href="platform.html?shop=xiaoyu"')) {
    html = html.replace(navEnd, '<a href="platform.html?shop=xiaoyu" data-owner-only class="bg-slate-900 border border-slate-800 text-cyan-300 font-bold rounded-xl p-3 text-xs text-center"><i class="fa-solid fa-store mr-1"></i>代理店管理</a>' + navEnd);
  }

  html = html.replace(/lg:grid-cols-\d+/g, "lg:grid-cols-8");

  // Xiaoyu media manager is an overlay, matching Jerry's short-video management workflow
  // while writing only the legacy Xiaoyu siteSettings collection.
  if (!html.includes("/xiaoyu-media-admin.js")) {
    html = html.replace("</body>", '  <script type="module" src="/xiaoyu-media-admin.js?v=1"></script>\n</body>');
  }
  return html;
});

// Keep child pages deterministic: returning to the admin shell must not inherit a stale Jerry shop.
for (const page of ["orders.html","site-settings.html","cases.html","platform.html","payment-settings.html","audit-log.html"]) {
  patch(`admin/${page}`, (html) => html
    .replace(/href=["']index\.html(?:\?[^"']*)?["']/g, 'href="index.html?shop=xiaoyu"')
    .replace(/href=["']\/admin\/index\.html(?:\?[^"']*)?["']/g, 'href="/admin/index.html?shop=xiaoyu"'));
}

// The case editor writes {visible, images, description}; the old homepage renderer expected
// {published, imageUrl, note}. Support both schemas so newly-created cases actually appear correctly.
patch("home.js", (input) => {
  const replacement = `  function renderDelivery(cases){
    const section=$('#deliverySection'),grid=$('#deliveryCasesGrid');
    if(!section||!grid)return;
    const imageOf=(c)=>{const images=Array.isArray(c?.images)?c.images:[];const first=images.find((x)=>x&&typeof x==='object'&&x.isPrimary)||images[0];return String(c?.imageUrl||(typeof first==='string'?first:first?.url)||'');};
    const list=(cases||[]).filter((c)=>c?.visible!==false&&c?.published!==false).sort((a,b)=>Number(a.order||999)-Number(b.order||999)).slice(0,6);
    section.hidden=!list.length;
    grid.innerHTML=list.map((c)=>{const image=imageOf(c);const description=c.description||c.note||'感謝客人的信任。';return \`<article class="delivery-case-card">\${image?\`<img src="\${escapeHtml(image)}" alt="\${escapeHtml(c.title||'交車紀錄')}" loading="lazy">\`:\`<div class="delivery-case-placeholder">🚚</div>\`}<div><small>\${escapeHtml(c.location||'全台到府交車')}</small><h3>\${escapeHtml(c.title||'交車完成')}</h3><b>\${escapeHtml(c.model||'')}</b><p>\${escapeHtml(description)}</p></div></article>\`;}).join('');
  }`;
  const pattern = /  function renderDelivery\(cases\)\{[\s\S]*?\}\n\n  function initInstallmentCalculator\(\)/;
  if (!pattern.test(input)) throw new Error("Xiaoyu parity: home renderDelivery signature changed");
  return input.replace(pattern, `${replacement}\n\n  function initInstallmentCalculator()`);
});

// Add the same lazy short-video capability Jerry has, but backed by Xiaoyu's root collections.
patch("index.html", (html) => {
  if (html.includes("/xiaoyu-short-videos.js")) return html;
  return html.replace("</body>", '  <script type="module" src="/xiaoyu-short-videos.js?v=1"></script>\n</body>');
});

console.log("Xiaoyu parity overlay complete: admin routes, audit files, case schema and short-video modules are aligned.");
