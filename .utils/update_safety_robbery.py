#!/usr/bin/env python3
"""
Update safety scores in neighborhoods.csv by blending robbery data
(roubo_outros from SSP-SP DECAP delegacias, 2022-2024 average) with
the existing homicide-based safety scores.

Data source: SPDadosCriminais XLSX files from ssp.sp.gov.br
             (aggregated in roubo_outros_sp_capital.csv)

Method:
  1. Aggregate robbery counts per IBGE district (sum delegacias, avg 2022-2024)
  2. Normalize by approximate 2022 population → roubo per 100k residents
  3. Convert to 1-10 score using empirical tiers
  4. Blend: new_safety = round(0.5 * homicide_score + 0.5 * robbery_score)
  5. Apply ±2 cap to prevent over-correction
"""

import csv
import unicodedata

# ─────────────────────────────────────────────────────────────────────────────
# 1. Name normalization
# ─────────────────────────────────────────────────────────────────────────────
def norm(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.upper().strip()

# ─────────────────────────────────────────────────────────────────────────────
# 2. Fix ibge_district_approx values to real IBGE district names
#    (some are bairro names or abbreviations; some DPs span two districts)
# ─────────────────────────────────────────────────────────────────────────────
# Format: old_name -> [district1, district2, ...]  (split evenly when multi)
DISTRICT_FIX = {
    'CARANDIRU': ['SANTANA'],           # bairro in Santana
    'CAMPOS ELISEOS': ['CAMPOS ELISEOS'],
    'CAMPOS ELÍSEOS': ['CAMPOS ELISEOS'],
    'MOÓCA': ['MOOCA'],
    'BRÁS': ['BRAS'],
    'BELA VISTA': ['BELA VISTA'],
    'GUAIANASES': ['GUAIANASES'],
    'JARDIM DAS IMBUIAS': ['SACOMA'],   # bairro in Sacomã
    'JARDIM HERCULANO': ['JARDIM ANGELA'],  # bairro in Jardim Ângela
    'PARADA INGLESA': ['PARADA INGLESA'],
    'FREGUESIA DO Ó': ['FREGUESIA DO O'],
    'BRASILÂNDIA': ['BRASILANDIA'],
    'JARDIM ÂNGELA': ['JARDIM ANGELA'],
    'CARANDIRU / SANTANA': ['SANTANA'],
    'JARDIM HERCULANO / JARDIM ÂNGELA': ['JARDIM ANGELA'],
    'JARDIM DAS IMBUIAS / SACOMÃ': ['SACOMA'],
    'CIDADE A.E.CARVALHO': ['CIDADE LIDER'],  # 64º DP covers Cidade A.E. Carvalho = Cidade Líder district
    'BROOKLIN': ['BROOKLIN'],           # stored as BROOKLIN in CSV
    'JAÇANÃ': ['JACANA'],
    'MOEMA': ['MOEMA'],
    'SÃO MIGUEL PAULISTA': ['SAO MIGUEL'],  # IBGE: SÃO MIGUEL
    'VILA JACUÍ': ['VILA JACUI'],
    'VILA CARRÃO': ['CARRAO'],
    'SANTA CECÍLIA': ['SANTA CECILIA'],
    'ARICANDUVA': ['ARICANDUVA'],
    'SÃO MATEUS': ['SAO MATEUS'],
    'PARQUE SÃO JORGE': ['SAO MIGUEL'],  # Parque São Jorge is a bairro in São Miguel
    'PARQUE SÃO RAFAEL': ['SAO RAFAEL'],
    'ITAIM PAULISTA': ['ITAIM PAULISTA'],
    'LAJEADO': ['LAJEADO'],
    'IGUATEMI': ['IGUATEMI'],
    'ERMELINO MATARAZZO': ['ERMELINO MATARAZZO'],
    'VILA ALPINA': ['VILA ALPINA'],
    'SAPOPEMBA': ['SAPOPEMBA'],
    'PARQUE DO CARMO': ['PARQUE DO CARMO'],
    'CIDADE TIRADENTES': ['CIDADE TIRADENTES'],
    'CIDADE A.E.CARVALHO': ['CIDADE LIDER'],
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. Approximate 2022 IBGE census populations by district
#    Source: IBGE Censo 2022 preliminary results, districtlevel
#    Defaults to 110000 if unknown
# ─────────────────────────────────────────────────────────────────────────────
POPULATION = {
    'AGUA RASA':           68000,
    'ALTO DE PINHEIROS':   47000,
    'ANHANGUERA':          48000,
    'ARICANDUVA':         104000,
    'ARTUR ALVIM':         89000,
    'BARRA FUNDA':         14000,
    'BELA VISTA':          65000,
    'BELEM':               34000,
    'BELENZINHO':          42000,
    'BOM RETIRO':          32000,
    'BRAS':                29000,
    'BRASILANDIA':        255000,
    'BROOKLIN':            58000,
    'BUTANTA':             51000,
    'CACHOEIRINHA':        75000,
    'CAMBUCI':             36000,
    'CAMPO BELO':          65000,
    'CAMPO GRANDE':        85000,
    'CAMPO LIMPO':        222000,
    'CAMPOS ELISEOS':      41000,
    'CANGAIBA':            94000,
    'CAPAO REDONDO':      196000,
    'CARRAO':              55000,
    'CASA VERDE':          81000,
    'CIDADE ADEMAR':      142000,
    'CIDADE DUTRA':       196000,
    'CIDADE LIDER':        74000,
    'CIDADE TIRADENTES':  166000,
    'CONSOLACAO':          64000,
    'CURSINO':             74000,
    'ERMELINO MATARAZZO': 116000,
    'FREGUESIA DO O':     108000,
    'GRAJAU':             360000,
    'GUAIANASES':          83000,
    'IGUATEMI':            61000,
    'IPIRANGA':           107000,
    'ITAIM BIBI':          76000,
    'ITAIM PAULISTA':     110000,
    'ITAQUERA':           150000,
    'JABAQUARA':          128000,
    'JACANA':              67000,
    'JAGUARA':             25000,
    'JAGUARE':             72000,
    'JARAGUA':             54000,
    'JARDIM ANGELA':      171000,
    'JARDIM HELENA':       68000,
    'JARDIM PAULISTA':     92000,
    'JARDIM SAO LUIS':    158000,
    'JOSE BONIFACIO':      85000,
    'LAJEADO':            163000,
    'LAPA':                65000,
    'LIBERDADE':           64000,
    'LIMAO':               74000,
    'MANDAQUI':            89000,
    'MARSILAC':            10000,
    'MOEMA':               78000,
    'MOOCA':               74000,
    'MORUMBI':             69000,
    'PARELHEIROS':        151000,
    'PARI':                22000,
    'PARQUE DO CARMO':     98000,
    'PEDREIRA':           102000,
    'PENHA':              113000,
    'PERDIZES':            97000,
    'PERUS':               66000,
    'PINHEIROS':           73000,
    'PIRITUBA':           131000,
    'PONTE RASA':          60000,
    'RAPOSO TAVARES':      62000,
    'REPUBLICA':           55000,
    'RIO PEQUENO':        102000,
    'SACOMA':             155000,
    'SANTA CECILIA':       62000,
    'SANTANA':             85000,
    'SANTO AMARO':        104000,
    'SAO DOMINGOS':        80000,
    'SAO LUCAS':           78000,
    'SAO MATEUS':         175000,
    'SAO MIGUEL':         126000,
    'SAO RAFAEL':         101000,
    'SAPOPEMBA':          200000,
    'SAUDE':               60000,
    'SE':                  26000,
    'SOCORRO':             70000,
    'TATUAPE':             69000,
    'TREMEMBE':            60000,
    'TUCURUVI':            58000,
    'VILA ANDRADE':        88000,
    'VILA CURUCA':         65000,
    'VILA EMA':            59000,
    'VILA FORMOSA':        52000,
    'VILA GUILHERME':      68000,
    'VILA GUSTAVO':        49000,
    'VILA JACUI':         101000,
    'VILA LEOPOLDINA':     27000,
    'VILA MADALENA':       62000,
    'VILA MARIA':          98000,
    'VILA MARIANA':       117000,
    'VILA MATILDE':       110000,
    'VILA MEDEIROS':       84000,
    'VILA PRUDENTE':       53000,
    'VILA ROMANA':         27000,
    'VILA SONIA':          96000,
    'PARADA INGLESA':      75000,
}
DEFAULT_POP = 110000

# ─────────────────────────────────────────────────────────────────────────────
# 4. Load robbery data and aggregate per normalized district name
# ─────────────────────────────────────────────────────────────────────────────
district_year_count = {}  # norm_name -> {year -> total_roubo}

with open('roubo_outros_sp_capital.csv') as f:
    for row in csv.DictReader(f):
        raw_dist = row['ibge_district_approx'].strip()
        year     = int(row['year'])
        count    = int(row['roubo_outros'])

        # Resolve district name(s)
        targets = DISTRICT_FIX.get(raw_dist)
        if targets is None:
            # Try normalized lookup of the raw name
            n = norm(raw_dist)
            targets = [n]

        per_target = count / len(targets)

        for t in targets:
            n = norm(t)
            if n not in district_year_count:
                district_year_count[n] = {}
            district_year_count[n][year] = district_year_count[n].get(year, 0) + per_target

# ─────────────────────────────────────────────────────────────────────────────
# 5. Compute average 2022-2024 robbery count per district
# ─────────────────────────────────────────────────────────────────────────────
district_avg = {}  # norm_name -> avg annual robberies
for dn, year_dict in district_year_count.items():
    counts = [year_dict[y] for y in [2022, 2023, 2024] if y in year_dict]
    if counts:
        district_avg[dn] = sum(counts) / len(counts)

# ─────────────────────────────────────────────────────────────────────────────
# 6. Compute robbery per 100k and convert to 1-10 score
#    Tiers calibrated to SP capital distribution
# ─────────────────────────────────────────────────────────────────────────────
def robbery_score(avg_count, dist_norm):
    pop = POPULATION.get(dist_norm, DEFAULT_POP)
    per100k = avg_count / pop * 100000

    if per100k >= 2000: return 1
    if per100k >= 1400: return 2
    if per100k >= 900:  return 3
    if per100k >= 600:  return 4
    if per100k >= 400:  return 5
    if per100k >= 250:  return 6
    if per100k >= 150:  return 7
    if per100k >= 80:   return 8
    if per100k >= 40:   return 9
    return 10

# ─────────────────────────────────────────────────────────────────────────────
# 7. Load neighborhoods.csv and update safety scores
# ─────────────────────────────────────────────────────────────────────────────
with open('neighborhoods.csv') as f:
    rows = list(csv.DictReader(f))
    fieldnames = list(rows[0].keys())

changes = []
updated_rows = []

for row in rows:
    dist_norm = norm(row['district'])
    current_safety = int(row['safety'])

    if dist_norm in district_avg:
        rob_score = robbery_score(district_avg[dist_norm], dist_norm)
        pop = POPULATION.get(dist_norm, DEFAULT_POP)
        per100k = district_avg[dist_norm] / pop * 100000

        # Blend: 50% existing homicide-based score, 50% robbery score
        blended = (current_safety + rob_score) / 2
        new_safety = int(round(blended))

        # ±2 cap to prevent wild swings
        new_safety = max(current_safety - 2, min(current_safety + 2, new_safety))

        if new_safety != current_safety:
            changes.append({
                'district':        row['district'],
                'old_safety':      current_safety,
                'new_safety':      new_safety,
                'rob_score':       rob_score,
                'rob_per100k':     round(per100k),
                'avg_robberies':   round(district_avg[dist_norm]),
            })
            row = dict(row)
            row['safety'] = str(new_safety)
    else:
        pass  # keep unchanged

    updated_rows.append(row)

# ─────────────────────────────────────────────────────────────────────────────
# 8. Write updated neighborhoods.csv
# ─────────────────────────────────────────────────────────────────────────────
with open('neighborhoods.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames, lineterminator='\n')
    writer.writeheader()
    writer.writerows(updated_rows)

# ─────────────────────────────────────────────────────────────────────────────
# 9. Print summary
# ─────────────────────────────────────────────────────────────────────────────
print(f"\nDistricts with robbery data: {len(district_avg)}")
print(f"Safety scores changed:       {len(changes)}")
print(f"Districts without data (kept): {len([r for r in rows if norm(r['district']) not in district_avg])}")

print("\n--- All changes ---")
print(f"{'District':<30} {'Old':>4} {'Rob/100k':>9} {'RobScore':>9} {'New':>4}")
print("-" * 62)
for c in sorted(changes, key=lambda x: x['rob_per100k'], reverse=True):
    direction = '↑' if c['new_safety'] > c['old_safety'] else '↓'
    print(f"{c['district']:<30} {c['old_safety']:>4} {c['rob_per100k']:>9,} {c['rob_score']:>9}  {direction}{c['new_safety']}")

print("\n--- Robbery scores by district (all with data) ---")
scored = []
for dn, avg in district_avg.items():
    rs = robbery_score(avg, dn)
    pop = POPULATION.get(dn, DEFAULT_POP)
    per100k = avg / pop * 100000
    scored.append((dn, round(avg), round(per100k), rs))
for row in sorted(scored, key=lambda x: x[2], reverse=True):
    print(f"  {row[0]:<30} avg:{row[1]:>5}  per100k:{row[2]:>6,}  rob_score:{row[3]}")
