# X Purge Assistant

Chrome extension to prune your X following list.

- Nothing runs until you set your handle in the popup; while you scroll `x.com/<handle>/following`, accounts are collected automatically (scrapes the rendered list, no API).
- Popup interval setting opens a random non-kept account in a new tab roughly every interval (±25%); Pause/Resume button, auto-pauses when nothing is left to review.
- Popup shows tracked vs X's own following count (read from your profile page) so you can spot gaps.
- A **Keep** button appears next to Following buttons on x.com; kept accounts are saved locally. Unfollow the rest manually.
- Accounts are added only from your following page; any row or profile showing Follow (not Following) removes the account.

Load unpacked at `chrome://extensions` (Developer mode).
