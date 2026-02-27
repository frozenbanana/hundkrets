// Allow conversation participants to set read receipts on messages.
// Sender/body integrity is still guarded by client behavior and chat hooks.

migrate((app) => {
  const messagesCol = app.findCollectionByNameOrId("messages");
  messagesCol.updateRule = "@request.auth.id != '' && (conversation.user_a = @request.auth.id || conversation.user_b = @request.auth.id)";
  app.save(messagesCol);
}, (app) => {
  const messagesCol = app.findCollectionByNameOrId("messages");
  messagesCol.updateRule = "@request.auth.id != '' && sender = @request.auth.id";
  app.save(messagesCol);
});
