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
- Sender email: the verified LGNDRY.Co mailbox `neomokgwadi@lgndry-co.co.za`

SPF and DKIM should be configured with the selected mail provider to improve delivery. A publishable or anon key cannot change SMTP or dashboard Auth settings.

## Verification test

1. Register with a new email address.
2. Confirm that the subject is “Verify Your LGNDRY.Co Account” and sender name is “LGNDRY.Co”.
3. Open the newest verification email once.
4. Confirm the browser opens `/auth-callback.html` on the production domain.
5. Confirm the page displays “Your account is verified.”
6. Continue to My Account and confirm only the signed-in customer’s orders are visible.
7. Use the resend button if a link expires; older links should not be reused.

## Google sign-in

1. In Google Cloud Console, create an OAuth 2.0 Web Client.
2. Add this **Authorised redirect URI** exactly:
   `https://tscaluhtfrvwlwjybfsg.supabase.co/auth/v1/callback`
3. Add these **Authorised JavaScript origins**:
   - `https://www.lgndry-co.co.za`
   - `https://lgndry-co.co.za`
4. In **Supabase Dashboard → Authentication → Providers → Google**, enable Google and paste the Google Client ID and Client Secret.
5. Keep the website callback `https://www.lgndry-co.co.za/auth-callback.html` in Supabase's redirect allow list.

Google-authenticated email addresses are treated as provider-verified by Supabase. The existing database trigger creates the customer profile and links matching orders by verified email; order access remains enforced using the permanent Supabase user ID.
