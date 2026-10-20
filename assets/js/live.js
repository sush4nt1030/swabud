/* SWABUD live listings.
   Opportunities published from the admin panel (admin.html) appear on the site straight away:
   in the directory, the saved list, the calendar and on listing.html?id=<slug>. Every 30 minutes a GitHub
   Action copies them into _source/data/opportunities.json and rebuilds the static pages (see README).
   Data: the public "opportunities" table in Supabase (only published and removed rows can be read,
   see supabase/admin.sql). In preview mode it reads the admin panel's test data in this browser. */
(function () {
  "use strict";
  var SW = window.SWABUD = window.SWABUD || {};
  var CFG = window.SWABUD_CONFIG || {};
  var KEY = CFG.supabaseKey || CFG.supabaseAnonKey || "";
  var API = CFG.supabaseUrl || "";
  var configured = !!(API && KEY && /^https:\/\//.test(API));
  var onProd = (CFG.productionHosts || []).indexOf(location.hostname) !== -1;
  var MODE = configured ? "supabase" : (onProd ? "off" : "demo");
  var SCRIPT = document.currentScript && document.currentScript.src;
  var BASE = SCRIPT ? SCRIPT.replace(/assets\/js\/live\.js.*$/, "") : "";
  var PAGE = document.body.getAttribute("data-page") || "";
  var CACHE = "swabud-live-v1", DEMO_STORE = "swabud-demo-admin-opps";
  var SITE_URL = "https://swabud.tech";
  var meta = document.querySelector('meta[name="swabud-built"]');
  var BUILT = meta ? Date.parse(meta.getAttribute("content")) || 0 : 0;
  var DAY = 86400000, NPT = 345 * 60000;
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var CATS = [
    ["hackathons", "Hackathons & Competitions", "Hackathons"], ["ctf", "CTFs & Security Challenges", "CTFs"],
    ["internships", "Internships & Fellowships", "Fellowships"], ["scholarships", "Scholarships", "Scholarships"],
    ["events", "Events & Conferences", "Events"], ["courses", "Courses & Certifications", "Courses"],
    ["volunteering", "Volunteering", "Volunteering"], ["programs", "Student Programs & Perks", "Programs"]
  ];
  var CAT = {}; CATS.forEach(function (c) { CAT[c[0]] = c; });
  var REGIONS = { nepal: "In Nepal", online: "Online", abroad: "Abroad" };
  var LABELS = { open: "Open", closing: "Closing soon", live: "Happening now", upcoming: "Upcoming", rolling: "Always open", recurring: "Opens yearly", closed: "Closed" };

  /* ---------- small helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function icon(n) { return '<svg class="icon" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function each(sel, fn, scope) { Array.prototype.forEach.call((scope || document).querySelectorAll(sel), fn); }
  function cssq(s) { return String(s).replace(/["\\]/g, "\\$&"); }
  function ymd(s) { var p = String(s || "").split("-").map(Number); return p.length === 3 && p[0] ? { y: p[0], m: p[1] - 1, d: p[2] } : null; }
  function fdate(s, year) { var x = ymd(s); return x ? x.d + " " + MON[x.m] + (year === false ? "" : " " + x.y) : ""; }
  function todayISO() { var t = new Date(Date.now() + NPT); return t.toISOString().slice(0, 10); }
  function sodMs(s) { var x = ymd(s); return x ? Date.UTC(x.y, x.m, x.d) - NPT : null; }
  function ms(s) { var t = Date.parse(s || ""); return isNaN(t) ? 0 : t; }

  /* ---------- the listing record (same fields as _source/data/opportunities.json) ---------- */
  function rec(r) {
    var steps = Array.isArray(r.steps) ? r.steps : [];
    return {
      slug: r.slug, title: r.title || "", category: CAT[r.category] ? r.category : "events", organizer: r.organizer || "",
      summary: r.summary || "", who: r.who || "", mode: r.mode || "Online", location: r.location || "", region: REGIONS[r.region] ? r.region : "online",
      dates: r.dates || "", when: r.when_text != null ? r.when_text : (r.when || ""), start: r.start_date || r.start || "", end: r.end_date || r.end || "",
      deadline: r.deadline || "", opens: r.opens || "", base: r.base || "open", cost: r.cost || "", free: !!r.free, benefits: r.benefits || "",
      level: r.level || "All levels", link: r.link || "", verified: r.verified || "", steps: steps.filter(Boolean).map(String), notes: r.notes || "",
      status: r.status || "published", updated_at: r.updated_at || ""
    };
  }
  function dat(o) { return { base: o.base, opens: o.opens, deadline: o.deadline, start: o.start, end: o.end }; }
  function phase(o) { return SW.phase ? SW.phase(dat(o)) : { s: o.base, t: null, v: "", done: "" }; }
  function countdown(o) { var ph = phase(o); return SW.countdownText ? SW.countdownText(ph) : ""; }
  function modeKey(m) { m = String(m || "").toLowerCase(); if (m.indexOf("online") !== -1 && m.indexOf("person") !== -1) return "both"; return m.indexOf("online") !== -1 ? "online" : "inperson"; }
  function shortWhen(o) {
    var st = ymd(o.start), en = ymd(o.end);
    if (st && en && o.start !== o.end) {
      if (st.y === en.y && st.m === en.m) return st.d + " to " + en.d + " " + MON[en.m] + " " + en.y;
      return fdate(o.start, st.y !== en.y) + " to " + fdate(o.end);
    }
    if (st) return fdate(o.start);
    if (o.deadline && phase(o).s !== "closed") return "Apply by " + fdate(o.deadline);
    if (o.opens && o.opens >= todayISO()) return "Opens " + fdate(o.opens);
    return o.when || String(o.dates || "").split(". ")[0].replace(/\.$/, "");
  }
  function isInternal(u) { return !/^https?:\/\//i.test(u || ""); }
  function pageUrl(o, live) { return "listing.html?id=" + encodeURIComponent(o.slug) + (live ? "&live=1" : ""); }
  function shareUrl(o) { return SITE_URL + "/listing.html?id=" + encodeURIComponent(o.slug); }
  function attrs(o) { return 'data-opp data-base="' + esc(o.base) + '" data-opens="' + esc(o.opens) + '" data-deadline="' + esc(o.deadline) + '" data-start="' + esc(o.start) + '" data-end="' + esc(o.end) + '"'; }
  function pill(o) { var s = phase(o).s; return '<span class="pill" data-status="' + s + '">' + (LABELS[s] || s) + "</span>"; }
  function signedIn() { return document.documentElement.getAttribute("data-auth") === "in"; }
  function saveBtn(o, cls) {
    return '<button class="' + (cls || "save-btn") + '" type="button" data-auth-in' + (signedIn() ? "" : " hidden") + ' data-save="' + esc(o.slug) + '" aria-pressed="false" aria-label="Save ' + esc(o.title) + '">' +
      icon("bookmark") + "<span data-save-label>Save</span></button>";
  }

  /* ---------- a directory card (mirrors card() in _source/build.py) ---------- */
  function cardHTML(o, pre, href) {
    var c = CAT[o.category];
    var search = [o.title, o.organizer, o.summary, c[1], o.location, o.mode, REGIONS[o.region]].join(" ").toLowerCase();
    var verified = o.verified ? '<span class="verified">' + icon("check") + "Verified " + fdate(o.verified) + "</span>" : '<span class="verified">General listing</span>';
    var where = (!o.location || o.location === o.mode || o.location === "Online") ? o.mode : o.mode + " · " + o.location;
    var cd = countdown(o);
    return '<article class="opp-card" ' + attrs(o) + ' data-slug="' + esc(o.slug) + '" data-cat="' + o.category + '" data-mode="' + modeKey(o.mode) + '" data-region="' + o.region +
      '" data-free="' + (o.free ? "1" : "0") + '" data-level="' + esc(o.level) + '" data-title="' + esc(o.title.toLowerCase()) + '" data-verified="' + esc(o.verified) + '" data-search="' + esc(search) +
      '" data-live data-live-sig="' + esc(o.updated_at) + '">' +
      '<div class="opp-top"><span class="opp-cat">' + esc(c[2]) + "</span>" + pill(o) + "</div>" +
      '<h3><a href="' + (pre || "") + (href || pageUrl(o, true)) + '">' + esc(o.title) + "</a></h3>" +
      '<p class="opp-org">' + esc(o.organizer) + "</p>" +
      '<ul class="facts"><li>' + icon("calendar") + "<span>" + esc(shortWhen(o)) + "</span></li><li>" + icon("pin") + "<span>" + esc(where) + "</span></li><li>" + icon("coin") + "<span>" + esc(o.cost) + "</span></li></ul>" +
      '<div class="opp-tags"><span class="tag">' + REGIONS[o.region] + '</span><span class="tag">' + esc(o.level) + "</span>" + (o.free ? '<span class="tag tag-free">Free</span>' : "") + "</div>" +
      '<div class="opp-foot">' + verified + '<span class="countdown" data-countdown' + (cd ? "" : " hidden") + ">" + esc(cd) + "</span>" + saveBtn(o) + "</div></article>";
  }

  /* ---------- calendar links ---------- */
  function addDays(s, n) { var x = ymd(s); var t = new Date(Date.UTC(x.y, x.m, x.d + n)); return t.toISOString().slice(0, 10); }
  function compact(s) { return String(s).replace(/-/g, ""); }
  function gcal(o, kind) {
    var s, en, title;
    if (kind === "deadline") { s = o.deadline; en = addDays(s, 1); title = "Deadline: " + o.title; }
    else if (kind === "opens") { s = o.opens; en = addDays(s, 1); title = "Applications open: " + o.title; }
    else { s = o.start; en = addDays(o.end || o.start, 1); title = o.title; }
    var link = isInternal(o.link) ? SITE_URL + "/" + o.link : o.link;
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(title) + "&dates=" + compact(s) + "/" + compact(en) +
      "&details=" + encodeURIComponent(o.summary + " Official page: " + link + " Listed on swabud.tech") + "&location=" + encodeURIComponent(o.location);
  }
  function icsData(o) {
    var clean = function (t) { return String(t).replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, " "); };
    var stamp = compact(todayISO()) + "T000000Z", desc = clean(o.summary + " Details: " + shareUrl(o)), ev = "";
    function one(uid, title, s, en) {
      return "BEGIN:VEVENT\r\nUID:" + uid + "@swabud.tech\r\nDTSTAMP:" + stamp + "\r\nDTSTART;VALUE=DATE:" + compact(s) + "\r\nDTEND;VALUE=DATE:" + compact(en) +
        "\r\nSUMMARY:" + title + "\r\nDESCRIPTION:" + desc + "\r\nURL:" + shareUrl(o) + "\r\nEND:VEVENT\r\n";
    }
    if (o.start) ev += one(o.slug + "-event", clean(o.title), o.start, addDays(o.end || o.start, 1));
    if (o.deadline) ev += one(o.slug + "-deadline", clean("Deadline: " + o.title), o.deadline, addDays(o.deadline, 1));
    if (!ev) return "";
    return "data:text/calendar;charset=utf-8," + encodeURIComponent("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SWABUD//swabud.tech//EN\r\nCALSCALE:GREGORIAN\r\n" + ev + "END:VCALENDAR\r\n");
  }

  /* ---------- the full listing page (mirrors build_detail() in _source/build.py) ---------- */
  function ext(url, text, cls) { return '<a' + (cls ? ' class="' + cls + '"' : "") + ' href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + text + "</a>"; }
  function googleG() { var t = document.getElementById("tpl-google"); return t ? t.innerHTML : ""; }
  function lockCard(o) {
    var next = pageUrl(o, false);
    var perks = ["The official application link", "Step-by-step how to apply" + (o.notes ? " and SWABUD's tips" : ""), "Cost, benefits and level", "Calendar reminders and your personal tracker"];
    return '<div class="lock-card visitors-only lock-inline"><span class="lock-badge">' + icon("lock") + "Members only · free</span><h2>Unlock how to apply</h2>" +
      "<p>Create a free SWABUD account to see the full listing and keep track of it.</p><ul class=\"lock-perks\">" +
      perks.map(function (p) { return "<li>" + icon("check") + "<span>" + esc(p) + "</span></li>"; }).join("") + "</ul>" +
      '<div class="gate-actions"><button class="btn btn-google" type="button" data-google-signin data-next="' + esc(next) + '">' + googleG() + "Continue with Google</button>" +
      '<a class="btn btn-lime" href="signup.html" data-set-next="' + esc(next) + '">' + icon("user") + "Create a free account</a>" +
      '<a class="btn btn-ghost" href="login.html" data-set-next="' + esc(next) + '">Log in</a></div></div>';
  }
  function tickerHTML() {
    var units = ["d", "h", "m", "s"].map(function (k, i) { return '<span><b data-u="' + k + '">00</b><i>' + ["days", "hrs", "min", "sec"][i] + "</i></span>"; }).join("");
    return '<div class="countdown-big" data-ticker aria-live="off"><small data-ticker-label>When</small><div class="ticker" data-ticker-units hidden>' + units +
      '</div><strong class="ticker-done" data-ticker-done hidden></strong><p class="ticker-when" data-ticker-when hidden></p></div>';
  }
  function detailHTML(o) {
    var c = CAT[o.category], cd = countdown(o), share = shareUrl(o), today = todayISO();
    var steps = o.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");
    var go = isInternal(o.link) ? '<a class="btn btn-lime" href="' + esc(o.link) + '">More on SWABUD ' + icon("arrow") + "</a>"
      : ext(o.link, "Go to the official page " + icon("external"), "btn btn-lime");
    var cal = [];
    if (o.start && (o.end || o.start) >= today) cal.push(ext(gcal(o, "event"), icon("calendar") + "Add event to Google Calendar", "share-link"));
    if (o.deadline && o.deadline >= today) cal.push(ext(gcal(o, "deadline"), icon("calendar") + "Add deadline to Google Calendar", "share-link"));
    var ics = cal.length ? icsData(o) : "";
    if (ics) cal.push('<a class="share-link" href="' + ics + '" download="' + esc(o.slug) + '.ics">' + icon("calendar") + "Download .ics file</a>");
    var calHTML = cal.length ? '<div class="share-block"><p class="label">Add to your calendar</p><div class="share-row">' + cal.join("") + "</div></div>" : "";
    var msg = encodeURIComponent(o.title + ": " + share);
    var shares = ext("https://wa.me/?text=" + msg, icon("whatsapp") + '<span class="visually-hidden">Share on </span>WhatsApp', "share-link") +
      ext("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(share), icon("facebook") + '<span class="visually-hidden">Share on </span>Facebook', "share-link") +
      ext("https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(share), icon("linkedin") + '<span class="visually-hidden">Share on </span>LinkedIn', "share-link") +
      ext("https://twitter.com/intent/tweet?text=" + encodeURIComponent(o.title) + "&url=" + encodeURIComponent(share), icon("x") + '<span class="visually-hidden">Share on </span>X', "share-link") +
      '<button class="share-link" type="button" data-copy="' + esc(share) + '" data-copy-done="Link copied">' + icon("share") + "Copy link</button>";
    var note = o.notes ? '<div class="note"><strong>SWABUD note</strong>' + esc(o.notes) + "</div>" : "";
    var verified = o.verified ? fdate(o.verified) : "General listing, not individually dated";
    var report = "mailto:info@swabud.tech?subject=" + encodeURIComponent("Listing report: " + o.title) + "&body=" + encodeURIComponent("Listing: " + share + "\n\nWhat's wrong:\n");
    return "<div " + attrs(o) + ">" +
      '<section class="navy page-head"><div class="navy-pattern"></div><div class="wrap"><div class="frame">' +
      '<nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="opportunities.html">Opportunities</a><span aria-hidden="true">/</span>' +
      '<a href="opportunities.html#' + o.category + '">' + esc(c[2]) + '</a><span aria-hidden="true">/</span><span aria-current="page">' + esc(o.title) + "</span></nav>" +
      '<p class="eyebrow">' + esc(c[1]) + "</p><h1>" + esc(o.title) + "</h1>" +
      '<div class="meta">' + pill(o) + '<span class="countdown" style="color:#DCE4EF" data-countdown' + (cd ? "" : " hidden") + ">" + esc(cd) + "</span></div>" +
      '<p class="org">By ' + esc(o.organizer) + "</p></div></div></section>" +
      '<section class="section" style="padding-top:2.25rem"><div class="wrap detail"><article class="prose">' +
      '<p style="font-size:1.12rem;color:var(--ink)">' + esc(o.summary) + "</p>" +
      "<h2>Who can apply</h2><p>" + esc(o.who) + "</p><h2>Dates</h2><p>" + esc(o.dates || shortWhen(o)) + "</p>" +
      '<div class="members-only members-content"><h2>How to apply</h2>' + (steps ? "<ol>" + steps + "</ol>" : "<p>Follow the steps on the official page.</p>") + note +
      "<h2>What it costs and what you get</h2><p><strong>Cost:</strong> " + esc(o.cost) + "</p><p><strong>Benefits:</strong> " + esc(o.benefits) + "</p></div>" +
      lockCard(o) +
      '<h2>Before you apply</h2><ul class="checklist">' +
      ["Open the official page and confirm the dates in Nepal time.", "Read the eligibility rules in full, including age and country.",
        "Never pay an agent or a third party to apply. Official programmes say clearly if there is a fee.", "Save a copy of your application and any confirmation email."]
        .map(function (t) { return "<li>" + icon("check") + "<span>" + t + "</span></li>"; }).join("") + "</ul>" +
      '<h2>Share it with a friend</h2><div class="share-row">' + shares + "</div>" +
      '<p style="margin-top:1.5rem"><a class="share-link" href="' + esc(report) + '">' + icon("flag") + "Report a problem with this listing</a></p>" +
      "</article>" +
      '<aside class="factsheet" aria-label="Key facts">' + tickerHTML() +
      "<dl><div><dt>Status</dt><dd>" + pill(o) + "</dd></div><div><dt>When</dt><dd>" + esc(shortWhen(o)) + "</dd></div>" +
      "<div><dt>Format and location</dt><dd>" + esc(o.mode) + (o.location ? " · " + esc(o.location) : "") + "</dd></div>" +
      '<div class="members-only"><dt>Cost</dt><dd>' + esc(o.cost) + '</dd></div><div class="members-only"><dt>Benefits</dt><dd>' + esc(o.benefits) + "</dd></div>" +
      '<div class="members-only"><dt>Level</dt><dd>' + esc(o.level) + "</dd></div><div><dt>Last verified by SWABUD</dt><dd>" + esc(verified) + "</dd></div></dl>" +
      '<div class="actions"><div class="members-only members-content">' + go + "</div>" +
      '<a class="btn btn-lime visitors-only" href="login.html" data-set-next="' + esc(pageUrl(o, false)) + '">' + icon("lock") + "Log in to apply</a>" +
      '<a class="btn btn-ghost visitors-only" href="signup.html" data-set-next="' + esc(pageUrl(o, false)) + '">Create a free account</a>' +
      saveBtn(o, "btn btn-ghost save-btn save-wide") + '<div class="members-only">' + calHTML + "</div></div></aside></div></section>" +
      '<section class="section section-alt" data-related hidden><div class="wrap"><div class="section-head"><div><p class="eyebrow">Keep exploring</p><h2>Related opportunities</h2></div>' +
      '<a class="link-arrow" href="opportunities.html">All opportunities ' + icon("arrow") + '</a></div><div class="card-grid" data-related-grid></div></div></section></div>';
  }

  /* ---------- compact entry for member features (same shape as assets/js/data.js) ---------- */
  function compactOf(o) {
    return { s: o.slug, t: o.title, c: o.category, cl: CAT[o.category][2], o: o.organizer, b: o.base, op: o.opens, dl: o.deadline, st: o.start, en: o.end,
      r: o.region, f: o.free ? 1 : 0, w: shortWhen(o), lv: o.level, v: o.verified, l: o.link, x: 1 };
  }

  /* ---------- loading the rows ---------- */
  var ROWS = null;
  function sig(rows) { return (rows || []).map(function (r) { return r.slug + "@" + r.status + "@" + r.updated_at; }).sort().join("|"); }
  function readCache() { try { var c = JSON.parse(lsGet(CACHE) || "null"); return c && Array.isArray(c.rows) ? c.rows : null; } catch (e) { return null; } }
  function demoRows() {
    try { var all = JSON.parse(lsGet(DEMO_STORE) || "[]"); return all.filter(function (r) { return r.status === "published" || r.status === "removed"; }); } catch (e) { return []; }
  }
  function fetchRows() {
    if (MODE === "demo") return Promise.resolve(demoRows());
    if (MODE !== "supabase" || !window.fetch) return Promise.resolve([]);
    return fetch(API + "/rest/v1/opportunities?select=*&status=in.(published,removed)&order=updated_at.desc", {
      headers: { apikey: KEY, Accept: "application/json" }, cache: "no-store"
    }).then(function (r) {
      if (r.ok) return r.json();
      if (r.status === 404 || r.status === 400) return []; /* the table isn't set up yet */
      throw new Error("live listings: " + r.status);
    });
  }

  /* ---------- putting them on the page ---------- */
  function fresh(r, staticEl) {
    /* a static copy is current when it was built after the last change in the admin panel */
    return !staticEl || staticEl.hasAttribute("data-live") || ms(r.updated_at) > BUILT;
  }
  function placeCards(container, rows, pre) {
    if (!container) return false;
    var changed = false;
    rows.forEach(function (r) {
      var o = rec(r), ex = container.querySelector('.opp-card[data-slug="' + cssq(o.slug) + '"]');
      if (o.status === "removed") { if (ex) { ex.parentNode.removeChild(ex); changed = true; } return; }
      if (o.status !== "published" || !fresh(r, ex)) return;
      if (ex && ex.getAttribute("data-live-sig") === (o.updated_at || "")) return;
      var tmp = document.createElement("div");
      tmp.innerHTML = cardHTML(o, pre);
      var card = tmp.firstChild;
      if (ex) container.replaceChild(card, ex); else container.insertBefore(card, container.firstChild);
      changed = true;
    });
    return changed;
  }
  function mergeData() {
    var D = window.SWABUD_DATA;
    if (!D || !ROWS) return;
    ROWS.forEach(function (r) {
      var o = rec(r), i = -1;
      for (var k = 0; k < D.length; k++) if (D[k].s === o.slug) { i = k; break; }
      if (o.status === "removed") { if (i !== -1) D.splice(i, 1); return; }
      if (o.status !== "published") return;
      var c = compactOf(o);
      if (i !== -1) { c.x = D[i].x || 0; D[i] = c; } else D.push(c);
    });
  }

  /* calendar: add each dated row to its month, creating the month when needed */
  function monthBlock(y, m) {
    var title = MONTH_FULL[m] + " " + y, found = null;
    each(".members-only .cal-month", function (sec) { var h = sec.querySelector("h2"); if (h && h.textContent.trim() === title) found = sec; });
    if (found) return found;
    var first = new Date(Date.UTC(y, m, 1)).getUTCDay(), days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), today = todayISO();
    var cells = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(function (w) { return '<span class="dow">' + w + "</span>"; }).join("");
    for (var i = 0; i < first; i++) cells += '<span class="day empty"></span>';
    for (var dd = 1; dd <= days; dd++) {
      var iso = y + "-" + (m < 9 ? "0" : "") + (m + 1) + "-" + (dd < 10 ? "0" : "") + dd;
      cells += '<span class="day' + (iso === today ? " today" : "") + '" data-date="' + iso + '">' + dd + "</span>";
    }
    var sec = document.createElement("section");
    sec.className = "cal-month";
    sec.innerHTML = "<h2>" + title + '</h2><div class="cal-layout"><div class="cal-grid" aria-hidden="true">' + cells + '</div><ol class="cal-list"></ol></div>';
    var key = y * 12 + m, before = document.querySelector("[data-cal-expected]"), done = false;
    each(".members-only .cal-month:not([data-cal-expected])", function (s) {
      if (done) return;
      var h = s.querySelector("h2"), p = h ? h.textContent.trim().split(" ") : [];
      var k = Number(p[1]) * 12 + MONTH_FULL.indexOf(p[0]);
      if (k > key) { before = s; done = true; }
    });
    if (before && before.parentNode) before.parentNode.insertBefore(sec, before);
    return sec;
  }
  function placeCalendar(rows) {
    var expected = document.querySelector("[data-cal-expected]");
    if (!expected) return false;
    var today = todayISO(), changed = false;
    rows.forEach(function (r) {
      var o = rec(r);
      var old = document.querySelectorAll('.cal-item[data-slug="' + cssq(o.slug) + '"]');
      var anyStatic = Array.prototype.some.call(old, function (x) { return !x.hasAttribute("data-live"); });
      if (o.status !== "removed" && (o.status !== "published" || (anyStatic && !(ms(r.updated_at) > BUILT)))) return;
      if (old.length && old[0].getAttribute("data-live-sig") === o.updated_at && o.status === "published") return;
      Array.prototype.forEach.call(old, function (x) { x.parentNode.removeChild(x); changed = true; });
      each('.expected li[data-slug="' + cssq(o.slug) + '"]', function (x) { x.parentNode.removeChild(x); });
      if (o.status !== "published" || phase(o).s === "closed") return;
      var items = [];
      if (o.opens && o.opens >= today) items.push([o.opens, "opens"]);
      if (o.deadline && o.deadline >= today) items.push([o.deadline, "deadline"]);
      if (o.start && (o.end || o.start) >= today) items.push([o.start < today ? today : o.start, "event"]);
      if (!items.length && !o.start && !o.deadline && (phase(o).s === "upcoming" || phase(o).s === "recurring")) {
        var ul = expected.querySelector(".expected");
        if (ul) { var li = document.createElement("li"); li.setAttribute("data-slug", o.slug); li.innerHTML = '<a href="' + pageUrl(o, true) + '">' + esc(o.title) + "</a><span>" + esc(shortWhen(o)) + "</span>"; ul.appendChild(li); changed = true; }
      }
      items.forEach(function (it) {
        var x = ymd(it[0]), sec = monthBlock(x.y, x.m), list = sec.querySelector(".cal-list"), kind = it[1];
        var label = { deadline: "Deadline", opens: "Applications open" }[kind] || (o.start < today ? "Happening now" : (o.category === "events" ? "Event" : "Starts"));
        var dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(Date.UTC(x.y, x.m, x.d)).getUTCDay()];
        var li = document.createElement("li");
        li.className = "cal-item";
        li.setAttribute("data-live", ""); li.setAttribute("data-live-sig", o.updated_at);
        li.setAttribute("data-opp", ""); li.setAttribute("data-base", o.base); li.setAttribute("data-opens", o.opens); li.setAttribute("data-deadline", o.deadline);
        li.setAttribute("data-start", o.start); li.setAttribute("data-end", o.end); li.setAttribute("data-slug", o.slug); li.setAttribute("data-date", it[0]); li.setAttribute("data-kind", kind);
        li.innerHTML = '<span class="board-date cal-date"><b>' + x.d + "</b><small>" + dow + '</small></span><span class="cal-body"><span class="cal-kind cal-' + kind + '">' + label + "</span>" +
          '<a href="' + pageUrl(o, true) + '">' + esc(o.title) + '</a><span class="cal-meta">' + pill(o) + "<span>" + esc(String(o.location).split(" (")[0]) + "</span></span></span>" +
          ext(gcal(o, kind === "event" ? "event" : kind), icon("calendar") + '<span class="visually-hidden">Add ' + esc(o.title) + " to </span>Google Calendar", "share-link cal-add");
        var after = null;
        each(".cal-item", function (n) { if (!after && (n.getAttribute("data-date") || "") > it[0]) after = n; }, list);
        list.insertBefore(li, after);
        var cell = sec.querySelector('.day[data-date="' + it[0] + '"]');
        if (cell) cell.classList.add(kind === "deadline" ? "has-deadline" : (kind === "opens" ? "has-opens" : "has-event"));
        changed = true;
      });
    });
    return changed;
  }

  /* the listing page shell: listing.html?id=<slug> */
  function param(n) { var m = new RegExp("[?&]" + n + "=([^&#]*)").exec(location.search); return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : ""; }
  var listingDone = "";
  function renderListing(rows, final) {
    var host = document.getElementById("live-listing");
    if (!host) return;
    var id = param("id"), live = param("live") === "1", row = null;
    rows.forEach(function (r) { if (r.slug === id) row = r; });
    function message(h, p) {
      host.innerHTML = '<section class="navy page-head"><div class="navy-pattern"></div><div class="wrap"><div class="frame"><p class="eyebrow">Opportunities</p><h1>' + h + "</h1><p>" + p +
        '</p><div style="margin-top:1.25rem"><a class="btn btn-lime" href="opportunities.html">Browse opportunities ' + icon("arrow") + "</a></div></div></div></section>";
    }
    if (!row) {
      if (!final) return;
      if (id && !live && /^[a-z0-9-]+$/.test(id)) { location.replace("opportunities/" + id + ".html"); return; }
      if (listingDone !== "missing") { listingDone = "missing"; message("We couldn't find this listing", "It may have been renamed or taken down. All current opportunities are in the directory."); }
      return;
    }
    var o = rec(row);
    if (o.status === "removed") { if (listingDone !== "removed") { listingDone = "removed"; message("This listing is no longer on SWABUD", "It closed or was taken down after a check. Browse what's open now."); } return; }
    if (o.status !== "published") return;
    function show() {
      var key = o.slug + "@" + o.updated_at;
      if (listingDone === key) return;
      listingDone = key;
      host.innerHTML = detailHTML(o);
      document.title = o.title + " | SWABUD";
      var d = document.querySelector('meta[name="description"]'); if (d) d.setAttribute("content", o.summary.slice(0, 155));
      after();
      related(o);
    }
    if (!live) {
      /* once the site has been rebuilt the listing has a static page: send people there */
      if (!final || listingDone === "checking") return;
      if (listingDone === "") {
        listingDone = "checking";
        fetch("opportunities/" + encodeURIComponent(o.slug) + ".html", { method: "HEAD", cache: "no-store" }).then(function (r) {
          if (r.ok) { location.replace("opportunities/" + o.slug + ".html"); return; }
          listingDone = ""; live = true; show();
        }).catch(function () { listingDone = ""; live = true; show(); });
        return;
      }
    }
    show();
  }

  /* three related listings under a listing page, like the static pages have */
  function related(o) {
    var box = document.querySelector("[data-related]"), grid = document.querySelector("[data-related-grid]");
    if (!box || !grid || !window.fetch) return;
    var v = document.querySelector('meta[name="swabud-build"]');
    fetch(BASE + "assets/data/listings.json" + (v ? "?v=" + v.getAttribute("content") : "")).then(function (r) { return r.ok ? r.json() : { listings: [] }; }).then(function (j) {
      var gone = {}, live = [];
      (ROWS || []).forEach(function (r) { if (r.status === "removed") gone[r.slug] = 1; else if (r.status === "published") live.push(rec(r)); });
      var pool = live.concat((j.listings || []).map(rec)).filter(function (x, i, arr) {
        return x.slug !== o.slug && !gone[x.slug] && phase(x).s !== "closed" && arr.findIndex(function (y) { return y.slug === x.slug; }) === i;
      });
      var same = pool.filter(function (x) { return x.category === o.category; }), pick = same.slice(0, 3);
      if (pick.length < 3) pick = pick.concat(pool.filter(function (x) { return pick.indexOf(x) === -1; }).slice(0, 3 - pick.length));
      if (!pick.length) return;
      var liveSlugs = {}; live.forEach(function (x) { liveSlugs[x.slug] = 1; });
      grid.innerHTML = pick.map(function (x) { return cardHTML(x, "", liveSlugs[x.slug] ? pageUrl(x, true) : "opportunities/" + x.slug + ".html"); }).join("");
      box.hidden = false;
      after();
    }).catch(function () { /* keep the page without related listings */ });
  }

  /* a static listing page whose listing was edited or removed in the admin panel: show the latest version */
  function checkStaticPage(rows) {
    var m = /\/opportunities\/([a-z0-9-]+)\.html$/.exec(location.pathname);
    if (!m) return;
    var row = null;
    rows.forEach(function (r) { if (r.slug === m[1]) row = r; });
    if (!row) return;
    var isDetail = !!document.querySelector("main > [data-opp]");
    var is404 = !isDetail;
    if ((is404 && row.status === "published") || (isDetail && (row.status === "removed" || ms(row.updated_at) > BUILT)))
      location.replace(BASE + "listing.html?id=" + encodeURIComponent(m[1]) + "&live=1");
  }

  function after() {
    if (SW.refreshStatuses) SW.refreshStatuses();
    if (SW.renderTickers) SW.renderTickers();
    if (SW.paintSaved) SW.paintSaved();
  }
  function apply(rows, final) {
    ROWS = rows;
    mergeData();
    if (PAGE === "listing") { renderListing(rows, final); return; }
    checkStaticPage(rows);
    var dirChanged = placeCards(document.getElementById("directory"), rows, "");
    var savedChanged = placeCards(document.querySelector("[data-saved-list]"), rows, "");
    var calChanged = placeCalendar(rows);
    if (dirChanged || savedChanged || calChanged) {
      after();
      if (dirChanged && SW.applyDirectory) SW.applyDirectory();
      try { document.dispatchEvent(new CustomEvent("swabud:live", { detail: { rows: rows } })); } catch (e) { /* ignore */ }
    }
  }

  SW.live = {
    mode: MODE, rec: rec, cardHTML: cardHTML, detailHTML: detailHTML, compactOf: compactOf, shortWhen: shortWhen, CATS: CATS, LABELS: LABELS, REGIONS: REGIONS,
    rows: function () { return ROWS || []; }, mergeData: mergeData,
    refresh: function () { return fetchRows().then(function (r) { lsSet(CACHE, JSON.stringify({ at: Date.now(), rows: r })); apply(r, true); return r; }); }
  };
  window.SWABUD_LIVE = SW.live;
  if (MODE === "off" || PAGE === "admin") return;

  var cached = readCache();
  if (cached) apply(cached, false);
  else if (PAGE === "listing") renderListing([], false);
  fetchRows().then(function (rows) {
    var changed = !cached || sig(rows) !== sig(cached);
    lsSet(CACHE, JSON.stringify({ at: Date.now(), rows: rows }));
    if (changed || PAGE === "listing") apply(rows, true);
  }).catch(function () {
    if (PAGE === "listing") apply(cached || [], true);
  });
})();
