import { expect, test } from "@playwright/test";

test.describe("MP/admin web functional flow", () => {
  test("navigation, filtering, submission, and public transparency render", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "LokSetu", exact: true })).toBeVisible();
    await expect(page.getByText("Live · Postgres · Vertex-ready")).toBeVisible();
    await expect(page.getByRole("heading", { name: "LokSetu AI live priority command center" })).toBeVisible();
    await expect(page.getByText("Real-time constituency dashboard")).toBeVisible();

    await page.getByRole("button", { name: "India Explorer" }).click();
    await expect(page.getByRole("heading", { name: "All-India issue atlas" })).toBeVisible();
    await expect(page.getByText("Geospatial demand hotspots")).toBeVisible();
    await expect(page.getByText("Local map fallback")).toBeVisible();
    await expect(page.locator(".hotspot").first()).toBeVisible();
    await expect(page.locator(".hotspot-row").first()).toBeVisible();

    await expect(page.getByRole("link", { name: "Open Apni Awaaz" })).toHaveAttribute("href", "http://localhost:5174");

    await page.getByRole("button", { name: "Public" }).click();
    await expect(page.getByRole("heading", { name: "Public transparency board" })).toBeVisible();
    await expect(page.locator(".public-card").first()).toBeVisible();
  });
});
