// Seed 10 Malmö users with dogs, needs, capacities. Password: password123!
// Reset: rm -rf pb_data && ./pocketbase serve

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  const dogsCol = app.findCollectionByNameOrId("dogs");
  const needsCol = app.findCollectionByNameOrId("watch_needs");
  const capacityCol = app.findCollectionByNameOrId("watch_capacity");

  const PASSWORD = "password123!"; // User-requested password
  const CITY = "Malmö";

  // Skip if already seeded
  try {
    const existing = app.findAuthRecordByEmail("users", "anna.malmo@example.com");
    if (existing) return;
  } catch (_) {}

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

  const users = [];
  for (let i = 0; i < userSpecs.length; i++) {
    const u = userSpecs[i];
    const record = new Record(usersCol);
    record.set("email", u.email);
    record.setPassword(PASSWORD);
    record.set("name", u.name);
    record.set("phone", u.phone);
    record.set("area", u.area);
    record.set("city", CITY);
    record.set("neighborhood", u.neighborhood);
    record.set("address_private", `${u.neighborhood}, ${CITY}, Sverige`);
    record.set("latitude", u.lat);
    record.set("longitude", u.lon);
    app.save(record);
    users.push(record);
  }

  const dogs = [];
  for (let i = 0; i < users.length; i++) {
    const d = dogSpecs[i];
    const rec = new Record(dogsCol);
    rec.set("owner", users[i].id);
    rec.set("name", d.name);
    rec.set("breed", d.breed);
    rec.set("size", d.size);
    rec.set("gender", d.gender);
    app.save(rec);
    dogs.push(rec);
  }

  // Variety: some flexible, some with specific dates; some with open_any_duration, some with notes
  const needOpts = [
    { flexible: true, openAny: true },
    { flexible: true, openAny: false, durationSpecific: "Helger i juli" },
    { flexible: true, openAny: true },
    { flexible: false, startDate: "2025-06-01", endDate: "2025-06-15" },
    { flexible: true, openAny: true },
    { flexible: true, openAny: false, durationSpecific: "Vardagar" },
    { flexible: true, openAny: true },
    { flexible: false, startDate: "2025-07-10", endDate: "2025-07-25" },
    { flexible: true, openAny: true },
    { flexible: true, openAny: true },
  ];

  const capOpts = [
    { flexible: true, openAny: true, sizes: ["small", "medium", "large"], genders: "any", max: 2 },
    { flexible: true, openAny: false, durationSpecific: "Eftermiddagar", sizes: ["small", "medium"], genders: "any", max: 1 },
    { flexible: true, openAny: true, sizes: ["medium", "large"], genders: "female", max: 1 },
    { flexible: false, startDate: "2025-06-01", endDate: "2025-06-30", sizes: ["small", "medium", "large"], genders: "any", max: 2 },
    { flexible: true, openAny: true, sizes: ["small"], genders: "any", max: 1 },
    { flexible: true, openAny: true, sizes: ["small", "medium", "large"], genders: "any", max: 3 },
    { flexible: true, openAny: false, durationSpecific: "Helger", sizes: ["medium", "large"], genders: "male", max: 1 },
    { flexible: true, openAny: true, sizes: ["small", "medium", "large"], genders: "any", max: 2 },
    { flexible: false, startDate: "2025-08-01", endDate: "2025-08-15", sizes: ["small", "medium"], genders: "any", max: 1 },
    { flexible: true, openAny: true, sizes: ["small", "medium", "large"], genders: "any", max: 2 },
  ];

  for (let i = 0; i < users.length; i++) {
    const n = needOpts[i];
    const needRec = new Record(needsCol);
    needRec.set("user", users[i].id);
    needRec.set("dog", dogs[i].id);
    needRec.set("flexible_dates", n.flexible);
    needRec.set("open_any_duration", n.openAny ?? true);
    if (n.durationSpecific) needRec.set("duration_specific", n.durationSpecific);
    if (!n.flexible && n.startDate) {
      needRec.set("start_date", n.startDate);
      needRec.set("end_date", n.endDate);
    }
    app.save(needRec);

    const c = capOpts[i];
    const capRec = new Record(capacityCol);
    capRec.set("user", users[i].id);
    capRec.set("flexible_dates", c.flexible);
    capRec.set("open_any_duration", c.openAny ?? true);
    if (c.durationSpecific) capRec.set("duration_specific", c.durationSpecific);
    if (!c.flexible && c.startDate) {
      capRec.set("start_date", c.startDate);
      capRec.set("end_date", c.endDate);
    }
    capRec.set("dog_sizes", c.sizes);
    capRec.set("dog_genders", c.genders);
    capRec.set("max_dogs", c.max);
    app.save(capRec);
  }
}, () => {});
