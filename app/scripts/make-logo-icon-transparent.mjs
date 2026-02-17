#!/usr/bin/env node
/**
 * Makes the logo-icon background transparent by removing the checkerboard
 * (white and light gray squares) that was embedded instead of real transparency.
 * Run from app/: node scripts/make-logo-icon-transparent.mjs
 * Requires: npm install sharp (in app/)
 */
import sharp from "sharp";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] === "favicon" ? "favicon" : "logo-icon";
const logoPath = join(__dirname, `../public/${target}.png`);

function isCheckerboardWhite(r, g, b) {
  return r > 235 && g > 235 && b > 235;
}

function isCheckerboardGray(r, g, b) {
  const avg = (r + g + b) / 3;
  const variance = Math.abs(r - avg) + Math.abs(g - avg) + Math.abs(b - avg);
  return variance < 30 && avg >= 70 && avg <= 250;
}

function isCheckerboardBlack(r, g, b) {
  const avg = (r + g + b) / 3;
  const variance = Math.abs(r - avg) + Math.abs(g - avg) + Math.abs(b - avg);
  return variance < 30 && avg <= 60;
}

async function main() {
  if (!existsSync(logoPath)) {
    console.error(`${target}.png not found at`, logoPath);
    process.exit(1);
  }

  const img = sharp(readFileSync(logoPath));
  const { data, info } = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];
    if (isCheckerboardWhite(r, g, b) || isCheckerboardGray(r, g, b) || isCheckerboardBlack(r, g, b)) {
      data[i * channels + 3] = 0;
    }
  }

  await sharp(Buffer.from(data), {
    raw: { width, height, channels },
  })
    .png()
    .toFile(logoPath);

  console.log(`${target}.png background made transparent.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
