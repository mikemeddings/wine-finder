"""Parsing tests for the Calgary retailers (ZYN, BSW Liquor), using small made-up products.

Run:  python -m pytest scripts -q
"""

import sys
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import src_shopify as S  # noqa: E402


def product(pid, title, price="20.00", available=True, product_type="", tags=(), variants=None, handle=None):
    return {
        "id": pid, "title": title, "handle": handle or f"p{pid}", "product_type": product_type,
        "tags": list(tags), "body_html": "<p>notes</p>", "images": [],
        "variants": variants or [{"title": "Default Title", "price": price, "available": available, "sku": str(pid)}],
    }


# ---- Shared helpers -------------------------------------------------------------------

def test_sizes_and_packs():
    assert S.size_from_text("Masi Amarone Costasera 2017 - 375 ml") == 375
    assert S.size_from_text("Chateau Pichon Baron 2015 - 1.5 Litre Bottle") == 1500
    assert S.size_from_text("Some Barolo Magnum") == 1500
    assert S.size_from_text("Plain wine 2020") is None
    assert S.multipack_from_title("Inniskillin Ice Wine 50 ml Mini - 3 x 50 ml Bottles") == 3
    assert S.pack_of("12 Pack") == 12 and S.pack_of("Default Title") == 1
    assert S.clean_title("Masi Amarone Costasera 2017 - 375 ml") == "Masi Amarone Costasera 2017"
    assert S.vintage_of("Chateau Margaux 2019") == 2019


def test_in_stock_variant_prefers_single_bottle():
    p = product(1, "X", variants=[
        {"title": "12 Pack", "price": "200", "available": True},
        {"title": "Default Title", "price": "20", "available": True},
    ])
    assert S.in_stock_variant(p)["price"] == "20"
    assert S.in_stock_variant(product(2, "Y", available=False)) is None


# ---- ZYN --------------------------------------------------------------------------------

def test_zyn_codes():
    assert S.zyn_code("C7-ITALY-RED") == ("Italy", "Red")
    assert S.zyn_code("C7-ARG-WHITE") == ("Argentina", "White")
    assert S.zyn_code("C7-NEW-ZEALAND") == ("New Zealand", None)
    assert S.zyn_code("C7-MOLDOVA") == ("Moldova", None)
    assert S.zyn_code("C7-PORT") == (None, "Fortified")
    assert S.zyn_code("C7-CELLAR") == (None, None)
    assert S.zyn_code("Bundles") == (None, None)


def test_normalise_zyn():
    wine = [
        product(1, "Chateau de Purcari 'Negru De Purcari' 2022", "53.00", product_type="C7-MOLDOVA"),
        product(2, "Castello di Verduno Pelaverga 2024", product_type="C7-FRANCE-RED"),  # mislabelled
        product(3, "Masi Amarone Costasera 2017 - 375 ml", product_type="C7-375ML-WINE"),
        product(4, "Sold out wine", product_type="C7-ITALY-RED", available=False),
        product(5, "Oyster Bay Chardonnay - Bundle & Save", product_type="Bundles"),
    ]
    sparkling = [product(6, "Bollinger Special Cuvee", "120.00", product_type="C7-CELLAR")]
    cols = {
        "wine": wine, "sparkling-wines": sparkling, "champagne": [],
        "red-wine": [{"id": 1}, {"id": 2}, {"id": 3}], "white-wine": [],
        "italy": [{"id": 2}, {"id": 3}], "france": [{"id": 6}],
        "90-wines": [{"id": 3}],
    }
    recs = {r["id"]: r for r in S.normalise_zyn(cols)}
    assert set(recs) == {"zyn-1", "zyn-2", "zyn-3", "zyn-6"}  # sold out and bundle dropped
    negru = recs["zyn-1"]
    assert (negru["source"], negru["country"], negru["type"], negru["price"], negru["vintage"]) == \
        ("ZYN", "Moldova", "Red", 53.0, 2022)
    assert negru["url"] == "https://zyn.ca/products/p1"
    assert recs["zyn-2"]["country"] == "Italy"  # collection beats the product-type label
    amarone = recs["zyn-3"]
    assert (amarone["name"], amarone["size_ml"], amarone["retailer_scores"]) == \
        ("Masi Amarone Costasera 2017", 375, "On ZYN's list of 90+ point wines under $35")
    assert (recs["zyn-6"]["type"], recs["zyn-6"]["country"]) == ("Sparkling", "France")  # from sparkling-wines


# ---- BSW ----------------------------------------------------------------------------------

def test_country_from_tags():
    negru_tags = ["750ml", "Cabernet Sauvignon", "Moldova", "Moldovian Red Wine", "Portugal", "Red Wine",
                  "Republic Of Moldova", "vivino", "Wine"]
    assert S.country_from_tags(negru_tags) == "Moldova"  # 3 votes beat a stray "Portugal"
    assert S.country_from_tags(["BRAND: TUSCANY", "COLOUR: RED"]) == "Italy"
    assert S.country_from_tags(["France", "United States"]) is None  # tie: don't guess
    assert S.country_from_tags(["clean", "vivino"]) is None


def test_size_from_tags():
    assert S.size_from_tags(["750ml"]) == 750
    assert S.size_from_tags(["SIZE: 1500"]) == 1500
    assert S.size_from_tags(["1.5L"]) == 1500
    assert S.size_from_tags(["750", "16", "0.1"]) is None  # bare numbers are other codes


def test_normalise_bsw():
    cols = {
        "red-wine": [
            product(10, "Chateau Purcari Negru de Purcari 2022", "49.99", product_type="Cabernet Sauvignon",
                    tags=["750ml", "Moldova", "Portugal", "Republic Of Moldova"]),
            product(11, "Fratelli Borgogno Barolo 2020", "60.00", tags=["France"]),  # tag wrong
            product(12, "Old Bordeaux", "30.00", tags=["BRAND: BORDEAUX", "SIZE: 750"]),
            product(13, "Gone", available=False),
        ],
        "champagne-sparkling": [product(14, "Cuvee de Purcari Brut", "47.00", tags=["Moldova"])],
        "white-wine": [], "rose-wine": [], "fortified-wine": [], "dessert-wine": [], "sake": [],
        "italian-wines": [{"id": 11}], "moldovan-wine": [{"id": 14}],
    }
    recs = {r["id"]: r for r in S.normalise_bsw(cols)}
    assert set(recs) == {"bsw-10", "bsw-11", "bsw-12", "bsw-14"}
    negru = recs["bsw-10"]
    assert (negru["source"], negru["country"], negru["type"], negru["size_ml"], negru["region_or_grape"]) == \
        ("BSW Liquor", "Moldova", "Red", 750, "Cabernet Sauvignon")
    assert recs["bsw-11"]["country"] == "Italy"  # country collection beats the tag
    assert recs["bsw-12"]["country"] == "France"
    assert recs["bsw-14"]["type"] == "Sparkling"
    assert negru["url"] == "https://www.bswliquor.com/products/p10"


# ---- Fetching -------------------------------------------------------------------------------

def test_fetch_collection_pages_and_cap(monkeypatch):
    monkeypatch.setattr(S.time, "sleep", lambda s: None)
    calls = []

    def fake_get(url):
        calls.append(url)
        page = int(url.rsplit("page=", 1)[1])
        return {"products": [product(page * 1000 + i, "W") for i in range(S.PAGE)] if page <= 3 else []}

    got = S.fetch_collection("https://x", "red-wine", get=fake_get)
    assert len(got) == 3 * S.PAGE and len(calls) == 4
    assert "body_html" not in got[0] and "images" not in got[0]

    calls.clear()
    S.fetch_collection("https://x", "big", get=lambda url: (calls.append(url), {"products": [product(1, "W")]})[1])
    assert len(calls) == S.SHOPIFY_CAP // S.PAGE  # stops at Shopify's 25,000 limit


def test_fetch_collection_missing_is_empty(monkeypatch):
    def gone(url):
        raise urllib.error.HTTPError(url, 404, "Not Found", None, None)
    assert S.fetch_collection("https://x", "no-such", get=gone) == []
