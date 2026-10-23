"""BC Liquor Distribution Branch price list: discover, download, normalise.

The BC Data Catalogue is CKAN. As of 2026-10 the dataset has a single CSV
resource that is replaced in place each edition (its file name carries the
month and year, e.g. ..._july_2026.csv).
"""

import csv
import io
import json
import re
import urllib.request
from pathlib import Path

SOURCE = "BC Liquor"
PACKAGE_ID = "bc-liquor-store-product-price-list-historical-prices"
CKAN_URL = "https://catalogue.data.gov.bc.ca/api/3/action/package_show?id=" + PACKAGE_ID
DATASET_PAGE = "https://catalogue.data.gov.bc.ca/dataset/" + PACKAGE_ID
USER_AGENT = "WineFinder-refresh/1.0 (weekly personal price-list refresh; static site)"

MONTHS = ["january", "february", "march", "april", "may", "june", "july",
          "august", "september", "october", "november", "december"]

COUNTRY_NAMES = {
    "UNITED STATES OF AMERICA": "USA",
    "KOREA - SOUTH": "South Korea",
}

# Words kept upper case in display names.
# Not "DO": it is also Portuguese "do" (Quinta do Vale Meao).
UPPER_WORDS = {"AOC", "AOP", "DOC", "DOCG", "IGT", "IGP", "AVA", "VQA",
               "VDP", "VORS", "VOS", "VSOP", "XO", "LBV", "BC", "USA", "NV",
               "II", "III", "IV", "VI", "VII", "VIII", "IX", "XI", "XII"}
LOWER_WORDS = {"1ER": "1er", "ML": "ml"}

VINTAGE_RE = re.compile(r"\b(19\d\d|20[0-3]\d)\b")
EDITION_RE = re.compile(r"(" + "|".join(MONTHS) + r")[_\s-]*(\d{4})", re.I)


def _get(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def edition_from_name(name):
    """'bc_liquor_store_product_price_list_july_2026.csv' -> ('July 2026', (2026, 7))."""
    m = EDITION_RE.search(name or "")
    if not m:
        return None, None
    month = MONTHS.index(m.group(1).lower()) + 1
    return f"{m.group(1).title()} {m.group(2)}", (int(m.group(2)), month)


def discover():
    """Return {'url', 'file', 'edition', 'last_modified'} for the newest CSV edition."""
    try:
        data = json.loads(_get(CKAN_URL))
        resources = [r for r in data["result"]["resources"]
                     if (r.get("format") or "").lower() == "csv" or (r.get("url") or "").lower().endswith(".csv")]
        if not resources:
            raise ValueError("no CSV resources in CKAN package")

        def key(r):
            _, ym = edition_from_name(r.get("url", "").rsplit("/", 1)[-1] + " " + (r.get("name") or ""))
            return (ym or (0, 0), r.get("last_modified") or r.get("created") or "")

        best = max(resources, key=key)
        url = best["url"]
        last_modified = best.get("last_modified") or best.get("created")
    except Exception:
        # Fallback: scrape CSV links from the dataset page.
        html = _get(DATASET_PAGE).decode("utf-8", errors="replace")
        links = set(re.findall(r'href="([^"]+\.csv)"', html, re.I))
        if not links:
            raise
        url = max(links, key=lambda u: edition_from_name(u.rsplit("/", 1)[-1])[1] or (0, 0))
        last_modified = None
    file = url.rsplit("/", 1)[-1]
    return {"url": url, "file": file, "edition": edition_from_name(file)[0], "last_modified": last_modified}


def download(url):
    return _get(url, timeout=120)


def display_name(raw):
    """Title-case a BC name, keeping AOC/DOC/IGT etc. upper case."""
    def word(w):
        core = w.strip("()[],.")
        if core.upper() in UPPER_WORDS:
            return w.upper()
        if core.upper() in LOWER_WORDS:
            return w.replace(core, LOWER_WORDS[core.upper()])
        out, cap = [], True
        for i, ch in enumerate(w.lower()):
            if ch.isalpha():
                out.append(ch.upper() if cap else ch)
                cap = False
            else:
                out.append(ch)
                if ch in "-/(.&":
                    cap = True
                elif ch == "'":
                    # D'ESTOURNEL -> D'Estournel, but BLANDY'S -> Blandy's
                    letters = [c for c in w[:i] if c.isalpha()]
                    cap = len(letters) == 1
        return "".join(out)

    return " ".join(word(w) for w in raw.split())


def country_name(raw):
    raw = (raw or "").strip().upper()
    if raw in COUNTRY_NAMES:
        return COUNTRY_NAMES[raw]
    return " ".join(w.capitalize() for w in raw.split())


TYPE_RULES = [  # first match wins; whole words only ("Port" must not match "Portugal")
    ("Sparkling", r"champagne|sparkling|prosecco"),
    ("Fortified", r"port|sherry|madeira|vermouth|fortified|aperitif"),
    ("Dessert", r"dessert|ice wine"),
    ("Sake", r"sake|rice wine"),
    ("Red", r"red"),
    ("White", r"white"),
    ("Rosé", r"rose"),
]


def wine_type(item_class):
    c = (item_class or "").lower()
    for name, pattern in TYPE_RULES:
        if re.search(r"\b(?:" + pattern + r")\b", c):
            return name
    return "Other"


def _num(s):
    s = (s or "").strip()
    if not s or s.upper() == "NA":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def normalise(csv_bytes, previous_skus=None):
    """Parse raw CSV bytes into normalised wine records (wine category only)."""
    text = csv_bytes.decode("utf-8", errors="replace")
    records = []
    for r in csv.DictReader(io.StringIO(text, newline="")):
        if (r.get("ITEM_CATEGORY_NAME") or "").strip() != "Wine":
            continue
        raw = (r["PRODUCT_LONG_NAME"] or "").strip()
        sku = (r["PRODUCT_SKU_NO"] or "").strip()
        m = VINTAGE_RE.search(raw)
        vintage = int(m.group(1)) if m else None
        region, producer = None, None
        if " - " in raw:
            left, right = raw.split(" - ", 1)
            region = display_name(left.strip())
            right = VINTAGE_RE.sub("", right).strip()
            producer = display_name(right) if right else None
        litres = _num(r["PRODUCT_LITRES_PER_CONTAINER"])
        sweet = _num(r["SWEETNESS_CODE"])
        pack = _num(r["PRD_CONTAINER_PER_SELL_UNIT"])
        records.append({
            "id": f"bcl-{sku}",
            "source": SOURCE,
            "name": display_name(raw),
            "name_raw": raw,
            "producer": producer,
            "region_or_grape": region,
            "vintage": vintage,
            "country": country_name(r["PRODUCT_COUNTRY_ORIGIN_NAME"]),
            "type": wine_type(r["ITEM_CLASS_NAME"]),
            "size_ml": int(round(litres * 1000)) if litres else None,
            "pack": int(pack) if pack else 1,
            "abv": _num(r["PRODUCT_ALCOHOL_PERCENT"]),
            "price": _num(r["PRODUCT_PRICE"]),
            "sweetness": int(sweet) if sweet is not None else None,
            "sku": sku,
            "url": None,
            "available": True,
            "retailer_scores": None,
            "new_since_last": bool(previous_skus) and sku not in previous_skus,
        })
    return records


def wine_skus(csv_bytes):
    text = csv_bytes.decode("utf-8", errors="replace")
    return {(r.get("PRODUCT_SKU_NO") or "").strip()
            for r in csv.DictReader(io.StringIO(text, newline=""))
            if (r.get("ITEM_CATEGORY_NAME") or "").strip() == "Wine"}


def previous_edition(archive_dir, current_file):
    """Newest archived CSV older than current_file, or None."""
    _, cur = edition_from_name(current_file)
    best = None
    for p in Path(archive_dir).glob("*.csv"):
        _, ym = edition_from_name(p.name)
        if ym and cur and ym < cur and (best is None or ym > best[0]):
            best = (ym, p)
    return best[1] if best else None
