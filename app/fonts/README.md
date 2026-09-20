# Anka CLM

The display face for the artist name in the site header, and nothing else.

- **Source**: the [Culmus project](https://culmus.sourceforge.io/) Hebrew font family.
- **Licence**: GNU GPL v2, in `ANKA-CLM-LICENSE.txt`. There is **no font exception
  clause** in the copy that shipped with it, so the licence has to travel with the file
  wherever it is served. That is why it lives here in the repo rather than being pulled
  from a CDN and forgotten.
- **Original**: `ankaclm-bold-webfont.ttf` (14,976 bytes), converted to woff2 here
  (8,240 bytes). No subsetting - the face is already tiny.

## Why only the header

The face carries 28 Hebrew letters and the ten digits, but **only five Latin letters**,
and ships a single weight (700). It cannot set body text, a story, or any UI label
without falling through to another font mid-sentence. The artist name is pure Hebrew and
wants one weight, so that is the one place it fits.
