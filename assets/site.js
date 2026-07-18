function pageData() {
  const node = document.getElementById('page-data');
  return node ? JSON.parse(node.textContent) : {};
}
function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function drawAxes(ctx, width, height, pad, opts = {}) {
  ctx.strokeStyle = '#263955';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, height - pad.b); ctx.lineTo(width - pad.r, height - pad.b); ctx.stroke();
  const lines = opts.lines || 4;
  ctx.fillStyle = '#8ea3bf';
  ctx.font = '12px Georgia';
  for (let i = 0; i <= lines; i++) {
    const y = pad.t + (height - pad.t - pad.b) * i / lines;
    ctx.strokeStyle = 'rgba(255,255,255,.09)';
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke();
  }
}
function drawBarChart(canvas, labels, series, title, yLabel) {
  if (!canvas || !labels.length) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width, height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const pad = {l: 58, r: 24, t: 30, b: 72};
  const max = Math.max(1, ...series.flatMap(s => s.values.map(v => Math.max(0, v))));
  drawAxes(ctx, width, height, pad);
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const cluster = plotW / labels.length;
  const barW = Math.min(34, cluster / (series.length + 1));
  series.forEach((s, si) => {
    ctx.fillStyle = s.color;
    s.values.forEach((v, i) => {
      const x = pad.l + i * cluster + cluster / 2 + (si - (series.length - 1) / 2) * barW;
      const h = Math.max(1, (v / max) * plotH);
      ctx.globalAlpha = s.alpha || 1;
      ctx.fillRect(x - barW * .42, height - pad.b - h, barW * .84, h);
      ctx.globalAlpha = 1;
    });
  });
  ctx.fillStyle = '#e8edf6'; ctx.font = 'bold 16px Georgia'; ctx.fillText(title, pad.l, 20);
  ctx.fillStyle = '#8ea3bf'; ctx.font = '12px Georgia';
  labels.forEach((label, i) => {
    const x = pad.l + i * cluster + cluster / 2;
    ctx.save(); ctx.translate(x, height - 42); ctx.rotate(-0.55); ctx.textAlign = 'right'; ctx.fillText(label, 0, 0); ctx.restore();
  });
  ctx.save(); ctx.translate(16, height / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(yLabel, 0, 0); ctx.restore();
  let lx = pad.l, ly = 34;
  series.forEach(s => { ctx.fillStyle = s.color; ctx.fillRect(lx, ly, 12, 8); ctx.fillStyle = '#e8edf6'; ctx.fillText(s.name, lx + 18, ly + 8); lx += ctx.measureText(s.name).width + 48; });
}
function drawLineChart(canvas, points, title) {
  if (!canvas || !points.length) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width, height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const pad = {l: 58, r: 24, t: 30, b: 72};
  const ranks = points.map(p => p.rank);
  const min = Math.min(...ranks) - 2, max = Math.max(...ranks) + 2;
  drawAxes(ctx, width, height, pad);
  const xAt = i => pad.l + (width - pad.l - pad.r) * (points.length === 1 ? .5 : i / (points.length - 1));
  const yAt = r => pad.t + (r - min) / (max - min || 1) * (height - pad.t - pad.b);
  ctx.strokeStyle = css('--cyan'); ctx.lineWidth = 4; ctx.beginPath();
  points.forEach((p, i) => { const x = xAt(i), y = yAt(p.rank); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke();
  points.forEach((p, i) => { const x = xAt(i), y = yAt(p.rank); ctx.fillStyle = css('--cyan'); ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e8edf6'; ctx.font = 'bold 12px Georgia'; ctx.fillText(p.rank, x - 8, y - 11); });
  ctx.fillStyle = '#e8edf6'; ctx.font = 'bold 16px Georgia'; ctx.fillText(title, pad.l, 20);
  ctx.fillStyle = '#8ea3bf'; ctx.font = '12px Georgia';
  points.forEach((p, i) => { const x = xAt(i); ctx.save(); ctx.translate(x, height - 42); ctx.rotate(-0.55); ctx.textAlign = 'right'; ctx.fillText(p.round, 0, 0); ctx.restore(); });
}
(function init() {
  const data = pageData();
  if (data.characters && document.getElementById('overview-chart')) {
    const chars = data.characters.slice().sort((a, b) => a.rank - b.rank);
    drawBarChart(document.getElementById('overview-chart'), chars.slice(0, 24).map(c => c.name), [{name: 'Score', color: css('--cyan'), alpha: .9, values: chars.slice(0, 24).map(c => c.score)}], 'Top 24 Score Spread', 'Score');
  }
  if (data.character) {
    const c = data.character;
    drawBarChart(document.getElementById('match-chart'), c.matches.map(m => `${m.round} M${m.match}`), [{name: c.name, color: css('--cyan'), alpha: .9, values: c.matches.map(m => m.score)}], 'Score Per Match', 'Score');
    drawLineChart(document.getElementById('rank-chart'), c.ranks, 'Rank Trajectory');
    drawBarChart(document.getElementById('round-chart'), c.roundTotals.map(r => r.round), [{name: c.name, color: css('--gold'), alpha: .86, values: c.roundTotals.map(r => r.score)}], 'Round Score Totals', 'Score');
  }
})();