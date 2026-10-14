(() => {
  const KEPT_KEY = "kept";
  const FOLLOWING_KEY = "following";
  const STATUS_KEY = "importStatus";
  const AUTO_KEY = "autoImport";
  const RESERVED = new Set(["i", "home", "search", "notifications", "messages", "explore", "settings"]);
  const SCROLL_DELAY_MS = 800;
  const IDLE_ROUNDS = 4;
  let kept = {};
  let following = {};

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function handleFromHref(href) {
    const m = (href || "").match(/^\/([A-Za-z0-9_]{1,15})(\/|$|\?)/);
    return m && !RESERVED.has(m[1].toLowerCase()) ? m[1] : null;
  }

  function ownHandle() {
    return handleFromHref(
      document.querySelector('[data-testid="AppTabBar_Profile_Link"]')?.getAttribute("href")
    );
  }

  function isOwnFollowingPage() {
    const me = ownHandle();
    return !!me && location.pathname.toLowerCase() === `/${me.toLowerCase()}/following`;
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

  function scrapeRows(into) {
    document.querySelectorAll('[data-testid="primaryColumn"] [data-testid="UserCell"]').forEach((row) => {
      const handle = rowHandle(row);
      if (handle && !into[handle]) into[handle] = metaFrom(row, handle);
    });
  }

  async function importFollowing() {
    const found = {};
    let idle = 0;
    chrome.storage.local.set({ [STATUS_KEY]: { running: true, count: 0 } });
    while (idle < IDLE_ROUNDS) {
      const before = Object.keys(found).length;
      scrapeRows(found);
      const count = Object.keys(found).length;
      idle = count === before ? idle + 1 : 0;
      chrome.storage.local.set({ [STATUS_KEY]: { running: true, count } });
      window.scrollBy(0, window.innerHeight);
      await sleep(SCROLL_DELAY_MS);
    }
    window.scrollTo(0, 0);
    chrome.storage.local.set({
      [FOLLOWING_KEY]: found,
      [STATUS_KEY]: { running: false, count: Object.keys(found).length },
    });
  }

  function startImport() {
    if (isOwnFollowingPage()) return importFollowing();
    const me = ownHandle();
    if (!me) {
      chrome.storage.local.set({ [STATUS_KEY]: { running: false, error: "Log in to x.com first" } });
      return;
    }
    chrome.storage.local.set({ [AUTO_KEY]: true }, () => {
      location.href = `/${me}/following`;
    });
  }

  async function resumeImport() {
    const { [AUTO_KEY]: auto } = await chrome.storage.local.get(AUTO_KEY);
    if (!auto) return;
    for (let i = 0; i < 30 && !isOwnFollowingPage(); i++) await sleep(500);
    await chrome.storage.local.remove(AUTO_KEY);
    if (isOwnFollowingPage()) await importFollowing();
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

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "import") startImport();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[FOLLOWING_KEY]) following = changes[FOLLOWING_KEY].newValue || {};
    if (changes[KEPT_KEY]) kept = changes[KEPT_KEY].newValue || {};
  });

  chrome.storage.local.get([KEPT_KEY, FOLLOWING_KEY], (r) => {
    kept = r[KEPT_KEY] || {};
    following = r[FOLLOWING_KEY] || {};
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
    resumeImport();
  });
})();
