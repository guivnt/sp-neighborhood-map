# SP Neighborhood Map — Nubank Relocation Guide

An interactive map of São Paulo's 96 official districts to help Nubankers evaluate neighborhoods before relocating. Districts are colored by a composite score built from criteria like safety, walkability, distance to the Pinheiros office, rent prices, and public transport access. All weights are adjustable in real time via sliders.

<img width="1717" height="989" alt="Screenshot 2026-03-12 at 12 38 59" src="https://github.com/user-attachments/assets/f06d051b-b06a-46a7-9fdd-dcbefa4680b0" />

---

## Features

### Choropleth map
Districts are color-coded from red (low score) to green (high score) using a dynamic scale that stretches to the actual data range. Hover over any district to see its name and composite score; click to open a detailed breakdown.

<img width="1717" height="989" alt="Screenshot 2026-03-12 at 12 40 59" src="https://github.com/user-attachments/assets/39ed2d6f-b81d-48d0-85b4-91c5901b394b" />


### Weight sliders
Each scoring criterion has a weight slider (0–5×). Drag any slider and the map recolors instantly, letting you tune the ranking to your personal priorities. A **Reset Weights** button restores all defaults.

<img width="1717" height="989" alt="Screenshot 2026-03-12 at 12 42 16" src="https://github.com/user-attachments/assets/e5c99b26-c855-41b6-97fb-49314bdc24aa" />


### Filter Districts
Set a minimum score per criterion to grey out districts that don't meet your hard requirements. Filtered-out districts appear desaturated on the map so the qualifying ones stand out clearly. A **Reset Filters** button clears all minimums.

<img width="1717" height="989" alt="Screenshot 2026-03-12 at 12 44 23" src="https://github.com/user-attachments/assets/7b5310e2-84a4-4a5e-a5ae-ef5e96f8767e" />


### District Detail panel
Click any district to open a sidebar panel showing:
- Composite score
- Per-criterion score bars (visual bar + numeric value)
- Free-text notes (when available in the CSV)
- List of **neighbourhoods (bairros)** within the district

<img width="339" height="637" alt="image" src="https://github.com/user-attachments/assets/0ae97558-25d5-4fbf-8119-071dd082d99e" />


### Compare mode
Click the **Compare** button in the District Detail panel to enter compare mode. Select up to 4 districts using the checkboxes in their detail panels; a horizontal bar chart renders side-by-side scores for all selected districts. Click **Done** or ✕ to exit compare mode.

<img width="714" height="986" alt="image" src="https://github.com/user-attachments/assets/cfcde6d6-aa39-4398-81e6-fb91e4fd07fa" />


### CSV data management
| Action | How |
|---|---|
| Edit scores | Open `data/neighborhoods.csv` in any spreadsheet app |
| Reload | **Load CSV** button in the sidebar |
| Export | **Download CSV** button exports the current dataset |

### Map opacity slider
A slider in the sidebar controls the opacity of the choropleth layer (10–100 %), making it easy to see the underlying basemap tiles when needed.

### Collapsible sections
The **Weight Sliders** and **Filter Districts** sidebar sections can be collapsed to save space. They start collapsed by default; click the section header to expand.

---

## Running locally

You need Python 3 (pre-installed on macOS) or any static file server. **Do not open `index.html` directly as a file** — the app fetches the GeoJSON and CSV at runtime, which requires an HTTP server.

**Clone and run:**

```bash
git clone https://github.com/pedro-luiz-santoro/sp-neighborhood-map.git
cd sp-neighborhood-map

# Option 1: Docker (recommended for deployment)
docker build -t sp-map . && docker run -p 8000:8000 sp-map

# Option 2: Python static server
python3 -m http.server 8080
```

Then open [http://localhost:8000](http://localhost:8000) (Docker) or [http://localhost:8080](http://localhost:8080) (Python) in your browser.

**Alternative servers** (if you prefer):

```bash
# Node.js
npx serve .

# Ruby
ruby -run -e httpd . -p 8080
```

---

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

---

## Customizing the data

`data/neighborhoods.csv` is a plain spreadsheet — open it in Excel, Numbers, or Google Sheets, edit any scores, save, then use the **Load CSV** button in the sidebar to apply your changes without touching any code.

For full documentation on scoring methodology, data sources, and how each criterion was derived, see [`data/README.md`](data/README.md).

If you want to persist your changes for everyone, edit the CSV and open a PR.

---

## Data disclaimer

The default scores in `data/neighborhoods.csv` were generated with AI assistance and reviewed by a human, but may still contain errors or reflect outdated information. Use them as a starting point — you are encouraged to edit the CSV with your own research and load it back via the **Load CSV** button.

---

## Data sources

- **District polygons**: [codigourbano/distritos-sp](https://github.com/codigourbano/distritos-sp) — SP's 96 official IBGE districts, fetched at runtime
- **Safety scores**: Blended from homicide rate (Mapa da Desigualdade 2024) and street robbery per capita (SSP-SP Dados Criminais 2022–2024, 93 DECAP delegacias)
- **Transit scores**: Based on SP Metro and CPTM network proximity and transfer count to Oscar Freire (L4), the closest station to Nubank
- **Neighbourhoods (bairros)**: Compiled from saopauloaqui.com.br, Wikipedia, Prefeitura SP, saopaulobairros.com.br, spbairros.com.br
- **Map tiles**: CartoDB Dark Matter via OpenStreetMap

---

## Tech stack

No build step, no npm, no dependencies to install.

- [Leaflet.js](https://leafletjs.com/) — map rendering and choropleth
- [chroma.js](https://gka.github.io/chroma.js/) — dynamic color scale
- [PapaParse](https://www.papaparse.com/) — CSV parsing in the browser
- [Chart.js](https://www.chartjs.org/) — horizontal bar chart for district comparison
- Vanilla HTML/CSS/JS — all libraries loaded via CDN
