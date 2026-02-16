// Add user bio and dog age

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  if (!usersCol.fields.getByName("bio")) {
    usersCol.fields.add(new TextField({ name: "bio", required: false }));
  }
  app.save(usersCol);

  const dogsCol = app.findCollectionByNameOrId("dogs");
  if (!dogsCol.fields.getByName("age")) {
    dogsCol.fields.add(new NumberField({ name: "age", required: false, min: 0, max: 25 }));
  }
  app.save(dogsCol);
}, (app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  usersCol.fields.removeByName("bio");
  app.save(usersCol);

  const dogsCol = app.findCollectionByNameOrId("dogs");
  dogsCol.fields.removeByName("age");
  app.save(dogsCol);
});
