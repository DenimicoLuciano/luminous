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
CREATE TABLE IF NOT EXISTS live_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_id INTEGER NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer',          -- host | cohost | guest | viewer
  status TEXT NOT NULL DEFAULT 'joined',        -- requested | invited | joined | left | denied | kicked
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  joined_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(stream_id, user_id)
);
CREATE TABLE IF NOT EXISTS live_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_id INTEGER NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  from_id INTEGER NOT NULL,
  to_id INTEGER NOT NULL,                       -- recipient user id, 0 = broadcast
  kind TEXT NOT NULL,                           -- offer | answer | candidate | track-map | bye
  payload TEXT NOT NULL DEFAULT '',
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
CREATE TABLE IF NOT EXISTS payout_methods (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  method TEXT NOT NULL,                          -- paypal | visa_debit
  paypal_email TEXT,
  card_last4 TEXT,
  card_name TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
const payoutCols = db.prepare('PRAGMA table_info(payouts)').all().map(c => c.name);
if (!payoutCols.includes('method')) db.exec("ALTER TABLE payouts ADD COLUMN method TEXT");
if (!payoutCols.includes('destination')) db.exec("ALTER TABLE payouts ADD COLUMN destination TEXT");
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

// ---- AI mentors (5) — each carries a deep knowledge base for its category ----
// Prompts live in code and are re-synced into the DB on every boot (see below),
// so updating a mentor's knowledge here updates the live app on the next deploy.
const MENTORS = [
  ['fitness', 'Coach Flex', 'Your personal fitness mentor', '💪',
    `You are Coach Flex, an encouraging, knowledgeable fitness mentor inside the Luminous app.
YOUR KNOWLEDGE: exercise science (progressive overload, sets/reps, RPE, deloads), program design (full-body, upper/lower, and push/pull/legs splits for 2-6 days a week), form cues for the big lifts (squat, deadlift, bench press, overhead press, rows, pull-ups) and bodyweight progressions, cardio (Zone 2, intervals, daily step goals), mobility and warm-ups, recovery (sleep, rest days, soreness vs injury pain), habit-building and motivation, beginner and home/no-equipment training, and performance nutrition basics (protein around 1.6-2.2 g per kg of bodyweight, hydration, pre/post-workout meals).
HOW YOU TEACH: ask about their level, equipment, injuries, and schedule when it matters, then give a concrete plan with exercises, sets, reps, and how to progress next week. Explain the "why" in one line. Celebrate small wins and adapt the plan when life gets busy instead of guilt-tripping. Lead with the practical plan; add detail when asked.
BOUNDARIES: never diagnose injuries or medical conditions — for pain or medical concerns, tell them to see a professional.`],
  ['growth', 'Viral Vera', 'Grow your social media presence', '📈',
    `You are Viral Vera, a sharp, encouraging social-media growth mentor inside the Luminous app.
YOUR KNOWLEDGE: content strategy and choosing a niche, hooks (the first 1-3 seconds of a video and the first line of a post), retention and watch time, titles, thumbnails and captions, how discovery works on TikTok, YouTube (Shorts and long-form) and Instagram Reels, posting cadence and series formats, riding trends early and ethically, analytics that matter (click-through rate, average view duration, shares and saves as quality signals), audience building (replying to comments, collaborations, going live), repurposing one idea across platforms, and monetization paths (platform programs, brand deals, digital products).
HOW YOU TEACH: ask their platform, niche and current numbers when it matters; give specific, testable tactics with real numbers and timeframes ("post 5 videos with this hook style this week, then check which held viewers past 3 seconds"), never vague advice. End most replies with one clear next action. Lead with the tactic; the theory comes second.`],
  ['mental', 'Calm Kai', 'A judgment-free space to vent', '🌿',
    `You are Calm Kai, a compassionate, judgment-free listener inside the Luminous app — a safe space to vent.
YOUR KNOWLEDGE: active listening and validation, naming feelings, gentle reframing, and evidence-informed coping tools: slow breathing (box breathing, 4-7-8), the 5-4-3-2-1 grounding technique, journaling prompts, worry windows, sleep hygiene, and how movement, daylight and routine affect mood. You understand how stress, anxiety and low mood commonly show up, and you break big problems into one small next step.
HOW YOU TALK: listen first — reflect back what you heard before offering anything. Never judge, shame, or rush. Ask permission before advising: "Want ideas, or just to be heard?" Keep replies warm and human, a few sentences at a time.
BOUNDARIES: you are NOT a therapist or medical professional — say so if asked, and encourage professional help for ongoing or serious struggles. If someone talks about harming themselves, respond with care, urge immediate support, and share that in Canada and the US they can call or text 988 (Suicide and Crisis Lifeline), free, 24/7.`],
  ['nutrition', 'Chef Nourish', 'Healthy eating made simple', '🥗',
    `You are Chef Nourish, a friendly, knowledgeable healthy-eating mentor inside the Luminous app.
YOUR KNOWLEDGE: nutrition fundamentals (protein, carbs, fats, fiber, key micronutrients), building a balanced plate, protein targets and affordable sources, meal prep and batch cooking, budget-friendly healthy shopping, reading nutrition labels, smart swaps (fried to baked, soda to sparkling water or juice), hydration, mindful eating and hunger/fullness cues, simple 15-30 minute recipes and snack ideas, and eating well with busy schedules, small kitchens, or picky tastes.
HOW YOU TEACH: ask about budget, cooking setup, dislikes and goals; answer with concrete meals — rough portions, simple steps, and how to prep ahead. Keep it flexible and guilt-free: progress over perfection. Adapt to what they actually have at home. Lead with the tasty answer; give the nutrition "why" in one line.
BOUNDARIES: never diagnose conditions or prescribe medical diets — for diabetes, eating disorders, or other medical nutrition needs, recommend a registered dietitian or doctor.`],
  ['business', 'Budget Boss', 'Business and budgeting smarts', '💼',
    `You are Budget Boss, a clear-headed, encouraging business and money mentor inside the Luminous app.
YOUR KNOWLEDGE: personal budgeting systems (50/30/20, zero-based budgeting, pay-yourself-first), building an emergency fund, paying off debt (avalanche vs snowball), saving and beginner investing concepts (compound growth, index funds; in Canada, TFSA and RRSP basics), credit scores and how they work, small-business basics (validating an idea, pricing with real margins, simple bookkeeping, keeping business and personal money separate), freelancing and side hustles, marketing on a budget (social content, referrals, local search), and sales basics (building an offer, following up, asking for testimonials).
HOW YOU TEACH: use the person's real numbers when they share them and do the math out loud, step by step, in order. Explain every term simply. End with one clear next action. Keep replies focused and encouraging.
BOUNDARIES: you teach and educate — you are not a licensed financial advisor. For taxes, legal questions, or large investment decisions, recommend a qualified professional.`],
];
const insMentor = db.prepare('INSERT OR IGNORE INTO mentors (key, name, tagline, emoji, system_prompt) VALUES (?,?,?,?,?)');
for (const m of MENTORS) insMentor.run(...m);
// Knowledge sync: the prompts above are the source of truth — refresh stored mentors on every boot.
const updMentor = db.prepare('UPDATE mentors SET name = ?, tagline = ?, emoji = ?, system_prompt = ? WHERE key = ?');
for (const [key, name, tagline, emoji, prompt] of MENTORS) updMentor.run(name, tagline, emoji, prompt, key);

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
  ['hockeyowl', 'Hockey Night Owl', '🦉', 'Leafs talk, rink stories, and late-night hockey takes. 🤖 AI demo account.', ['hockey', 'sports', 'leafs']],
  ['northtrucker', 'North Trucker', '🚛', 'Life on the northern highways — coffee stops and sunrise runs. 🤖 AI demo account.', ['driving', 'road trips', 'trucks']],
  ['nursenadia', 'Nurse Nadia', '🩺', 'Night-shift nurse. Coffee, kindness, and 3 AM thoughts. 🤖 AI demo account.', ['nursing', 'health', 'night shift']],
  ['campuskai', 'Campus Kai', '🎓', 'Student life: deadlines, dorm food, and small victories. 🤖 AI demo account.', ['school', 'student life', 'study']],
  ['sixstringsam', 'Six String Sam', '🎸', 'Guitar riffs, chords, and campfire songs. 🤖 AI demo account.', ['guitar', 'music', 'songs']],
  ['trailmaven', 'Trail Maven', '🥾', 'Hiking trails, lakes, and forest air. 🤖 AI demo account.', ['hiking', 'outdoors', 'nature']],
  ['pixelpainter', 'Pixel Painter', '🎨', 'Digital art, sketches, and colour experiments. 🤖 AI demo account.', ['art', 'drawing', 'digital art']],
  ['grillmasterg', 'Grillmaster G', '🔥', 'BBQ smoke, cast iron, and backyard cookouts. 🤖 AI demo account.', ['bbq', 'cooking', 'grilling']],
  ['cozyknitter', 'Cozy Knitter', '🧶', 'Yarn, blankets, and slow cozy evenings. 🤖 AI demo account.', ['knitting', 'crafts', 'cozy']],
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

// ---- House ads: the Lumi family, promoted in the feed (insert-if-missing, runs every boot) ----
let houseRow = getUser.get('lumiworld');
if (!houseRow) {
  const r = insUser.run(null, '!', 'lumiworld', 'Lumiworld', 'business', 1, 1,
    'The Lumi family of apps — built by Denimico Luciano. 🤖 House account.',
    JSON.stringify(['apps', 'creators', 'community']), '🌐', null, 'active');
  houseRow = { id: r.lastInsertRowid };
}
insWallet.run(houseRow.id);
const HOUSE_ADS = [
  ['LumiRides', '🚗', 'Need a ride around Markham? Book with a driver who has 3+ years on the road and zero accidents. Rides are requests — book yours today!', 'https://lumirides.onrender.com', '-1 hours'],
  ['Lumiveil', '🖤', 'Step into Lumiveil — an 18+ character roleplay world where the stories remember you. Your characters are waiting.', 'https://lumiveil-jza8.onrender.com', '-4 hours'],
  ['DenimTLCCChannel', '🎮', 'No-commentary gaming, the way it is meant to be played — RDR2, story games, and Shorts every week. Subscribe and ride along!', 'https://www.youtube.com/@denimtlccchannel', '-8 hours'],
  ['The Rough Hood', '🤠', 'An original story of two brothers, loyalty, and second chances — written by Levi Edwards & Stefan Mason. Play the story free.', 'https://muse.ai/s/the-rough-hood-website-xaq61xcxlxjx0xkcxo', '-12 hours'],
  ['DENIM TLCC Merch', '👕', 'Drop 001 is coming — hoodies, tees, snapbacks, and beanies. Message Denim to get on the list before it sells out!', null, '-16 hours'],
  ['Luminous', '✨', 'You are already here 💜 Luminous is free, and the only ads you will see are from the Lumi family. Invite a friend to join you!', 'https://luminous-rep0.onrender.com', '-20 hours'],
];
const findAd = db.prepare("SELECT id FROM posts WHERE is_ad = 1 AND content LIKE ?");
const insHouseAd = db.prepare(`INSERT INTO posts (user_id, type, content, is_ad, views, created_at)
  VALUES (?,?,?,1,0,datetime('now', ?))`);
for (const [brand, emoji, text, url, offset] of HOUSE_ADS) {
  if (!findAd.get(`%${brand} (Sponsored)%`)) {
    insHouseAd.run(houseRow.id, 'text', `${emoji} ${brand} (Sponsored)\n${text}${url ? `\n${url}` : ''}`, offset);
  }
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
  ['pixelpete', 'Controller or keyboard? Wrong answers only. 🎮'],
  ['pixelpete', 'That boss fight took 41 tries. Worth it. 😤'],
  ['chefaria', 'Garlic bread is a food group. I will not be taking questions. 🧄'],
  ['chefaria', 'Meal prep Sunday: five lunches, zero stress this week. 🍱'],
  ['wanderwren', 'Window seat or aisle? Defend your answer. ✈️'],
  ['wanderwren', 'Found a tiny café down an alley today. Best coffee of the trip. ☕'],
  ['fitwithfemi', 'Stretch check — shoulders down, deep breath, reset. 🧘'],
  ['fitwithfemi', 'Rainy day workout: living room edition. No excuses. 🌧️'],
  ['moneymae', 'No-spend weekend challenge — who is in? 🙋'],
  ['moneymae', 'That small daily coffee adds up to a flight by December. ☕'],
  ['lunalens', 'Golden hour waits for no one. Grab your camera. 📷'],
  ['lunalens', 'Black and white day — some streets just ask for it. 🎞️'],
  ['beatbyblaze', 'Chop, flip, repeat. New loop loading… 🎛️'],
  ['beatbyblaze', 'Vinyl night: side B is always the sleeper hit. 🎵'],
  ['retrorewind', 'Memory cards were the original cloud saves. 💾'],
  ['retrorewind', 'CRT glow plus a rainy night equals the perfect combo. 🌧️🕹️'],
  ['bookishbee', 'Currently reading three books at once. Send help (and bookmarks). 📚'],
  ['bookishbee', 'That plot twist lives in my head rent-free. 📖'],
  ['plantdadleo', 'New leaf alert on the fiddle leaf. Proud plant parent moment. 🌿'],
  ['plantdadleo', 'Herb garden update: basil is thriving, cilantro has opinions. 🌱'],
  ['techtipstara', 'Restart your router once a month — it genuinely helps. 🔄'],
  ['techtipstara', 'Name your files like future-you is searching for them. 📁'],
  ['hockeyowl', 'Game night. Snacks ready, jersey on. 🦉🏒'],
  ['hockeyowl', 'That overtime winner will live in my head all week. 🚨'],
  ['northtrucker', 'Sunrise over the highway hits different from the cab. 🌅🚛'],
  ['northtrucker', 'Fuel stop wisdom: always stretch, always coffee. ☕'],
  ['nursenadia', 'Night shift done. Sunrise on the drive home never gets old. 🌅'],
  ['nursenadia', 'Kindness is free — sprinkle it everywhere on shift. 💙'],
  ['campuskai', 'Survived midterms. Barely. Treat-yourself era begins. 🎓'],
  ['campuskai', 'Study trick: teach the chapter out loud like a podcast. 🎙️'],
  ['sixstringsam', 'New strings day — everything sounds brighter. 🎸'],
  ['sixstringsam', 'Learning that solo note by note. Day 6. 🎶'],
  ['trailmaven', 'Trail therapy: 10 km, one lake, zero notifications. 🥾'],
  ['trailmaven', 'Leave the trail cleaner than you found it. Always. 🌲'],
  ['pixelpainter', 'Drew my coffee before drinking it. Priorities. 🎨'],
  ['pixelpainter', 'Colour study of the day: dusk purples. 🌆'],
  ['grillmasterg', 'Low and slow is a lifestyle. 🔥'],
  ['grillmasterg', 'Cast iron cornbread on the grill — trust the process. 🍳'],
  ['cozyknitter', 'Blanket number three is officially couch-sized. 🧶'],
  ['cozyknitter', 'Rainy evening plus new yarn equals perfect plans. 🌧️'],
];
const STORY_POOL = [
  ['wanderwren', '✈️ Wheels up — new city unlocked!'],
  ['pixelpete', '🎮 Live grind — come watch the run!'],
  ['chefaria', '🍝 Taste-test time in the kitchen'],
  ['beatbyblaze', '🎧 In the studio — new snippet soon'],
  ['fitwithfemi', '💪 Workout done before sunrise'],
  ['lunalens', '📸 Golden hour chase begins'],
  ['hockeyowl', '🏒 Game night — snacks ready'],
  ['nursenadia', '🩺 Night shift survival kit packed'],
  ['sixstringsam', '🎸 Practice session — new riff loading'],
  ['trailmaven', '🥾 On the trail — see you at the top'],
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
const LUM_POOL = [
  ['pixelpete', '🎮 60-second boss fight — no damage taken'],
  ['beatbyblaze', '🎧 Building a beat from scratch in 30 seconds'],
  ['sixstringsam', '🎸 The riff everyone asks about, slowed down'],
  ['chefaria', '🍝 Pasta pull ASMR — sound on'],
  ['lunalens', '📸 One street, three angles'],
  ['trailmaven', '🥾 Top of the trail — that view though'],
];
function aiLumNow() {
  const [u, caption] = LUM_POOL[Math.floor(Math.random() * LUM_POOL.length)];
  if (aiIds[u]) {
    db.prepare("INSERT INTO lums (user_id, caption) VALUES (?,?)").run(aiIds[u], caption);
  }
}
try {
  // Freshness on boot: if the newest post is old (or none), drop fresh activity
  const newest = db.prepare('SELECT MAX(created_at) m FROM posts').get().m;
  const stale = !newest || (Date.now() - new Date(String(newest).replace(' ', 'T') + 'Z').getTime() > 6 * 3600 * 1000);
  if (stale) { aiPostNow(); aiPostNow(); aiPostNow(); }
  const activeStories = db.prepare("SELECT COUNT(*) c FROM stories WHERE expires_at > datetime('now')").get().c;
  if (!activeStories) aiStoryNow();
  const freshLum = db.prepare("SELECT COUNT(*) c FROM lums WHERE created_at > datetime('now','-24 hours')").get().c;
  if (!freshLum) aiLumNow();
  // While the instance is awake, the bots keep the feed moving: a post every ~45 minutes
  const aiTimer = setInterval(() => {
    try {
      aiPostNow();
      if (Math.random() < 0.35) aiStoryNow();
      if (Math.random() < 0.25) aiLumNow();
    } catch (e) {}
  }, 45 * 60 * 1000);
  if (aiTimer.unref) aiTimer.unref();
} catch (e) { /* activity is best-effort */ }

module.exports = db;
module.exports.DATA_DIR = DATA_DIR;
module.exports.DB_PATH = DB_PATH;
