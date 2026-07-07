import { expect, test } from "@playwright/test";

test.describe("Apni Awaaz citizen app functional flow", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addInitScript(() => {
      localStorage.setItem("loksetuLanguage", "English");
    });
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 28.62, longitude: 77.3 });
    await loginIfNeeded(page);
  });

  test("citizen can submit a text problem and receive a private batch receipt", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Apni Awaaz")).toBeVisible();
    await page.getByRole("button", { name: "Show my reward total" }).click();
    await expect(page.getByText("Cumulative reward", { exact: true })).toBeVisible();
    await expect(page.getByText("Current milestone")).toBeVisible();
    await page.getByRole("button", { name: "How to get 100% reward" }).click();
    await expect(page.getByRole("heading", { name: "How to report well and earn 100% reward" })).toBeVisible();
    await expect(page.getByText("Good example")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Type Write the problem" }).click();
    await page.getByPlaceholder("E.g. School toilets are broken and classrooms flood after rain.").fill(
      "Functional citizen test: the school hand pump is broken and children cannot drink water."
    );
    await page.getByRole("button", { name: "Submit problem" }).click();
    await expect(page.getByRole("heading", { name: "Submitted. Thank you!" })).toBeVisible();
    await expect(page.getByText("pending batch")).toBeVisible();
    await expect(page.getByText("Receipt ID")).toBeVisible();
  });
});

async function loginIfNeeded(page: import("@playwright/test").Page) {
  await page.goto("/");
  const aadhaarNumber = page.getByLabel("Aadhaar number");
  if (await aadhaarNumber.isVisible()) {
    await aadhaarNumber.fill(testAadhaarNumber());
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Apni Awaaz")).toBeVisible();
  }
}

function testAadhaarNumber() {
  return process.env.TEST_AADHAAR_NUMBER ?? "2345 6789 0123";
}
