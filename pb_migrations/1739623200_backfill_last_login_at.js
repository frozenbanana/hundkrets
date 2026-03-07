// Backfill last_login_at = created for existing users (production deploy)
// Runs after 1739623100_last_login_at.js adds the field

migrate((app) => {
  app.db().newQuery("UPDATE users SET last_login_at = created WHERE last_login_at IS NULL OR last_login_at = ''").execute();
}, (app) => {
  // No revert - we don't clear last_login_at on downgrade
});
