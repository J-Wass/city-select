import { calculateResults } from '../scoring.js';
import { getCityMapSVG } from '../cityMaps.js';
import state from '../state.js';

function formatPop(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return n.toString();
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
  const modeLabel = state.mode === 'living' ? 'Live In' : 'Visit';

  container.innerHTML = `
    <div class="step-content results">
      <h2>Your Top Cities to ${modeLabel}</h2>
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

  // Insert all-cities table
  const allSection = buildAllCitiesSection(results, showModal);
  container.querySelector('#allCitiesAnchor').replaceWith(allSection);

  container.querySelector('#startOver').addEventListener('click', () => {
    state.mode = null;
    state.quizAnswers = {};
    state.rankOrder = [];
    state.results = [];
    state.prefLabels = {};
    onBack(true);
  });
}
