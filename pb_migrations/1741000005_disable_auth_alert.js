// Disable auth alert (login from new location emails)

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  if (usersCol.options && usersCol.options.authAlert) {
    usersCol.options.authAlert.enabled = false;
  }
  app.save(usersCol);
}, (app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  if (usersCol.options && usersCol.options.authAlert) {
    usersCol.options.authAlert.enabled = true;
  }
  app.save(usersCol);
});