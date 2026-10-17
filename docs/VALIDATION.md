# Validation — 16 October 2026

Current instance: Node 24.19, Python 3.12, MySQL 8.4 (Docker), React 18.

- Production client build: passed.
- Dependency installation / local database preparation: passed using `bash scripts/setup.sh --skip-model`.
- `npm test`: 22 passed, 0 failed, 0 skipped. Includes concurrent overlapping acceptance (exactly one succeeds), real media upload/retrieval and invalid-file rejection, server-side role/ownership controls, review eligibility, suspension and export.
- `npm run test:browser`: passed organizer demo sign-in, create/like/comment on a persisted post, genre filtering, artist profile, booking request and cancellation, persisted messaging, and desktop/mobile routes without JavaScript exceptions or horizontal overflow.
- `npm run test:roles`: passed musician profile editing, all profile tabs, all administrator tabs, database maintenance, and mobile admin navigation.
- Screenshots: `screenshots/desktop.png`, `screenshots/discover.png`, `screenshots/mobile.png`. Sample profiles are fictional. Images and fonts are local; screenshot inspection found no broken images.
- Python service syntax and shell script syntax: passed.
- Startup: MySQL and Node/React service started using `bash scripts/start.sh`; `/api/health` confirms MySQL.

**Outstanding:** Hugging Face model download returned proxy 403. The actual Sentence-BERT service was attempted and failed at model loading. Its implementation is present, but actual model inference and semantic reindexing are not validated. Search runs the labeled `keyword-fallback` engine; its persistence and user-specific history are tested. `tests/semantic.mjs` must pass against the actual model after network access is enabled. No fabricated embeddings or semantic test results are used.

The saved environment draft includes installation/startup instructions and Hugging Face host requirements. Draft persistence is separate from runtime changes and publication. No public deployment, production load/security audit, formal usability evaluation, or fresh-task snapshot restoration was performed.

## Google/Gmail authentication update

Added Google OAuth authorization-code login with PKCE, browser-bound state, nonce and signed ID-token validation. Added SMTP verification for password signup, 24-hour single-use hashed tokens, resend cooldown, pending-account login restrictions, and additive migrations for existing users. Node now loads a local ignored `.env` automatically.

The 21 API tests include 8 new authentication cases using actual SMTP delivery to a loopback test inbox and locally signed JWTs. A real Google OAuth consent/token exchange and delivery to a Gmail inbox require the owner's credentials and remain unverified. No normal Gmail password is used or stored. See `GOOGLE-AND-GMAIL-SETUP.md` for Windows setup.

## Startup diagnostics fix

An occupied website port now reports an error and exits with status 1. The previous Express 5 listen callback ignored its error argument and could falsely log a successful startup while an older website still served requests. A regression test checks the failure status, message, and continued operation of the original listener. Development shutdown was also checked to release both the API and Vite live-reload ports.
