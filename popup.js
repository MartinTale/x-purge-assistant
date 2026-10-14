(() => {
  const list = document.getElementById("list");
  const status = document.getElementById("status");
  const count = document.getElementById("count");
  const importBtn = document.getElementById("import");
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

  const load = () => chrome.storage.local.get(["following", "kept", "importStatus", "interval"], (r) => {
    intervalSelect.value = String(r.interval || 0);
    render(r);
    renderStatus(r.importStatus);
  });

  function renderStatus(s) {
    if (!s) return;
    importBtn.disabled = !!s.running;
    status.textContent = s.error
      ? `Error: ${s.error}`
      : s.running
        ? `Importing... ${s.count} found`
        : `Imported ${s.count} accounts`;
  }

  importBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.startsWith("https://x.com/")) {
      status.textContent = "Open x.com in the current tab first";
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: "import" });
    window.close();
  });

  intervalSelect.addEventListener("change", () =>
    chrome.storage.local.set({ interval: Number(intervalSelect.value) })
  );

  chrome.storage.onChanged.addListener(load);
  load();
})();
