// Continent lookup.
//
// The `region` column in cities.csv is inconsistent (the same country shows up
// under 'Americas', 'North America' and 'Latin America'), so scope filtering
// derives the continent from the country instead.
const COUNTRY_CONTINENT = {
  // Africa
  'Algeria': 'Africa', 'Angola': 'Africa', 'Cameroon': 'Africa',
  'Democratic Republic of Congo': 'Africa', 'Egypt': 'Africa', 'Ethiopia': 'Africa',
  'Ghana': 'Africa', 'Ivory Coast': 'Africa', 'Kenya': 'Africa', 'Morocco': 'Africa',
  'Nigeria': 'Africa', 'Rwanda': 'Africa', 'Senegal': 'Africa', 'South Africa': 'Africa',
  'Tanzania': 'Africa', 'Tunisia': 'Africa', 'Uganda': 'Africa',
  // Asia
  'Armenia': 'Asia', 'Azerbaijan': 'Asia', 'Bahrain': 'Asia', 'Bangladesh': 'Asia',
  'Cambodia': 'Asia', 'China': 'Asia', 'Georgia': 'Asia', 'India': 'Asia',
  'Indonesia': 'Asia', 'Iran': 'Asia', 'Iraq': 'Asia', 'Israel': 'Asia',
  'Japan': 'Asia', 'Jordan': 'Asia', 'Kazakhstan': 'Asia', 'Kuwait': 'Asia',
  'Lebanon': 'Asia', 'Malaysia': 'Asia', 'Mongolia': 'Asia', 'Myanmar': 'Asia',
  'Nepal': 'Asia', 'Oman': 'Asia', 'Pakistan': 'Asia', 'Philippines': 'Asia',
  'Qatar': 'Asia', 'Saudi Arabia': 'Asia', 'Singapore': 'Asia', 'South Korea': 'Asia',
  'Sri Lanka': 'Asia', 'Taiwan': 'Asia', 'Thailand': 'Asia', 'Turkey': 'Asia',
  'United Arab Emirates': 'Asia', 'Uzbekistan': 'Asia', 'Vietnam': 'Asia',
  // Europe
  'Albania': 'Europe', 'Austria': 'Europe', 'Belarus': 'Europe', 'Belgium': 'Europe',
  'Bosnia': 'Europe', 'Bulgaria': 'Europe', 'Croatia': 'Europe', 'Cyprus': 'Europe',
  'Czech Republic': 'Europe', 'Denmark': 'Europe', 'Estonia': 'Europe',
  'Finland': 'Europe', 'France': 'Europe', 'Germany': 'Europe', 'Greece': 'Europe',
  'Hungary': 'Europe', 'Iceland': 'Europe', 'Ireland': 'Europe', 'Italy': 'Europe',
  'Latvia': 'Europe', 'Lithuania': 'Europe', 'Luxembourg': 'Europe', 'Malta': 'Europe',
  'Netherlands': 'Europe', 'Norway': 'Europe', 'Poland': 'Europe', 'Portugal': 'Europe',
  'Romania': 'Europe', 'Serbia': 'Europe', 'Slovakia': 'Europe', 'Slovenia': 'Europe',
  'Spain': 'Europe', 'Sweden': 'Europe', 'Switzerland': 'Europe', 'Ukraine': 'Europe',
  'United Kingdom': 'Europe',
  // North America
  'Canada': 'North America', 'Costa Rica': 'North America', 'Cuba': 'North America',
  'Mexico': 'North America', 'Panama': 'North America', 'United States': 'North America',
  // South America
  'Argentina': 'South America', 'Bolivia': 'South America', 'Brazil': 'South America',
  'Chile': 'South America', 'Colombia': 'South America', 'Ecuador': 'South America',
  'Paraguay': 'South America', 'Peru': 'South America', 'Uruguay': 'South America',
  // Oceania
  'Australia': 'Oceania', 'New Zealand': 'Oceania',
};

const CONTINENT_ORDER = [
  'Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania',
];

const CONTINENT_ICONS = {
  'Africa': '🌍',
  'Asia': '🌏',
  'Europe': '🏰',
  'North America': '🗽',
  'South America': '🌴',
  'Oceania': '🦘',
};

/** Continent for a city, falling back to its (messy) region column. */
export function continentOf(city) {
  return COUNTRY_CONTINENT[city.country] || city.region || 'Other';
}

export function continentIcon(continent) {
  return CONTINENT_ICONS[continent] || '📍';
}

/** Continents present in the data, in a stable display order. */
export function continentList(cities) {
  const counts = new Map();
  for (const city of cities) {
    const c = continentOf(city);
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  const known = CONTINENT_ORDER.filter(c => counts.has(c));
  const extra = [...counts.keys()].filter(c => !CONTINENT_ORDER.includes(c)).sort();
  return [...known, ...extra].map(name => ({ name, count: counts.get(name) }));
}

/** Countries present in the data, grouped under their continent. */
export function countryList(cities) {
  const counts = new Map();
  for (const city of cities) {
    const entry = counts.get(city.country) || { name: city.country, continent: continentOf(city), count: 0 };
    entry.count++;
    counts.set(city.country, entry);
  }
  return [...counts.values()].sort((a, b) =>
    a.continent.localeCompare(b.continent) || a.name.localeCompare(b.name));
}
