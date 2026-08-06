// Media collections + R2 keys on dogs/users

migrate((app) => {
  const usersId = app.findCollectionByNameOrId("users").id;

  const mediaCol = new Collection({
    type: "base",
    name: "media",
    listRule: "visibility = 'public' || @request.auth.id != ''",
    viewRule: "visibility = 'public' || @request.auth.id != ''",
    createRule: "@request.auth.id != '' && owner = @request.auth.id",
    updateRule: "@request.auth.id != '' && owner = @request.auth.id",
    deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
    fields: [
      { name: "owner", type: "relation", required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
      { name: "kind", type: "select", required: true, maxSelect: 1, values: ["image", "video"] },
      { name: "object_key", type: "text", required: true, max: 512 },
      { name: "poster_key", type: "text", required: false, max: 512 },
      { name: "visibility", type: "select", required: true, maxSelect: 1, values: ["public", "members"] },
      { name: "duration_ms", type: "number", required: false },
      { name: "width", type: "number", required: false },
      { name: "height", type: "number", required: false },
    ],
  });
  app.save(mediaCol);

  const mediaId = mediaCol.id;
  const reportsCol = new Collection({
    type: "base",
    name: "media_reports",
    listRule: "@request.auth.id != '' && reporter = @request.auth.id",
    viewRule: "@request.auth.id != '' && reporter = @request.auth.id",
    createRule: "@request.auth.id != '' && reporter = @request.auth.id",
    updateRule: null,
    deleteRule: "@request.auth.id != '' && reporter = @request.auth.id",
    fields: [
      { name: "media", type: "relation", required: true, maxSelect: 1, collectionId: mediaId, cascadeDelete: true },
      { name: "reporter", type: "relation", required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
      { name: "reason", type: "text", required: false, max: 500 },
    ],
  });
  app.save(reportsCol);

  const dogsCol = app.findCollectionByNameOrId("dogs");
  if (!dogsCol.fields.getByName("image_key")) {
    dogsCol.fields.add(new TextField({ name: "image_key", required: false, max: 512 }));
    app.save(dogsCol);
  }

  const usersCol = app.findCollectionByNameOrId("users");
  if (!usersCol.fields.getByName("avatar_key")) {
    usersCol.fields.add(new TextField({ name: "avatar_key", required: false, max: 512 }));
    app.save(usersCol);
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("media_reports"));
  } catch (_) {}
  try {
    app.delete(app.findCollectionByNameOrId("media"));
  } catch (_) {}
  try {
    const dogsCol = app.findCollectionByNameOrId("dogs");
    dogsCol.fields.removeByName("image_key");
    app.save(dogsCol);
  } catch (_) {}
  try {
    const usersCol = app.findCollectionByNameOrId("users");
    usersCol.fields.removeByName("avatar_key");
    app.save(usersCol);
  } catch (_) {}
});
