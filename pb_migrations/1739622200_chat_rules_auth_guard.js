// Chat rules: guard @request.auth before .id access to avoid 400 on unauthenticated requests

migrate((app) => {
  const conversationsCol = app.findCollectionByNameOrId("conversations");
  conversationsCol.listRule = "@request.auth.id != '' && (user_a = @request.auth.id || user_b = @request.auth.id)";
  conversationsCol.viewRule = "@request.auth.id != '' && (user_a = @request.auth.id || user_b = @request.auth.id)";
  conversationsCol.createRule = "@request.auth.id != '' && (user_a = @request.auth.id || user_b = @request.auth.id)";
  conversationsCol.updateRule = "@request.auth.id != '' && (user_a = @request.auth.id || user_b = @request.auth.id)";
  conversationsCol.deleteRule = "@request.auth.id != '' && (user_a = @request.auth.id || user_b = @request.auth.id)";
  app.save(conversationsCol);

  const messagesCol = app.findCollectionByNameOrId("messages");
  messagesCol.listRule = "@request.auth.id != '' && (conversation.user_a = @request.auth.id || conversation.user_b = @request.auth.id)";
  messagesCol.viewRule = "@request.auth.id != '' && (conversation.user_a = @request.auth.id || conversation.user_b = @request.auth.id)";
  messagesCol.createRule = "@request.auth.id != '' && sender = @request.auth.id && (conversation.user_a = @request.auth.id || conversation.user_b = @request.auth.id)";
  messagesCol.updateRule = "@request.auth.id != '' && sender = @request.auth.id";
  messagesCol.deleteRule = "@request.auth.id != '' && sender = @request.auth.id";
  app.save(messagesCol);
}, (app) => {
  const conversationsCol = app.findCollectionByNameOrId("conversations");
  conversationsCol.listRule = "user_a = @request.auth.id || user_b = @request.auth.id";
  conversationsCol.viewRule = "user_a = @request.auth.id || user_b = @request.auth.id";
  conversationsCol.createRule = "user_a = @request.auth.id || user_b = @request.auth.id";
  conversationsCol.updateRule = "user_a = @request.auth.id || user_b = @request.auth.id";
  conversationsCol.deleteRule = "user_a = @request.auth.id || user_b = @request.auth.id";
  app.save(conversationsCol);

  const messagesCol = app.findCollectionByNameOrId("messages");
  messagesCol.listRule = "conversation.user_a = @request.auth.id || conversation.user_b = @request.auth.id";
  messagesCol.viewRule = "conversation.user_a = @request.auth.id || conversation.user_b = @request.auth.id";
  messagesCol.createRule = "sender = @request.auth.id && (conversation.user_a = @request.auth.id || conversation.user_b = @request.auth.id)";
  messagesCol.updateRule = "sender = @request.auth.id";
  messagesCol.deleteRule = "sender = @request.auth.id";
  app.save(messagesCol);
});
