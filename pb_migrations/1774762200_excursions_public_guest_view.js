migrate((app) => {
  const excursionsCol = app.findCollectionByNameOrId("excursions");
  excursionsCol.listRule = "visibility = 'public' || (@request.auth.id != '' && host_user = @request.auth.id)";
  excursionsCol.viewRule = "visibility = 'public' || (@request.auth.id != '' && host_user = @request.auth.id)";
  app.save(excursionsCol);
}, (app) => {
  const excursionsCol = app.findCollectionByNameOrId("excursions");
  excursionsCol.listRule = "@request.auth.id != '' && (host_user = @request.auth.id || visibility = 'public')";
  excursionsCol.viewRule = "@request.auth.id != '' && (host_user = @request.auth.id || visibility = 'public')";
  app.save(excursionsCol);
});
