#!/usr/bin/env node
/**
 * Minimal script to test PocketBase admin login.
 * Run: node scripts/test-pb-admin-login.mjs
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

import PocketBase from "pocketbase";

const PB_URL = process.env.VITE_POCKETBASE_URL || process.env.VITE_POCKBASE_URL || process.env.PB_URL || "http://127.0.0.1:8090";
const email = process.env.PB_ADMIN_EMAIL;
const password = process.env.PB_ADMIN_PASSWORD;

const pb = new PocketBase(PB_URL);

try {
  await pb.collection("_superusers").authWithPassword(email, password);
  console.log("OK – inloggad som", pb.authStore.model?.email);
} catch (e) {
  console.error("Fel:", e?.message || e);
  process.exit(1);
}
