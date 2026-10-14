/* SWABUD account settings.
   Accounts (Google sign-in, email sign-up with a 6-digit code, password reset by code, profile, tracker and submissions)
   run on Supabase's free plan. Follow "Step 2: switch on accounts" in README.md, then paste the two values below.

   supabaseUrl  Supabase dashboard > Project Settings > API Keys / Data API > Project URL   (https://xxxx.supabase.co)
   supabaseKey  Supabase dashboard > Project Settings > API Keys > Publishable key (sb_publishable_...).
                Older projects can use the legacy "anon public" key instead. Both are safe to publish:
                every table is protected by row level security (see supabase/schema.sql).
                Never paste the secret / service_role key here.

   While these are empty, accounts run in "preview mode" (stored only in the visitor's browser, codes shown on screen)
   everywhere except the production hosts listed below, where visitors see "Accounts are being set up" instead,
   and (with openWhenAccountsOff: true) every page stays fully open so nothing is locked behind a login that isn't ready. */
window.SWABUD_CONFIG = {
  supabaseUrl: "https://qzyugqgoqzsovimaezjc.supabase.co",
  supabaseKey: "sb_publishable_NtFEQAVpfflCXxYMijQiig_2yz7nHEW",
  productionHosts: ["swabud.tech", "www.swabud.tech"],
  openWhenAccountsOff: true
};
