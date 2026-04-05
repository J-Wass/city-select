import state from '../state.js';

export function render(container, onNext, onBack) {
  const rankable = state.dimensions.filter(d => d.rankable);
  const weightKey = state.mode === 'living' ? 'livingWeight' : 'visitingWeight';
  const sorted = [...rankable].sort((a, b) => b[weightKey] - a[weightKey]);
  state.rankOrder = sorted.map(d => d.id);

  const rankableCount = rankable.length;
  const t1 = Math.ceil(rankableCount / 3);
  const t2 = Math.ceil(rankableCount * 2 / 3);
  const tierLabels = [
    { start: 0, end: t1, label: 'Critical', cls: 'tier-critical' },
    { start: t1, end: t2, label: 'Important', cls: 'tier-important' },
    { start: t2, end: rankableCount, label: 'Nice to Have', cls: 'tier-nice' },
  ];

  container.innerHTML = `
    <div class="step-content priority-rank">
      <h2>Rank Your Priorities</h2>
      <p class="subtitle">Drag to reorder. Top items matter most.</p>
      <div class="rank-actions">
        <button class="btn btn-secondary" id="useDefaults">Use defaults</button>
      </div>
      <div class="tier-labels" id="tierLabels"></div>
      <ul class="rank-list" id="rankList"></ul>
      <div class="step-footer">
        <button class="btn btn-primary" id="rankNext">Next</button>
      </div>
    </div>
  `;

  const list = container.querySelector('#rankList');
  const tierContainer = container.querySelector('#tierLabels');

  function buildList() {
    list.innerHTML = '';
    state.rankOrder.forEach((id, i) => {
      const dim = state.dimensions.find(d => d.id === id);
      const tier = tierLabels.find(t => i >= t.start && i < t.end);
      const li = document.createElement('li');
      li.dataset.id = id;
      li.className = `rank-item ${tier.cls}`;
      li.innerHTML = `
        <span class="rank-pos">${i + 1}</span>
        <span class="rank-label">${dim.label}</span>
        <span class="rank-desc">${dim.description}</span>
      `;
      list.appendChild(li);
    });
    updateTierLabels();
  }

  function updateTierLabels() {
    tierContainer.innerHTML = tierLabels.map(t =>
      `<div class="tier-header ${t.cls}">${t.label} (${t.start + 1}\u2013${Math.min(t.end, rankableCount)})</div>`
    ).join('');
  }

  function updateAfterSort() {
    state.rankOrder = [...list.querySelectorAll('li')].map(li => li.dataset.id);
    buildList();
  }

  buildList();

  if (window.Sortable) {
    Sortable.create(list, {
      animation: 150,
      ghostClass: 'rank-ghost',
      onEnd: updateAfterSort,
    });
  }

  container.querySelector('#useDefaults').addEventListener('click', onNext);
  container.querySelector('#rankNext').addEventListener('click', () => {
    state.rankOrder = [...list.querySelectorAll('li')].map(li => li.dataset.id);
    onNext();
  });
}
