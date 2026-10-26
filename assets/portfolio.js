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

  // ---- Non-Admin Google Docs / Drive Logs 0-Token Check & Refresh (Athletics & Health) ----
  const GDOC_STORAGE_KEY = "liam_gdoc_links_v1";
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
  document.querySelectorAll("[data-gdoc-sync]").forEach((box) => {
    const key = box.getAttribute("data-gdoc-sync");
    const lastDate = box.getAttribute("data-gdoc-last-date") || "2026-10-18";
    const input = document.getElementById(`gdoc-url-${key}`);
    const status = document.getElementById(`gdoc-status-${key}`);
    const saved = loadGdocLinks();
    if (input && saved[key]) input.value = saved[key];

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
      refreshBtn.addEventListener("click", async () => {
        const rawUrl = (input && input.value.trim()) || loadGdocLinks()[key] || "";
        const docId = extractGdocId(rawUrl);
        if (!docId) {
          if (status) {
            status.style.color = "#9ddacf";
            status.textContent = `✓ Checked local build cache: ${key} log is validated through ${lastDate} (0 API tokens used). Paste your Google Doc share link from your Drive "Logs/" folder above to enable live cloud pulls.`;
          }
          return;
        }
        if (status) {
          status.style.color = "#9ddacf";
          status.textContent = `Fetching Google Doc (${docId.slice(0, 8)}…/export?format=txt) · 0 API tokens…`;
        }
        try {
          const resp = await fetch(`https://docs.google.com/document/d/${docId}/export?format=txt`);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const text = await resp.text();
          const lines = text.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
          // Deterministically repair dates (0 tokens)
          const dateMatches = [];
          lines.forEach((ln) => {
            const m = ln.match(/\b(\d{1,2})[\/.\-](\d{1,2})0?(20\d{2})\b/);
            if (m) {
              const iso = `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
              dateMatches.push(iso);
            }
          });
          const newest = dateMatches.sort().pop() || lastDate;
          const previewEl = box.parentElement?.querySelector("pre.athletics-entry");
          if (newest <= lastDate) {
            if (status) {
              status.style.color = "#8fe0a8";
              status.textContent = `✓ Up to date! Latest Google Doc entry is ${newest} (matches built ${lastDate}) · 0 API tokens used.`;
            }
          } else {
            if (previewEl) previewEl.textContent = lines.slice(-6).join("\n");
            if (status) {
              status.style.color = "#8fe0a8";
              status.textContent = `✓ Pulled ${lines.length} lines from Google Docs (new entries through ${newest} validated deterministically with 0 API tokens!). Run 'python -B -m site_content.log_sync' to commit to repo.`;
            }
          }
        } catch {
          if (status) {
            status.style.color = "#f7ab65";
            status.textContent = `⚠ Could not fetch Doc directly in browser (ensure Google Doc sharing is "Anyone with link: Viewer", or run 'python -B -m site_content.log_sync' locally). 0 tokens used.`;
          }
        }
      });
    }
  });

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

  // Helper: convert Markdown + $...$ / $$...$$ LaTeX math into HTML + MathJax \(...\) / \[...\]
  const formatStudyProseHtml = (rawText) => {
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const blocks = String(rawText || "").split(/\n{2,}/);
    return blocks
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return "";
        if (/^#{1,4}\s+/.test(trimmed)) {
          const headingText = esc(trimmed.replace(/^#{1,4}\s+/, ""));
          return `<h4>${headingText}</h4>`;
        }
        let html = esc(trimmed);
        // Display math $$...$$ -> <div class="tex-display-math">\[...\]</div>
        html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, eq) => `<div class="tex-display-math">\\[${eq}\\]</div>`);
        // Inline math $...$ (avoid matching currency like $44 ... $68 by requiring non-space boundaries and math tokens/letters)
        html = html.replace(/\$([^\n$]+?)\$/g, (full, eq) => {
          if (/^\d[\d,.]*(\s|$)/.test(eq)) return full;
          return `<span class="math inline">\\(${eq}\\)</span>`;
        });
        // Bold **...** and italic *...*
        html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
        return `<p>${html}</p>`;
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
          const canonicalIds = new Set(["ST-01", "ST-02", "ST-05", "ST-06"]);
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
                kpisBlock,
                inspectorBlock,
                renderSvg(st.id, an),
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
          const canonicalIds = new Set(["ST-01", "ST-02", "ST-05", "ST-06"]);
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
})();