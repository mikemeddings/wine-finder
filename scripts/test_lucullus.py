"""Tests for the Lucullus price-list reader (src_lucullus.py), on a small made-up sheet
shaped like the real one: a header row, then heading rows (type, country, region)
above each block of wines."""

import datetime as dt
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import src_lucullus as L  # noqa: E402

ROWS = [
    (dt.datetime(2026, 10, 14, 10, 36), None, None, None, None, None, None, None),
    ("Preisliste", None, None, None, None, None, None, None),
    ("Art.-Nr.", "Erzeuger", "Bezeichnung", "Einheit cl", "Jg", "Lager", "CHF/Fl.", None),
    (None, None, None, None, None, None, None, None),
    (None, "Armagnac", None, None, None, None, None, None),
    (None, "Frankreich", None, None, None, None, None, None),
    (None, "Armagnac", None, None, None, None, None, None),
    ("n15998", "Samalens", "Bas-Armagnac 1888 - TS Samalens", 70, "1888", 1, 1327, None),
    (None, "Champagner", None, None, None, None, None, None),
    (None, "Frankreich", None, None, None, None, None, None),
    (None, "Champagne", None, None, None, None, None, None),
    ("n30561", "Laurent-Perrier", "Grand Siècle No. 26 N.V. Champagne Laurent-Perrier", 75, "N.V.", 39, 165, "Neu"),
    (None, "Rotweine", None, None, None, None, None, None),
    (None, "Frankreich", None, None, None, None, None, None),
    (None, "Côte du Rhône", None, None, None, None, None, None),
    ("n3693", "Usseglio Pierre", "CNDP Cuvée de mon Aieul 2000 AC, MO, Pierre Usseglio", 75, "2000", 42, 75, None),
    ("n0000", "Nobody", "A wine with no price", 75, "2000", 0, 0, None),
    (None, "Australien", None, None, None, None, None, None),
    (None, "Südaustralien", None, None, None, None, None, None),
    ("n13565", "Penfolds", "Grange Hermitage BIN 95 2006 Penfolds MO, Barossa Valley", 150, "2006", 0, 772, None),
]


def wines():
    return {w["sku"]: w for w in L.normalise(ROWS, 1.7)}


def test_spirits_and_unpriced_rows_are_left_out():
    assert set(wines()) == {"n30561", "n3693", "n13565"}


def test_types_countries_and_regions_come_from_headings():
    w = wines()
    assert (w["n30561"]["type"], w["n30561"]["country"], w["n30561"]["region_or_grape"]) == ("Sparkling", "France", "Champagne")
    assert (w["n3693"]["type"], w["n3693"]["country"], w["n3693"]["region_or_grape"]) == ("Red", "France", "Rhône")
    assert (w["n13565"]["type"], w["n13565"]["country"], w["n13565"]["region_or_grape"]) == ("Red", "Australia", "South Australia")


def test_prices_sizes_vintages_and_stock():
    w = wines()["n13565"]
    assert (w["price_local"], w["currency"], w["vat"], w["price"]) == (772, "CHF", "excl", 1312.4)
    assert (w["size_ml"], w["vintage"], w["stock"], w["available"]) == (1500, 2006, 0, False)
    assert wines()["n30561"]["vintage"] is None  # N.V.


def test_cndp_is_spelled_out_and_links_open_the_wine():
    w = wines()["n3693"]
    assert w["name"].startswith("Châteauneuf-du-Pape Cuvée de mon Aieul 2000")
    assert w["url"] == "https://www.lucullus.ch/en/search?search=n3693"


def test_new_flag_and_list_date():
    assert wines()["n30561"]["new_since_last"] is True
    assert wines()["n3693"]["new_since_last"] is False
    assert L.list_date(ROWS) == "2026-10-14"


def test_chf_rate_reads_the_bank_of_canada_reply():
    reply = {"observations": [{"d": "2026-10-23", "FXCHFCAD": {"v": "1.6969"}}]}
    assert L.chf_rate(lambda url: json.dumps(reply).encode()) == (1.6969, "2026-10-23")
