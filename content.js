(() => {
  const KEPT_KEY = "kept";
  const FOLLOWING_KEY = "following";
  const OWNER_KEY = "owner";
  const TOTAL_KEY = "followingTotal";
  const SCAN_INTERVAL_MS = 1500;
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

  // Writes are serialized and applied to the stored list, so overlapping scans never overwrite each other.
  let writeQueue = Promise.resolve();
  function updateFollowing(apply) {
    writeQueue = writeQueue
      .then(async () => {
        const stored = (await chrome.storage.local.get(FOLLOWING_KEY))[FOLLOWING_KEY] || {};
        if (apply(stored)) await chrome.storage.local.set({ [FOLLOWING_KEY]: stored });
      })
      .catch(() => {});
  }

  const isStale = (prev, next) => !prev || prev.name !== next.name || prev.avatar !== next.avatar;

  function scrapeFollowing() {
    const found = [];
    document.querySelectorAll('[data-testid="primaryColumn"] [data-testid="UserCell"]').forEach((row) => {
      const handle = rowHandle(row);
      if (!handle) return;
      const prev = following[handle];
      if (prev?.avatar && prev.name !== handle) return;
      const next = metaFrom(row, handle);
      if (isStale(prev, next)) found.push(next);
    });
    if (!found.length) return;
    updateFollowing((stored) => {
      let changed = false;
      for (const user of found) {
        if (!isStale(stored[user.handle], user)) continue;
        stored[user.handle] = user;
        changed = true;
      }
      return changed;
    });
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
    const meta = isFollowing ? metaFrom(scope, handle) : null;
    updateFollowing((stored) => {
      if (isFollowing === handle in stored) return false;
      if (isFollowing) stored[handle] = meta;
      else delete stored[handle];
      return true;
    });
  }

  let observer;
  let timer;

  // After the extension reloads, this script is orphaned and every chrome.* call throws.
  function scan() {
    if (!chrome.runtime?.id) {
      observer?.disconnect();
      clearInterval(timer);
      return;
    }
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
    if (changes[OWNER_KEY]) scan();
  });

  chrome.storage.local.get([KEPT_KEY, FOLLOWING_KEY, OWNER_KEY], (r) => {
    kept = r[KEPT_KEY] || {};
    following = r[FOLLOWING_KEY] || {};
    owner = r[OWNER_KEY] || "";
    scan();
    observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    timer = setInterval(scan, SCAN_INTERVAL_MS);
  });
})();
