// Simple global state object
const state = {
  mode: null,            // "living" or "visiting"
  dimensions: [],        // parsed from CSV
  cities: [],            // parsed from CSV
  questions: [],         // parsed from JSON
  rankOrder: [],         // dimension IDs in user-ranked order
  quizAnswers: {},       // { questionId: selectedOptionIndex(es) }
  results: [],           // scored city list
};

export default state;
