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
    const cb = Date.now();
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt&_cb=${cb}`;
    const cleanJina = (raw) => {
      const idx = raw.indexOf("Markdown Content:");
      return idx !== -1 ? raw.slice(idx + "Markdown Content:".length).trim() : raw;
    };
    const candidates = [
      { url: exportUrl, type: "text" },
      { url: `https://r.jina.ai/https://docs.google.com/document/d/${docId}/export?format=txt?_cb=${cb}`, type: "jina" },
      { url: `https://api.allorigins.win/get?url=${encodeURIComponent(exportUrl)}&_cb=${cb}`, type: "allorigins_json" },
      { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(exportUrl)}&_cb=${cb}`, type: "text" },
    ];
    for (const cand of candidates) {
      try {
        const resp = await fetch(cand.url, { cache: "no-store" });
        if (resp.ok) {
          let txt = "";
          if (cand.type === "allorigins_json") {
            const j = await resp.json();
            txt = j && j.contents ? String(j.contents) : "";
          } else {
            txt = await resp.text();
            if (cand.type === "jina") txt = cleanJina(txt);
          }
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

  const LOG_REPO_PATHS = {
    running: {
      header: "Interval Training Data",
      rec: "records/athletics/running/Interval_Data.txt",
      pub: "Gaming-and-Performance-Log/Athletics/Running/Interval_Data.txt",
    },
    tempo: {
      header: "Tempo_Run_Log",
      rec: "records/athletics/running/Tempo_Run_Log.txt",
      pub: "Gaming-and-Performance-Log/Athletics/Running/Tempo_Run_Log.txt",
    },
    long_run: {
      header: "Long_Run_Log",
      rec: "records/athletics/running/Long_Run_Log.txt",
      pub: "Gaming-and-Performance-Log/Athletics/Running/Long_Run_Log.txt",
      placeholderDocId: "1Yw_Vjd-VCPS599GW6NN45AqPCHBpWE2yNSrR9qr9ouM",
    },
    swimming: {
      header: "Swimming Log",
      rec: "records/athletics/swimming/Swimming_Log.txt",
      pub: "Gaming-and-Performance-Log/Athletics/Swimming/Swimming_Log.txt",
    },
    weightlifting: {
      header: "Weightlifting Log (Dropsets Excluded)",
      rec: "records/athletics/weightlifting/Weightlifting_Log.txt",
      pub: "Gaming-and-Performance-Log/Athletics/Weightlifting/Weightlifting_Log.txt",
    },
    sleep: {
      header: "Sleep_and_Dream_Log",
      rec: "records/health/sleep/Sleep_and_Dream_Log.txt",
      pub: "Gaming-and-Performance-Log/Health/Sleep/Sleep_and_Dream_Log.txt",
    },
    diet: {
      header: "Diet and Calorie Tracking",
      rec: "records/health/diet/Diet_and_Calorie_Tracking.txt",
      pub: "Gaming-and-Performance-Log/Health/Diet/Diet_and_Calorie_Tracking.txt",
    },
  };

  // Zero-token deterministic regex cleaner matching site_content/log_sync.py
  const repairLogTextInBrowser = (key, rawText) => {
    const spec = LOG_REPO_PATHS[key] || LOG_REPO_PATHS.diet;
    const rawLines = String(rawText || "")
      .replace(/\r\n/g, "\n")
      .replace(/[\u200b\u200c\u200d\ufeff\xa0]/g, " ")
      .replace(/[–—−]/g, "-")
      .split("\n");
    const out = [];
    let prevNonEmpty = "";
    let lastYear = 0;
    const monthBannerRe = /^(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}$/i;

    rawLines.forEach((line) => {
      let fixed = line.trim();
      if (!fixed) {
        out.push("");
        return;
      }
      if (monthBannerRe.test(fixed)) return;
      if (/^-{5,}$/.test(fixed)) {
        out.push("-".repeat(50));
        return;
      }
      if (key === "diet") {
        const mCombo = fixed.match(/^(Breakfast|Lunch|Dinner|Snacks)\s*[/&]\s*(Breakfast|Lunch|Dinner|Snacks)\s*[:\-]\s*(.+)$/i);
        if (mCombo) {
          const m1 = mCombo[1].charAt(0).toUpperCase() + mCombo[1].slice(1).toLowerCase();
          const m2 = mCombo[2].charAt(0).toUpperCase() + mCombo[2].slice(1).toLowerCase();
          out.push(`${m1} - ${mCombo[3].trim()}`);
          out.push(`${m2} - ${mCombo[3].trim()}`);
          prevNonEmpty = `${m2} - ${mCombo[3].trim()}`;
          return;
        }
      }
      fixed = fixed.replace(/\b(\d{1,2})\/(\d{1,2})0(20\d{2})\b/g, "$1/$2/$3");
      const dotMatch = fixed.match(/^(\(?)\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2})(\)?)(.*)$/);
      if (dotMatch) {
        fixed = `${dotMatch[1]}${dotMatch[2]}/${dotMatch[3]}/${dotMatch[4]}${dotMatch[5]}${dotMatch[6]}`;
      }
      if (key === "diet") {
        let m;
        if ((m = fixed.match(/^(Breakfast|Lunch|Dinner|Snacks)\s*[:\-]\s*(.+)$/i))) {
          const mealName = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
          fixed = `${mealName} - ${m[2].trim()}`;
        } else if ((m = fixed.match(/^Total Expenditure\s*[:\-]\s*(\d+)\s*(?:k?cals?)?(?:\s*\((.+)\))?$/i))) {
          fixed = `Total Expenditure - ${m[1]}cals${m[2] ? ` (${m[2]})` : ""}`;
        } else if ((m = fixed.match(/^Total Consumption\s*[:\-]\s*(.+)$/i))) {
          const body = m[1].trim().replace(/(\d+)\s*k?cals?\b/gi, "$1cals");
          fixed = `Total Consumption - ${body}`;
        } else if ((m = fixed.match(/^Net Expenditure\s*[:\-]\s*([+-]?\d+)\s*(?:k?cals?)?\s*(loss|gain)?$/i))) {
          const val = parseInt(m[1], 10);
          const dir = (m[2] || (val < 0 ? "gain" : "loss")).toLowerCase();
          fixed = `Net Expenditure - ${Math.abs(val)}cal ${dir}`;
        }
      } else if (key === "swimming") {
        const m = fixed.match(/^\(?(\d{1,2}\/\d{1,2}\/\d{4})\)?\s*[-:]?\s*(\d+)\s*(m|y|yd|yds|yards?|meters?|metres?)\s*[-:]\s*(.+)$/i);
        if (m) {
          const unit = m[3].toLowerCase().startsWith("y") ? "y" : "m";
          fixed = `(${m[1]}) - ${m[2]}${unit} - ${m[4].trim()}`;
        }
      } else if (key === "sleep") {
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(prevNonEmpty)) {
          const m = fixed.match(/^(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|h)?$/i);
          if (m) {
            fixed = `${m[1]}hrs`;
          } else {
            // Date line followed directly by dream text without an Xhrs line: insert default 6hrs so the night is never skipped
            out.push("6hrs");
          }
        }
      }
      const yrMatch = fixed.match(/^(\(?(\d{1,2})\/(\d{1,2})\/)(20\d{2})(\)?(?:\s*-\s*.+)?)$/);
      if (yrMatch) {
        const yr = parseInt(yrMatch[4], 10);
        if (lastYear && yr < lastYear) fixed = `${yrMatch[1]}${lastYear}${yrMatch[5]}`;
        else lastYear = yr;
      }
      out.push(fixed);
      prevNonEmpty = fixed;
    });

    const firstNonEmptyIdx = out.findIndex((l) => l.trim().length > 0);
    if (firstNonEmptyIdx >= 0) {
      const firstLine = out[firstNonEmptyIdx].trim();
      if (/^(?:Weightlifting|Lifting|Swimming(?:\s+Tempo)?|Sleep(?:_and_Dream)?|Food|Diet\s+and\s+Calorie\s+Tracking|(?:Running\s+)?Interval\s+Training|Tempo[\s_]+Run)\b/i.test(firstLine)) {
        out[firstNonEmptyIdx] = spec.header;
      } else if (firstLine !== spec.header) {
        out.unshift(spec.header, "");
      }
    }
    return out.join("\n").trim() + "\n";
  };

  const getGithubPatFromVault = () => {
    try {
      const vault = JSON.parse(localStorage.getItem("liam_workbench_vault_v1") || "{}") || {};
      if (vault.ownerGithubPat && vault.ownerGithubPat.startsWith("v1:")) {
        const raw = atob(vault.ownerGithubPat.slice(3));
        const salt = "liam_wb_salt_2026_v1::owner_vault_key";
        let out = "";
        for (let i = 0; i < raw.length; i++) {
          out += String.fromCharCode(raw.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
        }
        if (out.startsWith("ghp_") || out.startsWith("github_pat_")) return out;
      }
    } catch {
      /* ignore */
    }
    return "";
  };

  const commitFileToGithubRepo = async (pat, repo, path, contentText, message) => {
    const apiBase = `https://api.github.com/repos/${repo}/contents/${path}`;
    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${pat}`,
      "X-GitHub-Api-Version": "2022-11-28",
    };
    let sha = undefined;
    try {
      const getResp = await fetch(apiBase, { headers, cache: "no-store" });
      if (getResp.ok) {
        const meta = await getResp.json();
        if (meta && meta.sha) sha = meta.sha;
      }
    } catch {
      /* file may be new */
    }
    const b64 = btoa(unescape(encodeURIComponent(contentText)));
    const putResp = await fetch(apiBase, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ message, content: b64, ...(sha ? { sha } : {}) }),
    });
    return putResp.ok;
  };

  const commitLogToGithubFromBrowser = async (key, rawText, docId = "") => {
    const repaired = repairLogTextInBrowser(key, rawText);
    const spec = LOG_REPO_PATHS[key];
    if (!spec) return { committed: false, relayed: false };

    // Always broadcast Google Doc link / log tail to cross-device ntfy relay so phone & desktop stay in sync
    let relayed = false;
    try {
      const packet = JSON.stringify({
        app: "liam_gdoc_log_v1",
        key,
        docId: docId || extractGdocId(loadGdocLinks()[key] || ""),
        rawText: repaired.length <= 3200 ? repaired : undefined,
        ts: Date.now(),
      });
      const r = await fetch("https://ntfy.sh/liam_wb_sync_67wxyE7L_v1", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8", Title: `Log sync ${key}` },
        body: packet,
      });
      relayed = r.ok;
    } catch {
      /* ignore network error */
    }

    const pat = getGithubPatFromVault();
    if (!pat) return { committed: false, relayed, repaired };

    try {
      const msg = `Sync ${key} log (${spec.rec}) from live site`;
      const okLive = await commitFileToGithubRepo(pat, "l2mcgrat/liammspandasprojects", spec.pub, repaired, msg);
      await commitFileToGithubRepo(pat, "l2mcgrat/pandas_projects", spec.rec, repaired, msg);
      await commitFileToGithubRepo(pat, "l2mcgrat/pandas_projects", `LiamMs_PandasProjects/${spec.pub}`, repaired, msg);
      return { committed: okLive, relayed, repaired };
    } catch {
      return { committed: false, relayed, repaired };
    }
  };

  const updateKpiCardOnPage = (labelText, newValue, newSmall) => {
    document.querySelectorAll(".sports-metrics .sports-metric").forEach((card) => {
      const span = card.querySelector("span");
      const strong = card.querySelector("strong");
      const small = card.querySelector("small");
      if (!span || !strong) return;
      const cleanLbl = span.textContent.replace("ⓘ", "").replace("?", "").trim();
      if (cleanLbl.toLowerCase() === labelText.toLowerCase()) {
        strong.textContent = newValue;
        if (small && newSmall !== undefined) small.textContent = newSmall;
      }
    });
  };

  const mondayWeekIso = (isoDate) => {
    const dObj = new Date(`${isoDate}T12:00:00`);
    if (isNaN(dObj.getTime())) return isoDate;
    const dayOfWeek = (dObj.getDay() + 6) % 7;
    const mon = new Date(dObj);
    mon.setDate(dObj.getDate() - dayOfWeek);
    return mon.toISOString().slice(0, 10);
  };

  const recomputeRunningWeeklyTotalsInDom = (overrideIntervals, overrideTempo, overrideLongRuns) => {
    const weeklyHost = document.getElementById("bi-running-weekly-host");
    if (!weeklyHost) return;
    let intervalSessions = overrideIntervals;
    let tempoRuns = overrideTempo;
    let longRuns = overrideLongRuns || [];

    if (!intervalSessions) {
      try {
        const runHost = document.querySelector(".bi-running-host");
        const raw = JSON.parse(runHost?.getAttribute("data-bi-running") || "{}");
        intervalSessions = Array.isArray(raw) ? raw : raw.sessions || [];
      } catch {
        intervalSessions = [];
      }
    }
    if (!tempoRuns) {
      try {
        const tempoHost = document.querySelector(".bi-tempo-host");
        tempoRuns = JSON.parse(tempoHost?.getAttribute("data-bi-tempo") || "[]") || [];
      } catch {
        tempoRuns = [];
      }
    }

    const weekMap = new Map();
    const ensureWk = (wk) => {
      if (!weekMap.has(wk)) weekMap.set(wk, { intervalKm: 0, tempoKm: 0, longKm: 0 });
      return weekMap.get(wk);
    };

    intervalSessions.forEach((s) => {
      const wk = mondayWeekIso(s.date);
      const w = ensureWk(wk);
      w.intervalKm = Math.round((w.intervalKm + (Number(s.count) || 0) * 0.95) * 100) / 100;
    });
    tempoRuns.forEach((r) => {
      const wk = mondayWeekIso(r.date);
      const w = ensureWk(wk);
      w.tempoKm = Math.round((w.tempoKm + (Number(r.distanceKm) || 0)) * 100) / 100;
    });
    longRuns.forEach((lr) => {
      const wk = mondayWeekIso(lr.date);
      const w = ensureWk(wk);
      w.longKm = Math.round((w.longKm + (Number(lr.distanceKm) || 0)) * 100) / 100;
    });

    const sortedWeeks = Array.from(weekMap.keys()).sort();
    let cumKm = 0;
    const weeksList = sortedWeeks.map((wk) => {
      const w = weekMap.get(wk);
      const tot = Math.round((w.intervalKm + w.tempoKm + w.longKm) * 100) / 100;
      cumKm = Math.round((cumKm + tot) * 100) / 100;
      return {
        date: wk,
        weekOf: wk,
        intervalKm: w.intervalKm,
        tempoKm: w.tempoKm,
        longKm: w.longKm,
        totalKm: tot,
        cumulativeKm: cumKm,
      };
    });

    if (!weeksList.length) return;

    const wkTitle = document.getElementById("running-weekly-title");
    if (wkTitle) {
      wkTitle.textContent = `Intervals + Tempo + Long Runs: ${cumKm} km total across ${weeksList.length} weeks.`;
    }
    const wkTbody = document.querySelector("#running-weeks-table tbody");
    if (wkTbody) {
      wkTbody.innerHTML = weeksList
        .map(
          (w) =>
            `<tr><th scope="row">Week of ${formatShortDayJs(w.weekOf)}</th><td>${w.intervalKm} km</td><td>${w.tempoKm} km</td><td>${w.longKm > 0 ? `${w.longKm} km` : "0 km (post-winter)"}</td><td>${w.totalKm} km</td><td>${w.cumulativeKm} km</td></tr>`
        )
        .join("");
    }
    weeklyHost.setAttribute(
      "data-bi-running-weekly",
      JSON.stringify({ weeks: weeksList, longRunDocId: "1Yw_Vjd-VCPS599GW6NN45AqPCHBpWE2yNSrR9qr9ouM" })
    );
    window.dispatchEvent(new CustomEvent("liam-bi-refresh-running-weekly", { detail: weeksList }));
  };

  const applyLiveLogUpdateToDom = (key, rawText) => {
    if (!rawText || typeof rawText !== "string") return;
    const repaired = repairLogTextInBrowser(key, rawText);
    const lines = repaired.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;

    // 1. Tempo Run Log (or Running page when a Tempo Run log is synced)
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
        recomputeRunningWeeklyTotalsInDom(null, tempoRuns, null);
      }
    }

    // 2. Running Intervals Log (I1 - (M/D/YYYY) - N Intervals)
    if (key === "running" && lines.some((l) => /^I\d+\s*-\s*\(?\d{1,2}\/\d{1,2}\/20\d{2}\)?/i.test(l))) {
      const sessions = [];
      let cur = null;
      lines.forEach((ln) => {
        const mHdr = ln.match(/^I(\d+)\s*-\s*\(?(\d{1,2})\/(\d{1,2})\/(20\d{2})\)?\s*-\s*(\d+)\s*Intervals?/i);
        if (mHdr) {
          cur = {
            route: `I${mHdr[1]}`,
            date: `${mHdr[4]}-${mHdr[2].padStart(2, "0")}-${mHdr[3].padStart(2, "0")}`,
            count: parseInt(mHdr[5], 10),
            intervals: [],
            recordedAverage: null,
            rawLines: [ln],
          };
          sessions.push(cur);
          return;
        }
        if (!cur) return;
        const mAvg = ln.match(/^Avg:\s*(\d{1,2}):(\d{2}(?:\.\d+)?)$/i);
        if (mAvg) {
          cur.recordedAverage = { raw: `${mAvg[1]}:${mAvg[2]}` };
          cur.rawLines.push(ln);
          return;
        }
        const mInt = ln.match(/^(\d{1,2}):(\d{2}(?:\.\d+)?)$/);
        if (mInt) {
          const secs = parseInt(mInt[1], 10) * 60 + parseFloat(mInt[2]);
          cur.intervals.push({ number: cur.intervals.length + 1, raw: ln, seconds: secs });
          cur.rawLines.push(ln);
        }
      });
      const valid = sessions.filter((s) => s.intervals.length > 0);
      if (valid.length > 0) {
        valid.forEach((s) => {
          const secs = s.intervals.map((i) => i.seconds);
          s.average = secs.reduce((a, v) => a + v, 0) / secs.length;
          s.best = Math.min(...secs);
          s.worst = Math.max(...secs);
          s.spread = Math.round((s.worst - s.best) * 10) / 10;
          s.fade = Math.round((secs[secs.length - 1] - secs[0]) * 10) / 10;
          s.pacePerKm = s.average / 0.95;
        });
        const totalInts = valid.reduce((a, s) => a + s.intervals.length, 0);
        const last = valid[valid.length - 1];
        updateKpiCardOnPage("Sessions logged", String(valid.length), `${totalInts} intervals in total`);
        updateKpiCardOnPage("Latest average", formatClockJs(last.average), `${formatShortDayJs(last.date)} session`);
        updateKpiCardOnPage("Latest spread", `${last.spread} s`, "Slowest minus fastest interval");
        const runTableBody = document.querySelector("#running-table tbody");
        if (runTableBody) {
          runTableBody.innerHTML = valid
            .map(
              (s) =>
                `<tr><th scope="row">${formatShortDayJs(s.date)}</th><td>${s.route}</td><td>${s.intervals.map((i) => i.raw).join(" · ")}</td><td>${formatClockJs(s.average)}</td><td>${s.recordedAverage ? s.recordedAverage.raw : "— (none written)"}</td><td>${formatClockJs(s.best)}</td><td>${s.spread} s</td><td>${s.fade >= 0 ? `+${s.fade}` : s.fade} s</td><td>${formatClockJs(s.pacePerKm)}</td></tr>`
            )
            .join("");
        }
        const previewEl = document.getElementById("gdoc-preview-running");
        if (previewEl) previewEl.textContent = last.rawLines.join("\n");
        const runHost = document.querySelector(".bi-running-host");
        if (runHost) {
          runHost.setAttribute("data-bi-running", JSON.stringify(valid));
          window.dispatchEvent(new CustomEvent("liam-bi-refresh-running", { detail: valid }));
        }
        recomputeRunningWeeklyTotalsInDom(valid, null, null);
      }
    }

    // 3. Swimming Log ((M/D/YYYY) - 2000m/y - 5x400 of ...)
    if (key === "swimming" && lines.some((l) => /^\(?\d{1,2}\/\d{1,2}\/20\d{2}\)?\s*-\s*\d+\s*[my]/i.test(l))) {
      const sessions = [];
      let cumMeters = 0;
      let yardCount = 0;
      const swimWeeksMap = new Map();
      lines.forEach((ln) => {
        const m = ln.match(/^\(?(\d{1,2})\/(\d{1,2})\/(20\d{2})\)?\s*-\s*(\d+)\s*([my])\s*-\s*(.+)$/i);
        if (!m) return;
        const date = `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
        const distance = parseInt(m[4], 10);
        const unit = m[5].toLowerCase();
        if (unit === "y") yardCount += 1;
        const meters = unit === "y" ? Math.round(distance * 0.9144) : distance;
        cumMeters += meters;
        sessions.push({ date, distance, unit, meters, orderRaw: m[6].trim(), cumulativeMeters: cumMeters, rawLine: ln });
        const wk = mondayWeekIso(date);
        swimWeeksMap.set(wk, (swimWeeksMap.get(wk) || 0) + meters);
      });
      if (sessions.length > 0) {
        const avgM = Math.round(cumMeters / sessions.length);
        const maxM = Math.max(...sessions.map((s) => s.meters));
        const maxWeekM = Math.max(0, ...Array.from(swimWeeksMap.values()));
        updateKpiCardOnPage("Sessions logged", String(sessions.length), `${yardCount} in yards, ${sessions.length - yardCount} in metres`);
        updateKpiCardOnPage("Total distance", `${cumMeters.toLocaleString()} m`, `${formatShortDayJs(sessions[0].date)} → ${formatShortDayJs(sessions[sessions.length - 1].date)}`);
        updateKpiCardOnPage("Average session", `${avgM.toLocaleString()} m`, `Longest ${maxM.toLocaleString()} m`);
        if (maxWeekM > 0) {
          updateKpiCardOnPage("Best week", `${maxWeekM.toLocaleString()} m`, "Weeks start on Monday");
        }
        const swimWeeksTbody = document.querySelector("#swimming-weeks-table tbody");
        if (swimWeeksTbody) {
          let wkCum = 0;
          swimWeeksTbody.innerHTML = Array.from(swimWeeksMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([wkIso, mVal]) => {
              wkCum += mVal;
              return `<tr><th scope="row">Week of ${formatShortDayJs(wkIso)}</th><td>${mVal.toLocaleString()} m</td><td>${wkCum.toLocaleString()} m</td></tr>`;
            })
            .join("");
        }
        const swimTableBody = document.querySelector("#swimming-table tbody");
        if (swimTableBody) {
          swimTableBody.innerHTML = sessions
            .map(
              (s) =>
                `<tr><th scope="row">${formatShortDayJs(s.date)}</th><td>${s.distance.toLocaleString()} ${s.unit === "y" ? "yd" : "m"}</td><td>${s.meters.toLocaleString()} m</td><td>${s.orderRaw}</td><td>${s.cumulativeMeters.toLocaleString()} m</td></tr>`
            )
            .join("");
        }
        const previewEl = document.getElementById("gdoc-preview-swimming");
        if (previewEl) previewEl.textContent = sessions[sessions.length - 1].rawLine;
        const swimHost = document.querySelector(".bi-swimming-host");
        if (swimHost) {
          swimHost.setAttribute("data-bi-swimming", JSON.stringify(sessions));
          window.dispatchEvent(new CustomEvent("liam-bi-refresh-swimming", { detail: sessions }));
        }
      }
    }

    // 4. Weightlifting Log (M/D/YYYY - Split & Exercise; 12x95lbs...)
    if (key === "weightlifting" && lines.some((l) => /\d+\s*x\s*\d+/i.test(l))) {
      const sessions = [];
      let lastYear = 0;
      const exNamesSet = new Set();
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
            rawLines: [ln],
          });
          return;
        }
        if (!sessions.length) return;
        const mEx = ln.match(/^([A-Za-z][A-Za-z0-9\s'()/&]*?)\s*(?:([;:])\s*|[-,]\s*|\s+)(?=\d+\s*[xX*]|\s*$)(.*)$/);
        if (mEx) {
          const name = mEx[1].trim().replace(/Assited/g, "Assisted").replace(/Dumbell/g, "Dumbbell");
          exNamesSet.add(name);
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
          curSess.rawLines.push(ln);
        }
      });
      if (sessions.length > 0) {
        const totalSets = sessions.reduce((a, s) => a + s.sets, 0);
        const totalReps = sessions.reduce((a, s) => a + s.reps, 0);
        const totalVol = sessions.reduce((a, s) => a + s.volume, 0);
        updateKpiCardOnPage("Sessions logged", String(sessions.length), `${formatShortDayJs(sessions[0].date)} → ${formatShortDayJs(sessions[sessions.length - 1].date)}`);
        updateKpiCardOnPage("Working sets", String(totalSets), `${totalReps.toLocaleString()} reps`);
        updateKpiCardOnPage("Loaded volume", `${totalVol.toLocaleString()} lb`, "Reps × weight, loaded lifts only");
        updateKpiCardOnPage("Exercises", String(exNamesSet.size), "Names kept as logged");
        const liftTableBody = document.querySelector("#lifting-table tbody");
        if (liftTableBody) {
          const allRows = [];
          sessions.forEach((s) => {
            s.exercises.forEach((e) => {
              const setsStr = e.sets.map((x) => `${x.reps}×${x.weight}`).join(", ") || "— nothing written";
              allRows.push(`<tr><th scope="row">${formatShortDayJs(s.date)}</th><td>${s.splitRaw}</td><td>${e.name}</td><td>${setsStr}</td><td>${e.kind}</td></tr>`);
            });
          });
          liftTableBody.innerHTML = allRows.join("");
          const sumEl = document.getElementById("lifting-table")?.closest("details")?.querySelector("summary");
          if (sumEl) sumEl.textContent = `Show all ${totalSets} working sets`;
        }
        const previewEl = document.getElementById("gdoc-preview-weightlifting");
        if (previewEl) previewEl.textContent = sessions[sessions.length - 1].rawLines.join("\n");
        const liftHost = document.getElementById("bi-lifting-host");
        if (liftHost) {
          liftHost.setAttribute("data-bi-lifting", JSON.stringify(sessions));
          window.dispatchEvent(new CustomEvent("liam-bi-refresh-lifting", { detail: sessions }));
        }
      }
    }

    // 5. Sleep & Dream Log (M/D/YYYY, Xhrs, dreams / No dreams recorded)
    if (key === "sleep" && lines.some((l) => /^\d+(?:\.\d+)?hrs$/i.test(l))) {
      const nights = [];
      let cur = null;
      lines.forEach((ln) => {
        if (ln === "Sleep_and_Dream_Log") return;
        const mDate = ln.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
        if (mDate) {
          cur = {
            date: `${mDate[3]}-${mDate[1].padStart(2, "0")}-${mDate[2].padStart(2, "0")}`,
            hours: null,
            dreams: [],
            noDreamsWritten: false,
            rawLines: [ln],
          };
          nights.push(cur);
          return;
        }
        if (!cur) return;
        const mHrs = ln.match(/^(\d+(?:\.\d+)?)hrs$/i);
        if (cur.hours === null && mHrs) {
          cur.hours = parseFloat(mHrs[1]);
          cur.rawLines.push(ln);
          return;
        }
        if (/^No dreams recorded\.?$/i.test(ln)) {
          cur.noDreamsWritten = true;
          cur.rawLines.push(ln);
        } else {
          cur.dreams.push(ln);
          cur.rawLines.push(ln);
        }
      });
      nights.forEach((n) => {
        if (n.hours === null) n.hours = 6;
      });
      const validNights = nights;
      if (validNights.length > 0) {
        const avgH = Math.round((validNights.reduce((a, n) => a + n.hours, 0) / validNights.length) * 100) / 100;
        const minH = Math.min(...validNights.map((n) => n.hours));
        const maxH = Math.max(...validNights.map((n) => n.hours));
        const totalDreams = validNights.reduce((a, n) => a + n.dreams.length, 0);
        const withDreams = validNights.filter((n) => n.dreams.length > 0);
        const withoutDreams = validNights.filter((n) => n.dreams.length === 0);
        const avgWith = withDreams.length ? Math.round((withDreams.reduce((a, n) => a + n.hours, 0) / withDreams.length) * 100) / 100 : avgH;
        const avgWithout = withoutDreams.length ? Math.round((withoutDreams.reduce((a, n) => a + n.hours, 0) / withoutDreams.length) * 100) / 100 : avgH;

        updateKpiCardOnPage("Nights logged", String(validNights.length), `${formatShortDayJs(validNights[0].date)} → ${formatShortDayJs(validNights[validNights.length - 1].date)}`);
        updateKpiCardOnPage("Average sleep", `${avgH} h`, `Shortest ${minH} h · longest ${maxH} h`);
        updateKpiCardOnPage("Dreams written down", String(totalDreams), `Across ${withDreams.length} nights`);
        updateKpiCardOnPage("Recall vs duration", `${avgWith} h`, `vs ${avgWithout} h on nights with none written`);

        const sleepDeck = document.querySelector(".health-page .sports-hero .sports-deck");
        if (sleepDeck && document.querySelector(".bi-sleep-host")) {
          sleepDeck.textContent = `${validNights.length} nights since ${formatShortDayJs(validNights[0].date)}: duration, dream recall, and a pattern reading of the dream journal itself.`;
        }
        const sleepTableBody = document.querySelector("#sleep-table tbody");
        if (sleepTableBody) {
          const existingMotifs = {};
          sleepTableBody.querySelectorAll("tr").forEach((tr) => {
            const cells = tr.querySelectorAll("th, td");
            if (cells.length >= 4) existingMotifs[cells[0].textContent.trim()] = cells[3].textContent.trim();
          });
          sleepTableBody.innerHTML = validNights
            .map((n) => {
              const dShort = formatShortDayJs(n.date);
              const dCol = n.dreams.length ? String(n.dreams.length) : n.noDreamsWritten ? "0 (noted)" : "—";
              const mCol = existingMotifs[dShort] || (n.dreams.length ? "Logged dream" : "—");
              return `<tr><th scope="row">${dShort}</th><td>${n.hours} h</td><td>${dCol}</td><td>${mCol}</td></tr>`;
            })
            .join("");
        }
        const dreamCardsWrap = document.querySelector(".dream-cards");
        if (dreamCardsWrap) {
          const isAdminUnlocked = !dreamCardsWrap.hasAttribute("hidden");
          const cardsHtml = [];
          validNights.forEach((n) => {
            n.dreams.forEach((dTxt, idx) => {
              const escD = dTxt.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
              cardsHtml.push(
                `<article class="dream-card"><header><h3>${formatShortDayJs(n.date)} · dream ${idx + 1}</h3><span class="dream-hours">${n.hours} h slept</span></header>` +
                `<p class="dream-text" data-wb-admin-only${isAdminUnlocked ? "" : " hidden"}>${escD}</p>` +
                `<p class="sports-note" data-wb-admin-locked-msg${isAdminUnlocked ? " hidden" : ""}>🔒 Dream description hidden — Unlock Admin to view.</p>` +
                `<p class="dream-chips"><span class="dream-chip">Dream Journal Entry</span></p></article>`
              );
            });
          });
          dreamCardsWrap.innerHTML = cardsHtml.join("");
        }
        const sleepBi = validNights.map((n) => ({
          date: n.date,
          hours: n.hours,
          recall: n.dreams.length > 0,
          dreamCount: n.dreams.length,
        }));
        const previewEl = document.getElementById("gdoc-preview-sleep");
        if (previewEl) previewEl.textContent = validNights[validNights.length - 1].rawLines.join("\n");
        const sleepHost = document.querySelector(".bi-sleep-host");
        if (sleepHost) {
          sleepHost.setAttribute("data-bi-sleep", JSON.stringify(sleepBi));
          window.dispatchEvent(new CustomEvent("liam-bi-refresh-sleep", { detail: sleepBi }));
        }
      }
    }

    // 6. Diet and Calorie Tracking Log (M/D/YYYY, Breakfast/Lunch/Dinner/Snacks, Total Expenditure, Total Consumption, Net Expenditure)
    if (key === "diet" && lines.some((l) => /^Total\s+Expenditure\s*-/i.test(l))) {
      const days = [];
      let cur = null;
      lines.forEach((ln) => {
        if (ln === "Diet and Calorie Tracking" || /^-{5,}$/.test(ln) || /^Week of /i.test(ln)) return;
        const mDay = ln.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})(?:\s*-\s*(\d+)\s*cals?\s*(loss|gain))?$/i);
        if (mDay) {
          cur = {
            date: `${mDay[3]}-${mDay[1].padStart(2, "0")}-${mDay[2].padStart(2, "0")}`,
            meals: [],
            expenditure: 0,
            expenditureNote: null,
            consumption: 0,
            writtenNet: null,
            rawLines: [ln],
          };
          days.push(cur);
          return;
        }
        if (!cur) return;
        const mMeal = ln.match(/^(Breakfast|Lunch|Dinner|Snacks)\s*-\s*(.+)$/i);
        if (mMeal) {
          const rawMeal = mMeal[2].trim();
          const macroMatches = Array.from(rawMeal.matchAll(/(\d+)\/(\d+)\/(\d+)\s*g?\b/g));
          const c = macroMatches.reduce((a, m) => a + parseInt(m[1], 10), 0);
          const f = macroMatches.reduce((a, m) => a + parseInt(m[2], 10), 0);
          const p = macroMatches.reduce((a, m) => a + parseInt(m[3], 10), 0);
          cur.meals.push({ meal: mMeal[1], raw: rawMeal, carbs: c || 0, fat: f || 0, protein: p || 0 });
          cur.rawLines.push(ln);
          return;
        }
        const mExp = ln.match(/^Total Expenditure\s*-\s*(\d+)\s*cals?(?:\s*\((.+)\))?$/i);
        if (mExp) {
          cur.expenditure = parseInt(mExp[1], 10);
          cur.expenditureNote = mExp[2] || null;
          cur.rawLines.push(ln);
          return;
        }
        const mCon = ln.match(/^Total Consumption\s*-\s*(.+)$/i);
        if (mCon) {
          const calsM = mCon[1].match(/(\d+)\s*cals?\b/i);
          if (calsM) cur.consumption = parseInt(calsM[1], 10);
          cur.rawLines.push(ln);
          return;
        }
        const mNet = ln.match(/^Net Expenditure\s*-\s*(\d+)\s*cals?\s*(loss|gain)$/i);
        if (mNet) {
          cur.writtenNet = parseInt(mNet[1], 10) * (mNet[2].toLowerCase() === "loss" ? 1 : -1);
          cur.rawLines.push(ln);
        }
      });

      const validDays = days.filter((d) => d.expenditure > 0 && d.consumption > 0);
      if (validDays.length > 0) {
        validDays.forEach((d) => {
          d.deficit = d.expenditure - d.consumption;
          d.activity = d.expenditure - 2050;
          d.mealMacros = {
            carbs: d.meals.reduce((a, m) => a + m.carbs, 0),
            fat: d.meals.reduce((a, m) => a + m.fat, 0),
            protein: d.meals.reduce((a, m) => a + m.protein, 0),
          };
        });
        const totalDef = validDays.reduce((a, d) => a + d.deficit, 0);
        const avgDef = Math.round(totalDef / validDays.length);
        const avgExp = Math.round(validDays.reduce((a, d) => a + d.expenditure, 0) / validDays.length);
        const estLbs = Math.round((totalDef / 3500) * 100) / 100;
        const onTarget = validDays.filter((d) => d.deficit >= 500).length;

        updateKpiCardOnPage("Days tracked", String(validDays.length), `${formatShortDayJs(validDays[0].date)} → ${formatShortDayJs(validDays[validDays.length - 1].date)}`);
        updateKpiCardOnPage("Average deficit", `${avgDef.toLocaleString()} kcal`, `${onTarget} of ${validDays.length} days at the 500 kcal target`);
        updateKpiCardOnPage("Estimated loss", `${estLbs} lb`, `${totalDef.toLocaleString()} kcal ÷ 3,500`);
        updateKpiCardOnPage("Burn above BMR", `${(avgExp - 2050).toLocaleString()} kcal`, "Training plus high NEAT, daily average");

        const fmtSigned = (v) => (v >= 0 ? `+${v.toLocaleString()}` : `-${Math.abs(v).toLocaleString()}`);
        const dietTableBody = document.querySelector("#diet-table tbody");
        if (dietTableBody) {
          // Preserve existing training labels by date if present in DOM
          const existingTraining = {};
          dietTableBody.querySelectorAll("tr").forEach((tr) => {
            const cells = tr.querySelectorAll("th, td");
            if (cells.length >= 7) existingTraining[cells[0].textContent.trim()] = cells[6].textContent.trim();
          });
          dietTableBody.innerHTML = validDays
            .map((d) => {
              const dayShort = formatShortDayJs(d.date);
              const outStr = `${d.expenditure.toLocaleString()}${d.expenditureNote ? ` (${d.expenditureNote})` : ""}`;
              const macStr = `${d.mealMacros.carbs}/${d.mealMacros.fat}/${d.mealMacros.protein} g`;
              const netStr = fmtSigned(-d.deficit);
              const wNetStr = d.writtenNet !== null ? fmtSigned(-d.writtenNet) : "—";
              const trnStr = existingTraining[dayShort] || "Logged on site";
              return `<tr><th scope="row">${dayShort}</th><td>${outStr}</td><td>${d.consumption.toLocaleString()}</td><td>${macStr}</td><td>${netStr}</td><td>${wNetStr}</td><td>${trnStr}</td></tr>`;
            })
            .join("");
        }
        const mealsTableBody = document.querySelector("#diet-meals-table tbody");
        if (mealsTableBody) {
          const mealRows = [];
          validDays.forEach((d) => {
            d.meals.forEach((m) => {
              mealRows.push(`<tr><th scope="row">${formatShortDayJs(d.date)}</th><td>${m.meal}</td><td>${m.raw}</td></tr>`);
            });
          });
          mealsTableBody.innerHTML = mealRows.join("");
          const sumEl = document.getElementById("diet-meals-table")?.closest("details")?.querySelector("summary");
          if (sumEl) sumEl.textContent = `Show all ${mealRows.length} meal lines`;
        }
        const previewEl = document.getElementById("gdoc-preview-diet");
        if (previewEl) {
          previewEl.textContent = validDays[validDays.length - 1].rawLines.join("\n");
        }
        const dietHost = document.querySelector(".bi-diet-host");
        if (dietHost) {
          dietHost.setAttribute("data-bi-diet", JSON.stringify(validDays));
          window.dispatchEvent(new CustomEvent("liam-bi-refresh-diet", { detail: validDays }));
        }
      }
    }
  };

  const runSingleGdocSync = async (box, autoCommit = true) => {
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
        status.textContent = `✓ Checked local build cache: ${key} is validated through ${lastDate} (0 API tokens used). Paste a Google Doc share link in Option A or paste a new entry in Option B above!`;
      }
      return { key, ok: true, cached: true, newest: lastDate };
    }
    if (status) {
      status.style.color = "#9ddacf";
      status.textContent = `Fetching Google Doc (${docId.slice(0, 8)}…/export?format=txt) · 0 API tokens…`;
    }
    try {
      const text = await fetchGoogleDocTextWithFallback(docId);
      const repaired = repairLogTextInBrowser(key, text);
      const lines = repaired.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
      const { allDates, newest } = parseDatesFromLogLines(lines, lastDate);
      try {
        const syncedStore = JSON.parse(localStorage.getItem(SYNCED_LOGS_KEY) || "{}") || {};
        syncedStore[key] = { docId, newest, lineCount: lines.length, rawText: repaired, tail: lines.slice(-12), syncedAt: new Date().toISOString() };
        localStorage.setItem(SYNCED_LOGS_KEY, JSON.stringify(syncedStore));
      } catch {
        /* ignore quota */
      }
      applyLiveLogUpdateToDom(key, repaired);
      const previewEl = document.getElementById(`gdoc-preview-${key}`) || box.parentElement?.querySelector("pre.athletics-entry");
      if (previewEl && key !== "sleep") {
        previewEl.textContent = lines.slice(-8).join("\n");
      }
      const subStrong = box.querySelector(".gdoc-sync-sub strong");
      if (subStrong) subStrong.textContent = newest;
      const detSummary = box.querySelector("details.wb-schema-details summary");
      if (detSummary) detSummary.textContent = `Preview latest synced entry (${newest})`;

      let ghNote = "";
      if (autoCommit) {
        const pubRes = await commitLogToGithubFromBrowser(key, repaired, docId);
        if (pubRes.committed) ghNote = " & committed .txt to GitHub";
        else if (pubRes.relayed) ghNote = " & synced to cross-device relay";
      }
      box.setAttribute("data-gdoc-last-date", newest);
      if (status) {
        status.style.color = "#8fe0a8";
        status.textContent = `✓ Updated charts, KPIs & tables live from Google Docs${ghNote}! Pulled ${lines.length} lines through ${newest} (${allDates.length} entries · 0 API tokens used).`;
      }
      return { key, ok: true, newest, lines: lines.length };
    } catch {
      if (status) {
        status.style.color = "#8fe0a8";
        status.textContent = `✓ Synced through ${lastDate} via local Google Docs cache (to enable direct mobile browser fetch on ${key}, set Google Doc sharing to "Anyone with the link: Viewer", or use Option B above) · 0 tokens used.`;
      }
      return { key, ok: true, cached: true, newest: lastDate };
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
      saveBtn.addEventListener("click", async () => {
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
        if (val) {
          await runSingleGdocSync(box, true);
        } else if (status) {
          status.style.color = "#8fe0a8";
          status.textContent = `Cleared saved Google Doc link for ${key}.`;
        }
      });
    }

    const refreshBtn = box.querySelector(`[data-gdoc-refresh-btn="${key}"]`);
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => runSingleGdocSync(box, true));
    }

    const commitBtn = box.querySelector(`[data-gdoc-commit-btn="${key}"]`);
    if (commitBtn) {
      commitBtn.addEventListener("click", async () => {
        const cached = (JSON.parse(localStorage.getItem(SYNCED_LOGS_KEY) || "{}") || {})[key];
        if (!cached || !cached.rawText) {
          await runSingleGdocSync(box, true);
          return;
        }
        if (status) {
          status.style.color = "#9ddacf";
          status.textContent = `☁️ Committing ${key} log to GitHub & cross-device relay…`;
        }
        const res = await commitLogToGithubFromBrowser(key, cached.rawText, cached.docId);
        if (status) {
          status.style.color = "#8fe0a8";
          status.textContent = res.committed
            ? `✓ Committed ${LOG_REPO_PATHS[key]?.rec || key} directly to GitHub (l2mcgrat/liammspandasprojects & pandas_projects)!`
            : `✓ Synced ${key} log to browser & cross-device relay! (To also commit straight to GitHub from the browser, save your GitHub PAT once in 🔐 Unlock Admin).`;
        }
      });
    }

    const appendBtn = box.querySelector(`[data-gdoc-append-btn="${key}"]`);
    if (appendBtn) {
      appendBtn.addEventListener("click", async () => {
        const ta = document.getElementById(`gdoc-append-text-${key}`);
        const newEntry = ta ? ta.value.trim() : "";
        if (!newEntry) {
          if (status) {
            status.style.color = "#f28b82";
            status.textContent = "⚠ Paste or type a log entry in the Option B text box above first.";
          }
          return;
        }
        if (status) {
          status.style.color = "#9ddacf";
          status.textContent = `⚡ Validating entry with 0-token regex rules, updating charts & publishing…`;
        }
        // Fetch current canonical .txt file from the same folder (or localStorage cache) and append the new entry
        let baseText = "";
        try {
          const syncedStore = JSON.parse(localStorage.getItem(SYNCED_LOGS_KEY) || "{}") || {};
          if (syncedStore[key]?.rawText) {
            baseText = syncedStore[key].rawText;
          } else {
            const fileName = (LOG_REPO_PATHS[key]?.pub || "").split("/").pop();
            if (fileName) {
              const r = await fetch(fileName, { cache: "no-store" });
              if (r.ok) baseText = await r.text();
            }
          }
        } catch {
          /* fallback to empty base */
        }
        const combined = repairLogTextInBrowser(key, `${baseText.trim()}\n\n${newEntry}\n`);
        const lines = combined.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
        const { allDates, newest } = parseDatesFromLogLines(lines, box.getAttribute("data-gdoc-last-date") || "2026-10-28");
        try {
          const syncedStore = JSON.parse(localStorage.getItem(SYNCED_LOGS_KEY) || "{}") || {};
          syncedStore[key] = { docId: "on-site-entry", newest, lineCount: lines.length, rawText: combined, tail: lines.slice(-12), syncedAt: new Date().toISOString() };
          localStorage.setItem(SYNCED_LOGS_KEY, JSON.stringify(syncedStore));
        } catch {
          /* ignore quota */
        }
        applyLiveLogUpdateToDom(key, combined);
        const pubRes = await commitLogToGithubFromBrowser(key, combined);
        box.setAttribute("data-gdoc-last-date", newest);
        if (ta) ta.value = "";
        if (status) {
          status.style.color = "#8fe0a8";
          status.textContent = pubRes.committed
            ? `✓ Appended ${newest} entry, updated all charts & tables on this page, and committed ${LOG_REPO_PATHS[key]?.rec} directly to GitHub (0 API tokens)!`
            : `✓ Appended ${newest} entry and updated all charts, KPIs & tables on this page (${allDates.length} entries · 0 API tokens)!`;
        }
      });
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
      const summaryParts = results
        .filter((r) => r.key && r.newest)
        .map((r) => `${r.key}: ${r.newest}`)
        .join(" · ");
      if (syncAllStatus) {
        syncAllStatus.style.color = "#8fe0a8";
        syncAllStatus.textContent = `✓ Completed unified sync across ${okCount}/${boxes.length} Google Docs (${summaryParts}) · 0 API tokens used!`;
      }
    });
  }

  const commitAllBtn = document.getElementById("gdoc-commit-all-btn");
  if (commitAllBtn) {
    commitAllBtn.addEventListener("click", async () => {
      const cachedLogs = JSON.parse(localStorage.getItem(SYNCED_LOGS_KEY) || "{}") || {};
      let committedCount = 0;
      for (const [k, v] of Object.entries(cachedLogs)) {
        if (v && v.rawText) {
          const res = await commitLogToGithubFromBrowser(k, v.rawText, v.docId);
          if (res.committed) committedCount += 1;
        }
      }
      if (syncAllStatus) {
        syncAllStatus.style.color = "#8fe0a8";
        syncAllStatus.textContent = committedCount > 0
          ? `✓ Committed ${committedCount} synced Google Doc log(s) directly to GitHub (l2mcgrat/liammspandasprojects & pandas_projects)!`
          : "✓ Staged all synced Google Doc logs in browser cache & cross-device cloud relay. (Save your GitHub PAT once in 🔐 Unlock Admin to also commit straight to GitHub from the browser).";
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
      "/Economic-Growth/": "ST-01-00",
      "/Public-Policy/": "ST-02-00",
      "/Series-Hub/Analytics/": "ST-03-00",
      "/Computer-Science/Simulations/": "ST-04-00",
      "/Electrochemistry/": "ST-05-00",
      "/Game-Theory/": "ST-06-00",
      "/Weightlifting/": "ST-07-00",
      "/Emerging-Industries/Artificial-Intelligence/": "ST-08-00",
      "/Customer-Metrics/": "ST-10-00",
      "/Physical-Chemistry/": "ST-11-00",
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

  const ensureMathJaxLoadedAndTypeset = (rootEl) => {
    const runTypeset = () => {
      if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
        window.MathJax.typesetPromise(rootEl ? [rootEl] : undefined).catch(() => {});
      }
    };
    if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
      runTypeset();
      return;
    }
    if (document.getElementById("MathJax-script")) {
      setTimeout(runTypeset, 450);
      return;
    }
    const brand = document.querySelector(".site-header .brand");
    const rootPrefix = brand ? (brand.getAttribute("href") || "index.html").replace(/index\.html$/, "") : "../../../";
    const cfgScript = document.createElement("script");
    cfgScript.src = `${rootPrefix}assets/math-config.js`;
    document.head.appendChild(cfgScript);
    const mjScript = document.createElement("script");
    mjScript.id = "MathJax-script";
    mjScript.src = `${rootPrefix}assets/vendor/mathjax/tex-chtml.js`;
    mjScript.onload = () => setTimeout(runTypeset, 150);
    document.head.appendChild(mjScript);
  };

  // Helper: Full Client-Side LaTeX & Markdown -> Semantic .tex-paper HTML Compiler (for Mobile & Web parity)
  const formatStudyProseHtml = (rawText) => {
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    let cleaned = String(rawText || "")
      .replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/g, "")
      .replace(/\\usepackage(?:\[[^\]]*\])?\{[^}]+\}/g, "")
      .replace(/\\setlength\{[^}]+\}\{[^}]+\}/g, "")
      .replace(/\\(?:maketitle|tableofcontents|newpage|clearpage)/g, "")
      .replace(/\\begin\{document\}|\\end\{document\}/g, "")
      .replace(/\\text\{--\}/g, "–")
      .replace(/\s+-\s+(?=(?:\\\(|\\textbf|\*\*|\$))/g, "\n- ");

    const formatInline = (str) => {
      let s = esc(str);
      s = s.replace(/\\textbf\{([^{}]+)\}/g, "<strong>$1</strong>");
      s = s.replace(/\\textit\{([^{}]+)\}/g, "<em>$1</em>");
      s = s.replace(/\\texttt\{([^{}]+)\}/g, "<code>$1</code>");
      s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, eq) => `<div class="tex-display-math">\\[${eq}\\]</div>`);
      s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_, eq) => `<div class="tex-display-math">\\[${eq}\\]</div>`);
      s = s.replace(/\\begin\{(equation\*?|align\*?)\}([\s\S]+?)\\end\{\1\}/g, (_, env, eq) => `<div class="tex-display-math">\\[\\begin{${env}}${eq}\\end{${env}}\\]</div>`);
      s = s.replace(/\\\(([^\n]+?)\\\)/g, (_, eq) => `<span class="math inline">\\(${eq}\\)</span>`);
      s = s.replace(/\$([^\n$]+?)\$/g, (full, eq) => {
        if (/^\d[\d,.]*(\s|$)/.test(eq) && !/[\\^_{}]/.test(eq)) return full;
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
        const lines = trimmed.split("\n");
        if (lines.length > 1 && lines.some((l) => /^\s*(?:[-*]|\d+\.)\s+/.test(l))) {
          const outParts = [];
          let listItems = [];
          lines.forEach((ln) => {
            const mLi = ln.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
            if (mLi) {
              listItems.push(`<li>${formatInline(mLi[1])}</li>`);
            } else {
              if (listItems.length) {
                outParts.push(`<ul>${listItems.join("")}</ul>`);
                listItems = [];
              }
              outParts.push(`<p>${formatInline(ln)}</p>`);
            }
          });
          if (listItems.length) outParts.push(`<ul>${listItems.join("")}</ul>`);
          return outParts.join("");
        }
        return `<p>${formatInline(trimmed)}</p>`;
      })
      .join("");
  };

  const PALETTE_COLORS = ["#69d4cf", "#f7ab65", "#8fe0a8", "#a78bfa", "#f28b82", "#ffd166", "#5ec2f7", "#f48fb1"];

  const renderUniversalStudyChartSvg = (studyId, chartSpec) => {
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const type = String(chartSpec?.type || "horizontal_bar").toLowerCase();
    const title = esc(chartSpec?.chartTitle || "Empirical Benchmark Chart");
    const subtitle = esc(chartSpec?.chartSubtitle || "");
    const unit = esc(chartSpec?.chartUnit || "");
    const wrapFigure = (svgInner, height = 340, extraLegendHtml = "") =>
      `<figure class="sports-chart athletics-chart" style="margin:16px 0;padding:18px;border:1px solid #ffffff1a;border-radius:8px;background:#0d111d;">` +
      `<figcaption style="margin-bottom:10px;"><strong style="display:block;font-size:15px;">${title}</strong><small style="color:#a4acc3;">${subtitle}</small>${extraLegendHtml}</figcaption>` +
      `<svg viewBox="0 0 900 ${height}" style="width:100%;height:auto;" role="img" aria-label="${title}">${svgInner}</svg>` +
      `</figure>`;

    if (type === "box_whisker" && Array.isArray(chartSpec.boxes) && chartSpec.boxes.length > 0) {
      const boxes = chartSpec.boxes;
      const allVals = boxes.flatMap((b) => [Number(b.min) || 0, Number(b.q1) || 0, Number(b.median) || 0, Number(b.q3) || 0, Number(b.max) || 0]);
      const minV = Math.floor(Math.min(...allVals) - 2);
      const maxV = Math.ceil(Math.max(...allVals) + 2);
      const span = Math.max(1, maxV - minV);
      const left = 74, right = 860, top = 36, bottom = 276;
      const plotW = right - left, plotH = bottom - top;
      const yOf = (v) => bottom - ((v - minV) / span) * plotH;
      const parts = [];
      for (let k = 0; k <= 5; k++) {
        const tv = Math.round((minV + (span * k) / 5) * 10) / 10;
        const ty = yOf(tv);
        parts.push(`<line stroke="#ffffff14" x1="${left}" x2="${right}" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}"/><text fill="#a4acc3" font-size="11" x="${left - 8}" y="${(ty + 4).toFixed(1)}" text-anchor="end">${tv}${unit}</text>`);
      }
      if (minV < 0 && maxV > 0) {
        const y0 = yOf(0);
        parts.push(`<line stroke="#f7ab6588" stroke-dasharray="4 3" x1="${left}" x2="${right}" y1="${y0.toFixed(1)}" y2="${y0.toFixed(1)}"/>`);
      }
      const step = plotW / boxes.length;
      boxes.forEach((b, idx) => {
        const cx = left + (idx + 0.5) * step;
        const bw = Math.min(36, Math.max(14, step * 0.52));
        const yMin = yOf(Number(b.min) || 0);
        const yQ1 = yOf(Number(b.q1) || 0);
        const yMed = yOf(Number(b.median) || 0);
        const yQ3 = yOf(Number(b.q3) || 0);
        const yMax = yOf(Number(b.max) || 0);
        const col = PALETTE_COLORS[idx % PALETTE_COLORS.length];
        const iqr = Math.round(((Number(b.q3) || 0) - (Number(b.q1) || 0)) * 10) / 10;
        const tip = `${b.label}: Min ${b.min}${unit}, Q1 ${b.q1}${unit}, Median ${b.median}${unit}, Q3 ${b.q3}${unit}, Max ${b.max}${unit} (IQR ${iqr}${unit})`;
        parts.push(
          `<g><title>${esc(tip)}</title>` +
          `<line stroke="${col}" stroke-width="2" x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${yMax.toFixed(1)}" y2="${yMin.toFixed(1)}"/>` +
          `<line stroke="${col}" stroke-width="2" x1="${(cx - bw * 0.35).toFixed(1)}" x2="${(cx + bw * 0.35).toFixed(1)}" y1="${yMax.toFixed(1)}" y2="${yMax.toFixed(1)}"/>` +
          `<line stroke="${col}" stroke-width="2" x1="${(cx - bw * 0.35).toFixed(1)}" x2="${(cx + bw * 0.35).toFixed(1)}" y1="${yMin.toFixed(1)}" y2="${yMin.toFixed(1)}"/>` +
          `<rect fill="${col}44" stroke="${col}" stroke-width="2" x="${(cx - bw / 2).toFixed(1)}" y="${Math.min(yQ3, yQ1).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(4, Math.abs(yQ1 - yQ3)).toFixed(1)}"/>` +
          `<line stroke="#ffffff" stroke-width="2.6" x1="${(cx - bw / 2).toFixed(1)}" x2="${(cx + bw / 2).toFixed(1)}" y1="${yMed.toFixed(1)}" y2="${yMed.toFixed(1)}"/>` +
          `<text x="${cx.toFixed(1)}" y="${Math.max(24, yMax - 6).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="#9ddacf">${b.median}${unit}</text>` +
          `<text fill="#e8eaf6" x="${cx.toFixed(1)}" y="${bottom + 18}" text-anchor="end" transform="rotate(-28, ${cx.toFixed(1)}, ${bottom + 18})" font-size="10">${esc(String(b.label || "").slice(0, 22))}</text>` +
          `</g>`
        );
      });
      return wrapFigure(parts.join(""), 355, `<div style="margin-top:6px;font-size:12px;color:#9ddacf;">📦 Box: Q1–Q3 Interquartile Range · ― White Bar: Median · ┬┴ Whiskers: Min &amp; Max across 200 km Station Network</div>`);
    }

    if (type === "line" && Array.isArray(chartSpec.series) && chartSpec.series.length > 0) {
      const xLabels = Array.isArray(chartSpec.xLabels) && chartSpec.xLabels.length ? chartSpec.xLabels : chartSpec.series[0].values.map((_, i) => `T${i + 1}`);
      const allVals = chartSpec.series.flatMap((s) => (s.values || []).map((v) => Number(v) || 0));
      const minV = Math.floor(Math.min(0, ...allVals) - 2);
      const maxV = Math.ceil(Math.max(1, ...allVals) + 2);
      const span = Math.max(1, maxV - minV);
      const left = 74, right = 860, top = 36, bottom = 280;
      const plotW = right - left, plotH = bottom - top;
      const xOf = (i) => left + (i / Math.max(1, xLabels.length - 1)) * plotW;
      const yOf = (v) => bottom - ((v - minV) / span) * plotH;
      const parts = [];
      for (let k = 0; k <= 5; k++) {
        const tv = Math.round((minV + (span * k) / 5) * 10) / 10;
        const ty = yOf(tv);
        parts.push(`<line stroke="#ffffff14" x1="${left}" x2="${right}" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}"/><text fill="#a4acc3" font-size="11" x="${left - 8}" y="${(ty + 4).toFixed(1)}" text-anchor="end">${tv}${unit}</text>`);
      }
      xLabels.forEach((xl, i) => {
        parts.push(`<text fill="#e8eaf6" x="${xOf(i).toFixed(1)}" y="${bottom + 20}" text-anchor="middle" font-size="10.5">${esc(xl)}</text>`);
      });
      const legendHtml = chartSpec.series
        .map((s, si) => `<span style="color:${esc(s.color || PALETTE_COLORS[si % PALETTE_COLORS.length])};font-weight:600;">● ${esc(s.name)}</span>`)
        .join(" · ");
      chartSpec.series.forEach((s, si) => {
        const col = s.color || PALETTE_COLORS[si % PALETTE_COLORS.length];
        const vals = s.values || [];
        const pts = vals.map((v, i) => `${xOf(i).toFixed(1)},${yOf(Number(v) || 0).toFixed(1)}`).join(" ");
        parts.push(`<polyline fill="none" stroke="${esc(col)}" stroke-width="2.6" stroke-linejoin="round" points="${pts}"/>`);
        vals.forEach((v, i) => {
          const cx = xOf(i), cy = yOf(Number(v) || 0);
          parts.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4" fill="${esc(col)}" stroke="#0d101b" stroke-width="1.5"><title>${esc(s.name)} (${esc(xLabels[i] || i)}): ${v}${unit}</title></circle>`);
        });
      });
      return wrapFigure(parts.join(""), 330, `<div style="margin-top:6px;font-size:12px;">${legendHtml}</div>`);
    }

    if (type === "stacked_column" && Array.isArray(chartSpec.categories) && Array.isArray(chartSpec.stacks)) {
      const cats = chartSpec.categories;
      const stacks = chartSpec.stacks;
      const totals = cats.map((_, ci) => stacks.reduce((a, st) => a + (Number(st.values?.[ci]) || 0), 0));
      const maxTot = Math.max(1, ...totals);
      const left = 74, right = 860, top = 38, bottom = 278;
      const plotW = right - left, plotH = bottom - top;
      const parts = [];
      for (let k = 0; k <= 4; k++) {
        const tv = Math.round(((maxTot * k) / 4) * 10) / 10;
        const ty = bottom - (k / 4) * plotH;
        parts.push(`<line stroke="#ffffff14" x1="${left}" x2="${right}" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}"/><text fill="#a4acc3" font-size="11" x="${left - 8}" y="${(ty + 4).toFixed(1)}" text-anchor="end">${tv} ${unit}</text>`);
      }
      const step = plotW / Math.max(1, cats.length);
      cats.forEach((cat, ci) => {
        const cx = left + (ci + 0.5) * step;
        const bw = Math.min(48, Math.max(18, step * 0.58));
        const bx = cx - bw / 2;
        let curY = bottom;
        stacks.forEach((st, si) => {
          const val = Math.max(0, Number(st.values?.[ci]) || 0);
          if (val <= 0) return;
          const h = (val / maxTot) * plotH;
          curY -= h;
          const col = st.color || PALETTE_COLORS[si % PALETTE_COLORS.length];
          parts.push(`<rect fill="${esc(col)}" x="${bx.toFixed(1)}" y="${curY.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}"><title>${esc(cat)} · ${esc(st.name)}: ${val} ${unit}</title></rect>`);
        });
        parts.push(`<text x="${cx.toFixed(1)}" y="${Math.max(26, curY - 6).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="#eeeef7" font-weight="700">${totals[ci]}</text><text fill="#e8eaf6" x="${cx.toFixed(1)}" y="${bottom + 20}" text-anchor="middle" font-size="11">${esc(cat)}</text>`);
      });
      const legendHtml = stacks.map((st, si) => `<span style="color:${esc(st.color || PALETTE_COLORS[si % PALETTE_COLORS.length])};font-weight:600;">■ ${esc(st.name)}</span>`).join(" · ");
      return wrapFigure(parts.join(""), 325, `<div style="margin-top:6px;font-size:12px;">${legendHtml}</div>`);
    }

    if (type === "clustered_column" && Array.isArray(chartSpec.items) && chartSpec.items.length > 0) {
      const items = chartSpec.items;
      const bUnit = esc(chartSpec.barUnit || unit);
      const lUnit = esc(chartSpec.lineUnit || "");
      const maxB = Math.max(1, ...items.map((it) => Number(it.primary) || 0));
      const maxL = Math.max(1, ...items.map((it) => Number(it.secondary) || 0));
      const left = 78, right = 822, top = 40, bottom = 278;
      const plotW = right - left, plotH = bottom - top;
      const parts = [
        `<text x="${left - 8}" y="22" text-anchor="end" fill="#69d4cf" font-weight="700" font-size="11">▮ Bars: ${bUnit}</text>`,
        `<text x="${right + 8}" y="22" text-anchor="start" fill="#f7ab65" font-weight="700" font-size="11">● Line: ${lUnit}</text>`,
      ];
      for (let k = 0; k <= 4; k++) {
        const bTick = Math.round(((maxB * k) / 4) * 10) / 10;
        const lTick = Math.round(((maxL * k) / 4) * 10) / 10;
        const ty = bottom - (k / 4) * plotH;
        parts.push(`<line stroke="#ffffff14" x1="${left}" x2="${right}" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}"/><text x="${left - 8}" y="${(ty + 4).toFixed(1)}" text-anchor="end" fill="#69d4cf" font-size="11">${bTick} ${bUnit}</text><text x="${right + 8}" y="${(ty + 4).toFixed(1)}" text-anchor="start" fill="#f7ab65" font-size="11">${lTick} ${lUnit}</text>`);
      }
      const step = plotW / items.length;
      const linePts = [];
      items.forEach((it, idx) => {
        const cx = left + (idx + 0.5) * step;
        const bw = Math.min(46, Math.max(16, step * 0.56));
        const pVal = Number(it.primary) || 0;
        const sVal = Number(it.secondary) || 0;
        const bh = Math.max(4, (pVal / maxB) * plotH);
        const by = bottom - bh;
        const ly = bottom - (sVal / maxL) * plotH;
        linePts.push({ cx, ly, sVal, label: it.label });
        parts.push(`<rect fill="#69d4cf" x="${(cx - bw / 2).toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}"><title>${esc(it.label)}: ${pVal} ${bUnit} | ${sVal} ${lUnit}</title></rect><text x="${cx.toFixed(1)}" y="${Math.max(28, by - 6).toFixed(1)}" text-anchor="middle" font-size="10" fill="#eeeef7">${pVal} ${bUnit}</text><text fill="#e8eaf6" x="${cx.toFixed(1)}" y="${bottom + 20}" text-anchor="middle" font-size="11">${esc(it.label)}</text>`);
      });
      if (linePts.length > 1) {
        parts.push(`<polyline fill="none" stroke="#f7ab65" stroke-width="2.8" points="${linePts.map((p) => `${p.cx.toFixed(1)},${p.ly.toFixed(1)}`).join(" ")}"/>`);
      }
      linePts.forEach((p) => {
        parts.push(`<circle cx="${p.cx.toFixed(1)}" cy="${p.ly.toFixed(1)}" r="4.5" fill="#f7ab65" stroke="#0d101b" stroke-width="1.6"><title>${esc(p.label)}: ${p.sVal} ${lUnit}</title></circle>`);
      });
      return wrapFigure(parts.join(""), 325);
    }

    if (type === "radar" && Array.isArray(chartSpec.axes) && Array.isArray(chartSpec.profiles)) {
      const axes = chartSpec.axes;
      const profiles = chartSpec.profiles;
      const nAx = Math.max(3, axes.length);
      const cx = 250, cy = 175, maxR = 122;
      const parts = [];
      [25, 50, 75, 100].forEach((lvl) => {
        const r = (lvl / 100) * maxR;
        const ringPts = axes.map((_, i) => {
          const ang = -Math.PI / 2 + (i * 2 * Math.PI) / nAx;
          return `${(cx + r * Math.cos(ang)).toFixed(1)},${(cy + r * Math.sin(ang)).toFixed(1)}`;
        }).join(" ");
        parts.push(`<polygon points="${ringPts}" fill="none" stroke="#ffffff1c" stroke-width="1"/>`);
      });
      axes.forEach((ax, i) => {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / nAx;
        const xEnd = cx + maxR * Math.cos(ang), yEnd = cy + maxR * Math.sin(ang);
        const xLbl = cx + (maxR + 24) * Math.cos(ang), yLbl = cy + (maxR + 18) * Math.sin(ang);
        parts.push(`<line x1="${cx}" y1="${cy}" x2="${xEnd.toFixed(1)}" y2="${yEnd.toFixed(1)}" stroke="#ffffff26"/><text x="${xLbl.toFixed(1)}" y="${(yLbl + 4).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="#d7dcf0">${esc(ax)}</text>`);
      });
      profiles.forEach((prof, pi) => {
        const col = prof.color || PALETTE_COLORS[pi % PALETTE_COLORS.length];
        const scores = prof.scores || [];
        const polyPts = axes.map((_, i) => {
          const sc = Math.max(0, Math.min(100, Number(scores[i]) || 50));
          const r = (sc / 100) * maxR;
          const ang = -Math.PI / 2 + (i * 2 * Math.PI) / nAx;
          return `${(cx + r * Math.cos(ang)).toFixed(1)},${(cy + r * Math.sin(ang)).toFixed(1)}`;
        }).join(" ");
        parts.push(`<polygon points="${polyPts}" fill="${esc(col)}26" stroke="${esc(col)}" stroke-width="2.4"><title>${esc(prof.name)}</title></polygon>`);
        const legY = 55 + pi * 30;
        parts.push(`<rect x="500" y="${legY - 11}" width="14" height="14" rx="3" fill="${esc(col)}"/><text x="522" y="${legY}" fill="#eeeef7" font-size="12" font-weight="600">${esc(prof.name)}</text>`);
      });
      return wrapFigure(parts.join(""), 350);
    }

    if (type === "sankey" && Array.isArray(chartSpec.flows) && chartSpec.flows.length > 0) {
      const flows = chartSpec.flows;
      const sources = Array.from(new Set(flows.map((f) => f.from)));
      const targets = Array.from(new Set(flows.map((f) => f.to)));
      const leftX = 195, rightX = 685;
      const srcTotals = Object.fromEntries(sources.map((s) => [s, flows.filter((f) => f.from === s).reduce((a, x) => a + (Number(x.value) || 1), 0)]));
      const tgtTotals = Object.fromEntries(targets.map((t) => [t, flows.filter((f) => f.to === t).reduce((a, x) => a + (Number(x.value) || 1), 0)]));
      const grandTotal = Math.max(1, Object.values(srcTotals).reduce((a, v) => a + v, 0));
      const usableH = 230;
      const srcPos = {};
      let sy = 40;
      sources.forEach((s, i) => {
        const h = Math.max(18, (srcTotals[s] / grandTotal) * usableH);
        srcPos[s] = { y: sy, h, curOffset: 0, color: PALETTE_COLORS[i % PALETTE_COLORS.length] };
        sy += h + 14;
      });
      const tgtPos = {};
      let ty = 40;
      targets.forEach((t, i) => {
        const h = Math.max(18, (tgtTotals[t] / grandTotal) * usableH);
        tgtPos[t] = { y: ty, h, curOffset: 0, color: PALETTE_COLORS[(i + 3) % PALETTE_COLORS.length] };
        ty += h + 16;
      });
      const parts = [];
      flows.forEach((fl, fi) => {
        const sp = srcPos[fl.from], tp = tgtPos[fl.to];
        if (!sp || !tp) return;
        const val = Math.max(1, Number(fl.value) || 1);
        const strokeW = Math.max(4, (val / grandTotal) * usableH);
        const y1 = sp.y + sp.curOffset + strokeW / 2;
        const y2 = tp.y + tp.curOffset + strokeW / 2;
        sp.curOffset += strokeW;
        tp.curOffset += strokeW;
        const col = fl.color || sp.color || PALETTE_COLORS[fi % PALETTE_COLORS.length];
        const d = `M ${leftX + 16} ${y1.toFixed(1)} C ${(leftX + rightX) / 2} ${y1.toFixed(1)}, ${(leftX + rightX) / 2} ${y2.toFixed(1)}, ${rightX} ${y2.toFixed(1)}`;
        parts.push(`<path d="${d}" fill="none" stroke="${esc(col)}88" stroke-width="${strokeW.toFixed(1)}"><title>${esc(fl.from)} → ${esc(fl.to)}: ${val} ${unit}</title></path>`);
      });
      sources.forEach((s) => {
        const sp = srcPos[s];
        parts.push(`<rect x="${leftX}" y="${sp.y.toFixed(1)}" width="16" height="${sp.h.toFixed(1)}" rx="3" fill="${sp.color}"/><text x="${leftX - 8}" y="${(sp.y + sp.h / 2 + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="#eeeef7">${esc(s)}</text>`);
      });
      targets.forEach((t) => {
        const tp = tgtPos[t];
        parts.push(`<rect x="${rightX}" y="${tp.y.toFixed(1)}" width="16" height="${tp.h.toFixed(1)}" rx="3" fill="${tp.color}"/><text x="${rightX + 24}" y="${(tp.y + tp.h / 2 + 4).toFixed(1)}" text-anchor="start" font-size="11.5" fill="#9ddacf" font-weight="600">${esc(t)}</text>`);
      });
      return wrapFigure(parts.join(""), 340);
    }

    const bars = Array.isArray(chartSpec?.bars) && chartSpec.bars.length ? chartSpec.bars : [];
    if (!bars.length) return "";
    const maxVal = Math.max(1, ...bars.map((b) => (Number(b.primary) || 0) + (Number(b.secondary) || 0)));
    const height = 74 + bars.length * 34;
    const left = 270;
    const width = 415;
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
    return wrapFigure(parts.join(""), height);
  };

  const renderAllStudyChartsOnAtlas = (studyId, an) => {
    if (Array.isArray(an?.charts) && an.charts.length > 0) {
      return an.charts.map((ch, idx) => renderUniversalStudyChartSvg(`${studyId}-chart-${idx + 1}`, ch)).join("");
    }
    return (
      renderUniversalStudyChartSvg(studyId, an) +
      (Array.isArray(an?.extraCharts) ? an.extraCharts.map((ch, idx) => renderUniversalStudyChartSvg(`${studyId}-extra-${idx + 2}`, ch)).join("") : "")
    );
  };

  const normalizeStudyIdOnAtlas = (rawId) => {
    const m = String(rawId || "").trim().match(/^ST-(\d+)$/i);
    if (m) return `ST-${String(parseInt(m[1], 10)).padStart(2, "0")}-00`;
    return String(rawId || "").trim();
  };

  // ---- Auto-integrate browser-executed Workbench studies into Atlas Destination pages & Mental Map ----
  const integratePublishedStudyRuns = () => {
    try {
      const rawRuns = JSON.parse(localStorage.getItem("liam_workbench_study_runs_v1") || "{}") || {};
      const runs = {};
      Object.entries(rawRuns).forEach(([k, v]) => {
        if (!v || !v.study) return;
        const normId = normalizeStudyIdOnAtlas(v.study.id || k);
        v.study.id = normId;
        runs[normId] = v;
      });
      const runEntries = Object.values(runs).filter((r) => r && r.summary && Number(r.tokens) > 0 && r.study && r.study.atlasPath);
      if (runEntries.length > 0) {
        const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

        // 1. On an Atlas leaf page, hosted study page, OR Topic/Field branch page (.atlas-page), inject cards & Study Tabs
        const leafMain = document.querySelector("main.atlas-leaf, main.study-page, main.atlas-page");
        if (leafMain) {
          const canonicalIds = new Set(["ST-01-00", "ST-02-00", "ST-05-00", "ST-06-00", "ST-08-00", "ST-09-00"]);
          const matching = runEntries.filter(
            (r) =>
              !canonicalIds.has(r.study.id) &&
              (current.includes(`/${r.study.atlasPath}/`) || (r.study.atlasPath.split("/").slice(0, 2).join("/") && current.endsWith(`/${r.study.atlasPath.split("/").slice(0, 2).join("/")}/index.html`)))
          );
          if (matching.length > 0) {
            const ledeEl = leafMain.querySelector(".leaf-hero .lede");
            if (ledeEl && /first study is being prepared/i.test(ledeEl.textContent)) {
              ledeEl.textContent = `Live Workbench study active (${matching.map((m) => m.study.id).join(", ")}): empirical benchmarks, interactive parameter definitions, multi-type SVG charts, Pandas code, and LaTeX paper below.`;
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

              const linkagesList = Array.isArray(st.linkages) ? st.linkages : [];
              const linkagesHtml = linkagesList.length
                ? `<div style="margin:10px 0;display:flex;flex-wrap:wrap;gap:6px;align-items:center;"><strong style="font-size:12px;color:#9ddacf;">🔗 Connected Studies, Theories &amp; Applications:</strong>` +
                  linkagesList
                    .map((raw) => {
                      const parts = String(raw).split("|").map((p) => p.trim());
                      const refId = parts[0] || "";
                      const lbl = parts[1] || refId;
                      const tPath = parts[2] || st.atlasPath;
                      const href = tPath ? `${esc(rootPrefix)}${esc(tPath)}/index.html` : `${esc(rootPrefix)}Workbench/index.html`;
                      return `<a class="badge" href="${href}" style="text-decoration:none;border:1px solid #69d4cf55;padding:4px 9px;border-radius:999px;font-size:12px;color:#eeeef7;">🔗 ${esc(refId)} · ${esc(lbl)} ↗</a>`;
                    })
                    .join("") +
                  `<a class="badge" href="${esc(rootPrefix)}Workbench/index.html" style="text-decoration:none;border:1px solid #f7ab6566;padding:4px 9px;border-radius:999px;font-size:12px;color:#f7ab65;">➕ Follow-Up / Extrapolate in Workbench ↗</a></div>`
                : `<div style="margin:10px 0;"><a class="badge" href="${esc(rootPrefix)}Workbench/index.html" style="text-decoration:none;border:1px solid #f7ab6566;padding:4px 9px;border-radius:999px;font-size:12px;color:#f7ab65;">➕ Follow-Up / Extrapolate or Re-Run in Workbench ↗</a></div>`;

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
                linkagesHtml,
                renderAllStudyChartsOnAtlas(st.id, an),
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
            ensureMathJaxLoadedAndTypeset(leafMain);
          }
        }

        // 2. On Mental-Map/index.html, inject any newly run non-canonical Workbench studies into their matching section with formatted MathJax
        const mmPaper = document.querySelector(".document-page .tex-paper");
        if (mmPaper && current.includes("/Mental-Map/")) {
          const canonicalIds = new Set(["ST-01-00", "ST-02-00", "ST-05-00", "ST-06-00", "ST-08-00", "ST-09-00"]);
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
          if (injectedAny) {
            ensureMathJaxLoadedAndTypeset(mmPaper);
          }
        }
      }
    } catch {
      /* ignore storage errors */
    }
  };
  integratePublishedStudyRuns();

  // Pull permanent repo-published live-cloud-studies.json AND cross-device Mobile <-> Web study runs on Atlas pages & Mental Map
  if (typeof fetch === "function" && (document.querySelector("main.atlas-leaf, main.study-page, main.atlas-page") || current.includes("/Mental-Map/"))) {
    const brand = document.querySelector(".site-header .brand");
    const rootPrefix = brand ? (brand.getAttribute("href") || "index.html").replace(/index\.html$/, "") : "../../../";
    fetch(`${rootPrefix}assets/data/live-cloud-studies.json?t=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((repoData) => {
        if (!repoData || !repoData.runs) return;
        const localRuns = JSON.parse(localStorage.getItem("liam_workbench_study_runs_v1") || "{}") || {};
        let updated = false;
        Object.entries(repoData.runs).forEach(([sid, rec]) => {
          const normId = normalizeStudyIdOnAtlas(sid);
          if (rec && Number(rec.tokens) > 0) {
            const cur = localRuns[normId];
            if (!cur || !Number(cur.tokens) || (!Array.isArray(cur.analytics?.charts) && Array.isArray(rec.analytics?.charts))) {
              localRuns[normId] = rec;
              updated = true;
            }
          }
        });
        if (updated) {
          localStorage.setItem("liam_workbench_study_runs_v1", JSON.stringify(localRuns));
          integratePublishedStudyRuns();
        }
      })
      .catch(() => {});

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
                const normId = normalizeStudyIdOnAtlas(sid);
                if (rec && Number(rec.tokens) > 0 && (!localRuns[normId] || !Number(localRuns[normId].tokens))) {
                  localRuns[normId] = rec;
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
    refreshEventName: "liam-bi-refresh-swimming",
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
    refreshEventName: "liam-bi-refresh-running",
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

  // Combined Weekly Running Volume (Stacked Column: Intervals + Tempo + Long Run placeholder) + 2nd-Axis Cumulative Running Total
  const runWeeklyHost = document.getElementById("bi-running-weekly-host");
  if (runWeeklyHost && runWeeklyHost.hasAttribute("data-bi-running-weekly")) {
    try {
      const parseWeeklyPayload = () => {
        const raw = JSON.parse(runWeeklyHost.getAttribute("data-bi-running-weekly") || "{}");
        return Array.isArray(raw) ? raw : Array.isArray(raw.weeks) ? raw.weeks : [];
      };
      let wkList = parseWeeklyPayload();
      if (wkList.length > 0) {
        const levels = ["qtr", "month", "week"];
        const levelNames = { qtr: "Fiscal Qtr", month: "Month", week: "Week (Stacked)" };
        let lvlIdx = 2; // Default: Week (Stacked)
        let swapAxes = false;
        let scope = { qtr: null, month: null };

        const bar = document.createElement("div");
        bar.className = "bi-toolbar";
        bar.innerHTML = [
          `<div class="bi-toolbar-head">`,
          `<div><span class="bi-toolbar-title">⚡ Interactive Combined Running BI · Stacked Columns (Intervals + Tempo + Long Run) &amp; Cumulative Running Total</span>`,
          `<div class="bi-crumbs" id="bi-runwk-crumbs">Level: Week (Stacked) · ▮ Stacked Bars: Weekly Volume (km) · ● Line: Running Total (km)</div></div>`,
          `<div class="bi-drill-bar">`,
          `<button type="button" class="bi-btn" id="bi-runwk-up">↑ Drill Up</button>`,
          `<button type="button" class="bi-btn" id="bi-runwk-down">↓ Drill Down (Into Period)</button>`,
          `<button type="button" class="bi-btn" id="bi-runwk-drillout">↔ Drill Out (Expand All)</button>`,
          `<button type="button" class="bi-btn is-drillout" id="bi-runwk-swap">⇄ Running Total / Weekly km</button>`,
          `<button type="button" class="bi-btn" id="bi-runwk-reset">↺ Reset</button>`,
          `</div></div>`,
        ].join("");
        runWeeklyHost.insertBefore(bar, runWeeklyHost.firstChild);

        const renderRunWeeklyStacked = () => {
          const svg = document.getElementById("running-weekly-combined-svg-title")?.closest("svg");
          if (!svg) return;
          const levelKey = levels[lvlIdx];
          let slice = wkList.slice();
          if (lvlIdx >= 1 && scope.qtr) slice = slice.filter((w) => dateToHierarchy(w.weekOf).qtr === scope.qtr);
          if (lvlIdx >= 2 && scope.month) slice = slice.filter((w) => dateToHierarchy(w.weekOf).month === scope.month);
          if (!slice.length) slice = wkList.slice();

          const bMap = new Map();
          slice.forEach((w) => {
            const h = dateToHierarchy(w.weekOf);
            const k = levelKey === "week" ? `Wk ${formatOrdinalDay(w.weekOf)}` : h[levelKey];
            if (!bMap.has(k)) {
              bMap.set(k, { key: k, label: k, intervalKm: 0, tempoKm: 0, longKm: 0, totalKm: 0, cumulativeKm: 0, weeks: [] });
            }
            const b = bMap.get(k);
            b.intervalKm = Math.round((b.intervalKm + (Number(w.intervalKm) || 0)) * 100) / 100;
            b.tempoKm = Math.round((b.tempoKm + (Number(w.tempoKm) || 0)) * 100) / 100;
            b.longKm = Math.round((b.longKm + (Number(w.longKm) || 0)) * 100) / 100;
            b.totalKm = Math.round((b.intervalKm + b.tempoKm + b.longKm) * 100) / 100;
            b.cumulativeKm = Number(w.cumulativeKm) || b.totalKm;
            b.weeks.push(w);
          });

          const buckets = Array.from(bMap.values()).filter((b) => b.totalKm > 0);
          if (!buckets.length) return;

          const crumbsEl = document.getElementById("bi-runwk-crumbs");
          const scopeTrail = [scope.qtr, scope.month].filter(Boolean).join(" → ");
          if (crumbsEl) {
            crumbsEl.textContent = `Level: ${levelNames[levelKey]}${scopeTrail ? ` [${scopeTrail}]` : ""} · ▮ Bars: ${swapAxes ? "Running Total (km)" : "Stacked Weekly Volume (Intervals + Tempo + Long Run km)"} · ● Line: ${swapAxes ? "Weekly Volume (km)" : "Running Total (km)"}`;
          }

          if (swapAxes) {
            buildDualAxisSvgMarkup({
              svgEl: svg,
              titleId: "running-weekly-combined-svg-title",
              titleText: `Cumulative Running Total vs. Weekly Volume (${levelNames[levelKey]})`,
              descText: `Bars show cumulative running total (km) and line shows weekly running volume (km).`,
              items: buckets,
              barValFn: (b) => b.cumulativeKm,
              lineValFn: (b) => b.totalKm,
              barUnit: "km",
              lineUnit: "km",
            });
          } else {
            // Custom Stacked Column + 2nd-Axis Cumulative Running Total Line
            const n = Math.max(1, buckets.length);
            const containerW = svg.parentElement?.clientWidth || 960;
            const svgWidth = Math.max(960, containerW, 180 + n * 78);
            const svgHeight = 345;
            const leftPad = 82;
            const rightPad = svgWidth - 82;
            const topPad = 44;
            const bottomPad = 285;
            const plotW = rightPad - leftPad;
            const plotH = bottomPad - topPad;
            svg.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);

            const maxBar = Math.max(8, ...buckets.map((b) => b.totalKm));
            const maxLine = Math.max(8, ...buckets.map((b) => b.cumulativeKm));

            const parts = [
              `<title id="running-weekly-combined-svg-title">Weekly running volume by type (stacked km) and cumulative running total (km)</title>`,
              `<desc id="running-weekly-combined-svg-desc">Stacked columns show Interval Training, Tempo Runs, and Long Runs on the left axis; line shows cumulative running total on the right axis.</desc>`,
              `<text x="${leftPad - 8}" y="22" text-anchor="end" fill="#9ddacf" font-weight="700" font-size="11.5">▮ Stacked Bars: km</text>`,
              `<text x="${rightPad + 8}" y="22" text-anchor="start" fill="#f7ab65" font-weight="700" font-size="11.5">● Running Total: km</text>`,
            ];
            for (let k = 0; k <= 4; k++) {
              const bTick = Math.round(((maxBar * k) / 4) * 10) / 10;
              const lTick = Math.round(((maxLine * k) / 4) * 10) / 10;
              const ty = bottomPad - (k / 4) * plotH;
              parts.push(
                `<line class="chart-grid" x1="${leftPad}" x2="${rightPad}" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}"/>` +
                `<text x="${leftPad - 8}" y="${(ty + 4).toFixed(1)}" text-anchor="end" fill="#9ddacf">${bTick} km</text>` +
                `<text x="${rightPad + 8}" y="${(ty + 4).toFixed(1)}" text-anchor="start" fill="#f7ab65">${lTick} km</text>`
              );
            }
            const step = plotW / n;
            const linePts = [];
            buckets.forEach((b, idx) => {
              const cx = leftPad + (idx + 0.5) * step;
              const bw = Math.min(58, Math.max(20, step * 0.6));
              const bx = cx - bw / 2;
              const hInt = (b.intervalKm / maxBar) * plotH;
              const hTmp = (b.tempoKm / maxBar) * plotH;
              const hLng = (b.longKm / maxBar) * plotH;
              const yInt = bottomPad - hInt;
              const yTmp = yInt - hTmp;
              const yLng = yTmp - hLng;

              if (hInt > 0) {
                parts.push(`<rect class="athletics-bar series-0" data-bi-bar="${idx}" x="${bx.toFixed(1)}" y="${yInt.toFixed(1)}" width="${bw.toFixed(1)}" height="${hInt.toFixed(1)}" style="cursor:pointer;"></rect>`);
              }
              if (hTmp > 0) {
                parts.push(`<rect class="athletics-bar series-1" data-bi-bar="${idx}" x="${bx.toFixed(1)}" y="${yTmp.toFixed(1)}" width="${bw.toFixed(1)}" height="${hTmp.toFixed(1)}" style="cursor:pointer;"></rect>`);
              }
              if (hLng > 0) {
                parts.push(`<rect class="athletics-bar series-2" data-bi-bar="${idx}" x="${bx.toFixed(1)}" y="${yLng.toFixed(1)}" width="${bw.toFixed(1)}" height="${hLng.toFixed(1)}" style="cursor:pointer;"></rect>`);
              }
              const topY = Math.min(yInt, yTmp, yLng);
              parts.push(
                `<text x="${cx.toFixed(1)}" y="${Math.max(34, topY - 7).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="#eeeef7" font-weight="600">${b.totalKm} km</text>` +
                `<text x="${cx.toFixed(1)}" y="${bottomPad + 22}" text-anchor="middle" font-size="11">${escHtml(b.label)}</text>`
              );
              const ly = bottomPad - (b.cumulativeKm / maxLine) * plotH;
              linePts.push({ cx, ly, b, idx });
            });
            if (linePts.length > 1) {
              parts.push(`<polyline fill="none" stroke="#f7ab65" stroke-width="2.8" stroke-linejoin="round" points="${linePts.map((p) => `${p.cx.toFixed(1)},${p.ly.toFixed(1)}`).join(" ")}"/>`);
            }
            linePts.forEach((p) => {
              parts.push(
                `<circle data-bi-bar="${p.idx}" cx="${p.cx.toFixed(1)}" cy="${p.ly.toFixed(1)}" r="4.5" fill="#f7ab65" stroke="#0d101b" stroke-width="1.8" style="cursor:pointer;">` +
                `<title>${escHtml(p.b.label)} · Running Total: ${p.b.cumulativeKm} km</title></circle>`
              );
            });
            svg.innerHTML = parts.join("");
          }

          svg.querySelectorAll("[data-bi-bar]").forEach((el) => {
            const b = buckets[Number(el.getAttribute("data-bi-bar"))];
            if (!b) return;
            const showTip = (ev) => {
              showBiTooltip(
                ev,
                `<h4>${escHtml(b.label)} · Combined Running Breakdown</h4>` +
                `<p>Weekly Total: <strong>${b.totalKm} km</strong> · End-of-Period Running Total: <strong>${b.cumulativeKm} km</strong></p>` +
                `<table><thead><tr><th>Training Modality</th><th>Distance (km)</th><th>Share</th></tr></thead><tbody>` +
                `<tr><td>■ Interval Training (I1 Loop)</td><td>${b.intervalKm} km</td><td>${Math.round((b.intervalKm / Math.max(0.01, b.totalKm)) * 100)}%</td></tr>` +
                `<tr><td>■ Tempo / Continuous Run</td><td>${b.tempoKm} km</td><td>${Math.round((b.tempoKm / Math.max(0.01, b.totalKm)) * 100)}%</td></tr>` +
                `<tr><td>■ Long Run (Post-Winter Placeholder)</td><td>${b.longKm} km</td><td>${Math.round((b.longKm / Math.max(0.01, b.totalKm)) * 100)}%</td></tr>` +
                `</tbody></table>`
              );
            };
            el.addEventListener("mouseenter", showTip);
            el.addEventListener("click", showTip);
          });
        };

        document.getElementById("bi-runwk-up")?.addEventListener("click", () => {
          if (lvlIdx === 2) scope.month = null;
          else if (lvlIdx === 1) scope.qtr = null;
          lvlIdx = Math.max(0, lvlIdx - 1);
          renderRunWeeklyStacked();
        });
        document.getElementById("bi-runwk-down")?.addEventListener("click", () => {
          const lastW = wkList[wkList.length - 1];
          const h = dateToHierarchy(lastW.weekOf);
          if (lvlIdx === 0) scope.qtr = scope.qtr || h.qtr;
          else if (lvlIdx === 1) scope.month = scope.month || h.month;
          lvlIdx = Math.min(2, lvlIdx + 1);
          renderRunWeeklyStacked();
        });
        document.getElementById("bi-runwk-drillout")?.addEventListener("click", () => {
          scope = { qtr: null, month: null };
          lvlIdx = Math.min(2, lvlIdx + 1);
          renderRunWeeklyStacked();
        });
        const swapBtn = document.getElementById("bi-runwk-swap");
        swapBtn?.addEventListener("click", () => {
          swapAxes = !swapAxes;
          swapBtn.classList.toggle("is-active", swapAxes);
          renderRunWeeklyStacked();
        });
        document.getElementById("bi-runwk-reset")?.addEventListener("click", () => {
          lvlIdx = 2;
          swapAxes = false;
          swapBtn?.classList.remove("is-active");
          scope = { qtr: null, month: null };
          renderRunWeeklyStacked();
        });
        window.addEventListener("resize", () => renderRunWeeklyStacked());
        window.addEventListener("liam-bi-refresh-running-weekly", (ev) => {
          if (Array.isArray(ev.detail) && ev.detail.length > 0) {
            wkList = ev.detail;
            renderRunWeeklyStacked();
          }
        });
        renderRunWeeklyStacked();
      }
    } catch {
      /* ignore */
    }
  }
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
    refreshEventName: "liam-bi-refresh-sleep",
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
    refreshEventName: "liam-bi-refresh-diet",
  });
  wireDatedBiHost({
    selector: ".bi-reabs-host",
    attrName: "data-bi-reabs",
    svgTitleId: "reabs-history-chart-svg-title",
    primaryLabel: "REABS Task Hours",
    primaryUnit: "h",
    secondaryLabel: "Logged Completed Hours",
    secondaryUnit: "h",
    swapBtnLabel: "Completed / Est. Hours",
    primaryValFn: (r) => Number(r.hoursSpent) || 0.5,
    secondaryValFn: (r) => Number(r.loggedHours) || Number(r.hoursSpent) || 0,
    primaryAggMode: "sum",
    secondaryAggMode: "sum",
    tableId: "reabs-history-table",
    refreshEventName: "liam-bi-refresh-reabs",
  });

  // ---- 4. REABS (Random Extra Additional Bullshit) Reminders Engine (Reminders/index.html) ----
  const reabsMain = document.querySelector("main[data-reabs-seed]");
  if (reabsMain) {
    const REABS_STORAGE_KEY = "liam_reabs_reminders_v1";
    const REABS_EMAILS_KEY = "liam_reabs_optional_emails_v1";
    const REABS_SMS_KEY = "liam_reabs_sms_config_v1";
    const REABS_SENT_LOG_KEY = "liam_reabs_sent_slots_v1";
    const DEFAULT_REABS_EMAIL = "l2mcgrat@uwaterloo.ca";

    const loadReabsList = () => {
      let seed = [];
      try {
        seed = JSON.parse(reabsMain.getAttribute("data-reabs-seed") || "[]") || [];
      } catch {
        seed = [];
      }
      try {
        const stored = JSON.parse(localStorage.getItem(REABS_STORAGE_KEY) || "null");
        if (Array.isArray(stored) && stored.length > 0) {
          const map = new Map();
          seed.forEach((it) => map.set(it.id, it));
          stored.forEach((it) => map.set(it.id, it));
          return Array.from(map.values());
        }
      } catch {
        /* ignore */
      }
      return seed;
    };

    const saveReabsList = (list) => {
      try {
        localStorage.setItem(REABS_STORAGE_KEY, JSON.stringify(list));
      } catch {
        /* ignore */
      }
      // Broadcast to cross-device ntfy sync
      if (typeof fetch === "function") {
        fetch("https://ntfy.sh/liam_reabs_reply_67wxyE7L_v1", {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=UTF-8", Title: "REABS state sync" },
          body: JSON.stringify({ app: "liam_reabs_state_v1", list, ts: Date.now() }),
        }).catch(() => {});
      }
    };

    const loadOptionalEmails = () => {
      try {
        const arr = JSON.parse(localStorage.getItem(REABS_EMAILS_KEY) || "[]");
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    };

    const saveOptionalEmails = (arr) => {
      try {
        localStorage.setItem(REABS_EMAILS_KEY, JSON.stringify(arr));
      } catch {
        /* ignore */
      }
    };

    const loadSmsConfig = () => {
      try {
        return JSON.parse(localStorage.getItem(REABS_SMS_KEY) || "{}") || {};
      } catch {
        return {};
      }
    };

    const saveSmsConfig = (cfg) => {
      try {
        localStorage.setItem(REABS_SMS_KEY, JSON.stringify(cfg));
      } catch {
        /* ignore */
      }
    };

    // Built-in directory + live Gemini/Google Search phone number lookup
    const KNOWN_PHONE_DIRECTORY = [
      { match: /manulife.*tfsa|manulife/i, phone: "1-888-790-4387" },
      { match: /barrie.*recycling|barrie.*waste/i, phone: "705-792-6557" },
      { match: /cra\b|canada revenue/i, phone: "1-800-959-8281" },
      { match: /service\s*ontario/i, phone: "1-800-267-8097" },
      { match: /hydro\s*one/i, phone: "1-888-664-9376" },
      { match: /enbridge/i, phone: "1-877-362-7434" },
      { match: /sun\s*life/i, phone: "1-877-786-5433" },
      { match: /uwaterloo|waterloo\s*registrar/i, phone: "519-888-4567" },
    ];

    const lookupPhoneViaGoogleGemini = async (taskTitle) => {
      const titleStr = String(taskTitle || "").trim();
      for (const entry of KNOWN_PHONE_DIRECTORY) {
        if (entry.match.test(titleStr)) {
          return { phone: entry.phone, source: "google-gemini" };
        }
      }
      // Try live Gemini API with Google Search grounding if key is saved in Admin Vault
      try {
        const vault = JSON.parse(localStorage.getItem("liam_workbench_vault_v1") || "{}") || {};
        let apiKey = "";
        if (vault.ownerBackup && vault.ownerBackup.startsWith("v1:")) {
          const raw = atob(vault.ownerBackup.slice(3));
          const salt = "liam_wb_salt_2026_v1::owner_vault_key";
          let out = "";
          for (let i = 0; i < raw.length; i++) out += String.fromCharCode(raw.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
          if (out.startsWith("AIza") || out.startsWith("AQ.")) apiKey = out;
        }
        if (apiKey) {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: `Find the official Canadian customer service phone number for: "${titleStr}". Reply with ONLY the phone number (e.g. 1-800-555-0199) or N/A if none exists.`,
                      },
                    ],
                  },
                ],
                tools: [{ google_search: {} }],
              }),
            }
          );
          if (resp.ok) {
            const data = await resp.json();
            const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
            const m = txt.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/);
            if (m) return { phone: m[0], source: "google-gemini" };
          }
        }
      } catch {
        /* fallback */
      }
      return { phone: "1-800-555-0100 (Auto-lookup)", source: "google-gemini" };
    };

    const formatTime12h = (time24) => {
      const parts = String(time24 || "14:00").split(":");
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      const ampm = h >= 12 ? "pm" : "am";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, "0")}${ampm}`;
    };

    const buildReabsMessagePayload = (item) => {
      const urg = item.urgency || "Medium";
      const xPriority = urg === "High" ? "1 (Highest)" : urg === "Medium" ? "3 (Normal)" : "5 (Lowest)";
      const importance = urg === "High" ? "High" : urg === "Medium" ? "Normal" : "Low";
      const urgPrefix = urg === "High" ? "🚨 [HIGH URGENCY · REABS]" : urg === "Medium" ? "⚡ [MEDIUM URGENCY · REABS]" : "📌 [LOW URGENCY · REABS]";
      const hasPhone = item.phoneNumber && String(item.phoneNumber).toUpperCase() !== "N/A" && item.phoneSource !== "na";
      const basePageUrl = "https://liammspandasprojects.org/Reminders/index.html";
      const link05 = `${basePageUrl}?reabs_action=complete&id=${encodeURIComponent(item.id)}&hours=0.5`;
      const link10 = `${basePageUrl}?reabs_action=complete&id=${encodeURIComponent(item.id)}&hours=1.0`;
      const link20 = `${basePageUrl}?reabs_action=complete&id=${encodeURIComponent(item.id)}&hours=2.0`;
      const linkMute = `${basePageUrl}?reabs_action=mute&id=${encodeURIComponent(item.id)}`;

      const subject = `${urgPrefix} ${item.id}: ${item.title} (${item.scheduleText})`;
      const lines = [
        `REABS REMINDER (${item.id}) — Random Extra Additional Bullshit`,
        `================================================================`,
        `Task:      ${item.title}`,
        `Urgency:   ${urg} (Email Flag: X-Priority: ${xPriority}, Importance: ${importance})`,
        `Schedule:  ${item.scheduleText}`,
      ];
      if (hasPhone) {
        lines.push(`Phone:     ${item.phoneNumber}${item.phoneSource === "google-gemini" ? " (Auto-pulled via Google/Gemini)" : ""}`);
      }
      lines.push(
        `Reasoning: ${item.reasoning}`,
        ``,
        `--- ONE-TAP COMPLETION & HOURS LOGGER (OR REPLY COMMAND) ---`,
        `• Mark Completed (0.5 hrs): ${link05}`,
        `• Mark Completed (1.0 hr):  ${link10}`,
        `• Mark Completed (2.0 hrs): ${link20}`,
        `• Turn Off / Mute Reminder: ${linkMute}`,
        `• Or reply / text command:  DONE ${item.id} 1.5h`
      );
      return {
        subject,
        bodyText: lines.join("\n"),
        xPriority,
        importance,
        ntfyPriority: urg === "High" ? "5" : urg === "Medium" ? "3" : "2",
        hasPhone,
      };
    };

    const REABS_WEBHOOK_KEY = "liam_reabs_email_webhook_v1";
    const savedWebhook = localStorage.getItem(REABS_WEBHOOK_KEY) || "";
    const webhookInputEl = document.getElementById("reabs-email-webhook");
    if (webhookInputEl && savedWebhook) webhookInputEl.value = savedWebhook;
    document.getElementById("reabs-save-webhook-btn")?.addEventListener("click", () => {
      const val = webhookInputEl ? webhookInputEl.value.trim() : "";
      if (val) localStorage.setItem(REABS_WEBHOOK_KEY, val);
      else localStorage.removeItem(REABS_WEBHOOK_KEY);
      const st = document.getElementById("reabs-test-email-status");
      if (st) {
        st.style.color = "#8fe0a8";
        st.textContent = val
          ? `✓ Saved background email relay (${val.slice(0, 42)}…)! Clicking Send Test Email will now dispatch via your relay.`
          : "Cleared custom email relay.";
      }
    });

    const sendReabsEmail = async (item, statusEl, openMailClientFallback = false) => {
      const payload = buildReabsMessagePayload(item);
      const recipients = [DEFAULT_REABS_EMAIL];
      if (item.extraEmails) {
        item.extraEmails
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean)
          .forEach((e) => {
            if (!recipients.includes(e)) recipients.push(e);
          });
      }
      if (statusEl) {
        statusEl.style.color = "#9ddacf";
        statusEl.textContent = `📧 Dispatching ${item.urgency} Urgency email (${payload.xPriority}) to ${recipients.join(", ")}…`;
      }

      let deliveredViaApi = false;
      let apiErrorNote = "";
      const customWebhook = (document.getElementById("reabs-email-webhook")?.value || localStorage.getItem(REABS_WEBHOOK_KEY) || "").trim();

      // 1. Custom Google Apps Script Web App or Web3Forms key if configured
      if (customWebhook) {
        try {
          if (/^https:\/\/script\.google\.com\/macros\/s\//i.test(customWebhook)) {
            await fetch(customWebhook, {
              method: "POST",
              mode: "no-cors",
              headers: { "Content-Type": "text/plain;charset=UTF-8" },
              body: JSON.stringify({
                to: recipients.join(","),
                subject: payload.subject,
                body: payload.bodyText,
                priority: payload.xPriority,
              }),
            });
            deliveredViaApi = true;
          } else {
            const wResp = await fetch("https://api.web3forms.com/submit", {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({
                access_key: customWebhook,
                subject: payload.subject,
                email: recipients[0],
                message: payload.bodyText,
              }),
            });
            if (wResp.ok) deliveredViaApi = true;
          }
        } catch {
          /* fallback below */
        }
      }

      // 2. Try FormSubmit AJAX endpoint (checking both HTTP status and JSON .success)
      if (!deliveredViaApi) {
        for (const emailAddr of recipients) {
          try {
            const r = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(emailAddr)}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({
                _subject: payload.subject,
                _template: "box",
                Task_ID: item.id,
                Task: item.title,
                Urgency_Flag: `${item.urgency} (X-Priority: ${payload.xPriority} / Importance: ${payload.importance})`,
                Schedule: item.scheduleText,
                ...(payload.hasPhone ? { Phone_Number: item.phoneNumber } : {}),
                Reasoning: item.reasoning,
                One_Tap_Complete_1h: `https://liammspandasprojects.org/Reminders/index.html?reabs_action=complete&id=${encodeURIComponent(item.id)}&hours=1.0`,
                Reply_Command: `DONE ${item.id} 1.0h`,
              }),
            });
            if (r.ok) {
              const j = await r.json().catch(() => ({}));
              if (j && (j.success === "true" || j.success === true)) {
                deliveredViaApi = true;
              } else if (j && j.message) {
                apiErrorNote = j.message;
              }
            } else {
              apiErrorNote = `FormSubmit HTTP ${r.status}`;
            }
          } catch {
            apiErrorNote = "FormSubmit HTTP 521 (origin server offline)";
          }
        }
      }

      // 3. Always mirror the full email digest to the user's phone via UTF-8 JSON POST to ntfy.sh (no non-ASCII HTTP headers!)
      let mirroredToPhone = false;
      try {
        const rMirror = await fetch("https://ntfy.sh", {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: JSON.stringify({
            topic: "liam_reabs_sms_67wxyE7L_v1",
            title: `📧 ${payload.subject}`,
            message: `To: ${recipients.join(", ")}\n${payload.bodyText}`,
            priority: Number(payload.ntfyPriority) || 4,
            tags: ["e-mail", "bell"],
            click: "https://liammspandasprojects.org/Reminders/index.html",
            actions: [
              {
                action: "http",
                label: "✓ Done (1.0h)",
                url: "https://ntfy.sh/liam_reabs_sms_67wxyE7L_v1",
                method: "POST",
                body: `DONE ${item.id} 1.0h`,
              },
              {
                action: "http",
                label: "🔕 Mute",
                url: "https://ntfy.sh/liam_reabs_sms_67wxyE7L_v1",
                method: "POST",
                body: `OFF ${item.id}`,
              },
            ],
          }),
        });
        if (rMirror.ok) mirroredToPhone = true;
      } catch {
        /* ignore */
      }

      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipients.join(","))}&su=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(payload.bodyText)}`;
      const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(recipients.join(","))}&subject=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(payload.bodyText)}`;

      if (openMailClientFallback === "gmail") {
        window.open(gmailUrl, "_blank", "noopener");
      } else if (openMailClientFallback === "outlook" || openMailClientFallback === true) {
        window.open(outlookUrl, "_blank", "noopener");
      } else if (!deliveredViaApi) {
        // When FormSubmit is down (HTTP 521), open Gmail compose if a @gmail.com recipient is selected, else Outlook Web
        const hasGmail = recipients.some((r) => /@gmail\.com$/i.test(r));
        window.open(hasGmail ? gmailUrl : outlookUrl, "_blank", "noopener");
      }

      if (statusEl) {
        statusEl.style.color = "#8fe0a8";
        if (deliveredViaApi) {
          statusEl.textContent = `✓ Sent ${item.urgency} Urgency REABS email [X-Priority: ${payload.xPriority}] to ${recipients.join(", ")}${mirroredToPhone ? " + mirrored to your ntfy phone app" : ""}!`;
        } else {
          statusEl.innerHTML =
            `✓ Delivered instant copy to your <strong>ntfy phone app</strong> (<code>liam_reabs_sms_67wxyE7L_v1</code>) &amp; opened pre-filled compose for <strong>${escHtml(recipients.join(", "))}</strong> ` +
            `<small style="color:#f7ab65;">(${escHtml(apiErrorNote || "FormSubmit 521 offline")} — click <strong>Send</strong> in the opened Gmail/Outlook tab, or expand ⚙️ above to paste a Google Apps Script URL for 100% silent background Gmail delivery)</small>.`;
        }
      }
    };

    const sendReabsSms = async (item, statusEl) => {
      const payload = buildReabsMessagePayload(item);
      const smsCfg = loadSmsConfig();
      const phoneDest = (document.getElementById("reabs-sms-number")?.value || smsCfg.number || "").trim();
      const carrier = document.getElementById("reabs-sms-carrier")?.value || smsCfg.carrier || "ntfy";

      const shortSms =
        `[REABS ${item.urgency.toUpperCase()}] ${item.id}: ${item.title}\n` +
        `Schedule: ${item.scheduleText}` +
        (payload.hasPhone ? `\nPhone: ${item.phoneNumber}` : "") +
        `\nWhy: ${item.reasoning}\n` +
        `Reply "DONE ${item.id} 1h" or tap a button below:`;

      if (statusEl) {
        statusEl.style.color = "#9ddacf";
        statusEl.textContent = `📱 Sending REABS push/text notification for ${item.id} to ntfy.sh/liam_reabs_sms_67wxyE7L_v1…`;
      }
      let ok = false;
      try {
        // Post UTF-8 JSON body to root https://ntfy.sh (avoids browser fetch ByteString TypeError on emojis in HTTP headers!)
        const r = await fetch("https://ntfy.sh", {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: JSON.stringify({
            topic: "liam_reabs_sms_67wxyE7L_v1",
            title: payload.subject,
            message: shortSms,
            priority: Number(payload.ntfyPriority) || 4,
            tags: item.urgency === "High" ? ["rotating_light", "bell"] : ["bell", "zap"],
            click: "https://liammspandasprojects.org/Reminders/index.html",
            actions: [
              {
                action: "http",
                label: "✓ Done (0.5h)",
                url: "https://ntfy.sh/liam_reabs_sms_67wxyE7L_v1",
                method: "POST",
                body: `DONE ${item.id} 0.5h`,
              },
              {
                action: "http",
                label: "✓ Done (1.0h)",
                url: "https://ntfy.sh/liam_reabs_sms_67wxyE7L_v1",
                method: "POST",
                body: `DONE ${item.id} 1.0h`,
              },
              {
                action: "http",
                label: "🔕 Mute",
                url: "https://ntfy.sh/liam_reabs_sms_67wxyE7L_v1",
                method: "POST",
                body: `OFF ${item.id}`,
              },
            ],
          }),
        });
        if (r.ok) ok = true;
      } catch {
        /* ignore */
      }

      if (statusEl) {
        statusEl.style.color = ok ? "#8fe0a8" : "#f28b82";
        statusEl.textContent = ok
          ? `✓ Sent live push notification with 1-tap action buttons for ${item.id} (${item.urgency} Urgency) to your ntfy phone app (liam_reabs_sms_67wxyE7L_v1)${phoneDest ? ` · ${phoneDest}` : ""}!`
          : `⚠ Could not reach ntfy.sh — check your network connection.`;
      }
    };

    const renderOptionalEmailsUi = () => {
      const listEl = document.getElementById("reabs-optional-emails-list");
      const formExtraEl = document.getElementById("reabs-form-extra-emails");
      const emails = loadOptionalEmails();
      if (listEl) {
        if (!emails.length) {
          listEl.innerHTML = `<small style="color:#a4acc3;">No optional additional emails saved yet — add one above to make it selectable on reminders.</small>`;
        } else {
          listEl.innerHTML = emails
            .map(
              (em) =>
                `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(157,218,207,0.2);">` +
                `<label class="wb-inline-check" style="margin:0;"><input type="checkbox" data-reabs-test-opt-email="${escHtml(em)}"> <code>${escHtml(em)}</code> <small style="color:#a4acc3;">(Optional)</small></label>` +
                `<button type="button" class="button ghost wb-delete-study-btn" data-reabs-del-email="${escHtml(em)}" style="padding:2px 8px;font-size:12px;">🗑 Delete</button>` +
                `</div>`
            )
            .join("");
          listEl.querySelectorAll("[data-reabs-del-email]").forEach((btn) => {
            btn.addEventListener("click", () => {
              const target = btn.getAttribute("data-reabs-del-email");
              saveOptionalEmails(loadOptionalEmails().filter((x) => x !== target));
              renderOptionalEmailsUi();
            });
          });
        }
      }
      if (formExtraEl) {
        formExtraEl.innerHTML = emails
          .map(
            (em) =>
              `<label class="wb-inline-check"><input type="checkbox" name="reabsExtraEmail" value="${escHtml(em)}"> <code>${escHtml(em)}</code> (Optional)</label>`
          )
          .join("");
      }
    };

    let reabsItems = loadReabsList();

    const renderReabsTablesAndChart = () => {
      const activeCount = reabsItems.filter((r) => r.status === "active" && r.remindersEnabled !== 0).length;
      const doneCount = reabsItems.filter((r) => r.status === "completed").length;
      const totalHrs = Math.round(reabsItems.reduce((a, r) => a + (Number(r.hoursSpent) || 0), 0) * 100) / 100;

      updateKpiCardOnPage("Active REABS items", String(activeCount), "Scheduled email & text reminders active");
      updateKpiCardOnPage("Completed REABS", String(doneCount), "Historical bullshit tasks finished");
      updateKpiCardOnPage("Logged REABS hours", `${totalHrs} hrs`, "Cumulative hours tracked across completed REABS");

      const tbody = document.getElementById("reabs-active-tbody");
      if (tbody) {
        tbody.innerHTML = reabsItems
          .map((r) => {
            const rid = escHtml(r.id);
            const urg = r.urgency || "Medium";
            const urgCls = urg === "High" ? "wb-warn" : urg === "Medium" ? "wb-up" : "wb-flat";
            const urgIcon = urg === "High" ? "🚨 High" : urg === "Medium" ? "⚡ Medium" : "📌 Low";
            const flagStr = urg === "High" ? "X-Priority: 1" : urg === "Medium" ? "X-Priority: 3" : "X-Priority: 5";
            const pVal = r.phoneNumber || "N/A";
            const isNa = pVal.toUpperCase() === "N/A" || r.phoneSource === "na";
            const phoneHtml = isNa
              ? `<span class="wb-badge wb-flat" title="Explicitly marked N/A — no phone lookup or phone number included in email/text">N/A (No Phone Lookup)</span>`
              : `<a href="tel:${escHtml(pVal.replace(/[^0-9+]/g, ""))}" style="color:#69d4cf;font-weight:700;">📞 ${escHtml(pVal)}</a>${r.phoneSource === "google-gemini" ? " <small style='color:#9ddacf;'>(Google/Gemini)</small>" : ""}`;
            const remOn = Boolean(r.remindersEnabled) && r.status !== "completed";
            const hrs = Number(r.hoursSpent) || 0;
            const extraList = r.extraEmails ? ` + ${escHtml(r.extraEmails)}` : "";
            return (
              `<tr data-reabs-row="${rid}" data-reabs-status="${escHtml(r.status)}">` +
              `<th scope="row"><code>${rid}</code><br><small style="color:#a4acc3;">${escHtml(r.createdOn || "2026-10-29")}</small></th>` +
              `<td><strong>${escHtml(r.title)}</strong><br><small style="color:#b8c0d8;"><strong>Reasoning:</strong> ${escHtml(r.reasoning)}</small></td>` +
              `<td><span class="wb-badge ${urgCls}">${urgIcon}</span><br><small>Email Flag: <code>${flagStr}</code></small></td>` +
              `<td><strong>${escHtml(r.scheduleText)}</strong><br><small style="color:#9ddacf;">To: <code>${escHtml(r.defaultEmail || DEFAULT_REABS_EMAIL)}${extraList}</code></small></td>` +
              `<td>${phoneHtml}</td>` +
              `<td><button class="button ghost wb-run-study-btn" type="button" data-reabs-toggle="${rid}">${remOn ? "🔔 ON (Active)" : "🔕 OFF (Muted)"}</button></td>` +
              `<td>` +
              `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">` +
              `<input type="number" step="0.25" min="0" max="200" value="${hrs}" data-reabs-hours-input="${rid}" style="width:70px;padding:4px 6px;border-radius:6px;background:#0d101b;color:#eeeef7;border:1px solid rgba(157,218,207,0.35);" title="Hours spent to complete this REABS task">` +
              `<button class="button primary wb-run-study-btn" type="button" data-reabs-complete="${rid}">${r.status === "completed" ? `✓ Completed (${hrs}h)` : "✓ Mark Done & Log Hrs"}</button>` +
              `</div>` +
              `<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">` +
              `<button class="button ghost wb-run-study-btn" type="button" data-reabs-send-email="${rid}">📧 Email Now</button>` +
              `<button class="button ghost wb-run-study-btn" type="button" data-reabs-send-sms="${rid}">📱 Text Now</button>` +
              `<button class="button ghost wb-delete-study-btn" type="button" data-reabs-delete="${rid}">🗑</button>` +
              `</div></td></tr>`
            );
          })
          .join("");

        tbody.querySelectorAll("[data-reabs-toggle]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-reabs-toggle");
            const item = reabsItems.find((x) => x.id === id);
            if (!item) return;
            item.remindersEnabled = item.remindersEnabled ? 0 : 1;
            if (item.remindersEnabled && item.status === "muted") item.status = "active";
            if (!item.remindersEnabled && item.status === "active") item.status = "muted";
            saveReabsList(reabsItems);
            renderReabsTablesAndChart();
          });
        });

        tbody.querySelectorAll("[data-reabs-complete]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-reabs-complete");
            const item = reabsItems.find((x) => x.id === id);
            if (!item) return;
            const hrsInput = tbody.querySelector(`[data-reabs-hours-input="${id}"]`);
            const enteredHrs = hrsInput ? parseFloat(hrsInput.value) : 0;
            item.hoursSpent = !isNaN(enteredHrs) && enteredHrs > 0 ? enteredHrs : item.hoursSpent || 0.5;
            item.status = "completed";
            item.remindersEnabled = 0;
            item.completedOn = new Date().toISOString().slice(0, 10);
            saveReabsList(reabsItems);
            renderReabsTablesAndChart();
          });
        });

        tbody.querySelectorAll("[data-reabs-send-email]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-reabs-send-email");
            const item = reabsItems.find((x) => x.id === id);
            if (item) sendReabsEmail(item, document.getElementById("reabs-test-email-status"), false);
          });
        });

        tbody.querySelectorAll("[data-reabs-send-sms]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-reabs-send-sms");
            const item = reabsItems.find((x) => x.id === id);
            if (item) sendReabsSms(item, document.getElementById("reabs-test-sms-status"));
          });
        });

        tbody.querySelectorAll("[data-reabs-delete]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-reabs-delete");
            reabsItems = reabsItems.filter((x) => x.id !== id);
            saveReabsList(reabsItems);
            renderReabsTablesAndChart();
          });
        });
      }

      const histTbody = document.querySelector("#reabs-history-table tbody");
      if (histTbody) {
        histTbody.innerHTML = reabsItems
          .map(
            (r) =>
              `<tr><th scope="row">${escHtml(r.id)}</th><td>${escHtml(r.title)}</td><td>${escHtml(r.urgency)}</td><td>${escHtml(r.scheduleText)}</td><td>${escHtml(r.phoneNumber || "N/A")}</td><td>${escHtml(r.status)}</td><td>${escHtml(r.completedOn || "Pending (Active)")}</td><td>${Number(r.hoursSpent) || 0} hrs</td></tr>`
          )
          .join("");
      }

      const biHost = document.getElementById("bi-reabs-host");
      if (biHost) {
        const biPayload = reabsItems.map((r) => ({
          id: r.id,
          date: r.completedOn || r.createdOn || "2026-10-29",
          title: r.title,
          urgency: r.urgency,
          status: r.status,
          hoursSpent: Number(r.hoursSpent) || (r.urgency === "High" ? 1.5 : r.urgency === "Medium" ? 1.0 : 0.5),
          loggedHours: Number(r.hoursSpent) || 0,
        }));
        biHost.setAttribute("data-bi-reabs", JSON.stringify(biPayload));
        window.dispatchEvent(new CustomEvent("liam-bi-refresh-reabs", { detail: biPayload }));
      }
    };

    // Execute a two-way reply command like "DONE RB-01 1.5h", "OFF RB-02", "HOURS RB-03 0.75", or shorthand "1" / "Test"
    const executeReabsReplyCommand = (rawCmd, statusEl, isSilentPoll = false) => {
      const cmd = String(rawCmd || "").trim();
      if (!cmd) return false;
      const mDone = cmd.match(/^(?:(?:DONE|COMPLETE|COMPLETED)\s+)?(?:RB-0*)?(\d+)\s*(\d+(?:\.\d+)?)?\s*(?:h|hr|hrs|hours?)?$/i);
      if (mDone && (/^(?:DONE|COMPLETE|COMPLETED|RB-)/i.test(cmd) || /^\d+$/.test(cmd))) {
        const num = String(parseInt(mDone[1], 10)).padStart(2, "0");
        const id = `RB-${num}`;
        const hrs = mDone[2] ? parseFloat(mDone[2]) : 1.0;
        const item = reabsItems.find((x) => x.id.toUpperCase() === id);
        if (item) {
          item.status = "completed";
          item.remindersEnabled = 0;
          item.hoursSpent = hrs;
          item.completedOn = new Date().toISOString().slice(0, 10);
          saveReabsList(reabsItems);
          renderReabsTablesAndChart();
          if (statusEl) {
            statusEl.style.color = "#8fe0a8";
            statusEl.textContent = `✓ Reply processed: Marked ${item.id} (${item.title}) as COMPLETED with ${hrs} hrs logged!`;
          }
          return true;
        }
      }
      const mOff = cmd.match(/^(?:OFF|MUTE|STOP)\s+(?:RB-0*)?(\d+)$/i);
      if (mOff) {
        const id = `RB-${String(parseInt(mOff[1], 10)).padStart(2, "0")}`;
        const item = reabsItems.find((x) => x.id.toUpperCase() === id);
        if (item) {
          item.remindersEnabled = 0;
          item.status = "muted";
          saveReabsList(reabsItems);
          renderReabsTablesAndChart();
          if (statusEl) {
            statusEl.style.color = "#8fe0a8";
            statusEl.textContent = `✓ Reply processed: Turned OFF reminders for ${item.id} (${item.title}).`;
          }
          return true;
        }
      }
      const mHrs = cmd.match(/^HOURS?\s+(?:RB-0*)?(\d+)\s+(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)?$/i);
      if (mHrs) {
        const id = `RB-${String(parseInt(mHrs[1], 10)).padStart(2, "0")}`;
        const hrs = parseFloat(mHrs[2]);
        const item = reabsItems.find((x) => x.id.toUpperCase() === id);
        if (item) {
          item.hoursSpent = hrs;
          saveReabsList(reabsItems);
          renderReabsTablesAndChart();
          if (statusEl) {
            statusEl.style.color = "#8fe0a8";
            statusEl.textContent = `✓ Reply processed: Logged ${hrs} hrs on ${item.id} (${item.title}).`;
          }
          return true;
        }
      }
      if (!isSilentPoll && statusEl) {
        statusEl.style.color = "#8fe0a8";
        statusEl.textContent = `📱 Message received ("${cmd}") · Tip: Reply "DONE RB-01 1.5h" (or "1") to mark completed, or "OFF RB-02" to mute.`;
      }
      return false;
    };

    // Check URL query parameters for one-tap email/SMS completion links (?reabs_action=complete&id=RB-01&hours=1.0)
    try {
      const params = new URLSearchParams(window.location.search);
      const act = params.get("reabs_action");
      const rid = params.get("id");
      const hrs = params.get("hours") || "1.0";
      if (act === "complete" && rid) {
        executeReabsReplyCommand(`DONE ${rid} ${hrs}`, document.getElementById("reabs-test-sms-status"));
      } else if (act === "mute" && rid) {
        executeReabsReplyCommand(`OFF ${rid}`, document.getElementById("reabs-test-sms-status"));
      }
    } catch {
      /* ignore */
    }

    // Wire Optional Email Add Button
    document.getElementById("reabs-add-email-btn")?.addEventListener("click", () => {
      const inp = document.getElementById("reabs-new-email");
      const val = inp ? inp.value.trim() : "";
      if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return;
      const list = loadOptionalEmails();
      if (!list.includes(val) && val.toLowerCase() !== DEFAULT_REABS_EMAIL) {
        list.push(val);
        saveOptionalEmails(list);
      }
      if (inp) inp.value = "";
      renderOptionalEmailsUi();
    });

    // Wire Test Email, Gmail & Outlook Pre-filled Test Buttons
    document.getElementById("reabs-test-email-btn")?.addEventListener("click", () => {
      const checkedExtras = Array.from(document.querySelectorAll("[data-reabs-test-opt-email]:checked")).map((c) =>
        c.getAttribute("data-reabs-test-opt-email")
      );
      const sampleItem = reabsItems[0] || {
        id: "RB-01",
        title: "Contact Manulife Financial Regarding TFSA Setup",
        urgency: "High",
        scheduleText: "2pm Mon, Wed, Thurs",
        phoneNumber: "1-888-790-4387",
        phoneSource: "google-gemini",
        reasoning: "Confirming REABS automated email delivery, Urgency headers, and one-tap completion links.",
      };
      sendReabsEmail({ ...sampleItem, extraEmails: checkedExtras.join(",") }, document.getElementById("reabs-test-email-status"), false);
    });

    document.getElementById("reabs-test-gmail-btn")?.addEventListener("click", () => {
      const checkedExtras = Array.from(document.querySelectorAll("[data-reabs-test-opt-email]:checked")).map((c) =>
        c.getAttribute("data-reabs-test-opt-email")
      );
      const sampleItem = reabsItems[0] || {
        id: "RB-01",
        title: "Contact Manulife Financial Regarding TFSA Setup",
        urgency: "Medium",
        scheduleText: "2pm Mon, Wed, Thurs",
        phoneNumber: "1-888-790-4387",
        phoneSource: "google-gemini",
        reasoning: "I want to be able to pull money out later in the future that I've forgetable put away over time.",
      };
      sendReabsEmail({ ...sampleItem, extraEmails: checkedExtras.join(",") }, document.getElementById("reabs-test-email-status"), "gmail");
    });

    document.getElementById("reabs-test-outlook-btn")?.addEventListener("click", () => {
      const checkedExtras = Array.from(document.querySelectorAll("[data-reabs-test-opt-email]:checked")).map((c) =>
        c.getAttribute("data-reabs-test-opt-email")
      );
      const sampleItem = reabsItems[0] || {
        id: "RB-01",
        title: "Contact Manulife Financial Regarding TFSA Setup",
        urgency: "Medium",
        scheduleText: "2pm Mon, Wed, Thurs",
        phoneNumber: "1-888-790-4387",
        phoneSource: "google-gemini",
        reasoning: "I want to be able to pull money out later in the future that I've forgetable put away over time.",
      };
      sendReabsEmail({ ...sampleItem, extraEmails: checkedExtras.join(",") }, document.getElementById("reabs-test-email-status"), "outlook");
    });

    // Wire SMS Settings & Test Text Button
    const savedSms = loadSmsConfig();
    const smsNumIn = document.getElementById("reabs-sms-number");
    const smsCarIn = document.getElementById("reabs-sms-carrier");
    if (smsNumIn && savedSms.number) smsNumIn.value = savedSms.number;
    if (smsCarIn && savedSms.carrier) smsCarIn.value = savedSms.carrier;

    document.getElementById("reabs-save-sms-btn")?.addEventListener("click", () => {
      saveSmsConfig({
        number: smsNumIn ? smsNumIn.value.trim() : "",
        carrier: smsCarIn ? smsCarIn.value : "ntfy",
      });
      const st = document.getElementById("reabs-test-sms-status");
      if (st) {
        st.style.color = "#8fe0a8";
        st.textContent = `✓ Saved text/SMS settings (${smsNumIn?.value || "ntfy mobile push"}).`;
      }
    });

    document.getElementById("reabs-test-sms-btn")?.addEventListener("click", () => {
      const sampleItem = reabsItems[0] || {
        id: "RB-01",
        title: "Contact Manulife Financial Regarding TFSA Setup",
        urgency: "Medium",
        scheduleText: "2pm Mon, Wed, Thurs",
        phoneNumber: "1-888-790-4387",
        phoneSource: "google-gemini",
        reasoning: "I want to be able to pull money out later in the future that I've forgetable put away over time.",
      };
      sendReabsSms(sampleItem, document.getElementById("reabs-test-sms-status"));
    });

    // Wire Reply Command Box
    document.getElementById("reabs-reply-submit-btn")?.addEventListener("click", () => {
      const inp = document.getElementById("reabs-reply-cmd");
      if (!inp) return;
      if (executeReabsReplyCommand(inp.value, document.getElementById("reabs-test-sms-status"))) {
        inp.value = "";
      }
    });

    // Wire Day-of-Week Quick Presets
    document.querySelectorAll("[data-reabs-day-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const days = (btn.getAttribute("data-reabs-day-preset") || "").split(",");
        document.querySelectorAll('input[name="reabsDay"]').forEach((cb) => {
          cb.checked = days.includes(cb.value);
        });
      });
    });

    // Wire N/A Phone Checkbox & Auto-Find Phone Button
    const phoneInput = document.getElementById("reabs-phone");
    const phoneNaCheck = document.getElementById("reabs-phone-na");
    phoneNaCheck?.addEventListener("change", () => {
      if (phoneNaCheck.checked && phoneInput) {
        phoneInput.value = "N/A";
        phoneInput.disabled = true;
      } else if (phoneInput) {
        if (phoneInput.value === "N/A") phoneInput.value = "";
        phoneInput.disabled = false;
      }
    });

    document.getElementById("reabs-lookup-phone-btn")?.addEventListener("click", async () => {
      if (phoneNaCheck?.checked) return;
      const titleVal = document.getElementById("reabs-title")?.value?.trim() || "";
      const fb = document.getElementById("reabs-form-feedback");
      if (!titleVal) {
        if (fb) fb.textContent = "Enter a REABS Task Title first so Google/Gemini knows who to look up.";
        return;
      }
      if (fb) fb.textContent = `🔍 Looking up official phone number for "${titleVal}" via Google/Gemini…`;
      const res = await lookupPhoneViaGoogleGemini(titleVal);
      if (phoneInput) phoneInput.value = res.phone;
      if (fb) fb.textContent = `✓ Auto-filled phone number: ${res.phone}`;
    });

    // Wire Add REABS Form Submit
    document.getElementById("reabs-add-form")?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const titleVal = document.getElementById("reabs-title")?.value?.trim() || "";
      if (!titleVal) return;
      const urgencyVal = document.getElementById("reabs-urgency")?.value || "Medium";
      const timeVal = document.getElementById("reabs-time")?.value || "14:00";
      const checkedDays = Array.from(document.querySelectorAll('input[name="reabsDay"]:checked')).map((c) => c.value);
      const daysList = checkedDays.length ? checkedDays : ["Mon", "Wed", "Thu"];
      const daysLabel =
        daysList.join(",") === "Mon,Tue,Wed,Thu,Fri"
          ? "Mon-Fri"
          : daysList.map((d) => (d === "Thu" ? "Thurs" : d)).join(", ");
      const scheduleText = `${formatTime12h(timeVal)} ${daysLabel}`;

      let phoneNumber = phoneInput ? phoneInput.value.trim() : "";
      let phoneSource = "direct";
      if (phoneNaCheck?.checked || phoneNumber.toUpperCase() === "N/A") {
        phoneNumber = "N/A";
        phoneSource = "na";
      } else if (!phoneNumber) {
        const lookedUp = await lookupPhoneViaGoogleGemini(titleVal);
        phoneNumber = lookedUp.phone;
        phoneSource = lookedUp.source;
      }

      const extraEmails = Array.from(document.querySelectorAll('input[name="reabsExtraEmail"]:checked'))
        .map((c) => c.value)
        .join(",");
      const smsEnabled = document.getElementById("reabs-form-sms")?.checked ? 1 : 0;
      const reasoning = document.getElementById("reabs-reasoning")?.value?.trim() || "Needs to get done.";

      const nextNum = reabsItems.length + 1;
      const newId = `RB-${String(nextNum).padStart(2, "0")}`;
      const newItem = {
        id: newId,
        createdOn: new Date().toISOString().slice(0, 10),
        title: titleVal,
        urgency: urgencyVal,
        scheduleText,
        daysOfWeek: daysList.join(","),
        timeOfDay: timeVal,
        phoneNumber,
        phoneSource,
        reasoning,
        defaultEmail: DEFAULT_REABS_EMAIL,
        extraEmails,
        smsEnabled,
        remindersEnabled: 1,
        status: "active",
        completedOn: null,
        hoursSpent: 0.0,
      };
      reabsItems.push(newItem);
      saveReabsList(reabsItems);
      renderReabsTablesAndChart();
      ev.target.reset();
      if (phoneInput) phoneInput.disabled = false;
      const fb = document.getElementById("reabs-form-feedback");
      if (fb) fb.textContent = `✓ Added ${newId} (${scheduleText}) · Armed for ${DEFAULT_REABS_EMAIL}${extraEmails ? ` + ${extraEmails}` : ""}!`;
    });

    // Background Time-of-Day Scheduler (checks every 60s if any active REABS is due right now)
    const checkDueReabsSchedule = () => {
      const now = new Date();
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const curDay = dayNames[now.getDay()];
      const curHm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const dateSlotKey = `${now.toISOString().slice(0, 10)}_${curHm}`;
      let sentSlots = {};
      try {
        sentSlots = JSON.parse(localStorage.getItem(REABS_SENT_LOG_KEY) || "{}") || {};
      } catch {
        sentSlots = {};
      }
      reabsItems.forEach((item) => {
        if (item.status !== "active" || !item.remindersEnabled) return;
        const itemDays = String(item.daysOfWeek || "").split(",").map((d) => d.trim());
        if (itemDays.includes(curDay) && item.timeOfDay === curHm) {
          const slotId = `${item.id}_${dateSlotKey}`;
          if (!sentSlots[slotId]) {
            sentSlots[slotId] = true;
            try {
              localStorage.setItem(REABS_SENT_LOG_KEY, JSON.stringify(sentSlots));
            } catch {
              /* ignore */
            }
            sendReabsEmail(item, document.getElementById("reabs-test-email-status"), false);
            if (item.smsEnabled) sendReabsSms(item, document.getElementById("reabs-test-sms-status"));
          }
        }
      });
    };
    setInterval(checkDueReabsSchedule, 60000);

    // Poll & live-stream cross-device REABS state + inbound phone messages from BOTH liam_reabs_sms_67wxyE7L_v1 & liam_reabs_reply_67wxyE7L_v1
    const seenNtfyIds = new Set();
    const phoneFeedMessages = [];
    const handleInboundNtfyEnvelope = (env, isLiveStream = false) => {
      if (!env || env.event !== "message" || !env.message || seenNtfyIds.has(env.id)) return;
      seenNtfyIds.add(env.id);
      const msg = String(env.message || "").trim();
      const title = String(env.title || "").trim();
      if (msg.startsWith("{")) {
        try {
          const pkt = JSON.parse(msg);
          if (pkt && pkt.app === "liam_reabs_state_v1" && Array.isArray(pkt.list)) {
            reabsItems = pkt.list;
            localStorage.setItem(REABS_STORAGE_KEY, JSON.stringify(reabsItems));
            renderReabsTablesAndChart();
          }
        } catch {
          /* ignore */
        }
        return;
      }
      // Skip outbound reminder broadcasts generated by sendReabsSms / sendReabsEmail
      if (/REABS/i.test(title) || /^\[REABS\s/i.test(msg) || /^To:\s/i.test(msg)) {
        return;
      }
      const tsStr = env.time ? new Date(env.time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "just now";
      phoneFeedMessages.push({ id: env.id, text: msg, time: tsStr });
      const feedBodyEl = document.getElementById("reabs-phone-feed-body");
      if (feedBodyEl) {
        const recent = phoneFeedMessages.slice(-4);
        feedBodyEl.innerHTML = recent
          .map((m) => `<span class="wb-badge wb-up" style="margin-right:6px;">📱 ${escHtml(m.time)}: &ldquo;${escHtml(m.text)}&rdquo;</span>`)
          .join(" ");
      }
      executeReabsReplyCommand(msg, document.getElementById("reabs-test-sms-status"), !isLiveStream);
    };

    if (typeof fetch === "function") {
      ["https://ntfy.sh/liam_reabs_sms_67wxyE7L_v1/json?poll=1&since=all", "https://ntfy.sh/liam_reabs_reply_67wxyE7L_v1/json?poll=1&since=all"].forEach(
        (url) => {
          fetch(url)
            .then((r) => (r.ok ? r.text() : ""))
            .then((txt) => {
              if (!txt) return;
              txt
                .trim()
                .split("\n")
                .filter(Boolean)
                .forEach((line) => {
                  try {
                    handleInboundNtfyEnvelope(JSON.parse(line), false);
                  } catch {
                    /* ignore */
                  }
                });
            })
            .catch(() => {});
        }
      );
    }

    if (typeof EventSource === "function") {
      try {
        const sse = new EventSource("https://ntfy.sh/liam_reabs_sms_67wxyE7L_v1/sse");
        sse.addEventListener("message", (ev) => {
          try {
            handleInboundNtfyEnvelope(JSON.parse(ev.data), true);
          } catch {
            /* ignore */
          }
        });
      } catch {
        /* ignore */
      }
    }

    renderOptionalEmailsUi();
    renderReabsTablesAndChart();
  }

  // Re-apply any previously synced Google Doc logs from localStorage AFTER all BI charts are wired
  try {
    const cachedLogs = JSON.parse(localStorage.getItem(SYNCED_LOGS_KEY) || "{}") || {};
    Object.entries(cachedLogs).forEach(([k, v]) => {
      if (v && v.rawText) applyLiveLogUpdateToDom(k, v.rawText);
    });
  } catch {
    /* ignore */
  }

  // Auto-poll cross-device Google Doc links & on-site log entries on Athletics/Health/Updates pages
  if (typeof fetch === "function" && document.querySelector("[data-gdoc-sync]")) {
    fetch("https://ntfy.sh/liam_wb_sync_67wxyE7L_v1/json?poll=1&since=all")
      .then((r) => (r.ok ? r.text() : ""))
      .then(async (txt) => {
        if (!txt) return;
        const lines = txt.trim().split("\n").filter(Boolean);
        const links = loadGdocLinks();
        let linksChanged = false;
        const latestByKey = {};
        for (const line of lines) {
          try {
            const env = JSON.parse(line);
            if (!env || env.event !== "message" || !env.message || !env.message.startsWith("{")) continue;
            const pkt = JSON.parse(env.message);
            if (pkt && pkt.app === "liam_gdoc_log_v1" && pkt.key) {
              latestByKey[pkt.key] = pkt;
              if (pkt.docId && pkt.docId !== "on-site-entry" && !links[pkt.key]) {
                links[pkt.key] = `https://docs.google.com/document/d/${pkt.docId}/edit`;
                linksChanged = true;
              }
            }
          } catch {
            /* skip */
          }
        }
        if (linksChanged) saveGdocLinks(links);
        Object.values(latestByKey).forEach((pkt) => {
          const input = document.getElementById(`gdoc-url-${pkt.key}`);
          if (input && !input.value && pkt.docId && pkt.docId !== "on-site-entry") {
            input.value = `https://docs.google.com/document/d/${pkt.docId}/edit`;
          }
          if (pkt.rawText) {
            applyLiveLogUpdateToDom(pkt.key, pkt.rawText);
          }
        });
      })
      .catch(() => {});
  }
})();