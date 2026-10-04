(() => {
  "use strict";
  // Mental Map change requests: fill a form, then open an email draft. Nothing is sent or stored here.
  const dialog = document.getElementById("request-change");
  const atlas = window.SITE_ATLAS;
  if (!dialog || !atlas || !Array.isArray(atlas.c) || typeof dialog.showModal !== "function") return;
  const byId = (id) => document.getElementById(id);
  const form = byId("request-form");
  const status = byId("request-status");
  const field = {
    name: byId("request-name"), date: byId("request-date"), section: byId("request-section"),
    subsection: byId("request-subsection"), subsubsection: byId("request-subsubsection"), content: byId("request-content"),
  };
  const email = dialog.dataset.email;
  const siteRoot = new URL("../", location.href);
  const MAILTO_LIMIT = 1900;

  const option = (value, text) => {
    const item = document.createElement("option");
    item.value = value;
    item.textContent = text;
    return item;
  };
  const fill = (select, nodes, number, placeholder) => {
    select.replaceChildren(option("", placeholder), ...nodes.map((node, i) => option(String(i), `${number}${i + 1} ${node.t}`)));
    select.disabled = nodes.length === 0;
  };
  const chosen = (select, nodes) => (select.value === "" ? null : nodes[Number(select.value)] || null);
  const section = () => chosen(field.section, atlas.c);
  const subsection = () => { const s = section(); return s ? chosen(field.subsection, s.c) : null; };
  const subsubsection = () => { const s = subsection(); return s ? chosen(field.subsubsection, s.c) : null; };

  const updateSubsections = () => {
    const s = section();
    fill(field.subsection, s ? s.c : [], s ? `${Number(field.section.value) + 1}.` : "", s ? "Choose a subsection" : "Choose a section first");
    updateSubsubsections();
  };
  const updateSubsubsections = () => {
    const s = subsection();
    const number = s ? `${Number(field.section.value) + 1}.${Number(field.subsection.value) + 1}.` : "";
    fill(field.subsubsection, s ? s.c : [], number, s ? "The whole subsection" : "Choose a subsection first");
  };
  fill(field.section, atlas.c, "", "Choose a section");
  updateSubsections();
  field.section.addEventListener("change", updateSubsections);
  field.subsection.addEventListener("change", updateSubsubsections);

  // Anchor id -> [section, subsection, subsubsection] indexes, from the site outline.
  const positions = new Map();
  atlas.c.forEach((a, i) => {
    positions.set(a.a, [i]);
    a.c.forEach((b, j) => {
      positions.set(b.a, [i, j]);
      b.c.forEach((c, k) => positions.set(c.a, [i, j, k]));
    });
  });
  const here = () => {
    let found = null;
    for (const heading of document.querySelectorAll(".tex-paper [id]:is(h1,h2,h3,h4,h5)")) {
      if (heading.getBoundingClientRect().top > 160) break;
      if (positions.has(heading.id)) found = positions.get(heading.id);
    }
    return found;
  };
  const select = ([i, j, k] = []) => {
    if (i === undefined) return;
    field.section.value = String(i);
    updateSubsections();
    if (j === undefined) return;
    field.subsection.value = String(j);
    updateSubsubsections();
    if (k !== undefined) field.subsubsection.value = String(k);
  };
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  document.querySelectorAll("[data-request-open]").forEach((opener) => opener.addEventListener("click", (event) => {
    event.preventDefault();
    if (!field.date.value) field.date.value = today();
    if (field.section.value === "") select(here() || []);
    status.textContent = "";
    dialog.showModal();
    field.name.focus();
  }));
  dialog.querySelector("[data-request-close]").addEventListener("click", () => dialog.close());

  const label = (node, numbers) => (node ? `${numbers.join(".")} ${node.t}` : "");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const a = section(), b = subsection(), c = subsubsection();
    const i = Number(field.section.value) + 1, j = Number(field.subsection.value) + 1, k = Number(field.subsubsection.value) + 1;
    const target = c || b;
    const path = [a.s, b.s, c && c.s].filter(Boolean).join("/");
    const header = [
      `Name: ${field.name.value.trim()}`,
      `Date: ${field.date.value}`,
      `Section: ${label(a, [i])}`,
      `Subsection: ${label(b, [i, j])}`,
      `Subsubsection: ${c ? label(c, [i, j, k]) : "The whole subsection"}`,
      `Website page: ${new URL(path + "/index.html", siteRoot).href}`,
      `Mental Map section: ${new URL("Mental-Map/index.html#" + encodeURIComponent(target.a), siteRoot).href}`,
      "",
      "Proposed content (text or .tex):",
      "",
    ];
    const subject = `Mental Map change request: ${target.t}`;
    const draft = (body) => `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\r?\n/g, "\r\n"))}`;
    const full = header.join("\n") + field.content.value;
    let url = draft(full);
    if (url.length > MAILTO_LIMIT) {
      // Long drafts are cut off by some email apps, so the full request goes to the clipboard instead.
      let copied = false;
      try {
        await navigator.clipboard.writeText(full);
        copied = true;
      } catch (error) {
        copied = false;
      }
      url = draft(header.join("\n") + (copied ? "[The full request was copied to your clipboard. Paste it here, replacing this line.]"
        : "[The content was too long for an email link. Please paste it here.]"));
      status.textContent = copied ? "Your request is long, so the full text was copied to the clipboard. Paste it into the email."
        : "Your request is long. Copy your content from the form and paste it into the email.";
    } else {
      status.textContent = "Your email app should open with the request filled in.";
    }
    window.location.href = url;
  });
})();
