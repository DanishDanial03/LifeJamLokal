import { randomBytes, createHash } from "node:crypto";
import nodemailer from "nodemailer";
import { OAuth2Client } from "google-auth-library";
import { query, pool, hashPassword } from "./db.js";
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export function appUrl() {
  const url = new URL(process.env.APP_URL || "http://localhost:3000");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw Error("APP_URL must be an HTTP(S) origin without a path.");
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw Error("APP_URL requires HTTPS outside localhost.");
  return url.origin;
}
export const mailConfigured = () =>
  !!(process.env.SMTP_HOST && process.env.SMTP_FROM);
export const googleConfigured = () =>
  !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const authError = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const demoEmails = [
  "aina",
  "amir",
  "daniel",
  "sarah",
  "nadia",
  "midnight",
  "rizal",
  "admin",
].map((v) => v + "@lifejam.local");
export const maySignIn = (u) =>
  !!u.email_verified ||
  (process.env.SEED_DEMO !== "false" && demoEmails.includes(u.email));
function transport() {
  const port = Number(process.env.SMTP_PORT || 465);
  const local = ["localhost", "127.0.0.1", "::1"].includes(
    process.env.SMTP_HOST,
  );
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465 && !local,
    connectionTimeout: 10000,
    socketTimeout: 15000,
    ...(process.env.SMTP_USER
      ? {
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        }
      : {}),
  });
}
export async function createPendingAccount({
  name,
  email,
  password,
  role,
  location,
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [row] = await conn.execute(
      "INSERT INTO users (name,email,password,role,location,bio) VALUES (?,?,?,?,?,?)",
      [name, email, hashPassword(password), role, location, ""],
    );
    if (role === "musician")
      await conn.execute(
        "INSERT INTO profiles (user_id,headline,description,genres,skills,portfolio,availability) VALUES (?,?,?,?,?,?,?)",
        [row.insertId, "Musician", "", "[]", "[]", "[]", "[]"],
      );
    await conn.commit();
    return (await query("SELECT * FROM users WHERE id=?", [row.insertId]))[0];
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
export async function sendVerification(user) {
  if (!mailConfigured())
    throw authError(
      "Verification email is not configured yet. Please contact the site administrator.",
      503,
    );
  const conn = await pool.getConnection();
  let token, tokenId;
  try {
    await conn.beginTransaction();
    const [users] = await conn.execute(
      "SELECT email_verified,suspended FROM users WHERE id=? FOR UPDATE",
      [user.id],
    );
    if (!users[0] || users[0].email_verified || users[0].suspended) {
      await conn.rollback();
      return false;
    }
    const [recent] = await conn.execute(
      "SELECT id FROM email_verifications WHERE user_id=? AND created_at>DATE_SUB(NOW(),INTERVAL 60 SECOND) LIMIT 1",
      [user.id],
    );
    if (recent.length) {
      await conn.rollback();
      return false;
    }
    token = randomBytes(32).toString("hex");
    const [row] = await conn.execute(
      "INSERT INTO email_verifications (user_id,token_hash,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 24 HOUR))",
      [user.id, digest(token)],
    );
    tokenId = row.insertId;
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  const link = appUrl() + "/#verify-email/" + token;
  try {
    await transport().sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: "Verify your LifeJamLokal account",
      text: `Welcome to LifeJamLokal!\n\nConfirm your email address to activate your account:\n${link}\n\nThis link expires in 24 hours and can be used once. If you did not sign up, you can ignore this email.\n\nLifeJamLokal`,
    });
  } catch {
    await query("DELETE FROM email_verifications WHERE id=?", [tokenId]);
    throw authError(
      "We could not send the verification email. Please try resending it shortly.",
      502,
    );
  }
  return true;
}
export async function consumeVerification(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    throw authError(
      "This verification link is invalid or expired. Request a new email.",
    );
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      "SELECT * FROM email_verifications WHERE token_hash=? AND expires_at>NOW() AND used_at IS NULL FOR UPDATE",
      [digest(token)],
    );
    if (!rows[0])
      throw authError(
        "This verification link is invalid, expired, or already used. Request a new email.",
      );
    const t = rows[0];
    const [users] = await conn.execute(
      "SELECT id,suspended,email_verified FROM users WHERE id=? FOR UPDATE",
      [t.user_id],
    );
    if (!users[0] || users[0].suspended)
      throw authError(
        "This account cannot be activated. Please contact the administrator.",
        403,
      );
    await conn.execute("UPDATE users SET email_verified=TRUE WHERE id=?", [
      t.user_id,
    ]);
    await conn.execute(
      "UPDATE email_verifications SET used_at=NOW() WHERE user_id=? AND used_at IS NULL",
      [t.user_id],
    );
    await conn.execute("DELETE FROM sessions WHERE user_id=?", [t.user_id]);
    await conn.commit();
    return true;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
export function googleClient() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    appUrl() + "/api/auth/google/callback",
  );
}
export async function beginGoogle(role) {
  if (!googleConfigured())
    throw authError("Google sign-in is not configured yet.", 503);
  if (!["organizer", "musician"].includes(role))
    throw authError("Choose an organizer or musician account.");
  const state = randomBytes(32).toString("hex"),
    nonce = randomBytes(32).toString("hex"),
    browserToken = randomBytes(32).toString("hex");
  const client = googleClient();
  const { codeVerifier, codeChallenge } =
    await client.generateCodeVerifierAsync();
  await query("DELETE FROM oauth_attempts WHERE expires_at<NOW()");
  await query(
    "INSERT INTO oauth_attempts (state_hash,browser_hash,nonce,verifier,role,expires_at) VALUES (?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 10 MINUTE))",
    [digest(state), digest(browserToken), nonce, codeVerifier, role],
  );
  const url = client.generateAuthUrl({
    scope: ["openid", "email", "profile"],
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return { url, browserToken };
}
export async function consumeGoogleAttempt(state, browserToken) {
  if (
    !/^[a-f0-9]{64}$/.test(state || "") ||
    !/^[a-f0-9]{64}$/.test(browserToken || "")
  )
    throw authError(
      "Google sign-in expired or could not be verified. Please try again.",
    );
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      "SELECT * FROM oauth_attempts WHERE state_hash=? AND browser_hash=? AND expires_at>NOW() FOR UPDATE",
      [digest(state), digest(browserToken)],
    );
    if (!rows[0])
      throw authError(
        "Google sign-in expired or could not be verified. Please try again.",
      );
    await conn.execute("DELETE FROM oauth_attempts WHERE state_hash=?", [
      digest(state),
    ]);
    await conn.commit();
    return rows[0];
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
// Only call after verifying Google's signature, issuer, audience and nonce.
export async function googleAccount(payload, role) {
  if (
    payload.email_verified !== true ||
    typeof payload.sub !== "string" ||
    !payload.sub ||
    payload.sub.length > 255 ||
    typeof payload.email !== "string" ||
    !/@(gmail|googlemail)\.com$/i.test(payload.email) ||
    payload.email.length > 190
  )
    throw authError(
      "Please choose a Google account with a verified Gmail address.",
      403,
    );
  if (!["organizer", "musician"].includes(role))
    throw authError("Invalid account role.");
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      "SELECT * FROM users WHERE google_sub=? OR email=? FOR UPDATE",
      [payload.sub, payload.email.toLowerCase()],
    );
    let user = rows.find((u) => u.google_sub === payload.sub) || rows[0];
    if (user) {
      if (user.suspended)
        throw authError(
          "This account is suspended. Contact the administrator.",
          403,
        );
      if (user.google_sub !== payload.sub) {
        if (user.google_sub || !user.email_verified)
          throw authError(
            "An email/password account already uses this address. Verify that account and sign in with its password before using Google.",
            409,
          );
        await conn.execute("UPDATE users SET google_sub=? WHERE id=?", [
          payload.sub,
          user.id,
        ]);
      }
    } else {
      const [r] = await conn.execute(
        "INSERT INTO users (name,email,password,role,location,bio,email_verified,google_sub,password_login_enabled) VALUES (?,?,?,?,?,?,TRUE,?,FALSE)",
        [
          (payload.name || "Musician").slice(0, 100),
          payload.email.toLowerCase(),
          hashPassword(randomBytes(48).toString("hex")),
          role,
          "Kuala Lumpur",
          "",
          payload.sub,
        ],
      );
      user = { id: r.insertId };
      if (role === "musician")
        await conn.execute(
          "INSERT INTO profiles (user_id,headline,description,genres,skills,portfolio,availability) VALUES (?,?,?,?,?,?,?)",
          [user.id, "Musician", "", "[]", "[]", "[]", "[]"],
        );
    }
    await conn.commit();
    return (await query("SELECT * FROM users WHERE id=?", [user.id]))[0];
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
