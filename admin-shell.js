(() => {
  const allowed = new Set(["dashboard", "products", "orders-full", "draw"]);
  const buttons = [...document.querySelectorAll("[data-shell-view]")];
  const panels = [...document.querySelectorAll("[data-shell-panel]")];

  function normalizeView(value) {
    const aliases = { orders: "orders-full", raffle: "draw", home: "dashboard" };
    const view = aliases[value] || value;
    return allowed.has(view) ? view : "dashboard";
  }

  function loadFrame(view) {
    const frame = view === "orders-full" ? document.querySelector("#ordersFrame") : view === "draw" ? document.querySelector("#drawFrame") : null;
    if (frame && !frame.src) frame.src = frame.dataset.src;
  }

  function showView(rawView, updateHash = true) {
    const view = normalizeView(rawView);
    panels.forEach((panel) => { panel.hidden = panel.dataset.shellPanel !== view; });
    buttons.forEach((button) => {
      button.classList.toggle("is-shell-active", button.dataset.shellView === view || (view === "dashboard" && button.dataset.shellView === "dashboard"));
    });
    loadFrame(view);
    if (updateHash) history.replaceState(null, "", `#${view}`);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  buttons.forEach((button) => {
    button.addEventListener("click", (event) => {
      if (button.tagName === "A" && !button.dataset.shellView) return;
      event.preventDefault();
      showView(button.dataset.shellView);
    });
  });

  window.addEventListener("hashchange", () => showView(location.hash.slice(1), false));
  const initialView = new URLSearchParams(location.search).get("view") || location.hash.slice(1);
  showView(initialView, false);
})();
