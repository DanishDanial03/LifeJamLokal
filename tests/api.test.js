import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { query, pool, hashPassword } from "../server/db.js";
const base = process.env.TEST_URL || "http://127.0.0.1:3000/api";
const fixtures = [];
const uploads = [];
async function request(url, { method = "GET", body, cookie } = {}) {
  const r = await fetch(base + url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
async function register(role) {
  const name = "Integration " + role + " " + Date.now() + Math.random();
  const email = `test-${Math.random().toString(36).slice(2)}@lifejam.test`;
  const row = await query(
    "INSERT INTO users (name,email,password,role,email_verified) VALUES (?,?,?,?,TRUE)",
    [name, email, hashPassword("TestPassword2026!"), role],
  );
  fixtures.push(row.insertId);
  if (role === "musician")
    await query(
      "INSERT INTO profiles (user_id,genres,skills,portfolio,availability) VALUES (?,JSON_ARRAY(),JSON_ARRAY(),JSON_ARRAY(),JSON_ARRAY())",
      [row.insertId],
    );
  const r = await request("/auth/login", {
    method: "POST",
    body: { email, password: "TestPassword2026!" },
  });
  assert.equal(r.status, 200);
  return { ...r.data.user, cookie: r.cookie };
}
let organizer, musician, stranger, admin, bookingId;
const future = new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10);
before(async () => {
  organizer = await register("organizer");
  musician = await register("musician");
  stranger = await register("organizer");
  admin = await register("organizer");
  await query("UPDATE users SET role='admin' WHERE id=?", [admin.id]);
});
after(async () => {
  if (fixtures.length) {
    const ids = fixtures.join(",");
    for (const sql of [
      `DELETE FROM reactions WHERE user_id IN (${ids}) OR post_id IN (SELECT id FROM posts WHERE user_id IN (${ids}))`,
      `DELETE FROM comments WHERE user_id IN (${ids}) OR post_id IN (SELECT id FROM posts WHERE user_id IN (${ids}))`,
      `DELETE FROM posts WHERE user_id IN (${ids})`,
      `DELETE FROM reviews WHERE author_id IN (${ids}) OR musician_id IN (${ids})`,
      `DELETE FROM bookings WHERE organizer_id IN (${ids}) OR musician_id IN (${ids})`,
      `DELETE FROM messages WHERE sender_id IN (${ids}) OR recipient_id IN (${ids})`,
      `DELETE FROM saved WHERE user_id IN (${ids}) OR musician_id IN (${ids})`,
      `DELETE FROM connections WHERE user_id IN (${ids}) OR target_id IN (${ids})`,
      `DELETE FROM notifications WHERE user_id IN (${ids})`,
      `DELETE FROM searches WHERE user_id IN (${ids})`,
      `DELETE FROM embeddings WHERE musician_id IN (${ids})`,
      `DELETE FROM sessions WHERE user_id IN (${ids})`,
      `DELETE FROM profiles WHERE user_id IN (${ids})`,
      `DELETE FROM users WHERE id IN (${ids})`,
    ])
      await query(sql);
  }
  for (const file of uploads) {
    const { unlink } = await import("node:fs/promises");
    await unlink(new URL("../data" + file, import.meta.url)).catch(() => {});
  }
  await pool.end();
});
test("authentication and role boundaries", async () => {
  assert.equal(
    (await request("/me", { cookie: organizer.cookie })).data.user.id,
    organizer.id,
  );
  assert.equal((await request("/bookings")).status, 401);
  assert.equal(
    (await request("/admin/overview", { cookie: organizer.cookie })).status,
    403,
  );
  assert.equal(
    (
      await request("/auth/register", {
        method: "POST",
        body: {
          name: "Admin",
          email: "a@a.com",
          password: "TestPassword2026!",
          role: "admin",
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/auth/login", {
        method: "POST",
        body: { email: organizer.email, password: "bad" },
      })
    ).status,
    401,
  );
});
test("musician profile persists skills, genres, unavailable dates and rejects unsafe portfolio URLs", async () => {
  const r = await request("/profile", {
    method: "PATCH",
    cookie: musician.cookie,
    body: {
      name: musician.name,
      location: "Kuala Lumpur",
      headline: "Acoustic guitar",
      description: "Soulful acoustic folk for intimate café evenings",
      genres: ["Acoustic", "Folk"],
      skills: ["Guitar", "Vocals"],
      portfolio: [
        { title: "Unsafe", url: "javascript:alert(1)", type: "link" },
      ],
      availability: ["2026-12-25"],
      rate: 450,
    },
  });
  assert.equal(r.status, 200);
  const p = (await request("/musicians/" + musician.id)).data.musician;
  assert.deepEqual(p.genres, ["Acoustic", "Folk"]);
  assert.equal(p.portfolio.length, 0);
  assert.equal(p.rate, 450);
});
test("booking creation, ownership and role restrictions", async () => {
  const body = {
    musician_id: musician.id,
    title: "Integration acoustic night",
    event_date: future,
    start_time: "19:00",
    end_time: "21:00",
    location: "Test café",
    budget: 500,
    details: "An intimate acoustic performance",
  };
  assert.equal(
    (
      await request("/bookings", {
        method: "POST",
        cookie: musician.cookie,
        body,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/bookings", {
        method: "POST",
        cookie: organizer.cookie,
        body: { ...body, event_date: "2020-01-01" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/bookings", {
        method: "POST",
        cookie: organizer.cookie,
        body: { ...body, event_date: "2026-12-25" },
      })
    ).status,
    409,
  );
  const r = await request("/bookings", {
    method: "POST",
    cookie: organizer.cookie,
    body,
  });
  assert.equal(r.status, 201);
  bookingId = r.data.id;
  assert.equal(
    (
      await request("/bookings/" + bookingId, {
        method: "PATCH",
        cookie: stranger.cookie,
        body: { status: "accepted" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/bookings/" + bookingId, {
        method: "PATCH",
        cookie: organizer.cookie,
        body: { status: "accepted" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/bookings/" + bookingId, {
        method: "PATCH",
        cookie: musician.cookie,
        body: { status: "accepted" },
      })
    ).status,
    200,
  );
  const rows = (await request("/bookings", { cookie: organizer.cookie })).data
    .bookings;
  assert.equal(rows[0].event_date, future);
});
test("booking overlap and premature completion are rejected", async () => {
  const body = {
    musician_id: musician.id,
    title: "Overlap",
    event_date: future,
    start_time: "20:00",
    end_time: "22:00",
    location: "Other café",
    budget: 500,
  };
  assert.equal(
    (
      await request("/bookings", {
        method: "POST",
        cookie: organizer.cookie,
        body,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/bookings/" + bookingId, {
        method: "PATCH",
        cookie: organizer.cookie,
        body: { status: "completed" },
      })
    ).status,
    409,
  );
});
test("reviews require completed booking and compute multi-criteria average", async () => {
  const review = {
    booking_id: bookingId,
    performance: 5,
    professionalism: 4,
    communication: 3,
    comment: "Great performance and a warm sound.",
  };
  assert.equal(
    (
      await request("/reviews", {
        method: "POST",
        cookie: organizer.cookie,
        body: review,
      })
    ).status,
    403,
  );
  await query("UPDATE bookings SET event_date='2020-01-01' WHERE id=?", [
    bookingId,
  ]);
  assert.equal(
    (
      await request("/bookings/" + bookingId, {
        method: "PATCH",
        cookie: organizer.cookie,
        body: { status: "completed" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/reviews", {
        method: "POST",
        cookie: stranger.cookie,
        body: review,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/reviews", {
        method: "POST",
        cookie: organizer.cookie,
        body: review,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await request("/reviews", {
        method: "POST",
        cookie: organizer.cookie,
        body: review,
      })
    ).status,
    409,
  );
  const p = (await request("/musicians/" + musician.id)).data;
  assert.equal(Number(p.musician.rating), 4);
  assert.equal(p.reviews.length, 1);
});
test("messages are private and persist for both participants", async () => {
  const person = await request("/people/" + organizer.id, {
    cookie: musician.cookie,
  });
  assert.equal(person.status, 200);
  assert.equal(person.data.person.role, "organizer");
  assert.equal("email" in person.data.person, false);

  const r = await request("/messages", {
    method: "POST",
    cookie: organizer.cookie,
    body: { recipient_id: musician.id, body: "Let’s make some music." },
  });
  assert.equal(r.status, 201);
  assert.equal(
    (
      await request("/messages", { cookie: musician.cookie })
    ).data.messages.some((m) => m.id === r.data.id),
    true,
  );
  assert.equal(
    (
      await request("/messages", { cookie: stranger.cookie })
    ).data.messages.some((m) => m.id === r.data.id),
    false,
  );
});
test("saved musicians and connections can be added and removed", async () => {
  assert.equal(
    (
      await request("/saved/" + musician.id, {
        method: "POST",
        cookie: organizer.cookie,
      })
    ).data.saved,
    true,
  );
  assert.equal(
    (await request("/saved", { cookie: organizer.cookie })).data.musicians
      .length,
    1,
  );
  assert.equal(
    (
      await request("/saved/" + musician.id, {
        method: "POST",
        cookie: organizer.cookie,
      })
    ).data.saved,
    false,
  );
  assert.equal(
    (
      await request("/network/" + musician.id, {
        method: "POST",
        cookie: organizer.cookie,
      })
    ).data.connected,
    true,
  );
  assert.equal(
    (await request("/network", { cookie: organizer.cookie })).data.connections
      .length,
    1,
  );
  assert.equal(
    (
      await request("/network/" + musician.id, {
        method: "POST",
        cookie: organizer.cookie,
      })
    ).data.connected,
    false,
  );
});
test("community publishing, likes and comments persist", async () => {
  const r = await request("/posts", {
    method: "POST",
    cookie: organizer.cookie,
    body: { body: "Integration community post", tag: "New music" },
  });
  assert.equal(r.status, 201);
  assert.equal(
    (
      await request("/posts/" + r.data.id + "/like", {
        method: "POST",
        cookie: musician.cookie,
      })
    ).data.liked,
    true,
  );
  assert.equal(
    (
      await request("/posts/" + r.data.id + "/comments", {
        method: "POST",
        cookie: musician.cookie,
        body: { body: "Love the sound." },
      })
    ).status,
    201,
  );
  assert.equal(
    (await request("/posts/" + r.data.id + "/comments")).data.comments.length,
    1,
  );
});
test("admin moderation hides reviews and profiles and invalidates suspended sessions", async () => {
  let overview = (await request("/admin/overview", { cookie: admin.cookie }))
    .data;
  const review = overview.reviews.find((r) => r.author_id === organizer.id);
  assert.equal(
    (
      await request("/admin/reviews/" + review.id, {
        method: "PATCH",
        cookie: admin.cookie,
        body: { hidden: true },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/musicians/" + musician.id)).data.reviews.length,
    0,
  );
  const p = overview.profiles.find((p) => p.user_id === musician.id);
  await request("/admin/profiles/" + p.id, {
    method: "PATCH",
    cookie: admin.cookie,
    body: { hidden: true },
  });
  assert.equal((await request("/musicians/" + musician.id)).status, 404);
  await request("/admin/profiles/" + p.id, {
    method: "PATCH",
    cookie: admin.cookie,
    body: { hidden: false },
  });
  await request("/admin/users/" + stranger.id, {
    method: "PATCH",
    cookie: admin.cookie,
    body: { suspended: true },
  });
  assert.equal(
    (await request("/bookings", { cookie: stranger.cookie })).status,
    401,
  );
  assert.equal(
    (
      await request("/admin/maintenance", {
        method: "POST",
        cookie: admin.cookie,
      })
    ).status,
    200,
  );
  const backup = (await request("/admin/export", { cookie: admin.cookie }))
    .data;
  assert.equal(
    backup.users.some((u) => "password" in u),
    false,
  );
});
test("search uses a truthful engine label and persists user-scoped history", async () => {
  const q = "gentle acoustic folk café";
  const r = await request("/musicians?q=" + encodeURIComponent(q), {
    cookie: organizer.cookie,
  });
  assert.equal(r.status, 200);
  assert.ok(
    r.data.engine === "keyword-fallback" ||
      r.data.engine.includes("all-MiniLM-L6-v2"),
  );
  if (r.data.engine === "keyword-fallback")
    assert.match(r.data.warning, /keyword/);
  assert.ok(r.data.musicians.every((p) => typeof p.score === "number"));
  const history = (await request("/history", { cookie: organizer.cookie })).data
    .history;
  assert.ok(history.some((h) => h.query === q && h.engine === r.data.engine));
  assert.equal(
    (await request("/history", { cookie: musician.cookie })).data.history.some(
      (h) => h.query === q,
    ),
    false,
  );
});

test("concurrent overlapping acceptances allow exactly one confirmed booking", async () => {
  const body = {
    musician_id: musician.id,
    title: "Concurrency test",
    event_date: future,
    start_time: "10:00",
    end_time: "12:00",
    location: "Test venue",
    budget: 500,
  };
  const a = await request("/bookings", {
    method: "POST",
    cookie: organizer.cookie,
    body,
  });
  const b = await request("/bookings", {
    method: "POST",
    cookie: organizer.cookie,
    body,
  });
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  const results = await Promise.all(
    [a, b].map((r) =>
      request("/bookings/" + r.data.id, {
        method: "PATCH",
        cookie: musician.cookie,
        body: { status: "accepted" },
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
});

test("media uploads require authentication and reject mismatched file content", async () => {
  const valid = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  const upload = async (bytes, cookie, type = "image/png") => {
    const body = new FormData();
    body.append("file", new Blob([bytes], { type }), "test.png");
    const response = await fetch(base + "/uploads", {
      method: "POST",
      headers: cookie ? { Cookie: cookie } : {},
      body,
    });
    return { status: response.status, data: await response.json() };
  };
  assert.equal((await upload(valid)).status, 401);
  assert.equal(
    (await upload(Buffer.from("not an image"), musician.cookie)).status,
    400,
  );
  const r = await upload(valid, musician.cookie);
  assert.equal(r.status, 201);
  uploads.push(r.data.url);
  const file = await fetch(base.replace(/\/api$/, "") + r.data.url);
  assert.equal(file.status, 200);
  assert.match(file.headers.get("content-type"), /image\/png/);
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), valid);
});

test("logout invalidates the session", async () => {
  assert.equal(
    (
      await request("/auth/logout", {
        method: "POST",
        cookie: organizer.cookie,
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/me", { cookie: organizer.cookie })).data.user,
    null,
  );
});
