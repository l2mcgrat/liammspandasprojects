/* Interactive regional economy map inspector and Alberta demographic dimension filter. */
(() => {
  const layout = document.querySelector(".study-map-layout[data-regions]");
  if (layout) {
    let regions = [];
    try {
      regions = JSON.parse(layout.getAttribute("data-regions") || "[]");
    } catch {
      regions = [];
    }
    const byId = new Map(regions.map((r) => [r.id, r]));
    const selectRegion = (id) => {
      const reg = byId.get(id);
      if (!reg) return;
      document.querySelectorAll("[data-region-node]").forEach((node) => {
        node.classList.toggle("is-selected", node.getAttribute("data-region-node") === id);
      });
      document.querySelectorAll("[data-region-btn]").forEach((btn) => {
        btn.classList.toggle("is-active", btn.getAttribute("data-region-btn") === id);
      });
      const setTxt = (elId, val) => {
        const el = document.getElementById(elId);
        if (el) el.textContent = val;
      };
      setTxt("reg-country", `${reg.country} · Regional Economy Inspector`);
      setTxt("reg-name", reg.name);
      setTxt("reg-gdp", `$${Number(reg.gdpBillions).toLocaleString()}B`);
      setTxt("reg-workers", `${Number(reg.workersMillions).toFixed(1)}M`);
      setTxt("reg-surf", `${Number(reg.surfacePct).toFixed(1)}%`);
      setTxt("reg-sub", `${Number(reg.submergedPct).toFixed(1)}%`);
      setTxt("reg-sig", reg.signature);
      const barsEl = document.getElementById("reg-sectors");
      if (barsEl && reg.sectors) {
        barsEl.replaceChildren();
        for (const [sector, pct] of Object.entries(reg.sectors)) {
          const row = document.createElement("div");
          row.className = "study-sector-row";
          const label = document.createElement("span");
          label.textContent = sector;
          const track = document.createElement("div");
          track.className = "study-sector-track";
          const fill = document.createElement("div");
          fill.className = "study-sector-fill";
          fill.style.width = `${Math.min(100, Number(pct) * 3)}%`;
          track.appendChild(fill);
          const strong = document.createElement("strong");
          strong.textContent = `${pct}%`;
          row.append(label, track, strong);
          barsEl.appendChild(row);
        }
      }
    };

    document.querySelectorAll("[data-region-node]").forEach((node) => {
      node.addEventListener("click", () => selectRegion(node.getAttribute("data-region-node")));
      node.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          selectRegion(node.getAttribute("data-region-node"));
        }
      });
    });
    document.querySelectorAll("[data-region-btn]").forEach((btn) => {
      btn.addEventListener("click", () => selectRegion(btn.getAttribute("data-region-btn")));
    });
  }

  // Alberta Referendum demographic dimension filter
  const dimButtons = document.querySelectorAll("[data-ab-dim]");
  if (dimButtons.length) {
    dimButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const dim = btn.getAttribute("data-ab-dim");
        dimButtons.forEach((b) => b.classList.toggle("is-active", b === btn));
        document.querySelectorAll("#ab-demo-body tr").forEach((tr) => {
          tr.hidden = dim !== "All" && tr.getAttribute("data-ab-row") !== dim;
        });
      });
    });
  }
})();
