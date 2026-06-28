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
    await expect(page.locator(".map-state")).toContainText(/Google Maps live|Local map fallback|Loading map/);
    await expect(page.locator(".hotspot-row").first()).toBeVisible();
    await expect(page.getByLabel("Selected issue drilldown")).toBeVisible();
    await expect(page.getByText("Issue drilldown")).toBeVisible();
    await page.getByRole("button", { name: "All India" }).click();
    await expect(page.locator(".hotspot-row")).toHaveCount(8);
    await page.locator(".hotspot-row").nth(1).click();
    await expect(page.getByLabel("Applied signal filters")).toContainText("rank=2");
    await expect(page.getByText("Related complaints")).toBeVisible();
    await expect(page.getByText("Evidence timeline")).toBeVisible();

    await page.getByRole("button", { name: "My area" }).click();
    await page.getByLabel("State").selectOption("Uttar Pradesh");
    await expect(page.getByLabel("District")).toHaveValue("Lucknow");
    await expect(page.getByLabel("Ward", { exact: true })).toHaveValue("Aminabad Basti");
    await expect(page.getByLabel("MP", { exact: true })).toHaveValue("mp-up-lucknow");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.locator(".hotspot-row").first()).toContainText("Aminabad Basti");

    await expect(page.getByRole("link", { name: "Open Apni Awaaz" })).toHaveAttribute("href", "http://localhost:5174");

    await page.getByRole("button", { name: "Public" }).click();
    await expect(page.getByRole("heading", { name: "Public transparency board" })).toBeVisible();
    await expect(page.locator(".public-card").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Public project detail" })).toBeVisible();
    await expect(page.getByText("Source snapshots")).toBeVisible();
    await page.getByLabel("Rate public priority").getByRole("button", { name: "5" }).click();
    await expect(page.getByLabel("Rate public priority")).toContainText("Rating recorded");
    await page.getByLabel("Category").selectOption("Sanitation");
    await expect(page.locator(".public-card").first()).toContainText("Sanitation");

    await page.getByRole("button", { name: "Admin" }).click();
    await expect(page.getByRole("heading", { name: "Area routing console" })).toBeVisible();
    await page.getByRole("button", { name: "Update mapping" }).click();
    await expect(page.getByText(/is now routed to/)).toBeVisible();
    await expect(page.getByText("updated_area_mapping").first()).toBeVisible();

    await page.getByRole("button", { name: "Project Rooms" }).click();
    await expect(page.getByRole("heading", { name: "Project rooms", exact: true })).toBeVisible();
    const statusActions = page.getByLabel("Project status actions");
    const reviewButton = statusActions.getByRole("button", { name: "Return to review" });
    if (await reviewButton.isEnabled()) {
      await reviewButton.click();
      await expect(page.getByText("Status updated to review.")).toBeVisible();
    } else {
      await statusActions.getByRole("button", { name: "Shortlist" }).click();
      await expect(page.getByText("Status updated to shortlist.")).toBeVisible();
    }

    await page.getByRole("button", { name: "Analytics" }).click();
    await expect(page.getByRole("heading", { name: "Constituency intelligence layer" })).toBeVisible();
    await expect(page.getByText("Daily constituency digest")).toBeVisible();
    await expect(page.getByText("Source coverage registry")).toBeVisible();
    await expect(page.getByText("Citizen Sources")).toBeVisible();
    await expect(page.getByText("Top emerging issues")).toBeVisible();

    await page.getByRole("button", { name: "Situation Room" }).click();
    await expect(page.getByRole("heading", { name: "AI Situation Room" })).toBeVisible();
    await expect(page.getByText("AI incident management")).toBeVisible();
    await expect(page.getByText("AI anomaly detection")).toBeVisible();
    await expect(page.getByText("Enterprise observability")).toBeVisible();

    await page.getByRole("button", { name: "AI Copilot" }).click();
    await expect(page.getByRole("heading", { name: "LokSetu AI Copilot" })).toBeVisible();
    await page.getByRole("button", { name: "Ask Copilot" }).click();
    await expect(page.getByRole("heading", { name: "Grounded answer" })).toBeVisible();
    await expect(page.getByText("Suggested actions")).toBeVisible();
    await expect(page.getByText("Citations")).toBeVisible();

    await page.getByRole("button", { name: "Simulation" }).click();
    await expect(page.getByRole("heading", { name: "Simulation workbench" })).toBeVisible();
    await page.getByRole("button", { name: /School flooding/ }).click();
    await page.getByRole("button", { name: "Submit simulation" }).click();
    await expect(page.getByText("pending_batch")).toBeVisible();
  });
});
