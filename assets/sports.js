/* Progressive enhancement only. No network, libraries, inline data or HTML sinks.
 * Requires window.BASKETBALL_ANALYSIS from the parent's local data asset.
 * Static server-rendered figures and tables are the missing-data/no-JS fallback.
 */
(() => {
  "use strict";
  const names = { L: "Liam", O: "Owen" };
  const challengeOrder = ["shooting", "bump", "horse", "backboard", "three-point", "rim", "one-on-one"];
  const labels = { shooting: "Shooting", bump: "Bump", horse: "HORSE", backboard: "Backboard", "three-point": "3 Point", rim: "Rim", "one-on-one": "1v1" };
  const object = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const rows = value => Array.isArray(value) ? value.filter(row => row && typeof row === "object" && !Array.isArray(row)) : [];
  const integer = value => typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  const player = value => value === "L" || value === "O" ? value : "unknown";
  const name = value => names[player(value)] || "Unrecorded";
  const label = value => Object.hasOwn(labels, String(value)) ? labels[value] : String(value || "Unrecorded challenge");
  const text = value => value == null ? "" : String(value);
  const percent = (count, total) => integer(total) ? `${(100 * integer(count) / integer(total)).toFixed(1)}%` : "—";
  const element = (tag, content, className) => {
    const node = document.createElement(tag);
    if (content != null) node.textContent = text(content);
    if (className) node.className = className;
    return node;
  };
  // SVG attributes here are fixed names, fixed classes or finite numeric geometry.
  const svgElement = (tag, attributes = {}, content) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    if (content != null) node.textContent = text(content);
    return node;
  };

  function init() {
    const page = document.querySelector(".sports-page");
    if (!page) return;
    const byId = id => page.querySelector(`#${id}`); // Callers supply only fixed IDs.
    const netButton = byId("sports-net-boop");
    if (netButton) {
      const art = netButton.closest(".sports-art");
      if (art) {
        netButton.disabled = false;
        const status = element("p", "", "sports-note");
        status.setAttribute("role", "status");
        art.append(status);
        netButton.addEventListener("click", () => {
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            status.textContent = "Swish. Motion is off for your reduced-motion preference.";
            return;
          }
          if (art.classList.contains("is-shooting")) return;
          art.classList.add("is-shooting");
          status.textContent = "An illustrated swish — not a recorded shot.";
          window.setTimeout(() => art.classList.remove("is-shooting"), 1450);
        });
      }
    }
    if (!page.hasAttribute("data-sports-dashboard")) return;

    const data = object(window.BASKETBALL_ANALYSIS);
    const status = byId("sports-data-status");
    if (data.schemaVersion !== 1 || !Array.isArray(data.series)) return;
    const series = rows(data.series).filter(item =>
      typeof item.id === "string" && Array.isArray(item.rounds) &&
      Array.isArray(item.trajectory) && Number.isInteger(item.roundCount) &&
      item.roundCount >= 4 && item.roundCount <= 7 && item.rounds.length === item.roundCount
    );
    if (!series.length) {
      if (status) status.textContent = "No completed series are available. Static evidence and source links remain readable.";
      return;
    }
    const requiredIds = ["sports-series-select", "sports-series-controls", "sports-round-range", "sports-round-controls", "sports-round-prev", "sports-round-next", "sports-selected-title", "sports-series-note", "sports-round-score", "sports-round-context", "sports-round-list", "sports-trajectory", "play-by-play"];
    if (requiredIds.some(id => !byId(id))) return;

    const lookup = new Map(series.map(item => [item.id, item]));
    const fallback = lookup.get("2026-09-10-1") || series.find(item => item.decider) || series[0];
    let selected = fallback;
    let selectedRound = fallback.roundCount;
    const select = byId("sports-series-select");
    const range = byId("sports-round-range");
    const previous = byId("sports-round-prev");
    const next = byId("sports-round-next");
    const logRows = [...page.querySelectorAll("#sports-series-table tbody tr[data-series-id]")];

    function readLocation() {
      const params = new URL(window.location.href).searchParams;
      selected = lookup.get(params.get("series")) || fallback;
      const rawRound = params.get("round");
      const parsedRound = rawRound != null && /^\d{1,2}$/.test(rawRound) ? Number(rawRound) : NaN;
      // Invalid series IDs fall back to the complete default story, not a partial
      // round of an unrelated series supplied by the invalid URL.
      selectedRound = (!params.has("series") || lookup.has(params.get("series"))) &&
        Number.isInteger(parsedRound) && parsedRound >= 0 && parsedRound <= selected.roundCount
        ? parsedRound : selected.roundCount;
    }

    function writeLocation(focusWalkthrough = false) {
      const url = new URL(window.location.href);
      url.searchParams.set("series", selected.id);
      url.searchParams.set("round", String(selectedRound));
      if (focusWalkthrough) url.hash = "play-by-play";
      try {
        window.history.replaceState(null, "", url.href);
      } catch (_error) {
        // Sandboxed/file previews can deny history changes; controls still work.
      }
    }

    function focusWalkthrough() {
      const section = byId("play-by-play");
      section.focus({ preventScroll: true });
      section.scrollIntoView({ behavior: "instant", block: "start" });
    }

    function drawTrajectory() {
      const svg = byId("sports-trajectory");
      const fragment = document.createDocumentFragment();
      const count = selected.roundCount;
      const points = rows(selected.trajectory).filter(point => integer(point.round) <= selectedRound);
      fragment.append(
        svgElement("title", { id: "trajectory-title" }, `Cumulative round wins · ${text(selected.date)} / session ${integer(selected.session)}`),
        svgElement("desc", { id: "trajectory-desc" }, `Through round ${selectedRound} of ${count}. Y axis: round wins, zero to four. L / Liam: circles and solid line. O / Owen: squares and dashed line. Source round log follows.`),
        svgElement("text", { x: 55, y: 25 }, "Round wins / first to 4")
      );
      for (let score = 0; score <= 4; score += 1) {
        const y = 246 - score * 48;
        fragment.append(svgElement("line", { class: "chart-grid", x1: 55, x2: 835, y1: y, y2: y }), svgElement("text", { x: 40, y: y + 4, "text-anchor": "end" }, score));
      }
      for (let round = 0; round <= count; round += 1) {
        fragment.append(svgElement("text", { x: 55 + round * 780 / count, y: 273, "text-anchor": "middle" }, round));
      }
      const lines = svgElement("g", { id: "sports-trajectory-lines" });
      for (const who of ["L", "O"]) {
        const coords = points.map(point => [55 + Math.min(count, integer(point.round)) * 780 / count, 246 - Math.min(4, integer(point[who])) * 48]);
        lines.append(svgElement("polyline", { class: `trajectory-line player-${who}`, points: coords.map(point => point.join(",")).join(" ") }));
        for (const [x, y] of coords) {
          lines.append(who === "L"
            ? svgElement("circle", { class: "trajectory-dot player-L", cx: x, cy: y, r: 5 })
            : svgElement("rect", { class: "trajectory-dot player-O", x: x - 5, y: y - 5, width: 10, height: 10 }));
        }
      }
      const marker = 55 + selectedRound * 780 / count;
      fragment.append(lines, svgElement("line", { id: "sports-round-marker", class: "round-marker", x1: marker, x2: marker, y1: 45, y2: 253 }), svgElement("text", { x: 450, y: 305, "text-anchor": "middle" }, "Round →"));
      svg.replaceChildren(fragment);
    }

    function drawRoundLog() {
      const fragment = document.createDocumentFragment();
      for (const row of rows(selected.rounds)) {
        const number = integer(row.number);
        const item = element("li");
        item.id = `sports-round-${number}`;
        const content = element("div");
        const heading = element("h3", label(row.challenge));
        heading.append(element("span", `${player(row.winner)} / ${name(row.winner)} wins`, `player-${player(row.winner)}`));
        const wins = object(row.cumulativeWins);
        const picker = row.inferredPicker ? `${name(row.inferredPicker)} (inferred from previous winner)` : "Unrecorded · opening round";
        const raw = element("p", "Raw score: ");
        const time = object(row.time);
        const timeText = row.challenge === "three-point" ? `${time.raw == null ? "Absent" : text(time.raw)} · ${text(time.status || "missing")}` : "Not applicable";
        raw.append(element("strong", row.scoreRaw == null ? "Not recorded" : row.scoreRaw), document.createTextNode(" · Raw time: "), element("strong", timeText));
        content.append(heading, element("p", `Series score: L ${integer(wins.L)} – O ${integer(wins.O)}. Picker: ${picker}.`), raw, element("p", `Note: ${text(row.note) || "None recorded"}`));
        item.append(element("span", String(number).padStart(2, "0"), "sports-round-number"), content);
        fragment.append(item);
      }
      byId("sports-round-list").replaceChildren(fragment);
    }

    function renderRound() {
      range.max = String(selected.roundCount);
      range.value = String(selectedRound);
      range.setAttribute("aria-valuetext", `Round ${selectedRound} of ${selected.roundCount}`);
      previous.disabled = selectedRound === 0;
      next.disabled = selectedRound === selected.roundCount;
      const point = rows(selected.trajectory).find(row => row.round === selectedRound) || { L: 0, O: 0 };
      const isFinal = selectedRound === selected.roundCount;
      byId("sports-round-score").textContent = `Round ${selectedRound} of ${selected.roundCount} · L ${integer(point.L)} – O ${integer(point.O)}${isFinal ? " · Final" : ""}`;
      const round = rows(selected.rounds).find(row => row.number === selectedRound);
      byId("sports-round-context").textContent = round
        ? `${label(round.challenge)} · ${name(round.winner)} won this round.${isFinal ? " First to four ends the series." : ""}`
        : "Before the opening round · L 0 – O 0. Opening picker unrecorded.";
      for (const item of byId("sports-round-list").children) {
        if (item.id === `sports-round-${selectedRound}`) item.setAttribute("aria-current", "step");
        else item.removeAttribute("aria-current");
      }
      drawTrajectory();
    }

    function renderSeries() {
      select.value = selected.id;
      byId("sports-selected-title").textContent = `${text(selected.date)} / session ${integer(selected.session)}`;
      byId("sports-series-note").textContent = `Series note: ${text(selected.note) || "None recorded"}`;
      for (const row of logRows) {
        const current = row.dataset.seriesId === selected.id;
        row.toggleAttribute("data-selected", current);
        const link = row.querySelector("a[data-select-series]");
        if (link) {
          if (current) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        }
      }
      drawRoundLog();
      renderRound();
    }

    // Rebuild options as text so stale server/data combinations still work.
    select.replaceChildren(...series.map(item => {
      const option = element("option", `${text(item.date)} / session ${integer(item.session)} · ${text(item.order)}`);
      option.value = item.id;
      return option;
    }));
    byId("sports-series-controls").disabled = false;
    byId("sports-round-controls").disabled = false;
    select.addEventListener("change", () => {
      selected = lookup.get(select.value) || fallback;
      selectedRound = selected.roundCount;
      renderSeries();
      writeLocation();
    });
    function moveRound(value) {
      selectedRound = Math.min(selected.roundCount, Math.max(0, integer(value)));
      renderRound();
      writeLocation();
    }
    range.addEventListener("input", () => moveRound(Number(range.value)));
    previous.addEventListener("click", () => moveRound(selectedRound - 1));
    next.addEventListener("click", () => moveRound(selectedRound + 1));
    for (const link of page.querySelectorAll("a[data-select-series]")) {
      link.addEventListener("click", event => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        const target = lookup.get(link.dataset.selectSeries);
        if (!target) return;
        event.preventDefault();
        selected = target;
        selectedRound = target.roundCount;
        renderSeries();
        writeLocation(true);
        focusWalkthrough();
      });
    }

    const winnerFilter = byId("sports-log-winner");
    const search = byId("sports-log-search");
    const reset = byId("sports-log-reset");
    const logStatus = byId("sports-log-status");
    if (winnerFilter && search && reset && logStatus && byId("sports-log-controls")) {
      byId("sports-log-controls").disabled = false;
      function filterLog() {
        const term = search.value.trim().toLocaleLowerCase();
        let visible = 0;
        for (const row of logRows) {
          const item = lookup.get(row.dataset.seriesId);
          const haystack = item ? `${text(item.date)} ${text(item.sourceDate)} ${text(item.id)} ${text(item.order)}`.toLocaleLowerCase() : "";
          const match = !!item && (!winnerFilter.value || item.winner === winnerFilter.value) && haystack.includes(term);
          row.hidden = !match;
          if (match) visible += 1;
        }
        logStatus.textContent = `Showing ${visible} of ${logRows.length} series · log only. Global overview unchanged.${visible ? "" : " No matching series."}`;
      }
      winnerFilter.addEventListener("change", filterLog);
      search.addEventListener("input", filterLog);
      reset.addEventListener("click", () => {
        winnerFilter.value = "";
        search.value = "";
        filterLog();
      });
    }

    const pickerFilter = byId("sports-picker-filter");
    const matrix = byId("sports-transition-matrix");
    const choiceTable = byId("sports-choice-table");
    if (pickerFilter && matrix && choiceTable && Array.isArray(data.transitions) && byId("sports-picker-controls")) {
      const events = rows(data.transitions);
      byId("sports-picker-controls").disabled = false;
      function filterPicker() {
        const who = pickerFilter.value;
        const chosen = who === "L" || who === "O" ? who : "";
        const counts = challengeOrder.map(() => challengeOrder.map(() => 0));
        for (const transition of events) {
          if (chosen && transition.inferredPicker !== chosen) continue;
          const row = challengeOrder.indexOf(transition.previousChallenge);
          const column = challengeOrder.indexOf(transition.nextChallenge);
          if (row >= 0 && column >= 0) counts[row][column] += 1;
        }
        const maximum = Math.max(1, ...counts.flat());
        const total = counts.flat().reduce((sum, count) => sum + count, 0);
        const body = document.createDocumentFragment();
        counts.forEach((values, index) => {
          const row = element("tr");
          const heading = element("th", label(challengeOrder[index]));
          heading.scope = "row";
          row.append(heading);
          for (const count of values) {
            const cell = element("td", count);
            cell.style.backgroundColor = `rgb(247 171 101 / ${(0.06 + 0.40 * count / maximum).toFixed(3)})`;
            row.append(cell);
          }
          body.append(row);
        });
        if (matrix.tBodies[0]) matrix.tBodies[0].replaceChildren(body);
        if (matrix.caption) matrix.caption.textContent = `${chosen ? `${name(chosen)} / inferred picker` : "All inferred pickers"} · ${total} within-series transitions. Rows = previous challenge; columns = next challenge. Cells are counts, not rates.`;
        // Keep each player's conditioning in the All view; never average rates.
        const choices = rows(data.conditionalNextChallenge).filter(row => !chosen || row.player === chosen);
        const choiceBody = document.createDocumentFragment();
        for (const choice of choices) {
          const row = element("tr");
          row.dataset.picker = player(choice.player);
          const heading = element("th", `${name(choice.player)} / ${label(choice.nextChallenge)}`);
          heading.scope = "row";
          row.append(heading,
            element("td", `${integer(choice.countPicks)}/${integer(choice.pickerTotal)} · ${percent(choice.countPicks, choice.pickerTotal)}`),
            element("td", `${integer(choice.countWins)}/${integer(choice.countPicks)} · ${percent(choice.countWins, choice.countPicks)}`),
            element("td", integer(choice.countLosses)));
          choiceBody.append(row);
        }
        if (!choices.length) {
          const row = element("tr");
          const cell = element("td", "No inferred choices supplied.");
          cell.colSpan = 4;
          row.append(cell);
          choiceBody.append(row);
        }
        if (choiceTable.tBodies[0]) choiceTable.tBodies[0].replaceChildren(choiceBody);
        const pickerStatus = byId("sports-picker-status");
        if (pickerStatus) pickerStatus.textContent = `Matrix and choice table: ${chosen ? name(chosen) : "all inferred pickers"}. ${total} transitions. Hold cards above always show the full log.`;
      }
      pickerFilter.addEventListener("change", filterPicker);
    }

    readLocation();
    renderSeries();
    writeLocation();
    if (window.location.hash === "#play-by-play") focusWalkthrough();
    window.addEventListener("popstate", () => {
      readLocation();
      renderSeries();
      writeLocation();
      if (window.location.hash === "#play-by-play") focusWalkthrough();
    });
    if (status) status.textContent = "Interactive source log ready. Global metrics always describe the entire supplied log; filtering changes only the labelled view.";
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();