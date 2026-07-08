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

export function getCityMapSVG(city) {
  const { lat, lon } = city;
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
