import state from '../state.js';
import { continentList, continentIcon, countryList, continentOf } from '../geo.js';

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function render(container, onNext, onBack) {
  // Work on a copy so a Back click leaves the committed scope untouched.
  let mode = state.scope.type;            // 'all' | 'continent' | 'country'
  let selected = new Set(state.scope.values);
  let countryQuery = '';

  const continents = continentList(state.cities);
  const countries = countryList(state.cities);

  function matchingCityCount() {
    if (mode === 'all' || selected.size === 0) return state.cities.length;
    return state.cities.filter(city =>
      selected.has(mode === 'continent' ? continentOf(city) : city.country)).length;
  }

  function continentsMarkup() {
    return `
      <div class="scope-grid">
        ${continents.map(c => `
          <button class="scope-chip ${selected.has(c.name) ? 'selected' : ''}" data-value="${escapeHtml(c.name)}">
            <span class="scope-chip-icon">${continentIcon(c.name)}</span>
            <span class="scope-chip-label">${escapeHtml(c.name)}</span>
            <span class="scope-chip-count">${c.count} cities</span>
          </button>
        `).join('')}
      </div>`;
  }

  function countriesMarkup() {
    const query = countryQuery.trim().toLowerCase();
    const visible = countries.filter(c =>
      !query || c.name.toLowerCase().includes(query) || c.continent.toLowerCase().includes(query));

    const groups = [];
    for (const country of visible) {
      const last = groups[groups.length - 1];
      if (last && last.continent === country.continent) last.items.push(country);
      else groups.push({ continent: country.continent, items: [country] });
    }

    return `
      <input id="scopeCountryQuery" class="scope-search" type="text"
             placeholder="Search countries..." value="${escapeHtml(countryQuery)}">
      <div class="scope-country-list">
        ${visible.length === 0 ? '<p class="scope-empty">No countries match that search.</p>' : ''}
        ${groups.map(g => `
          <div class="scope-country-group">
            <div class="scope-country-group-title">${continentIcon(g.continent)} ${escapeHtml(g.continent)}</div>
            <div class="scope-grid scope-grid-compact">
              ${g.items.map(c => `
                <button class="scope-chip scope-chip-sm ${selected.has(c.name) ? 'selected' : ''}" data-value="${escapeHtml(c.name)}">
                  <span class="scope-chip-label">${escapeHtml(c.name)}</span>
                  <span class="scope-chip-count">${c.count}</span>
                </button>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>`;
  }

  function draw() {
    const count = matchingCityCount();
    container.innerHTML = `
      <div class="step-content scope-select">
        <h2>Where are you looking?</h2>
        <p class="subtitle">Optional — narrow the search to a continent or specific countries, or skip to search the whole world.</p>

        <div class="scope-tabs" role="tablist">
          <button class="scope-tab ${mode === 'all' ? 'active' : ''}" data-mode="all">🌐 Anywhere</button>
          <button class="scope-tab ${mode === 'continent' ? 'active' : ''}" data-mode="continent">Continent</button>
          <button class="scope-tab ${mode === 'country' ? 'active' : ''}" data-mode="country">Country</button>
        </div>

        <div class="scope-body" id="scopeBody">
          ${mode === 'all'
            ? `<p class="scope-all-note">Searching all ${state.cities.length} cities worldwide.</p>`
            : mode === 'continent' ? continentsMarkup() : countriesMarkup()}
        </div>

        <p class="scope-summary" aria-live="polite">
          ${mode === 'all' || selected.size === 0
            ? `No filter — all ${state.cities.length} cities in play.`
            : `${selected.size} selected · ${count} ${count === 1 ? 'city' : 'cities'} in play`}
        </p>

        <div class="step-footer scope-footer">
          <button class="btn btn-secondary" id="scopeBack">Back</button>
          ${mode !== 'all' && selected.size > 0
            ? '<button class="btn btn-secondary" id="scopeClear">Clear</button>' : ''}
          <button class="btn btn-primary" id="scopeNext">
            ${mode === 'all' || selected.size === 0 ? 'Search Anywhere' : 'Continue'}
          </button>
        </div>
      </div>
    `;

    container.querySelectorAll('.scope-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        if (tab.dataset.mode === mode) return;
        mode = tab.dataset.mode;
        selected = new Set(); // continents and countries aren't mixed
        countryQuery = '';
        draw();
      });
    });

    container.querySelectorAll('.scope-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const value = chip.dataset.value;
        if (selected.has(value)) selected.delete(value);
        else selected.add(value);
        draw();
        // Keep the search box focused while picking countries.
        const search = container.querySelector('#scopeCountryQuery');
        if (search) {
          search.focus();
          search.setSelectionRange(search.value.length, search.value.length);
        }
      });
    });

    const search = container.querySelector('#scopeCountryQuery');
    if (search) {
      search.addEventListener('input', () => {
        countryQuery = search.value;
        const body = container.querySelector('#scopeBody');
        body.innerHTML = countriesMarkup();
        bindCountryBody();
      });
    }

    function bindCountryBody() {
      const input = container.querySelector('#scopeCountryQuery');
      if (input) {
        input.value = countryQuery;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        input.addEventListener('input', () => {
          countryQuery = input.value;
          const body = container.querySelector('#scopeBody');
          body.innerHTML = countriesMarkup();
          bindCountryBody();
        });
      }
      container.querySelectorAll('.scope-country-list .scope-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const value = chip.dataset.value;
          if (selected.has(value)) selected.delete(value);
          else selected.add(value);
          draw();
        });
      });
    }

    const clearBtn = container.querySelector('#scopeClear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        selected = new Set();
        draw();
      });
    }

    container.querySelector('#scopeBack').addEventListener('click', () => onBack());

    container.querySelector('#scopeNext').addEventListener('click', () => {
      state.scope = (mode === 'all' || selected.size === 0)
        ? { type: 'all', values: [] }
        : { type: mode, values: [...selected] };
      onNext();
    });
  }

  draw();
}
