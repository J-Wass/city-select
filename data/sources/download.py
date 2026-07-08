#!/usr/bin/env python3
"""
City-Select Source Downloader
==============================
Fetches source data files into data/sources/ for use by data/build.py.

Usage (run from the repo root or the data/ directory):
    python data/sources/download.py

    # Skip the climate API (one HTTP call per city — takes a few minutes):
    python data/sources/download.py --skip-climate

Automated sources fetched here:
  ti_cpi.csv          <- World Bank WGI Control of Corruption
  sipri.csv           <- World Bank Military Expenditure (% of GDP)
  henley.csv          <- Passport Index open dataset (GitHub/ilyankou)
  climate_data.csv    <- NASA POWER monthly climate normals
  rsf.csv             <- RSF World Press Freedom Index (official CSV)
  ookla.csv           <- Ookla Speedtest Global Index (fixed broadband)
  ef_epi.csv          <- EF English Proficiency Index
  numbeo_col.csv      <- Numbeo Cost of Living rankings
  numbeo_property.csv <- Numbeo Price-to-Income rankings
  numbeo_crime.csv    <- Numbeo Crime Index rankings
  who_air.csv         <- WHO Ambient Air Quality Database (city PM2.5)

Optional manual upgrade — instructions printed at the end:
  iqair.csv data can replace who_air.csv rows if you obtain the IQAir
  annual report spreadsheet (fresher data, but no automated download).

After running, rebuild cities.csv with:
    python data/build.py
"""

import csv
import html as html_mod
import json
import os
import re
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

BROWSER_UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
              '(KHTML, like Gecko) Chrome/126.0 Safari/537.36')

def fetch(url, label='', retries=3, ua=None):
    """Fetch URL, return bytes. Retries on failure."""
    headers = {'User-Agent': ua or 'city-select-pipeline/1.0 (open-source research tool)'}
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

def clamp(value, lo=0, hi=100):
    return max(lo, min(hi, value))

def decode_best(raw):
    """Decode bytes as UTF-8, falling back to cp1252 (RSF/Ookla ship non-UTF8)."""
    try:
        return raw.decode('utf-8-sig')
    except UnicodeDecodeError:
        return raw.decode('cp1252')

# ── Country name matching ─────────────────────────────────────────────────────

# Source-name -> our country name overrides for common mismatches
COUNTRY_ALIASES = {
    # World Bank names
    'korea, rep.':                  'South Korea',
    'czechia':                      'Czech Republic',
    'turkiye':                      'Turkey',
    'türkiye':                      'Turkey',
    'viet nam':                     'Vietnam',
    'iran, islamic rep.':           'Iran',
    "egypt, arab rep.":             'Egypt',
    "cote d'ivoire":                'Ivory Coast',
    "côte d'ivoire":                'Ivory Coast',
    'congo, dem. rep.':             'DR Congo',
    'democratic republic of congo': 'DR Congo',
    'democratic republic of the congo': 'DR Congo',
    'hong kong sar, china':         'Hong Kong',
    'hong kong (china)':            'Hong Kong',
    'macao sar, china':             'Macao',
    'macao (china)':                'Macao',
    'myanmar (burma)':              'Myanmar',
    'bosnia-herzegovina':           'Bosnia',
    'morocco / western sahara':     'Morocco',
    # WHO / UN-style names
    'united states of america':     'United States',
    'united kingdom of great britain and northern ireland': 'United Kingdom',
    'republic of korea':            'South Korea',
    'iran (islamic republic of)':   'Iran',
    'bolivia (plurinational state of)': 'Bolivia',
    'russian federation':           'Russia',
    'venezuela (bolivarian republic of)': 'Venezuela',
    'china, hong kong sar':         'Hong Kong',
    'china, macao sar':             'Macao',
    'republic of north macedonia':  'North Macedonia',
    'united republic of tanzania':  'Tanzania',
    "lao people's democratic republic": 'Laos',
    'republic of moldova':          'Moldova',
    'netherlands (kingdom of the)': 'Netherlands',
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

# Some COUNTRY_ALIASES values are legacy source-file spellings rather than
# our canonical names (country_mappings.csv translates them at build time
# for the older sources). Newer sources write canonical names directly.
CANONICAL_FIXUPS = {
    'dr congo': 'Democratic Republic of Congo',
}

def match_canonical(raw_name, our_countries):
    """Like match_name, but guarantees the result is one of our canonical
    country names (or None). Use for sources build.py joins on our_country."""
    m = match_name(raw_name, our_countries)
    if not m:
        return None
    if m in our_countries:
        return m
    return CANONICAL_FIXUPS.get(m.lower())

# ── Source 1: World Bank WGI Control of Corruption ───────────────────────────

def download_corruption():
    """
    World Bank WGI Control of Corruption governance score -> ti_cpi.csv
    Indicator GOV_WGI_CC.SC (WGI database, source=3) is natively 0-100
    (higher = cleaner). Used directly.
    Note: the old CC.EST indicator was archived from the default WDI
    database; WGI now lives in its own database with GOV_WGI_* ids.
    """
    print("\n[1/4] World Bank: Control of Corruption (WGI)...")

    # Fetch country metadata for name lookup
    meta_url = 'https://api.worldbank.org/v2/country?format=json&per_page=300'
    meta_data = fetch_json(meta_url, 'WB country list')
    wb_names = {c['id']: c['name'] for c in (meta_data[1] or [])}  # iso3 -> name

    # Fetch the 0-100 governance score (most recent year)
    ind_url = ('https://api.worldbank.org/v2/country/all/indicator/GOV_WGI_CC.SC'
               '?format=json&mrv=1&per_page=300&source=3')
    ind_data = fetch_json(ind_url, 'WB GOV_WGI_CC.SC')
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
        score = max(0, min(100, round(item['value'])))
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

# ── Source 4: RSF World Press Freedom Index ──────────────────────────────────

def download_rsf():
    """
    RSF publishes the full index as a semicolon-separated CSV -> rsf.csv
    Score is 0-100 (higher = more press freedom), decimal-comma formatted.
    build.py uses the score directly.
    """
    print("\n[RSF] World Press Freedom Index...")

    url = 'https://rsf.org/sites/default/files/import_classement/2025.csv'
    raw = decode_best(fetch(url, 'RSF 2025 CSV'))
    rows = list(csv.DictReader(raw.splitlines(), delimiter=';'))

    score_col = next((c for c in rows[0] if c.lower().startswith('score')), None)
    if not score_col or 'Country_EN' not in rows[0]:
        raise RuntimeError(f"RSF: unexpected columns: {list(rows[0].keys())}")

    our_countries = load_our_countries()
    out = []
    for row in rows:
        name = (row.get('Country_EN') or '').strip()
        our_name = match_name(name, our_countries)
        if not our_name:
            continue
        try:
            score = float(row[score_col].replace(',', '.'))
        except ValueError:
            continue
        out.append({'Country': our_name, 'Score': round(score, 2)})

    write_csv('rsf.csv', ['Country', 'Score'], out)
    print(f"    Matched {len(out)}/{len(our_countries)} countries (index year: 2025)")

# ── Source 5: Ookla Speedtest Global Index ────────────────────────────────────

def download_ookla():
    """
    Ookla Speedtest Global Index -> ookla.csv
    Scrapes the fixed-broadband column (median download Mbps per country)
    from the public rankings page.
    build.py transform: clamp(mbps / 200 * 100, 0, 100)
    """
    print("\n[Ookla] Speedtest Global Index (fixed broadband)...")

    html = decode_best(fetch('https://www.speedtest.net/global-index',
                             'Ookla global index', ua=BROWSER_UA))

    i = html.find('id="column-fixedMean"')
    if i == -1:
        raise RuntimeError("Ookla: fixed-broadband column not found in page")
    # Only the first table inside the column div is the download-speed ranking;
    # later tables on the page repeat countries with other metrics.
    end = html.find('</table>', i)
    chunk = html[i:end if end != -1 else len(html)]

    pairs = re.findall(
        r'class="country">\s*<a[^>]*>\s*([^<]+?)\s*</a>\s*</td>\s*'
        r'<td class="speed">([\d.]+)</td>',
        chunk)
    if len(pairs) < 50:
        raise RuntimeError(f"Ookla: only parsed {len(pairs)} rows — page layout changed?")

    our_countries = load_our_countries()
    out = []
    for name, mbps in pairs:
        our_name = match_name(html_mod.unescape(name), our_countries)
        if our_name:
            out.append({'Country': our_name, 'Download Speed (Mbps)': mbps})

    write_csv('ookla.csv', ['Country', 'Download Speed (Mbps)'], out)
    print(f"    Matched {len(out)}/{len(our_countries)} countries "
          f"({len(pairs)} in source)")

# ── Source 6: EF English Proficiency Index ────────────────────────────────────

def download_ef_epi():
    """
    EF EPI country scores -> ef_epi.csv
    The EPI page embeds all country data in its __NEXT_DATA__ JSON blob.
    Raw EF scores sit on a ~350-650 band scale; rescaled to 0-100 via
    (score - 350) / 300 * 100 (350 -> 0, 650 -> 100) since build.py
    expects a 0-100 value it can use directly.
    English-primary cities are set to 100 by build.py regardless.
    """
    print("\n[EF EPI] English Proficiency Index...")

    html = fetch('https://www.ef.com/wwen/epi/', 'EF EPI page',
                 ua=BROWSER_UA).decode('utf-8', errors='replace')

    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not m:
        raise RuntimeError("EF EPI: __NEXT_DATA__ blob not found in page")
    data = json.loads(m.group(1))
    summary = data['props']['pageProps']['centralData']['homepage']['countrySummary']

    our_countries = load_our_countries()
    out = []
    for entry in summary:
        for _iso2, d in entry.items():
            name = d.get('countrySlug', '').replace('-', ' ').title()
            raw = d.get('efEpiScore')
            if not name or not isinstance(raw, (int, float)):
                continue
            our_name = match_name(name, our_countries)
            if not our_name:
                continue
            out.append({'Country': our_name,
                        'EPI Score': clamp(round((raw - 350) / 300 * 100))})

    write_csv('ef_epi.csv', ['Country', 'EPI Score'], out)
    print(f"    Matched {len(out)}/{len(our_countries)} countries "
          f"({len(summary)} in source)")

# ── Source 7: Numbeo city rankings (cost of living, property, crime) ─────────

NUMBEO_PAGES = [
    ('cost-of-living',      'numbeo_col.csv',      'Cost of Living Index'),
    ('property-investment', 'numbeo_property.csv', 'Price To Income Ratio'),
    ('crime',               'numbeo_crime.csv',    'Crime Index'),
]

def download_numbeo():
    """
    Numbeo current-year city rankings -> numbeo_col.csv, numbeo_property.csv,
    numbeo_crime.csv. Each rankings page server-renders a table (id="t2")
    whose first numeric column is the index named in NUMBEO_PAGES.
    City cells look like "Zurich, Switzerland" or "Austin, TX, United States";
    the first comma part is the city, the last is the country.
    """
    print("\n[Numbeo] City rankings (3 pages)...")

    our_countries = load_our_countries()
    for slug, fname, colname in NUMBEO_PAGES:
        url = f'https://www.numbeo.com/{slug}/rankings.jsp'
        html = fetch(url, f'Numbeo {slug}', ua=BROWSER_UA).decode('utf-8', errors='replace')

        m = re.search(r'<table id="t2".*?</table>', html, re.S)
        if not m:
            raise RuntimeError(f"Numbeo {slug}: table id='t2' not found")

        out = []
        for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', m.group(0), re.S):
            city_m  = re.search(r'class="cityOrCountryInIndicesTable">([^<]+)<', tr)
            value_m = re.search(r'<td style="text-align: right">([\d.]+)</td>', tr)
            if not city_m or not value_m:
                continue
            parts = [p.strip() for p in html_mod.unescape(city_m.group(1)).split(',')]
            if len(parts) < 2:
                continue
            city, country = parts[0], parts[-1]
            country = match_name(country, our_countries) or country
            out.append({'City': city, 'Country': country, colname: value_m.group(1)})

        write_csv(fname, ['City', 'Country', colname], out)
        time.sleep(1)  # be polite between pages

# ── Source 8: WHO Ambient Air Quality Database ───────────────────────────────

WHO_AIR_URL = ('https://cdn.who.int/media/docs/default-source/air-pollution-documents/'
               'air-quality-and-health/who_ambient_air_quality_database_version_2024_'
               '(v6.1).xlsx?sfvrsn=c504c0cd_3&download=true')

def _parse_who_xlsx(raw):
    """Parse the WHO xlsx (stdlib only) -> list of dicts with pm2.5 rows."""
    import io
    import zipfile
    from xml.etree import ElementTree as ET

    NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
    z = zipfile.ZipFile(io.BytesIO(raw))
    sst = []
    for si in ET.fromstring(z.read('xl/sharedStrings.xml')):
        sst.append(''.join(t.text or '' for t in si.iter(NS + 't')))

    def col_idx(ref):
        n = 0
        for ch in ref:
            if ch.isalpha():
                n = n * 26 + (ord(ch) - 64)
        return n - 1

    # Data lives on the sheet named "Update ..." — find its xml via the rels
    wb = z.read('xl/workbook.xml').decode('utf-8')
    rels = z.read('xl/_rels/workbook.xml.rels').decode('utf-8')
    rid = next(r for name, r in re.findall(r'<sheet name="([^"]+)"[^>]*r:id="(rId\d+)"', wb)
               if name.lower().startswith('update'))
    target = dict(re.findall(r'Id="(rId\d+)" [^>]*Target="(worksheets/[^"]+)"', rels))[rid]

    header, out = None, []
    for _ev, el in ET.iterparse(z.open('xl/' + target)):
        if el.tag != NS + 'row':
            continue
        vals = {}
        for c in el.findall(NS + 'c'):
            v = c.find(NS + 'v')
            if v is not None:
                vals[col_idx(c.get('r') or '')] = sst[int(v.text)] if c.get('t') == 's' else v.text
        el.clear()
        if header is None:
            header = {v: k for k, v in vals.items()}
            continue
        g = lambda k: vals.get(header[k], '')
        try:
            out.append({
                'name':    g('city').split('/')[0].strip(),
                'country': g('country_name').strip(),
                'year':    int(float(g('year'))),
                'pm25':    float(g('pm25_concentration')),
                'lat':     float(g('latitude')),
                'lon':     float(g('longitude')),
            })
        except (ValueError, KeyError):
            pass  # rows with 'NA' pm2.5 or missing coords
    return out

def _haversine_km(lat1, lon1, lat2, lon2):
    import math
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(a))

def download_who_air():
    """
    WHO Ambient Air Quality Database (V6.1, Jan 2024) -> who_air.csv
    City-level annual-mean PM2.5. Each of our cities is matched to a WHO
    settlement geographically (city_meta lat/lon vs WHO station coords):
      1. most recent reading within 25 km
      2. else exact name + country match (WHO coords are yearly station
         averages and occasionally drift far from the city proper)
      3. else most recent reading within 40 km
    Output is keyed by city_id, so build.py joins directly with no
    name-matching. build.py transform: clamp((50 - pm25) / 50 * 100).
    """
    print("\n[WHO] Ambient Air Quality Database (city PM2.5)...")

    raw = fetch(WHO_AIR_URL, 'WHO air quality xlsx', ua=BROWSER_UA)
    rows = _parse_who_xlsx(raw)
    print(f"    Parsed {len(rows)} city-year PM2.5 readings")

    our_countries = load_our_countries()
    city_meta = read_csv('city_meta.csv')

    out = []
    for city in city_meta:
        clat, clon = float(city['lat']), float(city['lon'])
        near = [(r, _haversine_km(clat, clon, r['lat'], r['lon'])) for r in rows]

        pick = None
        close = [(r, d) for r, d in near if d <= 25]
        if close:
            pick = max(close, key=lambda x: (x[0]['year'], -x[1]))[0]
        else:
            name_l = city['name'].lower()
            named = [r for r in rows
                     if r['name'].lower() == name_l
                     and (match_name(r['country'], our_countries) or r['country']) == city['country']]
            if named:
                pick = max(named, key=lambda r: r['year'])
            else:
                wider = [(r, d) for r, d in near if d <= 40]
                if wider:
                    pick = max(wider, key=lambda x: (x[0]['year'], -x[1]))[0]

        if pick:
            out.append({'city_id': city['id'], 'City': pick['name'],
                        'Country': pick['country'], 'PM2.5': round(pick['pm25'], 1),
                        'Year': pick['year']})

    write_csv('who_air.csv', ['city_id', 'City', 'Country', 'PM2.5', 'Year'], out)
    print(f"    Matched {len(out)}/{len(city_meta)} cities")

# ── Source 9: Freedom House Freedom in the World ─────────────────────────────

def download_freedom_house():
    """
    Freedom House "Freedom in the World" aggregate score -> freedom_house.csv
    The country scores page server-renders a table with each country's
    total score out of 100. Used directly for govProgressiveness.
    """
    print("\n[Freedom House] Freedom in the World scores...")

    html = decode_best(fetch('https://freedomhouse.org/country/scores',
                             'Freedom House scores', ua=BROWSER_UA))
    m = re.search(r'<table[^>]*>.*?</table>', html, re.S)
    if not m:
        raise RuntimeError("Freedom House: score table not found in page")

    our_countries = load_our_countries()
    out = []
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', m.group(0), re.S):
        name_m  = re.search(r'<a href="/country/[^"]*">([^<]+)</a>', tr)
        score_m = re.search(r'<span class="score">(\d+)</span>', tr)
        if not name_m or not score_m:
            continue
        our_name = match_canonical(name_m.group(1).replace('*', ''), our_countries)
        if our_name:
            out.append({'Country': our_name, 'Score': int(score_m.group(1))})

    write_csv('freedom_house.csv', ['Country', 'Score'], out)
    print(f"    Matched {len(out)}/{len(our_countries)} countries")

# ── Source 10: WHO UHC Service Coverage Index ────────────────────────────────

def download_who_uhc():
    """
    WHO Universal Health Coverage service coverage index -> who_uhc.csv
    GHO OData API, indicator UHC_INDEX_REPORTED. Index is 0-100
    (higher = better health service coverage); latest year per country.
    Used directly for healthcareQuality.
    """
    print("\n[WHO UHC] Universal Health Coverage index...")

    data = fetch_json('https://ghoapi.azureedge.net/api/UHC_INDEX_REPORTED',
                      'WHO GHO UHC index')

    # ISO3 -> name via the World Bank country list (same as other WB sources)
    meta = fetch_json('https://api.worldbank.org/v2/country?format=json&per_page=300',
                      'WB country list')
    iso_names = {c['id']: c['name'] for c in (meta[1] or [])}

    latest = {}  # iso3 -> (year, value)
    for item in data.get('value', []):
        if item.get('SpatialDimType') != 'COUNTRY' or item.get('NumericValue') is None:
            continue
        iso3, year = item['SpatialDim'], item['TimeDim']
        if iso3 not in latest or year > latest[iso3][0]:
            latest[iso3] = (year, item['NumericValue'])

    our_countries = load_our_countries()
    out = []
    for iso3, (year, val) in latest.items():
        name = iso_names.get(iso3)
        our_name = match_canonical(name, our_countries) if name else None
        if our_name:
            out.append({'Country': our_name, 'Score': clamp(round(val))})

    write_csv('who_uhc.csv', ['Country', 'Score'], out)
    print(f"    Matched {len(out)}/{len(our_countries)} countries")

# ── Source 11: World Bank Harmonized Learning Outcomes ───────────────────────

def download_wb_education():
    """
    World Bank Harmonized Test Scores (HD.HCI.HLOS) -> wb_hlo.csv
    Raw scores sit on a ~300-625 band; rescaled to 0-100 via
    (score - 300) / 300 * 100 (300 -> 0, 600 -> 100).
    Used for educationQuality.
    """
    print("\n[WB HLO] Harmonized Learning Outcomes...")

    meta = fetch_json('https://api.worldbank.org/v2/country?format=json&per_page=300',
                      'WB country list')
    wb_names = {c['id']: c['name'] for c in (meta[1] or [])}

    url = ('https://api.worldbank.org/v2/country/all/indicator/HD.HCI.HLOS'
           '?format=json&mrv=1&per_page=300')
    data = fetch_json(url, 'WB HLO')
    records = list(data[1] or [])
    for page in range(2, data[0].get('pages', 1) + 1):
        records.extend(fetch_json(url + f'&page={page}', f'WB HLO page {page}')[1] or [])

    our_countries = load_our_countries()
    out = []
    for item in records:
        if item.get('value') is None:
            continue
        name = wb_names.get(item['countryiso3code'], item['country']['value'])
        our_name = match_canonical(name, our_countries)
        if our_name:
            out.append({'Country': our_name,
                        'Score': clamp(round((item['value'] - 300) / 300 * 100))})

    write_csv('wb_hlo.csv', ['Country', 'Score'], out)
    print(f"    Matched {len(out)}/{len(our_countries)} countries")

# ── Source 12: World Bank GDP growth (economic outlook) ──────────────────────

def download_wb_gdp_growth():
    """
    World Bank real GDP growth (NY.GDP.MKTP.KD.ZG), 3-year average
    -> wb_gdp.csv. Mapped to 0-100 via (avg + 2) / 8 * 100
    (-2% -> 0, +6% -> 100). Used for economicOutlook.
    (IMF WEO forecasts would be preferable but the datamapper API
    blocks non-browser clients.)
    """
    print("\n[WB GDP] Real GDP growth (3-year average)...")

    meta = fetch_json('https://api.worldbank.org/v2/country?format=json&per_page=300',
                      'WB country list')
    wb_names = {c['id']: c['name'] for c in (meta[1] or [])}

    url = ('https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.KD.ZG'
           '?format=json&mrv=3&per_page=300')
    data = fetch_json(url, 'WB GDP growth')
    records = list(data[1] or [])
    for page in range(2, data[0].get('pages', 1) + 1):
        records.extend(fetch_json(url + f'&page={page}', f'WB GDP page {page}')[1] or [])

    growth = defaultdict(list)  # iso3 -> [values]
    for item in records:
        if item.get('value') is not None:
            growth[item['countryiso3code']].append(item['value'])

    our_countries = load_our_countries()
    out = []
    for iso3, vals in growth.items():
        name = wb_names.get(iso3)
        our_name = match_canonical(name, our_countries) if name else None
        if our_name:
            avg = sum(vals) / len(vals)
            out.append({'Country': our_name,
                        'Score': clamp(round((avg + 2) / 8 * 100))})

    write_csv('wb_gdp.csv', ['Country', 'Score'], out)
    print(f"    Matched {len(out)}/{len(our_countries)} countries")

# ── Source 13: OWID/Ember fossil share of electricity ────────────────────────

def download_owid_fossil():
    """
    Our World in Data (Ember) share of electricity from fossil fuels
    -> owid_fossil.csv. Inverted: score = 100 - fossil_share, so
    fossil-free grids -> 100. Used for fossilFuelReliance.
    """
    print("\n[OWID] Fossil share of electricity (Ember)...")

    raw = decode_best(fetch(
        'https://ourworldindata.org/grapher/share-electricity-fossil-fuels.csv',
        'OWID fossil electricity CSV', ua=BROWSER_UA))
    rows = list(csv.DictReader(raw.splitlines()))
    value_col = next(c for c in rows[0] if c not in ('Entity', 'Code', 'Year'))

    latest = {}  # entity -> (year, share)
    for r in rows:
        code = (r.get('Code') or '').strip()
        if len(code) != 3 or code.startswith('OWID'):
            continue  # skip regions/aggregates
        try:
            year, share = int(r['Year']), float(r[value_col])
        except (ValueError, KeyError):
            continue
        ent = r['Entity'].strip()
        if ent not in latest or year > latest[ent][0]:
            latest[ent] = (year, share)

    our_countries = load_our_countries()
    out = []
    for ent, (year, share) in latest.items():
        our_name = match_canonical(ent, our_countries)
        if our_name:
            out.append({'Country': our_name, 'Score': clamp(round(100 - share))})

    write_csv('owid_fossil.csv', ['Country', 'Score'], out)
    print(f"    Matched {len(out)}/{len(our_countries)} countries")

# ── Source 14: NASA POWER Climate Normals ────────────────────────────────────

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

    print("\n[4/4] NASA POWER: Climate normals (one API call per city)...")
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
=== Optional Manual Upgrades ===
airQuality is fed automatically from the WHO Ambient Air Quality Database
(who_air.csv, data vintage mostly 2019-2022). For fresher city PM2.5 you can
manually obtain the IQAir World Air Quality Report spreadsheet
(https://www.iqair.com/world-air-quality-report — rate-limits bots) and merge
it into who_air.csv; keep the columns city_id, City, Country, PM2.5, Year.
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
        ("press freedom (RSF)",  download_rsf),
        ("internet (Ookla)",     download_ookla),
        ("english (EF EPI)",     download_ef_epi),
        ("numbeo rankings",      download_numbeo),
        ("air quality (WHO)",    download_who_air),
        ("freedom (FH)",         download_freedom_house),
        ("healthcare (WHO UHC)", download_who_uhc),
        ("education (WB HLO)",   download_wb_education),
        ("econ outlook (WB)",    download_wb_gdp_growth),
        ("fossil share (OWID)",  download_owid_fossil),
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
