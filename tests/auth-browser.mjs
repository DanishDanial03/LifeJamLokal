import { chromium } from "playwright-core";
import { SMTPServer } from "smtp-server";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { query, pool } from "../server/db.js";
const inbox = [];
const errors = [];
const base = "http://localhost:3102";
let server, browser, uid;
let logs = "";
const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ["AUTH", "STARTTLS"],
  onData(stream, session, callback) {
    let body = "";
    stream.on("data", (c) => (body += c));
    stream.on("end", () => {
      inbox.push(body);
      callback();
    });
  },
});
try {
  await new Promise((resolve, reject) => {
    smtp.once("error", reject);
    smtp.listen(2526, "127.0.0.1", resolve);
  });
  server = spawn(process.execPath, ["server/index.js"], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: "3102",
      APP_URL: base,
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "2526",
      SMTP_FROM: "LifeJamLokal <no-reply@lifejam.test>",
      SMTP_USER: "",
      SMTP_PASSWORD: "",
      GOOGLE_CLIENT_ID: "test-client",
      GOOGLE_CLIENT_SECRET: "test-secret",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (c) => (logs += c));
  server.stderr.on("data", (c) => (logs += c));
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + "/api/config")).ok) {
        ready = true;
        break;
      }
    } catch {}
    if (server.exitCode !== null) throw Error(logs);
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(ready, true, logs);
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page
    .getByRole("button", { name: "Sign in", exact: false })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Join the community", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Continue with Google" })
      .isEnabled(),
    true,
  );
  await page.getByRole("button", { name: "I make music", exact: true }).click();
  const email =
    "browser-verify-" + randomBytes(5).toString("hex") + "@gmail.com";
  await page
    .getByLabel("Your name", { exact: true })
    .fill("Verified Browser Musician");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel(/^Password/).fill("BrowserPassword2026!");
  await page
    .getByRole("button", { name: "Let’s make some noise", exact: false })
    .click();
  await page
    .getByRole("heading", { name: "Check your inbox.", exact: true })
    .waitFor();
  uid = (await query("SELECT id FROM users WHERE email=?", [email]))[0].id;
  const me = await page.request.get(base + "/api/me");
  assert.equal((await me.json()).user, null);
  await page
    .getByRole("button", { name: "Resend verification email", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Please wait before resending" })
    .waitFor();
  const token = inbox
    .at(-1)
    .replace(/=\r?\n/g, "")
    .replace(/=([A-F0-9]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .match(/verify-email\/([a-f0-9]{64})/)[1];
  await page.goto(base + "/#verify-email/" + token);
  await page
    .getByRole("button", { name: "Verify my email", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "You’re verified. Let’s make some noise." })
    .waitFor();
  await page.getByRole("button", { name: "Sign in to LifeJamLokal" }).click();
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel(/^Password/).fill("BrowserPassword2026!");
  await page.getByRole("button", { name: "Welcome back", exact: true }).click();
  await page
    .getByRole("heading", { name: "Verified Browser Musician", exact: true })
    .waitFor();
  assert.equal(
    (await page.request.get(base + "/api/me").then((r) => r.json())).user
      .email_verified,
    1,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/#verify-email/not-a-valid-token");
  await page
    .getByRole("button", { name: "Verify my email", exact: true })
    .click();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Email signup → SMTP delivery → resend cooldown → confirmation → verified login passed in the browser; invalid link and mobile layout passed.",
  );
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((r) => server.once("exit", r));
  }
  await new Promise((r) => smtp.close(r));
  if (uid) {
    for (const table of ["email_verifications", "sessions", "profiles"])
      await query(`DELETE FROM ${table} WHERE user_id=?`, [uid]);
    await query("DELETE FROM users WHERE id=?", [uid]);
  }
  await pool.end();
}
