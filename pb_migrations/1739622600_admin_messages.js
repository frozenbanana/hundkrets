// Admin managed marquee/announcement messages for app users.

migrate((app) => {
  const col = new Collection({
    type: "base",
    name: "admin_messages",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "text", type: "text", required: true, max: 5000 },
      { name: "start_date", type: "date", required: true },
      { name: "end_date", type: "date", required: true },
      {
        name: "pages",
        type: "select",
        required: false,
        maxSelect: 8,
        values: ["all", "app_home", "profile", "dogs", "needs", "capacity", "chats", "matches"],
      },
      { name: "ttl_seconds", type: "number", required: false, min: 1 },
      { name: "message_type", type: "select", required: true, maxSelect: 1, values: ["news", "warning"] },
      { name: "is_moving", type: "bool", required: false },
    ],
  });

  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("admin_messages");
    app.delete(col);
  } catch (_) {}
});
