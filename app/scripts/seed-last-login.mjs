#!/usr/bin/env node
/**
 * Seed last_login_at for existing users (varied values for dev/testing).
 * Run: node app/scripts/seed-last-login.mjs
 * Requires: PocketBase running, PB_ADMIN_EMAIL + PB_ADMIN_PASSWORD in .env
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

import PocketBase from "pocketbase";

const PB_URL = process.env.VITE_POCKETBASE_URL || process.env.POCKETBASE_SERVER_URL || "http://127.0.0.1:8090";
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || "admin@example.com";
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || "password123!";

/** Spread last_login_at over the past 7 days - different for each user */
function lastLoginForIndex(i, total) {
  const now = Date.now();
  const msPerDay = 86400000;
  // Spread: 0 = 5 min ago, 1 = 30 min, 2 = 2h, 3 = 6h, 4 = 1d, 5 = 2d, 6 = 3d, 7 = 5d, 8 = 7d, ...
  const offsets = [
    5 * 60 * 1000,      // 5 min
    30 * 60 * 1000,     // 30 min
    2 * 60 * 60 * 1000, // 2 hours
    6 * 60 * 60 * 1000, // 6 hours
    1 * msPerDay,       // 1 day
    2 * msPerDay,       // 2 days
    3 * msPerDay,       // 3 days
    4 * msPerDay,       // 4 days
    5 * msPerDay,       // 5 days
    6 * msPerDay,       // 6 days
    7 * msPerDay,       // 7 days
  ];
  const offset = offsets[i % offsets.length];
  const ts = new Date(now - offset);
  return ts.toISOString();
}

async function main() {
  const pb = new PocketBase(PB_URL);

  try {
    await pb.collection("_superusers").authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  } catch (e) {
    console.error("Admin auth failed. Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD in .env");
    console.error("Error:", e?.message || e);
    process.exit(1);
  }

  const users = await pb.collection("users").getFullList({ $autoCancel: false });
  if (users.length === 0) {
    console.log("No users found. Run seed-malmo.mjs first.");
    process.exit(0);
  }

  for (let i = 0; i < users.length; i++) {
    const lastLoginAt = lastLoginForIndex(i, users.length);
    await pb.collection("users").update(users[i].id, { last_login_at: lastLoginAt });
    const d = new Date(lastLoginAt);
    const ago = Math.round((Date.now() - d.getTime()) / 60000);
    const agoStr = ago < 60 ? `${ago} min` : ago < 1440 ? `${Math.round(ago / 60)} h` : `${Math.round(ago / 1440)} d`;
    console.log(`  ${users[i].name || users[i].email} – ${agoStr} sedan`);
  }

  console.log(`\n✓ Seeded last_login_at for ${users.length} users.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
