// Add avatar (profile photo) field to users collection

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  if (!usersCol.fields.getByName("avatar")) {
    usersCol.fields.add(new FileField({ name: "avatar", required: false, maxSelect: 1, maxSize: 5242880, thumbs: ["100x100f"] }));
  }
  app.save(usersCol);
}, (app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  usersCol.fields.removeByName("avatar");
  app.save(usersCol);
});
