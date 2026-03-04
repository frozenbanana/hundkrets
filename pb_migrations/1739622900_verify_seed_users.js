// Set verified=true for seed/test users (e.g. *@example.com) so connection_requests work
migrate((app) => {
  try {
    const users = app.findRecordsByFilter("users", "email ~ {:suffix}", "", 200, 0, { suffix: "@example.com" });
    for (let i = 0; i < users.length; i++) {
      users[i].set("verified", true);
      app.save(users[i]);
    }
  } catch (_) {}
}, (app) => {});
