# Savta Gallery

A public, museum-style archive of Bluma Swhartzberg Kamin's paintings, with a
phone-friendly admin so she can add her own work. Hebrew throughout, RTL.

Full specification: **[PLAN.md](PLAN.md)** · Working notes: **[CLAUDE.md](CLAUDE.md)**

## Local development

```bash
npm install
npm run hash -- "artist password" "admin password"   # → paste into .env.local
npm run db:migrate
npm run db:seed                                       # sample Hebrew paintings
npm run dev                                           # http://localhost:3000
```

> **The `$` in an argon2 hash must be backslash-escaped in `.env.local`.**
> Next runs dotenv-expand over `.env` files, and `$argon2id$v=19$m=…` otherwise
> expands away to a value no password can ever match — a login that fails with
> no visible reason. `npm run hash` prints the escaped form for you. Portainer's
> env panel does no expansion, so paste the **raw** value there.

The password itself selects the role: one value logs in as `artist`, the other
as `admin`. Don't set them to the same string.

## Commands

| | |
|---|---|
| `npm run dev` / `build` / `start` | the app |
| `npm run lint` / `typecheck` | checks |
| `npm run db:migrate` / `db:seed` / `db:reset` / `db:studio` | database |
| `npm run db:seed-demo` | 20 demo paintings, generated images, for looking at the gallery |
| `npm run db:seed-demo -- --clear` | remove them again |
| `npm run hash` | generate `SESSION_SECRET` and password hashes |
| `npm run icons -- [image]` | PWA icons (defaults to a placeholder mark) |
| `npm run test:session -- 5` | synthetic digitization session for testing |
| `npm run import -- <dir> [--dry-run]` | bulk import (PLAN.md §11) |

## Deploying to the home server

Every push to `main` builds and publishes to GHCR as
`ghcr.io/<owner>/<repo>:latest`. Portainer **pulls that image** — it does not
build on the server.

### 1. Portainer stack

**Stacks → Add stack → Web editor**:

```yaml
services:
  web:
    image: ghcr.io/omer182/savta-gallary:latest
    ports:
      - "127.0.0.1:3006:3000"
    environment:
      - DATA_DIR=/data
      - SESSION_SECRET=${SESSION_SECRET}
      - ADMIN_PASSWORD_HASH=${ADMIN_PASSWORD_HASH}
      - ARTIST_PASSWORD_HASH=${ARTIST_PASSWORD_HASH}
    volumes:
      - /srv/savta-gallery/data:/data
    restart: unless-stopped
```

Put the three secrets in the stack's **Environment variables** panel, not in
the YAML — raw, with no quotes and no backslashes.

If the package is private, add a registry credential in Portainer
(**Registries → GitHub**) using a PAT with `read:packages`.

### 2. nginx

`deploy/nginx.example.conf` is a reference for the vhost. The parts that matter:
`client_max_body_size 50m` (uploads 413 without it), derivatives served straight
off disk with an immutable cache header, and no caching on `/admin`, `/api` or
`/login`.

**Originals are deliberately not served by nginx.** They are the uncropped
frames — for imported paintings they still show the wall and the numbered
sticky note — and the app gates them behind an admin session. Serving them from
disk would bypass that.

### 3. Updating

Push to `main`, wait for the Action, then **Stacks → savta-gallery → Pull and
redeploy**. Migrations run automatically on container start.

### 4. Standing up a demo wall

A fresh `/data` is empty, so the gallery has nothing to show. To fill it with
twenty generated paintings — five subjects, five media, proportions from a
150cm panorama to a tall upright — open the container console:

```
Portainer → Containers → savta-gallery → Console   (/bin/sh)
node dist/scripts/seed-about.mjs
node dist/scripts/seed-demo.mjs
```

Every demo row is marked `provenance_note = 'demo-seed'`, and
`node dist/scripts/seed-demo.mjs --clear` removes exactly those and nothing
else — real paintings entered by hand are never touched. Add `--count 120` to
repeat the catalogue if you want to feel the paging.

The images are generated, not photographs, but they go through the same
pipeline as a real upload, so the derivatives, thumbhashes and sizes are
genuinely what the gallery will be working with.

## Everything lives in `/data`

```
/data
  db/gallery.db        SQLite — paintings, images, tags, FTS index
  images/originals/    archival originals, never modified
  images/derived/      AVIF/WebP/JPEG, content-hashed
  import/<date>/       digitization sessions (PLAN.md §11)
```

Back this up and you have backed up the site. Off-site backup is deliberately
**deferred** (PLAN.md §7) — decide it before the archive is treated as the
system of record, because these files cannot be recreated.

## Bulk import

Photos named by number plus a `manifest.csv` with a matching `num` column.
Run it **on the server** — SQLite over a network share breaks file locking:

```
Portainer → Containers → savta-gallery → Console
node dist/scripts/import.mjs /data/import/2026-09-06 --dry-run
```

Always dry-run first: it reports cluster/row mismatches by number before
anything is written. Then `/admin/import/crop`, then `/admin/import/stories`.
