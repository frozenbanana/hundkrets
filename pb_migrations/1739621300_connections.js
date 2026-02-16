// Connection requests: when both users click "Interested", phone numbers are exchanged

migrate((app) => {
  const usersId = app.findCollectionByNameOrId("users").id;

  const connCol = new Collection({
    type: "base",
    name: "connection_requests",
    listRule: "from_user = @request.auth.id || to_user = @request.auth.id",
    viewRule: "from_user = @request.auth.id || to_user = @request.auth.id",
    createRule: "@request.auth.id != ''",
    updateRule: "from_user = @request.auth.id || to_user = @request.auth.id",
    deleteRule: "from_user = @request.auth.id || to_user = @request.auth.id",
    fields: [
      { name: "from_user", type: "relation", required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
      { name: "to_user", type: "relation", required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
    ],
  });
  app.save(connCol);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("connection_requests");
    app.delete(col);
  } catch (_) {}
});
