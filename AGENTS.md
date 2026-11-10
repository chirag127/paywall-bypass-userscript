# AGENTS.md - paywall-bypass-userscript

Single-file userscript. `paywall-bypass-userscript.user.js` at repo root IS the product. No build, no deps, `@grant none`.

## Method

| Source | How it's read |
|--------|--------------|
| JSON-LD | `script[type=application/ld+json]` → any Article/NewsArticle node with `articleBody` > 200 chars |
| AMP | fetch of `<url>.amp`, `<url>?amp`, `<url>/amp`; body from JSON-LD or common article selectors |
| Archive | opens `archive.ph/newest/<url>` and `web.archive.org/web/2026/<url>` |
| Paywall | `querySelector('[class*="paywall"], [id*="paywall"], [data-testid*="paywall"]')` or text match |

Settings open **only** from the right-click context menu (transient DOM menu on `contextmenu` event). No floating panels/chips. `@grant none`.

## Rules

- One file, zero deps, `@grant none`. Broad `@match *://*/*` is intentional (paywalls are site-specific).
- Settings persist to `localStorage` under `paywall-bypass`.
- Auto-read mode reads JSON-LD on paywall pages; never sends the page to a third party.
- No credential theft, no DRM defeat, no Widevine.

## Install docs

Shared guide: https://github.com/chirag127/userscript-install-guide

## Test

`sctl install ./paywall-bypass-userscript.user.js`, open a paywalled article, right-click, pick **Read via JSON-LD**, confirm the article renders.

Documentation is single-sourced at `c:\ws\docs/okf\`. Your note: `c:\ws\docs/okf\scripts\paywall-bypass-userscript.md`. Do not create an `okf/` folder here.


