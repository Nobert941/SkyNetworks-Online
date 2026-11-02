# SkyNetworks refined MVP

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
