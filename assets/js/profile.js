/* SWABUD profile page: overview with what's next, recommendations, saved + application tracker,
   submissions and settings. Data comes from auth.js (Supabase or preview backend). */
(function () {
  "use strict";
  var SW = window.SWABUD || {};
  var A = SW.auth;
  if (!A) return;
  var DATA = window.SWABUD_DATA || [];
  var LEARN = window.SWABUD_LEARN || [];
  var CHECKS = ["Read the full rules and eligibility", "Update my CV or portfolio", "Draft my answers or statement", "Collect documents and references", "Submit before the deadline", "Save the confirmation"];
  var BY = {};
  DATA.forEach(function (o) { BY[o.s] = o; });
  var STAGES = [["saved", "Saved"], ["preparing", "Preparing"], ["applied", "Applied"], ["accepted", "Accepted"], ["rejected", "Not selected"]];
  var STAGE_LABEL = {}; STAGES.forEach(function (s) { STAGE_LABEL[s[0]] = s[1]; });
  var CAT_LABEL = { hackathons: "Hackathons", ctf: "CTFs", internships: "Fellowships", scholarships: "Scholarships", events: "Events", courses: "Courses", volunteering: "Volunteering", programs: "Programs" };
  var REGION_LABEL = { nepal: "In Nepal", online: "Online", abroad: "Abroad" };
  var SUB_STATUS = { pending: ["In review", "upcoming"], published: ["Published", "open"], declined: ["Not listed", "closed"] };

  var USER = null, B = null, PROFILE = {}, SAVED = {}, SUBS = [], FILTER = "";

  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function each(sel, fn, scope) { Array.prototype.forEach.call((scope || document).querySelectorAll(sel), fn); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function icon(n) { return '<svg class="icon" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  function attrs(o) { return 'data-opp data-base="' + esc(o.b) + '" data-opens="' + esc(o.op) + '" data-deadline="' + esc(o.dl) + '" data-start="' + esc(o.st) + '" data-end="' + esc(o.en) + '"'; }
  function dat(o) { return { base: o.b, opens: o.op, deadline: o.dl, start: o.st, end: o.en }; }
  function pill(ph) { return '<span class="pill" data-status="' + ph.s + '">' + esc(SW.LABELS[ph.s] || ph.s) + "</span>"; }
  function link(o) { return "opportunities/" + encodeURIComponent(o.s) + ".html"; }
  function toast(m) { if (SW.toast) SW.toast(m); }

  /* ---------- tabs ---------- */
  var TABS = ["overview", "saved", "submit", "settings"];
  function showTab(name, focus) {
    if (TABS.indexOf(name) === -1) name = "overview";
    each("[data-tab]", function (t) {
      var on = t.getAttribute("data-tab") === name;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    each("[data-panel]", function (p) { p.hidden = p.getAttribute("data-panel") !== name; });
    try { history.replaceState(null, "", "#" + name); } catch (e) { /* ignore */ }
  }
  each("[data-tab]", function (t) {
    t.addEventListener("click", function () { showTab(t.getAttribute("data-tab")); });
    t.addEventListener("keydown", function (e) {
      var i = TABS.indexOf(t.getAttribute("data-tab"));
      if (e.key === "ArrowRight") { e.preventDefault(); showTab(TABS[(i + 1) % TABS.length], true); }
      if (e.key === "ArrowLeft") { e.preventDefault(); showTab(TABS[(i + TABS.length - 1) % TABS.length], true); }
    });
  });
  document.addEventListener("click", function (e) {
    var l = e.target.closest("[data-tab-link]");
    if (!l) return;
    e.preventDefault();
    showTab(l.getAttribute("data-tab-link"));
    window.scrollTo({ top: $(".tabs-bar").offsetTop - 70, behavior: "smooth" });
  });
  function hashTab() {
    var h = (location.hash || "").replace("#", "");
    return TABS.indexOf(h) !== -1 ? h : "";
  }

  /* ---------- rendering ---------- */
  function savedList() {
    return Object.keys(SAVED).filter(function (s) { return BY[s]; }).map(function (s) { return { o: BY[s], row: SAVED[s] }; });
  }
  function byNext(a, b) {
    var now = Date.now(), pa = SW.phase(dat(a.o || a), now), pb = SW.phase(dat(b.o || b), now);
    return (SW.RANK[pa.s] - SW.RANK[pb.s]) || ((pa.t || 9e15) - (pb.t || 9e15));
  }
  function nextRow(o, extra) {
    var ph = SW.phase(dat(o));
    var dp = SW.dayParts(ph.t);
    return '<li class="next-row" ' + attrs(o) + ">" +
      '<span class="board-date"><b>' + dp.day + "</b><small>" + dp.mon + "</small></span>" +
      '<span class="next-body"><a href="' + link(o) + '">' + esc(o.t) + "</a>" +
      '<span class="next-meta">' + pill(ph) + '<span class="fine" data-fine-verb="' + ph.v + '" data-fine="' + ph.t + '"></span>' + (extra || "") + "</span></span></li>";
  }
  function renderHead() {
    var first = String(USER.name || USER.email).split(/[\s@]/)[0];
    $("[data-profile-greet]").textContent = "Namaste, " + first + "!";
    var since = USER.createdAt ? new Date(USER.createdAt) : null;
    var via = USER.provider === "google" ? "Google account" : "Email account";
    $("[data-profile-sub]").textContent = USER.email + " · " + via + (since ? " · Member since " + since.toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "");
    A.paint(USER);
  }
  function renderStats() {
    var list = savedList(), now = Date.now();
    var active = list.filter(function (x) { return x.row.status === "preparing" || x.row.status === "applied"; }).length;
    var closing = list.filter(function (x) { return SW.phase(dat(x.o), now).s === "closing"; }).length;
    $('[data-stat="saved"]').textContent = list.length;
    $('[data-stat="active"]').textContent = active;
    $('[data-stat="closing"]').textContent = closing;
    $('[data-stat="submitted"]').textContent = SUBS.length;
    $("[data-count-saved]").textContent = list.length;
  }
  function renderNext() {
    var now = Date.now();
    var rows = savedList().filter(function (x) { var p = SW.phase(dat(x.o), now); return p.t && x.row.status !== "rejected"; }).sort(byNext);
    var stageTag = function (x) { return x.row.status && x.row.status !== "saved" ? '<span class="tag">' + esc(STAGE_LABEL[x.row.status]) + "</span>" : ""; };
    $("[data-next-list]").innerHTML = rows.slice(0, 8).map(function (x) { return nextRow(x.o, stageTag(x)); }).join("");
    $("[data-next-empty]").hidden = rows.length !== 0;
    var board = DATA.filter(function (o) { var p = SW.phase(dat(o), now); return p.t && p.s !== "closed"; })
      .sort(function (a, b) { return SW.phase(dat(a), now).t - SW.phase(dat(b), now).t; });
    $("[data-board-list]").innerHTML = board.slice(0, 6).map(function (o) { return nextRow(o); }).join("");
    tickFine();
  }
  function renderReco() {
    var now = Date.now(), ints = PROFILE.interests || [], region = PROFILE.region || "";
    var ok = { open: 3, closing: 4, live: 2, rolling: 1, upcoming: 2 };
    var cand = DATA.filter(function (o) { return !SAVED[o.s] && ok[SW.phase(dat(o), now).s]; }).map(function (o) {
      var ph = SW.phase(dat(o), now), score = ok[ph.s];
      if (ints.indexOf(o.c) !== -1) score += 5;
      if (region && o.r === region) score += 3;
      if (o.f) score += 0.5;
      if (ph.t && ph.t - now < 45 * SW.DAY) score += 1;
      return { o: o, ph: ph, score: score };
    }).sort(function (a, b) { return b.score - a.score || (a.ph.t || 9e15) - (b.ph.t || 9e15); }).slice(0, 6);
    $("[data-reco-list]").innerHTML = cand.map(function (x) {
      var o = x.o, cd = SW.countdownText(x.ph);
      return '<article class="mini-card" ' + attrs(o) + ' data-slug="' + esc(o.s) + '">' +
        '<div class="opp-top"><span class="opp-cat">' + esc(o.cl) + "</span>" + pill(x.ph) + "</div>" +
        '<h3><a href="' + link(o) + '">' + esc(o.t) + "</a></h3>" +
        '<p class="opp-org">' + esc(o.o) + "</p>" +
        '<div class="mini-foot"><span class="countdown" data-countdown' + (cd ? "" : " hidden") + ">" + esc(cd) + "</span>" +
        '<span class="tag">' + esc(REGION_LABEL[o.r]) + "</span>" + (o.f ? '<span class="tag tag-free">Free</span>' : "") +
        '<button class="save-btn" type="button" data-save="' + esc(o.s) + '" aria-pressed="false" aria-label="Save ' + esc(o.t) + '">' + icon("bookmark") + "<span data-save-label>Save</span></button></div></article>";
    }).join("");
    var names = ints.map(function (c) { return CAT_LABEL[c]; }).filter(Boolean);
    $("[data-reco-why]").textContent = names.length
      ? "Based on your interests: " + names.join(", ") + (region ? " · " + REGION_LABEL[region] + " first" : "") + "."
      : "Open now and closing soon. Choose your interests for better picks.";
    $("[data-nudge]").hidden = names.length > 0;
    if (SW.paintSaved) SW.paintSaved();
  }
  function stageOptions(cur) {
    return STAGES.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === cur ? " selected" : "") + ">" + s[1] + "</option>"; }).join("");
  }
  function renderTracker() {
    var list = savedList().sort(byNext);
    var counts = { "": list.length };
    STAGES.forEach(function (s) { counts[s[0]] = 0; });
    list.forEach(function (x) { counts[x.row.status || "saved"]++; });
    each("[data-track-n]", function (n) { var k = n.getAttribute("data-track-n"); n.textContent = counts[k] ? "(" + counts[k] + ")" : ""; });
    each("[data-track-filter]", function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-track-filter") === FILTER ? "true" : "false"); });
    var shown = list.filter(function (x) { return !FILTER || (x.row.status || "saved") === FILTER; });
    var now = Date.now();
    $("[data-track-list]").innerHTML = shown.map(function (x) {
      var o = x.o, ph = SW.phase(dat(o), now), cd = SW.countdownText(ph, now), id = "st-" + o.s, st = x.row.status || "saved";
      var note = x.row.note || "", done = x.row.checklist || [];
      var checks = CHECKS.map(function (c, i) {
        return '<label><input type="checkbox" data-check="' + esc(o.s) + '" value="' + i + '"' + (done.indexOf(i) !== -1 ? " checked" : "") + "><span>" + esc(c) + "</span></label>";
      }).join("");
      return '<li class="track-item" ' + attrs(o) + ' data-stage="' + st + '">' +
        '<div class="track-main"><div class="track-top"><span class="opp-cat">' + esc(o.cl) + "</span>" + pill(ph) +
        '<span class="countdown" data-countdown' + (cd ? "" : " hidden") + ">" + esc(cd) + "</span></div>" +
        '<a class="track-title" href="' + link(o) + '">' + esc(o.t) + "</a>" +
        '<p class="track-meta">' + esc(o.o) + " · " + esc(o.w) + "</p>" +
        (done.length ? '<p><span class="tag tag-check">Checklist ' + done.length + "/" + CHECKS.length + "</span></p>" : "") +
        (note ? '<p class="track-note-preview">' + icon("pen") + "<span>" + esc(note) + "</span></p>" : "") + "</div>" +
        '<div class="track-ctrl"><label class="visually-hidden" for="' + id + '">Stage for ' + esc(o.t) + "</label>" +
        '<select class="input input-sm stage-select" id="' + id + '" data-stage-select="' + esc(o.s) + '">' + stageOptions(st) + "</select>" +
        '<button class="icon-btn icon-btn-sm" type="button" data-note-toggle aria-expanded="false" aria-label="Checklist and notes for ' + esc(o.t) + '">' + icon("pen") + "</button>" +
        '<button class="icon-btn icon-btn-sm" type="button" data-remove="' + esc(o.s) + '" aria-label="Remove ' + esc(o.t) + '">' + icon("close") + "</button></div>" +
        '<div class="track-note" hidden><span class="label">Application checklist</span><div class="checklist-box">' + checks + "</div>" +
        '<label for="n-' + esc(o.s) + '">Private note</label>' +
        '<textarea class="input" id="n-' + esc(o.s) + '" data-note="' + esc(o.s) + '" maxlength="1000" placeholder="e.g. Ask Prof. Sharma for a reference by Friday">' + esc(note) + "</textarea>" +
        '<span class="hint" data-note-status>Saved automatically.</span></div></li>';
    }).join("");
    $("[data-track-empty]").hidden = shown.length !== 0;
    if (!list.length) $("[data-track-empty] h3").textContent = "Nothing saved yet";
    else if (!shown.length) $("[data-track-empty] h3").textContent = "Nothing at this stage";
  }
  function renderSubs() {
    $("[data-sub-list]").innerHTML = SUBS.map(function (s) {
      var st = SUB_STATUS[s.status] || SUB_STATUS.pending;
      var dt = s.created_at ? new Date(s.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
      return '<li class="sub-row"><span class="sub-title">' + esc(s.title) + '</span><span class="sub-meta"><span class="pill" data-status="' + st[1] + '">' + st[0] + "</span>" +
        "<span>" + esc(dt) + "</span>" + (s.official_link ? '<a href="' + esc(s.official_link) + '" target="_blank" rel="noopener noreferrer">Official page</a>' : "") + "</span></li>";
    }).join("");
    $("[data-sub-empty]").hidden = SUBS.length !== 0;
  }
  function fillSettings() {
    var f = document.getElementById("profile-form");
    f.elements.full_name.value = PROFILE.full_name || USER.name || "";
    document.getElementById("pf-email").value = USER.email || "";
    ["college", "programme", "city"].forEach(function (k) { f.elements[k].value = PROFILE[k] || ""; });
    f.elements.region.value = PROFILE.region || "";
    var ints = PROFILE.interests || [];
    each('[name="interests"]', function (c) { c.checked = ints.indexOf(c.value) !== -1; }, f);
    f.elements.alerts.checked = !!PROFILE.alerts;
    $("[data-provider-hint]").textContent = USER.provider === "google" ? "You sign in with Google. Your email comes from your Google account." : "Your sign-in email. Contact us to change it.";
    var google = USER.provider === "google";
    $("[data-pw-title]").textContent = google && !USER.hasPassword ? "Set a password (optional)" : "Change password";
    $("[data-pw-note]").textContent = google && !USER.hasPassword
      ? "You sign in with Google, so you don't need a password. Set one if you also want to log in with your email."
      : "Choose a new password of at least 8 characters with letters and numbers.";
    var created = USER.createdAt ? new Date(USER.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
    $("[data-account-meta]").textContent = "Signed in with " + (google ? "Google" : "email") + " as " + USER.email + (created ? ". Account created " + created + "." : ".");
  }
  function prefillSubmit() {
    var f = document.getElementById("profile-submit");
    if (!f) return;
    if (!f.elements.name.value) f.elements.name.value = PROFILE.full_name || USER.name || "";
    if (!f.elements.email.value) f.elements.email.value = USER.email || "";
  }
  /* new since last visit, learning progress, profile completeness */
  function renderDash() {
    var prev = SW.member && SW.member.prevVisit ? SW.member.prevVisit(USER) : null;
    var newList = $("[data-new-list]"), sub = $("[data-new-sub]");
    if (!prev) {
      sub.textContent = "Welcome! From your next visit, listings added or re-checked since you were last here appear in this box.";
      newList.innerHTML = "";
    } else {
      var since = prev.toISOString().slice(0, 10);
      var fresh = DATA.filter(function (o) { return o.v && o.v > since; }).sort(function (a, b) { return b.v.localeCompare(a.v); });
      sub.textContent = fresh.length ? fresh.length + " new or re-checked since " + prev.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + "."
        : "Nothing new since " + prev.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ". Check back soon.";
      newList.innerHTML = fresh.slice(0, 5).map(function (o) { return '<li><a href="' + link(o) + '">' + esc(o.t) + '</a><span class="mono">' + esc(o.cl) + "</span></li>"; }).join("");
    }
    var prog = PROFILE.learn_progress || {};
    $("[data-learn-list]").innerHTML = LEARN.map(function (t) {
      var n = (prog[t.id] || []).length;
      return '<li><a href="learn.html#' + esc(t.id) + '">' + esc(t.t) + '</a><span class="mono">' + Math.round(100 * n / Math.max(1, t.n)) + "%</span></li>";
    }).join("");
    var fields = [["full_name", "Name"], ["college", "College"], ["programme", "Programme and year"], ["city", "City or district"], ["region", "Where you want opportunities"], ["interests", "Interests"]];
    var missing = fields.filter(function (f) { var v = PROFILE[f[0]]; return !(Array.isArray(v) ? v.length : v); });
    var pct = Math.round(100 * (fields.length - missing.length) / fields.length);
    $("[data-complete-bar]").style.width = pct + "%";
    $("[data-complete-text]").textContent = pct === 100 ? "Your profile is complete. Thank you!" : "Your profile is " + pct + "% complete. Add the rest for better recommendations.";
    $("[data-complete-list]").innerHTML = missing.map(function (f) { return "<li><span>" + esc(f[1]) + '</span><span class="mono">missing</span></li>'; }).join("");
    try { localStorage.setItem("swabud-profile-cache", JSON.stringify({ interests: PROFILE.interests || [], region: PROFILE.region || "" })); } catch (e) { /* ignore */ }
  }
  function renderAll() {
    renderHead(); renderStats(); renderNext(); renderReco(); renderTracker(); renderSubs(); fillSettings(); prefillSubmit(); renderDash();
    if (SW.refreshStatuses) SW.refreshStatuses();
  }

  /* live fine-grained countdowns in the overview lists */
  function tickFine() {
    var now = Date.now();
    each("[data-fine]", function (el) {
      var t = Number(el.getAttribute("data-fine"));
      el.textContent = t > now ? el.getAttribute("data-fine-verb") + " in " + SW.fineText(t - now) : "Now";
    });
  }
  setInterval(tickFine, 1000);

  /* ---------- tracker actions ---------- */
  var noteTimers = {};
  document.addEventListener("change", function (e) {
    var ck = e.target.closest("[data-check]");
    if (ck && B) {
      var cs = ck.getAttribute("data-check"), box = ck.closest(".checklist-box");
      var list = Array.prototype.filter.call(box.querySelectorAll("[data-check]"), function (c) { return c.checked; }).map(function (c) { return Number(c.value); });
      SAVED[cs] = Object.assign({}, SAVED[cs] || {}, { checklist: list });
      B.updateSaved(cs, { checklist: list }).then(function () {
        toast(list.length === CHECKS.length ? "Checklist complete. Good luck!" : "Checklist " + list.length + "/" + CHECKS.length);
      }).catch(function (x) { toast(x.message); });
      return;
    }
    var sel = e.target.closest("[data-stage-select]");
    if (!sel || !B) return;
    var slug = sel.getAttribute("data-stage-select"), st = sel.value;
    SAVED[slug] = Object.assign({}, SAVED[slug] || {}, { status: st });
    B.updateSaved(slug, { status: st }).then(function () { toast("Moved to " + STAGE_LABEL[st]); }).catch(function (x) { toast(x.message); });
    renderStats(); renderNext();
    sel.closest(".track-item").setAttribute("data-stage", st);
  });
  document.addEventListener("input", function (e) {
    var ta = e.target.closest("[data-note]");
    if (!ta || !B) return;
    var slug = ta.getAttribute("data-note"), status = ta.parentNode.querySelector("[data-note-status]");
    status.textContent = "Saving...";
    clearTimeout(noteTimers[slug]);
    noteTimers[slug] = setTimeout(function () {
      var note = ta.value.trim();
      SAVED[slug] = Object.assign({}, SAVED[slug] || {}, { note: note });
      B.updateSaved(slug, { note: note }).then(function () { status.textContent = "Saved."; }).catch(function (x) { status.textContent = x.message; });
    }, 700);
  });
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-note-toggle]");
    if (t) {
      var box = t.closest(".track-item").querySelector(".track-note");
      box.hidden = !box.hidden;
      t.setAttribute("aria-expanded", box.hidden ? "false" : "true");
      if (!box.hidden) box.querySelector("textarea").focus();
      else renderTracker();
      return;
    }
    var r = e.target.closest("[data-remove]");
    if (r && B) {
      var slug = r.getAttribute("data-remove");
      delete SAVED[slug];
      SW.setSaved(SW.getSaved().filter(function (s) { return s !== slug; }));
      SW.paintSaved();
      B.deleteSaved(slug).catch(function (x) { toast(x.message); });
      toast("Removed from your tracker");
      renderStats(); renderNext(); renderTracker(); renderReco();
      return;
    }
    var f = e.target.closest("[data-track-filter]");
    if (f) { FILTER = f.getAttribute("data-track-filter"); renderTracker(); SW.refreshStatuses(); }
  });
  /* bookmarks toggled elsewhere on the page (recommendations) */
  document.addEventListener("swabud:saved-change", function (e) {
    var d = e.detail || {};
    if (d.saved) SAVED[d.slug] = SAVED[d.slug] || { status: "saved", note: "" };
    else delete SAVED[d.slug];
    renderStats(); renderNext(); renderTracker();
    SW.refreshStatuses();
  });

  /* ---------- calendar export of saved dates ---------- */
  function icsDate(t) { var x = new Date(t + 345 * 60000); return x.getUTCFullYear() + ("0" + (x.getUTCMonth() + 1)).slice(-2) + ("0" + x.getUTCDate()).slice(-2); }
  function icsEsc(s) { return String(s).replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, " "); }
  document.addEventListener("click", function (e) {
    if (!e.target.closest("[data-ics-export]")) return;
    var now = Date.now(), ev = [], stamp = icsDate(now) + "T000000Z";
    savedList().forEach(function (x) {
      var o = x.o, url = A.base + link(o);
      [["opens", "Applications open: "], ["dl", "Deadline: "], ["st", ""]].forEach(function (k) {
        var v = o[k[0]]; if (!v) return;
        var t = SW.sod(v); if (t + SW.DAY < now) return;
        var end = k[0] === "st" && o.en ? SW.sod(o.en) + SW.DAY : t + SW.DAY;
        ev.push("BEGIN:VEVENT\r\nUID:" + o.s + "-" + k[0] + "@swabud.tech\r\nDTSTAMP:" + stamp + "\r\nDTSTART;VALUE=DATE:" + icsDate(t) + "\r\nDTEND;VALUE=DATE:" + icsDate(end) +
          "\r\nSUMMARY:" + icsEsc(k[1] + o.t) + "\r\nDESCRIPTION:" + icsEsc("Details: " + url) + "\r\nURL:" + url + "\r\nEND:VEVENT\r\n");
      });
    });
    if (!ev.length) { toast("None of your saved opportunities have upcoming dates yet."); return; }
    var ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SWABUD//swabud.tech//EN\r\nCALSCALE:GREGORIAN\r\nX-WR-CALNAME:My SWABUD dates\r\n" + ev.join("") + "END:VCALENDAR\r\n";
    try {
      var url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
      var a = document.createElement("a");
      a.href = url; a.download = "swabud-my-dates.ics";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast(ev.length + (ev.length === 1 ? " date" : " dates") + " ready to import into your calendar");
    } catch (x) { toast("Your browser blocked the download."); }
  });

  /* ---------- submissions ---------- */
  var subForm = document.getElementById("profile-submit");
  if (subForm) {
    subForm.addEventListener("swabud:form-submit", function (e) {
      if (!B) return;
      var d = e.detail.data, nul = function (v) { return v || null; };
      var row = { title: d.title, category: d.category, organizer: d.organizer, official_link: d.official_link, opens: nul(d.opens), deadline: nul(d.deadline),
        start_date: nul(d.start_date), end_date: nul(d.end_date), format: d.format, location: nul(d.location), cost: nul(d.cost), level: nul(d.level),
        who_can_apply: d.who_can_apply, description: d.description, relationship: nul(d.relationship), contact_name: d.name, contact_email: d.email };
      B.addSubmission(row).then(function () { return B.listSubmissions(); }).then(function (s) { SUBS = s; renderSubs(); renderStats(); })
        .catch(function (x) { toast("Sent by email, but we couldn't save it to your profile: " + x.message); });
    });
    subForm.addEventListener("swabud:form-sent", prefillSubmit);
  }

  /* ---------- settings ---------- */
  function formErr(form, msg) { var b = form.querySelector("[data-auth-error]"); b.hidden = !msg; b.textContent = msg || ""; }
  var pf = document.getElementById("profile-form");
  pf.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!B) return;
    var name = pf.elements.full_name.value.trim();
    if (!name) { formErr(pf, "Please enter your name."); return; }
    formErr(pf, "");
    var fields = {
      full_name: name, college: pf.elements.college.value.trim(), programme: pf.elements.programme.value.trim(), city: pf.elements.city.value.trim(),
      region: pf.elements.region.value, alerts: pf.elements.alerts.checked,
      interests: Array.prototype.filter.call(pf.querySelectorAll('[name="interests"]'), function (c) { return c.checked; }).map(function (c) { return c.value; })
    };
    var btn = pf.querySelector("[type=submit]"); btn.disabled = true;
    B.updateProfile(fields).then(function () {
      btn.disabled = false;
      PROFILE = Object.assign({}, PROFILE, fields);
      renderDash();
      USER.name = name;
      renderHead(); renderReco();
      toast("Profile saved");
    }).catch(function (x) { btn.disabled = false; formErr(pf, x.message); });
  });
  var pw = document.getElementById("password-form");
  pw.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!B) return;
    var p1 = pw.elements["pw-new"].value, p2 = pw.elements["pw-new2"].value;
    if (p1.length < 8) { formErr(pw, "Use at least 8 characters for your password."); return; }
    if (!/[A-Za-z]/.test(p1) || !/\d/.test(p1)) { formErr(pw, "Use both letters and numbers in your password."); return; }
    if (p1 !== p2) { formErr(pw, "The two passwords don't match."); return; }
    formErr(pw, "");
    var btn = pw.querySelector("[type=submit]"); btn.disabled = true;
    B.updatePassword(p1).then(function (u) {
      btn.disabled = false; pw.reset();
      if (u) { USER.hasPassword = true; fillSettings(); }
      toast("Password updated");
    }).catch(function (x) { btn.disabled = false; formErr(pw, x.message); });
  });
  var del = $("[data-delete-account]"), delMsg = $("[data-delete-msg]");
  del.addEventListener("click", function () {
    if (!del.classList.contains("confirm")) {
      del.classList.add("confirm");
      del.textContent = "Click again to send the deletion request";
      setTimeout(function () { del.classList.remove("confirm"); del.textContent = "Request account deletion"; }, 6000);
      return;
    }
    del.disabled = true;
    SW.sendToInbox({ name: USER.name, email: USER.email, account_id: USER.id, request: "Please delete my SWABUD account and its data." }, "SWABUD: Account deletion request - " + USER.email)
      .then(function (r) {
        delMsg.hidden = false;
        if (r.ok) { delMsg.textContent = "Request sent. We'll delete your account and data within 30 days and confirm by email."; return; }
        delMsg.innerHTML = "We couldn't send it automatically. Please email <a href=\"mailto:" + SW.CONTACT_EMAIL + "?subject=" +
          encodeURIComponent("Account deletion request") + "&body=" + encodeURIComponent("Please delete my SWABUD account: " + USER.email) + "\">" + SW.CONTACT_EMAIL + "</a> from " + esc(USER.email) + ".";
        del.disabled = false;
      });
  });

  /* ---------- start ---------- */
  var startTab = hashTab();
  var next = SW.ssGet ? SW.ssGet("swabud-next") : null;
  if (next && /^profile\.html(#|$)/.test(next)) { startTab = next.split("#")[1] || startTab; SW.ssTake("swabud-next"); }
  else if (next) { SW.ssTake("swabud-next"); location.replace(A.base + next); return; }

  A.ready.then(function (ctx) {
    $("[data-profile-loading]").hidden = true;
    if (ctx.mode === "off") {
      $("[data-profile-off]").hidden = false; $(".tabs-bar").hidden = true; $(".profile-actions").hidden = true;
      $("[data-profile-sub]").textContent = "Accounts are being set up.";
      return;
    }
    if (!ctx.backend) { $("[data-profile-sub]").textContent = "We couldn't reach your account. Check your connection and reload the page."; return; }
    if (!ctx.user) {
      SW.ssSet("swabud-next", "profile.html#" + (startTab || "overview"));
      location.replace(A.base + "login.html");
      return;
    }
    USER = ctx.user; B = ctx.backend;
    Promise.all([B.getProfile().catch(function () { return {}; }), B.listSaved().catch(function () { return []; }), B.listSubmissions().catch(function () { return []; })])
      .then(function (r) {
        PROFILE = r[0] || {};
        SAVED = {};
        r[1].forEach(function (row) { SAVED[row.slug] = { status: row.status || "saved", note: row.note || "", checklist: Array.isArray(row.checklist) ? row.checklist : [] }; });
        SUBS = r[2] || [];
        renderAll();
        showTab(startTab || "overview");
      });
  });
})();
