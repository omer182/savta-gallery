import fs from "node:fs/promises";
import sharp from "sharp";
import type { CropRect } from "./images";
import { originalAbsPath } from "./images";

/**
 * Auto-detects the painting rectangle in an import photograph (PLAN.md §11).
 *
 * Conditions are close to ideal, and deliberately so: the painting is
 * axis-aligned on a tripod against a uniform mid-grey matte sheet. That means no
 * OpenCV and no ML — a projection profile is enough.
 *
 * Method: downscale, take grayscale pixels, estimate the backdrop from the
 * border, then for each row and column measure how far it deviates from that
 * backdrop. The painting is a contiguous run on both axes. Confidence comes from
 * how crisp those transitions are, and drives the review queue's sort order so
 * the doubtful ones surface first.
 */

const WORK_WIDTH = 400;
const PAD_RATIO = 0.004; // a hair of margin, so a 1px misread never clips the art

/** fullWidth/fullHeight let the review sheet draw the proposal as percentages. */
export type Detection = {
  rect: CropRect;
  confidence: number;
  fullWidth: number;
  fullHeight: number;
};

export async function detectPaintingRect(originalRelPath: string): Promise<Detection | null> {
  let buf: Buffer;
  try {
    buf = await fs.readFile(originalAbsPath(originalRelPath));
  } catch {
    return null;
  }

  const src = sharp(buf, { failOn: "none" }).rotate();
  const meta = await src.metadata();
  const fullW = meta.width ?? 0;
  const fullH = meta.height ?? 0;
  if (!fullW || !fullH) return null;

  // Colour, not greyscale. The sheet is deliberately neutral grey while
  // paintings are not, so chroma separates them even when luminance does not —
  // an olive background can sit at almost exactly the sheet's brightness and
  // vanish from a greyscale profile, which silently crops into the artwork.
  const { data, info } = await src
    .clone()
    .resize({ width: WORK_WIDTH, withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  const px = (x: number, y: number) => {
    const i = (y * w + x) * ch;
    return [data[i]!, data[i + 1]!, data[i + 2]!] as const;
  };

  // Backdrop = per-channel median of the border ring; the sheet fills the edges.
  const bR: number[] = [];
  const bG: number[] = [];
  const bB: number[] = [];
  const push = (x: number, y: number) => {
    const [r, g, b] = px(x, y);
    bR.push(r);
    bG.push(g);
    bB.push(b);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  const med = (a: number[]) => {
    a.sort((p, q) => p - q);
    return a[Math.floor(a.length / 2)]!;
  };
  const back = [med(bR), med(bG), med(bB)] as const;

  // How far the sheet itself strays from its own median — JPEG noise, vignetting,
  // an uneven window light. This is the bar that "is this backdrop?" must clear,
  // and deriving it from the image survives lighting that a fixed number would not.
  const borderDist: number[] = [];
  for (let i = 0; i < bR.length; i++) {
    borderDist.push(
      Math.sqrt((bR[i]! - back[0]) ** 2 + (bG[i]! - back[1]) ** 2 + (bB[i]! - back[2]) ** 2),
    );
  }
  borderDist.sort((p2, q) => p2 - q);
  const sheetNoise = borderDist[Math.floor(borderDist.length * 0.9)]!;

  // Distance map, computed once and then profiled along each axis.
  const dist = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = px(x, y);
      dist[y * w + x] = Math.sqrt(
        (r - back[0]) ** 2 + (g - back[1]) ** 2 + (b - back[2]) ** 2,
      );
    }
  }

  // Profiles are computed over a WINDOW on the other axis, not the whole frame.
  // Averaging a row across the full width lets the empty margin dilute it below
  // threshold, which clips uniform bands of the painting; restricting to the
  // detected columns removes that entirely.
  const colProfile = (y0: number, y1: number) => {
    const out = new Float64Array(w);
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = y0; y <= y1; y++) sum += dist[y * w + x]!;
      out[x] = sum / (y1 - y0 + 1);
    }
    return out;
  };
  const rowProfile = (x0: number, x1: number) => {
    const out = new Float64Array(h);
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = x0; x <= x1; x++) sum += dist[y * w + x]!;
      out[y] = sum / (x1 - x0 + 1);
    }
    return out;
  };

  // Two refinement passes: columns over the full height, rows within those
  // columns, then columns again within those rows.
  let colScore = colProfile(0, h - 1);
  let cols = longestRun(colScore, sheetNoise);
  if (!cols) return null;

  const rowScore = rowProfile(cols.start, cols.end);
  const rows = longestRun(rowScore, sheetNoise);
  if (!rows) return null;

  colScore = colProfile(rows.start, rows.end);
  cols = longestRun(colScore, sheetNoise) ?? cols;

  const scaleX = fullW / w;
  const scaleY = fullH / h;
  const padX = fullW * PAD_RATIO;
  const padY = fullH * PAD_RATIO;

  const x0 = Math.max(0, cols.start * scaleX - padX);
  const y0 = Math.max(0, rows.start * scaleY - padY);
  const x1 = Math.min(fullW, (cols.end + 1) * scaleX + padX);
  const y1 = Math.min(fullH, (rows.end + 1) * scaleY + padY);

  const rect: CropRect = {
    x: Math.round(x0),
    y: Math.round(y0),
    width: Math.round(x1 - x0),
    height: Math.round(y1 - y0),
  };

  // Degenerate results are worse than none: fall back to the whole frame and
  // let the human decide.
  if (rect.width < fullW * 0.1 || rect.height < fullH * 0.1) return null;

  const coverage = (rect.width * rect.height) / (fullW * fullH);
  // A painting filling 25–85% of a well-shot frame is the expected case; both
  // extremes suggest the detector latched onto something else.
  const plausible = coverage > 0.15 && coverage < 0.92 ? 1 : 0.35;

  // Boundary sanity check. A clean detection has backdrop just OUTSIDE each
  // edge; if the band outside an edge still looks like painting, the run was
  // cut short — which happens when part of the artwork happens to match the
  // sheet's luminance. That is the dangerous failure (it crops into the art),
  // so it must drive confidence down hard rather than pass at 80%.
  const spill = Math.min(edgeSpill(colScore, cols), edgeSpill(rowScore, rows));
  const confidence = Math.min(1, ((cols.strength + rows.strength) / 2) * plausible * spill);

  return { rect, confidence, fullWidth: fullW, fullHeight: fullH };
}

type Run = { start: number; end: number; strength: number; low: number; high: number };

/**
 * Penalty for a detection whose edges still have painting just outside them.
 *
 * Samples a thin band beyond each edge and normalises it onto the profile's own
 * quiet→loud range, which is scale-free: ~0 means clean backdrop, ~1 means the
 * band still looks like artwork, i.e. the run stopped short and the crop would
 * cut into the painting. That is the dangerous failure, so it costs a lot of
 * confidence; a merely soft edge costs little.
 */
function edgeSpill(profile: Float64Array, run: Run): number {
  const band = (from: number, to: number): number | null => {
    const lo = Math.max(0, from);
    const hi = Math.min(profile.length - 1, to);
    if (hi < lo) return null; // edge sits at the frame boundary: nothing to judge
    let sum = 0;
    for (let i = lo; i <= hi; i++) sum += profile[i]!;
    return sum / (hi - lo + 1);
  };

  const depth = Math.max(2, Math.round(profile.length * 0.03));
  const span = Math.max(1, run.high - run.low);

  let worst = 1;
  for (const b of [band(run.start - depth, run.start - 1), band(run.end + 1, run.end + depth)]) {
    if (b === null) continue;
    const t = (b - run.low) / span; // 0 = backdrop, 1 = as loud as the painting
    const score = t <= 0.35 ? 1 : t >= 0.75 ? 0.3 : 1 - ((t - 0.35) / 0.4) * 0.7;
    worst = Math.min(worst, score);
  }
  return worst;
}

/**
 * Longest contiguous run of "not backdrop".
 *
 * The threshold sits just above the sheet's own noise, NOT at a fraction of the
 * painting's dynamic range. A painting containing one very bright element pushes
 * that range up, and a proportional threshold then discards the painting's own
 * flat areas — silently cropping into the artwork.
 */
function longestRun(score: Float64Array, sheetNoise: number): Run | null {
  const n = score.length;
  if (!n) return null;

  const sorted = Array.from(score).sort((a, b) => a - b);
  const low = sorted[Math.floor(n * 0.1)]!;
  const high = sorted[Math.floor(n * 0.9)]!;
  if (high - low < 3) return null; // essentially flat: nothing to find

  const threshold = Math.max(low + Math.max(4, sheetNoise * 1.5), low + (high - low) * 0.05);

  let best: { start: number; end: number } | null = null;
  let curStart = -1;
  for (let i = 0; i < n; i++) {
    if (score[i]! > threshold) {
      if (curStart < 0) curStart = i;
      if (!best || i - curStart > best.end - best.start) best = { start: curStart, end: i };
    } else {
      curStart = -1;
    }
  }
  if (!best) return null;

  return { start: best.start, end: best.end, strength: Math.min(1, (high - low) / 60), low, high };
}
