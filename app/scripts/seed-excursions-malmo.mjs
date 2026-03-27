#!/usr/bin/env node
/**
 * Seed excursions + relation mix around Malmö/Skåne.
 * - Creates upcoming excursions
 * - Creates a mix of one-way interests and mutual matches
 *
 * Run:
 *   node app/scripts/seed-excursions-malmo.mjs
 */

import PocketBase from "pocketbase";

const PB_URL = process.env.VITE_POCKETBASE_URL || process.env.PB_URL || "http://127.0.0.1:8090";
const PASSWORD = process.env.SEED_USER_PASSWORD || "password123!";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || "admin@test.com";
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || "adminpass123";

const USERS = [
  "anna.malmo@example.com",
  "erik.malmo@example.com",
  "sofia.malmo@example.com",
  "lars.malmo@example.com",
  "emma.malmo@example.com",
  "johan.malmo@example.com",
  "lisa.malmo@example.com",
  "mikael.malmo@example.com",
  "sara.malmo@example.com",
  "peter.malmo@example.com",
];

const EXCURSIONS = [
  {
    host: "anna.malmo@example.com",
    title: "Hundträff i Torups bokskog - alla välkomna, 2 timmar",
    description:
      "Vi går en lugn runda i Torupsskogen (ca 5 km) och tar gärna en kaffe vid friluftsområdet efteråt.",
    meeting_area: "Torupsskogen, Svedala",
    lat: 55.5457,
    lon: 13.0855,
    visibility: "public",
    duration_hours: 2,
    daysFromNow: 2,
  },
  {
    host: "erik.malmo@example.com",
    title: "Hundträff i Skrylle - alla välkomna, 3 timmar",
    description:
      "Vi ses vid parkeringen i Skrylle, går en längre skogsrunda och pausar för fika halvvägs.",
    meeting_area: "Skrylle, Södra Sandby",
    lat: 55.6985,
    lon: 13.4131,
    visibility: "public",
    duration_hours: 3,
    daysFromNow: 3,
  },
  {
    host: "sofia.malmo@example.com",
    title: "Hundträff vid Saxtorpssjöarna - för matchade, 2 timmar",
    description:
      "Social promenad runt sjöarna i lugnt tempo. Efteråt kan vi stanna en stund vid parkeringen.",
    meeting_area: "Saxtorpssjöarna",
    lat: 55.8705,
    lon: 12.9645,
    visibility: "matched_only",
    duration_hours: 2,
    daysFromNow: 4,
  },
  {
    host: "lars.malmo@example.com",
    title: "Hundträff på Lomma hundstrand - alla välkomna, 2 timmar",
    description:
      "Vi låter hundarna springa av sig på stranden och tar en kort promenad längs vattnet efteråt.",
    meeting_area: "Lomma hundstrand",
    lat: 55.6856,
    lon: 13.0468,
    visibility: "public",
    duration_hours: 2,
    daysFromNow: 5,
  },
  {
    host: "emma.malmo@example.com",
    title: "Hundträff i Bulltofta rekreationsområde - för intressekontakter, 2 timmar",
    description:
      "Lugn vardagsrunda i grönområdet. Vi kan ta en snabb fika på vägen tillbaka.",
    meeting_area: "Bulltofta rekreationsområde",
    lat: 55.6092,
    lon: 13.0539,
    visibility: "interested_by_me",
    duration_hours: 2,
    daysFromNow: 6,
  },
  {
    host: "johan.malmo@example.com",
    title: "Hundträff i Pildammsparken - alla välkomna, 2 timmar",
    description:
      "Vi går runt dammarna i Pildammsparken och avslutar med en kort paus vid gräsytan.",
    meeting_area: "Pildammsparken, Malmö",
    lat: 55.5927,
    lon: 12.9898,
    visibility: "public",
    duration_hours: 2,
    daysFromNow: 7,
  },
];

const CONNECTIONS = [
  // mutual matches
  ["anna.malmo@example.com", "erik.malmo@example.com", true],
  ["sofia.malmo@example.com", "lars.malmo@example.com", true],
  // one-way requests
  ["peter.malmo@example.com", "emma.malmo@example.com", false],
  ["johan.malmo@example.com", "lisa.malmo@example.com", false],
  ["mikael.malmo@example.com", "sara.malmo@example.com", false],
];

const EXCURSION_INTERESTS = [
  ["anna.malmo@example.com", "Hundträff i Skrylle - alla välkomna, 3 timmar"],
  ["lisa.malmo@example.com", "Hundträff i Torups bokskog - alla välkomna, 2 timmar"],
  ["peter.malmo@example.com", "Hundträff på Lomma hundstrand - alla välkomna, 2 timmar"],
];

function startAt(daysFromNow = 1) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(15, 0, 0, 0);
  return d.toISOString();
}

function mapsUrl(lat, lon) {
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

async function authAsUser(pb, email) {
  pb.authStore.clear();
  await pb.collection("users").authWithPassword(email, PASSWORD);
}

async function ensureConnection(pb, userIdByEmail, fromEmail, toEmail, mutual = false) {
  const fromUserId = userIdByEmail.get(fromEmail);
  const toUserId = userIdByEmail.get(toEmail);
  if (!fromUserId || !toUserId) {
    throw new Error(`Missing user IDs for connection ${fromEmail} -> ${toEmail}`);
  }

  await authAsUser(pb, fromEmail);
  const existingForward = await pb.collection("connection_requests").getFullList({
    filter: `from_user = "${fromUserId}" && to_user = "${toUserId}"`,
  });
  if (existingForward.length === 0) {
    await pb.collection("connection_requests").create({
      from_user: fromUserId,
      to_user: toUserId,
      message: "Hej! Vill gärna koppla ihop och hjälpa till med hundpassning.",
    });
  }

  if (!mutual) return;

  await authAsUser(pb, toEmail);
  const existingReverse = await pb.collection("connection_requests").getFullList({
    filter: `from_user = "${toUserId}" && to_user = "${fromUserId}"`,
  });
  if (existingReverse.length === 0) {
    await pb.collection("connection_requests").create({
      from_user: toUserId,
      to_user: fromUserId,
      message: "Toppen! Jag vill också koppla ihop.",
    });
  }
}

async function ensureExcursion(pb, item) {
  await authAsUser(pb, item.host);
  const existing = await pb.collection("excursions").getFullList({
    filter: `title = "${item.title.replace(/"/g, '\\"')}" && status = "scheduled"`,
  });
  if (existing.length > 0) return existing[0];

  return pb.collection("excursions").create({
    title: item.title,
    description: item.description,
    meeting_area: item.meeting_area,
    meeting_map_url: mapsUrl(item.lat, item.lon),
    meeting_latitude: item.lat,
    meeting_longitude: item.lon,
    start_at: startAt(item.daysFromNow),
    duration_hours: item.duration_hours,
    visibility: item.visibility,
    status: "scheduled",
  });
}

async function ensureExcursionInterest(pb, userEmail, excursionId) {
  await authAsUser(pb, userEmail);
  const userId = pb.authStore.model?.id;
  if (!userId) throw new Error(`Could not auth as ${userEmail}`);

  const already = await pb.collection("excursion_interests").getFullList({
    filter: `excursion = "${excursionId}" && user = "${userId}"`,
  });
  if (already.length > 0) return;
  await pb.collection("excursion_interests").create({ excursion: excursionId });
}

async function main() {
  const pb = new PocketBase(PB_URL);
  const pbAdmin = new PocketBase(PB_URL);

  console.log(`Seeding excursions on ${PB_URL} ...`);

  await pbAdmin.collection("_superusers").authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
  const users = await pbAdmin.collection("users").getFullList({ requestKey: null });
  const userIdByEmail = new Map(users.map((u) => [u.email, u.id]));
  for (const email of USERS) {
    if (!userIdByEmail.has(email)) {
      throw new Error(`User not found: ${email}. Run seed-malmo first.`);
    }
  }

  // 1) Create a connection mix (mutual matches + one-way interests)
  for (const [fromEmail, toEmail, mutual] of CONNECTIONS) {
    await ensureConnection(pb, userIdByEmail, fromEmail, toEmail, mutual);
    console.log(`Connection seeded: ${fromEmail} -> ${toEmail}${mutual ? " (mutual)" : ""}`);
  }

  // 2) Create upcoming excursions around Malmö/Skåne
  const excursionsByTitle = new Map();
  for (const item of EXCURSIONS) {
    const rec = await ensureExcursion(pb, item);
    excursionsByTitle.set(rec.title, rec.id);
    console.log(`Excursion seeded: ${rec.title}`);
  }

  // 3) Add a few excursion interests
  for (const [email, title] of EXCURSION_INTERESTS) {
    const excursionId = excursionsByTitle.get(title);
    if (!excursionId) {
      console.log(`Skipping interest, excursion not found in this run: ${title}`);
      continue;
    }
    try {
      await ensureExcursionInterest(pb, email, excursionId);
      console.log(`Excursion interest seeded: ${email} -> ${title}`);
    } catch (err) {
      console.log(`Interest skipped (${email} -> ${title}): ${err?.message || err}`);
    }
  }

  console.log("\n✓ Done. Dummy hundträffar + relation mix seeded.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
