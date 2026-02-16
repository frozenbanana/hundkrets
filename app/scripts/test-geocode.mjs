#!/usr/bin/env node
/**
 * Isolated test for Photon geocoding API.
 * Run: node app/scripts/test-geocode.mjs
 */

const PHOTON_BASE = "https://photon.komoot.io";

async function test(name, url) {
  console.log(`\n--- ${name} ---`);
  console.log("URL:", url);
  try {
    const res = await fetch(url);
    console.log("Status:", res.status, res.statusText);
    if (!res.ok) {
      const text = await res.text();
      console.log("Body:", text.slice(0, 500));
      return false;
    }
    const data = await res.json();
    const count = data.features?.length ?? 0;
    console.log("Features:", count);
    if (count > 0) {
      const first = data.features[0];
      console.log("First:", first.properties?.name ?? first.properties?.street, first.geometry?.coordinates);
    }
    return true;
  } catch (err) {
    console.error("Error:", err.message);
    return false;
  }
}

async function main() {
  console.log("Photon API isolated test\n");

  // Test 1: Minimal - just q (like Photon docs)
  await test("1. Minimal (q=berlin)", `${PHOTON_BASE}/api/?q=berlin&limit=3`);

  // Test 2: City search - Malmö Sverige (our searchCitiesSweden, no lang - Photon only supports de,en,fr)
  const cityParams = new URLSearchParams({ q: "Malmö Sverige", limit: "15" });
  await test("2. City search (Malmö Sverige)", `${PHOTON_BASE}/api/?${cityParams}`);

  // Test 3: Street search - Storgatan, Malmö (our searchAddress with city)
  const streetParams = new URLSearchParams({ q: "Storgatan, Malmö, Sverige", limit: "15" });
  await test("3. Street search (Storgatan Malmö)", `${PHOTON_BASE}/api/?${streetParams}`);

  console.log("\n--- Done ---");
}

main();
