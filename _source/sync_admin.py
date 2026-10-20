"""Copy listings published in the admin panel into _source/data/opportunities.json.

The admin panel (admin.html) saves listings in the Supabase table public.opportunities. The site shows
published ones straight away (assets/js/live.js); this script makes them permanent, so build.py can give
each one its own static page, calendar entries, sitemap and RSS item.

- published rows are added, or replace the listing with the same slug
- removed rows take the listing with that slug off the site
- drafts are never read (the database only lets the public key read published and removed rows)

It only uses the public key in assets/js/config.js, so it needs no secrets.
Run it by hand with:  python3 _source/sync_admin.py   (then python3 _source/build.py)
The GitHub Action .github/workflows/publish-admin-listings.yml runs both every 30 minutes.
Python 3.9+, standard library only.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "_source", "data", "opportunities.json")
CATS = {"hackathons", "ctf", "internships", "scholarships", "events", "courses", "volunteering", "programs"}
REGIONS = {"nepal", "online", "abroad"}
BASES = {"open", "upcoming", "rolling", "recurring", "closed"}
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def config():
    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not (url and key):
        with open(os.path.join(ROOT, "assets", "js", "config.js"), encoding="utf-8") as f:
            src = f.read()
        u = re.search(r'supabaseUrl:\s*"([^"]*)"', src)
        k = re.search(r'supabaseKey:\s*"([^"]*)"', src) or re.search(r'supabaseAnonKey:\s*"([^"]*)"', src)
        url, key = url or (u.group(1) if u else ""), key or (k.group(1) if k else "")
    return url.rstrip("/"), key


def fetch(url, key):
    req = urllib.request.Request(
        f"{url}/rest/v1/opportunities?select=*&status=in.(published,removed)&order=slug",
        headers={"apikey": key, "Accept": "application/json", "User-Agent": "swabud-sync"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:300]
        if e.code in (400, 404) and ("PGRST205" in body or "does not exist" in body or "schema cache" in body):
            print("The admin tables aren't set up yet (run supabase/admin.sql). Nothing to sync.")
            return None
        raise SystemExit(f"Supabase answered {e.code}: {body}")


def entry(r):
    """A database row in the same shape as the listings in opportunities.json."""
    d = lambda v: v if isinstance(v, str) and DATE.match(v) else ""
    steps = r.get("steps") or []
    return {
        "slug": r["slug"], "title": (r.get("title") or "").strip(), "category": r.get("category"),
        "organizer": (r.get("organizer") or "").strip(), "summary": (r.get("summary") or "").strip(), "who": (r.get("who") or "").strip(),
        "mode": r.get("mode") or "Online", "location": (r.get("location") or "").strip(), "region": r.get("region") or "online",
        "dates": (r.get("dates") or "").strip(), "when": (r.get("when_text") or "").strip(),
        "start": d(r.get("start_date")), "end": d(r.get("end_date")), "deadline": d(r.get("deadline")), "opens": d(r.get("opens")),
        "base": r.get("base") or "open", "cost": (r.get("cost") or "").strip(), "free": bool(r.get("free")),
        "benefits": (r.get("benefits") or "").strip(), "level": (r.get("level") or "All levels").strip(), "link": (r.get("link") or "").strip(),
        "verified": d(r.get("verified")), "steps": [str(s).strip() for s in steps if str(s).strip()], "notes": (r.get("notes") or "").strip(),
    }


def problems(e):
    out = []
    if not SLUG.match(e["slug"] or ""): out.append("bad slug")
    if len(e["title"]) < 3: out.append("no title")
    if e["category"] not in CATS: out.append("unknown category")
    if e["region"] not in REGIONS: out.append("unknown region")
    if e["base"] not in BASES: out.append("unknown status")
    if not e["link"]: out.append("no link")
    if e["end"] and not e["start"]: e["start"] = e["end"]
    if e["start"] and not e["end"]: e["end"] = e["start"]
    if not e["dates"]:
        # listing pages show a dates line; write one when the panel left it empty
        e["dates"] = dates_text(e) or e["when"] or "Dates to be announced."
    return out


MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def fdate(s, year=True):
    y, m, d = (int(x) for x in s.split("-"))
    return f"{d} {MON[m - 1]}" + (f" {y}" if year else "")


def dates_text(e):
    out = []
    if e["start"]:
        if e["end"] and e["end"] != e["start"]:
            sy, sm, sd = e["start"].split("-"); ey, em, ed = e["end"].split("-")
            out.append(f"{int(sd)} to {fdate(e['end'])}" if (sy, sm) == (ey, em) else f"{fdate(e['start'], sy != ey)} to {fdate(e['end'])}")
        else:
            out.append(fdate(e["start"]))
    if e["opens"]: out.append(f"Applications open {fdate(e['opens'])}")
    if e["deadline"]: out.append(f"Apply by {fdate(e['deadline'])}, 11:59 PM Nepal time")
    return ". ".join(out) + "." if out else ""


def main():
    url, key = config()
    if not (url and key):
        print("Accounts aren't configured in assets/js/config.js, so there is nothing to sync.")
        return set_output(False)
    rows = fetch(url, key)
    if rows is None:
        return set_output(False)
    with open(DATA, encoding="utf-8") as f:
        raw = f.read()
    data = json.loads(raw)
    changes = []
    for r in rows:
        slug = r.get("slug")
        idx = next((i for i, o in enumerate(data) if o.get("slug") == slug), None)
        if r.get("status") == "removed":
            if idx is not None:
                data.pop(idx)
                changes.append(f"removed  {slug}")
            continue
        if r.get("status") != "published":
            continue
        e = entry(r)
        bad = problems(e)
        if bad:
            print(f"skipped  {slug}: {', '.join(bad)}")
            continue
        if idx is None:
            data.insert(0, e)
            changes.append(f"added    {slug}")
        elif data[idx] != e:
            data[idx] = e
            changes.append(f"updated  {slug}")
    if changes:
        with open(DATA, "w", encoding="utf-8") as f:
            f.write(json.dumps(data, indent=1, ensure_ascii=False))
        print("\n".join(changes))
    print(f"{len(rows)} admin listings checked, {len(changes)} change(s).")
    set_output(bool(changes))


def set_output(changed):
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as f:
            f.write(f"changed={'true' if changed else 'false'}\n")


if __name__ == "__main__":
    sys.exit(main())
