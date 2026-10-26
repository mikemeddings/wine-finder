"""Tests for the Weinshop365 reader (src_weinshop365.py), on made-up pages shaped like
the shop's: a schema.org Product block plus a <dt>/<dd> "Facts" table."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import src_weinshop365 as W  # noqa: E402

SITEMAP = """<?xml version="1.0"?><urlset>
<url><loc>https://weinshop365.ch/en/wein/ancora-rose-100068</loc><lastmod>2026-07-27T08:00:00Z</lastmod></url>
<url><loc>https://weinshop365.ch/en/wein/old-whisky-200001</loc><lastmod>2026-07-27T08:00:00Z</lastmod></url>
<url><loc>https://weinshop365.ch/fr/wein/ancora-rose-100068</loc><lastmod>2026-07-27T08:00:00Z</lastmod></url>
<url><loc>https://weinshop365.ch/en/weinwelten/stories</loc></url>
</urlset>"""


def page(name, sku, wine_type, price, availability="InStock", was=None, vintage="2025", size="75cl"):
    offer = {"@type": "Offer", "price": price, "priceCurrency": "CHF", "availability": f"https://schema.org/{availability}"}
    if was:
        offer["priceSpecification"] = {"priceType": "https://schema.org/StrikethroughPrice", "price": was}
    product = {"@context": "https://schema.org", "@type": "Product", "name": name, "sku": sku,
               "brand": {"name": "Cave de Jolimont"}, "countryOfOrigin": "Switzerland", "offers": offer}
    facts = {"Article number": sku, "Wine type": wine_type, "Vintage": vintage, "Country": "Switzerland",
             "Region": "Waadt - La Côte", "Producer": "Cave de Jolimont", "Grape varieties": "Gamay", "Bottle size": size}
    dl = "".join(f'<div class="grid"><dt class="font-medium">{k}</dt><dd class="text-ink">{v}</dd></div>' for k, v in facts.items())
    return f'<html><script type="application/ld+json">{json.dumps(product)}</script><dl>{dl}</dl></html>'


ROSE = page("Ancora Rosé VdP Suisse", "100068", "Rosé wine", 13.2, was=15.5)
URL = "https://weinshop365.ch/en/wein/ancora-rose-100068"


def test_sitemap_keeps_english_wine_pages_only():
    assert W.sitemap_pages(SITEMAP) == [
        (URL, "2026-07-27T08:00:00Z"),
        ("https://weinshop365.ch/en/wein/old-whisky-200001", "2026-07-27T08:00:00Z")]


def test_a_wine_page():
    r = W.parse_page(ROSE, URL, "2026-07-27", 1.7)
    assert (r["id"], r["name"], r["producer"], r["type"], r["vintage"]) == (
        "w365-100068", "Ancora Rosé VdP Suisse", "Cave de Jolimont", "Rosé", 2025)
    assert (r["region"], r["grape"], r["country"], r["size_ml"]) == ("Waadt - La Côte", "Gamay", "Switzerland", 750)
    assert (r["price_local"], r["price_was"], r["price"], r["vat"], r["currency"]) == (13.2, 15.5, 22.44, "incl", "CHF")


def test_spirits_alcohol_free_and_sold_out_are_left_out():
    assert W.parse_page(page("Old Whisky", "200001", "Whisky", 80), URL, None, 1.7) is None
    assert W.parse_page(page("Free Rouge", "200002", "Alcohol-free wine", 12), URL, None, 1.7) is None
    assert W.parse_page(page("Gone", "200003", "Red wine", 20, availability="OutOfStock"), URL, None, 1.7) is None


def test_order_items_are_kept_and_flagged():
    r = W.parse_page(page("Ordered", "200004", "Red wine", 20, availability="BackOrder"), URL, None, 1.7)
    assert r["type"] == "Red" and r["order_item"] is True


def test_types_and_sizes():
    assert [W.wine_type(t) for t in ["Red wine", "White wine", "Sparkling wine", "Port wine", "Sweet wine"]] == [
        "Red", "White", "Sparkling", "Fortified", "Dessert"]
    assert (W.size_ml("37.5cl"), W.size_ml("150cl"), W.size_ml("")) == (375, 1500, None)


def test_unchanged_pages_are_not_read_again_but_get_todays_rate():
    rate = json.dumps({"observations": [{"d": "2026-11-02", "FXCHFCAD": {"v": "2.0"}}]}).encode()
    calls = []

    def get(url):
        calls.append(url)
        if "bankofcanada" in url:
            return rate
        if url.endswith("sitemap.xml"):
            return SITEMAP.encode()
        return page("Old Whisky", "200001", "Whisky", 80).encode()

    previous = [W.parse_page(ROSE, URL, "2026-07-27T08:00:00Z", 1.7)]
    records, extras = W.fetch(previous, get=get, delay=0, log=lambda *a: None)
    assert [r["id"] for r in records] == ["w365-100068"]
    assert records[0]["price"] == 26.4  # CHF 13.20 at the new rate
    assert URL not in calls  # unchanged page: not read again
    assert extras["fx"]["CAD_per_CHF"] == 2.0


def crumbs(category, name="A wine"):
    items = [{"@type": "ListItem", "position": i + 1, "name": n} for i, n in enumerate(["Home", "Wines", category, name])]
    return f'<script type="application/ld+json">{json.dumps({"@type": "BreadcrumbList", "itemListElement": items})}</script>'


def test_pages_without_a_wine_type_use_the_menu_trail():
    port = page("20 Years Old Tawny Port", "180298", "", 49).replace("<dl>", crumbs("Port wines") + "<dl>")
    magnum = page("Aalto Magnum", "106533", "", 99, size="150cl").replace("Gamay", "Tinto Fino").replace("<dl>", crumbs("Large formats") + "<dl>")
    gin = page("Aare Gin", "10257047", "", 45).replace("<dl>", crumbs("Spirits") + "<dl>")
    assert W.parse_page(port, URL, None, 1.7)["type"] == "Fortified"
    assert W.parse_page(magnum, URL, None, 1.7)["type"] == "Red"
    assert W.parse_page(gin, URL, None, 1.7) is None


def test_sweet_wines_filed_as_white_become_dessert():
    sweet = page("Beerenauslese Cuvée - Tschida (Süsswein)", "300001", "White wine", 39, size="37.5cl")
    assert W.parse_page(sweet, URL, None, 1.7)["type"] == "Dessert"
