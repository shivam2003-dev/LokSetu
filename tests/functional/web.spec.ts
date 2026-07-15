import { expect, test } from "@playwright/test";

const expectedCitizenAppUrl = process.env.VITE_CITIZEN_APP_URL ?? "http://localhost:5174";

test.describe("MP/admin web functional flow", () => {
  test("priority desk decision loop, pulse, map, signals, and copilot render", async ({ page }) => {
    await loginIfNeeded(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /JanVaani/ })).toBeVisible();
    await expect(page.getByText(/Live - (memory|postgres)/)).toBeVisible();
    await page.getByLabel("Collapse navigation").click();
    await expect(page.locator(".app-shell")).toHaveClass(/sidebar-collapsed/);
    await page.getByLabel("Expand navigation").click();
    await expect(page.locator(".app-shell")).not.toHaveClass(/sidebar-collapsed/);
    await expect(page.getByLabel("Demo data controls")).toBeVisible();
    await page.getByLabel("Demo data controls").getByRole("button", { name: "Disable demo data" }).click();
    await expect(page.getByLabel("Demo data controls")).toContainText("Demo data off");
    await page.getByLabel("Demo data controls").getByRole("button", { name: "Load local demo data" }).click();
    await expect(page.getByLabel("Demo data controls")).toContainText("Demo data on");

    // Overview is the post-login homepage; the priority desk remains the core workflow page.
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Constituency intelligence command center" })).toBeVisible();
    await page.goto("/#priorities");
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

    // Reports is a dedicated AI reporting workspace.
    await page.getByRole("button", { name: "Reports" }).click();
    await expect(page.getByRole("heading", { name: "AI-powered constituency reports" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Monthly Report AI draft ready" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Monthly Report" })).toBeVisible();
    await expect(page.getByText("Export PDF")).toBeVisible();

    // National Pulse remains available as the reports data source page.
    await page.goto("/#pulse");
    await expect(page.getByRole("heading", { name: "India", exact: true })).toBeVisible();
    await expect(page.getByLabel("National pulse filters")).toBeVisible();
    await page.getByLabel("Pulse state").selectOption("Uttar Pradesh");
    await expect(page.getByRole("heading", { name: "Uttar Pradesh", exact: true })).toBeVisible();
    await expect(page.getByLabel("Selected problem intelligence")).toBeVisible();
    await page.getByLabel("Pulse problem").selectOption("Roads");
    await expect(page.getByLabel("Selected problem intelligence")).toContainText("Roads");
    await page.getByRole("button", { name: "View All Districts" }).click();
    await expect(page.getByRole("button", { name: "Show Top Districts" })).toBeVisible();
    await page.getByRole("button", { name: "View All Trends" }).click();
    await expect(page.getByRole("button", { name: "Show Top Trends" })).toBeVisible();
    await page.getByLabel("Close problem intelligence").click();
    await page.getByLabel("Open problem intelligence").click();
    await page.getByLabel("Ask JanVaani AI").click();
    await expect(page.getByText(/Roads leads|No processed demand records/)).toBeVisible();
    await page.getByLabel("Pulse state").selectOption("All States");
    await page.getByLabel("Pulse problem").selectOption("All Problems");
    await expect(page.getByText("AI Priority Score")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Top 5 Citizen Problems" })).toBeVisible();
    await expect(page.locator(".problem-row")).toHaveCount(5);
    await expect(page.locator(".problem-pct").first()).toHaveText(/%$/);
    await expect(page.getByRole("heading", { name: "District Ranking" })).toBeVisible();
    await expect(page.locator(".rank-row").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trending This Week" })).toBeVisible();

    await page.getByRole("button", { name: "Data Explorer" }).click();
    await expect(page.getByRole("heading", { name: "Explore source data" })).toBeVisible();
    await expect(page.getByText("Constituency data workspace")).toBeVisible();
    await expect(page.getByText("Live Data Preview")).toBeVisible();

    await page.getByRole("button", { name: "Compare" }).click();
    await expect(page.getByRole("heading", { name: "Constituency Comparison Dashboard" })).toBeVisible();
    await expect(page.getByLabel("Comparison controls")).toBeVisible();
    await expect(page.getByText("AI-Generated Insights")).toBeVisible();
    await page.getByLabel("Compare level").selectOption("district");
    await expect(page.getByText("Radar Comparison")).toBeVisible();

    await page.getByLabel("JanVaani navigation").getByRole("button", { name: "Map View" }).click();
    await expect(page.getByRole("heading", { name: "All-India issue atlas" })).toBeVisible();
    await expect(page.getByText("Geospatial demand hotspots")).toBeVisible();
    await expect(page.locator(".map-state")).toContainText(/Google Maps live|Local map fallback|Live tile map|Loading map/);
    await expect(page.locator(".hotspot-row").first()).toBeVisible();
    await expect(page.getByText("Boundary layers")).toBeVisible();
    await expect(page.getByText("Hotspot clusters")).toBeVisible();
    await page.getByRole("button", { name: "district", exact: true }).click();
    await expect(page.locator(".boundary-list button").first()).toContainText(/production boundary connector|local-simplified-boundary/);
    await page.getByRole("button", { name: "All India" }).click();
    await expect(page.locator(".hotspot-row").first()).toBeVisible();
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
    await page.getByLabel("State", { exact: true }).selectOption("Uttar Pradesh");
    await expect(page.getByLabel("District")).toHaveValue("Lucknow");
    await expect(page.getByLabel("Ward", { exact: true })).toHaveValue("Aminabad Basti");
    await expect(page.getByLabel("MP", { exact: true })).toHaveValue("mp-up-lucknow");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.locator(".hotspot-row").first()).toContainText("Aminabad Basti");

    await expect(page.getByRole("link", { name: "Apni Awaaz" })).toHaveAttribute("href", expectedCitizenAppUrl);

    // Web Signals is the Demand Signals Intelligence dashboard.
    await page.getByRole("button", { name: "Demand Signals" }).click();
    await expect(page.getByRole("heading", { name: "Demand Signals Intelligence" })).toBeVisible();
    await expect(page.getByLabel("State and union territory filters")).toBeVisible();
    await expect(page.getByRole("button", { name: "All India + UT" })).toHaveClass(/active/);
    await expect(page.locator(".dsi-source-chips span")).toHaveCount(9);
    await expect(page.locator(".dsi-growth-tile").first()).toBeVisible();
    await expect(page.getByText("Demand Signal Score")).toBeVisible();
    await page.getByRole("radio", { name: "Compare Sources" }).check();
    await expect(page.getByRole("heading", { name: /Current Demand/ })).toContainText("All India and UTs");
    await expect(page.getByRole("heading", { name: /Evidence Timeline/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Demand Heatmap/ })).toBeVisible();
    await page.locator(".dsi-real-heatmap button").first().click();
    await expect(page.locator(".dsi-district-card")).toBeVisible();
    await page.getByRole("button", { name: "States", exact: true }).click();
    await page.getByLabel("State", { exact: true }).selectOption("Uttar Pradesh");
    await expect(page.getByLabel("State and union territory filters")).toContainText("Uttar Pradesh");
    await expect(page.locator(".dsi-real-heatmap")).toContainText("Uttar Pradesh");
    await page.getByRole("button", { name: "Union Territories", exact: true }).click();
    await page.getByLabel("Union Territory", { exact: true }).selectOption("Delhi");
    await expect(page.getByLabel("State and union territory filters")).toContainText("Delhi");
    await expect(page.getByRole("heading", { name: /Escalation Watch/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Evidence Correlation/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Why .* Leads/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Compare Issues" })).toBeVisible();
    await expect(page.locator(".dsi-compare tbody tr").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Top Recommended Actions" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Top Trending Topics/ })).toBeVisible();
    await page.getByRole("button", { name: "View All Trends" }).click();
    await expect(page.getByRole("heading", { name: "All Real Trends" })).toBeVisible();
    await page.getByLabel("Close expanded signal panel").click();
    await page.getByRole("button", { name: "View All Recommendations" }).click();
    await expect(page.getByRole("heading", { name: "All Recommended Actions" })).toBeVisible();
    await page.getByLabel("Close expanded signal panel").click();
    await page.getByRole("button", { name: "View All", exact: true }).click();
    await expect(page.getByRole("heading", { name: "All Source Evidence" })).toBeVisible();

    await page.getByRole("button", { name: /AI Assistant/ }).click();
    await expect(page.getByRole("heading", { name: "Grounded AI Assistant", level: 3 })).toBeVisible();
    const answerMode = page.getByRole("group", { name: "Answer mode" });
    await expect(answerMode).toBeVisible();
    await answerMode.getByRole("button", { name: "Submitted Issues" }).click();
    await expect(answerMode.getByRole("button", { name: "Submitted Issues" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("India search and locality controls")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Filters/ })).toHaveCount(0);
    await expect(page.getByLabel("Chat thread")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Key Evidence" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Evidence Map" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Grounded By/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "How AI Reached This Answer" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Export Answer" })).toBeVisible();
    await page.getByLabel("Ask a question").fill("latest submitted issue");
    await page.getByRole("button", { name: "Ask AI" }).click();
    await expect(page.locator(".copilot-msg--ai").filter({ hasText: /Latest processed submission|No processed citizen submissions|submitted citizen/i }).last()).toBeVisible();
    await answerMode.getByRole("button", { name: "Online" }).click();
    await expect(answerMode.getByRole("button", { name: "Online" })).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel("Ask a question").fill("hi");
    await page.getByRole("button", { name: "Ask AI" }).click();
    await expect(page.getByText("Ask me about constituency priorities")).toBeVisible();
    await expect(page.getByText("Copilot query failed")).toHaveCount(0);

    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "AI Governance Settings", exact: true })).toBeVisible();
    await expect(page.getByText("API Keys & Integrations")).toBeVisible();
    await expect(page.getByText("Audit Logs")).toBeVisible();
    await page.getByLabel("Settings state").selectOption("Bihar");
    await expect(page.getByLabel("Settings district")).toHaveValue("Patna");
    await expect(page.getByLabel("Settings district")).not.toContainText("Lucknow");
  });

  test("all sidebar navigation buttons route to their own working dashboards on every screen size", async ({ page }) => {
    const nav = page.getByLabel("JanVaani navigation");
    const cases = [
      { button: "Overview", heading: "Overview", marker: "Constituency intelligence command center" },
      { button: "Demand Signals", heading: "What the web says citizens need", marker: "Demand Signal Score" },
      { button: /AI Assistant/, heading: "Ask why a work ranks high", marker: "Grounded AI Assistant" },
      { button: "Recommendations", heading: "AI-ranked development recommendations", marker: "Project Ranking Table" },
      { button: "Projects", heading: "Development projects management", marker: "Kanban Board" },
      { button: "Reports", heading: "AI-powered constituency reports", marker: "Monthly Report" },
      { button: "Data Explorer", heading: "Explore source data", marker: "Live Data Preview" },
      { button: "Knowledge Base", heading: "Knowledge base and indexing", marker: "Vector Database" },
      { button: "Map View", heading: "Where demand is concentrated", marker: "Geospatial demand hotspots" },
      { button: "Compare", heading: "Compare constituencies and districts", marker: "Radar Comparison" },
      { button: "Settings", heading: "Enterprise AI governance settings", marker: "API Keys & Integrations" }
    ];

    for (const viewport of [
      { name: "desktop", width: 1440, height: 900, collapsed: false },
      { name: "tablet", width: 820, height: 1100, collapsed: false },
      { name: "mobile", width: 390, height: 844, collapsed: true }
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await loginIfNeeded(page);
      await expect(page.locator(".overview-page")).toBeVisible();

      for (const item of cases) {
        if (viewport.collapsed) {
          await page.getByRole("button", { name: "Menu" }).click();
          await expect(page.locator(".app-shell")).toHaveClass(/mobile-nav-open/);
        }
        const button = nav.getByRole("button", { name: item.button });
        await button.scrollIntoViewIfNeeded();
        await button.click();
        await expect(page.locator(".topbar h2")).toHaveText(item.heading);
        await expect(page.getByText(item.marker).first()).toBeVisible();
        const active = page.locator(".nav-item.active");
        await expect(active).toContainText(typeof item.button === "string" ? item.button : "AI Assistant");
        await expect(page.locator("html")).toHaveJSProperty("clientWidth", viewport.width);
        const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
        expect(hasHorizontalOverflow, `${viewport.name} should not have horizontal overflow after ${String(item.button)}`).toBe(false);
      }
    }
  });

  test("primary dashboard action buttons perform visible work", async ({ page }) => {
    await loginIfNeeded(page);

    await page.goto("/#overview");
    await page.getByRole("button", { name: "Open AI recommendations" }).click();
    await expect(page.locator(".topbar h2")).toHaveText("AI-ranked development recommendations");
    await page.goto("/#overview");
    await page.getByRole("button", { name: "Review projects" }).click();
    await expect(page.locator(".topbar h2")).toHaveText("Development projects management");
    await page.goto("/#overview");
    await page.getByRole("button", { name: "View GIS map" }).click();
    await expect(page.locator(".topbar h2")).toHaveText("Where demand is concentrated");

    await page.goto("/#map");
    await page.getByRole("button", { name: "Route analysis" }).click();
    await expect(page.locator(".action-status").filter({ hasText: "Route analysis created" })).toBeVisible();
    await page.getByRole("button", { name: "AI hotspot detection" }).click();
    await expect(page.locator(".action-status").filter({ hasText: "AI hotspot detection refreshed" })).toBeVisible();
    await page.locator(".state-onboarding-list button").first().click();
    await expect(page.locator(".action-status").filter({ hasText: /ready across/ })).toBeVisible();
    await page.locator(".hotspot-row").first().click();
    await page.getByLabel("Selected issue drilldown").locator(".area-facets button").first().click();
    await expect(page.locator(".action-status").filter({ hasText: /facet selected/ })).toBeVisible();

    await page.goto("/#copilot");
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByLabel("Query history")).toBeVisible();
    await expect(page.locator(".action-status").filter({ hasText: "History opened" })).toBeVisible();
    await page.locator(".rag-grounded-list button").first().click();
    await expect(page.locator(".action-status").filter({ hasText: /selected with .* supporting records/ })).toBeVisible();
    const answerPopup = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Export PDF" }).click();
    const popup = await answerPopup;
    await popup.close();
    await expect(page.locator(".action-status").filter({ hasText: "PDF export opened" })).toBeVisible();

    await page.goto("/#knowledge");
    await page.getByRole("button", { name: "Choose files" }).click();
    await expect(page.locator(".action-status").filter({ hasText: "Demo intake batch queued" })).toBeVisible();

    await page.goto("/#explorer");
    await page.getByRole("button", { name: "Run query" }).click();
    await expect(page.locator(".action-status").filter({ hasText: "Query returned" })).toBeVisible();
    await page.getByLabel("Explorer query filters").getByLabel("Category").selectOption("Roads");
    await expect(page.locator(".explorer-query-box code")).toContainText("category = 'Roads'");
    await page.getByRole("button", { name: "Run query" }).click();
    await expect(page.getByLabel("Query results")).toBeVisible();

    await page.goto("/#projects");
    const docDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "DPR.pdf" }).click();
    await docDownload;
    await expect(page.locator(".action-status").filter({ hasText: "DPR.pdf opened" })).toBeVisible();
    await page.getByRole("button", { name: "Before" }).click();
    await expect(page.locator(".action-status").filter({ hasText: "Before media selected" })).toBeVisible();

    await page.goto("/#recommendations");
    const recommendation = page.locator(".rec-card").nth(1);
    const recommendationTitle = await recommendation.locator("h4").innerText();
    await recommendation.click();
    await expect(recommendation).toHaveClass(/selected/);
    await expect(page.locator(".rec-reasoning-selected")).toContainText(recommendationTitle);

    await page.goto("/#reports");
    await page.getByRole("button", { name: "Constituency Summary" }).click();
    await expect(page.locator(".report-cover h4")).toHaveText("Constituency Summary");
    await expect(page.locator(".action-status").filter({ hasText: "Constituency Summary template loaded" })).toBeVisible();
    const reportDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PDF" }).click();
    await reportDownload;
    await expect(page.locator(".action-status").filter({ hasText: "Constituency Summary exported as PDF" })).toBeVisible();
    await page.getByRole("button", { name: "Share secure link" }).click();
    await expect(page.locator(".action-status").filter({ hasText: "Secure link created for Constituency Summary" })).toBeVisible();
  });

  test("map and explorer controls are backed by live dashboard data", async ({ page }) => {
    await loginIfNeeded(page);

    await page.goto("/#map");
    await page.getByLabel("GIS issue filter").selectOption("Roads");
    await expect(page.locator(".hotspot-row").first()).toContainText("Roads");
    await page.getByRole("button", { name: "Demand heatmap" }).click();
    await expect(page.getByRole("button", { name: "Demand heatmap" })).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel("GIS timeline slider").fill("100");
    await expect(page.locator(".gis-control-panel .action-status")).toContainText("Full year");

    await page.goto("/#explorer");
    const queryFilters = page.getByLabel("Explorer query filters");
    await queryFilters.getByLabel("Category").selectOption("Roads");
    await expect(page.locator(".explorer-query-box code")).toContainText("category = 'Roads'");
    await page.getByRole("button", { name: "Run query" }).click();
    await expect(page.getByLabel("Query results")).toBeVisible();
    await expect(page.getByText(/Query returned \d+ reviewed project rows/)).toBeVisible();

    await page.goto("/#recommendations");
    await expect(page.getByText(/Central Delhi · Samrala Road/)).toHaveCount(0);
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
    await expect(page.locator(".map-state")).toContainText(/Local map fallback|Live tile map/);
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

  test("admin creates an MP user whose homepage is locked to the configured constituency", async ({ page }) => {
    await loginIfNeeded(page);
    await page.goto("/#settings");
    await expect(page.getByLabel("Dashboard user management")).toBeVisible();
    await page.getByLabel("Dashboard user full name").fill("Lucknow MP Dashboard");
    await page.getByLabel("Dashboard user username").fill("mp.lucknow.browser");
    await page.getByLabel("Dashboard user temporary password").fill("BrowserPass123!");
    await page.getByLabel("Dashboard user role").selectOption("mp");
    await page.getByLabel("Dashboard user state").selectOption("Uttar Pradesh");
    await page.getByLabel("Dashboard user district").selectOption("Lucknow");
    await page.getByLabel("Dashboard user constituency").selectOption("mp-up-lucknow");
    await page.getByRole("checkbox", { name: /Update projects/ }).uncheck();
    await page.getByRole("button", { name: "Create dashboard user" }).click();
    await expect(page.getByRole("status")).toContainText("can now sign in");

    await page.getByRole("button", { name: "Logout" }).click();
    await page.getByLabel("Email or Mobile Number").fill("mp.lucknow.browser");
    await page.getByLabel("Password", { exact: true }).fill("BrowserPass123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    const accessBanner = page.getByLabel("Dashboard access scope");
    await expect(accessBanner).toContainText("Lucknow MP Dashboard");
    await expect(accessBanner).toContainText("Dashboard locked to MP Lucknow · Lucknow · Uttar Pradesh");
    await expect(page.getByLabel("Demo data controls")).toHaveCount(0);
    await expect(page.getByLabel("JanVaani navigation").getByRole("button", { name: "Settings" })).toHaveCount(0);

    await page.goto("/#priorities");
    await expect(page.getByLabel("Configured dashboard area")).toContainText("MP Lucknow");
    await expect(page.getByRole("button", { name: "All India" })).toHaveCount(0);
    await expect(page.getByLabel("State", { exact: true })).toHaveCount(0);
    await expect(page.locator(".queue-row").first()).toBeVisible();
    await expect(page.locator(".queue-row").first()).toContainText(/Aminabad Basti|Gomti Nagar Extension/);
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
  await page.addInitScript(() => {
    window.localStorage.setItem("janvaaniTourComplete", "1");
  });
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.setItem("janvaaniTourComplete", "1");
  });
  const username = page.getByLabel("Email or Mobile Number");
  const password = page.getByLabel("Password", { exact: true });
  if (await password.isVisible()) {
    if (await username.isVisible()) {
      await username.fill(testUsername());
    }
    await password.fill(testAccessPassword());
    await page.getByRole("button", { name: /Sign In|Login/i }).click();
    await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
  }
}

function testUsername() {
  return process.env.TEST_APP_USERNAME ?? process.env.APP_ADMIN_USERNAME ?? "functional-test";
}

function testAccessPassword() {
  return process.env.TEST_APP_ACCESS_PASSWORD ?? process.env.APP_ADMIN_PASSWORD ?? process.env.APP_ACCESS_PASSWORD ?? "functional-test";
}
