// Enable auth alert (login alert) for users collection - sends email on new device sign-in

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  if (usersCol.options && usersCol.options.authAlert) {
    usersCol.options.authAlert.enabled = true;
  }
  app.save(usersCol);
}, (app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  if (usersCol.options && usersCol.options.authAlert) {
    usersCol.options.authAlert.enabled = false;
  }
  app.save(usersCol);
});
