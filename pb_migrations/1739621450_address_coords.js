// Add address_private, latitude, longitude for geocoding and distance-based matching

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  if (!usersCol.fields.getByName("address_private")) {
    usersCol.fields.add(new TextField({ name: "address_private", required: false }));
  }
  if (!usersCol.fields.getByName("latitude")) {
    usersCol.fields.add(new NumberField({ name: "latitude", required: false }));
  }
  if (!usersCol.fields.getByName("longitude")) {
    usersCol.fields.add(new NumberField({ name: "longitude", required: false }));
  }
  app.save(usersCol);
}, (app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  usersCol.fields.removeByName("address_private");
  usersCol.fields.removeByName("latitude");
  usersCol.fields.removeByName("longitude");
  app.save(usersCol);
});
