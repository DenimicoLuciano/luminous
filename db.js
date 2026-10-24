// Database: SQLite via better-sqlite3. Schema + seed data.
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'luminous.db');

const Database = require('better-sqlite3');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  password_hash TEXT,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'personal', -- personal | business | creator
  role TEXT NOT NULL DEFAULT 'user',            -- user | developer
  verified INTEGER NOT NULL DEFAULT 0,           -- identity verified (Approved badge)
  is_ai INTEGER NOT NULL DEFAULT 0,             -- seeded demo AI account
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  bio TEXT DEFAULT '',
  public_age INTEGER,
  status TEXT NOT NULL DEFAULT 'active',        -- active | offline | away
  profile_color TEXT DEFAULT '#a855f7',
  layout TEXT DEFAULT 'grid',                   -- grid | list
  hobbies TEXT DEFAULT '[]',                    -- JSON array
  avatar_emoji TEXT DEFAULT '✨',
  auth_provider TEXT DEFAULT 'password',        -- password | google
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'text',            -- text | photo | ad
  content TEXT DEFAULT '',
  image_url TEXT,
  is_ad INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS post_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  viewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_ai INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT,
  text TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS story_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS lums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_url TEXT,
  caption TEXT DEFAULT '',
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS mentors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  emoji TEXT NOT NULL,
  system_prompt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS companions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_emoji TEXT NOT NULL DEFAULT '💫',
  color TEXT NOT NULL DEFAULT '#a855f7',
  age INTEGER NOT NULL DEFAULT 25,
  gender TEXT NOT NULL DEFAULT 'other',
  traits TEXT NOT NULL DEFAULT '[]',            -- JSON array (up to 4)
  interests TEXT NOT NULL DEFAULT '[]',         -- JSON array (up to 5)
  job_vibe TEXT DEFAULT '',
  backstory TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                           -- mentor | companion
  ref_id INTEGER NOT NULL,                      -- mentor.id or companion.id
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                           -- user | assistant
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 50
);
CREATE TABLE IF NOT EXISTS user_milestones (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone_id INTEGER NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, milestone_id)
);
CREATE TABLE IF NOT EXISTS live_streams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'live',          -- live | ended
  coins_earned INTEGER NOT NULL DEFAULT 0,
  viewers INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT
);
CREATE TABLE IF NOT EXISTS live_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_id INTEGER NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,                           -- tap | share | watch | gift | free_gift
  coins INTEGER NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS wallets (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  coins INTEGER NOT NULL DEFAULT 0,
  earnings_cents REAL NOT NULL DEFAULT 0        -- ad-revenue share, USD cents
);
CREATE TABLE IF NOT EXISTS payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',       -- pending | paid | rejected
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_lums_created ON lums(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
`;
db.exec(SCHEMA);

// ---- Migrations for existing databases ----
// role column (added with the Developer account system)
const userCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
if (!userCols.includes('role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
}

// ---- Milestones (11) ----
const MILESTONES = [
  ['first-post', 'First Light', 'Publish your very first post', 50],
  ['first-story', 'Storyteller', 'Share your first Story', 40],
  ['first-lum', 'Luminary', 'Upload your first Lum', 50],
  ['kindred-spirit', 'Kindred Spirit', 'Create your first AI companion', 75],
  ['going-live', 'Going Live', 'Start your first livestream', 75],
  ['century-views', 'Century Club', 'Reach 100 real views on your posts', 100],
  ['prolific', 'Prolific', 'Publish 10 posts', 100],
  ['social-butterfly', 'Social Butterfly', 'Reply to 5 Stories', 60],
  ['coin-earner', 'Coin Earner', 'Earn 100 coins from livestreams', 80],
  ['creator-approved', 'Approved Creator', 'Get your Approved identity badge', 100],
  ['level-five', 'Rising Star', 'Reach level 5', 150],
];
const insMs = db.prepare('INSERT OR IGNORE INTO milestones (key, name, description, xp_reward) VALUES (?,?,?,?)');
for (const m of MILESTONES) insMs.run(...m);

// ---- AI mentors (5) ----
const MENTORS = [
  ['fitness', 'Coach Flex', 'Your personal fitness mentor', '💪',
    'You are Coach Flex, an encouraging fitness mentor inside the Luminous app. Give practical workout, form, and motivation advice. Keep replies concise and friendly. Never give medical diagnoses; suggest seeing a professional for injuries or medical concerns.'],
  ['growth', 'Viral Vera', 'Grow your social media presence', '📈',
    'You are Viral Vera, a social media growth mentor inside the Luminous app. Give actionable tips on content strategy, hooks, posting cadence, and audience building. Keep replies concise and practical.'],
  ['mental', 'Calm Kai', 'A judgment-free space to vent', '🌿',
    'You are Calm Kai, a compassionate, non-judgmental listener inside the Luminous app. The user may vent about stress, anxiety, or life. Listen, validate, and offer gentle coping ideas. You are NOT a therapist and must say so if asked; encourage professional help for serious issues. Never judge.'],
  ['nutrition', 'Chef Nourish', 'Healthy eating made simple', '🥗',
    'You are Chef Nourish, a healthy-eating mentor inside the Luminous app. Suggest simple nutritious meals, snacks, and habits. Keep replies concise. Never diagnose conditions; suggest a registered dietitian for medical nutrition needs.'],
  ['business', 'Budget Boss', 'Business and budgeting smarts', '💼',
    'You are Budget Boss, a business and budgeting mentor inside the Luminous app. Give clear, practical advice on budgeting, saving, pricing, and small-business basics. Keep replies concise and encouraging.'],
];
const insMentor = db.prepare('INSERT OR IGNORE INTO mentors (key, name, tagline, emoji, system_prompt) VALUES (?,?,?,?,?)');
for (const m of MENTORS) insMentor.run(...m);

// ---- Seeded AI demo accounts (6) ----
const AI_ACCOUNTS = [
  ['pixelpete', 'Pixel Pete', '🎮', 'Pro gamer. High scores, hot takes, zero chill. 🤖 AI demo account.', ['gaming', 'esports', 'speedruns']],
  ['chefaria', 'Chef Aria', '🍳', 'Plating dreams one dish at a time. 🤖 AI demo account.', ['cooking', 'recipes', 'food photography']],
  ['wanderwren', 'Wander Wren', '🧭', 'Collecting sunsets around the world. 🤖 AI demo account.', ['travel', 'photography', 'hiking']],
  ['fitwithfemi', 'Fit with Femi', '🏋️', 'Your daily dose of movement motivation. 🤖 AI demo account.', ['fitness', 'wellness', 'running']],
  ['moneymae', 'Money Mae', '💸', 'Making money make sense. 🤖 AI demo account.', ['money', 'budgeting', 'investing']],
  ['lunalens', 'Luna Lens', '📸', 'Chasing light, one frame at a time. 🤖 AI demo account.', ['photography', 'portraits', 'editing']],
];
const getUser = db.prepare('SELECT id FROM users WHERE username = ?');
const insUser = db.prepare(`INSERT INTO users
  (email, password_hash, username, display_name, account_type, verified, is_ai, bio, hobbies, avatar_emoji, public_age, status)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
const insWallet = db.prepare('INSERT OR IGNORE INTO wallets (user_id) VALUES (?)');
const aiIds = {};
for (const [username, display, emoji, bio, hobbies] of AI_ACCOUNTS) {
  let row = getUser.get(username);
  if (!row) {
    const r = insUser.run(null, '!', username, display, 'creator', 1, 1, bio, JSON.stringify(hobbies), emoji, null, 'active');
    row = { id: r.lastInsertRowid };
  }
  aiIds[username] = row.id;
  insWallet.run(row.id);
}

// Seed content from AI accounts (only if posts table is empty of seed)
const postCount = db.prepare('SELECT COUNT(*) c FROM posts').get().c;
if (postCount === 0) {
  const insPost = db.prepare(`INSERT INTO posts (user_id, type, content, image_url, is_ad, views, created_at)
    VALUES (?,?,?,?,?,?,datetime('now', ?))`);
  const seedPosts = [
    ['pixelpete', 'text', 'Just hit a new speedrun PB — 3 seconds off world record. The grind continues. 🎮', null, '-2 hours'],
    ['chefaria', 'text', 'Recipe of the day: 15-minute garlic butter pasta. Save this one. 🍝', null, '-5 hours'],
    ['wanderwren', 'text', 'Sunset over the canyon hit different today. Where should I go next? 🌅', null, '-8 hours'],
    ['fitwithfemi', 'text', 'Day 42: consistency beats intensity. 20 minutes is enough. Start today. 💪', null, '-12 hours'],
    ['moneymae', 'text', 'The 50/30/20 budget rule, explained in 60 seconds: needs, wants, future you. 💸', null, '-1 day'],
    ['lunalens', 'text', 'Golden hour portraits: shoot facing the light, expose for the highlights. 📸', null, '-1 day'],
  ];
  for (const [u, , content, img, offset] of seedPosts) insPost.run(aiIds[u], 'text', content, img, 0, 0, offset);

  // In-feed ads styled as posts (is_ad = 1)
  const ads = [
    ['LumiBoost Pro', '🚀', 'Take your content further with LumiBoost Pro — analytics, scheduling, and growth tools for creators.'],
    ['PixelWear Merch', '👕', 'Official Luminous creator merch drop — hoodies, tees, and more. Limited run!'],
    ['SnackSnap', '🍿', 'SnackSnap: the snack box for late-night creators. First box 20% off.'],
  ];
  const insAd = db.prepare(`INSERT INTO posts (user_id, type, content, is_ad, views, created_at)
    VALUES (?,?,?,?,?,datetime('now','-3 hours'))`);
  for (const [brand, emoji, content] of ads) {
    insAd.run(aiIds['moneymae'], 'text', `${emoji} ${brand} (Sponsored)\n${content}`, 1, 0);
  }

  // Seed a story + a lum from AI accounts
  const insStory = db.prepare(`INSERT INTO stories (user_id, text, created_at, expires_at)
    VALUES (?,?,datetime('now','-1 hour'),datetime('now','+23 hours'))`);
  insStory.run(aiIds['wanderwren'], '🧭 New vlog drops tonight — guess the country! 🌍');
  const insLum = db.prepare(`INSERT INTO lums (user_id, caption, created_at) VALUES (?,?,datetime('now','-2 hours'))`);
  insLum.run(aiIds['pixelpete'], '🎮 Speedrun highlights — full run on my page!');
}

module.exports = db;
module.exports.DATA_DIR = DATA_DIR;
module.exports.DB_PATH = DB_PATH;
