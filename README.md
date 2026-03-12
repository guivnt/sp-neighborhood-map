# SP Neighborhood Map — Nubank Relocation Guide

An interactive map of São Paulo's 96 official districts to help Nubankers evaluate neighborhoods before relocating. Districts are colored by a composite score built from criteria like safety, walkability, distance to the Pinheiros office, rent prices, and public transport access. All weights are adjustable in real time via sliders.

## Running locally

You need Python 3 (pre-installed on macOS) or any static file server. **Do not open `index.html` directly as a file** — the app fetches the GeoJSON and CSV at runtime, which requires an HTTP server.

**Clone and run:**

```bash
git clone https://github.com/pedro-luiz-santoro/sp-neighborhood-map.git
cd sp-neighborhood-map
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

**Alternative servers** (if you prefer):

```bash
# Node.js
npx serve .

# Ruby
ruby -run -e httpd . -p 8080
```

## How to use it

| Interaction | What happens |
|---|---|
| Hover over a district | Tooltip with name and composite score |
| Click a district | Popup with all individual scores + sidebar breakdown |
| Drag a weight slider | Map recolors instantly |
| Click "Reset Weights" | All sliders back to defaults |
| Click "Load CSV" | Load your edited CSV to update all scores |
| Click "Download CSV" | Export the current dataset to edit externally |

## Scoring criteria

All scores are **1–10** (10 = best for living). The composite score is a weighted average across:

| Criterion | Default weight | Notes |
|---|---|---|
| Distance to Nubank | 2× | 10 = walking distance to Pinheiros office |
| Public Transport | 2× | 10 = direct metro to Oscar Freire (L4), closest station to Nubank |
| Safety | 1.5× | Blended score: homicide rate + street robbery per capita (SSP-SP 2022–2024) |
| Walkability | 1.5× | Pedestrian infrastructure and mixed-use density |
| Low Traffic | 1× | 10 = very low congestion |
| Affordable Rent | 1× | 10 = very affordable |
| Green Spaces | 1× | Parks, trees, squares |
| Affordable Purchase | 0.5× | 10 = very affordable to buy |
| Nightlife | 0.5× | Bars, restaurants, cultural life |
| Family Friendly | 0.5× | Schools, playgrounds, safety for kids |

Districts not present in the CSV default to **5** for all criteria.

## Customizing the data

`data/neighborhoods.csv` is a plain spreadsheet — open it in Excel, Numbers, or Google Sheets, edit any scores, save, then use the **Load CSV** button in the sidebar to apply your changes without touching any code.

For full documentation on scoring methodology, data sources, and how each criterion was derived, see [`data/README.md`](data/README.md).

If you want to persist your changes for everyone, edit the CSV and open a PR.

## Data disclaimer

The default scores in `data/neighborhoods.csv` were generated with AI assistance and reviewed by a human, but may still contain errors or reflect outdated information. Use them as a starting point — you are encouraged to edit the CSV with your own research and load it back via the **Load CSV** button.

## Data sources

- **District polygons**: [codigourbano/distritos-sp](https://github.com/codigourbano/distritos-sp) — SP's 96 official IBGE districts, fetched at runtime
- **Safety scores**: Blended from homicide rate (Mapa da Desigualdade 2024) and street robbery per capita (SSP-SP Dados Criminais 2022–2024, 93 DECAP delegacias)
- **Transit scores**: Based on SP Metro and CPTM network proximity and transfer count to Oscar Freire (L4), the closest station to Nubank
- **Map tiles**: CartoDB Dark Matter via OpenStreetMap

## Tech stack

No build step, no npm, no dependencies to install.

- [Leaflet.js](https://leafletjs.com/) — map rendering and choropleth
- [chroma.js](https://gka.github.io/chroma.js/) — dynamic color scale
- [PapaParse](https://www.papaparse.com/) — CSV parsing in the browser
- Vanilla HTML/CSS/JS — all libraries loaded via CDN
