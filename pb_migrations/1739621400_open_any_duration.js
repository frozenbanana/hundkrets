// Replace duration_weeks with open_any_duration + duration_specific

migrate((app) => {
  const needsCol = app.findCollectionByNameOrId("watch_needs");
  if (!needsCol.fields.getByName("open_any_duration")) {
    needsCol.fields.add(new BoolField({ name: "open_any_duration", required: false }));
  }
  if (!needsCol.fields.getByName("duration_specific")) {
    needsCol.fields.add(new TextField({ name: "duration_specific", required: false }));
  }
  app.save(needsCol);

  const capacityCol = app.findCollectionByNameOrId("watch_capacity");
  if (!capacityCol.fields.getByName("open_any_duration")) {
    capacityCol.fields.add(new BoolField({ name: "open_any_duration", required: false }));
  }
  if (!capacityCol.fields.getByName("duration_specific")) {
    capacityCol.fields.add(new TextField({ name: "duration_specific", required: false }));
  }
  app.save(capacityCol);
}, (app) => {
  try {
    const needsCol = app.findCollectionByNameOrId("watch_needs");
    needsCol.fields.removeByName("open_any_duration");
    needsCol.fields.removeByName("duration_specific");
    app.save(needsCol);
  } catch (_) {}
  try {
    const capacityCol = app.findCollectionByNameOrId("watch_capacity");
    capacityCol.fields.removeByName("open_any_duration");
    capacityCol.fields.removeByName("duration_specific");
    app.save(capacityCol);
  } catch (_) {}
});
