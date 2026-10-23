"""Known-answer tests against the July 2026 BC Liquor price list (brief §9).

Run:  python -m pytest scripts -q
The tests use the CSV in data/archive/ (written by refresh.py), or the
reference copy in "Latest BC Product List/" when that exists locally.
"""

import json
import sys
import unicodedata
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import src_bcl  # noqa: E402

JULY_2026 = "bc_liquor_store_product_price_list_july_2026.csv"
CANDIDATES = [ROOT / "data" / "archive" / JULY_2026, ROOT / "Latest BC Product List" / JULY_2026]


@pytest.fixture(scope="module")
def wines():
    for p in CANDIDATES:
        if p.exists():
            return src_bcl.normalise(p.read_bytes())
    pytest.skip("July 2026 BC CSV not available")


# --- Python mirror of the page's filter rules (index.html) -----------------

def fold(s):
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


def search(wines, text):
    words = fold(text).split()
    return [w for w in wines
            if all(t in fold(" ".join(filter(None, [w["name"], w["producer"], w["region_or_grape"]])))
                   for t in words)]


SWEET_BANDS = {"Dry": (0, 1), "Off-dry": (2, 4), "Medium-sweet": (5, 7), "Sweet": (8, 10)}


def sweet_filter(wines, bands, include_not_rated=True):
    def ok(w):
        if w["sweetness"] is None:
            return include_not_rated
        return any(lo <= w["sweetness"] <= hi for lo, hi in (SWEET_BANDS[b] for b in bands))
    return [w for w in wines if ok(w)]


def by(wines, **kw):
    return [w for w in wines if all(w[k] == v for k, v in kw.items())]


# --- Parsing ----------------------------------------------------------------

def test_wine_count_and_unique_skus(wines):
    assert len(wines) == 5957
    assert len({w["sku"] for w in wines}) == len(wines)
    assert len({w["id"] for w in wines}) == len(wines)


def test_record_shape(wines):
    keys = {"id", "source", "name", "name_raw", "producer", "region_or_grape", "vintage", "country",
            "type", "size_ml", "pack", "abv", "price", "sweetness", "sku", "url", "available",
            "retailer_scores", "new_since_last"}
    for w in wines:
        assert set(w) == keys
        assert w["source"] == "BC Liquor"
        assert w["price"] and w["price"] > 0
        assert w["size_ml"] and w["size_ml"] > 0
        assert w["type"] in {"Red", "White", "Rosé", "Sparkling", "Fortified", "Dessert", "Sake", "Other"}


def test_no_unknown_types_or_shouty_countries(wines):
    assert all(w["country"] != w["country"].upper() or w["country"] == "USA" for w in wines)
    assert "Other" not in {w["type"] for w in wines if w["country"] in ("France", "Italy", "Spain")}


def test_margaux_example(wines):
    w = by(wines, sku="203174")[0]
    assert w["name"] == "Margaux - Chateau Margaux 2014"
    assert w["producer"] == "Chateau Margaux"
    assert w["region_or_grape"] == "Margaux"
    assert w["vintage"] == 2014 and w["country"] == "France" and w["type"] == "Red"
    assert w["size_ml"] == 750 and w["price"] == 880.0 and w["sweetness"] == 0


def test_display_name():
    assert src_bcl.display_name("BLANDY'S - SERCIAL 2002") == "Blandy's - Sercial 2002"
    assert src_bcl.display_name("CHIANTI CLASSICO DOCG - X") == "Chianti Classico DOCG - X"
    assert src_bcl.display_name("CHATEAU COS D'ESTOURNEL") == "Chateau Cos D'Estournel"
    assert src_bcl.display_name("DOURO - QUINTA DO VALE MEAO 2020") == "Douro - Quinta Do Vale Meao 2020"


def test_country_names():
    assert src_bcl.country_name("UNITED STATES OF AMERICA") == "USA"
    assert src_bcl.country_name("KOREA - SOUTH") == "South Korea"
    assert src_bcl.country_name("NEW ZEALAND") == "New Zealand"


def test_types():
    assert src_bcl.wine_type("Portugal Rose Wine") == "Rosé"  # not "Port"
    assert src_bcl.wine_type("Port Wine") == "Fortified"
    assert src_bcl.wine_type("Other Fortified Import Wine") == "Fortified"
    assert src_bcl.wine_type("Prosecco Wine") == "Sparkling"
    assert src_bcl.wine_type("France Champagne Wine") == "Sparkling"
    assert src_bcl.wine_type("Canada - BC Ice Wine") == "Dessert"
    assert src_bcl.wine_type("Hungary Fruit and Dessert Wine") == "Dessert"
    assert src_bcl.wine_type("Japan Sake") == "Sake"


def test_blandys_sercial_is_fortified(wines):
    assert [w["type"] for w in search(wines, "blandy's sercial")] == ["Fortified"]


def test_edition_from_name():
    assert src_bcl.edition_from_name(JULY_2026) == ("July 2026", (2026, 7))


# --- Known answers (§9) -------------------------------------------------------

def test_georgia(wines):
    got = {(w["name"], w["price"]) for w in by(wines, country="Georgia")}
    assert got == {
        ("Saperavi - Godori", 17.49),
        ("Pirosmani - Godori Semi Dry", 17.49),
        ("Kindzmarauli - Tetri", 20.99),
        ("Kisi Khihvi Qvevri Amber Dry Wine - Chateau Nekresi 2016", 25.99),
    }


def test_montenegro(wines):
    got = by(wines, country="Montenegro")
    assert [(w["name"], w["price"]) for w in got] == [("Vranac - Plantaze", 14.99)]
    assert search(wines, "Plantaže") == got  # accent-insensitive


def test_moldova_absent(wines):
    assert by(wines, country="Moldova") == []


def test_tokaj(wines):
    got = search(wines, "tokaj")
    assert len(got) == 7
    names = " | ".join(w["name"] for w in got)
    assert "Tokaji Aszu 5 Puttonyos - Chateau Dereszla" in names
    assert "Tokaji Aszu 6 Puttonyos - Chateau Dereszla" in names


def test_musar(wines):
    assert [(w["vintage"], w["price"]) for w in by(wines, country="Lebanon")] == [(2015, 79.99)]


def test_don_melchor(wines):
    assert [(w["country"], w["price"]) for w in search(wines, "Don Melchor Puente Alto")] == [("Chile", 225.99)]


def test_greece(wines):
    assert search(wines, "Assyrtiko") == []
    assert [w["price"] for w in search(wines, "Boutari Naoussa")] == [23.99]


def test_portugal_count(wines):
    assert 100 <= len(by(wines, country="Portugal")) <= 108


def test_sweetness_filter_keeps_not_rated(wines):
    dry = sweet_filter(wines, ["Dry"], include_not_rated=True)
    assert any(w["sweetness"] is None for w in dry)
    assert all(w["sweetness"] is None or w["sweetness"] <= 1 for w in dry)
    dry_only = sweet_filter(wines, ["Dry"], include_not_rated=False)
    assert all(w["sweetness"] is not None for w in dry_only)
    assert len(dry) - len(dry_only) == sum(w["sweetness"] is None for w in wines)


def test_mateus_sizes(wines):
    mateus = search(wines, "mateus")
    assert len({w["size_ml"] for w in mateus}) >= 2
    bottles = [w for w in mateus if w["size_ml"] == 750]
    assert [(w["type"], w["price"]) for w in bottles] == [("Rosé", 12.99)]


def test_portugal_reds_preset_non_empty(wines):
    got = [w for w in by(wines, country="Portugal", type="Red", size_ml=750) if 20 <= w["price"] <= 50]
    assert got


# --- Generated files ------------------------------------------------------------

def test_generated_files_match_parser():
    wines_path, meta_path = ROOT / "data" / "wines.json", ROOT / "data" / "meta.json"
    if not wines_path.exists():
        pytest.skip("run scripts/refresh.py first")
    data = json.loads(wines_path.read_text(encoding="utf-8"))
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    bc = meta["sources"]["BC Liquor"]
    assert bc["status"] == "ok"
    assert bc["count"] == sum(w["source"] == "BC Liquor" for w in data)
    assert bc["edition"] and bc["refreshed"]
