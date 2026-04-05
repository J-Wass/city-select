import state from '../state.js';

export function render(container, onNext) {
  container.innerHTML = `
    <div class="step-content mode-select">
      <h2>What are you looking for?</h2>
      <p class="subtitle">This affects how dimensions are weighted</p>
      <div class="mode-buttons">
        <button class="mode-btn" data-mode="living">
          <span class="mode-icon">🏠</span>
          <span class="mode-label">Living</span>
          <span class="mode-desc">Find a city to call home</span>
        </button>
        <button class="mode-btn" data-mode="visiting">
          <span class="mode-icon">✈️</span>
          <span class="mode-label">Visiting</span>
          <span class="mode-desc">Find a city to explore</span>
        </button>
      </div>
    </div>
  `;

  container.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      onNext();
    });
  });
}
