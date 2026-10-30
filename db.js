// Database: SQLite via libsql — Turso cloud when TURSO_DATABASE_URL is set
// (accounts and data persist across deploys), local file otherwise.
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'luminous.db');

const Database = require('libsql');
const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
let db;
if (TURSO_URL) {
  db = new Database(TURSO_URL, { authToken: process.env.TURSO_AUTH_TOKEN || '' });
  console.log('🗄️ Luminous DB: Turso cloud (persistent)');
} else {
  db = new Database(DB_PATH);
  try { db.pragma('journal_mode = WAL'); } catch (e) {}
  console.log('🗄️ Luminous DB: local file (ephemeral)');
}
try { db.pragma('foreign_keys = ON'); } catch (e) { /* best-effort on remote */ }

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
CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',       -- pending | used
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  publish_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS friendships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',       -- pending | accepted
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT
);
CREATE TABLE IF NOT EXISTS dm_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  read_at TEXT
);
CREATE TABLE IF NOT EXISTS calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  callee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'audio',           -- audio | video
  status TEXT NOT NULL DEFAULT 'ringing',       -- ringing | ongoing | ended | declined | missed
  offer TEXT,
  answer TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT
);
CREATE TABLE IF NOT EXISTS call_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id INTEGER NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  from_user_id INTEGER NOT NULL,
  candidate TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_lums_created ON lums(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_friend_pair ON friendships(requester_id, addressee_id);
CREATE INDEX IF NOT EXISTS idx_dm_pair ON dm_messages(sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_calls_callee ON calls(callee_id, status);
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
  ['beatbyblaze', 'Beat by Blaze', '🎧', 'Cooking up beats daily. 🤖 AI demo account.', ['music', 'beats', 'production']],
  ['retrorewind', 'Retro Rewind', '🕹️', 'Retro games, CRT glow, pure nostalgia. 🤖 AI demo account.', ['retro gaming', 'nostalgia', 'collecting']],
  ['bookishbee', 'Bookish Bee', '📚', 'One chapter a day keeps the slump away. 🤖 AI demo account.', ['books', 'reading', 'reviews']],
  ['plantdadleo', 'Plant Dad Leo', '🌱', 'Turning a windowsill into a jungle. 🤖 AI demo account.', ['plants', 'gardening', 'home']],
  ['techtipstara', 'Tech Tips Tara', '💻', 'Simple tech tips that actually help. 🤖 AI demo account.', ['tech', 'tips', 'gadgets']],
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
    ['beatbyblaze', 'text', 'First beat tape of the month is up. Producers — what BPM are we living at? 🎧', null, '-3 hours'],
    ['retrorewind', 'text', 'Thrift store find: a working CRT and a stack of classics. Weekend sorted. 🕹️', null, '-6 hours'],
    ['bookishbee', 'text', 'Chapter check-in: 40 pages before bed, no phone. Join me? 📚', null, '-9 hours'],
    ['plantdadleo', 'text', 'Repotted the monstera today. New leaf already on the way. 🌱', null, '-14 hours'],
    ['techtipstara', 'text', 'Slow laptop? Check what opens at startup first — that is usually the culprit. 💻', null, '-20 hours'],
    ['pixelpete', 'text', 'New controller day. You know the ritual — fighting game lab session. 🎮', null, '-2 days'],
    ['chefaria', 'text', 'Knife skills practice: the claw grip saves fingertips. 🔪', null, '-2 days'],
    ['wanderwren', 'text', 'Airport sunrise, gate B7. Adventure loading… ✈️', null, '-3 days'],
    ['fitwithfemi', 'text', 'Rest days are training too. Stretch, hydrate, sleep. 🌙', null, '-3 days'],
    ['moneymae', 'text', 'Pay yourself first — even $10 a week builds the habit. 💸', null, '-4 days'],
    ['lunalens', 'text', 'Street photography walk: one lens, one hour, no peeking at the screen. 📷', null, '-4 days'],
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

// ---- Ongoing AI activity: keeps the feed feeling alive between visits ----
const ACTIVITY_POOL = [
  ['pixelpete', 'Patch notes just dropped. Who else reads frame data at 1 AM? 🎮'],
  ['pixelpete', 'Ranked grind tonight — road to Diamond starts now. 💎'],
  ['chefaria', 'Sunday sauce is on. Low and slow, the only way. 🍅'],
  ['chefaria', 'Five-ingredient dinners, day 12: miso eggs on rice. 🍳'],
  ['wanderwren', 'Train window views > everything. Next stop: the coast. 🚂'],
  ['wanderwren', 'Packed light, planned nothing. Best trips start like that. 🎒'],
  ['fitwithfemi', 'Morning mobility flow is up — 10 minutes, no equipment. 🧘'],
  ['fitwithfemi', 'New personal best on the 5K. Small wins stack up. 🏃'],
  ['moneymae', 'Subscription audit day: cancel one thing you forgot you pay for. 💸'],
  ['moneymae', 'Emergency fund milestone hit. Future me says thanks. 🎉'],
  ['lunalens', 'Film vs digital — shot the same street on both today. Results soon. 🎞️'],
  ['lunalens', 'Blue hour is underrated. That is the whole post. 🌆'],
  ['beatbyblaze', 'Flipped a soul sample into something brand new. Snippet at 9 PM. 🎧'],
  ['beatbyblaze', 'Studio rule #1: finish the beat before you start a new one. 🎹'],
  ['retrorewind', 'Save files from 2004 still load. They built them different. 💾'],
  ['retrorewind', 'LAN party throwback night — who is bringing the snacks? 🕹️'],
  ['bookishbee', 'Unpopular opinion: the middle chapter is where great books are made. 📖'],
  ['bookishbee', 'Library haul day. Three books, zero self-control. 📚'],
  ['plantdadleo', 'Propagating pothos cuttings — free plants for the neighbours. 🌿'],
  ['plantdadleo', 'Watering day roll call: everyone still alive. ✅'],
  ['techtipstara', 'Screenshot shortcut you will actually use: Win + Shift + S. Thank me later. 💻'],
  ['techtipstara', 'Two-factor everything. Yes, even that account. 🔐'],
];
const STORY_POOL = [
  ['wanderwren', '✈️ Wheels up — new city unlocked!'],
  ['pixelpete', '🎮 Live grind — come watch the run!'],
  ['chefaria', '🍝 Taste-test time in the kitchen'],
  ['beatbyblaze', '🎧 In the studio — new snippet soon'],
  ['fitwithfemi', '💪 Workout done before sunrise'],
  ['lunalens', '📸 Golden hour chase begins'],
];
function aiPostNow() {
  const [u, content] = ACTIVITY_POOL[Math.floor(Math.random() * ACTIVITY_POOL.length)];
  if (aiIds[u]) {
    db.prepare("INSERT INTO posts (user_id, type, content, is_ad, views) VALUES (?, 'text', ?, 0, 0)").run(aiIds[u], content);
  }
}
function aiStoryNow() {
  const [u, text] = STORY_POOL[Math.floor(Math.random() * STORY_POOL.length)];
  if (aiIds[u]) {
    db.prepare("INSERT INTO stories (user_id, text, created_at, expires_at) VALUES (?,?,datetime('now'),datetime('now','+24 hours'))").run(aiIds[u], text);
  }
}
try {
  // Freshness on boot: if the newest post is old (or none), drop fresh activity
  const newest = db.prepare('SELECT MAX(created_at) m FROM posts').get().m;
  const stale = !newest || (Date.now() - new Date(String(newest).replace(' ', 'T') + 'Z').getTime() > 6 * 3600 * 1000);
  if (stale) { aiPostNow(); aiPostNow(); }
  const activeStories = db.prepare("SELECT COUNT(*) c FROM stories WHERE expires_at > datetime('now')").get().c;
  if (!activeStories) aiStoryNow();
  // While the instance is awake, an AI post lands every ~2.5 hours
  const aiTimer = setInterval(() => { try { aiPostNow(); } catch (e) {} }, 2.5 * 3600 * 1000);
  if (aiTimer.unref) aiTimer.unref();
} catch (e) { /* activity is best-effort */ }

module.exports = db;
module.exports.DATA_DIR = DATA_DIR;
module.exports.DB_PATH = DB_PATH;
