const ALARM = "openRandom";
const JITTER = 0.25;

async function schedule({ reset = true } = {}) {
  const { interval = 0, paused = false, owner = "" } = await chrome.storage.local.get(["interval", "paused", "owner"]);
  if (!reset && (await chrome.alarms.get(ALARM))) return;
  await chrome.alarms.clear(ALARM);
  if (owner && interval > 0 && !paused) {
    const delayInMinutes = interval * (1 - JITTER + Math.random() * 2 * JITTER);
    chrome.alarms.create(ALARM, { delayInMinutes });
  }
}

async function openRandom() {
  const { following = {}, kept = {} } = await chrome.storage.local.get(["following", "kept"]);
  const pool = Object.keys(following).filter((h) => !kept[h]);
  if (!pool.length) return chrome.storage.local.set({ paused: true });
  const handle = pool[Math.floor(Math.random() * pool.length)];
  chrome.tabs.create({ url: `https://x.com/${handle}` });
}

chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== ALARM) return;
  await openRandom();
  schedule();
});
chrome.storage.onChanged.addListener((c, area) => area === "local" && (c.interval || c.paused || c.owner) && schedule());
chrome.runtime.onInstalled.addListener(() => schedule());
chrome.runtime.onStartup.addListener(() => schedule({ reset: false }));
