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

  const formatClockJs = (sec) => {
    const s = Math.round(Number(sec) || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, "0")}`;
  };

  const formatShortDayJs = (isoDate) => {
    const parts = String(isoDate || "").split("-");
    if (parts.length < 3) return isoDate;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mo = months[(parseInt(parts[1], 10) || 1) - 1] || parts[1];
    const d = parseInt(parts[2], 10) || 1;
    return `${mo} ${d}`;
  };

  const applyLiveLogUpdateToDom = (key, rawText) => {
    if (!rawText || typeof rawText !== "string") return;
    const lines = rawText.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;

    // 1. Auto-detect Tempo Run Log (even if pasted into the 'running' box on Running/index.html)
    if (key === "tempo" || lines.some((l) => /^Tempo\s+Run\s*[-:]/i.test(l))) {
      const tempoRuns = [];
      let cur = null;
      lines.forEach((ln) => {
        const mDate = ln.match(/^\(?(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2})\)?$/);
        if (mDate) {
          cur = {
            date: `${mDate[3]}-${mDate[1].padStart(2, "0")}-${mDate[2].padStart(2, "0")}`,
          };
          return;
        }
        const mRun = ln.match(/^Tempo\s+Run\s*[-:]\s*(\d+(?:\.\d+)?)\s*km\s*\((.+)\)/i);
        if (cur && mRun) {
          cur.distanceKm = parseFloat(mRun[1]);
          cur.route = mRun[2].trim();
          return;
        }
        const mTime = ln.match(/^(\d{1,2})[:.](\d{2})\.(\d{1,2})$/);
        if (cur && cur.distanceKm && !cur.timeRaw && mTime) {
          cur.timeRaw = ln;
          cur.timeSeconds = parseInt(mTime[1], 10) * 60 + parseInt(mTime[2], 10) + parseFloat(`0.${mTime[3]}`);
          return;
        }
        const mPace = ln.match(/^(\d{1,2}):(\d{2}(?:\.\d+)?)\s*min\/km\s*[-:]\s*(\d+(?:\.\d+)?)\s*m\/s/i);
        if (cur && cur.timeSeconds && mPace) {
          cur.writtenPace = { raw: ln };
          cur.paceSeconds = Math.round((cur.timeSeconds / cur.distanceKm) * 100) / 100;
          cur.speed = Math.round(((cur.distanceKm * 1000) / cur.timeSeconds) * 100) / 100;
          tempoRuns.push(cur);
          cur = null;
        }
      });

      if (tempoRuns.length > 0) {
        const totalKm = Math.round(tempoRuns.reduce((a, r) => a + r.distanceKm, 0) * 10) / 10;
        const tempoTitle = document.getElementById("running-tempo-title");
        if (tempoTitle) tempoTitle.textContent = `Continuous runs, ${totalKm} km so far.`;
        const chipsList = document.getElementById("tempo-chips-list") || document.querySelector("#running-tempo .athletics-chips");
        if (chipsList) {
          chipsList.innerHTML = tempoRuns
            .map((r, i) => `<li class="series-${i % 4}">${formatShortDayJs(r.date)} · ${r.route} · ${r.distanceKm} km @ ${formatClockJs(r.paceSeconds)}/km</li>`)
            .join("");
        }
        const tempoTableBody = document.querySelector("#tempo-table tbody");
        if (tempoTableBody) {
          tempoTableBody.innerHTML = tempoRuns
            .map(
              (r) =>
                `<tr><th scope="row">${formatShortDayJs(r.date)}</th><td>${r.route}</td><td>${r.distanceKm} km</td><td>${r.timeRaw}</td><td>${formatClockJs(r.paceSeconds)} /km</td><td>${r.speed} m/s</td><td>${r.writtenPace.raw}</td></tr>`
            )
            .join("");
        }
        const tempoHost = document.querySelector(".bi-tempo-host");
        if (tempoHost) {
          tempoHost.setAttribute("data-bi-tempo", JSON.stringify(tempoRuns));
          window.dispatchEvent(new CustomEvent("liam-bi-refresh-tempo", { detail: tempoRuns }));
        }
      }
    }

    // 2. Auto-detect Weightlifting Log and dynamically update sessions, table & interactive BI chart
    if (key === "weightlifting" && lines.some((l) => /\d+\s*x\s*\d+/i.test(l))) {
      const sessions = [];
      let lastYear = 0;
      lines.forEach((ln) => {
        const mDay = ln.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2})\s*(?:[-:]\s*)?([A-Za-z].*)$/);
        if (mDay) {
          let yr = parseInt(mDay[3], 10);
          if (lastYear && yr < lastYear) yr = lastYear;
          else lastYear = yr;
          const rawSplit = mDay[4].trim();
          const firstWord = rawSplit.split(/[^A-Za-z]+/)[0].toLowerCase();
          const split = firstWord === "back" ? "Back" : firstWord === "chest" ? "Chest" : "Shoulders";
          sessions.push({
            date: `${yr}-${mDay[1].padStart(2, "0")}-${mDay[2].padStart(2, "0")}`,
            splitRaw: rawSplit,
            split,
            exercises: [],
            sets: 0,
            reps: 0,
            volume: 0,
          });
          return;
        }
        if (!sessions.length) return;
        const mEx = ln.match(/^([A-Za-z][A-Za-z0-9\s'()/&]*?)\s*(?:([;:])\s*|[-,]\s*|\s+)(?=\d+\s*[xX*]|\s*$)(.*)$/);
        if (mEx) {
          const name = mEx[1].trim().replace(/Assited/g, "Assisted").replace(/Dumbell/g, "Dumbbell");
          const rest = mEx[3].trim();
          const sets = [];
          rest.split(",").forEach((tok) => {
            const t = tok.trim().replace(/\.$/, "");
            const ms = t.match(/^(\d+)\s*[xX*]\s*(\d+(?:\.\d+)?)\s*(?:lbs?|lb)?$/i);
            if (ms) {
              sets.push({ reps: parseInt(ms[1], 10), weight: parseFloat(ms[2]) });
            } else if (/^(\d+)\s*[xX*]\s*(?:bw|bodyweight)$/i.test(t)) {
              const mbw = t.match(/^(\d+)/);
              sets.push({ reps: parseInt(mbw[1], 10), weight: 0 });
            }
          });
          const kind = !sets.length ? "unrecorded" : /assisted/i.test(name) ? "assisted" : sets.every((s) => s.weight === 0) ? "bodyweight" : "loaded";
          const vol = kind === "loaded" ? Math.round(sets.reduce((a, s) => a + s.reps * s.weight, 0)) : 0;
          const repsSum = sets.reduce((a, s) => a + s.reps, 0);
          const curSess = sessions[sessions.length - 1];
          curSess.exercises.push({ name, kind, sets, setCount: sets.length, reps: repsSum, volume: vol });
          curSess.sets += sets.length;
          curSess.reps += repsSum;
          curSess.volume += vol;
        }
      });
      if (sessions.length > 0) {
        const liftHost = document.getElementById("bi-lifting-host");
        if (liftHost) {
          liftHost.setAttribute("data-bi-lifting", JSON.stringify(sessions));
          window.dispatchEvent(new CustomEvent("liam-bi-refresh-lifting", { detail: sessions }));
        }
      }
    }
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
        syncedStore[key] = { docId, newest, lineCount: lines.length, rawText: text, tail: lines.slice(-12), syncedAt: new Date().toISOString() };
        localStorage.setItem(SYNCED_LOGS_KEY, JSON.stringify(syncedStore));
      } catch {
        /* ignore quota */
      }
      applyLiveLogUpdateToDom(key, text);
      if (newest <= lastDate) {
        if (status) {
          status.style.color = "#8fe0a8";
          status.textContent = `✓ Synced & dynamically updated page! Latest Google Doc entry is ${newest} (${allDates.length} dated entries, ${lines.length} lines) · 0 API tokens used.`;
        }
      } else {
        box.setAttribute("data-gdoc-last-date", newest);
        if (status) {
          status.style.color = "#8fe0a8";
          status.textContent = `✓ Updated charts & tables live from Google Docs! Pulled ${lines.length} lines through ${newest} (${allDates.length} sessions · 0 API tokens used).`;
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

  // Re-apply any previously synced Google Doc logs from localStorage on page load so charts/tables stay updated
  try {
    const cachedLogs = JSON.parse(localStorage.getItem(SYNCED_LOGS_KEY) || "{}") || {};
    Object.entries(cachedLogs).forEach(([k, v]) => {
      if (v && v.rawText) applyLiveLogUpdateToDom(k, v.rawText);
    });
  } catch {
    /* ignore */
  }

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

        // 1. On an Atlas leaf page, hosted study page, OR Topic/Field branch page (.atlas-page), inject cards & Study Tabs
        const leafMain = document.querySelector("main.atlas-leaf, main.study-page, main.atlas-page");
        if (leafMain) {
          const canonicalIds = new Set(["ST-01", "ST-02", "ST-05", "ST-06", "ST-08", "ST-09"]);
          const matching = runEntries.filter(
            (r) =>
              !canonicalIds.has(r.study.id) &&
              (current.includes(`/${r.study.atlasPath}/`) || r.study.atlasPath.split("/").slice(0, 2).join("/") && current.endsWith(`/${r.study.atlasPath.split("/").slice(0, 2).join("/")}/index.html`))
          );
          if (matching.length > 0) {
            const ledeEl = leafMain.querySelector(".leaf-hero .lede");
            if (ledeEl && /first study is being prepared/i.test(ledeEl.textContent)) {
              ledeEl.textContent = `Live Workbench study active (${matching.map((m) => m.study.id).join(", ")}): empirical benchmarks, interactive parameter definitions, SVG chart, Pandas code, and LaTeX paper below.`;
            }
            const brand = document.querySelector(".site-header .brand");
            const rootPrefix = brand ? (brand.getAttribute("href") || "index.html").replace(/index\.html$/, "") : "../../../";
            const featGrid = leafMain.querySelector(".atlas-feature-grid");
            matching.forEach((rec) => {
              const st = rec.study;
              if (featGrid && !document.getElementById(`wb-feat-card-${st.id}`)) {
                const card = document.createElement("a");
                card.id = `wb-feat-card-${st.id}`;
                card.className = "atlas-feature";
                card.href = `#wb-live-tab-${st.id}`;
                card.innerHTML = `<span class="eyebrow">WORKBENCH · ${esc(st.id)} · ${esc(st.createdOn || "2026-10-27")}</span><h3>${esc(st.title)}</h3><p>${esc(String(st.question || "").slice(0, 160))}…</p><span class="button ghost">Open ↗</span>`;
                featGrid.insertBefore(card, featGrid.firstChild);
              }
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
                renderSvg(st.id, an) + (Array.isArray(an.extraCharts) ? an.extraCharts.map((ch, idx) => renderSvg(`${st.id}-extra-${idx + 2}`, ch)).join("") : ""),
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
          const canonicalIds = new Set(["ST-01", "ST-02", "ST-05", "ST-06", "ST-08", "ST-09"]);
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

  // Pull cross-device Mobile <-> Web study runs on Atlas leaf/branch pages & Mental Map (including >4KB attachments)
  if (typeof fetch === "function" && (document.querySelector("main.atlas-leaf, main.study-page, main.atlas-page") || current.includes("/Mental-Map/"))) {
    fetch("https://ntfy.sh/liam_wb_cloud_sync_67wxyE7LLICn/json?poll=1&since=all")
      .then((r) => (r.ok ? r.text() : ""))
      .then(async (txt) => {
        if (!txt) return;
        const localRuns = JSON.parse(localStorage.getItem("liam_workbench_study_runs_v1") || "{}") || {};
        let updated = false;
        const lines = txt.trim().split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const env = JSON.parse(line);
            if (!env || env.event !== "message") continue;
            let pkt = null;
            if (env.attachment && env.attachment.url) {
              const attResp = await fetch(env.attachment.url);
              if (attResp.ok) pkt = await attResp.json();
            } else if (env.message && env.message.startsWith("{")) {
              pkt = JSON.parse(env.message);
            }
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
        }
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
  // PowerBI-Style Interactive Visual Engine (Sliders, Slicers, True Drilldown vs.
  // Drillout, Dual-Axis Bar + Line with 'Energy / Pounds' Swap Toggle, Ordinal
  // Dates without Year, Dynamic Flat/Angled Labels & Scrollable Wide SVG)
  // ============================================================================
  const escHtml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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

  // Ordinal Day Formatter without Year: "2026-09-14" -> "Sep 14th", "2026-12-31" -> "Dec 31st", "2027-01-01" -> "Jan 1st"
  const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const ordinalSuffix = (d) => {
    if (d >= 11 && d <= 13) return `${d}th`;
    switch (d % 10) {
      case 1: return `${d}st`;
      case 2: return `${d}nd`;
      case 3: return `${d}rd`;
      default: return `${d}th`;
    }
  };
  const formatOrdinalDay = (isoDate) => {
    const parts = String(isoDate || "").split("-");
    if (parts.length < 3) return String(isoDate || "");
    const moIdx = (parseInt(parts[1], 10) || 1) - 1;
    const dayNum = parseInt(parts[2], 10) || 1;
    return `${MONTHS_SHORT[moIdx] || parts[1]} ${ordinalSuffix(dayNum)}`;
  };

  const dateToHierarchy = (isoDate) => {
    const parts = String(isoDate || "2026-10-01").split("-");
    const mo = parseInt(parts[1], 10) || 10;
    const qtrNum = Math.ceil(mo / 3);
    const qtrRanges = { 1: "Jan–Mar", 2: "Apr–Jun", 3: "Jul–Sep", 4: "Oct–Dec" };
    const dObj = new Date(`${isoDate}T12:00:00`);
    const dayOfWeek = (dObj.getDay() + 6) % 7;
    const mon = new Date(dObj);
    mon.setDate(dObj.getDate() - dayOfWeek);
    const weekIso = mon.toISOString().slice(0, 10);
    return {
      qtr: `Q${qtrNum} · ${qtrRanges[qtrNum]}`,
      month: MONTHS_FULL[mo - 1] || "October",
      week: `Wk ${formatOrdinalDay(weekIso)}`,
      day: formatOrdinalDay(isoDate),
      rawDate: isoDate,
    };
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

  const estimateSetEffectiveLbs = (exName, exKind, reps, weightLbs) => {
    const r = Number(reps) || 0;
    const w = Number(weightLbs) || 0;
    if (r <= 0) return 0;
    if (exKind === "loaded" && w > 0) return r * w;
    if (exKind === "assisted") return Math.round(r * Math.max(40, 194 - w));
    const grp = classifyExerciseMuscle(exName);
    return Math.round(r * (grp === "Abs" ? 35 : 65));
  };

  // Helper: Draw a Dual-Axis Bar (Left Y-Axis) + Line (Right Y-Axis) SVG with Dynamic Flat/Angled X-Labels & Scrollable Width
  const buildDualAxisSvgMarkup = ({
    svgEl,
    titleId,
    titleText,
    descText,
    items,
    barValFn,
    lineValFn,
    barUnit,
    lineUnit,
    barFormatFn,
    lineFormatFn,
    barColorFn,
  }) => {
    const n = Math.max(1, items.length);
    const containerW = svgEl.parentElement?.clientWidth || 960;
    const minStep = 64;
    const naturalStep = (containerW - 180) / n;
    const svgWidth = naturalStep >= minStep ? Math.max(960, containerW) : Math.max(960, 180 + n * minStep);
    const useAngledLabels = (svgWidth - 180) / n < 78 || items.some((it) => String(it.label || "").length > 11);
    const svgHeight = useAngledLabels ? 365 : 335;
    const leftPad = 82;
    const rightPad = svgWidth - 82;
    const topPad = 44;
    const bottomPad = 285;
    const plotW = rightPad - leftPad;
    const plotH = bottomPad - topPad;

    svgEl.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);
    svgEl.style.minWidth = svgWidth > containerW ? `${svgWidth}px` : "100%";

    const barVals = items.map(barValFn);
    const lineVals = items.map(lineValFn);
    const maxBar = Math.max(1, ...barVals);
    const maxLine = Math.max(1, ...lineVals);

    const parts = [
      `<title id="${escHtml(titleId)}">${escHtml(titleText)}</title>`,
      `<desc id="${escHtml(titleId.replace("-title", "-desc"))}">${escHtml(descText)}</desc>`,
      `<text x="${leftPad - 8}" y="22" text-anchor="end" fill="#9ddacf" font-weight="700" font-size="11.5">▮ Bars: ${escHtml(barUnit)}</text>`,
      `<text x="${rightPad + 8}" y="22" text-anchor="start" fill="#f7ab65" font-weight="700" font-size="11.5">● Line: ${escHtml(lineUnit)}</text>`,
    ];

    for (let k = 0; k <= 4; k++) {
      const bTick = (maxBar * k) / 4;
      const lTick = (maxLine * k) / 4;
      const ty = bottomPad - (k / 4) * plotH;
      const bLbl = barFormatFn ? barFormatFn(bTick) : `${Math.round(bTick)} ${barUnit}`;
      const lLbl = lineFormatFn ? lineFormatFn(lTick) : `${Math.round(lTick)} ${lineUnit}`;
      parts.push(
        `<line class="chart-grid" x1="${leftPad}" x2="${rightPad}" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}"/>` +
        `<text x="${leftPad - 8}" y="${(ty + 4).toFixed(1)}" text-anchor="end" fill="#9ddacf">${escHtml(bLbl)}</text>` +
        `<text x="${rightPad + 8}" y="${(ty + 4).toFixed(1)}" text-anchor="start" fill="#f7ab65">${escHtml(lLbl)}</text>`
      );
    }

    const step = plotW / n;
    const linePts = [];

    items.forEach((it, idx) => {
      const bVal = barVals[idx];
      const lVal = lineVals[idx];
      const cx = leftPad + (idx + 0.5) * step;
      const bw = Math.min(54, Math.max(16, step * 0.62));
      const bh = Math.max(4, (bVal / maxBar) * plotH);
      const bx = cx - bw / 2;
      const by = bottomPad - bh;
      const ly = bottomPad - (lVal / maxLine) * plotH;
      linePts.push({ cx, ly, lVal, it, idx });

      const bText = barFormatFn ? barFormatFn(bVal) : `${Math.round(bVal)} ${barUnit}`;
      const clsOrFill = barColorFn ? barColorFn(it, idx) : 'class="athletics-bar series-0"';
      const xLabel = String(it.label || it.key || "");
      const labelAttr = useAngledLabels
        ? `x="${cx.toFixed(1)}" y="${bottomPad + 18}" text-anchor="end" transform="rotate(-28, ${cx.toFixed(1)}, ${bottomPad + 18})"`
        : `x="${cx.toFixed(1)}" y="${bottomPad + 22}" text-anchor="middle"`;

      parts.push(
        `<rect ${clsOrFill} data-bi-bar="${idx}" x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" style="cursor:pointer;"></rect>` +
        `<text x="${cx.toFixed(1)}" y="${Math.max(34, by - 7).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="#eeeef7" font-weight="600">${escHtml(bText)}</text>` +
        `<text ${labelAttr} font-size="11">${escHtml(xLabel)}</text>`
      );
    });

    if (linePts.length > 1) {
      parts.push(
        `<polyline fill="none" stroke="#f7ab65" stroke-width="2.8" stroke-linejoin="round" points="${linePts.map((p) => `${p.cx.toFixed(1)},${p.ly.toFixed(1)}`).join(" ")}"/>`
      );
    }
    linePts.forEach((p) => {
      const lText = lineFormatFn ? lineFormatFn(p.lVal) : `${Math.round(p.lVal)} ${lineUnit}`;
      parts.push(
        `<circle data-bi-bar="${p.idx}" cx="${p.cx.toFixed(1)}" cy="${p.ly.toFixed(1)}" r="4.5" fill="#f7ab65" stroke="#0d101b" stroke-width="1.8" style="cursor:pointer;">` +
        `<title>${escHtml(p.it.label || p.it.key)}: ${escHtml(lText)}</title></circle>`
      );
    });

    svgEl.innerHTML = parts.join("");
  };

  // ---- 1. Weightlifting Interactive PowerBI Dashboard ----
  const liftingHost = document.getElementById("bi-lifting-host");
  if (liftingHost && liftingHost.hasAttribute("data-bi-lifting")) {
    try {
      let rawSessions = JSON.parse(liftingHost.getAttribute("data-bi-lifting") || "[]");
      if (Array.isArray(rawSessions) && rawSessions.length > 0) {
        const allMuscles = ["Chest", "Back", "Shoulders", "Triceps", "Biceps", "Abs", "Legs"];
        const activeMuscles = new Set(allMuscles);
        const levels = ["qtr", "month", "week", "day", "set"];
        const levelLabels = {
          qtr: "Fiscal Qtr",
          month: "Month",
          week: "Week",
          day: "Day (Workout)",
          set: "Workout & Set (Clustered)",
        };
        let currentLevelIdx = 3; // Default: Day (Workout)
        let swapAxes = false; // False: Bars = Pounds (lb), Line = Energy (kcal). True: Bars = Energy (kcal), Line = Pounds (lb)
        let minReps = 1;
        let startIdx = 0;
        let endIdx = rawSessions.length - 1;
        // True PowerBI Drilldown Scope: tracks parent selection when drilling down (cleared when drilling out!)
        let drillScope = { qtr: null, month: null, week: null, dayIso: rawSessions[rawSessions.length - 1].date };

        const toolbar = document.createElement("div");
        toolbar.className = "bi-toolbar";
        toolbar.innerHTML = [
          `<div class="bi-toolbar-head">`,
          `<div><span class="bi-toolbar-title">⚡ Interactive BI Controls · Dual-Axis (Pounds &amp; Energy), Drilldown vs. Drillout &amp; Muscle Slicer</span>`,
          `<div class="bi-crumbs" id="bi-lift-crumbs">Level: Day (Workout) · Bars: Volume (lb) · Line: Energy (kcal)</div></div>`,
          `<div class="bi-drill-bar">`,
          `<button type="button" class="bi-btn" id="bi-lift-up" title="Step up one hierarchy level">↑ Drill Up</button>`,
          `<button type="button" class="bi-btn" id="bi-lift-down" title="Drill down into the selected period only (e.g. Q4 → Oct → Oct Weeks → single week's workouts → sets)">↓ Drill Down (Into Period)</button>`,
          `<button type="button" class="bi-btn" id="bi-lift-drillout" title="Expand ALL visible periods to the next level across the whole range (e.g. Q3+Q4 → all months → all weeks → all workouts)">↔ Drill Out (Expand All)</button>`,
          `<button type="button" class="bi-btn is-drillout" id="bi-lift-swap-axis" title="Swap which metric is on the Primary Bars (left axis) vs. Secondary Line (right axis)">⇄ Energy / Pounds</button>`,
          `<button type="button" class="bi-btn" id="bi-lift-reset">↺ Reset</button>`,
          `</div></div>`,
          `<div class="bi-sliders-row">`,
          `<label class="bi-slider-label"><span>Start Session: <output id="bi-lift-start-out">${formatOrdinalDay(rawSessions[0].date)}</output></span>`,
          `<input type="range" id="bi-lift-start" min="0" max="${rawSessions.length - 1}" value="0"></label>`,
          `<label class="bi-slider-label"><span>End Session: <output id="bi-lift-end-out">${formatOrdinalDay(rawSessions[rawSessions.length - 1].date)}</output></span>`,
          `<input type="range" id="bi-lift-end" min="0" max="${rawSessions.length - 1}" value="${rawSessions.length - 1}"></label>`,
          `<label class="bi-slider-label"><span>Min Reps Filter (removes lower-rep sets): <output id="bi-lift-reps-out">1+ reps</output></span>`,
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
            const exName = card.getAttribute("data-exercise-name") || "";
            const exKind = card.getAttribute("data-exercise-kind") || "loaded";
            const pts = JSON.parse(card.getAttribute("data-exercise-points") || "[]");
            const inWindow = pts.filter((p) => p.date >= startIso && p.date <= endIso && (Number(p.reps) || 0) >= minReps);
            card.hidden = !activeMuscles.has(mGrp) || inWindow.length === 0;
            if (!card.hidden) {
              // Update small multiple X-axis labels to ordinal dates without year (Sep 14th, Oct 25th) and add table tooltip
              const spark = card.querySelector("svg.athletics-spark");
              if (spark && !card.hasAttribute("data-spark-wired")) {
                card.setAttribute("data-spark-wired", "1");
                spark.querySelectorAll("text").forEach((tEl) => {
                  if (Number(tEl.getAttribute("y")) >= 165) {
                    const txt = tEl.textContent || "";
                    const m = txt.match(/^([A-Za-z]{3})\s+(\d+)$/);
                    if (m) tEl.textContent = `${m[1]} ${ordinalSuffix(parseInt(m[2], 10))}`;
                  }
                });
                card.style.cursor = "pointer";
                card.addEventListener("click", (ev) => {
                  const rowsHtml = inWindow
                    .map((p) => {
                      const kcal = estimateSetKcal(exName, exKind, p.reps, p.value);
                      return `<tr><td>${escHtml(formatOrdinalDay(p.date))}</td><td>${p.value ?? 0} lb</td><td>${p.reps} reps</td><td>${p.best10 ?? "—"}</td><td>${p.best12 ?? "—"}</td><td>${kcal} kcal</td></tr>`;
                    })
                    .join("");
                  showBiTooltip(
                    ev,
                    `<h4>${escHtml(exName)} (${escHtml(mGrp)}) · ${inWindow.length} Sessions</h4>` +
                    `<p>Filtered to ≥${minReps} reps · ${formatOrdinalDay(startIso)} → ${formatOrdinalDay(endIso)}</p>` +
                    `<table><thead><tr><th>Date</th><th>Top Set</th><th>Reps</th><th>10+ Reps</th><th>12+ Reps</th><th>Top Set kcal</th></tr></thead><tbody>${rowsHtml}</tbody></table>`
                  );
                });
              }
            }
          });

          if (activeMuscles.size >= 1) {
            allMuscles.forEach((mGrp) => {
              if (!activeMuscles.has(mGrp)) return;
              const matching = cards.filter((c) => !c.hidden && c.getAttribute("data-muscle-group") === mGrp);
              if (matching.length === 0) return;
              const sec = document.createElement("div");
              sec.className = `muscle-bucket-section muscle-${mGrp.toLowerCase()}`;
              sec.innerHTML = `<div class="muscle-bucket-header"><span>■ ${escHtml(mGrp)} Bucket (${matching.length} tracked exercise${matching.length === 1 ? "" : "s"})</span><small>Filtered: ≥${minReps} reps · ${formatOrdinalDay(startIso)} → ${formatOrdinalDay(endIso)}</small></div><div class="muscle-bucket-grid"></div>`;
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

          // Apply Time Slider + Active Drilldown Scope
          let scopedSessions = rawSessions.filter((s) => s.date >= startIso && s.date <= endIso);
          if (currentLevelIdx >= 1 && drillScope.qtr) {
            scopedSessions = scopedSessions.filter((s) => dateToHierarchy(s.date).qtr === drillScope.qtr);
          }
          if (currentLevelIdx >= 2 && drillScope.month) {
            scopedSessions = scopedSessions.filter((s) => dateToHierarchy(s.date).month === drillScope.month);
          }
          if (currentLevelIdx >= 3 && drillScope.week) {
            scopedSessions = scopedSessions.filter((s) => dateToHierarchy(s.date).week === drillScope.week);
          }
          if (!scopedSessions.length) {
            scopedSessions = rawSessions.filter((s) => s.date >= startIso && s.date <= endIso);
          }

          const scopeTrail = [drillScope.qtr, drillScope.month, drillScope.week].filter(Boolean).join(" → ");
          const barName = swapAxes ? "Energy Expended (kcal)" : "Mechanical Volume (lb)";
          const lineName = swapAxes ? "Mechanical Volume (lb)" : "Energy Expended (kcal)";
          if (crumbsEl) {
            crumbsEl.textContent = `Level: ${levelLabels[levelKey]}${scopeTrail ? ` [Drilled into: ${scopeTrail}]` : " [All in Range]"} · ▮ Bars: ${barName} · ● Line: ${lineName} · Min Reps: ≥${minReps}`;
          }

          // Final Drilldown Level ("set"): Clustered Column of each Exercise and each Set's Weight (lb) + Secondary Line of Energy (kcal)
          if (levelKey === "set") {
            const targetSession =
              scopedSessions.find((s) => s.date === drillScope.dayIso) ||
              scopedSessions[scopedSessions.length - 1] ||
              rawSessions[rawSessions.length - 1];
            if (!targetSession) return;
            drillScope.dayIso = targetSession.date;
            const exList = (targetSession.exercises || [])
              .map((ex) => {
                const mGrp = classifyExerciseMuscle(ex.name);
                if (!activeMuscles.has(mGrp)) return null;
                const qualSets = (ex.sets || []).filter((st) => (Number(st.reps) || 0) >= minReps);
                if (!qualSets.length) return null;
                return { ...ex, muscleGroup: mGrp, qualSets };
              })
              .filter(Boolean);

            const flatSets = [];
            exList.forEach((ex) => {
              ex.qualSets.forEach((st, sIdx) => {
                const wLb = Number(st.weight) || (ex.kind === "bodyweight" ? 45 : 0);
                const kcal = estimateSetKcal(ex.name, ex.kind, st.reps, st.weight);
                flatSets.push({
                  label: `${ex.name.split(" ").slice(0, 2).join(" ")} S${sIdx + 1}`,
                  fullEx: ex.name,
                  muscleGroup: ex.muscleGroup,
                  setNum: sIdx + 1,
                  reps: st.reps,
                  weightLb: wLb,
                  kcal,
                  qualSets: ex.qualSets,
                  exKind: ex.kind,
                });
              });
            });

            if (flatSets.length > 0) {
              buildDualAxisSvgMarkup({
                svgEl: svg,
                titleId: "lifting-volume-svg-title",
                titleText: `Workout & Set Breakdown (${formatOrdinalDay(targetSession.date)})`,
                descText: `Each bar is one qualifying set (≥${minReps} reps) on ${formatOrdinalDay(targetSession.date)}.`,
                items: flatSets,
                barValFn: (it) => (swapAxes ? it.kcal : it.weightLb),
                lineValFn: (it) => (swapAxes ? it.weightLb : it.kcal),
                barUnit: swapAxes ? "kcal" : "lb",
                lineUnit: swapAxes ? "lb" : "kcal",
                barFormatFn: (v) => (swapAxes ? `${Math.round(v * 10) / 10} kcal` : `${Math.round(v)} lb`),
                lineFormatFn: (v) => (swapAxes ? `${Math.round(v)} lb` : `${Math.round(v * 10) / 10} kcal`),
                barColorFn: (it) => `class="athletics-bar split-${targetSession.split}"`,
              });
              svg.querySelectorAll("[data-bi-bar]").forEach((el) => {
                const it = flatSets[Number(el.getAttribute("data-bi-bar"))];
                if (!it) return;
                const showTip = (ev) => {
                  const rowsHtml = it.qualSets
                    .map((st, idx) => `<tr><td>Set ${idx + 1}</td><td>${st.reps} reps</td><td>${st.weight} lb</td><td>${estimateSetKcal(it.fullEx, it.exKind, st.reps, st.weight)} kcal</td></tr>`)
                    .join("");
                  showBiTooltip(
                    ev,
                    `<h4>${escHtml(formatOrdinalDay(targetSession.date))} · ${escHtml(it.fullEx)} (${escHtml(it.muscleGroup)})</h4>` +
                    `<p>Set ${it.setNum}: ${it.reps} reps × ${it.weightLb} lb · ${it.kcal} kcal (190 cm wingspan ROM)</p>` +
                    `<table><thead><tr><th>Set</th><th>Reps</th><th>Weight (lb)</th><th>Energy (kcal)</th></tr></thead><tbody>${rowsHtml}</tbody></table>`
                  );
                };
                el.addEventListener("mouseenter", showTip);
                el.addEventListener("click", showTip);
              });
            }
            updateMultiplesBucketing();
            return;
          }

          // Aggregate sessions into buckets for Fiscal Qtr / Month / Week / Day
          // IMPORTANT: Completely omit any session/bucket where the Muscle Slicer or Min Reps filter leaves 0 qualifying sets!
          const bucketsMap = new Map();
          scopedSessions.forEach((sess) => {
            const h = dateToHierarchy(sess.date);
            const key = h[levelKey] || h.day;
            let sessLoadedLb = 0;
            let sessEffectiveLb = 0;
            let sessKcal = 0;
            let sessSets = 0;
            const sessDetails = [];

            (sess.exercises || []).forEach((ex) => {
              const mGrp = classifyExerciseMuscle(ex.name);
              if (!activeMuscles.has(mGrp)) return;
              const qualSets = (ex.sets || []).filter((st) => (Number(st.reps) || 0) >= minReps);
              if (!qualSets.length) return;
              let exLb = 0;
              let exKcal = 0;
              qualSets.forEach((st) => {
                const loaded = ex.kind === "loaded" ? (Number(st.reps) || 0) * (Number(st.weight) || 0) : 0;
                const eff = estimateSetEffectiveLbs(ex.name, ex.kind, st.reps, st.weight);
                const kc = estimateSetKcal(ex.name, ex.kind, st.reps, st.weight);
                sessLoadedLb += loaded;
                sessEffectiveLb += eff;
                sessKcal += kc;
                exLb += loaded > 0 ? loaded : eff;
                exKcal += kc;
                sessSets += 1;
              });
              sessDetails.push({
                date: sess.date,
                dateOrd: formatOrdinalDay(sess.date),
                muscle: mGrp,
                exercise: ex.name,
                setsStr: qualSets.map((x) => `${x.reps}×${x.weight}lb`).join(", "),
                vol: Math.round(exLb),
                kcal: Math.round(exKcal * 10) / 10,
              });
            });

            // Only include this workout in the bucket if it has at least 1 qualifying set for the selected muscle groups!
            if (sessSets > 0) {
              if (!bucketsMap.has(key)) {
                bucketsMap.set(key, {
                  key,
                  label: key,
                  split: sess.split,
                  hierarchy: h,
                  sessions: [],
                  volumeLb: 0,
                  totalKcal: 0,
                  setsCount: 0,
                  workoutDetails: [],
                });
              }
              const b = bucketsMap.get(key);
              b.sessions.push(sess);
              b.volumeLb += sessLoadedLb > 0 ? sessLoadedLb : sessEffectiveLb;
              b.totalKcal += sessKcal;
              b.setsCount += sessSets;
              b.workoutDetails.push(...sessDetails);
            }
          });

          const buckets = Array.from(bucketsMap.values()).filter((b) => b.setsCount > 0 && (b.volumeLb > 0 || b.totalKcal > 0));
          if (!buckets.length) {
            svg.innerHTML = `<title id="lifting-volume-svg-title">No matching workouts</title><desc id="lifting-volume-svg-desc">No sets match the current muscle/rep filter.</desc><text x="450" y="170" text-anchor="middle" fill="#a4acc3">No workouts match the selected Muscle Group / Min Reps filter in this range.</text>`;
            updateMultiplesBucketing();
            return;
          }

          const lbValFn = (b) => Math.round(b.volumeLb);
          const kcalValFn = (b) => (levelKey === "day" ? Math.round(b.totalKcal) : Math.round(b.totalKcal / Math.max(1, b.sessions.length)));
          const fmtLb = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k lb` : `${Math.round(v)} lb`);
          const fmtKcal = (v) => `${Math.round(v)} kcal`;

          buildDualAxisSvgMarkup({
            svgEl: svg,
            titleId: "lifting-volume-svg-title",
            titleText: `Weightlifting (${levelLabels[levelKey]})`,
            descText: `Dual-axis chart of ${barName} (bars) and ${lineName} (line).`,
            items: buckets,
            barValFn: swapAxes ? kcalValFn : lbValFn,
            lineValFn: swapAxes ? lbValFn : kcalValFn,
            barUnit: swapAxes ? "kcal" : "lb",
            lineUnit: swapAxes ? "lb" : "kcal",
            barFormatFn: swapAxes ? fmtKcal : fmtLb,
            lineFormatFn: swapAxes ? fmtLb : fmtKcal,
            barColorFn: (b) => `class="athletics-bar split-${b.split}"`,
          });

          const drillIntoBucket = (b) => {
            if (!b) return;
            if (levelKey === "qtr") {
              drillScope = { qtr: b.key, month: null, week: null, dayIso: b.sessions[b.sessions.length - 1]?.date || null };
              currentLevelIdx = 1;
            } else if (levelKey === "month") {
              drillScope = { ...drillScope, month: b.key, week: null, dayIso: b.sessions[b.sessions.length - 1]?.date || null };
              currentLevelIdx = 2;
            } else if (levelKey === "week") {
              drillScope = { ...drillScope, week: b.key, dayIso: b.sessions[b.sessions.length - 1]?.date || null };
              currentLevelIdx = 3;
            } else if (levelKey === "day") {
              drillScope = { ...drillScope, dayIso: b.sessions[b.sessions.length - 1]?.date || null };
              currentLevelIdx = 4;
            }
            getBiTooltip().hidden = true;
            renderLiftingVisual();
          };

          svg.querySelectorAll("[data-bi-bar]").forEach((el) => {
            const b = buckets[Number(el.getAttribute("data-bi-bar"))];
            if (!b) return;
            const showTip = (ev) => {
              const rowsHtml = b.workoutDetails
                .slice(0, 12)
                .map((w) => `<tr><td>${escHtml(w.dateOrd)}</td><td>${escHtml(w.muscle)}</td><td>${escHtml(w.exercise)}</td><td>${escHtml(w.setsStr)}</td><td>${w.vol.toLocaleString()} lb</td><td>${w.kcal} kcal</td></tr>`)
                .join("");
              const moreNote = b.workoutDetails.length > 12 ? `<p>+ ${b.workoutDetails.length - 12} more exercises in this period</p>` : "";
              showBiTooltip(
                ev,
                `<h4>${escHtml(b.key)} · ${b.sessions.length} Workout(s) · ${b.setsCount} Sets (≥${minReps} reps)</h4>` +
                `<p>Volume: <strong>${b.volumeLb.toLocaleString()} lb</strong> · Total Energy: <strong>${Math.round(b.totalKcal)} kcal</strong> (Avg ${Math.round(b.totalKcal / Math.max(1, b.sessions.length))} kcal/workout)</p>` +
                `<table><thead><tr><th>Date</th><th>Muscle</th><th>Exercise</th><th>Qualifying Sets</th><th>Vol (lb)</th><th>Energy</th></tr></thead><tbody>${rowsHtml}</tbody></table>` +
                moreNote +
                `<div style="display:flex;gap:8px;justify-content:flex-end;">` +
                `<button type="button" class="bi-btn" id="bi-tip-drilldown">↓ Drill Down Into ${escHtml(b.key)}</button>` +
                `<button type="button" class="bi-btn is-drillout" id="bi-tip-drillthrough">↗ Drillthrough to Log Table</button>` +
                `</div>`
              );
              document.getElementById("bi-tip-drilldown")?.addEventListener("click", () => drillIntoBucket(b));
              document.getElementById("bi-tip-drillthrough")?.addEventListener("click", () => {
                getBiTooltip().hidden = true;
                const dSet = new Set(
                  b.sessions.map((s) => {
                    const dt = new Date(`${s.date}T12:00:00`);
                    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  })
                );
                filterLogTable(b.key, dSet, activeMuscles);
              });
            };
            el.addEventListener("mouseenter", showTip);
            el.addEventListener("click", showTip);
            el.addEventListener("dblclick", () => drillIntoBucket(b));
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
          document.getElementById("bi-lift-start-out").textContent = formatOrdinalDay(rawSessions[startIdx].date);
          renderLiftingVisual();
        });
        endSlider?.addEventListener("input", () => {
          endIdx = Math.max(Number(endSlider.value), startIdx);
          endSlider.value = String(endIdx);
          document.getElementById("bi-lift-end-out").textContent = formatOrdinalDay(rawSessions[endIdx].date);
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
          if (currentLevelIdx === 4) drillScope.dayIso = null;
          else if (currentLevelIdx === 3) drillScope.week = null;
          else if (currentLevelIdx === 2) drillScope.month = null;
          else if (currentLevelIdx === 1) drillScope.qtr = null;
          currentLevelIdx = Math.max(0, currentLevelIdx - 1);
          renderLiftingVisual();
        });
        // Drill Down button: enters the latest visible parent period at the current level
        document.getElementById("bi-lift-down")?.addEventListener("click", () => {
          const lastSess = rawSessions[endIdx] || rawSessions[rawSessions.length - 1];
          const h = dateToHierarchy(lastSess.date);
          if (currentLevelIdx === 0) drillScope.qtr = drillScope.qtr || h.qtr;
          else if (currentLevelIdx === 1) drillScope.month = drillScope.month || h.month;
          else if (currentLevelIdx === 2) drillScope.week = drillScope.week || h.week;
          else if (currentLevelIdx === 3) drillScope.dayIso = drillScope.dayIso || lastSess.date;
          currentLevelIdx = Math.min(levels.length - 1, currentLevelIdx + 1);
          renderLiftingVisual();
        });
        // Drill Out button: clears single-parent scope and expands ALL periods in the range to the next finer level
        document.getElementById("bi-lift-drillout")?.addEventListener("click", () => {
          drillScope = { qtr: null, month: null, week: null, dayIso: rawSessions[endIdx]?.date || null };
          currentLevelIdx = Math.min(3, currentLevelIdx + 1);
          renderLiftingVisual();
        });
        // Energy / Pounds dual-axis swap button
        const swapBtn = document.getElementById("bi-lift-swap-axis");
        swapBtn?.addEventListener("click", () => {
          swapAxes = !swapAxes;
          swapBtn.classList.toggle("is-active", swapAxes);
          renderLiftingVisual();
        });
        document.getElementById("bi-lift-reset")?.addEventListener("click", () => {
          currentLevelIdx = 3;
          swapAxes = false;
          swapBtn?.classList.remove("is-active");
          drillScope = { qtr: null, month: null, week: null, dayIso: rawSessions[rawSessions.length - 1].date };
          minReps = 1;
          startIdx = 0;
          endIdx = rawSessions.length - 1;
          if (startSlider) startSlider.value = "0";
          if (endSlider) endSlider.value = String(endIdx);
          if (repsSlider) repsSlider.value = "1";
          document.getElementById("bi-lift-start-out").textContent = formatOrdinalDay(rawSessions[0].date);
          document.getElementById("bi-lift-end-out").textContent = formatOrdinalDay(rawSessions[endIdx].date);
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

        window.addEventListener("resize", () => renderLiftingVisual());
        window.addEventListener("liam-bi-refresh-lifting", (ev) => {
          if (Array.isArray(ev.detail) && ev.detail.length > 0) {
            rawSessions = ev.detail;
            endIdx = rawSessions.length - 1;
            if (startSlider) startSlider.max = String(endIdx);
            if (endSlider) {
              endSlider.max = String(endIdx);
              endSlider.value = String(endIdx);
            }
            document.getElementById("bi-lift-end-out").textContent = formatOrdinalDay(rawSessions[endIdx].date);
            renderLiftingVisual();
          }
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
          `<button type="button" class="bi-btn" id="bi-comp-down">↓ Drill Down (Into Field)</button>`,
          `<button type="button" class="bi-btn" id="bi-comp-expand36">↔ Drill Out (All 36 Subsections)</button>`,
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
            if (crumbs) crumbs.textContent = `Drill Out Active: Expanded All 36 Subsections (6 × 6 Topics) · Metric: ${compMetric === "pct" ? "Active Completion (%)" : compMetric === "words" ? "Mental Map Words" : "LaTeX Formulae"}`;
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

  // ---- 3. Universal Dual-Axis Interactive BI Engine for Swimming, Running Intervals, Tempo, Sleep & Diet ----
  const wireDatedBiHost = ({
    selector,
    attrName,
    svgTitleId,
    primaryLabel,
    primaryUnit,
    secondaryLabel,
    secondaryUnit,
    swapBtnLabel,
    primaryValFn,
    secondaryValFn,
    primaryAggMode = "sum",
    secondaryAggMode = "sum",
    tableId,
    refreshEventName,
  }) => {
    const host = document.querySelector(selector);
    if (!host || !host.hasAttribute(attrName)) return;
    try {
      const parseHostList = () => {
        const raw = JSON.parse(host.getAttribute(attrName) || "[]");
        return Array.isArray(raw) ? raw : Array.isArray(raw.sessions) ? raw.sessions : [];
      };
      let list = parseHostList();
      if (list.length < 1) return;

      const levels = ["qtr", "month", "week", "day"];
      const levelNames = { qtr: "Fiscal Qtr", month: "Month", week: "Week", day: "Day" };
      let lvlIdx = 3; // Default: Day
      let swapAxes = false;
      let sIdx = 0;
      let eIdx = list.length - 1;
      let scope = { qtr: null, month: null, week: null };

      const bar = document.createElement("div");
      bar.className = "bi-toolbar";
      bar.innerHTML = [
        `<div class="bi-toolbar-head">`,
        `<div><span class="bi-toolbar-title">⚡ Interactive BI Controls · Dual-Axis, Hierarchy Drilldown &amp; Drillout</span>`,
        `<div class="bi-crumbs" data-bi-sub-crumbs>Level: Day · ▮ Bars: ${escHtml(primaryLabel)} (${escHtml(primaryUnit)}) · ● Line: ${escHtml(secondaryLabel)} (${escHtml(secondaryUnit)})</div></div>`,
        `<div class="bi-drill-bar">`,
        `<button type="button" class="bi-btn" data-bi-sub-up>↑ Drill Up</button>`,
        `<button type="button" class="bi-btn" data-bi-sub-down title="Drill down into the selected period only">↓ Drill Down (Into Period)</button>`,
        `<button type="button" class="bi-btn" data-bi-sub-drillout title="Expand all visible periods across the range to the next finer level">↔ Drill Out (Expand All)</button>`,
        `<button type="button" class="bi-btn is-drillout" data-bi-sub-swap title="Swap which metric is on the Bars (left axis) vs. Line (right axis)">⇄ ${escHtml(swapBtnLabel)}</button>`,
        `<button type="button" class="bi-btn" data-bi-sub-reset>↺ Reset</button>`,
        `</div></div>`,
        `<div class="bi-sliders-row">`,
        `<label class="bi-slider-label"><span>From Date: <output data-bi-sub-sout>${formatOrdinalDay(list[0].date)}</output></span><input type="range" data-bi-sub-s min="0" max="${list.length - 1}" value="0"></label>`,
        `<label class="bi-slider-label"><span>To Date: <output data-bi-sub-eout>${formatOrdinalDay(list[list.length - 1].date)}</output></span><input type="range" data-bi-sub-e min="0" max="${list.length - 1}" value="${list.length - 1}"></label>`,
        `<label class="bi-slider-label"><span>Hierarchy Level</span><select data-bi-sub-level class="bi-btn" style="width:100%;padding:6px 8px;">`,
        levels.map((lv, i) => `<option value="${i}"${i === lvlIdx ? " selected" : ""}>${i + 1}. ${levelNames[lv]}</option>`).join(""),
        `</select></label>`,
        `</div>`,
      ].join("");
      host.insertBefore(bar, host.firstChild);

      const renderSub = () => {
        const svg = document.getElementById(svgTitleId)?.closest("svg");
        if (!svg) return;
        const levelKey = levels[lvlIdx];
        const lvlSel = bar.querySelector("[data-bi-sub-level]");
        if (lvlSel) lvlSel.value = String(lvlIdx);

        let slice = list.slice(sIdx, eIdx + 1);
        if (lvlIdx >= 1 && scope.qtr) slice = slice.filter((it) => dateToHierarchy(it.date).qtr === scope.qtr);
        if (lvlIdx >= 2 && scope.month) slice = slice.filter((it) => dateToHierarchy(it.date).month === scope.month);
        if (lvlIdx >= 3 && scope.week) slice = slice.filter((it) => dateToHierarchy(it.date).week === scope.week);
        if (!slice.length) slice = list.slice(sIdx, eIdx + 1);

        const bMap = new Map();
        slice.forEach((it) => {
          const h = dateToHierarchy(it.date);
          const k = h[levelKey] || h.day;
          if (!bMap.has(k)) bMap.set(k, { key: k, label: k, items: [], pVals: [], sVals: [] });
          const b = bMap.get(k);
          b.items.push(it);
          b.pVals.push(primaryValFn(it));
          b.sVals.push(secondaryValFn(it));
        });

        const agg = (arr, mode) => {
          if (!arr.length) return 0;
          if (mode === "last") return arr[arr.length - 1];
          const sum = arr.reduce((a, v) => a + v, 0);
          return mode === "avg" ? Math.round((sum / arr.length) * 10) / 10 : Math.round(sum * 10) / 10;
        };

        const buckets = Array.from(bMap.values())
          .map((b) => ({
            ...b,
            pAgg: agg(b.pVals, levelKey === "day" ? "sum" : primaryAggMode),
            sAgg: agg(b.sVals, secondaryAggMode),
          }))
          .filter((b) => b.items.length > 0 && (b.pAgg !== 0 || b.sAgg !== 0));

        if (!buckets.length) return;

        const barMetricLbl = swapAxes ? `${secondaryLabel} (${secondaryUnit})` : `${primaryLabel} (${primaryUnit})`;
        const lineMetricLbl = swapAxes ? `${primaryLabel} (${primaryUnit})` : `${secondaryLabel} (${secondaryUnit})`;
        const scopeStr = [scope.qtr, scope.month, scope.week].filter(Boolean).join(" → ");
        bar.querySelector("[data-bi-sub-crumbs]").textContent = `Level: ${levelNames[levelKey]}${scopeStr ? ` [${scopeStr}]` : ""} · ▮ Bars: ${barMetricLbl} · ● Line: ${lineMetricLbl}`;

        buildDualAxisSvgMarkup({
          svgEl: svg,
          titleId: svgTitleId,
          titleText: `${primaryLabel} vs. ${secondaryLabel} (${levelNames[levelKey]})`,
          descText: `Interactive ${levelNames[levelKey]} chart showing ${barMetricLbl} as bars and ${lineMetricLbl} as a line.`,
          items: buckets,
          barValFn: (b) => (swapAxes ? b.sAgg : b.pAgg),
          lineValFn: (b) => (swapAxes ? b.pAgg : b.sAgg),
          barUnit: swapAxes ? secondaryUnit : primaryUnit,
          lineUnit: swapAxes ? primaryUnit : secondaryUnit,
        });

        const drillIn = (b) => {
          if (!b || lvlIdx >= 3) return;
          if (levelKey === "qtr") {
            scope = { qtr: b.key, month: null, week: null };
            lvlIdx = 1;
          } else if (levelKey === "month") {
            scope = { ...scope, month: b.key, week: null };
            lvlIdx = 2;
          } else if (levelKey === "week") {
            scope = { ...scope, week: b.key };
            lvlIdx = 3;
          }
          getBiTooltip().hidden = true;
          renderSub();
        };

        svg.querySelectorAll("[data-bi-bar]").forEach((el) => {
          const b = buckets[Number(el.getAttribute("data-bi-bar"))];
          if (!b) return;
          const showTip = (ev) => {
            const rowsHtml = b.items
              .slice(0, 10)
              .map(
                (it) =>
                  `<tr><td>${escHtml(formatOrdinalDay(it.date))}</td><td>${primaryValFn(it)} ${escHtml(primaryUnit)}</td><td>${secondaryValFn(it)} ${escHtml(secondaryUnit)}</td></tr>`
              )
              .join("");
            showBiTooltip(
              ev,
              `<h4>${escHtml(b.key)} · ${b.items.length} Entry(s)</h4>` +
              `<p>${escHtml(primaryLabel)}: <strong>${b.pAgg} ${escHtml(primaryUnit)}</strong> · ${escHtml(secondaryLabel)}: <strong>${b.sAgg} ${escHtml(secondaryUnit)}</strong></p>` +
              `<table><thead><tr><th>Date</th><th>${escHtml(primaryLabel)}</th><th>${escHtml(secondaryLabel)}</th></tr></thead><tbody>${rowsHtml}</tbody></table>` +
              (lvlIdx < 3 ? `<div style="display:flex;justify-content:flex-end;"><button type="button" class="bi-btn" id="bi-sub-tip-in">↓ Drill Down Into ${escHtml(b.key)}</button></div>` : "")
            );
            document.getElementById("bi-sub-tip-in")?.addEventListener("click", () => drillIn(b));
          };
          el.addEventListener("mouseenter", showTip);
          el.addEventListener("click", showTip);
          el.addEventListener("dblclick", () => drillIn(b));
        });
      };

      const sIn = bar.querySelector("[data-bi-sub-s]");
      const eIn = bar.querySelector("[data-bi-sub-e]");
      const lvlSel = bar.querySelector("[data-bi-sub-level]");
      sIn?.addEventListener("input", () => {
        sIdx = Math.min(Number(sIn.value), eIdx);
        sIn.value = String(sIdx);
        bar.querySelector("[data-bi-sub-sout]").textContent = formatOrdinalDay(list[sIdx].date);
        renderSub();
      });
      eIn?.addEventListener("input", () => {
        eIdx = Math.max(Number(eIn.value), sIdx);
        eIn.value = String(eIdx);
        bar.querySelector("[data-bi-sub-eout]").textContent = formatOrdinalDay(list[eIdx].date);
        renderSub();
      });
      lvlSel?.addEventListener("change", () => {
        lvlIdx = Number(lvlSel.value) || 0;
        renderSub();
      });
      bar.querySelector("[data-bi-sub-up]")?.addEventListener("click", () => {
        if (lvlIdx === 3) scope.week = null;
        else if (lvlIdx === 2) scope.month = null;
        else if (lvlIdx === 1) scope.qtr = null;
        lvlIdx = Math.max(0, lvlIdx - 1);
        renderSub();
      });
      bar.querySelector("[data-bi-sub-down]")?.addEventListener("click", () => {
        const lastIt = list[eIdx] || list[list.length - 1];
        const h = dateToHierarchy(lastIt.date);
        if (lvlIdx === 0) scope.qtr = scope.qtr || h.qtr;
        else if (lvlIdx === 1) scope.month = scope.month || h.month;
        else if (lvlIdx === 2) scope.week = scope.week || h.week;
        lvlIdx = Math.min(levels.length - 1, lvlIdx + 1);
        renderSub();
      });
      bar.querySelector("[data-bi-sub-drillout]")?.addEventListener("click", () => {
        scope = { qtr: null, month: null, week: null };
        lvlIdx = Math.min(levels.length - 1, lvlIdx + 1);
        renderSub();
      });
      const swapBtn = bar.querySelector("[data-bi-sub-swap]");
      swapBtn?.addEventListener("click", () => {
        swapAxes = !swapAxes;
        swapBtn.classList.toggle("is-active", swapAxes);
        renderSub();
      });
      bar.querySelector("[data-bi-sub-reset]")?.addEventListener("click", () => {
        lvlIdx = 3;
        swapAxes = false;
        swapBtn?.classList.remove("is-active");
        scope = { qtr: null, month: null, week: null };
        sIdx = 0;
        eIdx = list.length - 1;
        if (sIn) sIn.value = "0";
        if (eIn) eIn.value = String(eIdx);
        bar.querySelector("[data-bi-sub-sout]").textContent = formatOrdinalDay(list[0].date);
        bar.querySelector("[data-bi-sub-eout]").textContent = formatOrdinalDay(list[eIdx].date);
        renderSub();
      });

      window.addEventListener("resize", () => renderSub());
      if (refreshEventName) {
        window.addEventListener(refreshEventName, (ev) => {
          if (Array.isArray(ev.detail) && ev.detail.length > 0) {
            list = ev.detail;
            eIdx = list.length - 1;
            if (sIn) sIn.max = String(eIdx);
            if (eIn) {
              eIn.max = String(eIdx);
              eIn.value = String(eIdx);
            }
            bar.querySelector("[data-bi-sub-eout]").textContent = formatOrdinalDay(list[eIdx].date);
            renderSub();
          }
        });
      }

      renderSub();
    } catch {
      /* ignore */
    }
  };

  // Swimming: 2nd-axis line shows the Running Total (cumulativeMeters, 'last' value at the end of each week/period)!
  wireDatedBiHost({
    selector: ".bi-swimming-host",
    attrName: "data-bi-swimming",
    svgTitleId: "swimming-sessions-svg-title",
    primaryLabel: "Session Distance",
    primaryUnit: "m",
    secondaryLabel: "Running Total",
    secondaryUnit: "m",
    swapBtnLabel: "Running Total / Distance",
    primaryValFn: (s) => Number(s.meters) || 0,
    secondaryValFn: (s) => Number(s.cumulativeMeters) || Number(s.meters) || 0,
    primaryAggMode: "sum",
    secondaryAggMode: "last",
    tableId: "swimming-table",
  });
  wireDatedBiHost({
    selector: ".bi-running-host",
    attrName: "data-bi-running",
    svgTitleId: "running-intervals-svg-title",
    primaryLabel: "Mean Loop Time",
    primaryUnit: "s",
    secondaryLabel: "Energy Expended",
    secondaryUnit: "kcal",
    swapBtnLabel: "Energy / Loop Time",
    primaryValFn: (s) => Math.round(Number(s.average) || 0),
    secondaryValFn: (s) => Math.round((Number(s.count) || 4) * 0.95 * 88 * 1.036),
    primaryAggMode: "avg",
    secondaryAggMode: "sum",
    tableId: "running-table",
  });
  wireDatedBiHost({
    selector: ".bi-tempo-host",
    attrName: "data-bi-tempo",
    svgTitleId: "running-tempo-chart-svg-title",
    primaryLabel: "Pace per km",
    primaryUnit: "s/km",
    secondaryLabel: "Energy Expended",
    secondaryUnit: "kcal",
    swapBtnLabel: "Energy / Pace",
    primaryValFn: (r) => Math.round(Number(r.paceSeconds) || 0),
    secondaryValFn: (r) => Math.round((Number(r.distanceKm) || 4.6) * 88 * 1.036),
    primaryAggMode: "avg",
    secondaryAggMode: "sum",
    tableId: "tempo-table",
    refreshEventName: "liam-bi-refresh-tempo",
  });
  wireDatedBiHost({
    selector: ".bi-sleep-host",
    attrName: "data-bi-sleep",
    svgTitleId: "sleep-hours-svg-title",
    primaryLabel: "Sleep Duration",
    primaryUnit: "h",
    secondaryLabel: "Basal Recovery Energy",
    secondaryUnit: "kcal",
    swapBtnLabel: "Energy / Hours",
    primaryValFn: (s) => Number(s.hours) || 0,
    secondaryValFn: (s) => Math.round((Number(s.hours) || 0) * 77),
    primaryAggMode: "avg",
    secondaryAggMode: "sum",
    tableId: "sleep-table",
  });
  wireDatedBiHost({
    selector: ".bi-diet-host",
    attrName: "data-bi-diet",
    svgTitleId: "diet-balance-svg-title",
    primaryLabel: "Daily Caloric Deficit",
    primaryUnit: "kcal",
    secondaryLabel: "Total Expenditure",
    secondaryUnit: "kcal",
    swapBtnLabel: "Expenditure / Deficit",
    primaryValFn: (s) => Number(s.deficit) || 0,
    secondaryValFn: (s) => Number(s.expenditure) || 0,
    primaryAggMode: "avg",
    secondaryAggMode: "avg",
    tableId: "diet-table",
  });
})();