// Add onboarding_complete to users - true when user finishes onboarding (capacity step)

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  if (!usersCol.fields.getByName("onboarding_complete")) {
    usersCol.fields.add(new BoolField({ name: "onboarding_complete", required: false }));
  }
  app.save(usersCol);
}, (app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  usersCol.fields.removeByName("onboarding_complete");
  app.save(usersCol);
});
