(() => {
  "use strict";
  const allowed = new Set(["dashboard","plate-orders","products","customers","content","delivery","orders-full"]);
  const buttons = [...document.querySelectorAll("[data-shell-view]")];
  const panels = [...document.querySelectorAll("[data-shell-panel]")];
  function normalizeView(value) {
    const aliases = { orders:"orders-full", home:"dashboard", customer:"customers", site:"content", plate:"plate-orders" };
    const view = aliases[value] || value;
    return allowed.has(view) ? view : "dashboard";
  }
  function loadFrame(view) {
    const frame = view === "orders-full" ? document.querySelector("#ordersFrame") : null;
    if (!frame || frame.dataset.loaded === "1") return;
    frame.dataset.loaded = "1";
    frame.src = `${frame.dataset.src}${frame.dataset.src.includes("?") ? "&" : "?"}shell=${Date.now()}`;
  }
  function showView(rawView, updateHash = true) {
    const view = normalizeView(rawView);
    panels.forEach((panel) => { panel.hidden = panel.dataset.shellPanel !== view; });
    buttons.forEach((button) => button.classList.toggle("is-shell-active", button.dataset.shellView === view));
    loadFrame(view);
    if (updateHash) history.replaceState(null, "", `#${view}`);
    window.scrollTo({ top:0, behavior:"auto" });
  }
  buttons.forEach((button) => button.addEventListener("click", (event) => { event.preventDefault(); showView(button.dataset.shellView); }));
  window.addEventListener("hashchange", () => showView(location.hash.slice(1), false));
  const initial = new URLSearchParams(location.search).get("view") || location.hash.slice(1);
  showView(initial, false);
})();
