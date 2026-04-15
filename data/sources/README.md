# Data Sources

This directory holds the downloaded source files that `data/build.py` reads to generate `data/cities.csv`.

Files listed here are **not tracked in git** (they are large, change annually, and belong to third parties).
Only `city_meta.csv`, `manual_scores.csv`, `city_mappings.csv`, and `country_mappings.csv` are tracked.

Run the pipeline after placing any source file here:

```
cd data/
python build.py
```

---

## Files and Where to Get Them

### `ti_cpi.csv` — Transparency International CPI
**Dimension:** `corruption`
**Source:** https://www.transparency.org/en/cpi
**How to download:**
1. Go to the CPI page and scroll to "CPI Full Data Set"
2. Download the CSV version
3. Place as `data/sources/ti_cpi.csv`

**Expected columns:** `Country or Territory`, `CPI score YYYY`
**Transform:** Score is already 0–100 (higher = less corrupt). Used directly.

---

### `rsf.csv` — RSF World Press Freedom Index
**Dimension:** `pressFreedom`
**Source:** https://rsf.org/en/index
**How to download:**
1. Go to the index page
2. Download the CSV/Excel data file
3. Place as `data/sources/rsf.csv`

**Expected columns:** `Country`, `Score`
**Transform:** Score 0–100 (higher = more press freedom, post-2022 methodology). Used directly.
**Note:** RSF changed their scoring methodology in 2022. Earlier data is not comparable.

---

### `sipri.csv` — SIPRI Military Expenditure Database
**Dimension:** `militarySpending`
**Source:** https://sipri.org/databases/milex
**How to download:**
1. Go to the SIPRI MILEX database
2. Select "Share of GDP (%)" as the indicator
3. Download as CSV/Excel
4. Place as `data/sources/sipri.csv`

**Expected columns:** `Country`, `[Year]` (e.g. `2023`)
**Transform:** `100 - clamp(pct_gdp / 5 * 100, 0, 100)`
Countries spending 0% of GDP on military → score 100. At 5%+ → score 0.

---

### `numbeo_col.csv` — Numbeo Cost of Living Index
**Dimension:** `costOfLiving`
**Source:** https://www.numbeo.com/cost-of-living/rankings.jsp
**How to download:**
1. Set the year dropdown and click "Current"
2. Right-click the table > "Export to CSV" or copy the data
3. Place as `data/sources/numbeo_col.csv`

**Expected columns:** `City`, `Country`, `Cost of Living Index`
**Transform:** NYC baseline ≈ 100. Inverted and normalized to 0–100 against observed range.
Lower raw index → higher score (cheaper = better for residents).

---

### `numbeo_property.csv` — Numbeo Property Price to Income Ratio
**Dimension:** `affordability`
**Source:** https://www.numbeo.com/property-investment/rankings.jsp
**How to download:**
1. Navigate to the Property Investment rankings
2. Export or copy the "Price To Income Ratio" table
3. Place as `data/sources/numbeo_property.csv`

**Expected columns:** `City`, `Country`, `Price To Income Ratio`
**Transform:** Higher ratio = less affordable. Inverted and normalized to 0–100.

---

### `numbeo_crime.csv` — Numbeo Crime Index
**Dimension:** `safety`
**Source:** https://www.numbeo.com/crime/rankings.jsp
**How to download:**
1. Navigate to the Crime Index rankings
2. Export or copy the table
3. Place as `data/sources/numbeo_crime.csv`

**Expected columns:** `City`, `Country`, `Crime Index`
**Transform:** `100 - crime_index` (clamped to 0–100). Lower crime → higher safety score.

---

### `iqair.csv` — IQAir World Air Quality Report
**Dimension:** `airQuality`
**Source:** https://www.iqair.com/world-air-quality-report
**How to download:**
1. Download the annual World Air Quality Report PDF + supplemental data
2. The city-level PM2.5 data is usually available as a separate spreadsheet/CSV
3. Place as `data/sources/iqair.csv`

**Expected columns:** `City`, `Country`, `PM2.5` (annual mean in µg/m³)
**Transform:** `clamp((50 - pm25) / 50 * 100, 0, 100)`
WHO guideline = 5 µg/m³. At 50 µg/m³ score = 0. Cities below 5 µg/m³ score ~90+.

---

### `ookla.csv` — Ookla Speedtest Global Index
**Dimension:** `internetQuality`
**Source:** https://www.speedtest.net/global-index
**How to download:**
1. Go to the Global Index page and select "Fixed Broadband"
2. Export or transcribe the country-level median download speeds
3. Place as `data/sources/ookla.csv`

**Expected columns:** `Country`, `Download Speed (Mbps)` (median fixed broadband)
**Transform:** `clamp(mbps / 200 * 100, 0, 100)`. 200+ Mbps → 100.

---

### `ef_epi.csv` — EF English Proficiency Index
**Dimension:** `languageAccess`
**Source:** https://www.ef.com/wwen/epi/
**How to download:**
1. Go to the EPI results page
2. Download or transcribe the country scores
3. Place as `data/sources/ef_epi.csv`

**Expected columns:** `Country`, `EPI Score` (0–100)
**Transform:** Cities where `primaryLanguage = english` → score 100. Others use EPI score directly.
**Note:** EPI measures English proficiency among non-native speakers. Countries not in EPI
(English-speaking countries) should be handled via the `primaryLanguage` column in city_meta.csv.

---

### `henley.csv` — Henley Passport Index
**Dimension:** `visaEase`
**Source:** https://www.henleypassport.com/passport-index/
**How to download:**
1. Download the passport index CSV from Henley & Partners
2. Place as `data/sources/henley.csv`

**Expected columns:** `Country`, `Visa-Free Destinations` (count)
**Transform:** `clamp(count / 193 * 100, 0, 100)`. 193 destinations → 100.
**Note:** This measures passport strength (how easily residents can travel out), which
correlates closely with visa reciprocity for inbound visitors.

---

### `climate_data.csv` — City Climate Normals
**Dimensions:** `sunshine`, `humidity`, `rainfall`, `winterWarmth`
**Source:** https://en.climate-data.org/ (and NOAA for US cities)
**How to compile:**
This file must be compiled manually — look up each city on climate-data.org.
The file uses our internal city IDs directly (no name-matching needed).

**Required columns:**

| Column | Description |
|--------|-------------|
| `city_id` | Our internal ID (e.g. `tokyo`, `newYork`) |
| `sunshine_hours` | Annual sunshine hours |
| `humidity_pct` | Annual mean relative humidity % |
| `rainfall_mm` | Annual precipitation in mm |
| `jan_temp_c` | January mean temperature in Celsius |

**Transforms:**
- `sunshine`: `clamp((hours - 1000) / 2500 * 100, 0, 100)`
  — 1000 hrs/yr → 0, 3500 hrs/yr → 100
- `humidity`: `clamp((rh - 30) / 55 * 100, 0, 100)`
  — 30% RH → 0, 85% RH → 100
- `rainfall`: `clamp(mm / 2500 * 100, 0, 100)`
  — 0 mm/yr → 0, 2500+ mm/yr → 100
- `winterWarmth`: `clamp((jan_temp + 20) / 45 * 100, 0, 100)`
  — -20°C → 0, +25°C → 100

---

## Editable Mapping Files

### `city_mappings.csv`
Maps each city_id to the city/country names used by city-level sources (Numbeo, IQAir).
Edit this file when a source uses a non-standard city name (e.g. Numbeo uses "New York"
but a new source uses "New York City").

Columns: `city_id`, `numbeo_city`, `numbeo_country`, `iqair_city`, `iqair_country`

### `country_mappings.csv`
Maps our country strings to the country names used by country-level sources.
Edit this when a source spells a country differently (e.g. "United States" vs "USA").

Columns: `our_country`, `ti_country`, `rsf_country`, `sipri_country`, `henley_country`, `ef_country`, `ookla_country`

### `manual_scores.csv`
Hand-curated scores for dimensions that have no single authoritative source:
`transitQuality`, `climateAction`, `govProgressiveness`, `economicOutlook`,
`fossilFuelReliance`, `healthcareQuality`, `educationQuality`, `culturalOfferings`,
`walkability`, `foodScene`, `nightlife`, `naturalBeauty`, `jobMarket`

**Reference materials used for manual scoring:**
- `transitQuality` — UITP Mobility in Cities database; TomTom Traffic Index; user research
- `climateAction` — Climate Action Tracker country ratings (https://climateactiontracker.org)
- `govProgressiveness` — Freedom House Freedom in the World; V-Dem Liberal Democracy Index
- `economicOutlook` — IMF World Economic Outlook; World Bank GDP growth forecasts
- `fossilFuelReliance` — Our World in Data energy mix (https://ourworldindata.org/energy-mix)
- `healthcareQuality` — WHO health system rankings; Bloomberg Health System Efficiency Index
- `educationQuality` — PISA 2022 country mean scores (OECD); QS World University Rankings
- `culturalOfferings` — Michelin Guide city presence; UNESCO World Heritage Sites count; museum density; Timeout City Index
- `walkability` — Walk Score (US cities); urban density + metro coverage for others
- `foodScene` — Michelin stars count; Timeout Food city rankings; street food culture
- `nightlife` — Time Out Night Life rankings; club/bar density; city reputation
- `naturalBeauty` — proximity to national parks, coastlines, mountains; green space per capita
- `jobMarket` — LinkedIn Economic Graph; IMF city-level employment; startup ecosystem rankings
