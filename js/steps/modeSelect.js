import { render as renderCompare } from './compare.js';

export function render(container, onNext, onBack) {
  container.innerHTML = `
    <div class="step-content mode-select">
      <h2>How do you want to get started?</h2>
      <p class="subtitle">Take the quiz for a personalized ranking, or compare specific cities side-by-side.</p>
      <div class="mode-buttons">
        <button class="mode-btn" id="startQuizBtn">
          <span class="mode-icon">📝</span>
          <span class="mode-label">Start Quiz</span>
          <span class="mode-desc">Rank your priorities and get your best-fit cities.</span>
        </button>
        <button class="mode-btn" id="compareCitiesBtn">
          <span class="mode-icon">⚖️</span>
          <span class="mode-label">Compare Cities</span>
          <span class="mode-desc">See specific cities side-by-side across every dimension.</span>
        </button>
      </div>
    </div>
  `;

  container.querySelector('#startQuizBtn').addEventListener('click', () => {
    onNext();
  });

  container.querySelector('#compareCitiesBtn').addEventListener('click', () => {
    renderCompare(container, () => render(container, onNext, onBack));
  });
}
