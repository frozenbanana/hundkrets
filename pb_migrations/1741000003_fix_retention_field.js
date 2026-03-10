migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  const field = usersCol.fields.getByName("retention_email_enabled");
  if (field) {
    field.required = false;
    field.defaultValue = true;
    app.save(usersCol);
  }
}, (app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  const field = usersCol.fields.getByName("retention_email_enabled");
  if (field) {
    field.required = true;
    field.defaultValue = false;
    app.save(usersCol);
  }
});