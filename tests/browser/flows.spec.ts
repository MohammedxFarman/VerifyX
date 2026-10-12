import { test, expect } from "@playwright/test";
import sharp from "sharp";
const png = async (size = 1) =>
  sharp({
    create: { width: size, height: size, channels: 3, background: "#aabbcc" },
  })
    .png()
    .toBuffer();
test("dashboard, tiny image, original preview and metadata, then history", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByText("Your first report will appear here."),
  ).toBeVisible();
  await page.locator("#tab-btn-image").click();
  await page
    .getByLabel("Choose image")
    .setInputFiles({
      name: "AI-fake.png",
      mimeType: "image/png",
      buffer: await png(),
    });
  await expect(
    page.getByRole("heading", { name: /^inconclusive$/i }),
  ).toBeVisible();
  await expect(page.getByText("No combined authenticity score")).toBeVisible();
  await expect(
    page.getByText("Verified authentic", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Insufficient visual information:", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/image-" + test.info().project.name + ".png",
    fullPage: true,
  });
  await page.locator("#tab-btn-profile-keys").click();
  await expect(
    page.getByRole("heading", { name: "Saved reports" }),
  ).toBeVisible();
  await expect(
    page.locator("summary").filter({ hasText: "image report" }),
  ).toHaveCount(1);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("text comparison, honest unavailable providers and safe external text", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#tab-btn-plagiarism").click();
  await page
    .getByLabel("Your text", { exact: true })
    .fill("one two three four five six seven");
  await page
    .getByLabel("Reference text (required for comparison)")
    .fill("one two three four five six seven");
  await page.getByRole("button", { name: "Run check" }).click();
  await expect(
    page.getByText("100.0% measured overlap / model output"),
  ).toBeVisible();
  await page.locator("#tab-btn-news").click();
  await page
    .getByLabel("Claim to investigate")
    .fill("<img src=x onerror=alert(1)> A claim needing sources");
  await page.getByRole("button", { name: "Run check" }).click();
  await expect(
    page.getByText("No source search was performed.", { exact: false }),
  ).toBeVisible();
  await page.locator("#tab-btn-ai-content").click();
  await page
    .getByLabel("Text to inspect")
    .fill("A simple text with no known authorship information");
  await page.getByRole("button", { name: "Run check" }).click();
  await expect(
    page.getByText("No authorship score was produced.", { exact: false }),
  ).toBeVisible();
});
test("successive uploads cannot publish an older result; pending and cancellation show no verdict", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#tab-btn-image").click();
  let submissions = 0;
  let oldPoll = false;
  await page.route("**/api/verify/image?async=true", async (route) => {
    submissions++;
    await route.fulfill({
      status: 202,
      json: {
        job_id: submissions === 1 ? "old-job" : "new-job",
        status: "queued",
      },
    });
  });
  await page.route("**/api/verify/cancel/*", (route) =>
    route.fulfill({ json: { job_id: "old-job", status: "canceled" } }),
  );
  await page.route("**/api/verify/result/*", async (route) => {
    if (route.request().url().endsWith("old-job")) {
      oldPoll = true;
      await new Promise((r) => setTimeout(r, 1200));
    }
    await route
      .fulfill({
        json: {
          job_id: route.request().url().endsWith("old-job")
            ? "old-job"
            : "new-job",
          status: "processing",
        },
      })
      .catch(() => {});
  });
  await page
    .getByLabel("Choose image")
    .setInputFiles({
      name: "first.png",
      mimeType: "image/png",
      buffer: await png(64),
    });
  await expect.poll(() => oldPoll).toBeTruthy();
  await page
    .getByLabel("Choose image")
    .setInputFiles({
      name: "second.png",
      mimeType: "image/png",
      buffer: await png(96),
    });
  await expect(page.getByText("second.png", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Analyzing file evidence" }),
  ).toBeVisible();
  await expect(page.getByLabel("Evidence report")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel analysis" }).click();
  await expect(
    page.getByText("Analysis canceled. No verdict was produced."),
  ).toBeVisible();
  await expect(page.getByLabel("Evidence report")).toHaveCount(0);
});
test("registration and account login retain private history", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#get-started-nav-btn").click();
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Full name").fill("Browser Tester");
  await page
    .getByLabel("Email", { exact: true })
    .fill("browser-" + Date.now() + "@example.org");
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-long-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.locator("dialog")).not.toBeVisible();
  await expect(page.locator("#user-profile-menu-btn")).toContainText(
    "Browser Tester",
  );
  await page.locator("#tab-btn-plagiarism").click();
  await page
    .getByLabel("Your text", { exact: true })
    .fill("one two three four five six");
  await page
    .getByLabel("Reference text (required for comparison)")
    .fill("one two three four five six");
  await page.getByRole("button", { name: "Run check" }).click();
  await expect(page.getByLabel("Evidence report")).toBeVisible();
  await page.locator("#user-profile-menu-btn").click();
  await page.locator("#nav-logout-btn").click();
  await expect(
    page.getByText("Your first report will appear here."),
  ).toBeVisible();
});
