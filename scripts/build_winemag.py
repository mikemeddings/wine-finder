"""Build data/producers-we.json: how each producer's wines score for their price, from the Wine
Enthusiast reviews in WineMag/winemag-data_first150k.csv (that folder stays on the PC and is never
committed). Only points, prices, label names and grapes are kept, summed up by producer; no tasting
notes. The reviews carry no vintage, so this is a producer's reputation, not a score for a bottle.

A review's "value" is its points minus what wines at that price usually score in the whole file,
so +3 means three points better than its price suggests. Only producers that match a wine in the
store lists or the cellars are kept, matched the same way the site does (see gems.js), plus any
producer whose wines score at least 2 points above their prices across three or more reviews.

Run:  python scripts/build_winemag.py
"""
import csv
import json
import math
import re
import statistics as st
import unicodedata
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "WineMag" / "winemag-data_first150k.csv"
OUT = ROOT / "data" / "producers-we.json"
STORES = ["wines.json", "wines-bsw.json", "wines-zyn.json", "wines-lucullus.json", "wines-weinshop365.json"]

# Words that don't tell one producer from another. Kept the same as STOP in gems.js.
STOP = set("""wine wines vineyard vineyards estate estates winery wineries cellars cellar family famille domaine domaines
chateau chateaux bodega bodegas cantina cantine tenuta tenute weingut weinguter the and vins vin vino vini vinhos weine wein
casa quinta azienda agricola fattoria poderi podere mas clos company cie fils sons brothers freres group wineworks
de du la le les di del della des von van der den das""".split())
COUNTRY = {"US": "USA", "United States": "USA", "England": "United Kingdom"}


def fold(s):
    s = "".join(c for c in unicodedata.normalize("NFD", str(s or "")) if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", " ", s)


def words(s):
    return [t for t in fold(s).split() if len(t) > 2 and t not in STOP]


def country(c):
    return COUNTRY.get(c, c or "")


def main():
    rows, seen = [], set()
    with open(SRC, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            k = (r["winery"], r["designation"], r["variety"], r["points"], r["price"], r["description"][:80])
            if k in seen:
                continue  # the file repeats many reviews
            seen.add(k)
            rows.append(r)

    # what a price usually scores: mean points in bands of log price, as [price, points]
    bands = defaultdict(list)
    for r in rows:
        if r["price"]:
            bands[round(math.log(float(r["price"])) * 4)].append(int(r["points"]))
    base = sorted((math.exp(b / 4), st.mean(v)) for b, v in bands.items() if len(v) >= 30)

    def expected(p):
        if p <= base[0][0]:
            return base[0][1]
        for (p0, s0), (p1, s1) in zip(base, base[1:]):
            if p <= p1:
                return s0 + (s1 - s0) * (math.log(p) - math.log(p0)) / (math.log(p1) - math.log(p0))
        return base[-1][1]

    by = defaultdict(list)
    for r in rows:
        by[(r["winery"], country(r["country"]))].append(r)

    # keep the producers the site can meet: a store wine or a cellar wine matches them
    index = defaultdict(list)
    for (name, ctry) in by:
        w = words(name)
        if w:
            index[max(w, key=len)].append((name, ctry, set(w)))
    pool = []
    for f in STORES:
        d = json.loads((ROOT / "data" / f).read_text(encoding="utf-8"))
        pool += d if isinstance(d, list) else d["wines"]
    for c in json.loads((ROOT / "data" / "cellars.json").read_text(encoding="utf-8"))["cellars"].values():
        pool += c.get("wines", [])
    keep = set()
    for w in pool:
        toks = set(fold(f"{w.get('producer') or ''} {w.get('name') or ''} {w.get('region_or_grape') or ''}").split())
        best = None
        for t in toks:
            for name, ctry, need in index.get(t, []):
                if not need <= toks:
                    continue
                wc = w.get("country") or ""
                if ctry and wc and wc != "Country not stated" and ctry != wc:
                    continue
                if (not ctry or not wc) and len(need) < 2:
                    continue
                if not best or len(need) > len(best[2]):
                    best = (name, ctry, need)
        if best:
            keep.add(best[:2])

    # and, for wines not in our lists yet (the LCBO, a new edition), every producer that scores well
    # above its prices across at least three reviews
    for key, rs in by.items():
        priced = [r for r in rs if r["price"]]
        if len(priced) >= 3 and st.mean(int(r["points"]) - expected(float(r["price"])) for r in priced) >= 2:
            keep.add(key)
    out = []
    for (name, ctry) in sorted(keep):
        rs = by[(name, ctry)]
        priced = [r for r in rs if r["price"]]
        labels = defaultdict(list)
        for r in priced:
            labels[(r["designation"].strip(), r["variety"].strip())].append(r)
        lab = []
        for (des, var), lr in labels.items():
            top = max(lr, key=lambda r: int(r["points"]) - expected(float(r["price"])))
            lab.append([des, var, int(top["points"]), round(float(top["price"])), round(int(top["points"]) - expected(float(top["price"])), 1)])
        lab.sort(key=lambda x: -x[4])
        value = st.mean(int(r["points"]) - expected(float(r["price"])) for r in priced) if priced else None
        out.append([name, ctry, len(rs), round(st.mean(int(r["points"]) for r in rs), 1),
                    round(st.median(float(r["price"]) for r in priced)) if priced else None,
                    round(value, 1) if value is not None else None, lab[:4]])
    OUT.write_text(json.dumps({
        "about": "Wine Enthusiast reviews summed up by producer: [name, country, reviews, average points, median price (USD), "
                 "value (points above what that price usually scores), best labels [name, grape, points, price, value]]. "
                 "No vintages: a producer's reputation, not a bottle's score.",
        "built": date.today().isoformat(),
        "baseline": [[round(p, 2), round(s, 2)] for p, s in base],
        "producers": out,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(rows)} unique reviews, {len(by)} producers, kept {len(out)}; {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
