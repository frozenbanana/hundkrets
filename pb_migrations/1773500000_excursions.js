migrate((app) => {
  const usersId = app.findCollectionByNameOrId("users").id;

  const excursionsCol = new Collection({
    type: "base",
    name: "excursions",
    listRule: "@request.auth.id != '' && (host_user = @request.auth.id || visibility = 'public')",
    viewRule: "@request.auth.id != '' && (host_user = @request.auth.id || visibility = 'public')",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != '' && host_user = @request.auth.id",
    deleteRule: "@request.auth.id != '' && host_user = @request.auth.id",
    fields: [
      { name: "host_user", type: "relation", required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
      { name: "title", type: "text", required: true, max: 140 },
      { name: "description", type: "text", required: false, max: 2000 },
      { name: "start_at", type: "date", required: true },
      { name: "end_at", type: "date", required: false },
      { name: "meeting_area", type: "text", required: true, max: 120 },
      { name: "visibility", type: "select", required: true, maxSelect: 1, values: ["public", "matched_only", "interested_by_me"] },
      { name: "status", type: "select", required: true, maxSelect: 1, values: ["scheduled", "cancelled", "completed"] },
    ],
  });
  app.save(excursionsCol);

  const excursionsId = excursionsCol.id;
  const interestsCol = new Collection({
    type: "base",
    name: "excursion_interests",
    listRule: "@request.auth.id != '' && (user = @request.auth.id || excursion.host_user = @request.auth.id)",
    viewRule: "@request.auth.id != '' && (user = @request.auth.id || excursion.host_user = @request.auth.id)",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != '' && user = @request.auth.id",
    deleteRule: "@request.auth.id != '' && user = @request.auth.id",
    fields: [
      { name: "excursion", type: "relation", required: true, maxSelect: 1, collectionId: excursionsId, cascadeDelete: true },
      { name: "user", type: "relation", required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
    ],
  });
  app.save(interestsCol);

  const commentsCol = new Collection({
    type: "base",
    name: "excursion_comments",
    listRule: "@request.auth.id != '' && (author = @request.auth.id || excursion.host_user = @request.auth.id || excursion.visibility = 'public')",
    viewRule: "@request.auth.id != '' && (author = @request.auth.id || excursion.host_user = @request.auth.id || excursion.visibility = 'public')",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != '' && author = @request.auth.id",
    deleteRule: "@request.auth.id != '' && author = @request.auth.id",
    fields: [
      { name: "excursion", type: "relation", required: true, maxSelect: 1, collectionId: excursionsId, cascadeDelete: true },
      { name: "author", type: "relation", required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
      { name: "body", type: "text", required: true, max: 2000 },
    ],
  });
  app.save(commentsCol);

  commentsCol.fields.add(new RelationField({
    name: "parent_comment",
    required: false,
    maxSelect: 1,
    collectionId: commentsCol.id,
    cascadeDelete: false,
  }));
  app.save(commentsCol);

  try {
    const items = app.findRecordsByFilter("excursions", "status = ''", "", 0, 0);
    for (let i = 0; i < items.length; i++) {
      items[i].set("status", "scheduled");
      app.save(items[i]);
    }
  } catch (_) {}
  try {
    const items = app.findRecordsByFilter("excursions", "visibility = ''", "", 0, 0);
    for (let i = 0; i < items.length; i++) {
      items[i].set("visibility", "public");
      app.save(items[i]);
    }
  } catch (_) {}
}, (app) => {
  try {
    const commentsCol = app.findCollectionByNameOrId("excursion_comments");
    app.delete(commentsCol);
  } catch (_) {}
  try {
    const interestsCol = app.findCollectionByNameOrId("excursion_interests");
    app.delete(interestsCol);
  } catch (_) {}
  try {
    const excursionsCol = app.findCollectionByNameOrId("excursions");
    app.delete(excursionsCol);
  } catch (_) {}
});
