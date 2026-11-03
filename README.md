# SkyNetworks — Complete Refined Marketplace

## Files
- `index.html` — marketplace layout and UI.
- `styles.css` — responsive design.
- `app.js` — Supabase authentication, task posting/browsing, offers, public discussion, private chat and in-app notifications.
- `supabase-config.js` — project URL and frontend publishable key.
- `02-supabase-upgrade.sql` — database upgrade to run in Supabase SQL Editor.

## Account signup database error (important)
If signup displays `Database error saving new user`, the browser signup request is reaching Supabase but a database operation during user creation is failing. This is commonly an `auth.users` trigger that inserts into a profile table with a missing/incompatible column, constraint, or permissions. This is not something a GitHub Pages code change can repair on its own.

1. Open Supabase Dashboard → SQL Editor.
2. Run the read-only `AUTH-SIGNUP-DIAGNOSTICS.sql` included in this ZIP.
3. In Supabase Dashboard → Logs → Postgres Logs, inspect the database error at the signup timestamp.
4. Correct the exact failing trigger/function or schema based on that error. Do not blindly drop auth triggers; they may be required by your app.
5. In Authentication → Users, verify whether the attempted email was created. Retry signup after the database repair.

The updated `app.js` now reports this as a database-side error and gives the next steps instead of implying that the password is wrong.

## Important deployment steps
1. In Supabase Dashboard → SQL Editor, create a new query, paste the complete contents of `02-supabase-upgrade.sql`, and Run it. This is needed for the notification table, database-side public contact filtering, accepted-offer private chat permissions and notifications.
2. Upload/replace the five website files in the root of your GitHub Pages repository: `index.html`, `styles.css`, `app.js`, `supabase-config.js`, `README.md`.
3. Do not upload `README-old.md` or this SQL file to the website root unless you want it visible publicly. Keep a local copy of the SQL migration.
4. Wait for GitHub Pages deployment, then hard-refresh the site.

## Airtasker-style refinement (v20261103)
- New file `airtasker.css` (upload next to `styles.css`). `index.html`, `app.js` also changed.
- Header: logo, Post a task pill, nav, Sign up / Log in.
- Browse: filter pills (search, category, location, price, sort), compact task cards with price, location, category, posted time, Open status and offer count, beside a full-height map with price pins. Hover/click syncs list and map. On phones the map opens with the Show map / Show list pill.

- Distance filter (5–100 km) measured from your location (or central Nairobi if not shared), blue radius circle on the map, km shown on each card, and a Nearest-first sort. Only tasks with map coordinates can be distance-filtered.

## Update v20261103-2 (run 03-fix-task-posting.sql FIRST)
- `03-fix-task-posting.sql` fixes the error `record "new" has no field "visibility"` when publishing a task, and adds the columns `is_remote`, `due_date`, `time_of_day`.
- Location pill opens a panel: task type (All / In person / Remote), area, distance slider (5-250 km), Use my location.
- Tasks are placed on the map automatically from the typed town (rounded to about 1 km). Exact GPS is never stored.
- Cards show location + km, due date or Flexible, time of day, offers, and poster initials when profiles are readable.

## UI refinements in this build
- Responsive mobile browsing: task cards use the full screen width; the map is opened with a Show map / Show tasks switch instead of squeezing the task list into a narrow column.
- Desktop split task list and map, matching the task-marketplace browsing pattern in the reference image.
- Accessible map toggle state and map resize when the map becomes visible.

## Features in this build
- Supabase email/password signup and login.
- Reads open tasks from `public.tasks`; posts tasks including optional browser geolocation coordinates.
- Leaflet maps with real OpenStreetMap map tiles. Task markers appear when a task has latitude/longitude. Users may grant browser location permission to centre the map.
- Public task discussion, provider offers, customer acceptance and private chat for the accepted provider.
- In-app notifications for offers and messages (polling every 30 seconds).
- Client-side contact-detail warning plus database trigger filtering for common email, phone, URL, social/contact patterns in public task content.
- Company contact address: networke@gmail.com.

## Existing database expectations
This build expects the original setup tables `profiles`, `tasks`, `offers`, `messages` created in the earlier SQL script. It expects these columns:
- `tasks`: id, owner_id, title, description, category, budget, location, latitude, longitude, status, created_at
- `offers`: id, task_id, provider_id, amount, message, status, created_at
- `messages`: id, task_id, sender_id, recipient_id, visibility, body, created_at

If your original `tasks` table does not have `latitude` and `longitude`, run:
```sql
alter table public.tasks add column if not exists latitude double precision;
alter table public.tasks add column if not exists longitude double precision;
```

## Maps
The map uses Leaflet and OpenStreetMap tiles, not a decorative mock map. It requires internet access. Users can optionally share approximate coordinates using browser geolocation. Tasks without coordinates still appear in the task list but cannot be pinned accurately. OpenStreetMap/Nominatim usage policies apply; this version does not automatically geocode every text address.

## Notifications and company email
In-app notifications are stored in Supabase. The company email `networke@gmail.com` is displayed as the public support contact; this does **not** send system emails. To send real email/SMS notifications, configure a transactional email/SMS provider (e.g. Resend or an SMS gateway) through a Supabase Edge Function or other trusted backend. Store provider credentials only as server-side secrets. The browser must never contain email/SMS API secrets.

## Security and production limitations
- The database trigger blocks common contact-sharing patterns in public content, but no text filter is perfect. Human reporting/moderation is still required.
- Private chat is limited by row-level security to the task owner and provider with an accepted offer.
- Before public commercial launch, review all RLS policies, test with separate customer/provider accounts, add moderation/reporting, account deletion, privacy retention, rate limiting, dispute workflows, and legal terms.
- This MVP does not implement M-Pesa, escrow, payouts, SMS/email delivery, push notifications, or a full admin console.
- Never expose Supabase service-role/secret keys. The publishable key is intended for browser use.


## Install / update checklist
1. Back up your existing GitHub repository before replacing files.
2. Upload `index.html`, `styles.css`, `app.js`, and `supabase-config.js` to the same folder as the current site. Keep filenames and casing exactly as shown.
3. In Supabase SQL Editor, review and run `02-supabase-upgrade.sql` once if you have not already run it. Back up your database first; inspect the SQL and test with separate customer/provider accounts.
4. If signup still fails with `Database error saving new user`, run the read-only `AUTH-SIGNUP-DIAGNOSTICS.sql` and inspect Supabase Postgres logs. Frontend changes alone cannot repair a failing database trigger.
5. Commit the changed files to GitHub and wait for Pages to deploy. Open the website in Chrome, then hard-refresh or clear that site's cached files.
6. Test account creation, login, posting a task, task search/category filtering, making and accepting an offer, public discussion, private negotiation, notifications, and map behavior on desktop and mobile.

## Important
This package does not log in to GitHub or publish changes on your behalf. You can upload these files to your repository yourself. Never share your GitHub password, access token, or Supabase service-role/secret key. The Supabase publishable key in `supabase-config.js` is intended for browser use; database security depends on correctly configured Row Level Security policies.
