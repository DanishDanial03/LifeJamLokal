import { chromium } from "playwright-core";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:3000");
  await page
    .getByRole("button", { name: "Sign in", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "Musician", exact: true }).click();
  await page.getByText("Demo account opened.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Make your profile shine" }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByLabel("Professional headline").waitFor();
  assert.equal(
    await page.getByLabel("Professional headline").inputValue(),
    "Acoustic guitarist & singer",
  );
  await page
    .getByLabel("Your sound & experience")
    .fill(
      "Soulful acoustic guitarist and singer for intimate café evenings, weddings and mellow indie gatherings. Warm vocals and fingerstyle guitar.",
    );
  await page
    .getByRole("button", { name: "Save your profile", exact: false })
    .click();
  await page.getByText("Profile updated.", { exact: false }).waitFor();
  await page.goto("http://127.0.0.1:3000/#profile/2");
  await page
    .getByRole("heading", { name: "Amir Hakim", exact: true })
    .waitFor();
  for (const tab of ["About", "Portfolio", "Reviews", "Availability"]) {
    await page
      .locator(".profile-tabs")
      .getByRole("button", { name: tab, exact: false })
      .click();
    await page.waitForTimeout(150);
  }
  await page.goto("http://127.0.0.1:3000/#messages/1");
  await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
  assert.equal(
    await page
      .locator(".conversation-header")
      .getByText("Aina Rahman", { exact: true })
      .count(),
    1,
  );
  const admin = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  admin.on("pageerror", (e) => errors.push(e.message));
  await admin.goto("http://127.0.0.1:3000");
  await admin
    .getByRole("button", { name: "Sign in", exact: false })
    .first()
    .click();
  await admin.getByRole("button", { name: "Admin", exact: true }).click();
  await admin.getByText("Demo account opened.", { exact: false }).waitFor();
  await admin.goto("http://127.0.0.1:3000/#admin");
  await admin.getByRole("heading", { name: "The admin studio." }).waitFor();
  for (const tab of [
    "Accounts",
    "Profiles",
    "Posts",
    "Reviews",
    "Search activity",
    "Maintenance",
  ]) {
    await admin
      .locator(".tabs-scroll")
      .getByRole("button", { name: tab, exact: true })
      .click();
    await admin.waitForTimeout(120);
  }
  await admin
    .getByRole("button", { name: "Analyze tables & clean sessions" })
    .click();
  await admin
    .getByText("Database tables analyzed;", { exact: false })
    .waitFor();
  await admin.setViewportSize({ width: 390, height: 844 });
  for (const tab of [
    "Accounts",
    "Profiles",
    "Posts",
    "Search activity",
    "Maintenance",
  ]) {
    await admin
      .locator(".tabs-scroll")
      .getByRole("button", { name: tab, exact: true })
      .click();
    assert.equal(
      await admin.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "Musician editor/profile tabs and all administrator screens passed at desktop/mobile widths.",
  );
} finally {
  await browser.close();
}
