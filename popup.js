(() => {
  const list = document.getElementById("list");
  const status = document.getElementById("status");
  const count = document.getElementById("count");
  const importBtn = document.getElementById("import");

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

  const load = () => chrome.storage.local.get(["following", "kept"], render);

  importBtn.addEventListener("click", async () => {
    importBtn.disabled = true;
    status.textContent = "Importing...";
    const res = await chrome.runtime.sendMessage({ type: "import" });
    status.textContent = res.error ? `Error: ${res.error}` : `Imported ${res.count} accounts`;
    importBtn.disabled = false;
  });

  chrome.storage.onChanged.addListener(load);
  load();
})();
