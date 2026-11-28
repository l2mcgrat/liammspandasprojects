/* The two apps that keep their data in the vault: the personal time tracker and the
   connections web. Both read and write encrypted records through window.LiamVault.records
   (see vault.js), so an entry made on the phone appears on the laptop and the other way round. */
(() => {
  "use strict";
  const V = window.LiamVault;
  if (!V) return;
  const { el, records } = V;
  const SVG = "http://www.w3.org/2000/svg";
  const svg = (tag, attrs = {}, ...children) => {
    const node = document.createElementNS(SVG, tag);
    Object.entries(attrs).forEach(([name, value]) => {
      if (value == null || value === false) return;
      if (name === "text") node.textContent = value;
      else if (name.startsWith("on")) node.addEventListener(name.slice(2), value);
      else node.setAttribute(name, value);
    });
    children.flat().forEach((child) => { if (child) node.append(child); });
    return node;
  };
  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
  const mondayOf = (iso) => { const d = parseDate(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoDate(d); };
  const addDays = (iso, n) => { const d = parseDate(iso); d.setDate(d.getDate() + n); return isoDate(d); };
  const hours = (minutes) => `${(minutes / 60).toFixed(1)} h`;
  const dayLabel = (iso) => parseDate(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const options = (select, values, chosen) => {
    select.textContent = "";
    values.forEach((value) => select.append(el("option", { value, selected: value === chosen, text: value })));
  };
  const field = (label, control, wide) => el("label", { class: wide ? "vt-wide" : null }, label, control);

  const statusBar = () => {
    const text = el("span");
    const error = el("span", { class: "vt-msg is-error" });
    const button = el("button", { class: "vt-chipbtn", type: "button", text: "Sync now", onclick: async () => {
      button.disabled = true;
      await records.refresh();
      button.disabled = false;
    } });
    const draw = () => {
      const s = records.status();
      text.textContent = "";
      text.append(el("strong", { text: `${s.total}` }), ` change${s.total === 1 ? "" : "s"} on this device · `,
        el("strong", { text: `${s.pending}` }), " waiting to be stored in the repository · ",
        s.lastSync ? `checked ${pad(s.lastSync.getHours())}:${pad(s.lastSync.getMinutes())}` : "not checked yet");
      error.textContent = s.lastError;
    };
    records.onChange(draw);
    draw();
    return el("div", { class: "vt-status" }, text, button, error);
  };

  // ---- Time tracker ----------------------------------------------------------------------
  const BUCKETS = {
    "Work": ["Day job", "Overtime", "Side income"],
    "Maintenance": ["Commute & driving", "Errands", "Cooking", "Eating", "Cleaning & chores", "Hygiene", "Meditation", "Life admin (REABS)", "Appointments", "Sleep"],
    "Leisure & goals": ["Rap", "Video games", "Web dev", "STEM study", "Business & econ study", "Linguistics study", "AI research", "Whiteboard",
      "Swim", "Run", "Lift", "Basketball", "Soccer", "YouTube", "Anime", "Manga", "Light novel", "Book", "Socializing", "Other"],
  };
  const BUCKET_CLASS = { "Work": "b-work", "Maintenance": "b-maintenance", "Leisure & goals": "b-leisure" };
  const ALONGSIDE = ["Nothing else", "Music", "YouTube", "Podcast or audiobook", "Voice note", "Silence on purpose"];
  const WITH = ["Solo", "Friends", "Family", "Coworkers"];
  const TIMER = "liam_vault_timer_v1";

  const mountTracker = (mount) => {
    let week = mondayOf(isoDate(new Date()));
    let editing = null;
    const date = el("input", { type: "date", required: true, value: isoDate(new Date()) });
    const start = el("input", { type: "time" });
    const hrs = el("input", { type: "number", min: "0", max: "24", step: "1", value: "0", inputmode: "numeric" });
    const mins = el("input", { type: "number", min: "0", max: "59", step: "5", value: "30", inputmode: "numeric" });
    const bucket = el("select");
    const activity = el("select");
    const detail = el("input", { type: "text", maxlength: "80", placeholder: "Game, book, project…" });
    const alongside = el("select");
    const withWhom = el("select");
    const note = el("textarea", { maxlength: "1500", placeholder: "What happened, what to pick up next time" });
    const message = el("span", { class: "vt-msg" });
    const submit = el("button", { class: "button primary", type: "submit", text: "Save entry" });
    const cancel = el("button", { class: "button ghost", type: "button", text: "Cancel edit", hidden: true });
    options(bucket, Object.keys(BUCKETS), "Leisure & goals");
    options(activity, BUCKETS["Leisure & goals"], "Book");
    options(alongside, ALONGSIDE, ALONGSIDE[0]);
    options(withWhom, WITH, WITH[0]);
    bucket.addEventListener("change", () => options(activity, BUCKETS[bucket.value], BUCKETS[bucket.value][0]));

    const reset = () => {
      editing = null;
      submit.textContent = "Save entry";
      cancel.hidden = true;
      note.value = "";
      detail.value = "";
      start.value = "";
    };
    cancel.addEventListener("click", reset);
    const form = el("form", { class: "vt-form", onsubmit: async (event) => {
      event.preventDefault();
      const minutes = Math.round(Number(hrs.value || 0) * 60 + Number(mins.value || 0));
      if (!date.value || !(minutes > 0) || minutes > 24 * 60) {
        message.className = "vt-msg is-error";
        message.textContent = "Give a date and a duration between 1 minute and 24 hours.";
        return;
      }
      try {
        await records.put("time.entry", editing || records.newKey(), {
          date: date.value, start: start.value, minutes, bucket: bucket.value, activity: activity.value, detail: detail.value.trim(),
          alongside: alongside.value, withWhom: withWhom.value, note: note.value.trim(),
        });
        message.className = "vt-msg";
        message.textContent = `${editing ? "Updated" : "Saved"}: ${hours(minutes)} of ${activity.value} on ${dayLabel(date.value)}.`;
        week = mondayOf(date.value);
        reset();
      } catch (problem) {
        message.className = "vt-msg is-error";
        message.textContent = problem.message;
      }
    } },
    field("Date", date), field("Started at (optional)", start), field("Hours", hrs), field("Minutes", mins),
    field("Bucket", bucket), field("Activity", activity), field("Detail (optional)", detail),
    field("Alongside", alongside), field("With", withWhom), field("Note (optional)", note, true),
    el("div", { class: "vt-actions vt-wide" }, submit, cancel, message));

    // A timer that only fills in the form: nothing is stored until the entry is saved.
    const timerText = el("span", { class: "vt-empty" });
    const timerButton = el("button", { class: "vt-chipbtn", type: "button" });
    const readTimer = () => { try { return JSON.parse(localStorage.getItem(TIMER) || "null"); } catch { return null; } };
    const drawTimer = () => {
      const running = readTimer();
      timerButton.textContent = running ? "Stop and fill in the form" : "Start a timer";
      timerButton.classList.toggle("is-on", Boolean(running));
      if (!running) { timerText.textContent = "Or time it: start now, stop when you finish."; return; }
      const elapsed = Math.max(0, Math.floor((Date.now() - running.start) / 1000));
      const began = new Date(running.start);
      timerText.textContent = `Running since ${pad(began.getHours())}:${pad(began.getMinutes())} · ${pad(Math.floor(elapsed / 3600))}:${pad(Math.floor(elapsed / 60) % 60)}:${pad(elapsed % 60)}`;
    };
    timerButton.addEventListener("click", () => {
      const running = readTimer();
      if (!running) {
        localStorage.setItem(TIMER, JSON.stringify({ start: Date.now() }));
      } else {
        const began = new Date(running.start);
        const minutes = Math.max(1, Math.round((Date.now() - running.start) / 60000));
        date.value = isoDate(began);
        start.value = `${pad(began.getHours())}:${pad(began.getMinutes())}`;
        hrs.value = String(Math.floor(minutes / 60));
        mins.value = String(minutes % 60);
        localStorage.removeItem(TIMER);
        note.focus();
      }
      drawTimer();
    });
    setInterval(drawTimer, 1000);
    drawTimer();

    const weekLabel = el("strong");
    const summary = el("div", { class: "vt-table-wrap" });
    const entries = el("div", { class: "vt-table-wrap" });
    const edit = (entry) => {
      editing = entry.key;
      date.value = entry.date;
      start.value = entry.start || "";
      hrs.value = String(Math.floor(entry.minutes / 60));
      mins.value = String(entry.minutes % 60);
      options(bucket, Object.keys(BUCKETS), entry.bucket);
      options(activity, [...new Set([...(BUCKETS[entry.bucket] || []), entry.activity])], entry.activity);
      detail.value = entry.detail || "";
      options(alongside, ALONGSIDE, entry.alongside || ALONGSIDE[0]);
      options(withWhom, WITH, entry.withWhom || WITH[0]);
      note.value = entry.note || "";
      submit.textContent = "Update entry";
      cancel.hidden = false;
      form.scrollIntoView({ block: "center" });
    };
    const draw = () => {
      const all = records.list("time.entry").filter((e) => e.date && e.minutes > 0);
      const last = addDays(week, 6);
      const inWeek = all.filter((e) => e.date >= week && e.date <= last).sort((a, b) => (a.date + (a.start || "")) < (b.date + (b.start || "")) ? 1 : -1);
      weekLabel.textContent = `${dayLabel(week)} to ${dayLabel(last)}`;
      const total = inWeek.reduce((sum, e) => sum + e.minutes, 0);
      const groups = new Map();
      inWeek.forEach((e) => {
        const key = `${e.bucket}\u0000${e.activity}`;
        const row = groups.get(key) || { bucket: e.bucket, activity: e.activity, minutes: 0, shared: 0, count: 0 };
        row.minutes += e.minutes;
        row.count += 1;
        if (e.alongside && e.alongside !== ALONGSIDE[0]) row.shared += e.minutes;
        groups.set(key, row);
      });
      summary.textContent = "";
      if (!inWeek.length) {
        summary.append(el("p", { class: "vt-empty", text: all.length ? "Nothing logged in this week." : "No entries yet. Log the first one above." }));
      } else {
        const widest = Math.max(...[...groups.values()].map((r) => r.minutes));
        const body = el("tbody");
        Object.keys(BUCKETS).forEach((name) => {
          const rows = [...groups.values()].filter((r) => r.bucket === name).sort((a, b) => b.minutes - a.minutes);
          if (!rows.length) return;
          const bucketTotal = rows.reduce((sum, r) => sum + r.minutes, 0);
          body.append(el("tr", {}, el("th", { scope: "row", colspan: "2", text: name }), el("td", { class: "vt-num", text: hours(bucketTotal) }),
            el("td", { class: "vt-num", text: `${Math.round(bucketTotal / (168 * 60) * 100)}% of the week` }), el("td")));
          rows.forEach((r) => body.append(el("tr", {},
            el("td", { text: r.activity }),
            el("td", {}, el("span", { class: `vt-bar ${BUCKET_CLASS[name] || ""}`, style: `width:${Math.max(2, r.minutes / widest * 100)}%` })),
            el("td", { class: "vt-num", text: hours(r.minutes) }),
            el("td", { class: "vt-num", text: `${r.count} entr${r.count === 1 ? "y" : "ies"}` }),
            el("td", { class: "vt-num", text: r.shared ? `${hours(r.shared)} with audio` : "" }))));
        });
        summary.append(el("table", { class: "vt-table" },
          el("caption", { text: `Logged this week: ${hours(total)} of 168 h.` }),
          el("thead", {}, el("tr", {}, el("th", { text: "Activity" }), el("th", { text: "Share" }), el("th", { class: "vt-num", text: "Time" }),
            el("th", { class: "vt-num", text: "Entries" }), el("th", { class: "vt-num", text: "Doubled up" }))), body));
      }
      entries.textContent = "";
      if (inWeek.length) {
        const body = el("tbody");
        inWeek.forEach((e) => body.append(el("tr", {},
          el("td", { text: `${dayLabel(e.date)}${e.start ? ` · ${e.start}` : ""}` }),
          el("td", { class: "vt-num", text: hours(e.minutes) }),
          el("td", { text: `${e.activity}${e.detail ? ` · ${e.detail}` : ""}` }),
          el("td", { text: [e.withWhom && e.withWhom !== "Solo" ? `With ${e.withWhom.toLowerCase()}` : "", e.alongside && e.alongside !== ALONGSIDE[0] ? e.alongside : ""].filter(Boolean).join(" · ") }),
          el("td", { text: e.note || "" }),
          el("td", {}, el("button", { type: "button", text: "Edit", onclick: () => edit(e) }),
            el("button", { type: "button", text: "Delete", onclick: async () => { if (window.confirm("Delete this entry?")) await records.remove("time.entry", e.key); } })))));
        entries.append(el("table", { class: "vt-table" },
          el("thead", {}, el("tr", {}, el("th", { text: "When" }), el("th", { class: "vt-num", text: "Time" }), el("th", { text: "What" }),
            el("th", { text: "With / alongside" }), el("th", { text: "Note" }), el("th", { text: "" }))), body));
      }
    };
    records.onChange(draw);
    mount.append(el("div", { class: "vt-app" },
      statusBar(),
      el("section", { class: "vt-card" }, el("h3", { text: "Log time" }), form, el("div", { class: "vt-actions", style: "margin-top:12px" }, timerButton, timerText)),
      el("section", { class: "vt-card" }, el("h3", { text: "The week" }),
        el("div", { class: "vt-week" },
          el("button", { type: "button", text: "← Earlier", onclick: () => { week = addDays(week, -7); draw(); } }), weekLabel,
          el("button", { type: "button", text: "Later →", onclick: () => { week = addDays(week, 7); draw(); } }),
          el("button", { type: "button", text: "This week", onclick: () => { week = mondayOf(isoDate(new Date())); draw(); } })),
        summary),
      el("section", { class: "vt-card" }, el("h3", { text: "Entries" }), entries)));
    draw();
  };

  // ---- Connections web -------------------------------------------------------------------
  const GROUPS = ["Collingwood friends & family", "University friends", "Work", "LinkedIn"];
  const COLOURS = ["#f7ab65", "#69d4cf", "#bba1ff", "#5ec2f7", "#8fe0a8", "#ff8f8f", "#ffd166"];
  const linkKey = (a, b) => [a, b].sort().join("~");

  const mountConnections = (mount) => {
    let selected = null;
    const graph = el("div");
    const detail = el("section", { class: "vt-card" });
    const tableWrap = el("div", { class: "vt-table-wrap" });
    const linksWrap = el("div", { class: "vt-table-wrap" });
    const name = el("input", { type: "text", maxlength: "60", required: true, placeholder: "Name" });
    const group = el("select");
    const newGroup = el("input", { type: "text", maxlength: "40", placeholder: "Or a new group" });
    const strength = el("input", { type: "range", min: "1", max: "10", step: "1", value: "5" });
    const strengthText = el("span", { text: "5 / 10" });
    strength.addEventListener("input", () => { strengthText.textContent = `${strength.value} / 10`; });
    const addMessage = el("span", { class: "vt-msg" });
    const linkA = el("select");
    const linkB = el("select");
    const linkWeight = el("input", { type: "range", min: "1", max: "10", step: "1", value: "5" });

    const people = () => records.list("web.person").filter((p) => p.name).sort((a, b) => a.name.localeCompare(b.name));
    const notesFor = (key) => records.list("web.note").filter((n) => n.person === key).sort((a, b) => (a.date + a.at < b.date + b.at ? -1 : 1));
    const groupsNow = () => [...new Set([...GROUPS, ...people().map((p) => p.group)])];

    const addForm = el("form", { class: "vt-form", onsubmit: async (event) => {
      event.preventDefault();
      const chosen = newGroup.value.trim() || group.value;
      if (!name.value.trim()) return;
      const key = records.newKey();
      await records.put("web.person", key, { name: name.value.trim(), group: chosen, strength: Number(strength.value) });
      await records.put("web.note", records.newKey(), { person: key, date: isoDate(new Date()), strength: Number(strength.value), change: 0, text: "Added to the web." });
      addMessage.textContent = `Added ${name.value.trim()} to ${chosen}.`;
      name.value = "";
      newGroup.value = "";
      selected = key;
      draw();
    } },
    field("Name", name), field("Group", group), field("New group (optional)", newGroup),
    field("Strength now", el("span", {}, strength, strengthText)),
    el("div", { class: "vt-actions vt-wide" }, el("button", { class: "button primary", type: "submit", text: "Add person" }), addMessage));

    const linkForm = el("form", { class: "vt-form", onsubmit: async (event) => {
      event.preventDefault();
      if (!linkA.value || !linkB.value || linkA.value === linkB.value) return;
      await records.put("web.link", linkKey(linkA.value, linkB.value), { a: linkA.value, b: linkB.value, weight: Number(linkWeight.value) });
    } },
    field("Person", linkA), field("Knows", linkB), field("How strongly (1 to 10)", linkWeight),
    el("div", { class: "vt-actions vt-wide" }, el("button", { class: "button ghost", type: "submit", text: "Save link" })));

    const drawGraph = (list, links) => {
      const width = 900, height = 620, cx = 450, cy = 310;
      const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, class: "vt-graph", role: "img", "aria-label": "Web of connections: me in the centre, a hub for each group, and each person sized by strength." });
      const groups = groupsNow();
      const spot = new Map();
      const edges = svg("g");
      const nodes = svg("g");
      groups.forEach((groupName, index) => {
        const angle = -Math.PI / 2 + index * 2 * Math.PI / groups.length;
        const gx = cx + 150 * Math.cos(angle), gy = cy + 135 * Math.sin(angle);
        const colour = COLOURS[index % COLOURS.length];
        const members = list.filter((p) => p.group === groupName);
        edges.append(svg("line", { x1: cx, y1: cy, x2: gx, y2: gy, stroke: colour, "stroke-width": 1.5, opacity: members.length ? 0.6 : 0.2 }));
        const span = Math.min(2 * Math.PI / groups.length * 0.86, 0.26 * Math.max(1, members.length - 1));
        members.forEach((person, i) => {
          const offset = members.length === 1 ? 0 : -span / 2 + span * i / (members.length - 1);
          const ring = i % 2 ? 1.0 : 0.86;
          const px = cx + 300 * ring * Math.cos(angle + offset), py = cy + 262 * ring * Math.sin(angle + offset);
          spot.set(person.key, [px, py]);
          const s = Math.max(1, Math.min(10, Number(person.strength) || 1));
          edges.append(svg("line", { x1: gx, y1: gy, x2: px, y2: py, stroke: colour, "stroke-width": 0.6 + s * 0.45, opacity: 0.25 + s * 0.065 }));
          const pick = () => { selected = person.key; draw(); };
          nodes.append(svg("g", { class: `vt-node${selected === person.key ? " is-selected" : ""}`, tabindex: 0, role: "button",
            "aria-label": `${person.name}, ${groupName}, strength ${s} of 10`, onclick: pick,
            onkeydown: (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pick(); } } },
          svg("circle", { cx: px, cy: py, r: 7 + s * 1.3, fill: colour, opacity: 0.9, stroke: "#0d101b", "stroke-width": 1.5 }),
          svg("text", { x: px, y: py + 7 + s * 1.3 + 14, "text-anchor": "middle", text: person.name })));
        });
        nodes.append(svg("circle", { cx: gx, cy: gy, r: 9, fill: "#0d101b", stroke: colour, "stroke-width": 2.5 }),
          svg("text", { x: gx, y: gy - 15, "text-anchor": "middle", fill: colour, "font-weight": 700, text: `${groupName} (${members.length})` }));
      });
      links.forEach((link) => {
        const a = spot.get(link.a), b = spot.get(link.b);
        if (!a || !b) return;
        const w = Math.max(1, Math.min(10, Number(link.weight) || 1));
        edges.append(svg("path", { d: `M${a[0]} ${a[1]} Q${cx} ${cy} ${b[0]} ${b[1]}`, fill: "none", stroke: "#ffffff", "stroke-dasharray": "5 4",
          "stroke-width": 0.5 + w * 0.3, opacity: 0.15 + w * 0.05 }));
      });
      nodes.append(svg("circle", { cx, cy, r: 26, fill: "#eef0f8" }), svg("text", { x: cx, y: cy + 5, "text-anchor": "middle", fill: "#0d101b", "font-weight": 800, text: "Me" }));
      root.append(edges, nodes);
      graph.textContent = "";
      graph.append(root);
    };

    const drawDetail = (list) => {
      detail.textContent = "";
      const person = list.find((p) => p.key === selected);
      if (!person) {
        detail.append(el("h3", { text: "Pick a person" }), el("p", { class: "vt-empty", text: "Select a circle or a row to see the history and add a note." }));
        return;
      }
      const history = notesFor(person.key);
      const noteText = el("textarea", { maxlength: "1200", placeholder: "What happened? A call, a visit, a long silence…" });
      const noteDate = el("input", { type: "date", value: isoDate(new Date()) });
      const moveTo = el("select");
      options(moveTo, groupsNow(), person.group);
      const add = async (change) => {
        const next = Math.max(1, Math.min(10, (Number(person.strength) || 1) + change));
        await records.put("web.note", records.newKey(), { person: person.key, date: noteDate.value || isoDate(new Date()), strength: next, change, text: noteText.value.trim() });
        if (next !== person.strength) await records.put("web.person", person.key, { name: person.name, group: person.group, strength: next });
      };
      const points = history.filter((n) => Number.isFinite(Number(n.strength)));
      const spark = svg("svg", { viewBox: "0 0 240 60", width: "240", height: "60", role: "img", "aria-label": `Strength over ${points.length} notes` },
        svg("polyline", { fill: "none", stroke: "#69d4cf", "stroke-width": 2,
          points: points.map((n, i) => `${points.length === 1 ? 120 : 8 + i * 224 / (points.length - 1)},${54 - (Number(n.strength) - 1) / 9 * 48}`).join(" ") }),
        points.map((n, i) => svg("circle", { cx: points.length === 1 ? 120 : 8 + i * 224 / (points.length - 1), cy: 54 - (Number(n.strength) - 1) / 9 * 48, r: 3, fill: "#69d4cf" })));
      detail.append(
        el("h3", { text: `${person.name} · ${person.strength} / 10` }),
        el("p", { class: "vt-empty", text: `${person.group} · ${history.length} note${history.length === 1 ? "" : "s"}` }),
        spark,
        el("div", { class: "vt-form", style: "margin-top:10px" }, field("Note", noteText, true), field("Date", noteDate),
          el("div", { class: "vt-actions vt-wide" },
            el("button", { class: "vt-chipbtn", type: "button", text: "Stronger (+1)", onclick: () => add(1) }),
            el("button", { class: "vt-chipbtn", type: "button", text: "Same", onclick: () => add(0) }),
            el("button", { class: "vt-chipbtn", type: "button", text: "Weaker (−1)", onclick: () => add(-1) }))),
        el("div", { class: "vt-form", style: "margin-top:12px" }, field("Move to group", moveTo),
          el("div", { class: "vt-actions" },
            el("button", { class: "vt-chipbtn", type: "button", text: "Move", onclick: () => records.put("web.person", person.key, { name: person.name, group: moveTo.value, strength: person.strength }) }),
            el("button", { class: "vt-chipbtn", type: "button", text: "Remove person", onclick: async () => {
              if (!window.confirm(`Remove ${person.name} from the web? The notes stay in the history.`)) return;
              selected = null;
              await records.remove("web.person", person.key);
            } }))),
        el("ul", { class: "vt-history" }, [...history].reverse().map((n) => el("li", { class: n.change > 0 ? "is-up" : n.change < 0 ? "is-down" : null },
          el("small", { text: `${dayLabel(n.date)} · ${n.strength} / 10${n.change > 0 ? " · stronger" : n.change < 0 ? " · weaker" : ""}` }), n.text || "No note."))));
    };

    const draw = () => {
      const list = people();
      const links = records.list("web.link").filter((l) => l.a && l.b);
      const names = new Map(list.map((p) => [p.key, p.name]));
      options(group, groupsNow(), group.value || GROUPS[0]);
      [linkA, linkB].forEach((select) => {
        const chosen = select.value;
        select.textContent = "";
        list.forEach((p) => select.append(el("option", { value: p.key, selected: p.key === chosen, text: p.name })));
      });
      drawGraph(list, links);
      drawDetail(list);
      tableWrap.textContent = "";
      if (!list.length) {
        tableWrap.append(el("p", { class: "vt-empty", text: "Nobody yet. Add the first person below." }));
      } else {
        const body = el("tbody");
        [...list].sort((a, b) => b.strength - a.strength || a.name.localeCompare(b.name)).forEach((p) => {
          const history = notesFor(p.key);
          const latest = history[history.length - 1];
          body.append(el("tr", {}, el("td", {}, el("button", { type: "button", text: p.name, style: "padding:0", onclick: () => { selected = p.key; draw(); } })),
            el("td", { text: p.group }), el("td", { class: "vt-num", text: `${p.strength} / 10` }),
            el("td", { text: latest ? dayLabel(latest.date) : "" }), el("td", { class: "vt-num", text: String(history.length) })));
        });
        tableWrap.append(el("table", { class: "vt-table" }, el("caption", { text: `${list.length} people, strongest first.` }),
          el("thead", {}, el("tr", {}, el("th", { text: "Person" }), el("th", { text: "Group" }), el("th", { class: "vt-num", text: "Strength" }),
            el("th", { text: "Last note" }), el("th", { class: "vt-num", text: "Notes" }))), body));
      }
      linksWrap.textContent = "";
      const shown = links.filter((l) => names.has(l.a) && names.has(l.b));
      if (shown.length) {
        const body = el("tbody");
        shown.forEach((l) => body.append(el("tr", {}, el("td", { text: names.get(l.a) }), el("td", { text: names.get(l.b) }), el("td", { class: "vt-num", text: `${l.weight} / 10` }),
          el("td", {}, el("button", { type: "button", text: "Remove", onclick: () => records.remove("web.link", linkKey(l.a, l.b)) })))));
        linksWrap.append(el("table", { class: "vt-table" }, el("caption", { text: "Who knows whom." }),
          el("thead", {}, el("tr", {}, el("th", { text: "Person" }), el("th", { text: "Knows" }), el("th", { class: "vt-num", text: "Strength" }), el("th", { text: "" }))), body));
      }
    };
    records.onChange(draw);
    mount.append(el("div", { class: "vt-app" },
      statusBar(),
      el("div", { class: "vt-two" }, el("section", { class: "vt-card" }, el("h3", { text: "The web" }), graph), detail),
      el("section", { class: "vt-card" }, el("h3", { text: "Everyone" }), tableWrap),
      el("section", { class: "vt-card" }, el("h3", { text: "Add a person" }), addForm),
      el("section", { class: "vt-card" }, el("h3", { text: "Connect two people" }), linkForm, linksWrap)));
    draw();
  };

  const apps = { "time-tracker": mountTracker, connections: mountConnections };
  let started = false;
  V.onChange(async (unlocked) => {
    const mounts = [...document.querySelectorAll("[data-vault-app]")];
    if (!unlocked || started || !mounts.length) return;
    started = true;
    await records.loadLocal();
    mounts.forEach((mount) => {
      const app = apps[mount.dataset.vaultApp];
      if (!app) return;
      mount.textContent = "";
      app(mount);
    });
    records.refresh();
  });
})();
