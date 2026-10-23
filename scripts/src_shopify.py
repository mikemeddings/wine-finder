"""Calgary retailers on Shopify: ZYN and BSW Liquor.

Both stores publish their catalogue as JSON at /collections/<handle>/products.json
(robots.txt allows it; terms checked 2026-10-23, see Design/CLAUDE.md §11). We read
politely: one request every DELAY seconds, descriptive User-Agent, weekly.

Neither feed states country and colour reliably on its own, so both are taken
from collection membership (e.g. ZYN's "france", BSW's "red-wine"), with the
product's own type or tags as a fallback. Only in-stock wines are kept.
"""

import json
import re
import time
import urllib.error
import urllib.request

USER_AGENT = "WineFinder-refresh/1.0 (weekly personal price-list refresh; static site)"
DELAY = 1.2
PAGE = 250
SHOPIFY_CAP = 25000  # Shopify refuses page * limit beyond this

VINTAGE_RE = re.compile(r"\b(19\d\d|20[0-3]\d)\b")


# ---- Fetching -------------------------------------------------------------------

def _get_json(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def fetch_collection(base, handle, delay=DELAY, get=_get_json):
    """All products in one collection, without descriptions or images."""
    out, page = [], 1
    while page * PAGE <= SHOPIFY_CAP:
        try:
            products = get(f"{base}/collections/{handle}/products.json?limit={PAGE}&page={page}")["products"]
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return out
            raise
        if not products:
            break
        for p in products:
            p.pop("body_html", None)
            p.pop("images", None)
        out += products
        page += 1
        time.sleep(delay)
    return out


def fetch_groups(base, groups, delay=DELAY, get=_get_json):
    """{handle: [products]} for every handle named in groups ({label: [handles]})."""
    return {h: fetch_collection(base, h, delay, get) for hs in groups.values() for h in hs}


# ---- Shared parsing ------------------------------------------------------------

def in_stock_variant(p):
    """The single-bottle variant if one is in stock, else the first in-stock variant."""
    avail = [v for v in p.get("variants", []) if v.get("available")]
    if not avail:
        return None
    single = [v for v in avail if not re.search(r"\bpack\b", v.get("title") or "", re.I)]
    return (single or avail)[0]


def pack_of(variant_title):
    m = re.search(r"(\d+)\s*pack", variant_title or "", re.I)
    return int(m.group(1)) if m else 1


SIZE_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(ml|l|litre|liter)\b", re.I)


def size_from_text(text):
    """Bottle size in ml from text like '375 ml', '1.5 Litre', '3 x 50 ml'; None if absent."""
    text = text or ""
    m = SIZE_RE.search(text)
    if m:
        n, unit = float(m.group(1)), m.group(2).lower()
        return int(round(n if unit == "ml" else n * 1000))
    if re.search(r"\bmagnum\b", text, re.I):
        return 1500
    return None


def multipack_from_title(title):
    m = re.search(r"\b(\d+)\s*x\s*\d", title or "", re.I)
    return int(m.group(1)) if m else 1


def vintage_of(title):
    m = VINTAGE_RE.search(title or "")
    return int(m.group(1)) if m else None


def clean_title(title):
    """Drop a trailing size note: 'Masi Amarone 2017 - 375 ml' -> 'Masi Amarone 2017'."""
    t = re.sub(r"\s+-\s+[\d.]+\s*(ml|l|litre|liter)\b.*$", "", title or "", flags=re.I)
    return re.sub(r"\s+", " ", t).strip()


def first_group(pid, groups, membership):
    """First label in groups ({label: [handles]}) whose collections contain pid."""
    for label, handles in groups.items():
        if any(pid in membership.get(h, ()) for h in handles):
            return label
    return None


def record(prefix, source, base, p, variant, country, wine_type, size_ml, pack, grape=None, scores=None):
    title = clean_title(p["title"])
    return {
        "id": f"{prefix}-{p['id']}",
        "source": source,
        "name": title,
        "name_raw": p["title"],
        "producer": None,
        "region_or_grape": grape or None,
        "vintage": vintage_of(p["title"]),
        "country": country,
        "type": wine_type,
        "size_ml": size_ml,
        "pack": pack,
        "abv": None,
        "price": float(variant["price"]),
        "sweetness": None,
        "sku": variant.get("sku") or str(p["id"]),
        "url": f"{base}/products/{p['handle']}",
        "available": True,
        "retailer_scores": scores,
        "new_since_last": False,
    }


# ---- ZYN ---------------------------------------------------------------------------

ZYN_BASE = "https://zyn.ca"
ZYN_SOURCE = "ZYN"

ZYN_TYPES = {  # checked in this order: a sparkling wine can also sit in white-wine
    "Sparkling": ["sparkling-wines", "champagne"],
    "Fortified": ["fortified-wines"],
    "Dessert": ["dessert-wines"],
    "Rosé": ["rose-wine"],
    "Red": ["red-wine"],
    "White": ["white-wine"],
}
ZYN_COUNTRIES = {
    "France": ["france"], "Italy": ["italy"], "USA": ["united-states"], "Canada": ["canada"],
    "Argentina": ["argentina"], "Australia": ["australia"], "Spain": ["spain"], "Chile": ["chile"],
    "Portugal": ["portugal"], "New Zealand": ["new-zealand"], "South Africa": ["south-africa"],
    "Germany": ["germany"], "Austria": ["austria"], "Greece": ["greece"], "Hungary": ["hungary"],
    "Georgia": ["georgia"], "Croatia": ["croatia"], "Lebanon": ["lebanon"], "Montenegro": ["montenegro"],
    "Uruguay": ["uruguay"], "Brazil": ["brazil"], "Romania": ["romania"],
}
ZYN_TOP = "90-wines"  # ZYN's own collection, titled "90+ Point Wines Under $35"

# ZYN product_type codes, e.g. C7-ITALY-RED, C7-MOLDOVA, C7-PORT.
ZYN_CODE_COUNTRY = {"ARG": "Argentina", "USA": "USA", "SHERRY": "Spain", "MADEIRA": "Portugal",
                    "MARSALA": "Italy"}
ZYN_CODE_TYPE = {"PORT": "Fortified", "SHERRY": "Fortified", "MADEIRA": "Fortified", "MARSALA": "Fortified",
                 "VERMOUTH-APERITIF": "Fortified", "DESSERT-WINE": "Dessert", "ROSE-WINE": "Rosé",
                 "SPARKLING": "Sparkling"}
ZYN_CODE_NO_COUNTRY = {"CELLAR", "375ML-WINE", "PORT", "ROSE-WINE", "SPARKLING", "DESSERT-WINE",
                       "VERMOUTH-APERITIF"}
ZYN_SKIP_TYPES = {"Bundles", "C7-375ML-SPIRITS", "C7-LIQUEUR", ""}  # Bundles repeat single wines as cases


def zyn_code(product_type):
    """'C7-ITALY-RED' -> (country, type); either may be None."""
    m = re.match(r"C7-(.+?)(?:-(RED|WHITE))?$", product_type or "")
    if not m:
        return None, None
    code, colour = m.group(1), m.group(2)
    wine_type = {"RED": "Red", "WHITE": "White"}.get(colour) or ZYN_CODE_TYPE.get(code)
    if code in ZYN_CODE_COUNTRY:
        country = ZYN_CODE_COUNTRY[code]
    elif code in ZYN_CODE_NO_COUNTRY:
        country = None
    else:
        country = " ".join(w.capitalize() for w in code.split("-"))
    return country, wine_type


def zyn_groups():
    return {**ZYN_TYPES, **ZYN_COUNTRIES, "top": [ZYN_TOP], "wine": ["wine"]}  # sparkling handles are in ZYN_TYPES


ZYN_WINE_SOURCES = ["wine", "sparkling-wines", "champagne"]  # ZYN keeps bubbles outside "wine"


def normalise_zyn(collections):
    """collections: {handle: [products]} including the ZYN_WINE_SOURCES and type/country handles."""
    membership = {h: {p["id"] for p in ps} for h, ps in collections.items()}
    records, seen = [], set()
    for p in (p for h in ZYN_WINE_SOURCES for p in collections.get(h, [])):
        if p["id"] in seen or (p.get("product_type") or "") in ZYN_SKIP_TYPES:
            continue
        seen.add(p["id"])
        v = in_stock_variant(p)
        if not v:
            continue
        code_country, code_type = zyn_code(p.get("product_type"))
        country = first_group(p["id"], ZYN_COUNTRIES, membership) or code_country
        wine_type = first_group(p["id"], ZYN_TYPES, membership) or code_type or "Other"
        scores = "On ZYN's list of 90+ point wines under $35" if p["id"] in membership.get(ZYN_TOP, ()) else None
        size = size_from_text(p["title"]) or 750
        pack = pack_of(v.get("title")) * multipack_from_title(p["title"])
        records.append(record("zyn", ZYN_SOURCE, ZYN_BASE, p, v, country, wine_type, size, pack, scores=scores))
    return records


def fetch_zyn(delay=DELAY, get=_get_json):
    return normalise_zyn(fetch_groups(ZYN_BASE, zyn_groups(), delay, get))


# ---- BSW Liquor ----------------------------------------------------------------------

BSW_BASE = "https://www.bswliquor.com"
BSW_SOURCE = "BSW Liquor"

# BSW's "wine" collection (36k) is over Shopify's 25k cap, so read it by colour.
BSW_TYPES = {
    "Sparkling": ["champagne-sparkling"],
    "Fortified": ["fortified-wine"],
    "Dessert": ["dessert-wine"],
    "Sake": ["sake"],
    "Rosé": ["rose-wine"],
    "Red": ["red-wine"],
    "White": ["white-wine"],
}
BSW_COUNTRIES = {
    "France": ["french-wine"], "Italy": ["italian-wines"], "USA": ["american-wine"],
    "Canada": ["canadian-wine"], "Spain": ["spanish-wine"], "Australia": ["australian-wines"],
    "Chile": ["chile-wine"], "Portugal": ["portugal-wines"], "South Africa": ["south-africa-wines"],
    "Germany": ["german-wine"], "New Zealand": ["new-zealand-wines"], "Austria": ["austrian-wine"],
    "Georgia": ["georgian-wine"], "Moldova": ["moldovan-wine"], "Argentina": ["argentina"],
}

# Tag words that point to a country, used when no country collection claims the wine.
COUNTRY_WORDS = {
    "France": ["france", "french"], "Italy": ["italy", "italian"], "USA": ["united states", "usa", "american"],
    "Canada": ["canada", "canadian"], "Spain": ["spain", "spanish"], "Australia": ["australia", "australian"],
    "Argentina": ["argentina", "argentinian", "argentine"], "Chile": ["chile", "chilean"],
    "Portugal": ["portugal", "portuguese"], "South Africa": ["south africa", "south african"],
    "New Zealand": ["new zealand"], "Germany": ["germany", "german"], "Austria": ["austria", "austrian"],
    "Greece": ["greece", "greek"], "Hungary": ["hungary", "hungarian"], "Georgia": ["georgia", "georgian"],
    "Moldova": ["moldova", "moldovan", "moldovian"], "Lebanon": ["lebanon", "lebanese"],
    "Croatia": ["croatia", "croatian"], "Romania": ["romania", "romanian"], "Bulgaria": ["bulgaria", "bulgarian"],
    "Uruguay": ["uruguay", "uruguayan"], "Brazil": ["brazil", "brazilian"], "Japan": ["japan", "japanese"],
    "China": ["china", "chinese"], "Israel": ["israel", "israeli"], "Ukraine": ["ukraine", "ukrainian"],
    "Slovenia": ["slovenia", "slovenian"], "Mexico": ["mexico", "mexican"],
}
REGION_COUNTRY = {  # BSW "BRAND: <region>" tags
    "bordeaux": "France", "burgundy": "France", "loire valley": "France", "rhone valley": "France",
    "provence": "France", "languedoc-roussillon": "France", "alsace": "France", "champagne": "France",
    "tuscany": "Italy", "piedmont": "Italy", "veneto": "Italy", "campania": "Italy", "abbruzzi": "Italy",
    "friuli - venezia - guilia": "Italy", "sicily": "Italy", "puglia": "Italy",
    "british columbia": "Canada", "ontario": "Canada", "california": "USA", "oregon": "USA",
    "washington": "USA", "south australia": "Australia", "mosel - saar - ruwer": "Germany",
    "priorat": "Spain", "rioja": "Spain", "ribera del duero": "Spain", "douro": "Portugal",
}


def country_from_tags(tags):
    """Vote across tags ('Moldova', 'Republic Of Moldova', 'Moldovian Red Wine', 'BRAND: TUSCANY').

    A clear winner is returned; a tie returns None rather than guess.
    """
    votes = {}
    for tag in tags or []:
        t = tag.strip().lower()
        if t.startswith("brand:"):
            c = REGION_COUNTRY.get(t[6:].strip())
            if c:
                votes[c] = votes.get(c, 0) + 1
            continue
        for country, words in COUNTRY_WORDS.items():
            if any(re.search(r"\b" + re.escape(w) + r"\b", t) for w in words):
                votes[country] = votes.get(country, 0) + 1
    if not votes:
        return None
    best = max(votes.values())
    winners = [c for c, n in votes.items() if n == best]
    return winners[0] if len(winners) == 1 else None


def size_from_tags(tags):
    for tag in tags or []:
        t = tag.strip()
        m = re.fullmatch(r"(?:SIZE:\s*)?(\d+(?:\.\d+)?)\s*(ml|l)?", t, re.I)
        if m and (m.group(2) or t.upper().startswith("SIZE")):
            n, unit = float(m.group(1)), (m.group(2) or "ml").lower()
            return int(round(n if unit == "ml" else n * 1000))
    return None


def bsw_groups():
    return {**BSW_TYPES, **BSW_COUNTRIES}


def normalise_bsw(collections):
    membership = {h: {p["id"] for p in ps} for h, ps in collections.items()}
    records, seen = [], set()
    for handles in BSW_TYPES.values():
        for h in handles:
            for p in collections.get(h, []):
                if p["id"] in seen:
                    continue
                seen.add(p["id"])
                v = in_stock_variant(p)
                if not v:
                    continue
                tags = p.get("tags") or []
                country = first_group(p["id"], BSW_COUNTRIES, membership) or country_from_tags(tags)
                wine_type = first_group(p["id"], BSW_TYPES, membership)
                size = size_from_tags(tags) or size_from_text(p["title"]) or 750
                pack = pack_of(v.get("title")) * multipack_from_title(p["title"])
                records.append(record("bsw", BSW_SOURCE, BSW_BASE, p, v, country, wine_type, size, pack,
                                      grape=(p.get("product_type") or "").strip()))
    return records


def fetch_bsw(delay=DELAY, get=_get_json):
    return normalise_bsw(fetch_groups(BSW_BASE, bsw_groups(), delay, get))
