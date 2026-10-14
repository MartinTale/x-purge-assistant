const ALARM = "openRandom";

async function schedule() {
  const { interval = 0, paused = false } = await chrome.storage.local.get(["interval", "paused"]);
  await chrome.alarms.clear(ALARM);
  if (interval > 0 && !paused) chrome.alarms.create(ALARM, { periodInMinutes: interval });
}

async function openRandom() {
  const { following = {}, kept = {} } = await chrome.storage.local.get(["following", "kept"]);
  const pool = Object.keys(following).filter((h) => !kept[h]);
  if (!pool.length) return chrome.storage.local.set({ paused: true });
  const handle = pool[Math.floor(Math.random() * pool.length)];
  chrome.tabs.create({ url: `https://x.com/${handle}` });
}

chrome.alarms.onAlarm.addListener((a) => a.name === ALARM && openRandom());
chrome.storage.onChanged.addListener((c, area) => area === "local" && (c.interval || c.paused) && schedule());
chrome.runtime.onInstalled.addListener(schedule);
chrome.runtime.onStartup.addListener(schedule);
