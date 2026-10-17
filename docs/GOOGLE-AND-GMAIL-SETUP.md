# Google sign-in and Gmail verification — Windows setup

There are two signup methods:

- **Continue with Google:** Google confirms ownership of a verified Gmail/googlemail address. No additional verification email is needed. Users choose musician or organizer; existing accounts keep their stored role. Google Workspace / non-Gmail addresses are not enabled by this Gmail-specific feature.
- **Email and password:** The app emails a one-use link. The new account stays inactive until the user opens the link and clicks **Verify my email**. Links expire after 24 hours. Verified users then sign in normally. Any email provider can receive the link, including Gmail.

Existing database records are retained by automatic additive migrations. Existing real email/password accounts must verify on their next sign-in; they can use **Need a new verification email?**. Built-in fictional `.local` demo accounts remain available only in demo mode. A Google login never automatically takes over an unverified email/password account. Verify that original account first. Once a Gmail password account is verified, Google can link to that same account without changing its role.

## 1. Get the updated code

Download the updated project ZIP or, if using a Git checkout, pull the updated branch once it has been pushed. Keep your existing Docker container/volume and `data/uploads` folder. Do not delete your database.

Open PowerShell in your project folder:

```powershell
cd "C:\Users\DanishVictus\Documents\Degree\FYP 2\LifeJamLokal-website\LifeJamLokal"
npm.cmd ci
Copy-Item .env.example .env
```

Only run the copy command if `.env` does not already exist. If it exists, add the new settings to that file instead. Never overwrite your own existing credentials.

Open `.env` in VS Code. The Node API now reads it automatically. It is excluded from Git. Never send its secret values in chat or screenshots.

## 2. Create a Google OAuth application

1. Open Google Cloud Console: https://console.cloud.google.com/
2. Create/select a project such as **LifeJamLokal**.
3. Open **Google Auth Platform** (or **APIs & Services → OAuth consent screen** in the older interface).
4. Configure the app name, support email, and developer contact. For a student project choose the audience **External** and keep the app in testing while developing.
5. In **Audience / Test users**, add your own Gmail address and the Gmail addresses of anyone testing the app.
6. In **Clients**, create an **OAuth client ID**, application type **Web application**.
7. Add this authorized redirect URI exactly:

```text
http://localhost:3000/api/auth/google/callback
```

8. If asked for an authorized JavaScript origin, enter `http://localhost:3000`. This integration uses a server-side redirect, not a browser client secret.
9. Copy the client ID and client secret into your local `.env`:

```dotenv
APP_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

Open the website using `localhost`, not `127.0.0.1`, so the OAuth state cookie and callback use the same hostname. For public hosting use HTTPS and register the exact public callback URI too. This integration requests only OpenID identity, email and profile; it does not read anyone's Gmail inbox.

## 3. Configure Gmail to send verification emails

Use a dedicated sender Gmail account if possible.

1. Open https://myaccount.google.com/security while signed in to the sender account.
2. Enable **2-Step Verification**.
3. Open https://myaccount.google.com/apppasswords and create an App Password named **LifeJamLokal**.
4. Copy the generated App Password into `.env` as `SMTP_PASSWORD`. Remove display spaces; use the generated app password, not your normal Gmail password.
5. Fill in:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-sender@gmail.com
SMTP_PASSWORD=your-generated-app-password
SMTP_FROM="LifeJamLokal <your-sender@gmail.com>"
```

Use the same Gmail sender in `SMTP_USER` and `SMTP_FROM` unless you have explicitly configured an allowed Gmail sending alias. If Google does not offer App Passwords, your account type/security policy may prohibit them; use an SMTP provider that permits authenticated application mail and put its host, port, username and password in these same settings. Do not enable obsolete "less secure apps" or disable TLS verification.

## 4. Restart and test

Keep Docker Desktop/MySQL and your Python recommendation service running. In the website terminal press **Ctrl+C**, then run:

```powershell
npm.cmd run dev
```

The first start adds the verification and Google identity fields/tables automatically, preserving existing data. Open the site at `http://localhost:3000`.

**Test email signup:** Join the community, choose a role, and register a fresh email. Expect **Check your inbox**, not an immediate login. Open the email, click the link, click **Verify my email**, then sign in. Check spam if needed. Resend is available with a 60-second server cooldown. If an SMTP failure occurs after account creation, the account stays pending and can be recovered using resend; do not repeatedly create a second account.

**Test Google:** Sign out, choose your new-account role, and click **Continue with Google**. Use a verified Gmail test-user account and consent. Google accounts are already verified by Google; the app creates/signs in the account after validating the signed ID token. A different account role chosen on a later login does not change an existing role or grant administrator access.

## Troubleshooting

| Message | Fix |
|---|---|
| Google button disabled | Set both Google client variables in `.env`, then restart Node from the correct project folder. If another website process still holds port 3000, stop that process first. The updated server reports occupied ports clearly instead of claiming it started. |
| `redirect_uri_mismatch` | Match the callback URI above exactly, including localhost, port and path. |
| Access blocked / test user missing | Add the Gmail address to the OAuth app's test users. |
| Google sign-in expired / could not be verified | Start again from the app. Use the same browser and hostname; the callback needs its original HttpOnly cookie. |
| Gmail authentication failed | Check the sender address, 2-Step Verification and App Password. Do not use your Gmail login password. |
| Verification email is not configured | Set SMTP_HOST and SMTP_FROM; configure authentication for Gmail; restart Node. |
| Could not send email | Check the SMTP settings/network. Use resend after fixing delivery; the pending account is retained. |
| Link expired/already used | Request a new email. A completed verification link cannot be reused. |
| Old account needs verification | Choose **Need a new verification email?** on sign-in and enter the account's existing email. |

Verification links point to the `APP_URL` you set. A localhost link works on the computer running the website; open the email link on that laptop, not on your phone. For other devices/users, host the application at a reachable HTTPS origin and update APP_URL and Google's redirect URI.

## Validation limits

Automated tests deliver actual SMTP messages to a local test mail server and cover verification/expiration/replay/resend, pending login, mail failure recovery, Google state/PKCE/browser binding, signature/audience/issuer validation, role preservation and account-linking rules. They do not contact a real Gmail inbox or complete a real Google consent flow. Those live checks require your own credentials and browser; no credentials have been invented or committed.
