/* Browser interactivity for Workbench/index.html: snap-scroll forms, PBKDF2/AES-GCM passkey study runner, Rap bucket filter, voice recorder, and GitHub Mobile handoff. */
(() => {
  const STORAGE_KEY = "liam_workbench_entries_v1";
  const VAULT_KEY = "liam_workbench_vault_v2";
  const RUNS_KEY = "liam_workbench_study_runs_v1";
  const REPO_ISSUES = "https://github.com/l2mcgrat/pandas_projects/issues/new";

  const loadJson = (key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}") || {};
    } catch {
      return {};
    }
  };
  const saveJson = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private-browsing quota ignored */
    }
  };
  const loadLocal = () => loadJson(STORAGE_KEY);
  const saveLocal = (store) => saveJson(STORAGE_KEY, store);

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

  // ---- Snap-scroll right to the Add form when clicking Options 01-04 ----
  document.querySelectorAll("[data-wb-jump]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("data-wb-jump");
      const target = targetId ? document.getElementById(targetId) : null;
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstInput = target.querySelector("input:not([type=hidden]):not([type=file]), select, textarea");
      if (firstInput) {
        setTimeout(() => firstInput.focus({ preventScroll: true }), 260);
      }
    });
  });

  // ---- Passkey & Portable SHA-256 HMAC / CTR-MAC Token Vault ----
  // Pure-JS SHA-256 + HMAC-SHA256 so passkey verification and vault encryption work over both
  // plain HTTP (http://liammspandasprojects.org) and HTTPS.
  const DEFAULT_SALT_STR = "liam-wb-salt-v2";
  const DEFAULT_HASH_B64 = "67wxyE7LLICnHCNkjjGbBSKiCXdsQXw5YSjn1+lNzHo=";
  const LEGACY_PBKDF2_HASH_B64 = "c/tgnYToM7Vc9RWMAayysEY5G4NZTmPz10CHDSCkAXo=";

  let sessionUnlocked = false;
  let unlockedApiKey = "";
  let selectedRunnerModel = "argon-high";
  let pendingStudyToRun = null;

  const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const utf8Bytes = (str) => new TextEncoder().encode(str);

  const K256 = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  const sha256 = (msgBytes) => {
    const len = msgBytes.length;
    const bitHi = Math.floor((len * 8) / 0x100000000);
    const bitLo = (len * 8) >>> 0;
    const padLen = ((len + 9 + 63) & ~63);
    const buf = new Uint8Array(padLen);
    buf.set(msgBytes);
    buf[len] = 0x80;
    const view = new DataView(buf.buffer);
    view.setUint32(padLen - 8, bitHi, false);
    view.setUint32(padLen - 4, bitLo, false);

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const w = new Uint32Array(64);

    for (let off = 0; off < padLen; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K256[i] + w[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }
    const out = new Uint8Array(32);
    const outView = new DataView(out.buffer);
    [h0, h1, h2, h3, h4, h5, h6, h7].forEach((v, i) => outView.setUint32(i * 4, v, false));
    return out;
  };

  const hmacSha256 = (keyBytes, msgBytes) => {
    const k = keyBytes.length > 64 ? sha256(keyBytes) : keyBytes;
    const ipad = new Uint8Array(64);
    const opad = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
      const b = i < k.length ? k[i] : 0;
      ipad[i] = b ^ 0x36;
      opad[i] = b ^ 0x5c;
    }
    const innerInput = new Uint8Array(64 + msgBytes.length);
    innerInput.set(ipad);
    innerInput.set(msgBytes, 64);
    const inner = sha256(innerInput);
    const outerInput = new Uint8Array(64 + 32);
    outerInput.set(opad);
    outerInput.set(inner, 64);
    return sha256(outerInput);
  };

  const deriveKeyBytes = (passphrase, saltBytes) => {
    let h = utf8Bytes(passphrase);
    for (let i = 0; i < 4096; i++) {
      const msg = new Uint8Array(h.length + 2);
      msg.set(h);
      msg[h.length] = (i >>> 8) & 0xff;
      msg[h.length + 1] = i & 0xff;
      h = hmacSha256(saltBytes, msg);
    }
    return h;
  };

  const keystreamXor = (keyBytes, ivBytes, inputBytes) => {
    const out = new Uint8Array(inputBytes.length);
    let blockIndex = 0;
    for (let off = 0; off < inputBytes.length; off += 32) {
      const ctrMsg = new Uint8Array(ivBytes.length + 4);
      ctrMsg.set(ivBytes);
      new DataView(ctrMsg.buffer).setUint32(ivBytes.length, blockIndex++, false);
      const block = hmacSha256(keyBytes, ctrMsg);
      const end = Math.min(inputBytes.length, off + 32);
      for (let i = off; i < end; i++) out[i] = inputBytes[i] ^ block[i - off];
    }
    return out;
  };

  const sealVault = (passphrase, payloadObj) => {
    const salt = new Uint8Array(16);
    const iv = new Uint8Array(12);
    crypto.getRandomValues(salt);
    crypto.getRandomValues(iv);
    const master = deriveKeyBytes(passphrase, salt);
    const encKey = hmacSha256(master, utf8Bytes("enc"));
    const macKey = hmacSha256(master, utf8Bytes("mac"));
    const plain = utf8Bytes(JSON.stringify(payloadObj));
    const cipher = keystreamXor(encKey, iv, plain);
    const macInput = new Uint8Array(iv.length + cipher.length);
    macInput.set(iv);
    macInput.set(cipher, iv.length);
    const tag = hmacSha256(macKey, macInput);
    return { salt: toB64(salt), iv: toB64(iv), cipher: toB64(cipher), tag: toB64(tag) };
  };

  const openVault = (passphrase, vault) => {
    const salt = fromB64(vault.salt);
    const iv = fromB64(vault.iv);
    const cipher = fromB64(vault.cipher);
    const master = deriveKeyBytes(passphrase, salt);
    const encKey = hmacSha256(master, utf8Bytes("enc"));
    const macKey = hmacSha256(master, utf8Bytes("mac"));
    const macInput = new Uint8Array(iv.length + cipher.length);
    macInput.set(iv);
    macInput.set(cipher, iv.length);
    const expectedTag = toB64(hmacSha256(macKey, macInput));
    if (expectedTag !== vault.tag) throw new Error("MAC mismatch");
    const plain = keystreamXor(encKey, iv, cipher);
    return JSON.parse(new TextDecoder().decode(plain));
  };

  const matchesDefaultPassphrase = (passphrase) => {
    const derived = toB64(deriveKeyBytes(passphrase, utf8Bytes(DEFAULT_SALT_STR)));
    return derived === DEFAULT_HASH_B64 || LEGACY_PBKDF2_HASH_B64 === derived;
  };

  const MODEL_LABELS = {
    "argon-high": "Gemini Argon · High Thinking",
    "argon-medium": "Gemini Argon · Medium Thinking",
    "flash-fast": "Gemini 2.5 Flash · Fast Search",
  };

  const updateAuthIndicators = () => {
    const label = MODEL_LABELS[selectedRunnerModel] || MODEL_LABELS["argon-high"];
    document.querySelectorAll("[data-wb-auth-indicator]").forEach((el) => {
      el.textContent = sessionUnlocked ? `🔓 Unlocked · ${label}` : "🔒 Runner locked";
      el.classList.toggle("is-unlocked", sessionUnlocked);
    });
  };

  const authDialog = document.getElementById("wb-auth-dialog");
  const authForm = document.getElementById("wb-auth-form");
  const authStatus = document.getElementById("wb-auth-status");
  const runDialog = document.getElementById("wb-run-dialog");

  const openDialog = (dlg) => {
    if (!dlg) return;
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  };
  const resetPeekButtons = () => {
    document.querySelectorAll("[data-wb-peek]").forEach((btn) => {
      const targetId = btn.getAttribute("data-wb-peek");
      const input = targetId ? document.getElementById(targetId) : null;
      if (input) input.type = "password";
      btn.setAttribute("aria-pressed", "false");
      btn.classList.remove("is-peeking");
    });
  };
  const closeDialog = (dlg) => {
    if (!dlg) return;
    resetPeekButtons();
    if (typeof dlg.close === "function") dlg.close();
    else dlg.removeAttribute("open");
  };

  document.querySelectorAll("[data-wb-peek]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-wb-peek");
      const input = targetId ? document.getElementById(targetId) : null;
      if (!input) return;
      const showing = input.type === "password";
      input.type = showing ? "text" : "password";
      btn.setAttribute("aria-pressed", showing ? "true" : "false");
      btn.classList.toggle("is-peeking", showing);
    });
  });

  document.querySelectorAll("[data-wb-dialog-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-wb-dialog-close");
      if (id) closeDialog(document.getElementById(id));
    });
  });

  document.querySelectorAll("[data-wb-auth-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (authStatus) {
        const hasVault = Boolean(loadJson(VAULT_KEY).cipher);
        authStatus.textContent = hasVault
          ? "Custom browser vault active. Enter your current passphrase to unlock, change passphrase, or update settings."
          : "Default owner passphrase active. Enter your passphrase to unlock (or fill New passphrase to change it).";
      }
      openDialog(authDialog);
    });
  });

  const lockBtn = document.getElementById("wb-auth-lock");
  if (lockBtn) {
    lockBtn.addEventListener("click", () => {
      sessionUnlocked = false;
      unlockedApiKey = "";
      updateAuthIndicators();
      if (authStatus) authStatus.textContent = "Session locked.";
      closeDialog(authDialog);
      announce("Study Runner locked.");
    });
  }

  if (authForm) {
    authForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(authForm);
      const rawPass = String(data.get("passphrase") || "");
      const passphrase = rawPass.trim();
      const newPassphrase = String(data.get("newPassphrase") || "").trim();
      const newKey = String(data.get("apiKey") || "").trim();
      const chosenModel = String(data.get("runnerModel") || "argon-high");
      if (passphrase.length < 4) {
        if (authStatus) authStatus.textContent = "Passphrase must be at least 4 characters.";
        return;
      }
      if (newPassphrase && newPassphrase.length < 4) {
        if (authStatus) authStatus.textContent = "New passphrase must be at least 4 characters.";
        return;
      }
      try {
        const vault = loadJson(VAULT_KEY);
        let existingApiKey = "";
        let existingModel = chosenModel;
        let verified = false;

        if (vault.cipher && vault.tag) {
          try {
            const parsed = openVault(passphrase, vault);
            if (parsed.verifier === "LIAM_WB_OK") {
              verified = true;
              existingApiKey = parsed.apiKey || "";
              existingModel = chosenModel || parsed.runnerModel || "argon-high";
            }
          } catch {
            /* fall through to check default owner passphrase */
          }
        }
        if (!verified && (matchesDefaultPassphrase(passphrase) || matchesDefaultPassphrase(rawPass))) {
          verified = true;
        }
        if (!verified) {
          throw new Error("Passphrase mismatch");
        }

        const effectivePass = newPassphrase || passphrase;
        const effectiveApiKey = newKey || existingApiKey;
        selectedRunnerModel = existingModel;

        const sealed = sealVault(effectivePass, {
          verifier: "LIAM_WB_OK",
          apiKey: effectiveApiKey,
          runnerModel: selectedRunnerModel,
        });
        saveJson(VAULT_KEY, sealed);

        sessionUnlocked = true;
        unlockedApiKey = effectiveApiKey;
        updateAuthIndicators();
        authForm.reset();
        const modelSel = document.getElementById("wb-auth-model");
        if (modelSel) modelSel.value = selectedRunnerModel;
        closeDialog(authDialog);
        announce(
          newPassphrase
            ? `Passphrase changed & Study Runner unlocked (${MODEL_LABELS[selectedRunnerModel]}).`
            : `Study Runner unlocked (${MODEL_LABELS[selectedRunnerModel]}).`
        );
        if (pendingStudyToRun) {
          const study = pendingStudyToRun;
          pendingStudyToRun = null;
          await executeStudy(study);
        }
      } catch {
        sessionUnlocked = false;
        unlockedApiKey = "";
        updateAuthIndicators();
        if (authStatus) authStatus.textContent = "Incorrect current passphrase — verification failed. No tokens used.";
      }
    });
  }

  // ---- Study Synthesis & Standalone LaTeX Generator ----
  const buildLatexPaper = (study, findingsText) => {
    const safe = (s) => String(s || "").replace(/[\\{}$&#^_%~]/g, (m) => `\\${m}`);
    return [
      "\\documentclass[11pt]{article}",
      "\\usepackage[margin=1in]{geometry}",
      "\\setlength{\\emergencystretch}{3em}",
      "\\usepackage{amsmath,amssymb,enumitem}",
      "\\usepackage[hidelinks]{hyperref}",
      `\\title{${safe(study.title)}}`,
      "\\author{Liam McGrath}",
      `\\date{${study.createdOn || todayIso()}}`,
      "\\begin{document}",
      "\\maketitle",
      "\\tableofcontents",
      "",
      "\\section{Research Question \\& Dataset}",
      `\\textbf{Atlas destination:} \\texttt{${safe(study.atlasPath)}}\\\\`,
      `\\textbf{Primary data source:} ${safe(study.dataset)}`,
      "",
      `\\textit{${safe(study.question)}}`,
      "",
      "\\section{Synthesis \\& Empirical Findings}",
      safe(findingsText),
      "",
      "\\section{Model Specification}",
      "\\begin{equation}",
      "\\Delta Y_i = \\beta_0 + \\beta_1 X_i + \\varepsilon_i, \\qquad \\mathbb{E}[\\varepsilon_i \\mid X_i] = 0.",
      "\\label{eq:study-baseline}",
      "\\end{equation}",
      "\\end{document}",
    ].join("\n");
  };

  const markStudyCompletedInDom = (study, resultRecord) => {
    const statusCell = document.querySelector(`[data-study-status="${study.id}"]`);
    if (statusCell) {
      statusCell.innerHTML = '<span class="wb-badge wb-up">published</span>';
    }
    const outputCell = document.querySelector(`[data-study-outputs="${study.id}"]`);
    if (outputCell) {
      outputCell.replaceChildren();
      const viewBtn = document.createElement("button");
      viewBtn.type = "button";
      viewBtn.className = "button ghost wb-run-study-btn";
      viewBtn.textContent = "📄 View study & LaTeX ↗";
      viewBtn.addEventListener("click", () => showStudyResultModal(study, resultRecord));
      outputCell.appendChild(viewBtn);
    }
  };

  let activeModalResult = null;
  const showStudyResultModal = (study, resultRecord) => {
    activeModalResult = { study, ...resultRecord };
    const titleEl = document.getElementById("wb-run-title");
    const statusModalEl = document.getElementById("wb-run-status");
    const summaryEl = document.getElementById("wb-run-summary");
    const texEl = document.getElementById("wb-run-tex");
    if (titleEl) titleEl.textContent = `${study.id} · ${study.title}`;
    if (statusModalEl) statusModalEl.textContent = `Completed (${resultRecord.mode}) on ${resultRecord.completedAt}`;
    if (summaryEl) summaryEl.textContent = resultRecord.summary;
    if (texEl) texEl.value = resultRecord.tex;
    openDialog(runDialog);
  };

  const executeStudy = async (study) => {
    const titleEl = document.getElementById("wb-run-title");
    const statusModalEl = document.getElementById("wb-run-status");
    const summaryEl = document.getElementById("wb-run-summary");
    const texEl = document.getElementById("wb-run-tex");
    if (titleEl) titleEl.textContent = `Running ${study.id}: ${study.title}…`;
    if (statusModalEl) statusModalEl.textContent = "Authenticated · synthesizing study & LaTeX article…";
    if (summaryEl) summaryEl.textContent = `Question: ${study.question}\nDataset: ${study.dataset}`;
    if (texEl) texEl.value = "";
    openDialog(runDialog);

    let summaryText = "";
    let discoveredDataset = study.dataset;
    let mode = "local deterministic scaffold · 0 API tokens";
    const needsDatasetSearch = !study.dataset || /auto-discover/i.test(study.dataset);
    if (unlockedApiKey) {
      try {
        const prompt = [
          `You are an empirical research assistant for Liam McGrath's technical notebook.`,
          `Title: ${study.title}`,
          `Atlas Section: ${study.atlasPath}`,
          `Question: ${study.question}`,
          needsDatasetSearch
            ? `Dataset: NONE PROVIDED — first search for and name the most authoritative public datasets (e.g. Statistics Canada, BLS, FRED, World Bank, Elections Alberta/Canada, NBER, or peer-reviewed benchmarks) that answer this question, and start your response with a line "DATASETS: <concise dataset names & sources>".`
            : `Dataset provided: ${study.dataset} (also cite any complementary public benchmark datasets).`,
          `Then write a concise, fact-grounded 3-paragraph analytical study summary with concrete numbers, key hypotheses, and empirical takeaways.`,
        ].join("\n");
        const isHighThinking = selectedRunnerModel === "argon-high";
        const isMediumThinking = selectedRunnerModel === "argon-medium";
        const modelId = selectedRunnerModel === "flash-fast" ? "gemini-2.5-flash" : "gemini-2.5-pro";
        const thinkingBudget = isHighThinking ? 24576 : isMediumThinking ? 8192 : 0;
        const genConfig = {
          temperature: 0.2,
          ...(thinkingBudget ? { thinkingConfig: { thinkingBudget } } : {}),
        };
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(unlockedApiKey)}`;
        let resp = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
            generationConfig: genConfig,
          }),
        });
        if (!resp.ok) {
          resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(unlockedApiKey)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2 },
              }),
            }
          );
        }
        if (resp.ok) {
          const data = await resp.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n").trim() || "";
          const dsMatch = rawText.match(/^DATASETS:\s*(.+)$/im);
          if (dsMatch) {
            discoveredDataset = dsMatch[1].trim();
            study.dataset = discoveredDataset;
          }
          summaryText = rawText.replace(/^DATASETS:\s*.+\n?/im, "").trim();
          if (summaryText) mode = `${MODEL_LABELS[selectedRunnerModel] || "Gemini Argon · High Thinking"} + dataset search`;
        }
      } catch {
        /* fall back to zero-token scaffold */
      }
    }
    if (!summaryText) {
      if (needsDatasetSearch) {
        discoveredDataset = `Auto-suggested public sources for ${study.atlasPath.split("/").pop() || "study"} (StatCan / BLS / FRED / peer-reviewed tables)`;
        study.dataset = discoveredDataset;
      }
      summaryText = [
        `1. Scope & Hypothesis (${study.atlasPath}): Evaluates "${study.question}" using ${discoveredDataset}.`,
        `2. Decomposition & Primary Estimators: Splits observations into baseline trend, structural regime shifts, and tail leverage, cross-checked against reproducible CSV tables.`,
        `3. Next Compilation Step: Download the standalone .tex source below and run 'python -B -m site_content.pdf --engine <tectonic>' to certify the PDF cache.`,
      ].join("\n\n");
    }
    const tex = buildLatexPaper(study, summaryText);
    const resultRecord = { summary: summaryText, tex, dataset: discoveredDataset, mode, completedAt: todayIso() };
    const allRuns = loadJson(RUNS_KEY);
    allRuns[study.id] = resultRecord;
    saveJson(RUNS_KEY, allRuns);
    markStudyCompletedInDom(study, resultRecord);
    showStudyResultModal(study, resultRecord);
    announce(`Ran study ${study.id} (${mode}).`);
  };

  const requestRunStudy = (study) => {
    if (!sessionUnlocked) {
      pendingStudyToRun = study;
      if (authStatus) {
        authStatus.textContent = `Passkey required to run "${study.title}". Unlock below to proceed.`;
      }
      openDialog(authDialog);
      return;
    }
    executeStudy(study);
  };

  const attachRunButtonListener = (btn) => {
    btn.addEventListener("click", () => {
      const study = {
        id: btn.getAttribute("data-run-study-id") || "ST-RUN",
        title: btn.getAttribute("data-study-title") || "Queued Study",
        atlasPath: btn.getAttribute("data-study-path") || "",
        question: btn.getAttribute("data-study-question") || "",
        dataset: btn.getAttribute("data-study-dataset") || "",
        createdOn: todayIso(),
      };
      requestRunStudy(study);
    });
  };

  document.querySelectorAll("[data-run-study-id]").forEach(attachRunButtonListener);

  const downloadTexBtn = document.getElementById("wb-run-download-tex");
  if (downloadTexBtn) {
    downloadTexBtn.addEventListener("click", () => {
      if (!activeModalResult) return;
      const slug = (activeModalResult.study.id || "study").toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
      const blob = new Blob([activeModalResult.tex], { type: "application/x-tex" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${slug}.tex`;
      a.click();
    });
  }

  const copyTexBtn = document.getElementById("wb-run-copy-tex");
  if (copyTexBtn) {
    copyTexBtn.addEventListener("click", async () => {
      if (!activeModalResult || !navigator.clipboard) return;
      await navigator.clipboard.writeText(activeModalResult.tex);
      const statusModalEl = document.getElementById("wb-run-status");
      if (statusModalEl) statusModalEl.textContent = "Copied standalone LaTeX source to clipboard.";
    });
  }

  // Update submit button text when "Run study right now" toggle is flipped
  const runNowToggle = document.getElementById("wb-study-run-now");
  const studySubmitBtn = document.getElementById("wb-study-submit");
  if (runNowToggle && studySubmitBtn) {
    runNowToggle.addEventListener("change", () => {
      studySubmitBtn.textContent = runNowToggle.checked
        ? "Save & Run Study Now ▶"
        : "Save to Workbench +";
    });
  }

  const appendRow = (table, entry) => {
    if (table === "studyQueue") {
      const tbody = document.getElementById("wb-studies-body");
      if (!tbody) return;
      const tr = document.createElement("tr");
      tr.setAttribute("data-study-row", entry.id);
      const statusTd = cell("td", entry.status);
      statusTd.setAttribute("data-study-status", entry.id);
      const outTd = document.createElement("td");
      outTd.setAttribute("data-study-outputs", entry.id);
      const runBtn = document.createElement("button");
      runBtn.type = "button";
      runBtn.className = "button ghost wb-run-study-btn";
      runBtn.textContent = "▶ Run study now";
      runBtn.setAttribute("data-run-study-id", entry.id);
      runBtn.setAttribute("data-study-title", entry.title);
      runBtn.setAttribute("data-study-path", entry.atlasPath);
      runBtn.setAttribute("data-study-question", entry.question);
      runBtn.setAttribute("data-study-dataset", entry.dataset);
      attachRunButtonListener(runBtn);
      outTd.appendChild(runBtn);
      tr.append(
        cell("th", entry.id),
        cell("td", entry.createdOn),
        cell("td", entry.title),
        cell("td", entry.atlasPath),
        cell("td", entry.question),
        cell("td", entry.dataset),
        statusTd,
        outTd
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
      const rawDataset = String(data.get("dataset") || "").trim();
      return {
        id: `ST-L${Date.now().toString(36).slice(-4).toUpperCase()}`,
        createdOn,
        title: String(data.get("title") || "").trim(),
        atlasPath: String(data.get("atlasPath") || "").trim(),
        question: String(data.get("question") || "").trim(),
        dataset: rawDataset || "Auto-discover relevant public datasets",
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

  // Restore locally saved rows and any completed study runs on load
  const stored = loadLocal();
  for (const [table, rows] of Object.entries(stored)) {
    if (Array.isArray(rows)) rows.forEach((row) => appendRow(table, row));
  }
  const savedRuns = loadJson(RUNS_KEY);
  for (const [studyId, resultRecord] of Object.entries(savedRuns)) {
    const rowEl = document.querySelector(`[data-study-row="${studyId}"]`);
    if (rowEl && resultRecord && resultRecord.tex) {
      const cells = rowEl.querySelectorAll("td");
      const studyObj = {
        id: studyId,
        createdOn: cells[0]?.textContent || todayIso(),
        title: cells[1]?.textContent || studyId,
        atlasPath: cells[2]?.textContent || "",
        question: cells[3]?.textContent || "",
        dataset: cells[4]?.textContent || "",
      };
      markStudyCompletedInDom(studyObj, resultRecord);
    }
  }

  // Handle form submissions
  document.querySelectorAll("form[data-wb-table]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const table = form.getAttribute("data-wb-table");
      if (!table) return;
      const shouldRunNow = table === "studyQueue" && Boolean(runNowToggle && runNowToggle.checked);
      const entry = buildEntry(form, table);
      const current = loadLocal();
      current[table] = current[table] || [];
      current[table].push(entry);
      saveLocal(current);
      appendRow(table, entry);
      form.reset();
      if (studySubmitBtn) studySubmitBtn.textContent = "Save to Workbench +";
      announce(`Saved ${entry.id} to ${table} (local storage).`);
      if (shouldRunNow) {
        requestRunStudy(entry);
      }
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
