"""Refresh the wine lists in data/ and data/meta.json from all sources.

Usage:
    python scripts/refresh.py                     # all stores (about 8 minutes: the retailers are read politely)
    python scripts/refresh.py --local FILE        # BC from a CSV already on disk
    python scripts/refresh.py --skip-retailers    # BC only
    python scripts/refresh.py --only zyn          # one store: bcl, zyn, bsw or luc
    python scripts/refresh.py --scheduled         # only the stores due this month (the monthly GitHub run)

Each store has its own file (BC: wines.json, ZYN: wines-zyn.json, BSW: wines-bsw.json),
named in meta.json as data_file so the page can load the Calgary lists only when needed.
A source that fails keeps its previous records and is marked failed in meta.json, so
the rest of the site keeps working. Files are rewritten only when their content changes.
"""

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import src_bcl  # noqa: E402
import src_lucullus  # noqa: E402
import src_shopify  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
ARCHIVE = DATA / "archive"
META = DATA / "meta.json"


def _load(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def _write_if_changed(path, obj, compact=False):
    if compact and isinstance(obj, list):  # one wine per line: small, readable diffs in git history
        text = "[\n" + ",\n".join(json.dumps(o, ensure_ascii=False, separators=(",", ":")) for o in obj) + "\n]"
    elif compact:
        text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    else:
        text = json.dumps(obj, ensure_ascii=False, indent=2)
    text += "\n"
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return False
    path.write_text(text, encoding="utf-8")
    return True


def refresh_bcl(local=None):
    """Return (records, meta_entry). Raises on failure."""
    if local:
        local = Path(local)
        raw = local.read_bytes()
        info = {"file": local.name, "edition": src_bcl.edition_from_name(local.name)[0],
                "url": None, "last_modified": None}
    else:
        info = src_bcl.discover()
        raw = src_bcl.download(info["url"])

    ARCHIVE.mkdir(parents=True, exist_ok=True)
    archived = ARCHIVE / info["file"]
    if not archived.exists() or archived.read_bytes() != raw:
        archived.write_bytes(raw)

    prev = src_bcl.previous_edition(ARCHIVE, info["file"])
    prev_skus = src_bcl.wine_skus(prev.read_bytes()) if prev else None
    records = src_bcl.normalise(raw, prev_skus)
    if len(records) < 1000:
        raise ValueError(f"only {len(records)} wine rows parsed; refusing to replace data")
    return records, {
        "status": "ok",
        "edition": info["edition"],
        "file": info["file"],
        "source_last_modified": info["last_modified"],
        "compared_with": prev.name if prev else None,
        "count": len(records),
    }


MIN_RECORDS = {"BC Liquor": 1000, "ZYN": 1000, "BSW Liquor": 3000, "Lucullus": 2000}  # fewer means a broken feed


def refresh_shopify(name, fetch):
    records = fetch()
    if len(records) < MIN_RECORDS[name]:
        raise ValueError(f"only {len(records)} wines parsed; refusing to replace data")
    return records, {"status": "ok", "edition": None, "count": len(records),
                     "note": "in-stock wines from the store's online catalogue"}


def refresh_lucullus():
    records, extras = src_lucullus.fetch()
    if len(records) < MIN_RECORDS["Lucullus"]:
        raise ValueError(f"only {len(records)} wines parsed; refusing to replace data")
    return records, {"status": "ok", "count": len(records), **extras}


# (key, source name, data file, refresh function, months between scheduled refreshes)
# Quarterly sources run in Jan, Apr, Jul and Oct (BC publishes about quarterly); monthly ones every month.
SOURCES = [
    ("bcl", src_bcl.SOURCE, "wines.json", lambda args: refresh_bcl(args.local), 3),
    ("zyn", src_shopify.ZYN_SOURCE, "wines-zyn.json", lambda args: refresh_shopify("ZYN", src_shopify.fetch_zyn), 3),
    ("bsw", src_shopify.BSW_SOURCE, "wines-bsw.json",
     lambda args: refresh_shopify("BSW Liquor", src_shopify.fetch_bsw), 3),
    ("luc", src_lucullus.SOURCE, "wines-lucullus.json", lambda args: refresh_lucullus(), 1),
]


def due(every, month):
    """A source refreshed every `every` months is due in Jan, and every `every` months after."""
    return (month - 1) % every == 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--local", help="path to a BC price-list CSV to use instead of downloading")
    ap.add_argument("--skip-retailers", action="store_true", help="refresh BC only")
    ap.add_argument("--only", choices=[k for k, *_ in SOURCES], help="refresh just this store")
    ap.add_argument("--scheduled", action="store_true", help="refresh only the stores due this month")
    args = ap.parse_args(argv)

    DATA.mkdir(exist_ok=True)
    old_meta = _load(META, {"sources": {}})
    meta_sources = dict(old_meta.get("sources", {}))
    today = dt.date.today().isoformat()
    ran_ok = True

    for key, name, file, fn, every in SOURCES:
        if (args.only and key != args.only) or (args.skip_retailers and key != "bcl") or                 (args.scheduled and not due(every, dt.date.today().month)):
            continue  # untouched: previous file and meta entry stay as they are
        path = DATA / file
        old_records = _load(path, [])
        prev_entry = meta_sources.get(name, {})
        try:
            records, entry = fn(args)
            print(f"{name}: {entry['count']} wines" + (f" ({entry['edition']})" if entry.get("edition") else ""))
        except Exception as e:  # keep the previous data for this source
            records = old_records
            entry = {**prev_entry, "status": "failed", "message": f"{type(e).__name__}: {e}"}
            ran_ok = False
            print(f"{name}: FAILED - {e}; keeping {len(records)} previous records", file=sys.stderr)
        records = sorted(records, key=lambda w: (w["sku"], w["id"]))
        entry["data_file"] = file
        entry["refreshed"] = (prev_entry.get("refreshed") or today) if records == old_records else today
        meta_sources[name] = entry
        if records:
            changed = _write_if_changed(path, records, compact=True)
            print(f"  {file} {'updated' if changed else 'unchanged'} ({len(records)} records)")

    meta_changed = _write_if_changed(META, {"sources": meta_sources})
    print(f"meta.json {'updated' if meta_changed else 'unchanged'}")
    return 0 if ran_ok else 1


if __name__ == "__main__":
    sys.exit(main())
