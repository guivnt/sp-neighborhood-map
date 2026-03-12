# SP Neighborhood Map — Dataset Documentation

## Overview

`neighborhoods.csv` contains livability scores for São Paulo's official IBGE
administrative districts, calibrated for a **Nubank employee** commuting to the
company's headquarters at **Rua Capote Valente, Pinheiros** (nearest metro:
Oscar Freire, Line 4 Yellow).

Scores represent a point-in-time snapshot based on publicly available data and
domain knowledge as of 2024–2025. They are intended as a starting point for
relocation research, not a substitute for on-the-ground investigation.

---

## File Structure

| Column | Type | Description |
|---|---|---|
| `district` | string | Official IBGE district name (uppercase, no accents) |
| `distance_to_nubank` | 1–10 | Proximity + commute ease to Nubank HQ in Pinheiros |
| `public_transport` | 1–10 | Metro/CPTM coverage and directness to Oscar Freire (L4) |
| `safety` | 1–10 | Street safety — homicide rate + favela share + street robbery patterns |
| `walkability` | 1–10 | Pedestrian infrastructure and mixed-use density |
| `traffic` | 1–10 | Low congestion (10 = very low, 1 = severely congested) |
| `rent_price` | 1–10 | Rental affordability (10 = very affordable, 1 = very expensive) |
| `buy_price` | 1–10 | Purchase affordability (10 = very affordable, 1 = very expensive) |
| `green_spaces` | 1–10 | Parks, trees, public squares |
| `nightlife` | 1–10 | Bars, restaurants, cultural venues |
| `family_friendly` | 1–10 | Schools, playgrounds, residential safety |
| `notes` | string | Free-text rationale, caveats, and local knowledge |
| `healthcare` | 1–10 | Public primary-care access: wait time for basic consultation (10 = shortest) |

All scores are **1–10 where 10 is always best for the resident** (cost and
congestion are inverted: 10 = very affordable / very low traffic).

---

## Default Criterion Weights

The app ships with the following weights, which users can drag to adjust in
real time:

| Criterion | Default Weight | Rationale |
|---|---|---|
| Distance to Nubank | 2× | Primary daily constraint |
| Public Transport | 2× | Strongly correlated with commute quality |
| Safety | 1.5× | High personal-safety concern for new residents |
| Walkability | 1.5× | Quality-of-life multiplier |
| Low Traffic | 1× | Affects commute and daily errands |
| Affordable Rent | 1× | Major financial factor |
| Healthcare Access | 1× | Access to public primary care |
| Green Spaces | 1× | Quality of life |
| Affordable Purchase | 0.5× | Longer-term consideration |
| Nightlife | 0.5× | Personal preference |
| Family Friendly | 0.5× | Relevant for those with families |

---

## Primary Data Sources

### Mapa da Desigualdade 2024 — Rede Nossa São Paulo

The **Mapa da Desigualdade** is a yearly report published by
[Rede Nossa São Paulo](https://nossasaopaulo.org.br/category/mapa-da-desigualdade/)
and [Instituto Cidades Sustentáveis](https://novo.icidadessustentaveis.org.br/mapa-da-desigualdade/).
It covers all **96 SP administrative districts** with 45+ indicators across
health, education, safety, environment, and mobility, sourced from official
city agencies (SSP-SP, SMS-SP, SEADE, Prefeitura SP).

The 2024 edition was the primary source for auditing and updating the `safety`
and `healthcare` columns. The raw data is available at:
- [Interactive explorer (Shiny App)](https://institutocidadessustentaveis.shinyapps.io/mapadesigualdadesaopaulo2024/)
- [Data download (xlsx)](https://www.cidadessustentaveis.org.br/arquivos/RNSP/mapa_da_desigualdade_2024_dados.xlsx)

### Indicators used from the Mapa da Desigualdade

| Indicator | Column in mapa CSV | Used for |
|---|---|---|
| Homicídios por 100k habitantes | `homicidios_per100k` | Safety audit |
| % domicílios em favelas | `favelas_pct_domicilios` | Safety audit (downward cap) |
| Espera para consulta básica (dias) | `espera_consulta_basica_dias` | Healthcare score |
| Idade média ao morrer (anos) | `idade_media_morte` | Healthcare fallback (3 districts) |
| Mortalidade infantil (por 1k nascidos) | `mortalidade_infantil_per1k` | Healthcare fallback (3 districts) |

---

## Methodology

### distance_to_nubank

Anchored to Nubank's office at **Rua Capote Valente, Pinheiros**. Pinheiros
itself scores 10. Scores decrease based on geographic distance and realistic
transit time. Direct Line 4 Yellow access (Oscar Freire station) heavily
weights adjacent districts (Butantã, Vila Sônia, Morumbi, Consolação).
Far peripheral districts (Marsilac, Parelheiros, Cidade Tiradentes) score 1 —
daily commute is not viable.

### public_transport

Based on proximity to **São Paulo Metro (METRÔ)** and **CPTM** stations, with
emphasis on directness to **Oscar Freire (L4 Yellow)** — the station at the end
of Nubank's street. Scoring logic:

- **10**: Oscar Freire at doorstep (Pinheiros)
- **9**: One stop or direct on L4 (Vila Madalena L2→L4 at Consolação; Consolação L2→L4)
- **8**: 2–3 stops on a direct line, or a single easy transfer (Butantã L4, Vila Sônia L4, Morumbi L4, Moema L5)
- **6–7**: Requires one transfer + moderate riding time
- **4–5**: Bus-dependent or multiple transfers required
- **1–3**: No meaningful transit connection; commute is 60+ minutes or requires a car

Sources:
- [Metro SP — Mapa da Rede](https://www.metro.sp.gov.br/sua-viagem/mapa-da-rede/)
- [CPTM — Official Site](https://www.cptm.sp.gov.br/cptm)

### safety

Safety scores were **audited against the Mapa da Desigualdade 2024** using two
official indicators per district:

1. **Homicídios por 100k habitantes** (from SIM/SEADE, via SMS-SP) — primary
   signal for lethal violence risk.
2. **% domicílios em favelas** — structural vulnerability indicator; high favela
   share caps the safety ceiling even when homicide rates are moderate.

The audit algorithm converts homicide rate to a data-driven target score, applies
a favela-share cap where warranted, and then constrains the move to ±2 points from
the previous score to preserve street-robbery knowledge not captured by homicide
data alone (critical for high-footfall areas like Sé, Brás, and República).

Reference homicide tiers (per 100k residents):

| Homicide rate | Safety target | Example districts |
|---|---|---|
| > 20 | 2 | Sé (26.2), Marsilac (23.7) |
| 12–20 | 3 | Brás (15.1), Anhanguera (13.0) |
| 8–12 | 4 | Capão Redondo (10.1), Guaianases (10.9), Parelheiros (11.1) |
| 5–8 | 5 | Cachoeirinha (6.8), Lapa (7.4), Campo Limpo (7.4) |
| 3–5 | 6 | Butantã (3.7), Mooca (3.7), Campo Belo (3.1) |
| 1.5–3 | 7 | Pinheiros (1.5), Consolação (1.7), Perdizes (2.6) |
| < 1.5 | 8 | Moema (0.0), Vila Mariana (0.0), Cambuci (0.0) |

Two districts were manually overridden after algorithmic review:
- **Alto de Pinheiros**: algorithm suggested 7; set to 8 (0% favelas, consistently cited as one of SP's safest areas in SSP bulletins)
- **Vila Romana**: Lapa data used as proxy overstates violence; set to 6

Sources:
- [Mapa da Desigualdade 2024 — data download](https://www.cidadessustentaveis.org.br/arquivos/RNSP/mapa_da_desigualdade_2024_dados.xlsx)
- [SSP-SP — Estatísticas](https://www.ssp.sp.gov.br/estatistica)
- [SSP-SP — Portal de Transparência](https://www.ssp.sp.gov.br/transparenciassp/Apresentacao.aspx)
- [SSP-SP — Dados Mensais por Distrito](https://www.ssp.sp.gov.br/estatistica/dados-mensais)
- [Base dos Dados — SSP dataset (BigQuery-ready)](https://basedosdados.org/dataset/dbd717cb-7da8-4efd-9162-951a71694541)

### healthcare

Measures access to **public primary healthcare** using the
**espera para consulta básica (dias)** indicator from the Mapa da Desigualdade
2024 — the average number of days a resident must wait for a basic consultation
appointment at a UBS (Unidade Básica de Saúde).

Score conversion (10 = shortest wait = best access):

| Wait time (days) | Score |
|---|---|
| 0–4 | 10 |
| 5–8 | 9 |
| 9–12 | 8 |
| 13–16 | 7 |
| 17–20 | 6 |
| 21–24 | 5 |
| 25–28 | 4 |
| 29–32 | 3 |
| 33–36 | 2 |
| 37+ | 1 |

Three districts where wait-time data was absent in the Mapa
(Alto de Pinheiros, Consolação, Jardim Paulista) use a proxy score derived from
`idade_media_morte` (average age at death) and `mortalidade_infantil_per1k`
(infant mortality per 1k live births) from the same dataset.

Three districts not present in the Mapa da Desigualdade (Vila Madalena, Vila
Romana, Belenzinho) use wait-time data from their closest same-subprefeitura
neighbor as a proxy (Pinheiros, Lapa, and Mooca respectively).

Notable range:
- **Score 10**: República (0 days — major hospital cluster including Santa Casa), Morumbi (3 days), Vila Sônia (4 days), Marsilac (4 days)
- **Score 1**: Campo Grande (39 days), Cidade Líder (39 days), Santana (37 days)

Sources:
- [Mapa da Desigualdade 2024 — data download](https://www.cidadessustentaveis.org.br/arquivos/RNSP/mapa_da_desigualdade_2024_dados.xlsx)
- [CEInfo Boletim Saúde em Dados 2023 — SMS-SP](https://drive.prefeitura.sp.gov.br/cidade/secretarias/upload/saude/arquivos/ceinfo/tabelas/Tabelas_CEInfo_Dados_Sub_2023.xlsx)

### walkability

Based on pedestrian infrastructure quality, continuous sidewalk coverage,
street-level commercial activity, and mixed-use density. No formal index was
applied — scores reflect general SP urban knowledge cross-referenced with
Walk Score methodology.

Reference tools:
- [Walk Score — São Paulo](https://www.walkscore.com/)
- [ITDP Brasil — iCam 2.0 Walkability Framework](https://itdpbrasil.org/indice-de-caminhabilidade/)

### traffic

Scored inversely (10 = very low congestion). SP's chronically congested
corridors are explicitly accounted for:
- **Faria Lima + Brigadeiro + Juscelino** (Itaim Bibi, part of Pinheiros): score 3
- **Av. Paulista + Radial Leste** (Consolação, Bela Vista, República): score 4
- **Marginal Tietê/Pinheiros**: affects Barra Funda, Vila Leopoldina corridors

### rent_price / buy_price

Scored inversely (10 = very affordable). Calibrated against the
**QuintoAndar/Imovelweb Índice de Locação** (closed-contract data, more accurate
than listing-based indices for neighborhood-level rents) and
**Creditas/DataZAP** purchase price data.

Approximate 2025 reference tiers for **rent** (R$/m²/month):

| Score | Tier | Approximate range | Example districts |
|---|---|---|---|
| 1–2 | Very expensive | R$ 90–110/m² | Jardim Paulista (Jardins), Itaim Bibi (incl. Vila Olímpia) |
| 3 | Expensive | R$ 70–90/m² | Pinheiros, Moema, Alto de Pinheiros |
| 4–5 | Mid-range | R$ 50–70/m² | Vila Madalena, Vila Mariana, Perdizes, Consolação |
| 6–7 | Affordable | R$ 35–50/m² | Lapa, Tatuapé, Butantã, Santo Amaro |
| 8–10 | Very affordable | < R$ 35/m² | Most peripheral districts |

Approximate 2025 reference tiers for **purchase** (R$/m²):

| Score | Tier | Approximate range | Example districts |
|---|---|---|---|
| 1–2 | Very expensive | R$ 12,000+/m² | Jardim Paulista (Jardins), Pinheiros, Itaim Bibi (Vila Olímpia) |
| 3 | Expensive | R$ 10,000–12,000/m² | Moema, Alto de Pinheiros, Vila Madalena |
| 4–5 | Mid-range | R$ 7,000–10,000/m² | Vila Mariana, Perdizes, Consolação, Lapa |
| 6–7 | Affordable | R$ 4,000–7,000/m² | Tatuapé, Butantã, Mooca, Santo Amaro |
| 8–10 | Very affordable | < R$ 4,000/m² | Most peripheral districts |

> Purchase tier ranges are broader estimates. Check the Creditas link below
> for the most current per-neighborhood purchase prices.

Sources:
- [QuintoAndar — Valor do m² em SP por bairro (2025)](https://www.quintoandar.com.br/guias/dados-indices/valor-do-m2-em-sp-por-bairro/)
- [QuintoAndar — Índice mensal (PDF)](https://publicfiles.data.quintoandar.com.br/indice_quintoandar_imovelweb/indice_setembro_2025_sp.pdf)
- [Creditas Exponencial — Preço do m² em SP por bairro 2025](https://www.creditas.com/exponencial/preco-metro-quadrado-em-sp/)
- [FIPE ZAP — Índice Residencial](https://www.fipe.org.br/pt-br/indices/fipezap/)

### green_spaces

Based on presence and accessibility of parks, tree canopy, and public plazas.
Notable anchors:
- Parque Ibirapuera → Moema, Vila Mariana
- Parque Siqueira Campos (Trianon) → Consolação
- Parque Villa-Lobos → Jaguaré, Alto de Pinheiros
- Parque Estadual Cantareira → Jaçanã, Tremembé, Mandaqui
- Parque do Carmo → Parque do Carmo district
- Guarapiranga / Billings reservoirs → southern zone districts

Geospatial reference:
- [GeoSampa — Portal Geográfico da Cidade de SP](https://geosampa.prefeitura.sp.gov.br/)

### nightlife

Based on density and variety of bars, restaurants, music venues, and cultural
spaces. Top anchors:
- Rua Augusta (Consolação): SP's densest nightlife strip → score 9
- Vila Madalena (Rua Wisard/Harmonia/Aspicuelta) → score 10
- Bela Vista/Bixiga (Rua 13 de Maio) → score 8
- Itaim Bibi restaurant row → score 8

### family_friendly

Composite of perceived safety for children, public school availability,
playgrounds, pediatric healthcare, and community feel. Strongly correlated with
`safety` but not identical — some safe but nightlife-heavy districts score lower
(Consolação); some moderate-safety peripheral districts score higher for
community character (Mandaqui, Tremembé).

---

## District Coverage

The dataset covers **São Paulo's 96 official IBGE administrative districts**
plus one alternate-spelling entry (`GUAIANASES`) to handle GeoJSON name
variations in the [distritos-sp source data](https://github.com/codigourbano/distritos-sp).

Three districts are absent from the Mapa da Desigualdade 2024 (Vila Madalena,
Vila Romana, Belenzinho). These use same-subprefeitura neighbor data as a
proxy for `safety` and `healthcare` scores.

Districts absent from the CSV default to a score of **5** across all criteria
in the app, producing a neutral gray color on the map.

---

## Additional IBGE / Official Data Sources

These sources were identified during research and are available for future
score improvements:

| Source | What it provides | URL |
|---|---|---|
| IBGE Censo 2022 — income brackets | Household income distribution per district (released Apr 2025) | [ibge.gov.br](https://www.ibge.gov.br/estatisticas/sociais/trabalho/22827-censo-demografico-2022.html?edicao=41852&t=resultados) |
| IBGE Censo 2022 — Panorama downloads | Population, age, sanitation per district | [censo2022.ibge.gov.br](https://censo2022.ibge.gov.br/panorama/downloads.html) |
| ObservaSampa (Prefeitura SP) | 350+ indicators per district, 21 thematic axes | [observasampa.prefeitura.sp.gov.br](https://observasampa.prefeitura.sp.gov.br/index.php?page=dadosabertos) |
| SEADE IMP Distritos | Historical demographic + social indicators (back to 1980) | [dados.gov.br](https://dados.gov.br/dataset/informacoes-dos-distritos-da-capital-paulista-imp-distritos) |
| CEM/USP — census tract data | Pre-processed Censo 2022 by tract, aggregatable to district | [centrodametropole.fflch.usp.br](https://centrodametropole.fflch.usp.br/pt-br/download-de-dados) |
| Base dos Dados | All of the above queryable via BigQuery/SQL/Python | [basedosdados.org](https://basedosdados.org) |
| CNES/DATASUS | Hospital bed counts by district | [cnes.datasus.gov.br](http://cnes.datasus.gov.br) |

---

## Known Limitations

1. **Safety homicide data is from 2020.** The Mapa da Desigualdade 2024 sources
   its homicídios indicator from SIM/SEADE mortality records. 2020 is the most
   recent year available at district granularity.

2. **Mobile phone robbery is not explicitly scored.** SSP-SP publishes monthly
   `roubo de celular` counts by delegacia (police precinct), but this was not
   incorporated. Phone snatching risk does not perfectly track homicide rates —
   high-footfall central districts (Sé, República, Brás) score low on homicides
   but are known robbery hotspots. The ±2-point cap on score changes during the
   audit was intended to preserve this street-level intuition, but the underlying
   original scores were not derived from formal robbery statistics.
   See: [SSP-SP — Dados Mensais por Distrito](https://www.ssp.sp.gov.br/estatistica/dados-mensais)

3. **Healthcare score measures public UBS access only.** Districts with low
   scores (e.g. Liberdade, Santana) have poor public primary-care coverage but
   are well served by private clinics and hospitals. The score is most relevant
   for residents relying on the SUS public health system.

4. **Three districts use proxy data.** Vila Madalena (→ Pinheiros proxy),
   Vila Romana (→ Lapa proxy), and Belenzinho (→ Mooca proxy) were absent from
   the Mapa da Desigualdade. Their safety and healthcare scores may be less
   accurate than the 93 directly measured districts.

5. **Rent/buy scores are district-level averages.** Itaim Bibi includes both
   the very expensive Vila Olímpia and more affordable pockets. Morumbi spans
   from luxury condos to streets bordering Paraisópolis.

6. **Transit scores reflect the 2024–2025 network.** SP is expanding Lines 5,
   6, 17, 19, and 20. New stations will shift transit scores when they open.

7. **Walkability has no formal per-district index.** Scores are based on urban
   knowledge cross-referenced with the ITDP iCam framework.

---

## How to Update

1. Edit `neighborhoods.csv` directly in any spreadsheet or text editor.
2. Keep district names uppercase with no accents (to match GeoJSON normalization
   in `js/app.js`).
3. Use the **Load CSV** button in the app to hot-reload without restarting.
4. Use **Download CSV** to export your modified dataset.

**To refresh safety scores:** download the Mapa da Desigualdade when a new
edition is released and re-run the scoring script pattern in this document.

**To refresh rent scores:** check the
[QuintoAndar monthly index PDF](https://publicfiles.data.quintoandar.com.br/indice_quintoandar_imovelweb/indice_setembro_2025_sp.pdf).

**To refresh healthcare scores:** a new Mapa da Desigualdade edition updates the
`espera_consulta_basica_dias` indicator annually. The SMS-SP CEInfo annual report
also publishes UBS coverage by subprefeitura:
[Tabelas_CEInfo_Dados_Sub_2023.xlsx](https://drive.prefeitura.sp.gov.br/cidade/secretarias/upload/saude/arquivos/ceinfo/tabelas/Tabelas_CEInfo_Dados_Sub_2023.xlsx).
