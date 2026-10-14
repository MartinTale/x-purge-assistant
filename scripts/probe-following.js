// Paste into the DevTools console on x.com (logged in). Looks for cached user data
// in web storage, IndexedDB and the in-memory Redux store, and reports what it finds.
(async () => {
  const SCREEN_NAME = /"screen_name":"[A-Za-z0-9_]{1,15}"/g;
  const hits = (text) => (text.match(SCREEN_NAME) || []).length;
  const report = {};

  for (const [name, store] of [["localStorage", localStorage], ["sessionStorage", sessionStorage]]) {
    const keys = Object.keys(store);
    report[name] = {
      keys: keys.length,
      screenNameHits: keys.reduce((n, k) => n + hits(store.getItem(k) || ""), 0),
    };
  }

  try {
    const dbs = await indexedDB.databases();
    for (const { name } of dbs) {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open(name);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      for (const storeName of db.objectStoreNames) {
        const rows = await new Promise((res, rej) => {
          const req = db.transaction(storeName).objectStore(storeName).getAll();
          req.onsuccess = () => res(req.result);
          req.onerror = () => rej(req.error);
        });
        report[`indexedDB:${name}/${storeName}`] = {
          records: rows.length,
          screenNameHits: hits(JSON.stringify(rows)),
        };
      }
      db.close();
    }
  } catch (e) {
    report.indexedDB = String(e);
  }

  try {
    const root = document.getElementById("react-root");
    const key = Object.keys(root).find((k) => k.startsWith("__reactContainer$"));
    const queue = [root[key]];
    let store = null;
    for (let i = 0; queue.length && i < 50000 && !store; i++) {
      const fiber = queue.shift();
      if (!fiber) continue;
      store = fiber.memoizedProps?.store?.getState ? fiber.memoizedProps.store : null;
      queue.push(fiber.child, fiber.sibling);
    }
    if (store) {
      const state = store.getState();
      const users = Object.values(state.entities?.users?.entities || {});
      const following = users.filter(
        (u) => u.following === true || u.relationship_perspectives?.following === true
      );
      report.reduxStore = {
        stateKeys: Object.keys(state),
        usersCached: users.length,
        usersFlaggedFollowing: following.length,
      };
      window.__xpa = { store, state, users, following };
    } else {
      report.reduxStore = "not found";
    }
  } catch (e) {
    report.reduxStore = String(e);
  }

  console.log(JSON.stringify(report, null, 2));
  console.log("Inspect further via window.__xpa (store, state, users, following)");
})();
