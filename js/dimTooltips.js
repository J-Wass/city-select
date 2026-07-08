import state from './state.js';

// Per-dimension sorted score arrays, built lazily from state.cities.
// Only cities with real data are included, so ranks read "of N cities with data".
const scoreCache = {};

function sortedScores(dimId) {
  if (!scoreCache[dimId]) {
    scoreCache[dimId] = state.cities
      .map(c => c.scores[dimId])
      .filter(v => v != null)
      .sort((a, b) => b - a);
  }
  return scoreCache[dimId];
}

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/**
 * Hover text attributing a city's dimension value to its real source,
 * phrased from whichever end of the ranking is closer, e.g.
 * "Copenhagen is the 5th coldest winters city of 250 — source: NASA POWER".
 * Ties share a rank (rank = 1 + number of strictly better cities).
 */
export function dimTooltip(city, dim) {
  const score = city.scores[dim.id];
  if (score == null) {
    return `${city.name} has no ${dim.source || 'source'} data for ${dim.label} — skipped in scoring, not guessed`;
  }
  const scores = sortedScores(dim.id);
  const m = scores.length;
  const rankHigh = scores.filter(v => v > score).length + 1;
  const rankLow = scores.filter(v => v < score).length + 1;
  const useHigh = rankHigh <= rankLow;
  const rank = useHigh ? rankHigh : rankLow;
  const phrase = useHigh ? dim.highLabel : dim.lowLabel;
  return `${city.name} is ${ordinal(rank)} of ${m} cities for ${phrase} — source: ${dim.source}`;
}

/** Look up a dimension object by id (for callers that only have the id). */
export function dimById(dimId) {
  return state.dimensions.find(d => d.id === dimId);
}
