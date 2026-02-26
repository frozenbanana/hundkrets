// Fix message create rule: avoid relational rule eval on create that can yield 400
// Participant validation remains enforced in pb_hooks/main.pb.js

migrate((app) => {
  const messagesCol = app.findCollectionByNameOrId("messages");
  messagesCol.createRule = "@request.auth.id != '' && sender = @request.auth.id";
  app.save(messagesCol);
}, (app) => {
  const messagesCol = app.findCollectionByNameOrId("messages");
  messagesCol.createRule = "@request.auth.id != '' && sender = @request.auth.id && (conversation.user_a = @request.auth.id || conversation.user_b = @request.auth.id)";
  app.save(messagesCol);
});
