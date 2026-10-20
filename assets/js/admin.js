/* SWABUD admin panel (admin.html).
   Add, edit, publish, unpublish and remove opportunities, and turn student submissions into listings,
   without touching code. Published listings show on the site straight away (assets/js/live.js) and are
   built into static pages by the "Publish admin listings" GitHub Action (every 30 minutes).
   Data: Supabase tables public.opportunities and public.submissions (run supabase/admin.sql once).
   Only emails in public.admins can use it. In preview mode everything is stored in this browser. */
(function () {
  "use strict";
  var SW = window.SWABUD || {}, A = SW.auth, L = SW.live;
  var app = document.getElementById("admin-app");
  if (!app) return;
  var CFG = window.SWABUD_CONFIG || {};
  var vm = document.querySelector('meta[name="swabud-build"]');
  var VER = vm ? vm.getAttribute("content") : "";
  var BASE = A ? A.base : "";
  var css = document.createElement("link");
  css.rel = "stylesheet"; css.href = BASE + "assets/css/admin.css?v=" + VER;
  document.head.appendChild(css);
  if (!A || !L) { app.innerHTML = "<p>The admin panel couldn't start. Reload the page.</p>"; return; }

  var DEMO_STORE = "swabud-demo-admin-opps", REPO_KEY = "swabud-admin-repo";
  var CATS = L.CATS, LABELS = L.LABELS, REGIONS = L.REGIONS;
  var CAT = {}; CATS.forEach(function (c) { CAT[c[0]] = c; });
  var BASES = [
    ["open", "Open", "Applications are open now. Add the deadline."],
    ["upcoming", "Upcoming", "Announced, but applications aren't open yet. Add the opening or start date."],
    ["rolling", "Always open", "No deadline: people can join any time."],
    ["recurring", "Opens yearly", "Runs every year; the next dates aren't announced yet."],
    ["closed", "Closed", "Closed until you update it."]
  ];
  var MODES = ["Online", "In person", "Online or in person"];
  var LEVELS = ["All levels", "Beginner-friendly", "Beginner to intermediate", "Intermediate", "Advanced"];
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var S = { store: null, rows: [], statics: [], built: "", levels: LEVELS.slice(), subs: [], subsError: "", filter: { q: "", cat: "", show: "all" }, limit: 50, form: null, dirty: false, busy: false };

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function icon(n) { return '<svg class="icon" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function each(sel, fn, scope) { Array.prototype.forEach.call((scope || document).querySelectorAll(sel), fn); }
  function toast(m) { if (SW.toast) SW.toast(m); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function todayISO() { return new Date(Date.now() + 345 * 60000).toISOString().slice(0, 10); }
  function ymd(s) { var p = String(s || "").split("-").map(Number); return p.length === 3 && p[0] ? { y: p[0], m: p[1] - 1, d: p[2] } : null; }
  function fdate(s, year) { var x = ymd(s); return x ? x.d + " " + MON[x.m] + (year === false ? "" : " " + x.y) : ""; }
  function when(iso) {
    var t = Date.parse(iso || ""); if (isNaN(t)) return "";
    var mins = Math.round((Date.now() - t) / 60000);
    if (mins < 1) return "just now"; if (mins < 60) return mins + " min ago";
    var h = Math.round(mins / 60); if (h < 24) return h + " h ago";
    var d = new Date(t + 345 * 60000); return d.getUTCDate() + " " + MON[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }
  function stamp(iso) { var t = Date.parse(iso || ""); if (isNaN(t)) return "not yet"; var d = new Date(t + 345 * 60000); return d.getUTCDate() + " " + MON[d.getUTCMonth()] + " " + d.getUTCFullYear() + ", " + ("0" + d.getUTCHours()).slice(-2) + ":" + ("0" + d.getUTCMinutes()).slice(-2) + " Nepal time"; }
  function slugify(t) { return String(t || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-").slice(0, 80).replace(/-+$/, ""); }
  function phase(o) { return SW.phase ? SW.phase({ base: o.base, opens: o.opens, deadline: o.deadline, start: o.start, end: o.end }) : { s: o.base }; }
  function pill(o) { var s = phase(o).s; return '<span class="pill" data-status="' + s + '">' + (LABELS[s] || s) + "</span>"; }
  function supaRef() { var m = /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(CFG.supabaseUrl || ""); return m ? m[1] : ""; }
  function sqlLink() { var r = supaRef(); return r ? "https://supabase.com/dashboard/project/" + r + "/sql/new" : "https://supabase.com/dashboard"; }

  /* ---------- data stores: Supabase, or this browser in preview mode ---------- */
  function check(r) { if (r && r.error) throw r.error; return r ? r.data : null; }
  function SupaStore(c) {
    return {
      isAdmin: function () { return c.rpc("is_admin").then(check).then(function (d) { return d === true; }); },
      list: function () { return c.from("opportunities").select("*").order("updated_at", { ascending: false }).then(check); },
      save: function (row) { return c.from("opportunities").upsert(row, { onConflict: "slug" }).select().single().then(check); },
      remove: function (slug) { return c.from("opportunities").delete().eq("slug", slug).then(check); },
      subs: function () { return c.from("submissions").select("*").order("created_at", { ascending: false }).then(check); },
      updateSub: function (id, f) { return c.from("submissions").update(f).eq("id", id).select().single().then(check); }
    };
  }
  function DemoStore() {
    function all() { try { return JSON.parse(lsGet(DEMO_STORE) || "[]"); } catch (e) { return []; } }
    function put(list) { lsSet(DEMO_STORE, JSON.stringify(list)); }
    var subs = null;
    return {
      demo: true,
      isAdmin: function () { return Promise.resolve(true); },
      list: function () { return Promise.resolve(all().sort(function (a, b) { return (b.updated_at || "").localeCompare(a.updated_at || ""); })); },
      save: function (row) {
        var list = all(), now = new Date().toISOString(), i = -1;
        list.forEach(function (r, k) { if (r.slug === row.slug) i = k; });
        var out = Object.assign({}, i === -1 ? { created_at: now } : list[i], row, { updated_at: now, updated_by: (A.user && A.user.email) || "" });
        if (i === -1) list.push(out); else list[i] = out;
        put(list);
        return Promise.resolve(out);
      },
      remove: function (slug) { put(all().filter(function (r) { return r.slug !== slug; })); return Promise.resolve(null); },
      subs: function (force) {
        if (subs && !force) return Promise.resolve(subs);
        return A.backend().then(function (b) { return b && b.listSubmissions ? b.listSubmissions() : []; }).then(function (r) { subs = r || []; return subs; });
      },
      updateSub: function (id, f) {
        (subs || []).forEach(function (s) { if (s.id === id) Object.assign(s, f); });
        try { /* keep the change in this browser's preview data too */
          var who = JSON.parse(lsGet("swabud-demo-session") || "null"), key = who && "swabud-demo-data-" + who.id;
          var d = key && JSON.parse(lsGet(key) || "null");
          if (d && d.submissions) { d.submissions.forEach(function (s) { if (s.id === id) Object.assign(s, f); }); lsSet(key, JSON.stringify(d)); }
        } catch (e) { /* ignore */ }
        return Promise.resolve(null);
      }
    };
  }
  function openStore() {
    if (A.mode === "demo") return Promise.resolve(DemoStore());
    return A.backend().then(function (b) {
      if (!b || !b.client) throw new Error("Accounts aren't connected on this site.");
      return b.client();
    }).then(SupaStore);
  }
  function isSetupError(e) {
    var code = (e && e.code) || "", m = (e && e.message) || "";
    return /^(PGRST202|PGRST205|PGRST204|42P01|42883)$/.test(code) || /could not find the (function|table)|does not exist|schema cache/i.test(m);
  }
  function errText(e) {
    var m = (e && (e.message || e.error_description)) || String(e || "Something went wrong.");
    if (/violates row-level security|permission denied/i.test(m)) return "Your account isn't allowed to do this. Check that your login email is in public.admins.";
    if (/duplicate key/i.test(m)) return "A listing with this web address already exists.";
    if (/check constraint/i.test(m)) return "One of the fields isn't in the right format (" + m.replace(/^.*constraint "?([a-z_]+)"?.*$/i, "$1") + ").";
    if (/Failed to fetch|NetworkError|network/i.test(m)) return "We couldn't reach the database. Check your connection and try again.";
    return m;
  }

  /* ---------- gates ---------- */
  function gate(html) { app.innerHTML = '<div class="adm-gate">' + html + "</div>"; }
  function gateOff() {
    gate("<h2>Accounts aren't switched on yet</h2><p>The admin panel uses the same Supabase accounts as the rest of the site. Add your Supabase URL and key in <code>assets/js/config.js</code> (README, Step 2), publish, then come back here.</p>");
  }
  function gateLogin() {
    var g = $("#tpl-google");
    gate("<h2>Log in with your admin account</h2><p>Use the same Google account or email you added as an admin in Supabase.</p>" +
      '<div class="gate-actions"><button class="btn btn-google" type="button" data-google-signin data-next="admin.html">' + (g ? g.innerHTML : "") + "Continue with Google</button>" +
      '<a class="btn btn-navy" href="login.html" data-set-next="admin.html">' + icon("user") + "Log in with email</a></div>");
  }
  function sqlBox(sql) {
    return '<div class="adm-code"><code>' + esc(sql) + '</code><button class="btn btn-ghost btn-sm" type="button" data-copy="' + esc(sql) + '" data-copy-done="SQL copied">' + icon("share") + "Copy</button></div>";
  }
  function gateNotAdmin() {
    var email = (A.user && A.user.email || "").toLowerCase();
    gate("<h2>This account isn't an admin yet</h2><p>You're logged in as <strong>" + esc(email) + "</strong>. To make it an admin:</p><ol>" +
      '<li>Open the <a href="' + sqlLink() + '" target="_blank" rel="noopener noreferrer">Supabase SQL Editor</a> for SWABUD.</li>' +
      "<li>Paste this line and click <strong>Run</strong>:" + sqlBox("insert into public.admins (email) values ('" + email + "') on conflict do nothing;") + "</li>" +
      "<li>Come back here and reload the page.</li></ol>" +
      '<p>Haven\'t set up the admin panel yet? Run the whole <code>supabase/admin.sql</code> file first.</p><div class="gate-actions"><button class="btn btn-lime" type="button" data-reload>Reload</button><button class="btn btn-ghost" type="button" data-signout>Log out</button></div>');
  }
  function gateSetup() {
    gate("<h2>One more step: set up the admin tables</h2><p>The database doesn't have the admin panel's tables yet.</p><ol>" +
      '<li>Open the <a href="' + sqlLink() + '" target="_blank" rel="noopener noreferrer">Supabase SQL Editor</a> and click <strong>New query</strong>.</li>' +
      "<li>Paste everything from <code>supabase/admin.sql</code> (in your website folder), add your login email at the bottom, and click <strong>Run</strong>.</li>" +
      '<li>Reload this page.</li></ol><div class="gate-actions"><button class="btn btn-lime" type="button" data-reload>Reload</button></div>');
  }
  function gateError(e) {
    gate("<h2>We couldn't open the admin panel</h2><p>" + esc(errText(e)) + '</p><div class="gate-actions"><button class="btn btn-lime" type="button" data-reload>Try again</button></div>');
  }

  /* ---------- the merged list: listings already on the site + listings in the admin panel ---------- */
  function entries() {
    var by = {}, out = [];
    S.statics.forEach(function (o) { by[o.slug] = { slug: o.slug, site: o, row: null }; });
    S.rows.forEach(function (r) { (by[r.slug] = by[r.slug] || { slug: r.slug, site: null, row: null }).row = r; });
    Object.keys(by).forEach(function (k) {
      var e = by[k];
      e.d = e.row ? L.rec(e.row) : e.site;
      e.kind = !e.row ? "site" : (e.row.status === "draft" ? (e.site ? "edited-draft" : "draft") : (e.row.status === "removed" ? "removed" : (e.site ? "edited" : "new")));
      out.push(e);
    });
    return out;
  }
  var KIND = { site: "On the site", "new": "Added here · live", edited: "Edited here · live", draft: "Draft", "edited-draft": "Unpublished changes", removed: "Removed" };
  function viewUrl(e) {
    if (e.kind === "site" || e.kind === "edited-draft") return BASE + "opportunities/" + e.slug + ".html";
    return BASE + "listing.html?id=" + encodeURIComponent(e.slug) + "&live=1";
  }

  /* ---------- shell ---------- */
  function pending() { return S.subs.filter(function (s) { return s.status === "pending"; }).length; }
  function route() { var h = (location.hash || "").replace(/^#/, ""); return h || "list"; }
  function go(h) { if (location.hash !== "#" + h) location.hash = h; else render(); }
  function shell(active, body) {
    var tab = function (h, label, extra, cls) {
      return '<a class="adm-tab' + (cls ? " " + cls : "") + '" href="#' + h + '"' + (active === h ? ' aria-current="page"' : "") + ">" + label + (extra || "") + "</a>";
    };
    var pend = pending();
    app.innerHTML = '<div class="adm-bar"><nav class="adm-tabs" aria-label="Admin sections">' +
      tab("list", icon("list") + "All listings", ' <span class="adm-count">' + entries().length + "</span>") +
      tab("new", icon("plus") + "Add opportunity", "", "adm-add") +
      tab("subs", icon("send") + "Submissions", ' <span class="adm-count' + (pend ? " hot" : "") + '">' + pend + "</span>") +
      tab("publish", icon("spark") + "Publishing") +
      '</nav><div class="adm-who">' + (S.store && S.store.demo ? '<span class="adm-mode">Preview mode · saved in this browser</span>' : "") +
      "<span>" + esc(A.user && A.user.email) + '</span><a href="' + BASE + 'opportunities.html" target="_blank" rel="noopener">View site ' + icon("external") + "</a></div></div>" + body;
  }

  /* ---------- list view ---------- */
  function listView() {
    var all = entries(), f = S.filter, q = f.q.trim().toLowerCase();
    var counts = { live: 0, admin: 0, draft: 0 };
    all.forEach(function (e) {
      if (e.kind !== "removed" && e.kind !== "draft" && phase(e.d).s !== "closed") counts.live++;
      if (e.row) counts.admin++;
      if (e.kind === "draft" || e.kind === "edited-draft") counts.draft++;
    });
    var shown = all.filter(function (e) {
      if (f.cat && e.d.category !== f.cat) return false;
      if (q && (e.d.title + " " + e.slug + " " + e.d.organizer).toLowerCase().indexOf(q) === -1) return false;
      var st = phase(e.d).s;
      switch (f.show) {
        case "admin": return !!e.row;
        case "drafts": return e.kind === "draft" || e.kind === "edited-draft";
        case "removed": return e.kind === "removed";
        case "open": return e.kind !== "removed" && e.kind !== "draft" && (st === "open" || st === "closing" || st === "live" || st === "rolling");
        case "closed": return e.kind !== "removed" && st === "closed";
        default: return true;
      }
    });
    shown.sort(function (a, b) {
      var ua = a.row ? a.row.updated_at : "", ub = b.row ? b.row.updated_at : "";
      if (ua !== ub) return ub.localeCompare(ua);
      return a.d.title.localeCompare(b.d.title);
    });
    var rows = shown.slice(0, S.limit).map(function (e) {
      var o = e.d, c = CAT[o.category] || CATS[0];
      var actions = '<button class="adm-btn" type="button" data-edit="' + esc(e.slug) + '">' + icon("pen") + "Edit</button>" +
        (e.kind === "draft" ? "" : '<a class="adm-btn" href="' + viewUrl(e) + '" target="_blank" rel="noopener">' + icon("eye") + "View</a>") +
        '<button class="adm-btn" type="button" data-dup="' + esc(e.slug) + '" title="Copy into a new listing">' + icon("plus") + "Copy</button>" +
        (e.kind === "removed" ? '<button class="adm-btn" type="button" data-restore="' + esc(e.slug) + '">' + icon("check") + "Restore</button>"
          : (e.kind === "draft" ? '<button class="adm-btn danger" type="button" data-delete="' + esc(e.slug) + '">' + icon("close") + "Delete</button>"
            : '<button class="adm-btn danger" type="button" data-remove="' + esc(e.slug) + '">' + icon("close") + "Remove</button>"));
      return '<div class="adm-row"><div class="adm-title"><button type="button" data-edit="' + esc(e.slug) + '">' + esc(o.title) + "</button><small>" + esc(e.slug) + " · " + esc(o.organizer) + "</small></div>" +
        '<div class="adm-meta">' + esc(c[2]) + "</div>" +
        '<div class="adm-meta">' + (e.kind === "removed" ? '<span class="pill" data-status="closed">Removed</span>' : pill(o)) + "<br>" + esc(L.shortWhen(o)) + "</div>" +
        '<div class="adm-meta"><span class="adm-badge b-' + e.kind + '">' + KIND[e.kind] + "</span>" + (e.row ? "<br><small>" + esc(when(e.row.updated_at)) + "</small>" : "") + "</div>" +
        '<div class="adm-actions">' + actions + "</div></div>";
    }).join("");
    var catOpts = '<option value="">All categories</option>' + CATS.map(function (c) { return '<option value="' + c[0] + '"' + (f.cat === c[0] ? " selected" : "") + ">" + esc(c[1]) + "</option>"; }).join("");
    var showOpts = [["all", "Everything"], ["open", "Open now"], ["admin", "Added or edited here"], ["drafts", "Drafts"], ["removed", "Removed"], ["closed", "Closed"]]
      .map(function (s) { return '<option value="' + s[0] + '"' + (f.show === s[0] ? " selected" : "") + ">" + s[1] + "</option>"; }).join("");
    shell("list",
      '<div class="adm-stats"><div class="adm-stat"><b>' + all.length + "</b><span>listings in total</span></div>" +
      '<div class="adm-stat"><b>' + counts.live + "</b><span>live and not closed</span></div>" +
      '<div class="adm-stat"><b>' + counts.admin + "</b><span>added or edited here</span></div>" +
      '<div class="adm-stat"><b>' + counts.draft + "</b><span>drafts</span></div>" +
      '<div class="adm-stat"><b>' + pending() + "</b><span>submissions to review</span></div></div>" +
      '<div class="adm-tools"><div class="field field-search"><label for="a-q">Search</label><input class="input" id="a-q" type="search" placeholder="Title, organizer or web address" value="' + esc(f.q) + '"></div>' +
      '<div class="field"><label for="a-cat">Category</label><select class="input" id="a-cat">' + catOpts + "</select></div>" +
      '<div class="field"><label for="a-show">Show</label><select class="input" id="a-show">' + showOpts + "</select></div></div>" +
      '<div class="adm-list"><div class="adm-row adm-head"><span>Listing</span><span>Category</span><span>Status on the site</span><span>Source</span><span></span></div>' +
      (rows || '<div class="adm-empty">No listings match. <a href="#new">Add an opportunity</a>.</div>') +
      (shown.length > S.limit ? '<div class="adm-more-row"><button class="btn btn-ghost btn-sm" type="button" data-more>Show more (' + (shown.length - S.limit) + " left)</button></div>" : "") + "</div>");
    var qIn = $("#a-q");
    qIn.addEventListener("input", function () { S.filter.q = qIn.value; S.limit = 50; var pos = qIn.selectionStart; listView(); var n = $("#a-q"); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } });
    $("#a-cat").addEventListener("change", function (ev) { S.filter.cat = ev.target.value; S.limit = 50; listView(); });
    $("#a-show").addEventListener("change", function (ev) { S.filter.show = ev.target.value; S.limit = 50; listView(); });
  }

  /* ---------- the form model ---------- */
  function blank() {
    return { slug: "", title: "", category: "hackathons", organizer: "", summary: "", who: "", mode: "Online", location: "", region: "online", dates: "", when: "",
      start: "", end: "", deadline: "", opens: "", base: "open", cost: "", free: false, benefits: "", level: "All levels", link: "", verified: todayISO(), steps: ["", "", ""], notes: "" };
  }
  function fromRecord(o) {
    var f = blank();
    Object.keys(f).forEach(function (k) { if (o[k] != null) f[k] = Array.isArray(o[k]) ? o[k].slice() : o[k]; });
    if (!f.steps.length) f.steps = [""];
    return f;
  }
  function toRow(f, status) {
    var nul = function (v) { return v ? v : null; };
    return {
      slug: f.slug, title: f.title.trim(), category: f.category, organizer: f.organizer.trim(), summary: f.summary.trim(), who: f.who.trim(),
      mode: f.mode, location: f.location.trim(), region: f.region, dates: f.dates.trim(), when_text: f.when.trim(),
      opens: nul(f.opens), deadline: nul(f.deadline), start_date: nul(f.start), end_date: nul(f.end || ""), base: f.base,
      cost: f.cost.trim(), free: !!f.free, benefits: f.benefits.trim(), level: f.level.trim() || "All levels", link: f.link.trim(),
      verified: nul(f.verified), steps: f.steps.map(function (s) { return s.trim(); }).filter(Boolean), notes: f.notes.trim(), status: status,
      submission_id: f.submissionId || null
    };
  }
  function previewRec(f) { var r = toRow(f, "published"); r.updated_at = new Date().toISOString(); return L.rec(r); }
  function datesText(f) {
    var out = [], st = ymd(f.start), en = ymd(f.end);
    if (st) {
      if (en && f.end !== f.start) out.push(st.y === en.y && st.m === en.m ? st.d + " to " + en.d + " " + MON[en.m] + " " + en.y : fdate(f.start, st.y !== en.y) + " to " + fdate(f.end));
      else out.push(fdate(f.start));
    }
    if (f.opens) out.push("Applications open " + fdate(f.opens));
    if (f.deadline) out.push("Apply by " + fdate(f.deadline) + ", 11:59 PM Nepal time");
    return out.length ? out.join(". ") + "." : "";
  }
  function validate(f, publishing) {
    var err = {}, warn = [], today = todayISO();
    var need = function (k, msg) { if (!String(f[k] || "").trim()) err[k] = msg; };
    need("title", "Add a title.");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug)) err.slug = "Use lowercase letters, numbers and single dashes, for example nasa-space-apps-2026.";
    if (!/^https?:\/\/[^\s]+\.[^\s]+/i.test(f.link.trim()) && !/^[a-z0-9\/#._-]+\.html/.test(f.link.trim())) err.link = "Add the full official link, starting with https://";
    if (f.isNew && !err.slug) {
      var taken = entries().filter(function (e) { return e.slug === f.slug; })[0];
      if (taken) err.slug = "This web address is already used by \"" + taken.d.title + "\". Change it a little (for example add the year).";
    }
    if (publishing) {
      need("organizer", "Who runs it?");
      if (f.summary.trim().length < 40) err.summary = "Write at least one full sentence (40+ characters) about what it is.";
      need("who", "Who can apply?");
      need("cost", "Write the cost, for example Free, or Rs 500 registration.");
      need("benefits", "What do participants get?");
      if (!f.start && !f.deadline && !f.opens && !f.when.trim() && f.base !== "rolling") err.when = "Add a date, or a short date line such as \"Every year in March\".";
      if (!f.steps.some(function (s) { return s.trim(); })) err.steps = "Add at least one step.";
    }
    if (f.start && f.end && f.end < f.start) err.end = "The end date is before the start date.";
    if (f.opens && f.deadline && f.deadline < f.opens) err.deadline = "The deadline is before applications open.";
    if (f.deadline && f.deadline < today && f.base !== "closed") warn.push("The deadline has already passed, so this will show as Closed.");
    if (f.base === "open" && !f.deadline && !f.start) warn.push("\"Open\" listings usually have a deadline. If there is none, choose \"Always open\".");
    if (f.base === "upcoming" && !f.opens && !f.start) warn.push("\"Upcoming\" works best with an opening date or a start date, so the countdown can show.");
    if (f.verified && f.verified > today) err.verified = "The check date can't be in the future.";
    if (/^http:\/\//i.test(f.link.trim())) warn.push("The link starts with http://, not https://. Use the secure link if the site has one.");
    var twin = f.isNew && f.title.trim().length > 5 ? entries().filter(function (e) { return e.d.title.toLowerCase() === f.title.trim().toLowerCase(); })[0] : null;
    if (twin) warn.push("A listing with the same title already exists: \"" + twin.d.title + "\". Check it isn't a duplicate.");
    return { err: err, warn: warn, ok: Object.keys(err).length === 0 };
  }

  /* ---------- editor ---------- */
  function fld(id, label, input, help, req, cls) {
    return '<div class="field' + (cls ? " " + cls : "") + '" data-f="' + id + '"><label for="f-' + id + '">' + label + (req ? ' <span class="req">*</span>' : "") + "</label>" + input +
      (help ? '<span class="help">' + help + "</span>" : "") + '<span class="err" data-err="' + id + '" hidden></span></div>';
  }
  function inp(id, v, attrs) { return '<input class="input" id="f-' + id + '" name="' + id + '" value="' + esc(v) + '"' + (attrs || "") + ">"; }
  function area(id, v, rows, max) { return '<textarea class="input" id="f-' + id + '" name="' + id + '" rows="' + rows + '"' + (max ? ' maxlength="' + max + '"' : "") + ">" + esc(v) + "</textarea>"; }
  function sel(id, v, opts) { return '<select class="input" id="f-' + id + '" name="' + id + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === v ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>"; }
  function stepsHTML(steps) {
    return steps.map(function (s, i) {
      return '<div class="adm-step"><span>' + (i + 1) + '</span><input class="input" data-step="' + i + '" value="' + esc(s) + '" placeholder="' + (i === 0 ? "Register on the official page." : (i === 1 ? "Form a team or prepare your documents." : "Submit before the deadline.")) + '" maxlength="300">' +
        '<div class="adm-actions"><button class="adm-icon-btn" type="button" data-step-up="' + i + '" aria-label="Move step up"' + (i === 0 ? " disabled" : "") + ">&uarr;</button>" +
        '<button class="adm-icon-btn" type="button" data-step-down="' + i + '" aria-label="Move step down"' + (i === steps.length - 1 ? " disabled" : "") + ">&darr;</button>" +
        '<button class="adm-icon-btn" type="button" data-step-del="' + i + '" aria-label="Remove step">&times;</button></div></div>';
    }).join("");
  }
  function editorView(f) {
    S.form = f;
    var title = f.isNew ? (f.submissionId ? "New listing from a submission" : "Add an opportunity") : "Edit listing";
    var lead = "";
    if (f.origin === "site") lead = '<div class="adm-info">This listing is already on the site. When you publish, your version replaces it straight away, and the static page is rebuilt within 30 minutes.</div>';
    if (f.origin === "removed") lead = '<div class="adm-warn">This listing was removed from the site. Publish to bring it back.</div>';
    if (f.submissionId) lead = '<div class="adm-info">Filled in from a student submission. Check every detail on the official page before you publish; the submission is marked Published automatically.</div>';
    var catOpts = CATS.map(function (c) { return [c[0], c[1]]; });
    var levelList = '<datalist id="levels">' + S.levels.map(function (l) { return '<option value="' + esc(l) + '">'; }).join("") + "</datalist>";
    var html = '<div class="adm-editor"><form class="adm-form" id="adm-form" novalidate>' +
      "<div><h2 style=\"font-size:var(--step-2)\">" + esc(title) + "</h2>" + (f.isNew ? "" : '<p style="color:var(--muted);margin-top:.35rem">' + esc(f.title) + "</p>") + "</div>" + lead +
      '<div class="adm-errors" id="adm-errors" hidden></div>' +
      '<section class="adm-card"><h2><span class="num">1</span>The basics</h2><div class="adm-grid">' +
      fld("title", "Title", inp("title", f.title, ' maxlength="140" placeholder="NASA Space Apps Challenge 2026"'), "The official name, with the year if it has one.", true, "full") +
      fld("slug", "Web address", '<div class="adm-inline"><span style="color:var(--muted);font-size:.85rem;white-space:nowrap">swabud.tech/opportunities/</span>' + inp("slug", f.slug, ' maxlength="80"' + (f.isNew ? "" : " readonly")) + "</div>",
        f.isNew ? "Made from the title. You can shorten it." : "Can't change after publishing (old links would break). To rename, copy it into a new listing.", true, "full") +
      fld("category", "Category", sel("category", f.category, catOpts), "", true) +
      fld("organizer", "Organizer", inp("organizer", f.organizer, ' maxlength="160" placeholder="Who runs it"'), "", true) +
      fld("link", "Official link", '<div class="adm-inline">' + inp("link", f.link, ' type="url" maxlength="500" placeholder="https://..."') + '<a class="adm-btn" id="f-open-link" href="#" target="_blank" rel="noopener noreferrer">' + icon("external") + "Test</a></div>", "The organizer's own page, never a third-party post.", true, "full") +
      fld("summary", "What it is", area("summary", f.summary, 4, 1200) + '<span class="counter" data-count="summary"></span>', "Two or three plain sentences. The first one shows in search results.", true, "full") +
      fld("who", "Who can apply", area("who", f.who, 3, 800), "Age, level of study, country, team size.", true, "full") +
      "</div></section>" +
      '<section class="adm-card"><h2><span class="num">2</span>Dates and status</h2><p class="hint">All dates are Nepal time. A deadline closes at 11:59 PM on its day. The status and countdown change by themselves.</p><div class="adm-grid four">' +
      fld("opens", "Applications open", inp("opens", f.opens, ' type="date"')) +
      fld("deadline", "Deadline", inp("deadline", f.deadline, ' type="date"')) +
      fld("start", "Starts", inp("start", f.start, ' type="date"')) +
      fld("end", "Ends", inp("end", f.end, ' type="date"')) +
      '</div><div class="adm-grid">' +
      fld("base", "Status when there are no dates", sel("base", f.base, BASES.map(function (b) { return [b[0], b[1]]; })), '<span id="base-help"></span>', true) +
      fld("when", "Short date line", inp("when", f.when, ' maxlength="120" placeholder="Every year in March"'), "Only used when there are no exact dates.") +
      fld("dates", "Dates, in words", '<div class="adm-inline">' + inp("dates", f.dates, ' maxlength="400" placeholder="14 to 15 Nov 2026. Apply by 10 Nov 2026."') + '<button class="adm-btn" type="button" id="f-dates-auto">' + icon("spark") + "Write it</button></div>", "Shown on the listing page. \"Write it\" fills it from the dates above.", false, "full") +
      "</div></section>" +
      '<section class="adm-card"><h2><span class="num">3</span>Format, cost and level</h2><div class="adm-grid three">' +
      fld("mode", "Format", sel("mode", MODES.indexOf(f.mode) === -1 ? "Online" : f.mode, MODES.map(function (m) { return [m, m]; })), "", true) +
      fld("region", "Where", sel("region", f.region, [["online", "Online"], ["nepal", "In Nepal"], ["abroad", "Abroad"]]), "", true) +
      fld("location", "Location", inp("location", f.location, ' maxlength="160" placeholder="Kathmandu, Nepal or Online"'), "City and venue, or Online.") +
      '</div><div class="adm-grid">' +
      fld("cost", "Cost", inp("cost", f.cost, ' maxlength="160" placeholder="Free, or Rs 500 registration"'), "", true) +
      '<div class="field" style="align-self:end"><label class="adm-check"><input type="checkbox" id="f-free"' + (f.free ? " checked" : "") + '> Confirmed free</label><span class="help">Tick only if the official page says it\'s free. It adds the Free tag and filter.</span></div>' +
      fld("benefits", "What participants get", area("benefits", f.benefits, 2, 600), "Prizes, certificates, funding, mentors, experience.", true, "full") +
      fld("level", "Level", inp("level", f.level, ' list="levels" maxlength="40"') + levelList, "For example All levels, Beginner-friendly, Intermediate.", true) +
      fld("verified", "Checked on the official page", '<div class="adm-inline">' + inp("verified", f.verified, ' type="date"') + '<button class="adm-btn" type="button" id="f-today">' + icon("check") + "Today</button></div>", "The date you last confirmed the details.") +
      "</div></section>" +
      '<section class="adm-card"><h2><span class="num">4</span>How to apply</h2><p class="hint">Short steps members follow, in order.</p><div class="adm-steps" id="f-steps">' + stepsHTML(f.steps) + "</div>" +
      '<span class="err" data-err="steps" hidden></span><button class="adm-btn" type="button" id="f-add-step" style="margin-top:.75rem">' + icon("plus") + "Add a step</button>" +
      '<div class="adm-grid">' + fld("notes", "SWABUD note (optional)", area("notes", f.notes, 2, 800), "A tip or warning, for example \"No local event in Nepal this year; join the virtual one.\"", false, "full") + "</div></section>" +
      '<div class="adm-actbar"><div class="left"><button class="btn btn-lime" type="submit" data-act="publish">' + icon("send") + (f.isNew || f.origin !== "admin-live" ? "Publish now" : "Update live listing") + "</button>" +
      '<button class="btn btn-ghost" type="button" data-act="draft">Save as draft</button><button class="btn btn-ghost" type="button" data-act="preview">' + icon("eye") + "Preview page</button></div>" +
      '<div class="right"><span class="adm-saving" id="adm-saving"></span>' +
      (!f.isNew && f.origin === "admin-live" ? '<button class="btn btn-ghost btn-sm" type="button" data-act="unpublish">Unpublish</button>' : "") +
      '<a class="btn btn-ghost btn-sm" href="#list">Cancel</a></div></div>' +
      "</form>" +
      '<aside class="adm-side"><div><h3 class="side-h">How it shows in the directory</h3><div class="card-grid" id="adm-card"></div></div>' +
      '<div class="adm-card" style="padding:1rem"><h3 class="side-h">Right now it shows as</h3><div class="adm-shows" id="adm-shows"></div><div id="adm-warns" style="margin-top:.75rem"></div></div></aside></div>';
    shell(f.isNew ? "new" : "", html);
    bindEditor();
    refreshPreview();
  }
  function readForm() {
    var f = S.form, form = $("#adm-form");
    ["title", "slug", "category", "organizer", "link", "summary", "who", "opens", "deadline", "start", "end", "base", "when", "dates", "mode", "region", "location", "cost", "benefits", "level", "verified", "notes"].forEach(function (k) {
      var el = form.querySelector("#f-" + k); if (el) f[k] = el.value;
    });
    f.free = $("#f-free").checked;
    f.steps = Array.prototype.map.call(form.querySelectorAll("[data-step]"), function (i) { return i.value; });
    return f;
  }
  function showErrors(v, focus) {
    each("[data-err]", function (e) { e.hidden = true; e.textContent = ""; });
    each(".field.has-err", function (e) { e.classList.remove("has-err"); });
    var box = $("#adm-errors"), keys = Object.keys(v.err);
    keys.forEach(function (k) {
      var e = $('[data-err="' + k + '"]'); if (e) { e.textContent = v.err[k]; e.hidden = false; }
      var fe = $('[data-f="' + k + '"]'); if (fe) fe.classList.add("has-err");
    });
    if (box) {
      box.hidden = !keys.length;
      box.innerHTML = keys.length ? "Please fix " + keys.length + (keys.length === 1 ? " thing" : " things") + " before saving:<ul>" + keys.map(function (k) { return "<li>" + esc(v.err[k]) + "</li>"; }).join("") + "</ul>" : "";
    }
    if (focus && keys.length) { var el = $("#f-" + keys[0]) || box; if (el) { el.focus(); el.scrollIntoView({ block: "center", behavior: "smooth" }); } }
  }
  function refreshPreview() {
    var f = readForm(), o = previewRec(f);
    if (!o.slug) o.slug = "preview";
    if (!o.title) o.title = "Your opportunity title";
    $("#adm-card").innerHTML = L.cardHTML(o, BASE, "#");
    var ph = phase(o), cd = SW.countdownText ? SW.countdownText(ph) : "";
    $("#adm-shows").innerHTML = pill(o) + "<span>" + esc(cd || L.shortWhen(o) || "No date yet") + "</span>";
    var v = validate(f, false);
    $("#adm-warns").innerHTML = v.warn.map(function (w) { return '<div class="adm-warn">' + esc(w) + "</div>"; }).join("");
    var b = BASES.filter(function (x) { return x[0] === f.base; })[0];
    $("#base-help").textContent = b ? b[2] : "";
    var lk = $("#f-open-link"); lk.href = /^https?:\/\//i.test(f.link) ? f.link : "#";
    var cnt = $('[data-count="summary"]'); if (cnt) cnt.textContent = f.summary.length + " / 1200";
    if (SW.refreshStatuses) SW.refreshStatuses();
  }
  function bindEditor() {
    var form = $("#adm-form"), f = S.form, slugTouched = !f.isNew || !!f.slug;
    form.addEventListener("input", function (e) {
      S.dirty = true;
      if (e.target.id === "f-slug") slugTouched = true;
      if (e.target.id === "f-title" && f.isNew && !slugTouched) $("#f-slug").value = slugify(e.target.value);
      if (e.target.id === "f-slug") e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      refreshPreview();
    });
    form.addEventListener("change", function (e) {
      S.dirty = true;
      if (e.target.id === "f-free" && e.target.checked && !$("#f-cost").value.trim()) $("#f-cost").value = "Free";
      if ((e.target.id === "f-start") && !$("#f-end").value) $("#f-end").value = e.target.value;
      refreshPreview();
    });
    $("#f-dates-auto").addEventListener("click", function () { var t = datesText(readForm()); if (!t) { toast("Add a start date, opening date or deadline first."); return; } $("#f-dates").value = t; S.dirty = true; refreshPreview(); });
    $("#f-today").addEventListener("click", function () { $("#f-verified").value = todayISO(); S.dirty = true; refreshPreview(); });
    $("#f-add-step").addEventListener("click", function () { var g = readForm(); g.steps.push(""); $("#f-steps").innerHTML = stepsHTML(g.steps); var ins = form.querySelectorAll("[data-step]"); ins[ins.length - 1].focus(); });
    $("#f-steps").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var g = readForm(), i;
      if (b.hasAttribute("data-step-del")) { i = +b.getAttribute("data-step-del"); g.steps.splice(i, 1); if (!g.steps.length) g.steps = [""]; }
      else if (b.hasAttribute("data-step-up")) { i = +b.getAttribute("data-step-up"); g.steps.splice(i - 1, 0, g.steps.splice(i, 1)[0]); }
      else if (b.hasAttribute("data-step-down")) { i = +b.getAttribute("data-step-down"); g.steps.splice(i + 1, 0, g.steps.splice(i, 1)[0]); }
      else return;
      S.dirty = true;
      $("#f-steps").innerHTML = stepsHTML(g.steps);
      refreshPreview();
    });
    form.addEventListener("submit", function (e) { e.preventDefault(); save("published"); });
    form.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b || b.type === "submit") return;
      var act = b.getAttribute("data-act");
      if (act === "draft") save("draft");
      if (act === "preview") preview();
      if (act === "unpublish") confirmBox("Unpublish this listing?", "It disappears from the site straight away and stays here as a draft.", "Unpublish", function () { save("draft", true); });
    });
  }
  function save(status, skipValidate) {
    if (S.busy) return;
    var f = readForm();
    f.slug = f.slug.replace(/-+$/, "").replace(/^-+/, "");
    var v = validate(f, status === "published");
    if (!skipValidate || !v.ok) { showErrors(v, true); if (!v.ok) return; }
    var row = toRow(f, status), note = $("#adm-saving");
    S.busy = true;
    note.textContent = status === "published" ? "Publishing..." : "Saving...";
    S.store.save(row).then(function (saved) {
      var replaced = false;
      S.rows = S.rows.map(function (r) { if (r.slug === saved.slug) { replaced = true; return saved; } return r; });
      if (!replaced) S.rows.unshift(saved);
      S.dirty = false;
      var after = f.submissionId && status === "published" ? S.store.updateSub(f.submissionId, { status: "published" }).then(function () {
        S.subs.forEach(function (s) { if (s.id === f.submissionId) s.status = "published"; });
      }).catch(function () { toast("Listing published. Mark the submission as published in the Submissions tab."); }) : Promise.resolve();
      return after.then(function () {
        if (L.refresh) L.refresh().catch(function () { /* the site picks it up on the next visit */ });
        S.busy = false;
        doneView(saved, status);
      });
    }).catch(function (e) {
      S.busy = false; note.textContent = "";
      showErrors({ err: { _save: errText(e) }, warn: [] }, false);
      toast(errText(e));
    });
  }
  function doneView(row, status) {
    var o = L.rec(row), live = status === "published";
    var link = BASE + "listing.html?id=" + encodeURIComponent(o.slug) + "&live=1";
    shell("", '<div class="adm-gate" style="max-width:none"><h2>' + (live ? "Published. It's live on the site now." : "Saved as a draft.") + "</h2>" +
      (live ? '<p>Students can find <strong>' + esc(o.title) + "</strong> in the directory and calendar right away. Its permanent page is built automatically within 30 minutes (see Publishing).</p>"
        : "<p>Drafts aren't visible on the site. Publish it when the details are confirmed.</p>") +
      '<div class="card-grid" style="max-width:24rem;margin-top:1rem">' + L.cardHTML(o, BASE, live ? link : "#") + "</div>" +
      '<div class="gate-actions">' + (live ? '<a class="btn btn-lime" href="' + link + '" target="_blank" rel="noopener">' + icon("eye") + "View it on the site</a>" : "") +
      '<button class="btn btn-ghost" type="button" data-edit="' + esc(o.slug) + '">' + icon("pen") + "Edit again</button>" +
      '<a class="btn btn-ghost" href="#new">' + icon("plus") + "Add another</a><a class=\"btn btn-ghost\" href=\"#list\">All listings</a></div></div>");
    if (SW.refreshStatuses) SW.refreshStatuses();
    window.scrollTo(0, 0);
  }
  function preview() {
    var o = previewRec(readForm());
    if (!o.slug) o.slug = "preview";
    var m = modal('<div class="adm-dialog wide" role="dialog" aria-modal="true" aria-label="Page preview"><div class="adm-preview-bar"><strong>Preview · how members see the page</strong><button class="btn btn-ghost btn-sm" type="button" data-close>Close preview</button></div><div>' + L.detailHTML(o) + "</div></div>");
    if (SW.refreshStatuses) SW.refreshStatuses();
    if (SW.renderTickers) SW.renderTickers();
    m.querySelector("[data-close]").focus();
  }

  /* ---------- modal + confirm ---------- */
  function modal(html) {
    var wrap = document.createElement("div");
    wrap.className = "adm-modal";
    wrap.innerHTML = html;
    document.body.appendChild(wrap);
    function close() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    wrap.addEventListener("click", function (e) { if (e.target === wrap || e.target.closest("[data-close]")) close(); });
    document.addEventListener("keydown", onKey);
    wrap.close = close;
    return wrap;
  }
  function confirmBox(title, text, okLabel, onOk, danger) {
    var m = modal('<div class="adm-dialog" role="alertdialog" aria-modal="true"><h2>' + esc(title) + "</h2><p>" + esc(text) + '</p><div class="gate-actions"><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn ' + (danger ? "btn-navy" : "btn-lime") + '" type="button" data-ok>' + esc(okLabel) + "</button></div></div>");
    m.querySelector("[data-ok]").addEventListener("click", function () { m.close(); onOk(); });
    m.querySelector("[data-ok]").focus();
  }

  /* ---------- list actions ---------- */
  function find(slug) { return entries().filter(function (e) { return e.slug === slug; })[0]; }
  function edit(slug) {
    var e = find(slug); if (!e) { go("list"); return; }
    var f = fromRecord(e.d);
    f.isNew = false;
    f.origin = e.kind === "site" || e.kind === "edited-draft" ? (e.kind === "site" ? "site" : "admin") : (e.kind === "removed" ? "removed" : (e.row && e.row.status === "published" ? "admin-live" : "admin"));
    if (e.row && e.row.submission_id) f.submissionId = e.row.submission_id;
    editorView(f);
  }
  function duplicate(slug) {
    var e = find(slug); if (!e) return;
    var f = fromRecord(e.d);
    f.isNew = true; f.origin = "new"; f.title = e.d.title + " (copy)"; f.slug = slugify(f.title); f.verified = todayISO();
    editorView(f);
  }
  function setStatus(slug, status) {
    var e = find(slug); if (!e) return;
    var base = e.row ? Object.assign({}, e.row) : toRow(fromRecord(e.site), status);
    base.status = status;
    delete base.created_at; delete base.updated_at; delete base.updated_by;
    S.store.save(base).then(function (saved) {
      var replaced = false;
      S.rows = S.rows.map(function (r) { if (r.slug === saved.slug) { replaced = true; return saved; } return r; });
      if (!replaced) S.rows.unshift(saved);
      if (L.refresh) L.refresh().catch(function () { /* ignore */ });
      toast(status === "removed" ? "Removed from the site." : (status === "published" ? "Restored. It's live again." : "Saved."));
      render();
    }).catch(function (err) { toast(errText(err)); });
  }
  function hardDelete(slug) {
    S.store.remove(slug).then(function () {
      S.rows = S.rows.filter(function (r) { return r.slug !== slug; });
      toast("Draft deleted.");
      render();
    }).catch(function (err) { toast(errText(err)); });
  }

  /* ---------- submissions ---------- */
  function catFromLabel(t) {
    t = String(t || "").toLowerCase();
    var hit = CATS.filter(function (c) { return c[0] === t || c[1].toLowerCase() === t || c[2].toLowerCase() === t || t.indexOf(c[2].toLowerCase()) !== -1; })[0];
    if (hit) return hit[0];
    if (/ctf|security/.test(t)) return "ctf"; if (/intern|fellow/.test(t)) return "internships"; if (/scholar/.test(t)) return "scholarships";
    if (/course|cert/.test(t)) return "courses"; if (/volunt/.test(t)) return "volunteering"; if (/event|conference|meetup|workshop/.test(t)) return "events";
    if (/hack|compet|contest/.test(t)) return "hackathons";
    return "programs";
  }
  function fromSubmission(s) {
    var f = blank();
    f.isNew = true; f.origin = "new"; f.submissionId = s.id;
    f.title = s.title || ""; f.slug = slugify(s.title); f.category = catFromLabel(s.category); f.organizer = s.organizer || "";
    f.link = s.official_link || ""; f.opens = s.opens || ""; f.deadline = s.deadline || ""; f.start = s.start_date || ""; f.end = s.end_date || "";
    var fm = String(s.format || "").toLowerCase();
    f.mode = /online/.test(fm) && /person|hybrid|both/.test(fm) ? "Online or in person" : (/person|venue|offline/.test(fm) ? "In person" : "Online");
    f.location = s.location || ""; f.region = /online/.test(String(s.location || "").toLowerCase()) || f.mode === "Online" ? "online" : "nepal";
    f.cost = s.cost || ""; f.free = /^free/i.test(String(s.cost || "")); f.level = s.level || "All levels"; f.who = s.who_can_apply || ""; f.summary = s.description || "";
    f.base = f.deadline || f.start ? "open" : "upcoming"; f.dates = datesText(f); f.verified = "";
    return f;
  }
  function subsView() {
    var list = S.subs.slice().sort(function (a, b) { return (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || String(b.created_at).localeCompare(String(a.created_at)); });
    var badge = { pending: ["b-draft", "To review"], published: ["b-new", "Published"], declined: ["b-removed", "Not listed"] };
    var dd = function (k, v) { return v ? "<div><dt>" + k + "</dt><dd>" + esc(v) + "</dd></div>" : ""; };
    var cards = list.map(function (s) {
      var b = badge[s.status] || badge.pending;
      return '<article class="adm-sub" data-sub="' + esc(s.id) + '"><header><div><h3>' + esc(s.title) + '</h3><p style="color:var(--muted);font-size:.9rem;margin-top:.2rem">' + esc(s.organizer) + " · " + esc(s.category) + " · sent " + esc(when(s.created_at)) + "</p></div>" +
        '<span class="adm-badge ' + b[0] + '">' + b[1] + "</span></header><dl>" +
        '<div><dt>Official link</dt><dd><a href="' + esc(s.official_link) + '" target="_blank" rel="noopener noreferrer">' + esc(s.official_link) + "</a></dd></div>" +
        dd("Opens", s.opens ? fdate(s.opens) : "") + dd("Deadline", s.deadline ? fdate(s.deadline) : "") + dd("Starts", s.start_date ? fdate(s.start_date) : "") + dd("Ends", s.end_date ? fdate(s.end_date) : "") +
        dd("Format", s.format) + dd("Location", s.location) + dd("Cost", s.cost) + dd("Level", s.level) + dd("Who can apply", s.who_can_apply) +
        dd("Sent by", [s.contact_name, s.contact_email].filter(Boolean).join(" · ")) + dd("Their role", s.relationship) + dd("Review note", s.review_note) + "</dl>" +
        (s.description ? '<p class="desc">' + esc(s.description) + "</p>" : "") +
        '<div class="adm-actions">' + (s.status !== "published" ? '<button class="adm-btn primary" type="button" data-sub-create="' + esc(s.id) + '">' + icon("plus") + "Create listing from this</button>" : "") +
        (s.status === "pending" ? '<button class="adm-btn" type="button" data-sub-mark="' + esc(s.id) + '">' + icon("check") + "Mark as published</button>" +
          '<button class="adm-btn danger" type="button" data-sub-decline="' + esc(s.id) + '">' + icon("close") + "Decline</button>" : "") +
        (s.status !== "pending" ? '<button class="adm-btn" type="button" data-sub-reopen="' + esc(s.id) + '">Move back to review</button>' : "") + "</div></article>";
    }).join("");
    shell("subs", (S.subsError ? '<div class="adm-warn" style="margin-bottom:1rem">' + esc(S.subsError) + "</div>" : "") +
      '<div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:flex-start;margin-bottom:1rem"><p style="color:var(--muted);max-width:46rem">Opportunities students send from their profile. Check each one on the official page. "Create listing" fills in the form for you; the student sees the new status in their profile.</p>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-subs-refresh>' + icon("clock") + "Check for new</button></div>" +
      (cards ? '<div class="adm-subs">' + cards + "</div>" : '<div class="adm-list"><div class="adm-empty">No submissions yet.</div></div>'));
  }
  function subById(id) { return S.subs.filter(function (s) { return String(s.id) === String(id); })[0]; }
  function updateSub(id, fields, msg) {
    S.store.updateSub(subById(id).id, fields).then(function () {
      Object.assign(subById(id), fields);
      toast(msg); subsView();
    }).catch(function (e) { toast(errText(e)); });
  }

  /* ---------- publishing ---------- */
  function publishView() {
    var built = Date.parse(S.built) || 0, staticSlugs = {};
    S.statics.forEach(function (o) { staticSlugs[o.slug] = true; });
    var waiting = S.rows.filter(function (r) {
      if (r.status === "draft") return false;
      if (r.status === "removed") return !!staticSlugs[r.slug];
      return !staticSlugs[r.slug] || Date.parse(r.updated_at) > built;
    });
    var repo = lsGet(REPO_KEY) || "sush4nt1030/swabud";
    var runUrl = repo ? "https://github.com/" + repo.replace(/^https?:\/\/github\.com\//, "").replace(/\/+$/, "") + "/actions/workflows/publish-admin-listings.yml" : "";
    var rows = waiting.map(function (r) {
      return "<tr><td><strong>" + esc(r.title) + "</strong><br><small>" + esc(r.slug) + "</small></td><td>" + (r.status === "removed" ? "Removed" : (staticSlugs[r.slug] ? "Edited" : "New")) +
        "</td><td>" + esc(when(r.updated_at)) + "</td></tr>";
    }).join("");
    shell("publish", '<div class="adm-two">' +
      '<section class="adm-card"><h2>How publishing works</h2><ol class="adm-steps-list">' +
      "<li><strong>Straight away:</strong> when you publish, the listing shows in the directory, the saved list and the calendar, and on its own page.</li>" +
      "<li><strong>Within 30 minutes:</strong> the <em>Publish admin listings</em> GitHub Action copies your changes into <code>_source/data/opportunities.json</code>, rebuilds the site (permanent page, calendar, sitemap, RSS, search) and pushes it. Cloudflare publishes it automatically.</li>" +
      "<li><strong>Every night</strong> at 00:05 Nepal time it also rebuilds once, so dates and statuses in the static pages stay fresh.</li></ol>" +
      '<p class="hint" style="margin-top:1rem">Last full site build: <strong>' + esc(stamp(S.built)) + "</strong></p></section>" +
      '<section class="adm-card"><h2>Rebuild now (optional)</h2><p class="hint">Don\'t want to wait up to 30 minutes? Run the job by hand on GitHub.</p>' +
      '<div class="field" style="margin-top:1rem"><label for="a-repo">Your GitHub repository</label><div class="adm-inline"><input class="input" id="a-repo" placeholder="sush4nt1030/swabud" value="' + esc(repo) + '"><button class="adm-btn" type="button" id="a-repo-save">Save</button></div><span class="help">Saved in this browser only.</span></div>' +
      (runUrl ? '<a class="btn btn-lime" style="margin-top:1rem" href="' + esc(runUrl) + '" target="_blank" rel="noopener noreferrer">' + icon("spark") + "Open the publish job</a><p class=\"hint\" style=\"margin-top:.5rem\">On GitHub, click <strong>Run workflow</strong>, then <strong>Run workflow</strong> again.</p>" : "") +
      "</section></div>" +
      '<section class="adm-card" style="margin-top:1rem"><h2>Waiting for the next rebuild</h2>' +
      (waiting.length ? '<p class="hint">These are already live on the site. They get their permanent page at the next rebuild.</p><table class="adm-table"><thead><tr><th>Listing</th><th>Change</th><th>When</th></tr></thead><tbody>' + rows + "</tbody></table>"
        : '<div class="adm-ok" style="margin-top:.75rem">Everything is built into the static pages.</div>') + "</section>" +
      '<section class="adm-card" style="margin-top:1rem"><h2>Backup and bulk import</h2><p class="hint">Download everything you added here, or paste many listings at once (the same format as <code>_source/data/opportunities.json</code>). Imported listings arrive as drafts so you can check them first.</p>' +
      '<div class="gate-actions" style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:1rem"><button class="btn btn-ghost btn-sm" type="button" id="a-export">' + icon("download") + "Download backup (JSON)</button></div>" +
      '<div class="field" style="margin-top:1rem"><label for="a-import">Paste listings (JSON)</label><textarea class="input" id="a-import" rows="5" placeholder="[{&quot;title&quot;: &quot;...&quot;, &quot;slug&quot;: &quot;...&quot;, ...}]"></textarea></div>' +
      '<button class="btn btn-navy btn-sm" type="button" id="a-import-go" style="margin-top:.75rem">Import as drafts</button><p class="adm-saving" id="a-import-msg" style="margin-top:.5rem"></p></section>');
    $("#a-repo-save").addEventListener("click", function () { lsSet(REPO_KEY, $("#a-repo").value.trim()); toast("Saved"); publishView(); });
    $("#a-export").addEventListener("click", function () {
      var blob = new Blob([JSON.stringify(S.rows, null, 1)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "swabud-admin-listings-" + todayISO() + ".json";
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
    $("#a-import-go").addEventListener("click", importJSON);
  }
  function importJSON() {
    var msg = $("#a-import-msg"), list;
    try { list = JSON.parse($("#a-import").value); } catch (e) { msg.textContent = "That isn't valid JSON."; return; }
    if (!Array.isArray(list)) list = [list];
    var ok = 0, bad = [];
    var jobs = list.map(function (o) {
      var f = fromRecord(L.rec(Object.assign({}, o, { status: "draft" })));
      f.isNew = true;
      if (!f.slug) f.slug = slugify(f.title);
      var v = validate(f, false);
      if (!v.ok) { bad.push((f.title || "(no title)") + ": " + v.err[Object.keys(v.err)[0]]); return Promise.resolve(); }
      return S.store.save(toRow(f, "draft")).then(function (saved) { ok++; S.rows.unshift(saved); }).catch(function (e) { bad.push(f.title + ": " + errText(e)); });
    });
    msg.textContent = "Importing...";
    Promise.all(jobs).then(function () {
      msg.innerHTML = esc(ok + " imported as drafts.") + (bad.length ? "<br>Skipped: " + bad.map(esc).join("<br>") : "");
      toast(ok + " imported as drafts");
    });
  }

  /* ---------- routing and clicks ---------- */
  function render() {
    var r = route();
    if (r === "new") { var f = blank(); f.isNew = true; f.origin = "new"; editorView(f); return; }
    if (r.indexOf("edit=") === 0) { edit(decodeURIComponent(r.slice(5))); return; }
    if (r === "subs") { subsView(); return; }
    if (r === "publish") { publishView(); return; }
    listView();
  }
  var lastHash = location.hash;
  window.addEventListener("hashchange", function () {
    if (S.dirty) {
      var to = location.hash;
      history.replaceState(null, "", lastHash || "#list");
      confirmBox("Leave without saving?", "Your changes to this listing will be lost.", "Leave", function () { S.dirty = false; lastHash = to; location.hash = to; }, true);
      return;
    }
    lastHash = location.hash;
    render();
  });
  window.addEventListener("beforeunload", function (e) { if (S.dirty) { e.preventDefault(); e.returnValue = ""; } });
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-edit],[data-dup],[data-remove],[data-restore],[data-delete],[data-more],[data-sub-create],[data-sub-mark],[data-sub-decline],[data-sub-reopen],[data-reload],[data-signout],[data-subs-refresh]");
    if (!b) return;
    if (b.hasAttribute("data-subs-refresh")) {
      b.disabled = true;
      S.store.subs(true).then(function (r) { S.subs = r || []; S.subsError = ""; toast("Submissions updated"); subsView(); })
        .catch(function (err) { b.disabled = false; toast(errText(err)); });
      return;
    }
    if (b.hasAttribute("data-reload")) { location.reload(); return; }
    if (b.hasAttribute("data-signout")) { A.signOut(); return; }
    if (b.hasAttribute("data-edit")) { go("edit=" + encodeURIComponent(b.getAttribute("data-edit"))); return; }
    if (b.hasAttribute("data-dup")) { duplicate(b.getAttribute("data-dup")); return; }
    if (b.hasAttribute("data-more")) { S.limit += 50; listView(); return; }
    var slug = b.getAttribute("data-remove") || b.getAttribute("data-restore") || b.getAttribute("data-delete");
    if (b.hasAttribute("data-remove")) {
      var e1 = find(slug);
      confirmBox("Remove \"" + e1.d.title + "\" from the site?", "It disappears straight away, and its page shows \"no longer on SWABUD\". You can restore it later.", "Remove", function () { setStatus(slug, "removed"); }, true);
      return;
    }
    if (b.hasAttribute("data-restore")) { setStatus(slug, "published"); return; }
    if (b.hasAttribute("data-delete")) { confirmBox("Delete this draft?", "This can't be undone.", "Delete", function () { hardDelete(slug); }, true); return; }
    var sid = b.getAttribute("data-sub-create") || b.getAttribute("data-sub-mark") || b.getAttribute("data-sub-decline") || b.getAttribute("data-sub-reopen");
    if (b.hasAttribute("data-sub-create")) { editorView(fromSubmission(subById(sid))); window.scrollTo(0, 0); return; }
    if (b.hasAttribute("data-sub-mark")) { updateSub(sid, { status: "published" }, "Marked as published"); return; }
    if (b.hasAttribute("data-sub-reopen")) { updateSub(sid, { status: "pending" }, "Moved back to review"); return; }
    if (b.hasAttribute("data-sub-decline")) {
      var m = modal('<div class="adm-dialog" role="dialog" aria-modal="true"><h2>Decline this submission?</h2><p>The student sees "Not listed" in their profile. Add a short reason (optional).</p>' +
        '<textarea class="input" id="decline-note" rows="3" maxlength="300" placeholder="For example: we couldn\'t confirm it on an official page."></textarea>' +
        '<div class="gate-actions"><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-navy" type="button" data-ok>Decline</button></div></div>');
      m.querySelector("[data-ok]").addEventListener("click", function () { var n = m.querySelector("#decline-note").value.trim(); m.close(); updateSub(sid, { status: "declined", review_note: n || null }, "Declined"); });
    }
  });

  /* ---------- start ---------- */
  function loadStatics() {
    return fetch(BASE + "assets/data/listings.json?v=" + VER, { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : { listings: [] }; })
      .then(function (j) { S.statics = j.listings || []; S.built = j.built || ""; if (j.levels) S.levels = j.levels.concat(LEVELS.filter(function (l) { return j.levels.indexOf(l) === -1; })); })
      .catch(function () { S.statics = []; });
  }
  function startApp() {
    app.innerHTML = '<p class="admin-loading">Loading listings...</p>';
    return Promise.all([
      S.store.list().then(function (r) { S.rows = r || []; }),
      loadStatics(),
      S.store.subs().then(function (r) { S.subs = r || []; }).catch(function (e) { S.subs = []; S.subsError = "Submissions couldn't load: " + errText(e); })
    ]).then(render);
  }
  A.ready.then(function () {
    if (A.mode === "off") { gateOff(); return; }
    if (!A.user) { gateLogin(); return; }
    return openStore().then(function (st) { S.store = st; return st.isAdmin(); }).then(function (ok) {
      if (!ok) { gateNotAdmin(); return; }
      return startApp();
    });
  }).catch(function (e) {
    if (isSetupError(e)) gateSetup(); else gateError(e);
  });
})();
