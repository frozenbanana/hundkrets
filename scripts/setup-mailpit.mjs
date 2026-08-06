#!/usr/bin/env node
/**
 * Dev setup: start Mailpit and configure PocketBase SMTP for local email testing.
 *
 * Usage:
 *   node scripts/setup-mailpit.mjs              # full setup (certs + mailpit + PB config)
 *   node scripts/setup-mailpit.mjs --config-only # only configure PB SMTP settings
 *   node scripts/setup-mailpit.mjs --stop        # stop Mailpit container
 *
 * Prerequisites:
 *   - Docker (for Mailpit container)
 *   - mkcert (recommended, for trusted TLS certs)
 *   - PocketBase running locally (for --config-only)
 */

import { execSync, spawn } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CERTS_DIR = join(ROOT, "mailpit-certs");
const PB_URL = process.env.PB_URL || process.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";
const MAILPIT_SMTP_PORT = 1025;
const MAILPIT_WEB_PORT = 8025;

const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || "admin@test.com";
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || "adminpass123";

const args = process.argv.slice(2);
const configOnly = args.includes("--config-only");
const stopOnly = args.includes("--stop");

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf-8", stdio: opts.silent ? "pipe" : "inherit", ...opts });
  } catch (e) {
    if (opts.allowFail) return null;
    throw e;
  }
}

function checkDocker() {
  try {
    execSync("docker info", { stdio: "pipe" });
    return true;
  } catch {
    console.error("Docker is not running. Please start Docker and try again.");
    return false;
  }
}

async function generateCerts() {
  if (existsSync(join(CERTS_DIR, "cert.pem")) && existsSync(join(CERTS_DIR, "key.pem"))) {
    console.log("TLS certs already exist in mailpit-certs/");
    return;
  }

  mkdirSync(CERTS_DIR, { recursive: true });

  if (run("command -v mkcert", { silent: true, allowFail: true })) {
    console.log("Generating trusted certs with mkcert...");
    run("mkcert -install", { allowFail: true });
    run(`mkcert -key-file "${CERTS_DIR}/key.pem" -cert-file "${CERTS_DIR}/cert.pem" localhost 127.0.0.1`, { silent: true });
  } else {
    console.log("Generating self-signed certs with openssl...");
    console.log("(Install mkcert for trusted certs: https://github.com/FiloSottile/mkcert)");
    run(`openssl req -x509 -newkey rsa:4096 -nodes ` +
      `-keyout "${CERTS_DIR}/key.pem" -out "${CERTS_DIR}/cert.pem" ` +
      `-sha256 -days 3650 -subj "/CN=localhost" ` +
      `-addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`, { silent: true });
    console.log("\nTo trust this cert on Linux:");
    console.log(`  sudo cp ${CERTS_DIR}/cert.pem /usr/local/share/ca-certificates/mailpit-dev.crt`);
    console.log("  sudo update-ca-certificates");
  }

  console.log("TLS certs created.");
}

async function startMailpit() {
  const existing = run("docker ps -q -f name=mailpit-dev", { silent: true, allowFail: true })?.trim();
  if (existing) {
    console.log("Mailpit container already running.");
    return;
  }

  const stopped = run("docker ps -aq -f name=mailpit-dev", { silent: true, allowFail: true })?.trim();
  if (stopped) {
    console.log("Removing stopped mailpit-dev container...");
    run("docker rm mailpit-dev", { silent: true, allowFail: true });
  }

  console.log("Starting Mailpit container...");
  run(
    `docker run -d --name mailpit-dev ` +
    `-p ${MAILPIT_WEB_PORT}:${MAILPIT_WEB_PORT} ` +
    `-p ${MAILPIT_SMTP_PORT}:${MAILPIT_SMTP_PORT} ` +
    `-v "${CERTS_DIR}:/certs:ro" ` +
    `-e MP_SMTP_TLS_CERT=/certs/cert.pem ` +
    `-e MP_SMTP_TLS_KEY=/certs/key.pem ` +
    `-e MP_SMTP_AUTH_ACCEPT_ANY=1 ` +
    `axllent/mailpit:latest`
  );

  console.log(`Mailpit started: Web UI at http://localhost:${MAILPIT_WEB_PORT}, SMTP on port ${MAILPIT_SMTP_PORT}`);
}

async function stopMailpit() {
  run("docker stop mailpit-dev 2>/dev/null", { allowFail: true, silent: true });
  run("docker rm mailpit-dev 2>/dev/null", { allowFail: true, silent: true });
  console.log("Mailpit container stopped and removed.");
}

async function configurePocketBase() {
  console.log("\nConfiguring PocketBase SMTP settings...");

  let token;

  try {
    const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: PB_ADMIN_EMAIL, password: PB_ADMIN_PASSWORD }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Admin auth failed (${res.status}): ${err}`);
      console.error("Make sure PocketBase is running and admin credentials are correct.");
      console.error("You can create an admin with: ./pocketbase superuser upsert <email> <password>");
      process.exit(1);
    }

    const data = await res.json();
    token = data.token;
  } catch (e) {
    console.error(`Failed to connect to PocketBase at ${PB_URL}`);
    console.error("Make sure PocketBase is running: ./pocketbase serve");
    process.exit(1);
  }

  const settings = {
    meta: {
      senderAddress: "hundkrets@test.local",
      senderName: "Hundkrets (Dev)",
      appUrl: "http://localhost:3000",
    },
    smtp: {
      enabled: true,
      host: "localhost",
      port: 1025,
      username: "",
      password: "",
      tls: false,
    },
  };

  try {
    const res = await fetch(`${PB_URL}/api/settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Admin ${token}`,
      },
      body: JSON.stringify(settings),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Failed to update PB settings: ${err}`);
      process.exit(1);
    }
    console.log("PocketBase settings updated: sender address = hundkrets@test.local, app URL = http://localhost:3000");
    console.log("PocketBase SMTP configured: localhost:1025 (no TLS, no auth)");
  } catch (e) {
    console.error("Failed to configure PocketBase:", e.message);
    process.exit(1);
  }

  console.log("\nSMTP configuration:");
  console.log("  Host: localhost");
  console.log("  Port: 1025");
  console.log("  TLS: Auto (StartTLS)");
  console.log("  Auth: None (accept any)");
  console.log("\nConfigure these in PocketBase Admin > Settings > Mail if not already set.");
  console.log("Or use: --set-smtp flag (requires manual setup in Admin UI).");
}

async function main() {
  if (stopOnly) {
    await stopMailpit();
    return;
  }

  if (!configOnly) {
    if (!checkDocker()) process.exit(1);
    await generateCerts();
    await startMailpit();
    console.log("");
  }

  await configurePocketBase();

  console.log("\n---");
  console.log("Dev email testing is ready!");
  console.log(`  Mailpit Web UI: http://localhost:${MAILPIT_WEB_PORT}`);
  console.log("  Run email tests: cd app && npm run test:email");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});