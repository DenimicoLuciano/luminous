// Luminous — Express backend + API. Serves the SPA and all JSON APIs.
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ---------- uploads ----------
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 8);
    cb(null, crypto.randomBytes(16).toString('hex') + ext);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });
app.use('/uploads', express.static(UPLOAD_DIR));

// ---------- helpers ----------
const AI_CONFIGURED = () => !!process.env.OPENAI_API_KEY;

async function callAI(system, messages) {
  if (!AI_CONFIGURED()) return null;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, ...messages.slice(-20)],
      max_tokens: 400,
      temperature: 0.8,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`AI provider error ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

const LEVEL_XP = (n) => 100 * (n - 1) * (n - 1); // xp needed for level n
function levelForXp(xp) {
  let lvl = 1;
  while (xp >= LEVEL_XP(lvl + 1) && lvl < 100) lvl++;
  return lvl;
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, username: u.username, display_name: u.display_name,
    account_type: u.account_type, verified: !!u.verified, is_ai: !!u.is_ai,
    role: u.role || 'user',
    is_developer: (u.role === 'developer') || isDeveloperEmail(u.email),
    xp: u.xp, level: u.level, bio: u.bio, public_age: u.public_age,
    status: u.status, profile_color: u.profile_color, layout: u.layout,
    hobbies: safeJson(u.hobbies, []), avatar_emoji: u.avatar_emoji,
    created_at: u.created_at,
  };
}
function safeJson(s, fb) { try { return JSON.parse(s || ''); } catch { return fb; } }

const getUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const getUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?');

// ---------- developer role ----------
// The whitelisted Developer identity. An account registered with this exact
// email automatically gets role 'developer' — no password is ever hardcoded;
// he registers and sets his own password like any user.
const DEVELOPER_EMAIL = (process.env.DEVELOPER_EMAIL || 'denimdenimdenim00@gmail.com').toLowerCase();
function isDeveloperEmail(email) {
  return !!email && String(email).toLowerCase() === DEVELOPER_EMAIL;
}
function isDeveloper(u) {
  return !!u && (u.role === 'developer' || isDeveloperEmail(u.email));
}
// Grant the developer role to the whitelisted account if it somehow lacks it
// (e.g. the account existed before the role system). Idempotent.
function ensureDeveloperRole(u) {
  if (u && isDeveloperEmail(u.email) && u.role !== 'developer') {
    db.prepare("UPDATE users SET role = 'developer' WHERE id = ?").run(u.id);
    u.role = 'developer';
  }
  return u;
}

function addXp(userId, amount) {
  const u = getUserById.get(userId);
  if (!u) return;
  const newXp = u.xp + amount;
  const newLevel = levelForXp(newXp);
  db.prepare('UPDATE users SET xp = ?, level = ? WHERE id = ?').run(newXp, newLevel, userId);
  if (newLevel >= 5) unlockMilestone(userId, 'level-five');
}

function unlockMilestone(userId, key) {
  const m = db.prepare('SELECT * FROM milestones WHERE key = ?').get(key);
  if (!m) return null;
  const has = db.prepare('SELECT 1 FROM user_milestones WHERE user_id = ? AND milestone_id = ?').get(userId, m.id);
  if (has) return null;
  db.prepare('INSERT INTO user_milestones (user_id, milestone_id) VALUES (?,?)').run(userId, m.id);
  // award xp (avoid recursion: update directly, recompute level)
  const u = getUserById.get(userId);
  const newXp = u.xp + m.xp_reward;
  db.prepare('UPDATE users SET xp = ?, level = ? WHERE id = ?').run(newXp, levelForXp(newXp), userId);
  return m;
}

function ensureWallet(userId) {
  db.prepare('INSERT OR IGNORE INTO wallets (user_id) VALUES (?)').run(userId);
}

// ---------- auth ----------
function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  const s = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
  if (!s) return res.status(401).json({ error: 'INVALID_TOKEN' });
  const user = getUserById.get(s.user_id);
  if (!user) return res.status(401).json({ error: 'INVALID_TOKEN' });
  req.user = ensureDeveloperRole(user);
  next();
}
function optionalAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (token) {
    const s = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
    if (s) req.user = getUserById.get(s.user_id) ? ensureDeveloperRole(getUserById.get(s.user_id)) : null;
  }
  next();
}

app.get('/api/config', (req, res) => {
  res.json({ aiConfigured: AI_CONFIGURED(), appName: 'Luminous' });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, username, display_name, account_type } = req.body || {};
  if (!email || !password || !username || !display_name)
    return res.status(400).json({ error: 'Missing required fields' });
  if (getUserByEmail.get(email) || db.prepare('SELECT 1 FROM users WHERE username = ?').get(username))
    return res.status(409).json({ error: 'Email or username already taken' });
  const clean = String(username).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24) || 'user';
  const type = ['personal', 'business', 'creator'].includes(account_type) ? account_type : 'personal';
  const role = isDeveloperEmail(email) ? 'developer' : 'user';
  const hash = bcrypt.hashSync(password, 10);
  const r = db.prepare(`INSERT INTO users (email, password_hash, username, display_name, account_type, role)
    VALUES (?,?,?,?,?,?)`).run(email, hash, clean, display_name.slice(0, 60), type, role);
  ensureWallet(r.lastInsertRowid);
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?,?)').run(token, r.lastInsertRowid);
  res.json({ token, user: publicUser(getUserById.get(r.lastInsertRowid)) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = email && getUserByEmail.get(email);
  if (!u || !u.password_hash || u.password_hash === '!' || !bcrypt.compareSync(password || '', u.password_hash))
    return res.status(401).json({ error: 'Invalid email or password' });
  ensureDeveloperRole(u);
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?,?)').run(token, u.id);
  res.json({ token, user: publicUser(getUserById.get(u.id)) });
});

app.post('/api/auth/logout', authRequired, (req, res) => {
  const h = req.headers.authorization;
  db.prepare('DELETE FROM sessions WHERE token = ?').run(h.slice(7));
  res.json({ ok: true });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  ensureWallet(req.user.id);
  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.user.id);
  const milestones = db.prepare(`SELECT m.key, m.name, m.description, m.xp_reward,
      um.unlocked_at IS NOT NULL AS unlocked
    FROM milestones m LEFT JOIN user_milestones um
      ON um.milestone_id = m.id AND um.user_id = ?`).all(req.user.id);
  res.json({ user: publicUser(getUserById.get(req.user.id)), wallet, milestones });
});

// ---------- posts / feed ----------
const EARN_PER_VIEW_USD = 0.0033; // $3.30 per 1,000 views (55% ad-revenue share)

app.get('/api/feed', optionalAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  const offset = parseInt(req.query.offset) || 0;
  const rows = db.prepare(`
    SELECT p.*, u.username, u.display_name, u.avatar_emoji, u.verified, u.is_ai, u.role
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.is_ad = 0
    ORDER BY p.created_at DESC LIMIT ? OFFSET ?`).all(limit, offset);
  // inject in-feed ads styled as posts: every ~6 posts
  const ads = db.prepare(`SELECT p.*, u.username, u.display_name, u.avatar_emoji, u.role
    FROM posts p JOIN users u ON u.id = p.user_id WHERE p.is_ad = 1
    ORDER BY RANDOM() LIMIT 5`).all();
  const feed = [];
  let adIdx = 0;
  rows.forEach((p, i) => {
    feed.push(p);
    if ((i + 1) % 6 === 0 && ads.length) feed.push({ ...ads[adIdx++ % ads.length], _adSlot: true });
  });
  res.json({ posts: feed });
});

app.post('/api/posts', authRequired, upload.single('image'), (req, res) => {
  const content = (req.body.content || '').slice(0, 2000);
  const type = req.file ? 'photo' : 'text';
  if (!content && !req.file) return res.status(400).json({ error: 'Post needs text or a photo' });
  const image_url = req.file ? '/uploads/' + req.file.filename : null;
  const r = db.prepare('INSERT INTO posts (user_id, type, content, image_url) VALUES (?,?,?,?)')
    .run(req.user.id, type, content, image_url);
  addXp(req.user.id, 10);
  unlockMilestone(req.user.id, 'first-post');
  const count = db.prepare('SELECT COUNT(*) c FROM posts WHERE user_id = ? AND is_ad = 0').get(req.user.id).c;
  if (count >= 10) unlockMilestone(req.user.id, 'prolific');
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.post('/api/posts/:id/view', optionalAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const viewer = req.user || null;
  const isAi = viewer ? !!viewer.is_ai : false;
  db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(post.id);
  db.prepare('INSERT INTO post_views (post_id, viewer_id, is_ai) VALUES (?,?,?)')
    .run(post.id, viewer ? viewer.id : null, isAi ? 1 : 0);
  // earnings: approved business/creator authors earn on REAL views only
  if (!isAi && !post.is_ad) {
    const author = getUserById.get(post.user_id);
    if (author && author.verified && ['business', 'creator'].includes(author.account_type) && !author.is_ai) {
      ensureWallet(author.id);
      db.prepare('UPDATE wallets SET earnings_cents = earnings_cents + ? WHERE user_id = ?')
        .run(EARN_PER_VIEW_USD * 100, author.id);
      const realViews = db.prepare(`SELECT COUNT(*) c FROM post_views pv
        JOIN posts p ON p.id = pv.post_id
        WHERE p.user_id = ? AND pv.is_ai = 0`).get(author.id).c;
      if (realViews >= 100) unlockMilestone(author.id, 'century-views');
    }
  }
  res.json({ ok: true });
});

// ---------- stories ----------
app.get('/api/stories', optionalAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, u.username, u.display_name, u.avatar_emoji, u.role
    FROM stories s JOIN users u ON u.id = s.user_id
    WHERE s.expires_at > datetime('now')
    ORDER BY s.created_at DESC LIMIT 100`).all();
  // group by user for the tray
  const byUser = {};
  for (const s of rows) {
    (byUser[s.user_id] = byUser[s.user_id] || { user: {
      id: s.user_id, username: s.username, display_name: s.display_name, avatar_emoji: s.avatar_emoji,
      role: s.role, is_developer: s.role === 'developer',
    }, stories: [] }).stories.push(s);
  }
  res.json({ trays: Object.values(byUser) });
});

app.post('/api/stories', authRequired, upload.single('image'), (req, res) => {
  const text = (req.body.text || '').slice(0, 500);
  const image_url = req.file ? '/uploads/' + req.file.filename : null;
  if (!text && !image_url) return res.status(400).json({ error: 'Story needs text or an image' });
  const r = db.prepare(`INSERT INTO stories (user_id, image_url, text, expires_at)
    VALUES (?,?,?,datetime('now','+24 hours'))`).run(req.user.id, image_url, text);
  addXp(req.user.id, 5);
  unlockMilestone(req.user.id, 'first-story');
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.get('/api/stories/:id/replies', authRequired, (req, res) => {
  const rows = db.prepare(`SELECT r.*, u.username, u.display_name, u.role
    FROM story_replies r JOIN users u ON u.id = r.user_id
    WHERE r.story_id = ? ORDER BY r.created_at`).all(req.params.id);
  res.json({ replies: rows });
});

app.post('/api/stories/:id/replies', authRequired, (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Reply text required' });
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.id);
  if (!story) return res.status(404).json({ error: 'Story not found' });
  db.prepare('INSERT INTO story_replies (story_id, user_id, text) VALUES (?,?,?)')
    .run(story.id, req.user.id, text.slice(0, 500));
  addXp(req.user.id, 2);
  const n = db.prepare('SELECT COUNT(*) c FROM story_replies WHERE user_id = ?').get(req.user.id).c;
  if (n >= 5) unlockMilestone(req.user.id, 'social-butterfly');
  res.json({ ok: true });
});

// ---------- lums ----------
app.get('/api/lums', optionalAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT l.*, u.username, u.display_name, u.avatar_emoji, u.is_ai, u.role
    FROM lums l JOIN users u ON u.id = l.user_id
    ORDER BY l.created_at DESC LIMIT 50`).all();
  res.json({ lums: rows });
});

app.post('/api/lums', authRequired, upload.single('video'), (req, res) => {
  const caption = (req.body.caption || '').slice(0, 500);
  const video_url = req.file ? '/uploads/' + req.file.filename : (req.body.video_url || '').slice(0, 500);
  if (!video_url) return res.status(400).json({ error: 'Lum needs a video' });
  const r = db.prepare('INSERT INTO lums (user_id, video_url, caption) VALUES (?,?,?)')
    .run(req.user.id, video_url, caption);
  addXp(req.user.id, 10);
  unlockMilestone(req.user.id, 'first-lum');
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.post('/api/lums/:id/view', optionalAuth, (req, res) => {
  db.prepare('UPDATE lums SET views = views + 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- AI mentors ----------
app.get('/api/mentors', (req, res) => {
  const rows = db.prepare('SELECT id, key, name, tagline, emoji FROM mentors').all();
  res.json({ mentors: rows, aiConfigured: AI_CONFIGURED() });
});

function getOrCreateConversation(userId, kind, refId) {
  let c = db.prepare('SELECT * FROM conversations WHERE user_id = ? AND kind = ? AND ref_id = ?')
    .get(userId, kind, refId);
  if (!c) {
    const r = db.prepare('INSERT INTO conversations (user_id, kind, ref_id) VALUES (?,?,?)')
      .run(userId, kind, refId);
    c = { id: r.lastInsertRowid, user_id: userId, kind, ref_id: refId };
  }
  return c;
}

app.post('/api/mentors/:key/chat', authRequired, async (req, res) => {
  try {
    const mentor = db.prepare('SELECT * FROM mentors WHERE key = ?').get(req.params.key);
    if (!mentor) return res.status(404).json({ error: 'Mentor not found' });
    const { message } = req.body || {};
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message required' });
    const conv = getOrCreateConversation(req.user.id, 'mentor', mentor.id);
    db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?,?,?)')
      .run(conv.id, 'user', message.slice(0, 2000));
    const history = db.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 20')
      .all(conv.id).reverse();
    const reply = await callAI(mentor.system_prompt, history);
    if (reply == null) return res.json({ aiConfigured: false, reply: null });
    db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?,?,?)')
      .run(conv.id, 'assistant', reply);
    addXp(req.user.id, 2);
    res.json({ aiConfigured: true, reply });
  } catch (e) {
    res.status(502).json({ error: 'AI_ERROR', message: e.message });
  }
});

app.get('/api/mentors/:key/history', authRequired, (req, res) => {
  const mentor = db.prepare('SELECT * FROM mentors WHERE key = ?').get(req.params.key);
  if (!mentor) return res.status(404).json({ error: 'Mentor not found' });
  const conv = db.prepare('SELECT * FROM conversations WHERE user_id = ? AND kind = \'mentor\' AND ref_id = ?')
    .get(req.user.id, mentor.id);
  const messages = conv ? db.prepare('SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id')
    .all(conv.id) : [];
  res.json({ messages, aiConfigured: AI_CONFIGURED() });
});

// ---------- AI companions ----------
const PRONOUNS = { woman: 'she/her', man: 'he/him' };
function companionSystemPrompt(c) {
  const traits = safeJson(c.traits, []).join(', ') || 'friendly';
  const interests = safeJson(c.interests, []).join(', ') || 'chatting';
  const pn = PRONOUNS[c.gender] || 'they/them';
  return `You are ${c.name}, a ${c.age}-year-old (${pn}) AI companion inside the Luminous app.
Personality traits: ${traits}.
Interests: ${interests}.
Vibe/role: ${c.job_vibe || 'a good friend'}.
Backstory: ${c.backstory || 'You met the user on Luminous and quickly became close.'}
Stay fully in character as ${c.name} at all times. Be warm, vivid, and conversational. Keep replies concise (a few sentences). Never break character or mention you are an AI language model.`;
}

app.get('/api/companions', authRequired, (req, res) => {
  const rows = db.prepare('SELECT * FROM companions WHERE user_id = ? ORDER BY created_at').all(req.user.id);
  res.json({ companions: rows.map(c => ({ ...c, traits: safeJson(c.traits, []), interests: safeJson(c.interests, []) })), aiConfigured: AI_CONFIGURED() });
});

app.post('/api/companions', authRequired, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) c FROM companions WHERE user_id = ?').get(req.user.id).c;
  if (count >= 5) return res.status(400).json({ error: 'You can have up to 5 companions' });
  const b = req.body || {};
  const age = Math.max(18, Math.min(99, parseInt(b.age) || 25));
  const r = db.prepare(`INSERT INTO companions
    (user_id, name, avatar_emoji, color, age, gender, traits, interests, job_vibe, backstory)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    req.user.id,
    (b.name || 'Companion').slice(0, 40),
    (b.avatar_emoji || '💫').slice(0, 8),
    (b.color || '#a855f7').slice(0, 16),
    age,
    ['woman', 'man', 'nonbinary', 'other'].includes(b.gender) ? b.gender : 'other',
    JSON.stringify((b.traits || []).slice(0, 4)),
    JSON.stringify((b.interests || []).slice(0, 5)),
    (b.job_vibe || '').slice(0, 120),
    (b.backstory || '').slice(0, 1000),
  );
  addXp(req.user.id, 25);
  const ms = unlockMilestone(req.user.id, 'kindred-spirit');
  res.json({ ok: true, id: r.lastInsertRowid, milestone: ms });
});

app.delete('/api/companions/:id', authRequired, (req, res) => {
  db.prepare('DELETE FROM companions WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.post('/api/companions/:id/chat', authRequired, async (req, res) => {
  try {
    const c = db.prepare('SELECT * FROM companions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!c) return res.status(404).json({ error: 'Companion not found' });
    const { message } = req.body || {};
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message required' });
    const conv = getOrCreateConversation(req.user.id, 'companion', c.id);
    db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?,?,?)')
      .run(conv.id, 'user', message.slice(0, 2000));
    const history = db.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 20')
      .all(conv.id).reverse();
    const reply = await callAI(companionSystemPrompt(c), history);
    if (reply == null) return res.json({ aiConfigured: false, reply: null });
    db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?,?,?)')
      .run(conv.id, 'assistant', reply);
    addXp(req.user.id, 2);
    res.json({ aiConfigured: true, reply });
  } catch (e) {
    res.status(502).json({ error: 'AI_ERROR', message: e.message });
  }
});

app.get('/api/companions/:id/history', authRequired, (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE user_id = ? AND kind = \'companion\' AND ref_id = ?')
    .get(req.user.id, req.params.id);
  const messages = conv ? db.prepare('SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id')
    .all(conv.id) : [];
  res.json({ messages, aiConfigured: AI_CONFIGURED() });
});

// ---------- public milestone list ----------
app.get('/api/milestones', (req, res) => {
  res.json({ milestones: db.prepare('SELECT key, name, description, xp_reward FROM milestones').all() });
});

// ---------- livestream + coin economy ----------
app.get('/api/live', (req, res) => {
  const rows = db.prepare(`
    SELECT l.*, u.username, u.display_name, u.avatar_emoji, u.role
    FROM live_streams l JOIN users u ON u.id = l.user_id
    WHERE l.status = 'live' ORDER BY l.started_at DESC`).all();
  res.json({ streams: rows });
});

app.post('/api/live/start', authRequired, (req, res) => {
  const existing = db.prepare('SELECT 1 FROM live_streams WHERE user_id = ? AND status = \'live\'').get(req.user.id);
  if (existing) return res.status(400).json({ error: 'You already have a live stream' });
  const title = (req.body.title || 'Live now ✨').slice(0, 120);
  const r = db.prepare('INSERT INTO live_streams (user_id, title) VALUES (?,?)').run(req.user.id, title);
  addXp(req.user.id, 15);
  unlockMilestone(req.user.id, 'going-live');
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.get('/api/live/:id', (req, res) => {
  const s = db.prepare(`SELECT l.*, u.username, u.display_name, u.avatar_emoji, u.role
    FROM live_streams l JOIN users u ON u.id = l.user_id WHERE l.id = ?`).get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Stream not found' });
  const events = db.prepare(`SELECT e.*, u.display_name FROM live_events e
    LEFT JOIN users u ON u.id = e.user_id
    WHERE e.stream_id = ? ORDER BY e.id DESC LIMIT 30`).all(s.id);
  res.json({ stream: s, events: events.reverse() });
});

function liveActive(id) {
  return db.prepare('SELECT * FROM live_streams WHERE id = ? AND status = \'live\'').get(id);
}
function addStreamCoins(streamId, coins) {
  db.prepare('UPDATE live_streams SET coins_earned = coins_earned + ? WHERE id = ?').run(coins, streamId);
}

// 10 taps = 5 coins
app.post('/api/live/:id/tap', authRequired, (req, res) => {
  const s = liveActive(req.params.id);
  if (!s) return res.status(404).json({ error: 'Stream not live' });
  const taps = Math.max(0, Math.min(1000, parseInt(req.body.taps) || 0));
  const coins = Math.floor(taps / 10) * 5;
  if (coins > 0) {
    addStreamCoins(s.id, coins);
    db.prepare('INSERT INTO live_events (stream_id, user_id, kind, coins) VALUES (?,?,?,?)')
      .run(s.id, req.user.id, 'tap', coins);
  }
  res.json({ ok: true, coins });
});

// share = +10 coins (once per user per stream)
app.post('/api/live/:id/share', authRequired, (req, res) => {
  const s = liveActive(req.params.id);
  if (!s) return res.status(404).json({ error: 'Stream not live' });
  const already = db.prepare('SELECT 1 FROM live_events WHERE stream_id = ? AND user_id = ? AND kind = \'share\'')
    .get(s.id, req.user.id);
  if (already) return res.json({ ok: true, coins: 0, already: true });
  addStreamCoins(s.id, 10);
  db.prepare('INSERT INTO live_events (stream_id, user_id, kind, coins) VALUES (?,?,?,?)')
    .run(s.id, req.user.id, 'share', 10);
  res.json({ ok: true, coins: 10 });
});

// watch heartbeat: +2 coins per minute (server enforces >=50s gap)
app.post('/api/live/:id/watch', authRequired, (req, res) => {
  const s = liveActive(req.params.id);
  if (!s) return res.status(404).json({ error: 'Stream not live' });
  const last = db.prepare(`SELECT created_at FROM live_events
    WHERE stream_id = ? AND user_id = ? AND kind = 'watch' ORDER BY id DESC LIMIT 1`)
    .get(s.id, req.user.id);
  if (last && (Date.now() - new Date(last.created_at + 'Z').getTime()) < 50000)
    return res.json({ ok: true, coins: 0, tooSoon: true });
  addStreamCoins(s.id, 2);
  db.prepare('INSERT INTO live_events (stream_id, user_id, kind, coins) VALUES (?,?,?,?)')
    .run(s.id, req.user.id, 'watch', 2);
  addXp(req.user.id, 1);
  res.json({ ok: true, coins: 2 });
});

// coin gift: transfer from giver wallet to stream
app.post('/api/live/:id/gift', authRequired, (req, res) => {
  const s = liveActive(req.params.id);
  if (!s) return res.status(404).json({ error: 'Stream not live' });
  const coins = Math.max(1, Math.min(10000, parseInt(req.body.coins) || 0));
  ensureWallet(req.user.id);
  const w = db.prepare('SELECT coins FROM wallets WHERE user_id = ?').get(req.user.id);
  if (w.coins < coins) return res.status(400).json({ error: 'Not enough coins' });
  db.prepare('UPDATE wallets SET coins = coins - ? WHERE user_id = ?').run(coins, req.user.id);
  addStreamCoins(s.id, coins);
  db.prepare('INSERT INTO live_events (stream_id, user_id, kind, coins, note) VALUES (?,?,?,?,?)')
    .run(s.id, req.user.id, 'gift', coins, (req.body.note || '').slice(0, 60));
  res.json({ ok: true, coins });
});

// free gift: +1 coin, 20-second cooldown per user per stream
app.post('/api/live/:id/free-gift', authRequired, (req, res) => {
  const s = liveActive(req.params.id);
  if (!s) return res.status(404).json({ error: 'Stream not live' });
  const last = db.prepare(`SELECT created_at FROM live_events
    WHERE stream_id = ? AND user_id = ? AND kind = 'free_gift' ORDER BY id DESC LIMIT 1`)
    .get(s.id, req.user.id);
  if (last && (Date.now() - new Date(last.created_at + 'Z').getTime()) < 20000)
    return res.json({ ok: true, coins: 0, cooldown: true });
  addStreamCoins(s.id, 1);
  db.prepare('INSERT INTO live_events (stream_id, user_id, kind, coins) VALUES (?,?,?,?)')
    .run(s.id, req.user.id, 'free_gift', 1);
  res.json({ ok: true, coins: 1 });
});

// host withdrawal at 1,000 coins (stream keeps going)
app.post('/api/live/:id/withdraw', authRequired, (req, res) => {
  const s = liveActive(req.params.id);
  if (!s || s.user_id !== req.user.id) return res.status(403).json({ error: 'Only the host can withdraw' });
  if (s.coins_earned < 1000) return res.status(400).json({ error: 'Need at least 1,000 coins to withdraw' });
  ensureWallet(req.user.id);
  db.prepare('UPDATE wallets SET coins = coins + ? WHERE user_id = ?').run(s.coins_earned, req.user.id);
  db.prepare('UPDATE live_streams SET coins_earned = 0 WHERE id = ?').run(s.id);
  const w = db.prepare('SELECT coins FROM wallets WHERE user_id = ?').get(req.user.id);
  if (w.coins >= 100) unlockMilestone(req.user.id, 'coin-earner');
  res.json({ ok: true, withdrawn: s.coins_earned });
});

app.post('/api/live/:id/end', authRequired, (req, res) => {
  const s = liveActive(req.params.id);
  if (!s || s.user_id !== req.user.id) return res.status(403).json({ error: 'Only the host can end the stream' });
  ensureWallet(req.user.id);
  db.prepare('UPDATE wallets SET coins = coins + ? WHERE user_id = ?').run(s.coins_earned, req.user.id);
  db.prepare('UPDATE live_streams SET status = \'ended\', ended_at = datetime(\'now\') WHERE id = ?').run(s.id);
  const w = db.prepare('SELECT coins FROM wallets WHERE user_id = ?').get(req.user.id);
  if (w.coins >= 100) unlockMilestone(req.user.id, 'coin-earner');
  res.json({ ok: true, earned: s.coins_earned });
});

// ---------- wallet & payouts ----------
app.get('/api/wallet', authRequired, (req, res) => {
  ensureWallet(req.user.id);
  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.user.id);
  const payouts = db.prepare('SELECT * FROM payouts WHERE user_id = ? ORDER BY id DESC LIMIT 20').all(req.user.id);
  const canEarn = req.user.verified && ['business', 'creator'].includes(req.user.account_type);
  res.json({ wallet, payouts, canEarn, payoutThresholdCents: 1000, earnPer1kViews: 3.30 });
});

app.post('/api/wallet/payout', authRequired, (req, res) => {
  const canEarn = req.user.verified && ['business', 'creator'].includes(req.user.account_type);
  if (!canEarn) return res.status(403).json({ error: 'Earnings require an Approved Business/Creator account' });
  ensureWallet(req.user.id);
  const w = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.user.id);
  if (w.earnings_cents < 1000) return res.status(400).json({ error: 'Minimum payout is $10.00' });
  const amount = Math.floor(w.earnings_cents);
  db.prepare('UPDATE wallets SET earnings_cents = earnings_cents - ? WHERE user_id = ?').run(amount, req.user.id);
  const r = db.prepare('INSERT INTO payouts (user_id, amount_cents, status) VALUES (?,?,?)')
    .run(req.user.id, amount, 'pending');
  res.json({ ok: true, id: r.lastInsertRowid, amount_cents: amount });
});

// ---------- admin (developer only) ----------
function developerRequired(req, res, next) {
  if (!isDeveloper(req.user)) return res.status(403).json({ error: 'Developer access only' });
  next();
}

app.get('/api/admin/stats', authRequired, developerRequired, (req, res) => {
  const count = (sql) => db.prepare(sql).get().c;
  res.json({
    users: count('SELECT COUNT(*) c FROM users'),
    posts: count('SELECT COUNT(*) c FROM posts WHERE is_ad = 0'),
    stories: count('SELECT COUNT(*) c FROM stories'),
    lums: count('SELECT COUNT(*) c FROM lums'),
    live_streams: count('SELECT COUNT(*) c FROM live_streams'),
    live_now: count("SELECT COUNT(*) c FROM live_streams WHERE status = 'live'"),
  });
});

app.get('/api/admin/users', authRequired, developerRequired, (req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC, id DESC').all();
  res.json({ users: rows.map(u => ({ ...publicUser(u), email: u.email })) });
});

// Verify / unverify a Business or Creator account (the Approved badge)
app.post('/api/admin/users/:id/verify', authRequired, developerRequired, (req, res) => {
  const target = getUserById.get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (!['business', 'creator'].includes(target.account_type))
    return res.status(400).json({ error: 'Only Business and Creator accounts can be verified' });
  const verified = req.body && req.body.verified === false ? 0 : 1;
  db.prepare('UPDATE users SET verified = ? WHERE id = ?').run(verified, target.id);
  if (verified) unlockMilestone(target.id, 'creator-approved');
  res.json({ ok: true, user: publicUser(getUserById.get(target.id)) });
});

// Recent content across the platform, for moderation
app.get('/api/admin/content', authRequired, developerRequired, (req, res) => {
  const posts = db.prepare(`SELECT p.*, u.username, u.display_name FROM posts p
    JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC LIMIT 50`).all();
  const stories = db.prepare(`SELECT s.*, u.username, u.display_name FROM stories s
    JOIN users u ON u.id = s.user_id ORDER BY s.created_at DESC LIMIT 50`).all();
  const lums = db.prepare(`SELECT l.*, u.username, u.display_name FROM lums l
    JOIN users u ON u.id = l.user_id ORDER BY l.created_at DESC LIMIT 50`).all();
  res.json({ posts, stories, lums });
});

function adminDelete(table) {
  return (req, res) => {
    const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(row.id);
    res.json({ ok: true });
  };
}
app.delete('/api/admin/posts/:id', authRequired, developerRequired, adminDelete('posts'));
app.delete('/api/admin/stories/:id', authRequired, developerRequired, adminDelete('stories'));
app.delete('/api/admin/lums/:id', authRequired, developerRequired, adminDelete('lums'));

// ---------- profile ----------
app.get('/api/users/:username', optionalAuth, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username);
  if (!u) return res.status(404).json({ error: 'User not found' });
  const posts = db.prepare('SELECT * FROM posts WHERE user_id = ? AND is_ad = 0 ORDER BY created_at DESC LIMIT 30').all(u.id);
  const lums = db.prepare('SELECT * FROM lums WHERE user_id = ? ORDER BY created_at DESC LIMIT 12').all(u.id);
  const milestones = db.prepare(`SELECT m.key, m.name FROM milestones m
    JOIN user_milestones um ON um.milestone_id = m.id WHERE um.user_id = ?`).all(u.id);
  res.json({ user: publicUser(u), posts, lums, milestones, isOwn: !!req.user && req.user.id === u.id });
});

app.patch('/api/profile', authRequired, (req, res) => {
  const b = req.body || {};
  const fields = [];
  const vals = [];
  const allow = {
    display_name: v => String(v).slice(0, 60),
    bio: v => String(v).slice(0, 500),
    public_age: v => (v === null || v === '' ? null : Math.max(13, Math.min(120, parseInt(v) || 0)) || null),
    status: v => ['active', 'offline', 'away'].includes(v) ? v : 'active',
    profile_color: v => String(v).slice(0, 16),
    layout: v => ['grid', 'list'].includes(v) ? v : 'grid',
    hobbies: v => JSON.stringify((Array.isArray(v) ? v : []).slice(0, 12).map(String)),
    avatar_emoji: v => String(v).slice(0, 8),
  };
  for (const [k, fn] of Object.entries(allow)) {
    if (k in b) { fields.push(`${k} = ?`); vals.push(fn(b[k])); }
  }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(req.user.id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ ok: true, user: publicUser(getUserById.get(req.user.id)) });
});

app.post('/api/profile/account-type', authRequired, (req, res) => {
  const { account_type } = req.body || {};
  if (!['personal', 'business', 'creator'].includes(account_type))
    return res.status(400).json({ error: 'Invalid account type' });
  db.prepare('UPDATE users SET account_type = ?, verified = 0 WHERE id = ?').run(account_type, req.user.id);
  res.json({ ok: true, note: 'Verify your identity to earn the Approved badge' });
});

// Identity verification (demo/self-serve: in production this would be a manual/KYC review)
app.post('/api/profile/verify', authRequired, (req, res) => {
  if (!['business', 'creator'].includes(req.user.account_type))
    return res.status(400).json({ error: 'Only Business and Creator accounts can verify' });
  db.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(req.user.id);
  const ms = unlockMilestone(req.user.id, 'creator-approved');
  res.json({ ok: true, milestone: ms });
});

// ---------- static frontend ----------
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- error handler ----------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'SERVER_ERROR' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✨ Luminous running on port ${PORT} (AI ${AI_CONFIGURED() ? 'configured' : 'NOT configured'})`);
  });
}
module.exports = app;
