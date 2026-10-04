/* Site atlas: a radial tree generated recursively from the nested window.SITE_ATLAS schema. */
(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  // Root child index -> the site's hexagon slots: top, upper-left, upper-right, lower-left, bottom,
  // lower-right. SVG y grows downward, so -90 is up and -150 is the same direction as 210.
  const HEX_ANGLES = [-90, -150, -30, 150, 90, 30];
  const POSITIONS = ["top", "upper-left", "upper-right", "lower-left", "bottom", "lower-right"];
  const TIERS = ["Centre", "Field", "Topic", "Destination"];
  const PLURALS = ["centres", "fields", "topics", "destinations"];
  const GEOMETRY = {
    radii: [0, 128, 250, 410],
    dot: [46, 40, 6.5, 3.4],
    halo: [76, 60, 15, 6.2],
    stem: [0, 48, 99],
    font: [15, 9.6, 9.5, 9.2],
    lineHeight: [17, 10.8, 10.6, 10],
    wrap: [10, 12, 16, 0],
    labelGap: [0, 0, 12, 8],
    charWidth: 0.56,
    padding: 18,
  };
  const MAX_ZOOM = 8;
  const ZOOM_STEP = 1.5;

  const rad = (deg) => (deg * Math.PI) / 180;
  const round = (value) => Math.round(value * 100) / 100 || 0;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const normalize = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;
  const tierOf = (depth) => Math.min(depth, GEOMETRY.radii.length - 1);
  const polar = (radius, angle) => [round(radius * Math.cos(rad(angle))), round(radius * Math.sin(rad(angle)))];

  /* Place `node` at the middle of [startAngle, endAngle] on its tier's ring, then share that wedge
     equally between its children (the root's children take the hexagon slots instead). */
  function layout(node, depth, startAngle, endAngle, parentPath, parent, out) {
    const list = out || [];
    const path = depth === 0 ? "" : (parentPath ? parentPath + "/" : "") + node.s;
    const tier = tierOf(depth);
    const angle = depth === 0 ? -90 : (startAngle + endAngle) / 2;
    const radius = GEOMETRY.radii[tier];
    const [x, y] = polar(radius, angle);
    const item = {
      key: path || "root", path, title: String(node.t), url: path ? path + "/index.html" : "index.html",
      depth, index: parent ? parent.children.length : 0, parent: parent || null, children: [],
      start: startAngle, end: endAngle, angle, radius, x, y,
    };
    list.push(item);
    if (parent) parent.children.push(item);
    const kids = Array.isArray(node.c) ? node.c : [];
    kids.forEach((child, i) => {
      let span;
      let from;
      if (depth === 0) {
        span = 360 / kids.length;
        from = (kids.length === HEX_ANGLES.length ? HEX_ANGLES[i] : normalize(-90 + i * span)) - span / 2;
      } else {
        span = (endAngle - startAngle) / kids.length;
        from = startAngle + i * span;
      }
      layout(child, depth + 1, from, from + span, path, item, list);
    });
    return list;
  }

  function wrap(text, max) {
    if (!max || text.length <= max) return [text];
    const lines = [];
    let line = "";
    text.split(/\s+/).forEach((word) => {
      if (line && (line + " " + word).length > max) {
        lines.push(line);
        line = word;
      } else {
        line = line ? line + " " + word : word;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function lineage(item) {
    const chain = [];
    for (let node = item; node; node = node.parent) chain.unshift(node);
    return chain;
  }

  // Centre and field labels sit inside their discs; topic and leaf labels point radially outward,
  // turned 180 degrees on the left half so they never read upside down.
  function labelBox(item) {
    const tier = tierOf(item.depth);
    const font = GEOMETRY.font[tier];
    const lines = wrap(item.title, GEOMETRY.wrap[tier]);
    const offsets = lines.map((_, i) => round((i - (lines.length - 1) / 2) * GEOMETRY.lineHeight[tier] + font * 0.35));
    if (item.depth < 2) {
      return { lines, font, anchor: "middle", x: item.x, ys: offsets.map((dy) => round(item.y + dy)), transform: null };
    }
    const flip = Math.cos(rad(item.angle)) < -1e-9;
    const start = item.radius + GEOMETRY.labelGap[tier];
    return {
      lines, font, anchor: flip ? "end" : "start", x: flip ? -start : start, ys: offsets,
      transform: `rotate(${round(flip ? item.angle + 180 : item.angle)})`,
    };
  }

  // Half-width of a square view that holds every node and estimated label.
  function extent(nodes) {
    let reach = 0;
    nodes.forEach((item) => {
      const tier = tierOf(item.depth);
      reach = Math.max(reach, Math.max(Math.abs(item.x), Math.abs(item.y)) + GEOMETRY.halo[tier]);
      if (item.depth < 2) return;
      const box = labelBox(item);
      const longest = Math.max(...box.lines.map((line) => line.length));
      const far = polar(item.radius + GEOMETRY.labelGap[tier] + longest * GEOMETRY.charWidth * box.font, item.angle);
      const half = (box.lines.length * GEOMETRY.lineHeight[tier]) / 2;
      reach = Math.max(reach, Math.abs(far[0]) + half, Math.abs(far[1]) + half);
    });
    return Math.ceil(reach + GEOMETRY.padding);
  }

  // Straight spoke from the centre; elsewhere a stem along the parent's angle, then a radial cubic.
  function linkPath(parent, child) {
    const end = `${child.x},${child.y}`;
    if (parent.depth === 0) return `M${parent.x},${parent.y}L${end}`;
    const stemEnd = parent.radius + GEOMETRY.stem[Math.min(tierOf(parent.depth), GEOMETRY.stem.length - 1)];
    const bend = stemEnd + (child.radius - stemEnd) / 2;
    return `M${parent.x},${parent.y}L${polar(stemEnd, parent.angle)}C${polar(bend, parent.angle)} ${polar(bend, child.angle)} ${end}`;
  }

  function buildAtlas(schema) {
    const nodes = layout(schema, 0, -180, 180, "", null, []);
    return { nodes, root: nodes[0], leaves: nodes.filter((item) => !item.children.length), extent: extent(nodes) };
  }

  function describe(item) {
    if (!item.children.length) return item.parent ? `Destination inside ${item.parent.title}` : "A single page";
    const parts = [];
    let level = item.children;
    for (let depth = item.depth + 1; level.length; depth += 1) {
      parts.push(`${level.length} ${PLURALS[tierOf(depth)]}`);
      level = level.flatMap((node) => node.children);
    }
    return parts.join(" · ");
  }

  function svgEl(name, attrs, parent) {
    const element = document.createElementNS(SVG_NS, name);
    Object.keys(attrs).forEach((key) => {
      if (attrs[key] !== null && attrs[key] !== undefined) element.setAttribute(key, String(attrs[key]));
    });
    if (parent) parent.appendChild(element);
    return element;
  }

  function render(svg, atlas, prefix) {
    const defs = svgEl("defs", {}, svg);
    GEOMETRY.radii.forEach((_, tier) => {
      const glow = svgEl("radialGradient", { id: `atlas-tree-glow-${tier}`, class: `at-glow t${tier}` }, defs);
      svgEl("stop", { offset: "0", class: "at-glow-core" }, glow);
      svgEl("stop", { offset: "0.45", class: "at-glow-mid" }, glow);
      svgEl("stop", { offset: "1", class: "at-glow-edge" }, glow);
    });
    const scene = svgEl("g", { class: "at-scene" }, svg);
    const guides = svgEl("g", { class: "at-guides", "aria-hidden": "true" }, scene);
    GEOMETRY.radii.slice(1).forEach((r, i) => svgEl("circle", { class: `at-ring t${i + 1}`, cx: 0, cy: 0, r }, guides));
    const inner = GEOMETRY.radii[1] + GEOMETRY.stem[1] + 4;
    const outer = GEOMETRY.radii[GEOMETRY.radii.length - 1] - 14;
    atlas.root.children.forEach((field) => {
      svgEl("path", { class: "at-divider", d: `M${polar(inner, field.start)}L${polar(outer, field.start)}` }, guides);
    });
    const links = svgEl("g", { class: "at-links", "aria-hidden": "true" }, scene);
    const nodes = svgEl("g", { class: "at-nodes" }, scene);
    atlas.nodes.forEach((item) => {
      const tier = tierOf(item.depth);
      if (item.parent) item.link = svgEl("path", { class: `at-link t${tier}`, d: linkPath(item.parent, item) }, links);
      const link = svgEl("a", {
        class: `at-node t${tier}`, href: prefix + item.url, "data-key": item.key, tabindex: item.depth ? "-1" : "0",
      }, nodes);
      svgEl("title", {}, link).textContent = lineage(item).map((node) => node.title).join(" › ");
      svgEl("circle", { class: "at-halo", cx: item.x, cy: item.y, r: GEOMETRY.halo[tier], fill: `url(#atlas-tree-glow-${tier})` }, link);
      svgEl("circle", { class: "at-dot", cx: item.x, cy: item.y, r: GEOMETRY.dot[tier] }, link);
      const box = labelBox(item);
      const text = svgEl("text", { class: "at-label", "font-size": box.font, "text-anchor": box.anchor, transform: box.transform }, link);
      box.lines.forEach((line, i) => {
        svgEl("tspan", { x: box.x, y: box.ys[i] }, text).textContent = line;
      });
      item.el = link;
    });
    return scene;
  }

  function fold(text) {
    return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function boot() {
    const page = document.querySelector(".atlas-tree-page");
    const data = window.SITE_ATLAS;
    const stage = page && page.querySelector("[data-atlas-stage]");
    const mount = page && page.querySelector("[data-atlas-mount]");
    if (!stage || !mount || !data || !Array.isArray(data.c)) return;
    const atlas = buildAtlas(data);
    const prefix = mount.getAttribute("data-prefix") || "";
    const svg = svgEl("svg", {
      class: "atlas-tree-svg", role: "group", "aria-label": `Radial site atlas of ${atlas.nodes.length} linked pages`,
      "aria-describedby": "atlas-tree-hint", viewBox: `${-atlas.extent} ${-atlas.extent} ${atlas.extent * 2} ${atlas.extent * 2}`,
    });
    const scene = render(svg, atlas, prefix);
    mount.appendChild(svg);
    stage.hidden = false;
    try {
      const box = scene.getBBox();
      const reach = Math.max(-box.x, -box.y, box.x + box.width, box.y + box.height);
      if (Number.isFinite(reach) && reach > 0) atlas.extent = Math.ceil(reach + GEOMETRY.padding);
    } catch (error) {
      // Keep the estimated extent when the browser cannot measure yet.
    }
    interact(page, stage, mount, svg, atlas, prefix);
  }

  function interact(page, stage, viewport, svg, atlas, prefix) {
    const byKey = new Map(atlas.nodes.map((item) => [item.key, item]));
    const templates = new Map(Array.from(page.querySelectorAll("template[data-key]"), (t) => [t.getAttribute("data-key"), t]));
    const pick = (name) => page.querySelector(`[data-atlas-${name}]`);
    const detail = {
      box: pick("detail"), icon: pick("detail-icon"), tier: pick("detail-tier"), title: pick("detail-title"),
      meta: pick("detail-meta"), trail: pick("detail-trail"), open: pick("detail-open"), name: pick("detail-name"),
    };
    const rings = new Map();
    atlas.nodes.forEach((item) => {
      if (!rings.has(item.depth)) rings.set(item.depth, []);
      rings.get(item.depth).push(item);
    });
    rings.forEach((ring) => ring.sort((a, b) => normalize(a.angle) - normalize(b.angle)));
    const reduced = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
    let lit = [];
    let active = null;
    let roving = atlas.root;

    const nodeFrom = (target) => {
      const link = target && target.closest ? target.closest(".at-node") : null;
      return link && svg.contains(link) ? byKey.get(link.getAttribute("data-key")) : null;
    };

    function showDetail(item, playing) {
      if (!detail.box) return;
      const tier = tierOf(item.depth);
      detail.box.setAttribute("data-tier", String(tier));
      detail.tier.textContent = item.depth === 1 && POSITIONS[item.index] ? `${TIERS[tier]} · ${POSITIONS[item.index]}` : TIERS[tier];
      detail.title.textContent = item.title;
      detail.meta.textContent = describe(item);
      detail.trail.replaceChildren(...lineage(item).map((node) => {
        const li = document.createElement("li");
        const step = document.createElement(node === item ? "span" : "a");
        if (node === item) step.setAttribute("aria-current", "location");
        else step.href = prefix + node.url;
        step.textContent = node.title;
        li.append(step);
        return li;
      }));
      detail.open.href = prefix + item.url;
      detail.name.textContent = item.title;
      const template = templates.get(item.key);
      detail.icon.replaceChildren(...(template ? [template.content.cloneNode(true)] : []));
      detail.icon.classList.toggle("is-playing", Boolean(playing));
    }

    function clearLit() {
      lit.forEach((element) => element.classList.remove("is-lit", "is-branch"));
      lit = [];
    }

    function mark(element, name) {
      if (!element) return;
      element.classList.add(name);
      lit.push(element);
    }

    function markBranch(item) {
      item.children.forEach((child) => {
        mark(child.el, "is-branch");
        mark(child.link, "is-branch");
        markBranch(child);
      });
    }

    function activate(item) {
      if (active === item) return;
      clearLit();
      active = item;
      markBranch(item);
      for (let node = item; node; node = node.parent) {
        mark(node.el, "is-lit");
        mark(node.link, "is-lit");
      }
      svg.classList.add("has-active");
      showDetail(item, true);
    }

    function deactivate() {
      clearLit();
      active = null;
      svg.classList.remove("has-active");
      if (detail.icon) detail.icon.classList.remove("is-playing");
    }

    /* ---- zoom and pan: only the viewBox changes ---- */
    const zoomButtons = {};
    stage.querySelectorAll("[data-zoom]").forEach((button) => { zoomButtons[button.getAttribute("data-zoom")] = button; });
    const level = stage.querySelector("[data-atlas-zoom-level]");
    let view = { scale: 1, cx: 0, cy: 0 };
    let frame = 0;
    let settle = 0;

    function bounded(next) {
      const scale = clamp(next.scale, 1, MAX_ZOOM);
      const limit = atlas.extent - atlas.extent / scale;
      return { scale, cx: clamp(next.cx, -limit, limit), cy: clamp(next.cy, -limit, limit) };
    }

    function apply(next) {
      view = bounded(next);
      const half = atlas.extent / view.scale;
      svg.setAttribute("viewBox", [view.cx - half, view.cy - half, half * 2, half * 2].map(round).join(" "));
      const zoomed = view.scale > 1.001;
      viewport.classList.toggle("is-zoomed", zoomed);
      if (zoomButtons.out) zoomButtons.out.setAttribute("aria-disabled", String(!zoomed));
      if (zoomButtons.in) zoomButtons.in.setAttribute("aria-disabled", String(view.scale >= MAX_ZOOM - 0.001));
      if (zoomButtons.reset) zoomButtons.reset.setAttribute("aria-disabled", String(!zoomed));
      if (level) level.textContent = `${Math.round(view.scale * 100)}%`;
    }

    function zoomTo(next, animate) {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      const target = bounded(next);
      if (!animate || reduced.matches) {
        apply(target);
        return;
      }
      const from = view;
      const begun = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - begun) / 260);
        const eased = 1 - Math.pow(1 - progress, 3);
        apply({
          scale: Math.exp(lerp(Math.log(from.scale), Math.log(target.scale), eased)),
          cx: lerp(from.cx, target.cx, eased), cy: lerp(from.cy, target.cy, eased),
        });
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      // Throttled or paused animation frames must not leave the view half-way.
      settle = setTimeout(() => {
        cancelAnimationFrame(frame);
        apply(target);
      }, 420);
    }

    // Keep the scene point under the cursor (or pinch midpoint) fixed while scaling.
    function zoomAround(point, scale, animate) {
      const next = clamp(scale, 1, MAX_ZOOM);
      const keep = view.scale / next;
      zoomTo({ scale: next, cx: point.x + (view.cx - point.x) * keep, cy: point.y + (view.cy - point.y) * keep }, animate);
    }

    function toScene(clientX, clientY) {
      const matrix = svg.getScreenCTM();
      if (!matrix) return { x: view.cx, y: view.cy };
      const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
      return { x: point.x, y: point.y };
    }

    function reveal(item) {
      if (view.scale <= 1.001) return;
      const half = atlas.extent / view.scale;
      const margin = half * 0.2;
      if (Math.abs(item.x - view.cx) > half - margin || Math.abs(item.y - view.cy) > half - margin) {
        zoomTo({ scale: view.scale, cx: item.x, cy: item.y }, false);
      }
    }

    Object.keys(zoomButtons).forEach((kind) => {
      zoomButtons[kind].addEventListener("click", () => {
        if (zoomButtons[kind].getAttribute("aria-disabled") === "true") return;
        if (kind === "reset") zoomTo({ scale: 1, cx: 0, cy: 0 }, true);
        else if (kind === "out") zoomTo({ scale: view.scale / ZOOM_STEP, cx: view.cx, cy: view.cy }, true);
        else if (view.scale <= 1.001 && roving !== atlas.root) zoomTo({ scale: ZOOM_STEP, cx: roving.x, cy: roving.y }, true);
        else zoomTo({ scale: view.scale * ZOOM_STEP, cx: view.cx, cy: view.cy }, true);
      });
    });

    svg.addEventListener("wheel", (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomAround(toScene(event.clientX, event.clientY), view.scale * Math.exp(-event.deltaY * 0.0022), false);
    }, { passive: false });

    const pointers = new Map();
    let drag = null;
    let pinch = null;
    let suppressClick = false;
    const spread = () => {
      const [a, b] = Array.from(pointers.values());
      return { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };

    svg.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      suppressClick = false;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, cx: view.cx, cy: view.cy, moved: false };
      } else if (pointers.size === 2 && view.scale > 1.001) {
        pinch = { distance: spread().distance, scale: view.scale };
        drag = null;
      }
    });

    svg.addEventListener("pointermove", (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch && pointers.size === 2) {
        const now = spread();
        zoomAround(toScene(now.x, now.y), (pinch.scale * now.distance) / pinch.distance, false);
        return;
      }
      if (!drag || drag.id !== event.pointerId || view.scale <= 1.001) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      if (!drag.moved) {
        drag.moved = true;
        svg.setPointerCapture(event.pointerId);
        viewport.classList.add("is-panning");
      }
      const unit = (2 * atlas.extent) / view.scale / (svg.getBoundingClientRect().width || 1);
      apply({ scale: view.scale, cx: drag.cx - dx * unit, cy: drag.cy - dy * unit });
    });

    const release = (event) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = null;
      if (drag && drag.id === event.pointerId) {
        suppressClick = drag.moved;
        drag = null;
        viewport.classList.remove("is-panning");
      }
    };
    svg.addEventListener("pointerup", release);
    svg.addEventListener("pointercancel", release);
    svg.addEventListener("click", (event) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    /* ---- hover, focus and keyboard travel (one tab stop; arrows move between nodes) ---- */
    function setRoving(item) {
      if (roving === item) return;
      roving.el.setAttribute("tabindex", "-1");
      roving = item;
      item.el.setAttribute("tabindex", "0");
    }

    function focusNode(item) {
      setRoving(item);
      reveal(item);
      item.el.focus();
    }

    function around(item, direction) {
      const ring = rings.get(item.depth);
      return ring[(ring.indexOf(item) + direction + ring.length) % ring.length];
    }

    svg.addEventListener("pointerover", (event) => {
      const item = nodeFrom(event.target);
      if (item && !drag?.moved) activate(item);
    });
    svg.addEventListener("pointerleave", () => {
      const focused = nodeFrom(document.activeElement);
      if (focused) activate(focused);
      else deactivate();
    });
    svg.addEventListener("focusin", (event) => {
      const item = nodeFrom(event.target);
      if (!item) return;
      setRoving(item);
      reveal(item);
      activate(item);
    });
    svg.addEventListener("focusout", (event) => {
      if (!nodeFrom(event.relatedTarget) && !svg.matches(":hover")) deactivate();
    });
    svg.addEventListener("keydown", (event) => {
      const item = nodeFrom(event.target);
      if (!item || event.altKey || event.ctrlKey || event.metaKey) return;
      let next = null;
      if (event.key === "ArrowLeft") {
        next = item.parent;
        if (next) next.lastVisited = item;
      } else if (event.key === "ArrowRight") next = item.lastVisited || item.children[0] || null;
      else if (event.key === "ArrowUp") next = around(item, -1);
      else if (event.key === "ArrowDown") next = around(item, 1);
      else if (event.key === "Home") next = atlas.root;
      else return;
      event.preventDefault();
      if (next && next !== item) focusNode(next);
    });

    /* ---- search ---- */
    const form = stage.querySelector("[data-atlas-search]");
    const input = form && form.querySelector("input");
    const status = form && form.querySelector("output");
    atlas.nodes.forEach((item) => { item.folded = fold(item.title); });
    let matches = [];
    let cursor = 0;
    let searched = "";

    function search(query) {
      const wanted = fold(query);
      const tokens = wanted ? wanted.split(" ") : [];
      const rank = (item) => (item.folded === wanted ? 0 : item.folded.startsWith(wanted) ? 1 : 2);
      matches = tokens.length ? atlas.nodes.filter((item) => tokens.every((token) => item.folded.includes(token))) : [];
      matches.sort((a, b) => rank(a) - rank(b));
      const found = new Set(matches);
      atlas.nodes.forEach((item) => item.el.classList.toggle("is-match", found.has(item)));
      svg.classList.toggle("is-searching", tokens.length > 0);
      searched = wanted;
      cursor = 0;
      if (!status) return;
      if (!tokens.length) status.textContent = "";
      else if (!matches.length) status.textContent = `No page matches “${query.trim()}”.`;
      else status.textContent = `${matches.length} ${matches.length === 1 ? "match" : "matches"}. Press Enter to visit.`;
    }

    if (form && input) {
      input.addEventListener("input", () => search(input.value));
      input.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && input.value) {
          input.value = "";
          search("");
        }
      });
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (fold(input.value) !== searched) search(input.value);
        if (!matches.length) return;
        const item = matches[cursor % matches.length];
        cursor += 1;
        if (status && matches.length > 1) {
          status.textContent = `Match ${((cursor - 1) % matches.length) + 1} of ${matches.length}: ${item.title}. Search again for the next.`;
        }
        focusNode(item);
      });
    }

    showDetail(atlas.root, false);
    apply(view);
  }

  const api = { layout, buildAtlas, lineage, labelBox, linkPath, wrap, normalize, extent, GEOMETRY, HEX_ANGLES, POSITIONS };
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
    else boot();
  }
})();
