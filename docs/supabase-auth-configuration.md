# LGNDRY.Co Supabase Auth configuration

These dashboard settings are required for production customer email verification.

## URL configuration

In **Supabase Dashboard → Authentication → URL Configuration** set:

- Site URL: `https://www.lgndry-co.co.za`
- Redirect URL: `https://www.lgndry-co.co.za/auth-callback.html`
- Redirect URL: `https://www.lgndry-co.co.za/auth-callback.html?next=reset`
- Redirect URL: `https://lgndry-co.co.za/auth-callback.html`

Keep `http://localhost:3000/auth-callback.html` only as an additional development redirect when a local server is actually running. Never use localhost as the production Site URL.

## Confirmation email

In **Authentication → Email Templates → Confirm signup** set:

- Subject: `Verify Your LGNDRY.Co Account`
- Body: copy the complete contents of `supabase/email-templates/confirm-signup.html`

The template sends the verification token to the dedicated LGNDRY.Co callback page. It does not bypass verification.

## Sender name

The default Supabase mail service may display “Supabase Auth”. To reliably use LGNDRY.Co branding, configure **Authentication → SMTP Settings** with a verified custom SMTP provider and set:

- Sender name: `LGNDRY.Co`
- Sender email: a verified LGNDRY.Co mailbox, such as `info@lgndry-co.co.za`

SPF and DKIM should be configured with the selected mail provider to improve delivery. A publishable or anon key cannot change SMTP or dashboard Auth settings.

## Verification test

1. Register with a new email address.
2. Confirm that the subject is “Verify Your LGNDRY.Co Account” and sender name is “LGNDRY.Co”.
3. Open the newest verification email once.
4. Confirm the browser opens `/auth-callback.html` on the production domain.
5. Confirm the page displays “Your account is verified.”
6. Continue to My Account and confirm only the signed-in customer’s orders are visible.
7. Use the resend button if a link expires; older links should not be reused.
