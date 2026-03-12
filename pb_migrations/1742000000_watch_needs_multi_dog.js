// Hundkrets - Allow multiple dogs per watch_need

migrate((app) => {
  const needsCol = app.findCollectionByNameOrId("watch_needs");
  
  // Get the existing dog field and change it to allow multiple selections
  const dogField = needsCol.fields.getByName("dog");
  if (dogField) {
    // Change from single relation (maxSelect: 1) to multi-relation (maxSelect: 10)
    // Note: PocketBase doesn't support "unlimited" (0 or null), so we use a reasonable max
    dogField.maxSelect = 10;
    dogField.required = false; // Make optional since user might have no dogs yet
  }
  
  app.save(needsCol);
}, (app) => {
  // Down - revert to single dog field
  const needsCol = app.findCollectionByNameOrId("watch_needs");
  const dogField = needsCol.fields.getByName("dog");
  if (dogField) {
    dogField.maxSelect = 1;
    dogField.required = true;
  }
  app.save(needsCol);
});