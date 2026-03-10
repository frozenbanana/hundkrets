migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  if (!usersCol.fields.getByName("retention_email_enabled")) {
    usersCol.fields.add(new BoolField({ name: "retention_email_enabled", required: false, defaultValue: true }));
  }
  if (!usersCol.fields.getByName("last_retention_email_sent")) {
    usersCol.fields.add(new DateField({ name: "last_retention_email_sent", required: false }));
  }
  app.save(usersCol);
}, (app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  usersCol.fields.removeByName("retention_email_enabled");
  usersCol.fields.removeByName("last_retention_email_sent");
  app.save(usersCol);
});