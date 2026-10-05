import { createHmac, timingSafeEqual } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const retention = require(resolve(process.cwd(), "../pb_hooks/retention_unsubscribe.js")) as {
  isValid: (
    userId: string,
    type: string,
    token: string,
    secret: string,
    hs256: (message: string, secret: string) => string,
    equal: (a: string, b: string) => boolean
  ) => boolean;
  link: (
    baseUrl: string,
    userId: string,
    secret: string,
    hs256: (message: string, secret: string) => string
  ) => string;
  token: (
    userId: string,
    secret: string,
    hs256: (message: string, secret: string) => string
  ) => string;
};

function hs256(message: string, secret: string) {
  return createHmac("sha256", secret).update(message).digest("hex");
}

function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

describe("retention unsubscribe tokens", () => {
  const secret = "test-retention-secret";
  const userId = "abc123xyz456789";

  it("accepts the token that belongs to that member", () => {
    const token = retention.token(userId, secret, hs256);
    expect(retention.isValid(userId, "retention", token, secret, hs256, equal)).toBe(true);
  });

  it("rejects a missing, forged, or mismatched token", () => {
    const token = retention.token(userId, secret, hs256);
    expect(retention.isValid(userId, "retention", "", secret, hs256, equal)).toBe(false);
    expect(retention.isValid(userId, "retention", "forged", secret, hs256, equal)).toBe(false);
    expect(retention.isValid("someoneelse0001", "retention", token, secret, hs256, equal)).toBe(false);
    expect(retention.isValid(userId, "other", token, secret, hs256, equal)).toBe(false);
    expect(retention.isValid(userId, "retention", token, "", hs256, equal)).toBe(false);
  });

  it("puts the signature in the query string", () => {
    const link = retention.link("https://hundkrets.se/", userId, secret, hs256);
    const url = new URL(link);
    expect(url.origin + url.pathname).toBe(
      `https://hundkrets.se/api/unsubscribe/${userId}/retention`
    );
    expect(url.searchParams.get("token")).toBe(retention.token(userId, secret, hs256));
  });
});

describe("retention hook locks", () => {
  const hook = readFileSync(resolve(process.cwd(), "../pb_hooks/main.pb.js"), "utf8");

  it("signs both unsubscribe links and rejects an unsigned request", () => {
    expect(hook).not.toContain('"/api/unsubscribe/" + userId + "/retention"');
    expect(hook).not.toContain('"/api/unsubscribe/" + user.id + "/retention"');
    expect(hook.match(/retentionUnsubscribeUrl\(/g)?.length).toBeGreaterThanOrEqual(2);
    expect(hook).toContain('require(__hooks + "/retention_unsubscribe.js")');
    expect(hook).toContain("$security.hs256");
    expect(hook).toContain("$security.equal");
    expect(hook).toContain('e.json(400, { error: "Invalid unsubscribe request" })');
  });

  it("requires a superuser before the manual retention job can run", () => {
    const start = hook.indexOf('routerAdd("POST", "/api/test/retention-emails"');
    const end = hook.indexOf("routerAdd(", start + 1);
    const route = hook.slice(start, end === -1 ? undefined : end);
    expect(route.indexOf("hasSuperuserAuth")).toBeGreaterThan(-1);
    expect(route.indexOf("hasSuperuserAuth")).toBeLessThan(route.indexOf("runWeeklyRetentionJob"));
    expect(route).toContain('e.json(401, { error: "Unauthorized" })');
  });
});
