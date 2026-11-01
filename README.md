# SkyNetworks — editable marketplace website starter

A responsive front-end prototype for an Africa-focused task marketplace inspired by the broad workflow of platforms such as Airtasker. It is original starter code, not a copy of Airtasker's branding or source code.

## Run it
1. Download and unzip `SkyNetworks.zip`.
2. Open `index.html` in a modern browser. No build tools are required.
3. Edit `app.js` to change sample listings, categories, fee assumptions and demo interactions. Edit `styles.css` to change the theme and layout.
4. Deploy the folder to a static host such as GitHub Pages, Netlify or Cloudflare Pages.

## Included in this prototype
- Dark navy / blue responsive layout.
- Task discovery, search and category filters.
- Post-task form with editable sample listings.
- Public task discussion and separate private-chat concept.
- Basic client-side blocking of phone-like numbers, emails and external links in messages.
- Service-fee illustration (10% provider fee; configurable in copy/code).
- Nearby map-style preview and location privacy messaging.
- Terms and conditions outline, safety guidance and reporting placeholder.
- Mobile navigation and notification/toast feedback.

## Important: demo vs production
This download is a **front-end prototype**. It does not create real user accounts, persist data, send emails/SMS/push notifications, provide real private messaging, process payments, calculate legal fees, or display a live Google Map. Demo tasks disappear when the page is refreshed. The browser-side contact filter is only a user-interface deterrent and can be bypassed; it is not security.

Before accepting real users or payments, build and test a secure backend:
- **Accounts:** verified email/phone, secure password hashing, MFA option, role permissions, account recovery and audit logs.
- **Database:** PostgreSQL or managed database; store users, tasks, offers, agreements, messages, reviews, reports, fee ledger and notification preferences.
- **Messaging:** authenticated task rooms; public thread visibility rules; private thread membership checks on every request; moderation/reporting queue; rate limits; abuse detection; safe attachment scanning. Consider end-to-end encryption only after a clear moderation and recovery design.
- **Contact-detail policy:** server-side detection and moderation, user warnings, appeals and clear exceptions where appropriate. Explain what staff can access and why. Never promise that private messages are absolutely inaccessible if your safety process permits review.
- **Maps:** create a Google Maps API key, restrict it by domain and API, enable billing alerts, and use approximate public task pins. Reveal exact meeting addresses only when needed and with both parties' consent. A Google Maps API key should not be treated as a secret when used in browser code; restrict it.
- **Payments:** choose a licensed payment provider and implement a server-side checkout/webhook ledger. For Kenya, investigate Daraja/M-Pesa STK Push and settlement requirements. Do not store M-Pesa PINs. Display the fee, payer, taxes and refund rules before confirmation. Obtain legal/accounting advice before holding funds or offering escrow.
- **Email/SMS/push:** connect a transactional provider (for example, Postmark, Resend, SendGrid or an SMS provider). Trigger notifications from backend events: task posted, offer received, assignment accepted, new message, agreement updated, deadline reminder, completion, review request, payment status and dispute update. Include notification preferences and unsubscribe controls.
- **Legal & compliance:** obtain local legal review for each launch country. Prepare Terms, Privacy Notice, Cookies, Community Standards, Provider Standards, Prohibited Items, Dispute/Refund Policy and Data Retention policy. Assess Kenya Data Protection Act requirements, controller/processor roles, lawful basis, data-subject rights, breach response and ODPC registration obligations where applicable.

## Suggested MVP build order
1. User registration and verification.
2. Create/edit task, categories, budget, town and approximate location.
3. Provider offers and task assignment.
4. Public task thread and authenticated private agreement chat.
5. Notifications and reporting/moderation tools.
6. Fee disclosure and payment-provider integration.
7. Reviews, disputes, admin dashboard and analytics.

## Fee configuration
The current UI uses a **10% illustrative provider fee**. This is only a suggested starting assumption, not a market or legal recommendation. Set the final fee after user research and legal/tax review. In production calculate it on the server and show the exact amount before acceptance.

## Google Maps setup
The current maps are illustrative CSS previews. For live maps, add a Google Maps JavaScript API integration in a production app, restrict the key to your domains and enabled APIs, and avoid publishing precise home/work locations by default.
