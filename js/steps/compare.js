import state from '../state.js';

const COLORS = ['#6c8cff', '#ffa94d', '#69db7c', '#ff6b6b', '#4dd4c6'];
const MAX_COMPARE = 5;

function formatPop(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return n.toString();
}

function sortCities(cities, sortKey, sortDir) {
  const dir = sortDir === 'desc' ? -1 : 1;
  return [...cities].sort((a, b) => {
    let left;
    let right;

    switch (sortKey) {
      case 'country':
      case 'region':
      case 'climate':
        left = a[sortKey] || '';
        right = b[sortKey] || '';
        break;
      case 'population':
      case 'gdpPerCapita':
        left = a[sortKey] || 0;
        right = b[sortKey] || 0;
        break;
      case 'name':
      default:
        left = a.name || '';
        right = b.name || '';
        break;
    }

    if (typeof left === 'number' && typeof right === 'number') {
      if (left === right) return (a.name || '').localeCompare(b.name || '') * dir;
      return (left - right) * dir;
    }

    const cmp = String(left).localeCompare(String(right));
    if (cmp === 0) return (a.name || '').localeCompare(b.name || '') * dir;
    return cmp * dir;
  });
}

export function render(container, onBack) {
  let selected = [];
  let quickQuery = '';
  let browserQuery = '';
  let regionFilter = 'all';
  let climateFilter = 'all';
  let sortKey = 'name';
  let sortDir = 'asc';

  function cellBg(s) {
    if (s >= 80) return 'rgba(105,219,124,0.18)';
    if (s >= 65) return 'rgba(105,219,124,0.07)';
    if (s >= 40) return 'transparent';
    if (s >= 25) return 'rgba(255,107,107,0.07)';
    return 'rgba(255,107,107,0.18)';
  }

  function selectedIds() {
    return new Set(selected.map(c => c.id));
  }

  function canAddMore() {
    return selected.length < MAX_COMPARE;
  }

  function addCityById(id) {
    if (!canAddMore() || selected.some(city => city.id === id)) return;
    const city = state.cities.find(c => c.id === id);
    if (!city) return;
    selected = [...selected, city];
    renderView();
  }

  function removeCityById(id) {
    selected = selected.filter(city => city.id !== id);
    renderView();
  }

  function sortIndicator(key) {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  function toggleSort(key) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = key === 'population' || key === 'gdpPerCapita' ? 'desc' : 'asc';
    }
    renderView();
  }

  function browserCities() {
    const query = browserQuery.trim().toLowerCase();
    const filtered = state.cities.filter(city => {
      if (regionFilter !== 'all' && city.region !== regionFilter) return false;
      if (climateFilter !== 'all' && city.climate !== climateFilter) return false;
      if (!query) return true;

      const haystack = [
        city.name,
        city.country,
        city.region,
        city.climate,
        city.nickname,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(query);
    });

    return sortCities(filtered, sortKey, sortDir);
  }

  function quickMatches() {
    const query = quickQuery.trim().toLowerCase();
    if (!query) return [];

    const chosen = selectedIds();
    return state.cities
      .filter(city => !chosen.has(city.id))
      .filter(city => (
        city.name.toLowerCase().includes(query) ||
        city.country.toLowerCase().includes(query) ||
        city.region.toLowerCase().includes(query)
      ))
      .slice(0, 10);
  }

  function buildComparisonTable() {
    const dims = state.dimensions;
    return `
      <div class="cmp-table-wrap">
        <table class="cmp-table">
          <thead>
            <tr>
              <th class="cmp-dim-th">Dimension</th>
              ${selected.map((city, i) => `
                <th class="cmp-city-th">
                  <span class="cmp-dot" style="background:${COLORS[i]}"></span>
                  <span class="cmp-city-nm">${city.name}</span>
                  <span class="cmp-city-sub">${city.country}</span>
                </th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${dims.map(dim => {
              const scores = selected.map(city => city.scores[dim.id] ?? 0);
              const max = Math.max(...scores);
              return `
                <tr>
                  <td class="cmp-dim-td" title="${dim.description}">${dim.label}</td>
                  ${selected.map((city, i) => {
                    const score = scores[i];
                    const isBest = score === max && scores.filter(value => value === max).length === 1;
                    return `
                      <td class="cmp-score-td${isBest ? ' cmp-best' : ''}" style="background:${cellBg(score)}">
                        <span class="cmp-val">${score}</span>
                        <div class="cmp-bar-wrap">
                          <div class="cmp-bar" style="width:${score}%;background:${COLORS[i]}"></div>
                        </div>
                      </td>`;
                  }).join('')}
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function buildBrowserTable(cities) {
    const chosen = selectedIds();
    return `
      <div class="cmp-browser-wrap">
        <div class="cmp-browser-meta">${cities.length} cities shown</div>
        <div class="cmp-browser-scroll">
          <table class="cmp-browser-table">
            <thead>
              <tr>
                <th class="cmp-browser-th cmp-browser-action-th">Compare</th>
                <th class="cmp-browser-th cmp-browser-sort" data-sort="name">City${sortIndicator('name')}</th>
                <th class="cmp-browser-th cmp-browser-sort" data-sort="country">Country${sortIndicator('country')}</th>
                <th class="cmp-browser-th cmp-browser-sort" data-sort="region">Region${sortIndicator('region')}</th>
                <th class="cmp-browser-th cmp-browser-sort" data-sort="climate">Climate${sortIndicator('climate')}</th>
                <th class="cmp-browser-th cmp-browser-sort" data-sort="population">Population${sortIndicator('population')}</th>
                <th class="cmp-browser-th cmp-browser-sort" data-sort="gdpPerCapita">GDP/cap${sortIndicator('gdpPerCapita')}</th>
              </tr>
            </thead>
            <tbody>
              ${cities.map(city => {
                const isSelected = chosen.has(city.id);
                const disabled = !isSelected && !canAddMore();
                const actionLabel = isSelected ? 'Remove' : 'Add';
                const actionClass = isSelected ? 'is-selected' : '';
                return `
                  <tr class="cmp-browser-row${isSelected ? ' is-selected' : ''}">
                    <td class="cmp-browser-td cmp-browser-action-td">
                      <button class="cmp-browser-action ${actionClass}" data-city-id="${city.id}" ${disabled ? 'disabled' : ''}>
                        ${actionLabel}
                      </button>
                    </td>
                    <td class="cmp-browser-td cmp-browser-city-td">
                      <span class="cmp-browser-city">${city.name}</span>
                      <span class="cmp-browser-sub">${city.nickname || city.country}</span>
                    </td>
                    <td class="cmp-browser-td">${city.country}</td>
                    <td class="cmp-browser-td">${city.region}</td>
                    <td class="cmp-browser-td"><span class="cmp-browser-pill">${city.climate}</span></td>
                    <td class="cmp-browser-td">${formatPop(city.population)}</td>
                    <td class="cmp-browser-td">$${city.gdpPerCapita}k</td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function regionOptions() {
    return [...new Set(state.cities.map(city => city.region).filter(Boolean))].sort();
  }

  function climateOptions() {
    return [...new Set(state.cities.map(city => city.climate).filter(Boolean))].sort();
  }

  function restoreInputState(id, start, end) {
    const input = container.querySelector(`#${id}`);
    if (!input) return;
    input.focus();
    if (typeof start === 'number' && typeof end === 'number') {
      input.setSelectionRange(start, end);
    }
  }

  function renderView() {
    const dropdownMatches = quickMatches();
    const citiesForBrowser = browserCities();

    container.innerHTML = `
      <div class="step-content compare">
        <h2>Compare Cities</h2>
        <p class="subtitle">Select up to ${MAX_COMPARE} cities to compare side-by-side on all dimensions.</p>

        <div class="cmp-toolbar">
          <div class="cmp-search-wrap">
            <input id="cmpSearch" class="cmp-search" type="text"
              placeholder="${canAddMore() ? 'Type a city name to add quickly...' : `Max ${MAX_COMPARE} cities selected`}"
              ${canAddMore() ? '' : 'disabled'} autocomplete="off" value="${quickQuery}">
            <div class="cmp-dropdown" id="cmpDropdown">
              ${quickQuery.trim() && canAddMore()
                ? (dropdownMatches.length
                    ? dropdownMatches.map(city => `<div class="cmp-dd-item" data-id="${city.id}">${city.name}, ${city.country}</div>`).join('')
                    : '<div class="cmp-dd-empty">No matches</div>')
                : ''}
            </div>
          </div>
          <div class="cmp-selection-count">${selected.length} / ${MAX_COMPARE} selected</div>
        </div>

        <div class="cmp-chips">
          ${selected.length === 0
            ? '<span class="cmp-hint">No cities selected yet - use quick search or the browser below.</span>'
            : selected.map((city, i) => `
                <span class="cmp-chip" style="border-color:${COLORS[i]}">
                  <span class="cmp-dot" style="background:${COLORS[i]}"></span>
                  ${city.name}, ${city.country}
                  <button class="cmp-chip-x" data-id="${city.id}" aria-label="Remove ${city.name}">x</button>
                </span>`).join('')}
        </div>

        ${selected.length > 0
          ? buildComparisonTable()
          : '<p class="cmp-placeholder">Pick cities from the quick search or browse all cities below to start comparing.</p>'}

        <div class="cmp-browser-section">
          <div class="cmp-browser-header">
            <div>
              <h3>Browse All Cities</h3>
              <p class="cmp-browser-subtitle">Filter and sort the full city list, then add any row directly into the comparison.</p>
            </div>
          </div>

          <div class="cmp-browser-controls">
            <input id="cmpBrowserQuery" class="cmp-browser-input" type="text" placeholder="Filter by city, country, region, climate..." value="${browserQuery}">
            <select id="cmpRegionFilter" class="cmp-browser-select">
              <option value="all">All regions</option>
              ${regionOptions().map(region => `<option value="${region}" ${region === regionFilter ? 'selected' : ''}>${region}</option>`).join('')}
            </select>
            <select id="cmpClimateFilter" class="cmp-browser-select">
              <option value="all">All climates</option>
              ${climateOptions().map(climate => `<option value="${climate}" ${climate === climateFilter ? 'selected' : ''}>${climate}</option>`).join('')}
            </select>
          </div>

          ${buildBrowserTable(citiesForBrowser)}
        </div>

        <div class="step-footer">
          <button class="btn btn-secondary" id="cmpBack">Back</button>
        </div>
      </div>`;

    container.querySelector('#cmpBack').addEventListener('click', onBack);

    const search = container.querySelector('#cmpSearch');
    const dropdown = container.querySelector('#cmpDropdown');
    if (search) {
      search.addEventListener('input', () => {
        const start = search.selectionStart;
        const end = search.selectionEnd;
        quickQuery = search.value;
        renderView();
        restoreInputState('cmpSearch', start, end);
      });
      search.addEventListener('blur', () => {
        setTimeout(() => {
          if (dropdown) dropdown.innerHTML = '';
        }, 160);
      });
    }

    container.querySelectorAll('.cmp-dd-item').forEach(item => {
      item.addEventListener('click', () => {
        quickQuery = '';
        addCityById(item.dataset.id);
      });
    });

    container.querySelectorAll('.cmp-chip-x').forEach(btn => {
      btn.addEventListener('click', () => {
        removeCityById(btn.dataset.id);
      });
    });

    const browserQueryInput = container.querySelector('#cmpBrowserQuery');
    browserQueryInput.addEventListener('input', () => {
      const start = browserQueryInput.selectionStart;
      const end = browserQueryInput.selectionEnd;
      browserQuery = browserQueryInput.value;
      renderView();
      restoreInputState('cmpBrowserQuery', start, end);
    });

    const regionSelect = container.querySelector('#cmpRegionFilter');
    regionSelect.addEventListener('change', () => {
      regionFilter = regionSelect.value;
      renderView();
    });

    const climateSelect = container.querySelector('#cmpClimateFilter');
    climateSelect.addEventListener('change', () => {
      climateFilter = climateSelect.value;
      renderView();
    });

    container.querySelectorAll('.cmp-browser-sort').forEach(th => {
      th.addEventListener('click', () => {
        toggleSort(th.dataset.sort);
      });
    });

    container.querySelectorAll('.cmp-browser-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const cityId = btn.dataset.cityId;
        if (selected.some(city => city.id === cityId)) {
          removeCityById(cityId);
        } else {
          addCityById(cityId);
        }
      });
    });
  }

  renderView();
}
