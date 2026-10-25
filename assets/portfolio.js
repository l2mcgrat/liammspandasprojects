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

  // ---- Auto-integrate browser-executed Workbench studies into Atlas Destination pages & Mental Map ----
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
        const left = 265;
        const width = 520;
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

      // 1. On an outlined Atlas leaf page, inject a live Study Tab with KPIs, SVG chart, data table, Pandas .py & LaTeX
      const leafMain = document.querySelector("main.atlas-leaf");
      if (leafMain) {
        const matching = runEntries.filter((r) => current.includes(`/${r.study.atlasPath}/`));
        if (matching.length > 0) {
          const ledeEl = leafMain.querySelector(".leaf-hero .lede");
          if (ledeEl && /first study is being prepared/i.test(ledeEl.textContent)) {
            ledeEl.textContent = `Live Workbench study active (${matching.map((m) => m.study.id).join(", ")}): empirical benchmarks, SVG chart, Pandas code, and LaTeX paper below.`;
          }
          matching.forEach((rec) => {
            const st = rec.study;
            const an = rec.analytics || {};
            const kpis = Array.isArray(an.kpis) ? an.kpis : [];
            const cols = Array.isArray(an.tableColumns) ? an.tableColumns : [];
            const rows = Array.isArray(an.tableRows) ? an.tableRows : [];
            const sec = document.createElement("section");
            sec.className = "atlas-features";
            sec.style.marginTop = "22px";
            sec.innerHTML = [
              `<p class="eyebrow">Live Workbench Study · ${esc(st.id)} · ${esc(rec.mode)}</p>`,
              `<h2>${esc(st.title)}</h2>`,
              `<p style="color:#a4acc3;"><strong>Primary datasets:</strong> ${esc(rec.dataset || st.dataset)}</p>`,
              kpis.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:14px 0;">${kpis.map((k) => `<div style="padding:14px;border:1px solid #69d4cf44;border-radius:8px;background:#111624;"><span style="display:block;font-size:11px;text-transform:uppercase;color:#a4acc3;">${esc(k.label)}</span><strong style="font-size:20px;color:#9ddacf;">${esc(k.value)}</strong><small style="display:block;color:#a4acc3;margin-top:4px;">${esc(k.note || "")}</small></div>`).join("")}</div>` : "",
              renderSvg(st.id, an),
              `<div style="white-space:pre-wrap;line-height:1.65;margin:16px 0;padding:18px;border:1px solid #ffffff1a;border-radius:8px;background:#0e1320;">${esc(rec.summary)}</div>`,
              cols.length && rows.length ? `<div style="overflow-x:auto;margin:14px 0;"><table style="width:100%;border-collapse:collapse;"><thead><tr>${cols.map((c) => `<th style="text-align:left;padding:8px 10px;border-bottom:1px solid #ffffff24;">${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td style="padding:8px 10px;border-bottom:1px solid #ffffff12;">${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : "",
              an.pandasScript ? `<details open style="margin:14px 0;"><summary style="cursor:pointer;font-weight:700;color:#9ddacf;">🐍 Reproducible Pandas Analysis Script (${esc(st.id.toLowerCase())}_pandas.py)</summary><pre style="padding:14px;border:1px solid #69d4cf44;border-radius:8px;background:#080b14;overflow-x:auto;"><code>${esc(an.pandasScript)}</code></pre></details>` : "",
            ].join("");
            const siblingsNav = leafMain.querySelector(".atlas-siblings");
            if (siblingsNav) leafMain.insertBefore(sec, siblingsNav);
            else leafMain.appendChild(sec);
          });
        }
      }

      // 2. On Mental-Map/index.html, inject any newly run Workbench studies into their matching section
      const mmPaper = document.querySelector(".document-page .tex-paper");
      if (mmPaper && current.includes("/Mental-Map/")) {
        let injectedAny = false;
        runEntries.forEach((rec) => {
          const st = rec.study;
          const slug = st.atlasPath.split("/").pop().toLowerCase();
          const heading = document.getElementById(`sec:${slug}`) || document.getElementById(slug);
          if (!heading) return;
          // Avoid duplicating if already built into static mental_map.tex
          if (mmPaper.textContent.includes(st.title)) return;
          const nextEl = heading.nextElementSibling;
          const wrapper = document.createElement("div");
          wrapper.className = "wb-mm-injected";
          wrapper.innerHTML = [
            `<aside class="topic-callout"><span>Go deeper ↗</span><a href="../${esc(st.atlasPath)}/index.html">Open the ${esc(st.title)} dashboard &amp; charts</a><small>Live Gemini 4 Argon + Pandas study (${esc(st.id)})</small></aside>`,
            `<h5>${esc(st.id)} · ${esc(st.title)}</h5>`,
            `<p><em>Primary data sources:</em> ${esc(rec.dataset || st.dataset)}</p>`,
            ...String(rec.summary || "").split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`),
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
})();