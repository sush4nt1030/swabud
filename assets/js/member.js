/* SWABUD member features that run on every page for logged-in members:
   deadline heads-up banner, "new since your last visit", learning progress on learn.html,
   "My saved dates" on calendar.html and the "Recommended for me" sort in the directory. */
(function () {
  "use strict";
  var SW = window.SWABUD || {};
  var A = SW.auth;
  if (!A) return;
  var DAY = 86400000;

  function each(sel, fn, scope) { Array.prototype.forEach.call((scope || document).querySelectorAll(sel), fn); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function icon(n) { return '<svg class="icon" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function toast(m) { if (SW.toast) SW.toast(m); }

  /* ---------- last visit (per account, on this device) ----------
     A new visit starts after 3 hours away. prevVisit() is the last moment of the previous visit. */
  var visitCache = {};
  function prevVisit(u) {
    if (!u) return null;
    if (visitCache.hasOwnProperty(u.id)) return visitCache[u.id];
    var key = "swabud-visit-" + u.id, now = Date.now(), rec = null;
    try { rec = JSON.parse(lsGet(key) || "null"); } catch (e) { rec = null; }
    var prev = rec ? rec.prev : null;
    if (rec && now - rec.last > 3 * 3600000) prev = rec.last;
    lsSet(key, JSON.stringify({ prev: prev, last: now }));
    visitCache[u.id] = prev ? new Date(prev) : null;
    return visitCache[u.id];
  }
  SW.member = { prevVisit: prevVisit };

  /* ---------- listing data (loaded only when a feature needs it) ---------- */
  var dataP = null;
  function loadData() {
    if (window.SWABUD_DATA) return Promise.resolve(window.SWABUD_DATA);
    if (!dataP) dataP = new Promise(function (resolve) {
      var s = document.createElement("script");
      s.src = A.base + "assets/js/data.js";
      s.onload = function () { resolve(window.SWABUD_DATA || []); };
      s.onerror = function () { resolve([]); };
      document.head.appendChild(s);
    });
    return dataP;
  }
  function dat(o) { return { base: o.b, opens: o.op, deadline: o.dl, start: o.st, end: o.en }; }

  /* ---------- deadline heads-up banner ---------- */
  function headsUp() {
    if (ssGet("swabud-hu-off") || ["login", "signup", "forgot"].indexOf(document.body.getAttribute("data-page") || "") !== -1) return;
    var saved = SW.getSaved ? SW.getSaved() : [];
    if (!saved.length) return;
    loadData().then(function (data) {
      var now = Date.now(), soon = [];
      data.forEach(function (o) {
        if (saved.indexOf(o.s) === -1) return;
        var ph = SW.phase(dat(o), now);
        if (!ph.t) return;
        var left = ph.t - now;
        if ((ph.v === "Closes" && left <= 3 * DAY) || (ph.v === "Opens" && left <= 2 * DAY) || (ph.v === "Starts" && left <= DAY)) {
          soon.push({ o: o, t: ph.t, txt: SW.countdownText(ph, now) });
        }
      });
      if (!soon.length) return;
      soon.sort(function (a, b) { return a.t - b.t; });
      var f = soon[0], header = document.querySelector(".site-header");
      var bar = document.createElement("div");
      bar.className = "heads-up";
      bar.setAttribute("role", "status");
      bar.innerHTML = '<div class="wrap">' + icon("clock") + '<span class="hu-text">Heads up: <a href="' + A.base + "opportunities/" + encodeURIComponent(f.o.s) + '.html">' +
        esc(f.o.t) + "</a> " + esc(f.txt.charAt(0).toLowerCase() + f.txt.slice(1)) + (soon.length > 1 ? ", and " + (soon.length - 1) + " more of your saved dates are close" : "") + ".</span>" +
        '<a href="' + A.base + 'profile.html#saved">Open tracker</a><button type="button" aria-label="Dismiss">' + icon("close") + "</button></div>";
      bar.querySelector("button").addEventListener("click", function () { bar.remove(); ssSet("swabud-hu-off", "1"); });
      if (header && header.parentNode) header.parentNode.insertBefore(bar, header.nextSibling);
    });
  }

  /* ---------- directory: "New" badges and "Recommended for me" ---------- */
  function profileCache() { try { return JSON.parse(lsGet("swabud-profile-cache") || "null"); } catch (e) { return null; } }
  function directory(u, b) {
    var dir = document.getElementById("directory");
    if (!dir) return;
    var prev = prevVisit(u);
    if (prev) {
      var since = prev.toISOString().slice(0, 10);
      each(".opp-card", function (c) {
        var v = c.getAttribute("data-verified");
        if (v && v > since && !c.querySelector(".tag-new")) {
          var tags = c.querySelector(".opp-tags");
          if (tags) tags.insertAdjacentHTML("afterbegin", '<span class="tag tag-new">New</span>');
        }
      }, dir);
    }
    var sort = document.getElementById("f-sort");
    function addReco(p) {
      SW.recoScore = function (card) {
        var d = card.dataset, sc = 0;
        if ((p.interests || []).indexOf(d.cat) !== -1) sc += 5;
        if (p.region && d.region === p.region) sc += 3;
        if (d.free === "1") sc += 0.5;
        if (card.getAttribute("data-live-status") === "closed") sc -= 10;
        return sc;
      };
      if (sort && !sort.querySelector('option[value="reco"]')) {
        sort.insertAdjacentHTML("afterbegin", '<option value="reco">Recommended for me</option>');
        if ((p.interests || []).length) { sort.value = "reco"; if (SW.applyDirectory) SW.applyDirectory(); }
      }
    }
    var p = profileCache();
    if (p) addReco(p);
    else b.getProfile().then(function (pr) {
      var c = { interests: pr.interests || [], region: pr.region || "" };
      lsSet("swabud-profile-cache", JSON.stringify(c));
      addReco(c);
    }).catch(function () { /* recommendations are optional */ });
  }

  /* ---------- learning progress ---------- */
  function learn(u, b) {
    var boxes = document.querySelectorAll("[data-learn-step]");
    if (!boxes.length) return;
    var progress = {};
    function paint() {
      each("[data-learn-bar]", function (bar) {
        var id = bar.getAttribute("data-learn-bar"), total = Number(bar.getAttribute("data-total")) || 1;
        var n = (progress[id] || []).length;
        bar.querySelector("i").style.width = Math.round(100 * n / total) + "%";
        bar.querySelector("[data-learn-text]").textContent = n + " of " + total + " steps done" + (n === total ? " · path complete!" : "");
      });
    }
    b.getProfile().then(function (pr) {
      progress = (pr && pr.learn_progress) || {};
      each("[data-learn-step]", function (c) {
        c.disabled = false;
        c.checked = (progress[c.getAttribute("data-learn-step")] || []).indexOf(Number(c.value)) !== -1;
      });
      paint();
    }).catch(function () { /* keep the boxes disabled */ });
    document.addEventListener("change", function (e) {
      var c = e.target.closest("[data-learn-step]");
      if (!c) return;
      var id = c.getAttribute("data-learn-step");
      progress[id] = Array.prototype.filter.call(document.querySelectorAll('[data-learn-step="' + id + '"]'), function (x) { return x.checked; })
        .map(function (x) { return Number(x.value); });
      paint();
      b.updateProfile({ learn_progress: progress }).then(function () { toast("Progress saved"); }).catch(function (x) { toast(x.message); });
    });
  }

  /* ---------- calendar: all dates or only my saved ones ---------- */
  function cal() {
    var chips = document.querySelectorAll("[data-cal-filter]");
    if (!chips.length) return;
    var empty = document.querySelector("[data-cal-empty]");
    function apply(mode) {
      var saved = SW.getSaved ? SW.getSaved() : [], any = false;
      each("[data-cal-filter]", function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-cal-filter") === mode ? "true" : "false"); });
      each(".cal-month", function (m) {
        if (m.hasAttribute("data-cal-expected")) { m.hidden = mode === "mine"; return; }
        var vis = 0, marks = {};
        each(".cal-item[data-date]", function (it) {
          var show = mode !== "mine" || saved.indexOf(it.getAttribute("data-slug")) !== -1;
          it.hidden = !show;
          if (show) { vis++; (marks[it.getAttribute("data-date")] = marks[it.getAttribute("data-date")] || {})[it.getAttribute("data-kind")] = 1; }
        }, m);
        each(".cal-grid .day[data-date]", function (cell) {
          if (!cell.hasAttribute("data-orig")) cell.setAttribute("data-orig", cell.className);
          if (mode !== "mine") { cell.className = cell.getAttribute("data-orig"); return; }
          var k = marks[cell.getAttribute("data-date")] || {};
          cell.className = cell.getAttribute("data-orig").replace(/ has-(deadline|event|opens)/g, "") +
            (k.deadline ? " has-deadline" : "") + (k.event ? " has-event" : "") + (k.opens ? " has-opens" : "");
        }, m);
        m.hidden = vis === 0;
        if (vis) any = true;
      });
      if (empty) empty.hidden = mode !== "mine" || any;
    }
    each("[data-cal-filter]", function (c) { c.addEventListener("click", function () { apply(c.getAttribute("data-cal-filter")); }); });
  }

  A.ready.then(function (ctx) {
    if (!ctx.user || !ctx.backend) return;
    prevVisit(ctx.user);
    headsUp();
    directory(ctx.user, ctx.backend);
    learn(ctx.user, ctx.backend);
    cal();
  });
})();
