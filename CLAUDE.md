# CLAUDE.md — Savta Gallery

Public museum-style gallery + phone-friendly admin for Bluma Swhartzberg Kamin's 50+ years
of paintings. Full spec: **[PLAN.md](PLAN.md)**.

Visual target: the **Hebrew RTL mock** —
`https://claude.ai/code/artifact/f0b95667-9775-4d42-a7cb-286ecbb48017`.
(`gallery-mock.jsx` was the original English prototype and is superseded.)

## What this is

- **Public**: masonry gallery, per-painting page with her story set large, About page,
  `/search` as its own page, scrolling tag strip. Published paintings only, ~48/page.
- **Admin**: two users — `admin` (full) and `artist` (grandmother; no publish, no delete).
  No dashboard, no giant button: a logged-in artist gets one extra nav item, `הוספת ציור`
  (`admin` also gets `ניהול` → `/admin`). Admin screens stay inside the site's design
  system — warm paper, serif — just single-column and finger-friendly.
- **"Add a painting" is the core flow**: pick photo → **full-screen crop** (drop the wall)
  → fields → save as draft. Autosave to localStorage, client-side HEIC→JPEG + resize,
  background upload that starts at crop-confirm so saving feels instant.
- Login: one `/login` field — the password picks the role (argon2id env-var hashes,
  HMAC httpOnly cookie, 365-day rolling for artist / 30-day admin, rate-limited). §3.

## Stack

Next.js 16 (App Router, TS, **no Tailwind** — the design system is bespoke CSS) · SQLite +
Drizzle + FTS5 · local FS image storage · sharp derivatives (AVIF/WebP 400/800/1600/2400 +
JPEG 1600) · thumbhash blur-up · hand-rolled cookie auth.

Deploy: GitHub Actions builds and pushes to **GHCR** on push to `main`; the Portainer stack
**pulls the pre-built image** (no build on the server) — same pattern as the sibling
`storytime` repo. `web` on `127.0.0.1:3006`, domain `bluma.omersher.com`, nginx +
Cloudflare owned by the user. All state is `/data` (db + images); off-site backup deferred.

## Non-negotiables

- Design system in PLAN.md §2 is **locked**. Warm paper `#F7F4EE`, ink `#1C1A15`, umber
  `#6E5A3A`. The site disappears; the paintings are the design.
- **The whole site is Hebrew and RTL** — chrome included, not just content. Type is
  **Frank Ruhl Libre** (display + story) and **Assistant** (UI). Cormorant Garamond and
  Karla are **retired**: neither ships Hebrew glyphs. Hebrew has no uppercase, so build
  label hierarchy from size/weight/colour, and cap tracking at ~`.02em`.
- Use **logical CSS properties** (`inset-inline-start`, `padding-inline`, `text-align:
  start/end`). Nothing pinned to a physical side. `dir="auto"` on user-entered text.
- Masonry is **CSS Grid row-spans**, never `columns` — `columns` fills column-by-column and
  scrambles `sort_order`. 2 cols on phones, 3 from 640px.
- **No caption under a tile** — the label lives ON the canvas. It is **always visible on
  touch** and hover-revealed on a mouse; either way it is `pointer-events: none`, because
  a tap anywhere on a tile opens the painting. No first tap ever means anything else.
- Grid cards are real `<a href>` — keyboard reachable, crawlable, visible focus ring.
- **One painting, one image.** No multi-image UI anywhere — no thumbnail strip on the
  painting page, no second upload in the editor. Enforced in `attachImages()`: the
  first id wins and a new photograph detaches the old one (PLAN.md §5).
- Never modify a stored original. Strip metadata from public derivatives.
- Content-hashed derivative URLs → `Cache-Control: immutable`. Admin + API routes uncached.
- Respect `prefers-reduced-motion`. Responsive to 360px.
- Nothing the `artist` role does can break the public site or lose typed text.

## Digitization

~500 paintings photographed at her house and bulk-imported once, via a CLI script plus two
`/admin/import/*` review passes — **not** a shipped batch-upload UI. Facts typed live; her
**stories are always recorded** (one memo per painting), transcribed with Whisper **on the
Mac**, corrected by hand. Photos match rows by EXIF-gap clustering, verified by a numbered
sticky note visible in every frame. Shoot **JPEG, not HEIC** — sharp cannot decode HEIC and
the importer has no browser to convert in.

The importer runs **on the home server** (SQLite over a network share corrupts), and
**defers derivative generation until after the crop pass** — imported photos still contain
wall and sticky note. Protocol, kit, import format: PLAN.md §11. The photography does not
wait for the software.

## Commands

`npm run dev` · `build` · `lint` · `typecheck` · `db:migrate` · `db:seed` · `db:reset` · `db:studio`

## Status

**Build step 1 (scaffold) done.** Drizzle schema + migrations + FTS5 triggers + Hebrew seed
data, RTL root layout with self-hosted fonts. Build/lint/typecheck green.

Gotchas worth keeping:
- **better-sqlite3 is pinned to `^12`** — v13.0.3's Windows prebuild segfaults on Node 22
  despite declaring `engines: node >=22`.
- Public pages are `force-dynamic`. **Step 2 should move them to ISR + `revalidatePath()`
  on publish**, which is what §9 wants behind Cloudflare.
- `outputFileTracingExcludes` keeps `./data` out of `.next/standalone`; without it the dev
  DB is baked into the image and shadows the `/data` mount.
- FTS5 tokenizes Hebrew correctly (word, prefix, phrase) — verified, not assumed.

Next: build step 2 — the public gallery, matching the RTL mock. PLAN.md §8.
