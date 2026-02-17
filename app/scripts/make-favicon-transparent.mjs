#!/usr/bin/env node
/**
 * Makes the favicon background transparent.
 * Run from project root: node app/scripts/make-favicon-transparent.mjs
 * Requires: npm install sharp (in app/)
 */
import sharp from "sharp";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const faviconPath = join(__dirname, "../public/favicon.png");

async function main() {
  if (!existsSync(faviconPath)) {
    console.error("favicon.png not found at", faviconPath);
    process.exit(1);
  }

  const img = sharp(readFileSync(faviconPath));
  const { data, info } = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const threshold = 240; // Treat light pixels (cream/white) as background

  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];
    if (r > threshold && g > threshold && b > threshold) {
      data[i * channels + 3] = 0; // Make transparent
    }
  }

  await sharp(Buffer.from(data), {
    raw: { width, height, channels },
  })
    .png()
    .toFile(faviconPath);

  console.log("Favicon background made transparent.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
