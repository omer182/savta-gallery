/**
 * Generates the PWA icon set (PLAN.md §8).
 *
 *   npm run icons -- [source-image]
 *
 * With no argument it renders a placeholder mark on the warm-paper ground, so
 * the app is installable before her paintings are digitised. Once a painting is
 * chosen, pass it and a centre-crop becomes the icon.
 *
 * No transparency and no padding: iOS masks the corners itself, and a padded
 * source ends up as a small picture floating in a rounded square.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT = path.resolve(process.cwd(), "public");
const PAPER = "#F7F4EE";
const INK = "#1C1A15";

async function main() {
  const source = process.argv[2];
  await fs.mkdir(OUT, { recursive: true });

  for (const size of [192, 512, 180]) {
    const base = source
      ? sharp(source).resize(size, size, { fit: "cover", position: "centre" })
      : sharp({
          create: {
            width: size,
            height: size,
            channels: 4,
            background: PAPER,
          },
        }).composite([
          {
            input: Buffer.from(
              `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
                 <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
                       font-family="Georgia, serif" font-size="${Math.round(size * 0.52)}"
                       fill="${INK}">ב</text>
               </svg>`,
            ),
            top: 0,
            left: 0,
          },
        ]);

    // Flatten onto the paper ground: transparency would show as black on iOS.
    const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
    await base.flatten({ background: PAPER }).png().toFile(path.join(OUT, name));
    console.log("wrote", name);
  }
}

void main();
