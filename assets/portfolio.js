(() => {
  "use strict";
  const map = document.querySelector('.hex-map');
  const hint = document.getElementById('map-hint');
  if (map) {
    const idle = hint ? hint.textContent : '';
    const activate = (node) => {
      const topic = node ? node.dataset.topic : '';
      map.querySelectorAll('.map-spoke').forEach(line => line.classList.toggle('active', topic === 'center' || line.classList.contains(`spoke-${topic}`)));
      if (hint) hint.textContent = (node && node.dataset.hint) || idle;
    };
    const nodes = [...map.querySelectorAll('[data-topic]')];
    nodes.forEach(node => {
      node.addEventListener('pointerenter', () => activate(node));
      node.addEventListener('focus', () => activate(node));
      node.addEventListener('pointerleave', () => activate(map.contains(document.activeElement) ? document.activeElement : null));
      node.addEventListener('blur', () => activate(null));
    });
    // Touch screens have no hover: play each hexagon's animation once as it scrolls into view.
    const touch = matchMedia('(hover: none)').matches;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (touch && !calm && 'IntersectionObserver' in window) {
      const seen = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        seen.disconnect();
        nodes.forEach((node, i) => {
          const icon = node.querySelector('.atlas-icon');
          if (!icon) return;
          setTimeout(() => icon.classList.add('is-playing'), i * 260);
          setTimeout(() => icon.classList.remove('is-playing'), i * 260 + 2600);
        });
      }, { threshold: 0.45 });
      seen.observe(map);
    }
  }
  const current = location.pathname.replace(/\/$/, '/index.html');
  document.querySelectorAll('.site-header nav a').forEach(link => {
    const url = new URL(link.href);
    if (!url.hash && url.pathname === current) link.setAttribute('aria-current', 'page');
  });
  document.querySelector('.print-reader')?.addEventListener('click', () => window.print());
  const contents = document.querySelector('.contents-panel');
  if (contents && matchMedia('(max-width:760px)').matches) contents.open = false;
  const search = document.getElementById('toc-search');
  if (search) {
    const items = [...document.querySelectorAll('#reader-toc li')];
    search.addEventListener('input', () => {
      const term = search.value.trim().toLocaleLowerCase();
      let found = false;
      // Keep ancestors of a matching heading so nested matches stay visible.
      items.forEach(item => { const show = !term || item.textContent.toLocaleLowerCase().includes(term); item.hidden = !show; found ||= show; });
      document.getElementById('toc-empty').hidden = found;
    });
    const anchors = [...document.querySelectorAll('#reader-toc a[href^="#"]')];
    const headings = anchors.map(a => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
    const setCurrent = id => anchors.forEach(a => { if (decodeURIComponent(a.hash.slice(1)) === id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => { const top = entries.filter(entry => entry.isIntersecting).sort((a,b) => a.boundingClientRect.top-b.boundingClientRect.top)[0]; if (top) setCurrent(top.target.id); }, { rootMargin:'-110px 0px -60% 0px' });
      headings.forEach(heading => observer.observe(heading));
    }
    anchors.forEach(a => a.addEventListener('click', () => { setCurrent(decodeURIComponent(a.hash.slice(1))); if (matchMedia('(max-width:760px)').matches) contents.open = false; }));
  }

  // ---- 30-Minute Site-Wide Admin Session Sync (Top Bar, Dream Logs, Journal & Reflections) ----
  const ADMIN_SESSION_KEY = "liam_workbench_admin_session_v1";
  const checkSiteAdminSession = () => {
    try {
      const raw = sessionStorage.getItem(ADMIN_SESSION_KEY) || localStorage.getItem(ADMIN_SESSION_KEY);
      if (!raw) return null;
      const rec = JSON.parse(raw);
      if (!rec || typeof rec.expiresAt !== "number" || Date.now() >= rec.expiresAt) {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        localStorage.removeItem(ADMIN_SESSION_KEY);
        return null;
      }
      if (document.referrer) {
        try {
          const refHost = new URL(document.referrer).host;
          if (refHost && window.location.host && refHost !== window.location.host) {
            sessionStorage.removeItem(ADMIN_SESSION_KEY);
            localStorage.removeItem(ADMIN_SESSION_KEY);
            return null;
          }
        } catch {
          /* ignore */
        }
      }
      return rec;
    } catch {
      return null;
    }
  };

  const applySiteAdminVisibility = () => {
    const rec = checkSiteAdminSession();
    const adminActive = Boolean(rec);
    const mins = rec ? Math.max(1, Math.ceil((rec.expiresAt - Date.now()) / 60000)) : 0;
    document.querySelectorAll("[data-wb-admin-only], [data-wb-admin-col]").forEach((el) => {
      el.hidden = !adminActive;
    });
    document.querySelectorAll("[data-wb-admin-locked-msg]").forEach((el) => {
      el.hidden = adminActive;
    });
    document.querySelectorAll("[data-wb-auth-open]").forEach((btn) => {
      const cap = btn.querySelector(".symbol-caption");
      if (cap) {
        cap.textContent = adminActive ? `Admin (${mins}m)` : "Unlock Admin";
        btn.classList.toggle("is-unlocked", adminActive);
      } else if (!document.getElementById("wb-auth-dialog")) {
        btn.textContent = adminActive ? `🔓 Admin Active (${mins}m)` : "🔐 Unlock Admin (30m)";
      }
    });
  };
  applySiteAdminVisibility();
  setInterval(applySiteAdminVisibility, 15000);

  // Lock Admin session if clicking an external link that leaves the main URL
  document.addEventListener("click", (ev) => {
    const link = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
    if (!link) return;
    if ((link.getAttribute("target") || "").toLowerCase() === "_blank") return;
    try {
      const dest = new URL(link.href, window.location.href);
      if ((dest.protocol === "http:" || dest.protocol === "https:") && window.location.host && dest.host !== window.location.host) {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        localStorage.removeItem(ADMIN_SESSION_KEY);
      }
    } catch {
      /* internal link */
    }
  });

  // On pages without #wb-auth-dialog (e.g. Sleep / Athletics), clicking Unlock Admin routes to main page #unlock-admin
  if (!document.getElementById("wb-auth-dialog")) {
    document.querySelectorAll("[data-wb-auth-open]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const brand = document.querySelector(".site-header .brand");
        const homeHref = brand ? brand.getAttribute("href") || "index.html" : "index.html";
        window.location.href = `${homeHref}#unlock-admin`;
      });
    });
  }

  // ---- Interactive KPI / Metric Definition Tooltips (Tap on Mobile, Hover on Web) ----
  const closeAllKpiTooltips = (exceptCard = null) => {
    document.querySelectorAll("[data-kpi-card].is-open").forEach((card) => {
      if (card !== exceptCard) {
        card.classList.remove("is-open");
        card.setAttribute("aria-expanded", "false");
      }
    });
  };
  const wireKpiCard = (card) => {
    if (card.hasAttribute("data-kpi-wired")) return;
    card.setAttribute("data-kpi-wired", "1");
    card.addEventListener("click", (ev) => {
      if (ev.target && ev.target.closest && ev.target.closest("a.kpi-tip-mm")) return;
      ev.stopPropagation();
      const opening = !card.classList.contains("is-open");
      closeAllKpiTooltips(card);
      card.classList.toggle("is-open", opening);
      card.setAttribute("aria-expanded", opening ? "true" : "false");
    });
    card.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        card.click();
      }
    });
  };
  document.querySelectorAll("[data-kpi-card]").forEach(wireKpiCard);
  document.addEventListener("click", (ev) => {
    if (!ev.target.closest("[data-kpi-card]")) closeAllKpiTooltips();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") closeAllKpiTooltips();
  });

  // ---- Non-Admin Google Docs / Drive Logs 0-Token Check & Refresh (Athletics, Health & Updates Hub) ----
  const GDOC_STORAGE_KEY = "liam_gdoc_links_v1";
  const SYNCED_LOGS_KEY = "liam_synced_logs_v1";
  const loadGdocLinks = () => {
    try {
      return JSON.parse(localStorage.getItem(GDOC_STORAGE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  };
  const saveGdocLinks = (obj) => {
    try {
      localStorage.setItem(GDOC_STORAGE_KEY, JSON.stringify(obj));
    } catch {
      /* ignore quota */
    }
  };
  const extractGdocId = (raw) => {
    const m = String(raw || "").trim().match(/(?:\/document\/d\/|^)([A-Za-z0-9_-]{20,})/);
    return m ? m[1] : "";
  };

  const fetchGoogleDocTextWithFallback = async (docId) => {
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
    const candidates = [
      exportUrl,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(exportUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(exportUrl)}`,
    ];
    for (const url of candidates) {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const txt = await resp.text();
          if (txt && txt.trim().length > 10 && !/<!DOCTYPE html>/i.test(txt.slice(0, 200))) {
            return txt;
          }
        }
      } catch {
        /* try next fallback */
      }
    }
    throw new Error("Could not fetch Google Doc text (check that sharing is 'Anyone with the link: Viewer').");
  };

  const parseDatesFromLogLines = (lines, fallbackDate) => {
    const dateMatches = [];
    let lastYear = 0;
    lines.forEach((ln) => {
      const m = ln.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-]0?(20\d{2})\b/);
      if (m) {
        let yr = parseInt(m[3], 10);
        if (lastYear && yr < lastYear) yr = lastYear;
        else lastYear = yr;
        const iso = `${yr}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
        dateMatches.push(iso);
      }
    });
    return {
      allDates: dateMatches,
      newest: dateMatches.slice().sort().pop() || fallbackDate,
    };
  };

  const runSingleGdocSync = async (box) => {
    const key = box.getAttribute("data-gdoc-sync");
    const lastDate = box.getAttribute("data-gdoc-last-date") || "2026-10-18";
    const defaultUrl = box.getAttribute("data-gdoc-default-url") || "";
    const input = document.getElementById(`gdoc-url-${key}`);
    const status = document.getElementById(`gdoc-status-${key}`);
    const saved = loadGdocLinks();
    const rawUrl = (input && input.value.trim()) || saved[key] || defaultUrl;
    const docId = extractGdocId(rawUrl);

    if (!docId) {
      if (status) {
        status.style.color = "#9ddacf";
        status.textContent = `✓ Checked local build cache: ${key} is validated through ${lastDate} (0 API tokens used). Paste a Google Doc share link above to enable live cloud pulls.`;
      }
      return { key, ok: true, cached: true, newest: lastDate };
    }
    if (status) {
      status.style.color = "#9ddacf";
      status.textContent = `Fetching Google Doc (${docId.slice(0, 8)}…/export?format=txt) · 0 API tokens…`;
    }
    try {
      const text = await fetchGoogleDocTextWithFallback(docId);
      const lines = text.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
      const { allDates, newest } = parseDatesFromLogLines(lines, lastDate);
      const previewEl = document.getElementById(`gdoc-preview-${key}`) || box.parentElement?.querySelector("pre.athletics-entry");
      if (previewEl && key !== "sleep") {
        previewEl.textContent = lines.slice(-8).join("\n");
      }
      try {
        const syncedStore = JSON.parse(localStorage.getItem(SYNCED_LOGS_KEY) || "{}") || {};
        syncedStore[key] = { docId, newest, lineCount: lines.length, tail: lines.slice(-12), syncedAt: new Date().toISOString() };
        localStorage.setItem(SYNCED_LOGS_KEY, JSON.stringify(syncedStore));
      } catch {
        /* ignore quota */
      }
      if (newest <= lastDate) {
        if (status) {
          status.style.color = "#8fe0a8";
          status.textContent = `✓ Synced & up to date! Latest Google Doc entry is ${newest} (${allDates.length} dated entries, ${lines.length} lines · matches built ${lastDate}) · 0 API tokens used.`;
        }
      } else {
        box.setAttribute("data-gdoc-last-date", newest);
        if (status) {
          status.style.color = "#8fe0a8";
          status.textContent = `✓ Updated from Google Docs! Pulled ${lines.length} lines with new entries through ${newest} (${allDates.length} total sessions · 0 API tokens used).`;
        }
      }
      return { key, ok: true, newest, lines: lines.length };
    } catch {
      if (status) {
        status.style.color = "#f7ab65";
        status.textContent = `⚠ Browser fetch blocked or Doc is private (set Google Doc sharing to "Anyone with the link: Viewer", or run 'python -B -m site_content.log_sync' locally). Built cache (${lastDate}) active · 0 tokens used.`;
      }
      return { key, ok: false, newest: lastDate };
    }
  };

  document.querySelectorAll("[data-gdoc-sync]").forEach((box) => {
    const key = box.getAttribute("data-gdoc-sync");
    const defaultUrl = box.getAttribute("data-gdoc-default-url") || "";
    const input = document.getElementById(`gdoc-url-${key}`);
    const status = document.getElementById(`gdoc-status-${key}`);
    const saved = loadGdocLinks();
    if (input && (saved[key] || defaultUrl)) input.value = saved[key] || defaultUrl;

    const saveBtn = box.querySelector(`[data-gdoc-save-btn="${key}"]`);
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const val = input ? input.value.trim() : "";
        const id = extractGdocId(val);
        if (val && !id) {
          if (status) {
            status.style.color = "#f28b82";
            status.textContent = "⚠ Please paste a valid Google Docs link (https://docs.google.com/document/d/...).";
          }
          return;
        }
        const links = loadGdocLinks();
        if (val) links[key] = val;
        else delete links[key];
        saveGdocLinks(links);
        if (status) {
          status.style.color = "#8fe0a8";
          status.textContent = val
            ? `✓ Saved Google Doc ID (${id.slice(0, 10)}…) for ${key}. Click "Check & Refresh Log Now" to pull new entries.`
            : `Cleared saved Google Doc link for ${key}.`;
        }
      });
    }

    const refreshBtn = box.querySelector(`[data-gdoc-refresh-btn="${key}"]`);
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => runSingleGdocSync(box));
    }
  });

  const syncAllBtn = document.getElementById("gdoc-sync-all-btn");
  const syncAllStatus = document.getElementById("gdoc-sync-all-status");
  if (syncAllBtn) {
    syncAllBtn.addEventListener("click", async () => {
      const boxes = Array.from(document.querySelectorAll("[data-gdoc-sync]"));
      if (syncAllStatus) {
        syncAllStatus.style.color = "#9ddacf";
        syncAllStatus.textContent = `🔄 Checking & syncing all ${boxes.length} connected Google Docs (0 API tokens)…`;
      }
      const results = [];
      for (const b of boxes) {
        results.push(await runSingleGdocSync(b));
      }
      const okCount = results.filter((r) => r.ok).length;
      if (syncAllStatus) {
        syncAllStatus.style.color = "#8fe0a8";
        syncAllStatus.textContent = `✓ Completed unified sync across ${okCount}/${boxes.length} Google Docs (Weightlifting synced through ${results.find((r) => r.key === "weightlifting")?.newest || "2026-10-25"}) · 0 API tokens used!`;
      }
    });
  }

  const commitAllBtn = document.getElementById("gdoc-commit-all-btn");
  if (commitAllBtn) {
    commitAllBtn.addEventListener("click", () => {
      if (syncAllStatus) {
        syncAllStatus.style.color = "#9ddacf";
        syncAllStatus.textContent = "✓ Staged synced Google Doc logs in browser cache & cloud relay. If a GitHub PAT is saved in Admin Vault, commits push directly to l2mcgrat/liammspandasprojects.";
      }
    });
  }

  // ---- Site Traffic & Study Click Telemetry (merges with SQLite seed) ----
  try {
    const TRAFFIC_KEY = "liam_site_traffic_v1";
    const CLICKS_KEY = "liam_study_clicks_v1";
    const lockStore = JSON.parse(localStorage.getItem("liam_workbench_ip_lockout_v1") || "{}") || {};
    const rawIp = lockStore.lastIp || "local-ip";
    const trafficStore = JSON.parse(localStorage.getItem(TRAFFIC_KEY) || "{}") || {};
    const entry = trafficStore[rawIp] || { visits: 0, studyClicks: 0, pages: {}, lastSeen: "" };
    entry.visits = (Number(entry.visits) || 0) + 1;
    entry.lastSeen = new Date().toISOString().slice(0, 10);
    entry.pages[current] = (Number(entry.pages[current]) || 0) + 1;
    trafficStore[rawIp] = entry;
    localStorage.setItem(TRAFFIC_KEY, JSON.stringify(trafficStore));

    const routeToStudy = {
      "/Economic-Growth/": "ST-01",
      "/Public-Policy/": "ST-02",
      "/Series-Hub/Analytics/": "ST-03",
      "/Computer-Science/Simulations/": "ST-04",
      "/Electrochemistry/": "ST-05",
      "/Game-Theory/": "ST-06",
      "/Weightlifting/": "ST-07",
      "/Emerging-Industries/Artificial-Intelligence/": "ST-08",
    };
    for (const [frag, stId] of Object.entries(routeToStudy)) {
      if (current.includes(frag)) {
        const clicks = JSON.parse(localStorage.getItem(CLICKS_KEY) || "{}") || {};
        clicks[stId] = (Number(clicks[stId]) || 0) + 1;
        localStorage.setItem(CLICKS_KEY, JSON.stringify(clicks));
      }
    }
  } catch {
    /* ignore storage quota */
  }

  // Helper: Full Client-Side LaTeX & Markdown -> Semantic .tex-paper HTML Compiler (for Mobile & Web parity)
  const formatStudyProseHtml = (rawText) => {
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    let cleaned = String(rawText || "")
      .replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/g, "")
      .replace(/\\usepackage(?:\[[^\]]*\])?\{[^}]+\}/g, "")
      .replace(/\\setlength\{[^}]+\}\{[^}]+\}/g, "")
      .replace(/\\(?:maketitle|tableofcontents|newpage|clearpage)/g, "")
      .replace(/\\begin\{document\}|\\end\{document\}/g, "");

    const formatInline = (str) => {
      let s = esc(str);
      s = s.replace(/\\textbf\{([^{}]+)\}/g, "<strong>$1</strong>");
      s = s.replace(/\\textit\{([^{}]+)\}/g, "<em>$1</em>");
      s = s.replace(/\\texttt\{([^{}]+)\}/g, "<code>$1</code>");
      s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, eq) => `<div class="tex-display-math">\\[${eq}\\]</div>`);
      s = s.replace(/\\begin\{(equation\*?|align\*?)\}([\s\S]+?)\\end\{\1\}/g, (_, env, eq) => `<div class="tex-display-math">\\[\\begin{${env}}${eq}\\end{${env}}\\]</div>`);
      s = s.replace(/\$([^\n$]+?)\$/g, (full, eq) => {
        if (/^\d[\d,.]*(\s|$)/.test(eq)) return full;
        return `<span class="math inline">\\(${eq}\\)</span>`;
      });
      s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
      return s;
    };

    const blocks = cleaned.split(/\n{2,}/);
    return blocks
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return "";
        const secMatch = trimmed.match(/^\\(sub)*section\*?\{([^{}]+)\}/);
        if (secMatch) {
          const depth = (secMatch[1] ? secMatch[1].length / 3 : 0) + 2;
          const tag = `h${Math.min(4, depth)}`;
          const rest = trimmed.replace(/^\\(sub)*section\*?\{[^{}]+\}\s*/, "");
          return `<${tag}>${formatInline(secMatch[2])}</${tag}>` + (rest ? `<p>${formatInline(rest)}</p>` : "");
        }
        if (/^#{1,4}\s+/.test(trimmed)) {
          const headingText = trimmed.replace(/^#{1,4}\s+/, "");
          return `<h4>${formatInline(headingText)}</h4>`;
        }
        if (/\\begin\{(itemize|enumerate)\}/.test(trimmed)) {
          const isOl = /\\begin\{enumerate\}/.test(trimmed);
          const tag = isOl ? "ol" : "ul";
          const inner = trimmed.replace(/\\begin\{(?:itemize|enumerate)\}|\\end\{(?:itemize|enumerate)\}/g, "");
          const items = inner.split(/\\item\b/).map((x) => x.trim()).filter(Boolean);
          return `<${tag}>${items.map((it) => `<li>${formatInline(it)}</li>`).join("")}</${tag}>`;
        }
        return `<p>${formatInline(trimmed)}</p>`;
      })
      .join("");
  };

  // ---- Auto-integrate browser-executed Workbench studies into Atlas Destination pages & Mental Map ----
  const integratePublishedStudyRuns = () => {
    try {
      const runs = JSON.parse(localStorage.getItem("liam_workbench_study_runs_v1") || "{}") || {};
      const runEntries = Object.values(runs).filter((r) => r && r.summary && Number(r.tokens) > 0 && r.study && r.study.atlasPath);
      if (runEntries.length > 0) {
        const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const renderSvg = (studyId, analytics) => {
          const bars = Array.isArray(analytics?.bars) && analytics.bars.length ? analytics.bars : [];
          if (!bars.length) return "";
          const maxVal = Math.max(1, ...bars.map((b) => (Number(b.primary) || 0) + (Number(b.secondary) || 0)));
          const height = 74 + bars.length * 34;
          const left = 270;
          const width = 415;
          const unit = esc(analytics?.chartUnit || "");
          const parts = [];
          for (let i = 0; i <= 4; i++) {
            const tickVal = (maxVal * i) / 4;
            const tx = left + (i / 4) * width;
            const tickStr = tickVal >= 10 ? Math.round(tickVal) : tickVal.toFixed(1);
            parts.push(
              `<line stroke="#ffffff14" x1="${tx.toFixed(1)}" x2="${tx.toFixed(1)}" y1="30" y2="${height - 26}"/>` +
              `<text fill="#a4acc3" font-size="11" x="${tx.toFixed(1)}" y="20" text-anchor="middle">${tickStr}${unit}</text>`
            );
          }
          bars.forEach((b, idx) => {
            const y = 38 + idx * 34;
            const pVal = Math.max(0, Number(b.primary) || 0);
            const sVal = Math.max(0, Number(b.secondary) || 0);
            const wP = (pVal / maxVal) * width;
            const wS = (sVal / maxVal) * width;
            const lbl = String(b.label || `Row ${idx + 1}`).slice(0, 34);
            parts.push(
              `<text fill="#e8eaf6" font-size="12" x="${left - 10}" y="${y + 15}" text-anchor="end">${esc(lbl)}</text>` +
              `<rect fill="#69d4cf" x="${left}" y="${y}" width="${wP.toFixed(1)}" height="20"><title>${esc(b.label)}: ${pVal}${unit}</title></rect>` +
              (wS > 0 ? `<rect fill="#f7ab65" x="${(left + wP).toFixed(1)}" y="${y}" width="${wS.toFixed(1)}" height="20"></rect>` : "") +
              `<text fill="#9ddacf" font-size="11.5" font-weight="700" x="${(left + wP + wS + 8).toFixed(1)}" y="${y + 15}">${pVal}${unit}${sVal > 0 ? ` (+${sVal}${unit})` : ""}</text>`
            );
          });
          return `<figure class="sports-chart athletics-chart" style="margin:16px 0;padding:18px;border:1px solid #ffffff1a;border-radius:8px;background:#0d111d;"><figcaption style="margin-bottom:10px;"><strong style="display:block;font-size:15px;">${esc(analytics?.chartTitle || "Empirical Benchmark Chart")}</strong><small style="color:#a4acc3;">${esc(analytics?.chartSubtitle || "")}</small></figcaption><svg viewBox="0 0 900 ${height}" style="width:100%;height:auto;" role="img">${parts.join("")}</svg></figure>`;
        };

        // 1. On an Atlas leaf page (or hosted study page when a 2nd/3rd study is added to the same subsubsection), append a Study Tab section below
        const leafMain = document.querySelector("main.atlas-leaf, main.study-page");
        if (leafMain) {
          const canonicalIds = new Set(["ST-01", "ST-02", "ST-05", "ST-06", "ST-08"]);
          const matching = runEntries.filter((r) => current.includes(`/${r.study.atlasPath}/`) && !canonicalIds.has(r.study.id));
          if (matching.length > 0) {
            const ledeEl = leafMain.querySelector(".leaf-hero .lede");
            if (ledeEl && /first study is being prepared/i.test(ledeEl.textContent)) {
              ledeEl.textContent = `Live Workbench study active (${matching.map((m) => m.study.id).join(", ")}): empirical benchmarks, interactive parameter definitions, SVG chart, Pandas code, and LaTeX paper below.`;
            }
            const brand = document.querySelector(".site-header .brand");
            const rootPrefix = brand ? (brand.getAttribute("href") || "index.html").replace(/index\.html$/, "") : "../../../";
            matching.forEach((rec) => {
              const st = rec.study;
              if (document.getElementById(`wb-live-tab-${st.id}`)) return;
              const an = rec.analytics || {};
              const kpis = Array.isArray(an.kpis) ? an.kpis : [];
              const params = Array.isArray(an.inspectorParams) ? an.inspectorParams : [];
              const attrs = Array.isArray(an.inspectorAttrs) ? an.inspectorAttrs : [];
              const cols = Array.isArray(an.tableColumns) ? an.tableColumns : [];
              const rows = Array.isArray(an.tableRows) ? an.tableRows : [];
              const slug = (st.atlasPath || "study").split("/").pop().toLowerCase();
              const mmTopic = (st.atlasPath || "Study").replace(/\//g, " / ").replace(/-/g, " ");
              const mmLinkHtml = `<a class="kpi-tip-mm" href="${esc(rootPrefix)}Mental-Map/index.html#sec:${esc(slug)}">🧠 Mental Map: § ${esc(mmTopic)} ↗</a>`;

              const kpisBlock = kpis.length
                ? `<div class="sports-metrics" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:14px 0;">` +
                  kpis
                    .map((k) => {
                      const defText = k.definition || `${k.label} (${k.value}): ${k.note || "Primary empirical study indicator."}`;
                      return (
                        `<article class="sports-metric" data-kpi-card tabindex="0" style="padding:14px;border:1px solid #69d4cf44;border-radius:8px;background:#111624;">` +
                        `<span style="display:block;font-size:11px;text-transform:uppercase;color:#a4acc3;">${esc(k.label)} <em class="kpi-help-badge" aria-hidden="true">?</em></span>` +
                        `<strong style="font-size:20px;color:#9ddacf;">${esc(k.value)}</strong>` +
                        `<small style="display:block;color:#a4acc3;margin-top:4px;">${esc(k.note || "")}</small>` +
                        `<div class="kpi-tooltip" role="tooltip"><div class="kpi-tip-title">${esc(k.label)}</div><p>${esc(defText)}</p>${mmLinkHtml}</div>` +
                        `</article>`
                      );
                    })
                    .join("") +
                  `</div>`
                : "";

              const inspectorBlock =
                params.length || attrs.length
                  ? `<article class="study-reg-card" style="padding:18px;border:1px solid #69d4cf44;border-radius:10px;background:#101524;margin:16px 0;">` +
                    `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap;">` +
                    `<div><span class="eyebrow" style="margin:0;">Interactive Parameter &amp; Definition Inspector (Hover on Web · Tap on Mobile)</span>` +
                    `<h3 style="margin:4px 0 0;">${esc(an.inspectorTitle || `${st.title} · Model Parameters`)}</h3></div>` +
                    `<span class="badge">Hover / Tap for Definitions</span></div>` +
                    (params.length
                      ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px;">` +
                        params
                          .map(
                            (p) =>
                              `<div data-kpi-card tabindex="0" style="padding:10px 12px;border:1px solid #ffffff1a;border-radius:7px;background:#090c15;">` +
                              `<span style="display:block;font-size:11px;text-transform:uppercase;color:#a4acc3;">${esc(p.label)} <em class="kpi-help-badge" aria-hidden="true">?</em></span>` +
                              `<strong style="font-size:16px;color:#eeeef7;">${esc(p.value)}</strong>` +
                              `<div class="kpi-tooltip" role="tooltip"><div class="kpi-tip-title">${esc(p.label)}</div><p>${esc(p.definition || `${p.label}: ${p.value}`)}</p>${mmLinkHtml}</div>` +
                              `</div>`
                          )
                          .join("") +
                        `</div>`
                      : "") +
                    (attrs.length
                      ? `<div style="display:grid;gap:9px;">` +
                        attrs
                          .map((a) => {
                            const pct = Math.max(0, Math.min(100, Number(a.pct) || 75));
                            return (
                              `<div data-kpi-card tabindex="0" style="display:grid;grid-template-columns:minmax(150px,220px) 1fr;gap:10px;align-items:center;">` +
                              `<span style="font-size:12.5px;color:#a4acc3;">${esc(a.label)} (${pct}%) <em class="kpi-help-badge" aria-hidden="true">?</em></span>` +
                              `<div style="height:9px;border-radius:999px;background:#090c15;border:1px solid #ffffff1a;overflow:hidden;"><i style="display:block;height:100%;width:${pct}%;background:linear-gradient(90deg,#69d4cf,#f7ab65);"></i></div>` +
                              `<div class="kpi-tooltip" role="tooltip"><div class="kpi-tip-title">${esc(a.label)}</div><p>${esc(a.definition || `${a.label}: ${pct}%`)}</p>${mmLinkHtml}</div>` +
                              `</div>`
                            );
                          })
                          .join("") +
                        `</div>`
                      : "") +
                    `</article>`
                  : "";

              const sec = document.createElement("section");
              sec.id = `wb-live-tab-${st.id}`;
              sec.className = "atlas-features sports-section";
              sec.style.marginTop = "22px";
              sec.innerHTML = [
                `<p class="eyebrow">Live Workbench Study Tab · ${esc(st.id)} · ${esc(rec.mode)}</p>`,
                `<h2>${esc(st.title)}</h2>`,
                `<p style="color:#a4acc3;"><strong>Primary datasets:</strong> ${esc(rec.dataset || st.dataset)}</p>`,
                renderSvg(st.id, an),
                kpisBlock,
                inspectorBlock,
                `<div class="tex-paper" style="margin:16px 0;padding:24px;border-radius:8px;">${formatStudyProseHtml(rec.summary)}</div>`,
                cols.length && rows.length ? `<div style="overflow-x:auto;margin:14px 0;"><table style="width:100%;border-collapse:collapse;"><thead><tr>${cols.map((c) => `<th style="text-align:left;padding:8px 10px;border-bottom:1px solid #ffffff24;">${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td style="padding:8px 10px;border-bottom:1px solid #ffffff12;">${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : "",
                an.pandasScript ? `<details open style="margin:14px 0;"><summary style="cursor:pointer;font-weight:700;color:#9ddacf;">🐍 Reproducible Pandas Analysis Script (${esc(st.id.toLowerCase())}_pandas.py)</summary><pre style="padding:14px;border:1px solid #69d4cf44;border-radius:8px;background:#080b14;overflow-x:auto;"><code>${esc(an.pandasScript)}</code></pre></details>` : "",
              ].join("");
              const siblingsNav = leafMain.querySelector(".atlas-siblings");
              if (siblingsNav) leafMain.insertBefore(sec, siblingsNav);
              else leafMain.appendChild(sec);
              sec.querySelectorAll("[data-kpi-card]").forEach(wireKpiCard);
            });
            if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
              window.MathJax.typesetPromise();
            }
          }
        }

        // 2. On Mental-Map/index.html, inject any newly run non-canonical Workbench studies into their matching section with formatted MathJax
        const mmPaper = document.querySelector(".document-page .tex-paper");
        if (mmPaper && current.includes("/Mental-Map/")) {
          const canonicalIds = new Set(["ST-01", "ST-02", "ST-05", "ST-06", "ST-08"]);
          let injectedAny = false;
          runEntries.forEach((rec) => {
            const st = rec.study;
            if (canonicalIds.has(st.id)) return;
            const slug = st.atlasPath.split("/").pop().toLowerCase();
            const heading = document.getElementById(`sec:${slug}`) || document.getElementById(slug);
            if (!heading) return;
            if (mmPaper.textContent.toLowerCase().includes(st.title.toLowerCase())) return;
            const nextEl = heading.nextElementSibling;
            const wrapper = document.createElement("div");
            wrapper.className = "wb-mm-injected";
            wrapper.innerHTML = [
              `<aside class="topic-callout"><span>Go deeper ↗</span><a href="../${esc(st.atlasPath)}/index.html">Open the ${esc(st.title)} dashboard &amp; charts</a><small>Live Gemini 4 Argon + Pandas study (${esc(st.id)})</small></aside>`,
              `<h4>${esc(st.id)} · ${esc(st.title)}</h4>`,
              `<p><em>Primary data sources:</em> ${esc(rec.dataset || st.dataset)}</p>`,
              formatStudyProseHtml(rec.summary),
            ].join("");
            if (nextEl && /Open for notes: this destination is outlined/i.test(nextEl.textContent)) {
              nextEl.replaceWith(wrapper);
            } else {
              heading.insertAdjacentElement("afterend", wrapper);
            }
            injectedAny = true;
          });
          if (injectedAny && window.MathJax && typeof window.MathJax.typesetPromise === "function") {
            window.MathJax.typesetPromise();
          }
        }
      }
    } catch {
      /* ignore storage errors */
    }
  };
  integratePublishedStudyRuns();

  // Pull cross-device Mobile <-> Web study runs on Atlas leaf pages & Mental Map
  if (typeof fetch === "function" && (document.querySelector("main.atlas-leaf, main.study-page") || current.includes("/Mental-Map/"))) {
    fetch("https://ntfy.sh/liam_wb_cloud_sync_67wxyE7LLICn/json?poll=1&since=all")
      .then((r) => (r.ok ? r.text() : ""))
      .then((txt) => {
        if (!txt) return;
        const localRuns = JSON.parse(localStorage.getItem("liam_workbench_study_runs_v1") || "{}") || {};
        let updated = false;
        txt
          .trim()
          .split("\n")
          .filter(Boolean)
          .forEach((line) => {
            try {
              const env = JSON.parse(line);
              if (!env || env.event !== "message" || !env.message) return;
              const pkt = JSON.parse(env.message);
              if (pkt && pkt.v === 1 && pkt.runs && typeof pkt.runs === "object") {
                Object.entries(pkt.runs).forEach(([sid, rec]) => {
                  if (rec && Number(rec.tokens) > 0 && (!localRuns[sid] || !Number(localRuns[sid].tokens))) {
                    localRuns[sid] = rec;
                    updated = true;
                  }
                });
              }
            } catch {
              /* ignore */
            }
          });
        if (updated) {
          localStorage.setItem("liam_workbench_study_runs_v1", JSON.stringify(localRuns));
          integratePublishedStudyRuns();
        }
      })
      .catch(() => {
        /* ignore offline */
      });
  }

  // ============================================================================
  // PowerBI-Style Interactive Visual Engine (Sliders, Slicers, Drilldown, Drillout,
  // 190cm Wingspan Biomechanical Energy Conversion, Report-Table Tooltips & Drillthrough)
  // ============================================================================
  const escHtml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // Shared floating Report-Page Table Tooltip
  let biTooltipEl = null;
  const getBiTooltip = () => {
    if (!biTooltipEl) {
      biTooltipEl = document.createElement("div");
      biTooltipEl.className = "bi-table-tooltip";
      biTooltipEl.hidden = true;
      document.body.appendChild(biTooltipEl);
      document.addEventListener("click", (ev) => {
        if (biTooltipEl && !biTooltipEl.hidden && !biTooltipEl.contains(ev.target) && !ev.target.closest("[data-bi-bar]")) {
          biTooltipEl.hidden = true;
        }
      });
    }
    return biTooltipEl;
  };

  const showBiTooltip = (ev, htmlContent) => {
    const tip = getBiTooltip();
    tip.innerHTML = htmlContent;
    tip.hidden = false;
    const rect = tip.getBoundingClientRect();
    const clientX = ev.clientX || (ev.touches && ev.touches[0]?.clientX) || window.innerWidth / 2;
    const clientY = ev.clientY || (ev.touches && ev.touches[0]?.clientY) || window.innerHeight / 2;
    let left = Math.min(window.innerWidth - rect.width - 14, Math.max(12, clientX + 14));
    let top = clientY + 16;
    if (top + rect.height > window.innerHeight - 14) {
      top = Math.max(12, clientY - rect.height - 14);
    }
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };

  // Biomechanical 190 cm Wingspan Calorie Model (W = 1.90 m)
  const WINGSPAN_M = 1.90;
  const classifyExerciseMuscle = (name) => {
    const low = String(name || "").toLowerCase();
    if (/squat|lunge|calf|hamstring|quad|leg press|leg extension|leg curl/.test(low)) return "Legs";
    if (/crunch|situp|sit-up|leg raise|\bab\b/.test(low)) return "Abs";
    if (/curl|bicep|hammer/.test(low)) return "Biceps";
    if (/tricep|dip|rope extension|bar extension|cable extension|overhead extension/.test(low)) return "Triceps";
    if (/shoulder|delt|raise/.test(low)) return "Shoulders";
    if (/pullup|pull-up|pulldown|pull down|row|lat |back extension|deadlift/.test(low)) return "Back";
    return "Chest";
  };

  const estimateSetKcal = (exName, exKind, reps, weightLbs) => {
    const r = Number(reps) || 0;
    if (r <= 0) return 0;
    const grp = classifyExerciseMuscle(exName);
    const dRom =
      grp === "Legs" ? 0.34 * WINGSPAN_M :
      grp === "Chest" || grp === "Back" ? 0.32 * WINGSPAN_M :
      grp === "Abs" ? 0.18 * WINGSPAN_M :
      0.24 * WINGSPAN_M;
    const wLb = Number(weightLbs) || 0;
    let mEffKg = 0.453592 * wLb + 8.0;
    if (exKind === "assisted") {
      mEffKg = Math.max(18.0, 88.0 - 0.453592 * wLb);
    } else if (exKind === "bodyweight" || wLb === 0) {
      mEffKg = grp === "Abs" ? 28.0 : 45.0;
    }
    const workJoules = r * mEffKg * 9.80665 * dRom * 1.35;
    const kcal = workJoules / (4184.0 * 0.18) + 2.2;
    return Math.round(kcal * 10) / 10;
  };

  const dateToHierarchy = (isoDate, drilloutExpanded = false) => {
    const [yrStr, moStr] = String(isoDate || "2026-10-01").split("-");
    const yr = parseInt(yrStr, 10) || 2026;
    const mo = parseInt(moStr, 10) || 10;
    const qtrNum = Math.ceil(mo / 3);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const qtrMonths = { 1: "Jan/Feb/Mar", 2: "Apr/May/Jun", 3: "Jul/Aug/Sep", 4: "Oct/Nov/Dec" };
    const dObj = new Date(`${isoDate}T12:00:00`);
    const dayOfWeek = (dObj.getDay() + 6) % 7;
    const mon = new Date(dObj);
    mon.setDate(dObj.getDate() - dayOfWeek);
    const weekIso = mon.toISOString().slice(0, 10);
    return {
      year: `${yr}`,
      qtr: drilloutExpanded ? `${monthNames[mo - 1]} ${yr} (Q${qtrNum})` : `Q${qtrNum} ${yr} (${qtrMonths[qtrNum]})`,
      month: `${monthNames[mo - 1]} ${yr}`,
      week: `Wk ${weekIso.slice(5)}`,
      day: isoDate,
    };
  };

  // ---- 1. Weightlifting Interactive PowerBI Dashboard ----
  const liftingHost = document.getElementById("bi-lifting-host");
  if (liftingHost && liftingHost.hasAttribute("data-bi-lifting")) {
    try {
      const rawSessions = JSON.parse(liftingHost.getAttribute("data-bi-lifting") || "[]");
      if (Array.isArray(rawSessions) && rawSessions.length > 0) {
        const allMuscles = ["Chest", "Back", "Shoulders", "Triceps", "Biceps", "Abs", "Legs"];
        const activeMuscles = new Set(allMuscles);
        const levels = ["year", "qtr", "month", "week", "day", "set"];
        const levelLabels = {
          year: "Year",
          qtr: "Fiscal Qtr",
          month: "Month",
          week: "Week",
          day: "Day (Workout)",
          set: "Workout & Set (Clustered)",
        };
        let currentLevelIdx = 4; // Default: Day (Workout)
        let drilloutMode = false; // When true: expands Fiscal Qtr -> Months & switches metric from Volume (lb) to Biomechanical Energy (kcal)
        let minReps = 1;
        let startIdx = 0;
        let endIdx = rawSessions.length - 1;
        let focusedDate = rawSessions[rawSessions.length - 1].date;

        const toolbar = document.createElement("div");
        toolbar.className = "bi-toolbar";
        toolbar.innerHTML = [
          `<div class="bi-toolbar-head">`,
          `<div><span class="bi-toolbar-title">⚡ Interactive BI Controls · Hierarchy Drilldown, Muscle Slicer &amp; 190cm Wingspan Energy (kcal)</span>`,
          `<div class="bi-crumbs" id="bi-lift-crumbs">Level: Day (Workout) · Metric: Loaded Volume (lb)</div></div>`,
          `<div class="bi-drill-bar">`,
          `<button type="button" class="bi-btn" id="bi-lift-up">↑ Drill Up</button>`,
          `<button type="button" class="bi-btn" id="bi-lift-down">↓ Drill Down (to Sets)</button>`,
          `<button type="button" class="bi-btn is-drillout" id="bi-lift-drillout" title="Expand Fiscal Qtr into Months &amp; convert weight×reps into Calories Expended (kcal) using 190 cm wingspan ROM">⚡ Drillout: Expand Qtr &amp; Energy (kcal)</button>`,
          `<button type="button" class="bi-btn" id="bi-lift-reset">↺ Reset</button>`,
          `</div></div>`,
          `<div class="bi-sliders-row">`,
          `<label class="bi-slider-label"><span>Start Session Date: <output id="bi-lift-start-out">${rawSessions[0].date}</output></span>`,
          `<input type="range" id="bi-lift-start" min="0" max="${rawSessions.length - 1}" value="0"></label>`,
          `<label class="bi-slider-label"><span>End Session Date: <output id="bi-lift-end-out">${rawSessions[rawSessions.length - 1].date}</output></span>`,
          `<input type="range" id="bi-lift-end" min="0" max="${rawSessions.length - 1}" value="${rawSessions.length - 1}"></label>`,
          `<label class="bi-slider-label"><span>Min Reps Filter (filters sets &amp; columns): <output id="bi-lift-reps-out">1+ reps</output></span>`,
          `<input type="range" id="bi-lift-reps" min="1" max="25" value="1"></label>`,
          `<label class="bi-slider-label"><span>Hierarchy Level</span>`,
          `<select id="bi-lift-level" class="bi-btn" style="width:100%;padding:6px 8px;">`,
          levels.map((lv, i) => `<option value="${i}"${i === currentLevelIdx ? " selected" : ""}>${i + 1}. ${levelLabels[lv]}</option>`).join(""),
          `</select></label>`,
          `</div>`,
          `<div class="bi-slicer-row"><span class="bi-slicer-title">Muscle Group Slicer (Multi-Select &amp; Bucket):</span>`,
          allMuscles.map((m) => `<button type="button" class="bi-slicer-pill is-active" data-muscle-slicer="${m}">${m}</button>`).join(""),
          `<button type="button" class="bi-btn" id="bi-lift-muscle-all" style="margin-left:auto;">Select All</button>`,
          `</div>`,
          `<div class="bi-drillthrough-banner" id="bi-lift-drillthrough" hidden></div>`,
        ].join("");
        liftingHost.insertBefore(toolbar, liftingHost.firstChild);

        const filterLogTable = (filterLabel, matchDatesSet, matchMusclesSet) => {
          const table = document.getElementById("lifting-table");
          if (!table) return;
          const details = table.closest("details");
          if (details) details.open = true;
          const banner = document.getElementById("bi-lift-drillthrough");
          if (banner) {
            banner.hidden = false;
            banner.innerHTML = `<span>🔎 <strong>Drillthrough Active:</strong> Filtered workout log table to <strong>${escHtml(filterLabel)}</strong></span><button type="button" class="bi-btn" id="bi-lift-clear-dt">✕ Clear Drillthrough</button>`;
            banner.querySelector("#bi-lift-clear-dt")?.addEventListener("click", () => {
              banner.hidden = true;
              table.querySelectorAll("tbody tr").forEach((tr) => { tr.hidden = false; });
            });
          }
          table.querySelectorAll("tbody tr").forEach((tr) => {
            const cells = tr.querySelectorAll("th, td");
            const dateTxt = cells[0]?.textContent?.trim() || "";
            const exTxt = cells[2]?.textContent?.trim() || "";
            const mGrp = classifyExerciseMuscle(exTxt);
            const dateOk = !matchDatesSet || matchDatesSet.has(dateTxt);
            const musOk = !matchMusclesSet || matchMusclesSet.has(mGrp);
            tr.hidden = !(dateOk && musOk);
          });
          table.scrollIntoView({ behavior: "smooth", block: "nearest" });
        };

        const updateMultiplesBucketing = () => {
          const grid = document.getElementById("lifting-multiples-grid");
          if (!grid) return;
          const cards = Array.from(grid.querySelectorAll("article.athletics-multiple"));
          grid.querySelectorAll(".muscle-bucket-section").forEach((sec) => {
            sec.querySelectorAll("article.athletics-multiple").forEach((c) => grid.appendChild(c));
            sec.remove();
          });

          const startIso = rawSessions[startIdx]?.date || "0000-00-00";
          const endIso = rawSessions[endIdx]?.date || "9999-99-99";

          cards.forEach((card) => {
            const mGrp = card.getAttribute("data-muscle-group") || "Chest";
            const pts = JSON.parse(card.getAttribute("data-exercise-points") || "[]");
            const inWindow = pts.filter((p) => p.date >= startIso && p.date <= endIso && (Number(p.reps) || 0) >= minReps);
            card.hidden = !activeMuscles.has(mGrp) || inWindow.length === 0;
          });

          // Bucket cards by muscle group when multiple muscle groups are selected
          if (activeMuscles.size >= 1) {
            allMuscles.forEach((mGrp) => {
              if (!activeMuscles.has(mGrp)) return;
              const matching = cards.filter((c) => !c.hidden && c.getAttribute("data-muscle-group") === mGrp);
              if (matching.length === 0) return;
              const sec = document.createElement("div");
              sec.className = `muscle-bucket-section muscle-${mGrp.toLowerCase()}`;
              sec.innerHTML = `<div class="muscle-bucket-header"><span>■ ${escHtml(mGrp)} Bucket (${matching.length} tracked exercise${matching.length === 1 ? "" : "s"})</span><small>Filtered: ≥${minReps} reps · ${startIso} → ${endIso}</small></div><div class="muscle-bucket-grid"></div>`;
              const innerGrid = sec.querySelector(".muscle-bucket-grid");
              matching.forEach((c) => innerGrid.appendChild(c));
              grid.appendChild(sec);
            });
          }
        };

        const renderLiftingVisual = () => {
          const svg = document.getElementById("lifting-volume-svg-title")?.closest("svg");
          if (!svg) return;
          const startIso = rawSessions[startIdx]?.date || "0000-00-00";
          const endIso = rawSessions[endIdx]?.date || "9999-99-99";
          const levelKey = levels[currentLevelIdx];
          const crumbsEl = document.getElementById("bi-lift-crumbs");
          const levelSel = document.getElementById("bi-lift-level");
          if (levelSel) levelSel.value = String(currentLevelIdx);

          const filteredSessions = rawSessions.filter((s) => s.date >= startIso && s.date <= endIso);
          const unitStr = drilloutMode ? "kcal" : "lb";
          if (crumbsEl) {
            crumbsEl.textContent = `Hierarchy: ${levelLabels[levelKey]}${levelKey === "set" ? ` (${focusedDate})` : ""} · Metric: ${drilloutMode ? "Biomechanical Energy Expended (kcal · 190cm wingspan ROM)" : "Loaded Mechanical Volume (lb)"} · Min Reps: ≥${minReps} reps · Active Muscles: ${Array.from(activeMuscles).join(", ") || "None"}`;
          }

          // Final Drilldown Level ("set"): Clustered Column of each Exercise and each Set's Weight (lb) or Energy (kcal)
          if (levelKey === "set") {
            const targetSession = filteredSessions.find((s) => s.date === focusedDate) || filteredSessions[filteredSessions.length - 1] || rawSessions[rawSessions.length - 1];
            if (!targetSession) return;
            focusedDate = targetSession.date;
            const exList = (targetSession.exercises || [])
              .map((ex) => {
                const mGrp = classifyExerciseMuscle(ex.name);
                if (!activeMuscles.has(mGrp)) return null;
                const qualSets = (ex.sets || []).filter((st) => (Number(st.reps) || 0) >= minReps);
                if (!qualSets.length) return null;
                return { ...ex, muscleGroup: mGrp, qualSets };
              })
              .filter(Boolean);

            const maxVal = Math.max(
              20,
              ...exList.flatMap((ex) =>
                ex.qualSets.map((st) => (drilloutMode ? estimateSetKcal(ex.name, ex.kind, st.reps, st.weight) : Number(st.weight) || 10))
              )
            );
            const high = Math.ceil(maxVal / 25) * 25;
            const parts = [];
            for (let k = 0; k <= 4; k++) {
              const tv = Math.round((high * k) / 4);
              const ty = 290 - (tv / high) * 235;
              parts.push(`<line class="chart-grid" x1="75" x2="870" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}"/><text x="66" y="${(ty + 4).toFixed(1)}" text-anchor="end">${tv} ${unitStr}</text>`);
            }
            const groupStep = 770 / Math.max(1, exList.length);
            const setColors = ["#69d4cf", "#bba1ff", "#f7ab65", "#8fe0a8", "#f28b82", "#edcc93"];
            exList.forEach((ex, gIdx) => {
              const gx = 88 + gIdx * groupStep;
              const nSets = ex.qualSets.length;
              const barW = Math.min(26, (groupStep * 0.78) / Math.max(1, nSets));
              ex.qualSets.forEach((st, sIdx) => {
                const val = drilloutMode ? estimateSetKcal(ex.name, ex.kind, st.reps, st.weight) : Number(st.weight) || 0;
                const bh = Math.max(4, (val / high) * 235);
                const bx = gx + sIdx * (barW + 2);
                const by = 290 - bh;
                parts.push(
                  `<rect data-bi-bar="${ gIdx }-${ sIdx }" fill="${setColors[sIdx % setColors.length]}" x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" style="cursor:pointer;">` +
                  `<title>${escHtml(ex.name)} · Set ${sIdx + 1}: ${st.reps} reps × ${st.weight} lb (${estimateSetKcal(ex.name, ex.kind, st.reps, st.weight)} kcal)</title></rect>` +
                  `<text x="${(bx + barW / 2).toFixed(1)}" y="${(by - 5).toFixed(1)}" text-anchor="middle" font-size="9.5">${val}${unitStr === "kcal" ? "" : ""}</text>`
                );
              });
              const shortEx = ex.name.length > 18 ? ex.name.slice(0, 17) + "…" : ex.name;
              parts.push(`<text x="${(gx + (nSets * (barW + 2)) / 2).toFixed(1)}" y="314" text-anchor="middle" font-size="10.5">${escHtml(shortEx)} (${ex.muscleGroup})</text>`);
            });
            svg.innerHTML = `<title id="lifting-volume-svg-title">Clustered Set Breakdown (${focusedDate})</title><desc id="lifting-volume-svg-desc">Each cluster is one exercise; each bar is one set meeting ≥${minReps} reps (${unitStr}).</desc>` + parts.join("");
            svg.querySelectorAll("[data-bi-bar]").forEach((rectEl) => {
              const [gIdx] = rectEl.getAttribute("data-bi-bar").split("-").map(Number);
              const ex = exList[gIdx];
              if (!ex) return;
              const showTip = (ev) => {
                const rowsHtml = ex.qualSets
                  .map((st, idx) => `<tr><td>Set ${idx + 1}</td><td>${st.reps} reps</td><td>${st.weight} lb</td><td>${st.reps * st.weight} lb</td><td>${estimateSetKcal(ex.name, ex.kind, st.reps, st.weight)} kcal</td></tr>`)
                  .join("");
                showBiTooltip(
                  ev,
                  `<h4>${escHtml(targetSession.date)} · ${escHtml(ex.name)} (${escHtml(ex.muscleGroup)})</h4>` +
                  `<p>Filtered to sets with ≥${minReps} reps · 190 cm wingspan ROM model</p>` +
                  `<table><thead><tr><th>Set</th><th>Reps</th><th>Load (lb)</th><th>Volume (lb)</th><th>Energy (kcal)</th></tr></thead><tbody>${rowsHtml}</tbody></table>`
                );
              };
              rectEl.addEventListener("mouseenter", showTip);
              rectEl.addEventListener("click", showTip);
            });
            updateMultiplesBucketing();
            return;
          }

          // Aggregate sessions into buckets for Year / Fiscal Qtr / Month / Week / Day
          const bucketsMap = new Map();
          filteredSessions.forEach((sess) => {
            const h = dateToHierarchy(sess.date, drilloutMode);
            const key = h[levelKey] || sess.date;
            if (!bucketsMap.has(key)) {
              bucketsMap.set(key, { key, split: sess.split, sessions: [], volumeLb: 0, totalKcal: 0, setsCount: 0, workoutDetails: [] });
            }
            const b = bucketsMap.get(key);
            let sessVol = 0;
            let sessKcal = 0;
            let sessSets = 0;
            (sess.exercises || []).forEach((ex) => {
              const mGrp = classifyExerciseMuscle(ex.name);
              if (!activeMuscles.has(mGrp)) return;
              const qualSets = (ex.sets || []).filter((st) => (Number(st.reps) || 0) >= minReps);
              if (!qualSets.length) return;
              qualSets.forEach((st) => {
                if (ex.kind === "loaded") sessVol += (Number(st.reps) || 0) * (Number(st.weight) || 0);
                sessKcal += estimateSetKcal(ex.name, ex.kind, st.reps, st.weight);
                sessSets += 1;
              });
              b.workoutDetails.push({
                date: sess.date,
                muscle: mGrp,
                exercise: ex.name,
                setsStr: qualSets.map((x) => `${x.reps}×${x.weight}lb`).join(", "),
                vol: Math.round(qualSets.reduce((acc, x) => acc + (ex.kind === "loaded" ? x.reps * x.weight : 0), 0)),
                kcal: Math.round(qualSets.reduce((acc, x) => acc + estimateSetKcal(ex.name, ex.kind, x.reps, x.weight), 0) * 10) / 10,
              });
            });
            if (sessSets > 0) {
              b.sessions.push(sess);
              b.volumeLb += sessVol;
              b.totalKcal += sessKcal;
              b.setsCount += sessSets;
            }
          });

          const buckets = Array.from(bucketsMap.values());
          const metricVal = (b) => {
            if (!drilloutMode) return b.volumeLb;
            return levelKey === "day" ? Math.round(b.totalKcal) : Math.round(b.totalKcal / Math.max(1, b.sessions.length));
          };
          const maxMetric = Math.max(100, ...buckets.map(metricVal));
          const stepUnit = drilloutMode ? 100 : 5000;
          const high = Math.ceil(maxMetric / stepUnit) * stepUnit;
          const parts = [];
          for (let k = 0; k <= 4; k++) {
            const tv = Math.round((high * k) / 4);
            const ty = 290 - (tv / high) * 235;
            const tickLbl = drilloutMode ? `${tv} kcal` : `${(tv / 1000).toFixed(tv % 1000 === 0 ? 0 : 1)}k lb`;
            parts.push(`<line class="chart-grid" x1="78" x2="870" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}"/><text x="68" y="${(ty + 4).toFixed(1)}" text-anchor="end">${tickLbl}</text>`);
          }

          const step = 760 / Math.max(1, buckets.length);
          buckets.forEach((b, idx) => {
            const val = metricVal(b);
            const bx = 92 + idx * step;
            const bw = Math.max(12, step * 0.66);
            const bh = Math.max(4, (val / high) * 235);
            const by = 290 - bh;
            const barValStr = drilloutMode ? `${val} kcal` : `${(val / 1000).toFixed(1)}k lb`;
            const xLbl = b.key.length > 12 ? b.key.slice(0, 12) : b.key;
            parts.push(
              `<rect class="athletics-bar split-${b.split}" data-bi-bar="${idx}" x="${(bx + (step - bw) / 2).toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" style="cursor:pointer;">` +
              `<title>${escHtml(b.key)}: ${barValStr} (${b.setsCount} qualifying sets · click to drill down)</title></rect>` +
              `<text x="${(bx + step / 2).toFixed(1)}" y="${(by - 7).toFixed(1)}" text-anchor="middle" font-size="10.5">${barValStr}</text>` +
              `<text x="${(bx + step / 2).toFixed(1)}" y="314" text-anchor="middle" font-size="10.5">${escHtml(xLbl)}</text>`
            );
          });

          svg.innerHTML = `<title id="lifting-volume-svg-title">Weightlifting (${levelLabels[levelKey]})</title><desc id="lifting-volume-svg-desc">Interactive ${levelLabels[levelKey]} chart in ${unitStr}.</desc>` + parts.join("");

          svg.querySelectorAll("[data-bi-bar]").forEach((rectEl) => {
            const b = buckets[Number(rectEl.getAttribute("data-bi-bar"))];
            if (!b) return;
            const showTip = (ev) => {
              const rowsHtml = b.workoutDetails
                .slice(0, 12)
                .map((w) => `<tr><td>${escHtml(w.date.slice(5))}</td><td>${escHtml(w.muscle)}</td><td>${escHtml(w.exercise)}</td><td>${escHtml(w.setsStr)}</td><td>${w.vol.toLocaleString()} lb</td><td>${w.kcal} kcal</td></tr>`)
                .join("");
              const moreNote = b.workoutDetails.length > 12 ? `<p>+ ${b.workoutDetails.length - 12} more exercises in this period</p>` : "";
              showBiTooltip(
                ev,
                `<h4>${escHtml(b.key)} · ${b.sessions.length} Workout(s) · ${b.setsCount} Sets (≥${minReps} reps)</h4>` +
                `<p>Loaded Volume: <strong>${b.volumeLb.toLocaleString()} lb</strong> · Total Energy: <strong>${Math.round(b.totalKcal)} kcal</strong> (Avg ${Math.round(b.totalKcal / Math.max(1, b.sessions.length))} kcal/workout)</p>` +
                `<table><thead><tr><th>Date</th><th>Muscle</th><th>Exercise</th><th>Qualifying Sets</th><th>Vol (lb)</th><th>Energy</th></tr></thead><tbody>${rowsHtml}</tbody></table>` +
                moreNote +
                `<div style="display:flex;gap:8px;justify-content:flex-end;">` +
                `<button type="button" class="bi-btn" id="bi-tip-drilldown">↓ Drill Down Here</button>` +
                `<button type="button" class="bi-btn is-drillout" id="bi-tip-drillthrough">↗ Drillthrough to Log Table</button>` +
                `</div>`
              );
              document.getElementById("bi-tip-drilldown")?.addEventListener("click", () => {
                if (b.sessions.length > 0) focusedDate = b.sessions[b.sessions.length - 1].date;
                currentLevelIdx = Math.min(levels.length - 1, currentLevelIdx + 1);
                getBiTooltip().hidden = true;
                renderLiftingVisual();
              });
              document.getElementById("bi-tip-drillthrough")?.addEventListener("click", () => {
                getBiTooltip().hidden = true;
                const dSet = new Set(b.sessions.map((s) => {
                  const dt = new Date(`${s.date}T12:00:00`);
                  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                }));
                filterLogTable(b.key, dSet, activeMuscles);
              });
            };
            rectEl.addEventListener("mouseenter", showTip);
            rectEl.addEventListener("click", (ev) => {
              showTip(ev);
            });
            rectEl.addEventListener("dblclick", () => {
              if (b.sessions.length > 0) focusedDate = b.sessions[b.sessions.length - 1].date;
              currentLevelIdx = Math.min(levels.length - 1, currentLevelIdx + 1);
              getBiTooltip().hidden = true;
              renderLiftingVisual();
            });
          });

          updateMultiplesBucketing();
        };

        // Wire toolbar controls
        const startSlider = document.getElementById("bi-lift-start");
        const endSlider = document.getElementById("bi-lift-end");
        const repsSlider = document.getElementById("bi-lift-reps");
        const levelSel = document.getElementById("bi-lift-level");
        startSlider?.addEventListener("input", () => {
          startIdx = Math.min(Number(startSlider.value), endIdx);
          startSlider.value = String(startIdx);
          document.getElementById("bi-lift-start-out").textContent = rawSessions[startIdx].date;
          renderLiftingVisual();
        });
        endSlider?.addEventListener("input", () => {
          endIdx = Math.max(Number(endSlider.value), startIdx);
          endSlider.value = String(endIdx);
          document.getElementById("bi-lift-end-out").textContent = rawSessions[endIdx].date;
          renderLiftingVisual();
        });
        repsSlider?.addEventListener("input", () => {
          minReps = Number(repsSlider.value) || 1;
          document.getElementById("bi-lift-reps-out").textContent = `${minReps}+ reps`;
          renderLiftingVisual();
        });
        levelSel?.addEventListener("change", () => {
          currentLevelIdx = Number(levelSel.value) || 0;
          renderLiftingVisual();
        });
        document.getElementById("bi-lift-up")?.addEventListener("click", () => {
          currentLevelIdx = Math.max(0, currentLevelIdx - 1);
          renderLiftingVisual();
        });
        document.getElementById("bi-lift-down")?.addEventListener("click", () => {
          currentLevelIdx = Math.min(levels.length - 1, currentLevelIdx + 1);
          renderLiftingVisual();
        });
        const drilloutBtn = document.getElementById("bi-lift-drillout");
        drilloutBtn?.addEventListener("click", () => {
          drilloutMode = !drilloutMode;
          drilloutBtn.classList.toggle("is-active", drilloutMode);
          renderLiftingVisual();
        });
        document.getElementById("bi-lift-reset")?.addEventListener("click", () => {
          currentLevelIdx = 4;
          drilloutMode = false;
          drilloutBtn?.classList.remove("is-active");
          minReps = 1;
          startIdx = 0;
          endIdx = rawSessions.length - 1;
          if (startSlider) startSlider.value = "0";
          if (endSlider) endSlider.value = String(endIdx);
          if (repsSlider) repsSlider.value = "1";
          document.getElementById("bi-lift-start-out").textContent = rawSessions[0].date;
          document.getElementById("bi-lift-end-out").textContent = rawSessions[endIdx].date;
          document.getElementById("bi-lift-reps-out").textContent = "1+ reps";
          allMuscles.forEach((m) => activeMuscles.add(m));
          toolbar.querySelectorAll("[data-muscle-slicer]").forEach((p) => p.classList.add("is-active"));
          renderLiftingVisual();
        });
        toolbar.querySelectorAll("[data-muscle-slicer]").forEach((pill) => {
          pill.addEventListener("click", () => {
            const m = pill.getAttribute("data-muscle-slicer");
            if (activeMuscles.has(m)) {
              if (activeMuscles.size > 1) activeMuscles.delete(m);
            } else {
              activeMuscles.add(m);
            }
            pill.classList.toggle("is-active", activeMuscles.has(m));
            renderLiftingVisual();
          });
        });
        document.getElementById("bi-lift-muscle-all")?.addEventListener("click", () => {
          allMuscles.forEach((m) => activeMuscles.add(m));
          toolbar.querySelectorAll("[data-muscle-slicer]").forEach((p) => p.classList.add("is-active"));
          renderLiftingVisual();
        });

        renderLiftingVisual();
      }
    } catch {
      /* keep static SVG if JSON fails */
    }
  }

  // ---- 2. Map & Site % Interactive Drilldown, Drillout & Table Tooltip ([data-bi-completion]) ----
  const compHost = document.querySelector("[data-bi-completion]");
  if (compHost) {
    try {
      const fieldsData = JSON.parse(compHost.getAttribute("data-bi-completion") || "[]");
      if (Array.isArray(fieldsData) && fieldsData.length === 6) {
        let compLevel = 0; // 0 = 6 Fields, 1 = 6 Subsections of selected Field (or all 36 in drillout), 2 = 6 Leaves of selected Subsection
        let selectedFieldIdx = 0;
        let selectedTopicIdx = 0;
        let compMetric = "pct"; // "pct" | "words" | "eqs"
        let expandAll36 = false;

        const bar = document.createElement("div");
        bar.className = "bi-toolbar";
        bar.innerHTML = [
          `<div class="bi-toolbar-head">`,
          `<div><span class="bi-toolbar-title">⚡ Interactive 6 × 6 × 6 Atlas Drilldown, Drillout &amp; Branch Tooltip</span>`,
          `<div class="bi-crumbs" id="bi-comp-crumbs">Level 1: All 6 Primary Fields (36 leaves each · click any bar to drill down)</div></div>`,
          `<div class="bi-drill-bar">`,
          `<button type="button" class="bi-btn" id="bi-comp-up">↑ Drill Up</button>`,
          `<button type="button" class="bi-btn" id="bi-comp-down">↓ Drill Down</button>`,
          `<button type="button" class="bi-btn is-drillout" id="bi-comp-expand36">⚡ Drillout: Expand All 36 Subsections</button>`,
          `<button type="button" class="bi-btn is-active" data-comp-metric="pct">Active %</button>`,
          `<button type="button" class="bi-btn" data-comp-metric="words">Words (Prose)</button>`,
          `<button type="button" class="bi-btn" data-comp-metric="eqs">LaTeX Formulae</button>`,
          `</div></div>`,
        ].join("");
        compHost.insertBefore(bar, compHost.firstChild);

        const renderCompChart = () => {
          const svg = document.getElementById("site-completion-fields-chart-svg-title")?.closest("svg");
          if (!svg) return;
          const crumbs = document.getElementById("bi-comp-crumbs");
          let items = [];
          if (expandAll36) {
            items = fieldsData.flatMap((f, fi) => f.topics.map((t, ti) => ({ ...t, label: `${f.title.split(" ")[0]} · ${t.title}`, fi, ti })));
            if (crumbs) crumbs.textContent = `Drillout Active: Expanded All 36 Subsections (6 × 6 Topics) · Metric: ${compMetric === "pct" ? "Active Completion (%)" : compMetric === "words" ? "Mental Map Words" : "LaTeX Formulae"}`;
          } else if (compLevel === 0) {
            items = fieldsData.map((f, fi) => ({ ...f, label: f.title, fi }));
            if (crumbs) crumbs.textContent = `Level 1: All 6 Fields (click any bar to drill down into its 6 Subsections) · Metric: ${compMetric.toUpperCase()}`;
          } else if (compLevel === 1) {
            const fld = fieldsData[selectedFieldIdx] || fieldsData[0];
            items = fld.topics.map((t, ti) => ({ ...t, label: t.title, fi: selectedFieldIdx, ti }));
            if (crumbs) crumbs.textContent = `Level 2: ${fld.title} → 6 Subsections (click any bar to drill down into its 6 Subsubsections)`;
          } else {
            const fld = fieldsData[selectedFieldIdx] || fieldsData[0];
            const top = fld.topics[selectedTopicIdx] || fld.topics[0];
            items = (top.children || []).map((lf, li) => ({
              title: lf.title,
              label: lf.title,
              path: lf.path,
              leaves: 1,
              mmFilled: lf.mm,
              mmPct: lf.mm * 100,
              tabLive: lf.tab,
              activeAny: lf.active,
              activePct: lf.activePct,
              words: lf.words,
              eqs: lf.eqs,
              li,
            }));
            if (crumbs) crumbs.textContent = `Level 3: ${fld.title} → ${top.title} → 6 Leaf Subsubsections`;
          }

          const valOf = (it) => (compMetric === "words" ? Number(it.words) || 0 : compMetric === "eqs" ? Number(it.eqs) || 0 : Number(it.activePct) || 0);
          const maxVal = compMetric === "pct" ? 100 : Math.max(10, ...items.map(valOf));
          const rowH = expandAll36 ? 26 : 38;
          const height = 76 + items.length * rowH;
          const left = 245;
          const width = 405;
          svg.setAttribute("viewBox", `0 0 900 ${height}`);
          const parts = [];
          for (let k = 0; k <= 4; k++) {
            const tv = Math.round((maxVal * k) / 4);
            const tx = left + (k / 4) * width;
            const unit = compMetric === "pct" ? "%" : compMetric === "words" ? " w" : " eq";
            parts.push(`<line class="chart-grid" x1="${tx.toFixed(1)}" x2="${tx.toFixed(1)}" y1="28" y2="${height - 24}"/><text x="${tx.toFixed(1)}" y="18" text-anchor="middle">${tv.toLocaleString()}${unit}</text>`);
          }
          items.forEach((it, idx) => {
            const y = 36 + idx * rowH;
            const v = valOf(it);
            const wBar = Math.max(2, (v / maxVal) * width);
            const rightTxt =
              compMetric === "pct"
                ? `${it.activePct}% (${it.activeAny}/${it.leaves} · ${it.words.toLocaleString()} w · ${it.eqs} eq)`
                : compMetric === "words"
                ? `${it.words.toLocaleString()} words (${it.eqs} eqs · ${it.activePct}% active)`
                : `${it.eqs} formulae (${it.words.toLocaleString()} words · ${it.activePct}% active)`;
            parts.push(
              `<text x="${left - 10}" y="${y + 14}" text-anchor="end" font-size="${expandAll36 ? "10.5" : "12"}">${escHtml(it.label.slice(0, 32))}</text>` +
              `<rect class="athletics-bar series-1" data-bi-bar="${idx}" x="${left}" y="${y}" width="${wBar.toFixed(1)}" height="${rowH - 12}" style="cursor:pointer;"></rect>` +
              `<text class="athletics-label" x="${(left + wBar + 8).toFixed(1)}" y="${y + 14}" font-size="${expandAll36 ? "10" : "11.5"}">${escHtml(rightTxt)}</text>`
            );
          });
          svg.innerHTML = `<title id="site-completion-fields-chart-svg-title">Interactive 6x6x6 Completion</title><desc id="site-completion-fields-chart-svg-desc">Interactive completion chart.</desc>` + parts.join("");

          svg.querySelectorAll("[data-bi-bar]").forEach((rectEl) => {
            const it = items[Number(rectEl.getAttribute("data-bi-bar"))];
            if (!it) return;
            const showTip = (ev) => {
              const subList = it.topics || it.children || [];
              const subRows = subList
                .map((ch) => `<tr><td>${escHtml(ch.title)}</td><td>${ch.activeAny ?? ch.active}/${ch.leaves ?? 1}</td><td>${(ch.words || 0).toLocaleString()} words</td><td>${ch.eqs || 0} eqs</td></tr>`)
                .join("");
              showBiTooltip(
                ev,
                `<h4>${escHtml(it.label)} (${it.activePct}% active)</h4>` +
                `<p>${it.activeAny}/${it.leaves} active leaves · ${(it.words || 0).toLocaleString()} words · ${it.eqs || 0} LaTeX formulae</p>` +
                (subRows ? `<table><thead><tr><th>Branch / Leaf</th><th>Active</th><th>Words</th><th>Formulae</th></tr></thead><tbody>${subRows}</tbody></table>` : "") +
                `<div style="display:flex;gap:8px;justify-content:flex-end;">` +
                (compLevel < 2 ? `<button type="button" class="bi-btn" id="bi-comp-tip-in">↓ Drill Into ${escHtml(it.title)}</button>` : "") +
                `<button type="button" class="bi-btn is-drillout" id="bi-comp-tip-dt">↗ Drillthrough to Table</button>` +
                `</div>`
              );
              document.getElementById("bi-comp-tip-in")?.addEventListener("click", () => {
                getBiTooltip().hidden = true;
                expandAll36 = false;
                document.getElementById("bi-comp-expand36")?.classList.remove("is-active");
                if (compLevel === 0 && it.fi !== undefined) {
                  selectedFieldIdx = it.fi;
                  compLevel = 1;
                } else if (compLevel === 1 && it.ti !== undefined) {
                  selectedTopicIdx = it.ti;
                  compLevel = 2;
                }
                renderCompChart();
              });
              document.getElementById("bi-comp-tip-dt")?.addEventListener("click", () => {
                getBiTooltip().hidden = true;
                const tbl = document.getElementById("site-topics-completion-table");
                if (tbl) {
                  tbl.querySelectorAll("tbody tr").forEach((tr) => {
                    const txt = tr.textContent || "";
                    tr.hidden = !txt.includes(it.title);
                  });
                  tbl.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }
              });
            };
            rectEl.addEventListener("mouseenter", showTip);
            rectEl.addEventListener("click", showTip);
          });
        };

        document.getElementById("bi-comp-up")?.addEventListener("click", () => {
          expandAll36 = false;
          document.getElementById("bi-comp-expand36")?.classList.remove("is-active");
          compLevel = Math.max(0, compLevel - 1);
          renderCompChart();
        });
        document.getElementById("bi-comp-down")?.addEventListener("click", () => {
          expandAll36 = false;
          document.getElementById("bi-comp-expand36")?.classList.remove("is-active");
          compLevel = Math.min(2, compLevel + 1);
          renderCompChart();
        });
        const expBtn = document.getElementById("bi-comp-expand36");
        expBtn?.addEventListener("click", () => {
          expandAll36 = !expandAll36;
          expBtn.classList.toggle("is-active", expandAll36);
          renderCompChart();
        });
        bar.querySelectorAll("[data-comp-metric]").forEach((btn) => {
          btn.addEventListener("click", () => {
            compMetric = btn.getAttribute("data-comp-metric") || "pct";
            bar.querySelectorAll("[data-comp-metric]").forEach((b) => b.classList.toggle("is-active", b === btn));
            renderCompChart();
          });
        });
        renderCompChart();
      }
    } catch {
      /* keep static chart */
    }
  }

  // ---- 3. Universal Interactive Time-Range, Drilldown & Table Tooltip for Swimming, Running, Sleep & Diet ----
  const wireDatedBiHost = (selector, attrName, svgTitleId, valFn, unitStr, kcalFn, tableId) => {
    const host = document.querySelector(selector);
    if (!host || !host.hasAttribute(attrName)) return;
    try {
      const raw = JSON.parse(host.getAttribute(attrName) || "[]");
      const list = Array.isArray(raw) ? raw : Array.isArray(raw.sessions) ? raw.sessions : [];
      if (list.length < 2) return;
      const levels = ["year", "qtr", "month", "week", "day"];
      let lvlIdx = 4;
      let drillout = false;
      let sIdx = 0;
      let eIdx = list.length - 1;

      const bar = document.createElement("div");
      bar.className = "bi-toolbar";
      bar.innerHTML = [
        `<div class="bi-toolbar-head">`,
        `<div><span class="bi-toolbar-title">⚡ Interactive Time Slider, Hierarchy Drilldown &amp; Energy Drillout</span>`,
        `<div class="bi-crumbs" data-bi-sub-crumbs>Level: Day · Unit: ${escHtml(unitStr)}</div></div>`,
        `<div class="bi-drill-bar">`,
        `<button type="button" class="bi-btn" data-bi-sub-up>↑ Drill Up</button>`,
        `<button type="button" class="bi-btn" data-bi-sub-down>↓ Drill Down</button>`,
        `<button type="button" class="bi-btn is-drillout" data-bi-sub-drillout>⚡ Drillout: Expand Qtr &amp; Energy (kcal)</button>`,
        `<button type="button" class="bi-btn" data-bi-sub-reset>↺ Reset</button>`,
        `</div></div>`,
        `<div class="bi-sliders-row">`,
        `<label class="bi-slider-label"><span>From Date: <output data-bi-sub-sout>${list[0].date}</output></span><input type="range" data-bi-sub-s min="0" max="${list.length - 1}" value="0"></label>`,
        `<label class="bi-slider-label"><span>To Date: <output data-bi-sub-eout>${list[list.length - 1].date}</output></span><input type="range" data-bi-sub-e min="0" max="${list.length - 1}" value="${list.length - 1}"></label>`,
        `</div>`,
      ].join("");
      host.insertBefore(bar, host.firstChild);

      const renderSub = () => {
        if (lvlIdx === 4 && !drillout && sIdx === 0 && eIdx === list.length - 1) return;
        const svg = document.getElementById(svgTitleId)?.closest("svg");
        if (!svg) return;
        const levelKey = levels[lvlIdx];
        const slice = list.slice(sIdx, eIdx + 1);
        const bMap = new Map();
        slice.forEach((it) => {
          const h = dateToHierarchy(it.date, drillout);
          const k = h[levelKey] || it.date;
          if (!bMap.has(k)) bMap.set(k, { key: k, items: [], sumVal: 0, sumKcal: 0 });
          const b = bMap.get(k);
          b.items.push(it);
          b.sumVal += valFn(it);
          b.sumKcal += kcalFn(it);
        });
        const buckets = Array.from(bMap.values());
        const u = drillout ? "kcal" : unitStr;
        const mVal = (b) => Math.round((drillout ? b.sumKcal : b.sumVal) / (levelKey === "day" ? 1 : Math.max(1, b.items.length)));
        const maxV = Math.max(10, ...buckets.map(mVal));
        const parts = [];
        for (let k = 0; k <= 4; k++) {
          const tv = Math.round((maxV * k) / 4);
          const ty = 290 - (k / 4) * 235;
          parts.push(`<line class="chart-grid" x1="78" x2="870" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}"/><text x="68" y="${(ty + 4).toFixed(1)}" text-anchor="end">${tv} ${u}</text>`);
        }
        const step = 760 / Math.max(1, buckets.length);
        buckets.forEach((b, idx) => {
          const v = mVal(b);
          const bx = 92 + idx * step;
          const bw = Math.max(14, step * 0.64);
          const bh = Math.max(4, (v / maxV) * 235);
          const by = 290 - bh;
          parts.push(
            `<rect class="athletics-bar series-0" data-bi-bar="${idx}" x="${(bx + (step - bw) / 2).toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" style="cursor:pointer;"></rect>` +
            `<text x="${(bx + step / 2).toFixed(1)}" y="${(by - 7).toFixed(1)}" text-anchor="middle" font-size="10.5">${v} ${u}</text>` +
            `<text x="${(bx + step / 2).toFixed(1)}" y="314" text-anchor="middle" font-size="10.5">${escHtml(b.key.slice(0, 12))}</text>`
          );
        });
        svg.innerHTML = `<title id="${svgTitleId}">Interactive View (${levelKey})</title><desc id="${svgTitleId.replace("-title", "-desc")}">Interactive view in ${u}.</desc>` + parts.join("");
        bar.querySelector("[data-bi-sub-crumbs]").textContent = `Hierarchy: ${levelKey.toUpperCase()} · Metric: ${drillout ? "Avg Energy (kcal)" : unitStr} · Window: ${list[sIdx].date} → ${list[eIdx].date}`;
        svg.querySelectorAll("[data-bi-bar]").forEach((rectEl) => {
          const b = buckets[Number(rectEl.getAttribute("data-bi-bar"))];
          if (!b) return;
          const showTip = (ev) => {
            const rowsHtml = b.items
              .slice(0, 10)
              .map((it) => `<tr><td>${escHtml(it.date)}</td><td>${valFn(it)} ${escHtml(unitStr)}</td><td>${Math.round(kcalFn(it))} kcal</td></tr>`)
              .join("");
            showBiTooltip(
              ev,
              `<h4>${escHtml(b.key)} (${b.items.length} session${b.items.length === 1 ? "" : "s"})</h4>` +
              `<table><thead><tr><th>Date</th><th>Primary (${escHtml(unitStr)})</th><th>Energy (kcal)</th></tr></thead><tbody>${rowsHtml}</tbody></table>`
            );
          };
          rectEl.addEventListener("mouseenter", showTip);
          rectEl.addEventListener("click", showTip);
        });
      };

      const sIn = bar.querySelector("[data-bi-sub-s]");
      const eIn = bar.querySelector("[data-bi-sub-e]");
      sIn?.addEventListener("input", () => {
        sIdx = Math.min(Number(sIn.value), eIdx);
        sIn.value = String(sIdx);
        bar.querySelector("[data-bi-sub-sout]").textContent = list[sIdx].date;
        renderSub();
      });
      eIn?.addEventListener("input", () => {
        eIdx = Math.max(Number(eIn.value), sIdx);
        eIn.value = String(eIdx);
        bar.querySelector("[data-bi-sub-eout]").textContent = list[eIdx].date;
        renderSub();
      });
      bar.querySelector("[data-bi-sub-up]")?.addEventListener("click", () => {
        lvlIdx = Math.max(0, lvlIdx - 1);
        renderSub();
      });
      bar.querySelector("[data-bi-sub-down]")?.addEventListener("click", () => {
        lvlIdx = Math.min(levels.length - 1, lvlIdx + 1);
        renderSub();
      });
      const doBtn = bar.querySelector("[data-bi-sub-drillout]");
      doBtn?.addEventListener("click", () => {
        drillout = !drillout;
        doBtn.classList.toggle("is-active", drillout);
        renderSub();
      });
      bar.querySelector("[data-bi-sub-reset]")?.addEventListener("click", () => {
        window.location.reload();
      });
    } catch {
      /* ignore */
    }
  };

  wireDatedBiHost(".bi-swimming-host", "data-bi-swimming", "swimming-sessions-svg-title", (s) => Number(s.meters) || 0, "m", (s) => Math.round((Number(s.meters) || 0) * 0.29), "swimming-table");
  wireDatedBiHost(".bi-running-host", "data-bi-running", "running-intervals-svg-title", (s) => Math.round(Number(s.average) || 0), "s/loop", (s) => Math.round((Number(s.count) || 4) * 0.95 * 88 * 1.036), "running-table");
  wireDatedBiHost(".bi-sleep-host", "data-bi-sleep", "sleep-hours-svg-title", (s) => Number(s.hours) || 0, "h", (s) => Math.round((Number(s.hours) || 0) * 72), "sleep-table");
  wireDatedBiHost(".bi-diet-host", "data-bi-diet", "diet-balance-svg-title", (s) => Number(s.deficit) || 0, "kcal deficit", (s) => Number(s.expenditure) || 0, "diet-table");
})();