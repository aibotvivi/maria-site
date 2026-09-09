#!/usr/bin/env python3
"""Refresh the stat strip on index.html from the bot's real database.

    python3 update-stats.py            # rewrite index.html in place
    python3 update-stats.py --check    # exit 1 if the page is stale, change nothing

The four numbers under the hero ("prices recorded and kept", "routes under
watch", "alerts sent", "watching since") are the site's proof that Maria is
real. They were typed in by hand on 2026-09-08 and were already wrong by the
9th: the page said 2,777 prices and 823 alerts against 2,796 and 831. A static
site cannot read a database at request time, so the honest alternative is to
make refreshing them one command and run it before every deploy.

Reads price_history.db read-only. Never touches the database.
"""

import os
import re
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(HERE, "index.html")
DB = os.path.expanduser("~/airfare-monitor/price_history.db")


def live():
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    prices = conn.execute("SELECT COUNT(*) FROM price_history").fetchone()[0]
    routes = conn.execute("SELECT COUNT(DISTINCT route_id) FROM price_history").fetchone()[0]
    alerts = conn.execute("SELECT COUNT(*) FROM alerts_log").fetchone()[0]
    first = conn.execute("SELECT MIN(checked_at) FROM price_history").fetchone()[0]
    conn.close()
    # "2 May" — day without a leading zero, month abbreviated, matching the copy.
    y, m, d = first[:10].split("-")
    since = f"{int(d)} " + ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][int(m) - 1]
    return {"prices": f"{prices:,}", "routes": f"{routes:,}", "alerts": f"{alerts:,}", "since": since}


def main():
    check = "--check" in sys.argv
    if not os.path.exists(DB):
        print(f"no database at {DB}", file=sys.stderr)
        return 2
    want = live()
    html = open(PAGE, encoding="utf-8").read()
    changed = []
    for key, val in want.items():
        pat = re.compile(r'(data-stat="%s">)([^<]*)(<)' % key)
        m = pat.search(html)
        if not m:
            print(f"no data-stat=\"{key}\" slot in index.html", file=sys.stderr)
            return 2
        if m.group(2) != val:
            changed.append(f"{key}: {m.group(2)} -> {val}")
            html = pat.sub(lambda mm: mm.group(1) + val + mm.group(3), html, count=1)
    if not changed:
        print("stats already current")
        return 0
    for c in changed:
        print("  " + c)
    if check:
        print("STALE — run without --check to update")
        return 1
    open(PAGE, "w", encoding="utf-8").write(html)
    print("index.html updated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
