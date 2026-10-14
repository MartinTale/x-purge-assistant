(() => {
  const list = document.getElementById("list");
  const status = document.getElementById("status");
  const count = document.getElementById("count");
  const ownerInput = document.getElementById("owner");
  const pauseBtn = document.getElementById("pause");
  const intervalSelect = document.getElementById("interval");

  function render({ following = {}, kept = {} }) {
    const users = Object.values(following).sort(
      (a, b) => !!kept[a.handle] - !!kept[b.handle] || a.name.localeCompare(b.name)
    );
    const keptCount = users.filter((u) => kept[u.handle]).length;
    count.textContent = users.length ? `(${keptCount}/${users.length} kept)` : "";
    list.replaceChildren(...users.map((u) => row(u, kept[u.handle])));
  }

  function row(user, isKept) {
    const li = document.createElement("li");
    li.className = isKept ? "kept" : "";
    const img = document.createElement("img");
    img.src = user.avatar;
    const link = document.createElement("a");
    link.href = `https://x.com/${user.handle}`;
    link.target = "_blank";
    link.textContent = user.name;
    const handle = document.createElement("small");
    handle.textContent = `@${user.handle}`;
    link.append(handle);
    li.append(img, link);
    return li;
  }

  const load = () => chrome.storage.local.get(["following", "kept", "owner", "interval", "paused"], (r) => {
    intervalSelect.value = String(r.interval || 0);
    pauseBtn.hidden = !r.interval;
    pauseBtn.textContent = r.paused ? "Resume" : "Pause";
    if (document.activeElement !== ownerInput) ownerInput.value = r.owner || "";
    status.hidden = !!r.owner;
    render(r);
  });

  ownerInput.addEventListener("change", () =>
    chrome.storage.local.set({ owner: ownerInput.value.trim().replace(/^@/, "") })
  );

  pauseBtn.addEventListener("click", async () => {
    const { paused } = await chrome.storage.local.get("paused");
    chrome.storage.local.set({ paused: !paused });
  });

  intervalSelect.addEventListener("change", () =>
    chrome.storage.local.set({ interval: Number(intervalSelect.value) })
  );

  chrome.storage.onChanged.addListener(load);
  load();
})();
