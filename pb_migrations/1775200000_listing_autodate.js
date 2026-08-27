// Add created/updated autodate so listing/sort (gallery, media, weekly metrics) works.

migrate((app) => {
  var collections = ["dogs", "media", "connection_requests", "excursions"];
  for (var i = 0; i < collections.length; i++) {
    var col = app.findCollectionByNameOrId(collections[i]);

    if (!col.fields.getByName("created")) {
      col.fields.add(new AutodateField({
        name: "created",
        onCreate: true,
        onUpdate: false,
      }));
    }

    if (!col.fields.getByName("updated")) {
      col.fields.add(new AutodateField({
        name: "updated",
        onCreate: true,
        onUpdate: true,
      }));
    }

    app.save(col);
  }
}, (app) => {
  var collections = ["dogs", "media", "connection_requests", "excursions"];
  for (var i = 0; i < collections.length; i++) {
    var col = app.findCollectionByNameOrId(collections[i]);

    var updatedField = col.fields.getByName("updated");
    if (updatedField && updatedField.type === "autodate" && !updatedField.system) {
      col.fields.removeByName("updated");
    }

    var createdField = col.fields.getByName("created");
    if (createdField && createdField.type === "autodate" && !createdField.system) {
      col.fields.removeByName("created");
    }

    app.save(col);
  }
});
