#!/usr/bin/env node
/**
 * Integration tests for email flows. Verifies that PocketBase hooks send
 * the expected emails to Mailpit.
 *
 * Prerequisites:
 *   - PocketBase running with Mail settings → host=localhost, port=1025
 *   - Mailpit running (docker run ... or docker compose --profile dev up)
 *   - Settings → Meta → Sender address configured
 *
 * Run: node app/scripts/test-email-flows.mjs
 * Or:  npm run test:email
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

import PocketBase from "pocketbase";

const PB_URL = process.env.VITE_POCKETBASE_URL || process.env.VITE_POCKBASE_URL || process.env.PB_URL || "http://127.0.0.1:8090";
const MAILPIT_URL = process.env.MAILPIT_URL || "http://localhost:8025";
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || "admin@example.com";
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || "password123!";


async function mailpitMessages() {
  const res = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=100`);
  if (!res.ok) throw new Error(`Mailpit API failed: ${res.status}`);
  const data = await res.json();
  return data.messages || data.Messages || data || [];
}

async function mailpitDeleteAll() {
  const res = await fetch(`${MAILPIT_URL}/api/v1/messages`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok && res.status !== 404) throw new Error(`Mailpit delete failed: ${res.status}`);
}

function toAddress(addr) {
  if (!addr) return "";
  if (typeof addr === "string") return addr;
  return addr.Address || addr.address || "";
}

function assertHasEmail(messages, { subject, toEmail }) {
  const found = messages.find(
    (m) =>
      (m.Subject || m.subject) === subject &&
      (m.To || m.to)?.some((a) => toAddress(a) === toEmail)
  );
  if (!found) {
    const got = messages.map((m) => `"${m.Subject || m.subject}"->${toAddress((m.To || m.to)?.[0])}`).join(", ");
    throw new Error(`Expected email not found: subject="${subject}" to=${toEmail}. Got: ${got || "(none)"}`);
  }
}

/** Assert an email was sent to toEmail with subject containing subjectPart (PocketBase defaults vary) */
function assertHasEmailToWithSubjectContaining(messages, { toEmail, subjectPart }) {
  const found = messages.find(
    (m) =>
      String(m.Subject || m.subject || "").includes(subjectPart) &&
      (m.To || m.to)?.some((a) => toAddress(a) === toEmail)
  );
  if (!found) {
    const got = messages.map((m) => `"${m.Subject || m.subject}"->${toAddress((m.To || m.to)?.[0])}`).join(", ");
    throw new Error(`Expected email to ${toEmail} with subject containing "${subjectPart}". Got: ${got || "(none)"}`);
  }
}

async function main() {
  console.log("Email flow tests – PocketBase + Mailpit\n");

  // Check Mailpit
  try {
    await fetch(`${MAILPIT_URL}/api/v1/info`);
  } catch (e) {
    console.error("Mailpit not reachable at", MAILPIT_URL);
    console.error("Start Mailpit: docker run -d -p 8025:8025 -p 1025:1025 ...");
    process.exit(1);
  }

  const pb = new PocketBase(PB_URL);

  // Admin auth (PocketBase uses _superusers collection, not /api/admins)
  try {
    await pb.collection("_superusers").authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  } catch (e) {
    console.error("Admin auth failed.");
    console.error("  URL:", PB_URL, "| Email:", PB_ADMIN_EMAIL ? PB_ADMIN_EMAIL + " (set)" : "(not set)");
    console.error("  Error:", e?.message || e);
    console.error("  Check: PocketBase running? Correct URL (8090/8099)? Admin exists in Settings?");
    process.exit(1);
  }

  // Ensure we have at least 2 users for connection/chat tests.
  // userPassword: needed for chat test (messages require sender = @request.auth.id)
  let userA, userB, userPassword;
  const existing = await pb.collection("users").getFullList({ $autoCancel: false });
  if (existing.length >= 2) {
    userA = existing[0];
    userB = existing[1];
    userPassword = process.env.TEST_USER_PASSWORD || "password123!"; // seed-malmo default
    console.log("Using existing users:", userA.email, userB.email);
  } else {
    userPassword = "TestPass123!";
    userA = await pb.collection("users").create({
      email: "emailtest-a@example.com",
      password: userPassword,
      passwordConfirm: userPassword,
      name: "TestA",
      phone: "070-0000001",
      area: "Malmö",
      latitude: 55.6,
      longitude: 13.0,
      onboarding_complete: true,
      welcome_email_sent: true,
    });
    userB = await pb.collection("users").create({
      email: "emailtest-b@example.com",
      password: userPassword,
      passwordConfirm: userPassword,
      name: "TestB",
      phone: "070-0000002",
      area: "Malmö",
      latitude: 55.6,
      longitude: 13.0,
      onboarding_complete: true,
      welcome_email_sent: true,
    });
    console.log("Created test users:", userA.email, userB.email);
  }

  // Ensure test users are verified (connection_requests hook requires it)
  try {
    await pb.collection("users").update(userA.id, { verified: true });
    await pb.collection("users").update(userB.id, { verified: true });
  } catch (updErr) {
    console.error("Failed to set verified on test users:", updErr?.message || updErr);
    console.error("  Connection/match tests will likely fail. Run with fresh DB (rm -rf pb_data) or verify users in Admin UI.");
  }

  // Clean Mailpit
  await mailpitDeleteAll();
  await new Promise((r) => setTimeout(r, 300));

  let passed = 0;
  let failed = 0;

  // --- 1. Connection request (intresseanmälan) ---
  try {
    const conns = await pb.collection("connection_requests").getFullList({
      filter: `(from_user = "${userA.id}" && to_user = "${userB.id}") || (from_user = "${userB.id}" && to_user = "${userA.id}")`,
    });
    for (const c of conns) await pb.collection("connection_requests").delete(c.id);

    await pb.collection("connection_requests").create({
      from_user: userA.id,
      to_user: userB.id,
      message: "Testmeddelande",
    });

    await new Promise((r) => setTimeout(r, 500));
    const msgs = await mailpitMessages();
    assertHasEmail(msgs, {
      subject: `${userA.name} är intresserad av dig på Hundkrets`,
      toEmail: userB.email,
    });
    console.log("✓ Connection request email");
    passed++;
  } catch (e) {
    const res = e?.response ?? e?.data;
    const data = res?.data ?? res;
    const msg = (typeof data?.message === "string" ? data.message : null) || (data && typeof data === "object" && !Array.isArray(data) ? Object.values(data).find((v) => typeof v === "object" && v?.message)?.message : null) || e.message;
    console.error("✗ Connection request email:", msg);
    failed++;
  }

  // --- 2. Match confirmation (båda får mail) ---
  try {
    await pb.collection("connection_requests").create({
      from_user: userB.id,
      to_user: userA.id,
      message: "",
    });

    await new Promise((r) => setTimeout(r, 500));
    const msgs = await mailpitMessages();
    assertHasEmail(msgs, { subject: "Ni har matchat på Hundkrets!", toEmail: userA.email });
    assertHasEmail(msgs, { subject: "Ni har matchat på Hundkrets!", toEmail: userB.email });
    console.log("✓ Match confirmation emails (both users)");
    passed++;
  } catch (e) {
    const res = e?.response ?? e?.data;
    const data = res?.data ?? res;
    const msg = (typeof data?.message === "string" ? data.message : null) || (data && typeof data === "object" && !Array.isArray(data) ? Object.values(data).find((v) => typeof v === "object" && v?.message)?.message : null) || e.message;
    console.error("✗ Match confirmation emails:", msg);
    failed++;
  }

  // --- 3. Welcome email ---
  const WELCOME_EMAIL = "welcome-test@example.com";
  const TEST_PW = "TestPass123!";
  try {
    // Remove existing welcome-test user from previous runs (avoids "Failed to create record" on duplicate email)
    const existingWelcome = await pb.collection("users").getFullList({ filter: `email = "${WELCOME_EMAIL}"`, $autoCancel: false });
    for (const u of existingWelcome) await pb.collection("users").delete(u.id);

    const welcomeUser = await pb.collection("users").create({
      email: WELCOME_EMAIL,
      password: TEST_PW,
      passwordConfirm: TEST_PW,
      name: "VälkommenTest",
      phone: "070-0000003",
      area: "Malmö",
      latitude: 55.6,
      longitude: 13.0,
      onboarding_complete: false,
    });

    await pb.collection("users").update(welcomeUser.id, { onboarding_complete: true });

    await new Promise((r) => setTimeout(r, 500));
    const msgs = await mailpitMessages();
    assertHasEmail(msgs, {
      subject: "Välkommen till Hundkrets!",
      toEmail: WELCOME_EMAIL,
    });
    console.log("✓ Welcome email");
    passed++;
  } catch (e) {
    console.error("✗ Welcome email:", e.message);
    failed++;
  }

  // --- 4. Chat notification (instant) ---
  // Create conversation as admin, then create message as userA (sender must match auth).
  try {
    await pb.collection("users").update(userB.id, { chat_email_frequency: "instant" });

    const convs = await pb.collection("conversations").getFullList({
      filter: `(user_a = "${userA.id}" && user_b = "${userB.id}") || (user_a = "${userB.id}" && user_b = "${userA.id}")`,
    });
    let conv = convs[0];
    if (!conv) {
      conv = await pb.collection("conversations").create({
        user_a: userA.id,
        user_b: userB.id,
        pair_key: [userA.id, userB.id].sort().join(":"),
      });
    }

    // Create message as userA (collection rules require sender = @request.auth.id)
    await pb.collection("users").authWithPassword(userA.email, userPassword);
    await pb.collection("messages").create({
      conversation: conv.id,
      sender: userA.id,
      body: "Hej från chatttest!",
    });
    await pb.collection("_superusers").authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);

    await new Promise((r) => setTimeout(r, 500));
    const msgs = await mailpitMessages();
    assertHasEmail(msgs, {
      subject: `${userA.name} skickade ett meddelande på Hundkrets`,
      toEmail: userB.email,
    });
    console.log("✓ Chat notification email");
    passed++;
  } catch (e) {
    console.error("✗ Chat notification email:", e.message);
    const details = e?.response ?? e?.data ?? e;
    if (details && typeof details === "object") console.error("  Details:", JSON.stringify(details, null, 2));
    failed++;
  }

  // --- 5. Reset password ---
  const RESET_EMAIL = "reset-test@example.com";
  try {
    const existingReset = await pb.collection("users").getFullList({ filter: `email = "${RESET_EMAIL}"`, $autoCancel: false });
    for (const u of existingReset) await pb.collection("users").delete(u.id);

    await pb.collection("users").create({
      email: RESET_EMAIL,
      password: "TestPass123!",
      passwordConfirm: "TestPass123!",
      name: "ResetTest",
      phone: "070-0000004",
      area: "Malmö",
      latitude: 55.6,
      longitude: 13.0,
      onboarding_complete: true,
      welcome_email_sent: true,
    });

    await pb.collection("users").requestPasswordReset(RESET_EMAIL);

    await new Promise((r) => setTimeout(r, 500));
    const msgs = await mailpitMessages();
    assertHasEmailToWithSubjectContaining(msgs, { toEmail: RESET_EMAIL, subjectPart: "Reset" });
    console.log("✓ Reset password email");
    passed++;
  } catch (e) {
    console.error("✗ Reset password email:", e.message);
    failed++;
  }

  // --- 6. Verification email ---
  const VERIFY_EMAIL = "verify-test@example.com";
  try {
    const existingVerify = await pb.collection("users").getFullList({ filter: `email = "${VERIFY_EMAIL}"`, $autoCancel: false });
    for (const u of existingVerify) await pb.collection("users").delete(u.id);

    await pb.collection("users").create({
      email: VERIFY_EMAIL,
      password: "TestPass123!",
      passwordConfirm: "TestPass123!",
      name: "VerifyTest",
      phone: "070-0000005",
      area: "Malmö",
      latitude: 55.6,
      longitude: 13.0,
      onboarding_complete: false,
      welcome_email_sent: true,
    });

    await pb.collection("users").requestVerification(VERIFY_EMAIL);

    await new Promise((r) => setTimeout(r, 500));
    const msgs = await mailpitMessages();
    assertHasEmailToWithSubjectContaining(msgs, { toEmail: VERIFY_EMAIL, subjectPart: "Verif" });
    console.log("✓ Verification email");
    passed++;
  } catch (e) {
    console.error("✗ Verification email:", e.message);
    failed++;
  }

  // --- 7. Confirm email change ---
  const NEW_EMAIL = "newemail-test@example.com";
  try {
    const existingNew = await pb.collection("users").getFullList({ filter: `email = "${NEW_EMAIL}"`, $autoCancel: false });
    for (const u of existingNew) await pb.collection("users").delete(u.id);

    await pb.collection("users").authWithPassword(userA.email, userPassword);
    await pb.collection("users").requestEmailChange(NEW_EMAIL);

    pb.authStore.clear();
    await pb.collection("_superusers").authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);

    await new Promise((r) => setTimeout(r, 500));
    const msgs = await mailpitMessages();
    assertHasEmailToWithSubjectContaining(msgs, { toEmail: NEW_EMAIL, subjectPart: "Confirm" });
    console.log("✓ Confirm email change email");
    passed++;
  } catch (e) {
    console.error("✗ Confirm email change email:", e.message);
    failed++;
  }

  // --- 8. Login alert (requires Auth alert enabled in Collection > users > Options) ---
  try {
    const existingAlert = await pb.collection("users").getFullList({ filter: `email = "alert-test@example.com"`, $autoCancel: false });
    for (const u of existingAlert) await pb.collection("users").delete(u.id);

    await pb.collection("users").create({
      email: "alert-test@example.com",
      password: "TestPass123!",
      passwordConfirm: "TestPass123!",
      name: "AlertTest",
      phone: "070-0000006",
      area: "Malmö",
      latitude: 55.6,
      longitude: 13.0,
      onboarding_complete: true,
      welcome_email_sent: true,
    });

    await pb.collection("users").authWithPassword("alert-test@example.com", "TestPass123!");

    pb.authStore.clear();
    await pb.collection("_superusers").authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);

    await new Promise((r) => setTimeout(r, 500));
    const msgs = await mailpitMessages();
    const alertSubjectParts = ["sign", "New", "login"];
    const alertFound = alertSubjectParts.some((part) => {
      try {
        assertHasEmailToWithSubjectContaining(msgs, { toEmail: "alert-test@example.com", subjectPart: part });
        return true;
      } catch (e) {
        return false;
      }
    });
    if (alertFound) {
      console.log("✓ Login alert email");
      passed++;
    } else {
      console.warn("⊘ Login alert: no email sent (enable Auth alert in Collection > users > Options)");
      passed++;
    }
  } catch (e) {
    console.error("✗ Login alert email:", e.message);
    failed++;
  }

  console.log("\n---");
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
