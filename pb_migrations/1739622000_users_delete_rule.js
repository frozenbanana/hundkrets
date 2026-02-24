// Allow users to delete their own account (for settings danger zone)

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  usersCol.deleteRule = "id = @request.auth.id";
  app.save(usersCol);
}, (app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  usersCol.deleteRule = "";
  app.save(usersCol);
});
