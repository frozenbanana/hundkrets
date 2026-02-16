// Dog Watch Match - Flexible dates, dog images, profile fields

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  if (!usersCol.fields.getByName("city")) {
    usersCol.fields.add(new TextField({ name: "city", required: false }));
  }
  if (!usersCol.fields.getByName("neighborhood")) {
    usersCol.fields.add(new TextField({ name: "neighborhood", required: false }));
  }
  app.save(usersCol);

  const dogsCol = app.findCollectionByNameOrId("dogs");
  if (!dogsCol.fields.getByName("image")) {
    dogsCol.fields.add(new FileField({ name: "image", required: false, maxSelect: 1, maxSize: 5242880, thumbs: ["200x200f"] }));
  }
  app.save(dogsCol);

  const needsCol = app.findCollectionByNameOrId("watch_needs");
  const needStart = needsCol.fields.getByName("start_date");
  const needEnd = needsCol.fields.getByName("end_date");
  if (needStart) needStart.required = false;
  if (needEnd) needEnd.required = false;
  if (!needsCol.fields.getByName("flexible_dates")) {
    needsCol.fields.add(new BoolField({ name: "flexible_dates", required: false }));
  }
  if (!needsCol.fields.getByName("duration_weeks")) {
    needsCol.fields.add(new NumberField({ name: "duration_weeks", required: false, min: 1, max: 2 }));
  }
  app.save(needsCol);

  const capacityCol = app.findCollectionByNameOrId("watch_capacity");
  const capStart = capacityCol.fields.getByName("start_date");
  const capEnd = capacityCol.fields.getByName("end_date");
  if (capStart) capStart.required = false;
  if (capEnd) capEnd.required = false;
  if (!capacityCol.fields.getByName("flexible_dates")) {
    capacityCol.fields.add(new BoolField({ name: "flexible_dates", required: false }));
  }
  if (!capacityCol.fields.getByName("duration_weeks")) {
    capacityCol.fields.add(new NumberField({ name: "duration_weeks", required: false, min: 1, max: 2 }));
  }
  app.save(capacityCol);
}, (app) => {
  // Down - revert field additions
  try {
    const usersCol = app.findCollectionByNameOrId("users");
    usersCol.fields.removeByName("city");
    usersCol.fields.removeByName("neighborhood");
    app.save(usersCol);
  } catch (_) {}
  try {
    const dogsCol = app.findCollectionByNameOrId("dogs");
    dogsCol.fields.removeByName("image");
    app.save(dogsCol);
  } catch (_) {}
  try {
    const needsCol = app.findCollectionByNameOrId("watch_needs");
    const needStart = needsCol.fields.getByName("start_date");
    const needEnd = needsCol.fields.getByName("end_date");
    if (needStart) needStart.required = true;
    if (needEnd) needEnd.required = true;
    needsCol.fields.removeByName("flexible_dates");
    needsCol.fields.removeByName("duration_weeks");
    app.save(needsCol);
  } catch (_) {}
  try {
    const capacityCol = app.findCollectionByNameOrId("watch_capacity");
    const capStart = capacityCol.fields.getByName("start_date");
    const capEnd = capacityCol.fields.getByName("end_date");
    if (capStart) capStart.required = true;
    if (capEnd) capEnd.required = true;
    capacityCol.fields.removeByName("flexible_dates");
    capacityCol.fields.removeByName("duration_weeks");
    app.save(capacityCol);
  } catch (_) {}
});
