/* SWABUD accounts: Google sign-in, email sign-up with a 6-digit code, log in, password reset by code,
   header account state and syncing saved opportunities to the account.
   Backend: Supabase (configure assets/js/config.js). Without configuration it runs a local preview backend. */
(function () {
  "use strict";
  var SW = window.SWABUD = window.SWABUD || {};
  var CFG = window.SWABUD_CONFIG || {};
  var SB_SRC = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js";
  var SCRIPT = document.currentScript && document.currentScript.src;
  var BASE = SCRIPT ? SCRIPT.replace(/assets\/js\/auth\.js.*$/, "") : "";
  var PAGE = document.body.getAttribute("data-page") || "";
  var SB_KEY = CFG.supabaseKey || CFG.supabaseAnonKey || "";
  var configured = !!(CFG.supabaseUrl && SB_KEY && /^https:\/\//.test(CFG.supabaseUrl));
  var onProd = (CFG.productionHosts || []).indexOf(location.hostname) !== -1;
  var MODE = configured ? "supabase" : (onProd ? "off" : "demo");
  var HASH_RECOVERY = /type=recovery/.test(location.hash);
  var HASH_AUTH = /access_token=|error_description=|type=recovery/.test(location.hash);
  var HASH_ERROR = (location.hash.match(/error_description=([^&]+)/) || [])[1];
  if (HASH_ERROR) {
    try { HASH_ERROR = decodeURIComponent(HASH_ERROR.replace(/\+/g, " ")); } catch (e) { /* keep raw */ }
    try { sessionStorage.setItem("swabud-flash", "Sign-in didn't finish: " + HASH_ERROR); } catch (e) { /* ignore */ }
  }

  function each(sel, fn, scope) { Array.prototype.forEach.call((scope || document).querySelectorAll(sel), fn); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssTake(k) { try { var v = sessionStorage.getItem(k); sessionStorage.removeItem(k); return v; } catch (e) { return null; } }
  function toast(m) { if (SW.toast) SW.toast(m); }
  function fail(message, code) { var e = new Error(message); e.code = code || ""; return e; }

  /* ---------- error messages people can act on ---------- */
  function friendly(err) {
    var m = (err && (err.message || err.error_description || err.msg)) || "";
    if (err && err.code === "email_not_confirmed") return err;
    if (/invalid login credentials/i.test(m)) return fail("Email or password is incorrect.");
    if (/email not confirmed/i.test(m)) return fail("Your email isn't confirmed yet.", "email_not_confirmed");
    if (/already registered|already been registered|user already exists/i.test(m)) return fail("An account with this email already exists. Log in instead, or reset your password.", "exists");
    if (/token has expired|invalid.*(otp|token)|otp.*(expired|invalid)/i.test(m)) return fail("That code is wrong or has expired. Check the latest email, or send a new code.");
    if (/rate limit|too many|security purposes|over_email_send_rate/i.test(m)) return fail("Too many attempts. Please wait a minute and try again.");
    if (/password should be|weak password|at least \d+ characters/i.test(m)) return fail("Choose a stronger password: at least 8 characters with letters and numbers.");
    if (/should be different from the old password/i.test(m)) return fail("Your new password must be different from your current one.");
    if (/provider is not enabled|unsupported provider/i.test(m)) return fail("Google sign-in isn't switched on yet. Please use email for now.");
    if (/failed to fetch|networkerror|load failed/i.test(m)) return fail("We couldn't reach the sign-in service. Check your connection and try again.");
    return fail(m || "Something went wrong. Please try again.", err && err.code);
  }

  /* ---------- preview backend (no server; everything stays in this browser) ---------- */
  function DemoBackend() {
    var KU = "swabud-demo-users", KS = "swabud-demo-session", KC = "swabud-demo-codes";
    function load(k, d) { try { return JSON.parse(lsGet(k)) || d; } catch (e) { return d; } }
    function save(k, v) { lsSet(k, JSON.stringify(v)); }
    function users() { return load(KU, {}); }
    function hash(pw) {
      try {
        if (window.crypto && crypto.subtle && window.TextEncoder) {
          return crypto.subtle.digest("SHA-256", new TextEncoder().encode("swabud-preview:" + pw)).then(function (b) {
            return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
          });
        }
      } catch (e) { /* fall through */ }
      var h = 0; for (var i = 0; i < pw.length; i++) { h = (h * 31 + pw.charCodeAt(i)) | 0; }
      return Promise.resolve("w" + h);
    }
    function uid() { return "preview-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
    function code(email, type) {
      var c = String(Math.floor(100000 + Math.random() * 900000)), all = load(KC, {});
      all[email] = { code: c, type: type, exp: Date.now() + 3600000 };
      save(KC, all);
      return c;
    }
    function checkCode(email, c, type) {
      var all = load(KC, {}), x = all[email];
      if (!x || x.type !== type || x.code !== String(c).trim() || x.exp < Date.now()) return false;
      delete all[email]; save(KC, all); return true;
    }
    function pub(u) {
      return u ? { id: u.id, email: u.email, name: (u.profile && u.profile.full_name) || u.name, avatar: u.avatar || "", provider: u.provider,
        providers: u.provider === "google" ? (u.pw ? ["google", "email"] : ["google"]) : ["email"],
        hasPassword: !!u.pw, createdAt: u.createdAt } : null;
    }
    function current() {
      var s = load(KS, null), all = users();
      if (!s) return null;
      for (var k in all) if (all[k].id === s.id) return all[k];
      return null;
    }
    function put(u) { var all = users(); all[u.email] = u; save(KU, all); }
    function data(u) { return load("swabud-demo-data-" + u.id, { saved: {}, submissions: [] }); }
    function putData(u, d) { save("swabud-demo-data-" + u.id, d); }
    function me() { var u = current(); if (!u) throw fail("Please log in again."); return u; }
    function later(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 350); }); }
    /* every method returns a promise, even when it fails early */
    function safe(api) {
      Object.keys(api).forEach(function (k) {
        var fn = api[k];
        if (typeof fn !== "function") return;
        api[k] = function () { try { return fn.apply(api, arguments); } catch (e) { return Promise.reject(e); } };
      });
      return api;
    }
    return safe({
      mode: "demo",
      getUser: function () { return Promise.resolve(pub(current())); },
      signInGoogle: function () {
        var email = "demo.student@example.com", u = users()[email];
        if (!u) { u = { id: uid(), email: email, name: "Demo Student", provider: "google", confirmed: true, createdAt: new Date().toISOString(), profile: { full_name: "Demo Student", interests: [], alerts: false } }; put(u); }
        save(KS, { id: u.id });
        return later({ redirected: false, user: pub(u) });
      },
      signInPassword: function (email, pw) {
        var u = users()[email];
        return hash(pw).then(function (h) {
          if (!u || !u.pw || u.pw !== h) throw fail("Email or password is incorrect.");
          if (!u.confirmed) { var e = fail("Your email isn't confirmed yet.", "email_not_confirmed"); e.demoCode = code(email, "signup"); throw e; }
          save(KS, { id: u.id });
          return later(pub(u));
        });
      },
      signUp: function (email, pw, meta) {
        var u = users()[email];
        if (u && u.confirmed) return Promise.reject(fail("An account with this email already exists. Log in instead, or reset your password.", "exists"));
        return hash(pw).then(function (h) {
          u = { id: (u && u.id) || uid(), email: email, name: meta.name, provider: "email", pw: h, confirmed: false, createdAt: new Date().toISOString(),
            profile: { full_name: meta.name, interests: meta.interests || [], alerts: false } };
          put(u);
          return later({ needsCode: true, demoCode: code(email, "signup") });
        });
      },
      verifySignup: function (email, c) {
        if (!checkCode(email, c, "signup")) return Promise.reject(fail("That code is wrong or has expired. Check the latest code, or send a new one."));
        var u = users()[email]; u.confirmed = true; put(u); save(KS, { id: u.id });
        return later(pub(u));
      },
      resend: function (type, email) {
        var u = users()[email];
        if (!u) return later({ demoCode: "", none: true });
        return later({ demoCode: code(email, type) });
      },
      sendReset: function (email) {
        var u = users()[email];
        return later(u ? { demoCode: code(email, "recovery") } : { demoCode: "", none: true });
      },
      verifyReset: function (email, c) {
        if (!checkCode(email, c, "recovery")) return Promise.reject(fail("That code is wrong or has expired. Check the latest code, or send a new one."));
        var u = users()[email]; u.confirmed = true; put(u); save(KS, { id: u.id });
        return later(pub(u));
      },
      updatePassword: function (pw) {
        return hash(pw).then(function (h) { var u = me(); if (u.pw === h) throw fail("Your new password must be different from your current one."); u.pw = h; put(u); return later(pub(u)); });
      },
      signOut: function () { lsDel(KS); return later(true); },
      getProfile: function () { var u = me(); return later(Object.assign({ full_name: u.name, interests: [], alerts: false }, u.profile || {})); },
      updateProfile: function (f) { var u = me(); u.profile = Object.assign({}, u.profile || {}, f); if (f.full_name) u.name = f.full_name; put(u); return later(u.profile); },
      listSaved: function () {
        var d = data(me());
        return later(Object.keys(d.saved).map(function (s) { return Object.assign({ slug: s }, d.saved[s]); }));
      },
      addSaved: function (slug) { var u = me(), d = data(u); if (!d.saved[slug]) d.saved[slug] = { status: "saved", note: "", updated_at: new Date().toISOString() }; putData(u, d); return Promise.resolve(true); },
      updateSaved: function (slug, f) { var u = me(), d = data(u); d.saved[slug] = Object.assign({ status: "saved", note: "" }, d.saved[slug] || {}, f, { updated_at: new Date().toISOString() }); putData(u, d); return later(true); },
      deleteSaved: function (slug) { var u = me(), d = data(u); delete d.saved[slug]; putData(u, d); return Promise.resolve(true); },
      listSubmissions: function () { return later(data(me()).submissions.slice().reverse()); },
      addSubmission: function (row) { var u = me(), d = data(u); d.submissions.push(Object.assign({ id: Date.now(), status: "pending", created_at: new Date().toISOString() }, row)); putData(u, d); return later(true); },
      onRecovery: function () { /* links are not used in preview mode */ }
    });
  }

  /* ---------- Supabase backend ---------- */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) { resolve(); return; }
      var s = document.createElement("script");
      s.src = src; s.async = true; s.crossOrigin = "anonymous";
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(fail("We couldn't load sign-in. Check your connection and try again.")); };
      document.head.appendChild(s);
    });
  }
  function SupabaseBackend() {
    var recoveryCbs = [], recovered = false;
    var clientP = loadScript(SB_SRC).then(function () {
      var c = window.supabase.createClient(CFG.supabaseUrl, SB_KEY, {
        auth: { storageKey: "swabud-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" }
      });
      c.auth.onAuthStateChange(function (ev) {
        if (ev === "PASSWORD_RECOVERY") { recovered = true; recoveryCbs.forEach(function (f) { f(); }); }
      });
      return c;
    });
    function mapUser(u) {
      if (!u) return null;
      var m = u.user_metadata || {}, am = u.app_metadata || {};
      var provs = am.providers || (am.provider ? [am.provider] : []);
      return { id: u.id, email: u.email, name: m.full_name || m.name || (u.email || "").split("@")[0], avatar: m.avatar_url || m.picture || "",
        provider: provs.indexOf("google") !== -1 && provs.indexOf("email") === -1 ? "google" : (provs[0] || "email"), providers: provs,
        hasPassword: provs.indexOf("email") !== -1, createdAt: u.created_at };
    }
    function run(fn) {
      return clientP.then(fn).then(function (r) { if (r && r.error) throw r.error; return r; }).catch(function (e) { throw friendly(e); });
    }
    var uidCache = null;
    function uid() {
      if (uidCache) return Promise.resolve(uidCache);
      return clientP.then(function (c) { return c.auth.getSession(); }).then(function (r) {
        var s = r.data && r.data.session; if (!s) throw fail("Please log in again."); uidCache = s.user.id; return uidCache;
      });
    }
    var redirectProfile = BASE + "profile.html";
    return {
      mode: "supabase",
      client: function () { return clientP; },
      getUser: function () {
        return clientP.then(function (c) { return c.auth.getSession(); }).then(function (r) { var s = r.data && r.data.session; return mapUser(s && s.user); });
      },
      signInGoogle: function () {
        return run(function (c) { return c.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectProfile, queryParams: { prompt: "select_account" } } }); })
          .then(function () { return { redirected: true }; });
      },
      signInPassword: function (email, pw) {
        return run(function (c) { return c.auth.signInWithPassword({ email: email, password: pw }); }).then(function (r) { return mapUser(r.data.user); });
      },
      signUp: function (email, pw, meta) {
        return run(function (c) {
          return c.auth.signUp({ email: email, password: pw, options: { data: { full_name: meta.name, interests: meta.interests || [] }, emailRedirectTo: redirectProfile } });
        }).then(function (r) {
          var u = r.data.user;
          if (u && u.identities && u.identities.length === 0) throw fail("An account with this email already exists. Log in instead, or reset your password.", "exists");
          return { needsCode: !r.data.session, user: mapUser(u) };
        });
      },
      verifySignup: function (email, code) {
        return clientP.then(function (c) {
          return c.auth.verifyOtp({ email: email, token: code, type: "email" }).then(function (r) {
            if (!r.error) return r;
            return c.auth.verifyOtp({ email: email, token: code, type: "signup" });
          });
        }).then(function (r) { if (r.error) throw r.error; return mapUser(r.data.user); }).catch(function (e) { throw friendly(e); });
      },
      resend: function (type, email) {
        if (type === "recovery") return this.sendReset(email);
        return run(function (c) { return c.auth.resend({ type: "signup", email: email, options: { emailRedirectTo: redirectProfile } }); }).then(function () { return {}; });
      },
      sendReset: function (email) {
        return run(function (c) { return c.auth.resetPasswordForEmail(email, { redirectTo: BASE + "forgot-password.html" }); }).then(function () { return {}; });
      },
      verifyReset: function (email, code) {
        return run(function (c) { return c.auth.verifyOtp({ email: email, token: code, type: "recovery" }); }).then(function (r) { return mapUser(r.data.user); });
      },
      updatePassword: function (pw) {
        return run(function (c) { return c.auth.updateUser({ password: pw }); }).then(function (r) { return mapUser(r.data.user); });
      },
      signOut: function () { uidCache = null; return run(function (c) { return c.auth.signOut(); }); },
      getProfile: function () {
        return uid().then(function (id) { return run(function (c) { return c.from("profiles").select("*").eq("id", id).maybeSingle(); }); })
          .then(function (r) { return r.data || {}; });
      },
      updateProfile: function (f) {
        return uid().then(function (id) {
          var row = Object.assign({ id: id, updated_at: new Date().toISOString() }, f);
          return run(function (c) { return c.from("profiles").upsert(row); }).then(function () {
            if (f.full_name) return clientP.then(function (c) { return c.auth.updateUser({ data: { full_name: f.full_name } }); });
          });
        }).then(function () { return f; });
      },
      listSaved: function () {
        return run(function (c) { return c.from("saved").select("slug,status,note,checklist,updated_at").order("created_at", { ascending: true }); }).then(function (r) { return r.data || []; });
      },
      addSaved: function (slug) {
        return uid().then(function (id) { return run(function (c) { return c.from("saved").upsert({ user_id: id, slug: slug }, { onConflict: "user_id,slug", ignoreDuplicates: true }); }); });
      },
      updateSaved: function (slug, f) {
        return uid().then(function (id) {
          var row = Object.assign({ user_id: id, slug: slug, updated_at: new Date().toISOString() }, f);
          return run(function (c) { return c.from("saved").upsert(row, { onConflict: "user_id,slug" }); });
        });
      },
      deleteSaved: function (slug) {
        return uid().then(function (id) { return run(function (c) { return c.from("saved").delete().eq("user_id", id).eq("slug", slug); }); });
      },
      listSubmissions: function () {
        return run(function (c) { return c.from("submissions").select("id,title,category,official_link,status,created_at").order("created_at", { ascending: false }); })
          .then(function (r) { return r.data || []; });
      },
      addSubmission: function (row) {
        return uid().then(function (id) { return run(function (c) { return c.from("submissions").insert(Object.assign({ user_id: id }, row)); }); });
      },
      onRecovery: function (cb) { recoveryCbs.push(cb); if (recovered || HASH_RECOVERY) clientP.then(function () { setTimeout(cb, 0); }); }
    };
  }

  /* ---------- choose the backend, but only load it when it's needed ---------- */
  var backendP = null;
  function backend() {
    if (!backendP) backendP = Promise.resolve(MODE === "supabase" ? SupabaseBackend() : (MODE === "demo" ? DemoBackend() : null));
    return backendP;
  }
  var hasSession = MODE === "demo" ? !!lsGet("swabud-demo-session") : (MODE === "supabase" ? !!lsGet("swabud-auth") : false);
  var needsBackend = ["login", "signup", "forgot", "profile", "submit", "saved", "admin"].indexOf(PAGE) !== -1 || hasSession || HASH_AUTH;

  /* ---------- header and account state ---------- */
  function initials(name, email) {
    var parts = String(name || email || "?").trim().split(/\s+/);
    return ((parts[0] || "?").charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : "")).toUpperCase();
  }
  function paintAvatar(el, u) {
    el.textContent = "";
    if (u.avatar && /^https:\/\//.test(u.avatar)) {
      var img = new Image();
      img.alt = ""; img.referrerPolicy = "no-referrer"; img.decoding = "async";
      img.onerror = function () { el.textContent = initials(u.name, u.email); };
      img.src = u.avatar;
      el.appendChild(img);
    } else { el.textContent = initials(u.name, u.email); }
  }
  function firstName(u) { return String(u.name || u.email || "").split(/[\s@]/)[0] || "Profile"; }
  function paint(u) {
    var root = document.documentElement;
    if (u) root.setAttribute("data-auth", "in"); else root.removeAttribute("data-auth");
    /* members (and everyone, while accounts aren't switched on yet) see the full site */
    root.setAttribute("data-access", u || (MODE === "off" && CFG.openWhenAccountsOff !== false) ? "full" : "limited");
    each("[data-auth-out]", function (el) { el.hidden = !!u; });
    each("[data-auth-in]", function (el) { el.hidden = !u; });
    each("[data-account-btn]", function (a) {
      a.href = u ? a.getAttribute("data-href-in") : a.getAttribute("data-href-out");
      a.setAttribute("aria-label", u ? "My profile" : "Log in or sign up");
      var ic = a.querySelector("[data-account-icon]"), av = a.querySelector("[data-avatar]");
      if (ic) ic.hidden = !!u;
      if (av) { av.hidden = !u; if (u) paintAvatar(av, u); }
    });
    if (u) {
      each(".nav-user [data-avatar], .profile-head [data-avatar]", function (el) { paintAvatar(el, u); });
      each("[data-user-name]", function (el) { el.textContent = firstName(u); });
      lsSet("swabud-user-cache", JSON.stringify({ name: u.name, email: u.email, avatar: u.avatar }));
    } else {
      lsDel("swabud-user-cache");
    }
    try { document.dispatchEvent(new CustomEvent("swabud:auth", { detail: { user: u || null } })); } catch (e) { /* ignore */ }
  }
  /* paint quickly from the cached user so the header doesn't flicker, then confirm with the backend */
  if (hasSession) { try { var cached = JSON.parse(lsGet("swabud-user-cache") || "null"); if (cached) paint(cached); } catch (e) { /* ignore */ } }

  /* ---------- keep saved opportunities in the account ---------- */
  function syncSaved(b) {
    return b.listSaved().then(function (rows) {
      var remote = rows.map(function (r) { return r.slug; });
      var local = SW.getSaved ? SW.getSaved() : [];
      var toAdd = local.filter(function (s) { return remote.indexOf(s) === -1; });
      if (SW.setSaved) { SW.setSaved(remote.concat(toAdd)); SW.paintSaved(); }
      return Promise.all(toAdd.map(function (s) { return b.addSaved(s); }));
    }).catch(function () { /* keep the local list if the account can't be reached */ });
  }
  document.addEventListener("swabud:saved-change", function (e) {
    if (!SW.auth.user) return;
    var d = e.detail || {};
    backend().then(function (b) { return d.saved ? b.addSaved(d.slug) : b.deleteSaved(d.slug); })
      .catch(function () { toast("Saved here, but we couldn't reach your account. We'll sync next time."); });
  });

  /* ---------- public API for profile.js ---------- */
  var readyResolve;
  SW.auth = {
    mode: MODE, user: null, base: BASE,
    ready: new Promise(function (r) { readyResolve = r; }),
    backend: backend,
    paint: paint,
    setUser: function (u) { SW.auth.user = u; paint(u); },
    signOut: signOut
  };

  function goNext(flash) {
    var next = ssTake("swabud-next") || "profile.html";
    if (!/^[a-z0-9\-\/]+\.html(#[\w-]+|\?id=[a-z0-9-]+(&live=1)?)?$/i.test(next)) next = "profile.html";
    if (flash) ssSet("swabud-flash", flash);
    location.href = BASE + next;
  }
  function signOut() {
    return backend().then(function (b) { return b ? b.signOut() : null; }).catch(function () { /* sign out locally anyway */ }).then(function () {
      lsDel("swabud-user-cache"); lsDel("swabud-auth");
      if (SW.setSaved) SW.setSaved([]);
      ssSet("swabud-flash", "You're signed out. Your saved list stays in your account.");
      location.href = BASE + "index.html";
    });
  }
  document.addEventListener("click", function (e) {
    var so = e.target.closest("[data-signout]");
    if (so) { e.preventDefault(); so.disabled = true; signOut(); return; }
    var nx = e.target.closest("[data-set-next]");
    if (nx) ssSet("swabud-next", nx.getAttribute("data-set-next"));
    var g = e.target.closest("[data-google-signin]");
    if (!g) return;
    e.preventDefault();
    if (MODE === "off") { toast("Sign-in opens soon. Thanks for your patience."); return; }
    if (g.getAttribute("data-next")) ssSet("swabud-next", g.getAttribute("data-next"));
    g.disabled = true;
    backend().then(function (b) { return b.signInGoogle(); }).then(function (r) {
      if (!r.redirected) goNext(MODE === "demo" ? "Preview: signed in with a demo Google account." : "");
    }).catch(function (err) {
      g.disabled = false;
      var box = document.querySelector("[data-step]:not([hidden]) [data-auth-error]") || document.querySelector("[data-auth-error]");
      if (box) { box.hidden = false; box.textContent = friendly(err).message; } else toast(friendly(err).message);
    });
  });

  /* ---------- small form helpers ---------- */
  function showStep(name) {
    each("[data-step]", function (s) { s.hidden = s.getAttribute("data-step") !== name; });
    var cur = document.querySelector('[data-step="' + name + '"]');
    if (cur) { var f = cur.querySelector("input:not([type=hidden]):not([disabled])"); if (f) setTimeout(function () { f.focus(); }, 30); }
    window.scrollTo(0, 0);
  }
  function err(form, msg) { var b = form.querySelector("[data-auth-error]"); if (!b) return; b.hidden = !msg; b.textContent = msg || ""; }
  function busy(btn, on) {
    if (!btn) return;
    if (on) { btn.disabled = true; btn.classList.add("is-busy"); }
    else { btn.disabled = false; btn.classList.remove("is-busy"); }
  }
  function demoCode(step, code, none) {
    var box = document.querySelector('[data-step="' + step + '"] [data-demo-code]');
    if (!box) return;
    if (MODE !== "demo") { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = none ? "<strong>Preview:</strong> there is no preview account with this email, so no code was created."
      : "<strong>Preview code: <span class=\"mono\">" + code + "</span></strong> On swabud.tech this code arrives by email.";
  }
  function val(form, name) { var el = form.elements[name]; return el ? String(el.value || "").trim() : ""; }
  function pwScore(p) {
    var s = 0;
    if (p.length >= 8) s++;
    if (p.length >= 12) s++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return Math.min(4, s);
  }
  function checkNewPassword(p1, p2) {
    if (p1.length < 8) return "Use at least 8 characters for your password.";
    if (!/[A-Za-z]/.test(p1) || !/\d/.test(p1)) return "Use both letters and numbers in your password.";
    if (p1 !== p2) return "The two passwords don't match.";
    return "";
  }
  /* show / hide password */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-pw-toggle]");
    if (!t) return;
    var inp = document.getElementById(t.getAttribute("data-pw-toggle"));
    var show = inp.type === "password";
    inp.type = show ? "text" : "password";
    t.setAttribute("aria-pressed", show ? "true" : "false");
    t.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });
  /* strength meter */
  each("[data-pw-meter]", function (m) {
    var field = m.closest(".field"), inp = field.querySelector("input"), hint = field.querySelector("[data-pw-hint]");
    var words = ["Too short", "Weak", "Okay", "Good", "Strong"];
    inp.addEventListener("input", function () {
      var p = inp.value, s = p ? pwScore(p) : 0;
      m.setAttribute("data-score", p ? String(s) : "");
      if (hint) hint.textContent = p ? "Strength: " + words[p.length < 8 ? 0 : s] + (p.length < 8 ? ". Use at least 8 characters." : "") : "At least 8 characters. Mix letters, numbers and a symbol.";
    });
  });
  /* only digits in code boxes */
  each(".code-input", function (inp) {
    inp.addEventListener("input", function () { var v = inp.value.replace(/\D/g, ""); if (v !== inp.value) inp.value = v; });
  });
  /* resend with a cooldown */
  function cooldown(btn, secs) {
    var label = btn.getAttribute("data-label-orig") || btn.textContent;
    btn.setAttribute("data-label-orig", label);
    btn.disabled = true;
    var left = secs;
    btn.textContent = label + " (" + left + "s)";
    var t = setInterval(function () {
      left--;
      if (left <= 0) { clearInterval(t); btn.disabled = false; btn.textContent = label; }
      else btn.textContent = label + " (" + left + "s)";
    }, 1000);
  }

  /* ---------- page controllers ---------- */
  var pendingEmail = "";
  function setCodeEmail(email) { each("[data-code-email]", function (el) { el.textContent = email; }); }

  function initLogin(b) {
    var form = document.getElementById("login-form"), codeForm = document.getElementById("login-code-form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = val(form, "email"), pw = form.elements["l-password"].value;
      if (!form.checkValidity() || !pw) { err(form, "Enter your email and password."); return; }
      err(form, "");
      var btn = form.querySelector("[type=submit]"); busy(btn, true);
      b.signInPassword(email, pw).then(function () { goNext(); }).catch(function (x) {
        busy(btn, false);
        if (x.code === "email_not_confirmed") {
          pendingEmail = email; setCodeEmail(email);
          (x.demoCode ? Promise.resolve({ demoCode: x.demoCode }) : b.resend("signup", email)).then(function (r) { showStep("code"); demoCode("code", r.demoCode); })
            .catch(function (y) { err(form, y.message); });
          return;
        }
        err(form, x.message);
      });
    });
    codeForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var c = val(codeForm, "code");
      if (!/^\d{6,10}$/.test(c)) { err(codeForm, "Enter the 6-digit code from the email."); return; }
      var btn = codeForm.querySelector("[type=submit]"); busy(btn, true);
      b.verifySignup(pendingEmail, c).then(function () { goNext("Email confirmed. Welcome to SWABUD!"); }).catch(function (x) { busy(btn, false); err(codeForm, x.message); });
    });
  }

  function initSignup(b) {
    var form = document.getElementById("signup-form"), codeForm = document.getElementById("signup-code-form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = val(form, "name"), email = val(form, "email");
      var p1 = form.elements["su-password"].value, p2 = form.elements["su-password2"].value;
      if (!name || !form.elements.email.checkValidity() || !email) { err(form, "Enter your name and a valid email address."); return; }
      var pwErr = checkNewPassword(p1, p2);
      if (pwErr) { err(form, pwErr); return; }
      if (!form.elements.terms.checked) { err(form, "Please agree to the terms and privacy policy."); return; }
      err(form, "");
      var interests = Array.prototype.filter.call(form.querySelectorAll('[name="interests"]'), function (c) { return c.checked; }).map(function (c) { return c.value; });
      var btn = form.querySelector("[type=submit]"); busy(btn, true);
      b.signUp(email, p1, { name: name, interests: interests }).then(function (r) {
        busy(btn, false);
        if (!r.needsCode) { goNext("Welcome to SWABUD! Your account is ready."); return; }
        pendingEmail = email; setCodeEmail(email);
        showStep("code"); demoCode("code", r.demoCode);
      }).catch(function (x) { busy(btn, false); err(form, x.message); });
    });
    codeForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var c = val(codeForm, "code");
      if (!/^\d{6,10}$/.test(c)) { err(codeForm, "Enter the 6-digit code from the email."); return; }
      var btn = codeForm.querySelector("[type=submit]"); busy(btn, true);
      b.verifySignup(pendingEmail, c).then(function () { goNext("Welcome to SWABUD! Your account is ready."); }).catch(function (x) { busy(btn, false); err(codeForm, x.message); });
    });
  }

  function initForgot(b) {
    var form = document.getElementById("forgot-form"), reset = document.getElementById("reset-form"), np = document.getElementById("newpass-form");
    var carried = ssTake("swabud-email");
    if (carried && form.elements.email) form.elements.email.value = carried;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = val(form, "email");
      if (!email || !form.elements.email.checkValidity()) { err(form, "Enter a valid email address."); return; }
      err(form, "");
      var btn = form.querySelector("[type=submit]"); busy(btn, true);
      b.sendReset(email).then(function (r) {
        busy(btn, false); pendingEmail = email; setCodeEmail(email);
        showStep("reset"); demoCode("reset", r.demoCode, r.none);
      }).catch(function (x) { busy(btn, false); err(form, x.message); });
    });
    reset.addEventListener("submit", function (e) {
      e.preventDefault();
      var c = val(reset, "code"), p1 = reset.elements["rp-password"].value, p2 = reset.elements["rp-password2"].value;
      if (!/^\d{6,10}$/.test(c)) { err(reset, "Enter the 6-digit code from the email."); return; }
      var pwErr = checkNewPassword(p1, p2);
      if (pwErr) { err(reset, pwErr); return; }
      err(reset, "");
      var btn = reset.querySelector("[type=submit]"); busy(btn, true);
      b.verifyReset(pendingEmail, c).then(function () { return b.updatePassword(p1); }).then(function (u) {
        if (u) SW.auth.setUser(u);
        showStep("done");
      }).catch(function (x) { busy(btn, false); err(reset, x.message); });
    });
    np.addEventListener("submit", function (e) {
      e.preventDefault();
      var p1 = np.elements["np-password"].value, p2 = np.elements["np-password2"].value;
      var pwErr = checkNewPassword(p1, p2);
      if (pwErr) { err(np, pwErr); return; }
      var btn = np.querySelector("[type=submit]"); busy(btn, true);
      b.updatePassword(p1).then(function (u) { if (u) SW.auth.setUser(u); showStep("done"); }).catch(function (x) { busy(btn, false); err(np, x.message); });
    });
    b.onRecovery(function () { showStep("newpass"); });
  }

  /* resend + back buttons on the code steps */
  document.addEventListener("click", function (e) {
    var r = e.target.closest("[data-resend]");
    if (r && pendingEmail) {
      var type = r.getAttribute("data-resend");
      cooldown(r, 60);
      backend().then(function (b) { return b.resend(type, pendingEmail); }).then(function (res) {
        var step = r.closest("[data-step]").getAttribute("data-step");
        demoCode(step, res.demoCode, res.none);
        toast("A new code is on its way to " + pendingEmail);
      }).catch(function (x) { var f = r.closest("[data-step]").querySelector("form"); if (f) err(f, x.message); });
      return;
    }
    var back = e.target.closest("[data-back]");
    if (back) { showStep(back.getAttribute("data-back")); return; }
    var carry = e.target.closest("[data-carry-email]");
    if (carry) { var src = document.querySelector(carry.getAttribute("data-carry-email")); if (src && src.value) ssSet("swabud-email", src.value.trim()); }
  });

  function disableForms() {
    each(".auth-card form button, .auth-card form input, .auth-card [data-google-signin]", function (el) { el.disabled = true; });
  }

  /* ---------- start ---------- */
  function showModeNotes() {
    each("[data-demo-note]", function (n) { n.hidden = MODE !== "demo"; });
    each("[data-setup-note]", function (n) { n.hidden = MODE !== "off"; });
  }
  if (["login", "signup", "forgot", "profile"].indexOf(PAGE) !== -1) showModeNotes();

  if (MODE === "off" || !needsBackend) {
    if (MODE === "off" && ["login", "signup", "forgot"].indexOf(PAGE) !== -1) disableForms();
    if (!hasSession) paint(null);
    readyResolve({ mode: MODE, user: null, backend: null });
    return;
  }

  backend().then(function (b) {
    return b.getUser().then(function (u) {
      SW.auth.user = u;
      paint(u);
      var after = u ? syncSaved(b) : Promise.resolve();
      return after.then(function () { return { b: b, u: u }; });
    }).catch(function () { paint(null); return { b: b, u: null }; });
  }).then(function (x) {
    var b = x.b, u = x.u;
    if (u && (PAGE === "login" || PAGE === "signup")) { goNext(); return; }
    if (u && PAGE === "submit") { location.replace(BASE + "profile.html#submit"); return; }
    if (u && PAGE === "saved") { location.replace(BASE + "profile.html#saved"); return; }
    if (PAGE === "login") initLogin(b);
    if (PAGE === "signup") initSignup(b);
    if (PAGE === "forgot") initForgot(b);
    readyResolve({ mode: MODE, user: u, backend: b });
  }).catch(function () {
    readyResolve({ mode: MODE, user: null, backend: null, error: true });
  });
})();
