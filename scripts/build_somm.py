"""Build data/somm.json, the Master Sommelier's data, from the notes taken while reading the
pairing books in full ("food pairings/notes_*.json"; that folder holds the books and is never
committed). The notes are in our own words, with book and page; recipes are kept by title and
page only. Wine names in the notes ("Sparkling (New World brut)", "Shiraz", "Chianti") are
turned into the names the site gives its wines: the grape list in app.js, plus a few styles.

Run:  python scripts/build_somm.py
"""
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NOTES = ROOT / "food pairings"
OUT = ROOT / "data" / "somm.json"
BOOKS = {
    "PP": ("notes_perfect_pairings.json", "Perfect Pairings (Evan Goldstein)"),
    "DP": ("notes_daring_pairings.json", "Daring Pairings (Evan Goldstein)"),
    "WLC": ("notes_wine_lovers_cookbook.json", "The Wine Lover's Cookbook (Sid Goldstein)"),
    "FW": ("notes_food_wine_guide.json", "The Food & Wine Guide to Perfect Pairings"),
}
FOODS = ["Red meat", "Lamb", "Pork", "Chicken", "Fish", "Seafood", "Pasta and pizza", "Cheese", "Spicy food", "Dessert"]


def fold(s):
    return unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()


def jsfold(s):
    """app.js's fold(): accents off, lower case, punctuation kept."""
    return "".join(c for c in unicodedata.normalize("NFD", str(s or "")) if unicodedata.category(c) != "Mn").lower()


def js_grapes():
    """The GRAPES list from app.js, as (name, compiled regex)."""
    src = (ROOT / "app.js").read_text(encoding="utf-8")
    block = src[src.index("const GRAPES = ["):]
    block = block[:block.index("\n];")]
    out = []
    for name, rx in re.findall(r'\["([^"]+)",\s*/(.+?)/\]', block):
        out.append((name, re.compile(rx)))
    return out


GRAPES = js_grapes()
STYLES = [  # the style names somm.js gives wines (sommKeys), and how the books write them
    ("Champagne", r"\bchampagne\b"),
    ("Sparkling", r"\b(sparkling|champagne|cava|cremant|prosecco|franciacorta|sekt|brut|bubbl\w*|spumante|blanc de blancs|blanc de noirs)\b"),
    ("Rosé", r"\b(rose|rosado|rosato|blush|vin gris|white zinfandel)\b"),
    ("Port", r"\b(port|porto|tawny|lbv|banyuls|maury)\b"),
    ("Madeira", r"\bmadeira\b"),
    ("Sherry (oloroso)", r"\b(oloroso|cream sherry|pedro ximenez|px)\b"),
    ("Sherry (fino)", r"\b(fino|manzanilla|amontillado)\b|\bsherry\b(?!.*oloroso)"),
    ("Sauternes", r"\b(sauternes|barsac)\b"),
    ("Tokaji", r"\btokaj"),
    ("Ice wine", r"\b(ice ?wine|icewine|eiswein)\b"),
    ("Late-harvest white", r"\b(late.harvest|vendange tardive|beerenauslese|auslese|spatlese|botrytis|noble rot|vin santo|sweet white|dessert wine|moscato d.asti|muscat de beaumes|recioto|passito)\b"),
]
STYLES = [(n, re.compile(rx)) for n, rx in STYLES]
# whole-region names the grape regexes don't catch
EXTRA = [
    ("Pinot Noir", r"\b(red burgundy|burgundy \(red\)|bourgogne rouge|cote de nuits|cote de beaune|volnay|pommard|gevrey)\b"),
    ("Chardonnay", r"\b(white burgundy|burgundy \(white\)|bourgogne blanc)\b"),
    ("Cabernet Sauvignon", r"\b(red bordeaux|bordeaux \(red\)|bordeaux blend|meritage)\b"),
    ("Merlot", r"\b(red bordeaux|bordeaux \(red\)|bordeaux blend|meritage)\b"),
    ("Sauvignon Blanc", r"\b(white bordeaux|graves blanc|entre.deux.mers)\b"),
    ("Syrah / Shiraz", r"\b(northern rhone|rhone red|red rhone)\b"),
    ("Grenache / Garnacha", r"\b(southern rhone|rhone red|red rhone|cotes du rhone)\b"),
    ("Muscat / Moscato", r"\bmoscato d.asti\b"),
]
EXTRA = [(n, re.compile(rx)) for n, rx in EXTRA]


def keys_of(label):
    """The site's names for one wine as a book writes it."""
    t = fold(label)
    keys = [n for n, rx in GRAPES if rx.search(t)] + [n for n, rx in EXTRA if rx.search(t)]
    keys += [n for n, rx in STYLES if rx.search(t)]
    if not keys:  # a grape the site doesn't list yet: keep the book's own name, tidied
        base = re.sub(r"\s*\(.*?\)", "", str(label)).strip()
        if base and len(base) < 40:
            keys.append(base)
    return list(dict.fromkeys(keys))


def keys_all(labels):
    out = []
    for l in labels or []:
        out += keys_of(l)
    return list(dict.fromkeys(out))


COUNTRIES = None


def countries():
    global COUNTRIES
    if COUNTRIES is None:
        names = set()
        for f in (ROOT / "data").glob("wines*.json"):
            for w in json.loads(f.read_text(encoding="utf-8")):
                if w.get("country"):
                    names.add(w["country"])
        COUNTRIES = sorted(names - {"Country not stated"}, key=len, reverse=True)
    return COUNTRIES


REGION_COUNTRY = {  # regions the books name without their country
    "burgundy": "France", "bordeaux": "France", "rhone": "France", "loire": "France", "alsace": "France", "champagne": "France",
    "provence": "France", "languedoc": "France", "beaujolais": "France", "jura": "France", "sauternes": "France", "roussillon": "France",
    "tuscany": "Italy", "piedmont": "Italy", "veneto": "Italy", "sicily": "Italy", "campania": "Italy", "friuli": "Italy", "umbria": "Italy",
    "sardinia": "Italy", "alto adige": "Italy", "puglia": "Italy", "rioja": "Spain", "catalonia": "Spain", "priorat": "Spain",
    "ribera": "Spain", "rias baixas": "Spain", "jerez": "Spain", "andalusia": "Spain", "douro": "Portugal", "dao": "Portugal",
    "alentejo": "Portugal", "vinho verde": "Portugal", "madeira": "Portugal", "mosel": "Germany", "rheingau": "Germany",
    "pfalz": "Germany", "wachau": "Austria", "tokaj": "Hungary", "napa": "United States", "sonoma": "United States",
    "california": "United States", "oregon": "United States", "washington": "United States", "okanagan": "Canada",
    "niagara": "Canada", "ontario": "Canada", "british columbia": "Canada", "mendoza": "Argentina", "barossa": "Australia",
    "mclaren": "Australia", "marlborough": "New Zealand", "stellenbosch": "South Africa", "santorini": "Greece",
    "kakheti": "Georgia", "usa": "United States", "united states": "United States", "america": "United States",
}


def country_of(place):
    t = fold(place)
    for c in countries():
        if fold(c) in t:
            return c
    for r, c in REGION_COUNTRY.items():
        if r in t:
            return c
    return None


def main():
    out = {"books": {b: {"short": s} for b, (_, s) in BOOKS.items()}, "grapes": {}, "recipes": [], "regions": {},
           "cheese": [], "dessert": [], "dishes": [], "menus": [], "bridges": {}, "principles": []}
    out["books"]["DPG"] = {"short": "Dornenburg & Page"}
    read = []
    for b, (fn, _) in BOOKS.items():
        p = NOTES / fn
        if not p.exists():
            continue
        d = json.loads(p.read_text(encoding="utf-8"))
        read.append(b)
        for g in d.get("grapes", []):
            for k in keys_of(g["grape"])[:1]:
                e = out["grapes"].setdefault(k, {"foods": {}})
                if g.get("style") and not e.get("style"):
                    e["style"] = g["style"]
                e.setdefault("places", [])
                e["places"] = list(dict.fromkeys(e["places"] + (g.get("places") or [])))[:8]
        for x in d.get("grape_foods", []):
            if x.get("food") not in FOODS:
                continue
            for k in keys_of(x["grape"]):
                e = out["grapes"].setdefault(k, {"foods": {}})
                e["foods"].setdefault(x["food"], []).append([x.get("dish", ""), int(x.get("strength") or 1), b, x.get("page"), x.get("why", "")])
        for r in d.get("recipes", []):
            if r.get("sub_recipe"):
                continue
            ks = keys_all(r.get("wines"))
            if not ks:
                continue
            out["recipes"].append([r["title"], b, r.get("page"), r.get("food") if r.get("food") in FOODS else None,
                                   r.get("course") or "main", r.get("protein") or "", ks, r.get("why", "")])
        for x in d.get("food_wines", []):
            if x.get("food") not in FOODS:
                continue
            out["dishes"].append([x["food"], x.get("dish", ""), keys_all(x.get("wines")), keys_all(x.get("avoid")), b, x.get("page"), x.get("why", "")])
        for x in d.get("cheese", []):
            ks = keys_all(x.get("wines"))
            if ks:
                out["cheese"].append([x["cheese"], ks, b, x.get("page")])
        for x in d.get("dessert", []):
            ks = keys_all(x.get("wines"))
            if ks:
                out["dessert"].append([x["dessert"], ks, b, x.get("page")])
        for x in d.get("bridges", []):  # ingredients that link a dish to the wine
            for k in keys_of(x["grape"])[:1]:
                out["bridges"].setdefault(k, []).append([x.get("ingredients", []), b, x.get("page")])
        for x in d.get("principles", []):  # the books' rules, with the wines each names (if any)
            t = fold(x.get("rule", ""))
            ks = [n for n, rx in GRAPES + EXTRA + STYLES if rx.search(t)]
            out["principles"].append([x.get("rule", ""), b, x.get("page"), list(dict.fromkeys(ks))])
        for m in d.get("menus", []):  # the books' own menus, each course with its wine
            courses = [[c.get("dish", ""), keys_all([c.get("wine", "")] if isinstance(c.get("wine"), str) else c.get("wine"))] for c in m.get("courses", [])]
            if courses:
                out["menus"].append([m.get("name", ""), b, m.get("page"), courses])
        for x in d.get("regions", []):
            c = country_of(x.get("place", ""))
            if not c:
                continue
            e = out["regions"].setdefault(c, {"grapes": [], "foods": [], "refs": []})
            e["grapes"] = list(dict.fromkeys(e["grapes"] + keys_all(x.get("grapes"))))
            e["foods"] = list(dict.fromkeys(e["foods"] + [f for f in (x.get("foods") or []) if f]))
            if x.get("foods") and len(e["refs"]) < 6:
                e["refs"].append([b, x.get("page")])
    # the recipes themselves (food pairings/recipes_*.json): ingredients as the book prints them,
    # the method in our own words. Keyed as somm.js looks them up: book|title, folded as JS fold() does.
    recipes = {}
    for b in ("PP", "DP", "WLC", "FW"):
        p = NOTES / f"recipes_{b}.json"
        if not p.exists():
            continue
        for r in json.loads(p.read_text(encoding="utf-8")):
            if not r.get("ingredients") or not r.get("method"):
                continue
            recipes[f"{b}|{jsfold(r['title'])}"] = {"s": r.get("serves"), "t": r.get("time"), "i": r["ingredients"], "m": r["method"]}
            listed = any(x[1] == b and jsfold(x[0]) == jsfold(r["title"]) for x in out["recipes"])
            ks = keys_all(r.get("wines"))
            if not listed and ks and not r.get("sub_recipe"):
                out["recipes"].append([r["title"], b, r.get("page"), r.get("food") if r.get("food") in FOODS else None,
                                       r.get("course") or "main", r.get("protein") or "", ks, ""])
    (ROOT / "data" / "recipes.json").write_text(json.dumps(recipes, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"recipes written out: {len(recipes)}")
    # best matches first, and no dish twice for a grape and food
    for e in out["grapes"].values():
        for f, rows in e["foods"].items():
            seen, keep = set(), []
            for row in sorted(rows, key=lambda r: -r[1]):
                k = fold(row[0])
                if k not in seen:
                    seen.add(k)
                    keep.append(row)
            e["foods"][f] = keep
    for e in out["regions"].values():
        e["foods"] = e["foods"][:14]
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"books read: {read}; grapes {len(out['grapes'])}, recipes {len(out['recipes'])}, dishes {len(out['dishes'])}, "
          f"cheese {len(out['cheese'])}, dessert {len(out['dessert'])}, countries {len(out['regions'])}; {OUT.stat().st_size // 1024} KB")
    unknown = sorted({k for e in [out["grapes"]] for k in e if k not in {n for n, _ in GRAPES} and k not in {n for n, _ in STYLES}})
    print("names not in the site's grape list:", unknown)


if __name__ == "__main__":
    main()
