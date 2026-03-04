// Email log collection - tracks all emails sent via PocketBase mailer

migrate((app) => {
  const col = new Collection({
    type: "base",
    name: "email_log",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "to", type: "text", required: true },
      { name: "subject", type: "text", required: false },
      { name: "sent_at", type: "date", required: true },
      { name: "type", type: "text", required: false, max: 64 },
    ],
  });

  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("email_log");
    app.delete(col);
  } catch (_) {}
});
