/* Schema 1 readers. Local data only; all source strings are rendered as text. */
(() => {
  "use strict";

  const PAGE_SIZE = 40;
  const $ = (id) => document.getElementById(id);
  const list = (value) => Array.isArray(value) ? value : [];
  const text = (value) => String(value ?? "");
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const count = (value) => number(value).toLocaleString("en-US");
  const ratio = (value) => value == null || !Number.isFinite(Number(value)) ? "Not available" : Number(value).toFixed(3);
  const fold = (value) => text(value).normalize("NFC").toLocaleLowerCase("en");
  const color = (value) => /^#[\da-f]{6}$/i.test(text(value)) ? value : "#64748b";
  const compareWords = (a, b) => text(a).localeCompare(text(b), "en", { sensitivity: "variant" });

  function el(tag, content, className) {
    const node = document.createElement(tag);
    if (content != null) node.textContent = text(content);
    if (className) node.className = className;
    return node;
  }

  function safeURL(value) {
    if (typeof value !== "string" || /[\u0000-\u0020]/.test(value)) return null;
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url : null;
    } catch { return null; }
  }

  function sourceLink(value, label) {
    const url = safeURL(value);
    if (!url) return el("span", `${label} (source link unavailable)`, "source-unavailable");
    const link = el("a", label);
    link.href = url.href;
    link.rel = "noopener noreferrer";
    return link;
  }

  function lineURL(song, line) {
    const url = safeURL(song.sourceUrl);
    if (!url) return null;
    url.hash = `${url.hostname === "bitbucket.org" ? "lines-" : "L"}${line.number}`;
    return url.href;
  }

  function pageValue(value) {
    return /^\d{1,8}$/.test(text(value)) ? Math.max(1, Number(value)) : 1;
  }

  function queryValue(params, name, allowed, fallback = "") {
    const value = params.get(name) || "";
    return allowed.includes(value) ? value : fallback;
  }

  function writeURL(values, keys, replace = false, hash = "") {
    const url = new URL(location.href);
    keys.forEach((key) => url.searchParams.delete(key));
    Object.entries(values).forEach(([key, value]) => {
      if (value !== "" && value != null && value !== false) url.searchParams.set(key, text(value));
    });
    url.hash = hash;
    if (url.href === location.href) return;
    try { history[replace ? "replaceState" : "pushState"](null, "", url.href); }
    catch { /* Readers still work in restricted/file contexts without history. */ }
  }

  function paging(prefix, total, page) {
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(Math.max(1, page), pages);
    const start = (page - 1) * PAGE_SIZE;
    $(`${prefix}-status`).textContent = total
      ? `${count(start + 1)}–${count(Math.min(start + PAGE_SIZE, total))} of ${count(total)} ${prefix === "vocab" ? "word forms" : "lines"} · Page ${count(page)} of ${count(pages)}`
      : `0 ${prefix === "vocab" ? "word forms" : "lines"} match the filters.`;
    $(`${prefix}-previous`).disabled = page === 1;
    $(`${prefix}-next`).disabled = page === pages;
    return { page, start };
  }

  function barChart(container, rows, palette = new Map()) {
    const maximum = Math.max(0, ...rows.map((row) => number(row.count)));
    const fragment = document.createDocumentFragment();
    rows.forEach((row) => {
      const bar = el("div", null, "bar-row");
      const track = el("span", null, "bar-track");
      track.setAttribute("aria-hidden", "true");
      const fill = el("span", null, "bar-fill");
      fill.style.display = "block";
      fill.style.width = `${maximum ? 100 * number(row.count) / maximum : 0}%`;
      if (palette.has(row.word)) fill.style.backgroundColor = palette.get(row.word);
      track.append(fill);
      bar.append(el("span", row.word, "bar-label"), track, el("span", count(row.count), "bar-count"));
      fragment.append(bar);
    });
    if (!rows.length) fragment.append(el("p", "No word forms match these filters.", "empty-state"));
    container.replaceChildren(fragment);
  }

  function availableMusic(prefix) {
    const data = window.MUSIC_ANALYSIS;
    if (data?.schemaVersion !== 1 || !Array.isArray(data.songs) || !Array.isArray(data.frequencies) || !Array.isArray(data.emotions) || !data.summary) {
      $(`${prefix}-data-status`).textContent = "Interactive data is unavailable or incompatible. The static preview and download links remain available.";
      if (prefix === "feelings") {
        $("feelings-wheel").querySelectorAll('[role="button"]').forEach((button) => {
          button.setAttribute("aria-disabled", "true");
          button.setAttribute("tabindex", "-1");
        });
      }
      return null;
    }
    $(`${prefix}-controls`).disabled = false;
    $(`${prefix}-data-status`).textContent = "Local analysis loaded. Filters stay in this browser; no network requests.";
    return data;
  }

  function songSource(container, song) {
    if (!song) {
      container.textContent = "Exact normalized copies count once; differing versions remain separate.";
      return;
    }
    container.replaceChildren(sourceLink(song.sourceUrl, `${song.title} · ${song.collection}`));
    const aliases = list(song.aliases);
    container.append(document.createTextNode(` · ${count(aliases.length)} normalized duplicate aliases excluded from counts.`));
    if (aliases.length) {
      const details = el("details");
      details.append(el("summary", "View alternate source paths"));
      const paths = el("ul");
      aliases.forEach((alias) => {
        const item = el("li");
        item.append(sourceLink(alias.sourceUrl, alias.path));
        paths.append(item);
      });
      details.append(paths);
      container.append(details);
    }
  }

  function initVocabulary() {
    const data = availableMusic("vocab");
    if (!data) return;
    const songs = new Map(data.songs.map((song) => [text(song.id), song]));
    const controls = { song: $("vocab-song"), q: $("vocab-search"), stop: $("vocab-stopwords") };
    const keys = ["song", "q", "stop", "sort", "dir", "page"];
    let state;

    function readState() {
      const params = new URLSearchParams(location.search);
      return {
        song: queryValue(params, "song", [...songs.keys()]),
        q: (params.get("q") || "").slice(0, 200), stop: params.get("stop") === "1",
        sort: queryValue(params, "sort", ["word", "count", "songCount"], "count"),
        dir: queryValue(params, "dir", ["asc", "desc"], "desc"), page: pageValue(params.get("page"))
      };
    }

    function save(replace = false) {
      writeURL({ ...state, stop: state.stop ? "1" : "", page: state.page > 1 ? state.page : "" }, keys, replace);
    }

    function render() {
      controls.song.value = state.song;
      controls.q.value = state.q;
      controls.stop.checked = state.stop;
      const song = songs.get(state.song);
      const scope = song || data.summary;
      $("vocab-scope").textContent = song ? `${song.title} · ${song.collection}` : "Corpus · all song versions";
      [["tokens", "tokenCount"], ["types", "vocabularySize"], ["hapax", "hapaxCount"]].forEach(([id, key]) => {
        $(`vocab-${id}`).textContent = count(scope[key]);
      });
      $("vocab-ttr").textContent = ratio(scope.ttr);
      $("vocab-mattr").textContent = ratio(scope.mattr);
      $("vocab-window-note").textContent = `${count(scope.mattrWindowCount)} within-song MATTR windows. ${scope.mattr == null ? "MATTR needs at least 50 tokens in a song; no shorter substitute is used." : "Corpus windows are weighted by window count, not averaged by song."}`;
      songSource($("vocab-source"), song);
      const query = fold(state.q.trim());
      const rows = list(song ? song.frequencies : data.frequencies).filter((row) => (!state.stop || !row.isStopword) && fold(row.word).includes(query));
      const ranked = [...rows].sort((a, b) => number(b.count) - number(a.count) || compareWords(a.word, b.word));
      barChart($("vocab-chart"), ranked.slice(0, 20));
      const sign = state.dir === "asc" ? 1 : -1;
      rows.sort((a, b) => state.sort === "word"
        ? sign * compareWords(a.word, b.word)
        : sign * (number(a[state.sort]) - number(b[state.sort])) || compareWords(a.word, b.word));
      const { page, start } = paging("vocab", rows.length, state.page);
      state.page = page;
      const fragment = document.createDocumentFragment();
      rows.slice(start, start + PAGE_SIZE).forEach((row, index) => {
        const tr = el("tr");
        const word = el("th", row.word);
        word.scope = "row";
        tr.append(el("td", count(start + index + 1)), word, el("td", count(row.count)), el("td", count(row.songCount)), el("td", row.isStopword ? "Yes" : "No"));
        fragment.append(tr);
      });
      if (!rows.length) {
        const row = el("tr");
        const cell = el("td", "No matching forms. Clear the search or include stopwords.", "empty-state");
        cell.colSpan = 5;
        row.append(cell);
        fragment.append(row);
      }
      $("vocab-rows").replaceChildren(fragment);
      document.querySelectorAll("[data-sort-header]").forEach((header) => {
        header.setAttribute("aria-sort", header.dataset.sortHeader === state.sort ? (state.dir === "asc" ? "ascending" : "descending") : "none");
      });
    }

    function change(replace = false) {
      state.song = controls.song.value;
      state.q = controls.q.value;
      state.stop = controls.stop.checked;
      state.page = 1;
      render();
      save(replace);
    }

    controls.song.addEventListener("change", () => change());
    controls.stop.addEventListener("change", () => change());
    controls.q.addEventListener("input", () => change(true));
    document.querySelectorAll("[data-vocab-sort]").forEach((button) => {
      button.disabled = false;
      button.addEventListener("click", () => {
        const sort = button.dataset.vocabSort;
        state.dir = sort === state.sort ? (state.dir === "asc" ? "desc" : "asc") : (sort === "word" ? "asc" : "desc");
        state.sort = sort;
        state.page = 1;
        render(); save();
      });
    });
    ["previous", "next"].forEach((direction) => $(`vocab-${direction}`).addEventListener("click", () => {
      state.page += direction === "next" ? 1 : -1;
      render(); save();
    }));
    $("vocab-reset").addEventListener("click", () => {
      state = { song: "", q: "", stop: false, sort: "count", dir: "desc", page: 1 };
      render(); save();
    });
    window.addEventListener("popstate", () => { state = readState(); render(); });
    state = readState(); render();
  }

  function polarity(line) {
    const value = line.polarity?.compound;
    if (value == null || !Number.isFinite(Number(value))) return "unavailable";
    return value >= 0.05 ? "positive" : value <= -0.05 ? "negative" : "neutral";
  }

  function lineID(song, line) { return `line-${song.id}-${line.number}`; }

  function lineCard(song, line, palette) {
    const article = el("article", null, "line-card");
    article.id = lineID(song, line);
    article.tabIndex = -1;
    article.dataset.lineNumber = text(line.number);
    article.style.setProperty("--emotion-color", palette.get(line.emotion) || "#64748b");
    article.append(el("h3", `${song.title} · Line ${line.number}`));
    const meta = el("p", `${song.collection} · `, "line-meta");
    const permalink = el("a", "Link to this line", "line-permalink");
    permalink.href = `#${encodeURIComponent(article.id)}`;
    meta.append(sourceLink(lineURL(song, line), `Source line ${line.number}`), document.createTextNode(" · "), permalink);
    const lyric = el("p", line.text, "lyric-text");
    lyric.dir = "auto";
    const label = el("p");
    const compound = line.polarity?.compound;
    const formatted = compound == null ? "not available" : `${number(compound) >= 0 ? "+" : ""}${number(compound).toFixed(3)}`;
    label.append(el("strong", "Heuristic primary: "), document.createTextNode(`${line.emotion}${line.subemotion ? ` / ${line.subemotion}` : ""} · VADER polarity: ${polarity(line)} · compound ${formatted}`));
    let ambiguity = line.ambiguous ? "Multiple active families or tied primary branches; the primary label is a heuristic." : "No competing active label recorded; this is not certainty.";
    if (list(line.tiedEmotions).length) ambiguity += ` Top-family tie: ${line.tiedEmotions.join(", ")}.`;
    const details = el("details", null, "line-evidence");
    const evidence = list(line.evidence);
    details.append(el("summary", `Supporting evidence · ${count(evidence.length)} cue mappings`));
    const scores = list(line.emotionScores).map((score) => `${score.family}: ${score.score}`).join("; ");
    details.append(el("p", `Family occurrence scores (not probabilities): ${scores || "none"}.`));
    if (evidence.length) {
      const items = el("ul");
      evidence.forEach((cue) => {
        const explanation = cue.negated ? `negated by ${list(cue.negators).map((item) => item.word).join(", ") || "a preceding cue"}; excluded (0)` : "active cue (+1)";
        items.append(el("li", `${cue.family} / ${cue.label}: “${cue.text}” — ${explanation}`, `evidence-chip${cue.negated ? " is-negated" : ""}`));
      });
      details.append(items);
    } else details.append(el("p", "No lexicon cues matched. Unclassified does not mean neutral feelings."));
    article.append(meta, lyric, label, el("p", ambiguity, "method-note"), details);
    return article;
  }

  function initFeelings() {
    const data = availableMusic("feelings");
    if (!data) return;
    const songs = new Map(data.songs.map((song) => [text(song.id), song]));
    const families = new Map(data.emotions.map((family) => [family.name, family]));
    const palette = new Map(data.emotions.map((family) => [family.name, color(family.color)]));
    palette.set("Unclassified", "#64748b");
    const entries = data.songs.flatMap((song) => list(song.lines).map((line) => ({ song, line, search: fold(line.text) })));
    const byID = new Map(entries.map((entry) => [lineID(entry.song, entry.line), entry]));
    const controls = {
      song: $("feelings-song"), q: $("feelings-search"), emotion: $("feelings-family"),
      branch: $("feelings-branch"), polarity: $("feelings-polarity")
    };
    const keys = ["song", "q", "emotion", "branch", "polarity", "page"];
    const wheel = $("feelings-wheel");
    const sectors = [...wheel.querySelectorAll('[role="button"]')];
    const familyButtons = [...$("feelings-legend").querySelectorAll("button")];
    let timelineSong;
    let state;

    function readState() {
      const params = new URLSearchParams(location.search);
      const emotion = queryValue(params, "emotion", [...families.keys(), "Unclassified"]);
      return {
        song: queryValue(params, "song", [...songs.keys()]), emotion,
        branch: queryValue(params, "branch", list(families.get(emotion)?.branches).map((branch) => branch.label)),
        polarity: queryValue(params, "polarity", ["positive", "neutral", "negative"]),
        q: (params.get("q") || "").slice(0, 200), page: pageValue(params.get("page"))
      };
    }

    function save(replace = false, hash = "") {
      writeURL({ ...state, page: state.page > 1 ? state.page : "" }, keys, replace, hash);
    }

    function syncControls() {
      Object.entries(controls).forEach(([key, control]) => { if (key !== "branch") control.value = state[key]; });
      const branches = list(families.get(state.emotion)?.branches);
      const options = [new Option("All branches", ""), ...branches.map((branch) => new Option(branch.label, branch.label))];
      controls.branch.replaceChildren(...options);
      controls.branch.disabled = !branches.length;
      controls.branch.value = state.branch;
      [...sectors, ...familyButtons].forEach((button) => {
        const active = button.dataset.emotion === state.emotion && (button.dataset.branch || "") === state.branch;
        button.setAttribute("aria-pressed", text(active));
        button.classList.toggle("is-active", active);
      });
    }

    function matches(entry) {
      const line = entry.line;
      if (state.song && entry.song.id !== state.song) return false;
      if (state.q.trim() && !entry.search.includes(fold(state.q.trim()))) return false;
      if (state.polarity && polarity(line) !== state.polarity) return false;
      if (state.emotion === "Unclassified") return line.emotion === "Unclassified";
      if (!state.emotion) return true;
      return list(line.matches).some((match) => match.family === state.emotion && number(match.score) > 0 && (!state.branch || match.label === state.branch));
    }

    function focusLine(identifier) {
      const target = $(identifier);
      if (target) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "center", behavior: "auto" });
      }
    }

    function jump(entry, replace = false) {
      state = { song: entry.song.id, q: "", emotion: "", branch: "", polarity: "", page: 1 };
      const songLines = entries.filter((item) => item.song.id === entry.song.id);
      state.page = Math.floor(songLines.indexOf(entry) / PAGE_SIZE) + 1;
      render();
      $("feelings-navigation-note").textContent = `Opened source line ${entry.line.number}; other line filters cleared to make the target visible.`;
      const identifier = lineID(entry.song, entry.line);
      save(replace, identifier);
      focusLine(identifier);
    }

    function renderTimeline() {
      if (timelineSong === state.song) return;
      timelineSong = state.song;
      const song = songs.get(state.song);
      const timeline = $("feelings-timeline");
      $("feelings-timeline-label").textContent = "Use arrow keys, Home and End to move between timeline strips.";
      if (!song) {
        timeline.replaceChildren();
        $("feelings-track-source").textContent = "Choose one song version to see its physical-line timeline.";
        return;
      }
      songSource($("feelings-track-source"), song);
      const fragment = document.createDocumentFragment();
      list(song.lines).forEach((line, index) => {
        const button = el("button", line.number, "timeline-line");
        button.type = "button";
        button.tabIndex = index === 0 ? 0 : -1;
        button.dataset.target = lineID(song, line);
        button.style.setProperty("--emotion-color", palette.get(line.emotion) || "#64748b");
        button.style.borderBottom = `6px solid ${palette.get(line.emotion) || "#64748b"}`;
        const label = `Line ${line.number}: ${line.emotion}${line.subemotion ? ` / ${line.subemotion}` : ""}; ${polarity(line)} polarity. ${text(line.text).slice(0, 100)}`;
        button.title = label;
        button.setAttribute("aria-label", label);
        fragment.append(button);
      });
      if (!list(song.lines).length) fragment.append(el("p", "This version has no retained lyric lines.", "empty-state"));
      timeline.replaceChildren(fragment);
    }

    function render() {
      syncControls();
      $("feelings-navigation-note").textContent = "";
      const filtered = entries.filter(matches);
      const counts = new Map([...families.keys(), "Unclassified"].map((family) => [family, 0]));
      filtered.forEach(({ line }) => {
        if (line.emotion === "Unclassified") counts.set("Unclassified", counts.get("Unclassified") + 1);
        const active = new Set(list(line.emotionScores).filter((score) => number(score.score) > 0).map((score) => score.family));
        active.forEach((family) => { if (counts.has(family)) counts.set(family, counts.get(family) + 1); });
      });
      barChart($("feelings-chart"), [...counts].map(([word, value]) => ({ word, count: value })), palette);
      $("feelings-chart-note").textContent = `${count(filtered.length)} lines in the current selection${state.emotion ? ` · ${state.emotion}${state.branch ? ` / ${state.branch}` : ""}` : ""}. A line may support several families; Unclassified has no active family.`;
      const { page, start } = paging("feelings", filtered.length, state.page);
      state.page = page;
      const fragment = document.createDocumentFragment();
      filtered.slice(start, start + PAGE_SIZE).forEach(({ song, line }) => fragment.append(lineCard(song, line, palette)));
      if (!filtered.length) fragment.append(el("p", "No matching lines. Try another family, include all polarities, or reset the filters.", "empty-state"));
      $("feelings-results").replaceChildren(fragment);
      renderTimeline();
    }

    function restore() {
      state = readState();
      let identifier = "";
      try { identifier = decodeURIComponent(location.hash.slice(1)); } catch { /* Invalid escapes are not a target. */ }
      const entry = byID.get(identifier);
      render();
      if (entry) {
        const filtered = entries.filter(matches);
        const index = filtered.indexOf(entry);
        if (index >= 0) {
          state.page = Math.floor(index / PAGE_SIZE) + 1;
          render(); focusLine(identifier);
        } else jump(entry, true);
      } else if (location.hash.startsWith("#line-")) {
        $("feelings-navigation-note").textContent = "That line link is not in this analysis. Showing the current selection instead.";
      }
    }

    Object.entries(controls).forEach(([key, control]) => {
      control.addEventListener(key === "q" ? "input" : "change", () => {
        state[key] = control.value;
        if (key === "emotion") state.branch = "";
        state.page = 1;
        render(); save(key === "q");
      });
    });

    function selectFamily(button) {
      state.emotion = button.dataset.emotion || "";
      state.branch = button.dataset.branch || "";
      state.page = 1;
      render(); save();
    }

    familyButtons.forEach((button) => {
      button.disabled = false;
      button.addEventListener("click", () => selectFamily(button));
    });
    sectors.forEach((sector) => {
      sector.addEventListener("click", (event) => { event.preventDefault(); selectFamily(sector); });
      sector.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Enter") { event.preventDefault(); selectFamily(sector); }
      });
    });

    function roving(container, selector) {
      container.addEventListener("keydown", (event) => {
        const offset = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (offset == null && !["Home", "End"].includes(event.key)) return;
        const items = [...container.querySelectorAll(selector)];
        const index = items.indexOf(event.target);
        if (index < 0 || !items.length) return;
        event.preventDefault();
        const target = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + offset + items.length) % items.length;
        items.forEach((item, i) => { item.tabIndex = i === target ? 0 : -1; });
        items[target].focus();
      });
      container.addEventListener("focusin", (event) => {
        if (!event.target.matches(selector)) return;
        container.querySelectorAll(selector).forEach((item) => { item.tabIndex = item === event.target ? 0 : -1; });
      });
    }
    roving(wheel, '[role="button"]');
    roving($("feelings-timeline"), "button[data-target]");
    $("feelings-timeline").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-target]");
      const entry = button && byID.get(button.dataset.target);
      if (entry) jump(entry);
    });
    $("feelings-results").addEventListener("click", (event) => {
      const anchor = event.target.closest("a.line-permalink");
      if (!anchor || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const identifier = anchor.closest(".line-card").id;
      save(false, identifier); focusLine(identifier);
    });
    ["previous", "next"].forEach((direction) => $(`feelings-${direction}`).addEventListener("click", () => {
      state.page += direction === "next" ? 1 : -1;
      render(); save();
      const first = $("feelings-results").querySelector(".line-card");
      if (first) focusLine(first.id);
    }));
    ["focusin", "mouseover"].forEach((eventName) => $("feelings-timeline").addEventListener(eventName, (event) => {
      const button = event.target.closest("button[data-target]");
      if (button) $("feelings-timeline-label").textContent = button.getAttribute("aria-label");
    }));
    $("feelings-reset").addEventListener("click", () => {
      state = { song: "", q: "", emotion: "", branch: "", polarity: "", page: 1 };
      render(); save();
    });
    window.addEventListener("popstate", restore);
    window.addEventListener("hashchange", restore);
    restore();
  }

  function initCode() {
    const input = $("code-search");
    const modules = [...$("code-modules").querySelectorAll("[data-code-module]")].map((node) => ({ node, search: fold(node.dataset.search) }));
    const initialOpen = new Map(modules.flatMap(({ node }) => [...node.querySelectorAll("details")].map((details) => [details, details.open])));
    $("code-controls").disabled = false;
    function render() {
      const query = fold(input.value.trim());
      let visible = 0;
      modules.forEach(({ node, search }) => {
        node.hidden = !search.includes(query);
        node.style.display = node.hidden ? "none" : "";
        if (!node.hidden) visible += 1;
        node.querySelectorAll("details").forEach((details) => { details.open = query ? !node.hidden : initialOpen.get(details); });
      });
      $("code-status").textContent = `${count(visible)} of ${count(modules.length)} modules${query ? ` matching “${input.value.trim()}”` : ""}. Counts above always describe the full source index, not problems solved.`;
      $("code-empty").hidden = visible !== 0;
      $("code-empty").style.display = visible ? "none" : "";
    }
    function restore() { input.value = (new URLSearchParams(location.search).get("q") || "").slice(0, 200); render(); }
    input.addEventListener("input", () => { render(); writeURL({ q: input.value }, ["q"], true); });
    $("code-reset").addEventListener("click", () => { input.value = ""; render(); writeURL({}, ["q"]); input.focus(); });
    window.addEventListener("popstate", restore);
    restore();
  }

  function init() {
    if ($("vocabulary-app")) initVocabulary();
    if ($("feelings-app")) initFeelings();
    if ($("code-app")) initCode();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();