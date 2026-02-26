// Add sortable timestamp fields to messages collection.
// Enables API sorting like: sort=+created or sort=-updated

migrate((app) => {
  const messagesCol = app.findCollectionByNameOrId("messages");

  if (!messagesCol.fields.getByName("created")) {
    messagesCol.fields.add(new AutodateField({
      name: "created",
      onCreate: true,
      onUpdate: false,
    }));
  }

  if (!messagesCol.fields.getByName("updated")) {
    messagesCol.fields.add(new AutodateField({
      name: "updated",
      onCreate: true,
      onUpdate: true,
    }));
  }

  app.save(messagesCol);
}, (app) => {
  const messagesCol = app.findCollectionByNameOrId("messages");

  const updatedField = messagesCol.fields.getByName("updated");
  if (updatedField && updatedField.type === "autodate" && !updatedField.system) {
    messagesCol.fields.removeByName("updated");
  }

  const createdField = messagesCol.fields.getByName("created");
  if (createdField && createdField.type === "autodate" && !createdField.system) {
    messagesCol.fields.removeByName("created");
  }

  app.save(messagesCol);
});
