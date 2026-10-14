const BEARER =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
const PAGE_SIZE = 100;
const FEATURES = {
  rweb_video_screen_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  longform_notetweets_rich_text_read_enabled: true,
  responsive_web_enhance_cards_enabled: false,
};

async function cookie(name) {
  const c = await chrome.cookies.get({ url: "https://x.com", name });
  return c ? decodeURIComponent(c.value) : null;
}

async function findQueryId() {
  const html = await (await fetch("https://x.com", { credentials: "include" })).text();
  const scripts = [...html.matchAll(/https:\/\/abs\.twimg\.com\/[^"']+\.js/g)].map((m) => m[0]);
  for (const src of scripts) {
    const js = await (await fetch(src)).text();
    const m = js.match(/queryId:"([\w-]+)",operationName:"Following"/);
    if (m) return m[1];
  }
  throw new Error("Following queryId not found");
}

function parseUser(result) {
  if (!result) return null;
  const legacy = result.legacy || {};
  const handle = result.core?.screen_name || legacy.screen_name;
  if (!handle) return null;
  return {
    handle,
    name: result.core?.name || legacy.name || handle,
    avatar: result.avatar?.image_url || legacy.profile_image_url_https || "",
  };
}

function parsePage(json) {
  const instructions = json.data?.user?.result?.timeline?.timeline?.instructions || [];
  const entries = instructions.flatMap((i) => i.entries || []);
  const users = [];
  let cursor = null;
  for (const e of entries) {
    if (e.content?.cursorType === "Bottom") cursor = e.content.value;
    const user = parseUser(e.content?.itemContent?.user_results?.result);
    if (user) users.push(user);
  }
  return { users, cursor };
}

async function importFollowing() {
  const [ct0, twid] = await Promise.all([cookie("ct0"), cookie("twid")]);
  const userId = twid && twid.replace(/^u=/, "");
  if (!ct0 || !userId) throw new Error("Not logged in to x.com");
  const queryId = await findQueryId();
  const headers = {
    authorization: `Bearer ${BEARER}`,
    "x-csrf-token": ct0,
    "x-twitter-auth-type": "OAuth2Session",
  };

  const following = {};
  let cursor = null;
  do {
    const variables = { userId, count: PAGE_SIZE, includePromotedContent: false, ...(cursor && { cursor }) };
    const params = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify(FEATURES),
    });
    const res = await fetch(`https://x.com/i/api/graphql/${queryId}/Following?${params}`, {
      headers,
      credentials: "include",
    });
    if (!res.ok) throw new Error(`X API ${res.status}`);
    const page = parsePage(await res.json());
    for (const u of page.users) following[u.handle] = u;
    cursor = page.users.length ? page.cursor : null;
  } while (cursor);

  await chrome.storage.local.set({ following });
  return Object.keys(following).length;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "import") return;
  importFollowing()
    .then((count) => sendResponse({ count }))
    .catch((e) => sendResponse({ error: e.message }));
  return true;
});
