# swabud.tech

The SWABUD website: verified hackathons, CTFs, internships, fellowships, scholarships, events, courses (free and paid), volunteering and student programmes for students in Nepal. **Discover. Connect. Grow.**

It is a fast static site (HTML, CSS and JavaScript) that runs on any host, including free Cloudflare Pages or GitHub Pages. Accounts use Supabase's free plan, so you still don't need a server.

## Visitors and members

SWABUD has two levels of access. Anyone can browse a preview; a free account (Google or email) unlocks the full platform.

| | Visitor (no account) | Member (free account) |
|---|---|---|
| Opportunities | 9 at a time, with search and categories | All of them, with status, place, level, cost filters, sorting, "Show more" and "Recommended for me" |
| Listing pages | Summary, who can apply, dates, live countdown | Plus official link, how-to-apply steps, cost, benefits, level, SWABUD tips, calendar buttons |
| Calendar | Next 4 dates | Full month-by-month calendar, plus a "My saved dates" view |
| Sources | Group names only | All 53 official sources with links |
| Learning paths | Path overview | Every step and resource, with progress you can tick off |
| Career guides | 2 guides (CV, scam safety) | All 8 guides |
| Saving and tracking | Not available | Save, tracker stages, application checklist, notes, calendar export |
| Extras | Contact form, weekly alerts | Dashboard, deadline heads-up banner, "new since your last visit", profile completeness, submit opportunities |

The top menu changes too: visitors see Opportunities, About, Partners, Contact, Log in and Sign up; members see Opportunities, Calendar, Sources, Learn, Career, About and their dashboard.

Good to know:
- This is a static site, so members-only content is hidden in the page rather than kept on a server. It stops casual browsing; someone who reads the page source could still find it. Listing pages carry the standard "paywalled content" markup so search engines still index them correctly.
- If accounts are not switched on (empty `config.js`) on swabud.tech, every page stays fully open (`openWhenAccountsOff: true` in `assets/js/config.js`), so nobody is locked behind a login that doesn't work yet.

## What's in it

- **124 opportunities in 8 categories**, free and paid, each with its own page: key facts, how to apply, a SWABUD note, share links, Google Calendar and `.ics` downloads, and a "report a problem" form.
- **Statuses that change by themselves, in Nepal time.** Every listing switches automatically between *Opens in…*, *Open*, *Closing soon* (last 7 days), *Happening now* and *Closed*. A deadline closes at 11:59:59 PM Nepal time on its day. Cards show "Closes in 18 days"; each listing page shows a live days / hours / minutes / seconds countdown. Nothing needs to be edited when a date passes.
- **Accounts** (`signup.html`, `login.html`, `forgot-password.html`, `profile.html`):
  - Sign up or log in with **Google**, or with email and password.
  - Email sign-ups are confirmed with a **6-digit code** sent by email.
  - **Forgot password:** get a code by email, enter it with a new password. The reset link in the same email also works.
  - **Profile:** what's next (your saved deadlines with live countdowns), what's coming up on SWABUD, recommendations from your interests and region, and stats.
  - **Saved & application tracker:** saved opportunities sync across devices; move each one through Saved, Preparing, Applied, Accepted or Not selected; add private notes; export all your dates to your calendar.
  - **Submit an opportunity** from the profile and follow its review status (In review, Published, Not listed).
  - **Settings:** edit name, college, programme, city, interests, region and weekly alerts; change or set a password; sign out; request account deletion.
- **"Submit an opportunity" now needs an account.** It moved out of the top menu into the profile. `submit.html` explains this and offers Google, log in or sign up.
- **Partners:** a partner strip under the home page numbers, a Partners section on the home and About pages (NISC, the Nepalgunj IT Students Community, first), and a "your community here" card linking to the partner form.
- Contact form on the home page and the Contact page (both send to info@swabud.tech); directory with search, categories and member filters; deadline calendar with opening dates; light and dark mode; 53 official sources; learning paths; career guides; an expanded About page; RSS feed and a public JSON summary (`api/opportunities.json`, without official links); SEO, favicons and web manifest.

## Step 1: activate the forms (one time)

Forms (contact, alerts, submissions, reports, partner and join) are delivered to **info@swabud.tech** by FormSubmit (free, no account needed).

1. Create the info@swabud.tech mailbox and make sure it receives mail.
2. Put the site online, open `contact.html` and send a test message.
3. FormSubmit emails info@swabud.tech an **Activate Form** button. Click it.
4. From then on, every form arrives in that inbox with the sender's email set as Reply-To.

If FormSubmit is ever unreachable, each form shows the message ready to send by email instead, so nothing is lost.

## Step 2: switch on accounts (Supabase, free)

Until you do this, swabud.tech shows "Accounts are being set up" on the account pages, and everything else works. On any other address (for example a test copy), accounts run in **preview mode**: stored only in that browser, with codes shown on screen.

### 2.1 Create the project and tables

1. Sign up at [supabase.com](https://supabase.com) and create a new project (name: `swabud`; pick the region closest to Nepal, such as Mumbai).
2. Open **SQL Editor**, paste everything from `supabase/schema.sql`, and click **Run**. This creates the `profiles`, `saved` and `submissions` tables, locks each one so people can only see their own rows, and creates a profile automatically for every new account.

**Already ran it for v3?** Run the new `supabase/schema.sql` once more. It is safe to re-run and adds the two columns v4 needs (`profiles.learn_progress` for learning progress and `saved.checklist` for the application checklist). Without them, those two features can't save.

### 2.2 Set your website address

**Authentication > URL Configuration**:

- **Site URL:** `https://swabud.tech`
- **Redirect URLs:** add `https://swabud.tech/**` and `https://www.swabud.tech/**` (and your `*.pages.dev` address if you test there).

### 2.3 Send real emails (required)

Supabase's built-in email service only delivers to members of your own Supabase team, and only about 2 emails an hour. Students won't receive codes until you connect your own email sender.

1. Choose an email provider with SMTP (for example Brevo, Resend, SendGrid or Zoho Mail; several have free plans) and verify the `swabud.tech` domain there. Add the SPF, DKIM and DMARC records it gives you in Cloudflare DNS.
2. In Supabase, **Authentication > Emails > SMTP Settings**: turn on custom SMTP, enter the provider's host, port, username and password, sender email `info@swabud.tech` (or `no-reply@swabud.tech`) and sender name `SWABUD`.
3. **Authentication > Rate Limits:** raise the email limit if you expect many sign-ups at once.

### 2.4 Use 6-digit codes in the emails

**Authentication > Emails > Templates**:

- **Confirm signup:** subject `Your SWABUD code: {{ .Token }}`, body: paste `supabase/email-templates/confirm-signup.html`.
- **Reset password:** subject `Your SWABUD password reset code: {{ .Token }}`, body: paste `supabase/email-templates/reset-password.html`.

`{{ .Token }}` is the 6-digit code people type on the site. The templates also keep a link as a backup.

In **Authentication > Sign In / Providers > Email**, keep **Confirm email** on and set the minimum password length to 8.

### 2.5 Google sign-in

1. Go to [Google Cloud Console](https://console.cloud.google.com/), create a project (for example `SWABUD`), and open **Google Auth Platform**.
2. **Branding:** app name `SWABUD`, support email, logo (`assets/img/icon-512.png`), home page `https://swabud.tech`, privacy policy `https://swabud.tech/privacy.html`, terms `https://swabud.tech/terms.html`, authorized domain `swabud.tech`.
3. **Audience:** User type *External*, then **Publish app**, so any Google account can sign in (not only test users).
4. **Data access:** the default `openid`, `email` and `profile` scopes are all SWABUD needs.
5. **Clients > Create client > Web application:**
   - Authorized JavaScript origins: `https://swabud.tech` and `https://www.swabud.tech`
   - Authorized redirect URI: the **Callback URL** shown in Supabase under **Authentication > Sign In / Providers > Google** (it looks like `https://xxxx.supabase.co/auth/v1/callback`)
6. Copy the **Client ID** and **Client secret** into Supabase's Google provider page, turn it on, and save.

### 2.6 Connect the website

1. In Supabase, **Project Settings > API Keys**: copy the **Project URL** and the **Publishable key** (`sb_publishable_...`). Older projects can use the legacy **anon public** key. Never use the secret or `service_role` key.
2. Paste them into `assets/js/config.js` (`supabaseUrl` and `supabaseKey`) and publish.
3. Test it: create an account with your own email, confirm with the code, save an opportunity, log out, use **Forgot password**, and try **Continue with Google**.

### 2.7 Day-to-day

- **Review submissions:** Supabase **Table Editor > submissions**. Check the official link, add the listing to `_source/data/opportunities.json`, then set `status` to `published` (or `declined`) so the submitter sees it in their profile. Each submission also arrives by email.
- **Weekly alerts list, most-saved listings and pending submissions:** ready-made queries are at the bottom of `supabase/schema.sql`.
- **Account deletion requests** arrive at info@swabud.tech. Delete the user in **Authentication > Users**; their profile, tracker and notes are deleted with it.

## Step 3: publish

**Cloudflare Pages (recommended, free):** push this folder to a GitHub repository, create a Pages project from it with no build command and `/` as the output folder, then add `swabud.tech` as a custom domain. `_headers` applies the security headers, including the rules that allow Supabase, Google profile photos and FormSubmit.

**GitHub Pages:** push to a repository and enable Pages on the main branch. `CNAME` already contains `swabud.tech`.

**cPanel / any web host:** upload everything except `_source/` and `supabase/` into `public_html`. `.htaccess` sets the 404 page, caching and the HTTPS redirect, and blocks those two folders.

## Admin panel: publish opportunities without code

`admin.html` (https://swabud.tech/admin.html) lets the SWABUD team add, edit, publish, unpublish and remove opportunities from a form, and turn student submissions into listings. No code, no build, no upload.

**How it goes live**

1. **Straight away:** when you click *Publish now*, the listing appears in the directory, the calendar, saved lists, member dashboards and on its own page (`listing.html?id=<web-address>`).
2. **Within 30 minutes:** the GitHub Action *Publish admin listings* (`.github/workflows/publish-admin-listings.yml`) copies your changes into `_source/data/opportunities.json`, runs `_source/build.py` and pushes. Cloudflare Pages publishes the commit, and the listing gets its permanent page at `opportunities/<web-address>.html`, plus its calendar file, sitemap entry, RSS item and home-page placement. It also rebuilds once every night (00:05 Nepal time) so dates in the static pages stay fresh.

### One-time setup (about 10 minutes)

1. **Database.** In Supabase, open **SQL Editor > New query**, paste everything from `supabase/admin.sql`, and before running it add your own login email on the line near the bottom:
   `insert into public.admins (email) values ('you@gmail.com') on conflict do nothing;`
   Use the exact email you log in to swabud.tech with (your Google account if you use "Continue with Google"). Click **Run**. It's safe to run again later.
2. **Website files.** Upload this folder to your GitHub repository as usual (it includes the new `.github` folder, so make sure hidden folders are included). Cloudflare Pages publishes it.
3. **GitHub Actions.** In the repository on GitHub: **Settings > Actions > General**. Under *Actions permissions* allow actions, and under *Workflow permissions* choose **Read and write permissions**, then **Save**. Then open the **Actions** tab, pick **Publish admin listings** and click **Run workflow** once to check it finishes with a green tick.
4. **Log in.** Open https://swabud.tech/admin.html and log in with the email from step 1. If the panel says your account isn't an admin, it shows the exact SQL line to run.

To add another admin, run `insert into public.admins (email) values ('their@email.com') on conflict do nothing;` in the SQL Editor. To remove one, `delete from public.admins where email = 'their@email.com';`.

### Day to day

- **Add an opportunity:** *Add opportunity*, fill the form (the card on the right shows exactly how it will look), then **Publish now**. **Save as draft** keeps it hidden until you're ready. **Preview page** shows the full listing page first.
- **Edit any listing**, including the ones already on the site: *All listings > Edit*. Your version replaces the old one straight away.
- **Take something down:** *Remove*. Its page shows "no longer on SWABUD" at once and is deleted at the next rebuild. *Restore* brings it back.
- **Student submissions:** the *Submissions* tab lists everything students send from their profile. *Create listing from this* fills the form for you; when you publish, the submission is marked Published and the student sees it in their profile. *Decline* lets you add a short reason.
- **Publishing tab:** shows what is waiting for the next rebuild, a link to start the rebuild on GitHub right away (type your repository name once, like `username/swabud-site`), a JSON backup download and a bulk import (imported listings arrive as drafts).

### Good to know

- Only emails in `public.admins` can see drafts or change anything. Everyone else can only read published listings, which is what the site needs (`supabase/admin.sql`, row level security).
- If a listing is edited in the admin panel, that version wins over a hand edit of `opportunities.json` for the same web address. Listings you never touch in the panel can still be edited by hand as before.
- The web address of a published listing can't change (old links would break). To rename, use *Copy* to make a new listing and remove the old one.
- The panel works on phones too. On any address other than swabud.tech with empty keys in `config.js`, it runs in preview mode: everything is stored only in that browser, for testing.
- Scripts and styles now carry a version number (`?v=`) that changes at every build, so visitors always get the latest code even though `/assets/*` is cached for a week.

## Add or update an opportunity by hand (optional)

You can still edit the data file directly instead of using the admin panel:


1. Open `_source/data/opportunities.json` and copy an existing entry.
2. Fill in every field:
   - Dates use `YYYY-MM-DD` and are read as Nepal time. Leave a date empty (`""`) if it isn't known.
     - `opens`: when applications open. Before this date the listing shows *Upcoming · Opens in…*.
     - `deadline`: the last day to apply. It shows *Closing soon* for the last 7 days and *Closed* after 11:59 PM.
     - `start` and `end`: when the event runs. Between them the listing shows *Happening now*.
   - `category`: `hackathons`, `ctf`, `internships`, `scholarships`, `events`, `courses`, `volunteering` or `programs`.
   - `base`: `open`, `upcoming`, `rolling` (always open), `recurring` (opens yearly) or `closed` (closed until you update it).
   - `region`: `nepal`, `online` or `abroad`. `free`: `true` only if it's confirmed free; put the real price in `cost` for paid ones.
   - `verified`: the date you checked the official page, or empty for general listings.
   - `when`: a short date line for listings without exact dates.
3. Run `python3 _source/build.py` from this folder (Python 3.9 or newer, no extra packages).
4. Upload the changed files.

**Partners** are at the top of `_source/build.py` (`PARTNERS`). Add NISC's official website or Facebook page in `url` to make its card a link, and add new partners the same way (logo in `assets/img/partners/`).

Sources and learning links live in `_source/data/sources.json` and `_source/data/learn.json`.

## Check before launch

- Finish Steps 1 and 2 and test every account flow on the live site.
- **Social links** use instagram.com/swabud.tech, facebook.com/swabud.tech and linkedin.com/company/swabud. Change `SITE["social"]` in `_source/build.py` if yours differ, then rebuild.
- **WordCamp Nepal 2027** dates (29 to 30 Jan 2027, Nepalgunj) come from dev.events because the official site couldn't be read by our checker. Confirm them on nepal.wordcamp.org.
- **Recurring Nepal events** (LOCUS, TechSprint, KMC HackVerse) are listed as "Opens yearly" until their next dates are announced. Add `opens`, `deadline` and `start` when they are.
- Re-verify open listings every week and rebuild so the check dates stay fresh. Statuses and countdowns never need a rebuild.

## Brand

- Colours: Midnight Navy `#101C30`, Electric Lime `#C6F36A`, Slate `#526174`, Mist `#F4F7FA`.
- Fonts (Google Fonts): Unbounded for headings, Manrope for text, JetBrains Mono for labels and dates.
- Logos in `assets/img/`: `logo-wordmark.svg` (light backgrounds), `logo-wordmark-white.svg` (dark), `logo-lockup*.svg` (with tagline), `logo-badge.svg`, `icon.svg` (favicon and app icon). Originals in `assets/img/brand/originals/`. Partner logos in `assets/img/partners/`.
#   s w a b u d  
 #   s w a b u d  
 