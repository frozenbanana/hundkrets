#!/usr/bin/env node
/**
 * Seed 10 Malmö users with dogs, needs, capacities via PocketBase API.
 * Run: node app/scripts/seed-malmo.mjs
 * Requires: PocketBase running, pb_data reset (or run reset-and-seed.sh first)
 * Password for all: password123!
 */

import PocketBase from "pocketbase";

const PB_URL = process.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";
const PASSWORD = "password123!";

const userSpecs = [
  { email: "anna.malmo@example.com", name: "Anna", phone: "070-111 22 01", area: "Malmö - Västra Hamnen", neighborhood: "Västra Hamnen", lat: 55.608, lon: 12.976 },
  { email: "erik.malmo@example.com", name: "Erik", phone: "070-111 22 02", area: "Malmö - Möllevången", neighborhood: "Möllevången", lat: 55.592, lon: 13.002 },
  { email: "sofia.malmo@example.com", name: "Sofia", phone: "070-111 22 03", area: "Malmö - Limhamn", neighborhood: "Limhamn", lat: 55.578, lon: 12.945 },
  { email: "lars.malmo@example.com", name: "Lars", phone: "070-111 22 04", area: "Malmö - Centrum", neighborhood: "Centrum", lat: 55.605, lon: 13.000 },
  { email: "emma.malmo@example.com", name: "Emma", phone: "070-111 22 05", area: "Malmö - Hyllie", neighborhood: "Hyllie", lat: 55.565, lon: 12.976 },
  { email: "johan.malmo@example.com", name: "Johan", phone: "070-111 22 06", area: "Malmö - Kirseberg", neighborhood: "Kirseberg", lat: 55.615, lon: 13.045 },
  { email: "lisa.malmo@example.com", name: "Lisa", phone: "070-111 22 07", area: "Malmö - Ribersborg", neighborhood: "Ribersborg", lat: 55.598, lon: 12.982 },
  { email: "mikael.malmo@example.com", name: "Mikael", phone: "070-111 22 08", area: "Malmö - Södra Innerstaden", neighborhood: "Södra Innerstaden", lat: 55.588, lon: 13.008 },
  { email: "sara.malmo@example.com", name: "Sara", phone: "070-111 22 09", area: "Malmö - Slottsstaden", neighborhood: "Slottsstaden", lat: 55.595, lon: 12.992 },
  { email: "peter.malmo@example.com", name: "Peter", phone: "070-111 22 10", area: "Malmö - Östra Sorgenfri", neighborhood: "Östra Sorgenfri", lat: 55.612, lon: 13.028 },
];

const dogSpecs = [
  { name: "Buddy", breed: "Golden Retriever", size: "medium", gender: "male" },
  { name: "Luna", breed: "Labrador", size: "large", gender: "female" },
  { name: "Bella", breed: "Cocker Spaniel", size: "small", gender: "female" },
  { name: "Max", breed: "Schäfer", size: "large", gender: "male" },
  { name: "Molly", breed: "Blandras", size: "medium", gender: "female" },
  { name: "Charlie", breed: "Beagle", size: "medium", gender: "male" },
  { name: "Daisy", breed: "Cavalier", size: "small", gender: "female" },
  { name: "Rocky", breed: "Border Collie", size: "medium", gender: "male" },
  { name: "Nala", breed: "Husky", size: "large", gender: "female" },
  { name: "Teddy", breed: "Pudel", size: "small", gender: "male" },
];

const needOpts = [
  { flexible_dates: true, open_any_duration: true },
  { flexible_dates: true, open_any_duration: false, duration_specific: "Helger i juli" },
  { flexible_dates: true, open_any_duration: true },
  { flexible_dates: false, start_date: "2025-06-01", end_date: "2025-06-15" },
  { flexible_dates: true, open_any_duration: true },
  { flexible_dates: true, open_any_duration: false, duration_specific: "Vardagar" },
  { flexible_dates: true, open_any_duration: true },
  { flexible_dates: false, start_date: "2025-07-10", end_date: "2025-07-25" },
  { flexible_dates: true, open_any_duration: true },
  { flexible_dates: true, open_any_duration: true },
];

const capOpts = [
  { flexible_dates: true, open_any_duration: true, dog_sizes: ["small", "medium", "large"], dog_genders: "any", max_dogs: 2 },
  { flexible_dates: true, open_any_duration: false, duration_specific: "Eftermiddagar", dog_sizes: ["small", "medium"], dog_genders: "any", max_dogs: 1 },
  { flexible_dates: true, open_any_duration: true, dog_sizes: ["medium", "large"], dog_genders: "female", max_dogs: 1 },
  { flexible_dates: false, start_date: "2025-06-01", end_date: "2025-06-30", dog_sizes: ["small", "medium", "large"], dog_genders: "any", max_dogs: 2 },
  { flexible_dates: true, open_any_duration: true, dog_sizes: ["small"], dog_genders: "any", max_dogs: 1 },
  { flexible_dates: true, open_any_duration: true, dog_sizes: ["small", "medium", "large"], dog_genders: "any", max_dogs: 3 },
  { flexible_dates: true, open_any_duration: false, duration_specific: "Helger", dog_sizes: ["medium", "large"], dog_genders: "male", max_dogs: 1 },
  { flexible_dates: true, open_any_duration: true, dog_sizes: ["small", "medium", "large"], dog_genders: "any", max_dogs: 2 },
  { flexible_dates: false, start_date: "2025-08-01", end_date: "2025-08-15", dog_sizes: ["small", "medium"], dog_genders: "any", max_dogs: 1 },
  { flexible_dates: true, open_any_duration: true, dog_sizes: ["small", "medium", "large"], dog_genders: "any", max_dogs: 2 },
];

async function main() {
  const pb = new PocketBase(PB_URL);

  // Create users via public registration (no admin auth needed)
  const users = [];
  for (let i = 0; i < userSpecs.length; i++) {
    const u = userSpecs[i];
    let record;
    try {
      record = await pb.collection("users").create({
        email: u.email,
        password: PASSWORD,
        passwordConfirm: PASSWORD,
        name: u.name,
        phone: u.phone,
        area: u.area,
        city: "Malmö",
        neighborhood: u.neighborhood,
        address_private: `${u.neighborhood}, Malmö, Sverige`,
        latitude: u.lat,
        longitude: u.lon,
        onboarding_complete: true,
      });
    } catch (e) {
      if (e?.status === 400 && (String(e?.message || "").includes("already") || e?.data?.email)) {
        const auth = await pb.collection("users").authWithPassword(u.email, PASSWORD);
        record = auth.record;
        console.log(`Reusing ${u.name} (${u.email})`);
      } else {
        throw e;
      }
    }
    users.push(record);
    console.log(`Created ${u.name} (${u.email})`);
  }

  for (let i = 0; i < users.length; i++) {
    pb.authStore.clear();
    await pb.collection("users").authWithPassword(userSpecs[i].email, PASSWORD);
    const d = dogSpecs[i];
    const dog = await pb.collection("dogs").create({
      owner: users[i].id,
      name: d.name,
      breed: d.breed,
      size: d.size,
      gender: d.gender,
    });
    const n = needOpts[i];
    await pb.collection("watch_needs").create({
      user: users[i].id,
      dog: dog.id,
      ...n,
    });
    const c = capOpts[i];
    await pb.collection("watch_capacity").create({
      user: users[i].id,
      ...c,
    });
  }

  console.log("\n✓ Seeded 10 Malmö users with dogs, needs, capacities.");
  console.log("  Login: anna@malmo.seed (or any) / password123!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
