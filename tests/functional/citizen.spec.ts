import { expect, test } from "@playwright/test";

test.describe("Apni Awaaz citizen app functional flow", () => {
  test("citizen can submit a text problem and receive a private batch receipt", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Apni Awaaz")).toBeVisible();
    await page.getByRole("button", { name: /लिखें Type/i }).click();
    await page.getByPlaceholder("E.g. School toilets are broken and classrooms flood after rain.").fill(
      "Functional citizen test: the school hand pump is broken and children cannot drink water."
    );
    await page.getByRole("button", { name: "Submit problem" }).click();
    await expect(page.getByRole("heading", { name: "Submitted. Thank you!" })).toBeVisible();
    await expect(page.getByText("pending batch")).toBeVisible();
    await expect(page.getByText("Receipt ID")).toBeVisible();
  });
});
