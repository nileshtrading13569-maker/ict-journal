# Deploying this app (GitHub → Vercel + Postgres)

The code is already on GitHub:

```
https://github.com/nileshtrading13569-maker/ict-journal
```

`main` is the production branch. Deploying means connecting that repo to a host
(Vercel) and giving it a real Postgres database (Neon). The app's schema is
applied automatically during the build — there is no manual SQL step.

> The app lives in the **`FUll ICT Concept -grok-workspace`** folder, not at the
> repo root. When a host asks for the project/root directory, use that folder.

---

## 1. Create the database (Neon, free)

1. Go to <https://neon.com> (or `neon.tech`) and sign in.
2. **Create project** → pick any region near you → create.
3. Copy the **connection string**. Use the **pooled** one (its host contains
   `-pooler`), it looks like:

   ```
   postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
   ```

That string is your `DATABASE_URL`. Keep it private — never commit it.

Tables (`user`, `session`, `account`, `verification`, `user_desk_state`) are
created by `migrations/*.sql` through `npm run build` → `scripts/migrate.mjs` on
every deploy. Applied files are recorded in `_migrations` and never run twice.

---

## 2. Import the repo into Vercel

1. Go to <https://vercel.com/new>.
2. **Import Git Repository** → choose `ict-journal`.
3. Configure the project:

   | Setting | Value |
   | --- | --- |
   | **Root Directory** | `FUll ICT Concept -grok-workspace` ← **required** |
   | Framework Preset | `Vite` (or `Other` — the build emits Vercel's own output) |
   | Install Command | `npm install` |
   | Build Command | `npm run build` |
   | Output Directory | leave empty / default |

If you skip the Root Directory you'll get “No package.json found”, because the
repo root is only a wrapper folder.

---

## 3. Environment variables

Add these in **Project → Settings → Environment Variables** for **Production**
(and **Preview**):

| Name | Value | Required |
| --- | --- | --- |
| `DATABASE_URL` | Neon pooled connection string | **Yes** |
| `BETTER_AUTH_SECRET` | long random string, 32+ characters | **Yes** |
| `BETTER_AUTH_URL` | `https://your-project.vercel.app` (exact origin, no trailing slash) | Recommended |
| `VITE_AUTH_ENABLED` | `true` | Recommended |
| `AUTH_COOKIE_SECURE` | `true` | Optional (automatic on Vercel) |
| `GOOGLE_CLIENT_ID` | your own Google OAuth client id | Optional (see below) |
| `GOOGLE_CLIENT_SECRET` | your own Google OAuth client secret | Optional (see below) |

Generate a secret in PowerShell:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

Notes:

- `BETTER_AUTH_URL` is optional on Vercel: each deployment derives its origin from
  the request's own host (so `project.vercel.app`, preview URLs, and a custom
  domain all keep the OAuth callback on the host the visitor is actually using).
  Set it to your canonical `https://` origin when you want that as the fixed
  fallback.
- `VITE_AUTH_ENABLED` is baked into the client at build time; changing it
  requires a redeploy. Never set it to `false` on a real deployment.
- Never add a `.env` file to the repo — Vercel stores these values.

---

## 3b. Google sign-in on your own domain (recommended)

Out of the box the **Google** / **X** buttons federate through Grok's shared auth
broker. The broker is built for the Grok sandbox and its OAuth client is
registered for Grok hosts, so on your own domain it can end on the broker's
`state_mismatch` page or with `{"message":"Invalid redirect URI"}`. Google
sign-in becomes fully yours (no broker) once you supply a Google OAuth client:

1. <https://console.cloud.google.com/apis/credentials> → **Create credentials**
   → **OAuth client ID** → **Web application**.
2. **Authorized JavaScript origins**
   - `https://your-project.vercel.app`
   - `http://localhost:8080` (only if you test locally)
3. **Authorized redirect URIs** (must match exactly)
   - `https://your-project.vercel.app/api/auth/callback/google`
   - `http://localhost:8080/api/auth/callback/google`
4. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel → **Redeploy**.
5. The login screen detects them automatically (`/api/auth-config`) and switches
   the Google button to the first-party flow. X keeps using the broker.

Using a custom domain? Register that origin + callback in Google Cloud too, and
set `BETTER_AUTH_URL` to it.

> The sign-in host must be the SAME host the callback is registered for. Vercel
> preview deployments (`*-git-*.vercel.app`) derive their own origin, so a
> per-app or Google client registered for the production domain only will still
> reject them — use the production URL for account testing.

## 4. Deploy

1. Click **Deploy**. First build takes a few minutes.
2. Open the deployment URL.
3. Create an account → change **Account name** under Settings → wait for
   **Cloud saved** → refresh the page. The name must still be there.
4. Sign out, sign in again — the desk must come back.

Every push to `main` re-deploys production. Other branches get preview
deployments (their `*.vercel.app` hosts are trusted automatically for sign-in).

---

## 5. Custom domain (optional)

1. **Project → Settings → Domains** → add your domain and follow the DNS
   instructions.
2. Set `BETTER_AUTH_URL` to `https://yourdomain.com` (exact, no trailing slash).
3. Redeploy so the new value is picked up.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `No package.json found` | Root Directory not set to `FUll ICT Concept -grok-workspace` |
| Build fails connecting to Postgres | `DATABASE_URL` wrong/expired; copy a fresh pooled Neon string with `sslmode=require` |
| Sign-in says “Your session could not be started” / sessions vanish | `BETTER_AUTH_SECRET` missing (each serverless instance makes a new secret) or `BETTER_AUTH_URL` doesn't match the site origin |
| `Invalid origin` (403) | `BETTER_AUTH_URL` is not the exact `https://` origin in the browser address bar — fix it and redeploy |
| Broker page: “Sign-in couldn't be completed” / `state_mismatch` | The OAuth state cookie did not survive the round trip. Sign-in was started on one host and finished on another, took longer than 5 minutes, or the browser blocked the provider's cookie (private window, tracking protection, in-app browser). Use the production domain, one tab, finish within 5 minutes, and allow cookies for the provider. |
| App page: “Something went wrong / CODE: state_mismatch” | Same cause on this app's side: the callback host differs from the host where you started (check `BETTER_AUTH_URL` vs the address bar), or `BETTER_AUTH_SECRET` changes between serverless instances. The login screen now explains the code and lets you retry. |
| `{"message":"Invalid redirect URI"}` | The identity provider does not recognize the callback host. Open the deployment's main domain, set `BETTER_AUTH_URL` to that exact origin, and for Google configure the first-party client in §3b. |
| Google works in the Grok preview, not on my domain | Expected with the shared broker. Add `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (§3b). |
| Data not syncing after restart | `DATABASE_URL` missing → the app silently used its embedded local database, which is ephemeral on serverless. Set the Neon URL. |
| Login works locally, not deployed | Expected before step 3: local dev uses an embedded database; deployed needs `DATABASE_URL` + `BETTER_AUTH_SECRET`. |

Useful Vercel log lines: `[auth] ...`, `[migrate] applied ...`, `[db] ...`.
