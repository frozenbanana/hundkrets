import { expect, test, type Page } from "@playwright/test";

const EMAIL = process.env.TEST_EMAIL || "anna.malmo@example.com";
const PASSWORD = process.env.TEST_PASS || "password123!";

async function loginAsAnna(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-post").fill(EMAIL);
  await page.getByLabel("Lösenord").fill(PASSWORD);
  await page.getByRole("button", { name: "Logga in" }).click();
  await page.waitForURL(/\/(app\/explore|onboarding)/, { timeout: 15_000 });
  if (page.url().includes("/onboarding")) {
    throw new Error(`Expected explore after login, landed on ${page.url()}`);
  }
}

test.describe("Explore → profile", () => {
  test("profile API returns 200 with auth for a seed user", async ({ request }) => {
    const auth = await request.post("http://127.0.0.1:8090/api/collections/users/auth-with-password", {
      data: { identity: EMAIL, password: PASSWORD },
    });
    expect(auth.ok()).toBeTruthy();
    const { token } = await auth.json();
    expect(token).toBeTruthy();

    const erikAuth = await request.post(
      "http://127.0.0.1:8090/api/collections/users/auth-with-password",
      { data: { identity: "erik.malmo@example.com", password: PASSWORD } }
    );
    expect(erikAuth.ok()).toBeTruthy();
    const { record: erik } = await erikAuth.json();
    expect(erik?.id).toBeTruthy();

    const profile = await request.get(`/api/users/${erik.id}/profile`, {
      headers: { Authorization: token },
    });
    expect(profile.status(), `profile API body: ${await profile.text()}`).toBe(200);
    const body = await profile.json();
    expect(body.user?.id).toBe(erik.id);
    expect(Array.isArray(body.dogs)).toBeTruthy();
  });

  test("Flöde shows media cards and opens profile", async ({ page }) => {
    await loginAsAnna(page);
    await page.goto("/app/explore");
    await expect(page.getByRole("heading", { name: /Utforska/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Flöde/i })).toBeVisible();

    const card = page.locator(".media-card").first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    const name = (await card.locator(".media-card-name").textContent())?.trim();
    expect(name).toBeTruthy();

    await card.locator(".media-card-media").click();
    await page.waitForURL(/\/users\/[^/?]+/, { timeout: 15_000 });

    await expect(page.getByText("Failed to load profile")).toHaveCount(0);
    await expect(page.getByText("Profilen hittades inte")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: name! }).or(page.getByText(name!, { exact: true })).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "Media" })).toBeVisible();
  });

  test("Karta tab shows full-page map", async ({ page }) => {
    await loginAsAnna(page);
    await page.goto("/app/explore?utforsk=karta");
    await expect(page.getByRole("tab", { name: /Karta/i })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".leaflet-container").first()).toBeVisible({ timeout: 20_000 });
  });
});
