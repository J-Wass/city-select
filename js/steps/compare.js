import state from '../state.js';

const COLORS = ['#6c8cff', '#ffa94d', '#69db7c'];

export function render(container, onBack) {
  let selected = [];

  function cellBg(s) {
    if (s >= 80) return 'rgba(105,219,124,0.18)';
    if (s >= 65) return 'rgba(105,219,124,0.07)';
    if (s >= 40) return 'transparent';
    if (s >= 25) return 'rgba(255,107,107,0.07)';
    return 'rgba(255,107,107,0.18)';
  }

  function buildTable() {
    const dims = state.dimensions;
    return `
      <div class="cmp-table-wrap">
        <table class="cmp-table">
          <thead>
            <tr>
              <th class="cmp-dim-th">Dimension</th>
              ${selected.map((c, i) => `
                <th class="cmp-city-th">
                  <span class="cmp-dot" style="background:${COLORS[i]}"></span>
                  <span class="cmp-city-nm">${c.name}</span>
                  <span class="cmp-city-sub">${c.country}</span>
                </th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${dims.map(d => {
              const scores = selected.map(c => c.scores[d.id] ?? 0);
              const max = Math.max(...scores);
              return `
                <tr>
                  <td class="cmp-dim-td" title="${d.description}">${d.label}</td>
                  ${selected.map((c, i) => {
                    const s = scores[i];
                    const isBest = s === max && scores.filter(x => x === max).length === 1;
                    return `
                      <td class="cmp-score-td${isBest ? ' cmp-best' : ''}" style="background:${cellBg(s)}">
                        <span class="cmp-val">${s}</span>
                        <div class="cmp-bar-wrap">
                          <div class="cmp-bar" style="width:${s}%;background:${COLORS[i]}"></div>
                        </div>
                      </td>`;
                  }).join('')}
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function renderView() {
    container.innerHTML = `
      <div class="step-content compare">
        <h2>Compare Cities</h2>
        <p class="subtitle">Select up to 3 cities to compare side-by-side on all dimensions</p>

        <div class="cmp-search-wrap">
          <input id="cmpSearch" class="cmp-search" type="text"
            placeholder="${selected.length >= 3 ? 'Max 3 cities selected' : 'Type a city name…'}"
            ${selected.length >= 3 ? 'disabled' : ''} autocomplete="off">
          <div class="cmp-dropdown" id="cmpDropdown"></div>
        </div>

        <div class="cmp-chips">
          ${selected.length === 0
            ? '<span class="cmp-hint">No cities selected — search above to begin</span>'
            : selected.map((c, i) => `
                <span class="cmp-chip" style="border-color:${COLORS[i]}">
                  <span class="cmp-dot" style="background:${COLORS[i]}"></span>
                  ${c.name}, ${c.country}
                  <button class="cmp-chip-x" data-id="${c.id}">×</button>
                </span>`).join('')}
        </div>

        ${selected.length > 0
          ? buildTable()
          : '<p class="cmp-placeholder">Search for cities above to start comparing</p>'}

        <div class="step-footer">
          <button class="btn btn-secondary" id="cmpBack">Back</button>
        </div>
      </div>`;

    container.querySelector('#cmpBack').addEventListener('click', onBack);

    const search = container.querySelector('#cmpSearch');
    const dropdown = container.querySelector('#cmpDropdown');

    if (search && !search.disabled) {
      search.addEventListener('input', () => {
        const q = search.value.toLowerCase().trim();
        if (!q) { dropdown.innerHTML = ''; return; }
        const hits = state.cities
          .filter(c => !selected.some(s => s.id === c.id))
          .filter(c => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q))
          .slice(0, 10);
        dropdown.innerHTML = hits.length
          ? hits.map(c => `<div class="cmp-dd-item" data-id="${c.id}">${c.name}, ${c.country}</div>`).join('')
          : '<div class="cmp-dd-empty">No matches</div>';
        dropdown.querySelectorAll('.cmp-dd-item').forEach(item => {
          item.addEventListener('click', () => {
            const city = state.cities.find(c => c.id === item.dataset.id);
            if (city && selected.length < 3) { selected.push(city); renderView(); }
          });
        });
      });
      search.addEventListener('blur', () => setTimeout(() => { dropdown.innerHTML = ''; }, 160));
    }

    container.querySelectorAll('.cmp-chip-x').forEach(btn => {
      btn.addEventListener('click', () => {
        selected = selected.filter(c => c.id !== btn.dataset.id);
        renderView();
      });
    });
  }

  renderView();
}
