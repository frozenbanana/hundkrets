// Allow authenticated users to list/view dogs for matching (see other users' dogs in match cards)

migrate((app) => {
  const dogsCol = app.findCollectionByNameOrId("dogs");
  dogsCol.listRule = "@request.auth.id != ''";
  dogsCol.viewRule = "@request.auth.id != ''";
  app.save(dogsCol);
}, (app) => {
  const dogsCol = app.findCollectionByNameOrId("dogs");
  dogsCol.listRule = "owner = @request.auth.id";
  dogsCol.viewRule = "owner = @request.auth.id";
  app.save(dogsCol);
});
