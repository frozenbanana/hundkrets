// Track whether welcome email has been sent (avoids duplicate emails on profile updates)

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  if (!usersCol.fields.getByName("welcome_email_sent")) {
    usersCol.fields.add(new BoolField({ name: "welcome_email_sent", required: false }));
  }
  app.save(usersCol);
}, (app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  usersCol.fields.removeByName("welcome_email_sent");
  app.save(usersCol);
});
