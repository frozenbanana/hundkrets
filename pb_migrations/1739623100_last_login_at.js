// Add last_login_at to users - updated on login and app load for "Senast aktiv" sort

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  if (!usersCol.fields.getByName("last_login_at")) {
    usersCol.fields.add(new DateField({ name: "last_login_at", required: false }));
  }
  app.save(usersCol);
}, (app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  usersCol.fields.removeByName("last_login_at");
  app.save(usersCol);
});
