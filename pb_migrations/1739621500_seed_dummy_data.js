// Seed dummy data for testing matches
// Area: "Portland - Hawthorne" - set your profile to Portland / Hawthorne to see matches

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  const dogsCol = app.findCollectionByNameOrId("dogs");
  const needsCol = app.findCollectionByNameOrId("watch_needs");
  const capacityCol = app.findCollectionByNameOrId("watch_capacity");

  const AREA = "Malmö - Västra Hamnen";
  const CITY = "Malmö";
  const NEIGHBORHOOD = "Västra Hamnen";
  const ADDRESS = "Västra Hamnen, Malmö, Sweden";

  // Skip if dummy users already exist
  try {
    const existing = app.findAuthRecordByEmail("users", "jane.dogwatch@example.com");
    if (existing) return; // already seeded
  } catch (_) {}

  const users = [];
  for (const u of [
    { email: "jane.dogwatch@example.com", name: "Jane", phone: "555-0101", lat: 55.608, lon: 12.976 },
    { email: "mike.dogwatch@example.com", name: "Mike", phone: "555-0102", lat: 55.612, lon: 12.984 },
  ]) {
    const record = new Record(usersCol);
    record.set("email", u.email);
    record.setPassword("password123");
    record.set("name", u.name);
    record.set("phone", u.phone);
    record.set("area", AREA);
    record.set("city", CITY);
    record.set("neighborhood", NEIGHBORHOOD);
    record.set("address_private", ADDRESS);
    record.set("latitude", u.lat);
    record.set("longitude", u.lon);
    app.save(record);
    users.push(record);
  }

  const dogSpecs = [
    { name: "Buddy", breed: "Golden Retriever", size: "medium", gender: "male" },
    { name: "Luna", breed: "Labrador", size: "large", gender: "female" },
  ];
  const dogs = [];
  for (let i = 0; i < users.length; i++) {
    const rec = new Record(dogsCol);
    rec.set("owner", users[i].id);
    rec.set("name", dogSpecs[i].name);
    rec.set("breed", dogSpecs[i].breed);
    rec.set("size", dogSpecs[i].size);
    rec.set("gender", dogSpecs[i].gender);
    app.save(rec);
    dogs.push(rec);
  }

  for (let i = 0; i < users.length; i++) {
    const needRec = new Record(needsCol);
    needRec.set("user", users[i].id);
    needRec.set("dog", dogs[i].id);
    needRec.set("flexible_dates", true);
    needRec.set("open_any_duration", true);
    app.save(needRec);

    const capRec = new Record(capacityCol);
    capRec.set("user", users[i].id);
    capRec.set("flexible_dates", true);
    capRec.set("open_any_duration", true);
    capRec.set("dog_sizes", ["small", "medium", "large"]);
    capRec.set("dog_genders", "any");
    capRec.set("max_dogs", 1);
    app.save(capRec);
  }
}, () => {});
