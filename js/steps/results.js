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

function buildModal(container) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <span class="modal-city-name"></span>
        <button class="modal-close-btn">&#x2715;</button>
      </div>
      <div class="modal-dims"></div>
    </div>
  `;
  container.appendChild(modal);

  const close = () => modal.classList.remove('active');
  modal.querySelector('.modal-close-btn').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  return modal;
}

function showCityModal(modal, result) {
  const city = result.city;
  modal.querySelector('.modal-city-name').textContent =
    `${city.name}, ${city.country}${city.nickname ? ` — "${city.nickname}"` : ''}`;

  // Show dimensions in user's priority order, non-rankable at the end
  const rankIndex = {};
  state.rankOrder.forEach((id, i) => { rankIndex[id] = i; });
  const sorted = [...state.dimensions].sort((a, b) =>
    (rankIndex[a.id] ?? 999) - (rankIndex[b.id] ?? 999)
  );

  modal.querySelector('.modal-dims').innerHTML = sorted.map(d => {
    const score = city.scores[d.id] ?? 0;
    const strengthItem = result.strengths.find(s => s.label === d.label);
    const weaknessItem = result.weaknesses.find(w => w.label === d.label);
    const isStrength = !!strengthItem;
    const isWeakness = !!weaknessItem;
    const barClass = isStrength ? 'good' : isWeakness ? 'bad' : '';

    const rankPos = rankIndex[d.id] !== undefined ? rankIndex[d.id] + 1 : null;
    const rankBadge = rankPos
      ? `<span class="modal-rank-badge">#${rankPos}</span>`
      : '';

    let tag = '';
    let contextDesc = d.description;
    if (isStrength) {
      tag = '<span class="modal-tag modal-tag-strength">strength</span>';
      contextDesc = rankPos
        ? `Strong score — your #${rankPos} priority`
        : 'Standout match for your preferences';
    } else if (isWeakness) {
      tag = '<span class="modal-tag modal-tag-weakness">priority gap</span>';
      contextDesc = rankPos
        ? `Low score despite being your #${rankPos} priority`
        : 'Low score relative to your preferences';
    }

    return `
      <div class="modal-dim-row">
        <div class="modal-dim-info">
          <div class="modal-dim-header">
            ${rankBadge}
            <span class="modal-dim-label">${d.label}</span>
            ${tag}
          </div>
          <span class="modal-dim-desc">${contextDesc}</span>
        </div>
        <div class="modal-bar-wrap">
          <div class="modal-bar ${barClass}" style="width:${score}%"></div>
        </div>
        <span class="modal-dim-val">${score}</span>
      </div>`;
  }).join('');

  modal.classList.add('active');
}

export function render(container, _onNext, onBack) {
  const results = calculateResults();
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
      <div class="results-actions step-footer">
        <button class="btn btn-secondary" id="startOver">Start Over</button>
      </div>
    </div>
  `;

  const modal = buildModal(container);

  container.querySelectorAll('.btn-summary').forEach(btn => {
    btn.addEventListener('click', () => {
      const result = results.find(r => r.city.id === btn.dataset.cityId);
      if (result) showCityModal(modal, result);
    });
  });

  container.querySelector('#startOver').addEventListener('click', () => {
    state.mode = null;
    state.quizAnswers = {};
    state.rankOrder = [];
    state.results = [];
    state.prefLabels = {};
    onBack(true);
  });
}
