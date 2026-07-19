function pageData() {
  return window.PAGE_DATA || {};
}
function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function drawAxes(ctx, width, height, pad, opts = {}) {
  ctx.strokeStyle = '#263955';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, height - pad.b); ctx.lineTo(width - pad.r, height - pad.b); ctx.stroke();
  const lines = opts.lines || 4;
  const max = opts.max || 0;
  ctx.fillStyle = '#8ea3bf';
  ctx.font = '12px Georgia';
  for (let i = 0; i <= lines; i++) {
    const y = pad.t + (height - pad.t - pad.b) * i / lines;
    ctx.strokeStyle = 'rgba(255,255,255,.09)';
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke();
    if (opts.values) {
      const value = max - (max * i / lines);
      ctx.fillStyle = '#8ea3bf';
      ctx.textAlign = 'right';
      ctx.fillText(value.toFixed(max >= 10 ? 0 : 1), pad.l - 10, y + 4);
      ctx.textAlign = 'left';
    }
  }
}
function drawBarChart(canvas, labels, series, title, yLabel, opts = {}) {
  if (!canvas || !labels.length) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width, height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const line = opts.line || null;
  const pad = {l: 58, r: line ? 70 : 24, t: 30, b: 72};
  const max = Math.max(1, ...series.flatMap(s => s.values.map(v => Math.max(0, v))));
  drawAxes(ctx, width, height, pad, {values: true, max});
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
  if (line && (line.values || []).length) {
    const lineMax = Math.max(1, ...line.values.map(v => Math.max(0, Number(v) || 0)));
    const xAt = i => pad.l + i * cluster + cluster / 2;
    const yAt = v => pad.t + (1 - (Number(v) || 0) / lineMax) * plotH;
    ctx.strokeStyle = line.color || css('--gold');
    ctx.lineWidth = 3;
    ctx.beginPath();
    line.values.forEach((v, i) => { const x = xAt(i), y = yAt(v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
    line.values.forEach((v, i) => {
      const x = xAt(i), y = yAt(v);
      ctx.fillStyle = line.color || css('--gold'); ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8edf6'; ctx.font = 'bold 10px Georgia'; ctx.textAlign = 'center'; ctx.fillText(Number(v).toFixed(1), x, y - 8); ctx.textAlign = 'left';
    });
    ctx.fillStyle = '#8ea3bf'; ctx.font = '12px Georgia';
    for (let i = 0; i <= 5; i++) {
      const value = lineMax - (lineMax * i / 5);
      const y = pad.t + plotH * i / 5;
      ctx.fillText(value.toFixed(lineMax >= 10 ? 0 : 1), width - pad.r + 8, y + 4);
    }
    ctx.save(); ctx.translate(width - 18, height / 2); ctx.rotate(Math.PI / 2); ctx.fillText(line.label || 'Total Score', 0, 0); ctx.restore();
  }
  ctx.fillStyle = '#e8edf6'; ctx.font = 'bold 16px Georgia'; ctx.fillText(title, pad.l, 20);
  ctx.fillStyle = '#8ea3bf'; ctx.font = '12px Georgia';
  labels.forEach((label, i) => {
    const x = pad.l + i * cluster + cluster / 2;
    ctx.save(); ctx.translate(x, height - 42); ctx.rotate(-0.55); ctx.textAlign = 'right'; ctx.fillText(label, 0, 0); ctx.restore();
  });
  ctx.save(); ctx.translate(16, height / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(yLabel, 0, 0); ctx.restore();
  if (!opts.hideLegend) {
    let lx = pad.l, ly = 34;
    series.forEach(s => { ctx.fillStyle = s.color; ctx.fillRect(lx, ly, 12, 8); ctx.fillStyle = '#e8edf6'; ctx.fillText(s.name, lx + 18, ly + 8); lx += ctx.measureText(s.name).width + 48; });
    if (line) { ctx.strokeStyle = line.color || css('--gold'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(lx, ly + 4); ctx.lineTo(lx + 18, ly + 4); ctx.stroke(); ctx.fillStyle = '#e8edf6'; ctx.fillText(line.name || line.label || 'Total Score', lx + 24, ly + 8); }
  }
}
function matchValueMap(matches) {
  const map = new Map();
  (matches || []).forEach(m => map.set(`${m.round} M${m.match}`, Number(m.score) || 0));
  return map;
}
function drawCustomBarChart(canvas, labels, values, colors, title, yLabel) {
  if (!canvas || !labels.length) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width, height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const pad = {l: 58, r: 24, t: 30, b: 72};
  const max = Math.max(0.01, ...values.map(v => Math.abs(v)));
  drawAxes(ctx, width, height, pad, {values: true, max});
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const barW = Math.max(8, plotW / labels.length * 0.65);
  values.forEach((v, i) => {
    const x = pad.l + i * (plotW / labels.length) + (plotW / labels.length) / 2;
    const h = Math.max(1, (Math.abs(v) / max) * plotH);
    ctx.fillStyle = colors[i] || '#c084fc';
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x - barW / 2, height - pad.b - h, barW, h);
    ctx.globalAlpha = 1;
    if (Math.abs(v) > 0.01) {
      ctx.fillStyle = '#e8edf6'; ctx.font = '9px Georgia'; ctx.textAlign = 'center';
      ctx.fillText(v.toFixed(2), x, height - pad.b - h - 4);
      ctx.textAlign = 'left';
    }
  });
  ctx.fillStyle = '#e8edf6'; ctx.font = 'bold 16px Georgia'; ctx.fillText(title, pad.l, 20);
  ctx.fillStyle = '#8ea3bf'; ctx.font = '11px Georgia';
  labels.forEach((label, i) => {
    const x = pad.l + i * (plotW / labels.length) + (plotW / labels.length) / 2;
    ctx.save(); ctx.translate(x, height - 42); ctx.rotate(-0.55); ctx.textAlign = 'right'; ctx.fillText(label, 0, 0); ctx.restore();
  });
  ctx.save(); ctx.translate(16, height / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(yLabel, 0, 0); ctx.restore();
}
function roundValueMap(roundTotals) {
  const map = new Map();
  (roundTotals || []).forEach(r => map.set(r.round, Number(r.score) || 0));
  return map;
}
function ranksByRoundMap(ranks) {
  const map = new Map();
  (ranks || []).forEach(r => map.set(r.roundLabel, r));
  return map;
}
function comparisonSeries(character) {
  const c = character.comparisons || {};
  return [
    c.rankPlus10 && {character: c.rankPlus10, color: '#ffd369', label: '+10 rank'},
    c.rankMinus10 && {character: c.rankMinus10, color: '#f87171', label: '-10 rank'},
    c.rankPlus5 && {character: c.rankPlus5, color: '#d6b04d', label: '+5 rank'},
    c.rankMinus5 && {character: c.rankMinus5, color: '#b85866', label: '-5 rank'}
  ].filter(Boolean);
}
function drawRankComparisonChart(canvas, character, title) {
  if (!canvas || !(character.ranks || []).length) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width, height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const pad = {l: 58, r: 24, t: 30, b: 72};
  const labels = character.ranks.map(p => p.roundLabel);
  const displayLabels = character.ranks.map(p => p.round);
  const allRanks = [character, ...comparisonSeries(character).map(s => s.character)].flatMap(c => (c.ranks || []).map(p => p.rank));
  const min = Math.max(1, Math.min(...allRanks) - 2), max = Math.min(86, Math.max(...allRanks) + 2);
  drawAxes(ctx, width, height, pad, {lines: 6});
  const xAt = i => pad.l + (width - pad.l - pad.r) * (labels.length === 1 ? .5 : i / (labels.length - 1));
  const yAt = r => pad.t + (r - min) / (max - min || 1) * (height - pad.t - pad.b);
  const drawSeries = (series, color, widthLine, alpha, dash = []) => {
    const rankMap = ranksByRoundMap(series.ranks);
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = widthLine; ctx.globalAlpha = alpha; ctx.setLineDash(dash); ctx.beginPath();
    let started = false;
    labels.forEach((label, i) => {
      if (!rankMap.has(label)) return;
      const x = xAt(i), y = yAt(rankMap.get(label).rank);
      started ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      started = true;
    });
    ctx.stroke(); ctx.restore();
  };
  comparisonSeries(character).forEach((series, index) => drawSeries(series.character, series.color, 2, .7, index < 2 ? [7, 5] : [2, 4]));
  drawSeries(character, css('--cyan'), 4, 1);
  const own = ranksByRoundMap(character.ranks);
  labels.forEach((label, i) => {
    if (!own.has(label)) return;
    const x = xAt(i), y = yAt(own.get(label).rank);
    ctx.fillStyle = css('--cyan'); ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8edf6'; ctx.font = 'bold 12px Georgia'; ctx.fillText(own.get(label).rank, x - 8, y - 11);
  });
  ctx.fillStyle = '#e8edf6'; ctx.font = 'bold 16px Georgia'; ctx.fillText(title, pad.l, 20);
  ctx.fillStyle = '#8ea3bf'; ctx.font = '12px Georgia';
  displayLabels.forEach((label, i) => { const x = xAt(i); ctx.save(); ctx.translate(x, height - 42); ctx.rotate(-0.55); ctx.textAlign = 'right'; ctx.fillText(label, 0, 0); ctx.restore(); });
  ctx.save(); ctx.translate(16, height / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('Rank (lower = better)', 0, 0); ctx.restore();
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
const ROUND_ORDER = {round_1:1, round_2:2, elimination_1:3, round_3:4, elimination_2:5, round_4:6, elimination_3:7, round_5:8};
function allRounds(chars) {
  const seen = new Map();
  chars.forEach(c => (c.ranks || []).forEach(p => { if (!seen.has(p.roundLabel)) seen.set(p.roundLabel, p.round); }));
  return Array.from(seen, ([roundLabel, round]) => ({roundLabel, round}))
    .sort((a, b) => (ROUND_ORDER[a.roundLabel] || 99) - (ROUND_ORDER[b.roundLabel] || 99));
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
function drawScoreAtlas(canvas, chars, highlightNames) {
  if (!canvas || !chars.length) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width, height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const highlightSet = new Set(highlightNames || []);
  const pad = {l: 76, r: 210, t: 40, b: 82};
  const rounds = allRounds(chars);
  const allScores = chars.flatMap(c => (c.matches || []).map(m => Number(m.accumulatedScore) || 0));
  const max = Math.max(1, ...allScores);
  const xAt = i => pad.l + (width - pad.l - pad.r) * (rounds.length === 1 ? .5 : i / (rounds.length - 1));
  const yAt = score => pad.t + (1 - score / max) * (height - pad.t - pad.b);
  drawAxes(ctx, width, height, pad, {values: true, max, lines: 8});
  ctx.fillStyle = '#e8edf6'; ctx.font = 'bold 18px Georgia'; ctx.fillText('Every Character Total Score Trajectory', pad.l, 24);
  rounds.forEach((r, i) => { const x = xAt(i); ctx.fillStyle = '#8ea3bf'; ctx.font = '13px Georgia'; ctx.save(); ctx.translate(x, height - 42); ctx.rotate(-0.45); ctx.textAlign = 'right'; ctx.fillText(r.round, 0, 0); ctx.restore(); });
  const colors = ['#00c8ff', '#ffd369', '#4ade80', '#f87171', '#b07aa1', '#76b7b2', '#edc948', '#e15759'];
  const highlightColors = ['#00c8ff', '#ffd369', '#4ade80', '#f87171', '#f0abfc', '#38bdf8', '#fb923c', '#c4b5fd'];
  let highlightIndex = 0;
  chars.forEach((c, ci) => {
    const map = new Map();
    (c.matches || []).forEach(m => map.set(m.roundLabel, Number(m.accumulatedScore) || 0));
    const isHi = highlightSet.has(c.name);
    const hiColor = highlightColors[highlightIndex % highlightColors.length];
    if (isHi) highlightIndex += 1;
    ctx.strokeStyle = isHi ? hiColor : colors[ci % colors.length];
    ctx.globalAlpha = isHi ? 1 : 0.14;
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
      let lastScore = null;
      rounds.forEach((r, i) => {
        if (!map.has(r.roundLabel)) return;
        const score = map.get(r.roundLabel);
        const x = xAt(i), y = yAt(score);
        lastScore = score;
        ctx.fillStyle = hiColor; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e8edf6'; ctx.font = 'bold 12px Georgia'; ctx.fillText(score.toFixed(1), x + 8, y - 8);
      });
      if (lastScore !== null) { ctx.fillStyle = hiColor; ctx.font = 'bold 15px Georgia'; ctx.fillText(`${c.name} ${lastScore.toFixed(1)}`, width - pad.r + 20, yAt(lastScore) + 5); }
    }
  });
}
function drawOppRankAtlas(canvas, opps, highlightNames) {
  if (!canvas || !opps.length) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width, height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const highlightSet = new Set(highlightNames || []);
  const pad = {l: 70, r: 190, t: 40, b: 82};
  const seen = new Map();
  opps.forEach(o => (o.oppRanks || []).forEach(p => { if (!seen.has(p.roundLabel)) seen.set(p.roundLabel, p.round); }));
  const rounds = Array.from(seen, ([rl, r]) => ({roundLabel: rl, round: r}))
    .sort((a, b) => (ROUND_ORDER[a.roundLabel] || 99) - (ROUND_ORDER[b.roundLabel] || 99));
  if (!rounds.length) return;
  const xAt = i => pad.l + (width - pad.l - pad.r) * (rounds.length === 1 ? .5 : i / (rounds.length - 1));
  const yAt = rank => pad.t + (rank - 1) / (opps.length - 1) * (height - pad.t - pad.b);
  drawAxes(ctx, width, height, pad, {lines: 8});
  ctx.fillStyle = '#e8edf6'; ctx.font = 'bold 18px Georgia'; ctx.fillText('Every Opponent Rank Trajectory', pad.l, 24);
  rounds.forEach((r, i) => { const x = xAt(i); ctx.fillStyle = '#8ea3bf'; ctx.font = '13px Georgia'; ctx.save(); ctx.translate(x, height - 42); ctx.rotate(-0.45); ctx.textAlign = 'right'; ctx.fillText(r.round, 0, 0); ctx.restore(); });
  const colors = ['#c084fc','#ffd369','#4ade80','#f87171','#b07aa1','#76b7b2','#edc948','#e15759'];
  const highlightColors = ['#c084fc','#ffd369','#4ade80','#f87171','#f0abfc','#38bdf8','#fb923c','#c4b5fd'];
  let highlightIndex = 0;
  opps.forEach((o, oi) => {
    const map = new Map((o.oppRanks || []).map(p => [p.roundLabel, p.rank]));
    const isHi = highlightSet.has(o.name);
    const hiColor = highlightColors[highlightIndex % highlightColors.length];
    if (isHi) highlightIndex++;
    ctx.strokeStyle = isHi ? hiColor : colors[oi % colors.length];
    ctx.globalAlpha = isHi ? 1 : 0.16; ctx.lineWidth = isHi ? 4 : 1.2;
    ctx.beginPath(); let started = false;
    rounds.forEach((r, i) => {
      if (!map.has(r.roundLabel)) return;
      const x = xAt(i), y = yAt(map.get(r.roundLabel));
      started ? ctx.lineTo(x, y) : ctx.moveTo(x, y); started = true;
    });
    ctx.stroke(); ctx.globalAlpha = 1;
    if (isHi) {
      rounds.forEach((r, i) => {
        if (!map.has(r.roundLabel)) return;
        const x = xAt(i), y = yAt(map.get(r.roundLabel));
        ctx.fillStyle = hiColor; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e8edf6'; ctx.font = 'bold 12px Georgia'; ctx.fillText(map.get(r.roundLabel), x - 8, y - 11);
      });
      const last = o.oppRanks[o.oppRanks.length - 1];
      ctx.fillStyle = hiColor; ctx.font = 'bold 15px Georgia'; ctx.fillText(`${o.displayName || o.name} #${last.rank}`, width - pad.r + 20, yAt(last.rank) + 5);
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
  node.innerHTML = sorted.slice(0, 24).map((c, i) => `<div class="pareto-row"><span>${i + 1}</span><a href="../${c.slug}/index.html">${c.displayName || c.name}</a><strong>${metric.format(c[metric.key])}</strong></div>`).join('');
}
(function init() {
  const data = pageData();
  if (data.characters && document.getElementById('overview-chart')) {
    const chars = data.characters.slice().sort((a, b) => a.rank - b.rank);
    // Build sorted round list from all characters' rank history
    const seenRds = new Map();
    chars.forEach(c => (c.ranks || []).forEach(r => { if (!seenRds.has(r.roundLabel)) seenRds.set(r.roundLabel, r.round); }));
    const roundList = Array.from(seenRds, ([rl, r]) => ({roundLabel: rl, round: r}))
      .sort((a, b) => (ROUND_ORDER[a.roundLabel] || 99) - (ROUND_ORDER[b.roundLabel] || 99));
    const defaultRound = roundList.length ? roundList[roundList.length - 1].roundLabel : 'current';

    function renderSmashRound(roundLabel) {
      document.querySelectorAll('.round-pill').forEach(btn => btn.classList.toggle('active', btn.dataset.round === roundLabel));
      let sorted;
      if (!roundLabel || roundLabel === 'current') {
        sorted = chars.map(c => ({...c, _rank: c.rank, _score: Number(c.score)}));
      } else {
        const upTo = ROUND_ORDER[roundLabel] || 99;
        sorted = chars.map(c => {
          const cumScore = (c.roundTotals || [])
            .filter(rt => (ROUND_ORDER[rt.roundLabel] || 0) <= upTo && (ROUND_ORDER[rt.roundLabel] || 0) > 0)
            .reduce((s, rt) => s + Number(rt.score), 0);
          return {...c, _score: cumScore};
        }).sort((a, b) => b._score - a._score).map((c, i) => ({...c, _rank: i + 1}));
      }
      const leaderEl = document.getElementById('smash-leader-list');
      if (leaderEl) {
        leaderEl.innerHTML = sorted.map(c =>
          `<li><span>#${c._rank}</span><a href="${c.slug}/index.html">${c.displayName || c.name}</a><strong>${c._score.toFixed(2)}</strong></li>`
        ).join('');
      }
      const top16 = sorted.slice(0, 16);
      drawBarChart(document.getElementById('overview-chart'),
        top16.map(c => c.displayName || c.name),
        [{name: 'Score', color: css('--cyan'), alpha: .9, values: top16.map(c => c._score)}],
        'Top 16 Score Spread', 'Score', {hideLegend: true});
    }

    const pillsEl = document.getElementById('round-pills');
    if (pillsEl) {
      roundList.forEach(r => {
        const btn = document.createElement('button');
        btn.className = 'round-pill' + (r.roundLabel === defaultRound ? ' active' : '');
        btn.dataset.round = r.roundLabel;
        btn.textContent = r.round;
        btn.addEventListener('click', () => renderSmashRound(r.roundLabel));
        pillsEl.appendChild(btn);
      });
    }
    renderSmashRound(defaultRound);
  }
  if (data.opponents && document.getElementById('opp-overview-chart')) {
    const opps = data.opponents.slice(0, 16);
    drawBarChart(document.getElementById('opp-overview-chart'), opps.map(o => o.displayName || o.name), [{name: 'Total NT Score', color: '#c084fc', alpha: .9, values: opps.map(o => Number(o.totalNtScore))}], 'Top 16 Opponent NT Scores', 'Total NT Score', {hideLegend: true});
  }
  if (data.character) {
    const c = data.character;
    const name = c.displayName || c.name;
    const matchLabels = c.matches.map(m => `${m.round} M${m.match}`);
    const matchSeries = comparisonSeries(c).slice(0, 2).map(s => {
      const values = matchValueMap(s.character.matches);
      return {name: `${s.character.displayName || s.character.name} ${s.label}`, color: s.color, alpha: .62, values: matchLabels.map(label => values.get(label) || 0)};
    });
    matchSeries.push({name, color: css('--cyan'), alpha: .95, values: c.matches.map(m => m.score)});
    drawBarChart(document.getElementById('match-chart'), matchLabels, matchSeries, 'Score Per Match', 'Score', {line: {name: `${name} Total`, label: 'Total Score', color: css('--gold'), values: c.matches.map(m => m.accumulatedScore)}});
    drawRankComparisonChart(document.getElementById('rank-chart'), c, 'Rank Trajectory');
    const roundLabels = c.roundTotals.map(r => r.round);
    const roundSeries = comparisonSeries(c).slice(2, 4).map(s => {
      const values = roundValueMap(s.character.roundTotals);
      return {name: `${s.character.displayName || s.character.name} ${s.label}`, color: s.color, alpha: .62, values: roundLabels.map(label => values.get(label) || 0)};
    });
    roundSeries.splice(1, 0, {name, color: css('--cyan'), alpha: .95, values: c.roundTotals.map(r => r.score)});
    drawBarChart(document.getElementById('round-chart'), roundLabels, roundSeries, 'Round Score Totals vs. Rank ±5', 'Score');

    // ── Opponent section ──────────────────────────────────────────────────
    const opp = c.opponent;
    if (opp && opp.totalAppearances) {
      const kpiWrap = document.getElementById('opp-kpis');
      if (kpiWrap) {
        const kpis = [
          ['Appearances', opp.totalAppearances],
          ['W / L', `${opp.wins} / ${opp.losses}`],
          ['Win Rate', `${(opp.winRate * 100).toFixed(0)}%`],
          ['Total NT', opp.totalNtScore.toFixed(2)],
          ['Avg NT', opp.avgNtScore.toFixed(3)],
        ];
        kpiWrap.innerHTML = kpis.map(([lbl, val]) =>
          `<div class="opp-kpi"><strong>${val}</strong><span>${lbl}</span></div>`
        ).join('');
      }
      const oppCanvas = document.getElementById('opp-chart');
      if (oppCanvas && opp.appearances.length) {
        const oppLabels = opp.appearances.map(a => a.against);
        const oppVals = opp.appearances.map(a => a.ntScore);
        const oppColors = opp.appearances.map(a => a.win ? '#4ade80' : '#f87171');
        drawCustomBarChart(oppCanvas, oppLabels, oppVals, oppColors, 'NT Score Per Appearance as Opponent  (green = won)', 'NT Score');
      }
      const oppRoundCanvas = document.getElementById('opp-round-chart');
      if (oppRoundCanvas && opp.roundTotals.length) {
        const oppRoundLabels = opp.roundTotals.map(r => r.round);
        const oppRoundVals = opp.roundTotals.map(r => r.ntScore);
        drawCustomBarChart(oppRoundCanvas, oppRoundLabels, oppRoundVals, Array(oppRoundVals.length).fill('#c084fc'), 'NT Score by Round as Opponent', 'Total NT Score');
      }
      const logEl = document.getElementById('opp-log');
      if (logEl) {
        logEl.innerHTML = opp.appearances.map(a =>
          `<div class="opp-row"><span class="opp-round">${a.round} M${a.matchNum}</span><span class="${a.win ? 'opp-win' : 'opp-loss'}">${a.win ? 'W' : 'L'}</span><span>vs ${a.against}</span><span class="opp-nt">${a.ntScore.toFixed(2)}</span></div>`
        ).join('');
      }
    }
  }
  if (data.characters && document.getElementById('rank-atlas-chart')) {
    const select = document.getElementById('rank-highlight');
    const chars = data.characters.slice().sort((a, b) => a.rank - b.rank);
    select.innerHTML = chars.map(c => `<option value="${c.name}">${c.displayName || c.name} (#${c.rank})</option>`).join('');
    if (select.options.length) select.options[0].selected = true;
    const selectedNames = () => Array.from(select.selectedOptions).map(option => option.value);
    const redraw = () => drawRankAtlas(document.getElementById('rank-atlas-chart'), chars, selectedNames());
    select.addEventListener('change', redraw);
    redraw();
  }
  if (data.opponents && document.getElementById('opp-rank-atlas-chart')) {
    const select = document.getElementById('opp-rank-highlight');
    const opps = data.opponents.slice().sort((a, b) => a.oppRank - b.oppRank);
    select.innerHTML = opps.map(o => `<option value="${o.name}">${o.displayName || o.name} (#${o.oppRank})</option>`).join('');
    if (select.options.length) select.options[0].selected = true;
    const selectedNames = () => Array.from(select.selectedOptions).map(opt => opt.value);
    const redraw = () => drawOppRankAtlas(document.getElementById('opp-rank-atlas-chart'), opps, selectedNames());
    select.addEventListener('change', redraw);
    redraw();
  }
  if (data.characters && document.getElementById('score-atlas-chart')) {
    const select = document.getElementById('score-highlight');
    const chars = data.characters.slice().sort((a, b) => a.rank - b.rank);
    select.innerHTML = chars.map(c => `<option value="${c.name}">${c.displayName || c.name} (#${c.rank})</option>`).join('');
    if (select.options.length) select.options[0].selected = true;
    const selectedNames = () => Array.from(select.selectedOptions).map(option => option.value);
    const redraw = () => drawScoreAtlas(document.getElementById('score-atlas-chart'), chars, selectedNames());
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