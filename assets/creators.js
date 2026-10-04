(() => {
  "use strict";
  // Progressive only: snapping, layout and every link work without this file.
  const main = document.querySelector("main.home-snap");
  if (!main) return;
  const root = document.documentElement;
  const header = document.querySelector(".site-header");
  const footer = document.querySelector(".site-footer");
  const syncChrome = () => {
    if (header) root.style.setProperty("--creator-header", `${Math.ceil(header.getBoundingClientRect().height)}px`);
    if (footer) root.style.setProperty("--creator-footer", `${Math.ceil(footer.getBoundingClientRect().height)}px`);
  };
  syncChrome();
  if ("ResizeObserver" in window) {
    const resize = new ResizeObserver(syncChrome);
    [header, footer].forEach((element) => { if (element) resize.observe(element); });
  } else window.addEventListener("resize", syncChrome);

  const sections = [...main.querySelectorAll(":scope > .snap-section")];
  if (sections.length < 2 || !("IntersectionObserver" in window)) return;
  const labelFor = (section, index) => {
    const heading = document.getElementById(section.getAttribute("aria-labelledby") || "");
    const text = (section.dataset.snapLabel || (heading ? heading.textContent : "")).replace(/\s+/g, " ").trim();
    return text || (index === 0 ? "Home" : `Section ${index + 1}`);
  };

  const list = document.createElement("ol");
  const entries = [];
  sections.forEach((section, index) => {
    const id = section.id || (index === 0 ? main.id : "");
    if (!id) return;
    const link = document.createElement("a");
    link.href = `#${id}`;
    const label = document.createElement("span");
    label.className = "snap-rail-label";
    label.textContent = labelFor(section, index);
    link.append(label);
    const item = document.createElement("li");
    item.append(link);
    list.append(item);
    entries.push({ section, link });
  });
  if (entries.length < 2) return;
  const nav = document.createElement("nav");
  nav.className = "snap-rail";
  nav.setAttribute("aria-label", "Home page sections");
  nav.append(list);
  main.append(nav);

  const setCurrent = (section) => entries.forEach((entry) => {
    if (entry.section === section) entry.link.setAttribute("aria-current", "location");
    else entry.link.removeAttribute("aria-current");
  });
  setCurrent(entries[0].section);
  // A thin band across the middle of the viewport decides which section is "visible".
  const observer = new IntersectionObserver((records) => {
    records.forEach((record) => { if (record.isIntersecting) setCurrent(record.target); });
  }, { rootMargin: "-48% 0px -51% 0px", threshold: 0 });
  entries.forEach((entry) => observer.observe(entry.section));
})();
