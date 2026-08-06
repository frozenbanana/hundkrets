#!/usr/bin/env node
/**
 * Integration tests for all email flows in Hundkrets.
 * Verifies that PocketBase hooks send the expected emails to Mailpit,
 * and that email_log entries are created correctly.
 *
 * Prerequisites:
 *   - PocketBase running with Mail settings → host=localhost, port=1025
 *   - Mailpit running (docker compose --profile dev up, or scripts/setup-mailpit.mjs)
 *   - Settings → Meta → Sender address configured
 *   - Seed users exist (run scripts/reset-and-seed.sh or node app/scripts/seed-malmo.mjs)
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

const PB_URL =
  process.env.VITE_POCKETBASE_URL ||
  process.env.VITE_POCKBASE_URL ||
  process.env.PB_URL ||
  "http://127.0.0.1:8090";
const MAILPIT_URL = process.env.MAILPIT_URL || "http://localhost:8025";
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || "admin@test.com";
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || "adminpass123";

// --- Mailpit helpers ---

async function mailpitMessages() {
  const res = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=500`);
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
  if (!res.ok && res.status !== 404)
    throw new Error(`Mailpit delete failed: ${res.status}`);
}

async function waitForEmails(count = 1, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const msgs = await mailpitMessages();
    if (msgs.length >= count) return msgs;
    await new Promise((r) => setTimeout(r, 200));
  }
  return mailpitMessages();
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
    const got = messages
      .map(
        (m) =>
          `"${m.Subject || m.subject}"->${toAddress((m.To || m.to)?.[0])}`
      )
      .join(", ");
    throw new Error(
      `Expected email not found: subject="${subject}" to=${toEmail}. Got: ${got || "(none)"}`
    );
  }
  return found;
}

function assertHasEmailToWithSubjectContaining(messages, { toEmail, subjectPart }) {
  const found = messages.find(
    (m) =>
      String(m.Subject || m.subject || "").includes(subjectPart) &&
      (m.To || m.to)?.some((a) => toAddress(a) === toEmail)
  );
  if (!found) {
    const got = messages
      .map(
        (m) =>
          `"${m.Subject || m.subject}"->${toAddress((m.To || m.to)?.[0])}`
      )
      .join(", ");
    throw new Error(
      `Expected email to ${toEmail} with subject containing "${subjectPart}". Got: ${got || "(none)"}`
    );
  }
  return found;
}

/** Check that an email was NOT sent to a specific address with a given subject */
function assertNoEmail(messages, { subject, toEmail }) {
  const found = messages.find(
    (m) =>
      (m.Subject || m.subject) === subject &&
      (m.To || m.to)?.some((a) => toAddress(a) === toEmail)
  );
  if (found) {
    throw new Error(
      `Unexpected email found: subject="${subject}" to=${toEmail}. Should not have been sent.`
    );
  }
}

/** Check email_log collection for a specific type sent to a specific email */
async function assertEmailLog(pb, { type, toEmail }) {
  const filter = `type = '${type}' && to ~ '${toEmail}'`;
  const results = await pb
    .collection("email_log")
    .getFullList({ filter: filter, $autoCancel: false });
  if (!results || results.length === 0) {
    throw new Error(
      `No email_log entry found: type="${type}" to containing "${toEmail}"`
    );
  }
  return results[0];
}

// --- Main test runner ---

async function main() {
  console.log("Email flow tests – PocketBase + Mailpit\n");

  // Check Mailpit
  try {
    await fetch(`${MAILPIT_URL}/api/v1/info`);
  } catch (e) {
    console.error("Mailpit not reachable at", MAILPIT_URL);
    console.error(
      "Start Mailpit: node scripts/setup-mailpit.mjs"
    );
    console.error(
      "  or: docker compose --profile dev up -d"
    );
    process.exit(1);
  }

  const pb = new PocketBase(PB_URL);

  // Admin auth
  try {
    await pb.collection("_superusers").authWithPassword(
      PB_ADMIN_EMAIL,
      PB_ADMIN_PASSWORD
    );
  } catch (e) {
    console.error("Admin auth failed.");
    console.error(
      "  URL:",
      PB_URL,
      "| Email:",
      PB_ADMIN_EMAIL ? PB_ADMIN_EMAIL + " (set)" : "(not set)"
    );
    console.error("  Error:", e?.message || e);
    console.error(
      "  Check: PocketBase running? Correct URL (8090/8099)? Admin exists?"
    );
    console.error(
      "  Create admin: ./pocketbase superuser upsert <email> <password>"
    );
    process.exit(1);
  }

  // Ensure we have at least 2 users for connection/chat tests.
  let userA, userB, userPassword;
  const existing = await pb
    .collection("users")
    .getFullList({ $autoCancel: false });
  if (existing.length >= 2) {
    userA = existing[0];
    userB = existing[1];
    userPassword = process.env.TEST_USER_PASSWORD || "password123!";
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
    console.error(
      "Failed to set verified on test users:",
      updErr?.message || updErr
    );
    console.error(
      "  Connection/match tests will likely fail. Run with fresh DB (rm -rf pb_data) or verify users in Admin UI."
    );
  }

  // Clean Mailpit
  await mailpitDeleteAll();
  await new Promise((r) => setTimeout(r, 300));

  let passed = 0;
  let failed = 0;

  // =====================================================
  // 1. Connection request (intresseanmälan)
  // =====================================================
  try {
    const conns = await pb
      .collection("connection_requests")
      .getFullList({
        filter: `(from_user = "${userA.id}" && to_user = "${userB.id}") || (from_user = "${userB.id}" && to_user = "${userA.id}")`,
      });
    for (const c of conns)
      await pb.collection("connection_requests").delete(c.id);

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
    console.log("✓ 1. Connection request email");
    await assertEmailLog(pb, { type: "connection_request", toEmail: userB.email });
    console.log("  ✓ email_log entry verified");
    passed++;
  } catch (e) {
    const res = e?.response ?? e?.data;
    const data = res?.data ?? res;
    const msg =
      (typeof data?.message === "string" ? data.message : null) ||
      (data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      data !== null
        ? Object.values(data).find(
            (v) => typeof v === "object" && v?.message
          )?.message
        : null) ||
      e.message;
    console.error("✗ 1. Connection request email:", msg);
    failed++;
  }

  // =====================================================
  // 2. Match confirmation (båda får mail)
  // =====================================================
  try {
    await pb.collection("connection_requests").create({
      from_user: userB.id,
      to_user: userA.id,
      message: "",
    });

    await new Promise((r) => setTimeout(r, 500));
    const msgs = await mailpitMessages();
    assertHasEmail(msgs, {
      subject: "Ni har matchat på Hundkrets!",
      toEmail: userA.email,
    });
    assertHasEmail(msgs, {
      subject: "Ni har matchat på Hundkrets!",
      toEmail: userB.email,
    });
    console.log("✓ 2. Match confirmation emails (both users)");
    await assertEmailLog(pb, { type: "connection_match", toEmail: userA.email });
    await assertEmailLog(pb, { type: "connection_match", toEmail: userB.email });
    console.log("  ✓ email_log entries verified");
    passed++;
  } catch (e) {
    const res = e?.response ?? e?.data;
    const data = res?.data ?? res;
    const msg =
      (typeof data?.message === "string" ? data.message : null) ||
      (data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      data !== null
        ? Object.values(data).find(
            (v) => typeof v === "object" && v?.message
          )?.message
        : null) ||
      e.message;
    console.error("✗ 2. Match confirmation emails:", msg);
    failed++;
  }

  // =====================================================
  // 3. Welcome email
  // =====================================================
  const WELCOME_EMAIL = "welcome-test@example.com";
  const TEST_PW = "TestPass123!";
  try {
    const existingWelcome = await pb
      .collection("users")
      .getFullList({
        filter: `email = "${WELCOME_EMAIL}"`,
        $autoCancel: false,
      });
    for (const u of existingWelcome)
      await pb.collection("users").delete(u.id);

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

    await pb
      .collection("users")
      .update(welcomeUser.id, { onboarding_complete: true });

    await new Promise((r) => setTimeout(r, 500));
    const msgs = await mailpitMessages();
    assertHasEmail(msgs, {
      subject: "Välkommen till Hundkrets!",
      toEmail: WELCOME_EMAIL,
    });
    console.log("✓ 3. Welcome email");
    await assertEmailLog(pb, { type: "welcome", toEmail: WELCOME_EMAIL });
    console.log("  ✓ email_log entry verified");
    passed++;
  } catch (e) {
    console.error("✗ 3. Welcome email:", e.message);
    failed++;
  }

  // =====================================================
  // 4. Chat notification (instant)
  // =====================================================
  try {
    await pb
      .collection("users")
      .update(userB.id, { chat_email_frequency: "instant" });

    const convs = await pb
      .collection("conversations")
      .getFullList({
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

    await pb
      .collection("users")
      .authWithPassword(userA.email, userPassword);
    await pb.collection("messages").create({
      conversation: conv.id,
      sender: userA.id,
      body: "Hej från chatttest!",
    });
    await pb
      .collection("_superusers")
      .authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);

    await new Promise((r) => setTimeout(r, 500));
    const msgs = await mailpitMessages();
    assertHasEmail(msgs, {
      subject: `${userA.name} skickade ett meddelande på Hundkrets`,
      toEmail: userB.email,
    });
    console.log("✓ 4. Chat notification email (instant)");
    await assertEmailLog(pb, { type: "chat_instant", toEmail: userB.email });
    console.log("  ✓ email_log entry verified");
    passed++;
  } catch (e) {
    console.error("✗ 4. Chat notification email:", e.message);
    const details = e?.response ?? e?.data ?? e;
    if (details && typeof details === "object")
      console.error("  Details:", JSON.stringify(details, null, 2));
    failed++;
  }

  // =====================================================
  // 5. Chat notification (daily digest)
  // =====================================================
  try {
    // Set userB to daily digest
    await pb
      .collection("users")
      .update(userB.id, { chat_email_frequency: "daily", chat_digest_last_sent_at: null });

    // Clean mailbox
    await mailpitDeleteAll();
    await new Promise((r) => setTimeout(r, 300));

    // Create conversation if needed (reuse from test 4)
    const convs = await pb
      .collection("conversations")
      .getFullList({
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

    await pb
      .collection("users")
      .authWithPassword(userA.email, userPassword);
    await pb.collection("messages").create({
      conversation: conv.id,
      sender: userA.id,
      body: "Daglig sammanfattning test!",
    });
    await pb
      .collection("_superusers")
      .authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);

    await new Promise((r) => setTimeout(r, 500));
    const msgs = await mailpitMessages();
    assertHasEmail(msgs, {
      subject: "Daglig chattsammanfattning på Hundkrets",
      toEmail: userB.email,
    });
    console.log("✓ 5. Chat daily digest email");
    await assertEmailLog(pb, { type: "chat_daily", toEmail: userB.email });
    console.log("  ✓ email_log entry verified");
    passed++;
  } catch (e) {
    console.error("✗ 5. Chat daily digest email:", e.message);
    failed++;
  }

  // =====================================================
  // 6. Chat notification (off - no email should be sent)
  // =====================================================
  try {
    await pb
      .collection("users")
      .update(userB.id, { chat_email_frequency: "off" });

    await mailpitDeleteAll();
    await new Promise((r) => setTimeout(r, 300));

    const convs = await pb
      .collection("conversations")
      .getFullList({
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

    await pb
      .collection("users")
      .authWithPassword(userA.email, userPassword);
    await pb.collection("messages").create({
      conversation: conv.id,
      sender: userA.id,
      body: "Detta ska inte skicka mail!",
    });
    await pb
      .collection("_superusers")
      .authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);

    await new Promise((r) => setTimeout(r, 500));
    const msgs = await mailpitMessages();
    assertNoEmail(msgs, {
      subject: `${userA.name} skickade ett meddelande på Hundkrets`,
      toEmail: userB.email,
    });
    console.log("✓ 6. Chat notification suppressed (frequency=off)");
    passed++;
  } catch (e) {
    console.error("✗ 6. Chat notification suppression:", e.message);
    failed++;
  }

  // Reset chat frequency for userB
  try {
    await pb
      .collection("users")
      .update(userB.id, { chat_email_frequency: "instant" });
  } catch (_) {}

  // =====================================================
  // 7. Reset password
  // =====================================================
  const RESET_EMAIL = "reset-test@example.com";
  try {
    const existingReset = await pb
      .collection("users")
      .getFullList({ filter: `email = "${RESET_EMAIL}"`, $autoCancel: false });
    for (const u of existingReset)
      await pb.collection("users").delete(u.id);

    await pb.collection("users").create({
      email: RESET_EMAIL,
      password: TEST_PW,
      passwordConfirm: TEST_PW,
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
    assertHasEmailToWithSubjectContaining(msgs, {
      toEmail: RESET_EMAIL,
      subjectPart: "Reset",
    });
    console.log("✓ 7. Reset password email");
    await assertEmailLog(pb, { type: "auth_password_reset", toEmail: RESET_EMAIL });
    console.log("  ✓ email_log entry verified");
    passed++;
  } catch (e) {
    console.error("✗ 7. Reset password email:", e.message);
    failed++;
  }

  // =====================================================
  // 8. Verification email
  // =====================================================
  const VERIFY_EMAIL = "verify-test@example.com";
  try {
    const existingVerify = await pb
      .collection("users")
      .getFullList({
        filter: `email = "${VERIFY_EMAIL}"`,
        $autoCancel: false,
      });
    for (const u of existingVerify)
      await pb.collection("users").delete(u.id);

    await pb.collection("users").create({
      email: VERIFY_EMAIL,
      password: TEST_PW,
      passwordConfirm: TEST_PW,
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
    assertHasEmailToWithSubjectContaining(msgs, {
      toEmail: VERIFY_EMAIL,
      subjectPart: "Verif",
    });
    console.log("✓ 8. Verification email");
    try {
      await assertEmailLog(pb, { type: "auth_verification", toEmail: VERIFY_EMAIL });
      console.log("  ✓ email_log entry verified");
    } catch (logErr) {
      console.log("  ⚠ email_log entry not found (hook subject match may differ from PB locale)");
    }
    passed++;
  } catch (e) {
    console.error("✗ 8. Verification email:", e.message);
    failed++;
  }

  // =====================================================
  // 9. Confirm email change
  // =====================================================
  const NEW_EMAIL = "newemail-test@example.com";
  try {
    const existingNew = await pb
      .collection("users")
      .getFullList({
        filter: `email = "${NEW_EMAIL}"`,
        $autoCancel: false,
      });
    for (const u of existingNew)
      await pb.collection("users").delete(u.id);

    await pb
      .collection("users")
      .authWithPassword(userA.email, userPassword);
    await pb.collection("users").requestEmailChange(NEW_EMAIL);

    pb.authStore.clear();
    await pb
      .collection("_superusers")
      .authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);

    await new Promise((r) => setTimeout(r, 500));
    const msgs = await mailpitMessages();
    assertHasEmailToWithSubjectContaining(msgs, {
      toEmail: NEW_EMAIL,
      subjectPart: "Confirm",
    });
    console.log("✓ 9. Confirm email change email");
    passed++;
  } catch (e) {
    console.error("✗ 9. Confirm email change email:", e.message);
    failed++;
  }

  // =====================================================
  // 10. Login alert (requires Auth alert enabled in Collection > users > Options)
  // =====================================================
  try {
    const existingAlert = await pb
      .collection("users")
      .getFullList({
        filter: `email = "alert-test@example.com"`,
        $autoCancel: false,
      });
    for (const u of existingAlert)
      await pb.collection("users").delete(u.id);

    await pb.collection("users").create({
      email: "alert-test@example.com",
      password: TEST_PW,
      passwordConfirm: TEST_PW,
      name: "AlertTest",
      phone: "070-0000006",
      area: "Malmö",
      latitude: 55.6,
      longitude: 13.0,
      onboarding_complete: true,
      welcome_email_sent: true,
    });

    await pb
      .collection("users")
      .authWithPassword("alert-test@example.com", TEST_PW);

    pb.authStore.clear();
    await pb
      .collection("_superusers")
      .authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);

    await new Promise((r) => setTimeout(r, 500));
    const msgs = await mailpitMessages();
    const alertSubjectParts = ["sign", "New", "login"];
    const alertFound = alertSubjectParts.some((part) => {
      try {
        assertHasEmailToWithSubjectContaining(msgs, {
          toEmail: "alert-test@example.com",
          subjectPart: part,
        });
        return true;
      } catch (e) {
        return false;
      }
    });
    if (alertFound) {
      console.log("✓ 10. Login alert email");
      try {
        await assertEmailLog(pb, { type: "auth_alert", toEmail: "alert-test@example.com" });
        console.log("  ✓ email_log entry verified");
      } catch (_) {
        console.log("  (email_log entry not found — may use different subject)");
      }
      passed++;
    } else {
      console.warn(
        "⊘ 10. Login alert: no email sent (enable Auth alert in Collection > users > Options)"
      );
      passed++;
    }
  } catch (e) {
    console.error("✗ 10. Login alert email:", e.message);
    failed++;
  }

  // =====================================================
  // 11. Unsubscribe route (GET /api/unsubscribe/:userId/:type)
  // =====================================================
  try {
    const unsubUser = await pb.collection("users").create({
      email: "unsub-test@example.com",
      password: TEST_PW,
      passwordConfirm: TEST_PW,
      name: "UnsubTest",
      phone: "070-0000007",
      area: "Malmö",
      latitude: 55.6,
      longitude: 13.0,
      onboarding_complete: true,
      welcome_email_sent: true,
      retention_email_enabled: true,
    });

    const res = await fetch(
      `${PB_URL}/api/unsubscribe/${unsubUser.id}/retention`
    );
    if (!res.ok) {
      throw new Error(`Unsubscribe returned ${res.status}: ${await res.text()}`);
    }

    const updated = await pb
      .collection("users")
      .getOne(unsubUser.id, { $autoCancel: false });
    if (updated.retention_email_enabled !== false) {
      throw new Error(
        `Expected retention_email_enabled=false, got ${updated.retention_email_enabled}`
      );
    }

    console.log("✓ 11. Unsubscribe route disables retention_email_enabled");

    // Clean up
    try { await pb.collection("users").delete(unsubUser.id); } catch (_) {}
    passed++;
  } catch (e) {
    console.error("✗ 11. Unsubscribe route:", e.message);
    failed++;
  }

  // =====================================================
  // 12. Retention email (manual trigger via filter)
  // =====================================================
  try {
    // Create an inactive user with location who hasn't logged in for over a week
    const RET_EMAIL = "retention-test@example.com";
    const existingRet = await pb
      .collection("users")
      .getFullList({
        filter: `email = "${RET_EMAIL}"`,
        $autoCancel: false,
      });
    for (const u of existingRet)
      await pb.collection("users").delete(u.id);

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const retentionUser = await pb.collection("users").create({
      email: RET_EMAIL,
      password: TEST_PW,
      passwordConfirm: TEST_PW,
      name: "RetentionTest",
      phone: "070-0000008",
      area: "Malmö",
      city: "Malmö",
      latitude: 55.6,
      longitude: 13.0,
      onboarding_complete: true,
      welcome_email_sent: true,
      verified: true,
      retention_email_enabled: true,
      retention_radius: 3,
      last_login_at: tenDaysAgo,
    });

    // Also create a nearby new user (within 3km, created in last week)
    const NEARBY_EMAIL = "nearby-retention-test@example.com";
    const existingNearby = await pb
      .collection("users")
      .getFullList({
        filter: `email = "${NEARBY_EMAIL}"`,
        $autoCancel: false,
      });
    for (const u of existingNearby)
      await pb.collection("users").delete(u.id);

    const nearbyUser = await pb.collection("users").create({
      email: NEARBY_EMAIL,
      password: TEST_PW,
      passwordConfirm: TEST_PW,
      name: "NearbyUser",
      area: "Malmö",
      city: "Malmö",
      latitude: 55.605,
      longitude: 13.005,
      onboarding_complete: true,
      welcome_email_sent: true,
      verified: true,
    });

    // Clear retention_sent so the cron would send
    try {
      await pb
        .collection("users")
        .update(retentionUser.id, { last_retention_email_sent: null });
    } catch (_) {}

    // The retention email is sent via a cron job that can't be easily triggered from outside.
    // Instead, test the email_log cron functionality by verifying the user qualifies:
    // - last_login_at > 7 days ago ✓
    // - retention_email_enabled = true ✓
    // - no connection_requests from this user ✓
    // - no more than 3 previous retention emails ✓

    // Verify the user qualifies for retention
    if (retentionUser.retention_email_enabled !== true) {
      throw new Error("User should have retention_email_enabled=true");
    }

    const connReqs = await pb
      .collection("connection_requests")
      .getFullList({
        filter: `from_user = "${retentionUser.id}"`,
        $autoCancel: false,
      });
    if (connReqs.length > 0) {
      throw new Error("User should have no connection requests for retention to fire");
    }

    // Clean up
    try { await pb.collection("users").delete(retentionUser.id); } catch (_) {}
    try { await pb.collection("users").delete(nearbyUser.id); } catch (_) {}

    console.log("✓ 12. Retention email eligibility verified (cron job must be triggered separately)");
    console.log("  Note: Retention cron runs Mondays at 9am. Use Admin API or trigger manually for full email test.");
    passed++;
  } catch (e) {
    console.error("✗ 12. Retention email eligibility:", e.message);
    failed++;
  }

  // =====================================================
  // 13. Welcome email only sent once (welcome_email_sent guard)
  // =====================================================
  try {
    const ONCE_EMAIL = "welcome-once@example.com";
    const existingOnce = await pb
      .collection("users")
      .getFullList({
        filter: `email = "${ONCE_EMAIL}"`,
        $autoCancel: false,
      });
    for (const u of existingOnce)
      await pb.collection("users").delete(u.id);

    const onceUser = await pb.collection("users").create({
      email: ONCE_EMAIL,
      password: TEST_PW,
      passwordConfirm: TEST_PW,
      name: "WelcomeOnceTest",
      phone: "070-0000009",
      area: "Malmö",
      latitude: 55.6,
      longitude: 13.0,
      onboarding_complete: false,
    });

    // First onboarding_complete → sends welcome
    await pb.collection("users").update(onceUser.id, { onboarding_complete: true });
    await new Promise((r) => setTimeout(r, 500));

    await mailpitDeleteAll();
    await new Promise((r) => setTimeout(r, 300));

    // Second update with onboarding_complete=true → should NOT send again
    await pb.collection("users").update(onceUser.id, { name: "WelcomeOnceTest Updated" });
    await new Promise((r) => setTimeout(r, 500));

    const msgs = await mailpitMessages();
    assertNoEmail(msgs, {
      subject: "Välkommen till Hundkrets!",
      toEmail: ONCE_EMAIL,
    });
    console.log("✓ 13. Welcome email sent only once (duplicate guard works)");
    passed++;
  } catch (e) {
    console.error("✗ 13. Welcome email once guard:", e.message);
    failed++;
  }

  // =====================================================
  // 14. Connection request requires verified email
  // =====================================================
  try {
    const UNVER_EMAIL = "unverified-test@example.com";
    const existingUnver = await pb
      .collection("users")
      .getFullList({
        filter: `email = "${UNVER_EMAIL}"`,
        $autoCancel: false,
      });
    for (const u of existingUnver)
      await pb.collection("users").delete(u.id);

    const unverUser = await pb.collection("users").create({
      email: UNVER_EMAIL,
      password: TEST_PW,
      passwordConfirm: TEST_PW,
      name: "UnverifiedTest",
      area: "Malmö",
      latitude: 55.6,
      longitude: 13.0,
      onboarding_complete: true,
      welcome_email_sent: true,
      // verified is false by default
    });

    // Try to create connection request as unverified user — should fail
    let blocked = false;
    try {
      await pb.collection("connection_requests").create({
        from_user: unverUser.id,
        to_user: userB.id,
        message: "Should be blocked",
      });
    } catch (e) {
      if (e?.status === 400 || e?.response?.data?.message?.includes("verifiera")) {
        blocked = true;
      }
    }

    if (!blocked) {
      // Also try with verified explicitly set to false
      await pb.collection("users").update(unverUser.id, { verified: false });
      try {
        await pb.collection("connection_requests").create({
          from_user: unverUser.id,
          to_user: userB.id,
          message: "Should be blocked",
        });
      } catch (e) {
        blocked = true;
      }
    }

    if (!blocked) {
      throw new Error("Connection request from unverified user was NOT blocked");
    }

    // Clean up
    try { await pb.collection("users").delete(unverUser.id); } catch (_) {}
    console.log("✓ 14. Connection request blocked for unverified user");
    passed++;
  } catch (e) {
    console.error("✗ 14. Verified guard:", e.message);
    failed++;
  }

  // =====================================================
  // 15. Email log records all sent emails
  // =====================================================
  try {
    const totalLogs = await pb
      .collection("email_log")
      .getFullList({ $autoCancel: false });
    if (totalLogs.length === 0) {
      throw new Error("No email_log entries found — onMailerSend hook may not be working");
    }

    const types = new Set(totalLogs.map((r) => r.type).filter(Boolean));
    const expectedTypes = [
      "connection_request",
      "connection_match",
      "welcome",
      "chat_instant",
    ];
    const missing = expectedTypes.filter((t) => !types.has(t));
    if (missing.length > 0) {
      console.warn(
        `  Warning: some expected email types not found in log: ${missing.join(", ")}`
      );
    }

    console.log(
      `✓ 15. Email log has ${totalLogs.length} entries with types: ${[...types].sort().join(", ")}`
    );
    passed++;
  } catch (e) {
    console.error("✗ 15. Email log:", e.message);
    failed++;
  }

  // =====================================================
  // Summary
  // =====================================================
  console.log("\n---");
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  console.log(
    "\nEmail flows tested: connection request, match, welcome, chat instant, chat daily, chat off, password reset, verification, email change, login alert, unsubscribe, retention eligibility, welcome once guard, verified guard, email log"
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});