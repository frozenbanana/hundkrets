// Postal codes collection: Swedish postnummer -> city (from CSV), area (user-contributed)
// Seeded by scripts/seed-postal-codes.mjs from sweden-zipcode.csv

migrate((app) => {
  const col = new Collection({
    type: "base",
    name: "postal_codes",
    listRule: "", // Public read for city/area lookup
    viewRule: "",
    createRule: "", // Only migrations/seed script
    updateRule: "", // Only server hooks update area
    deleteRule: "",
    fields: [
      { name: "postal_code", type: "text", required: true }, // 5 digits, no space (e.g. 21113)
      { name: "city", type: "text", required: true },
      { name: "area", type: "text", required: false }, // User-contributed, e.g. Västra Hamnen
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_postal_codes_postal_code ON postal_codes (postal_code)",
    ],
  });
  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("postal_codes");
    app.delete(col);
  } catch (_) {}
});
