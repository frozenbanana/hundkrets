migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  if (!usersCol.fields.getByName("retention_radius")) {
    usersCol.fields.add(new NumberField({ name: "retention_radius", required: false, min: 1, max: 50, defaultValue: 3 }));
  }
  app.save(usersCol);
}, (app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  usersCol.fields.removeByName("retention_radius");
  app.save(usersCol);
});