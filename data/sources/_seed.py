#!/usr/bin/env python3
"""
One-time seed script: splits cities.csv into city_meta.csv and manual_scores.csv,
and scaffolds city_mappings.csv and country_mappings.csv.

Run once from the data/ directory:
    python sources/_seed.py

After running, delete or ignore this file — it is not part of the regular pipeline.
"""
import csv, os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR   = os.path.dirname(SCRIPT_DIR)
CITIES_CSV = os.path.join(DATA_DIR, 'cities.csv')
OUT_DIR    = SCRIPT_DIR

META_COLS   = ['id','name','country','region','population','climate','industries',
               'primaryLanguage','gdpPerCapita','density','nickname','lat','lon']
# All 27 dimension scores — manual_scores.csv is the complete baseline.
# Authoritative sources override individual columns on top of this.
MANUAL_COLS = ['id',
               'corruption','pressFreedom','costOfLiving','affordability','transitQuality',
               'climateAction','govProgressiveness','militarySpending','economicOutlook',
               'fossilFuelReliance','safety','healthcareQuality','educationQuality',
               'culturalOfferings','walkability','internetQuality','airQuality','foodScene',
               'nightlife','naturalBeauty','jobMarket','languageAccess','visaEase',
               'sunshine','humidity','rainfall','winterWarmth']

def write_csv(path, fieldnames, rows):
    with open(path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)
    print(f"  wrote {len(rows)} rows -> {os.path.relpath(path)}")

with open(CITIES_CSV, encoding='utf-8') as f:
    cities = list(csv.DictReader(f))

print(f"Loaded {len(cities)} cities from cities.csv")

# ── city_meta.csv ──────────────────────────────────────────────────────────────
meta_rows = [{c: row[c] for c in META_COLS} for row in cities]
write_csv(os.path.join(OUT_DIR, 'city_meta.csv'), META_COLS, meta_rows)

# ── manual_scores.csv ──────────────────────────────────────────────────────────
manual_rows = [{c: row[c] for c in MANUAL_COLS} for row in cities]
write_csv(os.path.join(OUT_DIR, 'manual_scores.csv'), MANUAL_COLS, manual_rows)

# ── city_mappings.csv ──────────────────────────────────────────────────────────
# Numbeo and IQAir mostly use standard English city names.
# Edit this file to fix any source-specific name variants.
city_map_fields = ['city_id','numbeo_city','numbeo_country','iqair_city','iqair_country']
city_map_rows = []
for row in cities:
    city_map_rows.append({
        'city_id':        row['id'],
        'numbeo_city':    row['name'],
        'numbeo_country': row['country'],
        'iqair_city':     row['name'],
        'iqair_country':  row['country'],
    })
write_csv(os.path.join(OUT_DIR, 'city_mappings.csv'), city_map_fields, city_map_rows)

# ── country_mappings.csv ───────────────────────────────────────────────────────
# Maps our country string → TI/RSF/SIPRI/Henley country name.
# Edit the right-hand column if a source uses a different country name.
unique_countries = sorted({row['country'] for row in cities})
country_map_fields = ['our_country','ti_country','rsf_country','sipri_country','henley_country','ef_country','ookla_country']
country_map_rows = [{f: c for f in country_map_fields} for c in unique_countries]
write_csv(os.path.join(OUT_DIR, 'country_mappings.csv'), country_map_fields, country_map_rows)

print("Done. Review and edit city_mappings.csv and country_mappings.csv for source-specific name variants.")
