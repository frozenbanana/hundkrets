// Add optional message to connection requests (intresseförfrågan)

migrate((app) => {
  const connCol = app.findCollectionByNameOrId("connection_requests");
  if (!connCol.fields.getByName("message")) {
    connCol.fields.add(new TextField({ name: "message", required: false, max: 500 }));
  }
  app.save(connCol);
}, (app) => {
  const connCol = app.findCollectionByNameOrId("connection_requests");
  connCol.fields.removeByName("message");
  app.save(connCol);
});
