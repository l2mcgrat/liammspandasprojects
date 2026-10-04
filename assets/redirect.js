(() => {
  "use strict";
  // Preserve query strings such as ?series=…&round=… when forwarding old URLs.
  const target = document.querySelector('link[rel="canonical"]');
  if (target) location.replace(target.href + location.search + location.hash);
})();
