# PACKOUT STL API (`server/`)

A tiny stateless HTTP service that turns a project into an STL — the backend
piece from `docs/ARCHITECTURE.md`. It wraps the **shared core** (`../src/core`)
with **no logic of its own**: parse project → resolve container → `validateLayout`
→ `exportInsertSTL`. Because the response is a pure function of the request body,
it caches trivially and scales to zero.

**You do not need this to use the web app or the iOS app** — both generate STLs
locally. This service exists for the one thing a client can't do alone:
**emailing the finished STL** (`POST /v1/stl/email`).

Status: written, typechecks, **not deployed anywhere yet**.

## Endpoints

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/v1/health` | — | `{ ok: true }` |
| GET | `/v1/containers` | — | bundled container library (id, name, cavity) |
| POST | `/v1/stl` | `{ project, override? }` | `200` binary STL, or `400/404/422` JSON with `issues` |
| POST | `/v1/stl/email` | `{ project, email, override? }` | `200 { ok, sentTo }`, `501` if mail isn't configured |

`project` is a project JSON (schema v1 — see `docs/DATA-MODEL.md`); it carries its
own `containerId`. `override` is optional `{ x_mm, y_mm, z_mm, verified }` for a
container whose cavity isn't in the library yet.

```bash
curl -sS -X POST localhost:8787/v1/stl \
  -H 'content-type: application/json' \
  --data '{"project": <project.json>}' \
  -o insert.stl
```

## Run it

```bash
cd server
npm install          # needs ../node_modules too — run `npm install` at the repo root first
npm run dev          # tsx watch, http://localhost:8787
```

The core in `../src` imports `zod`; it resolves from the repo-root `node_modules`
(the web app depends on it) or `server/node_modules`. `server/tsconfig.json` maps
it for `tsc`.

## Email delivery

Off by default — the endpoint returns `501` until you point it at your own mail
provider's SMTP (no account is created for you):

```bash
export SMTP_URL='smtps://user:pass@smtp.your-provider.com'
export MAIL_FROM='PACKOUT Designer <no-reply@yourdomain.com>'
```

`nodemailer` is loaded lazily only when `SMTP_URL` is set.

## Deploy targets (later)

The app is a standard `Hono` fetch handler, so it drops onto:

- **Node** (any host / a container) via `@hono/node-server` — `npm start`.
- **Cloudflare Workers / Vercel / Deno Deploy** — swap the `@hono/node-server`
  bootstrap in `src/index.ts` for that platform's adapter; the routes are
  unchanged. (`nodemailer` is Node-only — on Workers use an HTTP email API
  instead.)

A `Dockerfile` and a chosen host are the next step; not done here because it
touches account/billing setup.
