// Add user_type to users - has_dogs | sitter_only | receiver_only (for Snabbåtgärder)

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  if (!usersCol.fields.getByName("user_type")) {
    usersCol.fields.add(
      new SelectField({
        name: "user_type",
        required: false,
        values: ["has_dogs", "sitter_only", "receiver_only"],
      })
    );
  }
  app.save(usersCol);
}, (app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  usersCol.fields.removeByName("user_type");
  app.save(usersCol);
});
