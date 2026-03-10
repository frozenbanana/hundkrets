migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  var field = usersCol.fields.getByName("retention_email_enabled");
  if (field) {
    field.required = false;
    usersCol.fields.add(field);
    usersCol.fields.removeByName("retention_email_enabled");
    usersCol.fields.add(field);
  }
  app.save(usersCol);
}, (app) => {
  // no-op
});