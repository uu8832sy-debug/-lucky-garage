(() => {
  const safeId = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0,64);
  const params = new URLSearchParams(location.search);
  let shopId = safeId(params.get("shop"));
  if (!shopId) {
    try { shopId = safeId(sessionStorage.getItem("luckyGarageAdminShop")); } catch {}
  }
  if (!shopId) shopId = "xiaoyu";
  try { sessionStorage.setItem("luckyGarageAdminShop", shopId); } catch {}

  const adminPages = new Set(["index.html","orders.html","site-settings.html","cases.html","platform.html","payment-settings.html","audit-log.html"]);
  document.querySelectorAll("a[href]").forEach((anchor) => {
    const raw = String(anchor.getAttribute("href") || "");
    if (!raw || raw.startsWith("#") || /^(https?:|mailto:|tel:|javascript:)/i.test(raw)) return;
    const clean = raw.split(/[?#]/)[0].replace(/^\/admin\//, "").replace(/^\.\//, "");
    if (!adminPages.has(clean)) return;
    const target = new URL(anchor.href, location.href);
    target.searchParams.set("shop", shopId);
    anchor.setAttribute("href", `${clean}?${target.searchParams.toString()}`);
  });
})();
