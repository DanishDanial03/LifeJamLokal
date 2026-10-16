import mysql from "mysql2/promise";
import { randomBytes, scryptSync } from "node:crypto";
export const pool = mysql.createPool({
  uri:
    process.env.DATABASE_URL ||
    "mysql://lifejam:lifejam_local_dev@127.0.0.1:3306/lifejam",
  dateStrings: true,
  timezone: "+00:00",
});
export async function query(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export const parse = (v, fallback = []) => {
  try {
    return typeof v === "string" ? JSON.parse(v) : (v ?? fallback);
  } catch {
    return fallback;
  }
};
export const profile = (p) => ({
  ...p,
  genres: parse(p.genres),
  skills: parse(p.skills),
  portfolio: parse(p.portfolio),
  availability: parse(p.availability),
  hidden: !!p.hidden,
  verified: !!p.verified,
});
export async function initDb() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(190) NOT NULL UNIQUE, password VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL, avatar TEXT, location VARCHAR(100) DEFAULT 'Kuala Lumpur', bio TEXT, suspended BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS profiles (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL UNIQUE, headline VARCHAR(200), description TEXT, genres JSON, skills JSON, portfolio JSON, availability JSON, rate INT DEFAULT 500, cover TEXT, hidden BOOLEAN DEFAULT FALSE, verified BOOLEAN DEFAULT FALSE, FOREIGN KEY(user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS sessions (token VARCHAR(64) PRIMARY KEY, user_id INT NOT NULL, expires_at DATETIME NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS bookings (id INT AUTO_INCREMENT PRIMARY KEY, organizer_id INT NOT NULL, musician_id INT NOT NULL, title VARCHAR(150) NOT NULL, event_date DATE NOT NULL, start_time VARCHAR(5) NOT NULL, end_time VARCHAR(5) NOT NULL, location VARCHAR(200), budget INT, details TEXT, status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(organizer_id) REFERENCES users(id), FOREIGN KEY(musician_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS reviews (id INT AUTO_INCREMENT PRIMARY KEY, booking_id INT NOT NULL UNIQUE, author_id INT NOT NULL, musician_id INT NOT NULL, performance INT NOT NULL, professionalism INT NOT NULL, communication INT NOT NULL, rating DECIMAL(3,2) NOT NULL, comment TEXT, hidden BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(booking_id) REFERENCES bookings(id), FOREIGN KEY(author_id) REFERENCES users(id), FOREIGN KEY(musician_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS messages (id INT AUTO_INCREMENT PRIMARY KEY, sender_id INT NOT NULL, recipient_id INT NOT NULL, body TEXT NOT NULL, read_at DATETIME, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(sender_id) REFERENCES users(id), FOREIGN KEY(recipient_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS searches (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, query TEXT, engine VARCHAR(60), duration_ms INT, results JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS embeddings (musician_id INT PRIMARY KEY, model VARCHAR(100), vector JSON, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY(musician_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS saved (user_id INT NOT NULL, musician_id INT NOT NULL, PRIMARY KEY(user_id,musician_id), FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(musician_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS posts (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, body TEXT NOT NULL, tag VARCHAR(30) DEFAULT 'Community', image TEXT, hidden BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS reactions (post_id INT NOT NULL, user_id INT NOT NULL, PRIMARY KEY(post_id,user_id), FOREIGN KEY(post_id) REFERENCES posts(id), FOREIGN KEY(user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS comments (id INT AUTO_INCREMENT PRIMARY KEY, post_id INT NOT NULL, user_id INT NOT NULL, body TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(post_id) REFERENCES posts(id), FOREIGN KEY(user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS connections (user_id INT NOT NULL, target_id INT NOT NULL, PRIMARY KEY(user_id,target_id), FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(target_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS notifications (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, body TEXT NOT NULL, read_at DATETIME, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id))`,
  ];
  for (const sql of statements) await query(sql);
  if (
    process.env.SEED_DEMO !== "false" &&
    !(await query("SELECT id FROM users LIMIT 1")).length
  )
    await seed();
}
async function seed() {
  const faces = [
    "photo-1534528741775-53994a69daeb",
    "photo-1500648767791-00dcc994a43e",
    "photo-1506794778202-cad84cf45f1d",
    "photo-1524504388940-b1c1722653e1",
    "photo-1517841905240-472988babdf9",
    "photo-1506794778202-cad84cf45f1d",
    "photo-1506794778202-cad84cf45f1d",
  ];
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
  const img = (s, w = 300) => "/images/" + (localImages[s] || "poster-1.jpg");
  const people = [
    [
      "Aina Rahman",
      "aina@lifejam.local",
      "organizer",
      "Kuala Lumpur",
      "Independent event curator. Bringing good people and great music together.",
    ],
    [
      "Amir Hakim",
      "amir@lifejam.local",
      "musician",
      "Kuala Lumpur",
      "Soulful acoustic guitarist and singer for intimate café evenings, weddings and mellow indie gatherings. Warm vocals and fingerstyle guitar.",
    ],
    [
      "Daniel Lim",
      "daniel@lifejam.local",
      "musician",
      "Petaling Jaya",
      "Jazz pianist and keys player blending neo-soul, R&B and smooth jazz. Experienced in corporate events and cocktail lounges.",
    ],
    [
      "Sarah Yasmin",
      "sarah@lifejam.local",
      "musician",
      "Shah Alam",
      "Singer-songwriter with a love for indie folk, acoustic pop and meaningful lyrics. Intimate storytelling for your special moments.",
    ],
    [
      "Nadia Zain",
      "nadia@lifejam.local",
      "musician",
      "Kuala Lumpur",
      "Dynamic R&B and soul vocalist with a powerful live presence. Wedding receptions, neo-soul sessions and corporate celebrations.",
    ],
    [
      "The Midnight Collective",
      "midnight@lifejam.local",
      "musician",
      "Penang",
      "Four-piece funk and jazz fusion band. Groovy bass, punchy drums and electric guitar for festivals and high-energy live events.",
    ],
    [
      "Rizal Beats",
      "rizal@lifejam.local",
      "musician",
      "Johor Bahru",
      "Versatile percussionist and drummer. Malaysian traditional rhythms meet modern hip-hop and world music. Available for session work.",
    ],
    [
      "Platform Admin",
      "admin@lifejam.local",
      "admin",
      "Kuala Lumpur",
      "LifeJamLokal community team.",
    ],
  ];
  const genres = [
    [],
    ["Acoustic", "Indie", "Folk"],
    ["Jazz", "Neo-soul", "R&B"],
    ["Indie", "Folk", "Pop"],
    ["R&B", "Soul", "Pop"],
    ["Funk", "Jazz", "Rock"],
    ["Hip-hop", "Traditional", "World"],
  ];
  const skills = [
    [],
    ["Guitar", "Vocals", "Songwriting"],
    ["Piano", "Keys", "Arrangement"],
    ["Vocals", "Guitar", "Songwriting"],
    ["Vocals", "Live performance"],
    ["Guitar", "Bass", "Drums", "Keys"],
    ["Drums", "Percussion", "Production"],
  ];
  const titles = [
    "",
    "Acoustic guitarist & singer",
    "Jazz pianist & session musician",
    "Indie-folk singer-songwriter",
    "R&B & soul vocalist",
    "Funk & jazz fusion band",
    "Drummer & percussionist",
  ];
  const rates = [0, 450, 650, 500, 700, 1800, 400];
  const covers = [
    "photo-1516280440614-37939bbacd81",
    "photo-1510915361894-db8b60106cb1",
    "photo-1520523839897-bd0b52f945a0",
    "photo-1516280440614-37939bbacd81",
    "photo-1516280440614-37939bbacd81",
    "photo-1493225457124-a3eb161ffa5f",
    "photo-1519892300165-cb5542fb47c7",
  ];
  for (let i = 0; i < people.length; i++) {
    const [name, email, role, location, bio] = people[i];
    await query(
      "INSERT INTO users (name,email,password,role,avatar,location,bio) VALUES (?,?,?,?,?,?,?)",
      [
        name,
        email,
        hashPassword("LifeJam2026!"),
        role,
        img(faces[i % faces.length]),
        location,
        bio,
      ],
    );
    if (role === "musician")
      await query(
        "INSERT INTO profiles (user_id,headline,description,genres,skills,portfolio,availability,rate,cover,verified) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [
          i + 1,
          titles[i],
          bio,
          JSON.stringify(genres[i]),
          JSON.stringify(skills[i]),
          JSON.stringify([]),
          JSON.stringify([]),
          rates[i],
          img(covers[i], 800),
          true,
        ],
      );
  }
  const posts = [
    [
      4,
      "Some songs just hit different when the room sings them back. ✨ A little glimpse from last night's acoustic session at Jao Tim. Grateful for every single one of you who showed up.\n\nSame time next week? 🎤",
      "On stage",
      img("photo-1516280440614-37939bbacd81", 1200),
    ],
    [
      1,
      "Looking for a little soul for our next Sunday session. 🌿 We're putting together an intimate acoustic evening in Bangsar — think warm vocals, good coffee, and a room full of music lovers.\n\nMusicians, let's make something special. Drop me a message!",
      "Looking for talent",
      null,
    ],
    [
      3,
      "A reminder to all the bedroom musicians out there: your first gig doesn't need to be perfect. It just needs to happen. Keep playing, keep showing up. 🎹",
      "Backstage thoughts",
      null,
    ],
    [
      6,
      "New grooves in the works. Can't wait to bring these to a stage near you. Who's ready for a little more funk? 🪩",
      "New music",
      img("photo-1493225457124-a3eb161ffa5f", 1200),
    ],
  ];
  for (const p of posts)
    await query(
      "INSERT INTO posts (user_id,body,tag,image) VALUES (?,?,?,?)",
      p,
    );
  await query(
    "INSERT INTO reactions (post_id,user_id) VALUES (1,1),(1,2),(1,3),(1,5),(2,3),(2,4)",
  );
  await query("INSERT INTO comments (post_id,user_id,body) VALUES (1,2,?)", [
    "That room has such a beautiful sound. See you next week! 🙌",
  ]);
  await query(
    "INSERT INTO connections (user_id,target_id) VALUES (1,2),(1,3),(1,4)",
  );
  await query(
    "INSERT INTO messages (sender_id,recipient_id,body) VALUES (2,1,?)",
    [
      "Hey Aina! Love the Sunday session idea. I'd love to hear more about the vibe you have in mind. 🎸",
    ],
  );
  await query("INSERT INTO notifications (user_id,body) VALUES (1,?)", [
    "Welcome to LifeJamLokal. Your next great collaboration starts here.",
  ]);
}
