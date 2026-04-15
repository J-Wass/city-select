#!/usr/bin/env python3
"""
City-Select Source Downloader
==============================
Fetches source data files into data/sources/ for use by data/build.py.

Usage (run from the repo root or the data/ directory):
    python data/sources/download.py

    # Skip the climate API (212 HTTP calls — takes ~2 min):
    python data/sources/download.py --skip-climate

Automated sources fetched here:
  ti_cpi.csv       <- World Bank WGI Control of Corruption
  sipri.csv        <- World Bank Military Expenditure (% of GDP)
  henley.csv       <- Passport Index open dataset (GitHub/ilyankou)
  climate_data.csv <- NASA POWER monthly climate normals

Manual sources — download instructions printed at the end:
  rsf.csv, numbeo_col.csv, numbeo_property.csv, numbeo_crime.csv,
  iqair.csv, ookla.csv, ef_epi.csv

After running, rebuild cities.csv with:
    python data/build.py
"""

import csv
import json
import os
import sys
import time
import urllib.request
import urllib.error
from collections import defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Helpers ───────────────────────────────────────────────────────────────────

def read_csv(filename):
    path = os.path.join(SCRIPT_DIR, filename) if not os.path.isabs(filename) else filename
    with open(path, encoding='utf-8') as f:
        return list(csv.DictReader(f))

def write_csv(filename, fieldnames, rows):
    path = os.path.join(SCRIPT_DIR, filename)
    with open(path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)
    print(f"    Saved {len(rows)} rows -> {filename}")

def fetch(url, label='', retries=3):
    """Fetch URL, return bytes. Retries on failure."""
    headers = {'User-Agent': 'city-select-pipeline/1.0 (open-source research tool)'}
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1.5 ** attempt)
            else:
                raise RuntimeError(f"Failed to fetch {label or url}: {e}") from e

def fetch_json(url, label=''):
    return json.loads(fetch(url, label))

def load_our_countries():
    return {row['our_country'] for row in read_csv('country_mappings.csv')}

# ── Country name matching ─────────────────────────────────────────────────────

# Source-name -> our country name overrides for common mismatches
COUNTRY_ALIASES = {
    # World Bank names
    'korea, rep.':                  'South Korea',
    'iran, islamic rep.':           'Iran',
    "egypt, arab rep.":             'Egypt',
    "cote d'ivoire":                'Ivory Coast',
    "côte d'ivoire":                'Ivory Coast',
    'congo, dem. rep.':             'DR Congo',
    'hong kong sar, china':         'Hong Kong',
    'macao sar, china':             'Macao',
    'taiwan, china':                'Taiwan',
    'syrian arab republic':         'Syria',
    'lao pdr':                      'Laos',
    'cabo verde':                   'Cape Verde',
    'north macedonia':              'North Macedonia',
    'bosnia and herzegovina':       'Bosnia',
    'brunei darussalam':            'Brunei',
    'venezuela, rb':                'Venezuela',
    'yemen, rep.':                  'Yemen',
    'kyrgyz republic':              'Kyrgyzstan',
    'slovak republic':              'Slovakia',
    'eswatini':                     'Eswatini',
    'micronesia, fed. sts.':        'Micronesia',
    'bahamas, the':                 'Bahamas',
    'gambia, the':                  'Gambia',
    # Passport index names
    'uae':                          'United Arab Emirates',
    'united arab emirates':         'United Arab Emirates',
    'russia':                       'Russia',
    'south korea':                  'South Korea',
    'south africa':                 'South Africa',
    'new zealand':                  'New Zealand',
    'saudi arabia':                 'Saudi Arabia',
    'ivory coast':                  'Ivory Coast',
    'dr congo':                     'DR Congo',
    'north korea':                  'North Korea',
    'trinidad & tobago':            'Trinidad and Tobago',
    'st kitts & nevis':             'Saint Kitts and Nevis',
    'st lucia':                     'Saint Lucia',
    'st vincent & the grenadines':  'Saint Vincent and the Grenadines',
    'antigua & barbuda':            'Antigua and Barbuda',
    'sao tome & principe':          'Sao Tome and Principe',
    'guinea-bissau':                'Guinea-Bissau',
}

def match_name(raw_name, our_countries):
    """Map a source country name to our canonical country name."""
    lower = raw_name.strip().lower()
    if lower in COUNTRY_ALIASES:
        return COUNTRY_ALIASES[lower]
    our_lower = {c.lower(): c for c in our_countries}
    return our_lower.get(lower)

# ── Source 1: World Bank WGI Control of Corruption ───────────────────────────

def download_corruption():
    """
    World Bank WGI Control of Corruption (CC.EST) -> ti_cpi.csv
    Raw scale: -2.5 (very corrupt) to +2.5 (very clean)
    Normalized: (val + 2.5) / 5.0 * 100 -> 0-100
    """
    print("\n[1/4] World Bank: Control of Corruption (WGI)...")

    # Fetch country metadata for name lookup
    meta_url = 'https://api.worldbank.org/v2/country?format=json&per_page=300'
    meta_data = fetch_json(meta_url, 'WB country list')
    wb_names = {c['id']: c['name'] for c in (meta_data[1] or [])}  # iso3 -> name

    # Fetch CC.EST indicator (most recent year)
    ind_url = ('https://api.worldbank.org/v2/country/all/indicator/CC.EST'
               '?format=json&mrv=1&per_page=300')
    ind_data = fetch_json(ind_url, 'WB CC.EST')
    # Handle pagination (WB returns up to 300 per page)
    total_pages = ind_data[0].get('pages', 1)
    records = list(ind_data[1] or [])
    for page in range(2, total_pages + 1):
        more = fetch_json(ind_url + f'&page={page}', f'WB CC.EST page {page}')
        records.extend(more[1] or [])

    our_countries = load_our_countries()
    rows = []
    for item in records:
        if item.get('value') is None:
            continue
        iso3     = item['countryiso3code']
        wb_name  = wb_names.get(iso3, item['country']['value'])
        our_name = match_name(wb_name, our_countries)
        if not our_name:
            continue
        score = round((item['value'] + 2.5) / 5.0 * 100)
        score = max(0, min(100, score))
        rows.append({'Country or Territory': our_name, 'CPI score': score})

    write_csv('ti_cpi.csv', ['Country or Territory', 'CPI score'], rows)
    print(f"    Matched {len(rows)}/{len(our_countries)} countries "
          f"(year: {records[0]['date'] if records else '?'})")

# ── Source 2: World Bank Military Expenditure ────────────────────────────────

def download_military():
    """
    World Bank Military Expenditure (% GDP) -> sipri.csv
    build.py transform: 100 - clamp(pct / 5 * 100, 0, 100)
    """
    print("\n[2/4] World Bank: Military Expenditure % GDP...")

    meta_url = 'https://api.worldbank.org/v2/country?format=json&per_page=300'
    meta_data = fetch_json(meta_url, 'WB country list')
    wb_names = {c['id']: c['name'] for c in (meta_data[1] or [])}

    ind_url = ('https://api.worldbank.org/v2/country/all/indicator/MS.MIL.XPND.GD.ZS'
               '?format=json&mrv=1&per_page=300')
    ind_data = fetch_json(ind_url, 'WB MILEX')
    total_pages = ind_data[0].get('pages', 1)
    records = list(ind_data[1] or [])
    for page in range(2, total_pages + 1):
        more = fetch_json(ind_url + f'&page={page}', f'WB MILEX page {page}')
        records.extend(more[1] or [])

    our_countries = load_our_countries()
    rows = []
    year_seen = None
    for item in records:
        if item.get('value') is None:
            continue
        year_seen = item['date']
        iso3     = item['countryiso3code']
        wb_name  = wb_names.get(iso3, item['country']['value'])
        our_name = match_name(wb_name, our_countries)
        if not our_name:
            continue
        rows.append({'Country': our_name, year_seen: round(item['value'], 4)})

    year_col = year_seen or '2024'
    write_csv('sipri.csv', ['Country', year_col], rows)
    print(f"    Matched {len(rows)}/{len(our_countries)} countries (year: {year_col})")

# ── Source 3: Passport Index ──────────────────────────────────────────────────

def download_passport_index():
    """
    ilyankou/passport-index-dataset (GitHub) -> henley.csv
    Counts destinations accessible without a visa pre-application:
    numeric day values (e.g. "90", "180") = visa-free
    "visa on arrival" = accessible on arrival
    (excludes: "visa required", "e-visa", "-1" = no admission)
    """
    print("\n[3/4] Passport Index (GitHub/ilyankou)...")

    url = ('https://raw.githubusercontent.com/ilyankou/'
           'passport-index-dataset/master/passport-index-tidy.csv')
    raw = fetch(url, 'passport-index-tidy.csv').decode('utf-8')

    our_countries = load_our_countries()
    accessible = defaultdict(int)  # passport country name -> count

    for row in csv.DictReader(raw.splitlines()):
        passport = row.get('Passport', '').strip()
        req      = row.get('Requirement', '').strip().lower()
        # Count as visa-free: numeric day values or "visa on arrival"
        if req == 'visa on arrival' or (req.lstrip('-').isdigit() and req != '-1'):
            accessible[passport] += 1

    rows = []
    for passport, count in accessible.items():
        our_name = match_name(passport, our_countries)
        if our_name:
            rows.append({'Country': our_name, 'Visa-Free Destinations': count})

    write_csv('henley.csv', ['Country', 'Visa-Free Destinations'], rows)
    print(f"    Matched {len(rows)}/{len(our_countries)} countries")

# ── Source 4: NASA POWER Climate Normals ─────────────────────────────────────

NASA_URL = (
    'https://power.larc.nasa.gov/api/temporal/climatology/point'
    '?parameters=T2M,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN'
    '&community=RE'
    '&longitude={lon}'
    '&latitude={lat}'
    '&format=JSON'
    '&user=cityselect'
)

# Empirical factor to convert NASA POWER solar irradiance (kWh/m²/day)
# to approximate sunshine hours/year. Calibrated against reference cities.
# Dubai: ~7.0 kWh/m²/day -> 3500h actual (factor ~1.37)
# Tokyo: ~3.9 kWh/m²/day -> 1876h actual (factor ~1.32)
SOLAR_TO_SUN_HOURS = 1.35  # kWh/m²/day * 365 * factor ≈ annual sunshine hours

def download_climate(skip=False):
    """
    NASA POWER monthly climatology (multi-year averages) -> climate_data.csv
    One API call per city. Supports resuming: skips cities already in the file.

    Variables fetched:
      T2M           -> jan_temp_c    (January mean temperature, °C)
      PRECTOTCORR   -> rainfall_mm   (annual total precipitation, mm)
      RH2M          -> humidity_pct  (annual mean relative humidity, %)
      ALLSKY_SFC_SW -> sunshine_hours (solar irradiance converted to ~sunshine hours)
    """
    if skip:
        print("\n[4/4] Climate data — skipped (--skip-climate flag set)")
        return

    print("\n[4/4] NASA POWER: Climate normals (212 API calls, ~2 min)...")
    print("    Use --skip-climate to skip this step.")

    city_meta = read_csv('city_meta.csv')

    # Resume support: load existing rows
    existing_path = os.path.join(SCRIPT_DIR, 'climate_data.csv')
    existing = {}
    if os.path.exists(existing_path):
        for row in read_csv('climate_data.csv'):
            existing[row['city_id']] = row

    fields = ['city_id', 'sunshine_hours', 'humidity_pct', 'rainfall_mm', 'jan_temp_c']
    rows = dict(existing)  # start from existing; will overwrite on success
    to_fetch = [c for c in city_meta if c['id'] not in existing]

    if not to_fetch:
        print(f"    All {len(city_meta)} cities already downloaded. Delete climate_data.csv to re-fetch.")
        return

    print(f"    Fetching {len(to_fetch)} cities ({len(existing)} already cached)...")

    for i, city in enumerate(to_fetch):
        cid  = city['id']
        name = city['name']
        lat  = city['lat']
        lon  = city['lon']

        print(f"    ({len(existing) + i + 1}/{len(city_meta)}) {name}...", end='', flush=True)

        url = NASA_URL.format(lat=lat, lon=lon)
        try:
            data = fetch_json(url, name)
            params = data['properties']['parameter']

            t2m   = params['T2M']       # monthly temp °C
            prcp  = params['PRECTOTCORR']  # mm/day monthly avg
            rh    = params['RH2M']      # % monthly avg
            solar = params['ALLSKY_SFC_SW_DWN']  # kWh/m²/day monthly avg

            jan_temp    = t2m.get('JAN', -999)
            if jan_temp == -999:
                raise ValueError("missing JAN temperature")

            ann_solar   = solar.get('ANN', -999)
            ann_prcp    = prcp.get('ANN', -999)
            ann_rh      = rh.get('ANN', -999)
            if any(v == -999 for v in [ann_solar, ann_prcp, ann_rh]):
                raise ValueError("missing annual value")

            sunshine_hours = round(ann_solar * 365 * SOLAR_TO_SUN_HOURS)
            rainfall_mm    = round(ann_prcp  * 365)
            humidity_pct   = round(ann_rh, 1)

            rows[cid] = {
                'city_id':       cid,
                'sunshine_hours': sunshine_hours,
                'humidity_pct':  humidity_pct,
                'rainfall_mm':   rainfall_mm,
                'jan_temp_c':    round(jan_temp, 1),
            }
            print(f" {sunshine_hours}h sun, {rainfall_mm}mm rain, Jan {round(jan_temp,1)}°C")

            # Save after every city for crash-resilience
            write_csv('climate_data.csv', fields, list(rows.values()))

        except Exception as e:
            print(f" [FAIL] {e}")

        time.sleep(0.15)  # be polite to NASA POWER

    print(f"    Climate data complete: {len(rows)}/{len(city_meta)} cities")

# ── Manual download instructions ─────────────────────────────────────────────

MANUAL_INSTRUCTIONS = """
=== Manual Downloads Required ===
Place each file in data/sources/ then run: python data/build.py

-- PRESS FREEDOM (rsf.csv) --
   Source:  https://rsf.org/en/index
   Steps:   Open index page -> click download/export icon -> save as CSV
   Columns: Country, Score  (0-100, higher = more free)

-- COST OF LIVING (numbeo_col.csv) --
   Source:  https://www.numbeo.com/cost-of-living/rankings.jsp
   Steps:   Select year -> right-click table -> Export or copy as CSV
   Columns: City, Country, Cost of Living Index

-- HOUSING AFFORDABILITY (numbeo_property.csv) --
   Source:  https://www.numbeo.com/property-investment/rankings.jsp
   Steps:   Same export method as Cost of Living
   Columns: City, Country, Price To Income Ratio

-- SAFETY / CRIME (numbeo_crime.csv) --
   Source:  https://www.numbeo.com/crime/rankings.jsp
   Steps:   Same export method as Cost of Living
   Columns: City, Country, Crime Index

-- AIR QUALITY (iqair.csv) --
   Source:  https://www.iqair.com/world-air-quality-report
   Steps:   Download annual report -> get supplemental city PM2.5 spreadsheet
   Columns: City, Country, PM2.5  (annual mean ug/m3)

-- INTERNET SPEED (ookla.csv) --
   Source:  https://www.speedtest.net/global-index
   Steps:   Select Fixed Broadband -> export or transcribe country rankings
   Columns: Country, Download Speed (Mbps)

-- ENGLISH PROFICIENCY (ef_epi.csv) --
   Source:  https://www.ef.com/wwen/epi/
   Steps:   Download full country rankings from the EPI page
   Columns: Country, EPI Score  (0-100)
"""

# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    skip_climate = '--skip-climate' in sys.argv

    print("City-Select Source Downloader")
    print("=" * 40)
    print("Fetching automated sources...")

    errors = []

    for label, fn in [
        ("corruption (WB WGI)",  download_corruption),
        ("military spend (WB)",  download_military),
        ("visa ease (passport)",  download_passport_index),
    ]:
        try:
            fn()
        except Exception as e:
            print(f"    [ERROR] {e}")
            errors.append(label)

    try:
        download_climate(skip=skip_climate)
    except Exception as e:
        print(f"    [ERROR] {e}")
        errors.append("climate (NASA POWER)")

    print(MANUAL_INSTRUCTIONS)

    if errors:
        print(f"[!] {len(errors)} source(s) failed: {', '.join(errors)}")
        print("    Check your internet connection and retry.")
    else:
        print("Automated downloads complete.")

    print("Next step: python data/build.py\n")

if __name__ == '__main__':
    main()
