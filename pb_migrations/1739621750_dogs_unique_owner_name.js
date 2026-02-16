// Unique constraint: an owner cannot have two dogs with the same name.
// Removes existing duplicates (keeps first per owner+name), then adds unique index.

migrate((app) => {
  const dogsCol = app.findCollectionByNameOrId("dogs");
  const table = dogsCol.name;
  const needsTable = app.findCollectionByNameOrId("watch_needs").name;

  // 1. Remove duplicates via raw SQL (keep min id per owner+name)
  const dupRows = arrayOf(
    new DynamicModel({
      owner: "",
      name: "",
      keep_id: "",
      ids: "",
    })
  );
  app
    .db()
    .newQuery(
      `SELECT owner, name, 
        MIN(id) as keep_id,
        GROUP_CONCAT(id) as ids
       FROM ${table}
       GROUP BY owner, name
       HAVING COUNT(*) > 1`
    )
    .all(dupRows);

  for (const row of dupRows) {
    const keepId = row.keep_id;
    const allIds = row.ids.split(",").filter((id) => id !== keepId);

    for (const dupId of allIds) {
      app.db().newQuery(`DELETE FROM ${needsTable} WHERE dog = {:dupId}`).bind({ dupId }).execute();
      app.db().newQuery(`DELETE FROM ${table} WHERE id = {:dupId}`).bind({ dupId }).execute();
    }
  }

  // 2. Add unique index on (owner, name)
  dogsCol.addIndex("idx_dogs_owner_name", true, "owner,name", "");
  app.save(dogsCol);
}, (app) => {
  const dogsCol = app.findCollectionByNameOrId("dogs");
  dogsCol.removeIndex("idx_dogs_owner_name");
  app.save(dogsCol);
});
