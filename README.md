# Unified Inbox API

[![CI/CD](https://github.com/JavierVargas0112/unified-inbox-api/actions/workflows/ci.yml/badge.svg)](https://github.com/JavierVargas0112/unified-inbox-api/actions/workflows/ci.yml)
[![CodeQL](https://github.com/JavierVargas0112/unified-inbox-api/actions/workflows/codeql.yml/badge.svg)](https://github.com/JavierVargas0112/unified-inbox-api/actions/workflows/codeql.yml)

A hotel receives guest messages by email, SMS and WhatsApp, and answers them from three
different tools. This API puts them in **one inbox**: every incoming message lands in a
single conversation model, linked to the right guest, and the reply goes back on the
channel the guest used.

**Stack:** TypeScript · NestJS · PostgreSQL · TypeORM · Jest · Docker · GitHub Actions · Render

## What it does

```
 Postmark ─┐                 ┌───────────────┐
 Twilio  ──┼─► /webhooks/* ─►│ channel        │──► InboundMessage ─► customer ─► conversation ─► message
 WhatsApp ─┘                 │ adapters       │       (one shape)     (email or    (open thread    (idempotent on
                             └───────────────┘                        E.164 phone)  per channel)    provider id)

 GET  /conversations                 unified inbox, every channel, latest activity first
 GET  /conversations/:id             one thread, oldest message first
 POST /conversations/:id/replies     reply on the original channel, within its limits
 PATCH /conversations/:id            close / reopen
```

Design choices worth reading in the code:

- **One model for every channel.** Each provider has an adapter
  ([`src/ingestion/adapters`](src/ingestion/adapters)) that turns its payload into the same
  `InboundMessage`. Adding a channel means adding an adapter; nothing downstream changes.
- **One guest across channels.** Phone numbers are normalised to E.164, so
  `+33 6 12 34 56 78` by SMS and `33612345678` on WhatsApp are the same customer.
- **Webhook retries are harmless.** Providers re-send on timeouts; messages are unique on
  `(channel, external_id)` and inserted with `ON CONFLICT DO NOTHING`, so a retry returns the
  original message instead of a duplicate.
- **Channel limits are enforced before sending.** An SMS reply is counted in GSM-7 or UCS-2
  segments the way carriers bill it ([`channel-rules.ts`](src/outbound/channel-rules.ts)).
- **Providers sit behind one interface.** `OutboundSender` is the only thing that would talk
  to Twilio, WhatsApp or SMTP; the default implementation logs, so the API runs without
  credentials.

## Pipeline

```
 push / PR ──► quality ─────────────┐
               format · lint ·      │
               typecheck · build    ├──► image ─────────────────────────────► deploy (main only)
                                    │    docker build · smoke test with a      Render deploy hook,
 push / PR ──► test ────────────────┘    real PostgreSQL · Grype scan          then wait for /health
               migrations on empty DB ·  (fails on fixable high/critical) ·
               schema drift check ·      push to GHCR (main only)
               unit + e2e · coverage ≥ 90%

 CodeQL (security-extended) on every push and weekly · Dependabot for npm, Actions and Docker
```

| Gate | What it catches |
|---|---|
| `format:check`, `lint`, `typecheck` | style drift, unsafe `any`, floating promises, type errors |
| `migration:run` on an empty database | a migration that does not apply from scratch |
| `schema:check` | an entity changed without its migration |
| `test:ci` | unit tests (adapters, phone normalisation, SMS segments) and e2e tests against PostgreSQL; fails under 90% merged coverage |
| container smoke test | an image that builds but does not start or reach its database |
| Grype scan | fixable high/critical vulnerabilities in the image |
| CodeQL | injection and other security patterns in the TypeScript code |

`main` is protected: a pull request merges only when `quality`, `test` and `image` are green.

## Run it locally

```bash
docker compose up --build          # API on :3000, PostgreSQL on :5432
open http://localhost:3000/docs    # Swagger UI
```

Or without Docker for the API:

```bash
npm ci
cp .env.example .env               # point DATABASE_URL at a PostgreSQL 16
npm run start:dev
```

Try it:

```bash
curl -X POST localhost:3000/webhooks/sms \
  -d 'MessageSid=SM1' -d 'From=+33612345678' -d 'Body=Can I check in late?'
curl localhost:3000/conversations
```

## Tests

```bash
npm test                                   # unit tests, no database
DATABASE_URL=postgres://... npm run test:e2e   # e2e against PostgreSQL
DATABASE_URL=postgres://... npm run test:ci    # both, with the coverage gate CI uses
```

## Deployment

`render.yaml` creates the web service (Docker) and a PostgreSQL database on Render, with
auto-deploy **off**: deploys come only from the pipeline. To enable it:

1. Create the Blueprint from this repository in Render.
2. Copy the service's *Deploy Hook* URL into the repository secret `RENDER_DEPLOY_HOOK_URL`.
3. Set the repository variable `RENDER_SERVICE_URL` (e.g. `https://unified-inbox-api.onrender.com`)
   so the pipeline waits for the new version's `/health`.

Without the secret, the deploy job is skipped with a warning and the rest of the pipeline runs.

## Not in scope (yet)

Real provider clients (Twilio, WhatsApp Cloud API, SMTP), webhook signature verification,
authentication of the inbox API, and the AI reply suggestions that a hotelier would see next
to each message.
