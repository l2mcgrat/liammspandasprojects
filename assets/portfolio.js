(() => {
  "use strict";
  const descriptions = { gaming: "Gaming — competition, measured.", economics: "Economics — systems of exchange.", business: "Business — from process to insight.", physics: "Physics — models of the world.", language: "Language — words, rhythm & meaning.", miscellaneous: "Miscellaneous — room for curiosity.", sports: "Sports — house rules, court stories & data.", "mental-map": "Mental Map — the thread connecting every field." };
  const map = document.querySelector('.hex-map');
  if (map) {
    const activate = (topic) => {
      map.querySelectorAll('.map-spoke').forEach(line => line.classList.toggle('active', topic === 'mental-map' || line.classList.contains(`spoke-${topic}`)));
      document.getElementById('map-hint').textContent = descriptions[topic] || 'Follow a thread. See where it leads.';
    };
    map.querySelectorAll('[data-topic]').forEach(node => {
      node.addEventListener('pointerenter', () => activate(node.dataset.topic));
      node.addEventListener('focus', () => activate(node.dataset.topic));
      node.addEventListener('pointerleave', () => activate(map.contains(document.activeElement) ? document.activeElement.dataset.topic : ''));
      node.addEventListener('blur', () => activate(''));
    });
  }
  const current = location.pathname.replace(/\/$/, '/index.html');
  document.querySelectorAll('.site-header nav a').forEach(link => {
    if (new URL(link.href).pathname === current) link.setAttribute('aria-current', 'page');
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