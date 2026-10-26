"""Lucullus SA, Stans (Switzerland): its full price list, one Excel download.

Lucullus publishes the whole list for anyone to download from its price-list page
(no login; its terms cover sales only; terms checked 2026-10-26, see Design/CLAUDE.md
§11). One request per refresh. Prices are Swiss francs excluding VAT, as Lucullus
publishes them; each wine also gets an approximate Canadian-dollar price (for the
site's price filter and sorting) from the Bank of Canada's daily CHF rate.

The sheet has no type, country or region columns: they come from heading rows above
each block of wines, in German, three deep: type ("Rotweine"), country ("Frankreich"),
region ("Burgund").
"""

import io
import json
import re
import urllib.request

SOURCE = "Lucullus"
LIST_URL = "https://www.lucullus.ch/product-price-list/xls"
PRODUCT_URL = "https://www.lucullus.ch/en/search?search={sku}"  # an item number opens that wine's own page
FX_URL = "https://www.bankofcanada.ca/valet/observations/FXCHFCAD/json?recent=1"
USER_AGENT = "WineFinder-refresh/1.0 (monthly personal price-list refresh; static site)"

TYPES = {  # heading -> wine type; None = not wine, left out
    "Rotweine": "Red", "Weissweine": "White", "Roséweine": "Rosé", "Champagner": "Sparkling",
    "Schaumweine": "Sparkling", "Süssweine": "Dessert", "Portweine": "Fortified", "Madeira": "Fortified",
    "Armagnac": None, "Cognac": None, "Grappa": None, "Whisky": None, "Spirituosen": None,
}
COUNTRIES = {
    "Frankreich": "France", "Italien": "Italy", "Spanien": "Spain", "Portugal": "Portugal",
    "Deutschland": "Germany", "Österreich": "Austria", "Schweiz": "Switzerland", "USA": "USA",
    "Australien": "Australia", "Neuseeland": "New Zealand", "Chile": "Chile", "Argentinien": "Argentina",
    "Südafrika": "South Africa", "Ungarn": "Hungary", "Libanon": "Lebanon", "Griechenland": "Greece",
    "Kanada": "Canada", "Israel": "Israel",
}
REGIONS = {  # German region names; anything else is kept as written
    "Burgund": "Burgundy", "Côte du Rhône": "Rhône", "Elsass": "Alsace", "Toskana": "Tuscany",
    "Piemont": "Piedmont", "Venetien": "Veneto", "Kampanien": "Campania", "Kalifornien": "California",
    "Südaustralien": "South Australia", "Galizien": "Galicia", "Deutschschweiz": "German-speaking Switzerland",
    "Drei-Seen": "Three Lakes", "Mosel-Saar-Ruwer": "Mosel", "Champagner": "Champagne",
}
VINTAGE_RE = re.compile(r"^(1[89]\d\d|20[0-4]\d)$")


def _get(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def chf_rate(get=_get):
    """(Canadian dollars per Swiss franc, date) from the Bank of Canada's daily rate."""
    obs = json.loads(get(FX_URL))["observations"][-1]
    return float(obs["FXCHFCAD"]["v"]), obs["d"]


def _rows(xlsx_bytes):
    import openpyxl  # only this source needs it
    ws = openpyxl.load_workbook(io.BytesIO(xlsx_bytes), read_only=True, data_only=True)["Preisliste"]
    return [tuple(r) for r in ws.iter_rows(values_only=True)]


def list_date(rows):
    """The date Lucullus printed in the sheet's first cell, e.g. "2026-10-14"."""
    first = rows[0][0] if rows and rows[0] else None
    return first.date().isoformat() if hasattr(first, "date") else None


def clean_name(text):
    return re.sub(r"\s+", " ", re.sub(r"\bCNDP\b", "Châteauneuf-du-Pape", str(text or ""))).strip()


def normalise(rows, rate):
    """Sheet rows -> wine records. rate: Canadian dollars per Swiss franc."""
    start = next(i for i, r in enumerate(rows) if r and r[0] == "Art.-Nr.") + 1
    wtype = country = region = None
    last = None  # what the previous heading row was: "type", "country" or "region"
    out = []
    for r in rows[start:]:
        cells = [c for c in r if c not in (None, "")]
        if not cells:
            continue
        if r[0] in (None, ""):  # a heading row
            h = str(cells[0]).strip()
            if h in COUNTRIES:
                country, region, last = COUNTRIES[h], None, "country"
            elif h in TYPES and last != "country":  # "Armagnac" under "Frankreich" is a region
                wtype, country, region, last = TYPES[h], None, None, "type"
            else:
                region, last = REGIONS.get(h, h), "region"
            continue
        sku, producer, desc, cl, jg, stock, chf = (list(r) + [None] * 8)[:7]
        new = len(r) > 7 and str(r[7] or "").strip().lower() == "neu"
        if wtype is None or not sku or not isinstance(chf, (int, float)) or chf <= 0:
            continue
        vintage = str(jg or "").strip()
        out.append({
            "id": f"luc-{sku}",
            "source": SOURCE,
            "name": clean_name(desc),
            "name_raw": str(desc or ""),
            "producer": str(producer).strip() if producer else None,
            "region_or_grape": region,
            "vintage": int(vintage) if VINTAGE_RE.match(vintage) else None,
            "country": country,
            "type": wtype,
            "size_ml": round(float(cl) * 10) if isinstance(cl, (int, float)) else None,
            "pack": 1,
            "abv": None,
            "price": round(chf * rate, 2),  # approximate Canadian dollars
            "price_local": round(float(chf), 2),
            "currency": "CHF",
            "vat": "excl",
            "stock": int(stock) if isinstance(stock, (int, float)) else None,
            "sweetness": None,
            "sku": str(sku),
            "url": PRODUCT_URL.format(sku=sku),
            "available": not isinstance(stock, (int, float)) or stock > 0,
            "retailer_scores": None,
            "new_since_last": new,
        })
    return out


def fetch(get=_get):
    """(records, meta extras) for refresh.py."""
    rate, rate_date = chf_rate(get)
    rows = _rows(get(LIST_URL))
    return normalise(rows, rate), {
        "edition": list_date(rows),
        "currency": "CHF",
        "fx": {"CAD_per_CHF": rate, "date": rate_date, "source": "Bank of Canada"},
        "note": "Lucullus's full price list; prices in CHF excluding VAT, with approximate CAD",
    }
