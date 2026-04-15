import state from './state.js';
import { render as renderModeSelect } from './steps/modeSelect.js';
import { render as renderPriorityRank } from './steps/priorityRank.js';
import { render as renderQuiz } from './steps/quiz.js';
import { render as renderResults } from './steps/results.js';

const steps = [renderModeSelect, renderPriorityRank, renderQuiz, renderResults];
const stepNames = ['Mode', 'Priorities', 'Quiz', 'Results'];
let currentStep = 0;

const appEl = document.getElementById('app');
const progressEl = document.getElementById('progress');

// --- CSV parsing ---
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i]; });
    return obj;
  });
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// --- Data loading ---
async function loadData() {
  const [dimText, cityText, questionsResp] = await Promise.all([
    fetch('data/dimensions.csv').then(r => r.text()),
    fetch('data/cities.csv', { cache: 'no-cache' }).then(r => r.text()),
    fetch('data/questions.json').then(r => r.json()),
  ]);

  // Parse dimensions
  state.dimensions = parseCSV(dimText).map(row => ({
    id: row.id,
    label: row.label,
    description: row.description,
    level: row.level,
    livingWeight: Number(row.livingWeight),
    visitingWeight: Number(row.visitingWeight),
    rankable: row.rankable !== 'false',
  }));

  // Parse cities — score columns are everything after 'industries'
  const dimensionIds = state.dimensions.map(d => d.id);
  state.cities = parseCSV(cityText).map(row => ({
    id: row.id,
    name: row.name,
    country: row.country,
    region: row.region,
    population: Number(row.population),
    climate: row.climate,
    industries: row.industries ? row.industries.split(';') : [],
    primaryLanguage: row.primaryLanguage || '',
    gdpPerCapita: Number(row.gdpPerCapita) || 0,
    density: Number(row.density) || 0,
    nickname: row.nickname || '',
    lat: Number(row.lat) || 0,
    lon: Number(row.lon) || 0,
    scores: Object.fromEntries(dimensionIds.map(id => [id, Number(row[id]) || 0])),
  }));

  state.questions = questionsResp;
}

// --- Navigation ---
function goToStep(step) {
  currentStep = step;
  updateProgress();
  steps[currentStep](appEl, onNext, onBack);
}

function onNext() {
  if (currentStep < steps.length - 1) {
    goToStep(currentStep + 1);
  }
}

function onBack(reset) {
  if (reset) {
    goToStep(0);
  } else if (currentStep > 0) {
    goToStep(currentStep - 1);
  }
}

function updateProgress() {
  progressEl.innerHTML = stepNames.map((name, i) =>
    `<div class="progress-step ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'done' : ''}">${name}</div>`
  ).join('<div class="progress-line"></div>');
}

// --- Init ---
loadData().then(() => goToStep(0));
