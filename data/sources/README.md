# Data Sources

This directory holds the downloaded source files that `data/build.py` reads to generate `data/cities.csv`.

Downloaded source files are small (a few KB each) and are committed alongside the
hand-maintained files (`city_meta.csv`, `city_mappings.csv`, `country_mappings.csv`)
so the build is reproducible without network access.
Re-running `download.py` refreshes them from the live sources.

**No manual/fudged data anywhere**: every score in cities.csv traces to one of the
sources below. When a source lacks a city, the cell stays empty and the app skips
that dimension for that city.

Run the pipeline:

```
cd data/
python sources/download.py   # fetches all automated sources
python build.py              # merges everything into cities.csv
```

---

## Automated Sources (fetched by `download.py`)

### `ti_cpi.csv` — World Bank WGI Control of Corruption
**Dimension:** `corruption`
**Source:** World Bank API, indicator `GOV_WGI_CC.SC` (WGI database, `source=3`)
**Transform:** Score is natively 0–100 (higher = cleaner). Used directly.
**Note:** The filename is historical — the data now comes from the World Bank
Worldwide Governance Indicators, not Transparency International.

### `rsf.csv` — RSF World Press Freedom Index
**Dimension:** `pressFreedom`
**Source:** https://rsf.org/sites/default/files/import_classement/2025.csv (official CSV, cp1252-encoded, `;`-separated)
**Transform:** Score 0–100 (higher = more press freedom, post-2022 methodology). Used directly.

### `sipri.csv` — World Bank Military Expenditure
**Dimension:** `militarySpending`
**Source:** World Bank API, indicator `MS.MIL.XPND.GD.ZS` (% of GDP)
**Transform:** `100 - clamp(pct_gdp / 5 * 100, 0, 100)` — 0% of GDP → 100, 5%+ → 0.
**Note:** ~11 cities are skipped (demilitarized or non-reporting countries: Costa Rica, Cuba, Iceland, Panama, Qatar, Taiwan, UAE, Uzbekistan, Vietnam).

### `henley.csv` — Passport Index open dataset
**Dimension:** `visaEase`
**Source:** https://github.com/ilyankou/passport-index-dataset
**Transform:** Count of visa-free + visa-on-arrival destinations, `clamp(count / 193 * 100)`.

### `ookla.csv` — Ookla Speedtest Global Index
**Dimension:** `internetQuality`
**Source:** https://www.speedtest.net/global-index (fixed-broadband median download, scraped from the public rankings page)
**Transform:** `clamp(mbps / 200 * 100, 0, 100)`. 200+ Mbps → 100.

### `ef_epi.csv` — EF English Proficiency Index
**Dimension:** `languageAccess`
**Source:** https://www.ef.com/wwen/epi/ (country scores parsed from the page's embedded JSON)
**Transform:** Raw EF band scores (~350–650) are rescaled at download time to 0–100 via `(score - 350) / 300 * 100`. Cities where `primaryLanguage = english` are set to 100 by build.py regardless.

### `numbeo_col.csv` / `numbeo_property.csv` / `numbeo_crime.csv` — Numbeo city rankings
**Dimensions:** `costOfLiving`, `affordability`, `safety`
**Source:** https://www.numbeo.com/ current-year rankings pages (scraped tables)
**Transforms:**
- `costOfLiving`: index (NYC≈100) inverted and normalized against the observed range — cheaper → higher score
- `affordability`: price-to-income ratio inverted and normalized, upper bound capped at 40 (outlier protection)
- `safety`: `100 - crime_index` (clamped)
**Note:** Numbeo only ranks cities with enough contributor data (~550 for cost of living, ~400 for the others). Cities not listed are skipped for these dimensions.

### `who_air.csv` — WHO Ambient Air Quality Database
**Dimension:** `airQuality`
**Source:** https://www.who.int/data/gho/data/themes/air-pollution/who-air-quality-database (V6.1, Jan 2024)
**Matching:** Each city is geo-matched at download time (city_meta lat/lon vs WHO station coordinates): most recent reading within 25 km, else exact name+country match, else within 40 km. Output is keyed by `city_id` — no name-matching in build.py.
**Transform:** `clamp((50 - pm25) / 50 * 100, 0, 100)`. WHO guideline is 5 µg/m³; 50+ µg/m³ → 0.
**Note:** Data vintage is mostly 2019–2022. For fresher data you can manually merge the IQAir World Air Quality Report spreadsheet (https://www.iqair.com/world-air-quality-report — rate-limits bots) into this file.

### `freedom_house.csv` — Freedom House Freedom in the World
**Dimension:** `govProgressiveness`
**Source:** https://freedomhouse.org/country/scores (server-rendered table, scraped)
**Transform:** Aggregate FIW score 0–100 (higher = more free). Used directly.

### `who_uhc.csv` — WHO UHC Service Coverage Index
**Dimension:** `healthcareQuality`
**Source:** WHO GHO API, indicator `UHC_INDEX_REPORTED` (latest year per country)
**Transform:** Index is natively 0–100. Used directly.

### `wb_hlo.csv` — World Bank Harmonized Learning Outcomes
**Dimension:** `educationQuality`
**Source:** World Bank API, indicator `HD.HCI.HLOS` (harmonized test scores, 2020 vintage)
**Transform:** Raw scores (~300–625) rescaled at download time: `(score - 300) / 300 * 100`.

### `wb_gdp.csv` — World Bank real GDP growth
**Dimension:** `economicOutlook`
**Source:** World Bank API, indicator `NY.GDP.MKTP.KD.ZG`, 3-year average
**Transform:** `(avg_growth + 2) / 8 * 100` at download time — −2% → 0, +6% → 100.
**Note:** IMF WEO forecasts would be preferable but the IMF datamapper API blocks non-browser clients.

### `owid_fossil.csv` — OWID/Ember fossil share of electricity
**Dimension:** `fossilFuelReliance`
**Source:** https://ourworldindata.org/grapher/share-electricity-fossil-fuels (CSV endpoint, Ember data)
**Transform:** `100 - fossil share of electricity`, latest year per country.

### `climate_data.csv` — NASA POWER Climate Normals
**Dimensions:** `sunshine`, `humidity`, `rainfall`, `winterWarmth`
**Source:** https://power.larc.nasa.gov/ climatology API (one call per city; resumes from existing rows)

**Columns:** `city_id`, `sunshine_hours`, `humidity_pct`, `rainfall_mm`, `jan_temp_c`

**Transforms:**
- `sunshine`: `clamp((hours - 1000) / 2500 * 100, 0, 100)` — 1000 hrs/yr → 0, 3500 → 100
- `humidity`: `clamp((rh - 30) / 55 * 100, 0, 100)` — 30% RH → 0, 85% → 100
- `rainfall`: `clamp(mm / 2500 * 100, 0, 100)` — 0 mm/yr → 0, 2500+ → 100
- `winterWarmth`: `clamp((jan_temp + 20) / 45 * 100, 0, 100)` — −20°C → 0, +25°C → 100

---

## Editable Mapping Files

### `city_mappings.csv`
Maps each city_id to the city/country names used by city-level sources.
Edit this when a source uses a non-standard city name (e.g. Numbeo uses
"Tel Aviv-Yafo", "Krakow (Cracow)", "Delhi").

Columns: `city_id`, `numbeo_city`, `numbeo_country`, `iqair_city`, `iqair_country`
(The `iqair_*` columns are currently unused — `who_air.csv` is keyed by `city_id`.)

### `country_mappings.csv`
Maps our country strings to the country names used by country-level sources.
Note that `download.py` already normalizes most source spellings to our names
via its `COUNTRY_ALIASES` table; this file handles the remainder at build time.

Columns: `our_country`, `ti_country`, `rsf_country`, `sipri_country`, `henley_country`, `ef_country`, `ookla_country`

### Removed dimensions

`manual_scores.csv` used to hold hand-estimated values as a fallback; it has been
deleted. Dimensions with no verifiable third-party source — `transitQuality`,
`culturalOfferings`, `walkability`, `nightlife`, `naturalBeauty`, `jobMarket` —
were removed from the app entirely rather than kept on editorial guesses.
(If a real source appears later — e.g. ITDP Atlas for transit/walkability —
add a downloader and re-add the dimension to `dimensions.csv` and build.py's
`ALL_DIMS`.)
