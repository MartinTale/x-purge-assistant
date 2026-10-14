(() => {
  const KEPT_KEY = "kept";
  const RESERVED = new Set(["i", "home", "search", "notifications", "messages", "explore", "settings"]);
  let kept = {};

  function handleFromHref(href) {
    const m = (href || "").match(/^\/([A-Za-z0-9_]{1,15})(\/|$|\?)/);
    return m && !RESERVED.has(m[1].toLowerCase()) ? m[1] : null;
  }

  function addKeepButton(unfollowBtn, handle) {
    if (unfollowBtn.parentElement.querySelector(".xpa-keep")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "xpa-keep";
    const render = () => {
      btn.classList.toggle("xpa-on", !!kept[handle]);
      btn.textContent = kept[handle] ? "Kept" : "Keep";
    };
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (kept[handle]) delete kept[handle];
      else kept[handle] = true;
      chrome.storage.local.set({ [KEPT_KEY]: kept });
      render();
    });
    render();
    unfollowBtn.before(btn);
  }

  function scan() {
    document.querySelectorAll('[data-testid$="-unfollow"]').forEach((btn) => {
      const scope = btn.closest('[data-testid="UserCell"]') || document.querySelector('[data-testid="primaryColumn"]');
      const handle = scope?.matches('[data-testid="UserCell"]')
        ? handleFromHref(scope.querySelector('a[role="link"][href^="/"]')?.getAttribute("href"))
        : handleFromHref(location.pathname);
      if (handle) addKeepButton(btn, handle);
    });
  }

  chrome.storage.local.get(KEPT_KEY, (r) => {
    kept = r[KEPT_KEY] || {};
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  });
})();
