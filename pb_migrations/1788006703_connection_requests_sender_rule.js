// Connection requests must always be created by the authenticated sender.

migrate((app) => {
  const connectionRequests = app.findCollectionByNameOrId("connection_requests");
  connectionRequests.createRule =
    "@request.auth.id != '' && from_user = @request.auth.id";
  app.save(connectionRequests);
}, (app) => {
  const connectionRequests = app.findCollectionByNameOrId("connection_requests");
  connectionRequests.createRule = "@request.auth.id != ''";
  app.save(connectionRequests);
});
