migrate((app) => {
  const excursionsCol = app.findCollectionByNameOrId("excursions");

  if (!excursionsCol.fields.getByName("duration_hours")) {
    excursionsCol.fields.add(
      new NumberField({
        name: "duration_hours",
        required: false,
        min: 1,
        max: 24,
        defaultValue: 2,
      })
    );
  }

  if (!excursionsCol.fields.getByName("meeting_map_url")) {
    excursionsCol.fields.add(
      new TextField({
        name: "meeting_map_url",
        required: false,
        max: 500,
      })
    );
  }

  if (!excursionsCol.fields.getByName("meeting_latitude")) {
    excursionsCol.fields.add(
      new NumberField({
        name: "meeting_latitude",
        required: false,
        min: -90,
        max: 90,
      })
    );
  }

  if (!excursionsCol.fields.getByName("meeting_longitude")) {
    excursionsCol.fields.add(
      new NumberField({
        name: "meeting_longitude",
        required: false,
        min: -180,
        max: 180,
      })
    );
  }

  app.save(excursionsCol);
}, (app) => {
  const excursionsCol = app.findCollectionByNameOrId("excursions");
  excursionsCol.fields.removeByName("duration_hours");
  excursionsCol.fields.removeByName("meeting_map_url");
  excursionsCol.fields.removeByName("meeting_latitude");
  excursionsCol.fields.removeByName("meeting_longitude");
  app.save(excursionsCol);
});
