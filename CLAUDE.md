# X Purge Assistant

Chrome MV3 extension, plain JS, no build, no backend. Everything lives in `chrome.storage.local`.
Work directly on `main`: commit every change and push it.

## Files

- `interceptor.js` - MAIN world (page context). Wraps `fetch`/XHR, and for X's `Following` GraphQL calls posts the JSON to the page via `window.postMessage` (`XPA_FOLLOWING`).
- `content.js` + `content.css` - isolated world, `document_start`. Collects the following list, injects the Keep button, reads X's following total.
- `background.js` - service worker. Alarm that opens a random non-kept account.
- `popup.html/js/css` - settings, progress, review/kept lists. Re-renders on every storage change.

## Storage

| Key | Shape | Written by |
|---|---|---|
| `owner` | handle string, no `@` | popup |
| `following` | `{handle: {handle, name, avatar}}` | content, popup (clear) |
| `kept` | `{handle: true}` | content |
| `followingTotal` | number or null, X's own count | content, popup (clear) |
| `interval` | minutes, 0 = never | popup |
| `paused` | boolean | popup, background (auto-pause when nothing left) |

## How it works

- No `owner` set: content script and alarm do nothing.
- Bulk collection happens only on `/<owner>/following`, from two sources merged into `following` (`mergeUsers`): intercepted `Following` responses (covers rows X unloads while scrolling) and rendered `UserCell` rows (covers an already-rendered page).
- Any row or profile (outside tweets) showing `-unfollow` (Following) adds that handle; `-follow` removes it. This keeps the list current when you follow or unfollow elsewhere.
- Keep button is added after each `-unfollow` button; its parent gets `.xpa-host` to lay out as a row.
- `followingTotal` is parsed from the owner's `/following` link text (exact counts only; abbreviated counts like "12K" are skipped).
- Alarm: one-shot with ±25% jitter (`JITTER`), rescheduled after each fire, on interval/pause/owner change, and on browser start (kept if already pending).
- Clear list in the popup empties `following` and `followingTotal`; `kept` stays. The content script drops its in-memory copy when storage is emptied.

## Gotchas

- After reloading the extension, refresh open x.com tabs: the old content script is orphaned and every `chrome.*` call throws. `scan` detects this and stops its observer.
- X's markup and GraphQL shapes are unofficial and can change: selectors are `data-testid` values (`UserCell`, `User-Name`, `primaryColumn`, `*-follow`/`*-unfollow`), GraphQL op name is `Following`.
- `content.js` runs at `document_start` so it catches the first `Following` response; DOM work waits for `DOMContentLoaded`.
- Use spaces, no em dashes.
