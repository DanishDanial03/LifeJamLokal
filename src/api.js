export async function api(url, options = {}) {
  const { body, ...rest } = options;
  const r = await fetch("/api" + url, {
    credentials: "same-origin",
    ...rest,
    ...(body instanceof FormData
      ? { body }
      : body !== undefined
        ? {
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json", ...rest.headers },
          }
        : {}),
  });
  const data = await r.json();
  if (!r.ok) {
    const error = new Error(data.error || "Unable to complete the request.");
    error.code = data.code;
    error.status = r.status;
    throw error;
  }
  return data;
}
export const money = (v) => "RM " + Number(v || 0).toLocaleString("en-MY");
export const date = (v) =>
  new Date(v).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const localImages = {
  "photo-1534528741775-53994a69daeb": "team-1.jpg",
  "photo-1500648767791-00dcc994a43e": "team-2.jpg",
  "photo-1506794778202-cad84cf45f1d": "team-3.jpg",
  "photo-1524504388940-b1c1722653e1": "team-1.jpg",
  "photo-1517841905240-472988babdf9": "team-1.jpg",
  "photo-1516280440614-37939bbacd81": "poster-5.jpg",
  "photo-1510915361894-db8b60106cb1": "poster-1.jpg",
  "photo-1520523839897-bd0b52f945a0": "poster-2.jpg",
  "photo-1493225457124-a3eb161ffa5f": "poster-4.jpg",
  "photo-1519892300165-cb5542fb47c7": "poster-3.jpg",
};
export const img = (s, w = 800) =>
  "/images/" + (localImages[s] || "poster-1.jpg");
