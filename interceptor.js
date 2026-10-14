// Runs in the page's own context so it can see X's GraphQL responses for the following list.
(() => {
  const FOLLOWING_OP = /\/graphql\/[^/]+\/Following(\?|$)/;
  const post = (data) => window.postMessage({ type: "XPA_FOLLOWING", data }, "*");

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url || String(args[0]);
    if (FOLLOWING_OP.test(url)) res.clone().json().then(post).catch(() => {});
    return res;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this._xpaUrl = String(url);
    return origOpen.apply(this, arguments);
  };

  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    if (FOLLOWING_OP.test(this._xpaUrl || "")) {
      this.addEventListener("load", () => {
        try {
          post(JSON.parse(this.responseText));
        } catch {}
      });
    }
    return origSend.apply(this, arguments);
  };
})();
