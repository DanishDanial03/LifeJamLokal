// An explicit availability fallback. This is never presented as SBERT.
export function keywordRank(query, profiles) {
  const tokens = (s) =>
    s
      .normalize("NFKC")
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) || [];
  const counts = (s) => {
    const m = new Map();
    for (const t of tokens(s)) m.set(t, (m.get(t) || 0) + 1);
    return m;
  };
  const q = counts(query),
    docs = profiles.map((p) => ({ id: p.id, counts: counts(p.text) }));
  const idf = (t) =>
    Math.log(
      1 + docs.length / (1 + docs.filter((d) => d.counts.has(t)).length),
    );
  const norm = (m) =>
    Math.sqrt([...m].reduce((n, [t, c]) => n + (c * idf(t)) ** 2, 0));
  const qnorm = norm(q);
  return {
    model: "keyword-fallback",
    warning:
      "SBERT is currently unavailable. These results use keyword matching; semantic recommendations resume when the model service is running.",
    results: docs
      .map((d) => ({
        id: d.id,
        score:
          [...q].reduce(
            (n, [t, c]) => n + c * (d.counts.get(t) || 0) * idf(t) ** 2,
            0,
          ) / (qnorm * norm(d.counts) || 1),
      }))
      .sort((a, b) => b.score - a.score),
  };
}
