/**
 * City map tiles using CartoDB light_all tiles (light mode, OSM-based).
 * Renders a 3×3 grid of tiles and offsets it so the city's exact
 * lat/lon lands at the center of the display container.
 * Coordinates come from the city object (cities.csv lat/lon columns).
 *
 * Attribution: © OpenStreetMap contributors, © CARTO
 */

const T = 256; // OSM tile size in px
const ZOOM = 10; // ~40 km per tile — wider city-area view

// Legacy fallback — remove once all cities have lat/lon in CSV
const cityCoords = {
  newYork:      [40.71,  -74.01],
  tokyo:        [35.69,  139.69],
  london:       [51.51,   -0.13],
  paris:        [48.85,    2.35],
  sydney:       [-33.87, 151.21],
  toronto:      [43.65,  -79.38],
  berlin:       [52.52,   13.41],
  singapore:    [ 1.35,  103.82],
  mexicoCity:   [19.43,  -99.13],
  saoPaulo:     [-23.55, -46.63],
  amsterdam:    [52.37,    4.90],
  barcelona:    [41.39,    2.16],
  bangkok:      [13.75,  100.52],
  dubai:        [25.20,   55.27],
  seoul:        [37.57,  126.98],
  vienna:       [48.21,   16.37],
  lisbon:       [38.72,   -9.14],
  copenhagen:   [55.68,   12.57],
  melbourne:    [-37.81, 144.96],
  buenosAires:  [-34.61, -58.38],
  prague:       [50.08,   14.44],
  taipei:       [25.05,  121.56],
  dublin:       [53.33,   -6.25],
  mumbai:       [19.08,   72.88],
  istanbul:     [41.01,   28.95],
  stockholm:    [59.33,   18.07],
  zurich:       [47.37,    8.54],
  hanoi:        [21.03,  105.85],
  cairo:        [30.04,   31.24],
  bogota:       [ 4.71,  -74.07],
  kualaLumpur:  [ 3.14,  101.69],
  rome:         [41.90,   12.50],
  nairobi:      [-1.29,   36.82],
  capeTown:     [-33.92,  18.42],
  helsinki:     [60.17,   24.94],
  budapest:     [47.50,   19.04],
  athensGreece: [37.98,   23.73],
  sanFrancisco: [37.77, -122.42],
  losAngeles:   [34.05, -118.24],
  chicago:      [41.88,  -87.63],
  austin:       [30.27,  -97.74],
  vancouver:    [49.28, -123.12],
  montreal:     [45.50,  -73.57],
  osaka:        [34.69,  135.50],
  kyoto:        [35.01,  135.77],
  marrakech:    [31.63,   -8.00],
  reykjavik:    [64.13,  -21.93],
  denver:       [39.74, -104.98],
  milanItaly:   [45.46,    9.19],
  washingtonDC: [38.91,  -77.04],
};

export function getCityMapSVG(city) {
  const lat = city.lat || (cityCoords[city.id] || [])[0];
  const lon = city.lon || (cityCoords[city.id] || [])[1];
  if (!lat || !lon) return `<div class="city-map-tile city-map-fallback"></div>`;
  const n = Math.pow(2, ZOOM);

  // Fractional tile coordinates for the city center
  const ftx = (lon + 180) / 360 * n;
  const latRad = lat * Math.PI / 180;
  const fty = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;

  const tileX = Math.floor(ftx);
  const tileY = Math.floor(fty);

  // City center pixel within the 3×3 grid (grid origin = tileX-1, tileY-1)
  const fx = ftx - tileX; // fractional offset within the tile (0..1)
  const fy = fty - tileY;
  const cityPxX = T + fx * T;
  const cityPxY = T + fy * T;

  // Place the 3×3 grid so its city-center pixel lands at the container's 50%/50%.
  // Using left/top 50% + translate avoids hardcoding the container height,
  // so it works whether the card is short or tall.
  const gridStyle =
    `position:absolute;width:${3*T}px;height:${3*T}px;` +
    `left:50%;top:50%;` +
    `transform:translate(${Math.round(-cityPxX)}px,${Math.round(-cityPxY)}px)`;

  // Build 3×3 tile grid
  let tiles = '';
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = tileX + dx;
      const ty = tileY + dy;
      const left = (dx + 1) * T;
      const top  = (dy + 1) * T;
      const url = `https://basemaps.cartocdn.com/light_all/${ZOOM}/${tx}/${ty}.png`;
      tiles += `<img src="${url}" loading="lazy" alt=""` +
        ` style="position:absolute;left:${left}px;top:${top}px;width:${T}px;height:${T}px;">`;
    }
  }

  // Red dot pinned to the exact city coordinate
  const marker =
    `<div style="position:absolute;left:${cityPxX}px;top:${cityPxY}px;` +
    `width:8px;height:8px;background:#e63946;border:2px solid #fff;border-radius:50%;` +
    `transform:translate(-50%,-50%);box-shadow:0 1px 4px rgba(0,0,0,0.45);z-index:2;"></div>`;

  return `<div class="city-map-tile">` +
    `<div style="${gridStyle}">` +
      tiles + marker +
    `</div>` +
    `<a class="osm-attr" href="https://www.openstreetmap.org/copyright"` +
      ` target="_blank" rel="noopener">© OSM / CARTO</a>` +
  `</div>`;
}
