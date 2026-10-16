import { chromium } from "playwright-core";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
let testPost, testMessage, testBooking;
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.TEST_URL || "http://127.0.0.1:3000";
try {
  await page.goto(base);
  await page.locator(".post").first().waitFor();
  assert.equal(
    await page.title(),
    "LifeJamLokal — Find your people. Make some noise.",
  );
  await page
    .getByRole("button", { name: "Sign in", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "Organizer", exact: true }).click();
  await page.getByText("Demo account opened.", { exact: false }).waitFor();
  await page.locator(".composer-top > button").first().click();
  const post = (testPost = "Browser smoke post " + Date.now());
  await page.getByPlaceholder("What’s happening in your scene?").fill(post);
  await page.getByRole("button", { name: "Share with the scene" }).click();
  await page.locator(".post").filter({ hasText: post }).waitFor();
  await page
    .locator(".post")
    .filter({ hasText: post })
    .getByRole("button", { name: "Feel this", exact: true })
    .click();
  await page
    .locator(".post")
    .filter({ hasText: post })
    .getByRole("button", { name: "Feeling it" })
    .waitFor();
  await page
    .locator(".post")
    .filter({ hasText: post })
    .getByRole("button", { name: "Comment", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Write a comment" })
    .fill("Love this community.");
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await page.getByText("Love this community.", { exact: true }).waitFor();
  await page.goto(base + "/#discover");
  await page.locator(".musician-card").first().waitFor();
  assert.equal(await page.locator(".musician-card").count(), 6);
  await page.getByRole("button", { name: "Jazz", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".musician-card").length === 2,
  );
  await page.getByRole("button", { name: "All genres", exact: false }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".musician-card").length === 6,
  );
  await page
    .locator(".musician-card")
    .first()
    .getByRole("link", { name: "View profile" })
    .click();
  await page.getByRole("button", { name: "Request a booking" }).click();
  const dialog = page.getByRole("dialog");
  testBooking = "Browser booking smoke test " + Date.now();
  await dialog.getByLabel("Event name").fill(testBooking);
  const tomorrow = new Date(Date.now() + 86400000 * 20)
    .toISOString()
    .slice(0, 10);
  await dialog.getByLabel("Event date").fill(tomorrow);
  await dialog.getByLabel("Start time").fill("19:00");
  await dialog.getByLabel("End time").fill("21:00");
  await dialog.getByLabel("Venue / location").fill("Test venue, Kuala Lumpur");
  await dialog.getByRole("button", { name: "Send booking request" }).click();
  await page.getByRole("heading", { name: testBooking }).waitFor();
  await page
    .getByRole("button", { name: "Cancel", exact: true })
    .first()
    .click();
  await page
    .locator(".booking-card")
    .filter({ hasText: testBooking })
    .locator(".status.cancelled")
    .waitFor();
  await page.goto(base + "/#messages/2");
  await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
  const message = (testMessage = "Browser conversation test " + Date.now());
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(message);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByText(message, { exact: true }).waitFor();
  for (const route of [
    "network",
    "saved",
    "history",
    "notifications",
    "home",
  ]) {
    await page.goto(base + "/#" + route);
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      route + " overflows desktop",
    );
  }
  await page.screenshot({ path: "/tmp/lifejam-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "home",
    "discover",
    "profile/2",
    "bookings",
    "messages/2",
    "network",
    "saved",
    "history",
    "notifications",
  ]) {
    await page.goto(base + "/#" + route);
    await page.waitForTimeout(400);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      route + " overflows mobile",
    );
  }
  await page.goto(base + "/#home");
  await page.waitForTimeout(300);
  await page.screenshot({ path: "/tmp/lifejam-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: organizer demo login, publish, like, comment, filters, profile, book, cancel, message, desktop and mobile navigation.",
  );
} finally {
  await browser.close();
  if (!process.env.TEST_URL) {
    const { query, pool } = await import("../server/db.js");
    if (testPost) {
      const posts = await query("SELECT id FROM posts WHERE body=?", [
        testPost,
      ]);
      for (const p of posts) {
        await query("DELETE FROM reactions WHERE post_id=?", [p.id]);
        await query("DELETE FROM comments WHERE post_id=?", [p.id]);
        await query("DELETE FROM posts WHERE id=?", [p.id]);
      }
    }
    if (testMessage)
      await query("DELETE FROM messages WHERE body=?", [testMessage]);
    if (testBooking) {
      await query("DELETE FROM bookings WHERE title=?", [testBooking]);
      await query("DELETE FROM notifications WHERE body LIKE ?", [
        "%" + testBooking + "%",
      ]);
    }
    await pool.end();
  }
}
