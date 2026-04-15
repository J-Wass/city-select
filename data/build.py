#!/usr/bin/env python3
"""
City-Select Data Pipeline
=========================
Generates data/cities.csv from authoritative source datasets + manual scores.

Usage (run from the data/ directory):
    python build.py

Source files live in data/sources/. See data/sources/README.md for download
instructions for each file. If a source file is missing, that dimension falls
back to the value in manual_scores.csv and a warning is printed.

Adding a new city
-----------------
1. Add a row to sources/city_meta.csv
2. Add a row to sources/manual_scores.csv
3. Add the city's name variants to sources/city_mappings.csv
4. Run: python build.py

Updating a dimension from a new source year
-------------------------------------------
1. Download the new source file and place it in sources/ (see README.md)
2. Update the 'year' field in SOURCES below
3. Run: python build.py
4. Review the diff in cities.csv and commit
"""

import csv
import os
import math

# ---------------------------------------------------------------------------
# Source registry
# Each entry documents: the official source, download URL, expected filename,
# what level the data is at (city or country), the year, and any notes.
# ---------------------------------------------------------------------------

SOURCES = {
    'corruption': {
        'name':  'Transparency International Corruption Perceptions Index',
        'url':   'https://www.transparency.org/en/cpi',
        'file':  'sources/ti_cpi.csv',
        'level': 'country',
        'year':  2024,
        'note':  (
            'Download "Full data table" CSV. '
            'Expected column: "CPI score YYYY". '
            'Score is 0-100 where 100 = no corruption. Used directly.'
        ),
    },
    'pressFreedom': {
        'name':  'RSF World Press Freedom Index',
        'url':   'https://rsf.org/en/index',
        'file':  'sources/rsf.csv',
        'level': 'country',
        'year':  2024,
        'note':  (
            'Download the index CSV. Expected column: "Score" (0-100, higher = more free). '
            'Score meaning changed in 2022 — ensure year >= 2022.'
        ),
    },
    'militarySpending': {
        'name':  'SIPRI Military Expenditure Database',
        'url':   'https://sipri.org/databases/milex',
        'file':  'sources/sipri.csv',
        'level': 'country',
        'year':  2024,
        'note':  (
            'Download the "Share of GDP" table as CSV. '
            'Expected column: most recent year (e.g. "2023"). '
            'Raw value is % of GDP. Transform: 100 - clamp(pct/5 * 100, 0, 100). '
            'Countries spending 0% -> 100, 5%+ -> 0.'
        ),
    },
    'costOfLiving': {
        'name':  'Numbeo Cost of Living Index',
        'url':   'https://www.numbeo.com/cost-of-living/rankings.jsp',
        'file':  'sources/numbeo_col.csv',
        'level': 'city',
        'year':  2025,
        'note':  (
            'Export the ranking table. Expected columns: "City", "Country", "Cost of Living Index". '
            'NYC baseline ~100. Transform: inverted and normalized to 0-100 against observed range.'
        ),
    },
    'affordability': {
        'name':  'Numbeo Property Price to Income Ratio',
        'url':   'https://www.numbeo.com/property-investment/rankings.jsp',
        'file':  'sources/numbeo_property.csv',
        'level': 'city',
        'year':  2025,
        'note':  (
            'Export the ranking table. Expected columns: "City", "Country", "Price To Income Ratio". '
            'Higher ratio = less affordable. Transform: inverted and normalized to 0-100.'
        ),
    },
    'safety': {
        'name':  'Numbeo Crime Index',
        'url':   'https://www.numbeo.com/crime/rankings.jsp',
        'file':  'sources/numbeo_crime.csv',
        'level': 'city',
        'year':  2025,
        'note':  (
            'Export the ranking table. Expected columns: "City", "Country", "Crime Index". '
            'Transform: 100 - crime_index (clamped to 0-100).'
        ),
    },
    'airQuality': {
        'name':  'IQAir World Air Quality Report (city PM2.5 annual means)',
        'url':   'https://www.iqair.com/world-air-quality-report',
        'file':  'sources/iqair.csv',
        'level': 'city',
        'year':  2024,
        'note':  (
            'Download the city-level PM2.5 data from the annual report. '
            'Expected columns: "City", "Country", "PM2.5" (annual mean µg/m3). '
            'WHO guideline = 5 µg/m3. Transform: clamp((50 - pm25) / 50 * 100, 0, 100). '
            '5 µg/m3 -> 90, 50 µg/m3 -> 0, >50 -> 0.'
        ),
    },
    'internetQuality': {
        'name':  'Ookla Speedtest Global Index',
        'url':   'https://www.speedtest.net/global-index',
        'file':  'sources/ookla.csv',
        'level': 'country',
        'year':  2024,
        'note':  (
            'Download or scrape the country-level median fixed broadband download speed. '
            'Expected columns: "Country", "Download Speed (Mbps)". '
            'Transform: clamp(mbps / 200 * 100, 0, 100). 200+ Mbps -> 100.'
        ),
    },
    'languageAccess': {
        'name':  'EF English Proficiency Index',
        'url':   'https://www.ef.com/wwen/epi/',
        'file':  'sources/ef_epi.csv',
        'level': 'country',
        'year':  2024,
        'note':  (
            'Download or transcribe the country EPI scores. '
            'Expected columns: "Country", "EPI Score" (0-100). '
            'Cities where primaryLanguage=english are set to 100. '
            'Others use EPI score directly (already 0-100 scale).'
        ),
    },
    'visaEase': {
        'name':  'Henley Passport Index',
        'url':   'https://www.henleypassport.com/passport-index/',
        'file':  'sources/henley.csv',
        'level': 'country',
        'year':  2024,
        'note':  (
            'Download or transcribe the visa-free destination count per country. '
            'Expected columns: "Country", "Visa-Free Destinations". '
            'Transform: clamp(count / 193 * 100, 0, 100).'
        ),
    },
    'climate': {
        'name':  'climate-data.org city climate statistics',
        'url':   'https://en.climate-data.org/',
        'file':  'sources/climate_data.csv',
        'level': 'city',
        'year':  2024,
        'note':  (
            'Manually compile city-level climate normals. '
            'Expected columns: "city_id", "sunshine_hours" (annual), '
            '"humidity_pct" (annual mean RH %), "rainfall_mm" (annual), '
            '"jan_temp_c" (January mean temp in Celsius). '
            'Transforms: '
            '  sunshine:    clamp((hours - 1000) / 2500 * 100, 0, 100) '
            '  humidity:    clamp((rh - 30) / 55 * 100, 0, 100) '
            '  rainfall:    clamp(mm / 2500 * 100, 0, 100) '
            '  winterWarmth: clamp((jan_temp + 20) / 45 * 100, 0, 100)'
        ),
    },
}

# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def src(filename):
    """Resolve a filename relative to the data/ directory."""
    return os.path.join(SCRIPT_DIR, filename)

def clamp(value, lo=0, hi=100):
    return max(lo, min(hi, value))

def normalize_invert(value, lo, hi):
    """
    Map a raw value to 0-100 where lo -> 100 and hi -> 0.
    Used for metrics where lower raw value = better score.
    """
    if hi == lo:
        return 50
    return clamp(round((hi - value) / (hi - lo) * 100))

def normalize(value, lo, hi):
    """
    Map a raw value to 0-100 where lo -> 0 and hi -> 100.
    """
    if hi == lo:
        return 50
    return clamp(round((value - lo) / (hi - lo) * 100))

def read_csv(path):
    with open(path, encoding='utf-8') as f:
        return list(csv.DictReader(f))

def warn(msg):
    print(f"  [WARN] {msg}")

def info(msg):
    print(f"  {msg}")

# ---------------------------------------------------------------------------
# Mapping loaders
# ---------------------------------------------------------------------------

def load_city_mappings():
    """
    Returns a dict of dicts keyed by city_id.
    e.g. city_mappings['tokyo']['numbeo_city'] == 'Tokyo'
    """
    rows = read_csv(src('sources/city_mappings.csv'))
    return {row['city_id']: row for row in rows}

def load_country_mappings():
    """
    Returns a dict: our_country -> {ti_country, rsf_country, ...}
    """
    rows = read_csv(src('sources/country_mappings.csv'))
    return {row['our_country']: row for row in rows}

def load_city_meta():
    """Returns list of city metadata dicts."""
    return read_csv(src('sources/city_meta.csv'))

def load_manual_scores():
    """Returns a dict: city_id -> {dimension -> score}."""
    rows = read_csv(src('sources/manual_scores.csv'))
    return {row['id']: row for row in rows}

# ---------------------------------------------------------------------------
# Country-level source loaders
# Each returns a dict: city_id -> int score (0-100), or {} if file missing.
# ---------------------------------------------------------------------------

def load_ti_cpi(city_meta, country_maps):
    """
    Transparency International CPI -> corruption score.
    CPI score 0-100 (higher = cleaner). Used directly.
    """
    path = src(SOURCES['corruption']['file'])
    if not os.path.exists(path):
        warn(f"Missing {path} — corruption will use manual scores")
        return {}

    rows = read_csv(path)
    # Find the score column (varies by year, e.g. "CPI score 2024")
    score_col = next((c for c in rows[0] if 'cpi score' in c.lower() or c.lower() == 'score'), None)
    country_col = next((c for c in rows[0] if 'country' in c.lower()), None)
    if not score_col or not country_col:
        warn(f"TI CPI: could not find Country or Score column. Columns: {list(rows[0].keys())}")
        return {}

    # Build lookup: ti_country -> score
    ti_scores = {}
    for row in rows:
        try:
            ti_scores[row[country_col].strip()] = int(float(row[score_col]))
        except (ValueError, KeyError):
            pass

    result = {}
    updated = 0
    for city in city_meta:
        cid = city['id']
        our_country = city['country']
        ti_name = country_maps.get(our_country, {}).get('ti_country', our_country)
        if ti_name in ti_scores:
            result[cid] = ti_scores[ti_name]
            updated += 1
    info(f"corruption (TI CPI): updated {updated}/{len(city_meta)} cities")
    return result

def load_rsf(city_meta, country_maps):
    """RSF Press Freedom Index -> pressFreedom score (0-100, higher = more free)."""
    path = src(SOURCES['pressFreedom']['file'])
    if not os.path.exists(path):
        warn(f"Missing {path} — pressFreedom will use manual scores")
        return {}

    rows = read_csv(path)
    score_col = next((c for c in rows[0] if 'score' in c.lower()), None)
    country_col = next((c for c in rows[0] if 'country' in c.lower()), None)
    if not score_col or not country_col:
        warn(f"RSF: could not find Country or Score column. Columns: {list(rows[0].keys())}")
        return {}

    rsf_scores = {}
    for row in rows:
        try:
            rsf_scores[row[country_col].strip()] = int(float(row[score_col]))
        except (ValueError, KeyError):
            pass

    result = {}
    updated = 0
    for city in city_meta:
        cid = city['id']
        our_country = city['country']
        rsf_name = country_maps.get(our_country, {}).get('rsf_country', our_country)
        if rsf_name in rsf_scores:
            result[cid] = rsf_scores[rsf_name]
            updated += 1
    info(f"pressFreedom (RSF): updated {updated}/{len(city_meta)} cities")
    return result

def load_sipri(city_meta, country_maps):
    """
    SIPRI Military Expenditure (% of GDP) -> militarySpending score.
    Transform: 100 - clamp(pct / 5 * 100, 0, 100)
    So 0% GDP spend -> 100, 5%+ -> 0.
    """
    path = src(SOURCES['militarySpending']['file'])
    if not os.path.exists(path):
        warn(f"Missing {path} — militarySpending will use manual scores")
        return {}

    rows = read_csv(path)
    # SIPRI exports have a header with country in column 0 and years as subsequent columns
    # Auto-detect country column and most recent year column
    cols = list(rows[0].keys())
    country_col = cols[0]
    # Find the rightmost numeric-looking column (the most recent year)
    year_col = None
    for c in reversed(cols[1:]):
        if any(row.get(c, '').replace('.', '').replace('-', '').strip().isdigit()
               for row in rows if row.get(c, '').strip() not in ('', '...')):
            year_col = c
            break

    if not year_col:
        warn(f"SIPRI: could not identify year column. Columns: {cols}")
        return {}

    sipri_scores = {}
    for row in rows:
        val = row.get(year_col, '').strip()
        if not val or val in ('...', 'xxx', 'N/A'):
            continue
        try:
            pct = float(val)
            score = 100 - clamp(round(pct / 5 * 100))
            sipri_scores[row[country_col].strip()] = score
        except ValueError:
            pass

    result = {}
    updated = 0
    for city in city_meta:
        cid = city['id']
        our_country = city['country']
        sipri_name = country_maps.get(our_country, {}).get('sipri_country', our_country)
        if sipri_name in sipri_scores:
            result[cid] = sipri_scores[sipri_name]
            updated += 1
    info(f"militarySpending (SIPRI): updated {updated}/{len(city_meta)} cities")
    return result

def load_ookla(city_meta, country_maps):
    """
    Ookla Speedtest Global Index (country-level median download Mbps) -> internetQuality.
    Transform: clamp(mbps / 200 * 100, 0, 100)
    """
    path = src(SOURCES['internetQuality']['file'])
    if not os.path.exists(path):
        warn(f"Missing {path} — internetQuality will use manual scores")
        return {}

    rows = read_csv(path)
    country_col = next((c for c in rows[0] if 'country' in c.lower()), None)
    speed_col   = next((c for c in rows[0] if 'download' in c.lower() or 'speed' in c.lower() or 'mbps' in c.lower()), None)
    if not country_col or not speed_col:
        warn(f"Ookla: could not find Country or speed column. Columns: {list(rows[0].keys())}")
        return {}

    ookla_scores = {}
    for row in rows:
        try:
            mbps = float(row[speed_col])
            ookla_scores[row[country_col].strip()] = clamp(round(mbps / 200 * 100))
        except (ValueError, KeyError):
            pass

    result = {}
    updated = 0
    for city in city_meta:
        cid = city['id']
        our_country = city['country']
        ookla_name = country_maps.get(our_country, {}).get('ookla_country', our_country)
        if ookla_name in ookla_scores:
            result[cid] = ookla_scores[ookla_name]
            updated += 1
    info(f"internetQuality (Ookla): updated {updated}/{len(city_meta)} cities")
    return result

def load_ef_epi(city_meta, country_maps):
    """
    EF English Proficiency Index -> languageAccess.
    Cities with primaryLanguage='english' get 100.
    Others: use country EPI score directly (already 0-100).
    """
    path = src(SOURCES['languageAccess']['file'])
    if not os.path.exists(path):
        warn(f"Missing {path} — languageAccess will use manual scores")
        return {}

    rows = read_csv(path)
    country_col = next((c for c in rows[0] if 'country' in c.lower()), None)
    score_col   = next((c for c in rows[0] if 'score' in c.lower() or 'epi' in c.lower()), None)
    if not country_col or not score_col:
        warn(f"EF EPI: could not find Country or Score column. Columns: {list(rows[0].keys())}")
        return {}

    epi_scores = {}
    for row in rows:
        try:
            epi_scores[row[country_col].strip()] = int(float(row[score_col]))
        except (ValueError, KeyError):
            pass

    result = {}
    updated = 0
    for city in city_meta:
        cid = city['id']
        if city.get('primaryLanguage', '').lower() == 'english':
            result[cid] = 100
            updated += 1
        else:
            our_country = city['country']
            ef_name = country_maps.get(our_country, {}).get('ef_country', our_country)
            if ef_name in epi_scores:
                result[cid] = epi_scores[ef_name]
                updated += 1
    info(f"languageAccess (EF EPI): updated {updated}/{len(city_meta)} cities")
    return result

def load_henley(city_meta, country_maps):
    """
    Henley Passport Index (# visa-free destinations) -> visaEase.
    Transform: clamp(count / 193 * 100, 0, 100)
    Note: this measures how easily residents CAN travel out, not how easily
    visitors can travel in. Correlates well with visa reciprocity.
    """
    path = src(SOURCES['visaEase']['file'])
    if not os.path.exists(path):
        warn(f"Missing {path} — visaEase will use manual scores")
        return {}

    rows = read_csv(path)
    country_col = next((c for c in rows[0] if 'country' in c.lower()), None)
    count_col   = next((c for c in rows[0] if c != country_col and
                        any(k in c.lower() for k in ('visa', 'destination', 'access', 'score', 'count'))), None)
    if not country_col or not count_col:
        warn(f"Henley: could not find Country or count column. Columns: {list(rows[0].keys())}")
        return {}

    henley_scores = {}
    for row in rows:
        try:
            count = int(float(row[count_col]))
            henley_scores[row[country_col].strip()] = clamp(round(count / 193 * 100))
        except (ValueError, KeyError):
            pass

    result = {}
    updated = 0
    for city in city_meta:
        cid = city['id']
        our_country = city['country']
        henley_name = country_maps.get(our_country, {}).get('henley_country', our_country)
        if henley_name in henley_scores:
            result[cid] = henley_scores[henley_name]
            updated += 1
    info(f"visaEase (Henley): updated {updated}/{len(city_meta)} cities")
    return result

# ---------------------------------------------------------------------------
# City-level source loaders
# ---------------------------------------------------------------------------

def _build_city_lookup(rows, city_col, country_col, city_maps, map_city_key, map_country_key):
    """
    Build a lookup from city_id to score using city_mappings.csv to resolve names.
    city_maps: {city_id -> row from city_mappings.csv}
    map_city_key / map_country_key: which columns in city_mappings.csv to use for matching.
    Returns {source_key: value} for the source, and the city_maps lookup.
    """
    # Build source lookup: (city_name_lower, country_lower) -> value
    src_lookup = {}
    for row in rows:
        city = row.get(city_col, '').strip().lower()
        country = row.get(country_col, '').strip().lower()
        src_lookup[(city, country)] = row
    return src_lookup

def load_numbeo_col(city_meta, city_maps):
    """
    Numbeo Cost of Living Index -> costOfLiving.
    Index NYC=100. Lower = cheaper = better score.
    Normalize inverted: lo=15 (cheapest) hi=120 (most expensive) -> 100..0
    Adjust lo/hi after reviewing your downloaded data's actual range.
    """
    path = src(SOURCES['costOfLiving']['file'])
    if not os.path.exists(path):
        warn(f"Missing {path} — costOfLiving will use manual scores")
        return {}

    rows = read_csv(path)
    city_col    = next((c for c in rows[0] if 'city' in c.lower()), None)
    country_col = next((c for c in rows[0] if 'country' in c.lower()), None)
    score_col   = next((c for c in rows[0] if 'cost of living' in c.lower() or c.lower() == 'col index'), None)
    if not city_col or not country_col or not score_col:
        warn(f"Numbeo COL: missing expected columns. Columns: {list(rows[0].keys())}")
        return {}

    src_lookup = {}
    raw_values = []
    for row in rows:
        try:
            val = float(row[score_col])
            key = (row[city_col].strip().lower(), row[country_col].strip().lower())
            src_lookup[key] = val
            raw_values.append(val)
        except (ValueError, KeyError):
            pass

    lo, hi = min(raw_values), max(raw_values)
    result = {}
    updated = 0
    for city in city_meta:
        cid = city['id']
        cm = city_maps.get(cid, {})
        numbeo_city    = cm.get('numbeo_city', city['name']).strip().lower()
        numbeo_country = cm.get('numbeo_country', city['country']).strip().lower()
        val = src_lookup.get((numbeo_city, numbeo_country))
        if val is not None:
            result[cid] = normalize_invert(val, lo, hi)
            updated += 1
    info(f"costOfLiving (Numbeo): updated {updated}/{len(city_meta)} cities (raw range {lo:.1f}-{hi:.1f})")
    return result

def load_numbeo_property(city_meta, city_maps):
    """
    Numbeo Price-to-Income Ratio -> affordability.
    Higher ratio = less affordable. Inverted and normalized.
    """
    path = src(SOURCES['affordability']['file'])
    if not os.path.exists(path):
        warn(f"Missing {path} — affordability will use manual scores")
        return {}

    rows = read_csv(path)
    city_col    = next((c for c in rows[0] if 'city' in c.lower()), None)
    country_col = next((c for c in rows[0] if 'country' in c.lower()), None)
    score_col   = next((c for c in rows[0] if 'price' in c.lower() and 'income' in c.lower()), None)
    if not city_col or not country_col or not score_col:
        warn(f"Numbeo Property: missing expected columns. Columns: {list(rows[0].keys())}")
        return {}

    src_lookup = {}
    raw_values = []
    for row in rows:
        try:
            val = float(row[score_col])
            key = (row[city_col].strip().lower(), row[country_col].strip().lower())
            src_lookup[key] = val
            raw_values.append(val)
        except (ValueError, KeyError):
            pass

    lo, hi = min(raw_values), max(raw_values)
    result = {}
    updated = 0
    for city in city_meta:
        cid = city['id']
        cm = city_maps.get(cid, {})
        numbeo_city    = cm.get('numbeo_city', city['name']).strip().lower()
        numbeo_country = cm.get('numbeo_country', city['country']).strip().lower()
        val = src_lookup.get((numbeo_city, numbeo_country))
        if val is not None:
            result[cid] = normalize_invert(val, lo, hi)
            updated += 1
    info(f"affordability (Numbeo Property): updated {updated}/{len(city_meta)} cities (raw range {lo:.1f}-{hi:.1f})")
    return result

def load_numbeo_crime(city_meta, city_maps):
    """
    Numbeo Crime Index -> safety.
    Transform: 100 - crime_index (clamped).
    """
    path = src(SOURCES['safety']['file'])
    if not os.path.exists(path):
        warn(f"Missing {path} — safety will use manual scores")
        return {}

    rows = read_csv(path)
    city_col    = next((c for c in rows[0] if 'city' in c.lower()), None)
    country_col = next((c for c in rows[0] if 'country' in c.lower()), None)
    score_col   = next((c for c in rows[0] if 'crime' in c.lower()), None)
    if not city_col or not country_col or not score_col:
        warn(f"Numbeo Crime: missing expected columns. Columns: {list(rows[0].keys())}")
        return {}

    src_lookup = {}
    for row in rows:
        try:
            val = float(row[score_col])
            key = (row[city_col].strip().lower(), row[country_col].strip().lower())
            src_lookup[key] = val
        except (ValueError, KeyError):
            pass

    result = {}
    updated = 0
    for city in city_meta:
        cid = city['id']
        cm = city_maps.get(cid, {})
        numbeo_city    = cm.get('numbeo_city', city['name']).strip().lower()
        numbeo_country = cm.get('numbeo_country', city['country']).strip().lower()
        val = src_lookup.get((numbeo_city, numbeo_country))
        if val is not None:
            result[cid] = clamp(round(100 - val))
            updated += 1
    info(f"safety (Numbeo Crime): updated {updated}/{len(city_meta)} cities")
    return result

def load_iqair(city_meta, city_maps):
    """
    IQAir PM2.5 annual mean -> airQuality.
    Transform: clamp((50 - pm25) / 50 * 100, 0, 100)
    WHO guideline = 5 µg/m3. At 50 µg/m3 score = 0.
    """
    path = src(SOURCES['airQuality']['file'])
    if not os.path.exists(path):
        warn(f"Missing {path} — airQuality will use manual scores")
        return {}

    rows = read_csv(path)
    city_col    = next((c for c in rows[0] if 'city' in c.lower()), None)
    country_col = next((c for c in rows[0] if 'country' in c.lower()), None)
    pm_col      = next((c for c in rows[0] if 'pm2' in c.lower() or 'pm25' in c.lower() or 'concentration' in c.lower()), None)
    if not city_col or not country_col or not pm_col:
        warn(f"IQAir: missing expected columns. Columns: {list(rows[0].keys())}")
        return {}

    src_lookup = {}
    for row in rows:
        try:
            pm25 = float(row[pm_col])
            key = (row[city_col].strip().lower(), row[country_col].strip().lower())
            src_lookup[key] = pm25
        except (ValueError, KeyError):
            pass

    result = {}
    updated = 0
    for city in city_meta:
        cid = city['id']
        cm = city_maps.get(cid, {})
        iqair_city    = cm.get('iqair_city', city['name']).strip().lower()
        iqair_country = cm.get('iqair_country', city['country']).strip().lower()
        pm25 = src_lookup.get((iqair_city, iqair_country))
        if pm25 is not None:
            result[cid] = clamp(round((50 - pm25) / 50 * 100))
            updated += 1
    info(f"airQuality (IQAir): updated {updated}/{len(city_meta)} cities")
    return result

def load_climate_data(city_meta):
    """
    climate-data.org city climate stats -> sunshine, humidity, rainfall, winterWarmth.
    Expected CSV columns: city_id, sunshine_hours, humidity_pct, rainfall_mm, jan_temp_c
    Transforms documented in SOURCES['climate']['note'].
    """
    path = src(SOURCES['climate']['file'])
    if not os.path.exists(path):
        warn(f"Missing {path} — sunshine/humidity/rainfall/winterWarmth will use manual scores")
        return {}

    rows = read_csv(path)
    if not rows or 'city_id' not in rows[0]:
        warn("climate_data.csv: expected 'city_id' column not found")
        return {}

    result = {}
    updated = 0
    for row in rows:
        cid = row.get('city_id', '').strip()
        if not cid:
            continue
        try:
            sunshine  = clamp(round((float(row['sunshine_hours']) - 1000) / 2500 * 100))
            humidity  = clamp(round((float(row['humidity_pct'])  - 30)   / 55   * 100))
            rainfall  = clamp(round( float(row['rainfall_mm'])           / 2500 * 100))
            jan_temp  = float(row['jan_temp_c'])
            winter    = clamp(round((jan_temp + 20) / 45 * 100))
            result[cid] = {
                'sunshine':    sunshine,
                'humidity':    humidity,
                'rainfall':    rainfall,
                'winterWarmth': winter,
            }
            updated += 1
        except (ValueError, KeyError) as e:
            warn(f"climate_data: skipping {cid}: {e}")
    info(f"climate (climate-data.org): updated {updated}/{len(city_meta)} cities")
    return result

# ---------------------------------------------------------------------------
# Main build function
# ---------------------------------------------------------------------------

ALL_DIMS = [
    'corruption', 'pressFreedom', 'costOfLiving', 'affordability', 'transitQuality',
    'climateAction', 'govProgressiveness', 'militarySpending', 'economicOutlook',
    'fossilFuelReliance', 'safety', 'healthcareQuality', 'educationQuality',
    'culturalOfferings', 'walkability', 'internetQuality', 'airQuality', 'foodScene',
    'nightlife', 'naturalBeauty', 'jobMarket', 'languageAccess', 'visaEase',
    'sunshine', 'humidity', 'rainfall', 'winterWarmth',
]

META_COLS = [
    'id', 'name', 'country', 'region', 'population', 'climate', 'industries',
    'primaryLanguage', 'gdpPerCapita', 'density', 'nickname', 'lat', 'lon',
]

OUTPUT_COLS = (
    ['id', 'name', 'country', 'region', 'population', 'climate', 'industries'] +
    ALL_DIMS +
    ['primaryLanguage', 'gdpPerCapita', 'density', 'nickname', 'lat', 'lon']
)

def build():
    print("City-Select Data Pipeline")
    print("=" * 40)

    city_meta     = load_city_meta()
    city_maps     = load_city_mappings()
    country_maps  = load_country_mappings()
    manual        = load_manual_scores()
    print(f"Loaded {len(city_meta)} cities from city_meta.csv")
    print()

    # --- Load all authoritative source overrides ---
    print("Loading authoritative sources...")
    overrides = {
        'corruption':      load_ti_cpi(city_meta, country_maps),
        'pressFreedom':    load_rsf(city_meta, country_maps),
        'militarySpending': load_sipri(city_meta, country_maps),
        'costOfLiving':    load_numbeo_col(city_meta, city_maps),
        'affordability':   load_numbeo_property(city_meta, city_maps),
        'safety':          load_numbeo_crime(city_meta, city_maps),
        'airQuality':      load_iqair(city_meta, city_maps),
        'internetQuality': load_ookla(city_meta, country_maps),
        'languageAccess':  load_ef_epi(city_meta, country_maps),
        'visaEase':        load_henley(city_meta, country_maps),
    }
    climate_overrides = load_climate_data(city_meta)

    print()
    print("Merging and writing output...")

    output_rows = []
    for city in city_meta:
        cid = city['id']
        row = {}

        # Metadata columns
        for col in META_COLS:
            row[col] = city.get(col, '')

        # Dimension columns: start from manual, then apply authoritative overrides
        man = manual.get(cid, {})
        for dim in ALL_DIMS:
            if dim in overrides and cid in overrides[dim]:
                row[dim] = overrides[dim][cid]
            elif dim in ('sunshine', 'humidity', 'rainfall', 'winterWarmth') and cid in climate_overrides:
                row[dim] = climate_overrides[cid][dim]
            else:
                row[dim] = man.get(dim, '')

        output_rows.append({col: row.get(col, '') for col in OUTPUT_COLS})

    out_path = src('cities.csv')
    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=OUTPUT_COLS)
        w.writeheader()
        w.writerows(output_rows)

    print(f"Wrote {len(output_rows)} cities -> cities.csv")
    print()
    print("Done. Run a diff against the previous cities.csv to review score changes.")

if __name__ == '__main__':
    build()
