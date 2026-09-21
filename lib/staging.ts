import fs from "node:fs/promises";
import sharp, { type OverlayOptions } from "sharp";

/**
 * Staging — putting a painting in a room.
 *
 * THE RULE THIS IS BUILT AROUND: a generative model may produce the room, and
 * must never touch the canvas. Everything here is deterministic compositing,
 * so the pixels of her painting come out exactly as they went in. A model that
 * repaints her brushwork to make a prettier photograph has falsified the
 * archive, which is the one thing this project cannot do.
 *
 * The consequence is that staging costs nothing per painting and takes
 * milliseconds: the expensive, generative half happens ONCE per scene, and
 * every painting after that is arithmetic.
 */

export type Scene = {
  id: string;
  /** Shown in the admin picker. */
  name: string;
  width: number;
  height: number;
  /**
   * Where the canvas goes. The painting is fitted INSIDE this box preserving
   * its own proportions, never stretched to fill it — her archive runs from
   * 0.38 to 2.35, and no single box flatters all of that, which is why the box
   * is generous and the painting is centred in it rather than filling it.
   */
  frame: { x: number; y: number; width: number; height: number };
  /** Backdrop, behind the painting. A file, or generated on the fly. */
  background: () => Promise<Buffer>;
  /** Optional layer drawn OVER the painting — cloth in front, an easel lip. */
  foreground?: () => Promise<Buffer>;
  /** Direction the light comes from; the shadow falls the other way. */
  light: { x: number; y: number };
  shadow: { sigma: number; opacity: number; distance: number };
};

const readFile = (p: string) => () => fs.readFile(p);

/* ------------------------------------------------------------------ *
 * A procedural gallery wall
 *
 * Here so the pipeline is testable before any photographed backdrop exists,
 * and good enough to ship as the default. A real scene is the same thing with
 * `background` pointing at a file instead.
 * ------------------------------------------------------------------ */
function wallBackdrop(w: number, h: number): Promise<Buffer> {
  const horizon = Math.round(h * 0.82);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="wall" x1="0" y1="0" x2="0.15" y2="1">
        <stop offset="0" stop-color="#9a938b"/>
        <stop offset="0.62" stop-color="#857e77"/>
        <stop offset="1" stop-color="#6f6962"/>
      </linearGradient>
      <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5d5852"/>
        <stop offset="1" stop-color="#4a453f"/>
      </linearGradient>
      <radialGradient id="key" cx="0.3" cy="0.16" r="0.78">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
        <stop offset="0.55" stop-color="#ffffff" stop-opacity="0.05"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="vig" cx="0.5" cy="0.45" r="0.78">
        <stop offset="0.55" stop-color="#000000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.35"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#wall)"/>
    <rect y="${horizon}" width="${w}" height="${h - horizon}" fill="url(#floor)"/>
    <rect y="${horizon}" width="${w}" height="2" fill="#000000" opacity="0.18"/>
    <rect width="${w}" height="${h}" fill="url(#key)"/>
    <rect width="${w}" height="${h}" fill="url(#vig)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export const SCENES: Scene[] = [
  {
    id: "wall",
    name: "קיר גלריה",
    width: 1600,
    height: 1200,
    // Generous: the painting should own the frame, not float in a field of
    // wall. Anything narrower and a 0.38 panorama comes out postage-stamp.
    frame: { x: 190, y: 120, width: 1220, height: 810 },
    background: () => wallBackdrop(1600, 1200),
    light: { x: -1, y: -0.7 },
    // Short throw, wide falloff, low opacity: a canvas hanging an inch off a
    // wall, not a board propped a foot in front of one.
    shadow: { sigma: 18, opacity: 0.34, distance: 12 },
  },
];

export function getScene(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}

/** A scene backed by photographed plates rather than generated ones. */
export function fileScene(
  base: Omit<Scene, "background" | "foreground"> & {
    backgroundPath: string;
    foregroundPath?: string;
  },
): Scene {
  const { backgroundPath, foregroundPath, ...rest } = base;
  return {
    ...rest,
    background: readFile(backgroundPath),
    foreground: foregroundPath ? readFile(foregroundPath) : undefined,
  };
}

/* ------------------------------------------------------------------ *
 * The composite
 * ------------------------------------------------------------------ */

/** A soft drop shadow the shape of the canvas, cast away from the light. */
async function castShadow(w: number, h: number, scene: Scene) {
  const { sigma, opacity, distance } = scene.shadow;
  const pad = Math.ceil(sigma * 3);

  const block = await sharp({
    create: { width: w, height: h, channels: 4, background: { r: 8, g: 6, b: 4, alpha: opacity } },
  })
    .png()
    .toBuffer();

  /*
   * TWO pipelines, and it has to be two.
   *
   * sharp applies operations in a fixed internal order, and composite runs at
   * the END of a pipeline regardless of where it is called. Chaining
   * .composite().blur() therefore blurs the empty base and then pastes a
   * perfectly sharp block on top of it - which is exactly what a shadow must
   * not be. Materialising the block first and blurring it in a pipeline of its
   * own is what actually softens it.
   */
  const slab = await sharp({
    create: {
      width: w + pad * 2,
      height: h + pad * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: block, left: pad, top: pad }])
    .png()
    .toBuffer();

  const buf = await sharp(slab).blur(sigma).png().toBuffer();

  // Unit light vector, so the offset is the same distance at any angle.
  const len = Math.hypot(scene.light.x, scene.light.y) || 1;
  return {
    buf,
    dx: Math.round((-scene.light.x / len) * distance) - pad,
    dy: Math.round((-scene.light.y / len) * distance) - pad,
  };
}

/**
 * The edge of a stretched canvas, and the light falling across its face.
 *
 * Both are drawn ON the painting rather than near it, which is what stops the
 * result looking like a picture pasted onto a photograph: a real canvas has a
 * lit edge, a dark one, and a gradient across its surface from the room it is
 * standing in.
 */
function surfaceOverlay(w: number, h: number, scene: Scene) {
  const litX = scene.light.x < 0 ? 0 : w - 3;
  const darkX = scene.light.x < 0 ? w - 3 : 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="face" x1="${scene.light.x < 0 ? 0 : 1}" y1="0" x2="${
        scene.light.x < 0 ? 1 : 0
      }" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.10"/>
        <stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.16"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#face)"/>
    <rect x="${litX}" width="3" height="${h}" fill="#ffffff" opacity="0.16"/>
    <rect x="${darkX}" width="3" height="${h}" fill="#000000" opacity="0.22"/>
    <rect y="${h - 3}" width="${w}" height="3" fill="#000000" opacity="0.26"/>
    <rect width="${w}" height="2" fill="#ffffff" opacity="0.10"/>
  </svg>`;
  return Buffer.from(svg);
}

/**
 * Puts one painting in one scene. The pixels of the painting are resized and
 * nothing else — no round trip through a model, no regeneration.
 */
export async function stage(paintingImage: Buffer, scene: Scene): Promise<Buffer> {
  const { frame } = scene;

  // `inside` preserves the proportions of the work. Never `fill`: stretching a
  // canvas to fit a box is the one distortion nobody would forgive.
  const fitted = await sharp(paintingImage)
    .resize({ width: frame.width, height: frame.height, fit: "inside", withoutEnlargement: false })
    .toBuffer({ resolveWithObject: true });

  const w = fitted.info.width;
  const h = fitted.info.height;
  const left = frame.x + Math.round((frame.width - w) / 2);
  const top = frame.y + Math.round((frame.height - h) / 2);

  const withSurface = await sharp(fitted.data)
    .composite([{ input: surfaceOverlay(w, h, scene), blend: "over" }])
    .toBuffer();

  const shadow = await castShadow(w, h, scene);

  const layers: OverlayOptions[] = [
    { input: shadow.buf, left: left + shadow.dx, top: top + shadow.dy },
    { input: withSurface, left, top },
  ];
  if (scene.foreground) {
    layers.push({ input: await scene.foreground(), left: 0, top: 0 });
  }

  return sharp(await scene.background())
    .composite(layers)
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}
