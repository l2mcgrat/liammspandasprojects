/* The vault in the browser. It asks for the passphrase, unwraps the content key from
   assets/vault/keyring.json and decrypts sealed pages and records in place. Until then the
   page, and the site, hold only ciphertext. The Python side is site_content/vault.py. */
(() => {
  "use strict";
  const ASSETS = new URL(".", document.currentScript.src);
  const SESSION = "liam_vault_session_v1";
  const LINES = "liam_vault_lines_v1";
  const DEVICE = "liam_vault_device_v1";
  const SHORT = 30 * 60 * 1000;
  const LONG = 30 * 24 * 60 * 60 * 1000;
  const MAX_LINE = 3800; // ntfy refuses bodies over 4,096 bytes
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const fromB64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  const toB64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let out = "";
    for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(out);
  };

  let ringPromise = null;
  let aesKey = null;
  let signKey = null;
  const listeners = new Set();
  const supported = Boolean(window.crypto && crypto.subtle);

  const keyring = () => {
    if (!ringPromise) {
      ringPromise = fetch(new URL("vault/keyring.json", ASSETS), { cache: "no-cache" }).then((r) => {
        if (!r.ok) throw new Error("The vault keyring is missing from this site.");
        return r.json();
      });
      ringPromise.catch(() => { ringPromise = null; });
    }
    return ringPromise;
  };
  const open = async (blob, aad) => new Uint8Array(await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(blob.iv), additionalData: enc.encode(aad) }, aesKey, fromB64(blob.ct)));
  const seal = async (bytes, aad) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(aad) }, aesKey, bytes);
    return { iv: toB64(iv), ct: toB64(ct) };
  };

  // Opening the sealed signing key proves the content key is the right one.
  const adopt = async (raw) => {
    const ring = await keyring();
    const previous = aesKey;
    aesKey = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
    try {
      const pkcs8 = await open(ring.signing.sealedPrivate, "keyring/signing");
      signKey = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    } catch (error) {
      aesKey = previous;
      throw error;
    }
  };
  const readSession = () => {
    try {
      const rec = JSON.parse(localStorage.getItem(SESSION) || "null");
      if (rec && rec.k && rec.exp > Date.now()) return rec;
    } catch { /* fall through */ }
    try { localStorage.removeItem(SESSION); } catch { /* storage unavailable */ }
    return null;
  };
  const announce = () => listeners.forEach((fn) => { try { fn(Boolean(aesKey)); } catch (error) { console.error(error); } });

  const unlock = async (passphrase, remember) => {
    const ring = await keyring();
    const material = await crypto.subtle.importKey("raw", enc.encode(String(passphrase).trim()), "PBKDF2", false, ["deriveKey"]);
    const kek = await crypto.subtle.deriveKey(
      { name: "PBKDF2", hash: ring.kdf.hash, salt: fromB64(ring.kdf.salt), iterations: ring.kdf.iterations },
      material, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    let raw;
    try {
      raw = new Uint8Array(await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromB64(ring.wrappedKey.iv), additionalData: enc.encode("keyring/wrappedKey") }, kek, fromB64(ring.wrappedKey.ct)));
    } catch {
      throw new Error("That passphrase does not open the vault.");
    }
    await adopt(raw);
    try {
      localStorage.setItem(SESSION, JSON.stringify({ k: toB64(raw), exp: Date.now() + (remember ? LONG : SHORT) }));
    } catch { /* stays unlocked for this page only */ }
    announce();
  };
  const lock = () => {
    try { localStorage.removeItem(SESSION); } catch { /* nothing stored */ }
    window.location.reload();
  };

  // ---- Sealed page fragments -------------------------------------------------------------
  const fillSlots = async () => {
    for (const slot of document.querySelectorAll("[data-vault-slot]")) {
      if (slot.dataset.vaultState === "open") continue;
      try {
        const response = await fetch(new URL(slot.dataset.vaultSrc, window.location.href), { cache: "no-cache" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = dec.decode(await open(await response.json(), `page/${slot.dataset.vaultSlot}`));
        slot.innerHTML = html; // authenticated by AES-GCM: only content sealed with the owner's key gets here
        slot.dataset.vaultState = "open";
      } catch (error) {
        slot.dataset.vaultState = "error";
        const note = slot.querySelector("[data-vault-message]");
        if (note) note.textContent = "This section could not be opened. It may have been sealed with a different key; rebuild the site.";
        console.error("vault slot", slot.dataset.vaultSlot, error);
      }
    }
  };

  // ---- Unlock dialog and status chip -----------------------------------------------------
  let dialog = null;
  const el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([name, value]) => {
      if (value === false || value == null) return;
      if (name === "class") node.className = value;
      else if (name === "text") node.textContent = value;
      else if (name.startsWith("on")) node.addEventListener(name.slice(2), value);
      else node.setAttribute(name, value === true ? "" : value);
    });
    children.flat().forEach((child) => { if (child != null && child !== false) node.append(child); });
    return node;
  };
  const showDialog = () => {
    if (!supported) {
      window.alert("This browser cannot open the vault: it needs a secure (https) page and Web Crypto.");
      return;
    }
    if (!dialog) {
      const input = el("input", { type: "password", autocomplete: "current-password", autocapitalize: "off", autocorrect: "off", spellcheck: "false", required: true });
      const remember = el("input", { type: "checkbox", checked: true });
      const error = el("p", { class: "vault-error", role: "alert", hidden: true });
      const submit = el("button", { class: "button primary", type: "submit", text: "Unlock" });
      const form = el("form", {
        onsubmit: async (event) => {
          event.preventDefault();
          submit.disabled = true;
          submit.textContent = "Unlocking…";
          error.hidden = true;
          try {
            await unlock(input.value, remember.checked);
            input.value = "";
            dialog.close();
          } catch (problem) {
            error.textContent = problem.message || "The vault could not be opened.";
            error.hidden = false;
          }
          submit.disabled = false;
          submit.textContent = "Unlock";
        },
      },
      el("h2", { text: "Unlock the vault" }),
      el("p", { text: "Finances, work time, the time tracker and the connections web are encrypted. The passphrase decrypts them in this browser; it is never sent anywhere." }),
      el("label", {}, "Vault passphrase", input),
      el("label", { class: "vault-remember" }, remember, " Keep this device unlocked for 30 days (otherwise 30 minutes)"),
      error,
      el("div", { class: "toolbar" }, submit, el("button", { class: "button ghost", type: "button", text: "Cancel", onclick: () => dialog.close() })));
      dialog = el("dialog", { class: "vault-dialog", "aria-label": "Unlock the vault" }, form);
      document.body.append(dialog);
    }
    dialog.showModal();
    dialog.querySelector("input[type=password]").focus();
  };
  let chip = null;
  const showChip = (unlocked) => {
    if (!unlocked || chip) return;
    chip = el("div", { class: "vault-chip" }, "🔓 Vault open ", el("button", { type: "button", text: "Lock", onclick: lock }));
    document.body.append(chip);
  };
  document.addEventListener("click", (event) => {
    const target = event.target && event.target.closest ? event.target.closest("[data-vault-unlock], [data-vault-lock]") : null;
    if (!target) return;
    event.preventDefault();
    if (target.hasAttribute("data-vault-lock")) lock();
    else showDialog();
  });

  // ---- Encrypted records (time tracker, connections web) ---------------------------------
  // Each change is one record: sealed, signed, kept on this device, posted to ntfy, and stored
  // in the repository by the hourly workflow. A record leaves the outbox only once the
  // repository copy contains it, so a missed post is sent again on the next visit.
  const records = (() => {
    const lines = new Map(); // id -> sealed line
    const events = new Map(); // id -> decrypted record
    const stored = new Set(); // ids present in the repository log
    const changed = new Set();
    let lastSync = null;
    let lastError = "";
    const device = (() => {
      try {
        let id = localStorage.getItem(DEVICE);
        if (!id) {
          id = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("");
          localStorage.setItem(DEVICE, id);
        }
        return id;
      } catch {
        return "nostore";
      }
    })();
    const save = () => {
      try { localStorage.setItem(LINES, JSON.stringify([...lines.values()])); } catch { lastError = "This device's storage is full; records are kept only until the page closes."; }
    };
    const absorb = async (line) => {
      if (!line || typeof line.id !== "string" || lines.has(line.id)) return false;
      try {
        const record = JSON.parse(dec.decode(await open(line, `event/${line.id}`)));
        if (record.id !== line.id) return false;
        lines.set(line.id, { id: line.id, iv: line.iv, ct: line.ct, sig: line.sig });
        events.set(line.id, record);
        return true;
      } catch {
        return false; // not sealed with this vault's key
      }
    };
    const post = async (line) => {
      const ring = await keyring();
      const response = await fetch(`https://ntfy.sh/${ring.events.topic}`, { method: "POST", body: JSON.stringify(line) });
      if (!response.ok) throw new Error(`ntfy answered ${response.status}`);
    };
    const notify = () => changed.forEach((fn) => { try { fn(); } catch (error) { console.error(error); } });
    const loadLocal = async () => {
      let kept = [];
      try { kept = JSON.parse(localStorage.getItem(LINES) || "[]") || []; } catch { kept = []; }
      for (const line of kept) await absorb(line);
    };
    const refresh = async () => {
      const ring = await keyring();
      lastError = "";
      const onRelay = new Set();
      try {
        const response = await fetch(ring.events.log, { cache: "no-cache" });
        if (response.ok) {
          for (const text of (await response.text()).split("\n")) {
            if (!text.trim()) continue;
            try {
              const line = JSON.parse(text);
              stored.add(line.id);
              await absorb(line);
            } catch { /* skip a damaged line */ }
          }
        } else if (response.status !== 404) {
          lastError = `The stored copy answered ${response.status}.`;
        }
      } catch {
        lastError = "The stored copy could not be reached.";
      }
      try {
        const response = await fetch(`https://ntfy.sh/${ring.events.topic}/json?poll=1&since=12h`, { cache: "no-store" });
        if (response.ok) {
          for (const text of (await response.text()).split("\n")) {
            if (!text.trim()) continue;
            try {
              const envelope = JSON.parse(text);
              if (envelope.event !== "message") continue;
              const line = JSON.parse(envelope.message);
              onRelay.add(line.id);
              await absorb(line);
            } catch { /* not one of ours */ }
          }
        }
      } catch {
        lastError = lastError || "The relay could not be reached; changes stay on this device until it can.";
      }
      for (const [id, line] of lines) {
        if (stored.has(id) || onRelay.has(id)) continue;
        try { await post(line); } catch { lastError = lastError || "Some changes are waiting on this device to be sent."; }
      }
      save();
      lastSync = new Date();
      notify();
    };
    const write = async (kind, key, op, data) => {
      if (!aesKey || !signKey) throw new Error("Unlock the vault first.");
      const id = `${Date.now().toString(36).padStart(9, "0")}-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("")}`;
      const record = { id, at: new Date().toISOString(), dev: device, kind, key, op, data };
      const line = { id, ...(await seal(enc.encode(JSON.stringify(record)), `event/${id}`)) };
      const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signKey, enc.encode(`${line.id}.${line.iv}.${line.ct}`));
      line.sig = toB64(signature);
      if (JSON.stringify(line).length > MAX_LINE) throw new Error("That entry is too long to sync. Shorten the note to about 1,500 characters.");
      lines.set(id, line);
      events.set(id, record);
      save();
      notify();
      post(line).catch(() => { lastError = "Saved on this device; it will be sent on the next sync."; notify(); });
      return record;
    };
    const current = () => {
      const latest = new Map();
      [...events.values()].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1))
        .forEach((record) => latest.set(`${record.kind}\u0000${record.key}`, record));
      return [...latest.values()].filter((record) => record.op !== "del");
    };
    return {
      loadLocal,
      refresh,
      put: (kind, key, data) => write(kind, key, "put", data),
      remove: (kind, key) => write(kind, key, "del", {}),
      list: (kind) => current().filter((record) => record.kind === kind).map((record) => ({ key: record.key, at: record.at, ...record.data })),
      status: () => ({ total: lines.size, pending: [...lines.keys()].filter((id) => !stored.has(id)).length, lastSync, lastError }),
      onChange: (fn) => changed.add(fn),
      newKey: () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join(""),
    };
  })();

  window.LiamVault = {
    supported,
    isUnlocked: () => Boolean(aesKey),
    unlock,
    lock,
    showDialog,
    records,
    el,
    onChange: (fn) => { listeners.add(fn); if (aesKey) fn(true); },
  };
  listeners.add((unlocked) => { if (unlocked) { fillSlots(); showChip(true); } });

  const start = async () => {
    if (!supported) return;
    const session = readSession();
    if (!session) return;
    try {
      await adopt(fromB64(session.k));
      announce();
    } catch {
      try { localStorage.removeItem(SESSION); } catch { /* nothing stored */ }
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
