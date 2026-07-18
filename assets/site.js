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
function allRounds(chars) {
  const seen = new Map();
  chars.forEach(c => (c.ranks || []).forEach(p => { if (!seen.has(p.roundLabel)) seen.set(p.roundLabel, p.round); }));
  return Array.from(seen, ([roundLabel, round]) => ({roundLabel, round}));
}
function drawRankAtlas(canvas, chars, highlightNames) {
  if (!canvas || !chars.length) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width, height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const highlightSet = new Set(highlightNames || []);
  const pad = {l: 70, r: 190, t: 40, b: 82};
  const rounds = allRounds(chars);
  const xAt = i => pad.l + (width - pad.l - pad.r) * (rounds.length === 1 ? .5 : i / (rounds.length - 1));
  const yAt = rank => pad.t + (rank - 1) / 85 * (height - pad.t - pad.b);
  drawAxes(ctx, width, height, pad, {lines: 8});
  ctx.fillStyle = '#e8edf6'; ctx.font = 'bold 18px Georgia'; ctx.fillText('Every Character Rank Trajectory', pad.l, 24);
  rounds.forEach((r, i) => { const x = xAt(i); ctx.fillStyle = '#8ea3bf'; ctx.font = '13px Georgia'; ctx.save(); ctx.translate(x, height - 42); ctx.rotate(-0.45); ctx.textAlign = 'right'; ctx.fillText(r.round, 0, 0); ctx.restore(); });
  const colors = ['#00c8ff', '#ffd369', '#4ade80', '#f87171', '#b07aa1', '#76b7b2', '#edc948', '#e15759'];
  const highlightColors = ['#00c8ff', '#ffd369', '#4ade80', '#f87171', '#f0abfc', '#38bdf8', '#fb923c', '#c4b5fd'];
  let highlightIndex = 0;
  chars.forEach((c, ci) => {
    const map = new Map((c.ranks || []).map(p => [p.roundLabel, p.rank]));
    const isHi = highlightSet.has(c.name);
    const hiColor = highlightColors[highlightIndex % highlightColors.length];
    if (isHi) highlightIndex += 1;
    ctx.strokeStyle = isHi ? hiColor : colors[ci % colors.length];
    ctx.globalAlpha = isHi ? 1 : 0.16;
    ctx.lineWidth = isHi ? 4 : 1.2;
    ctx.beginPath();
    let started = false;
    rounds.forEach((r, i) => {
      if (!map.has(r.roundLabel)) return;
      const x = xAt(i), y = yAt(map.get(r.roundLabel));
      started ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      started = true;
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (isHi) {
      rounds.forEach((r, i) => {
        if (!map.has(r.roundLabel)) return;
        const x = xAt(i), y = yAt(map.get(r.roundLabel));
        ctx.fillStyle = hiColor; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e8edf6'; ctx.font = 'bold 12px Georgia'; ctx.fillText(map.get(r.roundLabel), x + 8, y - 8);
      });
      const last = c.ranks[c.ranks.length - 1];
      ctx.fillStyle = hiColor; ctx.font = 'bold 15px Georgia'; ctx.fillText(`${c.name} #${last.rank}`, width - pad.r + 20, yAt(last.rank) + 5);
    }
  });
}
const PARETO_METRICS = [
  {key: 'score', label: 'Total Score', dir: 'desc', format: v => Number(v).toFixed(2)},
  {key: 'rank', label: 'Current Rank', dir: 'asc', format: v => `#${v}`},
  {key: 'avgRank', label: 'Average Rank', dir: 'asc', format: v => Number(v).toFixed(1)},
  {key: 'winRate', label: 'Win Rate', dir: 'desc', format: v => `${Math.round(Number(v) * 100)}%`},
  {key: 'pointsPerMatch', label: 'Points / Match', dir: 'desc', format: v => Number(v).toFixed(3)},
  {key: 'rawPerformance', label: 'Raw Performance', dir: 'desc', format: v => Number(v).toFixed(3)},
  {key: 'overperformance', label: 'Overperformance', dir: 'desc', format: v => Number(v).toFixed(3)},
  {key: 'scoreLost', label: 'Score Lost', dir: 'desc', format: v => Number(v).toFixed(3)},
  {key: 'adjustedScoreLost', label: 'Adjusted Score Lost', dir: 'desc', format: v => Number(v).toFixed(3)},
  {key: 'wins', label: 'Wins', dir: 'desc', format: v => `${v}`},
  {key: 'losses', label: 'Losses', dir: 'desc', format: v => `${v}`}
];
function drawHorizontalPareto(canvas, chars, metric) {
  if (!canvas || !chars.length) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width, height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const sorted = chars.slice().sort((a, b) => metric.dir === 'asc' ? Number(a[metric.key]) - Number(b[metric.key]) : Number(b[metric.key]) - Number(a[metric.key]));
  const pad = {l: 250, r: 90, t: 42, b: 42};
  const rowH = (height - pad.t - pad.b) / sorted.length;
  const values = sorted.map(c => Math.abs(Number(c[metric.key]) || 0));
  const max = Math.max(1, ...values);
  ctx.fillStyle = '#e8edf6'; ctx.font = 'bold 18px Georgia'; ctx.fillText(`${metric.label} Pareto`, pad.l, 24);
  sorted.forEach((c, i) => {
    const y = pad.t + i * rowH;
    const value = Number(c[metric.key]) || 0;
    const w = Math.abs(value) / max * (width - pad.l - pad.r);
    ctx.fillStyle = i < 8 ? '#00c8ff' : (i < 24 ? '#ffd369' : '#4ade80');
    ctx.globalAlpha = i < 24 ? .86 : .55;
    ctx.fillRect(pad.l, y + 2, w, Math.max(3, rowH - 4));
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#8ea3bf'; ctx.font = '11px Georgia'; ctx.textAlign = 'right'; ctx.fillText(`${i + 1}. ${c.name}`, pad.l - 10, y + rowH * .68);
    ctx.textAlign = 'left'; ctx.fillStyle = '#e8edf6'; ctx.fillText(metric.format(value), pad.l + w + 8, y + rowH * .68);
  });
  ctx.textAlign = 'left';
}
function renderParetoTable(node, chars, metric) {
  if (!node) return;
  const sorted = chars.slice().sort((a, b) => metric.dir === 'asc' ? Number(a[metric.key]) - Number(b[metric.key]) : Number(b[metric.key]) - Number(a[metric.key]));
  node.innerHTML = sorted.slice(0, 24).map((c, i) => `<div class="pareto-row"><span>${i + 1}</span><a href="../${c.slug}/index.html">${c.name}</a><strong>${metric.format(c[metric.key])}</strong></div>`).join('');
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
  if (data.characters && document.getElementById('rank-atlas-chart')) {
    const select = document.getElementById('rank-highlight');
    const chars = data.characters.slice().sort((a, b) => a.rank - b.rank);
    select.innerHTML = chars.map(c => `<option value="${c.name}">${c.name} (#${c.rank})</option>`).join('');
    if (select.options.length) select.options[0].selected = true;
    const selectedNames = () => Array.from(select.selectedOptions).map(option => option.value);
    const redraw = () => drawRankAtlas(document.getElementById('rank-atlas-chart'), chars, selectedNames());
    select.addEventListener('change', redraw);
    redraw();
  }
  if (data.characters && document.getElementById('pareto-chart')) {
    const select = document.getElementById('pareto-metric');
    select.innerHTML = PARETO_METRICS.map(m => `<option value="${m.key}">${m.label}</option>`).join('');
    const redraw = () => {
      const metric = PARETO_METRICS.find(m => m.key === select.value) || PARETO_METRICS[0];
      document.getElementById('pareto-title').textContent = metric.label;
      drawHorizontalPareto(document.getElementById('pareto-chart'), data.characters, metric);
      renderParetoTable(document.getElementById('pareto-table'), data.characters, metric);
    };
    select.addEventListener('change', redraw);
    redraw();
  }
})();