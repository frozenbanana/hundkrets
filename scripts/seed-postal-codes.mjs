#!/usr/bin/env node
/**
 * Seed postal_codes collection from sweden-zipcode.csv.
 * Run: node scripts/seed-postal-codes.mjs
 * Requires: PocketBase running, postal_codes migration applied.
 * Uses admin auth (admin@test.com / adminpass123) or POCKETBASE_ADMIN_EMAIL/POCKETBASE_ADMIN_PASSWORD.
 *
 * URL: POCKETBASE_URL (for scripts) or VITE_POCKETBASE_URL. Must point to PocketBase API, e.g.:
 *   - Local: http://127.0.0.1:8090
 *   - Docker: http://localhost:8099
 */

import { createReadStream, readFileSync } from "fs";
import { createInterface } from "readline";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from project root (no dotenv dep)
try {
  const envPath = join(__dirname, "..", ".env");
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) {
      const k = m[1].trim();
      const v = m[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  }
} catch (_) {}

const PB_URL =
  process.env.POCKETBASE_URL ||
  process.env.VITE_POCKETBASE_URL ||
  "http://127.0.0.1:8090";
const ADMIN_EMAIL =
  process.env.POCKETBASE_ADMIN_EMAIL ||
  process.env.PB_ADMIN_EMAIL ||
  "admin@test.com";
const ADMIN_PASSWORD =
  process.env.POCKETBASE_ADMIN_PASSWORD ||
  process.env.PB_ADMIN_PASSWORD ||
  "adminpass123";
const CSV_PATH = join(__dirname, "..", "sweden-zipcode.csv");
const BATCH_SIZE = 50; // Smaller batches for remote servers (avoids EHOSTUNREACH)
const DELAY_MS = 100; // Pause between batches to avoid overwhelming server

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function createWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status >= 500 && attempt < maxRetries) {
        await sleep(1000 * attempt);
        continue;
      }
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await sleep(1000 * attempt);
    }
  }
}

function formatCity(name) {
  if (!name || typeof name !== "string") return "";
  // MALMÖ -> Malmö, STOCKHOLM -> Stockholm
  return name
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Ö/g, "ö")
    .replace(/Ä/g, "ä")
    .replace(/Å/g, "å");
}

async function main() {
  const rows = [];
  const rl = createInterface({
    input: createReadStream(CSV_PATH),
    crlfDelay: Infinity,
  });

  let first = true;
  for await (const line of rl) {
    if (first) {
      first = false;
      if (line.startsWith("Zip")) continue; // skip header
    }
    const [zip, city] = line.split(",").map((s) => s.trim());
    if (!zip || !city) continue;
    const postalCode = zip.replace(/\s/g, "");
    if (postalCode.length !== 5) continue;
    rows.push({ postal_code: postalCode, city: formatCity(city), area: "" });
  }

  console.log(`Loaded ${rows.length} postal codes from CSV`);
  console.log(`PocketBase URL: ${PB_URL}`);

  // Auth as admin
  const authRes = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!authRes.ok) {
    const err = await authRes.text();
    throw new Error(`Admin auth failed: ${err}`);
  }
  const { token } = await authRes.json();

  // Check existing count
  const listRes = await fetch(
    `${PB_URL}/api/collections/postal_codes/records?perPage=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!listRes.ok) throw new Error(`List failed: ${await listRes.text()}`);
  const listData = await listRes.json();
  const existingCount = listData.totalItems ?? 0;
  if (existingCount >= rows.length) {
    console.log(`postal_codes already has ${existingCount} records. Done.`);
    return;
  }
  if (existingCount > 0) {
    console.log(`Resuming from ${existingCount} existing records...`);
  }

  // Create in batches (sequential within batch to avoid overwhelming remote server)
  let created = existingCount;
  for (let i = existingCount; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    for (const row of batch) {
      await createWithRetry(`${PB_URL}/api/collections/postal_codes/records`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(row),
      });
      created++;
      process.stdout.write(`\rCreated ${created}/${rows.length}`);
    }
    if (i + BATCH_SIZE < rows.length) await sleep(DELAY_MS);
  }
  console.log(`\nDone. Created ${created} postal codes.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
