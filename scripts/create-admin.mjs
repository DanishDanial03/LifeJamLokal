import { initDb, query, pool, hashPassword } from "../server/db.js";
if (
  !process.env.ADMIN_EMAIL ||
  !process.env.ADMIN_PASSWORD ||
  process.env.ADMIN_PASSWORD.length < 12
)
  throw Error(
    "Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) in your shell. Never commit them.",
  );
await initDb();
const rows = await query("SELECT id FROM users WHERE email=?", [
  process.env.ADMIN_EMAIL.toLowerCase(),
]);
if (rows.length)
  throw Error("This email already exists. No account was changed.");
await query(
  "INSERT INTO users (name,email,password,role,location,bio) VALUES (?,?,?,'admin',?,?)",
  [
    process.env.ADMIN_NAME || "Platform Admin",
    process.env.ADMIN_EMAIL.toLowerCase(),
    hashPassword(process.env.ADMIN_PASSWORD),
    "Kuala Lumpur",
    "Community administrator",
  ],
);
console.log("Administrator account created.");
await pool.end();
