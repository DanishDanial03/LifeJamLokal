# LifeJamLokal

A musician recruitment and community website built from **LifeJamLokal Progress 2 (Updated)**: React 18, Node/Express, MySQL 8.4, and a FastAPI / Sentence-BERT recommendation service.

The interface uses `#111111` and `#06402B`, with lime and lavender accents, a three-column professional community layout, artist portfolios, and mobile navigation.

## Run in this cloud workspace

```bash
cd /workspace/LifeJamLokal-
bash scripts/setup.sh
bash scripts/start.sh
```

Node 18+ (tested on 24), Python 3.10+ (tested on 3.12), Docker, and approximately 2 GB free disk are needed. The local database is bound to loopback and uses a development-only account. If Docker is unavailable, supply `DATABASE_URL` for an existing MySQL 8 server. Database tables are initialized automatically and sample data is inserted only into an empty database, unless `SEED_DEMO=false`.

The app listens on port **3000**. `bash scripts/start.sh --dev` starts the Vite development middleware with hot reload instead of serving the production build. There is no need to create a Git worktree: use the existing isolated checkout.

The setup script installs dependencies, starts MySQL, builds the client, and downloads `sentence-transformers/all-MiniLM-L6-v2`. Model files are cached outside the checkout in `/workspace/.cache/huggingface`. A one-time model download needs Hugging Face access; ordinary page browsing, images, and fonts work without external requests.

### Current model access limitation

The current environment returned an egress proxy **403** for `huggingface.co`. The SBERT service is implemented but could not load its pretrained model in this environment. Allow the model download hosts in environment settings (saved in the draft), then rerun:

```bash
HF_HOME=/workspace/.cache/huggingface HF_HUB_DISABLE_XET=1 \
/workspace/.lifejam-venv/bin/python -c 'from sentence_transformers import SentenceTransformer; SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2", device="cpu")'
bash scripts/start.sh
```

`GET /api/health` must show `semantic.ready: true` before claiming semantic readiness. Until then, search uses an explicitly labeled keyword cosine fallback; it does not fabricate SBERT scores. Browsing and all account, booking, community, and moderation workflows remain available. `bash scripts/setup.sh --skip-model` prepares those components without attempting the blocked download.

To run the semantic service separately:

```bash
HF_HOME=/workspace/.cache/huggingface HF_HUB_DISABLE_XET=1 \
/workspace/.lifejam-venv/bin/python -m uvicorn semantic.app:app --host 127.0.0.1 --port 8001
```

## Google signup and email verification

See [the Windows Google/Gmail setup guide](docs/GOOGLE-AND-GMAIL-SETUP.md). Configure a Google web OAuth client for **Continue with Google** and Gmail SMTP with an App Password for verification emails. New email/password accounts must confirm a one-use, 24-hour email link before sign-in. Existing real accounts also need verification; database migrations retain their records. Demo accounts remain available in demo mode. Live Google/Gmail credentials are not included.

## Try the workflows

Use **Sign in → Organizer / Musician / Admin** to open a sample account. All sample accounts use `LifeJam2026!` locally:

| Role | Email | What to try |
|---|---|---|
| Organizer | `aina@lifejam.local` | Find artists, save/connect, send booking requests, message artists |
| Musician | `amir@lifejam.local` | Edit portfolio, block dates, accept or decline booking requests, monitor reviews |
| Administrator | `admin@lifejam.local` | Manage accounts and content, moderate reviews, inspect searches, reindex and maintain the database |

You can also register your own organizer or musician account. Administrator self-registration is intentionally prohibited.

Bookings follow `pending → accepted / rejected`, accepted bookings can be cancelled or completed, and only the organizer can mark a performance completed after its scheduled end. Only that organizer can leave one multi-criteria review per completed booking. Overlapping accepted performances are rejected on the server, including concurrent acceptance attempts. Event times use Malaysia time (UTC+8).

Messages refresh every five seconds. Portfolio media can be uploaded (JPG, PNG, WebP, MP3, WAV, OGG, MP4; maximum 20 MB) or linked. Uploads are stored in ignored `data/uploads/`. User-entered URLs allow HTTP(S) and validated local asset paths; React renders text as text.

## Checks

Start the application and MySQL first:

```bash
npm run build
npm test
npm run test:browser
npm run test:roles
npm run test:auth-browser
```

API integration tests create and clean up their own accounts and exercise authentication, authorization, persisted profiles, unavailable dates, bookings, overlap prevention, completion restrictions, verified reviews, messaging privacy, saved musicians, connections, posts/comments, suspension, moderation, maintenance, export, and logout. They use the configured MySQL database; run them only against development data.

The role checks cover musician profile editing, profile tabs, every admin dashboard tab, maintenance, and mobile admin navigation. Browser checks use `/usr/bin/chromium` (override `CHROMIUM_PATH` as needed), exercise sample organizer workflows, and check desktop/mobile navigation for JavaScript errors and horizontal overflow. They write screenshots to `/tmp`. No external browser download is required in this workspace.

For semantic acceptance once the model is available:

```bash
node tests/semantic.mjs
```

This checks the actual SBERT model, embedding dimensions, ranking relevance and model reporting. It fails if only the fallback is running.

See [docs/VALIDATION.md](docs/VALIDATION.md) for measured results, [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) for thesis traceability and [docs/ASSETS.md](docs/ASSETS.md) for asset attribution.

## Configuration and real deployment

`.env.example` documents supported variables. The Node API automatically reads `.env`; the Python service still uses its own terminal environment. Do not commit real credentials.

For real deployment, use a **new database**, `SEED_DEMO=false`, a private `DATABASE_URL`, an HTTPS reverse proxy, and `COOKIE_SECURE=true`. These are concrete changes from the local demo, whose shared administrator password is public by design. Create the first administrator using `npm run admin:create` with `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` injected through your shell/environment. The script refuses to overwrite an existing account. Use a durable database volume and upload directory, and take restricted backups (the administrator export excludes password hashes and sessions). The optional `compose.yaml` starts a standalone MySQL instance using your `MYSQL_PASSWORD`; do not run it alongside the local script's container on the same port.

Online payments, a native mobile app, streaming/social integrations, and behavioral collaborative filtering are future work in the thesis and are not implemented. There is no payment checkout. The in-scope messaging module uses polling, rather than claiming real-time WebSocket delivery.

No public deployment or new-environment snapshot restoration has been verified.
