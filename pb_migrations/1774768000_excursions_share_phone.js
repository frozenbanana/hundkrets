migrate((app) => {
  const excursionsCol = app.findCollectionByNameOrId("excursions");
  if (!excursionsCol.fields.getByName("share_phone_with_attendees")) {
    excursionsCol.fields.add(
      new BoolField({
        name: "share_phone_with_attendees",
        required: false,
        defaultValue: false,
      })
    );
  }
  app.save(excursionsCol);
}, (app) => {
  const excursionsCol = app.findCollectionByNameOrId("excursions");
  excursionsCol.fields.removeByName("share_phone_with_attendees");
  app.save(excursionsCol);
});
