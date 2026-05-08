/* ============================================================
   Ollama — site-wide behaviors
   - Shell injection (topbar / footer / palette) into placeholders
   - Theme toggle (system default, persisted override)
   - Command palette (Cmd+K)
   - Copy-to-clipboard for code blocks
   - Per-page bootstrappers: home / library / model / settings
   ============================================================ */

(() => {
  "use strict";

  /* ---------- shared model catalog ---------- */
  const MODELS = [
    { name: "gpt-oss:120b",         tagline: "Open-weight 120B with strong reasoning and tool use.",  size: "65 GB",  params: "120B", ctx: "128K", family: "gpt-oss",   tags: ["cloud","local","general"], pulls: 2_400_000, region: "us-west", baseLatency: 620,  baseLoad: 78, featured: true },
    { name: "gpt-oss:20b",          tagline: "Smaller open-weight model that fits on a laptop.",      size: "13 GB",  params: "20B",  ctx: "128K", family: "gpt-oss",   tags: ["local","general"],         pulls: 1_900_000, region: "us-east", baseLatency: 280,  baseLoad: 32, featured: true },
    { name: "qwen3-coder:480b",     tagline: "Top-tier code model. Built for repo-scale tasks.",      size: "275 GB", params: "480B", ctx: "262K", family: "qwen3",     tags: ["cloud","code"],            pulls: 1_120_000, region: "us-east", baseLatency: 940,  baseLoad: 88, featured: true },
    { name: "qwen3:32b",            tagline: "Balanced general-purpose model in the Qwen3 family.",   size: "20 GB",  params: "32B",  ctx: "128K", family: "qwen3",     tags: ["local","general"],         pulls: 980_000,   region: "eu-west", baseLatency: 410,  baseLoad: 41 },
    { name: "deepseek-v3.1:671b",   tagline: "Frontier MoE model with deep reasoning.",               size: "404 GB", params: "671B", ctx: "128K", family: "deepseek",  tags: ["cloud","general"],         pulls: 860_000,   region: "us-west", baseLatency: 1200, baseLoad: 95, featured: true },
    { name: "kimi-k2:1t",           tagline: "Trillion-parameter model. Long-context master.",        size: "590 GB", params: "1T",   ctx: "1M",   family: "kimi",      tags: ["cloud","general"],         pulls: 540_000,   region: "ap-south", baseLatency: 1450, baseLoad: 71 },
    { name: "glm-4.6:357b",         tagline: "Strong bilingual model with agentic capabilities.",     size: "210 GB", params: "357B", ctx: "200K", family: "glm",       tags: ["cloud","general"],         pulls: 380_000,   region: "eu-west", baseLatency: 880,  baseLoad: 58 },
    { name: "llama4-scout:109b",    tagline: "Llama 4 Scout — fast, native multimodal.",              size: "60 GB",  params: "109B", ctx: "10M",  family: "llama4",    tags: ["cloud","local","vision"],  pulls: 1_460_000, region: "us-east", baseLatency: 540,  baseLoad: 24, featured: true },
    { name: "llama4-maverick:402b", tagline: "Llama 4 Maverick — reasoning + multimodal at scale.",   size: "240 GB", params: "402B", ctx: "1M",   family: "llama4",    tags: ["cloud","vision"],          pulls: 720_000,   region: "us-west", baseLatency: 980,  baseLoad: 66 },
    { name: "mistral-large:123b",   tagline: "Mistral's flagship — reliable, fast, multilingual.",   size: "70 GB",  params: "123B", ctx: "128K", family: "mistral",   tags: ["cloud","local","general"], pulls: 640_000,   region: "eu-west", baseLatency: 590,  baseLoad: 49 },
    { name: "phi-4:14b",            tagline: "Small but punchy. Excellent for edge devices.",         size: "9 GB",   params: "14B",  ctx: "16K",  family: "phi",       tags: ["local","general"],         pulls: 880_000,   region: "us-east", baseLatency: 220,  baseLoad: 18, featured: true },
    { name: "gemma3:27b",           tagline: "Google's open model. Strong at instruction following.", size: "17 GB",  params: "27B",  ctx: "128K", family: "gemma",     tags: ["local","general"],         pulls: 540_000,   region: "ap-south", baseLatency: 360,  baseLoad: 37 },
  ];

  /* ---------- utilities ---------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmtPct  = (v) => `${Math.round(v)}`;
  const fmtMs   = (ms) => (ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`);
  const fmtTokens = (n) => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return `${n}`;
  };
  const fmtPulls = (n) => {
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
    return `${n}`;
  };
  const fmtDuration = (ms) => {
    const h = Math.floor(ms / 3.6e6);
    const m = Math.floor((ms % 3.6e6) / 6e4);
    const d = Math.floor(h / 24);
    if (d >= 1) return `${d} day${d === 1 ? "" : "s"}`;
    if (h >= 1) return `${h} hour${h === 1 ? "" : "s"}`;
    return `${m} min`;
  };
  const statusBucket = (load) => (load >= 95 ? "full" : load >= 70 ? "busy" : "ok");
  const statusLabel  = (s) => (s === "full" ? "At capacity" : s === "busy" ? "Busy" : "Available");
  const barStatus    = (pct) => (pct >= 95 ? "bad" : pct >= 80 ? "warn" : "ok");

  function makeWalker({ start, lo = 0, hi = 100, step = 3, drift = 0 }) {
    let v = start;
    return () => {
      const delta = (Math.random() - 0.5) * 2 * step + drift;
      v = clamp(v + delta, lo, hi);
      return v;
    };
  }

  function copyIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  }
  function checkIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
  }

  /* ============================================================
     SHELL: topbar / footer / palette
     ============================================================ */
  const shellTopbar = () => `
    <header class="topbar">
      <div class="topbar-inner">
        <a class="brand" href="index.html">
          <svg class="brand-mark" viewBox="0 0 100 100" aria-hidden="true"><use href="logo.svg#root"/></svg>
          <span class="brand-name">Ollama</span>
        </a>
        <nav class="primary-nav" aria-label="Primary">
          <a href="library.html" data-nav="library">Models</a>
          <a href="docs.html"    data-nav="docs">Docs</a>
          <a href="pricing.html" data-nav="pricing">Pricing</a>
          <a href="https://github.com/ollama/ollama" target="_blank" rel="noopener">GitHub</a>
        </nav>
        <button class="search-trigger" data-action="open-palette" aria-label="Search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <span class="search-text">Search models</span>
          <span class="kbd">⌘K</span>
        </button>
        <button class="theme-toggle" data-action="toggle-theme" aria-label="Toggle theme">
          <svg class="theme-icon-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
          <svg class="theme-icon-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>
        <a class="avatar" href="settings.html" title="ai77" aria-label="Account settings"><span aria-hidden="true">🦙</span></a>
      </div>
    </header>
  `;

  const shellFooter = () => `
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-top">
          <div class="footer-brand">
            <a class="brand" href="index.html">
              <svg class="brand-mark" viewBox="0 0 100 100" aria-hidden="true"><use href="logo.svg#root"/></svg>
              <span class="brand-name">Ollama</span>
            </a>
            <p class="muted" style="font-size:13px; line-height:1.6;">Get up and running with large language models, locally and in the cloud.</p>
          </div>
          <div class="footer-col">
            <h4>Product</h4>
            <ul>
              <li><a href="library.html">Models</a></li>
              <li><a href="pricing.html">Pricing</a></li>
              <li><a href="settings.html">Cloud</a></li>
              <li><a href="index.html#download">Download</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>Resources</h4>
            <ul>
              <li><a href="docs.html">Documentation</a></li>
              <li><a href="docs.html#api">API reference</a></li>
              <li><a href="https://github.com/ollama/ollama" target="_blank" rel="noopener">GitHub</a></li>
              <li><a href="#">Blog</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>Company</h4>
            <ul>
              <li><a href="#">About</a></li>
              <li><a href="#">Careers</a></li>
              <li><a href="#">Contact</a></li>
              <li><a href="#">Press</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© 2026 Ollama, Inc.</span>
          <div class="footer-social">
            <a href="https://github.com/ollama/ollama" aria-label="GitHub" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.7-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/></svg>
            </a>
            <a href="#" aria-label="X (Twitter)">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="#" aria-label="Discord">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.075.075 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  `;

  const shellPalette = () => `
    <div class="palette" id="palette" aria-hidden="true" role="dialog" aria-label="Command palette">
      <div class="palette-card">
        <div class="palette-input-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input class="palette-input" id="paletteInput" type="search" placeholder="Search models, settings, docs…" aria-label="Search" />
        </div>
        <div class="palette-results" id="paletteResults"></div>
        <div class="palette-foot">
          <span><span class="kbd">↑↓</span> navigate</span>
          <span><span class="kbd">↵</span> select</span>
          <span><span class="kbd">esc</span> close</span>
        </div>
      </div>
    </div>
  `;

  function mountShell() {
    const top = $('[data-shell="topbar"]');
    if (top) top.outerHTML = shellTopbar();
    const foot = $('[data-shell="footer"]');
    if (foot) foot.outerHTML = shellFooter();
    const pal = $('[data-shell="palette"]');
    if (pal) pal.outerHTML = shellPalette();

    // active nav highlight
    const page = document.body.dataset.page;
    const navMap = { home: null, library: "library", docs: "docs", pricing: "pricing" };
    const target = navMap[page];
    if (target) {
      const link = $(`.primary-nav [data-nav="${target}"]`);
      if (link) link.setAttribute("aria-current", "page");
    }
  }

  /* ============================================================
     THEME
     ============================================================ */
  function setupTheme() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest('[data-action="toggle-theme"]');
      if (!btn) return;
      const current = document.documentElement.dataset.theme
        || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("theme", next);
    });
  }

  /* ============================================================
     COPY-TO-CLIPBOARD
     ============================================================ */
  function setupCopyButtons() {
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest(".code-copy");
      if (!btn) return;
      const host = btn.closest(".code, .code-block");
      if (!host) return;
      let text;
      if (host.classList.contains("code")) {
        text = host.dataset.copy || host.querySelector(".code-text")?.textContent || "";
      } else {
        // pre.code-block — strip the button's own text from the copy
        const clone = host.cloneNode(true);
        clone.querySelectorAll(".code-copy").forEach((b) => b.remove());
        text = clone.textContent.trim();
      }
      try {
        await navigator.clipboard.writeText(text);
        flashCopied(btn);
      } catch {
        // fallback for non-secure contexts
        const t = document.createElement("textarea");
        t.value = text;
        document.body.appendChild(t);
        t.select();
        try { document.execCommand("copy"); flashCopied(btn); } catch {}
        t.remove();
      }
    });
  }
  function flashCopied(btn) {
    const original = btn.innerHTML;
    btn.innerHTML = checkIcon();
    btn.dataset.copied = "true";
    setTimeout(() => {
      btn.innerHTML = original;
      delete btn.dataset.copied;
    }, 1200);
  }

  /* ============================================================
     COMMAND PALETTE
     ============================================================ */
  const paletteState = { open: false, query: "", active: 0, items: [] };

  function paletteCommands() {
    return [
      { kind: "Navigate", label: "Home",     icon: "home",  href: "index.html" },
      { kind: "Navigate", label: "Models",   icon: "grid",  href: "library.html" },
      { kind: "Navigate", label: "Docs",     icon: "book",  href: "docs.html" },
      { kind: "Navigate", label: "Pricing",  icon: "tag",   href: "pricing.html" },
      { kind: "Navigate", label: "Settings · Usage",    icon: "user", href: "settings.html#usage" },
      { kind: "Navigate", label: "Settings · Capacity", icon: "user", href: "settings.html#capacity" },
      { kind: "Action",   label: "Toggle theme",        icon: "moon", action: () => $('[data-action="toggle-theme"]').click() },
      { kind: "Action",   label: "Copy install command", icon: "copy", action: copyInstall },
      ...MODELS.map((m) => ({ kind: "Model", label: m.name, sub: m.tagline, icon: "cube", href: `model.html?m=${encodeURIComponent(m.name)}` })),
    ];
  }

  function copyInstall() {
    navigator.clipboard?.writeText("curl -fsSL https://ollama.com/install.sh | sh");
  }

  function iconSvg(name) {
    const icons = {
      home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
      grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
      book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M4 19.5V22h16"/>',
      tag:  '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
      user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
      moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
      copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
      cube: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    };
    return `<svg class="palette-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.cube}</svg>`;
  }

  function setupPalette() {
    const palette = $("#palette");
    const input = $("#paletteInput");
    const results = $("#paletteResults");
    if (!palette || !input || !results) return;

    function open() {
      paletteState.open = true;
      paletteState.query = "";
      palette.dataset.open = "true";
      palette.setAttribute("aria-hidden", "false");
      input.value = "";
      render();
      requestAnimationFrame(() => input.focus());
    }
    function close() {
      paletteState.open = false;
      palette.removeAttribute("data-open");
      palette.setAttribute("aria-hidden", "true");
    }
    function render() {
      const q = paletteState.query.trim().toLowerCase();
      const all = paletteCommands();
      const items = q
        ? all.filter((c) => `${c.label} ${c.sub || ""}`.toLowerCase().includes(q))
        : all;
      paletteState.items = items;
      paletteState.active = clamp(paletteState.active, 0, Math.max(0, items.length - 1));

      if (!items.length) {
        results.innerHTML = `<div class="palette-empty">No matches for "${q}"</div>`;
        return;
      }
      const groups = items.reduce((acc, it) => {
        (acc[it.kind] ||= []).push(it);
        return acc;
      }, {});
      let html = "";
      let idx = 0;
      for (const kind of Object.keys(groups)) {
        html += `<div class="palette-section"><div class="palette-section-title">${kind}</div>`;
        for (const it of groups[kind]) {
          const isActive = idx === paletteState.active;
          html += `
            <div class="palette-item ${isActive ? "active" : ""}" data-idx="${idx}">
              ${iconSvg(it.icon)}
              <span class="palette-label">${it.label}${it.sub ? ` <span class="muted" style="font-size:12px; margin-left:6px;">· ${it.sub}</span>` : ""}</span>
            </div>`;
          idx++;
        }
        html += `</div>`;
      }
      results.innerHTML = html;
      results.querySelector(".palette-item.active")?.scrollIntoView({ block: "nearest" });
    }
    function selectActive() {
      const it = paletteState.items[paletteState.active];
      if (!it) return;
      close();
      if (it.href) location.href = it.href;
      else if (it.action) it.action();
    }

    document.addEventListener("keydown", (e) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") { e.preventDefault(); paletteState.open ? close() : open(); return; }
      if (e.key === "/" && !paletteState.open && !e.target.matches("input, textarea, select")) {
        e.preventDefault(); open(); return;
      }
      if (!paletteState.open) return;
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); paletteState.active = clamp(paletteState.active + 1, 0, paletteState.items.length - 1); render(); }
      else if (e.key === "ArrowUp")   { e.preventDefault(); paletteState.active = clamp(paletteState.active - 1, 0, paletteState.items.length - 1); render(); }
      else if (e.key === "Enter")     { e.preventDefault(); selectActive(); }
    });

    document.addEventListener("click", (e) => {
      if (e.target.closest('[data-action="open-palette"]')) { e.preventDefault(); open(); return; }
      if (paletteState.open && !e.target.closest(".palette-card")) close();
    });

    input.addEventListener("input", (e) => {
      paletteState.query = e.target.value;
      paletteState.active = 0;
      render();
    });
    results.addEventListener("mousemove", (e) => {
      const item = e.target.closest(".palette-item");
      if (!item) return;
      const idx = +item.dataset.idx;
      if (idx !== paletteState.active) {
        paletteState.active = idx;
        render();
      }
    });
    results.addEventListener("click", (e) => {
      const item = e.target.closest(".palette-item");
      if (!item) return;
      paletteState.active = +item.dataset.idx;
      selectActive();
    });
  }

  /* ============================================================
     SPARKLINE
     ============================================================ */
  function renderSpark(svg, points, opts = {}) {
    if (!svg || !points.length) return;
    const { showAxis = false, showLast = false } = opts;
    const vb = svg.viewBox.baseVal;
    const W = vb.width, H = vb.height;
    const pad = showAxis ? { t: 8, r: 8, b: 14, l: 28 } : { t: 2, r: 2, b: 2, l: 2 };
    const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b;
    const x = (i) => pad.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = (v) => pad.t + innerH - (v / 100) * innerH;
    let d = "";
    points.forEach((p, i) => { d += (i === 0 ? "M" : "L") + x(i).toFixed(2) + "," + y(p).toFixed(2); });
    const area = d + `L${x(points.length - 1).toFixed(2)},${(pad.t + innerH).toFixed(2)}L${x(0).toFixed(2)},${(pad.t + innerH).toFixed(2)}Z`;
    let extras = "";
    if (showAxis) {
      [0, 50, 100].forEach((g) => {
        const yy = y(g).toFixed(2);
        extras += `<line class="spark-grid" x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}"/>`;
        extras += `<text class="spark-label" x="${pad.l - 6}" y="${yy}" text-anchor="end" dominant-baseline="middle">${g}</text>`;
      });
    }
    if (showLast) {
      const lx = x(points.length - 1).toFixed(2);
      const ly = y(points[points.length - 1]).toFixed(2);
      extras += `<circle class="spark-dot" cx="${lx}" cy="${ly}" r="3"/>`;
    }
    svg.innerHTML = `${extras}<path class="spark-area" d="${area}"/><path class="spark-line" d="${d}"/>`;
  }

  /* ============================================================
     AUTO-REFRESH ENGINE
     ============================================================ */
  function makeRefresher({ intervalMs, onTick, countdownEl, toggleEl, dotEl }) {
    let nextTickAt = Date.now() + intervalMs;
    let enabled = true;
    let countdownTimer = null, mainTimer = null;

    function setEnabled(on) {
      enabled = on;
      dotEl?.classList.toggle("paused", !on);
      if (on) { nextTickAt = Date.now() + intervalMs; schedule(); }
      else { clearTimeout(mainTimer); clearInterval(countdownTimer); if (countdownEl) countdownEl.textContent = "—"; }
    }
    function schedule() {
      clearTimeout(mainTimer); clearInterval(countdownTimer);
      const tick = () => {
        if (!enabled) return;
        onTick();
        nextTickAt = Date.now() + intervalMs;
        mainTimer = setTimeout(tick, intervalMs);
      };
      mainTimer = setTimeout(tick, Math.max(0, nextTickAt - Date.now()));
      if (countdownEl) {
        const update = () => {
          const remaining = Math.max(0, Math.round((nextTickAt - Date.now()) / 1000));
          countdownEl.textContent = remaining;
        };
        update();
        countdownTimer = setInterval(update, 250);
      }
    }
    function refreshNow() { onTick(); nextTickAt = Date.now() + intervalMs; schedule(); }
    toggleEl?.addEventListener("change", (e) => setEnabled(e.target.checked));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { clearTimeout(mainTimer); clearInterval(countdownTimer); }
      else if (enabled) { if (Date.now() >= nextTickAt) refreshNow(); else schedule(); }
    });
    schedule();
    return { refreshNow, setEnabled };
  }

  /* ============================================================
     PAGE: home — featured models grid
     ============================================================ */
  function renderModelCard(m) {
    const status = statusBucket(m.baseLoad);
    const url = `model.html?m=${encodeURIComponent(m.name)}`;
    return `
      <a class="model-card" href="${url}" data-status="${status}">
        <header class="model-card-head">
          <div class="model-name-wrap">
            <h3 class="model-name">${m.name}</h3>
            <span class="model-tagline">${m.tagline}</span>
          </div>
          <span class="status-badge"><span class="status-dot"></span>${statusLabel(status)}</span>
        </header>
        <div class="model-meta">
          <span class="model-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            ${m.params}
          </span>
          <span class="model-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v20M2 12h20"/></svg>
            ${m.ctx} ctx
          </span>
          <span class="model-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            ${fmtPulls(m.pulls)} pulls
          </span>
        </div>
      </a>`;
  }

  function initHome() {
    const grid = $("#featuredModels");
    if (!grid) return;
    const featured = MODELS.filter((m) => m.featured);
    grid.innerHTML = featured.map(renderModelCard).join("");
  }

  /* ============================================================
     PAGE: library
     ============================================================ */
  function initLibrary() {
    const grid = $("#libraryGrid");
    if (!grid) return;
    const empty = $("#libEmpty");
    const search = $("#libSearch");
    let filter = "all";
    let query = "";

    function matches(m) {
      const q = query.trim().toLowerCase();
      if (q && !`${m.name} ${m.tagline} ${m.family}`.toLowerCase().includes(q)) return false;
      if (filter === "all") return true;
      if (filter === "local") return m.tags.includes("local");
      if (filter === "cloud") return m.tags.includes("cloud");
      if (filter === "code")  return m.tags.includes("code");
      if (filter === "vision") return m.tags.includes("vision");
      return true;
    }
    function render() {
      const list = MODELS.filter(matches);
      grid.innerHTML = list.map(renderModelCard).join("");
      empty.style.display = list.length ? "none" : "block";
    }
    $$("#libFilters .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#libFilters .chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        filter = chip.dataset.filter;
        render();
      });
    });
    search.addEventListener("input", (e) => { query = e.target.value; render(); });
    render();
  }

  /* ============================================================
     PAGE: model detail
     ============================================================ */
  function initModel() {
    if (!$("#mdName")) return;
    const params = new URLSearchParams(location.search);
    const name = params.get("m") || "gpt-oss:120b";
    const m = MODELS.find((x) => x.name === name) || MODELS[0];

    $("#mdName").textContent = m.name;
    $("#mdTagline").textContent = m.tagline;
    $("#mdRunText").textContent = `ollama run ${m.name}`;
    $("#mdRunCode").dataset.copy = `ollama run ${m.name}`;
    document.title = `${m.name} · Ollama`;

    // Tags row
    const tags = ["local","cloud","code","vision","general"].filter((t) => m.tags.includes(t));
    $("#mdTags").innerHTML = [m.params, m.ctx + " context", ...tags].map((t) => `<span class="tag">${t}</span>`).join("");

    // Aside details
    $("#mdDetails").innerHTML = `
      <dt>Parameters</dt><dd>${m.params}</dd>
      <dt>Context</dt><dd>${m.ctx}</dd>
      <dt>Family</dt><dd>${m.family}</dd>
      <dt>Size</dt><dd>${m.size}</dd>
      <dt>Region</dt><dd>${m.region}</dd>`;

    // Tags table (sub-tags would normally be different quantizations; we'll fake a few)
    const rows = [
      { tag: m.name, size: m.size, q: "Q4_K_M", updated: "3 days ago" },
      { tag: m.name + "-q8", size: scaleSize(m.size, 1.8), q: "Q8_0", updated: "3 days ago" },
      { tag: m.name + "-fp16", size: scaleSize(m.size, 3.2), q: "FP16", updated: "1 week ago" },
    ];
    $("#mdTagRows").innerHTML = rows.map((r) =>
      `<tr><td>${r.tag}</td><td>${r.size}</td><td>${r.q}</td><td>${r.updated}</td></tr>`
    ).join("");

    // Tabs
    $$(".model-tabs button").forEach((b) => {
      b.addEventListener("click", () => {
        $$(".model-tabs button").forEach((x) => { x.classList.remove("active"); x.setAttribute("aria-selected","false"); });
        b.classList.add("active"); b.setAttribute("aria-selected","true");
        const target = b.dataset.tab;
        $$("[data-tab-panel]").forEach((p) => { p.hidden = p.dataset.tabPanel !== target; });
      });
    });

    // Live capacity widget
    const loadWalker = makeWalker({ start: m.baseLoad, lo: 5, hi: 100, step: 4 });
    const card = $("#mdCapacity");
    const tickCard = () => {
      const load = loadWalker();
      const status = statusBucket(load);
      card.parentElement.dataset.status = status;
      $(".status-label", card).textContent = statusLabel(status);
      $("#mdLoadPct").textContent = `${fmtPct(load)}%`;
      const bar = $("#mdLoadBar");
      bar.style.width = `${load}%`;
      bar.dataset.status = barStatus(load);
    };
    tickCard();
    setInterval(tickCard, 8000);
  }
  function scaleSize(s, factor) {
    const n = parseFloat(s);
    if (!isFinite(n)) return s;
    const out = (n * factor).toFixed(n < 100 ? 1 : 0);
    return `${out} GB`;
  }

  /* ============================================================
     PAGE: settings (usage + capacity dashboards)
     ============================================================ */
  function initSettings() {
    if (!$(".settings-page")) return;

    /* routing */
    const VIEWS = ["usage","capacity","keys","billing","profile"];
    const sidebar = $$(".settings-sidebar a");
    const views = $$(".view");
    function showView(name) {
      if (!VIEWS.includes(name)) name = "usage";
      views.forEach((v) => v.hidden = v.dataset.view !== name);
      sidebar.forEach((a) => {
        const active = a.dataset.route === name;
        a.classList.toggle("active", active);
        a.setAttribute("aria-current", active ? "page" : "false");
      });
    }
    window.addEventListener("hashchange", () => showView((location.hash || "#usage").slice(1)));
    showView((location.hash || "#usage").slice(1));

    /* USAGE */
    const usageState = {
      sessionPct: 0,
      weeklyPct: 100,
      sessionResetAt: Date.now() + 4 * 3.6e6,
      weeklyResetAt:  Date.now() + 2 * 24 * 3.6e6,
      sessionHistory: seedSessionHistory(),
      sessionWalker: makeWalker({ start: 4, lo: 0, hi: 100, step: 1.2, drift: 0.05 }),
      topModels: [
        { name: "gpt-oss:120b",        tokens: 4_182_339 },
        { name: "qwen3-coder:480b",    tokens: 2_904_117 },
        { name: "deepseek-v3.1:671b",  tokens: 1_356_802 },
        { name: "kimi-k2:1t",          tokens: 612_044 },
        { name: "gpt-oss:20b",         tokens: 188_950 },
      ],
    };
    function seedSessionHistory() {
      const pts = []; let v = 8;
      for (let i = 0; i < 60; i++) { v += (Math.random() - 0.45) * 2; v = clamp(v, 0, 60); pts.push(v); }
      return pts;
    }
    function refreshUsage() {
      const next = usageState.sessionWalker();
      usageState.sessionHistory.push(next);
      if (usageState.sessionHistory.length > 60) usageState.sessionHistory.shift();
      usageState.sessionPct = next;

      if (Date.now() > usageState.weeklyResetAt) { usageState.weeklyResetAt = Date.now() + 7 * 24 * 3.6e6; usageState.weeklyPct = 0; }
      if (Date.now() > usageState.sessionResetAt) { usageState.sessionResetAt = Date.now() + 4 * 3.6e6; usageState.sessionPct = 0; usageState.sessionHistory = [0]; }

      const sPct = Math.round(usageState.sessionPct);
      const wPct = Math.round(usageState.weeklyPct);
      $("#sessionPct").textContent = sPct;
      $("#weeklyPct").textContent  = wPct;
      const sBar = $("#sessionBar"), wBar = $("#weeklyBar");
      sBar.style.width = sPct + "%"; sBar.dataset.status = barStatus(sPct);
      wBar.style.width = wPct + "%"; wBar.dataset.status = barStatus(wPct);

      $("#sessionReset").textContent = fmtDuration(Math.max(0, usageState.sessionResetAt - Date.now()));
      $("#weeklyReset").textContent  = fmtDuration(Math.max(0, usageState.weeklyResetAt - Date.now()));

      const hist = usageState.sessionHistory;
      const ago = hist[Math.max(0, hist.length - 6)];
      const cur = hist[hist.length - 1];
      const delta = cur - ago;
      const dEl = $("#sessionDelta");
      if (Math.abs(delta) < 0.3) dEl.textContent = "steady";
      else dEl.textContent = `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}% in 5m`;

      renderSpark($("#sessionSpark"), hist, { showAxis: true, showLast: true });
      renderTopModels();
    }
    function renderTopModels() {
      const list = $("#topModels");
      const total = usageState.topModels.reduce((s, m) => s + m.tokens, 0);
      list.innerHTML = usageState.topModels.map((m) => {
        const pct = (m.tokens / total) * 100;
        return `<li>
          <div class="row"><span class="name">${m.name}</span><span class="count">${fmtTokens(m.tokens)} tokens · ${pct.toFixed(1)}%</span></div>
          <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
        </li>`;
      }).join("");
    }

    /* CAPACITY */
    const capState = MODELS.map((m, i) => ({
      ...m, el: null,
      history: seedModelHistory(m.baseLoad),
      loadWalker: makeWalker({ start: m.baseLoad, lo: 5, hi: 100, step: 4 + (i % 3) }),
      latencyJitter: makeWalker({ start: m.baseLatency, lo: m.baseLatency * 0.6, hi: m.baseLatency * 1.6, step: m.baseLatency * 0.08 }),
      queue: 0, load: m.baseLoad, latency: m.baseLatency,
    }));
    function seedModelHistory(base) {
      const pts = []; let v = base;
      for (let i = 0; i < 30; i++) { v += (Math.random() - 0.5) * 8; v = clamp(v, 5, 100); pts.push(v); }
      return pts;
    }

    function buildCapacityCards() {
      const grid = $("#capacityGrid");
      const tpl = $("#capacityCardTpl");
      grid.innerHTML = "";
      capState.forEach((m) => {
        const node = tpl.content.firstElementChild.cloneNode(true);
        $(".model-name", node).textContent = m.name;
        $(".model-name", node).title = m.name;
        $(".model-size", node).textContent = m.size;
        $(".model-region", node).textContent = m.region;
        m.el = node; grid.appendChild(node);
      });
    }

    function tickCapacity({ animate = true } = {}) {
      let avail = 0, busy = 0, full = 0, latencySum = 0;
      capState.forEach((m) => {
        const newLoad = m.loadWalker();
        m.load = newLoad;
        m.history.push(newLoad);
        if (m.history.length > 30) m.history.shift();
        m.queue = newLoad < 70 ? 0 : Math.round(((newLoad - 70) / 30) * 18 + Math.random() * 3);
        const lf = newLoad / 100;
        m.latency = m.latencyJitter() * (1 + lf * lf * 1.2);
        latencySum += m.latency;
        const status = statusBucket(newLoad);
        if (status === "ok") avail++; else if (status === "busy") busy++; else full++;
        paintModelCap(m, status, animate);
      });
      paintBanner({ avail, busy, full, avgLatency: latencySum / capState.length });
      applyFilterAndSort();
    }
    function paintModelCap(m, status, animate) {
      const el = m.el; if (!el) return;
      const prev = el.dataset.status;
      el.dataset.status = status;
      $(".status-label", el).textContent = statusLabel(status);
      $(".load-pct", el).textContent = `${fmtPct(m.load)}%`;
      const bar = $(".load-bar", el);
      bar.style.width = m.load + "%";
      bar.dataset.status = barStatus(m.load);
      $(".model-latency", el).textContent = fmtMs(m.latency);
      $(".model-queue", el).textContent = m.queue === 0 ? "—" : `${m.queue}`;
      renderSpark($(".spark", el), m.history);
      if (animate && prev && prev !== status) {
        el.dataset.flash = "true";
        setTimeout(() => delete el.dataset.flash, 800);
      }
    }
    function paintBanner({ avail, busy, full, avgLatency }) {
      const banner = $("#systemBanner");
      const headline = $("#systemHeadline");
      const sub = $("#systemSub");
      let status = "ok";
      if (full >= 3) status = "bad";
      else if (full >= 1 || busy >= capState.length / 2) status = "warn";
      banner.dataset.status = status;
      headline.textContent = status === "ok" ? "All systems operational"
        : status === "warn" ? "Elevated load on some models"
        : "Multiple models at capacity";
      sub.textContent = `Average latency ${fmtMs(avgLatency)} across ${capState.length} models`;
      $("#statAvail").textContent = avail;
      $("#statBusy").textContent = busy;
      $("#statFull").textContent = full;
    }

    let activeFilter = "all", activeSort = "load";
    function applyFilterAndSort() {
      const sorted = [...capState].sort((a, b) => {
        switch (activeSort) {
          case "latency": return a.latency - b.latency;
          case "name":    return a.name.localeCompare(b.name);
          case "size":    return parseFloat(b.size) - parseFloat(a.size);
          default:        return a.load - b.load;
        }
      });
      sorted.forEach((m, i) => {
        m.el.style.order = i;
        const status = statusBucket(m.load);
        const visible = activeFilter === "all" || activeFilter === status;
        m.el.style.display = visible ? "" : "none";
      });
    }
    $$(".filters .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$(".filters .chip").forEach((c) => { c.classList.remove("active"); c.setAttribute("aria-selected","false"); });
        chip.classList.add("active"); chip.setAttribute("aria-selected","true");
        activeFilter = chip.dataset.filter;
        applyFilterAndSort();
      });
    });
    $("#sortSelect")?.addEventListener("change", (e) => { activeSort = e.target.value; applyFilterAndSort(); });

    /* bootstrap settings */
    buildCapacityCards();
    refreshUsage();
    tickCapacity({ animate: false });

    const usageRefresher = makeRefresher({
      intervalMs: 15_000,
      onTick: refreshUsage,
      countdownEl: $("#refreshCountdown"),
      toggleEl: $("#autoRefreshToggle"),
      dotEl: $("#liveDot"),
    });
    $("#refreshNow")?.addEventListener("click", () => usageRefresher.refreshNow());

    makeRefresher({
      intervalMs: 10_000,
      onTick: () => tickCapacity({ animate: true }),
      countdownEl: $("#capCountdown"),
      toggleEl: $("#capAutoToggle"),
      dotEl: $("#liveDot2"),
    });

    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input, textarea, select")) return;
      if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey) {
        const view = (location.hash || "#usage").slice(1);
        if (view === "usage") usageRefresher.refreshNow();
        else if (view === "capacity") tickCapacity({ animate: true });
      }
    });
  }

  /* ============================================================
     BOOTSTRAP
     ============================================================ */
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }
  ready(() => {
    mountShell();
    setupTheme();
    setupCopyButtons();
    setupPalette();

    const page = document.body.dataset.page;
    if (page === "home")     initHome();
    if (page === "library")  initLibrary();
    if (page === "model")    initModel();
    if (page === "settings") initSettings();
  });
})();
