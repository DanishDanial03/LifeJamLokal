import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";

test(
  "occupied API port fails clearly without falsely reporting a running website",
  { timeout: 15000 },
  async () => {
    const occupied = http.createServer((req, res) =>
      res.end("existing website"),
    );
    await new Promise((r) => occupied.listen(0, "127.0.0.1", r));
    const port = occupied.address().port;
    let child;
    try {
      child = spawn(process.execPath, ["server/index.js"], {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: "production", PORT: String(port) },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      child.stdout.on("data", (c) => (output += c));
      child.stderr.on("data", (c) => (output += c));
      const [code] = await once(child, "exit");
      assert.equal(code, 1, output);
      assert.match(output, new RegExp(`port ${port} is already in use`));
      assert.doesNotMatch(output, /LifeJamLokal running on port/);
      assert.equal(
        await fetch(`http://127.0.0.1:${port}`).then((r) => r.text()),
        "existing website",
      );
    } finally {
      if (child && child.exitCode === null) child.kill();
      await new Promise((r) => occupied.close(r));
    }
  },
);
