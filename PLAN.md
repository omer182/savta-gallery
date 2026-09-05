# Savta Gallery — Product & Technical Plan

A digital archive and public gallery for my grandmother's paintings (flowers, animals,
landscapes — 50+ years of work). Public visitors browse the gallery and read the story
behind each painting. Two people manage content: me (`admin`) and my grandmother
(`artist`), through a deliberately simple, phone-friendly admin flow.

Self-hosted on my home server (existing nginx), behind Cloudflare, single Docker Compose
deployment. "Savta" (סבתא) = grandmother.

---

## 1. Product Overview

### Public site (visitors)

- **Gallery homepage** — masonry grid of paintings. No hero section, no marketing copy:
  artist name, one subtitle line, then the work. Library is expected to reach ~500
  paintings, so the grid is **paginated** (~48 per page): server-rendered pages at
  `/?page=n` for crawlability, progressively enhanced into "load more" / infinite scroll
  that appends the next page. Tag and search views paginate the same way.
- **Painting page** — large image, museum-style placard (title, year, medium, dimensions),
  the painting's story in long-form text, tags, additional images (detail shots, framed,
  in-progress), prev/next navigation.
- **About page** — artist portrait, her story, studio photos. Editable content (markdown).
- **Search** — **its own page** at `/search`, not an overlay on the gallery or About. The
  page contains only a large input and its results; the tag row belongs to the gallery and
  does not appear here. Full-text across titles, stories, and tags, results updating live
  as she types (only the results block re-renders, so the field keeps focus and cursor
  position). Gallery filters by tag only; search filters by query only.
- **Tag filtering** — quiet horizontal row of text chips above the grid.
- Only **published** paintings are visible publicly. Drafts and hidden paintings never
  appear.

### Admin (me + grandmother)

- Single login page, two users: `admin` (full access) and `artist` (grandmother — can add
  and edit her own drafts; cannot publish or delete). Login mechanism: §3.
- **No separate "admin dashboard" for the artist.** When logged in, she sees the normal
  public site with **one extra nav item in the topbar: `הוספת ציור`** (same quiet style as
  `גלריה · אודות · חיפוש`). That is her entire entry point — she never sees `/admin`.
  `admin` additionally gets `ניהול` → `/admin` (review queue, all paintings, pages, tags).
- **The "Add a painting" flow is the core product.** It shares the site's visual language
  — warm paper, serif headings — just laid out as a single focused column with roomy
  fields and comfortably large tap targets. Not a high-contrast utilitarian panel.
  1. Photo picker opens via `<input type="file" accept="image/*">` (native iOS photo
     picker).
  2. Large preview of the selected photo.
  3. **Crop step** — before any metadata, a full-screen cropper over the photo so she can
     drag a box down to just the painting and drop the wall / floor / hand holding it.
     Free aspect ratio (paintings are not uniform), pinch-zoom and drag on touch, a
     "straighten" slider is a nice-to-have. The cropped result is what gets uploaded and
     stored as the image of record — the uncropped camera frame is **not** kept. Capture
     date / camera is read from the original EXIF *before* cropping and sent alongside so
     it survives.
  4. Fields: title, year, medium (optional), "Tell the story of this painting" (big
     textarea), tags as tap-to-select chips from existing tags (free-text tag creation for
     admin only).
  5. One "Save" button. Saves as **draft**.
- **Draft / publish workflow** — artist saves drafts; admin has a review queue and
  publishes. Admin can also create/publish directly.
- **No destructive actions for artist role** — no delete button, "hide" only. Admin can
  delete.
- **Autosave** — form state persists locally (localStorage) as she types, restored if the
  tab reloads mid-edit.
- **Resilient uploads** — client-side pipeline before upload: HEIC → JPEG conversion,
  apply the crop, downscale to max 3000px longest edge; then a real progress bar and a
  clear "processing" state while derivatives generate.
- Admin can also: edit any painting, manage additional images per painting, reorder the
  gallery (`sort_order`), edit the About page, manage tags.
- **Import review** (admin only) — two separate passes over the bulk-import backlog (§11),
  because their throughput differs by orders of magnitude. **Crop pass:** a contact sheet of
  auto-detected crop rectangles, confidence-sorted, bulk-approvable. **Story pass:**
  sequential, audio + editable transcript, one painting per screen.
- **PWA** — installable to iPhone home screen with a custom icon (a crop of one of her
  paintings); opens to `/admin/add` when a logged-in artist launches it.

### Explicitly out of scope

- No sales / e-commerce.
- No batch upload **UI** — the ongoing product is one painting per session. Seeding the
  archive from the digitization sessions is a one-time migration handled by a CLI import
  script (§11), not a shipped feature.
- No comments, visitor accounts, or newsletters.

---

## 2. Design System (locked — do not reinterpret)

Based on `gallery-mock.jsx`. Minimal museum aesthetic.
**The site should disappear; the paintings are the design.**

### Tokens

| Role | Value |
| --- | --- |
| Background | warm paper `#F7F4EE` (pick one and use everywhere) |
| Ink (primary text) | `#1C1A15` |
| Muted text (captions, metadata) | `#8A8272` |
| Accent (links only, sparingly) | umber `#6E5A3A` |
| Card / placard surface | `#FFFEFA`, border `#E4DECF` |
| Shadows | soft, warm-tinted `rgba(40,32,20,0.06–0.12)` — never harsh black |

### Typography — Hebrew-first

The site is **Hebrew throughout** (§12), which replaces the original Latin pairing: both
Cormorant Garamond and Karla ship **zero Hebrew glyphs**, so neither can carry this site.

- **Display** (artist name, painting titles, stories): **Frank Ruhl Libre**, weights
  400–600. The canonical Hebrew serif; also covers Latin, so no second face is needed for
  years and dimensions.
- **UI / utility** (nav, captions, tags, admin): **Assistant**, weights 300–600.
- Stories are set LARGE in the serif (~21px, **line-height 1.85** — Hebrew needs more
  leading than Latin) at a ~600px measure. Reading her words is a primary experience.
- `<html dir="rtl" lang="he">`. Lay out with **logical properties**
  (`inset-inline-start`, `padding-inline`, `text-align: start/end`) so nothing is pinned to
  a physical side. Bidi handles mixed runs correctly when source order is logical — a
  placard written `1998 · שמן על בד` renders with the year at the right, as intended.
- **Hebrew has no uppercase**, so the "letterspaced uppercase label" device from the
  original mock does not exist here, and heavy tracking damages Hebrew word shapes (cap at
  ~`.02em`). Build the quiet-label hierarchy from **size, weight and colour** instead.
- Directional glyphs flip: back/previous points **→**, next points **←**.
- Self-host both fonts at build time. No runtime Google Fonts request.

### Signature element: the wall placard

Painting metadata rendered as a museum wall label — a small warm-white card with title
(serif) + year / medium / size (small sans, minimal tracking). It appears in **three**
places, and the third is not optional:

- On hover over grid items, rising softly from the frame's **inline-start** corner.
- Beside the painting on the detail page.
- **Always visible beneath every card on touch / small screens.** Hover does not exist on a
  phone, and the phone is the primary surface — a hover-only placard would delete the
  site's signature element for most visitors.

### Layout & motion

- Masonry via **CSS Grid with row-spans** computed from each image's stored aspect ratio —
  **not** CSS `columns`, which fills column-by-column and scrambles `sort_order`. Paintings
  sit in white "frames" (white padding + soft shadow). **Never crop paintings to uniform
  aspect ratios.**
- **2 columns on phones, 3 from 640px**, capped at ~1240px. One column makes 500 paintings
  an endless scroll; at ~160px wide a painting still reads as a composition.
- Grid cards are real `<a href>` elements — keyboard reachable, cmd-clickable, crawlable,
  with a visible `:focus-visible` ring. Never a click handler on a `<figure>`.
- Nav: `גלריה · אודות · חיפוש` for visitors. A logged-in artist also sees `הוספת ציור`;
  `admin` also sees `ניהול`. Same quiet style — nothing shouts.
- Tag row is a **single horizontally-scrollable strip** with scroll-snap and an edge fade,
  never wrapping — nine wrapped tags eat an entire phone screen before any art appears.
- Motion: blur-up image loading (thumbhash placeholders), gentle stagger on grid entry via
  IntersectionObserver (so it also covers "load more" pages, not just the first screen),
  subtle hover lift on pointer devices only. Respect `prefers-reduced-motion`.
- **Admin stays inside the same design system** — warm paper, serif headings, the same
  restraint. It is not a separate high-contrast utilitarian skin. The only concession to
  "admin-ness" is layout: the add / edit screens are a single focused column with roomy,
  finger-sized fields and one clear primary action, so it works one-handed on a phone.

### Reference mock

The current visual target is the **Hebrew RTL mock**
(`https://claude.ai/code/artifact/f0b95667-9775-4d42-a7cb-286ecbb48017`), which supersedes
the original `gallery-mock.jsx`. It implements everything above and is the thing to match.

- The procedural SVG "paintings" are a stand-in for real images and get deleted; the
  in-file `P` array becomes the database.
- Client-side filtering becomes server-driven (tag query + FTS5); the UI shape (scrolling
  tag strip, dedicated search page, empty-state copy) is the target.
- The mock's `role` toggle in the footer is a preview device only — the real nav derives
  from the session cookie.

---

## 3. Tech Stack

- **Next.js (App Router, latest stable)** — one app: public site (server components,
  cacheable) + admin (behind middleware auth). `next/image` with a **custom loader**
  pointing at pre-generated derivatives (not on-the-fly Next optimization).
- **SQLite + Drizzle ORM** — single file at `/data/db/gallery.db`. **FTS5** virtual table
  for search over title / story / tags, kept in sync via triggers or on write.
- **Local filesystem storage** — "originals" (the cropped, HEIC-decoded upload — see §4) at
  `/data/images/originals/`, derivatives at `/data/images/derived/`. Never modify a stored
  original after it lands.
- **sharp** for image processing. Its prebuilt binaries do **not** decode HEIC (libheif
  licensing), so HEIC → JPEG is done **client-side, always** — the server only ever
  receives JPEG / PNG / WebP. No custom sharp build, no libheif in the image.
- **Auth** — no auth library. One `/login` form with a **single password field, no
  username** — the password determines the role. Passwords stored as **argon2id hashes in
  env vars** (`ADMIN_PASSWORD_HASH`, `ARTIST_PASSWORD_HASH`), generated by a `npm run hash`
  script; never in the repo or DB. On success, set a signed **httpOnly, Secure,
  SameSite=Lax cookie** — `HMAC(SESSION_SECRET, { role, exp })` — with a **365-day rolling
  expiry for `artist`** (refreshed each visit, so she effectively never re-auths) and
  **30 days for `admin`**. `/login` is rate-limited in-app (~5/min per IP). Middleware
  gates `/admin/*` and every mutating API route; `role` gates publish / delete. Optional
  defense-in-depth: Cloudflare Access on `/admin` scoped to the admin's email only, cookie
  alone for the artist ADD flow. Passkey for `admin` is a later upgrade (§10).
- **Docker** — single Next.js standalone image, published to GHCR by CI, run as a
  one-service Portainer stack with a `/data` bind mount (see §7). Node 20+.
- Background processing for derivatives — simple in-process queue is acceptable
  (single-user upload volume); upload request returns fast, processing status is polled.

---

## 4. Image Pipeline

**Client-side, before upload** (see also §1 add-a-painting flow):

1. If HEIC/HEIF, decode to JPEG.
2. Read EXIF capture date / camera and hold it aside (crop will drop EXIF).
3. Apply the user's crop.
4. Downscale to max 3000px longest edge, encode JPEG ~q90.
5. Upload with a progress bar. This cropped JPEG is the "original" — the raw camera frame
   is never sent.

**Server, on upload:**

1. Store the received image untouched (content-hashed filename, e.g. `sha256[:16].jpg`).
   This is the archival original of record.
2. Persist the capture date / camera passed from the client into the DB — then **strip all
   metadata from every public derivative**.
3. Generate derivatives with sharp: **AVIF + WebP** at widths **400 / 800 / 1600 /
   2400px** (skip sizes larger than source). JPEG fallback at 1600px.
4. Extract intrinsic width / height; compute **thumbhash** for blur placeholder; store both
   in DB.
5. Derivative filenames are content-hashed → serve with
   `Cache-Control: public, max-age=31536000, immutable`.
6. Processing runs async after upload; the painting record shows a processing state until
   done.

Additional images (detail shots, framed, in-progress) go through the same client pipeline;
crop is optional for those.

**The bulk import differs deliberately** (§11). The web flow crops *before* upload, to save
her phone's bandwidth, so the uncropped frame never exists on the server. The CLI import
has the full frames on disk already, so it **stores them uncropped** and the crop is applied
later in the crop pass (`/admin/import/crop`). That makes the crop **non-destructive for the imported 500**
— the full frame, sticky note and all, is retained and any painting can be re-cropped at
any time.

Consequently **the import path must defer steps 3–5 above** (derivatives, thumbhash,
metadata-stripping) until after that crop is confirmed. Running them at import time would
produce derivatives of the uncropped frame, sticky note included. See §11.

---

## 5. Data Model

```
users          (optional — env-var users acceptable; if table used:)
               id, username, password_hash, role ('admin'|'artist')

paintings      id, slug (unique), title, year, medium, dimensions,
               story (markdown — Hebrew, from the transcript),
               title_en, story_en (nullable — no English yet, see §12),
               status ('draft'|'published'|'hidden'),
               provenance ('artist'|'sold'|'gifted'|'unknown'),  -- private, never public
               provenance_note (free text, private),
               audio_path (nullable — her recorded telling, see §11),
               needs_crop, needs_review (bool, set by the importer),
               sort_order, created_by, created_at, updated_at

images         id, painting_id (FK), original_path, original_hash,
               width, height, thumbhash, exif_json,
               is_primary (bool), sort_order, processing_status,
               created_at

tags           id, name, slug (unique)

painting_tags  painting_id (FK), tag_id (FK), PK(painting_id, tag_id)

pages          slug (PK, e.g. 'about'), title, body (markdown), updated_at

paintings_fts  FTS5(title, story, tags_text) — synced on write
```

Notes:

- A painting has many images; exactly one `is_primary` (grid + social image).
- **Slug = short id + Hebrew suffix**, e.g. `a7f3-הסירה-הכחולה`. The id (4–6 base36 chars,
  generated once at insert) is the identity; the suffix is derived from the title and is
  cosmetic. **Routing resolves on the id prefix alone** — so renaming a painting changes
  the suffix without breaking any existing link, and a request with a stale or absent
  suffix still resolves (canonical-redirect to the current form).
- `status = 'hidden'` is the artist-safe alternative to delete.
- `provenance` is **private admin bookkeeping** — where the painting physically is now. It
  is never rendered on the public site and never exposed by the API to unauthenticated
  requests.
- `audio_path` points at the archived recording of her telling that painting's story
  (§11). Not published in v1; the story text is what visitors read.
- `needs_crop` / `needs_review` are set by the importer and cleared by
  the crop and story passes respectively, so each knows what is left.
- `title_en` / `story_en` are nullable and unused in v1. They exist now purely so adding an
  English version later is not a migration. Whether English is wanted at all: §12.

---

## 6. Routes

**Public**

- `/` — gallery grid (published only), optional `?tag=` filter, `?page=n` pagination
  (~48/page)
- `/painting/[slug]` — painting page. Slug is `<id>-<hebrew-title>`
  (e.g. `a7f3-הסירה-הכחולה`); resolved on the id prefix, canonical-redirects if the suffix
  is stale or missing.
- `/about` — about page
- `/search?q=&page=n` — search results (also used by live search)
- `/images/[...path]` — derivative serving (or direct nginx location)

**Admin** (all behind auth middleware, `role` checked)

- `/admin` — **admin only**: review queue, all paintings, pages, tags. The artist never
  lands here; her nav item points straight at `/admin/add`.
- `/admin/add` — the grandmother flow (both roles)
- `/admin/paintings/[id]` — edit painting, manage images, publish / hide / delete
  (delete: admin only)
- `/admin/import/crop` — contact sheet of auto-detected crops, confidence-sorted,
  bulk-approvable (admin only, §11)
- `/admin/import/stories` — sequential audio + transcript review (admin only, §11)
- `/admin/about` — edit about page
- `/login` — single password field (password → role); redirects to `/admin/add` for
  `artist`, `/admin` for `admin`

**API** (route handlers) — upload endpoint (multipart, 50MB limit), processing-status
endpoint, CRUD for paintings / tags / pages, login / logout.

---

## 7. Deployment (home server)

**Environment.** Linux home server, everything runs in containers managed via **Portainer**
alongside Plex, the *arr stack, and many other apps. nginx and Cloudflare are already set
up and owned by me — this project only ships its own container(s).

**Domain.** `bluma.omersher.com` (Bluma — the artist). DNS + nginx vhost + Cloudflare
config are done by me by hand; the project does not touch them.

**CI / deploy workflow** (same pattern as the `storytime` project):

- Repo hosted on GitHub (`github.com/omer182/savta-gallary`).
- **`.github/workflows/docker-build.yml`** — on push to `main`/`master` (and `v*` tags),
  build the image with Buildx and push to **GHCR**: `ghcr.io/omer182/savta-gallary`,
  tagged `latest` + short SHA + semver. GHA layer cache.
- **`.github/workflows/pr-checks.yml`** — on PR: `next lint` + `tsc --noEmit` + `next build`
  + a no-push Docker build test.
- **Portainer** runs a plain Compose stack (Web editor or Git-backed) that **pulls the
  pre-built GHCR image** — it does not build on the server. Update later via
  **Stacks → savta-gallary → Pull and redeploy** (optionally wired to a Portainer webhook
  the Action calls, so a push to `main` auto-redeploys).

**What the stack looks like:**

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
      - ./data:/data          # holds db/ and images/
    restart: unless-stopped
```

Secrets go in Portainer's **Environment variables** section, never in the YAML. The image
runs pending Drizzle migrations on start. `docker-compose.yml` in the repo root has a
`build:` block for local `docker compose up --build`.

- An **example** nginx `server{}` block in the repo (`deploy/nginx.example.conf`) as a
  reference only. What it needs to express:
  - `client_max_body_size 50m;`
  - proxy `/` → `127.0.0.1:3006`
  - `location /images/` served **directly from the host `/data/images/derived` path** with
    `Cache-Control: public, max-age=31536000, immutable` (skip Node entirely)
  - never cache `/admin` or `/api`
- **Cloudflare** (already in front): edge-cache `/images/*` aggressively — content-hashed
  immutable URLs make this safe, so the origin serves each derivative roughly once. Note
  the **free-plan 100MB request-body cap**; the 50MB app limit + client-side resize keeps
  uploads well under it.

**Backups.** Entire site state is `/data` (one SQLite file + the image tree). A proper
off-site backup strategy is **deferred** — not in this build. For now the operator is
responsible for whatever snapshotting they already run on the host. Revisit before the
archive is considered "live" (see §10).

---

## 8. Build Order (implement in this sequence)

1. **Scaffold** — Next.js + Drizzle + schema + migrations + seed script (a few sample
   paintings with placeholder images).
2. **Public gallery** — homepage grid + painting page + about, styled per Section 2 exactly
   (priority for visual quality).
3. **Image pipeline** — upload endpoint → originals → sharp derivatives → thumbhash →
   serving with immutable caching.
4. **Auth + admin shell** — login, session cookie, middleware, roles.
5. **"Add a painting" flow** (grandma UX per Section 1) + autosave + client-side resize +
   progress.
6. **Edit / review / publish** — review queue, painting editor, image management,
   hide / delete, about editor, tag management.
6b. **Bulk import** (§11) — `npm run import` CLI: reads the session manifest, clusters
   photos by EXIF gap, reuses the step-3 `processImage()` path, runs Whisper over the
   memos; plus the two `/admin/import/*` review passes. Slots in here, but **the photography
   itself must not wait for it** — see §11.
7. **Search** — FTS5 + the dedicated `/search` page (live results, field keeps focus).
8. **PWA** — `manifest.json` (`start_url: "/"`, `display: "standalone"`, name "Bluma"),
   full icon set + `apple-touch-icon` (180px, no transparency — iOS masks the corners
   itself) derived from **a crop of one of her paintings**, `theme_color`/`background_color`
   on the warm-paper token, optional service worker for an offline shell. `artist` session
   redirects `/` → `/admin/add` so her home-screen icon opens the add flow.
9. **Ops** — Dockerfile (standalone output), `docker-compose.yml`,
   `.github/workflows/{docker-build,pr-checks}.yml` (GHCR publish + PR checks, per §7),
   `deploy/nginx.example.conf`, README with Portainer setup + operational notes.

---

## 9. Quality Bar

- Public pages: fast (static / ISR where possible), responsive to 360px, semantic HTML,
  keyboard focus visible, `prefers-reduced-motion` respected, OG meta per painting (primary
  image + title).
- Admin: works flawlessly in iOS Safari. Test the add-painting flow with a 15–40MB HEIC.
  Nothing the artist can do should break the public site or lose typed text.
- No external services beyond fonts (self-hosted at build time) and Cloudflare. No
  analytics by default.
- **The entire site is Hebrew / RTL** — chrome included, not just user content. `dir="auto"`
  on user-entered text, logical CSS properties throughout, and no layout pinned to a
  physical side. Verify mixed runs (years, dimensions, any Latin) render correctly under
  bidi.

---

## 10. Nice-to-haves (only after everything above works)

- **Off-site backup** (deferred from §7): Litestream for the DB + `restic`/`rsync` for
  `/data/images` to an off-site target. Do this before the archive is treated as the
  system of record.
- "Collections" / era grouping (featured tag treatment: *Early work*, *The Jerusalem
  years*) as a narrative browse mode.
- Passkey login for admin.
- Per-painting share images generated with the placard styling.
- **"Listen to Bluma tell it"** — an audio player on the painting page, fed by the
  `audio_path` recordings captured during the digitization sessions (§11). Only possible
  if the audio is captured now.

---

## 11. Initial Digitization & Bulk Import

Seeding the archive from Bluma's house: photographing ~500 paintings and capturing her
account of each. This is a **one-time migration**, not a product feature.

### The governing principle

**Her availability is the scarce resource, not the code.** The photos and audio are just
files on a disk; the importer can be written at any time. Therefore: **start shooting
immediately — do not wait for any part of the software to be finished.** And capture far
more than is planned for publication. Cropping, discarding, and editing are all reversible.
Re-recording is not.

### Capture protocol — facts typed, story recorded

The split matters. Short factual fields are faster to type than to say, and typing them
doesn't interrupt anything. The **story is always recorded**, never typed: typing while she
talks turns you into a live editor, compressing her phrasing into your summary — and §1
promises her stories "in her own words."

Per painting:

1. Swap onto the easel, dust it, bump the sticky note to the next number.
2. Shoot 2–3 frames.
3. **Type the row** on the Mac while she answers: number, title, year, medium, dimensions,
   tags, provenance. She names each painting here, in front of it.
4. **Tap record → say the number → let her tell it → tap stop.** Do not interrupt.
5. Next.

**One recording per painting, not one per session.** The file itself becomes the boundary,
which deletes the entire matching problem — no transcript splitting, no timestamp
alignment, no spoken-number parsing. 500 memos sort chronologically and map 1:1 onto the
500 manifest rows in the same order. The spoken number at the start of each memo is the
fallback if one is missed or runs long. **Archive the raw audio permanently** (§10).

### Transcription

**Whisper large-v3 locally, on the Mac** (whisper.cpp on Apple Silicon) — free, no API key,
nothing leaves the house, and it is where the audio already is. This is a **Mac-side prep
step, not part of the server import** (see "Where each step runs"): the transcripts go into
`manifest.csv` before the folder is copied across, so the home server never needs Whisper
installed. Hebrew accuracy is good but not clean; expect errors on names, places, and her
particular idiom, so a human review pass is **mandatory**, not optional.

Do **not** run an LLM "cleanup" pass over the transcripts. It smooths away exactly the
phrasing that makes them hers, which is the premise of the site. Fix Whisper's errors, cut
false starts, leave her voice alone.

**Titles:** she names each painting during the session, while she is standing in front of
it. No `Untitled (…)` fallback policy needed.

### Kit

| | |
|---|---|
| Camera | iPhone 14 Pro Max, 12MP, 1x main lens only, Live Photos off, Photographic Style Standard, Grid + Level on. ~50GB free, power bank. (On the 14 Pro, 48MP is ProRAW/DNG only — huge files sharp cannot read. 12MP is 4032px wide, ample for a 2400px derivative with crop headroom.) |
| **Camera format** | **Settings → Camera → Formats → "Most Compatible" (JPEG), not "High Efficiency" (HEIC).** Non-negotiable for the bulk import: sharp cannot decode HEIC, and the CLI importer has no browser to convert in — unlike the web upload flow, which converts client-side. Shooting JPEG removes an entire batch-conversion step for ~500 photos. Set this before session one. |
| Tripod | Phone tripod with clamp. Non-negotiable — consistency, no keystone, sharp in dim light, hands free. |
| Level | iPhone's built-in level + grid (Settings → Camera → Composition). |
| Audio | **A second device** for recording, so the camera phone stays free. One memo per painting. |
| Typing | Mac, with the **Hebrew input source added and tested before the session**. Spreadsheet → saved as `manifest.csv`. |
| Measuring | Metric tape, 3m+. |
| Colour | Plain white A4 sheets, or a grey card, in one frame per lighting setup. |
| Reflections | Clip-on circular polarizer — only if paintings are behind glass. Most of hers are not, so optional. |
| Staging | Easel with a **mid-grey matte cotton sheet** draped over it (pads the canvas against the easel ledge and gives a clean neutral field around the painting; not white — it fools the meter; not black — it hides the painting's edges from the crop). Microfiber in your pocket for dusting. Sticky notes + marker. |

### The station

Build it once per session, then only the paintings move:

```
  window )))  →   [ painting on grey-draped easel ]   ←  tripod + phone
  (indirect)          against a plain wall               lens at the painting's
                                                          centre height
```

Painting **faces the window**; camera sits between them. Watch that your own shadow doesn't
fall across the canvas. If one edge is noticeably darker, stand a white board or sheet on
the dark side to bounce light back — that is the entire lighting rig.

**Sort paintings into rough size groups first** (large / medium / small) and shoot each
group without touching the tripod. Otherwise a 40×40cm piece is lost in a frame set up for
a 120×80cm one. Three setups instead of five hundred.

**Easels lean back.** Most hold a canvas 5–10° off vertical, which trapezoids it exactly
like handheld tilt. Set the painting as upright as the easel allows, then shoot one test
frame and confirm its left and right edges are **parallel** in the photo. If they converge,
straighten the painting — not the camera.

### Shooting rules

- Indirect daylight, overcast ideal. **No flash** — it blows varnish out to a white blob.
- Painting off the wall, camera perpendicular, lens centred on the painting's centre.
- **Leave 10–15% margin around the painting**, with the numbered sticky note on the sheet
  inside the frame. Never crop in-camera; the crop step exists for this, a crop is
  reversible and a re-shoot is not, and the note gets cropped away with the margin.
- 2–3 frames each. Blur is invisible on a phone and obvious at 2400px.
- Tap-and-hold to lock AE/AF; shoot on a 2s timer.
- Also capture: signature, any inscription on the back, the frame, a texture close-up —
  **immediately after** the main frames, without pausing. The importer groups photos by
  time gap, so a pause longer than ~30 seconds turns the extras into a phantom painting.
- One test shot at the start of every session and after every tripod move — zoom fully in
  to check it is actually sharp.

### Pacing

~2 minutes per painting when it flows, more when there is a story. 500 paintings is
realistically **8–12 sessions**, not one. Shoot the paintings she cares most about first,
so if energy runs out the best material is already captured. The site can launch well with
60. **Back up each session's raw files to two places the same day** — backups are deferred
in §7, and these are the only files in the project that genuinely cannot be recreated.

### Import mechanism

Typed live in the session. `num` is the sticky-note number and is the join key;
`story` stays blank here — it comes from the recording during the story pass:

```
num | title | year | medium | width_cm | height_cm | tags | provenance | story
```

**Matching photos to rows — by file number (preferred).**

Photos are renamed to their sticky-note number after the session — `1.jpg`, `2.jpg`, and
`3b.jpg` for a second frame of painting 3 — and the manifest carries a matching `num`
column. The importer pairs on **the number, not the order**, which is what makes it safe:
a missing photo or a missing row is named precisely rather than silently shifting every
painting after it by one.

```
data/import/2026-09-06/
  manifest.csv     num,title,year,medium,width_cm,height_cm,tags,provenance,story
  photos/
    1.jpg          painting 1
    2.jpg          painting 2
    3.jpg   ┐      painting 3 — leading digits are the number, so any
    3b.jpg  ┘      suffix marks an extra frame of the same painting
  audio/
    3.m4a          matched by number too
```

Accepted number columns: `num`, `number`, `pic`, `pic_number`, `photo`, `id`, `מספר`.
Everything else in the row is optional; a blank `story` is expected at this stage, since it
comes from the recording during the story pass.

The importer reports mismatches before writing anything, e.g.:

```
!  1 manifest row(s) with NO photo: 7
!  1 photo group(s) with NO manifest row: 9
```

**Fallback: EXIF timestamp clustering** (`--mode exif`, and used automatically when the
photos are not numbered). Frames of one painting are 2–5 seconds apart while consecutive
paintings are separated by a swap, a dust, a typed row and a recorded story — so any gap
over ~30s starts a new painting. This pairs by **order**, so one bad gap misaligns
everything downstream, and it needs EXIF intact: transfer with **Image Capture / AirDrop
originals**, never a route that re-encodes or strips metadata. Prefer numbering.

The system is self-checking: the crop pass shows the **uncropped** photo, sticky
note and all, beside the manifest row — so any drift is visible on the very next painting.

Two free habits that make it bulletproof: **never delete photos on the phone mid-session**
(a deleted frame is fine, a deleted *gap* is not — cull later on the Mac), and if a
painting is re-shot later in a session, give it a **new number** rather than slotting it
back in.

**Validate on session one.** Run the importer over the first ~40 paintings and skim the
groupings before investing eleven more sessions in the approach.

### Where each step runs

The work splits by what each machine has. **The importer must run on the home server**:
SQLite over a network share breaks file locking and can corrupt the database, so the
process that writes must be on the box that owns the file.

| Step | Where | Why |
| --- | --- | --- |
| Dump photos off the phone | Mac | Image Capture / AirDrop originals, EXIF intact |
| Transcribe the memos | **Mac** | The audio is there, and Apple Silicon runs whisper.cpp fast |
| Fill `manifest.csv` | Mac | Paste transcripts beside the rows typed live in the session |
| Copy session folder to the server | — | Into `<stack-dir>/data/import/<date>/`; no new mount, `./data:/data` already exists |
| Run the importer | **Home server** | Writes rows + sharp derivatives directly into `/data` |
| Crop, then fix transcripts | Browser | `/admin/import/crop` then `/admin/import/stories` |

Run it from **Portainer → Containers → savta-gallary → Console**:

```
node scripts/import.mjs /data/import/2026-09-06
```

The script is shipped in the image as plain JS (the standalone build has no `tsx`), so the
Dockerfile must copy it explicitly — `.next/standalone` will not include it otherwise.

Everything lands as `status='draft'`, `needs_crop=true`, `needs_review=true`.

**Derivative generation is deferred — this is the one place the import must NOT reuse the
web upload path.** The two flows are not symmetrical:

- *Web:* she crops on the phone, uploads an already-cropped image, derivatives follow.
- *Import:* photos arrive **uncropped**, with wall, floor and a numbered sticky note in
  frame. Generating derivatives here would build ~4,500 files of a sticky note — and if
  anything later failed to regenerate them, **the public gallery would ship photographs of
  her paintings with sticky notes taped beside them.**

So at import the script only: stores the original untouched, reads intrinsic dimensions and
EXIF, and flags `needs_crop`. **Derivatives, thumbhash and metadata-stripping run after the
crop is confirmed** in the crop pass. The crop is therefore applied **server-side
with sharp** (`extract` on the stored original) — the review queue reuses the add-flow
cropper's *UI*, not its client-side application.

Because the stored original stays uncropped, re-cropping any imported painting later is
always possible (§4).

**Primary image.** A cluster holds 2–3 frames of one painting. The importer marks the
**first** frame `is_primary` and the rest as additional images in shooting order;
the crop pass allows switching. Extra shots (signature, inscription on the back,
frame, texture) must be taken **immediately after** the main frames — pause more than ~30
seconds and the EXIF clustering reads them as a separate painting.

**`--dry-run` is mandatory before the first real import.** It reports, writing nothing:
cluster count vs. manifest row count, any cluster whose frame count looks anomalous, gaps
near the 30-second threshold, photos missing EXIF timestamps, and the proposed row↔cluster
pairing. "Validate on session one" (above) means running this and reading it.

Once the crop pass is done, the staging folder is redundant — every original has
already been copied into `/data/images/originals` — so delete it to reclaim the space.
Budget roughly **8–10 GB** in `/data` for 500 paintings at 3 frames each, originals plus
derivatives.

### Reviewing 500 imports — two passes, not one

Cropping and transcript correction must **not** share a screen. Their throughput differs by
two orders of magnitude: a crop is a one-second glance that is right ~90% of the time, a
transcript is a two-minute listen-and-fix needed every time. Combining them forces the
two-minute task 500 times in order to do the one-second task 500 times, and makes
bulk-approving crops impossible.

**Auto-detection does most of pass 1.** Conditions are near-ideal for it: an axis-aligned
painting on a tripod against a uniform mid-grey matte sheet. No OpenCV needed — downscale
to ~400px, read grayscale pixels via sharp, and build a **projection profile** (per row and
column, how far it deviates from the backdrop). The painting is a sharp contiguous run on
both axes; take the bounding box plus slight padding. It also yields a **confidence score**
from edge crispness.

**Pass 1 — crop (contact sheet, ~30 minutes for 500).**
A grid of ~40 per page, each thumbnail showing the photo with its proposed rectangle drawn
on, **sorted lowest-confidence first** so the problems surface at the top. Fix those, scan
the rest, "approve remaining on this page". Tapping a thumbnail opens the full cropper.
~500 decisions collapse to ~30. Best on a laptop. Clears `needs_crop` and **is the gate
that triggers derivative generation**.

**Pass 2 — stories (sequential, spread over weeks).**
One painting per screen: audio player, editable Whisper transcript, metadata to confirm,
Next. Slow and pleasant — this is where her rambling becomes a story. Clears
`needs_review`. Because it only edits text, it blocks nothing: **the gallery can go live
after pass 1, with stories filling in gradually.**

Publishing stays a separate deliberate act in both cases.

---

## 12. Decisions & Open Questions

**Decided:**

- Domain: `bluma.omersher.com`. nginx + Cloudflare + DNS owned and configured by me; repo
  ships an example nginx conf only.
- Deploy: GitHub repo → GitHub Actions builds & pushes image to **GHCR** on every push to
  `main` → Portainer stack **pulls the pre-built image** (`Pull and redeploy`), does not
  build on the server. PR checks workflow too. Mirrors the `storytime` project's setup.
- Host port: `web` published on `127.0.0.1:3006`.
- Admin entry point: **no dashboard / no giant button.** Logged-in artist gets an `ADD
  PAINTING` item in the normal site topbar; `admin` also gets `MANAGE`. Admin screens stay
  in the site's design system (warm paper, serif), just single-column and finger-friendly.
- HEIC: converted client-side, always. No libheif in the image.
- Library size: up to ~500 paintings → grid, tag, and search views are paginated
  (~48/page) with progressive "load more".
- Crop: full-screen client-side crop step in the add-painting flow; only the cropped image
  is stored.
- Off-site backup: **deferred** — not in this build (§10).
- PWA: **one manifest**, `start_url: "/"`, `display: standalone`. No separate install
  scopes. When a request arrives with an `artist` session, the app redirects `/` →
  `/admin/add`, so if grandma installs the site while logged in, her home-screen icon
  lands on the add-painting screen; a visitor's install lands on the gallery.

- Login: **single-field password form** (password → role), argon2id env-var hashes,
  HMAC-signed httpOnly cookie, 365-day rolling for `artist` / 30-day for `admin`,
  rate-limited `/login`. Full detail in §3. Alternatives (magic link, passkey, Cloudflare
  Access for everyone) considered and rejected as too much friction for the artist;
  passkey stays a later admin-only upgrade.

- Digitization: she **names each painting during the session**. A private `provenance`
  column (artist / sold / gifted / unknown) is captured at the same time — cheap now,
  painful to retrofit. Full protocol in §11.
- Capture split: **facts typed live, story always recorded** (one memo per painting),
  transcribed with local Whisper, corrected in the story pass. Photos matched to
  rows by EXIF gap clustering, verified by the in-frame sticky note.
- **The site is entirely in Hebrew** — content and chrome, RTL throughout. This retires
  Cormorant Garamond and Karla (no Hebrew glyphs) in favour of **Frank Ruhl Libre +
  Assistant**; see the rewritten §2 typography. `title_en` / `story_en` stay nullable and
  unused, so an English version remains possible later without a migration.

- Import photo format: **shoot JPEG, not HEIC** (§11 Kit). sharp cannot decode HEIC and the
  CLI importer has no browser to convert in. The web upload flow still converts HEIC
  client-side for her day-to-day additions; only the bulk import needs JPEG.

- **Slugs: short id + Hebrew suffix** — `/painting/a7f3-הסירה-הכחולה`. The leading id is the
  identity and guarantees uniqueness and permanence; the Hebrew tail is decorative. Routing
  resolves on the id alone, so a renamed painting keeps working and old links never break,
  and the URL stays valid regardless of how a client handles Hebrew encoding.

**Still open:**

- Nothing blocking — ready to start Build Order step 1 (scaffold), and the photography can
  begin immediately in parallel.
