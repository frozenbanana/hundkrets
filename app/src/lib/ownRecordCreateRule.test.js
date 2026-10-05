import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("own record create rules", () => {
  const migration = readFileSync(
    resolve(process.cwd(), "../pb_migrations/1791240100_own_record_create_rules.js"),
    "utf8"
  );

  it("binds dogs to the authenticated owner", () => {
    expect(migration).toContain(
      `dogs.createRule = "@request.auth.id != '' && owner = @request.auth.id"`
    );
  });

  it("binds watch needs and capacity to the authenticated user", () => {
    expect(migration).toContain(
      `needs.createRule = "@request.auth.id != '' && user = @request.auth.id"`
    );
    expect(migration).toContain(
      `capacity.createRule = "@request.auth.id != '' && user = @request.auth.id"`
    );
  });
});
