# Basil's Wine Finder

A one-page wine finder covering the BC Liquor price list and two Calgary wine stores (BSW Liquor and ZYN). You filter and sort the wines, make a short list, and send it to Claude, print it or email it. It's a static site (plain HTML, CSS and JavaScript, no build step, no server), shared by link only and not listed in search engines.

## What's on the page

- **Store lists:** BC Liquor (whole wine list), BSW Liquor and ZYN (in-stock wines from their online catalogues).
- **Where can I buy…?:** searches all three lists for a wine, plus search buttons for eight other stores in Alberta, Vancouver, Ontario and Switzerland.
- **Quick picks:** one-tap searches, including "Famous wines" by country.
- **Short List for Claude:** asks Claude about the chosen wines, or asks it to rank them by reviews.
- **My wines:** imports a CellarTracker cellar export, or takes wines added by hand. These are stored only in the viewer's own browser, with a backup file. Nothing personal is ever published.

## Run locally

```
python scripts\refresh.py
python -m http.server 8000
```

Then open http://localhost:8000. Don't open `index.html` by double-clicking it: browsers block `fetch()` of local files.

Other refresh options:

```
python scripts\refresh.py --skip-retailers      # BC only (fast)
python scripts\refresh.py --only zyn            # one store: bcl, zyn or bsw
python scripts\refresh.py --local FILE.csv      # BC from a CSV already on disk
```

## How the refresh works

GitHub Actions (`.github/workflows/refresh.yml`) runs `scripts/refresh.py` on the 1st of January, April, July and October. You can also run it any time from the Actions tab with **Run workflow**. A full run takes about 8 minutes because the Calgary stores are read politely, one page every 1.2 seconds. The workflow commits `data/` only when something changed.

- **BC Liquor** (`scripts/src_bcl.py`): finds the newest price-list CSV through the BC Data Catalogue (CKAN) API and keeps a raw copy in `data/archive/`.
- **BSW and ZYN** (`scripts/src_shopify.py`): read the stores' public Shopify catalogue feeds and keep in-stock wines only. Country and colour come from the stores' own collections.

Each store has its own file (`data/wines.json`, `wines-bsw.json`, `wines-zyn.json`), listed in `data/meta.json`. If a store fails, its previous data is kept and the failure is shown in `meta.json` and on the Actions tab.

When changing `app.js` or `app.css`, bump the `?v=` number in `index.html` so browsers fetch the new files.

## Tests

```
python -m pytest scripts -q
```

These include known-answer checks against the July 2026 BC list and parsing checks for the Calgary feeds.

## Notes

- Prices exclude tax, and availability isn't guaranteed. BSW and ZYN sell in Alberta, so check shipping to BC.
- The CellarTracker, Wine Enthusiast and store-search buttons are plain links. Nothing is copied from those sites.
