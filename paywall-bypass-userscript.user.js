// ==UserScript==
// @name         Paywall Bypass
// @namespace    https://github.com/chirag127
// @version      1.0.0
// @description  Bypasses metered/hard paywalls: reads the articleBody JSON-LD the page already ships, falls back to AMP, then archive.ph / Wayback Machine. No UI floater — settings open from the right-click context menu only.
// @author       chirag127
// @license      MIT
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Paywall bypass that only uses what the page already exposes:
   *   1. JSON-LD articleBody (most news sites ship it for SEO)
   *   2. AMP version of the page (public copy)
   *   3. archive.ph / Wayback Machine snapshots
   * No credential theft, no DRM, no Widevine — only public copies.
   * All settings open via right-click context menu, no floaters.
   * ------------------------------------------------------------------ */

  const STORAGE_KEY = "paywall-bypass";

  const getOpts = () => {
    try {
      return Object.assign(
        { enabled: true, autoRead: false, openOnRightClick: true, lastSource: "" },
        JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
      );
    } catch {
      return { enabled: true, autoRead: false, openOnRightClick: true, lastSource: "" };
    }
  };
  const setOpts = (o) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(o)); } catch {} };

  /* --------------------------- JSON-LD reader ----------------------- */
  function findArticleBody() {
    for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
      let j;
      try { j = JSON.parse(el.textContent); } catch { continue; }
      const items = [].concat(j, j["@graph"] || []);
      for (const item of items) {
        if (!item) continue;
        const type = [].concat(item["@type"] || []).join(" ");
        if (
          /article|blog|news|reportage/i.test(type) &&
          item.headline &&
          item.articleBody &&
          item.articleBody.length > 200
        ) {
          return {
            headline: item.headline,
            author: item.author?.name || item.author || "",
            date: item.datePublished || item.dateModified || "",
            body: item.articleBody,
            source: "json-ld",
          };
        }
      }
    }
    return null;
  }

  /* --------------------------- render in place ---------------------- */
  function replaceWithArticle(art) {
    const block = document.createElement("article");
    block.id = "paywall-bypass-article";
    block.className = "pbb-article";
    block.innerHTML = `
      <h1>${esc(art.headline)}</h1>
      ${art.author ? `<p class="pbb-byline">${esc(art.author)}</p>` : ""}
      ${art.date ? `<p class="pbb-date">${esc(art.date)}</p>` : ""}
      <div class="pbb-body"></div>
      <p class="pbb-foot">Read via <b>Paywall Bypass</b> — ${esc(art.source)}. Right-click to open settings.</p>
    `;
    const bodyDiv = block.querySelector(".pbb-body");
    art.body
      .split(/\n{2,}/)
      .filter(Boolean)
      .forEach((p) => {
        const para = document.createElement("p");
        para.textContent = p.trim();
        bodyDiv.appendChild(para);
      });

    // Try to find the paywall container to replace, else append
    const paywall =
      document.querySelector('[class*="paywall"], [id*="paywall"], [data-testid*="paywall"]') ||
      document.querySelector("main");
    if (paywall) paywall.replaceWith(block);
    else document.body.appendChild(block);

    injectStyles();
    console.log("[Paywall Bypass] Rendered article from", art.source, "—", art.body.length, "chars");
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function injectStyles() {
    if (document.getElementById("pbb-style")) return;
    const s = document.createElement("style");
    s.id = "pbb-style";
    s.textContent = `
      #paywall-bypass-article{font:16px/1.6 Georgia,serif;max-width:720px;margin:24px auto;padding:0 16px;color:#1a1a1a}
      .pbb-article h1{font-size:32px;line-height:1.2;margin-bottom:8px}
      .pbb-byline{color:#666;font-size:14px}
      .pbb-date{color:#888;font-size:12px}
      .pbb-body p{margin:0 0 1em}
      .pbb-foot{margin-top:2em;padding-top:1em;border-top:1px solid #ccc;color:#888;font-size:12px;font-family:system-ui}
    `;
    document.head.appendChild(s);
  }

  /* --------------------------- AMP fallback ------------------------- */
  async function fetchAmp() {
    const url = new URL(location.href);
    const candidates = [
      url.origin + url.pathname.replace(/\/$/, "") + ".amp",
      url.origin + url.pathname + "?amp",
      url.origin + url.pathname + "/amp",
    ];
    for (const cand of candidates) {
      try {
        const res = await fetch(cand, { credentials: "omit" });
        if (!res.ok) continue;
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const art = extractFromDoc(doc);
        if (art) {
          art.source = "amp";
          art.url = cand;
          return art;
        }
      } catch { /* try next */ }
    }
    return null;
  }

  function extractFromDoc(doc) {
    for (const el of doc.querySelectorAll('script[type="application/ld+json"]')) {
      let j;
      try { j = JSON.parse(el.textContent); } catch { continue; }
      const items = [].concat(j, j["@graph"] || []);
      for (const item of items) {
        if (!item) continue;
        const type = [].concat(item["@type"] || []).join(" ");
        if (/article|news/i.test(type) && item.headline && item.articleBody) {
          return {
            headline: item.headline,
            author: item.author?.name || "",
            date: item.datePublished || "",
            body: item.articleBody,
          };
        }
      }
    }
    const body =
      doc.querySelector("[itemprop=articleBody]") ||
      doc.querySelector(".article-body") ||
      doc.querySelector(".article__body") ||
      doc.querySelector("article");
    if (body && body.textContent.trim().length > 500) {
      return {
        headline: doc.querySelector("h1")?.textContent || doc.title,
        author: "",
        date: "",
        body: body.textContent,
      };
    }
    return null;
  }

  /* --------------------------- archive links ------------------------ */
  function archiveLinks() {
    const clean = location.href.split("#")[0].split("?")[0];
    const domain = location.host + location.pathname.replace(/\/+$/, "");
    return [
      { label: "archive.ph (newest)", href: "https://archive.ph/newest/" + clean },
      { label: "Wayback Machine", href: "https://web.archive.org/web/2026/" + clean },
      { label: "archive.ph (all)", href: "https://archive.ph/" + domain },
    ];
  }

  /* --------------------------- right-click menu --------------------- */
  function isPaywall() {
    return (
      !!document.querySelector('[class*="paywall"], [id*="paywall"], [data-testid*="paywall"], [class*="metered"]') ||
      /paywall|metered|subscribe|register to continue|limited articles/i.test(document.body?.innerText?.slice(0, 3000) || "")
    );
  }

  let pbbMenu = null;
  function dismissMenu() {
    if (document.body.contains(pbbMenu)) document.body.removeChild(pbbMenu);
    document.removeEventListener("click", dismissMenu, true);
    document.removeEventListener("keydown", onKey, true);
  }
  function onKey(e) { if (e.key === "Escape") dismissMenu(); }

  function openMenu(x, y) {
    dismissMenu();
    const opts = getOpts();
    pbbMenu = document.createElement("div");
    Object.assign(pbbMenu.style, {
      position: "fixed",
      left: x + "px",
      top: y + "px",
      zIndex: 2147483647,
      background: "#1a1a1a",
      color: "#eee",
      border: "1px solid #333",
      borderRadius: "8px",
      boxShadow: "0 10px 30px rgba(0,0,0,.55)",
      font: "13px/1.45 system-ui",
      minWidth: "220px",
      overflow: "hidden",
    });

    const item = (label, action, opts_) => {
      const a = document.createElement("div");
      Object.assign(a.style, {
        padding: "8px 14px",
        cursor: "pointer",
        borderBottom: "1px solid #262626",
        display: "flex",
        gap: "8px",
        alignItems: "center",
      });
      a.addEventListener("mouseenter", () => (a.style.background = "#262626"));
      a.addEventListener("mouseleave", () => (a.style.background = "transparent"));
      const ico = document.createElement("span");
      ico.textContent = opts_?.icon || "•";
      ico.style.width = "18px";
      ico.style.textAlign = "center";
      const txt = document.createElement("span");
      txt.style.flex = "1";
      txt.textContent = label;
      a.append(ico, txt);
      a.addEventListener("click", () => { dismissMenu(); action(); });
      pbbMenu.appendChild(a);
    };

    pbbMenu.innerHTML = "";
    item("Read via JSON-LD", () => {
      const art = findArticleBody();
      if (art) replaceWithArticle(art);
      else toast("No articleBody JSON-LD found on this page");
    }, { icon: "📄" });
    item("Read via AMP", async () => {
      toast("Trying AMP…");
      const art = await fetchAmp();
      if (art) replaceWithArticle(art);
      else toast("No AMP copy available");
    }, { icon: "📱" });
    item("Open archive.ph", () => window.open(archiveLinks()[0].href, "_blank"), { icon: "🕘" });
    item("Open Wayback Machine", () => window.open(archiveLinks()[1].href, "_blank"), { icon: "⏰" });
    item(opts.autoRead ? "Auto-read: ON" : "Auto-read: OFF", () => {
      const o = getOpts(); o.autoRead = !o.autoRead; setOpts(o); toast("Auto-read " + (o.autoRead ? "on" : "off"));
    }, { icon: "⚡" });
    item(opts.openOnRightClick ? "Right-click menu: ON" : "Right-click menu: OFF", () => {
      const o = getOpts(); o.openOnRightClick = !o.openOnRightClick; setOpts(o); toast("Menu " + (o.openOnRightClick ? "on" : "off"));
    }, { icon: "🖱" });

    document.body.appendChild(pbbMenu);
    document.addEventListener("click", dismissMenu, true);
    document.addEventListener("keydown", onKey, true);
  }

  /* --------------------------- toast (transient) -------------------- */
  let toastEl = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      Object.assign(toastEl.style, {
        position: "fixed",
        left: "50%",
        bottom: "12px",
        transform: "translateX(-50%)",
        zIndex: 2147483646,
        background: "rgba(0,0,0,.9)",
        color: "#fff",
        padding: "8px 16px",
        borderRadius: "6px",
        font: "13px system-ui",
        opacity: "0",
        transition: "opacity .25s",
        pointerEvents: "none",
      });
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = "1";
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => (toastEl.style.opacity = "0"), 1400);
  }

  /* --------------------------- wiring ------------------------------- */
  function init() {
    const opts = getOpts();

    // Right-click context menu (native browser menu can't be extended by
    // userscripts, so we attach a transient DOM menu on the "contextmenu"
    // event — this is the standard userscript pattern).
    document.addEventListener("contextmenu", (e) => {
      if (!opts.openOnRightClick) return;
      if (!isPaywall() && !opts.alwaysShowMenu) return;
      e.preventDefault();
      e.stopPropagation();
      openMenu(e.clientX, e.clientY);
    });

    // If auto-read is on and we detect a paywall, read the JSON-LD immediately.
    if (opts.autoRead && isPaywall()) {
      setTimeout(() => {
        const art = findArticleBody();
        if (art) replaceWithArticle(art);
      }, 800);
    }

    // If not a paywall, still allow right-click menu on article pages
    document.addEventListener("contextmenu", (e) => {
      if (!opts.openOnRightClick || opts.alwaysShowMenu === false) return;
      if (isPaywall()) return; // handled above
      if (!/article|post|story/i.test(location.pathname)) return;
      e.preventDefault();
      e.stopPropagation();
      openMenu(e.clientX, e.clientY);
    });
  }

  init();
})();
