// Logged-in members may create dogs, needs, and capacity only for themselves.
// Update and delete already require owner/user = @request.auth.id.

migrate((app) => {
  const dogs = app.findCollectionByNameOrId("dogs");
  dogs.createRule = "@request.auth.id != '' && owner = @request.auth.id";
  app.save(dogs);

  const needs = app.findCollectionByNameOrId("watch_needs");
  needs.createRule = "@request.auth.id != '' && user = @request.auth.id";
  app.save(needs);

  const capacity = app.findCollectionByNameOrId("watch_capacity");
  capacity.createRule = "@request.auth.id != '' && user = @request.auth.id";
  app.save(capacity);
}, (app) => {
  const dogs = app.findCollectionByNameOrId("dogs");
  dogs.createRule = "@request.auth.id != ''";
  app.save(dogs);

  const needs = app.findCollectionByNameOrId("watch_needs");
  needs.createRule = "@request.auth.id != ''";
  app.save(needs);

  const capacity = app.findCollectionByNameOrId("watch_capacity");
  capacity.createRule = "@request.auth.id != ''";
  app.save(capacity);
});
