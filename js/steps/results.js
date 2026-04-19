import { calculateResults } from '../scoring.js';
import { getCityMapSVG } from '../cityMaps.js';
import state from '../state.js';

function formatPop(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return n.toString();
}

function formatDensity(n) {
  return `${Math.round(n).toLocaleString()}/km²`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function climateAccent(climate) {
  switch (climate) {
    case 'tropical': return '#48c78e';
    case 'subtropical': return '#ffb74d';
    case 'temperate': return '#6c8cff';
    case 'continental': return '#9682dc';
    case 'nordic': return '#82c8e6';
    case 'desert': return '#d28c3c';
    default: return '#8b8fa3';
  }
}

function exportRows(top5) {
  return top5.map((result, i) => ({
    rank: i + 1,
    name: result.city.name,
    country: result.city.country,
    region: result.city.region,
    climate: result.city.climate,
    score: result.score,
    population: formatPop(result.city.population),
    gdp: `$${result.city.gdpPerCapita}k`,
    density: formatDensity(result.city.density),
  }));
}

function buildExportMarkup(top5) {
  const rows = exportRows(top5);
  return `
    <div class="city-select-export-card">
      <div class="city-select-export-header">
        <div>
          <div class="city-select-export-kicker">City Select</div>
          <h1>Your Top 5 Cities</h1>
          <p>Personalized results based on your priorities and quiz answers.</p>
        </div>
        <div class="city-select-export-badge">${rows.length} cities</div>
      </div>
      <div class="city-select-export-list">
        ${rows.map(row => `
          <article class="city-select-export-row">
            <div class="city-select-export-rank">#${row.rank}</div>
            <div class="city-select-export-main">
              <div class="city-select-export-topline">
                <div>
                  <h2>${escapeHtml(row.name)}</h2>
                  <p>${escapeHtml(row.country)} · ${escapeHtml(row.region)}</p>
                </div>
                <div class="city-select-export-score">${row.score}% match</div>
              </div>
              <div class="city-select-export-stats">
                <span class="city-select-export-pill climate-${escapeHtml(row.climate)}">${escapeHtml(row.climate)}</span>
                <span class="city-select-export-pill">Pop ${row.population}</span>
                <span class="city-select-export-pill">GDP ${row.gdp}</span>
                <span class="city-select-export-pill">Density ${escapeHtml(row.density)}</span>
              </div>
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `.trim();
}

function buildExportDocument(top5) {
  const markup = buildExportMarkup(top5);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  :root {
    color-scheme: dark;
    --bg: #0f1117;
    --surface: #1a1d27;
    --border: #2a2d3a;
    --text: #e1e4ed;
    --text-muted: #8b8fa3;
    --accent: #6c8cff;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px;
    background:
      radial-gradient(circle at top left, rgba(108,140,255,0.2), transparent 34%),
      linear-gradient(180deg, #131722 0%, #0f1117 100%);
    font-family: "Segoe UI", Arial, sans-serif;
    color: var(--text);
  }
  .city-select-export-card {
    width: min(100%, 1120px);
    margin: 0 auto;
    padding: 24px;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 24px;
    background: rgba(26,29,39,0.92);
    box-shadow: 0 18px 50px rgba(0,0,0,0.35);
  }
  .city-select-export-header {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    align-items: flex-start;
    margin-bottom: 18px;
  }
  .city-select-export-kicker {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 8px;
  }
  .city-select-export-header h1 {
    margin: 0;
    font-size: 34px;
    line-height: 1.1;
  }
  .city-select-export-header p {
    margin: 8px 0 0;
    color: var(--text-muted);
    font-size: 15px;
  }
  .city-select-export-badge {
    flex-shrink: 0;
    padding: 10px 14px;
    border-radius: 999px;
    background: rgba(108,140,255,0.14);
    color: var(--accent);
    font-size: 13px;
    font-weight: 700;
  }
  .city-select-export-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .city-select-export-row {
    display: flex;
    gap: 16px;
    align-items: center;
    padding: 16px 18px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: rgba(255,255,255,0.03);
  }
  .city-select-export-rank {
    width: 58px;
    height: 58px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(108,140,255,0.26), rgba(108,140,255,0.08));
    color: var(--accent);
    font-size: 24px;
    font-weight: 800;
  }
  .city-select-export-main {
    flex: 1;
    min-width: 0;
  }
  .city-select-export-topline {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }
  .city-select-export-topline h2 {
    margin: 0;
    font-size: 22px;
    line-height: 1.15;
  }
  .city-select-export-topline p {
    margin: 5px 0 0;
    color: var(--text-muted);
    font-size: 14px;
  }
  .city-select-export-score {
    flex-shrink: 0;
    color: var(--text);
    font-size: 16px;
    font-weight: 800;
    white-space: nowrap;
  }
  .city-select-export-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  .city-select-export-pill {
    display: inline-flex;
    align-items: center;
    padding: 7px 10px;
    border-radius: 999px;
    background: rgba(255,255,255,0.06);
    color: var(--text);
    font-size: 12px;
    line-height: 1;
    border: 1px solid rgba(255,255,255,0.07);
    text-transform: capitalize;
  }
  .climate-tropical { color: #48c78e; }
  .climate-subtropical { color: #ffb74d; }
  .climate-temperate { color: #6c8cff; }
  .climate-continental { color: #9682dc; }
  .climate-nordic { color: #82c8e6; }
  .climate-desert { color: #d28c3c; }
  @media (max-width: 760px) {
    body { padding: 14px; }
    .city-select-export-card { padding: 16px; border-radius: 18px; }
    .city-select-export-header,
    .city-select-export-topline,
    .city-select-export-row { flex-direction: column; align-items: flex-start; }
    .city-select-export-rank { width: 48px; height: 48px; border-radius: 14px; font-size: 20px; }
    .city-select-export-header h1 { font-size: 28px; }
    .city-select-export-topline h2 { font-size: 20px; }
  }
</style>
</head>
<body>${markup}</body>
</html>`;
}

function buildEmbedCode(top5) {
  const doc = buildExportDocument(top5)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<iframe srcdoc="${doc}" loading="lazy" style="width:100%;max-width:1160px;height:720px;border:0;border-radius:24px;overflow:hidden;" title="City Select Top 5 Cities"></iframe>`;
}

function buildExportSVG(top5) {
  const rows = exportRows(top5);
  const width = 1200;
  const rowHeight = 118;
  const gap = 16;
  const headerHeight = 140;
  const padding = 40;
  const height = padding * 2 + headerHeight + (rows.length * rowHeight) + ((rows.length - 1) * gap);
  const rowWidth = width - padding * 2;
  const statPillWidth = 180;
  const statPillGap = 10;
  const statY = 72;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#131722"/>
      <stop offset="100%" stop-color="#0f1117"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.18" cy="0.08" r="0.7">
      <stop offset="0%" stop-color="#6c8cff" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="#6c8cff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>
  <rect x="${padding}" y="${padding}" width="${rowWidth}" height="${height - padding * 2}" rx="28" fill="#1a1d27" fill-opacity="0.94" stroke="#ffffff" stroke-opacity="0.08"/>
  <text x="${padding + 34}" y="${padding + 36}" fill="#6c8cff" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="2">CITY SELECT</text>
  <text x="${padding + 34}" y="${padding + 84}" fill="#e1e4ed" font-family="Segoe UI, Arial, sans-serif" font-size="40" font-weight="800">Your Top 5 Cities</text>
  <text x="${padding + 34}" y="${padding + 114}" fill="#8b8fa3" font-family="Segoe UI, Arial, sans-serif" font-size="18">Personalized results based on your priorities and quiz answers.</text>
  ${rows.map((row, i) => {
    const y = padding + headerHeight + i * (rowHeight + gap);
    const climateColor = climateAccent(row.climate);
    return `
      <g>
        <rect x="${padding + 24}" y="${y}" width="${rowWidth - 48}" height="${rowHeight}" rx="22" fill="#ffffff" fill-opacity="0.03" stroke="#2a2d3a"/>
        <rect x="${padding + 44}" y="${y + 22}" width="64" height="64" rx="18" fill="#6c8cff" fill-opacity="0.16" stroke="#6c8cff" stroke-opacity="0.20"/>
        <text x="${padding + 76}" y="${y + 62}" text-anchor="middle" fill="#6c8cff" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="800">#${row.rank}</text>
        <text x="${padding + 132}" y="${y + 42}" fill="#e1e4ed" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="700">${escapeXml(row.name)}</text>
        <text x="${padding + 132}" y="${y + 68}" fill="#8b8fa3" font-family="Segoe UI, Arial, sans-serif" font-size="16">${escapeXml(row.country)} · ${escapeXml(row.region)}</text>
        <text x="${padding + rowWidth - 72}" y="${y + 46}" text-anchor="end" fill="#e1e4ed" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="800">${row.score}% match</text>
        <g>
          <rect x="${padding + 132}" y="${y + statY}" width="${statPillWidth}" height="28" rx="14" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.07"/>
          <text x="${padding + 148}" y="${y + statY + 19}" fill="${climateColor}" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="700">${escapeXml(row.climate.toUpperCase())}</text>
          <rect x="${padding + 132 + statPillWidth + statPillGap}" y="${y + statY}" width="${statPillWidth}" height="28" rx="14" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.07"/>
          <text x="${padding + 148 + statPillWidth + statPillGap}" y="${y + statY + 19}" fill="#e1e4ed" font-family="Segoe UI, Arial, sans-serif" font-size="13">POP ${escapeXml(row.population)}</text>
          <rect x="${padding + 132 + (statPillWidth + statPillGap) * 2}" y="${y + statY}" width="${statPillWidth}" height="28" rx="14" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.07"/>
          <text x="${padding + 148 + (statPillWidth + statPillGap) * 2}" y="${y + statY + 19}" fill="#e1e4ed" font-family="Segoe UI, Arial, sans-serif" font-size="13">GDP ${escapeXml(row.gdp)}</text>
          <rect x="${padding + 132 + (statPillWidth + statPillGap) * 3}" y="${y + statY}" width="${statPillWidth}" height="28" rx="14" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.07"/>
          <text x="${padding + 148 + (statPillWidth + statPillGap) * 3}" y="${y + statY + 19}" fill="#e1e4ed" font-family="Segoe UI, Arial, sans-serif" font-size="13">DENSITY ${escapeXml(row.density)}</text>
        </g>
      </g>`;
  }).join('')}
</svg>`;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'absolute';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  document.body.removeChild(area);
}

async function downloadExportImage(top5) {
  const svg = buildExportSVG(top5);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();
    const loaded = new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    img.src = url;
    await loaded;

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!pngBlob) throw new Error('Canvas export failed');
    const downloadUrl = URL.createObjectURL(pngBlob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'city-select-top-5.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function whyText(item) {
  if (item.rankPos) return `#${item.rankPos} priority`;
  if (item.quizBoosted) return 'quiz priority';
  return '';
}

function weatherRow(city) {
  const s = city.scores;
  const bars = [
    { label: 'Sun',    val: s.sunshine,     cls: 'weather-sun',    lo: 'overcast', hi: 'sunny' },
    { label: 'Rain',   val: s.rainfall,     cls: 'weather-rain',   lo: 'dry',      hi: 'rainy' },
    { label: 'Winter', val: s.winterWarmth, cls: 'weather-winter', lo: 'harsh',    hi: 'mild' },
    { label: 'Humid',  val: s.humidity,     cls: 'weather-humid',  lo: 'arid',     hi: 'humid' },
  ];
  return `
    <div class="city-weather">
      <span class="climate-badge climate-${city.climate}">${city.climate}</span>
      <div class="weather-bars">
        ${bars.map(b => `
          <div class="weather-bar-group">
            <div class="weather-bar-header">
              <span class="weather-label">${b.label}</span>
              <span class="weather-val">${b.val}</span>
            </div>
            <div class="weather-track">
              <div class="weather-fill ${b.cls}" style="width:${b.val}%"></div>
            </div>
            <div class="weather-legend">
              <span>${b.lo}</span>
              <span>${b.hi}</span>
            </div>
          </div>`).join('')}
      </div>
    </div>
  `;
}

function dimRow(item, type) {
  const why = whyText(item);
  return `
    <div class="dim-row ${type}">
      <div class="dim-label-col">
        <span class="dim-name" title="${item.label}">${item.label}</span>
        ${why ? `<span class="dim-why">${why}</span>` : ''}
      </div>
      <div class="dim-bar-wrap">
        <div class="dim-bar ${type}" style="width:${item.score}%"></div>
      </div>
      <span class="dim-val">${item.score}</span>
    </div>`;
}

// ─── Stat rank helpers ───────────────────────────────────────────────────────

function computeStatRanks() {
  const cities = state.cities;
  const rankMap = arr => Object.fromEntries(arr.map((c, i) => [c.id, i + 1]));
  return {
    pop:     rankMap([...cities].sort((a, b) => b.population    - a.population)),
    density: rankMap([...cities].sort((a, b) => b.density       - a.density)),
    gdp:     rankMap([...cities].sort((a, b) => b.gdpPerCapita  - a.gdpPerCapita)),
  };
}

function climateScale(label, lo, hi, val, fromColor, toColor) {
  return `
    <div class="cs-row">
      <span class="cs-label">${label}</span>
      <div class="cs-track-wrap">
        <div class="cs-track" style="background:linear-gradient(to right,${fromColor},${toColor})">
          <div class="cs-dot" style="left:${val}%"></div>
        </div>
        <div class="cs-extremes"><span>${lo}</span><span>${hi}</span></div>
      </div>
      <span class="cs-val">${val}</span>
    </div>`;
}

// ─── Modal build & show ──────────────────────────────────────────────────────

function buildModal(container) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card">
      <button class="modal-close-btn" aria-label="Close">&#x2715;</button>

      <div class="modal-hero">
        <div class="modal-map-container"></div>
        <div class="modal-hero-overlay">
          <div class="modal-hero-info">
            <div class="modal-city-name"></div>
            <div class="modal-hero-meta"></div>
          </div>
          <div class="modal-hero-score-wrap">
            <div class="modal-hero-pct"></div>
            <div class="modal-hero-rank"></div>
          </div>
        </div>
      </div>

      <div class="modal-scroll">
        <div class="modal-db-banner" hidden></div>
        <div class="modal-two-col">
          <div class="modal-left-panel">
            <div class="modal-stats-grid"></div>
            <div class="modal-climate-section">
              <div class="modal-section-heading">Climate</div>
              <div class="modal-climate-badge-wrap"></div>
              <div class="modal-climate-scales"></div>
            </div>
          </div>
          <div class="modal-right-panel">
            <div class="modal-section-heading">Dimensions</div>
            <div class="modal-dims"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  container.appendChild(modal);

  const close = () => modal.classList.remove('active');
  modal.querySelector('.modal-close-btn').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  return modal;
}

function showCityModal(modal, result, matchRank, statRanks) {
  const city = result.city;
  const sc = city.scores;
  const n = state.cities.length;

  // Reset scroll
  modal.querySelector('.modal-scroll').scrollTop = 0;

  // Map
  modal.querySelector('.modal-map-container').innerHTML = getCityMapSVG(city);

  // Hero text
  modal.querySelector('.modal-city-name').textContent = city.name;
  modal.querySelector('.modal-hero-meta').textContent =
    [city.country, city.region, city.nickname ? `"${city.nickname}"` : ''].filter(Boolean).join(' · ');
  modal.querySelector('.modal-hero-pct').textContent = `${result.score}%`;
  modal.querySelector('.modal-hero-rank').textContent = matchRank ? `#${matchRank} match` : '';

  // Dealbreaker banner
  const banner = modal.querySelector('.modal-db-banner');
  const dbDims = result.violatedDealbreakers || [];
  if (dbDims.length > 0) {
    const labels = dbDims.map(id => {
      const d = state.dimensions.find(d => d.id === id);
      return d ? d.label : id;
    });
    banner.textContent = `✕ Dealbreaker: ${labels.join(', ')} scored too low`;
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }

  // Stats grid
  modal.querySelector('.modal-stats-grid').innerHTML = `
    <div class="modal-stat">
      <span class="modal-stat-label">Population</span>
      <span class="modal-stat-value">${formatPop(city.population)}</span>
      <span class="modal-stat-rank">#${statRanks.pop[city.id]} of ${n}</span>
    </div>
    <div class="modal-stat">
      <span class="modal-stat-label">Density</span>
      <span class="modal-stat-value">${city.density.toLocaleString()}<span class="modal-stat-unit">/km²</span></span>
      <span class="modal-stat-rank">#${statRanks.density[city.id]} of ${n}</span>
    </div>
    <div class="modal-stat">
      <span class="modal-stat-label">GDP / capita</span>
      <span class="modal-stat-value">$${city.gdpPerCapita}k</span>
      <span class="modal-stat-rank">#${statRanks.gdp[city.id]} of ${n}</span>
    </div>
    <div class="modal-stat">
      <span class="modal-stat-label">Region</span>
      <span class="modal-stat-value modal-stat-region">${city.region}</span>
      <span class="modal-stat-rank">${city.country}</span>
    </div>`;

  // Climate
  modal.querySelector('.modal-climate-badge-wrap').innerHTML =
    `<span class="climate-badge climate-${city.climate}">${city.climate}</span>`;
  modal.querySelector('.modal-climate-scales').innerHTML =
    climateScale('Temperature', 'Cold', 'Hot',     sc.winterWarmth, '#7bb8e8', '#e87a3a') +
    climateScale('Humidity',    'Dry',  'Humid',   sc.humidity,     '#c9b992', '#6aadca') +
    climateScale('Sunshine',    'Grey', 'Sunny',   sc.sunshine,     '#8899aa', '#f5c842') +
    climateScale('Rainfall',    'Dry',  'Rainy',   sc.rainfall,     '#c9b992', '#4ea3d4');

  // Dimensions
  const rankIndex = {};
  state.rankOrder.forEach((id, i) => { rankIndex[id] = i; });
  const dimsSorted = [...state.dimensions].sort((a, b) =>
    (rankIndex[a.id] ?? 999) - (rankIndex[b.id] ?? 999)
  );

  modal.querySelector('.modal-dims').innerHTML = dimsSorted.map(d => {
    const score = city.scores[d.id] ?? 0;
    const isStrength = result.strengths.some(s => s.label === d.label);
    const isWeakness = result.weaknesses.some(w => w.label === d.label);
    const barClass = isStrength ? 'good' : isWeakness ? 'bad' : '';

    const rankPos = rankIndex[d.id] !== undefined ? rankIndex[d.id] + 1 : null;
    const rankBadge = rankPos ? `<span class="modal-rank-badge">#${rankPos}</span>` : '';

    let tag = '', contextDesc = d.description;
    if (isStrength) {
      tag = '<span class="modal-tag modal-tag-strength">strength</span>';
      contextDesc = rankPos ? `Strong score — your #${rankPos} priority` : 'Standout match for your preferences';
    } else if (isWeakness) {
      tag = '<span class="modal-tag modal-tag-weakness">priority gap</span>';
      contextDesc = rankPos ? `Low score despite being your #${rankPos} priority` : 'Low score relative to your preferences';
    }

    return `
      <div class="modal-dim-row">
        <div class="modal-dim-info">
          <div class="modal-dim-header">${rankBadge}<span class="modal-dim-label">${d.label}</span>${tag}</div>
          <span class="modal-dim-desc">${contextDesc}</span>
        </div>
        <div class="modal-bar-wrap"><div class="modal-bar ${barClass}" style="width:${score}%"></div></div>
        <span class="modal-dim-val">${score}</span>
      </div>`;
  }).join('');

  modal.classList.add('active');
}

// ─── All-cities ranked table ────────────────────────────────────────────────

function buildAllCitiesSection(results, showModal) {
  const dims = state.dimensions;
  let sortKey = null;   // null = default match-score order
  let sortAsc = false;

  function cellBg(s) {
    if (s >= 80) return 'rgba(105,219,124,0.18)';
    if (s >= 65) return 'rgba(105,219,124,0.07)';
    if (s >= 40) return '';
    if (s >= 25) return 'rgba(255,107,107,0.07)';
    return 'rgba(255,107,107,0.18)';
  }

  function getSorted() {
    if (!sortKey) return results;
    return [...results].sort((a, b) => {
      let va, vb;
      if (sortKey === 'name') {
        const cmp = a.city.name.localeCompare(b.city.name);
        return sortAsc ? cmp : -cmp;
      }
      va = sortKey === 'score' ? a.score : (a.city.scores[sortKey] ?? 0);
      vb = sortKey === 'score' ? b.score : (b.city.scores[sortKey] ?? 0);
      return sortAsc ? va - vb : vb - va;
    });
  }

  function sortArrow(key) {
    return sortKey === key ? (sortAsc ? ' ▴' : ' ▾') : '';
  }

  const dimLabelOf = Object.fromEntries(dims.map(d => [d.id, d.label]));

  function renderTable(head, body) {
    const sorted = getSorted();

    head.innerHTML = `
      <tr>
        <th class="ac-th ac-sticky ac-rank-th"></th>
        <th class="ac-th ac-sticky ac-name-th ac-sortable" data-sort="name">
          City${sortArrow('name')}
        </th>
        <th class="ac-th ac-sortable" data-sort="score">Match${sortArrow('score')}</th>
        ${dims.map(d => `
          <th class="ac-th ac-sortable ac-dim-th" data-sort="${d.id}" title="${d.description}">
            ${d.label}${sortArrow(d.id)}
          </th>`).join('')}
      </tr>`;

    body.innerHTML = sorted.map((r, i) => {
      const dbLabels = (r.violatedDealbreakers || []).map(id => dimLabelOf[id] || id);
      const dbFlag = dbLabels.length > 0
        ? `<span class="ac-db-flag">✕ ${dbLabels.join(', ')}</span>`
        : '';
      return `
      <tr class="ac-row${dbLabels.length > 0 ? ' ac-row-db' : ''}" data-city-id="${r.city.id}">
        <td class="ac-td ac-sticky ac-rank-td">#${i + 1}</td>
        <td class="ac-td ac-sticky ac-name-td">
          ${r.city.name}<br><span class="ac-country">${r.city.country}</span>${dbFlag}
        </td>
        <td class="ac-td ac-score-td" style="background:${cellBg(r.score)}">
          <span class="ac-num">${r.score}</span>
          <div class="ac-mini-bar" style="width:${r.score}%;background:var(--accent)"></div>
        </td>
        ${dims.map(d => {
          const s = r.city.scores[d.id] ?? 0;
          return `<td class="ac-td ac-dim-td" style="background:${cellBg(s)}">
            <span class="ac-num">${s}</span>
            <div class="ac-mini-bar" style="width:${s}%"></div>
          </td>`;
        }).join('')}
      </tr>`;
    }).join('');

    // Sort header clicks
    head.querySelectorAll('.ac-sortable').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (sortKey === key) { sortAsc = !sortAsc; } else { sortKey = key; sortAsc = false; }
        renderTable(head, body);
      });
    });

    // Row click → modal
    body.querySelectorAll('.ac-row').forEach(row => {
      row.addEventListener('click', () => {
        const result = results.find(r => r.city.id === row.dataset.cityId);
        if (result) showModal(result);
      });
    });
  }

  const total = results.length;
  const dbCount = results.filter(r => r.violatedDealbreakers?.length > 0).length;
  const rankedLabel = dbCount > 0
    ? `All ${total} cities ranked (${dbCount} fail your dealbreakers)`
    : `All ${total} cities ranked`;

  const section = document.createElement('div');
  section.className = 'all-cities-section';
  section.innerHTML = `
    <button class="all-cities-toggle" id="acToggle">
      ${rankedLabel} ▾
    </button>
    <div class="ac-wrap" id="acWrap" hidden>
      <p class="ac-mobile-hint">Tap any row for full breakdown</p>
      <div class="ac-scroll">
        <table class="ac-table">
          <thead id="acHead"></thead>
          <tbody id="acBody"></tbody>
        </table>
      </div>
    </div>`;

  const toggle = section.querySelector('#acToggle');
  const wrap = section.querySelector('#acWrap');
  const head = section.querySelector('#acHead');
  const body = section.querySelector('#acBody');

  toggle.addEventListener('click', () => {
    const opening = wrap.hidden;
    wrap.hidden = !opening;
    toggle.textContent = opening
      ? `${rankedLabel} ▴`
      : `${rankedLabel} ▾`;
    if (opening) renderTable(head, body);
  });

  return section;
}

// ─── Main render ─────────────────────────────────────────────────────────────

export function render(container, _onNext, onBack) {
  const results = calculateResults();
  const statRanks = computeStatRanks();
  const matchRankOf = Object.fromEntries(results.map((r, i) => [r.city.id, i + 1]));
  const top5 = results.slice(0, 5);
  const embedCode = top5.length > 0 ? buildEmbedCode(top5) : '';

  container.innerHTML = `
    <div class="step-content results">
      <h2>Your Top Cities</h2>
      <div class="results-list">
        ${top5.length === 0 ? '<p class="no-results">No cities matched your criteria. Try removing some dealbreakers.</p>' : ''}
        ${top5.map((r, i) => `
          <div class="result-card">
            <div class="result-map-col">
              ${getCityMapSVG(r.city)}
              <div class="map-rank">#${i + 1}</div>
              <div class="map-stats">
                <div class="map-stat-row"><b>${formatPop(r.city.population)}</b> pop.</div>
                <div class="map-stat-row"><b>$${r.city.gdpPerCapita}k</b> GDP/cap</div>
                <div class="map-stat-row"><b>${r.city.density.toLocaleString()}</b>/km²</div>
              </div>
            </div>
            <div class="result-info">
              <h3>${r.city.name}, ${r.city.country}</h3>
              ${r.city.nickname ? `<p class="city-nickname">"${r.city.nickname}"</p>` : ''}
              <div class="result-score">
                <div class="score-bar">
                  <div class="score-fill" style="width: ${r.score}%"></div>
                </div>
                <span class="score-label">${r.score}% match</span>
              </div>
              ${weatherRow(r.city)}
              <div class="result-columns">
                <div class="strengths">
                  <strong>Strengths</strong>
                  ${r.strengths.map(s => dimRow(s, 'good')).join('')}
                </div>
                <div class="weaknesses">
                  <strong>Weaknesses</strong>
                  ${r.weaknesses.map(w => dimRow(w, 'bad')).join('')}
                </div>
              </div>
              <button class="btn-summary" data-city-id="${r.city.id}">All dimensions</button>
            </div>
          </div>
        `).join('')}
      </div>

      ${top5.length > 0 ? `
        <section class="export-panel">
          <div class="export-panel-header">
            <div>
              <h3>Export Your Top 5</h3>
              <p>Download a shareable image or copy an embed that includes your top five cities and key stats.</p>
            </div>
          </div>
          <div class="export-panel-actions">
            <button class="btn btn-primary" id="downloadExportImage">Download Image</button>
            <button class="btn btn-secondary" id="copyEmbedCode">Copy Embed</button>
            <button class="btn btn-secondary" id="toggleEmbedCode">Show Embed Code</button>
          </div>
          <p class="export-status" id="exportStatus" aria-live="polite"></p>
          <div class="export-code-wrap" id="exportCodeWrap" hidden>
            <textarea class="export-code" id="exportCode" readonly>${escapeHtml(embedCode)}</textarea>
          </div>
        </section>
      ` : ''}

      <div id="allCitiesAnchor"></div>

      <div class="results-actions step-footer">
        <button class="btn btn-secondary" id="startOver">Start Over</button>
      </div>
    </div>
  `;

  const modal = buildModal(container);
  const showModal = result =>
    showCityModal(modal, result, matchRankOf[result.city.id] || null, statRanks);

  container.querySelectorAll('.btn-summary').forEach(btn => {
    btn.addEventListener('click', () => {
      const result = results.find(r => r.city.id === btn.dataset.cityId);
      if (result) showModal(result);
    });
  });

  if (top5.length > 0) {
    const exportStatus = container.querySelector('#exportStatus');
    const exportCodeWrap = container.querySelector('#exportCodeWrap');
    const exportCode = container.querySelector('#exportCode');
    const toggleEmbedBtn = container.querySelector('#toggleEmbedCode');

    const setExportStatus = message => {
      exportStatus.textContent = message;
    };

    exportCode.value = embedCode;

    container.querySelector('#downloadExportImage').addEventListener('click', async () => {
      setExportStatus('Preparing image...');
      try {
        await downloadExportImage(top5);
        setExportStatus('Image downloaded.');
      } catch (err) {
        console.error(err);
        setExportStatus('Image export failed. Please try again.');
      }
    });

    container.querySelector('#copyEmbedCode').addEventListener('click', async () => {
      try {
        await copyText(embedCode);
        setExportStatus('Embed code copied to clipboard.');
      } catch (err) {
        console.error(err);
        setExportStatus('Embed copy failed. Please copy the code manually.');
        exportCodeWrap.hidden = false;
        toggleEmbedBtn.textContent = 'Hide Embed Code';
      }
    });

    toggleEmbedBtn.addEventListener('click', () => {
      const opening = exportCodeWrap.hidden;
      exportCodeWrap.hidden = !opening;
      toggleEmbedBtn.textContent = opening ? 'Hide Embed Code' : 'Show Embed Code';
      if (opening) {
        exportCode.focus();
        exportCode.select();
      }
    });
  }

  // Insert all-cities table
  const allSection = buildAllCitiesSection(results, showModal);
  container.querySelector('#allCitiesAnchor').replaceWith(allSection);

  container.querySelector('#startOver').addEventListener('click', () => {
    state.quizAnswers = {};
    state.rankOrder = [];
    state.results = [];
    state.prefLabels = {};
    onBack(true);
  });
}
