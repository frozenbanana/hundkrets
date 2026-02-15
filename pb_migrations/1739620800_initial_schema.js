// Dog Watch Match - Initial schema migration

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  const usersId = usersCol.id;

  // Allow authenticated users to list/view other users (for match display)
  usersCol.listRule = "@request.auth.id != ''";
  usersCol.viewRule = "@request.auth.id != ''";

  // Add profile fields to users auth collection
  if (!usersCol.fields.getByName("name")) {
    usersCol.fields.add(new TextField({ name: "name", required: false }));
  }
  if (!usersCol.fields.getByName("phone")) {
    usersCol.fields.add(new TextField({ name: "phone", required: false }));
  }
  if (!usersCol.fields.getByName("area")) {
    usersCol.fields.add(new TextField({ name: "area", required: false }));
  }
  app.save(usersCol);

  // Create dogs collection
  const dogsCol = new Collection({
    type: "base",
    name: "dogs",
    listRule: "owner = @request.auth.id",
    viewRule: "owner = @request.auth.id",
    createRule: "@request.auth.id != ''",
    updateRule: "owner = @request.auth.id",
    deleteRule: "owner = @request.auth.id",
    fields: [
      { name: "owner", type: "relation", required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
      { name: "name", type: "text", required: true },
      { name: "breed", type: "text", required: false },
      { name: "size", type: "select", required: true, values: ["small", "medium", "large"] },
      { name: "gender", type: "select", required: true, values: ["male", "female"] },
      { name: "temperament", type: "text", required: false },
      { name: "notes", type: "text", required: false },
    ],
  });
  app.save(dogsCol);
  const dogsId = dogsCol.id;

  // Create watch_needs collection (list/view open for matching; create/update/delete own only)
  const needsCol = new Collection({
    type: "base",
    name: "watch_needs",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "user = @request.auth.id",
    deleteRule: "user = @request.auth.id",
    fields: [
      { name: "user", type: "relation", required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
      { name: "dog", type: "relation", required: true, maxSelect: 1, collectionId: dogsId, cascadeDelete: false },
      { name: "start_date", type: "date", required: true },
      { name: "end_date", type: "date", required: true },
      { name: "notes", type: "text", required: false },
    ],
  });
  app.save(needsCol);

  // Create watch_capacity collection (list/view open for matching; create/update/delete own only)
  const capacityCol = new Collection({
    type: "base",
    name: "watch_capacity",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "user = @request.auth.id",
    deleteRule: "user = @request.auth.id",
    fields: [
      { name: "user", type: "relation", required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
      { name: "start_date", type: "date", required: true },
      { name: "end_date", type: "date", required: true },
      { name: "dog_sizes", type: "select", required: true, values: ["small", "medium", "large", "any"] },
      { name: "dog_genders", type: "select", required: true, values: ["male", "female", "any"] },
      { name: "max_dogs", type: "number", required: true },
      { name: "notes", type: "text", required: false },
    ],
  });
  app.save(capacityCol);
}, (app) => {
  // Down migration - remove new collections only
  try {
    const capacityCol = app.findCollectionByNameOrId("watch_capacity");
    app.delete(capacityCol);
  } catch (_) {}
  try {
    const needsCol = app.findCollectionByNameOrId("watch_needs");
    app.delete(needsCol);
  } catch (_) {}
  try {
    const dogsCol = app.findCollectionByNameOrId("dogs");
    app.delete(dogsCol);
  } catch (_) {}
});
