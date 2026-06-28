import { expect, test } from "@playwright/test";

test.describe("MP/admin web functional flow", () => {
  test("navigation, filtering, submission, and public transparency render", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "LokSetu", exact: true })).toBeVisible();
    await expect(page.getByText(/Live · (memory|postgres) · Vertex-ready/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "LokSetu AI live priority command center" })).toBeVisible();
    await expect(page.getByText("Real-time constituency dashboard")).toBeVisible();

    await page.getByRole("button", { name: "India Explorer" }).click();
    await expect(page.getByRole("heading", { name: "All-India issue atlas" })).toBeVisible();
    await expect(page.getByText("Geospatial demand hotspots")).toBeVisible();
    await expect(page.getByText("Local map fallback")).toBeVisible();
    await expect(page.locator(".hotspot").first()).toBeVisible();
    await expect(page.locator(".hotspot-row").first()).toBeVisible();

    await page.getByLabel("State").selectOption("Uttar Pradesh");
    await expect(page.getByLabel("District")).toHaveValue("Lucknow");
    await expect(page.getByLabel("Ward")).toHaveValue("Aminabad Basti");
    await expect(page.getByLabel("MP")).toHaveValue("mp-up-lucknow");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.locator(".hotspot-row").first()).toContainText("Aminabad Basti");

    await expect(page.getByRole("link", { name: "Open Apni Awaaz" })).toHaveAttribute("href", "http://localhost:5174");

    await page.getByRole("button", { name: "All India" }).click();
    await page.getByRole("button", { name: "Public" }).click();
    await expect(page.getByRole("heading", { name: "Public transparency board" })).toBeVisible();
    await expect(page.locator(".public-card").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Public project detail" })).toBeVisible();
    await expect(page.getByText("Source snapshots")).toBeVisible();
    await page.getByLabel("Category").selectOption("Sanitation");
    await expect(page.locator(".public-card").first()).toContainText("Sanitation");

    await page.getByRole("button", { name: "Simulation" }).click();
    await expect(page.getByRole("heading", { name: "Simulation workbench" })).toBeVisible();
    await page.getByRole("button", { name: /School flooding/ }).click();
    await page.getByRole("button", { name: "Submit simulation" }).click();
    await expect(page.getByText("pending_batch")).toBeVisible();
  });
});
