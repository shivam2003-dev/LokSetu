import { expect, test } from "@playwright/test";

test.describe("MP/admin web functional flow", () => {
  test("priority desk decision loop, map, intake, and copilot render", async ({ page }) => {
    await loginIfNeeded(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "LokSetu", exact: true })).toBeVisible();
    await expect(page.getByText(/Live - (memory|postgres)/)).toBeVisible();

    // Priority Desk is the default core workflow page.
    await expect(page.getByRole("heading", { name: "Ranked development priorities" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ranked priority queue" })).toBeVisible();
    await expect(page.getByText("Submissions analyzed")).toBeVisible();
    await expect(page.getByText("Awaiting decision")).toBeVisible();
    await expect(page.locator(".queue-row").first()).toBeVisible();
    await expect(page.locator(".queue-rank").first()).toContainText("#1");

    // Widen scope so the queue holds the full ranked list.
    await page.getByRole("button", { name: "All India" }).click();
    await expect(page.locator(".queue-row").nth(1)).toBeVisible();

    // Selecting a ranked work loads its decision brief with evidence.
    const decision = page.getByLabel("Decision brief");
    await page.locator(".queue-row").nth(1).click();
    await expect(page.locator(".queue-row").nth(1)).toHaveClass(/selected/);
    await expect(decision.getByText(/Rank #2/)).toBeVisible();
    await expect(decision.getByRole("heading", { name: "Evidence", exact: true })).toBeVisible();
    await expect(decision.getByRole("heading", { name: "Safeguards", exact: true })).toBeVisible();
    await expect(decision.getByText("Citizen demand")).toBeVisible();

    // MP decision workflow: shortlist/approve or send back to review.
    const returnToReview = decision.getByRole("button", { name: "Return to review" });
    if (await returnToReview.isVisible()) {
      await returnToReview.click();
      await expect(page.getByText("Status updated: In review.")).toBeVisible();
    } else {
      await decision.getByRole("button", { name: "Shortlist this work" }).click();
      await expect(page.getByText("Status updated: Shortlisted.")).toBeVisible();
    }

    // Stage tabs filter the queue by decision status.
    await page.getByRole("tab", { name: /Shortlisted/ }).click();
    const shortlistedRows = page.locator(".queue-row");
    if (await shortlistedRows.count()) {
      await expect(shortlistedRows.first().locator(".status-chip")).toContainText("Shortlisted");
    } else {
      await expect(page.getByText(/No works in this stage/)).toBeVisible();
    }
    await page.getByRole("tab", { name: /All works/ }).click();

    // Citizen rating feeds back into the ranking.
    await page.getByLabel("Rate this priority").getByRole("button", { name: "5" }).click();
    await expect(page.getByLabel("Rate this priority")).toContainText("Rating recorded");

    await page.getByRole("button", { name: "Demand Map" }).click();
    await expect(page.getByRole("heading", { name: "All-India issue atlas" })).toBeVisible();
    await expect(page.getByText("Geospatial demand hotspots")).toBeVisible();
    await expect(page.locator(".map-state")).toContainText(/Google Maps live|Local map fallback|Loading map/);
    await expect(page.locator(".hotspot-row").first()).toBeVisible();
    await expect(page.getByText("Boundary layers")).toBeVisible();
    await expect(page.getByText("Hotspot clusters")).toBeVisible();
    await page.getByRole("button", { name: "district", exact: true }).click();
    await expect(page.locator(".boundary-list button").first()).toContainText(/production boundary connector|local-simplified-boundary/);
    await page.getByRole("button", { name: "All India" }).click();
    await expect(page.locator(".hotspot-row")).toHaveCount(8);
    await page.locator(".hotspot-row").nth(1).click();
    await expect(page.getByLabel("Selected issue drilldown")).toBeVisible();
    await expect(page.getByText("Issue drilldown")).toBeVisible();
    await expect(page.getByText("Boundary provenance")).toBeVisible();
    await expect(page.getByLabel("Applied signal filters")).toContainText("rank=2");
    await expect(page.getByText("Related complaints")).toBeVisible();
    await expect(page.getByText("Evidence timeline")).toBeVisible();
    await page.getByLabel("Close issue detail").click();
    await page.locator(".cluster-list button").first().click();
    await expect(page.getByText("Cluster context")).toBeVisible();
    await page.getByLabel("Close issue detail").click();

    await page.getByRole("button", { name: "My area" }).click();
    await page.getByLabel("State").selectOption("Uttar Pradesh");
    await expect(page.getByLabel("District")).toHaveValue("Lucknow");
    await expect(page.getByLabel("Ward", { exact: true })).toHaveValue("Aminabad Basti");
    await expect(page.getByLabel("MP", { exact: true })).toHaveValue("mp-up-lucknow");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.locator(".hotspot-row").first()).toContainText("Aminabad Basti");

    await expect(page.getByRole("link", { name: "Open Apni Awaaz" })).toHaveAttribute("href", "http://localhost:5174");

    await page.getByRole("button", { name: "Evidence Copilot" }).click();
    await expect(page.getByRole("heading", { name: "LokSetu AI" })).toBeVisible();
    await expect(page.getByText("RAG status")).toBeVisible();
    await expect(page.getByLabel("India search and locality controls")).toHaveCount(0);
    await page.getByPlaceholder(/Ask anything about priorities/).fill("bihar stats");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.locator(".chat-message.assistant .message-meta").first()).toBeVisible();
    await expect(page.getByText("Retrieved context")).toBeVisible();
    await expect(page.getByText("Citations", { exact: true })).toBeVisible();
    await expect(page.getByText(/not-configured|pgvector-hybrid/).first()).toBeVisible();
    await expect(page.getByText(/retrieved/i).first()).toBeVisible();
    await expect(page.getByText("Kalindi Nagar")).toHaveCount(0);
    await page.getByPlaceholder(/Ask anything about priorities/).fill("hi");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Ask me about constituency priorities")).toBeVisible();
    await expect(page.getByText("Copilot query failed")).toHaveCount(0);

    await page.getByRole("button", { name: "Citizen Intake" }).click();
    await expect(page.getByRole("heading", { name: "Simulation workbench" })).toBeVisible();
    await page.getByRole("button", { name: /School flooding/ }).click();
    await page.getByRole("button", { name: "Submit simulation" }).click();
    await expect(page.getByText("pending_batch")).toBeVisible();
  });

  test("maps fallback works without a browser key", async ({ page }) => {
    await page.route("**/api/client-config", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          dataMode: "memory",
          maps: { enabled: false, apiKey: "", mapId: "", source: "not-configured" },
          citizenAppUrl: "http://localhost:5174",
          generatedAt: new Date().toISOString()
        })
      });
    });
    await loginIfNeeded(page);
    await page.goto("/#explore");
    await expect(page.locator(".map-state")).toContainText("Local map fallback");
    await expect(page.locator(".fallback-map .hotspot").first()).toBeVisible();
  });

  test("maps key without Map ID uses legacy markers and no marker library", async ({ page }) => {
    await installGoogleMapsMock(page);
    await page.route("**/api/client-config", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          dataMode: "memory",
          maps: { enabled: true, apiKey: "test-browser-key", mapId: "", source: "runtime-api" },
          citizenAppUrl: "http://localhost:5174",
          generatedAt: new Date().toISOString()
        })
      });
    });
    await loginIfNeeded(page);
    await page.goto("/#explore");
    await expect(page.locator(".map-state")).toContainText("Google Maps live");
    const markerStats = await page.evaluate(() => (window as any).__loksetuMapMock);
    expect(markerStats.legacyMarkers).toBeGreaterThan(0);
    expect(markerStats.advancedMarkers).toBe(0);
    expect(markerStats.scripts[0]).not.toContain("libraries=marker");
  });

  test("Map ID enables advanced markers and cluster click detail", async ({ page }) => {
    await installGoogleMapsMock(page);
    await page.route("**/api/client-config", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          dataMode: "memory",
          maps: { enabled: true, apiKey: "test-browser-key", mapId: "test-map-id", source: "runtime-api" },
          citizenAppUrl: "http://localhost:5174",
          generatedAt: new Date().toISOString()
        })
      });
    });
    await loginIfNeeded(page);
    await page.goto("/#explore");
    await expect(page.locator(".map-state")).toContainText("Google Maps live");
    await expect(page.locator(".google-hotspot-marker").first()).toBeVisible();
    await page.locator(".cluster-list button").first().click();
    await expect(page.getByLabel("Selected issue drilldown")).toBeVisible();
    await expect(page.getByText("Cluster context")).toBeVisible();
    const markerStats = await page.evaluate(() => (window as any).__loksetuMapMock);
    expect(markerStats.advancedMarkers).toBeGreaterThan(0);
    expect(markerStats.legacyMarkers).toBe(0);
    expect(markerStats.scripts[0]).toContain("libraries=marker");
  });
});

async function installGoogleMapsMock(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    (window as any).__loksetuMapMock = { scripts: [], legacyMarkers: 0, advancedMarkers: 0 };
    const originalAppendChild = HTMLHeadElement.prototype.appendChild;
    HTMLHeadElement.prototype.appendChild = function appendChildPatched<T extends Node>(node: T): T {
      if (node instanceof HTMLScriptElement && node.src.includes("maps.googleapis.com/maps/api/js")) {
        (window as any).__loksetuMapMock.scripts.push(node.src);
        const makeMapApi = () => {
          class LatLngBounds {
            extend() {}
          }
          class Map {
            element: HTMLElement;
            constructor(element: HTMLElement) {
              this.element = element;
            }
            fitBounds() {}
          }
          class Marker {
            constructor() {
              (window as any).__loksetuMapMock.legacyMarkers += 1;
            }
            addListener() {}
          }
          class AdvancedMarkerElement {
            content: HTMLElement;
            constructor(options: { map: Map; content: HTMLElement }) {
              (window as any).__loksetuMapMock.advancedMarkers += 1;
              this.content = options.content;
              options.map.element.appendChild(options.content);
            }
            addEventListener(_event: string, handler: EventListener) {
              this.content.addEventListener("click", handler);
            }
          }
          (window as any).google = { maps: { LatLngBounds, Map, Marker, marker: { AdvancedMarkerElement } } };
        };
        window.setTimeout(() => {
          makeMapApi();
          (window as any).__loksetuGoogleMapsLoaded?.();
        }, 0);
        return node;
      }
      return originalAppendChild.call(this, node) as T;
    };
  });
}

async function loginIfNeeded(page: import("@playwright/test").Page) {
  await page.goto("/");
  const password = page.getByLabel("Password");
  if (await password.isVisible()) {
    await password.fill(testAccessPassword());
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
  }
}

function testAccessPassword() {
  return process.env.TEST_APP_ACCESS_PASSWORD ?? process.env.APP_ACCESS_PASSWORD ?? "functional-test";
}
