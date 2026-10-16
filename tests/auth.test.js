import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { SMTPServer } from "smtp-server";
import { spawn } from "node:child_process";
import { randomBytes, generateKeyPairSync, createSign } from "node:crypto";
import { query, pool } from "../server/db.js";
import {
  beginGoogle,
  consumeGoogleAttempt,
  googleAccount,
  consumeVerification,
  digest,
  googleClient,
} from "../server/account-auth.js";
const inbox = [];
const ids = [];
const attempts = [];
const base = "http://localhost:3101";
let child,
  smtp,
  failMail = false;
let logs = "";
const smtpConfig = {
  disabledCommands: ["AUTH", "STARTTLS"],
  authOptional: true,
  onData(stream, session, callback) {
    let body = "";
    stream.on("data", (c) => (body += c));
    stream.on("end", () => {
      if (failMail) return callback(Error("Temporary delivery failure"));
      inbox.push({ body, to: session.envelope.rcptTo[0].address });
      callback();
    });
  },
};
async function request(url, { method = "GET", body, cookie } = {}) {
  const r = await fetch(base + "/api" + url, {
    method,
    redirect: "manual",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: r.status,
    data: r.headers.get("content-type")?.includes("application/json")
      ? await r.json()
      : null,
    cookie: r.headers.get("set-cookie")?.split(";")[0],
    location: r.headers.get("location"),
  };
}
const decodeMail = (body) =>
  body
    .replace(/=\r?\n/g, "")
    .replace(/=([A-F0-9]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const tokenFor = (email) =>
  decodeMail(inbox.filter((m) => m.to === email).at(-1)?.body || "").match(
    /verify-email\/([a-f0-9]{64})/,
  )?.[1];
let email,
  password = "VerificationTest2026!",
  uid,
  token;
before(async () => {
  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.APP_URL = base;
  smtp = new SMTPServer(smtpConfig);
  await new Promise((resolve, reject) => {
    smtp.once("error", reject);
    smtp.listen(2525, "127.0.0.1", resolve);
  });
  child = spawn(process.execPath, ["server/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: "3101",
      NODE_ENV: "production",
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "2525",
      SMTP_FROM: "LifeJamLokal <no-reply@lifejam.test>",
      SMTP_USER: "",
      SMTP_PASSWORD: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (c) => (logs += c));
  child.stderr.on("data", (c) => (logs += c));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + "/api/config")).ok) return;
    } catch {}
    if (child.exitCode !== null) throw Error(logs);
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Test server failed to start: " + logs);
});
after(async () => {
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await new Promise((r) => child.once("exit", r));
  }
  if (smtp) await new Promise((r) => smtp.close(r));
  if (ids.length) {
    const marks = ids.map(() => "?").join(",");
    for (const table of ["email_verifications", "sessions", "profiles"])
      await query(`DELETE FROM ${table} WHERE user_id IN (${marks})`, ids);
    await query(`DELETE FROM users WHERE id IN (${marks})`, ids);
  }
  for (const state of attempts)
    await query("DELETE FROM oauth_attempts WHERE state_hash=?", [state]);
  await pool.end();
});
test("signup sends a real SMTP message, leaves account unverified, and issues no session", async () => {
  email = `verify-${randomBytes(6).toString("hex")}@gmail.com`;
  const r = await request("/auth/register", {
    method: "POST",
    body: { name: "Verification Test", email, password, role: "musician" },
  });
  const rows = await query("SELECT * FROM users WHERE email=?", [email]);
  if (rows[0]) {
    uid = rows[0].id;
    ids.push(uid);
  }
  assert.equal(r.status, 202);
  assert.equal(r.data.verificationRequired, true);
  assert.equal(r.cookie, undefined);
  assert.equal(rows[0].email_verified, 0);
  assert.equal(
    (
      await request("/auth/login", {
        method: "POST",
        body: { email, password },
      })
    ).data.code,
    "EMAIL_NOT_VERIFIED",
  );
  assert.ok(inbox.some((m) => m.to === email));
  token = tokenFor(email);
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(
    (await query("SELECT COUNT(*) n FROM sessions WHERE user_id=?", [uid]))[0]
      .n,
    0,
  );
  assert.equal((await request("/musicians/" + uid)).status, 404);
  const stored = (
    await query("SELECT token_hash FROM email_verifications WHERE user_id=?", [
      uid,
    ])
  )[0];
  assert.equal(stored.token_hash, digest(token));
  assert.notEqual(stored.token_hash, token);
});
test("resend uses cooldown and does not reveal whether an address exists", async () => {
  const count = inbox.length;
  const known = await request("/auth/resend-verification", {
    method: "POST",
    body: { email },
  });
  const unknown = await request("/auth/resend-verification", {
    method: "POST",
    body: { email: "nobody-" + randomBytes(3).toString("hex") + "@gmail.com" },
  });
  assert.equal(known.status, 202);
  assert.deepEqual(known.data, unknown.data);
  assert.equal(inbox.length, count);
});
test("expired and forged verification tokens fail without activating an account", async () => {
  assert.equal(
    (
      await request("/auth/verify-email", {
        method: "POST",
        body: { token: "a".repeat(64) },
      })
    ).status,
    400,
  );
  await query(
    "UPDATE email_verifications SET expires_at=DATE_SUB(NOW(),INTERVAL 1 HOUR) WHERE user_id=?",
    [uid],
  );
  assert.equal(
    (await request("/auth/verify-email", { method: "POST", body: { token } }))
      .status,
    400,
  );
  assert.equal(
    (await query("SELECT email_verified FROM users WHERE id=?", [uid]))[0]
      .email_verified,
    0,
  );
  await query(
    "UPDATE email_verifications SET expires_at=DATE_ADD(NOW(),INTERVAL 1 HOUR) WHERE user_id=?",
    [uid],
  );
});
test("verification is single-use and enables password login", async () => {
  assert.equal(
    (await request("/auth/verify-email", { method: "POST", body: { token } }))
      .status,
    200,
  );
  assert.equal(
    (await request("/auth/verify-email", { method: "POST", body: { token } }))
      .status,
    400,
  );
  const login = await request("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(login.status, 200);
  assert.ok(login.cookie);
  assert.equal(login.data.user.email_verified, 1);
  assert.equal((await request("/musicians/" + uid)).status, 200);
});
test("SMTP delivery failure leaves a recoverable pending account and a later resend works", async () => {
  const e = `delivery-${randomBytes(4).toString("hex")}@gmail.com`;
  failMail = true;
  const r = await request("/auth/register", {
    method: "POST",
    body: { name: "Retry Test", email: e, password, role: "organizer" },
  });
  failMail = false;
  const u = (await query("SELECT id FROM users WHERE email=?", [e]))[0];
  if (u) ids.push(u.id);
  assert.equal(r.status, 502);
  assert.equal(
    (
      await query(
        "SELECT COUNT(*) n FROM email_verifications WHERE user_id=?",
        [u.id],
      )
    )[0].n,
    0,
  );
  assert.equal(
    (
      await request("/auth/resend-verification", {
        method: "POST",
        body: { email: e },
      })
    ).status,
    202,
  );
  assert.ok(tokenFor(e));
});
test("Google initiation uses trusted redirect, PKCE, nonce, state and a browser-bound cookie", async () => {
  const r = await request("/auth/google/start?role=musician");
  assert.equal(r.status, 302);
  const url = new URL(r.location);
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(
    url.searchParams.get("redirect_uri"),
    base + "/api/auth/google/callback",
  );
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.ok(url.searchParams.get("nonce"));
  assert.ok(r.cookie.startsWith("lifejam_oauth="));
  attempts.push(digest(url.searchParams.get("state")));
  assert.equal((await request("/auth/google/start?role=admin")).status, 400);
  const a = await beginGoogle("musician");
  const u = new URL(a.url),
    state = u.searchParams.get("state");
  attempts.push(digest(state));
  await assert.rejects(() => consumeGoogleAttempt(state, "b".repeat(64)));
  const accepted = await consumeGoogleAttempt(state, a.browserToken);
  assert.equal(accepted.role, "musician");
  await assert.rejects(() => consumeGoogleAttempt(state, a.browserToken));
  const bad = await request("/auth/google/callback?code=forged&state=" + state);
  assert.equal(bad.status, 302);
  assert.match(bad.location, /#auth-result\/error\//);
  assert.equal(bad.cookie?.startsWith("lifejam_session="), false);
});
test("Google JWT validation rejects wrong audience, issuer and forged signatures", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const cert = publicKey.export({ type: "spki", format: "pem" });
  const now = Math.floor(Date.now() / 1000);
  const jwt = (claims) => {
    const header = Buffer.from(
      JSON.stringify({ alg: "RS256", kid: "test-key" }),
    ).toString("base64url");
    const body = Buffer.from(
      JSON.stringify({
        iss: "https://accounts.google.com",
        aud: "test-client",
        iat: now,
        exp: now + 3600,
        ...claims,
      }),
    ).toString("base64url");
    const signed = header + "." + body;
    return (
      signed +
      "." +
      createSign("RSA-SHA256")
        .update(signed)
        .sign(privateKey)
        .toString("base64url")
    );
  };
  const verify = (t) =>
    googleClient().verifySignedJwtWithCertsAsync(
      t,
      { "test-key": cert },
      "test-client",
      ["https://accounts.google.com"],
    );
  assert.ok(await verify(jwt({ sub: "a-google-user" })));
  await assert.rejects(() => verify(jwt({ aud: "attacker-client" })));
  await assert.rejects(() => verify(jwt({ iss: "https://attacker.example" })));
  const good = jwt({});
  await assert.rejects(() => verify(good.slice(0, -12) + "AAAAAAAAAAAA"));
});
test("verified Google identities create correct roles and do not hijack unverified password accounts", async () => {
  const payload = {
    sub: "unit-" + randomBytes(10).toString("hex"),
    email: "oauth-" + randomBytes(5).toString("hex") + "@gmail.com",
    name: "Google Musician",
    email_verified: true,
  };
  const user = await googleAccount(payload, "musician");
  ids.push(user.id);
  assert.equal(user.role, "musician");
  assert.equal(user.email_verified, 1);
  assert.equal(user.password_login_enabled, 0);
  assert.equal(
    (await query("SELECT user_id FROM profiles WHERE user_id=?", [user.id]))[0]
      .user_id,
    user.id,
  );
  assert.equal((await googleAccount(payload, "organizer")).role, "musician");
  await assert.rejects(() =>
    googleAccount(
      { ...payload, sub: "new-sub", email: "different@example.com" },
      "organizer",
    ),
  );
  await assert.rejects(() =>
    googleAccount(
      {
        ...payload,
        sub: "new-sub",
        email: "unverified@gmail.com",
        email_verified: false,
      },
      "organizer",
    ),
  );
  const pending = (
    await query("SELECT email FROM users WHERE id=?", [ids[1]])
  )[0];
  await assert.rejects(() =>
    googleAccount(
      { ...payload, sub: "different-google-sub", email: pending.email },
      "organizer",
    ),
  );
  await query("UPDATE users SET suspended=TRUE WHERE id=?", [user.id]);
  await assert.rejects(() => googleAccount(payload, "musician"));
});
