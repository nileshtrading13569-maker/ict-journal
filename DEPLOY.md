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

Generate a secret in PowerShell:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

Notes:

- If `BETTER_AUTH_URL` is omitted, the app derives it from Vercel's own
  `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` variables. Set it explicitly
  when you add a custom domain.
- `VITE_AUTH_ENABLED` is baked into the client at build time; changing it
  requires a redeploy. Never set it to `false` on a real deployment.
- Never add a `.env` file to the repo — Vercel stores these values.

---

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
| Data not syncing after restart | `DATABASE_URL` missing → the app silently used its embedded local database, which is ephemeral on serverless. Set the Neon URL. |
| Login works locally, not deployed | Expected before step 3: local dev uses an embedded database; deployed needs `DATABASE_URL` + `BETTER_AUTH_SECRET`. |

Useful Vercel log lines: `[auth] ...`, `[migrate] applied ...`, `[db] ...`.
