(() => {
  const KEPT_KEY = "kept";
  const FOLLOWING_KEY = "following";
  const OWNER_KEY = "owner";
  const TOTAL_KEY = "followingTotal";
  const RESERVED = new Set(["i", "home", "search", "notifications", "messages", "explore", "settings"]);
  let kept = {};
  let following = {};
  let owner = "";
  let observer;

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

  function saveFollowing() {
    chrome.storage.local.set({ [FOLLOWING_KEY]: following });
  }

  function mergeUsers(users) {
    let changed = false;
    for (const next of users) {
      const prev = following[next.handle];
      const merged = {
        handle: next.handle,
        name: next.name !== next.handle ? next.name : prev?.name || next.handle,
        avatar: next.avatar || prev?.avatar || "",
      };
      if (prev && prev.name === merged.name && prev.avatar === merged.avatar) continue;
      following[next.handle] = merged;
      changed = true;
    }
    if (changed) saveFollowing();
  }

  function scrapeFollowing() {
    const users = [];
    document.querySelectorAll('[data-testid="primaryColumn"] [data-testid="UserCell"]').forEach((row) => {
      const handle = rowHandle(row);
      if (handle) users.push(metaFrom(row, handle));
    });
    mergeUsers(users);
  }

  function parseFollowingResponse(json) {
    const result = json?.data?.user?.result;
    const instructions = (result?.timeline || result?.timeline_v2)?.timeline?.instructions || [];
    return instructions
      .flatMap((i) => i.entries || [])
      .flatMap((e) => {
        const user = e.content?.itemContent?.user_results?.result;
        const handle = user?.core?.screen_name || user?.legacy?.screen_name;
        if (!handle) return [];
        return [{
          handle,
          name: user.core?.name || user.legacy?.name || handle,
          avatar: user.avatar?.image_url || user.legacy?.profile_image_url_https || "",
        }];
      });
  }

  function removeFollowing(handle) {
    if (!(handle in following)) return;
    delete following[handle];
    saveFollowing();
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
    const host = unfollowBtn.parentElement;
    host.classList.add("xpa-host");
    if (host.querySelector(".xpa-keep")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "xpa-keep";
    const render = () => {
      btn.classList.toggle("xpa-on", !!kept[handle]);
      btn.textContent = kept[handle] ? "\u2713 Kept" : "Keep";
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
    unfollowBtn.after(btn);
  }

  // After the extension reloads, this script is orphaned and every chrome.* call throws.
  function scan() {
    if (!chrome.runtime?.id) {
      observer?.disconnect();
      return;
    }
    if (!owner) return;
    scrapeTotal();
    if (isOwnerFollowingPage()) scrapeFollowing();
    document.querySelectorAll('[data-testid$="-follow"], [data-testid$="-unfollow"]').forEach((btn) => {
      const cell = btn.closest('[data-testid="UserCell"]');
      if (!cell && btn.closest("article")) return;
      const handle = cell ? rowHandle(cell) : handleFromHref(location.pathname);
      if (!handle) return;
      if (btn.getAttribute("data-testid").endsWith("-unfollow")) {
        addKeepButton(btn, handle);
        if (!following[handle]) {
          mergeUsers([metaFrom(cell || document.querySelector('[data-testid="primaryColumn"]') || document, handle)]);
        }
      } else {
        removeFollowing(handle);
      }
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[FOLLOWING_KEY] && !Object.keys(changes[FOLLOWING_KEY].newValue || {}).length) following = {};
    if (changes[KEPT_KEY]) kept = changes[KEPT_KEY].newValue || {};
    if (changes[OWNER_KEY]) {
      owner = changes[OWNER_KEY].newValue || "";
      scan();
    }
  });

  const ready = new Promise((resolve) => {
    chrome.storage.local.get([KEPT_KEY, FOLLOWING_KEY, OWNER_KEY], (r) => {
      kept = r[KEPT_KEY] || {};
      following = r[FOLLOWING_KEY] || {};
      owner = r[OWNER_KEY] || "";
      resolve();
    });
  });

  // X's own Following responses, relayed by interceptor.js; covers rows X unloads while scrolling.
  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.data?.type !== "XPA_FOLLOWING") return;
    await ready;
    if (!chrome.runtime?.id || !isOwnerFollowingPage()) return;
    mergeUsers(parseFollowingResponse(event.data.data));
  });

  function start() {
    scan();
    observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  ready.then(() => {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  });
})();
