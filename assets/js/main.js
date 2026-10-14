/* SWABUD site script: theme switch, live statuses and countdowns, directory filters, saved listings, copy buttons, forms. */
(function () {
  "use strict";

  /* Every form on the site is delivered to this inbox through FormSubmit.
     The first submission sends an activation email to info@swabud.tech: click "Activate Form" once.
     After activation FormSubmit can give you a random alias; paste it in place of the address here. */
  var CONTACT_EMAIL = "info@swabud.tech";
  var FORM_ENDPOINT = "https://formsubmit.co/ajax/" + CONTACT_EMAIL;

  var DAY = 86400000;
  /* All dates are Nepal time (UTC+5:45). A deadline closes at 11:59:59 PM on its day. */
  var NPT_OFFSET = 345 * 60000;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var LABELS = { open: "Open", closing: "Closing soon", live: "Happening now", upcoming: "Upcoming", rolling: "Always open", recurring: "Opens yearly", closed: "Closed" };
  var RANK = { closing: 0, live: 1, open: 2, rolling: 3, upcoming: 4, recurring: 5, closed: 6 };
  var root = document.documentElement;
  var SW = window.SWABUD = window.SWABUD || {};

  function each(sel, fn, scope) { Array.prototype.forEach.call((scope || document).querySelectorAll(sel), fn); }

  /* ---------- storage ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssTake(k) { try { var v = sessionStorage.getItem(k); sessionStorage.removeItem(k); return v; } catch (e) { return null; } }

  /* ---------- theme switch ---------- */
  function currentTheme() {
    var t = root.getAttribute("data-theme");
    if (t === "light" || t === "dark") return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function labelTheme() {
    var next = currentTheme() === "dark" ? "light" : "dark";
    each(".theme-toggle", function (b) { b.setAttribute("aria-label", "Switch to " + next + " mode"); b.title = "Switch to " + next + " mode"; });
  }
  each(".theme-toggle", function (b) {
    b.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      lsSet("swabud-theme", next);
      labelTheme();
    });
  });
  labelTheme();

  /* ---------- status engine (mirrors phase() in _source/build.py) ---------- */
  function sod(s) {
    if (!s) return null;
    var p = String(s).split("-").map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]) - NPT_OFFSET;
  }
  function eod(s) { var t = sod(s); return t === null ? null : t + DAY - 1000; }
  function phase(d, now) {
    now = now || Date.now();
    var base = d.base || "open";
    if (base === "closed") return { s: "closed", t: null, v: "", done: "" };
    var op = sod(d.opens);
    if (op !== null && now < op) return { s: "upcoming", t: op, v: "Opens", done: "" };
    if (op !== null && base === "upcoming") base = "open";
    var dl = eod(d.deadline), st = sod(d.start), en = eod(d.end || d.start);
    if (dl !== null) {
      if (now > dl) {
        if (st !== null && st <= now && now <= en) return { s: "live", t: en, v: "Ends", done: "" };
        return { s: "closed", t: null, v: "", done: en !== null && now > en ? "Ended" : "Applications closed" };
      }
      if (dl - now <= 7 * DAY) return { s: "closing", t: dl, v: "Closes", done: "" };
      return { s: base === "upcoming" ? "upcoming" : "open", t: dl, v: "Closes", done: "" };
    }
    if (st !== null) {
      if (now < st) return { s: base, t: st, v: "Starts", done: "" };
      if (now <= en) return { s: "live", t: en, v: "Ends", done: "" };
      return { s: "closed", t: null, v: "", done: "Ended" };
    }
    return { s: base, t: null, v: "", done: "" };
  }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function spanText(ms) {
    var days = Math.floor(ms / DAY);
    if (days >= 1) return plural(days, "day");
    if (ms >= 3600000) return plural(Math.floor(ms / 3600000), "hour");
    return Math.max(1, Math.floor(ms / 60000)) + " min";
  }
  function countdownText(ph, now) {
    if (!ph.t) return ph.done || "";
    return ph.v + " in " + spanText(ph.t - (now || Date.now()));
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fineText(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    return (d ? d + "d " : "") + pad(h) + "h " + pad(m) + "m " + pad(s % 60) + "s";
  }
  /* Format a timestamp as a Nepal-time date, e.g. 31 Oct 2026 */
  function fmtNPT(t, withYear) {
    var x = new Date(t + NPT_OFFSET);
    return x.getUTCDate() + " " + MONTHS[x.getUTCMonth()] + (withYear === false ? "" : " " + x.getUTCFullYear());
  }
  function dayParts(t) { var x = new Date(t + NPT_OFFSET); return { day: x.getUTCDate(), mon: MONTHS[x.getUTCMonth()] }; }
  function dataOf(el) { return { base: el.dataset.base, opens: el.dataset.opens, deadline: el.dataset.deadline, start: el.dataset.start, end: el.dataset.end }; }

  function refreshStatuses(scope) {
    var now = Date.now(), changed = false;
    each("[data-opp]", function (el) {
      var ph = phase(dataOf(el), now), c = countdownText(ph, now);
      if (el.getAttribute("data-live-status") !== ph.s) changed = true;
      el.setAttribute("data-live-status", ph.s);
      el.setAttribute("data-live-target", ph.t || "");
      each(".pill[data-status]", function (p) {
        if (p.closest("[data-opp]") !== el) return;
        p.setAttribute("data-status", ph.s);
        p.textContent = LABELS[ph.s] || ph.s;
      }, el);
      each("[data-countdown]", function (x) {
        if (x.closest("[data-opp]") !== el) return;
        x.textContent = c;
        x.hidden = !c;
      }, el);
    }, scope);
    return changed;
  }

  /* Big ticking countdown on listing pages */
  var TICK_LABEL = { Closes: "Applications close in", Opens: "Applications open in", Starts: "Starts in", Ends: "Happening now · ends in" };
  function tickWhen(v, t) {
    var dt = fmtNPT(t);
    return { Closes: "Deadline " + dt + ", 11:59 PM Nepal time", Opens: "Opens " + dt, Starts: "Starts " + dt, Ends: "Ends " + dt }[v];
  }
  function renderTickers() {
    var now = Date.now();
    each("[data-ticker]", function (box) {
      var host = box.closest("[data-opp]");
      if (!host) return;
      var ph = phase(dataOf(host), now);
      var units = box.querySelector("[data-ticker-units]"), done = box.querySelector("[data-ticker-done]");
      var label = box.querySelector("[data-ticker-label]"), when = box.querySelector("[data-ticker-when]");
      if (ph.t) {
        var s = Math.max(0, Math.floor((ph.t - now) / 1000));
        var vals = { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 };
        each("[data-u]", function (b) { b.textContent = pad(vals[b.getAttribute("data-u")]); }, units);
        units.hidden = false; done.hidden = true;
        label.textContent = TICK_LABEL[ph.v];
        when.textContent = tickWhen(ph.v, ph.t); when.hidden = false;
        var st = box.querySelector(".ticker-static"); if (st) st.hidden = true;
      } else if (ph.done) {
        units.hidden = true; done.hidden = false; done.textContent = ph.done;
        label.textContent = "Status";
        var d = dataOf(host);
        if (d.deadline && ph.done !== "Ended") when.textContent = "Deadline was " + fmtNPT(sod(d.deadline));
        else if (d.end || d.start) when.textContent = "Ended " + fmtNPT(sod(d.end || d.start));
        when.hidden = false;
      }
    });
  }
  refreshStatuses();
  renderTickers();
  if (document.querySelector("[data-ticker]")) setInterval(renderTickers, 1000);
  setInterval(function () { if (refreshStatuses() && SW.onStatusChange) SW.onStatusChange(); }, 30000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { refreshStatuses(); renderTickers(); } });

  /* ---------- toast + copy ---------- */
  var toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  }
  function selectText(node) {
    try {
      var r = document.createRange();
      r.selectNodeContents(node);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    } catch (e) { /* ignore */ }
  }
  function copyText(text, fallbackNode, done) {
    function fallback() {
      if (fallbackNode) selectText(fallbackNode);
      toast("Selected. Press Ctrl+C or Cmd+C to copy.");
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast(done || "Copied"); }, fallback);
      } else { fallback(); }
    } catch (e) { fallback(); }
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-copy]");
    if (b) {
      e.preventDefault();
      var target = b.getAttribute("data-copy-target");
      var node = target ? document.querySelector(target) : null;
      copyText(b.getAttribute("data-copy") || (node ? node.textContent : ""), node, b.getAttribute("data-copy-done"));
      return;
    }
    var r = e.target.closest("[data-copy-from-result]");
    if (r) {
      var pre = r.closest(".form-result").querySelector("[data-fallback-body]");
      copyText(pre.textContent, pre, "Message copied");
    }
  });

  /* ---------- nav ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var menu = document.getElementById("nav-menu");
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("is-open")) {
        menu.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* ---------- saved opportunities ---------- */
  function getSaved() {
    try { var v = JSON.parse(lsGet("swabud-saved") || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function setSaved(list) { lsSet("swabud-saved", JSON.stringify(list)); }
  function paintSaved() {
    var saved = getSaved();
    each("[data-save]", function (b) {
      var on = saved.indexOf(b.getAttribute("data-save")) !== -1;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      var l = b.querySelector("[data-save-label]");
      if (l) l.textContent = on ? "Saved" : "Save";
    });
    each("[data-saved-count]", function (c) { c.textContent = saved.length; c.hidden = saved.length === 0; });
    var list = document.querySelector("[data-saved-list]");
    if (list) {
      var shown = 0;
      each(".opp-card", function (card) {
        var on = saved.indexOf(card.getAttribute("data-slug")) !== -1;
        card.hidden = !on;
        if (on) shown++;
      }, list);
      document.getElementById("saved-count").textContent = shown + " saved";
      document.getElementById("saved-empty").hidden = shown !== 0;
      document.getElementById("saved-clear").hidden = shown === 0;
    }
  }
  function savedChange(slug, on) {
    try { document.dispatchEvent(new CustomEvent("swabud:saved-change", { detail: { slug: slug, saved: on } })); } catch (e) { /* ignore */ }
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-save]");
    if (!b) return;
    e.preventDefault();
    /* saving is a member feature */
    if (!(SW.auth && SW.auth.user)) {
      ssSet("swabud-next", location.pathname.replace(/^.*?([a-z0-9\-]+\/)?([a-z0-9\-]+\.html)$/i, "$1$2") || "profile.html");
      ssSet("swabud-flash", "Log in or create a free account to save opportunities.");
      location.href = (SW.auth && SW.auth.base || "") + "login.html";
      return;
    }
    var slug = b.getAttribute("data-save"), saved = getSaved(), i = saved.indexOf(slug);
    if (i === -1) { saved.push(slug); toast("Saved to your tracker"); }
    else { saved.splice(i, 1); toast("Removed from saved"); }
    setSaved(saved);
    paintSaved();
    savedChange(slug, i === -1);
  });
  var clearBtn = document.getElementById("saved-clear");
  if (clearBtn) clearBtn.addEventListener("click", function () {
    var old = getSaved();
    setSaved([]); paintSaved(); toast("Saved list cleared");
    old.forEach(function (s) { savedChange(s, false); });
  });
  paintSaved();

  /* ---------- home search ---------- */
  var heroSearch = document.getElementById("hero-search");
  if (heroSearch) {
    heroSearch.addEventListener("submit", function (e) {
      e.preventDefault();
      ssSet("swabud-q", (document.getElementById("hero-q").value || "").trim());
      var cat = document.getElementById("hero-cat").value;
      window.location.href = "opportunities.html" + (cat ? "#" + cat : "");
    });
  }

  /* ---------- directory ---------- */
  var dir = document.getElementById("directory");
  if (dir) {
    var PAGE_SIZE = 24, limit = PAGE_SIZE, VISITOR_LIMIT = 9;
    var lockMore = document.querySelector(".dir-lock [data-lock-more]");
    function isMember() { return root.getAttribute("data-access") === "full"; }
    var cards = Array.prototype.slice.call(dir.querySelectorAll(".opp-card"));
    var qIn = document.getElementById("f-q"), stIn = document.getElementById("f-status"), regIn = document.getElementById("f-region");
    var lvIn = document.getElementById("f-level"), sortIn = document.getElementById("f-sort"), freeIn = document.getElementById("f-free");
    var chips = Array.prototype.slice.call(document.querySelectorAll(".chip[data-cat]"));
    var countEl = document.getElementById("result-count"), emptyEl = document.getElementById("empty"), moreBtn = document.getElementById("show-more");
    var cat = "";
    function setCat(c, push) {
      cat = c || "";
      chips.forEach(function (ch) { ch.setAttribute("aria-pressed", ch.dataset.cat === cat ? "true" : "false"); });
      if (push) { try { history.replaceState(null, "", cat ? "#" + cat : location.pathname); } catch (e) { /* ignore */ } }
      limit = PAGE_SIZE;
      apply();
    }
    function matchStatus(s, f) {
      if (!f || f === "all") return true;
      if (f === "open") return s === "open" || s === "closing" || s === "rolling";
      if (f === "upcoming") return s === "upcoming" || s === "recurring";
      return s === f;
    }
    function apply() {
      var q = (qIn.value || "").trim().toLowerCase(), matches = [], member = isMember();
      cards.forEach(function (card) {
        var d = card.dataset, s = card.getAttribute("data-live-status");
        /* visitors can search and pick a category; the other filters are for members */
        var ok = (!cat || d.cat === cat) && (!q || d.search.indexOf(q) !== -1) && (!member || (matchStatus(s, stIn.value) &&
          (regIn.value === "all" || d.region === regIn.value) &&
          (lvIn.value === "all" || d.level === lvIn.value) &&
          (!freeIn.checked || d.free === "1")));
        card.hidden = true;
        if (ok) matches.push(card);
      });
      var by = member ? sortIn.value : "deadline";
      function target(c) { var t = c.getAttribute("data-live-target"); return t ? Number(t) : 9e15; }
      var sorted = cards.slice().sort(function (a, b) {
        if (by === "az") return a.dataset.title.localeCompare(b.dataset.title);
        if (by === "reco" && SW.recoScore) return SW.recoScore(b) - SW.recoScore(a) || (RANK[a.getAttribute("data-live-status")] || 0) - (RANK[b.getAttribute("data-live-status")] || 0) || target(a) - target(b);
        if (by === "verified") return (b.dataset.verified || "").localeCompare(a.dataset.verified || "") || a.dataset.title.localeCompare(b.dataset.title);
        var ra = RANK[a.getAttribute("data-live-status")] || 0, rb = RANK[b.getAttribute("data-live-status")] || 0;
        return ra - rb || target(a) - target(b) || a.dataset.title.localeCompare(b.dataset.title);
      });
      /* only move cards when the order really changed, so a click in progress isn't interrupted */
      var current = Array.prototype.slice.call(dir.children);
      if (sorted.some(function (c, i) { return current[i] !== c; })) sorted.forEach(function (c) { dir.appendChild(c); });
      var ordered = Array.prototype.filter.call(dir.children, function (c) { return matches.indexOf(c) !== -1; });
      var lim = member ? limit : VISITOR_LIMIT;
      ordered.forEach(function (c, i) { c.hidden = i >= lim; });
      var shown = Math.min(lim, ordered.length);
      countEl.textContent = (ordered.length > shown ? shown + " of " : "") + ordered.length + (ordered.length === 1 ? " opportunity" : " opportunities");
      emptyEl.hidden = ordered.length !== 0;
      var left = ordered.length - shown;
      moreBtn.hidden = left <= 0 || !member;
      if (lockMore) lockMore.textContent = left > 0
        ? "You are seeing " + shown + " of " + ordered.length + (q || cat ? " matching" : "") + " opportunities. " + left + " more are waiting."
        : "You are seeing a preview.";
      moreBtn.querySelector("span").textContent = "Show " + Math.min(PAGE_SIZE, left) + " more (" + left + " left)";
    }
    function reset() { limit = PAGE_SIZE; apply(); }
    moreBtn.addEventListener("click", function () { limit += PAGE_SIZE; apply(); });
    chips.forEach(function (ch) { ch.addEventListener("click", function () { setCat(ch.dataset.cat, true); }); });
    qIn.addEventListener("input", reset);
    [stIn, regIn, lvIn, sortIn, freeIn].forEach(function (el) { el.addEventListener("change", reset); });
    document.getElementById("f-reset").addEventListener("click", function () {
      qIn.value = ""; stIn.value = "all"; regIn.value = "all"; lvIn.value = "all"; sortIn.value = "deadline"; freeIn.checked = false; setCat("", true);
    });
    var stored = ssTake("swabud-q");
    if (stored) qIn.value = stored;
    var h = (location.hash || "").replace("#", "");
    if (h === "closing" || h === "live") { stIn.value = h; h = ""; }
    setCat(chips.some(function (c) { return c.dataset.cat === h; }) ? h : "", false);
    window.addEventListener("hashchange", function () {
      var hh = (location.hash || "").replace("#", "");
      if (chips.some(function (c) { return c.dataset.cat === hh; })) setCat(hh, false);
    });
    SW.onStatusChange = apply;
    SW.applyDirectory = reset;
    document.addEventListener("swabud:auth", reset);
  }

  /* ---------- sending to info@swabud.tech ---------- */
  function sendToInbox(data, subject) {
    var payload = {};
    Object.keys(data).forEach(function (k) { payload[k] = data[k]; });
    payload._subject = subject;
    payload._template = "table";
    payload._captcha = "false";
    if (data.email) payload._replyto = data.email;
    return new Promise(function (resolve) {
      var settled = false;
      function finish(v) { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } }
      var timer = setTimeout(function () { finish({ ok: false, reason: "The form service did not answer in time." }); }, 15000);
      try {
        fetch(FORM_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(payload)
        }).then(function (r) { return r.json().catch(function () { return { success: r.ok }; }); })
          .then(function (j) {
            var ok = j && (j.success === true || j.success === "true");
            finish(ok ? { ok: true } : { ok: false, reason: "We couldn't send this automatically right now." });
          })
          .catch(function () { finish({ ok: false, reason: "We couldn't reach the form service from this page." }); });
      } catch (err) { finish({ ok: false, reason: "We couldn't reach the form service from this page." }); }
    });
  }

  /* ---------- forms (all delivered to info@swabud.tech) ---------- */
  function labelFor(form, el) {
    var l = el.id ? form.querySelector('label[for="' + el.id + '"]') : null;
    var t = l ? l.textContent : el.name;
    return t.replace(/\s*\((required|optional)\)\s*/i, "").replace(/\s+/g, " ").trim();
  }
  function collect(form) {
    var data = {}, lines = [];
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.name === "_honey" || el.type === "submit" || el.type === "button") return;
      if ((el.type === "checkbox" || el.type === "radio") && !el.checked) return;
      var v = (el.value || "").trim();
      if (!v) return;
      if (el.name === "consent") { data.consent = "Yes"; return; }
      if (data[el.name]) data[el.name] += ", " + v; else data[el.name] = v;
    });
    Object.keys(data).forEach(function (k) {
      var el = form.elements[k], lab = el && el.length && !el.tagName ? (k.charAt(0).toUpperCase() + k.slice(1)) : (el ? labelFor(form, el) : k);
      lines.push(lab + ": " + data[k]);
    });
    return { data: data, text: lines.join("\n") };
  }
  function emit(form, name, detail) {
    try { form.dispatchEvent(new CustomEvent(name, { detail: detail, bubbles: true })); } catch (e) { /* ignore */ }
  }
  each("form[data-form]", function (form) {
    var errBox = form.querySelector("[data-form-error]");
    var result = form.querySelector(".form-result");
    var okBox = result.querySelector(".ok"), fb = result.querySelector(".fallback");
    var btn = form.querySelector('button[type="submit"]');
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        errBox.hidden = false;
        errBox.textContent = "Please fill in the fields marked as required. Links must start with https://.";
        var bad = form.querySelector(":invalid");
        if (bad) bad.focus();
        return;
      }
      errBox.hidden = true;
      var honey = form.querySelector('[name="_honey"]');
      var c = collect(form);
      var titleField = form.getAttribute("data-title-field");
      var subject = "SWABUD: " + form.getAttribute("data-subject") + (titleField && c.data[titleField] ? " - " + c.data[titleField] : "");
      function showOk() {
        result.hidden = false; fb.hidden = true; okBox.hidden = false;
        okBox.querySelector("[data-result-title]").textContent = "Sent to " + CONTACT_EMAIL;
        okBox.querySelector("[data-result-text]").textContent = c.data.email
          ? "Thank you. We'll reply to " + c.data.email + " if we need anything else."
          : "Thank you. We read every message.";
        form.reset();
        btn.disabled = false;
        emit(form, "swabud:form-sent", { data: c.data });
      }
      function showFallback(reason) {
        result.hidden = false; okBox.hidden = true; fb.hidden = false;
        fb.querySelector("[data-fallback-text]").textContent = reason + " Please send it by email instead: your message is ready below.";
        fb.querySelector("[data-fallback-body]").textContent = c.text;
        fb.querySelector("[data-fallback-mail]").href = "mailto:" + CONTACT_EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(c.text);
        btn.disabled = false;
      }
      if (honey && honey.value) { showOk(); return; }
      emit(form, "swabud:form-submit", { data: c.data, kind: form.getAttribute("data-form") });
      btn.disabled = true;
      result.hidden = false; okBox.hidden = false; fb.hidden = true;
      okBox.querySelector("[data-result-title]").textContent = "Sending...";
      okBox.querySelector("[data-result-text]").textContent = "";
      sendToInbox(c.data, subject).then(function (r) { if (r.ok) showOk(); else showFallback(r.reason); });
    });
  });

  /* ---------- flash messages carried across a page change ---------- */
  var flash = ssTake("swabud-flash");
  if (flash) setTimeout(function () { toast(flash); }, 300);

  /* ---------- footer year ---------- */
  each("[data-year]", function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- shared helpers for auth.js and profile.js ---------- */
  SW.CONTACT_EMAIL = CONTACT_EMAIL;
  SW.DAY = DAY;
  SW.LABELS = LABELS;
  SW.RANK = RANK;
  SW.phase = phase;
  SW.countdownText = countdownText;
  SW.fineText = fineText;
  SW.fmtNPT = fmtNPT;
  SW.dayParts = dayParts;
  SW.sod = sod;
  SW.toast = toast;
  SW.copyText = copyText;
  SW.getSaved = getSaved;
  SW.setSaved = setSaved;
  SW.paintSaved = paintSaved;
  SW.refreshStatuses = refreshStatuses;
  SW.sendToInbox = sendToInbox;
  SW.lsGet = lsGet; SW.lsSet = lsSet; SW.ssSet = ssSet; SW.ssGet = ssGet; SW.ssTake = ssTake;
})();
