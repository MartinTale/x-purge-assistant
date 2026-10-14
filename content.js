(() => {
  const KEPT_KEY = "kept";
  const FOLLOWING_KEY = "following";
  const OWNER_KEY = "owner";
  const TOTAL_KEY = "followingTotal";
  const RESERVED = new Set(["i", "home", "search", "notifications", "messages", "explore", "settings"]);
  let kept = {};
  let following = {};
  let owner = "";

  function handleFromHref(href) {
    const m = (href || "").match(/^\/([A-Za-z0-9_]{1,15})(\/|$|\?)/);
    return m && !RESERVED.has(m[1].toLowerCase()) ? m[1] : null;
  }

  function isOwnerFollowingPage() {
    return !!owner && location.pathname.toLowerCase().replace(/\/$/, "") === `/${owner.toLowerCase()}/following`;
  }

  function rowHandle(row) {
    return handleFromHref(row.querySelector('a[role="link"][href^="/"]')?.getAttribute("href"));
  }

  function metaFrom(scope, handle) {
    const name = [...scope.querySelectorAll('[data-testid="User-Name"] span, [data-testid="UserName"] span')].find(
      (s) => !s.children.length && s.textContent.trim() && !s.textContent.trim().startsWith("@")
    );
    const avatar = scope.querySelector('[data-testid^="UserAvatar-Container"] img')?.src || "";
    return { handle, name: name?.textContent.trim() || handle, avatar };
  }

  function scrapeFollowing() {
    let added = false;
    document.querySelectorAll('[data-testid="primaryColumn"] [data-testid="UserCell"]').forEach((row) => {
      const handle = rowHandle(row);
      if (!handle || following[handle]) return;
      following[handle] = metaFrom(row, handle);
      added = true;
    });
    if (added) chrome.storage.local.set({ [FOLLOWING_KEY]: following });
  }

  function scrapeTotal() {
    const link = [...document.querySelectorAll('a[href$="/following"]')].find(
      (a) => a.getAttribute("href").toLowerCase() === `/${owner.toLowerCase()}/following`
    );
    const m = link?.textContent.trim().match(/^(\d[\d,]*)\s/);
    if (!m) return;
    const total = Number(m[1].replace(/,/g, ""));
    chrome.storage.local.get(TOTAL_KEY, (r) => {
      if (r[TOTAL_KEY] !== total) chrome.storage.local.set({ [TOTAL_KEY]: total });
    });
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

  function syncFollowing(handle, scope, isFollowing) {
    if (isFollowing === handle in following) return;
    if (isFollowing) following[handle] = metaFrom(scope, handle);
    else delete following[handle];
    chrome.storage.local.set({ [FOLLOWING_KEY]: following });
  }

  function scan() {
    if (!owner) return;
    scrapeTotal();
    if (isOwnerFollowingPage()) scrapeFollowing();
    document.querySelectorAll('[data-testid$="-follow"], [data-testid$="-unfollow"]').forEach((btn) => {
      const cell = btn.closest('[data-testid="UserCell"]');
      const scope = cell || document.querySelector('[data-testid="primaryColumn"]');
      if (!scope) return;
      const handle = cell ? rowHandle(cell) : handleFromHref(location.pathname);
      if (!handle) return;
      const isFollowing = btn.getAttribute("data-testid").endsWith("-unfollow");
      if (isFollowing) addKeepButton(btn, handle);
      syncFollowing(handle, scope, isFollowing);
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[FOLLOWING_KEY]) following = changes[FOLLOWING_KEY].newValue || {};
    if (changes[OWNER_KEY]) owner = changes[OWNER_KEY].newValue || "";
    if (changes[KEPT_KEY]) kept = changes[KEPT_KEY].newValue || {};
  });

  chrome.storage.local.get([KEPT_KEY, FOLLOWING_KEY, OWNER_KEY], (r) => {
    kept = r[KEPT_KEY] || {};
    following = r[FOLLOWING_KEY] || {};
    owner = r[OWNER_KEY] || "";
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  });
})();
