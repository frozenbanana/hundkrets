// Disable auth alert for admin (superuser) logins

migrate((app) => {
  const col = app.findCollectionByNameOrId("_superusers");
  if (col.options && col.options.authAlert) {
    col.options.authAlert.enabled = false;
  }
  app.save(col);
}, (app) => {
  const col = app.findCollectionByNameOrId("_superusers");
  if (col.options && col.options.authAlert) {
    col.options.authAlert.enabled = true;
  }
  app.save(col);
});