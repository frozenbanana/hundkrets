// Profile: breeds owned, multi-select sizes, dog temperament by setting

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  if (!usersCol.fields.getByName("breeds_owned_before")) {
    usersCol.fields.add(new TextField({ name: "breeds_owned_before", required: false }));
  }
  app.save(usersCol);

  const dogsCol = app.findCollectionByNameOrId("dogs");
  const tempOpts = ["friendly", "cautious", "shy", "reactive", "neutral", "unknown"];
  if (!dogsCol.fields.getByName("temperament_new_people")) {
    dogsCol.fields.add(new SelectField({ name: "temperament_new_people", required: false, values: tempOpts }));
  }
  if (!dogsCol.fields.getByName("temperament_new_dogs_female")) {
    dogsCol.fields.add(new SelectField({ name: "temperament_new_dogs_female", required: false, values: tempOpts }));
  }
  if (!dogsCol.fields.getByName("temperament_new_dogs_male")) {
    dogsCol.fields.add(new SelectField({ name: "temperament_new_dogs_male", required: false, values: tempOpts }));
  }
  app.save(dogsCol);

  const capacityCol = app.findCollectionByNameOrId("watch_capacity");
  capacityCol.fields.removeByName("dog_sizes");
  capacityCol.fields.add(new SelectField({
    name: "dog_sizes",
    required: true,
    maxSelect: 3,
    values: ["small", "medium", "large"],
  }));
  app.save(capacityCol);
}, (app) => {
  try {
    const usersCol = app.findCollectionByNameOrId("users");
    usersCol.fields.removeByName("breeds_owned_before");
    app.save(usersCol);
  } catch (_) {}
  try {
    const dogsCol = app.findCollectionByNameOrId("dogs");
    dogsCol.fields.removeByName("temperament_new_people");
    dogsCol.fields.removeByName("temperament_new_dogs_female");
    dogsCol.fields.removeByName("temperament_new_dogs_male");
    app.save(dogsCol);
  } catch (_) {}
  try {
    const capacityCol = app.findCollectionByNameOrId("watch_capacity");
    capacityCol.fields.removeByName("dog_sizes");
    capacityCol.fields.add(new SelectField({
      name: "dog_sizes",
      required: true,
      maxSelect: 1,
      values: ["small", "medium", "large", "any"],
    }));
    app.save(capacityCol);
  } catch (_) {}
});
