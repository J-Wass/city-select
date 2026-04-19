import state from '../state.js';

export function render(container, onNext, onBack) {
  // Keep the general + living-oriented question set for the main recommendation flow.
  const questions = state.questions.filter(q => q.modes.includes('living'));
  let currentQ = 0;

  function renderQuestion() {
    const q = questions[currentQ];
    const isMulti = q.type === 'multi';
    const maxSelect = q.maxSelect || null;

    container.innerHTML = `
      <div class="step-content quiz">
        <div class="quiz-progress">Question ${currentQ + 1} of ${questions.length}</div>
        <h2>${q.text}</h2>
        ${maxSelect ? `<p class="subtitle">Select up to ${maxSelect}</p>` : (isMulti ? '<p class="subtitle">Select all that apply</p>' : '')}
        <div class="quiz-options ${isMulti ? 'multi' : 'single'}" id="quizOptions"></div>
        <div class="quiz-nav step-footer">
          <button class="btn btn-secondary" id="quizBack">${currentQ === 0 ? 'Back' : 'Previous'}</button>
          ${isMulti ? '<button class="btn btn-primary" id="quizNext">Next</button>' : ''}
        </div>
      </div>
    `;

    const optionsEl = container.querySelector('#quizOptions');
    const existing = state.quizAnswers[q.id];

    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option';
      btn.textContent = opt.label;

      if (isMulti) {
        const selected = Array.isArray(existing) ? existing : [];
        if (selected.includes(i)) btn.classList.add('selected');

        btn.addEventListener('click', () => {
          let sel = Array.isArray(state.quizAnswers[q.id]) ? [...state.quizAnswers[q.id]] : [];
          if (sel.includes(i)) {
            sel = sel.filter(x => x !== i);
          } else {
            if (maxSelect && sel.length >= maxSelect) return;
            sel.push(i);
          }
          state.quizAnswers[q.id] = sel;
          // Update visual
          optionsEl.querySelectorAll('.quiz-option').forEach((b, j) => {
            b.classList.toggle('selected', sel.includes(j));
          });
        });
      } else {
        if (existing === i) btn.classList.add('selected');

        btn.addEventListener('click', () => {
          state.quizAnswers[q.id] = i;
          // Auto-advance for single-select
          if (currentQ < questions.length - 1) {
            currentQ++;
            renderQuestion();
          } else {
            onNext();
          }
        });
      }

      optionsEl.appendChild(btn);
    });

    // Back button
    container.querySelector('#quizBack').addEventListener('click', () => {
      if (currentQ > 0) {
        currentQ--;
        renderQuestion();
      } else {
        onBack();
      }
    });

    // Next button (multi-select only)
    const nextBtn = container.querySelector('#quizNext');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentQ < questions.length - 1) {
          currentQ++;
          renderQuestion();
        } else {
          onNext();
        }
      });
    }
  }

  renderQuestion();
}
