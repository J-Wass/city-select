import state from '../state.js';
import { render as renderCompare } from './compare.js';

export function render(container, onNext, onBack) {
  container.innerHTML = `
    <div class="step-content mode-select">
      <h2>What are you looking for?</h2>
      <p class="subtitle">Take a personalized quiz, or compare specific cities directly</p>
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
      <button class="mode-compare-btn" id="modeCompareBtn">
        <span class="mode-compare-icon">⚖️</span>
        <span class="mode-compare-text">Compare specific cities side-by-side</span>
        <span class="mode-compare-arrow">→</span>
      </button>
    </div>
  `;

  container.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      onNext();
    });
  });

  container.querySelector('#modeCompareBtn').addEventListener('click', () => {
    renderCompare(container, () => render(container, onNext, onBack));
  });
}
