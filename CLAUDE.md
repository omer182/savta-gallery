# CLAUDE.md — Savta Gallery

Public museum-style gallery + phone-friendly admin for my grandmother's 50+ years of
paintings. Full spec: **[PLAN.md](PLAN.md)**. Visual prototype: **`gallery-mock.jsx`**
(static, throwaway — real app is Next.js).

## What this is

- **Public**: masonry gallery, per-painting page with a long story, About, hidden search,
  tag chips. Published paintings only.
- **Admin**: two users — `admin` (full) and `artist` (grandmother; no publish, no delete).
  No dashboard, no giant button: a logged-in artist just gets an `ADD PAINTING` item in
  the normal site topbar (`admin` also gets `MANAGE` → `/admin`). Admin screens stay in
  the site's design system — warm paper, serif — just single-column and finger-friendly.
- **"Add a painting" is the core flow**: pick photo → **full-screen crop** (drop the wall)
  → fields → Save as draft. Autosave to localStorage, client-side HEIC→JPEG + resize,
  progress bar.
- Login: one `/login` field — the password picks the role (argon2id env-var hashes,
  HMAC httpOnly cookie, 365-day rolling for artist / 30-day admin, rate-limited). PLAN.md §3.
- Gallery/tag/search views are **paginated** (~48/page, up to ~500 paintings).

## Stack

Next.js (App Router) · SQLite + Drizzle + FTS5 · local FS image storage · sharp
derivatives (AVIF/WebP 400/800/1600/2400 + JPEG 1600) · thumbhash blur-up ·
hand-rolled cookie auth (argon2id hashes, single-field password → role) · GitHub Actions builds & pushes the image to
**GHCR** on push to `main`; Portainer stack **pulls the pre-built image** (`Pull and
redeploy`), no build on the server — same pattern as the sibling `storytime` repo ·
containerised Linux home server alongside Plex/*arr · `web` on `127.0.0.1:3006` · domain
`bluma.omersher.com`, nginx + Cloudflare owned by the user. State = `/data` (db file +
images); off-site backup deferred.

## Non-negotiables

- Design system in PLAN.md §2 is **locked**. Warm paper `#F7F4EE`, ink `#1C1A15`,
  Cormorant Garamond for display, Karla for UI. The site disappears; paintings are the
  design. Never crop paintings to uniform aspect ratios.
- Never modify original uploads. Strip EXIF from public derivatives.
- `dir="auto"` on all user-entered text (Hebrew / RTL expected).
- Respect `prefers-reduced-motion`. Responsive to 360px.
- Nothing the `artist` role does can break the public site or lose typed text.
- Content-hashed derivative URLs → `Cache-Control: immutable`. Admin + API routes uncached.

## Digitization

~500 paintings get photographed at her house and bulk-imported once, via a CLI script +
an `/admin/import-review` queue — **not** a shipped batch-upload UI. Facts are typed live;
her **stories are always recorded** (one memo per painting) and transcribed with local
Whisper, then corrected by hand. Photos match rows by EXIF-gap clustering, verified by a
numbered sticky note visible in every frame. Protocol, kit, import format: PLAN.md §11.
The photography does not wait for the software.

Content will be **Hebrew** — `dir="auto"` everywhere, Frank Ruhl Libre paired with
Cormorant. Whether the site is Hebrew-only or bilingual is still open (PLAN.md §12).

## Commands

`npm run dev` · `build` · `lint` · `typecheck` · `db:migrate` · `db:seed` · `db:reset` · `db:studio`

## Status

**Build step 1 (scaffold) done.** Next.js 16 (App Router, TS, no Tailwind — the design
system is bespoke CSS), Drizzle + better-sqlite3, schema + migrations + Hebrew seed data,
RTL root layout with self-hosted Frank Ruhl Libre + Assistant. Build/lint/typecheck green.

Notes for whoever picks this up:
- **better-sqlite3 is pinned to `^12`** — v13.0.3's Windows prebuild segfaults on Node 22.
- Public pages are `force-dynamic` for now. **Step 2 should move them to ISR +
  `revalidatePath()` on publish**, which is what §9 wants behind Cloudflare.
- `outputFileTracingExcludes` keeps `./data` out of the standalone build; without it the
  dev DB is baked into the image and shadows the `/data` mount.

Next: build step 2 — the public gallery, matching the RTL mock. PLAN.md §8.
