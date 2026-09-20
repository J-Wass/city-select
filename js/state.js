// Simple global state object
const state = {
  dimensions: [],        // parsed from CSV
  cities: [],            // parsed from CSV
  questions: [],         // parsed from JSON
  rankOrder: [],         // dimension IDs in user-ranked order
  quizAnswers: {},       // { questionId: selectedOptionIndex(es) }
  // Optional search scope. type: 'all' | 'continent' | 'country'
  // values: selected continent names / country names (empty when type is 'all')
  scope: { type: 'all', values: [] },
};

export default state;
