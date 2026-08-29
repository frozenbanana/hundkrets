import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("connection request sender rule", () => {
  it("rejects a from_user that differs from the authenticated member", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "../pb_migrations/1788006703_connection_requests_sender_rule.js"
      ),
      "utf8"
    );

    expect(migration).toContain(
      `"@request.auth.id != '' && from_user = @request.auth.id"`
    );
  });
});
