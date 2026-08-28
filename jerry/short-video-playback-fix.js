(() => {
  function toSafariMp4(url) {
    const raw = String(url || "").trim();
    if (!raw.includes("res.cloudinary.com") || !raw.includes("/video/upload/")) return raw;
    let next = raw;
    if (!next.includes("/video/upload/f_mp4")) {
      next = next.replace("/video/upload/", "/video/upload/f_mp4,vc_h264,ac_aac,q_auto:good/");
    }
    next = next.replace(/\.(mov|webm|m4v|avi)(\?.*)?$/i, ".mp4$2");
    return next;
  }

  function patchVideo(video) {
    if (!video || video.dataset.jerrySafariFixed === "1") return;
    const original = video.dataset.src || video.getAttribute("src") || "";
    if (!original) return;
    const fixed = toSafariMp4(original);
    video.dataset.jerrySafariFixed = "1";
    video.dataset.originalSrc = original;
    if (video.dataset.src) video.dataset.src = fixed;
    if (video.getAttribute("src")) {
      video.src = fixed;
      video.load();
    }
    video.addEventListener("error", () => {
      const fallback = video.dataset.originalSrc;
      if (!fallback || video.dataset.jerryFallbackTried === "1") return;
      video.dataset.jerryFallbackTried = "1";
      video.src = fallback;
      video.load();
    });
  }

  function scan(root = document) {
    root.querySelectorAll?.("#short-videos video").forEach(patchVideo);
  }

  scan();
  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.matches?.("#short-videos video")) patchVideo(node);
      scan(node);
    }));
  }).observe(document.documentElement, { childList:true, subtree:true });
})();
