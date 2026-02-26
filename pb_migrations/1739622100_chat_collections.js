// Chat: conversations/messages + user notification preferences

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  const usersId = usersCol.id;

  if (!usersCol.fields.getByName("chat_email_frequency")) {
    usersCol.fields.add(new SelectField({
      name: "chat_email_frequency",
      required: false,
      maxSelect: 1,
      values: ["instant", "daily", "off"],
    }));
  }
  if (!usersCol.fields.getByName("chat_digest_last_sent_at")) {
    usersCol.fields.add(new DateField({ name: "chat_digest_last_sent_at", required: false }));
  }
  app.save(usersCol);

  const convCol = new Collection({
    type: "base",
    name: "conversations",
    listRule: "user_a = @request.auth.id || user_b = @request.auth.id",
    viewRule: "user_a = @request.auth.id || user_b = @request.auth.id",
    createRule: "user_a = @request.auth.id || user_b = @request.auth.id",
    updateRule: "user_a = @request.auth.id || user_b = @request.auth.id",
    deleteRule: "user_a = @request.auth.id || user_b = @request.auth.id",
    fields: [
      { name: "user_a", type: "relation", required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
      { name: "user_b", type: "relation", required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
      { name: "pair_key", type: "text", required: false, max: 128 },
      { name: "last_message_at", type: "date", required: false },
    ],
  });
  app.save(convCol);

  const convId = convCol.id;
  const messagesCol = new Collection({
    type: "base",
    name: "messages",
    listRule: "conversation.user_a = @request.auth.id || conversation.user_b = @request.auth.id",
    viewRule: "conversation.user_a = @request.auth.id || conversation.user_b = @request.auth.id",
    createRule: "sender = @request.auth.id && (conversation.user_a = @request.auth.id || conversation.user_b = @request.auth.id)",
    updateRule: "sender = @request.auth.id",
    deleteRule: "sender = @request.auth.id",
    fields: [
      { name: "conversation", type: "relation", required: true, maxSelect: 1, collectionId: convId, cascadeDelete: true },
      { name: "sender", type: "relation", required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
      { name: "body", type: "text", required: true, max: 2000 },
      { name: "read_at", type: "date", required: false },
    ],
  });
  app.save(messagesCol);
}, (app) => {
  try {
    const messagesCol = app.findCollectionByNameOrId("messages");
    app.delete(messagesCol);
  } catch (_) {}
  try {
    const convCol = app.findCollectionByNameOrId("conversations");
    app.delete(convCol);
  } catch (_) {}
  try {
    const usersCol = app.findCollectionByNameOrId("users");
    usersCol.fields.removeByName("chat_email_frequency");
    usersCol.fields.removeByName("chat_digest_last_sent_at");
    app.save(usersCol);
  } catch (_) {}
});
