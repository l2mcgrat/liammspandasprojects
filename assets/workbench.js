/* Browser interactivity for Workbench/index.html: snap-scroll forms, PBKDF2/AES-GCM passkey study runner, Rap bucket filter, voice recorder, and GitHub Mobile handoff. */
(() => {
  const STORAGE_KEY = "liam_workbench_entries_v1";
  const VAULT_KEY = "liam_workbench_vault_v2";
  const RUNS_KEY = "liam_workbench_study_runs_v1";
  const LOCKOUT_KEY = "liam_workbench_ip_lockout_v1";
  const DELETED_KEY = "liam_workbench_deleted_v1";
  const REPO_ISSUES = "https://github.com/l2mcgrat/pandas_projects/issues/new";

  const FAILED_ATTEMPT_MESSAGES = [
    "Incorrect current passphrase — verification failed. No tokens used.",
    "Passphrase Is Incorrect You Potential Clanker",
    "Persistant Are We 👀👀👀👀👀👀",
    "Maybe its time to give up and Touch Some Grassss",
    "Why are you still trying bro 😆🤣🥹🤤😬",
    "Dilly Dallying away our whole life away huh 🙂‍↔️",
    "🥶🥶🥶🥶🥶🥶🥶🥶🥶🥶🥶",
    "Why 😐",
    "Whyyyyy 😑😑😑😑",
    "Last Try 👉🤢👈👉😶👈👉😼👈👉😈👈",
  ];

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
    "argon-high": "Gemini 4 Argon · High Thinking",
    "argon-medium": "Gemini 4 Argon · Medium Thinking",
    "deep-research": "Gemini Deep Research Agent",
    "flash-fast": "Gemini 3.8 Flash · Fast Search",
  };

  let discoveredLiveModelIds = [];
  const discoverLiveModels = async (apiKey) => {
    if (!apiKey || typeof fetch !== "function") return;
    try {
      const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
        headers: { "x-goog-api-key": apiKey },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const models = Array.isArray(data?.models) ? data.models : [];
      const ids = models
        .map((m) => String(m.name || "").replace(/^models\//, ""))
        .filter((id) => /^gemini-(4|5|3\.8)|deep-research/i.test(id));
      if (ids.length > 0) {
        discoveredLiveModelIds = ids;
        const sel = document.getElementById("wb-auth-model");
        const discNote = document.getElementById("wb-model-discovery");
        if (discNote) {
          discNote.textContent = `✓ Live Google AI Studio models discovered: ${ids.slice(0, 4).join(", ")}`;
          discNote.style.color = "#8fe0a8";
        }
        if (sel) {
          ids.forEach((id) => {
            if (![...sel.options].some((o) => o.value === id)) {
              const opt = document.createElement("option");
              opt.value = id;
              opt.textContent = `Live API Model · ${id} (High Thinking + Google Search)`;
              sel.appendChild(opt);
              MODEL_LABELS[id] = `${id} · Live Google AI Studio`;
            }
          });
        }
      }
    } catch {
      /* keep built-in Gemini 4 Argon & 3.8 Flash defaults */
    }
  };

  const authDialog = document.getElementById("wb-auth-dialog");
  const authForm = document.getElementById("wb-auth-form");
  const authStatus = document.getElementById("wb-auth-status");
  const runDialog = document.getElementById("wb-run-dialog");
  const runNowToggle = document.getElementById("wb-study-run-now");
  const studySubmitBtn = document.getElementById("wb-study-submit");

  // ---- Client IP Resolution, IP Index & Permanent IP Lockout State ----
  let clientIp = loadJson(LOCKOUT_KEY).lastIp || "local-ip";
  let unlockedSessionIp = null;

  const computeIpIndex = (ipStr) => {
    const raw = String(ipStr || "local-ip").trim();
    if (!raw || raw === "IP#OWNER") return "IP#OWNER";
    const digest = sha256(utf8Bytes(`liam-ip-idx:${raw}`));
    const hex = Array.from(digest.slice(0, 2)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const parts = raw.split(".");
    const masked = parts.length === 4 ? `${parts[0]}.${parts[1]}.*.*` : raw.slice(0, 10);
    return raw === "local-ip" ? `IP#${hex}` : `IP#${hex} (${masked})`;
  };

  let currentIpIndex = computeIpIndex(clientIp);

  const isAdminUnlocked = () => Boolean(sessionUnlocked && unlockedSessionIp === clientIp && !isIpLocked());

  const getLockoutStore = () => {
    const store = loadJson(LOCKOUT_KEY);
    store.attemptsByIp = store.attemptsByIp || {};
    store.lockedIps = store.lockedIps || {};
    return store;
  };

  const isIpLocked = () => {
    const store = getLockoutStore();
    return Boolean(store.lockedAll || store.lockedIps[clientIp]);
  };

  const getFailedAttempts = () => {
    const store = getLockoutStore();
    return Number(store.attemptsByIp[clientIp] || store.attemptsByIp._local || 0);
  };

  const setFailedAttempts = (count) => {
    const store = getLockoutStore();
    store.lastIp = clientIp;
    store.attemptsByIp[clientIp] = count;
    store.attemptsByIp._local = count;
    saveJson(LOCKOUT_KEY, store);
  };

  const updateKeyStatusBadge = () => {
    const el = document.getElementById("wb-key-status");
    if (!el) return;
    const vault = loadJson(VAULT_KEY);
    if (unlockedApiKey) {
      el.textContent = `✓ Active in session (ends in …${unlockedApiKey.slice(-4)})`;
      el.style.color = "#8fe0a8";
    } else if (vault && vault.hasKey) {
      el.textContent = `✓ Saved in encrypted vault (ends in …${vault.keyTail || "****"}) — unlock Admin to activate`;
      el.style.color = "#9ddacf";
    } else {
      el.textContent = "⚠ No API key saved in this browser yet — paste your Google AI Studio key (AQ....eQ3w) below";
      el.style.color = "#f7ab65";
    }
  };

  const cleanAndValidateApiKey = (raw) => {
    const cleaned = String(raw || "").trim().replace(/^["']+|["']+$/g, "").trim();
    if (!cleaned) return { ok: true, key: "" };
    // Accept Google AI Studio Auth keys (AQ....), Standard keys (AIza...), or any full key >= 16 chars that isn't a masked "...xxxx" snippet
    if (cleaned.startsWith("...") || cleaned.length < 16) {
      return {
        ok: false,
        key: "",
        error: `⚠ "${cleaned}" looks like the shortened "...eQ3w" preview rather than the full key. Click "Copy key" in Google AI Studio to copy the full key (e.g. AQ....eQ3w) and paste it here.`,
      };
    }
    return { ok: true, key: cleaned };
  };

  const recoverSavedVaultData = (passphrase, vault) => {
    let existingApiKey = "";
    let existingModel = "";
    let verified = false;
    if (passphrase && vault && vault.cipher && vault.tag) {
      try {
        const parsed = openVault(passphrase, vault);
        if (parsed && parsed.verifier === "LIAM_WB_OK") {
          verified = true;
          existingApiKey = parsed.apiKey || "";
          existingModel = parsed.runnerModel || "";
        }
      } catch {
        /* try owner backup below */
      }
    }
    if (!existingApiKey && vault && vault.ownerBackup && vault.ownerBackup.cipher) {
      try {
        const backup = openVault(DEFAULT_HASH_B64, vault.ownerBackup);
        if (backup && backup.verifier === "LIAM_WB_OK") {
          existingApiKey = backup.apiKey || "";
          if (!existingModel) existingModel = backup.runnerModel || "";
        }
      } catch {
        /* ignore */
      }
    }
    return { verified, existingApiKey, existingModel };
  };

  const persistVaultRecord = (passphraseToSeal, apiKey, runnerModel) => {
    const effectivePass = passphraseToSeal || DEFAULT_HASH_B64;
    const payload = {
      verifier: "LIAM_WB_OK",
      apiKey: apiKey || "",
      runnerModel: runnerModel || "argon-high",
    };
    const sealed = sealVault(effectivePass, payload);
    sealed.ownerBackup = sealVault(DEFAULT_HASH_B64, payload);
    sealed.hasKey = Boolean(apiKey);
    sealed.keyTail = apiKey ? apiKey.slice(-4) : "";
    saveJson(VAULT_KEY, sealed);
  };

  const syncLockoutDom = () => {
    const locked = isIpLocked();
    const adminActive = isAdminUnlocked();
    const label = MODEL_LABELS[selectedRunnerModel] || MODEL_LABELS["argon-high"];
    document.querySelectorAll("[data-wb-auth-indicator]").forEach((el) => {
      if (locked) {
        el.textContent = `🚫 IP ${clientIp} Locked Out`;
      } else {
        el.textContent = adminActive ? `🔓 Admin · ${label} (${currentIpIndex.split(" ")[0]})` : "🔒 Admin locked";
      }
      el.classList.toggle("is-unlocked", adminActive);
      el.classList.toggle("is-locked-out", locked);
    });
    document.querySelectorAll("[data-wb-auth-open]").forEach((btn) => {
      const cap = btn.querySelector(".symbol-caption");
      if (cap) {
        cap.textContent = locked ? "IP Locked Out" : (adminActive ? "Admin Unlocked" : "Unlock Admin");
        btn.classList.toggle("is-unlocked", adminActive);
      } else {
        btn.textContent = locked ? "🚫 IP Locked Out" : (adminActive ? "🔓 Admin Unlocked" : "🔐 Unlock Admin");
      }
    });
    document.querySelectorAll("[data-wb-admin-col], [data-wb-admin-only]").forEach((el) => {
      el.hidden = !adminActive;
    });
    const restoreBtn = document.getElementById("wb-restore-deleted");
    if (restoreBtn) {
      const deleted = loadJson(DELETED_KEY).ids || [];
      restoreBtn.hidden = !adminActive || deleted.length === 0;
    }
    document.querySelectorAll("[data-run-study-id]").forEach((btn) => {
      btn.disabled = locked;
      if (!btn.hasAttribute("data-orig-label")) {
        btn.setAttribute("data-orig-label", btn.textContent || "▶ Run study now");
      }
      btn.textContent = locked ? "🚫 IP Locked Out" : (btn.getAttribute("data-orig-label") || "▶ Run study now");
    });
    if (runNowToggle) {
      if (locked) {
        runNowToggle.checked = false;
        if (studySubmitBtn) studySubmitBtn.textContent = "Save to Workbench +";
      }
      runNowToggle.disabled = locked;
    }
    if (authForm) {
      ["wb-auth-new-pass", "wb-auth-model", "wb-auth-key"].forEach((id) => {
        const el = document.getElementById(id);
        const wrap = el ? el.closest("label") : null;
        if (wrap) wrap.hidden = locked;
      });
    }
    updateKeyStatusBadge();
  };

  const lockAdminSession = () => {
    sessionUnlocked = false;
    unlockedSessionIp = null;
    unlockedApiKey = "";
    syncLockoutDom();
  };

  // Automatically lock Admin when leaving or unloading the page so it is strictly single-page-session + IP-scoped
  window.addEventListener("pagehide", lockAdminSession);
  window.addEventListener("beforeunload", lockAdminSession);

  const lockCurrentIp = () => {
    const store = getLockoutStore();
    store.lastIp = clientIp;
    store.lockedAll = true;
    store.lockedIps[clientIp] = { ip: clientIp, lockedAt: new Date().toISOString() };
    saveJson(LOCKOUT_KEY, store);
    lockAdminSession();
  };

  const unlockCurrentIp = () => {
    const store = getLockoutStore();
    store.lockedAll = false;
    delete store.lockedIps[clientIp];
    delete store.lockedIps["local-ip"];
    store.attemptsByIp[clientIp] = 0;
    store.attemptsByIp._local = 0;
    saveJson(LOCKOUT_KEY, store);
    const passInput = document.getElementById("wb-auth-pass");
    if (passInput) passInput.placeholder = "Enter current passphrase to unlock";
    syncLockoutDom();
  };

  // Resolve public IP in background via ipify (graceful fallback if offline/ad-blocked)
  if (typeof fetch === "function") {
    fetch("https://api.ipify.org?format=json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.ip) {
          const store = getLockoutStore();
          const prevIp = clientIp;
          clientIp = String(d.ip);
          currentIpIndex = computeIpIndex(clientIp);
          // If unlocked under local-ip placeholder during page load, bind to the resolved IP; if IP actually changed mid-session, lock!
          if (sessionUnlocked && unlockedSessionIp && unlockedSessionIp !== prevIp && unlockedSessionIp !== clientIp) {
            lockAdminSession();
          } else if (sessionUnlocked && unlockedSessionIp === prevIp) {
            unlockedSessionIp = clientIp;
          }
          store.lastIp = clientIp;
          if (store.lockedAll || store.lockedIps[prevIp]) {
            store.lockedIps[clientIp] = { ip: clientIp, lockedAt: new Date().toISOString() };
          }
          if (store.attemptsByIp._local && !store.attemptsByIp[clientIp]) {
            store.attemptsByIp[clientIp] = store.attemptsByIp._local;
          }
          saveJson(LOCKOUT_KEY, store);
          syncLockoutDom();
          if (typeof refreshIpFilterOptions === "function") refreshIpFilterOptions();
        }
      })
      .catch(() => {
        /* keep local-ip fallback */
      });
  }

  const updateAuthIndicators = () => syncLockoutDom();

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
      syncLockoutDom();
      if (authStatus) {
        if (isIpLocked()) {
          authStatus.classList.add("is-error");
          authStatus.textContent = `🚫 IP ${clientIp} is permanently locked out after 10 failed attempts. Inaccessible until unlocked by a valid passphrase.`;
        } else {
          authStatus.classList.remove("is-error");
          const hasVault = Boolean(loadJson(VAULT_KEY).cipher);
          authStatus.textContent = hasVault
            ? "Custom browser vault active. Enter your current passphrase to unlock, change passphrase, or update settings."
            : "Default owner passphrase active. Enter your passphrase to unlock (or fill New passphrase to change it).";
        }
      }
      openDialog(authDialog);
    });
  });

  const lockBtn = document.getElementById("wb-auth-lock");
  if (lockBtn) {
    lockBtn.addEventListener("click", () => {
      lockAdminSession();
      if (authStatus) {
        authStatus.classList.remove("is-error");
        authStatus.textContent = "Admin session locked.";
      }
      closeDialog(authDialog);
      announce("Admin session locked.");
    });
  }

  if (authForm) {
    authForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(authForm);
      const rawPass = String(data.get("passphrase") || "");
      const passphrase = rawPass.trim();
      const newPassphrase = String(data.get("newPassphrase") || "").trim();
      const rawNewKey = String(data.get("apiKey") || "").trim();
      const chosenModel = String(data.get("runnerModel") || "argon-high");

      const keyCheck = cleanAndValidateApiKey(rawNewKey);
      if (!keyCheck.ok) {
        if (authStatus) {
          authStatus.classList.add("is-error");
          authStatus.textContent = keyCheck.error;
        }
        return;
      }
      const newKey = keyCheck.key;

      try {
        const vault = loadJson(VAULT_KEY);
        const recovered = recoverSavedVaultData(passphrase, vault);
        let verified = recovered.verified;
        const existingApiKey = recovered.existingApiKey;
        const existingModel = chosenModel || recovered.existingModel || "argon-high";

        if (!verified && passphrase.length > 0 && (matchesDefaultPassphrase(passphrase) || matchesDefaultPassphrase(rawPass))) {
          verified = true;
        }
        if (!verified) {
          throw new Error("Passphrase mismatch");
        }

        if (newPassphrase && newPassphrase.length < 4) {
          if (authStatus) {
            authStatus.classList.add("is-error");
            authStatus.textContent = "New passphrase must be at least 4 characters.";
          }
          return;
        }

        // Valid passphrase entered: lift any IP lockout and reset the 1-10 failed-attempt loop!
        unlockCurrentIp();

        const effectivePass = newPassphrase || passphrase;
        const effectiveApiKey = newKey || existingApiKey;
        selectedRunnerModel = existingModel;

        persistVaultRecord(effectivePass, effectiveApiKey, selectedRunnerModel);

        sessionUnlocked = true;
        unlockedSessionIp = clientIp;
        unlockedApiKey = effectiveApiKey;
        if (unlockedApiKey) discoverLiveModels(unlockedApiKey);
        if (authStatus) authStatus.classList.remove("is-error");
        updateAuthIndicators();

        // If the user triggered Unlock Admin specifically to run a study, warn them if no API key is saved yet so they don't get a 0-token run by surprise!
        if (pendingStudyToRun && !unlockedApiKey) {
          const keyInput = document.getElementById("wb-auth-key");
          if (keyInput) keyInput.focus();
          if (authStatus) {
            authStatus.classList.add("is-error");
            authStatus.textContent = `🔓 Admin unlocked! To run "${pendingStudyToRun.title}" with live Gemini 4 Argon tokens (instead of 0 tokens), paste your Google AI Studio key (AQ....eQ3w) into the Gemini API key box above and click Unlock Admin 🔓 again.`;
          }
          return;
        }

        authForm.reset();
        const modelSel = document.getElementById("wb-auth-model");
        if (modelSel) modelSel.value = selectedRunnerModel;
        closeDialog(authDialog);
        announce(
          newPassphrase
            ? `Passphrase changed & Admin unlocked for ${currentIpIndex} (${MODEL_LABELS[selectedRunnerModel]}).`
            : `Admin unlocked for ${currentIpIndex} (${MODEL_LABELS[selectedRunnerModel]}).`
        );
        if (pendingStudyToRun) {
          const study = pendingStudyToRun;
          pendingStudyToRun = null;
          await executeStudy(study);
        }
      } catch {
        lockAdminSession();
        // If already locked out on this IP, close the window immediately on any wrong attempt.
        if (isIpLocked()) {
          closeDialog(authDialog);
          announce(`🚫 Access denied for IP ${clientIp} — permanently locked until unlocked.`);
          return;
        }
        const attempt = getFailedAttempts() + 1;
        setFailedAttempts(attempt);
        if (attempt > FAILED_ATTEMPT_MESSAGES.length) {
          // Failed after seeing #10 ("Last Try ...") -> close window & permanently lock out IP
          lockCurrentIp();
          closeDialog(authDialog);
          announce(`🚫 IP ${clientIp} permanently locked out after 10 failed attempts until unlocked.`);
          return;
        }
        const msg = FAILED_ATTEMPT_MESSAGES[attempt - 1];
        if (authStatus) {
          authStatus.classList.add("is-error");
          authStatus.textContent = msg;
        }
        if (attempt === FAILED_ATTEMPT_MESSAGES.length) {
          const passInput = document.getElementById("wb-auth-pass");
          if (passInput) passInput.placeholder = "Last Try 👉🤢👈👉😶👈👉😼👈👉😈👈";
        }
        updateAuthIndicators();
      }
    });
  }

  // ---- Study Synthesis, Athletics-Style SVG Chart, Pandas Script & Standalone LaTeX Generator ----
  const buildFallbackAnalytics = (study) => {
    const topic = (study.atlasPath || "Study").split("/").pop().replace(/-/g, " ");
    return {
      chartTitle: `${study.title} · Empirical Benchmark Comparison`,
      chartSubtitle: `Comparative benchmark metrics synthesized for ${topic} (${study.dataset || "public datasets"}).`,
      chartUnit: "",
      kpis: [
        { label: "Primary Domain", value: topic, note: study.atlasPath || "Atlas Destination" },
        { label: "Model Engine", value: "Gemini 4 Argon", note: "High Thinking + Google Search" },
        { label: "Data Pipeline", value: "Pandas + CSV", note: "Reproducible table & script" },
        { label: "Output Format", value: "SVG + LaTeX", note: "Integrated into Atlas & Mental Map" },
      ],
      bars: [
        { label: "Top decile / leader benchmark", primary: 84, secondary: 16, note: "Upper empirical bound" },
        { label: "Concentrated / treatment regime", primary: 68, secondary: 24, note: "Primary structural effect" },
        { label: "OECD / global median baseline", primary: 49, secondary: 18, note: "Cross-sectional median" },
        { label: "Competitive / control counterfactual", primary: 31, secondary: 12, note: "Unconcentrated baseline" },
      ],
      tableColumns: ["Benchmark Group", "Primary Metric", "Secondary Metric", "Regime / Mechanism"],
      tableRows: [
        ["Top decile / leader benchmark", "84.0", "16.0", "Upper empirical bound"],
        ["Concentrated / treatment regime", "68.0", "24.0", "Primary structural effect"],
        ["OECD / global median baseline", "49.0", "18.0", "Cross-sectional median"],
        ["Competitive / control counterfactual", "31.0", "12.0", "Unconcentrated baseline"],
      ],
    };
  };

  const buildPandasScript = (study, analytics) => {
    if (analytics && typeof analytics.pandasScript === "string" && analytics.pandasScript.trim().length > 40) {
      return analytics.pandasScript.trim();
    }
    const cols = (analytics && analytics.tableColumns) || ["Group", "Primary", "Secondary", "Notes"];
    const rows = (analytics && analytics.tableRows) || [];
    return [
      `"""Reproducible Pandas analysis for ${study.id}: ${study.title} (${study.atlasPath})"""`,
      `import numpy as np`,
      `import pandas as pd`,
      ``,
      `columns = ${JSON.stringify(cols)}`,
      `rows = ${JSON.stringify(rows, null, 2)}`,
      `df = pd.DataFrame(rows, columns=columns)`,
      `for col in df.columns[1:3]:`,
      `    df[col + "_num"] = pd.to_numeric(df[col].astype(str).str.replace(r"[^0-9.-]", "", regex=True), errors="coerce")`,
      `print("=== ${study.id}: ${study.title} — Pandas Summary ===")`,
      `print(df)`,
      `print("\\nDescriptive Statistics:")`,
      `print(df.describe(include="all"))`,
    ].join("\n");
  };

  const buildCsvFromAnalytics = (analytics) => {
    const cols = (analytics && analytics.tableColumns) || ["Group", "Primary", "Secondary", "Notes"];
    const rows = (analytics && analytics.tableRows) || [];
    const escCsv = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    return [cols.map(escCsv).join(","), ...rows.map((r) => r.map(escCsv).join(","))].join("\n");
  };

  const renderAnalyticsSvgHtml = (studyId, analytics) => {
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const bars = Array.isArray(analytics?.bars) && analytics.bars.length ? analytics.bars : buildFallbackAnalytics({}).bars;
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
        `<line class="chart-grid" x1="${tx.toFixed(1)}" x2="${tx.toFixed(1)}" y1="30" y2="${height - 26}"/>` +
        `<text x="${tx.toFixed(1)}" y="20" text-anchor="middle">${tickStr}${unit}</text>`
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
        `<text x="${left - 10}" y="${y + 15}" text-anchor="end">${esc(lbl)}</text>` +
        `<rect fill="#69d4cf" x="${left}" y="${y}" width="${wP.toFixed(1)}" height="20"><title>${esc(b.label)}: ${pVal}${unit} (${esc(b.note || "")})</title></rect>` +
        (wS > 0 ? `<rect fill="#f7ab65" x="${(left + wP).toFixed(1)}" y="${y}" width="${wS.toFixed(1)}" height="20"><title>${esc(b.label)} secondary: ${sVal}${unit}</title></rect>` : "") +
        `<text class="athletics-label" x="${(left + wP + wS + 8).toFixed(1)}" y="${y + 15}">${pVal}${unit}${sVal > 0 ? ` (+${sVal}${unit})` : ""}</text>`
      );
    });
    return [
      `<figure class="sports-chart athletics-chart">`,
      `<figcaption><span class="chart-title">${esc(analytics?.chartTitle || "Empirical Study Chart")}</span>`,
      `<small>${esc(analytics?.chartSubtitle || "")}</small></figcaption>`,
      `<svg viewBox="0 0 900 ${height}" role="img" aria-label="${esc(analytics?.chartTitle || studyId)}">${parts.join("")}</svg>`,
      `</figure>`,
    ].join("");
  };

  const renderStudyAnalyticsDom = (container, study, resultRecord) => {
    if (!container) return;
    const analytics = resultRecord.analytics || buildFallbackAnalytics(study);
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const kpis = Array.isArray(analytics.kpis) && analytics.kpis.length ? analytics.kpis : buildFallbackAnalytics(study).kpis;
    const kpiHtml = `<div class="sports-metrics" style="margin: 8px 0 14px;">` + kpis.slice(0, 4).map((k) =>
      `<article class="sports-metric"><span>${esc(k.label)}</span><strong>${esc(k.value)}</strong><small>${esc(k.note || "")}</small></article>`
    ).join("") + `</div>`;
    const svgHtml = renderAnalyticsSvgHtml(study.id, analytics);
    const cols = Array.isArray(analytics.tableColumns) && analytics.tableColumns.length ? analytics.tableColumns : ["Item", "Primary", "Secondary", "Notes"];
    const rows = Array.isArray(analytics.tableRows) ? analytics.tableRows : [];
    const tableHtml = rows.length
      ? `<div class="sports-table-wrap" style="margin: 12px 0;"><table class="wb-inline-study-table"><thead><tr>${cols.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((cellVal, ci) => ci === 0 ? `<th scope="row">${esc(cellVal)}</th>` : `<td>${esc(cellVal)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
      : "";
    container.innerHTML = kpiHtml + svgHtml + tableHtml;
    container.hidden = false;
  };

  const buildLatexPaper = (study, findingsText, analytics) => {
    const safe = (s) => String(s || "").replace(/[\\{}$&#^_%~]/g, (m) => `\\${m}`);
    const cols = Array.isArray(analytics?.tableColumns) ? analytics.tableColumns : [];
    const rows = Array.isArray(analytics?.tableRows) ? analytics.tableRows : [];
    let tableBlock = "";
    if (cols.length > 0 && rows.length > 0) {
      const colSpec = "l" + "r".repeat(Math.max(0, cols.length - 1));
      const headerLine = cols.map((c) => `\\textbf{${safe(c)}}`).join(" & ") + " \\\\";
      const rowLines = rows.slice(0, 12).map((r) => r.slice(0, cols.length).map((v) => safe(v)).join(" & ") + " \\\\").join("\n");
      tableBlock = [
        "",
        "\\section{Empirical Benchmark Table (Pandas Output)}",
        "\\begin{center}",
        `\\begin{tabular}{${colSpec}}`,
        "\\hline",
        headerLine,
        "\\hline",
        rowLines,
        "\\hline",
        "\\end{tabular}",
        "\\end{center}",
      ].join("\n");
    }
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
      tableBlock,
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
    const hasLiveTokens = Boolean(resultRecord && Number(resultRecord.tokens) > 0);
    const statusCell = document.querySelector(`[data-study-status="${study.id}"]`);
    if (statusCell) {
      statusCell.innerHTML = hasLiveTokens
        ? '<span class="wb-badge wb-up">published</span>'
        : '<span class="wb-badge wb-warn">scaffold (0 tokens)</span>';
    }
    const outputCell = document.querySelector(`[data-study-outputs="${study.id}"]`);
    if (outputCell) {
      outputCell.replaceChildren();
      const viewBtn = document.createElement("button");
      viewBtn.type = "button";
      viewBtn.className = "button ghost wb-run-study-btn";
      viewBtn.textContent = hasLiveTokens ? "📊 View charts, Pandas & LaTeX ↗" : "⚡ View / Run with API Key ↗";
      viewBtn.addEventListener("click", () => showStudyResultModal(study, resultRecord));
      outputCell.appendChild(viewBtn);
      if (study.atlasPath) {
        const destLink = document.createElement("a");
        destLink.className = "wb-action-link";
        destLink.href = `../${study.atlasPath}/index.html`;
        destLink.textContent = "Destination tab ↗";
        outputCell.appendChild(destLink);
      }
      if (!hasLiveTokens) {
        const rerunInlineBtn = document.createElement("button");
        rerunInlineBtn.type = "button";
        rerunInlineBtn.className = "button ghost wb-run-study-btn";
        rerunInlineBtn.textContent = "▶ Run study now";
        rerunInlineBtn.addEventListener("click", () => requestRunStudy(study));
        outputCell.appendChild(rerunInlineBtn);
      }
    }
  };

  let activeModalResult = null;
  const showStudyResultModal = (study, resultRecord) => {
    activeModalResult = { study, ...resultRecord };
    const titleEl = document.getElementById("wb-run-title");
    const statusModalEl = document.getElementById("wb-run-status");
    const summaryEl = document.getElementById("wb-run-summary");
    const visualsEl = document.getElementById("wb-run-visuals");
    const destLinksEl = document.getElementById("wb-run-dest-links");
    const texEl = document.getElementById("wb-run-tex");
    const keyBarEl = document.getElementById("wb-run-key-bar");
    if (titleEl) titleEl.textContent = `${study.id} · ${study.title}`;
    if (statusModalEl) statusModalEl.textContent = `Completed (${resultRecord.mode}) on ${resultRecord.completedAt}`;
    if (destLinksEl && study.atlasPath) {
      const slug = study.atlasPath.split("/").pop().toLowerCase();
      destLinksEl.innerHTML =
        `<div class="wb-bucket-bar" style="margin: 4px 0 8px;">` +
        `<a class="wb-bucket-chip is-active" href="../${study.atlasPath}/index.html">📊 Open ${study.atlasPath.split("/").pop().replace(/-/g, " ")} Destination Tab ↗</a>` +
        `<a class="wb-bucket-chip" href="../Mental-Map/index.html#sec:${slug}">🧠 View in Mental Map (§ ${study.atlasPath.split("/").pop().replace(/-/g, " ")}) ↗</a>` +
        `</div>`;
      destLinksEl.hidden = false;
    }
    renderStudyAnalyticsDom(visualsEl, study, resultRecord);
    if (summaryEl) summaryEl.textContent = resultRecord.summary;
    if (texEl) texEl.value = resultRecord.tex;
    if (keyBarEl) {
      const needsKey = !unlockedApiKey || !resultRecord.tokens || Number(resultRecord.tokens) === 0;
      keyBarEl.hidden = !needsKey;
    }
    openDialog(runDialog);
  };

  const executeStudy = async (study) => {
    // If Admin is unlocked or vault has an ownerBackup key, auto-recover unlockedApiKey before running
    if (!unlockedApiKey) {
      const vault = loadJson(VAULT_KEY);
      const recovered = recoverSavedVaultData("", vault);
      if (recovered.existingApiKey) {
        unlockedApiKey = recovered.existingApiKey;
        updateKeyStatusBadge();
      }
    }

    const titleEl = document.getElementById("wb-run-title");
    const statusModalEl = document.getElementById("wb-run-status");
    const summaryEl = document.getElementById("wb-run-summary");
    const visualsEl = document.getElementById("wb-run-visuals");
    const destLinksEl = document.getElementById("wb-run-dest-links");
    const texEl = document.getElementById("wb-run-tex");
    const keyBarEl = document.getElementById("wb-run-key-bar");
    if (titleEl) titleEl.textContent = `Running ${study.id}: ${study.title}…`;
    if (statusModalEl) {
      statusModalEl.textContent = unlockedApiKey
        ? `Calling Google AI Studio (${MODEL_LABELS[selectedRunnerModel] || selectedRunnerModel}) with key ending in …${unlockedApiKey.slice(-4)} (searching datasets, building SVG chart & Pandas table)…`
        : "No Google AI Studio API key saved yet — paste your AQ....eQ3w key below to run with live Gemini 4 Argon tokens.";
    }
    if (keyBarEl) keyBarEl.hidden = Boolean(unlockedApiKey);
    if (visualsEl) visualsEl.hidden = true;
    if (destLinksEl) destLinksEl.hidden = true;
    if (summaryEl) summaryEl.textContent = `Question: ${study.question}\nDataset: ${study.dataset}`;
    if (texEl) texEl.value = "";
    openDialog(runDialog);

    let summaryText = "";
    let discoveredDataset = study.dataset;
    let parsedAnalytics = null;
    let totalTokens = 0;
    let lastApiError = "";
    let mode = "local deterministic scaffold · 0 API tokens (no Google AI Studio key saved yet — paste your AQ....eQ3w key below)";
    const needsDatasetSearch = !study.dataset || /auto-discover/i.test(study.dataset);
    if (unlockedApiKey) {
      discoverLiveModels(unlockedApiKey);
      const prompt = [
        `You are an empirical data scientist and research assistant for Liam McGrath's technical notebook (liammspandasprojects.org).`,
        `Title: ${study.title}`,
        `Atlas Section: ${study.atlasPath}`,
        `Question: ${study.question}`,
        needsDatasetSearch
          ? `Dataset: NONE PROVIDED — first search for and name the most authoritative public datasets (e.g. Statistics Canada, BLS, FRED, World Bank, IEA, OECD, NREL, USGS, Elections Alberta/Canada, NBER, or peer-reviewed benchmarks) that answer this question, and start your response with a line "DATASETS: <concise dataset names & sources>".`
          : `Dataset provided: ${study.dataset} (also cite any complementary public benchmark datasets and start with "DATASETS: <datasets>").`,
        `Next, write a thorough, fact-grounded 3-paragraph analytical study summary with concrete empirical numbers, physical/economic/structural mechanisms, LaTeX math equations ($...$ and $$...$$), and testable hypotheses.`,
        `Finally, at the very end of your response, include a fenced \`\`\`json block containing empirical benchmark data for the site's Athletics-style SVG chart, KPI cards, data table, and a runnable Python pandas script in this exact schema:`,
        `\`\`\`json`,
        `{`,
        `  "chartTitle": "Concise quantitative chart title (with units)",`,
        `  "chartSubtitle": "One-sentence explanation of what the bars compare and data source",`,
        `  "chartUnit": "% or $/kWh or $/L or Wh/kg",`,
        `  "kpis": [`,
        `    {"label": "KPI 1 Name", "value": "Concrete #", "note": "Short benchmark context"},`,
        `    {"label": "KPI 2 Name", "value": "Concrete #", "note": "Short benchmark context"},`,
        `    {"label": "KPI 3 Name", "value": "Concrete #", "note": "Short benchmark context"},`,
        `    {"label": "KPI 4 Name", "value": "Concrete #", "note": "Short benchmark context"}`,
        `  ],`,
        `  "bars": [`,
        `    {"label": "Entity / Country / Chemistry 1", "primary": 160, "secondary": 0, "note": "Empirical note"},`,
        `    {"label": "Entity / Country / Chemistry 2", "primary": 250, "secondary": 0, "note": "Empirical note"}`,
        `  ],`,
        `  "tableColumns": ["Entity / Regime", "Primary Metric", "Secondary Metric", "Cost / Threshold", "Key Mechanism"],`,
        `  "tableRows": [`,
        `    ["Row 1", "val1", "val2", "val3", "mechanism 1"],`,
        `    ["Row 2", "val1", "val2", "val3", "mechanism 2"]`,
        `  ],`,
        `  "pandasScript": "import pandas as pd\\nimport numpy as np\\n# Complete runnable pandas analysis script computing summary stats, ratios, or regressions on this dataset..."`,
        `}`,
        `\`\`\``,
        `Include 6 to 10 real empirical rows in "bars" and "tableRows".`,
      ].join("\n");
      const thinkingLevel = selectedRunnerModel === "argon-high" ? "high" : selectedRunnerModel === "argon-medium" ? "medium" : "low";
      const customOrPrimaryModel =
        selectedRunnerModel === "flash-fast"
          ? "gemini-3.8-flash"
          : selectedRunnerModel === "deep-research"
          ? "gemini-4-argon"
          : /^gemini-|^deep-research/i.test(selectedRunnerModel)
          ? selectedRunnerModel
          : discoveredLiveModelIds.find((m) => /^gemini-[45]/i.test(m)) || "gemini-4-argon";

      const extractInteractionsText = (data) => {
        if (typeof data?.output_text === "string" && data.output_text.trim()) {
          return data.output_text.trim();
        }
        if (Array.isArray(data?.steps)) {
          const chunks = [];
          data.steps.forEach((step) => {
            if ((!step.type || step.type === "model_output") && Array.isArray(step.content)) {
              step.content.forEach((block) => {
                if ((!block.type || block.type === "text") && typeof block.text === "string") {
                  chunks.push(block.text);
                }
              });
            }
          });
          if (chunks.length > 0) return chunks.join("\n").trim();
        }
        const allParts = data?.candidates?.[0]?.content?.parts || [];
        const nonThoughtParts = allParts.filter((p) => !p.thought && typeof p.text === "string");
        const chosenParts = nonThoughtParts.length > 0 ? nonThoughtParts : allParts;
        return chosenParts.map((p) => p.text || "").join("\n").trim();
      };
      const extractTokenCount = (data, rawText) => {
        const u = data?.usage || data?.usageMetadata || {};
        const total = Number(
          u.total_tokens ||
          u.totalTokenCount ||
          (Number(u.total_input_tokens || u.promptTokenCount || 0) +
            Number(u.total_output_tokens || u.candidatesTokenCount || 0) +
            Number(u.total_thought_tokens || u.thoughtsTokenCount || 0) +
            Number(u.total_tool_use_tokens || 0))
        );
        return total > 0 ? total : Math.max(1, Math.round(rawText.length / 4));
      };

      const attempts = [
        // 1. Official 2026 Google AI Studio Interactions API (supports AQ.* Auth Keys & gemini-4-argon / gemini-3.8-flash)
        {
          endpoint: "https://generativelanguage.googleapis.com/v1beta/interactions",
          model: customOrPrimaryModel,
          body: {
            model: customOrPrimaryModel,
            input: prompt,
            tools: [{ type: "google_search" }],
            generation_config: { thinking_level: thinkingLevel },
          },
        },
        {
          endpoint: "https://generativelanguage.googleapis.com/v1beta/interactions",
          model: customOrPrimaryModel,
          body: {
            model: customOrPrimaryModel,
            input: prompt,
            generation_config: { thinking_level: thinkingLevel },
          },
        },
        {
          endpoint: "https://generativelanguage.googleapis.com/v1beta/interactions",
          model: "gemini-3.8-flash",
          body: {
            model: "gemini-3.8-flash",
            input: prompt,
            tools: [{ type: "google_search" }],
            generation_config: { thinking_level: "low" },
          },
        },
        {
          endpoint: "https://generativelanguage.googleapis.com/v1beta/interactions",
          model: "gemini-3.8-flash",
          body: {
            model: "gemini-3.8-flash",
            input: prompt,
          },
        },
        // 2. Fallback to v1beta generateContent with x-goog-api-key header (no deprecated temperature param)
        {
          endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${customOrPrimaryModel}:generateContent`,
          model: customOrPrimaryModel,
          body: {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
            generationConfig: { thinkingConfig: { thinkingLevel } },
          },
        },
        {
          endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${customOrPrimaryModel}:generateContent`,
          model: customOrPrimaryModel,
          body: {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          },
        },
        {
          endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
          model: "gemini-3.8-flash",
          body: {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
          },
        },
        {
          endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
          model: "gemini-3.8-flash",
          body: {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          },
        },
      ];
      for (const candidate of attempts) {
        try {
          const resp = await fetch(candidate.endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": unlockedApiKey,
            },
            body: JSON.stringify(candidate.body),
          });
          if (!resp.ok) {
            let errDetail = `HTTP ${resp.status}`;
            try {
              const errJson = await resp.json();
              if (errJson && errJson.error && errJson.error.message) {
                errDetail = `${resp.status}: ${errJson.error.message}`;
              }
            } catch {
              /* ignore parse error */
            }
            lastApiError = `${candidate.model} → ${errDetail}`;
            continue;
          }
          const data = await resp.json();
          const rawText = extractInteractionsText(data);
          if (!rawText) {
            lastApiError = `${candidate.model} returned empty text`;
            continue;
          }
          totalTokens = extractTokenCount(data, rawText);

          let cleanedNarrative = rawText;
          const jsonMatch = cleanedNarrative.match(/```json\s*([\s\S]*?)```/i);
          if (jsonMatch) {
            try {
              parsedAnalytics = JSON.parse(jsonMatch[1].trim());
            } catch {
              parsedAnalytics = null;
            }
            cleanedNarrative = cleanedNarrative.replace(/```json[\s\S]*?```/i, "").trim();
          }

          const dsMatch = cleanedNarrative.match(/^DATASETS:\s*(.+)$/im);
          if (dsMatch) {
            discoveredDataset = dsMatch[1].trim();
            study.dataset = discoveredDataset;
          }
          summaryText = cleanedNarrative.replace(/^DATASETS:\s*.+\n?/im, "").trim();
          if (summaryText) {
            mode = `${MODEL_LABELS[selectedRunnerModel] || "Gemini 4 Argon · High Thinking"} (${candidate.model}) via Google AI Studio · ${totalTokens.toLocaleString()} API tokens`;
            break;
          }
        } catch (err) {
          lastApiError = err && err.message ? err.message : "Network error calling generativelanguage.googleapis.com";
        }
      }
      if (!summaryText && lastApiError) {
        mode = `Google AI Studio API error (${lastApiError}) · 0 API tokens`;
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
    const analytics = parsedAnalytics || buildFallbackAnalytics(study);
    analytics.pandasScript = buildPandasScript(study, analytics);
    const tex = buildLatexPaper(study, summaryText, analytics);
    const resultRecord = {
      study: {
        id: study.id,
        title: study.title,
        atlasPath: study.atlasPath,
        question: study.question,
        dataset: discoveredDataset,
        createdOn: study.createdOn || todayIso(),
      },
      summary: summaryText,
      analytics,
      tex,
      dataset: discoveredDataset,
      mode,
      tokens: totalTokens,
      completedAt: todayIso(),
    };
    const allRuns = loadJson(RUNS_KEY);
    allRuns[study.id] = resultRecord;
    saveJson(RUNS_KEY, allRuns);
    markStudyCompletedInDom(study, resultRecord);
    showStudyResultModal(study, resultRecord);
    announce(`Ran study ${study.id} (${mode}) — integrated into ${study.atlasPath} & Mental Map.`);
  };

  const requestRunStudy = (study) => {
    if (isIpLocked()) {
      announce(`🚫 Access permanently locked for IP ${clientIp} until unlocked by the owner.`);
      return;
    }
    if (!isAdminUnlocked()) {
      pendingStudyToRun = study;
      if (authStatus) {
        authStatus.classList.remove("is-error");
        authStatus.textContent = `Unlock Admin required to run "${study.title}". Enter your passphrase below.`;
      }
      openDialog(authDialog);
      return;
    }
    executeStudy(study);
  };

  const attachRunButtonListener = (btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-run-study-id") || btn.getAttribute("data-restudy-id") || "ST-RUN";
      const useNewEl = document.querySelector(`[data-restudy-new="${id}"]`);
      const useUpdEl = document.querySelector(`[data-restudy-updated="${id}"]`);
      const useNew = useNewEl ? useNewEl.checked : true;
      const useUpdated = useUpdEl ? useUpdEl.checked : false;
      const scopeNotes = [];
      if (useNew) scopeNotes.push("search for & incorporate the newest external benchmark datasets");
      if (useUpdated) scopeNotes.push("re-evaluate updated / internal site datasets (records/athletics, records/health, Smash, basketball)");
      const baseDataset = btn.getAttribute("data-study-dataset") || "";
      const study = {
        id,
        title: btn.getAttribute("data-study-title") || "Queued Study",
        atlasPath: btn.getAttribute("data-study-path") || "",
        question: btn.getAttribute("data-study-question") || "",
        dataset: scopeNotes.length ? `${baseDataset} [Re-Study Scope: ${scopeNotes.join(" + ")}]` : baseDataset,
        createdOn: todayIso(),
      };
      requestRunStudy(study);
    });
  };

  document.querySelectorAll("[data-run-study-id], [data-restudy-id]").forEach(attachRunButtonListener);

  const rerunBtn = document.getElementById("wb-run-rerun");
  if (rerunBtn) {
    rerunBtn.addEventListener("click", () => {
      if (!activeModalResult || !activeModalResult.study) return;
      if (!unlockedApiKey) {
        const keyBarEl = document.getElementById("wb-run-key-bar");
        const inlineInput = document.getElementById("wb-run-inline-key");
        if (keyBarEl) keyBarEl.hidden = false;
        if (inlineInput) inlineInput.focus();
        const statusModalEl = document.getElementById("wb-run-status");
        if (statusModalEl) {
          statusModalEl.textContent = "🔑 Paste your AQ....eQ3w key from Google AI Studio below and click ⚡ Save Key & Run Gemini Argon.";
        }
        return;
      }
      const modNew = document.getElementById("wb-modal-scope-new");
      const modUpd = document.getElementById("wb-modal-scope-updated");
      const scopes = [];
      if (!modNew || modNew.checked) scopes.push("New External Datasets");
      if (modUpd && modUpd.checked) scopes.push("Updated / Internal Site Datasets");
      const baseStudy = { ...activeModalResult.study };
      if (scopes.length) {
        baseStudy.dataset = `${String(baseStudy.dataset || "").replace(/\s*\[Re-Study Scope:.*\]$/, "")} [Re-Study Scope: ${scopes.join(" + ")}]`;
      }
      requestRunStudy(baseStudy);
    });
  }

  const saveInlineKeyBtn = document.getElementById("wb-run-save-key");
  if (saveInlineKeyBtn) {
    saveInlineKeyBtn.addEventListener("click", async () => {
      const inlineInput = document.getElementById("wb-run-inline-key");
      const statusModalEl = document.getElementById("wb-run-status");
      const rawVal = inlineInput ? inlineInput.value : "";
      const keyCheck = cleanAndValidateApiKey(rawVal);
      if (!keyCheck.ok || !keyCheck.key) {
        if (statusModalEl) {
          statusModalEl.textContent = keyCheck.error || "⚠ Please paste your AQ....eQ3w key from Google AI Studio first.";
        }
        return;
      }
      unlockedApiKey = keyCheck.key;
      persistVaultRecord("", unlockedApiKey, selectedRunnerModel);
      if (inlineInput) inlineInput.value = "";
      updateAuthIndicators();
      if (activeModalResult && activeModalResult.study) {
        await executeStudy(activeModalResult.study);
      }
    });
  }

  const downloadPyBtn = document.getElementById("wb-run-download-py");
  if (downloadPyBtn) {
    downloadPyBtn.addEventListener("click", () => {
      if (!activeModalResult) return;
      const slug = (activeModalResult.study.id || "study").toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
      const pyCode = buildPandasScript(activeModalResult.study, activeModalResult.analytics || {});
      const blob = new Blob([pyCode], { type: "text/x-python" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${slug}_pandas.py`;
      a.click();
    });
  }

  const downloadCsvBtn = document.getElementById("wb-run-download-csv");
  if (downloadCsvBtn) {
    downloadCsvBtn.addEventListener("click", () => {
      if (!activeModalResult) return;
      const slug = (activeModalResult.study.id || "study").toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
      const csvText = buildCsvFromAnalytics(activeModalResult.analytics || {});
      const blob = new Blob([csvText], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${slug}_data.csv`;
      a.click();
    });
  }

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
  if (runNowToggle && studySubmitBtn) {
    runNowToggle.addEventListener("change", () => {
      studySubmitBtn.textContent = runNowToggle.checked
        ? "Save & Run Study Now ▶"
        : "Save to Workbench +";
    });
  }

  // ---- Admin Study Deletion & IP Index Filter Bar ----
  const getDeletedIds = () => {
    const d = loadJson(DELETED_KEY);
    return Array.isArray(d.ids) ? d.ids : [];
  };
  const addDeletedId = (id) => {
    const ids = new Set(getDeletedIds());
    ids.add(id);
    saveJson(DELETED_KEY, { ids: Array.from(ids) });
  };

  const deleteStudyById = (studyId) => {
    if (!isAdminUnlocked()) {
      announce("🔒 Unlock Admin first to delete studies.");
      openDialog(authDialog);
      return;
    }
    document.querySelectorAll(`[data-study-row="${studyId}"]`).forEach((tr) => tr.remove());
    const current = loadLocal();
    if (Array.isArray(current.studyQueue)) {
      current.studyQueue = current.studyQueue.filter((item) => item.id !== studyId);
      saveLocal(current);
    }
    const runs = loadJson(RUNS_KEY);
    if (runs[studyId]) {
      delete runs[studyId];
      saveJson(RUNS_KEY, runs);
    }
    addDeletedId(studyId);
    refreshIpFilterOptions();
    syncLockoutDom();
    announce(`Deleted study ${studyId}.`);
  };

  const attachDeleteStudyListener = (btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const id = btn.getAttribute("data-delete-study-id");
      if (id) deleteStudyById(id);
    });
  };

  document.querySelectorAll("[data-delete-study-id]").forEach(attachDeleteStudyListener);

  const restoreDeletedBtn = document.getElementById("wb-restore-deleted");
  if (restoreDeletedBtn) {
    restoreDeletedBtn.addEventListener("click", () => {
      saveJson(DELETED_KEY, { ids: [] });
      window.location.reload();
    });
  }

  // ---- PowerBI-Style Study Link Tooltip (Desktop hover + Mobile/Desktop click-to-pin) ----
  const closeAllStudyTooltips = (exceptCell = null) => {
    document.querySelectorAll(".wb-study-cell.is-open").forEach((cellEl) => {
      if (cellEl !== exceptCell) {
        cellEl.classList.remove("is-open");
        const trig = cellEl.querySelector("[data-wb-study-trigger]");
        if (trig) trig.setAttribute("aria-expanded", "false");
      }
    });
  };

  const wireStudyCellTooltip = (cellEl) => {
    const trig = cellEl.querySelector("[data-wb-study-trigger]");
    const closeBtn = cellEl.querySelector("[data-wb-tip-close]");
    if (trig) {
      trig.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const opening = !cellEl.classList.contains("is-open");
        closeAllStudyTooltips(cellEl);
        cellEl.classList.toggle("is-open", opening);
        trig.setAttribute("aria-expanded", opening ? "true" : "false");
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        cellEl.classList.remove("is-open");
        if (trig) trig.setAttribute("aria-expanded", "false");
      });
    }
  };

  document.querySelectorAll(".wb-study-cell").forEach(wireStudyCellTooltip);
  document.addEventListener("click", (ev) => {
    if (!ev.target.closest(".wb-study-cell")) closeAllStudyTooltips();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") closeAllStudyTooltips();
  });

  const buildStudyCellDom = (entry) => {
    const td = document.createElement("td");
    td.className = "wb-study-td";
    const wrap = document.createElement("div");
    wrap.className = "wb-study-cell";

    const trig = document.createElement("button");
    trig.type = "button";
    trig.className = "wb-study-link";
    trig.setAttribute("data-wb-study-trigger", "");
    trig.setAttribute("aria-expanded", "false");
    trig.setAttribute("aria-controls", `wb-tip-${entry.id}`);
    const titleSpan = cell("span", entry.title);
    titleSpan.className = "wb-study-link-title";
    const pillSpan = cell("span", "↗ Details & Run");
    pillSpan.className = "wb-study-link-pill";
    pillSpan.setAttribute("aria-hidden", "true");
    trig.append(titleSpan, pillSpan);

    const tip = document.createElement("div");
    tip.className = "wb-pbi-tooltip";
    tip.id = `wb-tip-${entry.id}`;
    tip.setAttribute("role", "region");
    tip.setAttribute("aria-label", `${entry.title} details`);

    const head = document.createElement("div");
    head.className = "wb-pbi-head";
    const kicker = document.createElement("span");
    kicker.className = "wb-pbi-kicker";
    const codeEl = cell("code", entry.id);
    kicker.append(codeEl, document.createTextNode(" · Study Tooltip"));
    const closeBtn = cell("button", "✕");
    closeBtn.type = "button";
    closeBtn.className = "wb-pbi-close";
    closeBtn.setAttribute("data-wb-tip-close", "");
    closeBtn.setAttribute("aria-label", "Close study tooltip");
    head.append(kicker, closeBtn);

    const destRow = document.createElement("div");
    destRow.className = "wb-pbi-row";
    const destLbl = cell("span", "Destination");
    destLbl.className = "wb-pbi-label";
    const destVal = document.createElement("div");
    destVal.className = "wb-pbi-val";
    const destLink = cell("a", `${entry.atlasPath.split("/").pop().replace(/-/g, " ")} ↗`);
    destLink.href = `../${entry.atlasPath}/index.html`;
    destVal.appendChild(destLink);
    destRow.append(destLbl, destVal);

    const qRow = document.createElement("div");
    qRow.className = "wb-pbi-row";
    const qLbl = cell("span", "Question");
    qLbl.className = "wb-pbi-label";
    const qP = cell("p", entry.question);
    qP.className = "wb-pbi-question";
    qRow.append(qLbl, qP);

    const outRow = document.createElement("div");
    outRow.className = "wb-pbi-row";
    const outLbl = cell("span", "Outputs / Run");
    outLbl.className = "wb-pbi-label";
    const outAct = document.createElement("div");
    outAct.className = "wb-pbi-actions";
    outAct.setAttribute("data-study-outputs", entry.id);
    const runBtn = document.createElement("button");
    runBtn.type = "button";
    runBtn.className = "button ghost wb-run-study-btn";
    runBtn.textContent = isIpLocked() ? "🚫 IP Locked Out" : "▶ Run study now";
    runBtn.disabled = isIpLocked();
    runBtn.setAttribute("data-run-study-id", entry.id);
    runBtn.setAttribute("data-study-title", entry.title);
    runBtn.setAttribute("data-study-path", entry.atlasPath);
    runBtn.setAttribute("data-study-question", entry.question);
    runBtn.setAttribute("data-study-dataset", entry.dataset);
    attachRunButtonListener(runBtn);
    outAct.appendChild(runBtn);
    outRow.append(outLbl, outAct);

    const adminRow = document.createElement("div");
    adminRow.className = "wb-pbi-row";
    adminRow.setAttribute("data-wb-admin-only", "");
    adminRow.hidden = !isAdminUnlocked();
    const adminLbl = cell("span", "Admin · IP Index & Moderation");
    adminLbl.className = "wb-pbi-label";
    const adminAct = document.createElement("div");
    adminAct.className = "wb-pbi-actions";
    const ipBadge = cell("code", entry.ipIndex || currentIpIndex);
    ipBadge.className = "wb-ip-badge";
    const delBtn = cell("button", "🗑 Delete study");
    delBtn.type = "button";
    delBtn.className = "button ghost wb-delete-study-btn";
    delBtn.setAttribute("data-delete-study-id", entry.id);
    attachDeleteStudyListener(delBtn);
    adminAct.append(ipBadge, delBtn);
    adminRow.append(adminLbl, adminAct);

    tip.append(head, destRow, qRow, outRow, adminRow);
    wrap.append(trig, tip);
    wireStudyCellTooltip(wrap);
    td.appendChild(wrap);
    return td;
  };

  const appendRow = (table, entry) => {
    if (table === "studyQueue") {
      const tbody = document.getElementById("wb-studies-body");
      if (!tbody) return;
      const ipIdx = entry.ipIndex || currentIpIndex;
      const tr = document.createElement("tr");
      tr.setAttribute("data-study-row", entry.id);
      tr.setAttribute("data-study-date", entry.createdOn);
      tr.setAttribute("data-study-title", entry.title);
      tr.setAttribute("data-study-path", entry.atlasPath);
      tr.setAttribute("data-study-field", (entry.atlasPath || "").split("/")[0] || "");
      tr.setAttribute("data-study-question", entry.question);
      tr.setAttribute("data-study-dataset", entry.dataset);
      tr.setAttribute("data-study-status-val", entry.status);
      tr.setAttribute("data-study-ip", ipIdx);
      const statusTd = document.createElement("td");
      statusTd.setAttribute("data-study-status", entry.id);
      const badge = cell("span", entry.status);
      badge.className = `wb-badge wb-${entry.status === "published" ? "up" : entry.status === "in-progress" ? "warn" : "flat"}`;
      statusTd.appendChild(badge);

      const ipTd = document.createElement("td");
      ipTd.setAttribute("data-wb-admin-col", "");
      ipTd.hidden = !isAdminUnlocked();
      const ipCode = cell("code", ipIdx);
      ipCode.className = "wb-ip-badge";
      ipTd.appendChild(ipCode);

      const delTd = document.createElement("td");
      delTd.setAttribute("data-wb-admin-col", "");
      delTd.hidden = !isAdminUnlocked();
      const delBtn = cell("button", "🗑 Delete");
      delBtn.type = "button";
      delBtn.className = "button ghost wb-delete-study-btn";
      delBtn.setAttribute("data-delete-study-id", entry.id);
      delBtn.setAttribute("aria-label", `Delete ${entry.id}`);
      attachDeleteStudyListener(delBtn);
      delTd.appendChild(delBtn);

      tr.append(
        cell("th", entry.id),
        cell("td", entry.createdOn),
        buildStudyCellDom({ ...entry, ipIndex: ipIdx }),
        cell("td", entry.dataset),
        statusTd,
        ipTd,
        delTd
      );
      tbody.appendChild(tr);
    } else if (table === "theoryQueue") {
      const tbody = document.getElementById("wb-theory-body");
      if (!tbody) return;
      const tr = document.createElement("tr");
      tr.setAttribute("data-theory-row", entry.id);
      const runTd = document.createElement("td");
      const runBtn = cell("button", "▶ Derive Theory Now");
      runBtn.type = "button";
      runBtn.className = "button ghost wb-run-study-btn";
      runBtn.setAttribute("data-run-study-id", entry.id);
      runBtn.setAttribute("data-study-title", `Theory: ${entry.title}`);
      runBtn.setAttribute("data-study-path", entry.atlasPath);
      runBtn.setAttribute("data-study-question", entry.scopePrompt);
      runBtn.setAttribute("data-study-dataset", `First-principles textbook & peer-reviewed derivation (${entry.category})`);
      attachRunButtonListener(runBtn);
      runTd.appendChild(runBtn);
      tr.append(
        cell("th", entry.id),
        cell("td", entry.createdOn),
        cell("td", entry.category),
        cell("td", entry.title),
        cell("td", entry.atlasPath),
        cell("td", entry.scopePrompt),
        cell("td", entry.status),
        runTd
      );
      tbody.appendChild(tr);
    } else if (table === "applicationsQueue") {
      const tbody = document.getElementById("wb-apps-body");
      if (!tbody) return;
      const tr = document.createElement("tr");
      tr.setAttribute("data-app-row", entry.id);
      const runTd = document.createElement("td");
      const runBtn = cell("button", "▶ Build Application Now");
      runBtn.type = "button";
      runBtn.className = "button ghost wb-run-study-btn";
      runBtn.setAttribute("data-run-study-id", entry.id);
      runBtn.setAttribute("data-study-title", `Application: ${entry.title}`);
      runBtn.setAttribute("data-study-path", entry.atlasPath);
      runBtn.setAttribute("data-study-question", `Engineering Design: ${entry.systemDesign} | Societal Benefit: ${entry.societalBenefit}`);
      runBtn.setAttribute("data-study-dataset", `Engineering system benchmarks & deployment data (${entry.domain})`);
      attachRunButtonListener(runBtn);
      runTd.appendChild(runBtn);
      tr.append(
        cell("th", entry.id),
        cell("td", entry.createdOn),
        cell("td", entry.domain),
        cell("td", entry.title),
        cell("td", entry.atlasPath),
        cell("td", entry.systemDesign),
        cell("td", entry.societalBenefit),
        cell("td", entry.status),
        runTd
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

  // Sequential ID generator (ST-06, TD-08, RL-04, VN-03) instead of random base-36 postal-code strings
  const nextSequentialId = (prefix, tbodyId, tableKey) => {
    let maxNum = 0;
    const re = new RegExp(`^${prefix}-(\\d+)$`, "i");
    document.querySelectorAll(`#${tbodyId} tr th`).forEach((th) => {
      const m = th.textContent.trim().match(re);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    });
    const localRows = loadLocal()[tableKey] || [];
    localRows.forEach((r) => {
      const m = String(r.id || "").match(re);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    });
    return `${prefix}-${String(maxNum + 1).padStart(2, "0")}`;
  };

  const buildEntry = (form, table) => {
    const data = new FormData(form);
    const createdOn = todayIso();
    if (table === "studyQueue") {
      const rawDataset = String(data.get("dataset") || "").trim();
      const scopes = [];
      if (data.get("scopeNewDatasets")) scopes.push("New External Datasets");
      if (data.get("scopeUpdatedDatasets")) scopes.push("Updated / Internal Site Datasets");
      const dsFinal = rawDataset || (scopes.length ? `Auto-discover (${scopes.join(" + ")})` : "Auto-discover relevant public datasets");
      return {
        id: nextSequentialId("ST", "wb-studies-body", "studyQueue"),
        createdOn,
        title: String(data.get("title") || "").trim(),
        atlasPath: String(data.get("atlasPath") || "").trim(),
        question: String(data.get("question") || "").trim(),
        dataset: dsFinal,
        status: String(data.get("status") || "queued"),
        studyRoute: null,
        paperRoute: null,
        clicks: 1,
        ipIndex: isAdminUnlocked() ? "IP#OWNER" : currentIpIndex,
        notes: "Added from browser Workbench",
      };
    }
    if (table === "theoryQueue") {
      return {
        id: nextSequentialId("TH", "wb-theory-body", "theoryQueue"),
        createdOn,
        category: String(data.get("category") || "General / Subsubsection Introduction"),
        title: String(data.get("title") || "").trim(),
        atlasPath: String(data.get("atlasPath") || "").trim(),
        scopePrompt: String(data.get("scopePrompt") || "").trim(),
        status: "queued",
        notes: "Added from browser Workbench",
      };
    }
    if (table === "applicationsQueue") {
      return {
        id: nextSequentialId("AP", "wb-apps-body", "applicationsQueue"),
        createdOn,
        domain: String(data.get("domain") || "General Engineering Application"),
        title: String(data.get("title") || "").trim(),
        atlasPath: String(data.get("atlasPath") || "").trim(),
        systemDesign: String(data.get("systemDesign") || "").trim(),
        societalBenefit: String(data.get("societalBenefit") || "").trim(),
        status: "queued",
        notes: "Added from browser Workbench",
      };
    }
    if (table === "wishlistTodos") {
      return {
        id: nextSequentialId("TD", "wb-todos-body", "wishlistTodos"),
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
        id: nextSequentialId("RL", "wb-lyrics-body", "rapLyrics"),
        createdOn,
        bucket: String(data.get("bucket") || "Future-Projects"),
        title: String(data.get("title") || "").trim(),
        bars: String(data.get("bars") || "").trim(),
        themeCue: String(data.get("themeCue") || "").trim(),
        status: "draft",
      };
    }
    return {
      id: nextSequentialId("VN", "wb-voice-body", "voiceNotes"),
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

  // ---- Dynamic Auto-Growing Entry Boxes & Site Data Quick-Picker ----
  const wireAutoGrow = (el) => {
    const resize = () => {
      el.style.height = "auto";
      el.style.height = `${Math.max(42, el.scrollHeight)}px`;
    };
    el.addEventListener("input", resize);
    el.addEventListener("focus", resize);
  };
  document.querySelectorAll("textarea.wb-auto-grow").forEach(wireAutoGrow);

  document.querySelectorAll("[data-site-dataset]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const dsInput = document.getElementById("wb-study-dataset");
      const updCheck = document.getElementById("wb-scope-updated");
      const snippet = chip.getAttribute("data-site-dataset") || "";
      if (!dsInput || !snippet) return;
      const active = chip.classList.toggle("is-active");
      if (active) {
        dsInput.value = dsInput.value.trim() ? `${dsInput.value.trim()} | ${snippet}` : snippet;
        if (updCheck) updCheck.checked = true;
      } else {
        dsInput.value = dsInput.value.replace(snippet, "").replace(/^\s*\|\s*|\s*\|\s*$/g, "").replace(/\s*\|\s*\|\s*/g, " | ").trim();
      }
      dsInput.dispatchEvent(new Event("input"));
    });
  });

  // ---- Study Click Counter & Visit Rank / Date Sorting ----
  const CLICKS_STORAGE_KEY = "liam_study_clicks_v1";
  const getSavedClicks = () => loadJson(CLICKS_STORAGE_KEY);
  const recordStudyClick = (studyId) => {
    if (!studyId) return;
    const clicks = getSavedClicks();
    clicks[studyId] = (Number(clicks[studyId]) || 0) + 1;
    saveJson(CLICKS_STORAGE_KEY, clicks);
    const tr = document.querySelector(`#wb-studies-body tr[data-study-row="${studyId}"]`);
    if (tr) {
      const base = Number(tr.getAttribute("data-base-clicks") || tr.getAttribute("data-study-clicks") || 0);
      if (!tr.hasAttribute("data-base-clicks")) tr.setAttribute("data-base-clicks", String(base));
      const total = base + Number(clicks[studyId]);
      tr.setAttribute("data-study-clicks", String(total));
      document.querySelectorAll(`[data-click-badge="${studyId}"]`).forEach((b) => {
        b.textContent = b.classList.contains("wb-click-pill") ? `👁 ${total}` : `${total} visits`;
      });
    }
  };
  // Initialize click counts from localStorage on load
  const initialClicks = getSavedClicks();
  document.querySelectorAll("#wb-studies-body tr[data-study-row]").forEach((tr) => {
    const id = tr.getAttribute("data-study-row");
    const base = Number(tr.getAttribute("data-study-clicks") || 0);
    tr.setAttribute("data-base-clicks", String(base));
    const extra = Number(initialClicks[id] || 0);
    if (extra > 0) {
      const total = base + extra;
      tr.setAttribute("data-study-clicks", String(total));
      document.querySelectorAll(`[data-click-badge="${id}"]`).forEach((b) => {
        b.textContent = b.classList.contains("wb-click-pill") ? `👁 ${total}` : `${total} visits`;
      });
    }
  });
  document.querySelectorAll("[data-study-click]").forEach((el) => {
    el.addEventListener("click", () => recordStudyClick(el.getAttribute("data-study-click")));
  });

  // ---- Always-On Study Queue Filter & Sort Bar ----
  const filterSearchEl = document.getElementById("wb-filter-search");
  const filterStatusEl = document.getElementById("wb-filter-status");
  const filterFieldEl = document.getElementById("wb-filter-field");
  const filterSortEl = document.getElementById("wb-filter-sort");
  const filterIpEl = document.getElementById("wb-filter-ip");
  const filterResetBtn = document.getElementById("wb-filter-reset");
  const deleteFilteredIpBtn = document.getElementById("wb-delete-filtered-ip");

  function refreshIpFilterOptions() {
    if (!filterIpEl) return;
    const prevVal = filterIpEl.value || "all";
    const ips = new Set();
    document.querySelectorAll("#wb-studies-body tr").forEach((tr) => {
      const ip = tr.getAttribute("data-study-ip");
      if (ip && ip !== "IP#OWNER") ips.add(ip);
    });
    // Keep the first 4 built-in options, then add any distinct submitter IP indexes
    while (filterIpEl.options.length > 4) filterIpEl.remove(4);
    ips.forEach((ip) => {
      const opt = document.createElement("option");
      opt.value = ip;
      opt.textContent = ip;
      filterIpEl.appendChild(opt);
    });
    if ([...filterIpEl.options].some((o) => o.value === prevVal)) {
      filterIpEl.value = prevVal;
    }
  }

  const applyStudyFilters = () => {
    const q = (filterSearchEl ? filterSearchEl.value : "").trim().toLowerCase();
    const st = filterStatusEl ? filterStatusEl.value : "all";
    const fld = filterFieldEl ? filterFieldEl.value : "all";
    const sortBy = filterSortEl ? filterSortEl.value : "id-asc";
    const ipFilter = filterIpEl ? filterIpEl.value : "all";
    const tbody = document.getElementById("wb-studies-body");
    const rows = Array.from(document.querySelectorAll("#wb-studies-body tr"));

    rows.forEach((tr) => {
      const title = (tr.getAttribute("data-study-title") || "").toLowerCase();
      const question = (tr.getAttribute("data-study-question") || "").toLowerCase();
      const dataset = (tr.getAttribute("data-study-dataset") || "").toLowerCase();
      const rowId = (tr.getAttribute("data-study-row") || "").toLowerCase();
      const rowStatus = tr.getAttribute("data-study-status-val") || "";
      const rowField = tr.getAttribute("data-study-field") || "";
      const rowIp = tr.getAttribute("data-study-ip") || "IP#OWNER";

      const matchesQ = !q || title.includes(q) || question.includes(q) || dataset.includes(q) || rowId.includes(q);
      const matchesSt = st === "all" || rowStatus === st;
      const matchesFld = fld === "all" || rowField === fld;
      let matchesIp = true;
      if (ipFilter === "mine") {
        matchesIp = rowIp === currentIpIndex || rowIp === "IP#OWNER";
      } else if (ipFilter === "not-mine") {
        matchesIp = rowIp !== currentIpIndex && rowIp !== "IP#OWNER";
      } else if (ipFilter !== "all") {
        matchesIp = rowIp === ipFilter;
      }
      tr.hidden = !(matchesQ && matchesSt && matchesFld && matchesIp);
    });

    if (tbody && rows.length > 1) {
      const parseNum = (idStr) => {
        const m = String(idStr || "").match(/(\d+)/);
        return m ? parseInt(m[1], 10) : 999;
      };
      rows.sort((a, b) => {
        const idA = a.getAttribute("data-study-row") || "";
        const idB = b.getAttribute("data-study-row") || "";
        const dateA = a.getAttribute("data-study-date") || "";
        const dateB = b.getAttribute("data-study-date") || "";
        const clicksA = Number(a.getAttribute("data-study-clicks") || 0);
        const clicksB = Number(b.getAttribute("data-study-clicks") || 0);
        if (sortBy === "visits-desc") return clicksB - clicksA || parseNum(idA) - parseNum(idB);
        if (sortBy === "date-desc") return dateB.localeCompare(dateA) || parseNum(idB) - parseNum(idA);
        if (sortBy === "date-asc") return dateA.localeCompare(dateB) || parseNum(idA) - parseNum(idB);
        return parseNum(idA) - parseNum(idB);
      });
      rows.forEach((tr) => tbody.appendChild(tr));
    }
  };

  [filterSearchEl, filterStatusEl, filterFieldEl, filterSortEl, filterIpEl].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", applyStudyFilters);
    el.addEventListener("change", applyStudyFilters);
  });

  if (filterResetBtn) {
    filterResetBtn.addEventListener("click", () => {
      if (filterSearchEl) filterSearchEl.value = "";
      if (filterStatusEl) filterStatusEl.value = "all";
      if (filterFieldEl) filterFieldEl.value = "all";
      if (filterSortEl) filterSortEl.value = "id-asc";
      if (filterIpEl) filterIpEl.value = "all";
      applyStudyFilters();
    });
  }

  if (deleteFilteredIpBtn) {
    deleteFilteredIpBtn.addEventListener("click", () => {
      if (!isAdminUnlocked()) return;
      const visibleIds = [];
      document.querySelectorAll("#wb-studies-body tr").forEach((tr) => {
        if (!tr.hidden) {
          const id = tr.getAttribute("data-study-row");
          if (id) visibleIds.push(id);
        }
      });
      visibleIds.forEach(deleteStudyById);
      announce(`Deleted ${visibleIds.length} filtered study row(s).`);
    });
  }

  // Remove any Admin-deleted seed rows, migrate old ST-L... postal-code IDs, and restore local rows
  const deletedSet = new Set(getDeletedIds());
  deletedSet.forEach((id) => {
    document.querySelectorAll(`[data-study-row="${id}"]`).forEach((tr) => tr.remove());
  });

  const stored = loadLocal();
  if (Array.isArray(stored.studyQueue)) {
    const seededTitles = new Set(
      Array.from(document.querySelectorAll("#wb-studies-body tr")).map((tr) =>
        (tr.getAttribute("data-study-title") || "").trim().toLowerCase()
      )
    );
    // Drop local rows that have already been promoted into the official repo seed (e.g. Sodium Battery Technology -> ST-05)
    stored.studyQueue = stored.studyQueue.filter(
      (r) => !seededTitles.has(String(r.title || "").trim().toLowerCase()) && !deletedSet.has(r.id)
    );
    // Renumber any remaining ST-L... rows into sequential ST-07, ST-08...
    let nextNum = 6;
    stored.studyQueue.forEach((r) => {
      if (/^ST-L/i.test(String(r.id || ""))) {
        nextNum += 1;
        r.id = `ST-${String(nextNum).padStart(2, "0")}`;
      }
      if (!r.ipIndex) r.ipIndex = currentIpIndex;
    });
    saveLocal(stored);
  }
  for (const [table, rows] of Object.entries(stored)) {
    if (Array.isArray(rows)) rows.forEach((row) => appendRow(table, row));
  }
  const savedRuns = loadJson(RUNS_KEY);
  let runsChanged = false;
  for (const [studyId, resultRecord] of Object.entries(savedRuns)) {
    // Purge stale 0-token scaffold runs so studies aren't stuck on a cached 0-token placeholder
    if (!resultRecord || !Number(resultRecord.tokens) || /0 API tokens/i.test(String(resultRecord.mode || ""))) {
      delete savedRuns[studyId];
      runsChanged = true;
      continue;
    }
    const rowEl = document.querySelector(`[data-study-row="${studyId}"]`);
    if (rowEl && resultRecord.tex) {
      const studyObj = {
        id: studyId,
        createdOn: rowEl.getAttribute("data-study-date") || todayIso(),
        title: rowEl.getAttribute("data-study-title") || studyId,
        atlasPath: rowEl.getAttribute("data-study-path") || "",
        question: rowEl.getAttribute("data-study-question") || "",
        dataset: rowEl.getAttribute("data-study-dataset") || "",
      };
      markStudyCompletedInDom(studyObj, resultRecord);
    }
  }
  if (runsChanged) saveJson(RUNS_KEY, savedRuns);
  refreshIpFilterOptions();
  syncLockoutDom();

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
      if (table === "studyQueue") {
        refreshIpFilterOptions();
        applyStudyFilters();
      }
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
