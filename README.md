# Paywall Bypass

Bypasses metered/hard paywalls by reading what the page already ships: `articleBody` JSON-LD, the AMP copy, or archive snapshots. **No UI floater** — settings open from the right-click context menu only. No credential theft, no DRM.

## Install

[Install paywall-bypass-userscript.user.js](https://github.com/chirag127/paywall-bypass-userscript/raw/main/paywall-bypass-userscript.user.js)

## Use

On a paywalled page, right-click → **Paywall Bypass** menu:
- **Read via JSON-LD** — most news sites ship `articleBody` for SEO; this just renders it
- **Read via AMP** — fetches the public AMP copy and extracts the body
- **Open archive.ph** / **Open Wayback Machine** — archive snapshots
- **Auto-read** — reads JSON-LD automatically on paywall pages
- **Right-click menu on/off**

## Gray zone

Reading `articleBody` that the page already downloaded (for SEO) is generally not a ToS violation — the content was already in your browser. AMP copies are published by the site. Archives are public. This script does **not** steal credentials, defeat DRM, or send the page anywhere.

## License

[MIT](LICENSE) © 2026 chirag127
