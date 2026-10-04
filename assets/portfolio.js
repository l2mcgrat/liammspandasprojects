(() => {
  "use strict";
  const map = document.querySelector('.hex-map');
  const hint = document.getElementById('map-hint');
  if (map) {
    const idle = hint ? hint.textContent : '';
    const activate = (node) => {
      const topic = node ? node.dataset.topic : '';
      map.querySelectorAll('.map-spoke').forEach(line => line.classList.toggle('active', topic === 'center' || line.classList.contains(`spoke-${topic}`)));
      if (hint) hint.textContent = (node && node.dataset.hint) || idle;
    };
    const nodes = [...map.querySelectorAll('[data-topic]')];
    nodes.forEach(node => {
      node.addEventListener('pointerenter', () => activate(node));
      node.addEventListener('focus', () => activate(node));
      node.addEventListener('pointerleave', () => activate(map.contains(document.activeElement) ? document.activeElement : null));
      node.addEventListener('blur', () => activate(null));
    });
    // Touch screens have no hover: play each hexagon's animation once as it scrolls into view.
    const touch = matchMedia('(hover: none)').matches;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (touch && !calm && 'IntersectionObserver' in window) {
      const seen = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        seen.disconnect();
        nodes.forEach((node, i) => {
          const icon = node.querySelector('.atlas-icon');
          if (!icon) return;
          setTimeout(() => icon.classList.add('is-playing'), i * 260);
          setTimeout(() => icon.classList.remove('is-playing'), i * 260 + 2600);
        });
      }, { threshold: 0.45 });
      seen.observe(map);
    }
  }
  const current = location.pathname.replace(/\/$/, '/index.html');
  document.querySelectorAll('.site-header nav a').forEach(link => {
    const url = new URL(link.href);
    if (!url.hash && url.pathname === current) link.setAttribute('aria-current', 'page');
  });
  document.querySelector('.print-reader')?.addEventListener('click', () => window.print());
  const contents = document.querySelector('.contents-panel');
  if (contents && matchMedia('(max-width:760px)').matches) contents.open = false;
  const search = document.getElementById('toc-search');
  if (search) {
    const items = [...document.querySelectorAll('#reader-toc li')];
    search.addEventListener('input', () => {
      const term = search.value.trim().toLocaleLowerCase();
      let found = false;
      // Keep ancestors of a matching heading so nested matches stay visible.
      items.forEach(item => { const show = !term || item.textContent.toLocaleLowerCase().includes(term); item.hidden = !show; found ||= show; });
      document.getElementById('toc-empty').hidden = found;
    });
    const anchors = [...document.querySelectorAll('#reader-toc a[href^="#"]')];
    const headings = anchors.map(a => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
    const setCurrent = id => anchors.forEach(a => { if (decodeURIComponent(a.hash.slice(1)) === id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => { const top = entries.filter(entry => entry.isIntersecting).sort((a,b) => a.boundingClientRect.top-b.boundingClientRect.top)[0]; if (top) setCurrent(top.target.id); }, { rootMargin:'-110px 0px -60% 0px' });
      headings.forEach(heading => observer.observe(heading));
    }
    anchors.forEach(a => a.addEventListener('click', () => { setCurrent(decodeURIComponent(a.hash.slice(1))); if (matchMedia('(max-width:760px)').matches) contents.open = false; }));
  }
})();