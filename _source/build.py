#!/usr/bin/env python3
"""Builds the SWABUD static site from _source/data/*.json.

Usage (from the site folder):  python3 _source/build.py
Edit opportunities in _source/data/opportunities.json, then run this again.
"""
import json, os, datetime, calendar
from html import escape as e
from urllib.parse import quote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "_source", "data")
# Deadlines are treated as 11:59:59 PM Nepal time (UTC+5:45) on the given day.
NPT = datetime.timezone(datetime.timedelta(hours=5, minutes=45))
NOW = datetime.datetime.now(NPT)
BUILD_DATE = NOW.date()

SITE = {
    "url": "https://swabud.tech",
    "name": "SWABUD",
    "email": "info@swabud.tech",
    "tagline": "Discover. Connect. Grow.",
    "social": [
        ("Instagram", "https://www.instagram.com/swabud.tech/", "instagram", "@swabud.tech"),
        ("LinkedIn", "https://www.linkedin.com/company/swabud/", "linkedin", "SWABUD"),
        ("Facebook", "https://www.facebook.com/swabud.tech", "facebook", "SWABUD"),
    ],
}

CATS = [
    ("hackathons", "Hackathons & Competitions", "Hackathons", "Hackathons, coding contests and startup competitions", "trophy"),
    ("ctf", "CTFs & Security Challenges", "CTFs", "Capture-the-flag contests and legal hacking practice", "shield"),
    ("internships", "Internships & Fellowships", "Fellowships", "Paid internships, fellowships and mentorships", "briefcase"),
    ("scholarships", "Scholarships", "Scholarships", "Funded study in Nepal and abroad", "globe"),
    ("events", "Events & Conferences", "Events", "Conferences, meetups and workshops", "mic"),
    ("courses", "Courses & Certifications", "Courses", "Free courses and certificates", "book"),
    ("volunteering", "Volunteering", "Volunteering", "Give your skills to causes and communities", "heart"),
    ("programs", "Student Programs & Perks", "Programs", "Clubs, ambassador programmes and free student tools", "users"),
]
CAT = {c[0]: c for c in CATS}
LABELS = {"open": "Open", "closing": "Closing soon", "live": "Happening now", "upcoming": "Upcoming", "rolling": "Always open", "recurring": "Opens yearly", "closed": "Closed"}
REGIONS = {"nepal": "In Nepal", "online": "Online", "abroad": "Abroad"}
RANK = {"closing": 0, "live": 1, "open": 2, "rolling": 3, "upcoming": 4, "recurring": 5, "closed": 6}

FONTS = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Manrope:wght@400;500;600;700;800&family=Unbounded:wght@500;600;700&display=swap"

# ---------------------------------------------------------------- icons
ICONS = {
    "search": '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    "calendar": '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    "pin": '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
    "users": '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.6-3.2 3.1-5 6-5s5.4 1.8 6 5"/><circle cx="17" cy="9.5" r="2.4"/><path d="M16.5 14.6c2.3.1 4 1.6 4.5 4.4"/>',
    "coin": '<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.3c-.5-.9-1.6-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2s1.1 1.7 2.8 2.1 2.9.9 2.9 2.1-1.3 2-2.9 2c-1.3 0-2.4-.6-2.9-1.5M12 6v1.9M12 16.1V18"/>',
    "gift": '<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5v7.5h14v-7.5M12 8.5V20M12 8.5c-1.5-3.5-5.5-4-5.5-1.5 0 1.3 1.9 1.5 5.5 1.5zM12 8.5c1.5-3.5 5.5-4 5.5-1.5 0 1.3-1.9 1.5-5.5 1.5z"/>',
    "check": '<circle cx="12" cy="12" r="8.5"/><path d="m8.3 12.3 2.4 2.4 5-5.2"/>',
    "shield": '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.2 2.2 4.3-4.5"/>',
    "external": '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    "arrow": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "trophy": '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5c0 3 1.5 4.5 3.7 4.8M16 6h3.5c0 3-1.5 4.5-3.7 4.8M12 13v3.5M8.5 20h7M9.5 20c0-2 1-3.5 2.5-3.5s2.5 1.5 2.5 3.5"/>',
    "briefcase": '<rect x="3.5" y="7" width="17" height="12.5" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17"/>',
    "globe": '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5S9.5 6.1 12 3.5z"/>',
    "mic": '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5M9 20.5h6"/>',
    "book": '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
    "heart": '<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/>',
    "code": '<path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15"/>',
    "chart": '<path d="M4 19.5h16M6.5 16l4-5 3 3 4.5-6.5"/><circle cx="18" cy="7.5" r="1.3"/>',
    "terminal": '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="m7 9.5 3 2.5-3 2.5M12.5 15h4.5"/>',
    "cloud": '<path d="M7.5 18.5a4.5 4.5 0 0 1-.6-9 5.5 5.5 0 0 1 10.6 1.4 3.8 3.8 0 0 1-.5 7.6z"/>',
    "pen": '<path d="M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.9 0l.5.5a2 2 0 0 1 0 2.9L8.6 18.8z"/><path d="m13.5 7 3.5 3.5"/>',
    "menu": '<path d="M4 7h16M4 12h16M4 17h16"/>',
    "mail": '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m4 7.5 8 6 8-6"/>',
    "clock": '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    "alert": '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    "flag": '<path d="M5 21V4.5M5 4.5h11l-1.8 4 1.8 4H5"/>',
    "bookmark": '<path d="M6.5 4h11v16.5L12 16.8l-5.5 3.7z"/>',
    "share": '<circle cx="17.5" cy="5.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/><path d="m8.7 10.8 6.6-4M8.7 13.2l6.6 4"/>',
    "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
    "moon": '<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>',
    "rss": '<path d="M5 19a1 1 0 1 0 0 .1M5 11a8 8 0 0 1 8 8M5 5a14 14 0 0 1 14 14"/>',
    "compass": '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    "send": '<path d="M20.5 3.5 3.5 10.5l7 3 3 7z"/><path d="m10.5 13.5 4-4"/>',
    "instagram": '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="0.9" class="icon-fill"/>',
    "linkedin": '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 10.5V16.5M8 7.6v.2M11.5 16.5v-6M11.5 13c0-1.6 1.1-2.6 2.4-2.6s2.1.9 2.1 2.6v3.5"/>',
    "facebook": '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M15.5 8h-1.8c-1.2 0-1.9.7-1.9 1.9v10.6M9.6 12.7h5"/>',
    "whatsapp": '<path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.4 18.6z"/><path d="M9.2 8.8c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.6 1.4c.1.2 0 .4-.1.6l-.4.5c.6 1.1 1.4 1.9 2.5 2.5l.5-.4c.2-.2.4-.2.6-.1l1.4.6c.3.1.4.3.4.5v.5c0 .3 0 .6-.5.8-1.6.8-6.6-2.6-6.3-6.3z" class="icon-fill"/>',
    "x": '<path d="M5 4.5h3.6l10.4 15H15.4zM18.6 4.5 13.2 10.6M5.4 19.5l5.4-6.1"/>',
    "user": '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.9-3.9 3.9-6 7.5-6s6.6 2.1 7.5 6"/>',
    "lock": '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2"/>',
    "logout": '<path d="M14.5 4.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3M10 16.5 5.5 12 10 7.5M5.5 12H15"/>',
    "settings": '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6"/>',
    "eye": '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    "list": '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1" class="icon-fill"/><circle cx="4.8" cy="12" r="1" class="icon-fill"/><circle cx="4.8" cy="17.5" r="1" class="icon-fill"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "close": '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    "download": '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
    "spark": '<path d="M12 3.5 13.8 10.2 20.5 12l-6.7 1.8L12 20.5l-1.8-6.7L3.5 12l6.7-1.8z"/>',
    "handshake": '<path d="m3 11 3.5-3.5 4 1.5 2-1.5 5 0L21 11M3 11l4.5 5 2 .2 1.5 1.8 2 .2 1.5-1.2 1.5.5 2-1.8L21 11M10.5 9l-2.5 3c.8.8 2.2.8 3 0l1.6-1.6"/>',
}

GOOGLE_G = ('<svg class="g-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>'
            '<path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>'
            '<path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>'
            '<path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>')

def sprite():
    return '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' + "".join(
        f'<symbol id="i-{k}" viewBox="0 0 24 24">{v}</symbol>' for k, v in ICONS.items()) + "</svg>"

def icon(name, cls="icon"):
    return f'<svg class="{cls}" aria-hidden="true"><use href="#i-{name}"/></svg>'

# ---------------------------------------------------------------- helpers
def d(s):
    return datetime.date.fromisoformat(s) if s else None

def fdate(s, year=True):
    x = d(s)
    if not x: return ""
    return f"{x.day} {x.strftime('%b')}" + (f" {x.year}" if year else "")

def sod(s):
    x = d(s)
    return datetime.datetime(x.year, x.month, x.day, tzinfo=NPT) if x else None

def eod(s):
    x = d(s)
    return datetime.datetime(x.year, x.month, x.day, 23, 59, 59, tzinfo=NPT) if x else None

def phase(o, now=None):
    """Status engine. Mirrored exactly in assets/js/main.js (phase()).
    Returns (status, target datetime or None, verb, text when there is no target)."""
    now = now or NOW
    base = o["base"]
    if base == "closed": return ("closed", None, "", "")
    op = sod(o.get("opens", ""))
    if op and now < op: return ("upcoming", op, "Opens", "")
    if op and base == "upcoming": base = "open"
    dl, st = eod(o["deadline"]), sod(o["start"])
    en = eod(o["end"] or o["start"])
    if dl:
        if now > dl:
            if st and st <= now <= en: return ("live", en, "Ends", "")
            return ("closed", None, "", "Ended" if en and now > en else "Applications closed")
        if (dl - now).total_seconds() <= 7 * 86400: return ("closing", dl, "Closes", "")
        return ("upcoming" if base == "upcoming" else "open", dl, "Closes", "")
    if st:
        if now < st: return (base, st, "Starts", "")
        if now <= en: return ("live", en, "Ends", "")
        return ("closed", None, "", "Ended")
    return (base, None, "", "")

def span_text(secs):
    days = int(secs // 86400)
    if days >= 1: return f"{days} day{'s' if days != 1 else ''}"
    if secs >= 3600:
        h = int(secs // 3600); return f"{h} hour{'s' if h != 1 else ''}"
    return f"{max(1, int(secs // 60))} min"

def status_now(o, now=None):
    return phase(o, now)[0]

def countdown(o, now=None):
    now = now or NOW
    s, target, verb, done = phase(o, now)
    if not target: return done
    return f"{verb} in {span_text((target - now).total_seconds())}"

def mode_key(m):
    m = m.lower()
    if "online" in m and "person" in m: return "both"
    return "online" if "online" in m else "inperson"

def is_internal(url):
    return not url.startswith("http")

def data_attrs(o):
    return f'data-opp data-base="{o["base"]}" data-opens="{o.get("opens", "")}" data-deadline="{o["deadline"]}" data-start="{o["start"]}" data-end="{o["end"]}"'

def pill(o):
    s = status_now(o)
    return f'<span class="pill" data-status="{s}">{LABELS[s]}</span>'

def ext(url, text, cls=""):
    c = f' class="{cls}"' if cls else ""
    return f'<a{c} href="{e(url)}" target="_blank" rel="noopener noreferrer">{text}</a>'

def domain(url):
    return url.split("//", 1)[-1].split("/", 1)[0].replace("www.", "")

def key_date(o):
    s, target, verb, done = phase(o)
    if target: return target.date().isoformat(), verb
    if o["deadline"]: return o["deadline"], "Closed"
    if o["start"]: return o["start"], "Started"
    return "", ""

def short_when(o):
    st, en, dl, op = d(o["start"]), d(o["end"]), d(o["deadline"]), d(o.get("opens", ""))
    if st and en and st != en:
        if st.year == en.year and st.month == en.month:
            return f"{st.day} to {en.day} {en.strftime('%b')} {en.year}"
        return f"{fdate(o['start'], st.year != en.year)} to {fdate(o['end'])}"
    if st: return fdate(o["start"])
    if dl and status_now(o) != "closed": return f"Apply by {fdate(o['deadline'])}"
    if op and op >= BUILD_DATE: return f"Opens {fdate(o['opens'])}"
    return o.get("when") or o["dates"].split(". ")[0].rstrip(".")

def canonical(o):
    return f"{SITE['url']}/opportunities/{o['slug']}.html"

def gcal(o, kind):
    if kind == "deadline":
        s = d(o["deadline"]); en = s + datetime.timedelta(days=1); title = f"Deadline: {o['title']}"
    elif kind == "opens":
        s = d(o["opens"]); en = s + datetime.timedelta(days=1); title = f"Applications open: {o['title']}"
    else:
        s = d(o["start"]); en = d(o["end"] or o["start"]) + datetime.timedelta(days=1); title = o["title"]
    q = (f"action=TEMPLATE&text={quote(title)}&dates={s.strftime('%Y%m%d')}/{en.strftime('%Y%m%d')}"
         f"&details={quote(o['summary'] + ' Official page: ' + (o['link'] if not is_internal(o['link']) else SITE['url'] + '/' + o['link']) + ' Listed on swabud.tech')}"
         f"&location={quote(o['location'])}")
    return "https://calendar.google.com/calendar/render?" + q

def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)

OPPS = load("opportunities.json")
for _o in OPPS: _o.setdefault("opens", "")
# Partners shown on the home and About pages. Add the partner's official website or page in "url" when you have it.
PARTNERS = [
    {"name": "Nepalgunj IT Students Community", "short": "NISC", "type": "Community partner", "place": "Nepalgunj, Banke",
     "logo": "assets/img/partners/nisc-logo.webp", "url": "",
     "desc": "A community of IT students in Nepalgunj, partnering with SWABUD to bring verified opportunities, events and learning to students in western Nepal."},
]
SOURCES = load("sources.json")
LEARN = load("learn.json")
BY_SLUG = {o["slug"]: o for o in OPPS}
N_SOURCES = sum(len(g["items"]) for g in SOURCES)

# ---------------------------------------------------------------- layout
# who: "all" = everyone, "m" = members (logged in), "v" = visitors only
NAV = [("opportunities.html", "Opportunities", "all"), ("calendar.html", "Calendar", "m"), ("sources.html", "Sources", "m"), ("learn.html", "Learn", "m"),
       ("career.html", "Career", "m"), ("about.html", "About", "all"), ("index.html#partners", "Partners", "v"), ("contact.html", "Contact", "v")]
WHO_CLASS = {"all": "", "m": ' class="members-only"', "v": ' class="visitors-only"'}
LOCK_TAG = '<span class="lock-ic visitors-only" title="Members only">' + '<svg class="icon" aria-hidden="true"><use href="#i-lock"/></svg><span class="visually-hidden">(members only)</span></span>'

def head(title, desc, path, pre, jsonld=None, noindex=False, page_id=""):
    full = title if title.startswith("SWABUD") else f"{title} | SWABUD"
    url = SITE["url"] + "/" + (path if path != "index.html" else "")
    ld = "".join(f'<script type="application/ld+json">{json.dumps(j, ensure_ascii=False)}</script>' for j in (jsonld or []))
    robots = '<meta name="robots" content="noindex">' if noindex else ""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(full)}</title>
<script src="{pre}assets/js/config.js"></script>
<script src="{pre}assets/js/theme.js"></script>
<meta name="description" content="{e(desc)}">
{robots}<link rel="canonical" href="{e(url)}">
<meta name="theme-color" content="#101C30">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SWABUD">
<meta property="og:title" content="{e(full)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{e(url)}">
<meta property="og:image" content="{SITE['url']}/assets/img/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{pre}favicon.ico" sizes="48x48">
<link rel="icon" href="{pre}assets/img/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="{pre}assets/img/apple-touch-icon.png">
<link rel="manifest" href="{pre}site.webmanifest">
<link rel="alternate" type="application/rss+xml" title="SWABUD opportunities" href="{SITE['url']}/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<link rel="stylesheet" href="{pre}assets/css/style.css">
{ld}
</head>
<body{f' data-page="{page_id}"' if page_id else ''}>
"""

def header(active, pre):
    cur = ' aria-current="page"'
    links = "".join(f'<li{WHO_CLASS[w]}><a href="{pre}{h}"{cur if h == active else ""}>{t}</a></li>' for h, t, w in NAV)
    return f"""{sprite()}
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap nav">
    <a class="brand" href="{pre}index.html" aria-label="SWABUD home">
      <img class="logo-on-light" src="{pre}assets/img/logo-wordmark.svg" alt="SWABUD" width="148" height="22">
      <img class="logo-on-dark" src="{pre}assets/img/logo-wordmark-white.svg" alt="SWABUD" width="148" height="22">
    </a>
    <div class="nav-tools">
      <a class="icon-btn" href="{pre}profile.html#saved" data-auth-in aria-label="Saved opportunities and tracker">{icon("bookmark")}<span class="count" data-saved-count hidden>0</span></a>
      <button class="icon-btn theme-toggle" type="button" aria-label="Switch between light and dark mode" title="Light or dark mode"><span class="i-moon">{icon("moon")}</span><span class="i-sun">{icon("sun")}</span></button>
      <a class="icon-btn account-btn" href="{pre}login.html" data-account-btn data-href-in="{pre}profile.html" data-href-out="{pre}login.html" aria-label="Log in or sign up"><span data-account-icon>{icon("user")}</span><span class="avatar avatar-xs" data-avatar hidden></span></a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-menu">{icon("menu")}Menu</button>
    </div>
    <nav class="nav-menu" id="nav-menu" aria-label="Main">
      <ul class="nav-links">{links}</ul>
      <div class="nav-auth" data-auth-out>
        <a class="btn btn-ghost btn-sm" href="{pre}login.html">Log in</a>
        <a class="btn btn-lime btn-sm" href="{pre}signup.html">Sign up</a>
      </div>
      <a class="nav-user" href="{pre}profile.html" data-auth-in title="My dashboard"><span class="avatar" data-avatar></span><span class="nav-user-name" data-user-name>Dashboard</span></a>
    </nav>
  </div>
</header>
"""

def footer(pre):
    soc = "".join(ext(u, icon(i) + f'<span class="visually-hidden">{n}</span>') for n, u, i, _ in SITE["social"])
    return f"""
<footer class="site-footer navy">
  <div class="navy-pattern"></div>
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <img src="{pre}assets/img/logo-lockup-white.svg" alt="SWABUD: Discover. Connect. Grow." width="220" height="46">
        <p>Verified hackathons, CTFs, internships, fellowships, scholarships, events, courses and volunteering for students in Nepal, in one place.</p>
        <div class="foot-mail"><code id="foot-email">{SITE['email']}</code><button class="copy-btn" type="button" data-copy="{SITE['email']}" data-copy-target="#foot-email" data-copy-done="Email address copied">Copy</button></div>
        <div class="socials">{soc}<a href="{pre}feed.xml" aria-label="RSS feed">{icon("rss")}</a></div>
      </div>
      <div>
        <h2>Explore</h2>
        <ul>
          <li><a href="{pre}opportunities.html">All opportunities</a></li>
          <li><a href="{pre}opportunities.html#hackathons">Hackathons</a></li>
          <li><a href="{pre}opportunities.html#ctf">CTFs</a></li>
          <li><a href="{pre}opportunities.html#scholarships">Scholarships</a></li>
          <li><a href="{pre}calendar.html">Deadline calendar</a>{LOCK_TAG}</li>
          <li><a href="{pre}sources.html">Opportunity sources</a>{LOCK_TAG}</li>
          <li><a href="{pre}learn.html">Learning paths</a>{LOCK_TAG}</li>
          <li><a href="{pre}career.html">Career guides</a>{LOCK_TAG}</li>
        </ul>
      </div>
      <div>
        <h2>Your account</h2>
        <ul>
          <li data-auth-out><a href="{pre}signup.html">Create a free account</a></li>
          <li data-auth-out><a href="{pre}login.html">Log in</a></li>
          <li><a href="{pre}profile.html">My dashboard</a></li>
          <li><a href="{pre}profile.html#saved">Saved and tracker</a></li>
          <li><a href="{pre}submit.html">Submit an opportunity</a></li>
          <li><a href="{pre}index.html#alerts">Weekly alerts</a></li>
        </ul>
      </div>
      <div>
        <h2>Get involved</h2>
        <ul>
          <li><a href="{pre}organizers.html">For organizers</a></li>
          <li><a href="{pre}index.html#partners">Partners</a></li>
          <li><a href="{pre}join.html">Join SWABUD</a></li>
          <li><a href="{pre}contact.html">Contact us</a></li>
        </ul>
      </div>
      <div>
        <h2>SWABUD</h2>
        <ul>
          <li><a href="{pre}about.html">About</a></li>
          <li><a href="{pre}editorial-policy.html">How we verify</a></li>
          <li><a href="{pre}privacy.html">Privacy policy</a></li>
          <li><a href="{pre}terms.html">Terms of use</a></li>
          <li><a href="{pre}feed.xml">RSS feed</a></li>
        </ul>
      </div>
    </div>
    <div class="foot-bottom">
      <span>&copy; <span data-year>{BUILD_DATE.year}</span> SWABUD · swabud.tech · Discover. Connect. Grow.</span>
      <span>Opportunities are run by their organizers. Always confirm details on the official site before applying.</span>
    </div>
  </div>
</footer>
<script src="{pre}assets/js/main.js" defer></script>
<script src="{pre}assets/js/auth.js" defer></script>
<script src="{pre}assets/js/member.js" defer></script>
{{extra_js}}</body>
</html>
"""

def page(path, title, desc, body, active="", pre="", jsonld=None, noindex=False, page_id="", scripts=()):
    extra = "".join(f'<script src="{pre}assets/js/{s}" defer></script>\n' for s in scripts)
    html = (head(title, desc, path, pre, jsonld, noindex, page_id) + header(active, pre) + f'<main id="main">{body}</main>'
            + footer(pre).replace("{extra_js}", extra))
    out = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    return path

def page_head(eyebrow, h1, lead, crumbs=None, extra=""):
    cr = ""
    if crumbs:
        parts = [f'<a href="{h}">{e(t)}</a>' if h else f'<span aria-current="page">{e(t)}</span>' for h, t in crumbs]
        cr = '<nav class="crumbs" aria-label="Breadcrumb">' + '<span aria-hidden="true">/</span>'.join(parts) + "</nav>"
    return f"""<section class="navy page-head"><div class="navy-pattern"></div>
  <div class="wrap"><div class="frame">
    {cr}
    {f'<p class="eyebrow">{e(eyebrow)}</p>' if eyebrow else ''}
    <h1>{h1}</h1>
    {f'<p>{lead}</p>' if lead else ''}
    {extra}
  </div></div>
</section>"""

# ---------------------------------------------------------------- forms
def honeypot():
    return '<div class="hp" aria-hidden="true"><label>Leave this empty<input type="text" name="_honey" tabindex="-1" autocomplete="off"></label></div>'

def consent(fid, pre=""):
    return (f'<label class="check full" for="{fid}"><input type="checkbox" id="{fid}" name="consent" value="yes" required>'
            f'<span>I agree that SWABUD may store these details and contact me about this message, as described in the <a href="{pre}privacy.html">privacy policy</a>. (required)</span></label>')

def form_result():
    return f"""<div class="form-result" role="status" hidden>
  <div class="ok" hidden><strong>{icon("check")}<span data-result-title>Sent</span></strong><p data-result-text></p></div>
  <div class="fallback" hidden>
    <p data-fallback-text></p>
    <pre data-fallback-body></pre>
    <div class="actions"><a class="btn btn-navy btn-sm" data-fallback-mail href="mailto:{SITE['email']}">{icon("mail")}Open in my email app</a><button class="btn btn-ghost btn-sm" type="button" data-copy-from-result>Copy text</button></div>
    <p class="hint">Send to <code>{SITE['email']}</code>.</p>
  </div>
</div>"""

def opts(items, placeholder=None):
    o = f'<option value="">{e(placeholder)}</option>' if placeholder else ""
    return o + "".join(f"<option>{e(x)}</option>" for x in items)

# ---------------------------------------------------------------- components
def save_btn(o, cls="save-btn"):
    return (f'<button class="{cls}" type="button" data-auth-in data-save="{o["slug"]}" aria-pressed="false" aria-label="Save {e(o["title"])}">'
            f'{icon("bookmark")}<span data-save-label>Save</span></button>')

def lock_card(title, text, perks, nxt, pre="", cls=""):
    """Shown to visitors in place of member-only content."""
    li = "".join(f"<li>{icon('check')}<span>{p}</span></li>" for p in perks)
    return f"""<div class="lock-card visitors-only {cls}">
  <span class="lock-badge">{icon("lock")}Members only · free</span>
  <h2>{title}</h2>
  <p>{text}</p>
  {f'<ul class="lock-perks">{li}</ul>' if perks else ''}
  <div class="gate-actions">
    <button class="btn btn-google" type="button" data-google-signin data-next="{nxt}">{GOOGLE_G}Continue with Google</button>
    <a class="btn btn-lime" href="{pre}signup.html" data-set-next="{nxt}">{icon("user")}Create a free account</a>
    <a class="btn btn-ghost" href="{pre}login.html" data-set-next="{nxt}">Log in</a>
  </div>
</div>"""

def card(o, pre):
    c = CAT[o["category"]]
    search = " ".join([o["title"], o["organizer"], o["summary"], c[1], o["location"], o["mode"], REGIONS[o["region"]]]).lower()
    verified = (f'<span class="verified">{icon("check")}Verified {fdate(o["verified"])}</span>' if o["verified"]
                else '<span class="verified">General listing</span>')
    where = o["mode"] if o["location"] in (o["mode"], "Online") else f'{o["mode"]} · {o["location"]}'
    cd = countdown(o)
    free = '<span class="tag tag-free">Free</span>' if o["free"] else ""
    return f"""<article class="opp-card" {data_attrs(o)} data-slug="{o['slug']}" data-cat="{o['category']}" data-mode="{mode_key(o['mode'])}" data-region="{o['region']}" data-free="{'1' if o['free'] else '0'}" data-level="{e(o['level'])}" data-title="{e(o['title'].lower())}" data-verified="{o['verified']}" data-search="{e(search)}">
  <div class="opp-top"><span class="opp-cat">{e(c[2])}</span>{pill(o)}</div>
  <h3><a href="{pre}opportunities/{o['slug']}.html">{e(o['title'])}</a></h3>
  <p class="opp-org">{e(o['organizer'])}</p>
  <ul class="facts">
    <li>{icon("calendar")}<span>{e(short_when(o))}</span></li>
    <li>{icon("pin")}<span>{e(where)}</span></li>
    <li>{icon("coin")}<span>{e(o['cost'])}</span></li>
  </ul>
  <div class="opp-tags"><span class="tag">{REGIONS[o['region']]}</span><span class="tag">{e(o['level'])}</span>{free}</div>
  <div class="opp-foot">{verified}<span class="countdown" data-countdown{'' if cd else ' hidden'}>{cd}</span>{save_btn(o)}</div>
</article>"""

def source_card(s):
    return f"""<a class="source-card" href="{e(s['url'])}" target="_blank" rel="noopener noreferrer">
  <span class="row"><strong>{e(s['name'])}</strong><span class="tag">{e(s['tag'])}</span></span>
  <p>{e(s['desc'])}</p>
  <span class="domain">{e(domain(s['url']))}{icon("external")}</span>
</a>"""

def counts():
    live = [o for o in OPPS if status_now(o) != "closed"]
    return {
        "open": sum(1 for o in OPPS if status_now(o) in ("open", "closing", "rolling")),
        "nepal": sum(1 for o in live if o["region"] == "nepal"),
        "free": sum(1 for o in live if o["free"]),
        "total": len(OPPS),
    }

# ---------------------------------------------------------------- pages
def partner_cards(pre=""):
    out = ""
    for p in PARTNERS:
        inner = f"""<span class="partner-logo"><img src="{pre}{p['logo']}" alt="{e(p['name'])} logo" width="640" height="358"></span>
  <span class="partner-body"><span class="tag">{e(p['type'])}</span><strong>{e(p['name'])} ({e(p['short'])})</strong><span>{e(p['desc'])}</span>
  <span class="partner-place">{icon("pin")}{e(p['place'])}</span></span>"""
        out += ext(p["url"], inner, "partner-card") if p["url"] else f'<div class="partner-card">{inner}</div>'
    out += f"""<a class="partner-card partner-cta" href="{pre}organizers.html#partner-form">
  <span class="partner-logo partner-logo-empty">{icon("users")}</span>
  <span class="partner-body"><span class="tag">Open</span><strong>Your community or company here</strong><span>Student clubs, colleges, companies and event organizers can partner with SWABUD to reach students across Nepal.</span>
  <span class="link-arrow">Become a partner {icon("arrow")}</span></span>
</a>"""
    return out

def build_home():
    upcoming = [o for o in OPPS if status_now(o) != "closed" and key_date(o)[1] in ("Closes", "Starts", "Opens", "Ends")]
    upcoming.sort(key=lambda o: key_date(o)[0])
    rows = ""
    for o in upcoming[:5]:
        kd, verb = key_date(o)
        x = d(kd)
        rows += f"""<li><a class="board-row" href="opportunities/{o['slug']}.html" {data_attrs(o)}>
  <span class="board-date"><b>{x.day}</b><small>{x.strftime('%b')}</small></span>
  <span><span class="board-title">{e(o['title'])}</span>
  <span class="board-meta">{pill(o)}<span data-countdown>{countdown(o)}</span><span>{e(o['location'].split(' (')[0].split(',')[-1].strip())}</span></span></span>
</a></li>"""
    n = counts()
    cat_counts = {c[0]: sum(1 for o in OPPS if o["category"] == c[0]) for c in CATS}
    tiles = "".join(f"""<a class="cat-tile" href="opportunities.html#{cid}">
  <span class="cat-icon">{icon(ic)}</span>
  <span><h3>{e(label)}</h3><p>{e(desc)}</p></span>
  <span class="cat-count">{cat_counts[cid]}</span>
</a>""" for cid, label, short, desc, ic in CATS)
    visitor_perks = ["A preview of opportunities, 9 at a time", "Search and browse by category", "Live statuses and countdowns", "Summaries, eligibility and dates",
                     "Two career guides, including the scam guide", "Weekly email alerts", "Contact and partner forms"]
    member_perks = [f"All {len(OPPS)} opportunities with every filter", "Official links, how-to-apply steps, costs and benefits", "Full deadline calendar, with a My saved dates view",
                    f"All {N_SOURCES} official sources", "Learning paths with saved progress", "All 8 career guides",
                    "Save, track and checklist every application", "Deadline heads-up and what's new since your last visit", "Recommendations for your interests", "Submit opportunities and follow their review"]
    featured = ["bsides-kathmandu-2026", "anais-2026-nepal-ai-school", "hacktoberfest-2026", "nasa-space-apps-challenge-2026", "wordcamp-nepal-2027", "ieeextreme-20"]
    cards = "".join(card(BY_SLUG[s], "") for s in featured)
    goals = [
        ("Land my first internship or fellowship", "Paid programmes, fellowships in Nepal and how to apply well.", [("opportunities.html#internships", "Fellowships"), ("career.html#cv", "CV guide")], "briefcase"),
        ("Get into cybersecurity", "CTFs, legal practice labs and BSides Kathmandu.", [("opportunities.html#ctf", "CTFs"), ("learn.html#security", "Security path")], "shield"),
        ("Study abroad on a scholarship", "Government scholarships and the documents to prepare.", [("opportunities.html#scholarships", "Scholarships"), ("career.html#scholarship-docs", "Document checklist")], "globe"),
        ("Win a hackathon", "Hackathons and coding contests you can join from Nepal.", [("opportunities.html#hackathons", "Hackathons"), ("career.html#hackathons", "Hackathon prep")], "trophy"),
        ("Meet the tech community", "Conferences and meetups in Kathmandu, Nepalgunj and online.", [("opportunities.html#events", "Events"), ("calendar.html", "Calendar")], "users"),
        ("Give back as a volunteer", "Online volunteering and the SWABUD ambassador programme.", [("opportunities.html#volunteering", "Volunteering"), ("join.html", "Join SWABUD")], "heart"),
    ]
    goal_html = "".join(f"""<div class="goal">
  <span class="cat-icon">{icon(ic)}</span>
  <h3>{e(t)}</h3><p>{e(p)}</p>
  <div class="goal-links">{''.join(f'<a href="{h}">{e(l)} {icon("arrow")}</a>' for h, l in links)}</div>
</div>""" for t, p, links, ic in goals)
    picks = [("competitions", 0), ("competitions", 1), ("cybersecurity", 0), ("jobs", 0), ("open-source", 0), ("volunteering", 0)]
    groups = {g["id"]: g for g in SOURCES}
    srcs = "".join(source_card(groups[g]["items"][i]) for g, i in picks)
    tracks = "".join(f"""<a class="track-card" href="learn.html#{t['id']}">
  <span class="cat-icon">{icon(t['icon'])}</span><h3>{e(t['title'])}</h3><p>{e(t['pitch'])}</p>
  <span class="link-arrow">Start the path {icon("arrow")}</span>
</a>""" for t in LEARN)
    interest = "".join(f'<label class="chip-check"><input type="checkbox" name="interests" value="{e(c[2])}"><span>{e(c[2])}</span></label>' for c in CATS)
    opts_cat = "".join(f'<option value="{c[0]}">{e(c[2])}</option>' for c in CATS)
    chips = "".join(f'<a href="opportunities.html#{c[0]}">{e(c[2])}</a>' for c in CATS[:6])
    body = f"""
<section class="navy hero"><div class="navy-pattern"></div>
  <div class="wrap hero-grid">
    <div class="frame">
      <p class="eyebrow">For students in Nepal</p>
      <h1>Your next opportunity <span class="accent">starts here.</span></h1>
      <p class="hero-lead">Hackathons, CTFs, fellowships, scholarships, events, free courses and volunteering, collected from official sources, checked, and kept up to date until they close.</p>
      <form class="hero-search" id="hero-search" role="search">
        <label class="visually-hidden" for="hero-q">Search opportunities</label>
        <input id="hero-q" name="q" type="search" placeholder="Search CTF, AI, Nepal..." autocomplete="off">
        <label class="visually-hidden" for="hero-cat">Category</label>
        <select id="hero-cat" name="cat"><option value="">All categories</option>{opts_cat}</select>
        <button class="btn btn-lime" type="submit">{icon("search")}Search</button>
      </form>
      <div class="hero-chips">{chips}</div>
    </div>
    <aside class="board" aria-label="Next dates">
      <div class="board-head"><strong>Next on the board</strong><span>checked {fdate(BUILD_DATE.isoformat())}</span></div>
      <ul class="board-list">{rows}</ul>
      <a class="board-foot" href="calendar.html">{icon("calendar")}See every date on the deadline calendar {icon("arrow")}</a>
    </aside>
  </div>
</section>
<section class="trust"><div class="wrap"><ul>
  <li><b class="mono">{n['open']}</b><span>open right now</span></li>
  <li><b class="mono">{n['nepal']}</b><span>happening in Nepal</span></li>
  <li><b class="mono">{n['free']}</b><span>free to join</span></li>
  <li><b class="mono">{N_SOURCES}</b><span>official sources watched</span></li>
</ul></div></section>
<section class="partner-strip" aria-label="Partners"><div class="wrap">
  <span class="label">Community partners</span>
  {''.join(f'<a class="strip-logo" href="#partners"><img src="{p["logo"]}" alt="" width="72" height="40"><span>{e(p["name"])} ({e(p["short"])})</span></a>' for p in PARTNERS)}
  <a class="strip-cta" href="organizers.html#partner-form">{icon("plus")}Your community here</a>
</div></section>

<section class="section"><div class="wrap">
  <div class="section-head"><div><p class="eyebrow">Start from your goal</p><h2>What do you want to do next?</h2><p>Pick a goal and we'll point you to the opportunities and guides that lead there.</p></div></div>
  <div class="goal-grid">{goal_html}</div>
</div></section>

<section class="section section-alt"><div class="wrap">
  <div class="section-head"><div><p class="eyebrow">On the board now</p><h2>Verified and worth your time</h2><p>Each card shows who it's for, when it happens and what it costs. Tap the bookmark to save it for later.</p></div>
  <a class="link-arrow" href="opportunities.html">All {n['total']} opportunities {icon("arrow")}</a></div>
  <div class="card-grid">{cards}</div>
</div></section>

<section class="section" id="membership" style="scroll-margin-top:80px"><div class="wrap">
  <div class="section-head"><div><p class="eyebrow">Free account</p><h2>Browse as a visitor. Unlock everything as a member.</h2><p>A SWABUD account is free for every student. Sign up with Google or email in under a minute, and the whole platform opens up.</p></div></div>
  <div class="plans">
    <div class="plan">
      <p class="plan-name">Visitor</p>
      <p class="plan-price">No account needed</p>
      <ul class="plan-list">{''.join(f"<li>{icon('check')}<span>{x}</span></li>" for x in visitor_perks)}</ul>
    </div>
    <div class="plan plan-member frame">
      <p class="plan-name">Member</p>
      <p class="plan-price">Free, with Google or email</p>
      <ul class="plan-list">{''.join(f"<li>{icon('check')}<span>{x}</span></li>" for x in member_perks)}</ul>
      <div class="plan-actions" data-auth-out>
        <button class="btn btn-google" type="button" data-google-signin>{GOOGLE_G}Continue with Google</button>
        <a class="btn btn-lime" href="signup.html">{icon("user")}Create a free account</a>
        <a class="btn btn-ghost" href="login.html">Log in</a>
      </div>
      <div class="plan-actions" data-auth-in><a class="btn btn-lime" href="profile.html">{icon("user")}Open my dashboard</a><a class="btn btn-ghost" href="profile.html#saved">My tracker</a></div>
    </div>
  </div>
</div></section>

<section class="section section-alt"><div class="wrap">
  <div class="section-head"><div><p class="eyebrow">Browse</p><h2>Eight kinds of opportunity</h2><p>From your first CTF to a fully funded master's degree.</p></div>
  <a class="link-arrow" href="opportunities.html">Open the directory {icon("arrow")}</a></div>
  <div class="cat-grid">{tiles}</div>
</div></section>

<section class="section"><div class="wrap">
  <div class="section-head"><div><p class="eyebrow">Why SWABUD</p><h2>Discover. Connect. Grow.</h2><p>One promise, three parts. Everything on this site serves one of them.</p></div></div>
  <div class="pillars">
    <div class="pillar"><p class="pillar-word">Discover</p><h3>Find what fits you</h3><p>Opportunities from scattered posts, portals and notice boards, checked at the source and written in one clear format.</p><a class="link-arrow" href="opportunities.html">Browse opportunities {icon("arrow")}</a></div>
    <div class="pillar"><p class="pillar-word">Connect</p><h3>Meet people who build</h3><p>Events, communities and campus ambassadors across Nepal, so no student has to figure it out alone.</p><a class="link-arrow" href="join.html">Join SWABUD {icon("arrow")}</a></div>
    <div class="pillar"><p class="pillar-word">Grow</p><h3>Get ready to be chosen</h3><p>Free learning paths and practical career guides, so you're ready when the right opportunity opens.</p><a class="link-arrow" href="learn.html">Start learning {icon("arrow")}</a></div>
  </div>
</div></section>

<section class="section section-alt"><div class="wrap split">
  <div>
    <p class="eyebrow">How SWABUD works</p>
    <h2 style="margin-top:.6rem">Nothing goes live until the official page confirms it</h2>
    <p style="color:var(--muted);margin-top:1rem;max-width:34rem">Social posts and forwarded images are only leads. A listing is published after we check it at the source, and it carries the date we last checked.</p>
    <ol class="steps" style="margin-top:1.5rem;grid-template-columns:1fr">
      <li><h3>Find the official source</h3><p>The organizer's own website, verified account or official email. A reposted poster is not a source.</p></li>
      <li><h3>Confirm the facts</h3><p>Organizer, eligibility, dates, format, cost and the real application link.</p></li>
      <li><h3>Publish with a check date</h3><p>Statuses then switch on their own, in Nepal time: Opens in, Open, Closing soon, Happening now and Closed. We recheck open listings every week.</p></li>
    </ol>
  </div>
  <div class="callout callout-warn">
    <h3>{icon("alert")}Five signs an opportunity is fake</h3>
    <ul>
      <li>You must pay to "reserve a seat" or "confirm your selection".</li>
      <li>No official website, page or named contact can be found.</li>
      <li>It asks for citizenship copies, bank details or passwords to apply.</li>
      <li>It promises a guaranteed job or a prize with no clear rules.</li>
      <li>The only source is a forwarded image or message.</li>
    </ul>
    <p style="margin-top:1rem"><a class="link-arrow" href="career.html#scams">Read the full scam guide {icon("arrow")}</a></p>
  </div>
</div></section>

<section class="section"><div class="wrap">
  <div class="section-head"><div><p class="eyebrow">Beyond SWABUD</p><h2>Where opportunities come from</h2><p>The official platforms we watch, so you can go straight to the source too.</p></div>
  <a class="link-arrow" href="sources.html">All {N_SOURCES} sources {icon("arrow")}</a></div>
  <div class="source-grid members-only">{srcs}</div>
  {lock_card(f"{N_SOURCES} official sources, for members", "Competition platforms, CTF calendars, open-source programmes, scholarship portals and Nepal tech communities, grouped by goal.",
             [e(g["title"]) for g in SOURCES[:4]] + ["and more"], "sources.html")}
</div></section>

<section class="section section-alt"><div class="wrap">
  <div class="section-head"><div><p class="eyebrow">Learn</p><h2>Build the skills they ask for</h2><p>Free learning paths, so you're ready when the right opportunity opens.</p></div>
  <a class="link-arrow" href="learn.html">All learning paths {icon("arrow")}</a></div>
  <div class="track-grid">{tracks}</div>
</div></section>

<section class="section" id="alerts" style="scroll-margin-top:80px"><div class="wrap split">
  <div>
    <p class="eyebrow">Get alerts</p>
    <h2 style="margin-top:.6rem">New opportunities, straight to your inbox</h2>
    <p style="color:var(--muted);margin-top:1rem;max-width:32rem">Tell us what you care about. We'll send a short weekly roundup of verified opportunities and deadline reminders. No spam, and you can unsubscribe any time.</p>
    <div class="join-grid" style="grid-template-columns:1fr;margin-top:1.5rem">{''.join(ext(u, f'{icon(i)}<span><strong>{nm}</strong><span>{e(h)}</span></span>', "join-card") for nm, u, i, h in SITE["social"])}</div>
  </div>
  <form class="form-card" data-form="alerts" data-subject="Alerts signup" novalidate>
    {honeypot()}
    <div class="form-grid">
      <div class="field full"><label for="a-email">Email (required)</label><input class="input" id="a-email" name="email" type="email" required autocomplete="email" placeholder="you@example.com"></div>
      <div class="field"><label for="a-name">First name</label><input class="input" id="a-name" name="name" maxlength="60" autocomplete="given-name"></div>
      <div class="field"><label for="a-where">City or district</label><input class="input" id="a-where" name="location" maxlength="60" placeholder="e.g. Butwal"></div>
      <fieldset class="field full"><legend class="label">I'm interested in</legend><div class="chips">{interest}</div></fieldset>
      {consent("a-consent")}
    </div>
    <p class="error" data-form-error role="alert" hidden></p>
    <button class="btn btn-lime" type="submit" style="margin-top:1.25rem">{icon("send")}Subscribe to alerts</button>
    {form_result()}
  </form>
</div></section>

<section class="section section-alt" id="partners" style="scroll-margin-top:80px"><div class="wrap">
  <div class="section-head"><div><p class="eyebrow">Partners</p><h2>Built with student communities</h2><p>SWABUD works with communities that share our goal: every student in Nepal should hear about real opportunities in time.</p></div>
  <a class="link-arrow" href="organizers.html#partner-form">Partner with SWABUD {icon("arrow")}</a></div>
  <div class="partner-grid">{partner_cards()}</div>
</div></section>

<section class="section" id="contact" style="scroll-margin-top:80px"><div class="wrap split">
  <div class="contact-copy">
    <p class="eyebrow">Contact</p>
    <h2 style="margin-top:.6rem">Talk to SWABUD</h2>
    <p class="lead-muted">Questions, corrections, partnerships, or an opportunity to share. Messages from this form arrive directly at <strong>{SITE['email']}</strong>, and we reply by email.</p>
    <ul class="contact-points">
      <li><span class="cat-icon">{icon("mail")}</span><span><strong>Email us</strong><a href="mailto:{SITE['email']}">{SITE['email']}</a></span></li>
      <li><span class="cat-icon">{icon("flag")}</span><span><strong>Wrong or expired listing?</strong>Use "Report a problem" at the bottom of any listing, or choose Correction here.</span></li>
      <li><span class="cat-icon">{icon("users")}</span><span><strong>Colleges, clubs and companies</strong><a href="organizers.html#partner-form">Partner with SWABUD</a> or <a href="submit.html">submit an opportunity</a>.</span></li>
    </ul>
    <div class="socials socials-ink">{''.join(ext(u, icon(i) + f'<span class="visually-hidden">{nm}</span>') for nm, u, i, h in SITE["social"])}</div>
  </div>
  <form class="form-card" id="home-contact" data-form="contact" data-subject="Contact form (home page)" data-title-field="topic" novalidate>
    {honeypot()}
    <div class="form-grid">
      <div class="field"><label for="hc-name">Name (required)</label><input class="input" id="hc-name" name="name" required maxlength="80" autocomplete="name"></div>
      <div class="field"><label for="hc-email">Email (required)</label><input class="input" id="hc-email" name="email" type="email" required autocomplete="email"></div>
      <div class="field full"><label for="hc-topic">Topic (required)</label><select class="input" id="hc-topic" name="topic" required>{opts(["General question", "Help with my account", "Correction to a listing", "Partnership or media", "Join the team", "Something else"], "Choose a topic")}</select></div>
      <div class="field full"><label for="hc-msg">Message (required)</label><textarea class="input" id="hc-msg" name="message" required maxlength="2000" placeholder="How can we help?"></textarea></div>
      {consent("hc-consent")}
    </div>
    <p class="error" data-form-error role="alert" hidden></p>
    <button class="btn btn-lime" type="submit" style="margin-top:1.25rem">{icon("send")}Send message</button>
    {form_result()}
  </form>
</div></section>

<section class="section section-alt"><div class="wrap">
  <div class="navy band frame"><div class="navy-pattern"></div>
    <div style="position:relative"><p class="eyebrow">For organizers</p><h2 style="margin-top:.6rem">Running something students should know about?</h2>
    <p>Colleges, clubs, companies and communities can list hackathons, internships, events and programmes on SWABUD for free, or partner with us to reach students across Nepal.</p></div>
    <div class="actions" style="position:relative"><a class="btn btn-lime" href="submit.html">Submit an opportunity</a><a class="btn btn-ghost-light" href="organizers.html">Partner with us</a></div>
  </div>
</div></section>
"""
    org = {"@context": "https://schema.org", "@type": "Organization", "name": "SWABUD", "url": SITE["url"], "logo": SITE["url"] + "/assets/img/icon-512.png",
           "email": SITE["email"], "slogan": SITE["tagline"], "sameAs": [s[1] for s in SITE["social"]]}
    site = {"@context": "https://schema.org", "@type": "WebSite", "name": "SWABUD", "url": SITE["url"]}
    return page("index.html", "SWABUD: Verified tech opportunities for students in Nepal",
                "Find verified hackathons, CTFs, fellowships, scholarships, tech events, free courses and volunteering for students in Nepal, checked against official sources.",
                body, "", "", [org, site])

def sorted_opps():
    return sorted(OPPS, key=lambda o: (RANK[status_now(o)], key_date(o)[0] or "9999", o["title"]))

def build_directory():
    chips = '<button class="chip" type="button" data-cat="" aria-pressed="true">All</button>' + "".join(
        f'<button class="chip" type="button" data-cat="{c[0]}" aria-pressed="false">{e(c[2])}</button>' for c in CATS)
    cards = "".join(card(o, "") for o in sorted_opps())
    levels = sorted({o["level"] for o in OPPS})
    lock_counts = [(c[1], sum(1 for o in OPPS if o["category"] == c[0])) for c in CATS]
    body = page_head("Opportunities", "Every opportunity, checked at the source", f"{len(OPPS)} listings across {len(CATS)} categories, free and paid. Each one links to the organizer's own page, and statuses and countdowns update by themselves in Nepal time.",
                     [("index.html", "Home"), ("", "Opportunities")]) + f"""
<section class="section" style="padding-top:2rem"><div class="wrap">
  <div class="filters" role="search">
    <div class="filter-row">
      <div class="field field-search"><label for="f-q">Search</label><input class="input" id="f-q" type="search" placeholder="Title, organizer, skill or place" autocomplete="off"></div>
      <div class="field members-only"><label for="f-status">Status</label><select class="input" id="f-status"><option value="all">Any status</option><option value="open">Open now</option><option value="closing">Closing soon (7 days)</option><option value="live">Happening now</option><option value="upcoming">Upcoming</option><option value="closed">Closed</option></select></div>
      <div class="field members-only"><label for="f-region">Where</label><select class="input" id="f-region"><option value="all">Anywhere</option><option value="nepal">In Nepal</option><option value="online">Online</option><option value="abroad">Abroad</option></select></div>
      <div class="field members-only"><label for="f-level">Level</label><select class="input" id="f-level"><option value="all">Any level</option>{''.join(f'<option>{e(l)}</option>' for l in levels)}</select></div>
      <div class="field members-only"><label for="f-sort">Sort by</label><select class="input" id="f-sort"><option value="deadline">Next date</option><option value="verified">Recently verified</option><option value="az">A to Z</option></select></div>
    </div>
    <div class="filter-foot">
      <div class="field" style="min-width:0"><span class="label">Category</span><div class="chips" role="group" aria-label="Category">{chips}</div></div>
      <label class="toggle members-only" for="f-free"><input type="checkbox" id="f-free"><span>Free only</span></label>
    </div>
  </div>
  <div class="result-bar"><span>Showing <strong id="result-count">{len(OPPS)} opportunities</strong></span><button class="btn btn-ghost btn-sm" id="f-reset" type="button">Clear filters</button></div>
  <div class="card-grid" id="directory">{cards}</div>
  <div class="more-row members-only"><button class="btn btn-ghost" id="show-more" type="button" hidden>{icon("plus")}<span>Show more</span></button></div>
  {lock_card(f"See all {len(OPPS)} opportunities, free", f'<span data-lock-more>You are seeing a preview.</span> Members get every listing with filters by status, place, level and cost, plus official links, how-to-apply steps, the deadline calendar and a personal tracker.',
             [f"{n} {lab}" for lab, n in lock_counts], "opportunities.html", "", "dir-lock")}
  <div class="empty" id="empty" hidden>
    <h3>No opportunities match these filters</h3>
    <p>Try another category or status, or tell us about an opportunity we should list.</p>
    <a class="btn btn-navy" href="submit.html">Submit an opportunity</a>
  </div>
</div></section>"""
    return page("opportunities.html", "Opportunities", "Browse verified hackathons, CTFs, fellowships, scholarships, events, courses, volunteering and student programmes open to students in Nepal.", body, "opportunities.html")

TICK_LABEL = {"Closes": "Applications close in", "Opens": "Applications open in", "Starts": "Starts in", "Ends": "Happening now · ends in"}

def tick_when(verb, target):
    dt = f"{target.day} {target.strftime('%b %Y')}"
    return {"Closes": f"Deadline {dt}, 11:59 PM Nepal time", "Opens": f"Opens {dt}", "Starts": f"Starts {dt}", "Ends": f"Ends {dt}"}[verb]

def ticker_html(o):
    """Big live countdown on detail pages. main.js re-renders it every second."""
    s, target, verb, done = phase(o)
    units = ""
    if target:
        secs = max(0, int((target - NOW).total_seconds()))
        vals = [secs // 86400, secs % 86400 // 3600, secs % 3600 // 60, secs % 60]
        units = "".join(f'<span><b data-u="{k}">{v:02d}</b><i>{lab}</i></span>' for k, v, lab in zip("dhms", vals, ["days", "hrs", "min", "sec"]))
    label = TICK_LABEL.get(verb, "Status")
    if target: when = tick_when(verb, target)
    elif done and o["deadline"] and done != "Ended": when = f"Deadline was {fdate(o['deadline'])}"
    elif done and (o["end"] or o["start"]): when = f"Ended {fdate(o['end'] or o['start'])}"
    else: when = short_when(o)
    static = "" if target or done else f'<strong class="ticker-static">{e(short_when(o))}</strong>'
    return f"""<div class="countdown-big" data-ticker aria-live="off">
      <small data-ticker-label>{e(label if target or done else "When")}</small>
      <div class="ticker" data-ticker-units{'' if target else ' hidden'}>{units or ''.join(f'<span><b data-u="{k}">00</b><i>{lab}</i></span>' for k, lab in zip("dhms", ["days", "hrs", "min", "sec"]))}</div>
      <strong class="ticker-done" data-ticker-done{'' if done and not target else ' hidden'}>{e(done)}</strong>
      {static}
      <p class="ticker-when" data-ticker-when{'' if target or done else ' hidden'}>{e(when)}</p>
    </div>"""

def build_detail(o):
    c = CAT[o["category"]]
    pre = "../"
    cd = countdown(o)
    kd, verb = key_date(o)
    steps = "".join(f"<li>{e(s)}</li>" for s in o["steps"])
    related = [x for x in sorted_opps() if x["category"] == o["category"] and x["slug"] != o["slug"]][:3]
    if len(related) < 3:
        related += [x for x in sorted_opps() if x["slug"] != o["slug"] and x not in related and status_now(x) != "closed"][: 3 - len(related)]
    rel = "".join(card(x, pre) for x in related)
    share = canonical(o)
    big_label = f"{verb} {fdate(kd)}" if kd else "When"
    verified = fdate(o["verified"]) if o["verified"] else "General listing, not individually dated"
    head_meta = f'<div class="meta">{pill(o)}<span class="countdown" style="color:#DCE4EF" data-countdown{"" if cd else " hidden"}>{cd}</span></div>'
    hero = page_head(c[1], e(o["title"]), "", [(pre + "index.html", "Home"), (pre + "opportunities.html", "Opportunities"), (pre + "opportunities.html#" + c[0], c[2]), ("", o["title"])],
                     head_meta + f'<p class="org">By {e(o["organizer"])}</p>')
    if is_internal(o["link"]):
        go = f'<a class="btn btn-lime" href="{pre}{o["link"]}">{"Apply on SWABUD" if o["link"].startswith("join") else "More on SWABUD"} {icon("arrow")}</a>'
    else:
        go = ext(o["link"], "Go to the official page " + icon("external"), "btn btn-lime")
    cal_links = []
    if o["start"] and d(o["end"] or o["start"]) >= BUILD_DATE:
        cal_links.append(ext(gcal(o, "event"), f'{icon("calendar")}Add event to Google Calendar', "share-link"))
    if o["deadline"] and d(o["deadline"]) >= BUILD_DATE:
        cal_links.append(ext(gcal(o, "deadline"), f'{icon("calendar")}Add deadline to Google Calendar', "share-link"))
    if cal_links:
        cal_links.append(f'<a class="share-link" href="{o["slug"]}.ics" download>{icon("calendar")}Download .ics file</a>')
    cal_html = f'<div class="share-block"><p class="label">Add to your calendar</p><div class="share-row">{"".join(cal_links)}</div></div>' if cal_links else ""
    msg = quote(f"{o['title']}: {share}")
    shares = (ext(f"https://wa.me/?text={msg}", f'{icon("whatsapp")}<span class="visually-hidden">Share on </span>WhatsApp', "share-link") +
              ext(f"https://www.facebook.com/sharer/sharer.php?u={quote(share)}", f'{icon("facebook")}<span class="visually-hidden">Share on </span>Facebook', "share-link") +
              ext(f"https://www.linkedin.com/sharing/share-offsite/?url={quote(share)}", f'{icon("linkedin")}<span class="visually-hidden">Share on </span>LinkedIn', "share-link") +
              ext(f"https://twitter.com/intent/tweet?text={quote(o['title'])}&url={quote(share)}", f'{icon("x")}<span class="visually-hidden">Share on </span>X', "share-link") +
              f'<button class="share-link" type="button" data-copy="{e(share)}" data-copy-done="Link copied">{icon("share")}Copy link</button>')
    note = f'<div class="note"><strong>SWABUD note</strong>{e(o["notes"])}</div>' if o["notes"] else ""
    issues = ["Wrong date or deadline", "Link not working", "Closed or cancelled", "Eligibility is wrong", "Looks like a scam", "Something else"]
    body = f"""<div {data_attrs(o)}>{hero}
<section class="section" style="padding-top:2.25rem"><div class="wrap detail">
  <article class="prose">
    <p style="font-size:1.12rem;color:var(--ink)">{e(o['summary'])}</p>
    <h2>Who can apply</h2>
    <p>{e(o['who'])}</p>
    <h2>Dates</h2>
    <p>{e(o['dates'])}</p>
    <div class="members-only members-content">
      <h2>How to apply</h2>
      <ol>{steps}</ol>
      {note}
      <h2>What it costs and what you get</h2>
      <p><strong>Cost:</strong> {e(o['cost'])}</p>
      <p><strong>Benefits:</strong> {e(o['benefits'])}</p>
    </div>
    {lock_card("Unlock how to apply", "Create a free SWABUD account to see the full listing and keep track of it.",
               ["The official application link", "Step-by-step how to apply" + (" and SWABUD's tips" if o["notes"] else ""), "Cost, benefits and level", "Calendar reminders and your personal tracker"],
               f"opportunities/{o['slug']}.html", pre, "lock-inline")}
    <h2>Before you apply</h2>
    <ul class="checklist">
      <li>{icon("check")}<span>Open the official page and confirm the dates in Nepal time.</span></li>
      <li>{icon("check")}<span>Read the eligibility rules in full, including age and country.</span></li>
      <li>{icon("check")}<span>Never pay an agent or a third party to apply. Official programmes say clearly if there is a fee.</span></li>
      <li>{icon("check")}<span>Save a copy of your application and any confirmation email.</span></li>
    </ul>
    <h2>Share it with a friend</h2>
    <div class="share-row">{shares}</div>
    <details class="report">
      <summary>{icon("flag")}Report a problem with this listing</summary>
      <form data-form="report" data-subject="Listing report: {e(o['title'])}" novalidate>
        {honeypot()}
        <input type="hidden" name="listing" value="{e(o['title'])}">
        <input type="hidden" name="listing_url" value="{e(share)}">
        <div class="form-grid">
          <div class="field"><label for="r-issue">What's wrong? (required)</label><select class="input" id="r-issue" name="issue" required>{opts(issues, "Choose one")}</select></div>
          <div class="field"><label for="r-email">Your email (optional)</label><input class="input" id="r-email" name="email" type="email" autocomplete="email"></div>
          <div class="field full"><label for="r-details">Details (required)</label><textarea class="input" id="r-details" name="details" required maxlength="1500" placeholder="What is wrong, and where did you see the correct information?"></textarea></div>
        </div>
        <p class="error" data-form-error role="alert" hidden></p>
        <button class="btn btn-navy btn-sm" type="submit" style="margin-top:1rem">{icon("send")}Send report</button>
        {form_result()}
      </form>
    </details>
  </article>
  <aside class="factsheet" aria-label="Key facts">
    {ticker_html(o)}
    <dl>
      <div><dt>Status</dt><dd>{pill(o)}</dd></div>
      <div><dt>When</dt><dd>{e(short_when(o))}</dd></div>
      <div><dt>Format and location</dt><dd>{e(o['mode'])} · {e(o['location'])}</dd></div>
      <div class="members-only"><dt>Cost</dt><dd>{e(o['cost'])}</dd></div>
      <div class="members-only"><dt>Benefits</dt><dd>{e(o['benefits'])}</dd></div>
      <div class="members-only"><dt>Level</dt><dd>{e(o['level'])}</dd></div>
      <div><dt>Last verified by SWABUD</dt><dd>{e(verified)}</dd></div>
    </dl>
    <div class="actions">
      <div class="members-only members-content">{go}</div>
      <a class="btn btn-lime visitors-only" href="{pre}login.html" data-set-next="opportunities/{o['slug']}.html">{icon("lock")}Log in to apply</a>
      <a class="btn btn-ghost visitors-only" href="{pre}signup.html" data-set-next="opportunities/{o['slug']}.html">Create a free account</a>
      {save_btn(o, "btn btn-ghost save-btn save-wide")}
      <div class="members-only">{cal_html}</div>
    </div>
  </aside>
</div></section>
<section class="section section-alt"><div class="wrap">
  <div class="section-head"><div><p class="eyebrow">Keep exploring</p><h2>Related opportunities</h2></div><a class="link-arrow" href="{pre}opportunities.html">All opportunities {icon("arrow")}</a></div>
  <div class="card-grid">{rel}</div>
</div></section></div>"""
    ld = []
    if o["start"] and o["category"] in ("events", "hackathons", "ctf"):
        online = mode_key(o["mode"]) == "online"
        loc = ({"@type": "VirtualLocation", "url": canonical(o)} if online else
               {"@type": "Place", "name": o["location"], "address": {"@type": "PostalAddress", "addressLocality": o["location"].split(",")[-2].strip() if "," in o["location"] else o["location"], "addressCountry": "NP"}})
        ld.append({"@context": "https://schema.org", "@type": "Event", "name": o["title"], "startDate": o["start"], "endDate": o["end"] or o["start"],
                   "eventStatus": "https://schema.org/EventScheduled",
                   "eventAttendanceMode": "https://schema.org/MixedEventAttendanceMode" if mode_key(o["mode"]) == "both" else ("https://schema.org/OnlineEventAttendanceMode" if online else "https://schema.org/OfflineEventAttendanceMode"),
                   "location": loc, "description": o["summary"], "url": canonical(o), "organizer": {"@type": "Organization", "name": o["organizer"]}})
    # part of the page is for members only: tell search engines (paywalled-content markup)
    ld.append({"@context": "https://schema.org", "@type": "WebPage", "name": o["title"], "url": canonical(o), "isAccessibleForFree": False,
               "hasPart": {"@type": "WebPageElement", "isAccessibleForFree": False, "cssSelector": ".members-content"}})
    return page(f"opportunities/{o['slug']}.html", o["title"], o["summary"][:155], body, "opportunities.html", pre, ld)

def build_ics(o):
    def ev(uid, title, s, en, desc):
        return ("BEGIN:VEVENT\r\n" f"UID:{uid}@swabud.tech\r\n" f"DTSTAMP:{BUILD_DATE.strftime('%Y%m%d')}T000000Z\r\n"
                f"DTSTART;VALUE=DATE:{s.strftime('%Y%m%d')}\r\n" f"DTEND;VALUE=DATE:{en.strftime('%Y%m%d')}\r\n"
                f"SUMMARY:{title}\r\n" f"DESCRIPTION:{desc}\r\n" f"URL:{canonical(o)}\r\n" "END:VEVENT\r\n")
    clean = lambda t: t.replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", " ")
    desc = clean(o["summary"] + " Details: " + canonical(o))
    events = ""
    if o["start"]:
        events += ev(o["slug"] + "-event", clean(o["title"]), d(o["start"]), d(o["end"] or o["start"]) + datetime.timedelta(days=1), desc)
    if o["deadline"]:
        events += ev(o["slug"] + "-deadline", clean("Deadline: " + o["title"]), d(o["deadline"]), d(o["deadline"]) + datetime.timedelta(days=1), desc)
    if not events: return
    with open(os.path.join(ROOT, "opportunities", o["slug"] + ".ics"), "w", newline="") as f:
        f.write("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SWABUD//swabud.tech//EN\r\nCALSCALE:GREGORIAN\r\n" + events + "END:VCALENDAR\r\n")

def build_calendar():
    items = []
    for o in OPPS:
        if status_now(o) == "closed": continue
        if o["opens"] and d(o["opens"]) >= BUILD_DATE:
            items.append((d(o["opens"]), "opens", o))
        if o["deadline"] and d(o["deadline"]) >= BUILD_DATE:
            items.append((d(o["deadline"]), "deadline", o))
        if o["start"]:
            st, en = d(o["start"]), d(o["end"] or o["start"])
            if en >= BUILD_DATE:
                items.append((max(st, BUILD_DATE) if st < BUILD_DATE else st, "event", o))
    items.sort(key=lambda x: (x[0], x[2]["title"]))
    months = {}
    for dt, kind, o in items:
        months.setdefault((dt.year, dt.month), []).append((dt, kind, o))
    cal = calendar.Calendar(firstweekday=6)
    blocks = ""
    for (y, m), its in months.items():
        marked = {}
        for dt, kind, o in its:
            marked.setdefault(dt.day, set()).add(kind)
        cells = "".join(f'<span class="dow">{w}</span>' for w in ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])
        for day in cal.itermonthdays(y, m):
            if day == 0:
                cells += '<span class="day empty"></span>'; continue
            k = marked.get(day, set())
            cls = "day" + (" has-deadline" if "deadline" in k else "") + (" has-event" if "event" in k else "") + (" has-opens" if "opens" in k else "") + (" today" if datetime.date(y, m, day) == BUILD_DATE else "")
            cells += f'<span class="{cls}" data-date="{datetime.date(y, m, day).isoformat()}">{day}</span>'
        rows = ""
        for dt, kind, o in its:
            ongoing = kind == "event" and d(o["start"]) < BUILD_DATE
            label = {"deadline": "Deadline", "opens": "Applications open"}.get(kind) or ("Happening now" if ongoing else ("Event" if o["category"] == "events" else "Starts"))
            gl = gcal(o, kind if kind in ("deadline", "opens") else "event")
            rows += f"""<li class="cal-item" {data_attrs(o)} data-slug="{o['slug']}" data-date="{dt.isoformat()}" data-kind="{kind}">
  <span class="board-date cal-date"><b>{dt.day}</b><small>{dt.strftime('%a')}</small></span>
  <span class="cal-body"><span class="cal-kind cal-{kind}">{label}</span><a href="opportunities/{o['slug']}.html">{e(o['title'])}</a>
  <span class="cal-meta">{pill(o)}<span>{e(o['location'].split(' (')[0])}</span></span></span>
  {ext(gl, icon("calendar") + '<span class="visually-hidden">Add ' + e(o['title']) + ' to </span>Google Calendar', "share-link cal-add")}
</li>"""
        blocks += f"""<section class="cal-month">
  <h2>{calendar.month_name[m]} {y}</h2>
  <div class="cal-layout">
    <div class="cal-grid" aria-hidden="true">{cells}</div>
    <ol class="cal-list">{rows}</ol>
  </div>
</section>"""
    expected = [o for o in sorted_opps() if status_now(o) in ("upcoming", "recurring") and not o["start"] and not o["deadline"]]
    exp_rows = "".join(f'<li><a href="opportunities/{o["slug"]}.html">{e(o["title"])}</a><span>{e(short_when(o))}</span></li>' for o in expected)
    teaser = ""
    for dt, kind, o in items[:4]:
        label = {"deadline": "Deadline", "opens": "Applications open"}.get(kind) or ("Happening now" if d(o["start"]) < BUILD_DATE else ("Event" if o["category"] == "events" else "Starts"))
        teaser += f"""<li class="cal-item cal-teaser" {data_attrs(o)}>
  <span class="board-date cal-date"><b>{dt.day}</b><small>{dt.strftime('%b')}</small></span>
  <span class="cal-body"><span class="cal-kind cal-{kind}">{label}</span><a href="opportunities/{o['slug']}.html">{e(o['title'])}</a>
  <span class="cal-meta">{pill(o)}</span></span>
</li>"""
    body = page_head("Calendar", "Deadline calendar", "Every confirmed opening date, deadline and event date in one place, in the order they happen. Add any of them to your own calendar.",
                     [("index.html", "Home"), ("", "Calendar")],
                     '<div class="legend"><span><i class="dot dot-deadline"></i>Deadline</span><span><i class="dot dot-event"></i>Event or start date</span><span><i class="dot dot-opens"></i>Applications open</span></div>') + f"""
<section class="section" style="padding-top:2.25rem"><div class="wrap">
  <div class="visitors-only">
    <div class="section-head"><div><p class="eyebrow">Preview</p><h2>The next {min(4, len(items))} dates</h2><p>{len(items)} confirmed dates are on the calendar right now.</p></div></div>
    <ol class="cal-list" style="max-width:46rem">{teaser}</ol>
    <div style="margin-top:2rem">{lock_card("Open the full deadline calendar", f"Members see all {len(items)} dates month by month, can filter to the opportunities they saved, and add any date to Google Calendar in one tap.",
        ["Every opening date, deadline and event date", "A \"My saved dates\" view of just your opportunities", "Google Calendar and .ics reminders", "Dates for listings expected later in the year"], "calendar.html")}</div>
  </div>
  <div class="members-only">
    <div class="cal-toolbar">
      <div class="chips" role="group" aria-label="Show dates">
        <button class="chip" type="button" data-cal-filter="all" aria-pressed="true">All dates</button>
        <button class="chip" type="button" data-cal-filter="mine" aria-pressed="false" data-auth-in>My saved dates</button>
      </div>
      <a class="link-arrow" href="profile.html#saved" data-auth-in>Export my dates {icon("arrow")}</a>
    </div>
    <div class="empty" data-cal-empty hidden><h3>None of your saved opportunities have dates yet</h3><p>Save opportunities with deadlines or event dates and they will appear here.</p><a class="btn btn-navy" href="opportunities.html">Browse opportunities</a></div>
    {blocks}
    <section class="cal-month" data-cal-expected>
      <h2>Coming later, dates not yet announced</h2>
      <p style="color:var(--muted);margin-top:.5rem;max-width:44rem">These run every year. We add exact dates as soon as the organizers publish them.</p>
      <ul class="expected">{exp_rows}</ul>
    </section>
  </div>
</div></section>"""
    return page("calendar.html", "Deadline calendar", "A calendar of upcoming deadlines and event dates for hackathons, CTFs, conferences and programmes for students in Nepal.", body, "calendar.html")

def build_saved():
    body = page_head("Saved", "Saved opportunities", "Saving opportunities and tracking your applications is part of your free SWABUD account.",
                     [("index.html", "Home"), ("", "Saved")]) + f"""
<section class="section" style="padding-top:2.25rem"><div class="wrap" style="max-width:52rem">
  <div class="gate-card" data-auth-in><span class="cat-icon">{icon("list")}</span><h2>Opening your tracker...</h2><p>Your saved opportunities live in your dashboard.</p>
    <div class="gate-actions"><a class="btn btn-lime" href="profile.html#saved">Open my tracker {icon("arrow")}</a></div></div>
  {lock_card("Save opportunities and track every application", "Bookmarks are saved to your account, so they follow you from your phone to your laptop.",
             ["Save any opportunity in one tap", "Move each one from Saved to Applied to Accepted", "Private notes and an application checklist", "Deadline heads-up when something you saved is about to close"], "profile.html#saved")}
</div></section>"""
    return page("saved.html", "Saved opportunities", "Save opportunities and track your applications with a free SWABUD account.", body, "", noindex=True, page_id="saved")

def build_sources():
    toc = '<div class="toc">' + "".join(f'<a href="#{g["id"]}">{e(g["title"])}</a>' for g in SOURCES) + "</div>"
    groups = "".join(f"""<section class="source-group" id="{g['id']}" style="scroll-margin-top:90px">
  <h2>{e(g['title'])}</h2><p>{e(g['intro'])}</p>
  <div class="source-grid">{''.join(source_card(s) for s in g['items'])}</div>
</section>""" for g in SOURCES)
    overview = "".join(f'<div class="value"><h3>{e(g["title"])}</h3><p>{e(g["intro"])}</p><p class="lock-count">{icon("lock")}{len(g["items"])} sources</p></div>' for g in SOURCES)
    body = page_head("Sources", "Go straight to the source", f"{N_SOURCES} official platforms, programmes and portals SWABUD watches. Every link opens the organizer's own site in a new tab.",
                     [("index.html", "Home"), ("", "Sources")], f'<div class="members-only">{toc}</div>') + f"""<section class="section"><div class="wrap">
  <div class="visitors-only">
    <div class="value-grid source-preview">{overview}</div>
    <div style="margin-top:2rem">{lock_card(f"Unlock all {N_SOURCES} official sources", "The places where opportunities are announced first: competition platforms, CTF calendars, open-source programmes, scholarship portals, Nepal tech communities and student perks.",
        ["Direct links to every official platform", "What each one is best for", "Grouped by goal, from first CTF to funded master's"], "sources.html")}</div>
  </div>
  <div class="members-only">{groups}</div>
</div></section>"""
    return page("sources.html", "Opportunity sources", "Official websites for hackathons, CTFs, open-source programmes, internships, scholarships, volunteering and tech communities, curated for students in Nepal.", body, "sources.html")

def build_learn():
    toc = '<div class="toc">' + "".join(f'<a href="#{t["id"]}">{e(t["title"])}</a>' for t in LEARN) + "</div>"
    tracks = ""
    for t in LEARN:
        n = len(t["steps"])
        steps = "".join(f'<li><label class="step-check"><input type="checkbox" data-learn-step="{t["id"]}" value="{i}" disabled><span>{e(x)}</span></label></li>' for i, x in enumerate(t["steps"]))
        res = "".join(source_card({"name": r["name"], "url": r["url"], "desc": r["desc"], "tag": "Free"}) for r in t["resources"])
        tracks += f"""<section class="track" id="{t['id']}">
  <div><h2><span class="cat-icon">{icon(t['icon'])}</span>{e(t['title'])}</h2><p class="pitch">{e(t['pitch'])}</p>
    <div class="learn-progress" data-learn-bar="{t['id']}" data-total="{n}"><span class="bar"><i></i></span><b data-learn-text>0 of {n} steps done</b></div>
    <ol class="path path-check">{steps}</ol>
    <p style="margin-top:.5rem">{ext(t['roadmap'], 'Full roadmap on roadmap.sh ' + icon("external"), "link-arrow")}</p></div>
  <div class="res-list">{res}</div>
</section>"""
    overview = "".join(f"""<div class="track-card">
  <span class="cat-icon">{icon(t['icon'])}</span><h3>{e(t['title'])}</h3><p>{e(t['pitch'])}</p>
  <p class="lock-count">{icon("lock")}{len(t['steps'])} steps · {len(t['resources'])} free resources</p>
</div>""" for t in LEARN)
    body = page_head("Learn", "Learn for free, then apply with confidence", "Six learning paths with the best free resources we know. Follow the steps in order, tick them off as you go, and build something at each one.",
                     [("index.html", "Home"), ("", "Learn")], f'<div class="members-only">{toc}</div>') + f"""
<div class="wrap visitors-only" style="padding-block:2.5rem 4rem">
  <div class="track-grid">{overview}</div>
  <div style="margin-top:2rem">{lock_card("Start a learning path", "Members get every step and resource, and can tick steps off to track their progress on any device.",
      ["Step-by-step paths in web, security, data and AI, CS, cloud and design", "Hand-picked free courses and official docs", "Progress saved to your account and shown on your dashboard"], "learn.html")}</div>
</div>
<div class="wrap members-only"><p class="learn-hint" data-auth-out>Log in to save your progress.</p><p class="learn-hint" data-auth-in>{icon("check")}Tick steps as you finish them. Your progress is saved to your account.</p>{tracks}</div>"""
    return page("learn.html", "Learn for free", "Free learning paths in web development, cybersecurity, data and AI, computer science, cloud and design, with official resource links.", body, "learn.html")

def build_career():
    sections = [
        ("cv", "Write an internship CV", """<p>Recruiters spend under a minute on a first read, so keep it to one page and put your strongest proof near the top.</p>
<ol><li><strong>Header:</strong> name, city, phone, a professional email, LinkedIn and GitHub or portfolio link.</li>
<li><strong>Summary (2 lines):</strong> what you study, what you build, what role you want. Example: "Third-year BSc CSIT student who builds web apps with React and Node. Looking for a frontend internship."</li>
<li><strong>Skills:</strong> grouped (Languages, Frameworks, Tools). List only what you can use in an interview.</li>
<li><strong>Projects:</strong> 2 to 4, each with one line on the problem, the stack and a result or link.</li>
<li><strong>Education:</strong> degree, college, expected graduation year.</li>
<li><strong>Extras:</strong> hackathons, CTFs, club roles, volunteering, certifications.</li></ol>
<ul class="checklist">
<li>{check}<span>Save as PDF named <code>Firstname-Lastname-CV.pdf</code>.</span></li>
<li>{check}<span>Use action verbs: built, designed, reduced, led.</span></li>
<li>{check}<span>No photo, date of birth or citizenship number unless the employer asks.</span></li>
<li>{check}<span>Tailor the summary and project order to each role.</span></li></ul>"""),
        ("portfolio", "Build a portfolio with no work experience", """<p>Your projects are your experience. Three finished, documented projects beat ten half-done ones.</p>
<ul><li><strong>Solve a local problem:</strong> a bus route finder for your city, a college notice board, a Nepali-English vocabulary app.</li>
<li><strong>Write a README for each project:</strong> what it does, a screenshot, how to run it, what you learned.</li>
<li><strong>Deploy it:</strong> a live link is far more convincing than code alone. GitHub Pages, Cloudflare Pages and Vercel have free tiers.</li>
<li><strong>Show your process:</strong> short write-ups of a bug you fixed or a CTF you solved show how you think.</li></ul>"""),
        ("linkedin", "Set up LinkedIn properly", """<ul class="checklist">
<li>{check}<span>Clear photo, and a headline that says what you do: "BIT student · Web developer · Open to internships".</span></li>
<li>{check}<span>An About section of 3 to 5 lines in plain language.</span></li>
<li>{check}<span>Projects and certifications added with links.</span></li>
<li>{check}<span>Set "Open to work" for internships, visible to recruiters only if you prefer.</span></li>
<li>{check}<span>Post once a week about something you built or learned.</span></li></ul>"""),
        ("applications", "Write applications that get read", """<p>Most applications fail on basics: missed instructions, generic text or a missing link.</p>
<ol><li>Read the whole call twice and list every required item.</li>
<li>Answer the actual question in the first sentence of each response.</li>
<li>Use one specific example per claim: "I led a team of 4 at a 24-hour hackathon" instead of "I am a team player".</li>
<li>Submit 24 hours before the deadline. Portals slow down on the last day.</li>
<li>Email follow-ups: short, polite, with the role name in the subject line.</li></ol>"""),
        ("hackathons", "Prepare for a hackathon or CTF", """<ul><li><strong>Form a balanced team:</strong> someone who builds, someone who designs or presents, someone who knows the problem area.</li>
<li><strong>Set up before the clock starts:</strong> GitHub repo, a starter template, accounts for any APIs you plan to use.</li>
<li><strong>Scope small:</strong> one working feature with a clear demo beats five broken ones.</li>
<li><strong>For CTFs:</strong> split challenges by category, keep shared notes, and write up solutions afterwards.</li>
<li><strong>Practise the demo:</strong> 2 minutes on the problem, 2 on the demo, 1 on what's next.</li></ul>"""),
        ("interviews", "Prepare for interviews", """<ul><li><strong>Know your CV:</strong> be ready to explain every line and every project decision.</li>
<li><strong>Practise out loud:</strong> "Tell me about yourself" in 60 seconds, plus one story each for a challenge, a failure and teamwork.</li>
<li><strong>Technical rounds:</strong> practise problems on paper and explain your thinking as you go.</li>
<li><strong>Ask questions:</strong> about the team, the work you would do and how interns are supported.</li>
<li><strong>Online interviews:</strong> test your internet, camera and microphone 15 minutes early.</li></ul>"""),
        ("scams", "Spot fake opportunities", """<p>Real programmes publish their rules openly and never pressure you to pay quickly. Be careful when you see any of these:</p>
<ul class="checklist">
<li>{alert}<span>A fee to "reserve a seat", "process your selection" or "unlock your offer letter".</span></li>
<li>{alert}<span>No official website, or a website that copies a real organization's name with a slightly different address.</span></li>
<li>{alert}<span>Requests for citizenship copies, bank details, OTP codes or passwords at the application stage.</span></li>
<li>{alert}<span>Guaranteed jobs, guaranteed visas or prizes with no rules.</span></li>
<li>{alert}<span>Contact only through a personal phone number or a free email address.</span></li></ul>
<p>When in doubt, search the organizer's official site yourself instead of using the link you were sent, and ask your college or SWABUD at <code>{email}</code>.</p>"""),
        ("scholarship-docs", "Prepare scholarship documents early", """<p>Government scholarships often need documents that take weeks to collect. Start a folder now:</p>
<ul><li>Academic transcripts and certificates, attested by Nepal's Ministry of Foreign Affairs where required</li>
<li>Passport, valid well beyond your intended study period</li>
<li>English test scores, if required (check each programme's rules)</li>
<li>Two or three referees who know your academic or work record</li>
<li>Drafts of your personal statement, study plan and career plan</li></ul>
<p>Apply only through the official website or embassy. Government scholarships do not need paid agents.</p>"""),
    ]
    public = ("cv", "scams")  # free for everyone; the rest are for members
    toc = '<div class="toc">' + "".join(f'<a href="#{sid}">{e(t)}{"" if sid in public else LOCK_TAG}</a>' for sid, t, _ in sections) + "</div>"
    content = ""
    for i, (sid, t, html) in enumerate(sections):
        content += f"""<section class="track{'' if sid in public else ' members-only'}" id="{sid}" style="grid-template-columns:minmax(0,0.75fr) minmax(0,1.25fr)">
  <div><p class="eyebrow">Guide {i + 1} of {len(sections)}</p><h2 style="margin-top:.6rem">{e(t)}</h2></div>
  <div class="prose">{html.replace('{check}', icon('check')).replace('{alert}', icon('alert')).replace('{email}', SITE['email'])}</div>
</section>"""
        if i == 0:
            content += f'<div style="padding-block:1rem 2.5rem">{lock_card("Read all 8 career guides", "Two guides are open to everyone. Members get the full set, written for students in Nepal.", [e(x[1]) for x in sections if x[0] not in public], "career.html")}</div>'
    body = page_head("Career guides", "Get ready to apply", "Short, practical guides for students in Nepal: CVs, portfolios, LinkedIn, applications, hackathons, interviews and staying safe from fake offers.",
                     [("index.html", "Home"), ("", "Career guides")], toc) + f'<div class="wrap">{content}</div>'
    return page("career.html", "Career guides", "Practical guides for students: internship CVs, portfolios without experience, LinkedIn, applications, hackathon prep, interviews and spotting fake opportunities.", body, "career.html")

def submit_fields(px="s"):
    cats = [c[1] for c in CATS]
    return f"""<fieldset>
        <legend>The opportunity</legend>
        <div class="form-grid">
          <div class="field full"><label for="{px}-title">Title (required)</label><input class="input" id="{px}-title" name="title" required maxlength="140" placeholder="e.g. Butwal Student Hackathon 2027"></div>
          <div class="field"><label for="{px}-category">Category (required)</label><select class="input" id="{px}-category" name="category" required>{opts(cats, "Choose a category")}</select></div>
          <div class="field"><label for="{px}-org">Organizer (required)</label><input class="input" id="{px}-org" name="organizer" required maxlength="120" placeholder="Company, college or community"></div>
          <div class="field full"><label for="{px}-link">Official link (required)</label><input class="input" id="{px}-link" name="official_link" type="url" required pattern="https?://.+" placeholder="https://"><span class="hint">The organizer's own page where students apply or register.</span></div>
          <div class="field"><label for="{px}-opens">Applications open</label><input class="input" id="{px}-opens" name="opens" type="date"></div>
          <div class="field"><label for="{px}-deadline">Application deadline</label><input class="input" id="{px}-deadline" name="deadline" type="date"></div>
          <div class="field"><label for="{px}-date">Event or start date</label><input class="input" id="{px}-date" name="start_date" type="date"></div>
          <div class="field"><label for="{px}-end">End date</label><input class="input" id="{px}-end" name="end_date" type="date"></div>
          <div class="field"><label for="{px}-mode">Format (required)</label><select class="input" id="{px}-mode" name="format" required>{opts(["Online", "In person", "Online or in person"], "Choose")}</select></div>
          <div class="field"><label for="{px}-location">Location</label><input class="input" id="{px}-location" name="location" maxlength="100" placeholder="City, or Remote"></div>
          <div class="field"><label for="{px}-cost">Cost for students</label><input class="input" id="{px}-cost" name="cost" maxlength="100" placeholder="Free, or the exact fee"></div>
          <div class="field"><label for="{px}-level">Level</label><select class="input" id="{px}-level" name="level">{opts(["Beginner-friendly", "Intermediate", "Advanced", "All levels"], "Choose")}</select></div>
          <div class="field full"><label for="{px}-who">Who can apply (required)</label><input class="input" id="{px}-who" name="who_can_apply" required maxlength="200" placeholder="e.g. Bachelor's IT students, any year, teams of 2 to 4"></div>
          <div class="field full"><label for="{px}-desc">Short description (required)</label><textarea class="input" id="{px}-desc" name="description" required maxlength="1500" placeholder="What it is, what participants get, anything students should know"></textarea></div>
        </div>
      </fieldset>"""

def submit_aside():
    return f"""<div class="callout"><h3>{icon("check")}What we list</h3><ul>
      <li>Hackathons, CTFs and competitions</li><li>Internships, fellowships and mentorships</li><li>Scholarships and exchange programmes</li><li>Events, conferences, workshops and meetups</li><li>Courses (free or paid), volunteering and student programmes</li></ul></div>
    <div class="callout callout-warn"><h3>{icon("alert")}What we don't list</h3><ul>
      <li>Anything that charges students to "reserve" a place</li><li>Offers with no official page or named organizer</li><li>Paid courses presented as scholarships</li><li>Recruitment that asks for fees or bank details</li></ul></div>"""

def build_submit():
    body = page_head("Submit", "Submit an opportunity", "Listing on SWABUD is free. Submit from your profile, and follow the review of everything you send in one place.",
                     [("index.html", "Home"), ("", "Submit")]) + f"""
<section class="section" style="padding-top:2.25rem"><div class="wrap detail">
  <div>
    <div class="gate-card" data-auth-out>
      <span class="cat-icon">{icon("lock")}</span>
      <h2>Log in to submit an opportunity</h2>
      <p>Submissions now come from your SWABUD profile, so we can reply to you, show you the review status of each one, and keep spam off the board. It takes less than a minute with Google.</p>
      <div class="gate-actions">
        <button class="btn btn-google" type="button" data-google-signin data-next="profile.html#submit">{GOOGLE_G}Continue with Google</button>
        <a class="btn btn-navy" href="login.html" data-set-next="profile.html#submit">Log in with email</a>
        <a class="btn btn-ghost" href="signup.html" data-set-next="profile.html#submit">Create an account</a>
      </div>
      <p class="hint">An organizer without an account? Email the details and the official link to <code>{SITE['email']}</code>.</p>
    </div>
    <div class="gate-card" data-auth-in>
      <span class="cat-icon">{icon("send")}</span>
      <h2>You're logged in</h2>
      <p>The submission form is in your profile, together with the status of everything you've sent.</p>
      <div class="gate-actions"><a class="btn btn-lime" href="profile.html#submit">Open the submission form {icon("arrow")}</a></div>
    </div>
  </div>
  <aside style="display:grid;gap:1rem;align-content:start">
    {submit_aside()}
    <div class="callout"><h3>{icon("clock")}What happens next</h3><ul>
      <li>Your submission is saved to your profile and arrives at {SITE['email']}.</li><li>We check it against the official link and may email you with questions.</li><li>Once confirmed, it goes live with today's check date and your profile shows it as published.</li></ul></div>
  </aside>
</div></section>"""
    return page("submit.html", "Submit an opportunity", "Organizers and students can submit hackathons, CTFs, internships, scholarships, events and programmes to SWABUD for free from their profile.", body, "", page_id="submit")

# ---------------------------------------------------------------- accounts
def auth_side():
    perks = [("bookmark", "Saved on every device", "Bookmark on your phone, open it on your laptop."),
             ("list", "Track every application", "Saved, Preparing, Applied, Accepted, with your notes."),
             ("clock", "Know what's next", "Your deadlines and opening dates, counting down."),
             ("send", "Submit opportunities", "Share a call and follow its review from your profile.")]
    li = "".join(f'<li><span class="cat-icon">{icon(i)}</span><span><strong>{e(t)}</strong><span>{e(p)}</span></span></li>' for i, t, p in perks)
    return f"""<aside class="auth-side navy"><div class="navy-pattern"></div>
    <div class="auth-side-inner frame">
      <img src="assets/img/logo-lockup-white.svg" alt="SWABUD: Discover. Connect. Grow." width="220" height="46">
      <h2>Your opportunities, organized.</h2>
      <ul class="auth-perks">{li}</ul>
      <p class="auth-free">Free for students. We never sell your data.</p>
    </div>
  </aside>"""

def auth_notes():
    return f"""<div class="mode-note" data-demo-note hidden>{icon("alert")}<span><strong>Preview mode.</strong> Accounts in this preview are stored only in this browser and no emails are sent; codes appear on screen. On swabud.tech, sign-in runs on Supabase with real Google sign-in and emailed codes.</span></div>
      <div class="mode-note" data-setup-note hidden>{icon("clock")}<span><strong>Accounts are being set up.</strong> Sign-in opens soon. Until then you can still browse, save opportunities on this device, and email <code>{SITE['email']}</code>.</span></div>"""

def pw_field(fid, label, auto, minlen=True, meter=False):
    m = '<div class="pw-meter" data-pw-meter aria-hidden="true"><i></i><i></i><i></i><i></i></div><span class="hint" data-pw-hint>At least 8 characters. Mix letters, numbers and a symbol.</span>' if meter else ""
    return f"""<div class="field full"><label for="{fid}">{label}</label>
          <div class="pw-wrap"><input class="input" id="{fid}" name="{fid}" type="password" required {'minlength="8"' if minlen else ''} autocomplete="{auto}" maxlength="72"><button class="pw-toggle" type="button" data-pw-toggle="{fid}" aria-label="Show password" aria-pressed="false">{icon("eye")}</button></div>{m}</div>"""

def code_field(fid):
    return f"""<div class="field full"><label for="{fid}">6-digit code (required)</label>
          <input class="input code-input" id="{fid}" name="code" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{{6,10}}" maxlength="10" placeholder="••••••"></div>"""

def auth_page(path, title, desc, card, page_id):
    body = f"""<section class="auth-wrap"><div class="wrap auth-grid">
  {auth_side()}
  <div class="auth-card">
    {auth_notes()}
    {card}
  </div>
</div></section>"""
    return page(path, title, desc, body, "", noindex=True, page_id=page_id)

def build_login():
    card = f"""<div data-step="login">
      <p class="eyebrow">Welcome back</p>
      <h1>Log in to SWABUD</h1>
      <p class="auth-lead">Pick up where you left off: your saved list, tracker and next deadlines.</p>
      <button class="btn btn-google" type="button" data-google-signin>{GOOGLE_G}Continue with Google</button>
      <div class="or"><span>or log in with email</span></div>
      <form class="auth-form" id="login-form" novalidate>
        <div class="form-grid">
          <div class="field full"><label for="l-email">Email</label><input class="input" id="l-email" name="email" type="email" required autocomplete="email" placeholder="you@example.com"></div>
          {pw_field("l-password", "Password", "current-password", minlen=False)}
        </div>
        <div class="auth-row"><span></span><a href="forgot-password.html" data-carry-email="#l-email">Forgot password?</a></div>
        <p class="error" data-auth-error role="alert" hidden></p>
        <button class="btn btn-lime btn-block" type="submit">{icon("lock")}Log in</button>
      </form>
      <p class="auth-switch">New to SWABUD? <a href="signup.html">Create a free account</a></p>
    </div>
    <div data-step="code" hidden>
      <p class="eyebrow">Confirm your email</p>
      <h1>Enter your code</h1>
      <p class="auth-lead">Your email isn't confirmed yet. We sent a new code to <strong data-code-email></strong>.</p>
      <div class="demo-code" data-demo-code hidden></div>
      <form class="auth-form" id="login-code-form" novalidate>
        <div class="form-grid">{code_field("lc-code")}</div>
        <p class="error" data-auth-error role="alert" hidden></p>
        <button class="btn btn-lime btn-block" type="submit">{icon("check")}Confirm and log in</button>
      </form>
      <div class="auth-row"><button class="link-btn" type="button" data-resend="signup">Resend code</button><button class="link-btn" type="button" data-back="login">Back to log in</button></div>
    </div>"""
    return auth_page("login.html", "Log in", "Log in to your SWABUD account with Google or email.", card, "login")

def build_signup():
    interest = "".join(f'<label class="chip-check"><input type="checkbox" name="interests" value="{c[0]}"><span>{e(c[2])}</span></label>' for c in CATS)
    card = f"""<div data-step="signup">
      <p class="eyebrow">Free account</p>
      <h1>Create your SWABUD account</h1>
      <p class="auth-lead">Save opportunities on every device, track your applications and see what's next.</p>
      <button class="btn btn-google" type="button" data-google-signin>{GOOGLE_G}Sign up with Google</button>
      <div class="or"><span>or sign up with email</span></div>
      <form class="auth-form" id="signup-form" novalidate>
        <div class="form-grid">
          <div class="field full"><label for="su-name">Full name (required)</label><input class="input" id="su-name" name="name" required maxlength="80" autocomplete="name"></div>
          <div class="field full"><label for="su-email">Email (required)</label><input class="input" id="su-email" name="email" type="email" required autocomplete="email" placeholder="you@example.com"></div>
          {pw_field("su-password", "Password (required)", "new-password", meter=True)}
          {pw_field("su-password2", "Confirm password (required)", "new-password")}
          <fieldset class="field full"><legend class="label">I'm interested in (optional)</legend><div class="chips">{interest}</div></fieldset>
          <label class="check full" for="su-terms"><input type="checkbox" id="su-terms" name="terms" required><span>I agree to the <a href="terms.html">terms of use</a> and <a href="privacy.html">privacy policy</a>. (required)</span></label>
        </div>
        <p class="error" data-auth-error role="alert" hidden></p>
        <button class="btn btn-lime btn-block" type="submit">{icon("user")}Create account</button>
      </form>
      <p class="auth-switch">Already have an account? <a href="login.html">Log in</a></p>
    </div>
    <div data-step="code" hidden>
      <p class="eyebrow">Step 2 of 2</p>
      <h1>Check your email</h1>
      <p class="auth-lead">We sent a 6-digit code to <strong data-code-email></strong>. Enter it below to confirm your account. It can take a minute to arrive; check spam too.</p>
      <div class="demo-code" data-demo-code hidden></div>
      <form class="auth-form" id="signup-code-form" novalidate>
        <div class="form-grid">{code_field("sc-code")}</div>
        <p class="error" data-auth-error role="alert" hidden></p>
        <button class="btn btn-lime btn-block" type="submit">{icon("check")}Confirm my account</button>
      </form>
      <div class="auth-row"><button class="link-btn" type="button" data-resend="signup">Resend code</button><button class="link-btn" type="button" data-back="signup">Use a different email</button></div>
    </div>"""
    return auth_page("signup.html", "Create an account", "Create a free SWABUD account with Google or email to save opportunities, track applications and submit listings.", card, "signup")

def build_forgot():
    card = f"""<div data-step="email">
      <p class="eyebrow">Forgot password</p>
      <h1>Reset your password</h1>
      <p class="auth-lead">Enter the email you signed up with. We'll send you a 6-digit code to set a new password.</p>
      <form class="auth-form" id="forgot-form" novalidate>
        <div class="form-grid"><div class="field full"><label for="fp-email">Email</label><input class="input" id="fp-email" name="email" type="email" required autocomplete="email" placeholder="you@example.com"></div></div>
        <p class="error" data-auth-error role="alert" hidden></p>
        <button class="btn btn-lime btn-block" type="submit">{icon("send")}Send reset code</button>
      </form>
      <p class="auth-switch">Remembered it? <a href="login.html">Back to log in</a></p>
      <p class="hint" style="margin-top:.75rem">Signed up with Google? You don't need a password: use Continue with Google on the log in page.</p>
    </div>
    <div data-step="reset" hidden>
      <p class="eyebrow">Step 2 of 2</p>
      <h1>Enter code and new password</h1>
      <p class="auth-lead">If an account exists for <strong data-code-email></strong>, a 6-digit code is on its way. Check spam if you don't see it.</p>
      <div class="demo-code" data-demo-code hidden></div>
      <form class="auth-form" id="reset-form" novalidate>
        <div class="form-grid">
          {code_field("rp-code")}
          {pw_field("rp-password", "New password", "new-password", meter=True)}
          {pw_field("rp-password2", "Confirm new password", "new-password")}
        </div>
        <p class="error" data-auth-error role="alert" hidden></p>
        <button class="btn btn-lime btn-block" type="submit">{icon("lock")}Reset password</button>
      </form>
      <div class="auth-row"><button class="link-btn" type="button" data-resend="recovery">Resend code</button><button class="link-btn" type="button" data-back="email">Use a different email</button></div>
    </div>
    <div data-step="newpass" hidden>
      <p class="eyebrow">Almost done</p>
      <h1>Choose a new password</h1>
      <p class="auth-lead">Your reset link worked. Set a new password for your account.</p>
      <form class="auth-form" id="newpass-form" novalidate>
        <div class="form-grid">
          {pw_field("np-password", "New password", "new-password", meter=True)}
          {pw_field("np-password2", "Confirm new password", "new-password")}
        </div>
        <p class="error" data-auth-error role="alert" hidden></p>
        <button class="btn btn-lime btn-block" type="submit">{icon("lock")}Save new password</button>
      </form>
    </div>
    <div data-step="done" hidden>
      <span class="done-icon">{icon("check")}</span>
      <h1>Password updated</h1>
      <p class="auth-lead">You're logged in with your new password.</p>
      <a class="btn btn-lime btn-block" href="profile.html">Go to my profile {icon("arrow")}</a>
    </div>"""
    return auth_page("forgot-password.html", "Reset your password", "Reset your SWABUD password with a code sent to your email.", card, "forgot")

def opp_payload():
    """Compact listing data embedded in profile.html for the tracker and recommendations."""
    out = []
    for o in OPPS:
        out.append({"s": o["slug"], "t": o["title"], "c": o["category"], "cl": CAT[o["category"]][2], "o": o["organizer"], "b": o["base"],
                    "op": o["opens"], "dl": o["deadline"], "st": o["start"], "en": o["end"], "r": o["region"], "f": 1 if o["free"] else 0,
                    "w": short_when(o), "lv": o["level"], "v": o["verified"], "l": o["link"]})
    return json.dumps(out, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

def build_profile():
    interest = "".join(f'<label class="chip-check"><input type="checkbox" name="interests" value="{c[0]}"><span>{e(c[2])}</span></label>' for c in CATS)
    stages = [("saved", "Saved"), ("preparing", "Preparing"), ("applied", "Applied"), ("accepted", "Accepted"), ("rejected", "Not selected")]
    filt = '<button class="chip" type="button" data-track-filter="" aria-pressed="true">All <span data-track-n=""></span></button>' + "".join(
        f'<button class="chip" type="button" data-track-filter="{k}" aria-pressed="false">{v} <span data-track-n="{k}"></span></button>' for k, v in stages)
    stats = [("saved", "Saved", "bookmark"), ("active", "Preparing or applied", "list"), ("closing", "Closing in 7 days", "clock"), ("submitted", "Submissions", "send")]
    stat_html = "".join(f'<div class="stat"><span class="cat-icon">{icon(i)}</span><b class="mono" data-stat="{k}">0</b><span>{e(t)}</span></div>' for k, t, i in stats)
    body = f"""<section class="navy profile-head"><div class="navy-pattern"></div>
  <div class="wrap"><div class="frame profile-id">
    <span class="avatar avatar-lg" data-avatar></span>
    <div class="profile-who">
      <p class="eyebrow">My SWABUD</p>
      <h1 data-profile-greet>Your profile</h1>
      <p data-profile-sub>Loading your account...</p>
    </div>
    <div class="profile-actions">
      <a class="btn btn-ghost-light btn-sm" href="#settings" data-tab-link="settings">{icon("settings")}Edit profile</a>
      <button class="btn btn-ghost-light btn-sm" type="button" data-signout>{icon("logout")}Sign out</button>
    </div>
  </div></div>
</section>
<div class="tabs-bar"><div class="wrap">
  <div class="tabs" role="tablist" aria-label="Profile sections">
    <button class="tab" role="tab" type="button" id="tab-overview" aria-controls="panel-overview" aria-selected="true" data-tab="overview">{icon("compass")}Overview</button>
    <button class="tab" role="tab" type="button" id="tab-saved" aria-controls="panel-saved" aria-selected="false" data-tab="saved">{icon("list")}Saved &amp; tracker <span class="tab-count" data-count-saved>0</span></button>
    <button class="tab" role="tab" type="button" id="tab-submit" aria-controls="panel-submit" aria-selected="false" data-tab="submit">{icon("send")}Submit</button>
    <button class="tab" role="tab" type="button" id="tab-settings" aria-controls="panel-settings" aria-selected="false" data-tab="settings">{icon("settings")}Settings</button>
  </div>
</div></div>

<section class="section profile-body"><div class="wrap">
  {auth_notes()}
  <div class="empty" data-profile-off hidden>
    <h3>Sign-in isn't available yet</h3>
    <p>Accounts are being set up. You can still browse and save opportunities on this device.</p>
    <a class="btn btn-navy" href="opportunities.html">Browse opportunities</a>
  </div>
  <p class="profile-loading" data-profile-loading>{icon("clock")}Loading your profile...</p>

  <div class="tab-panel" role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" data-panel="overview" hidden>
    <div class="stat-grid">{stat_html}</div>
    <div class="nudge" data-nudge hidden>{icon("spark")}<span>Pick your interests to get recommendations that fit you.</span><a class="btn btn-navy btn-sm" href="#settings" data-tab-link="settings">Choose interests</a></div>
    <div class="dash-grid">
      <div class="panel-card">
        <div class="panel-head"><div><h2>New since your last visit</h2><p data-new-sub>Listings added or re-checked since you were last here.</p></div></div>
        <ul class="mini-list" data-new-list></ul>
        <a class="link-arrow" href="opportunities.html" data-new-link style="margin-top:.8rem;font-size:.88rem">Browse all {icon("arrow")}</a>
      </div>
      <div class="panel-card">
        <div class="panel-head"><div><h2>Learning progress</h2><p>Steps you've ticked off on the learning paths.</p></div><a class="link-arrow" href="learn.html">Learn {icon("arrow")}</a></div>
        <ul class="mini-list" data-learn-list></ul>
      </div>
      <div class="panel-card">
        <div class="panel-head"><div><h2>Your profile</h2><p data-complete-text>Complete your profile for better recommendations.</p></div></div>
        <div class="meter"><i data-complete-bar style="width:0"></i></div>
        <ul class="mini-list" data-complete-list></ul>
        <a class="link-arrow" href="#settings" data-tab-link="settings" style="margin-top:.8rem;font-size:.88rem">Edit profile {icon("arrow")}</a>
      </div>
    </div>
    <div class="overview-grid">
      <div class="panel-card">
        <div class="panel-head"><div><h2>What's next for you</h2><p>Dates from your saved list, counting down in Nepal time.</p></div><a class="link-arrow" href="#saved" data-tab-link="saved">Tracker {icon("arrow")}</a></div>
        <ol class="next-list" data-next-list></ol>
        <div class="empty small" data-next-empty hidden><p>Save opportunities and their deadlines will appear here.</p><a class="btn btn-navy btn-sm" href="opportunities.html">Browse opportunities</a></div>
      </div>
      <div class="panel-card">
        <div class="panel-head"><div><h2>Coming up on SWABUD</h2><p>The next dates across every listing.</p></div><a class="link-arrow" href="calendar.html">Calendar {icon("arrow")}</a></div>
        <ol class="next-list" data-board-list></ol>
      </div>
    </div>
    <div class="section-head" style="margin-top:2.75rem"><div><p class="eyebrow">Picked for you</p><h2>Recommended for you</h2><p data-reco-why>Open now and closing soon.</p></div><a class="link-arrow" href="#settings" data-tab-link="settings">Change interests {icon("arrow")}</a></div>
    <div class="mini-grid" data-reco-list></div>
  </div>

  <div class="tab-panel" role="tabpanel" id="panel-saved" aria-labelledby="tab-saved" data-panel="saved" hidden>
    <div class="panel-head panel-head-lg"><div><h2>Saved and application tracker</h2><p>Move each opportunity through your own stages and keep private notes. Only you can see this.</p></div>
      <div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-ics-export>{icon("download")}Add my dates to calendar</button><a class="btn btn-navy btn-sm" href="opportunities.html">{icon("plus")}Find more</a></div></div>
    <div class="chips track-filters" role="group" aria-label="Filter by stage">{filt}</div>
    <ul class="track-list" data-track-list></ul>
    <div class="empty" data-track-empty hidden>
      <h3>Nothing here yet</h3>
      <p>Tap the bookmark on any opportunity to add it to your tracker.</p>
      <a class="btn btn-navy" href="opportunities.html">Browse opportunities</a>
    </div>
  </div>

  <div class="tab-panel" role="tabpanel" id="panel-submit" aria-labelledby="tab-submit" data-panel="submit" hidden>
    <div class="detail">
      <form class="form-card" id="profile-submit" data-form="submit" data-subject="New opportunity submission" data-title-field="title" novalidate>
        {honeypot()}
        {submit_fields("ps")}
        <fieldset>
          <legend>About you</legend>
          <div class="form-grid">
            <div class="field"><label for="ps-name">Your name (required)</label><input class="input" id="ps-name" name="name" required maxlength="80" autocomplete="name"></div>
            <div class="field"><label for="ps-email">Your email (required)</label><input class="input" id="ps-email" name="email" type="email" required autocomplete="email"></div>
            <div class="field full"><label for="ps-role">Your relationship to this opportunity</label><select class="input" id="ps-role" name="relationship">{opts(["I am the organizer", "I am part of the organizing team", "I am a student sharing it", "Other"])}</select></div>
            {consent("ps-consent")}
          </div>
        </fieldset>
        <p class="error" data-form-error role="alert" hidden></p>
        <button class="btn btn-lime" type="submit" style="margin-top:1.5rem">{icon("send")}Send submission</button>
        {form_result()}
      </form>
      <aside style="display:grid;gap:1rem;align-content:start">
        <div class="panel-card">
          <div class="panel-head"><div><h2>My submissions</h2><p>Everything you've sent, with its review status.</p></div></div>
          <ul class="sub-list" data-sub-list></ul>
          <p class="hint" data-sub-empty>You haven't submitted anything yet.</p>
        </div>
        {submit_aside()}
      </aside>
    </div>
  </div>

  <div class="tab-panel" role="tabpanel" id="panel-settings" aria-labelledby="tab-settings" data-panel="settings" hidden>
    <div class="settings-grid">
      <form class="form-card" id="profile-form" novalidate>
        <h2 class="card-title">Edit profile</h2>
        <div class="form-grid">
          <div class="field full"><label for="pf-name">Full name (required)</label><input class="input" id="pf-name" name="full_name" required maxlength="80" autocomplete="name"></div>
          <div class="field full"><label for="pf-email">Email</label><input class="input" id="pf-email" type="email" disabled><span class="hint" data-provider-hint></span></div>
          <div class="field"><label for="pf-college">College</label><input class="input" id="pf-college" name="college" maxlength="120" placeholder="e.g. Mahendra Multiple Campus"></div>
          <div class="field"><label for="pf-programme">Programme and year</label><input class="input" id="pf-programme" name="programme" maxlength="80" placeholder="e.g. BIT, 2nd year"></div>
          <div class="field"><label for="pf-city">City or district</label><input class="input" id="pf-city" name="city" maxlength="60" placeholder="e.g. Nepalgunj"></div>
          <div class="field"><label for="pf-region">Show me first</label><select class="input" id="pf-region" name="region"><option value="">Anywhere</option><option value="nepal">In Nepal</option><option value="online">Online</option><option value="abroad">Abroad</option></select></div>
          <fieldset class="field full"><legend class="label">Interests</legend><div class="chips">{interest}</div></fieldset>
          <label class="check full" for="pf-alerts"><input type="checkbox" id="pf-alerts" name="alerts"><span>Email me the weekly SWABUD roundup of verified opportunities.</span></label>
        </div>
        <p class="error" data-auth-error role="alert" hidden></p>
        <button class="btn btn-lime" type="submit" style="margin-top:1.25rem">{icon("check")}Save changes</button>
      </form>
      <div style="display:grid;gap:1.25rem;align-content:start">
        <form class="form-card" id="password-form" novalidate>
          <h2 class="card-title" data-pw-title>Change password</h2>
          <p class="hint" data-pw-note style="margin-bottom:1rem"></p>
          <div class="form-grid">
            {pw_field("pw-new", "New password", "new-password", meter=True)}
            {pw_field("pw-new2", "Confirm new password", "new-password")}
          </div>
          <p class="error" data-auth-error role="alert" hidden></p>
          <button class="btn btn-navy" type="submit" style="margin-top:1.25rem">{icon("lock")}Update password</button>
        </form>
        <div class="form-card">
          <h2 class="card-title">Account</h2>
          <p class="hint" data-account-meta></p>
          <div class="account-actions">
            <button class="btn btn-ghost" type="button" data-signout>{icon("logout")}Sign out</button>
            <button class="btn btn-ghost btn-danger" type="button" data-delete-account>Request account deletion</button>
          </div>
          <p class="hint" data-delete-msg hidden></p>
        </div>
      </div>
    </div>
  </div>
</div></section>
"""
    return page("profile.html", "My dashboard", "Your SWABUD dashboard: saved opportunities, application tracker, learning progress, submissions and settings.", body, "", noindex=True, page_id="profile", scripts=("data.js", "profile.js"))

def build_data_js():
    """Compact listing + learning data for member features (dashboard, heads-up banner)."""
    learn = [{"id": t["id"], "t": t["title"], "n": len(t["steps"])} for t in LEARN]
    with open(os.path.join(ROOT, "assets", "js", "data.js"), "w", encoding="utf-8") as f:
        f.write("/* Generated by _source/build.py from _source/data. Do not edit by hand. */\n"
                f"window.SWABUD_DATA = {opp_payload()};\n"
                f"window.SWABUD_LEARN = {json.dumps(learn, ensure_ascii=False, separators=(',', ':'))};\n")

def build_organizers():
    offers = [("List an opportunity, free", "Hackathons, CTFs, internships, fellowships, scholarships, events, courses and volunteer calls. We write a clear listing and link to your page.", "send"),
              ("Media partnership for your event", "We promote your event to students through the site, alerts and social channels in exchange for visibility and student access.", "mic"),
              ("Sessions for students", "Run a workshop, AMA or info session with student communities and SWABUD campus ambassadors.", "users"),
              ("Reach students across Nepal", "Our ambassadors share verified opportunities in colleges beyond Kathmandu valley, from Butwal to Nepalgunj.", "globe")]
    cards = "".join(f'<div class="value"><span class="cat-icon">{icon(i)}</span><h3 style="margin-top:.8rem">{e(t)}</h3><p>{e(p)}</p></div>' for t, p, i in offers)
    types = ["List an opportunity", "Media partnership for an event", "Workshop or session for students", "Sponsorship", "Something else"]
    body = page_head("Organizers", "Reach students who are ready to build", "SWABUD helps colleges, clubs, companies and communities get genuine opportunities in front of students across Nepal.",
                     [("index.html", "Home"), ("", "For organizers")]) + f"""
<section class="section"><div class="wrap">
  <div class="value-grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))">{cards}</div>
</div></section>
<section class="section section-alt"><div class="wrap split">
  <div>
    <p class="eyebrow">Our standards</p>
    <h2 style="margin-top:.6rem;font-size:var(--step-2)">Every partner listing goes through the same checks</h2>
    <ul class="checklist" style="margin-top:1.25rem;display:grid;gap:.6rem">
      <li>{icon("check")}<span>An official page with clear eligibility, dates and cost</span></li>
      <li>{icon("check")}<span>No fees to "reserve" a place, and no collection of sensitive personal data</span></li>
      <li>{icon("check")}<span>Paid placements, if we ever offer them, are always labelled Sponsored</span></li>
      <li>{icon("check")}<span>Student data is never sold or shared</span></li>
    </ul>
    <p style="margin-top:1.25rem"><a class="link-arrow" href="editorial-policy.html">Read our editorial policy {icon("arrow")}</a></p>
  </div>
  <form class="form-card" id="partner-form" style="scroll-margin-top:90px" data-form="partner" data-subject="Partnership enquiry" data-title-field="organization" novalidate>
    {honeypot()}
    <div class="form-grid">
      <div class="field full"><label for="p-org">Organization (required)</label><input class="input" id="p-org" name="organization" required maxlength="120"></div>
      <div class="field"><label for="p-name">Your name (required)</label><input class="input" id="p-name" name="name" required maxlength="80" autocomplete="name"></div>
      <div class="field"><label for="p-email">Email (required)</label><input class="input" id="p-email" name="email" type="email" required autocomplete="email"></div>
      <div class="field full"><label for="p-type">I'm interested in (required)</label><select class="input" id="p-type" name="interest" required>{opts(types, "Choose one")}</select></div>
      <div class="field full"><label for="p-web">Website or event page</label><input class="input" id="p-web" name="website" type="url" placeholder="https://"></div>
      <div class="field full"><label for="p-msg">Message (required)</label><textarea class="input" id="p-msg" name="message" required maxlength="1500" placeholder="Tell us about your opportunity or event, dates and who it's for"></textarea></div>
      {consent("p-consent")}
    </div>
    <p class="error" data-form-error role="alert" hidden></p>
    <button class="btn btn-lime" type="submit" style="margin-top:1.25rem">{icon("send")}Send enquiry</button>
    {form_result()}
  </form>
</div></section>"""
    return page("organizers.html", "For organizers", "List opportunities for free, partner on events and reach students across Nepal with SWABUD.", body, "")

def build_join():
    roles = [("Campus Ambassador", "Share verified opportunities at your college, send us local events and host short sessions on applying.", "users"),
             ("Opportunity Researcher", "Find opportunities and check them against official sources using our verification steps.", "search"),
             ("Content Creator", "Write captions, carousels and short guides, and make Reels about opportunities and skills.", "pen"),
             ("Designer or Developer", "Improve the website, design social templates, or build new features like alerts.", "code")]
    cards = "".join(f'<div class="value"><span class="cat-icon">{icon(i)}</span><h3 style="margin-top:.8rem">{e(t)}</h3><p>{e(p)}</p></div>' for t, p, i in roles)
    body = page_head("Join", "Join SWABUD", "SWABUD is built by students. Help classmates across Nepal find opportunities they would otherwise miss, and grow your own skills and network on the way.",
                     [("index.html", "Home"), ("", "Join SWABUD")]) + f"""
<section class="section"><div class="wrap">
  <div class="section-head"><div><p class="eyebrow">Volunteer roles</p><h2>Pick how you want to help</h2><p>Roles are flexible, usually 1 to 3 hours a week, and you can do them from anywhere in Nepal.</p></div></div>
  <div class="value-grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))">{cards}</div>
</div></section>
<section class="section section-alt"><div class="wrap split">
  <div>
    <p class="eyebrow">What you get</p>
    <h2 style="margin-top:.6rem;font-size:var(--step-2)">Real experience you can show</h2>
    <ul class="checklist" style="margin-top:1.25rem;display:grid;gap:.6rem">
      <li>{icon("check")}<span>A certificate and public credit on SWABUD</span></li>
      <li>{icon("check")}<span>Work you can put in your portfolio and on LinkedIn</span></li>
      <li>{icon("check")}<span>Early access to opportunities and a network of students across Nepal</span></li>
      <li>{icon("check")}<span>A reference letter after six active months</span></li>
    </ul>
    <p class="hint" style="margin-top:1rem">These are volunteer roles. SWABUD does not promise payment or jobs.</p>
  </div>
  <form class="form-card" data-form="join" data-subject="Join SWABUD application" data-title-field="role" novalidate>
    {honeypot()}
    <div class="form-grid">
      <div class="field full"><label for="j-role">Role (required)</label><select class="input" id="j-role" name="role" required>{opts([r[0] for r in roles], "Choose a role")}</select></div>
      <div class="field"><label for="j-name">Full name (required)</label><input class="input" id="j-name" name="name" required maxlength="80" autocomplete="name"></div>
      <div class="field"><label for="j-email">Email (required)</label><input class="input" id="j-email" name="email" type="email" required autocomplete="email"></div>
      <div class="field"><label for="j-college">College (required)</label><input class="input" id="j-college" name="college" required maxlength="120"></div>
      <div class="field"><label for="j-city">City or district (required)</label><input class="input" id="j-city" name="city" required maxlength="60"></div>
      <div class="field full"><label for="j-program">Programme and year</label><input class="input" id="j-program" name="programme" maxlength="80" placeholder="e.g. BIT, 2nd year"></div>
      <div class="field full"><label for="j-why">Why do you want to join? (required)</label><textarea class="input" id="j-why" name="why" required maxlength="1200" placeholder="A few lines about you and what you'd like to do"></textarea></div>
      <div class="field full"><label for="j-links">Links (LinkedIn, GitHub, portfolio)</label><input class="input" id="j-links" name="links" maxlength="300"></div>
      {consent("j-consent")}
    </div>
    <p class="error" data-form-error role="alert" hidden></p>
    <button class="btn btn-lime" type="submit" style="margin-top:1.25rem">{icon("send")}Send application</button>
    {form_result()}
  </form>
</div></section>"""
    return page("join.html", "Join SWABUD", "Become a SWABUD campus ambassador, opportunity researcher, content creator, designer or developer.", body, "")

def build_about():
    n_nepal = sum(1 for o in OPPS if o["region"] == "nepal")
    n_free = sum(1 for o in OPPS if o["free"])
    values = [("Accessibility", "Free for students, mobile-first, plain language, and built for every province, not only Kathmandu valley."),
              ("Trust", "Every listing is checked against its official source and shows the date we last checked it."),
              ("Learning", "Every listing and guide should leave you knowing something new, even when it isn't the right fit."),
              ("Community", "Students, clubs, colleges and organizers help each other, and credit is always given."),
              ("Growth", "Small steps and honest progress. No promises of jobs, visas or results.")]
    vals = "".join(f'<div class="value"><h3>{e(t)}</h3><p>{e(p)}</p></div>' for t, p in values)
    does = [("search", "Finds opportunities", "We watch official platforms, college notices, community pages and organizer announcements for hackathons, CTFs, fellowships, scholarships, events, courses, volunteering and student programmes."),
            ("check", "Checks them at the source", "A post is only a lead. A listing goes live after we confirm the organizer, eligibility, dates, format, cost and the real application link on the official page."),
            ("clock", "Keeps them up to date", "Statuses and countdowns switch by themselves in Nepal time: Opens in, Open, Closing soon, Happening now and Closed. We recheck open listings every week."),
            ("list", "Helps you apply", "Members save opportunities, track each application from Saved to Accepted, keep a checklist and notes, and get a heads-up before deadlines."),
            ("book", "Builds your skills", "Free learning paths and practical career guides, from your first CV to hackathon prep and spotting fake offers."),
            ("users", "Connects the community", "Partner communities, campus ambassadors and organizers across Nepal, so opportunities reach students outside the big cities too.")]
    does_html = "".join(f'<div class="value"><span class="cat-icon">{icon(i)}</span><h3 style="margin-top:.8rem">{e(t)}</h3><p>{e(p)}</p></div>' for i, t, p in does)
    student_steps = [("Browse", "See a preview of open opportunities, with statuses and countdowns, without an account."),
                     ("Create a free account", "Sign up with Google or email in under a minute to unlock every listing, the calendar, sources and guides."),
                     ("Save and plan", "Save what fits, tick off the application checklist, and watch your deadlines on your dashboard."),
                     ("Apply at the source", "Every application happens on the organizer's official page. SWABUD never asks you to pay to apply.")]
    org_steps = [("Submit", "Send an opportunity from your SWABUD account, or use the partner form for collaborations."),
                 ("We verify", "We check it against your official page and may email you with questions."),
                 ("It goes live", "The listing is published with a check date, a live status and a countdown."),
                 ("Students find it", "It appears in the directory, the calendar, recommendations and our weekly alerts.")]
    steps_html = lambda st: "".join(f"<li><h3>{e(t)}</h3><p>{e(p)}</p></li>" for t, p in st)
    rows = [("Preview of opportunities, with search and categories", True, True), ("Live statuses and countdowns", True, True),
            ("Summaries, eligibility and dates", True, True), ("Official links and how-to-apply steps", False, True),
            ("Every listing, with all filters", False, True), ("Full deadline calendar and My saved dates", False, True),
            (f"All {N_SOURCES} official sources", False, True), ("Learning paths with saved progress", False, True),
            ("All 8 career guides", False, True), ("Save, track and checklist applications", False, True),
            ("Deadline heads-up and what's new", False, True), ("Submit opportunities", False, True)]
    yes, no = f'<span class="yes">{icon("check")}<span class="visually-hidden">Yes</span></span>', '<span class="no">–<span class="visually-hidden">No</span></span>'
    table = "".join(f"<tr><th scope=\"row\">{e(r)}</th><td>{yes if v else no}</td><td>{yes if m else no}</td></tr>" for r, v, m in rows)
    faqs = [("Is SWABUD free?", "Yes. Browsing, the account and every member feature are free for students. Some listed opportunities, such as certification exams, charge their own fees, and each listing says so."),
            ("Why do I need an account to see everything?", "An account lets us keep your saved list, tracker and progress in one place, and helps us keep the platform useful and free of spam. It's free and takes under a minute."),
            ("Does SWABUD run these opportunities?", "No. Organizers run them. We check the details and send you to the official page to apply."),
            ("Who is SWABUD for?", "Students in Nepal who are interested in technology, from first-year BCA, BIT, BSc CSIT and BE students to fresh graduates, plus the clubs, colleges and companies that run genuine opportunities."),
            ("How can my club or company work with SWABUD?", "List an opportunity for free, or partner with us for events, sessions and outreach. Start on the For organizers page.")]
    faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in faqs)
    body = page_head("About", "About SWABUD", "SWABUD is a student tech opportunity platform for Nepal. We bring scattered opportunities into one organized, checked place, and help students act on them. Discover. Connect. Grow.",
                     [("index.html", "Home"), ("", "About")]) + f"""
<section class="section"><div class="wrap split" style="align-items:center">
  <div class="prose">
    <p class="eyebrow">Why SWABUD exists</p>
    <h2 style="margin-top:.6rem">Opportunities shouldn't depend on which group chat you are in</h2>
    <p>Hackathons, CTFs, fellowships, scholarships and events for students are announced across Facebook posts, college notice boards, Discord servers and dozens of websites. Students miss deadlines, cannot tell real calls from scams, and often don't know where to start, especially outside Kathmandu valley.</p>
    <p>SWABUD collects these opportunities, checks each one against its official source, writes it up in one clear format, and keeps it updated until it closes. Then it helps you act: save it, plan your application, and get reminded before the deadline.</p>
    <p>Our name carries our promise: <strong>Discover</strong> what's out there, <strong>Connect</strong> with the people and communities behind it, and <strong>Grow</strong> the skills to be chosen.</p>
  </div>
  <img class="badge-art" src="assets/img/brand/swabud-badge.webp" alt="SWABUD circular badge logo with the tagline Discover. Connect. Grow." width="680" height="680" loading="lazy">
</div></section>
<section class="trust"><div class="wrap"><ul>
  <li><b class="mono">{len(OPPS)}</b><span>opportunities listed</span></li>
  <li><b class="mono">{len(CATS)}</b><span>categories</span></li>
  <li><b class="mono">{n_nepal}</b><span>in Nepal</span></li>
  <li><b class="mono">{N_SOURCES}</b><span>official sources watched</span></li>
</ul></div></section>
<section class="section section-alt"><div class="wrap">
  <div class="section-head"><div><p class="eyebrow">What we do</p><h2>Six things SWABUD does for students</h2><p>{len(OPPS)} listings across {len(CATS)} categories, {n_free} of them confirmed free, plus learning paths, career guides and a personal dashboard.</p></div></div>
  <div class="value-grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))">{does_html}</div>
</div></section>
<section class="section"><div class="wrap">
  <div class="section-head"><div><p class="eyebrow">How it works</p><h2>For students</h2></div></div>
  <ol class="steps steps-4">{steps_html(student_steps)}</ol>
  <div class="section-head" style="margin-top:3rem"><div><p class="eyebrow">How it works</p><h2>For organizers</h2></div><a class="link-arrow" href="organizers.html">For organizers {icon("arrow")}</a></div>
  <ol class="steps steps-4">{steps_html(org_steps)}</ol>
</div></section>
<section class="section section-alt" id="access"><div class="wrap split" style="align-items:start">
  <div>
    <p class="eyebrow">Visitors and members</p>
    <h2 style="margin-top:.6rem;font-size:var(--step-2)">What you can do with and without an account</h2>
    <p style="color:var(--muted);margin-top:1rem;max-width:32rem">Anyone can browse a preview. A free account unlocks the full platform, so we can keep your saved list, tracker and progress for you.</p>
    <div class="plan-actions" data-auth-out style="margin-top:1.25rem">
      <button class="btn btn-google" type="button" data-google-signin>{GOOGLE_G}Continue with Google</button>
      <a class="btn btn-lime" href="signup.html">Create a free account</a>
    </div>
    <div class="plan-actions" data-auth-in style="margin-top:1.25rem"><a class="btn btn-lime" href="profile.html">Open my dashboard {icon("arrow")}</a></div>
  </div>
  <div class="table-wrap"><table class="access-table">
    <thead><tr><th scope="col">Feature</th><th scope="col">Visitor</th><th scope="col">Member (free)</th></tr></thead>
    <tbody>{table}</tbody>
  </table></div>
</div></section>
<section class="section"><div class="wrap split">
  <div>
    <p class="eyebrow">How we verify</p>
    <h2 style="margin-top:.6rem;font-size:var(--step-2)">Nothing goes live until the official page confirms it</h2>
    <p style="color:var(--muted);margin-top:1rem;max-width:34rem">Reposts and forwarded images are only leads. We confirm every fact at the source, publish it with a check date, correct mistakes quickly and note every correction.</p>
    <p style="margin-top:1.25rem"><a class="link-arrow" href="editorial-policy.html">Read our editorial policy {icon("arrow")}</a></p>
  </div>
  <div class="callout"><h3>{icon("shield")}What SWABUD will never do</h3><ul>
    <li>Charge students to see listings or to use their account</li><li>Sell or share student data</li><li>Promise jobs, visas or selection</li><li>Present a paid listing as an independent recommendation</li><li>Ask for your password, OTP or bank details</li></ul></div>
</div></section>
<section class="section section-alt"><div class="wrap split">
  <div><p class="eyebrow">Mission</p><h2 style="margin-top:.6rem;font-size:var(--step-2)">Make meaningful learning and career opportunities easy for students in Nepal to discover, trust and access.</h2></div>
  <div><p class="eyebrow">Vision</p><h2 style="margin-top:.6rem;font-size:var(--step-2)">Become the most trusted student opportunity platform in Nepal.</h2></div>
</div></section>
<section class="section"><div class="wrap">
  <div class="section-head"><div><p class="eyebrow">Values</p><h2>What we hold ourselves to</h2></div></div>
  <div class="value-grid">{vals}</div>
</div></section>
<section class="section section-alt"><div class="wrap split">
  <div><p class="eyebrow">Who it's for</p><h2 style="margin-top:.6rem;font-size:var(--step-2)">Students first, organizers welcome</h2>
  <p style="color:var(--muted);margin-top:1rem">We start with IT and tech-interested students in Nepal: from first-year BCA, BIT, BSc CSIT and BE students to fresh graduates, in every province, plus the clubs, colleges and companies that run genuine opportunities.</p>
  <p style="margin-top:1.25rem;display:flex;gap:.75rem;flex-wrap:wrap"><a class="btn btn-navy" href="join.html">Join SWABUD</a><a class="btn btn-ghost" href="organizers.html">For organizers</a></p></div>
  <div><p class="eyebrow">Built by students</p><h2 style="margin-top:.6rem;font-size:var(--step-2)">Help us grow it</h2>
  <p style="color:var(--muted);margin-top:1rem">SWABUD is built with students. Campus ambassadors, opportunity researchers, content creators, designers and developers help classmates across Nepal find opportunities they would otherwise miss.</p>
  <p style="margin-top:1.25rem"><a class="link-arrow" href="join.html">See volunteer roles {icon("arrow")}</a></p></div>
</div></section>
<section class="section" id="partners" style="scroll-margin-top:80px"><div class="wrap">
  <div class="section-head"><div><p class="eyebrow">Partners</p><h2>Our partners</h2><p>Student communities, colleges and organizations that help SWABUD reach students across Nepal.</p></div>
  <a class="link-arrow" href="organizers.html#partner-form">Become a partner {icon("arrow")}</a></div>
  <div class="partner-grid">{partner_cards()}</div>
</div></section>
<section class="section section-alt"><div class="wrap split">
  <div><p class="eyebrow">Questions</p><h2 style="margin-top:.6rem;font-size:var(--step-2)">About SWABUD, answered</h2>
  <p style="color:var(--muted);margin-top:1rem">Still curious? Write to <a href="mailto:{SITE['email']}">{SITE['email']}</a> or use the <a href="contact.html">contact form</a>.</p></div>
  <div class="faq">{faq}</div>
</div></section>"""
    return page("about.html", "About", "About SWABUD: a student tech opportunity platform for Nepal with verified hackathons, CTFs, fellowships, scholarships, events, courses and volunteering, and free member tools to apply.", body, "about.html")

def build_contact():
    soc = "".join(ext(u, f'{icon(i)}<span><strong>{n}</strong><span>{e(h)}</span></span>', "join-card") for n, u, i, h in SITE["social"])
    faqs = [("Is SWABUD free?", "Yes. Browsing, accounts, saving, alerts and submitting an opportunity are free. Some listed opportunities, like certification exams, charge their own fees, and each listing says so."),
            ("Does SWABUD run these opportunities?", "No. Each opportunity is run by its organizer. We check the details and link to the official page, where you apply."),
            ("Can you guarantee I will be selected?", "No one honest can. We help you find genuine opportunities and prepare well; selection is always the organizer's decision."),
            ("How do I report a wrong or expired listing?", "Use the Report a problem form on the listing, or this contact form with the topic set to Correction. We note every correction on the listing."),
            ("Do I need an account?", "You can browse a preview of opportunities, read summaries and use this contact form without one. A free account unlocks every listing with official links and how-to-apply steps, the deadline calendar, all sources, learning paths, career guides, saving and the application tracker."),
            ("Where do my saved opportunities go?", "They are saved to your account, so you can see them on any device after you log in."),
            ("I forgot my password. What do I do?", "Use Forgot password on the log in page. We email you a 6-digit code to set a new password. If you signed up with Google, just use Continue with Google."),
            ("Can organizations pay to feature a listing?", "Not at the moment. If we ever offer featured listings, they will always carry a clear Sponsored label, and normal listings will stay free."),
            ("What data do you collect?", "Only what you send us through a form or email. We never sell it. See the privacy policy for details.")]
    faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in faqs)
    topics = ["General question", "Help with my account", "Correction to a listing", "Partnership or media", "Join the team", "Something else"]
    body = page_head("Contact", "Contact SWABUD", "Questions, corrections, partnerships or a listing to share. Messages from this form arrive at info@swabud.tech.",
                     [("index.html", "Home"), ("", "Contact")]) + f"""
<section class="section"><div class="wrap split">
  <div style="display:grid;gap:1.25rem;align-content:start">
    <form class="form-card" id="contact-form" data-form="contact" data-subject="Contact form" data-title-field="topic" novalidate>
      {honeypot()}
      <div class="form-grid">
        <div class="field"><label for="c-name">Name (required)</label><input class="input" id="c-name" name="name" required maxlength="80" autocomplete="name"></div>
        <div class="field"><label for="c-email">Email (required)</label><input class="input" id="c-email" name="email" type="email" required autocomplete="email"></div>
        <div class="field full"><label for="c-topic">Topic (required)</label><select class="input" id="c-topic" name="topic" required>{opts(topics, "Choose a topic")}</select></div>
        <div class="field full"><label for="c-msg">Message (required)</label><textarea class="input" id="c-msg" name="message" required maxlength="2000"></textarea></div>
        {consent("c-consent")}
      </div>
      <p class="error" data-form-error role="alert" hidden></p>
      <button class="btn btn-lime" type="submit" style="margin-top:1.25rem">{icon("send")}Send message</button>
      {form_result()}
    </form>
    <div class="email-box">{icon("mail")}<code id="contact-email">{SITE['email']}</code><button class="btn btn-ghost btn-sm" type="button" data-copy="{SITE['email']}" data-copy-target="#contact-email" data-copy-done="Email address copied">Copy address</button></div>
    <div class="callout" id="report" style="scroll-margin-top:90px"><h3>{icon("flag")}Reporting a problem with a listing?</h3>
      <p style="margin-top:.6rem;color:var(--muted)">The quickest way is the Report a problem form at the bottom of that listing. Otherwise, choose "Correction to a listing" above and include the listing link and the official source.</p></div>
  </div>
  <div style="display:grid;gap:1.25rem;align-content:start">
    <div><p class="eyebrow">Follow</p><div class="join-grid" style="grid-template-columns:1fr;margin-top:.85rem">{soc}</div></div>
    <img src="assets/img/brand/swabud-social.jpg" alt="SWABUD logo on navy with the tagline Discover. Connect. Grow." width="800" height="800" loading="lazy" style="border-radius:var(--radius);width:100%">
    <div><p class="eyebrow">FAQ</p><div class="faq" style="margin-top:.85rem">{faq}</div></div>
  </div>
</div></section>"""
    return page("contact.html", "Contact", "Contact SWABUD at info@swabud.tech for questions, corrections, partnerships or to share an opportunity.", body, "")

def legal(path, eyebrow, h1, lead, sections, desc):
    content = "".join(f"<h2>{e(t)}</h2>{h}" for t, h in sections)
    body = page_head(eyebrow, h1, lead, [("index.html", "Home"), ("", h1)]) + f'<section class="section"><div class="wrap"><article class="prose" style="max-width:46rem">{content}</article></div></section>'
    return page(path, h1, desc, body, "")

def build_legal():
    upd = fdate(BUILD_DATE.isoformat())
    em = SITE["email"]
    out = []
    out.append(legal("editorial-policy.html", "Editorial policy", "How we verify listings", f"Last updated {upd}. Trust is the reason SWABUD exists, so this is how every listing is checked, updated and corrected.", [
        ("What counts as a source", "<p>Only the organizer's own website, verified social account or official email. Reposts, forwarded images and screenshots are treated as leads, never as sources. When an official site cannot be read, we say which other public listing we used and ask you to confirm on the official site.</p>"),
        ("What we check", "<ul><li>Who runs it, and that the organizer is real</li><li>Who can apply, including age and country rules</li><li>Dates and deadlines, and the time zone</li><li>Format and location</li><li>Cost to students and any benefits</li><li>The real application link</li></ul>"),
        ("Check dates and statuses", "<p>Every dated listing shows the day we last checked it. Statuses change to Closing soon seven days before a deadline and to Closed after it, automatically. We recheck open listings every week. General listings for always-open platforms are marked as such.</p>"),
        ("What we reject", "<p>Anything that asks students to pay to reserve a place, has no verifiable organizer, asks for sensitive personal or financial details at the application stage, or promises guaranteed results.</p>"),
        ("Corrections", f"<p>Use the Report a problem form on any listing, or email <code>{em}</code>. We check reports the same day where we can, fix the listing, and add a dated note describing the correction.</p>"),
        ("Independence and sponsorship", "<p>Listings are free and chosen on merit. If SWABUD ever accepts payment to feature a listing, it will be clearly labelled Sponsored and still go through the same checks. Paid placement never changes a status or a fact.</p>"),
    ], "How SWABUD verifies, updates and corrects opportunity listings."))
    out.append(legal("privacy.html", "Privacy", "Privacy policy", f"Last updated {upd}. SWABUD collects as little as possible and never sells your data.", [
        ("What we collect", "<p>Browsing SWABUD does not require an account. When you use a form (contact, alerts, submit, report, join or partner) or email us, we receive the details you choose to send, such as your name, email address and message.</p>"),
        ("Accounts", "<p>If you create an account, we store your name, email address, the profile details you add (college, programme, city, interests and alert choice), your saved opportunities with the stages, checklist and notes you set, your learning-path progress, and the opportunities you submit. To show what's new since your last visit, your browser also remembers when you last visited (on your device only). If you sign in with Google, Google shares your name, email address and profile photo with us; we never see your Google password. Account data is stored with Supabase, our authentication and database provider, and protected so that only you can read your own profile, tracker and notes. Passwords are stored by Supabase as secure hashes, never in plain text.</p>"),
        ("How forms are delivered", f"<p>Our forms are delivered to <code>{em}</code> by FormSubmit, an email forwarding service. Your form contents pass through that service only to reach our inbox. If it is unavailable, the site prepares an email you can send yourself.</p>"),
        ("How we use it", "<p>Only to reply to you, review and publish submissions, send the alerts you asked for, and fix errors you report. We do not use it for advertising.</p>"),
        ("Sharing", "<p>We never sell or rent personal information. We share it only if the law requires it. Opportunity details you submit, such as the title, organizer and official link, may be published on the site.</p>"),
        ("Storage and deletion", f"<p>We keep form emails for up to 12 months after they are no longer needed, then delete them. To unsubscribe from alerts, or to see or delete what we hold about you, email <code>{em}</code>.</p>"),
        ("Saved opportunities and theme", "<p>Without an account, bookmarks and your light or dark mode choice are stored only in your own browser (local storage) and never reach us. When you log in, your bookmarks are copied to your account so they appear on your other devices. Logging out removes them from that browser.</p>"),
        ("Deleting your account", f"<p>Use Request account deletion in your profile settings, or email <code>{em}</code> from the address on your account. We delete your account, profile, tracker and notes within 30 days. Opportunities you submitted that were published may stay on the site without your name.</p>"),
        ("Cookies and analytics", "<p>The site uses no advertising cookies. It may use privacy-respecting analytics to count page visits.</p>"),
        ("Third-party sites", "<p>Opportunity links open the organizer's own website, which has its own privacy policy. Read it before you apply.</p>"),
        ("Law", "<p>We handle personal information in line with Nepal's Individual Privacy Act, 2018 (2075): collected with consent, for a stated purpose, and not used or shared beyond it.</p>"),
    ], "How SWABUD collects, uses and protects personal information."))
    out.append(legal("terms.html", "Terms", "Terms of use", f"Last updated {upd}. By using swabud.tech you agree to these terms.", [
        ("What SWABUD is", "<p>SWABUD is an information platform. We list opportunities run by other organizations and link to their official pages. We do not run, sponsor or select candidates for those opportunities unless we say so clearly.</p>"),
        ("Accuracy", "<p>We check every listing against its official source, but organizers can change details at any time. Always confirm dates, eligibility and costs on the official page before you apply or pay anything.</p>"),
        ("No guarantees", "<p>SWABUD does not guarantee selection, employment, scholarships, visas or any other outcome.</p>"),
        ("Accounts", "<p>You need an account to submit opportunities and to sync your saved list and tracker. Keep your password private and use a real email address you can access. One person, one account. We may suspend accounts used for spam, fake listings or abuse.</p>"),
        ("Submissions", "<p>When you submit an opportunity, you confirm the information is accurate and that you may share it. We may edit it for clarity, decline it, or remove it at any time.</p>"),
        ("Volunteer roles", "<p>SWABUD ambassador and contributor roles are voluntary and unpaid unless agreed in writing.</p>"),
        ("Acceptable use", "<p>Do not use the site or its forms to post false, misleading or harmful opportunities, to send spam, to collect other people's data, or to disrupt the service.</p>"),
        ("Brand", "<p>The SWABUD name and logos belong to SWABUD. Organizer names and logos belong to their owners and appear only to identify who runs each opportunity.</p>"),
        ("Contact", f"<p>Questions about these terms: <code>{em}</code>.</p>"),
    ], "Terms of use for swabud.tech."))
    return out

def build_404():
    body = f"""<section class="navy"><div class="navy-pattern"></div><div class="wrap notfound"><div class="frame" style="display:inline-block">
  <p class="code">4<span>0</span>4</p>
  <h1 style="color:#fff;font-size:var(--step-2);margin-top:1rem">This page has moved or closed</h1>
  <p style="margin-top:.75rem">Like some deadlines, this link has passed. The opportunities are still a click away.</p>
  <div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;margin-top:1.5rem"><a class="btn btn-lime" href="/opportunities.html">Browse opportunities</a><a class="btn btn-ghost-light" href="/index.html">Go home</a></div>
</div></div></section>"""
    return page("404.html", "Page not found", "This page could not be found.", body, "", "/", noindex=True)

# ---------------------------------------------------------------- extras
def build_extras(paths):
    with open(os.path.join(ROOT, "sitemap.xml"), "w") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for p in paths:
            if p in ("404.html", "saved.html", "login.html", "signup.html", "forgot-password.html", "profile.html"): continue
            loc = SITE["url"] + "/" + ("" if p == "index.html" else p)
            f.write(f"  <url><loc>{loc}</loc><lastmod>{BUILD_DATE.isoformat()}</lastmod></url>\n")
        f.write("</urlset>\n")
    with open(os.path.join(ROOT, "robots.txt"), "w") as f:
        f.write(f"User-agent: *\nAllow: /\nDisallow: /_source/\nDisallow: /supabase/\n\nSitemap: {SITE['url']}/sitemap.xml\n")
    with open(os.path.join(ROOT, "site.webmanifest"), "w") as f:
        json.dump({"name": "SWABUD", "short_name": "SWABUD", "description": "Verified tech opportunities for students in Nepal",
                   "start_url": "/", "display": "standalone", "background_color": "#101C30", "theme_color": "#101C30",
                   "icons": [{"src": "/assets/img/icon-192.png", "sizes": "192x192", "type": "image/png"},
                             {"src": "/assets/img/icon-512.png", "sizes": "512x512", "type": "image/png"},
                             {"src": "/assets/img/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}, f, indent=2)
    os.makedirs(os.path.join(ROOT, ".well-known"), exist_ok=True)
    exp = (BUILD_DATE + datetime.timedelta(days=365)).isoformat()
    with open(os.path.join(ROOT, ".well-known", "security.txt"), "w") as f:
        f.write(f"Contact: mailto:{SITE['email']}\nExpires: {exp}T00:00:00.000Z\nPreferred-Languages: en, ne\nCanonical: {SITE['url']}/.well-known/security.txt\n")
    # RSS feed
    rfc = lambda dt: datetime.datetime.combine(dt, datetime.time(6, 0)).strftime("%a, %d %b %Y %H:%M:%S +0000")
    items = ""
    for o in sorted(OPPS, key=lambda x: x["verified"] or "0", reverse=True):
        pub = d(o["verified"]) or BUILD_DATE
        items += (f"<item><title>{e(o['title'])}</title><link>{canonical(o)}</link><guid>{canonical(o)}</guid>"
                  f"<category>{e(CAT[o['category']][1])}</category><pubDate>{rfc(pub)}</pubDate>"
                  f"<description>{e(o['summary'] + ' When: ' + short_when(o) + '.')}</description></item>\n")
    with open(os.path.join(ROOT, "feed.xml"), "w", encoding="utf-8") as f:
        f.write(f'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>SWABUD opportunities</title><link>{SITE["url"]}</link>'
                f'<description>Verified tech opportunities for students in Nepal</description><language>en</language><lastBuildDate>{rfc(BUILD_DATE)}</lastBuildDate>\n{items}</channel></rss>\n')
    # public JSON for apps and partners
    os.makedirs(os.path.join(ROOT, "api"), exist_ok=True)
    # public feed for partners and apps: summary fields only (official links and how-to-apply stay member-only)
    pub = [{k: o[k] for k in ("slug", "title", "category", "organizer", "summary", "mode", "region", "opens", "start", "end", "deadline", "free", "verified")}
           | {"status": status_now(o), "url": canonical(o)} for o in OPPS]
    with open(os.path.join(ROOT, "api", "opportunities.json"), "w", encoding="utf-8") as f:
        json.dump({"generated": BUILD_DATE.isoformat(), "count": len(pub), "opportunities": pub}, f, indent=1, ensure_ascii=False)

if __name__ == "__main__":
    paths = [build_home(), build_directory(), build_calendar(), build_saved(), build_sources(), build_learn(), build_career(),
             build_submit(), build_organizers(), build_join(), build_about(), build_contact(),
             build_login(), build_signup(), build_forgot(), build_profile()]
    paths += build_legal()
    for o in OPPS:
        paths.append(build_detail(o)); build_ics(o)
    paths.append(build_404())
    build_extras(paths)
    build_data_js()
    print(f"Built {len(paths)} pages and {len(OPPS)} listings on {BUILD_DATE}")
