import state from './state.js';

/**
 * Rank multiplier based on drag-and-drop position (0-indexed).
 * Positions 0-7:  2.0 down to 1.3
 * Positions 8-15: 1.0 down to 0.65
 * Positions 16+:  0.5 down to 0.1 (floored)
 */
function getRankMultiplier(position) {
  if (position < 8) return 2.0 - position * 0.1;
  if (position < 16) return 1.0 - (position - 8) * 0.05;
  return Math.max(0.1, 0.5 - (position - 16) * 0.05);
}

/**
 * Collect all quiz multipliers and effects from answers.
 */
function getQuizEffects() {
  const multipliers = {};    // dimensionId -> cumulative multiplier
  const dealbreakers = [];   // dimension IDs
  const populationFilters = []; // { min?, max?, factor } — city size preference
  const inversions = new Set(); // dimension IDs to invert (100 - score)
  const languageTags = new Set(); // user's spoken languages
  let climateMatch = null;
  let industryMatch = null;

  for (const q of state.questions) {
    const answer = state.quizAnswers[q.id];
    if (answer == null) continue;

    // Gather selected options (single = one index, multi = array of indices)
    const indices = Array.isArray(answer) ? answer : [answer];
    for (const idx of indices) {
      const effects = q.options[idx]?.effects;
      if (!effects) continue;

      if (effects.multipliers) {
        for (const [dim, mult] of Object.entries(effects.multipliers)) {
          multipliers[dim] = (multipliers[dim] || 1) * mult;
        }
      }
      if (effects.dealbreaker) {
        dealbreakers.push(effects.dealbreaker);
      }
      if (effects.populationFilter) {
        populationFilters.push(effects.populationFilter);
      }
      if (effects.inversions) {
        for (const dim of effects.inversions) {
          inversions.add(dim);
        }
      }
      if (effects.languageTag) {
        languageTags.add(effects.languageTag);
      }
      if (effects.climateMatch) {
        climateMatch = effects.climateMatch.split(',');
      }
      if (effects.industryMatch) {
        industryMatch = effects.industryMatch;
      }
    }
  }

  return { multipliers, dealbreakers, populationFilters, inversions, languageTags, climateMatch, industryMatch };
}

/**
 * Get a city's score for a dimension, respecting inversions.
 * Returns null when the city has no real data for the dimension —
 * callers skip it instead of scoring a made-up value.
 */
function getCityDimScore(city, dimId, inversions) {
  const raw = city.scores[dimId];
  if (raw == null) return null;
  return inversions.has(dimId) ? (100 - raw) : raw;
}

/**
 * Score all cities and return sorted results.
 */
export function calculateResults() {
  const effects = getQuizEffects();

  // Build rank lookup
  const rankOf = {};
  state.rankOrder.forEach((id, i) => { rankOf[id] = i; });

  const scored = [];

  for (const city of state.cities) {
    // --- Dealbreaker check ---
    const violatedDealbreakers = [];
    for (const dim of effects.dealbreakers) {
      if ((city.scores[dim] ?? 100) < 30) {
        violatedDealbreakers.push(dim);
      }
    }

    // --- Global penalty multiplier ---
    let globalMult = 1;

    // Dealbreaker penalty: heavy multiplier per violation (city stays ranked, sinks to bottom)
    for (const _dim of violatedDealbreakers) {
      globalMult *= 0.15;
    }

    // Climate mismatch penalty
    if (effects.climateMatch && !effects.climateMatch.includes(city.climate)) {
      globalMult *= 0.7;
    }

    // City size preference penalty
    for (const pf of effects.populationFilters) {
      const pop = parseInt(city.population) || 0;
      if ((pf.min && pop < pf.min) || (pf.max && pop > pf.max)) {
        globalMult *= pf.factor;
      }
    }

    // Industry match bonus
    if (effects.industryMatch && city.industries) {
      if (!city.industries.includes(effects.industryMatch)) {
        globalMult *= 0.7;
      }
    }

    // Language match bonus
    if (effects.languageTags.size > 0 && city.primaryLanguage) {
      if (effects.languageTags.has(city.primaryLanguage)) {
        globalMult *= 1.1; // Bonus for speaking the local language
      } else {
        globalMult *= 0.9; // Slight penalty for language mismatch
      }
    }

    // --- Weighted average ---
    let sumContributions = 0;
    let sumWeights = 0;

    for (const dim of state.dimensions) {
      const baseWeight = dim.weight;
      if (baseWeight === 0) continue;

      // Non-rankable dimensions get a neutral rank multiplier
      const score = getCityDimScore(city, dim.id, effects.inversions);
      if (score == null) continue; // no data — skip, don't fabricate

      const rankMult = dim.rankable ? getRankMultiplier(rankOf[dim.id] ?? 12) : 1.0;
      const quizMult = effects.multipliers[dim.id] || 1;
      const effectiveWeight = baseWeight * rankMult * quizMult;

      sumContributions += effectiveWeight * score;
      sumWeights += effectiveWeight;
    }

    const rawScore = sumWeights > 0 ? sumContributions / sumWeights : 0;
    const finalScore = Math.round(rawScore * globalMult);

    // Data coverage: how many dimensions have real data for this city
    const coveredDims = state.dimensions.filter(d => city.scores[d.id] != null).length;

    // Find strengths and weaknesses using effective (possibly inverted) scores
    const dimScores = state.dimensions
      .filter(d => d.weight > 0 && city.scores[d.id] != null)
      .map(d => ({
        id: d.id,
        label: d.label,
        score: getCityDimScore(city, d.id, effects.inversions),
        weight: d.weight *
                (d.rankable ? getRankMultiplier(rankOf[d.id] ?? 12) : 1.0) *
                (effects.multipliers[d.id] || 1),
      }))
      .sort((a, b) => (b.score * b.weight) - (a.score * a.weight));

    const toItem = d => ({
      id: d.id,
      label: d.label,
      score: Math.round(d.score),
      rankPos: rankOf[d.id] !== undefined ? rankOf[d.id] + 1 : null,
      quizBoosted: (effects.multipliers[d.id] || 1) > 1.1,
    });

    const strengths = dimScores.slice(0, 5).filter(d => d.score >= 65).map(toItem);

    // Weaknesses: bottom 3 among dimensions the user actually ranked in their top half
    const topHalfCutoff = Math.ceil(state.rankOrder.length / 2);
    const topRanked = dimScores.filter(d => {
      const pos = rankOf[d.id];
      return pos !== undefined && pos < topHalfCutoff;
    });
    const weaknesses = (topRanked.length > 0 ? topRanked : dimScores)
      .slice(-3)
      .filter(d => d.score < 62)
      .map(toItem);

    scored.push({
      city,
      score: finalScore,
      strengths,
      weaknesses,
      violatedDealbreakers,
      coverage: { covered: coveredDims, total: state.dimensions.length },
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}
