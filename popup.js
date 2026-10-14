(() => {
  const $ = (id) => document.getElementById(id);
  const list = $("list");
  const empty = $("empty");
  const ownerInput = $("owner");
  const intervalSelect = $("interval");
  const pauseBtn = $("pause");
  const clearBtn = $("clear");
  const tabs = { review: $("tab-review"), kept: $("tab-kept") };
  let view = "review";
  let data = {};

  const fmt = (n) => n.toLocaleString();

  function renderProgress({ following = {}, owner, followingTotal = null }) {
    const tracked = Object.keys(following).length;
    const message = $("message");
    $("tracked").textContent = fmt(tracked);
    $("total").textContent = followingTotal === null ? "tracked" : `of ${fmt(followingTotal)} followed`;
    $("bar").hidden = followingTotal === null || !followingTotal;
    const ratio = followingTotal ? Math.min(1, tracked / followingTotal) : 0;
    $("fill").style.width = `${ratio * 100}%`;

    const done = followingTotal !== null && tracked === followingTotal;
    $("bar").classList.toggle("done", done);
    message.className = "message";

    if (!owner) {
      message.textContent = "Enter your X handle to start collecting.";
    } else if (followingTotal === null) {
      message.textContent = "Open your profile on x.com once to see your total.";
    } else if (done) {
      message.textContent = "Everyone is collected.";
      message.classList.add("done");
    } else if (tracked < followingTotal) {
      message.textContent = `${fmt(followingTotal - tracked)} left. Scroll your following list to collect them.`;
      message.classList.add("gap");
    } else {
      message.textContent = `${fmt(tracked - followingTotal)} more than X reports. Unfollowed accounts drop off when you see them.`;
    }
  }

  function row(user, isKept) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `https://x.com/${user.handle}`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    const img = document.createElement("img");
    img.src = user.avatar;
    img.alt = "";
    const who = document.createElement("div");
    who.className = "who";
    const name = document.createElement("b");
    name.textContent = user.name;
    const handle = document.createElement("small");
    handle.textContent = `@${user.handle}`;
    who.append(name, handle);
    a.append(img, who);
    if (isKept) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "Kept";
      a.append(badge);
    }
    li.append(a);
    return li;
  }

  function renderList({ following = {}, kept = {} }) {
    const users = Object.values(following).sort((a, b) => a.name.localeCompare(b.name));
    const keptUsers = users.filter((u) => kept[u.handle]);
    const reviewUsers = users.filter((u) => !kept[u.handle]);
    $("n-review").textContent = fmt(reviewUsers.length);
    $("n-kept").textContent = fmt(keptUsers.length);
    for (const [name, btn] of Object.entries(tabs)) btn.setAttribute("aria-pressed", String(name === view));

    const shown = view === "kept" ? keptUsers : reviewUsers;
    list.replaceChildren(...shown.map((u) => row(u, view === "kept")));
    empty.hidden = shown.length > 0;
    if (shown.length) return;
    empty.textContent = users.length
      ? view === "kept"
        ? "Nothing kept yet. Use the Keep button next to an account on x.com."
        : "Nothing left to review."
      : "No accounts yet. Open your following page on x.com and scroll.";
  }

  function render() {
    renderProgress(data);
    renderList(data);
    clearBtn.disabled = !Object.keys(data.following || {}).length;
  }

  const load = () =>
    chrome.storage.local.get(["following", "kept", "owner", "interval", "paused", "followingTotal"], (r) => {
      data = r;
      if (document.activeElement !== ownerInput) ownerInput.value = r.owner ? `@${r.owner}` : "";
      intervalSelect.value = String(r.interval || 0);
      pauseBtn.hidden = !r.interval;
      pauseBtn.textContent = r.paused ? "Resume" : "Pause";
      render();
    });

  ownerInput.addEventListener("change", () =>
    chrome.storage.local.set({ owner: ownerInput.value.trim().replace(/^@/, "") })
  );

  clearBtn.addEventListener("click", () => {
    if (!confirm("Clear the tracked list? Kept marks stay.")) return;
    chrome.storage.local.set({ following: {}, followingTotal: null });
  });

  pauseBtn.addEventListener("click", () => chrome.storage.local.set({ paused: !data.paused }));

  intervalSelect.addEventListener("change", () =>
    chrome.storage.local.set({ interval: Number(intervalSelect.value) })
  );

  for (const [name, btn] of Object.entries(tabs)) {
    btn.addEventListener("click", () => {
      view = name;
      renderList(data);
    });
  }

  chrome.storage.onChanged.addListener(load);
  load();
})();
