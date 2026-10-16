import assert from "node:assert/strict";
const base = process.env.SEMANTIC_URL || "http://127.0.0.1:8001";
const health = await fetch(base + "/health").then((r) => r.json());
assert.equal(health.ready, true, "The real SBERT model must be loaded.");
assert.match(health.model, /all-MiniLM-L6-v2/);
const payload = {
  query: "A gentle acoustic singer for a quiet coffee shop",
  profiles: [
    {
      id: 1,
      text: "Acoustic folk guitarist and singer, soft warm vocals, intimate cafe performances",
    },
    {
      id: 2,
      text: "Heavy metal drummer, aggressive distortion and high volume hard rock concerts",
    },
  ],
};
const response = await fetch(base + "/rank", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
assert.equal(response.status, 200);
const ranked = await response.json();
assert.equal(ranked.results[0].id, 1);
assert.equal(ranked.embeddings.length, 2);
assert.equal(ranked.embeddings[0].vector.length, 384);
for (const r of ranked.results) assert.ok(r.score >= -1 && r.score <= 1);
assert.ok(ranked.results[0].score > ranked.results[1].score);
console.log(
  "Real SBERT model, 384-dimensional embeddings, cosine bounds and contextual ranking passed.",
);
