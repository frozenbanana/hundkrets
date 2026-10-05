// Superuser-only store for the retention unsubscribe signing secret.
// API rules are closed; hooks read and write through the app handle.

migrate((app) => {
  const col = new Collection({
    type: "base",
    name: "internal_secrets",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    indexes: [
      "CREATE UNIQUE INDEX idx_internal_secrets_key ON internal_secrets (key)",
    ],
    fields: [
      { name: "key", type: "text", required: true, max: 128 },
      { name: "value", type: "text", required: true, max: 512 },
    ],
  });
  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("internal_secrets");
    app.delete(col);
  } catch (_) {}
});
