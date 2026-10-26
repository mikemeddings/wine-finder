"""Weinshop365 (Aemme Getränke AG, Ramsei, Switzerland): its online shop's wine pages.

There is no downloadable list with prices (the yearly PDF loses red/white), but every
wine page carries the shop's own product data (schema.org JSON-LD: price, sale price,
stock) and a "Facts" table (type, vintage, country, region, producer, grapes, size).
Its robots.txt allows these pages (only /admin and /api/ are closed) and its terms
cover sales only; checked 2026-10-26, see Design/CLAUDE.md §11.

A one-time snapshot (Mike, 2026-10-26): the site shows its date and sends people to the
shop's page for today's price; refresh.py re-reads it only when asked (--only w365).

Read politely: one page every DELAY seconds, descriptive User-Agent. The sitemap dates
every page, so a refresh only re-reads pages that changed since the last run; the rest
keep their previous record, re-priced at the current exchange rate. Prices are Swiss
francs including VAT, as the shop shows them, with an approximate Canadian-dollar
price (Bank of Canada rate, as for Lucullus) for the site's filter and sorting.
"""

import datetime as dt
import html
import json
import re
import time
import urllib.error
import urllib.request

from src_lucullus import chf_rate

SOURCE = "Weinshop365"
BASE = "https://weinshop365.ch"
SITEMAP = BASE + "/sitemap.xml"
USER_AGENT = "WineFinder-refresh/1.0 (monthly personal price-list refresh; static site)"
DELAY = 1.2

# "Wine type" in the Facts table -> the site's type. Anything else (spirits, gift packs,
# alcohol-free) is left out.
TYPE_WORDS = [("sparkling", "Sparkling"), ("champagne", "Sparkling"), ("port", "Fortified"),
              ("sherry", "Fortified"), ("dessert", "Dessert"), ("sweet", "Dessert"),
              ("rosé", "Rosé"), ("rose wine", "Rosé"), ("red", "Red"), ("white", "White")]
KEEP_AVAILABILITY = ("InStock", "BackOrder", "PreOrder", "LimitedAvailability")  # order items count

# Some pages (port, sparkling, magnums, small bottles) have no "Wine type" line; their
# menu trail (schema.org BreadcrumbList) says what they are instead.
CATEGORY_TYPES = {"Red wines": "Red", "White wines": "White", "Rosé wines": "Rosé",
                  "Sparkling wines": "Sparkling", "Port wines": "Fortified"}
COLOUR_BY_GRAPE = {"Large formats", "Specialities 50cl / 37.5cl"}  # any colour: tell it from the grapes
RED_GRAPES = ("tinto", "tempranillo", "pinot noir", "merlot", "cabernet", "syrah", "shiraz", "grenache",
              "garnacha", "nebbiolo", "sangiovese", "barbera", "gamay", "malbec", "corvina", "primitivo",
              "zinfandel", "nero", "touriga", "zweigelt", "blaufränkisch", "montepulciano", "aglianico",
              "mencía", "mencia", "carignan", "mourvèdre", "monastrell", "cornalin", "humagne rouge",
              "gamaret", "garanoir", "diolinoir", "dolcetto", "lagrein", "teroldego", "negroamaro")
WHITE_GRAPES = ("chasselas", "chardonnay", "sauvignon", "riesling", "petite arvine", "heida", "païen",
                "pinot gris", "pinot blanc", "pinot grigio", "viognier", "grüner", "verdejo", "albariño",
                "vermentino", "garganega", "müller", "sylvaner", "silvaner", "marsanne", "roussanne",
                "chenin", "gewürz", "johannisberg", "amigne", "humagne blanche", "muscat", "moscato")


# Sweet wines the shop files under white or red: the name says so.
SWEET_NAME = re.compile(r"süsswein|dessertwein|strohwein|beerenauslese|TBA|passito|vendanges tardives|"
                        r"sélection de grains nobles|late harvest|icewine|eiswein|recioto|vin santo", re.I)


def type_from_grapes(grapes):
    g = (grapes or "").lower()
    red, white = any(x in g for x in RED_GRAPES), any(x in g for x in WHITE_GRAPES)
    return "Red" if red and not white else "White" if white and not red else None


def _get(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def sitemap_pages(xml):
    """[(url, lastmod)] for the English wine pages."""
    out = []
    for block in re.findall(r"<url>(.*?)</url>", xml, re.S):
        loc = re.search(r"<loc>([^<]+)</loc>", block)
        if loc and "/en/wein/" in loc.group(1):
            mod = re.search(r"<lastmod>([^<]+)</lastmod>", block)
            out.append((loc.group(1).strip(), mod.group(1).strip() if mod else None))
    return out


def wine_type(text):
    t = (text or "").lower()
    if "alcohol-free" in t or "non-alcoholic" in t:
        return None
    return next((v for word, v in TYPE_WORDS if word in t), None)


def size_ml(text):
    m = re.search(r"([\d.]+)\s*cl", text or "", re.I)
    return round(float(m.group(1)) * 10) if m else None


def parse_page(page, url, lastmod, rate):
    """One wine page -> a record, or None if it isn't a wine we list."""
    product = None
    for block in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', page, re.S):
        try:
            data = json.loads(block)
        except ValueError:
            continue
        if isinstance(data, dict) and data.get("@type") == "Product":
            product = data
            break
    if not product:
        return None
    crumbs = []
    for block in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', page, re.S):
        try:
            data = json.loads(block)
        except ValueError:
            continue
        if isinstance(data, dict) and data.get("@type") == "BreadcrumbList":
            crumbs = [html.unescape(str(i.get("name", ""))) for i in data.get("itemListElement", [])]
    category = crumbs[2] if len(crumbs) > 3 else None  # Home / Wines / <category> / <wine>
    facts = {html.unescape(re.sub(r"<[^>]+>", "", k)).strip(): html.unescape(re.sub(r"<[^>]+>", "", v)).strip()
             for k, v in re.findall(r"<dt[^>]*>(.*?)</dt>\s*<dd[^>]*>(.*?)</dd>", page, re.S)}
    wtype = wine_type(facts.get("Wine type")) or CATEGORY_TYPES.get(category) or         (type_from_grapes(facts.get("Grape varieties")) if category in COLOUR_BY_GRAPE else None)
    offer = product.get("offers") or {}
    if isinstance(offer, list):
        offer = offer[0] if offer else {}
    availability = str(offer.get("availability", "")).rsplit("/", 1)[-1]
    try:
        chf = float(offer.get("price"))
    except (TypeError, ValueError):
        return None
    if not wtype or availability not in KEEP_AVAILABILITY or chf <= 0:
        return None
    if wtype in ("White", "Red") and SWEET_NAME.search(product.get("name", "")):
        wtype = "Dessert"
    was = (offer.get("priceSpecification") or {})
    was = was.get("price") if isinstance(was, dict) and "Strikethrough" in str(was.get("priceType", "")) else None
    vintage = facts.get("Vintage", "")
    region, grape = facts.get("Region") or None, facts.get("Grape varieties") or None
    sku = str(product.get("sku") or facts.get("Article number") or url.rsplit("-", 1)[-1])
    return {
        "id": f"w365-{sku}",
        "source": SOURCE,
        "name": html.unescape(product.get("name", "")).strip(),
        "name_raw": product.get("name", ""),
        "producer": facts.get("Producer") or (product.get("brand") or {}).get("name"),
        "region_or_grape": " ".join(filter(None, [region, grape])) or None,
        "region": region,
        "grape": grape,
        "vintage": int(vintage) if re.fullmatch(r"(19|20)\d\d", vintage) else None,
        "country": facts.get("Country") or product.get("countryOfOrigin"),
        "type": wtype,
        "size_ml": size_ml(facts.get("Bottle size")),
        "pack": 1,
        "abv": None,
        "price": round(chf * rate, 2),  # approximate Canadian dollars
        "price_local": round(chf, 2),
        "price_was": float(was) if was else None,
        "currency": "CHF",
        "vat": "incl",
        "sweetness": None,
        "sku": sku,
        "url": url,
        "available": True,
        "order_item": availability != "InStock",
        "retailer_scores": None,
        "new_since_last": False,
        "page_date": lastmod,
    }


def fetch(previous=(), get=_get, delay=DELAY, log=print):
    """(records, meta extras). previous: last run's records, reused for unchanged pages."""
    rate, rate_date = chf_rate(get)
    pages = sitemap_pages(get(SITEMAP).decode("utf-8"))
    old = {r["url"]: r for r in previous}
    out, read, failed = [], 0, 0
    for url, lastmod in pages:
        prev = old.get(url)
        if prev and lastmod and prev.get("page_date") == lastmod:
            out.append({**prev, "price": round(prev["price_local"] * rate, 2)})
            continue
        try:
            rec = parse_page(get(url).decode("utf-8"), url, lastmod, rate)
        except (urllib.error.URLError, OSError, ValueError):
            failed += 1
            rec = prev  # keep what we had for this wine
        read += 1
        if rec:
            out.append(rec)
        if read % 100 == 0:
            log(f"  Weinshop365: read {read} pages, {len(out)} wines so far")
        time.sleep(delay)
    if failed > max(20, len(pages) // 5):
        raise ValueError(f"{failed} of {len(pages)} pages failed")
    return out, {
        "edition": dt.date.today().isoformat(),  # the snapshot's date
        "snapshot": True,
        "currency": "CHF",
        "fx": {"CAD_per_CHF": rate, "date": rate_date, "source": "Bank of Canada"},
        "note": f"wines from the shop's product pages; prices in CHF including VAT, with approximate CAD "
                f"({read} pages read this run, {len(pages) - read} unchanged)",
    }
