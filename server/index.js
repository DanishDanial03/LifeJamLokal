import express from "express";
import {
  createPendingAccount,
  maySignIn,
  mailConfigured,
  googleConfigured,
  sendVerification,
  consumeVerification,
  beginGoogle,
  consumeGoogleAttempt,
  googleClient,
  googleAccount,
  appUrl,
} from "./account-auth.js";
import { keywordRank } from "./search.js";
import multer from "multer";
import {
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initDb, query, pool, parse, profile, hashPassword } from "./db.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(path.join(root, "data/uploads"), { recursive: true });
appUrl();
await initDb();
export const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers["sec-fetch-site"] === "cross-site"
  )
    return res
      .status(403)
      .json({ error: "Cross-site requests are not allowed." });
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(
  "/uploads",
  express.static(path.join(root, "data/uploads"), {
    setHeaders: (res) =>
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; media-src 'self'; img-src 'self'",
      ),
  }),
);
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const fail = (message, status = 400) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};
const text = (v, max = 5000) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const id = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) fail("Invalid identifier.");
  return n;
};
const notify = (user, body) =>
  query("INSERT INTO notifications (user_id,body) VALUES (?,?)", [user, body]);
const publicUser = (u) => {
  const { password, google_sub, ...rest } = u;
  return { ...rest, suspended: !!u.suspended };
};
app.use(
  "/api",
  wrap(async (req, res, next) => {
    const cookie = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("lifejam_session="))
      ?.slice(16);
    if (cookie) {
      const rows = await query(
        "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>NOW()",
        [createHash("sha256").update(cookie).digest("hex")],
      );
      if (rows[0] && !rows[0].suspended && maySignIn(rows[0]))
        req.user = publicUser(rows[0]);
    }
    next();
  }),
);
const auth = (req, res, next) =>
  req.user
    ? next()
    : res.status(401).json({ error: "Please sign in to continue." });
const role =
  (...roles) =>
  (req, res, next) =>
    req.user && roles.includes(req.user.role)
      ? next()
      : res
          .status(403)
          .json({ error: "You do not have permission for this action." });
const attempts = new Map();
app.use("/api/auth", (req, res, next) => {
  const key = req.ip;
  const a = attempts.get(key) || { count: 0, until: Date.now() + 600000 };
  if (Date.now() > a.until) {
    a.count = 0;
    a.until = Date.now() + 600000;
  }
  a.count++;
  attempts.set(key, a);
  if (a.count > 60)
    return res
      .status(429)
      .json({ error: "Too many attempts. Please try again in 10 minutes." });
  next();
});
async function session(res, userId) {
  const token = randomBytes(32).toString("hex");
  await query(
    "INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 7 DAY))",
    [createHash("sha256").update(token).digest("hex"), userId],
  );
  res.cookie("lifejam_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: 7 * 86400000,
    path: "/",
  });
}
app.get(
  "/api/health",
  wrap(async (req, res) => {
    await query("SELECT 1");
    let semantic;
    try {
      semantic = await fetch(
        `${process.env.SEMANTIC_URL || "http://127.0.0.1:8001"}/health`,
        { signal: AbortSignal.timeout(3000) },
      ).then((r) => r.json());
    } catch {
      semantic = { ready: false };
    }
    res.json({ database: "mysql", semantic });
  }),
);
app.get("/api/config", (req, res) =>
  res.json({
    demo: process.env.SEED_DEMO !== "false",
    googleSignIn: googleConfigured(),
    emailVerification: mailConfigured(),
  }),
);
app.get("/api/me", (req, res) => res.json({ user: req.user || null }));
app.post(
  "/api/auth/register",
  wrap(async (req, res) => {
    const name = text(req.body.name, 100),
      email = text(req.body.email, 190).toLowerCase(),
      password = req.body.password,
      roleName = req.body.role;
    if (
      !name ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      typeof password !== "string" ||
      password.length < 10 ||
      password.length > 128 ||
      !["musician", "organizer"].includes(roleName)
    )
      fail(
        "Enter a name, valid email, role, and password of 10–128 characters.",
      );
    if (!mailConfigured())
      fail(
        "Email verification is not configured yet. Please contact the site administrator.",
        503,
      );
    if ((await query("SELECT id FROM users WHERE email=?", [email])).length)
      fail(
        "An account with this email already exists. Sign in or resend its verification email.",
        409,
      );
    const user = await createPendingAccount({
      name,
      email,
      password,
      role: roleName,
      location: text(req.body.location, 100) || "Kuala Lumpur",
    });
    // Account stays pending if delivery fails; the user can resend from sign-in.
    try {
      await sendVerification(user);
    } catch (e) {
      return res.status(e.status || 502).json({
        error: e.message,
        code: "VERIFICATION_DELIVERY_FAILED",
        email,
      });
    }
    res.status(202).json({
      verificationRequired: true,
      email,
      message: "Check your inbox and confirm your email before signing in.",
    });
  }),
);
app.post(
  "/api/auth/login",
  wrap(async (req, res) => {
    const u = (
      await query("SELECT * FROM users WHERE email=?", [
        text(req.body.email, 190).toLowerCase(),
      ])
    )[0];
    const pw = req.body.password;
    if (
      !u ||
      !u.password_login_enabled ||
      typeof pw !== "string" ||
      pw.length > 128
    )
      fail("Email or password is incorrect.", 401);
    const [salt, hashed] = u.password.split(":");
    if (!timingSafeEqual(Buffer.from(hashed, "hex"), scryptSync(pw, salt, 64)))
      fail("Email or password is incorrect.", 401);
    if (u.suspended)
      fail(
        "This account is suspended. Contact the platform administrator.",
        403,
      );
    if (!maySignIn(u))
      return res.status(403).json({
        error:
          "Please verify your email before signing in. You can request a new verification email below.",
        code: "EMAIL_NOT_VERIFIED",
      });
    await session(res, u.id);
    res.json({ user: publicUser(u) });
  }),
);
app.post(
  "/api/auth/resend-verification",
  wrap(async (req, res) => {
    const email = text(req.body.email, 190).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) fail("Enter your email address.");
    if (!mailConfigured())
      fail(
        "Verification email is not configured yet. Please contact the site administrator.",
        503,
      );
    const user = (await query("SELECT * FROM users WHERE email=?", [email]))[0];
    if (user && !user.suspended && !user.email_verified)
      try {
        await sendVerification(user);
      } catch (e) {
        return res.status(e.status || 502).json({
          error: e.message,
          code: "VERIFICATION_DELIVERY_FAILED",
          email,
        });
      }
    res.status(202).json({
      message:
        "If this address needs verification, an email has been sent. Check your inbox or spam folder. Please wait 60 seconds before trying again.",
    });
  }),
);
app.post(
  "/api/auth/verify-email",
  wrap(async (req, res) => {
    await consumeVerification(req.body.token);
    res.json({ message: "Your email is verified. You can now sign in." });
  }),
);
app.get(
  "/api/auth/google/start",
  wrap(async (req, res) => {
    const { url, browserToken } = await beginGoogle(
      req.query.role || "organizer",
    );
    res.cookie("lifejam_oauth", browserToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      path: "/api/auth/google/callback",
      maxAge: 600000,
    });
    res.redirect(url);
  }),
);
app.get("/api/auth/google/callback", async (req, res) => {
  try {
    const browserToken = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("lifejam_oauth="))
      ?.slice("lifejam_oauth=".length);
    const attempt = await consumeGoogleAttempt(req.query.state, browserToken);
    res.clearCookie("lifejam_oauth", { path: "/api/auth/google/callback" });
    if (req.query.error) throw Error("Google sign-in was cancelled.");
    if (typeof req.query.code !== "string")
      throw Error("Google did not return an authorization code.");
    const client = googleClient();
    const { tokens } = await client.getToken({
      code: req.query.code,
      codeVerifier: attempt.verifier,
    });
    if (!tokens.id_token) throw Error("Google did not return an ID token.");
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || payload.nonce !== attempt.nonce)
      throw Error("Invalid Google nonce.");
    const user = await googleAccount(payload, attempt.role);
    await session(res, user.id);
    res.redirect(appUrl() + "/#auth-result/success");
  } catch (e) {
    res.clearCookie("lifejam_oauth", { path: "/api/auth/google/callback" });
    res.redirect(
      appUrl() +
        "/#auth-result/error/" +
        encodeURIComponent(
          e.status
            ? e.message
            : "Google sign-in could not be completed. Please try again.",
        ),
    );
  }
});
app.post(
  "/api/auth/logout",
  wrap(async (req, res) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("lifejam_session="))
      ?.slice(16);
    if (token)
      await query("DELETE FROM sessions WHERE token=?", [
        createHash("sha256").update(token).digest("hex"),
      ]);
    res.clearCookie("lifejam_session", { path: "/" });
    res.json({ ok: true });
  }),
);
const musicianSql = `SELECT p.*,u.name,u.avatar,u.location,u.bio,COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.musician_id=u.id AND r.hidden=FALSE),0) rating,(SELECT COUNT(*) FROM reviews r WHERE r.musician_id=u.id AND r.hidden=FALSE) review_count FROM profiles p JOIN users u ON p.user_id=u.id WHERE p.hidden=FALSE AND u.suspended=FALSE AND (u.email_verified=TRUE ${process.env.SEED_DEMO !== "false" ? "OR u.email IN ('amir@lifejam.local','daniel@lifejam.local','sarah@lifejam.local','nadia@lifejam.local','midnight@lifejam.local','rizal@lifejam.local')" : ""})`;
app.get(
  "/api/musicians",
  wrap(async (req, res) => {
    let rows = (await query(musicianSql)).map(profile);
    if (req.query.location)
      rows = rows.filter((p) =>
        p.location
          .toLowerCase()
          .includes(String(req.query.location).toLowerCase()),
      );
    if (req.query.genre)
      rows = rows.filter((p) => p.genres.includes(req.query.genre));
    if (req.query.budget)
      rows = rows.filter((p) => p.rate <= Number(req.query.budget));
    const q = text(req.query.q, 1000);
    let engine = null,
      duration = 0,
      warning = null;
    if (q) {
      const started = Date.now();
      let result;
      try {
        const response = await fetch(
          `${process.env.SEMANTIC_URL || "http://127.0.0.1:8001"}/rank`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: q,
              profiles: rows.map((p) => ({
                id: p.user_id,
                text: [
                  p.name,
                  p.headline,
                  p.description,
                  ...p.genres,
                  ...p.skills,
                ].join(" "),
              })),
            }),
            signal: AbortSignal.timeout(30000),
          },
        );
        if (!response.ok) throw Error("Semantic service unavailable");
        result = await response.json();
      } catch {
        result = keywordRank(
          q,
          rows.map((p) => ({
            id: p.user_id,
            text: [
              p.name,
              p.headline,
              p.description,
              ...p.genres,
              ...p.skills,
            ].join(" "),
          })),
        );
      }
      warning = result.warning || null;
      engine = result.model;
      const scores = new Map(result.results.map((r) => [r.id, r.score]));
      rows = rows
        .map((p) => ({ ...p, score: scores.get(p.user_id) || 0 }))
        .sort((a, b) => b.score - a.score);
      duration = Date.now() - started;
      if (req.user)
        await query(
          "INSERT INTO searches (user_id,query,engine,duration_ms,results) VALUES (?,?,?,?,?)",
          [
            req.user.id,
            q,
            engine,
            duration,
            JSON.stringify(
              rows.map((p) => ({ id: p.user_id, score: p.score })),
            ),
          ],
        );
      if (Array.isArray(result.embeddings))
        for (const e of result.embeddings)
          await query(
            "INSERT INTO embeddings (musician_id,model,vector) VALUES (?,?,?) ON DUPLICATE KEY UPDATE model=VALUES(model),vector=VALUES(vector)",
            [e.id, engine, JSON.stringify(e.vector)],
          );
    }
    res.json({ musicians: rows, engine, duration, warning });
  }),
);
app.get(
  "/api/musicians/:id",
  wrap(async (req, res) => {
    const uid = id(req.params.id);
    const rows = await query(`${musicianSql} AND u.id=?`, [uid]);
    if (!rows[0]) fail("Musician not found.", 404);
    const reviews = await query(
      "SELECT r.*,u.name,u.avatar FROM reviews r JOIN users u ON r.author_id=u.id WHERE r.musician_id=? AND r.hidden=FALSE ORDER BY r.created_at DESC",
      [uid],
    );
    const bookings = await query(
      "SELECT event_date,start_time,end_time FROM bookings WHERE musician_id=? AND status='accepted' AND event_date>=CURDATE()",
      [uid],
    );
    res.json({ musician: profile(rows[0]), reviews, bookings });
  }),
);
app.patch(
  "/api/profile",
  auth,
  wrap(async (req, res) => {
    const b = req.body;
    const name = text(b.name, 100),
      location = text(b.location, 100);
    if (!name || !location) fail("Name and location are required.");
    const avatar = safeUrl(b.avatar);
    await query(
      "UPDATE users SET name=?,location=?,bio=?,avatar=? WHERE id=?",
      [name, location, text(b.bio), avatar, req.user.id],
    );
    if (req.user.role === "musician") {
      const genres = Array.isArray(b.genres)
        ? b.genres
            .map((v) => text(v, 40))
            .filter(Boolean)
            .slice(0, 12)
        : [];
      const skills = Array.isArray(b.skills)
        ? b.skills
            .map((v) => text(v, 50))
            .filter(Boolean)
            .slice(0, 20)
        : [];
      const portfolio = Array.isArray(b.portfolio)
        ? b.portfolio
            .map((p) => ({
              title: text(p.title, 100),
              url: safeUrl(p.url),
              type: ["image", "audio", "video", "link"].includes(p.type)
                ? p.type
                : "link",
            }))
            .filter((p) => p.url)
            .slice(0, 20)
        : [];
      const availability = Array.isArray(b.availability)
        ? b.availability
            .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v))
            .slice(0, 365)
        : [];
      const rate = Number(b.rate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100000)
        fail("Enter a valid rate.");
      await query(
        "UPDATE profiles SET headline=?,description=?,genres=?,skills=?,portfolio=?,availability=?,rate=?,cover=? WHERE user_id=?",
        [
          text(b.headline, 200),
          text(b.description),
          JSON.stringify(genres),
          JSON.stringify(skills),
          JSON.stringify(portfolio),
          JSON.stringify(availability),
          rate,
          safeUrl(b.cover),
          req.user.id,
        ],
      );
      await query("DELETE FROM embeddings WHERE musician_id=?", [req.user.id]);
    }
    res.json({
      user: publicUser(
        (await query("SELECT * FROM users WHERE id=?", [req.user.id]))[0],
      ),
    });
  }),
);
function safeUrl(value) {
  if (!value) return null;
  if (/^\/(uploads|images)\/[a-zA-Z0-9.-]+$/.test(value)) return value;
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}
const upload = multer({
  dest: path.join(root, "data/uploads"),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    cb(
      null,
      [
        "image/jpeg",
        "image/png",
        "image/webp",
        "audio/mpeg",
        "audio/wav",
        "audio/ogg",
        "video/mp4",
      ].includes(file.mimetype),
    ),
});
app.post(
  "/api/uploads",
  auth,
  upload.single("file"),
  wrap(async (req, res) => {
    if (!req.file)
      fail("Upload a JPG, PNG, WebP, MP3, WAV, OGG or MP4 file (up to 20 MB).");
    const bytes = await readFile(req.file.path);
    const mime = req.file.mimetype;
    const valid =
      mime === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216
        : mime === "image/png"
          ? bytes.subarray(1, 4).toString() === "PNG"
          : mime === "image/webp"
            ? bytes.subarray(8, 12).toString() === "WEBP"
            : mime === "audio/mpeg"
              ? bytes.subarray(0, 3).toString() === "ID3" || bytes[0] === 255
              : mime === "audio/wav"
                ? bytes.subarray(0, 4).toString() === "RIFF"
                : mime === "audio/ogg"
                  ? bytes.subarray(0, 4).toString() === "OggS"
                  : bytes.subarray(4, 8).toString() === "ftyp";
    if (!valid) {
      await unlink(req.file.path);
      fail("The file content does not match its type.");
    }
    const ext = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "audio/mpeg": ".mp3",
      "audio/wav": ".wav",
      "audio/ogg": ".ogg",
      "video/mp4": ".mp4",
    }[mime];
    const { rename } = await import("node:fs/promises");
    await rename(req.file.path, req.file.path + ext);
    res.status(201).json({
      url: "/uploads/" + req.file.filename + ext,
      type: mime.startsWith("image")
        ? "image"
        : mime.startsWith("audio")
          ? "audio"
          : "video",
    });
  }),
);
app.get(
  "/api/bookings",
  auth,
  wrap(async (req, res) => {
    const bookings = await query(
      "SELECT b.*,o.name organizer_name,o.avatar organizer_avatar,m.name musician_name,m.avatar musician_avatar,(SELECT id FROM reviews WHERE booking_id=b.id) review_id FROM bookings b JOIN users o ON b.organizer_id=o.id JOIN users m ON b.musician_id=m.id WHERE b.organizer_id=? OR b.musician_id=? ORDER BY b.event_date DESC",
      [req.user.id, req.user.id],
    );
    res.json({ bookings });
  }),
);
app.post(
  "/api/bookings",
  auth,
  role("organizer"),
  wrap(async (req, res) => {
    const b = req.body,
      mid = id(b.musician_id);
    if (!(await query(`${musicianSql} AND u.id=?`, [mid])).length)
      fail("Musician not found.", 404);
    if (
      !text(b.title, 150) ||
      !text(b.location, 200) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(b.event_date) ||
      !Number.isFinite(Date.parse(b.event_date)) ||
      new Date(b.event_date).toISOString().slice(0, 10) !== b.event_date ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.start_time) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.end_time) ||
      b.start_time >= b.end_time ||
      b.event_date <
        new Date().toLocaleDateString("en-CA", {
          timeZone: "Asia/Kuala_Lumpur",
        }) ||
      !Number.isFinite(Number(b.budget)) ||
      Number(b.budget) < 0
    )
      fail(
        "Enter an event name, location, future date, valid time range, and budget.",
      );
    const p = profile(
      (await query("SELECT * FROM profiles WHERE user_id=?", [mid]))[0],
    );
    if (p.availability.includes(b.event_date))
      fail("The musician is unavailable on this date.", 409);
    const conflicts = await query(
      "SELECT id FROM bookings WHERE musician_id=? AND event_date=? AND status='accepted' AND start_time<? AND end_time>?",
      [mid, b.event_date, b.end_time, b.start_time],
    );
    if (conflicts.length)
      fail("This musician already has a booking at that time.", 409);
    const r = await query(
      "INSERT INTO bookings (organizer_id,musician_id,title,event_date,start_time,end_time,location,budget,details) VALUES (?,?,?,?,?,?,?,?,?)",
      [
        req.user.id,
        mid,
        text(b.title, 150),
        b.event_date,
        b.start_time,
        b.end_time,
        text(b.location, 200),
        Number(b.budget),
        text(b.details),
      ],
    );
    await notify(
      mid,
      `${req.user.name} sent you a booking request for ${text(b.title, 150)}.`,
    );
    res.status(201).json({ id: r.insertId });
  }),
);
app.patch(
  "/api/bookings/:id",
  auth,
  wrap(async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        "SELECT * FROM bookings WHERE id=? FOR UPDATE",
        [id(req.params.id)],
      );
      const b = rows[0];
      if (!b) fail("Booking not found.", 404);
      const target = req.body.status;
      const musician = req.user.id === b.musician_id,
        organizer = req.user.id === b.organizer_id;
      if (!musician && !organizer) fail("Permission denied.", 403);
      if (target === "accepted" || target === "rejected") {
        if (!musician || b.status !== "pending")
          fail("Only the musician can respond to a pending request.", 409);
        if (target === "accepted") {
          await connection.execute(
            "SELECT id FROM users WHERE id=? FOR UPDATE",
            [b.musician_id],
          );
          const [conflicts] = await connection.execute(
            "SELECT id FROM bookings WHERE musician_id=? AND event_date=? AND status='accepted' AND start_time<? AND end_time>?",
            [b.musician_id, b.event_date, b.end_time, b.start_time],
          );
          if (conflicts.length)
            fail("There is an overlapping accepted booking.", 409);
        }
      } else if (target === "cancelled") {
        if (!["pending", "accepted"].includes(b.status))
          fail("This booking cannot be cancelled.", 409);
      } else if (target === "completed") {
        if (!organizer || b.status !== "accepted")
          fail("Only the organizer can complete an accepted booking.", 409);
        const eventEnd = new Date(
          `${String(b.event_date).slice(0, 10)}T${b.end_time}:00+08:00`,
        );
        if (eventEnd > new Date())
          fail(
            "The performance must finish before it can be marked complete.",
            409,
          );
      } else fail("Invalid status.");
      await connection.execute("UPDATE bookings SET status=? WHERE id=?", [
        target,
        b.id,
      ]);
      await connection.commit();
      await notify(
        musician ? b.organizer_id : b.musician_id,
        `Booking “${b.title}” is now ${target}.`,
      );
      res.json({ ok: true });
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }),
);
app.post(
  "/api/reviews",
  auth,
  wrap(async (req, res) => {
    const b = (
      await query("SELECT * FROM bookings WHERE id=?", [
        id(req.body.booking_id),
      ])
    )[0];
    if (!b || b.organizer_id !== req.user.id || b.status !== "completed")
      fail("You can only review your own completed bookings.", 403);
    const scores = ["performance", "professionalism", "communication"].map(
      (k) => Number(req.body[k]),
    );
    if (
      scores.some((v) => !Number.isInteger(v) || v < 1 || v > 5) ||
      !text(req.body.comment, 2000)
    )
      fail("Add a review and rate each category from 1 to 5.");
    if (
      (await query("SELECT id FROM reviews WHERE booking_id=?", [b.id])).length
    )
      fail("You have already reviewed this booking.", 409);
    await query(
      "INSERT INTO reviews (booking_id,author_id,musician_id,performance,professionalism,communication,rating,comment) VALUES (?,?,?,?,?,?,?,?)",
      [
        b.id,
        req.user.id,
        b.musician_id,
        ...scores,
        scores.reduce((a, b) => a + b) / 3,
        text(req.body.comment, 2000),
      ],
    );
    await notify(
      b.musician_id,
      `${req.user.name} left a review for ${b.title}.`,
    );
    res.status(201).json({ ok: true });
  }),
);
app.get(
  "/api/history",
  auth,
  wrap(async (req, res) =>
    res.json({
      history: await query(
        "SELECT id,query,engine,duration_ms,created_at FROM searches WHERE user_id=? ORDER BY id DESC LIMIT 30",
        [req.user.id],
      ),
    }),
  ),
);
app.delete(
  "/api/history",
  auth,
  wrap(async (req, res) => {
    await query("DELETE FROM searches WHERE user_id=?", [req.user.id]);
    res.json({ ok: true });
  }),
);
app.get(
  "/api/saved",
  auth,
  wrap(async (req, res) =>
    res.json({
      musicians: (
        await query(
          `${musicianSql} AND u.id IN (SELECT musician_id FROM saved WHERE user_id=?)`,
          [req.user.id],
        )
      ).map(profile),
    }),
  ),
);
app.post(
  "/api/saved/:id",
  auth,
  wrap(async (req, res) => {
    const mid = id(req.params.id);
    if (!(await query(`${musicianSql} AND u.id=?`, [mid])).length)
      fail("Musician not found.", 404);
    const exists = (
      await query("SELECT * FROM saved WHERE user_id=? AND musician_id=?", [
        req.user.id,
        mid,
      ])
    ).length;
    if (exists)
      await query("DELETE FROM saved WHERE user_id=? AND musician_id=?", [
        req.user.id,
        mid,
      ]);
    else
      await query("INSERT INTO saved (user_id,musician_id) VALUES (?,?)", [
        req.user.id,
        mid,
      ]);
    res.json({ saved: !exists });
  }),
);
app.get(
  "/api/network",
  auth,
  wrap(async (req, res) =>
    res.json({
      connections: await query(
        "SELECT u.id,u.name,u.avatar,u.role,u.location,p.headline FROM connections c JOIN users u ON c.target_id=u.id LEFT JOIN profiles p ON p.user_id=u.id WHERE c.user_id=? AND u.suspended=FALSE",
        [req.user.id],
      ),
    }),
  ),
);
app.post(
  "/api/network/:id",
  auth,
  wrap(async (req, res) => {
    const target = id(req.params.id);
    if (
      target === req.user.id ||
      !(
        await query("SELECT id FROM users WHERE id=? AND suspended=FALSE", [
          target,
        ])
      ).length
    )
      fail("Invalid connection.");
    const exists = (
      await query("SELECT * FROM connections WHERE user_id=? AND target_id=?", [
        req.user.id,
        target,
      ])
    ).length;
    if (exists)
      await query("DELETE FROM connections WHERE user_id=? AND target_id=?", [
        req.user.id,
        target,
      ]);
    else {
      await query("INSERT INTO connections (user_id,target_id) VALUES (?,?)", [
        req.user.id,
        target,
      ]);
      await notify(target, `${req.user.name} connected with you.`);
    }
    res.json({ connected: !exists });
  }),
);
app.get(
  "/api/people/:id",
  auth,
  wrap(async (req, res) => {
    const rows = await query(
      "SELECT u.id,u.name,u.avatar,u.role,u.location,p.headline FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.id=? AND u.suspended=FALSE",
      [id(req.params.id)],
    );
    if (!rows[0]) fail("Member not found.", 404);
    res.json({ person: rows[0] });
  }),
);
app.get(
  "/api/messages",
  auth,
  wrap(async (req, res) => {
    const messages = await query(
      "SELECT m.*,s.name sender_name,s.avatar sender_avatar,r.name recipient_name,r.avatar recipient_avatar FROM messages m JOIN users s ON s.id=m.sender_id JOIN users r ON r.id=m.recipient_id WHERE m.sender_id=? OR m.recipient_id=? ORDER BY m.id",
      [req.user.id, req.user.id],
    );
    res.json({ messages });
  }),
);
app.post(
  "/api/messages",
  auth,
  wrap(async (req, res) => {
    const target = id(req.body.recipient_id),
      body = text(req.body.body, 4000);
    if (!body || target === req.user.id)
      fail("Choose a recipient and enter a message.");
    if (
      !(
        await query("SELECT id FROM users WHERE id=? AND suspended=FALSE", [
          target,
        ])
      ).length
    )
      fail("Recipient not found.", 404);
    const r = await query(
      "INSERT INTO messages (sender_id,recipient_id,body) VALUES (?,?,?)",
      [req.user.id, target, body],
    );
    await notify(target, `${req.user.name} sent you a message.`);
    res.status(201).json({ id: r.insertId });
  }),
);
app.post(
  "/api/messages/:id/read",
  auth,
  wrap(async (req, res) => {
    await query(
      "UPDATE messages SET read_at=NOW() WHERE sender_id=? AND recipient_id=?",
      [id(req.params.id), req.user.id],
    );
    res.json({ ok: true });
  }),
);
app.get(
  "/api/notifications",
  auth,
  wrap(async (req, res) =>
    res.json({
      notifications: await query(
        "SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 40",
        [req.user.id],
      ),
    }),
  ),
);
app.post(
  "/api/notifications/read",
  auth,
  wrap(async (req, res) => {
    await query("UPDATE notifications SET read_at=NOW() WHERE user_id=?", [
      req.user.id,
    ]);
    res.json({ ok: true });
  }),
);
app.get(
  "/api/posts",
  wrap(async (req, res) => {
    let posts = await query(
      `SELECT p.*,u.name,u.avatar,u.role,pr.headline,(SELECT COUNT(*) FROM reactions r WHERE r.post_id=p.id) likes,(SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) comment_count FROM posts p JOIN users u ON u.id=p.user_id LEFT JOIN profiles pr ON pr.user_id=u.id WHERE p.hidden=FALSE AND u.suspended=FALSE ORDER BY p.id DESC LIMIT 60`,
    );
    if (req.query.following === "true") {
      if (!req.user) fail("Please sign in.", 401);
      const connected = await query(
        "SELECT target_id FROM connections WHERE user_id=?",
        [req.user.id],
      );
      const ids = new Set(connected.map((c) => c.target_id));
      posts = posts.filter(
        (p) => ids.has(p.user_id) || p.user_id === req.user.id,
      );
    }
    const liked = req.user
      ? await query("SELECT post_id FROM reactions WHERE user_id=?", [
          req.user.id,
        ])
      : [];
    res.json({
      posts: posts.map((p) => ({
        ...p,
        liked: liked.some((l) => l.post_id === p.id),
      })),
    });
  }),
);
app.post(
  "/api/posts",
  auth,
  wrap(async (req, res) => {
    const body = text(req.body.body, 5000);
    if (!body) fail("Write something to share.");
    const tags = [
      "Community",
      "On stage",
      "Looking for talent",
      "New music",
      "Backstage thoughts",
    ];
    const r = await query(
      "INSERT INTO posts (user_id,body,tag,image) VALUES (?,?,?,?)",
      [
        req.user.id,
        body,
        tags.includes(req.body.tag) ? req.body.tag : "Community",
        safeUrl(req.body.image),
      ],
    );
    res.status(201).json({ id: r.insertId });
  }),
);
app.post(
  "/api/posts/:id/like",
  auth,
  wrap(async (req, res) => {
    const pid = id(req.params.id);
    if (
      !(await query("SELECT id FROM posts WHERE id=? AND hidden=FALSE", [pid]))
        .length
    )
      fail("Post not found.", 404);
    const exists = (
      await query("SELECT * FROM reactions WHERE post_id=? AND user_id=?", [
        pid,
        req.user.id,
      ])
    ).length;
    if (exists)
      await query("DELETE FROM reactions WHERE post_id=? AND user_id=?", [
        pid,
        req.user.id,
      ]);
    else
      await query("INSERT INTO reactions (post_id,user_id) VALUES (?,?)", [
        pid,
        req.user.id,
      ]);
    res.json({ liked: !exists });
  }),
);
app.get(
  "/api/posts/:id/comments",
  wrap(async (req, res) =>
    res.json({
      comments: await query(
        "SELECT c.*,u.name,u.avatar FROM comments c JOIN users u ON u.id=c.user_id JOIN posts p ON p.id=c.post_id WHERE c.post_id=? AND p.hidden=FALSE AND u.suspended=FALSE ORDER BY c.id",
        [id(req.params.id)],
      ),
    }),
  ),
);
app.post(
  "/api/posts/:id/comments",
  auth,
  wrap(async (req, res) => {
    const pid = id(req.params.id),
      body = text(req.body.body, 2000);
    if (!body) fail("Enter a comment.");
    if (
      !(await query("SELECT id FROM posts WHERE id=? AND hidden=FALSE", [pid]))
        .length
    )
      fail("Post not found.", 404);
    await query("INSERT INTO comments (post_id,user_id,body) VALUES (?,?,?)", [
      pid,
      req.user.id,
      body,
    ]);
    res.status(201).json({ ok: true });
  }),
);
app.use("/api/admin", auth, role("admin"));
app.get(
  "/api/admin/overview",
  wrap(async (req, res) => {
    const users = await query(
      "SELECT id,name,email,role,suspended,created_at FROM users ORDER BY id DESC",
    );
    const profiles = (
      await query(
        "SELECT p.*,u.name FROM profiles p JOIN users u ON p.user_id=u.id",
      )
    ).map(profile);
    const reviews = await query(
      "SELECT r.*,u.name,m.name musician_name FROM reviews r JOIN users u ON u.id=r.author_id JOIN users m ON m.id=r.musician_id ORDER BY r.id DESC",
    );
    const searches = await query(
      "SELECT s.id,s.query,s.engine,s.duration_ms,s.created_at,u.name FROM searches s JOIN users u ON u.id=s.user_id ORDER BY s.id DESC LIMIT 100",
    );
    const posts = await query(
      "SELECT p.*,u.name FROM posts p JOIN users u ON u.id=p.user_id ORDER BY p.id DESC",
    );
    const counts = (
      await query(
        "SELECT (SELECT COUNT(*) FROM bookings) bookings,(SELECT COUNT(*) FROM embeddings) embeddings,(SELECT COUNT(*) FROM searches) searches",
      )
    )[0];
    res.json({ users, profiles, reviews, searches, posts, counts });
  }),
);
app.patch(
  "/api/admin/users/:id",
  wrap(async (req, res) => {
    const uid = id(req.params.id);
    if (uid === req.user.id) fail("You cannot suspend your own account.");
    await query("UPDATE users SET suspended=? WHERE id=?", [
      !!req.body.suspended,
      uid,
    ]);
    if (req.body.suspended)
      await query("DELETE FROM sessions WHERE user_id=?", [uid]);
    res.json({ ok: true });
  }),
);
app.patch(
  "/api/admin/:kind/:id",
  wrap(async (req, res) => {
    const tables = { profiles: "profiles", reviews: "reviews", posts: "posts" };
    const table = tables[req.params.kind];
    if (!table) fail("Unknown content type.");
    await query(`UPDATE ${table} SET hidden=? WHERE id=?`, [
      !!req.body.hidden,
      id(req.params.id),
    ]);
    res.json({ ok: true });
  }),
);
app.post(
  "/api/admin/maintenance",
  wrap(async (req, res) => {
    const sessions = await query("DELETE FROM sessions WHERE expires_at<NOW()");
    await query(
      "ANALYZE TABLE users,profiles,bookings,reviews,searches,embeddings",
    );
    res.json({
      ok: true,
      message: `Database tables analyzed; ${sessions.affectedRows} expired sessions removed.`,
    });
  }),
);
app.post(
  "/api/admin/reindex",
  wrap(async (req, res) => {
    const profiles = (await query(musicianSql)).map(profile);
    const response = await fetch(
      `${process.env.SEMANTIC_URL || "http://127.0.0.1:8001"}/rank`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "live music",
          profiles: profiles.map((p) => ({
            id: p.user_id,
            text: [
              p.name,
              p.headline,
              p.description,
              ...p.genres,
              ...p.skills,
            ].join(" "),
          })),
        }),
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok) fail("Recommendation service unavailable.", 503);
    const result = await response.json();
    for (const e of result.embeddings)
      await query(
        "INSERT INTO embeddings (musician_id,model,vector) VALUES (?,?,?) ON DUPLICATE KEY UPDATE model=VALUES(model),vector=VALUES(vector)",
        [e.id, result.model, JSON.stringify(e.vector)],
      );
    res.json({
      message: `Reindexed ${result.embeddings.length} musician profiles using ${result.model}.`,
    });
  }),
);
app.get(
  "/api/admin/export",
  wrap(async (req, res) => {
    const output = { exported_at: new Date().toISOString() };
    for (const table of [
      "users",
      "profiles",
      "bookings",
      "reviews",
      "searches",
      "embeddings",
      "posts",
    ])
      output[table] = await query(
        table === "users"
          ? "SELECT id,name,email,role,location,bio,suspended,created_at FROM users"
          : `SELECT * FROM ${table}`,
      );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="lifejam-backup.json"',
    );
    res.json(output);
  }),
);
app.use("/api", (req, res) =>
  res.status(404).json({ error: "API endpoint not found." }),
);
let vite;
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (req, res) =>
    res.sendFile(path.join(root, "dist/index.html")),
  );
} else {
  const { createServer } = await import("vite");
  vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.use((err, req, res, next) => {
  if (err.code === "ER_DUP_ENTRY")
    return res.status(409).json({ error: "This item already exists." });
  if (err instanceof multer.MulterError)
    return res.status(400).json({ error: err.message });
  console.error(err.status ? err.message : err);
  res.status(err.status || 500).json({
    error: err.status ? err.message : "Something went wrong. Please try again.",
  });
});
const port = Number(process.env.PORT) || 3000;
async function closeResources() {
  if (vite) await vite.close();
  await pool.end();
}
const server = app.listen(port, "0.0.0.0", (error) => {
  if (error) {
    console.error(
      error.code === "EADDRINUSE"
        ? `LifeJamLokal could not start: port ${port} is already in use. Stop the existing website process, then start again.`
        : `LifeJamLokal could not start: ${error.message}`,
    );
    closeResources()
      .catch(() => {})
      .finally(() => process.exit(1));
    return;
  }
  console.log(`LifeJamLokal running on port ${port}`);
});
let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    server.close(async () => {
      try {
        await closeResources();
      } finally {
        process.exit(0);
      }
    });
  });
