import { expect, test } from "@playwright/test";

test.describe("Landing", () => {
  test("shows value prop and CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Byt hundpassning|Hitta din partner/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Skapa konto" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Logga in" }).first()).toBeVisible();
  });
});
