/* Runs before the page paints: applies the saved light/dark theme and the visitor or member view,
   so logged-in members never see a flash of locked content. auth.js confirms the account right after. */
(function () {
  var d = document.documentElement, cached = null;
  try {
    var t = localStorage.getItem("swabud-theme");
    if (t === "light" || t === "dark") d.setAttribute("data-theme", t);
    cached = localStorage.getItem("swabud-user-cache");
  } catch (e) { /* storage blocked: visitor view */ }
  var c = window.SWABUD_CONFIG || {};
  var configured = !!(c.supabaseUrl && (c.supabaseKey || c.supabaseAnonKey));
  var accountsOff = !configured && (c.productionHosts || []).indexOf(location.hostname) !== -1;
  if (cached) d.setAttribute("data-auth", "in");
  /* "full" shows member content. Until accounts are switched on, swabud.tech stays fully open. */
  d.setAttribute("data-access", cached || (accountsOff && c.openWhenAccountsOff !== false) ? "full" : "limited");
})();
