/* Browser interactivity for Workbench/index.html: local persistence, Rap bucket filter, voice recorder, and GitHub Mobile handoff. */
(() => {
  const STORAGE_KEY = "liam_workbench_entries_v1";
  const REPO_ISSUES = "https://github.com/l2mcgrat/pandas_projects/issues/new";

  const loadLocal = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  };

  const saveLocal = (store) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      /* private-browsing quota ignored */
    }
  };

  const statusEl = document.getElementById("wb-status-msg");
  const announce = (msg) => {
    if (statusEl) statusEl.textContent = msg;
  };

  const todayIso = () => new Date().toISOString().slice(0, 10);

  const cell = (tag, text) => {
    const el = document.createElement(tag);
    el.textContent = text;
    return el;
  };

  const appendRow = (table, entry) => {
    if (table === "studyQueue") {
      const tbody = document.getElementById("wb-studies-body");
      if (!tbody) return;
      const tr = document.createElement("tr");
      tr.append(
        cell("th", entry.id),
        cell("td", entry.createdOn),
        cell("td", entry.title),
        cell("td", entry.atlasPath),
        cell("td", entry.question),
        cell("td", entry.dataset),
        cell("td", entry.status),
        cell("td", "Saved locally · ready to sync")
      );
      tbody.appendChild(tr);
    } else if (table === "wishlistTodos") {
      const tbody = document.getElementById("wb-todos-body");
      if (!tbody) return;
      const tr = document.createElement("tr");
      tr.append(
        cell("th", entry.id),
        cell("td", entry.createdOn),
        cell("td", entry.title),
        cell("td", entry.category),
        cell("td", entry.priority),
        cell("td", entry.atlasPath),
        cell("td", entry.status),
        cell("td", entry.notes || "")
      );
      tbody.appendChild(tr);
    } else if (table === "rapLyrics") {
      const tbody = document.getElementById("wb-lyrics-body");
      if (!tbody) return;
      const tr = document.createElement("tr");
      tr.dataset.bucket = entry.bucket;
      const barsTd = document.createElement("td");
      const pre = cell("pre", entry.bars);
      pre.className = "wb-bars";
      barsTd.appendChild(pre);
      tr.append(
        cell("th", entry.id),
        cell("td", entry.createdOn),
        cell("td", entry.bucket),
        cell("td", entry.title),
        barsTd,
        cell("td", entry.themeCue || ""),
        cell("td", entry.status)
      );
      tbody.appendChild(tr);
    } else if (table === "voiceNotes") {
      const tbody = document.getElementById("wb-voice-body");
      if (!tbody) return;
      const tr = document.createElement("tr");
      tr.append(
        cell("th", entry.id),
        cell("td", entry.createdOn),
        cell("td", entry.channel),
        cell("td", entry.title),
        cell("td", `${entry.durationSeconds} s`),
        cell("td", `${entry.transcript} — ${entry.summary}`),
        cell("td", entry.atlasPath),
        cell("td", entry.status)
      );
      tbody.appendChild(tr);
    }
  };

  const buildEntry = (form, table) => {
    const data = new FormData(form);
    const createdOn = todayIso();
    if (table === "studyQueue") {
      return {
        id: `ST-L${Date.now().toString(36).slice(-4).toUpperCase()}`,
        createdOn,
        title: String(data.get("title") || "").trim(),
        atlasPath: String(data.get("atlasPath") || "").trim(),
        question: String(data.get("question") || "").trim(),
        dataset: String(data.get("dataset") || "").trim(),
        status: String(data.get("status") || "queued"),
        studyRoute: null,
        paperRoute: null,
        notes: "Added from browser Workbench",
      };
    }
    if (table === "wishlistTodos") {
      return {
        id: `TD-L${Date.now().toString(36).slice(-4).toUpperCase()}`,
        createdOn,
        title: String(data.get("title") || "").trim(),
        category: String(data.get("category") || "Website"),
        priority: String(data.get("priority") || "medium"),
        atlasPath: String(data.get("atlasPath") || ""),
        status: "planned",
        notes: String(data.get("notes") || "").trim(),
      };
    }
    if (table === "rapLyrics") {
      return {
        id: `RL-L${Date.now().toString(36).slice(-4).toUpperCase()}`,
        createdOn,
        bucket: String(data.get("bucket") || "Future-Projects"),
        title: String(data.get("title") || "").trim(),
        bars: String(data.get("bars") || "").trim(),
        themeCue: String(data.get("themeCue") || "").trim(),
        status: "draft",
      };
    }
    return {
      id: `VN-L${Date.now().toString(36).slice(-4).toUpperCase()}`,
      createdOn,
      channel: String(data.get("channel") || "Journal"),
      title: String(data.get("title") || "").trim(),
      durationSeconds: Number(data.get("durationSeconds") || 0),
      audioFormat: "browser-voice-note",
      transcript: String(data.get("transcript") || "").trim(),
      summary: String(data.get("summary") || "").trim(),
      atlasPath: String(data.get("atlasPath") || ""),
      status: "processed",
    };
  };

  // Restore locally saved rows on load
  const stored = loadLocal();
  for (const [table, rows] of Object.entries(stored)) {
    if (Array.isArray(rows)) rows.forEach((row) => appendRow(table, row));
  }

  // Handle form submissions
  document.querySelectorAll("form[data-wb-table]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const table = form.getAttribute("data-wb-table");
      if (!table) return;
      const entry = buildEntry(form, table);
      const current = loadLocal();
      current[table] = current[table] || [];
      current[table].push(entry);
      saveLocal(current);
      appendRow(table, entry);
      form.reset();
      announce(`Saved ${entry.id} to ${table} (local storage).`);
    });
  });

  // GitHub Mobile handoff buttons
  document.querySelectorAll("[data-wb-github]").forEach((button) => {
    button.addEventListener("click", () => {
      const table = button.getAttribute("data-wb-github");
      const form = button.closest("form");
      if (!form || !table) return;
      const entry = buildEntry(form, table);
      const title = `[Workbench ${table}] ${entry.title || entry.id}`;
      const body = `Paste into \`records/workbench/workbench.json\` under \`${table}\`:\n\n\`\`\`json\n${JSON.stringify(entry, null, 2)}\n\`\`\``;
      const url = `${REPO_ISSUES}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    });
  });

  // Rap bucket filter chips
  const chips = document.querySelectorAll("[data-wb-bucket]");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const bucket = chip.getAttribute("data-wb-bucket");
      chips.forEach((c) => c.classList.toggle("is-active", c === chip));
      document.querySelectorAll("#wb-lyrics-body tr").forEach((row) => {
        row.hidden = bucket !== "all" && row.getAttribute("data-bucket") !== bucket;
      });
    });
  });

  // Export JSON & SQL INSERTs
  const exportJsonBtn = document.getElementById("wb-export-json");
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener("click", () => {
      const payload = JSON.stringify(loadLocal(), null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `workbench-patch-${todayIso()}.json`;
      a.click();
      announce("Downloaded workbench JSON patch.");
    });
  }

  const exportSqlBtn = document.getElementById("wb-export-sql");
  if (exportSqlBtn) {
    exportSqlBtn.addEventListener("click", async () => {
      const current = loadLocal();
      const q = (v) => `'${String(v ?? "").replace(/'/g, "''")}'`;
      const lines = [];
      for (const s of current.studyQueue || []) {
        lines.push(`INSERT INTO study_queue VALUES (${q(s.id)}, ${q(s.createdOn)}, ${q(s.title)}, ${q(s.atlasPath)}, ${q(s.question)}, ${q(s.dataset)}, ${q(s.status)}, NULL, NULL, ${q(s.notes)});`);
      }
      for (const t of current.wishlistTodos || []) {
        lines.push(`INSERT INTO wishlist_todos VALUES (${q(t.id)}, ${q(t.createdOn)}, ${q(t.title)}, ${q(t.category)}, ${q(t.priority)}, ${q(t.atlasPath)}, ${q(t.status)}, ${q(t.notes)});`);
      }
      for (const r of current.rapLyrics || []) {
        lines.push(`INSERT INTO rap_lyrics VALUES (${q(r.id)}, ${q(r.createdOn)}, ${q(r.bucket)}, ${q(r.title)}, ${q(r.bars)}, ${q(r.themeCue)}, ${q(r.status)});`);
      }
      for (const v of current.voiceNotes || []) {
        lines.push(`INSERT INTO voice_notes VALUES (${q(v.id)}, ${q(v.createdOn)}, ${q(v.channel)}, ${q(v.title)}, ${Number(v.durationSeconds) || 0}, ${q(v.audioFormat)}, ${q(v.transcript)}, ${q(v.summary)}, ${q(v.atlasPath)}, ${q(v.status)});`);
      }
      const sql = lines.join("\n") || "-- No browser-staged rows yet; submit any form below first.";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(sql);
        announce(`Copied ${lines.length} SQL INSERT statement(s).`);
      }
    });
  }

  // Voice Note Recorder (MediaRecorder + optional Web Speech dictation + file upload)
  const startBtn = document.getElementById("wb-rec-start");
  const stopBtn = document.getElementById("wb-rec-stop");
  const fileInput = document.getElementById("wb-rec-file");
  const timerEl = document.getElementById("wb-rec-timer");
  const audioEl = document.getElementById("wb-rec-audio");
  const downloadEl = document.getElementById("wb-rec-download");
  const durationInput = document.getElementById("wb-voice-duration");
  const transcriptInput = document.getElementById("wb-voice-transcript");

  let recorder = null;
  let chunks = [];
  let startedAt = 0;
  let timerId = 0;
  let recognition = null;

  if (startBtn && stopBtn) {
    startBtn.addEventListener("click", async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (timerEl) timerEl.textContent = "Microphone unavailable — use Upload audio file.";
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        recorder = new MediaRecorder(stream);
        startedAt = Date.now();
        recorder.addEventListener("dataavailable", (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        });
        recorder.addEventListener("stop", () => {
          clearInterval(timerId);
          stream.getTracks().forEach((t) => t.stop());
          const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
          if (durationInput) durationInput.value = String(elapsed);
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          const url = URL.createObjectURL(blob);
          if (audioEl) {
            audioEl.src = url;
            audioEl.hidden = false;
          }
          if (downloadEl) {
            downloadEl.href = url;
            downloadEl.hidden = false;
          }
          if (timerEl) timerEl.textContent = `${elapsed}s recorded · ready`;
        });
        recorder.start();
        startBtn.disabled = true;
        stopBtn.disabled = false;
        timerId = window.setInterval(() => {
          const s = Math.round((Date.now() - startedAt) / 1000);
          if (timerEl) timerEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} · recording…`;
        }, 500);

        const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (Speech && transcriptInput) {
          recognition = new Speech();
          recognition.continuous = true;
          recognition.interimResults = false;
          recognition.addEventListener("result", (ev) => {
            const text = Array.from(ev.results).map((r) => r[0].transcript).join(" ").trim();
            if (text) transcriptInput.value = text;
          });
          try { recognition.start(); } catch { /* ignore */ }
        }
      } catch {
        if (timerEl) timerEl.textContent = "Microphone permission declined.";
      }
    });

    stopBtn.addEventListener("click", () => {
      if (recorder && recorder.state !== "inactive") recorder.stop();
      if (recognition) {
        try { recognition.stop(); } catch { /* ignore */ }
      }
      startBtn.disabled = false;
      stopBtn.disabled = true;
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      if (audioEl) {
        audioEl.src = url;
        audioEl.hidden = false;
        audioEl.addEventListener("loadedmetadata", () => {
          if (durationInput && Number.isFinite(audioEl.duration)) {
            durationInput.value = String(Math.round(audioEl.duration));
          }
        }, { once: true });
      }
      if (timerEl) timerEl.textContent = `Loaded ${file.name}`;
    });
  }
})();
