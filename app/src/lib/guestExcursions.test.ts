import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readRoute(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("guest hundträff list", () => {
  const list = readRoute("routes/app/excursions/index.tsx");
  const create = readRoute("routes/app/excursions/create.tsx");
  const edit = readRoute("routes/app/excursions/[id]/edit.tsx");

  it("lets a logged-out visitor open the public list", () => {
    expect(list).toContain("<AppShell allowGuest>");
    expect(list).toContain("if (me)");
    expect(list).toContain("Skapa konto för att delta");
    expect(list).toContain("hideSocialCounts={!isLoggedIn()}");
  });

  it("keeps create and edit behind login", () => {
    expect(create).not.toContain("allowGuest");
    expect(edit).not.toContain("allowGuest");
    expect(create).toContain("<AppShell>");
    expect(edit).toContain("<AppShell>");
  });
});