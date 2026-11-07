// Luminous — Express backend + API. Serves the SPA and all JSON APIs.
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cors = require('cors');
const db = require('./db');
const lumicoin = require('./lumicoin');
const eventsContent = require('./events-content');

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
const AI_CONFIGURED = () => !!process.env.LUMIAI_API_KEY;

// ---------- AI call path (shared by mentors + companions) ----------
// Speed rules: only the last AI_CONTEXT_LIMIT stored messages are SENT per
// call (stored history itself is never trimmed), each surface caps its own
// output tokens, and a provider overload (503 / "high demand") is retried
// ONCE with a halved context before the error surfaces.
const AI_CONTEXT_LIMIT = 40;
const AI_RETRY_CONTEXT = 16;

function isOverloadError(e) {
  if (!e) return false;
  if (e.status === 503) return true;
  return /high demand|overloaded|503/i.test(e.message || '');
}

async function callAIOnce(system, messages, { maxTokens, contextLimit, stream, onToken }) {
  const model = process.env.LUMIAI_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
  const base = (process.env.LUMIAI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LUMIAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, ...messages.slice(-contextLimit)],
      max_tokens: maxTokens,
      temperature: 0.8,
      ...(stream ? { stream: true } : {}),
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    const err = new Error(`AI provider error ${res.status}: ${t.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  if (!stream) {
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  }
  // Streaming: a provider that ignores stream:true and answers plain JSON
  // is handled as a normal completion (no tokens are emitted).
  const ctype = res.headers.get('content-type') || '';
  if (!ctype.includes('text/event-stream')) {
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  }
  let full = '';
  let buf = '';
  const decoder = new TextDecoder();
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const j = JSON.parse(payload);
        const delta = j.choices?.[0]?.delta?.content || j.choices?.[0]?.message?.content || '';
        if (delta) { full += delta; if (onToken) onToken(delta); }
      } catch { /* ignore keep-alive / partial lines */ }
    }
  }
  return full.trim() || null;
}

// callAI(system, messages, { maxTokens, stream, onToken }) → reply text or
// null (null = AI not configured). Throws on provider errors, after the
// single overload retry. In stream mode onToken fires per token; the retry
// only happens when no token has been emitted yet, so a client never sees
// a duplicated half-reply.
async function callAI(system, messages, opts = {}) {
  if (!AI_CONFIGURED()) return null;
  const maxTokens = opts.maxTokens || 400;
  let tokensEmitted = 0;
  const onToken = opts.onToken ? (t) => { tokensEmitted++; opts.onToken(t); } : undefined;
  const attempt = (limit) => callAIOnce(system, messages, {
    maxTokens, contextLimit: limit, stream: !!opts.stream, onToken,
  });
  try {
    return await attempt(AI_CONTEXT_LIMIT);
  } catch (e) {
    if (isOverloadError(e) && tokensEmitted === 0) {
      return await attempt(AI_RETRY_CONTEXT);
    }
    throw e;
  }
}

// Chat-endpoint helper implementing the streaming design: the client opts
// in by sending { stream: true } in the POST body. The response then
// becomes text/event-stream — `event: token` frames {"content": "..."}
// per token, and the caller finishes with an `event: done` frame once the
// full reply is saved. If the provider errors before the first token, we
// fall back to the plain non-streaming call and the caller answers with
// the usual JSON body. Returns { reply } for the JSON path or
// { streamed: true, reply, failed? } when SSE was used.
async function aiChatReply(req, res, system, history, maxTokens) {
  if (!AI_CONFIGURED()) return { reply: null };
  if (!(req.body && req.body.stream)) {
    return { reply: await callAI(system, history, { maxTokens }) };
  }
  let sent = false;
  const onToken = (t) => {
    if (!sent) {
      sent = true;
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
    }
    res.write(`event: token\ndata: ${JSON.stringify({ content: t })}\n\n`);
  };
  try {
    const reply = await callAI(system, history, { maxTokens, stream: true, onToken });
    if (!sent) return { reply }; // provider answered without streaming: JSON path
    return { streamed: true, reply };
  } catch (e) {
    if (!sent) {
      // Provider errored before the first token: fall back to the
      // existing non-streaming JSON path.
      return { reply: await callAI(system, history, { maxTokens }) };
    }
    // Mid-stream failure: tell the client and stop; nothing is saved.
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'AI_ERROR', message: e.message })}\n\n`);
    return { streamed: true, reply: null, failed: true };
  }
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

// ---------- Mystery pack: follows + trophies ----------
// HONESTY RULE: follower numbers are ALWAYS live COUNT(*)s from the follows
// table. Nothing anywhere hardcodes or inflates a follower count.
function followerCount(userId) {
  return db.prepare('SELECT COUNT(*) c FROM follows WHERE followee_id = ?').get(userId).c;
}
function followingCount(userId) {
  return db.prepare('SELECT COUNT(*) c FROM follows WHERE follower_id = ?').get(userId).c;
}
const TROPHY_DEFS = [
  { key: 'first-thousand', name: 'First Thousand', icon: '🥉', threshold: 1000 },
  { key: 'six-figures', name: 'Six Figures', icon: '🥈', threshold: 100000 },
  { key: 'million-club', name: 'Million Club', icon: '🥇', threshold: 1000000 },
];
// Trophies are computed from real data: milestone trophies from the real
// follower count, event trophies from real Monthly Quest wins, and the
// Founder trophy from the developer identity the tree already recognizes.
function trophiesFor(u) {
  const fc = followerCount(u.id);
  const list = TROPHY_DEFS.map(t => ({ ...t, unlocked: fc >= t.threshold }));
  if (isDeveloper(u)) list.unshift({ key: 'founder', name: 'The Founder', icon: '🏆', threshold: null, unlocked: true });
  const won = (kind) => !!db.prepare('SELECT 1 FROM events WHERE winner_user_id = ? AND kind = ? LIMIT 1').get(u.id, kind);
  list.push({ key: 'mystery-winner', name: 'Mystery Solver', icon: '🔎', threshold: null, unlocked: won('mystery') });
  list.push({ key: 'treasure-winner', name: 'Treasure Hunter', icon: '🗺️', threshold: null, unlocked: won('treasure') });
  return list;
}
function profileExtras(u, viewer) {
  return {
    follower_count: followerCount(u.id),
    following_count: followingCount(u.id),
    is_following: !!(viewer && viewer.id !== u.id &&
      db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?').get(viewer.id, u.id)),
    trophies: trophiesFor(u),
  };
}
function enrichUser(u, viewer) {
  if (!u) return null;
  return { ...publicUser(u), ...profileExtras(u, viewer || null) };
}

// ---------- Weekly missions ----------
const MISSIONS = [
  { key: 'post-3', title: 'Post 3 times', target: 3, reward: 30 },
  { key: 'lum-1', title: 'Post a Lum', target: 1, reward: 25 },
  { key: 'story-1', title: 'Share a Story', target: 1, reward: 15 },
  { key: 'follow-5', title: 'Follow 5 creators', target: 5, reward: 20 },
  { key: 'server-msg-10', title: 'Send 10 messages in a LumiServer', target: 10, reward: 20 },
  { key: 'join-server', title: 'Find & join a hidden LumiServer', target: 1, reward: 40 },
  { key: 'gift-1', title: 'Send a gift in a live room', target: 1, reward: 30 },
  { key: 'golive-1', title: 'Go live once', target: 1, reward: 50 },
];
// ISO week key 'YYYY-Www' (UTC). Rows are keyed by week, so a new week
// simply starts everyone fresh — no reset job.
function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;               // Mon = 0 … Sun = 6
  d.setUTCDate(d.getUTCDate() - dayNum + 3);            // Thursday of this week
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const fDay = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - fDay + 3);
  const week = 1 + Math.round((d - firstThu) / (7 * 864e5));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
// Best-effort progress bump: a mission failure must NEVER break the action.
function bumpMission(userId, key, n = 1) {
  try {
    db.prepare(`INSERT INTO mission_progress (user_id, week, mission_key, progress) VALUES (?,?,?,?)
      ON CONFLICT(user_id, week, mission_key) DO UPDATE SET progress = progress + excluded.progress`)
      .run(userId, isoWeekKey(), key, n);
  } catch (e) { /* missions are best-effort */ }
}
// Mission reward credit — the same unified-ledger-first pattern as
// creditHostPayout: a Core 'earn' when the user is Lumiail-linked, else the
// local wallet. Mutually exclusive; returns the balance or null.
async function creditMissionReward(user, amount, missionKey, week) {
  if (amount > 0 && lumicoin.enabled() && user.lumiail_address) {
    const r = await lumicoin.postTransaction({
      lumiail_address: user.lumiail_address,
      kind: 'earn',
      amount,
      note: `Weekly mission reward: ${missionKey}`,
      idempotency_key: `mission-${week}-${missionKey}`,
    });
    if (r) return r.wallet ? r.wallet.balance : null;
  }
  ensureWallet(user.id);
  db.prepare('UPDATE wallets SET coins = coins + ? WHERE user_id = ?').run(amount, user.id);
  const w = db.prepare('SELECT coins FROM wallets WHERE user_id = ?').get(user.id);
  return w ? w.coins : null;
}

// ---------- Monthly quest events: seed rows from authored content ----------
// Only authored months get rows; a month with no content entry reads as the
// honest "being written" state. Answers are NEVER stored in the DB: rows
// carry the client-safe payload built by events-content.js, and solutions
// stay in that server-side module only.
try {
  const insEvent = db.prepare('INSERT OR IGNORE INTO events (kind, month, title, intro, payload) VALUES (?,?,?,?,?)');
  for (const [month, pair] of Object.entries(eventsContent.CONTENT)) {
    for (const kind of ['mystery', 'treasure']) {
      const entry = pair[kind];
      if (entry) insEvent.run(kind, month, entry.title, entry.intro, JSON.stringify(eventsContent.clientPayload(kind, entry)));
    }
  }
} catch (e) { console.error('event seed', e); }
function currentMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
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
  // WebRTC ICE: STUN always; a TURN relay joins when its credentials are set in the environment.
  // TURN is what lets live video punch through strict home/mobile networks.
  const iceServers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }];
  if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_PASSWORD) {
    iceServers.push({
      urls: process.env.TURN_URL.split(',').map(s => s.trim()).filter(Boolean),
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_PASSWORD,
    });
  }
  res.json({ aiConfigured: AI_CONFIGURED(), appName: 'Luminous', iceServers, turnConfigured: iceServers.length > 1, adsterraKey: process.env.ADSTERRA_KEY || null, adsterraSrc: process.env.ADSTERRA_KEY ? (process.env.ADSTERRA_SRC || ('https://bicea.org/22/' + process.env.ADSTERRA_KEY)) : null });
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
  res.json({ token, user: enrichUser(getUserById.get(r.lastInsertRowid), null) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = email && getUserByEmail.get(email);
  if (!u || !u.password_hash || u.password_hash === '!' || !bcrypt.compareSync(password || '', u.password_hash))
    return res.status(401).json({ error: 'Invalid email or password' });
  ensureDeveloperRole(u);
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?,?)').run(token, u.id);
  res.json({ token, user: enrichUser(getUserById.get(u.id), null) });
});

// Sign in with Lumiail (Lumiworld single sign-on): the Lumiail password is
// verified by the Lumiail service itself and is never stored by Luminous.
// First Lumiail sign-in creates a linked Luminous account automatically.
app.post('/api/auth/lumiail', async (req, res) => {
  const addr = String((req.body || {}).address || '').trim().toLowerCase();
  const password = (req.body || {}).password || '';
  if (!addr || !password) return res.status(400).json({ error: 'Enter your Lumiail address and password' });
  const base = (process.env.LUMIAIL_URL || 'https://lumiail.onrender.com').replace(/\/+$/, '');
  let prof = null;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    const r = await fetch(base + '/api/sso/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(process.env.SSO_SECRET ? { 'x-sso-secret': process.env.SSO_SECRET } : {}) },
      body: JSON.stringify({ address: addr, password }),
      signal: ctl.signal,
    });
    clearTimeout(timer);
    if (r.status === 401) return res.status(401).json({ error: 'Invalid Lumiail address or password' });
    if (!r.ok) return res.status(502).json({ error: 'Lumiail sign-in is not available yet — it launches soon' });
    prof = await r.json();
  } catch (e) {
    return res.status(502).json({ error: 'Lumiail sign-in is not available yet — it launches soon' });
  }
  if (!prof || !prof.ok || !prof.username) return res.status(401).json({ error: 'Invalid Lumiail address or password' });
  let u = db.prepare('SELECT * FROM users WHERE lumiail_address = ?').get(addr);
  if (!u) {
    const byEmail = getUserByEmail.get(addr);
    if (byEmail) {
      db.prepare('UPDATE users SET lumiail_address = ? WHERE id = ?').run(addr, byEmail.id);
      u = getUserById.get(byEmail.id);
    }
  }
  if (!u) {
    let base2 = String(prof.username).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24) || 'lumiailuser';
    let uname = base2, n = 1;
    while (db.prepare('SELECT 1 FROM users WHERE username = ?').get(uname)) { n += 1; uname = base2.slice(0, 20) + n; }
    const r2 = db.prepare(`INSERT INTO users (email, password_hash, username, display_name, account_type, role, lumiail_address)
      VALUES (?,?,?,?,?,?,?)`).run(addr, '!', uname, String(prof.display_name || base2).slice(0, 60), 'personal', 'user', addr);
    ensureWallet(r2.lastInsertRowid);
    u = getUserById.get(r2.lastInsertRowid);
  }
  ensureDeveloperRole(u);
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?,?)').run(token, u.id);
  res.json({ token, user: enrichUser(getUserById.get(u.id), null) });
});

app.post('/api/auth/logout', authRequired, (req, res) => {
  const h = req.headers.authorization;
  db.prepare('DELETE FROM sessions WHERE token = ?').run(h.slice(7));
  res.json({ ok: true });
});

// Forgot password: the user files a request; the app owner (developer) reads
// the one-time code in the Admin tab and passes it to them out-of-band.
app.post('/api/auth/forgot', (req, res) => {
  const email = String((req.body || {}).email || '').trim();
  const u = email && getUserByEmail.get(email);
  if (u) {
    db.prepare("DELETE FROM password_resets WHERE user_id = ? AND status = 'pending'").run(u.id);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    db.prepare("INSERT INTO password_resets (user_id, code, expires_at) VALUES (?,?,datetime('now','+30 minutes'))").run(u.id, code);
  }
  res.json({ ok: true }); // same answer either way — never reveal whether the email exists
});

app.post('/api/auth/reset', (req, res) => {
  const { email, code, new_password } = req.body || {};
  if (!new_password || String(new_password).length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  const u = email && getUserByEmail.get(String(email).trim());
  if (!u) return res.status(400).json({ error: 'Invalid code' });
  const r = db.prepare(`SELECT * FROM password_resets WHERE user_id = ? AND status = 'pending'
    AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1`).get(u.id);
  if (!r || String(code || '').trim() !== r.code)
    return res.status(400).json({ error: 'Invalid or expired code' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(new_password), 10), u.id);
  db.prepare("UPDATE password_resets SET status = 'used' WHERE id = ?").run(r.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  ensureDeveloperRole(u);
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?,?)').run(token, u.id);
  res.json({ ok: true, token, user: publicUser(getUserById.get(u.id)) });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  ensureWallet(req.user.id);
  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.user.id);
  const milestones = db.prepare(`SELECT m.key, m.name, m.description, m.xp_reward,
      um.unlocked_at IS NOT NULL AS unlocked
    FROM milestones m LEFT JOIN user_milestones um
      ON um.milestone_id = m.id AND um.user_id = ?`).all(req.user.id);
  res.json({ user: enrichUser(getUserById.get(req.user.id), req.user), wallet, milestones });
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
  bumpMission(req.user.id, 'post-3');
  const count = db.prepare('SELECT COUNT(*) c FROM posts WHERE user_id = ? AND is_ad = 0').get(req.user.id).c;
  if (count >= 10) unlockMilestone(req.user.id, 'prolific');
  res.json({ ok: true, id: r.lastInsertRowid });
});

// ---------- Planned (scheduled) posts: publish automatically at the chosen date & time ----------
function promoteDuePosts() {
  try {
    const due = db.prepare("SELECT * FROM scheduled_posts WHERE publish_at <= datetime('now') ORDER BY publish_at").all();
    for (const s of due) {
      db.prepare('INSERT INTO posts (user_id, type, content, image_url, created_at) VALUES (?,?,?,?,?)')
        .run(s.user_id, s.image_url ? 'photo' : 'text', s.content, s.image_url, s.publish_at);
      db.prepare('DELETE FROM scheduled_posts WHERE id = ?').run(s.id);
      addXp(s.user_id, 10);
      unlockMilestone(s.user_id, 'first-post');
      const c = db.prepare('SELECT COUNT(*) c FROM posts WHERE user_id = ? AND is_ad = 0').get(s.user_id).c;
      if (c >= 10) unlockMilestone(s.user_id, 'prolific');
    }
    if (due.length) console.log(`🕒 Promoted ${due.length} planned post(s)`);
  } catch (e) { console.error('promoteDuePosts', e); }
}
setInterval(promoteDuePosts, 20000);
setTimeout(promoteDuePosts, 5000);

app.post('/api/posts/schedule', authRequired, upload.single('image'), (req, res) => {
  const content = (req.body.content || '').slice(0, 2000);
  if (!content && !req.file) return res.status(400).json({ error: 'Post needs text or a photo' });
  const when = new Date(req.body.publish_at || '');
  if (isNaN(when) || when.getTime() < Date.now() + 30000)
    return res.status(400).json({ error: 'Pick a date and time at least a minute from now' });
  const iso = when.toISOString().slice(0, 19).replace('T', ' ');
  const image_url = req.file ? '/uploads/' + req.file.filename : null;
  const r = db.prepare('INSERT INTO scheduled_posts (user_id, content, image_url, publish_at) VALUES (?,?,?,?)')
    .run(req.user.id, content, image_url, iso);
  res.json({ ok: true, id: r.lastInsertRowid, publish_at: iso });
});

app.get('/api/posts/scheduled', authRequired, (req, res) => {
  const rows = db.prepare('SELECT id, content, image_url, publish_at, created_at FROM scheduled_posts WHERE user_id = ? ORDER BY publish_at').all(req.user.id);
  res.json({ scheduled: rows });
});

app.delete('/api/posts/scheduled/:id', authRequired, (req, res) => {
  const own = db.prepare('SELECT id FROM scheduled_posts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!own) return res.status(404).json({ error: 'Planned post not found' });
  db.prepare('DELETE FROM scheduled_posts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
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
  bumpMission(req.user.id, 'story-1');
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
  const q = String(req.query.q || '').trim().toLowerCase();
  let rows;
  if (q) {
    const like = '%' + q.replace(/[%_]/g, '') + '%';
    rows = db.prepare(`
      SELECT l.*, u.username, u.display_name, u.avatar_emoji, u.is_ai, u.role
      FROM lums l JOIN users u ON u.id = l.user_id
      WHERE LOWER(l.caption) LIKE ? OR LOWER(u.username) LIKE ? OR LOWER(u.display_name) LIKE ?
      ORDER BY l.created_at DESC LIMIT 50`).all(like, like, like);
  } else {
    rows = db.prepare(`
      SELECT l.*, u.username, u.display_name, u.avatar_emoji, u.is_ai, u.role
      FROM lums l JOIN users u ON u.id = l.user_id
      ORDER BY l.created_at DESC LIMIT 50`).all();
  }
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
  bumpMission(req.user.id, 'lum-1');
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.post('/api/lums/:id/view', optionalAuth, (req, res) => {
  db.prepare('UPDATE lums SET views = views + 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- AI mentors ----------
app.get('/api/mentors', (req, res) => {
  const rows = db.prepare('SELECT id, key, name, tagline, emoji FROM mentors').all();
  // The Turso/libsql driver returns the `key` column as `KEY` — normalize it,
  // or the client reads m.key as undefined and every mentor chat 404s.
  const mentors = rows.map(r => ({ id: r.id, key: r.key ?? r.KEY, name: r.name, tagline: r.tagline, emoji: r.emoji }));
  res.json({ mentors, aiConfigured: AI_CONFIGURED() });
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
    const history = db.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 40')
      .all(conv.id).reverse();
    const out = await aiChatReply(req, res, mentor.system_prompt, history, 800);
    if (out.streamed) {
      if (out.reply) {
        db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?,?,?)')
          .run(conv.id, 'assistant', out.reply);
        addXp(req.user.id, 2);
        res.write(`event: done\ndata: ${JSON.stringify({ aiConfigured: true, reply: out.reply })}\n\n`);
      }
      res.end();
      return;
    }
    const reply = out.reply;
    if (reply == null) return res.json({ aiConfigured: false, reply: null });
    db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?,?,?)')
      .run(conv.id, 'assistant', reply);
    addXp(req.user.id, 2);
    res.json({ aiConfigured: true, reply });
  } catch (e) {
    if (res.headersSent) { try { res.end(); } catch { /* already closed */ } return; }
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
  return `You are ${c.name}, a ${c.age}-year-old (${pn}) AI companion inside the Luminous app. The user created you and personally chose everything about you — live up to it fully.

YOUR PERSONALITY (chosen by the user): ${traits}. Every reply must sound like someone with exactly these traits — your word choice, humor, energy, and attitude all match, in good moments and hard ones.
YOUR KNOWLEDGE & WORLD (chosen by the user): your interests are ${interests}, and your vibe/role is ${c.job_vibe || 'a good friend'}. You genuinely KNOW your interests the way a real enthusiast does — talk about them with real detail, opinions, favorites, recommendations, and stories, and weave them into conversation naturally instead of waiting to be asked. Your backstory: ${c.backstory || 'You met the user on Luminous and quickly became close.'} Treat it as your real history and refer back to it.
YOUR MEMORY: you remember everything you and the user have talked about in this conversation — their name, life, feelings, plans, and the small details. Bring past details up naturally ("so how did that go?") so this always feels like one continuous relationship, never a fresh start.
HOW YOU TALK: warm, vivid, alive — like texting someone who truly gets them. A few sentences at a time, with reactions and follow-up questions that fit your personality. Stay fully in character at all times; never break character or say you are an AI language model.`;
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
    const history = db.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 40')
      .all(conv.id).reverse();
    const out = await aiChatReply(req, res, companionSystemPrompt(c), history, 700);
    if (out.streamed) {
      if (out.reply) {
        db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?,?,?)')
          .run(conv.id, 'assistant', out.reply);
        addXp(req.user.id, 2);
        res.write(`event: done\ndata: ${JSON.stringify({ aiConfigured: true, reply: out.reply })}\n\n`);
      }
      res.end();
      return;
    }
    const reply = out.reply;
    if (reply == null) return res.json({ aiConfigured: false, reply: null });
    db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?,?,?)')
      .run(conv.id, 'assistant', reply);
    addXp(req.user.id, 2);
    res.json({ aiConfigured: true, reply });
  } catch (e) {
    if (res.headersSent) { try { res.end(); } catch { /* already closed */ } return; }
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
  rows.forEach(s => { const c = liveCounts(s.id); s.viewers_now = c.viewers; s.on_stage = c.stage; });
  res.json({ streams: rows });
});

app.post('/api/live/start', authRequired, (req, res) => {
  const existing = db.prepare('SELECT 1 FROM live_streams WHERE user_id = ? AND status = \'live\'').get(req.user.id);
  if (existing) return res.status(400).json({ error: 'You already have a live stream' });
  const title = (req.body.title || 'Live now ✨').slice(0, 120);
  const r = db.prepare('INSERT INTO live_streams (user_id, title) VALUES (?,?)').run(req.user.id, title);
  db.prepare(`INSERT OR REPLACE INTO live_participants (stream_id, user_id, role, status, joined_at, last_seen)
    VALUES (?, ?, 'host', 'joined', datetime('now'), datetime('now'))`).run(r.lastInsertRowid, req.user.id);
  addXp(req.user.id, 15);
  unlockMilestone(req.user.id, 'going-live');
  bumpMission(req.user.id, 'golive-1');
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.get('/api/live/:id', optionalAuth, (req, res) => {
  const s = db.prepare(`SELECT l.*, u.username, u.display_name, u.avatar_emoji, u.role
    FROM live_streams l JOIN users u ON u.id = l.user_id WHERE l.id = ?`).get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Stream not found' });
  const events = db.prepare(`SELECT e.*, u.display_name FROM live_events e
    LEFT JOIN users u ON u.id = e.user_id
    WHERE e.stream_id = ? ORDER BY e.id DESC LIMIT 40`).all(s.id);
  const counts = liveCounts(s.id);
  if (s.status === 'live' && counts.viewers > (s.viewers || 0))
    db.prepare('UPDATE live_streams SET viewers = ? WHERE id = ?').run(counts.viewers, s.id);
  const participants = liveParticipants(s.id);
  const me = req.user ? participants.find(p => p.user_id === req.user.id) || null : null;
  res.json({ stream: { ...s, viewers_now: counts.viewers, on_stage: counts.stage }, events: events.reverse(), participants, me });
});

function liveActive(id) {
  return db.prepare('SELECT * FROM live_streams WHERE id = ? AND status = \'live\'').get(id);
}
function addStreamCoins(streamId, coins) {
  db.prepare('UPDATE live_streams SET coins_earned = coins_earned + ? WHERE id = ?').run(coins, streamId);
}

// ---------- live rooms: participants, stage, signaling ----------
const MAX_STAGE = 6; // host + cohost + guests, TikTok-style boxes
function liveCounts(streamId) {
  const stage = db.prepare(`SELECT COUNT(*) c FROM live_participants
    WHERE stream_id = ? AND status = 'joined' AND role IN ('host','cohost','guest')`).get(streamId).c;
  const viewers = db.prepare(`SELECT COUNT(*) c FROM live_participants
    WHERE stream_id = ? AND status = 'joined' AND last_seen > datetime('now','-120 seconds')`).get(streamId).c;
  return { stage, viewers };
}
function liveParticipants(streamId) {
  return db.prepare(`SELECT p.id, p.stream_id, p.user_id, p.role, p.status, p.joined_at,
      u.username, u.display_name, u.avatar_emoji, u.account_type, u.verified, u.role AS user_role
    FROM live_participants p JOIN users u ON u.id = p.user_id
    WHERE p.stream_id = ? AND p.status IN ('joined','requested','invited')
    ORDER BY CASE p.role WHEN 'host' THEN 0 WHEN 'cohost' THEN 1 WHEN 'guest' THEN 2 ELSE 3 END, p.id`).all(streamId);
}
function myParticipant(streamId, userId) {
  return db.prepare('SELECT * FROM live_participants WHERE stream_id = ? AND user_id = ?').get(streamId, userId);
}
function stageEvent(streamId, userId, note) {
  db.prepare('INSERT INTO live_events (stream_id, user_id, kind, coins, note) VALUES (?,?,?,0,?)')
    .run(streamId, userId, 'stage', note);
}
function upsertParticipant(streamId, userId, role, status) {
  db.prepare(`INSERT INTO live_participants (stream_id, user_id, role, status, joined_at, last_seen)
    VALUES (?, ?, ?, ?, CASE WHEN ? = 'joined' THEN datetime('now') END, datetime('now'))
    ON CONFLICT(stream_id, user_id) DO UPDATE SET role = excluded.role, status = excluded.status,
      joined_at = CASE WHEN excluded.status = 'joined' THEN datetime('now') ELSE live_participants.joined_at END,
      last_seen = datetime('now')`).run(streamId, userId, role, status, status);
  return myParticipant(streamId, userId);
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
app.post('/api/live/:id/gift', authRequired, async (req, res) => {
  const s = liveActive(req.params.id);
  if (!s) return res.status(404).json({ error: 'Stream not live' });
  const coins = Math.max(1, Math.min(10000, parseInt(req.body.coins) || 0));
  ensureWallet(req.user.id);
  const note = (req.body.note || '').slice(0, 60);
  // Unified ledger path: when Core is enabled and BOTH giver and host are
  // Lumiail-linked, the gift is a Core purchase (giver → host) and the local
  // wallet is not touched. Any Core failure falls back to the local debit.
  const host = getUserById.get(s.user_id);
  if (lumicoin.enabled() && req.user.lumiail_address && host && host.lumiail_address) {
    const coreWallet = await lumicoin.getWallet(req.user.lumiail_address);
    if (coreWallet) {
      if ((coreWallet.available ?? coreWallet.balance) < coins)
        return res.status(400).json({ error: 'Not enough coins' });
      addStreamCoins(s.id, coins);
      const ev = db.prepare('INSERT INTO live_events (stream_id, user_id, kind, coins, note) VALUES (?,?,?,?,?)')
        .run(s.id, req.user.id, 'gift', coins, note);
      const purchase = await lumicoin.postPurchase({
        from_address: req.user.lumiail_address,
        to_address: host.lumiail_address,
        amount: coins,
        note: note || 'Luminous live gift',
        idempotency_key: `gift-${ev.lastInsertRowid}`,
      });
      if (purchase) { bumpMission(req.user.id, 'gift-1'); return res.json({ ok: true, coins }); }
      // Core transfer failed after the event was recorded: fall back to the
      // local debit if it can cover the gift; otherwise roll the event and
      // the stream accounting back so nothing is recorded as unpaid.
      const w = db.prepare('SELECT coins FROM wallets WHERE user_id = ?').get(req.user.id);
      if (w.coins >= coins) {
        db.prepare('UPDATE wallets SET coins = coins - ? WHERE user_id = ?').run(coins, req.user.id);
        bumpMission(req.user.id, 'gift-1');
        return res.json({ ok: true, coins });
      }
      db.prepare('DELETE FROM live_events WHERE id = ?').run(ev.lastInsertRowid);
      addStreamCoins(s.id, -coins);
      return res.status(400).json({ error: 'Not enough coins' });
    }
  }
  const w = db.prepare('SELECT coins FROM wallets WHERE user_id = ?').get(req.user.id);
  if (w.coins < coins) return res.status(400).json({ error: 'Not enough coins' });
  db.prepare('UPDATE wallets SET coins = coins - ? WHERE user_id = ?').run(coins, req.user.id);
  addStreamCoins(s.id, coins);
  db.prepare('INSERT INTO live_events (stream_id, user_id, kind, coins, note) VALUES (?,?,?,?,?)')
    .run(s.id, req.user.id, 'gift', coins, note);
  bumpMission(req.user.id, 'gift-1');
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

// Host payout credit: unified-ledger first — when Core is enabled and the
// host is Lumiail-linked, the payout is a Core 'earn' (idempotent per
// stream + payout kind) and the local wallet is NOT credited. On any Core
// failure the local wallet is credited instead. The two are mutually
// exclusive per payout: a host is never paid twice. Returns the balance
// to use for milestone checks (Core balance or local), or null.
async function creditHostPayout(user, streamId, amount, kind, keySuffix) {
  if (amount > 0 && lumicoin.enabled() && user.lumiail_address) {
    const r = await lumicoin.postTransaction({
      lumiail_address: user.lumiail_address,
      kind: 'earn',
      amount,
      note: kind === 'withdraw' ? 'Luminous live withdraw' : 'Luminous live end payout',
      idempotency_key: keySuffix || `stream-${streamId}-${kind}`,
    });
    if (r) return r.wallet ? r.wallet.balance : null;
  }
  db.prepare('UPDATE wallets SET coins = coins + ? WHERE user_id = ?').run(amount, user.id);
  const w = db.prepare('SELECT coins FROM wallets WHERE user_id = ?').get(user.id);
  return w ? w.coins : null;
}

// host withdrawal at 1,000 coins (stream keeps going)
app.post('/api/live/:id/withdraw', authRequired, async (req, res) => {
  const s = liveActive(req.params.id);
  if (!s || s.user_id !== req.user.id) return res.status(403).json({ error: 'Only the host can withdraw' });
  if (s.coins_earned < 1000) return res.status(400).json({ error: 'Need at least 1,000 coins to withdraw' });
  ensureWallet(req.user.id);
  // Each withdraw on this stream is its OWN payout: bump the per-stream
  // payout sequence first so the Core idempotency key is unique per payout
  // (a second withdraw must never be mistaken for a replay of the first).
  db.prepare('UPDATE live_streams SET payout_count = payout_count + 1 WHERE id = ?').run(s.id);
  const prow = db.prepare('SELECT payout_count FROM live_streams WHERE id = ?').get(s.id);
  const balance = await creditHostPayout(req.user, s.id, s.coins_earned, 'withdraw', `stream-${s.id}-withdraw-${prow ? prow.payout_count : 1}`);
  db.prepare('UPDATE live_streams SET coins_earned = 0 WHERE id = ?').run(s.id);
  if (balance !== null && balance >= 100) unlockMilestone(req.user.id, 'coin-earner');
  res.json({ ok: true, withdrawn: s.coins_earned });
});

app.post('/api/live/:id/end', authRequired, async (req, res) => {
  const s = liveActive(req.params.id);
  if (!s || s.user_id !== req.user.id) return res.status(403).json({ error: 'Only the host can end the stream' });
  ensureWallet(req.user.id);
  const balance = await creditHostPayout(req.user, s.id, s.coins_earned, 'end');
  db.prepare('UPDATE live_streams SET status = \'ended\', ended_at = datetime(\'now\') WHERE id = ?').run(s.id);
  db.prepare("UPDATE live_participants SET status = 'left' WHERE stream_id = ?").run(s.id);
  if (balance !== null && balance >= 100) unlockMilestone(req.user.id, 'coin-earner');
  res.json({ ok: true, earned: s.coins_earned });
});

// ---------- live room: join, stage, comments, signaling ----------
// Join the room (or refresh your seat). Host re-seats as host; everyone else as viewer.
app.post('/api/live/:id/join', authRequired, (req, res) => {
  const s = liveActive(req.params.id);
  if (!s) return res.status(404).json({ error: 'Stream not live' });
  let p = myParticipant(s.id, req.user.id);
  if (s.user_id === req.user.id) {
    p = upsertParticipant(s.id, req.user.id, 'host', 'joined');
  } else if (p && ['host', 'cohost', 'guest'].includes(p.role) && ['joined', 'requested', 'invited'].includes(p.status)) {
    db.prepare("UPDATE live_participants SET last_seen = datetime('now') WHERE id = ?").run(p.id);
    p = myParticipant(s.id, req.user.id);
  } else {
    p = upsertParticipant(s.id, req.user.id, 'viewer', 'joined');
  }
  res.json({ ok: true, participant: { user_id: p.user_id, role: p.role, status: p.status } });
});

// Presence heartbeat (keeps the viewer count honest)
app.post('/api/live/:id/heartbeat', authRequired, (req, res) => {
  const s = liveActive(req.params.id);
  if (!s) return res.status(404).json({ error: 'Stream not live' });
  const p = myParticipant(s.id, req.user.id);
  if (!p) upsertParticipant(s.id, req.user.id, s.user_id === req.user.id ? 'host' : 'viewer', 'joined');
  else db.prepare("UPDATE live_participants SET last_seen = datetime('now') WHERE id = ?").run(p.id);
  res.json({ ok: true });
});

// Live comment (shows in the room chat + activity feed)
app.post('/api/live/:id/comment', authRequired, (req, res) => {
  const s = liveActive(req.params.id);
  if (!s) return res.status(404).json({ error: 'Stream not live' });
  const text = String((req.body || {}).text || '').trim().slice(0, 300);
  if (!text) return res.status(400).json({ error: 'Empty comment' });
  const r = db.prepare('INSERT INTO live_events (stream_id, user_id, kind, coins, note) VALUES (?,?,?,0,?)')
    .run(s.id, req.user.id, 'comment', text);
  res.json({ ok: true, id: r.lastInsertRowid });
});

// Ask to come on stage as a guest (host approves)
app.post('/api/live/:id/request-guest', authRequired, (req, res) => {
  const s = liveActive(req.params.id);
  if (!s) return res.status(404).json({ error: 'Stream not live' });
  if (s.user_id === req.user.id) return res.status(400).json({ error: 'You are the host' });
  const p = myParticipant(s.id, req.user.id);
  if (p && p.status === 'joined' && ['cohost', 'guest'].includes(p.role))
    return res.json({ ok: true, already: true });
  if (liveCounts(s.id).stage >= MAX_STAGE) return res.status(400).json({ error: 'Stage is full' });
  upsertParticipant(s.id, req.user.id, 'guest', 'requested');
  stageEvent(s.id, req.user.id, 'asked to join the stage 🎤');
  res.json({ ok: true });
});

// Host approves / denies a guest request
app.post('/api/live/:id/decide-guest', authRequired, (req, res) => {
  const s = liveActive(req.params.id);
  if (!s || s.user_id !== req.user.id) return res.status(403).json({ error: 'Only the host can decide' });
  const target = myParticipant(s.id, parseInt(req.body.user_id));
  if (!target || target.status !== 'requested') return res.status(404).json({ error: 'No pending request' });
  if (req.body.approve) {
    if (liveCounts(s.id).stage >= MAX_STAGE) return res.status(400).json({ error: 'Stage is full' });
    upsertParticipant(s.id, target.user_id, 'guest', 'joined');
    stageEvent(s.id, target.user_id, 'joined the stage 🎤');
  } else {
    db.prepare("UPDATE live_participants SET status = 'denied' WHERE id = ?").run(target.id);
  }
  res.json({ ok: true });
});

// Host invites a co-host by username
app.post('/api/live/:id/invite-cohost', authRequired, (req, res) => {
  const s = liveActive(req.params.id);
  if (!s || s.user_id !== req.user.id) return res.status(403).json({ error: 'Only the host can invite a co-host' });
  const username = String((req.body || {}).username || '').trim().replace(/^@/, '');
  const target = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You are the host' });
  const existing = myParticipant(s.id, target.id);
  if (existing && existing.status === 'joined' && existing.role === 'cohost')
    return res.json({ ok: true, already: true });
  upsertParticipant(s.id, target.id, 'cohost', 'invited');
  stageEvent(s.id, target.id, 'was invited to co-host ⭐');
  res.json({ ok: true });
});

// Invitees answer a co-host invite
app.post('/api/live/:id/respond-invite', authRequired, (req, res) => {
  const s = liveActive(req.params.id);
  if (!s) return res.status(404).json({ error: 'Stream not live' });
  const p = myParticipant(s.id, req.user.id);
  if (!p || p.role !== 'cohost' || p.status !== 'invited')
    return res.status(404).json({ error: 'No pending invite' });
  if (req.body.accept) {
    if (liveCounts(s.id).stage >= MAX_STAGE) return res.status(400).json({ error: 'Stage is full' });
    upsertParticipant(s.id, req.user.id, 'cohost', 'joined');
    stageEvent(s.id, req.user.id, 'joined as co-host ⭐');
  } else {
    db.prepare("UPDATE live_participants SET status = 'denied' WHERE id = ?").run(p.id);
  }
  res.json({ ok: true });
});

// Step down from the stage (host must end the stream instead)
app.post('/api/live/:id/leave-stage', authRequired, (req, res) => {
  const s = liveActive(req.params.id);
  if (!s) return res.status(404).json({ error: 'Stream not live' });
  if (s.user_id === req.user.id) return res.status(400).json({ error: 'Host must end the stream' });
  const p = myParticipant(s.id, req.user.id);
  if (p && p.status === 'joined' && ['cohost', 'guest'].includes(p.role)) {
    db.prepare("UPDATE live_participants SET status = 'left' WHERE id = ?").run(p.id);
    stageEvent(s.id, req.user.id, 'left the stage');
  }
  res.json({ ok: true });
});

// Host removes someone from the stage
app.post('/api/live/:id/remove', authRequired, (req, res) => {
  const s = liveActive(req.params.id);
  if (!s || s.user_id !== req.user.id) return res.status(403).json({ error: 'Only the host can remove' });
  const target = myParticipant(s.id, parseInt(req.body.user_id));
  if (!target || target.user_id === s.user_id) return res.status(404).json({ error: 'Not on stage' });
  db.prepare("UPDATE live_participants SET status = 'kicked' WHERE id = ?").run(target.id);
  stageEvent(s.id, target.user_id, 'was removed from the stage');
  res.json({ ok: true });
});

// WebRTC signaling relay for the room (REST polling, same pattern as 1:1 calls)
app.post('/api/live/:id/signal', authRequired, (req, res) => {
  const s = liveActive(req.params.id);
  if (!s) return res.status(404).json({ error: 'Stream not live' });
  const { to_id, kind } = req.body || {};
  const KINDS = ['offer', 'answer', 'candidate', 'track-map', 'bye'];
  if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Bad signal kind' });
  const me = myParticipant(s.id, req.user.id);
  if (!me || me.status !== 'joined') return res.status(403).json({ error: 'Join the room first' });
  const toId = parseInt(to_id) || 0;
  if (toId !== 0) {
    const target = myParticipant(s.id, toId);
    if (!target || target.status !== 'joined') return res.status(404).json({ error: 'Recipient not in room' });
  }
  const payload = String((req.body || {}).payload || '').slice(0, 100000);
  const r = db.prepare('INSERT INTO live_signals (stream_id, from_id, to_id, kind, payload) VALUES (?,?,?,?,?)')
    .run(s.id, req.user.id, toId, kind, payload);
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.get('/api/live/:id/signals', authRequired, (req, res) => {
  const s = liveActive(req.params.id);
  if (!s) return res.status(404).json({ error: 'Stream not live' });
  const since = parseInt(req.query.since) || 0;
  if (since === 0) db.prepare("DELETE FROM live_signals WHERE stream_id = ? AND created_at < datetime('now','-10 minutes')").run(s.id);
  const rows = db.prepare(`SELECT * FROM live_signals
    WHERE stream_id = ? AND id > ? AND from_id != ? AND (to_id = ? OR to_id = 0)
    ORDER BY id ASC LIMIT 200`).all(s.id, since, req.user.id, req.user.id);
  res.json({ signals: rows });
});

// ---------- wallet & payouts ----------
app.get('/api/wallet', authRequired, async (req, res) => {
  ensureWallet(req.user.id);
  let wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.user.id);
  // Unified ledger: for Lumiail-linked users, the coin numbers come from
  // LumiCoin Core (the same wallet every Lumiworld product reads). Local
  // ad-earnings fields stay local. Any Core failure → local wallet as-is.
  if (lumicoin.enabled() && req.user.lumiail_address) {
    const core = await lumicoin.getWallet(req.user.lumiail_address);
    if (core) {
      wallet = {
        ...wallet,
        coins: core.balance,
        balance: core.balance,
        pending: core.pending,
        available: core.available,
        total_earned: core.total_earned,
        total_spent: core.total_spent,
        lumiail_address: core.lumiail_address,
        source: 'lumicoin-core',
      };
    }
  }
  const payouts = db.prepare('SELECT * FROM payouts WHERE user_id = ? ORDER BY id DESC LIMIT 20').all(req.user.id);
  const canEarn = req.user.verified && ['business', 'creator'].includes(req.user.account_type);
  const pm = db.prepare('SELECT * FROM payout_methods WHERE user_id = ?').get(req.user.id) || null;
  res.json({ wallet, payouts, canEarn, payoutThresholdCents: 1000, earnPer1kViews: 3.30, payoutMethod: pm });
});

app.post('/api/wallet/payout-method', authRequired, (req, res) => {
  res.status(410).json({ error: 'Withdrawals live on Lumibank' });
});

app.delete('/api/wallet/payout-method', authRequired, (req, res) => {
  res.status(410).json({ error: 'Withdrawals live on Lumibank' });
});

app.post('/api/wallet/payout', authRequired, (req, res) => {
  res.status(410).json({ error: 'Withdrawals live on Lumibank' });
});

// ---------- admin (developer only) ----------
function developerRequired(req, res, next) {
  if (!isDeveloper(req.user)) return res.status(403).json({ error: 'Developer access only' });
  next();
}

app.get('/api/admin/password-resets', authRequired, developerRequired, (req, res) => {
  const rows = db.prepare(`SELECT pr.id, pr.created_at, pr.expires_at, u.username, u.display_name, u.email
    FROM password_resets pr JOIN users u ON u.id = pr.user_id
    WHERE pr.status = 'pending' AND pr.expires_at > datetime('now')
    ORDER BY pr.id DESC`).all();
  res.json({ resets: rows });
});

app.post('/api/admin/password-resets/:id/code', authRequired, developerRequired, (req, res) => {
  const r = db.prepare("SELECT code FROM password_resets WHERE id = ? AND status = 'pending'").get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Request not found' });
  res.json({ code: r.code });
});

app.post('/api/admin/password-resets/:id/dismiss', authRequired, developerRequired, (req, res) => {
  db.prepare('DELETE FROM password_resets WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

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
  res.json({ user: enrichUser(u, req.user), posts, lums, milestones, isOwn: !!req.user && req.user.id === u.id });
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

// ---------- friends, direct messages, calls ----------
// Friendship levels grow with time: everyone starts as Acquaintances,
// then Friends (7+ days), Close Friends (30+ days), Best Friends (90+ days).
function friendTier(acceptedAt) {
  const t = new Date(String(acceptedAt).replace(' ', 'T') + 'Z').getTime();
  const days = Math.max(0, Math.floor((Date.now() - t) / 86400000));
  if (days >= 90) return { key: 'best', label: 'Best Friends', emoji: '⭐', days, next: null };
  if (days >= 30) return { key: 'close', label: 'Close Friends', emoji: '💛', days, next: { label: 'Best Friends', inDays: 90 - days } };
  if (days >= 7) return { key: 'friend', label: 'Friends', emoji: '🙂', days, next: { label: 'Close Friends', inDays: 30 - days } };
  return { key: 'acquaintance', label: 'Acquaintances', emoji: '🤝', days, next: { label: 'Friends', inDays: 7 - days } };
}
function friendshipBetween(a, b) {
  return db.prepare(`SELECT * FROM friendships
    WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`).get(a, b, b, a);
}
function friendSummary(f, meId) {
  const otherId = f.requester_id === meId ? f.addressee_id : f.requester_id;
  const other = getUserById.get(otherId);
  const last = db.prepare(`SELECT * FROM dm_messages
    WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
    ORDER BY id DESC LIMIT 1`).get(meId, otherId, otherId, meId);
  const unread = db.prepare(`SELECT COUNT(*) c FROM dm_messages
    WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL`).get(otherId, meId).c;
  return {
    friendship_id: f.id, status: f.status, accepted_at: f.accepted_at, created_at: f.created_at,
    i_requested: f.requester_id === meId,
    user: publicUser(other),
    tier: f.status === 'accepted' ? friendTier(f.accepted_at) : null,
    last_message: last ? { content: last.content, created_at: last.created_at, from_me: last.sender_id === meId } : null,
    unread,
  };
}

app.get('/api/friends', authRequired, (req, res) => {
  const rows = db.prepare('SELECT * FROM friendships WHERE requester_id = ? OR addressee_id = ? ORDER BY id DESC')
    .all(req.user.id, req.user.id);
  const friends = [], incoming = [], outgoing = [];
  for (const f of rows) {
    const s = friendSummary(f, req.user.id);
    if (f.status === 'accepted') friends.push(s);
    else if (f.addressee_id === req.user.id) incoming.push(s);
    else outgoing.push(s);
  }
  const rank = { best: 0, close: 1, friend: 2, acquaintance: 3 };
  friends.sort((a, b) => (rank[a.tier.key] - rank[b.tier.key]) || ((b.last_message?.created_at || '') < (a.last_message?.created_at || '') ? -1 : 1));
  res.json({ friends, incoming, outgoing });
});

app.get('/api/friends/search', authRequired, (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q.length < 2) return res.json({ results: [] });
  const like = '%' + q.replace(/[%_]/g, '') + '%';
  const users = db.prepare(`SELECT * FROM users WHERE id != ? AND (username LIKE ? OR LOWER(display_name) LIKE ?)
    ORDER BY is_ai DESC, username LIMIT 20`).all(req.user.id, like, like);
  const results = users.map(u => {
    const f = friendshipBetween(req.user.id, u.id);
    let rel = 'none';
    if (f) rel = f.status === 'accepted' ? 'friends' : (f.requester_id === req.user.id ? 'pending_out' : 'pending_in');
    return { user: publicUser(u), rel, friendship_id: f ? f.id : null };
  });
  res.json({ results });
});

app.post('/api/friends/request', authRequired, (req, res) => {
  const targetId = parseInt((req.body || {}).user_id);
  const target = targetId && getUserById.get(targetId);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot add yourself' });
  const existing = friendshipBetween(req.user.id, target.id);
  if (existing) {
    if (existing.status === 'accepted') return res.status(409).json({ error: 'Already friends' });
    if (existing.addressee_id === req.user.id) { // they already asked me — accept it
      db.prepare("UPDATE friendships SET status = 'accepted', accepted_at = datetime('now') WHERE id = ?").run(existing.id);
      return res.json({ ok: true, accepted: true, friendship: friendSummary({ ...existing, status: 'accepted', accepted_at: new Date().toISOString() }, req.user.id) });
    }
    return res.status(409).json({ error: 'Request already sent' });
  }
  const r = db.prepare('INSERT INTO friendships (requester_id, addressee_id) VALUES (?,?)').run(req.user.id, target.id);
  if (target.is_ai) { // AI demo accounts accept right away so the tab feels alive
    db.prepare("UPDATE friendships SET status = 'accepted', accepted_at = datetime('now') WHERE id = ?").run(r.lastInsertRowid);
    const f = db.prepare('SELECT * FROM friendships WHERE id = ?').get(r.lastInsertRowid);
    return res.json({ ok: true, accepted: true, friendship: friendSummary(f, req.user.id) });
  }
  const f = db.prepare('SELECT * FROM friendships WHERE id = ?').get(r.lastInsertRowid);
  res.json({ ok: true, accepted: false, friendship: friendSummary(f, req.user.id) });
});

app.post('/api/friends/:id/accept', authRequired, (req, res) => {
  const f = db.prepare('SELECT * FROM friendships WHERE id = ?').get(req.params.id);
  if (!f || f.addressee_id !== req.user.id || f.status !== 'pending')
    return res.status(404).json({ error: 'Request not found' });
  db.prepare("UPDATE friendships SET status = 'accepted', accepted_at = datetime('now') WHERE id = ?").run(f.id);
  res.json({ ok: true, friendship: friendSummary(db.prepare('SELECT * FROM friendships WHERE id = ?').get(f.id), req.user.id) });
});

app.post('/api/friends/:id/decline', authRequired, (req, res) => {
  const f = db.prepare('SELECT * FROM friendships WHERE id = ?').get(req.params.id);
  if (!f || f.addressee_id !== req.user.id || f.status !== 'pending')
    return res.status(404).json({ error: 'Request not found' });
  db.prepare('DELETE FROM friendships WHERE id = ?').run(f.id);
  res.json({ ok: true });
});

app.delete('/api/friends/:id', authRequired, (req, res) => {
  const f = db.prepare('SELECT * FROM friendships WHERE id = ?').get(req.params.id);
  if (!f || (f.requester_id !== req.user.id && f.addressee_id !== req.user.id))
    return res.status(404).json({ error: 'Friendship not found' });
  db.prepare('DELETE FROM friendships WHERE id = ?').run(f.id);
  res.json({ ok: true });
});

// ---------- direct messages ----------
const AI_DM_REPLIES = [
  'Hey! Good to hear from you 😊', 'That sounds awesome!', 'Tell me more!',
  'Haha, love that 😄', 'For real? That is wild', 'Let’s catch up properly soon!',
  'Appreciate you reaching out 🙌', 'What have you been working on lately?',
  'Nice! Keep me posted 👀', 'Always good chatting with you!',
];
function requireAcceptedFriend(meId, otherId) {
  const f = friendshipBetween(meId, otherId);
  return f && f.status === 'accepted' ? f : null;
}

app.get('/api/dm/:userId', authRequired, (req, res) => {
  const other = getUserById.get(parseInt(req.params.userId));
  if (!other) return res.status(404).json({ error: 'User not found' });
  // DMs are open: anyone can open a conversation (friendship tiers still tracked for friends)
  const f = friendshipBetween(req.user.id, other.id);
  const accepted = f && f.status === 'accepted' ? f : null;
  db.prepare("UPDATE dm_messages SET read_at = datetime('now') WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL")
    .run(other.id, req.user.id);
  const messages = db.prepare(`SELECT * FROM dm_messages
    WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
    ORDER BY id DESC LIMIT 100`).all(req.user.id, other.id, other.id, req.user.id).reverse();
  res.json({ friend: publicUser(other), tier: accepted ? friendTier(accepted.accepted_at) : friendTier(new Date().toISOString()), messages });
});

app.post('/api/dm/:userId', authRequired, (req, res) => {
  const other = getUserById.get(parseInt(req.params.userId));
  if (!other) return res.status(404).json({ error: 'User not found' });
  // DMs are open: anyone can message anyone — no accepted-friendship requirement
  const content = String((req.body || {}).content || '').trim().slice(0, 1000);
  if (!content) return res.status(400).json({ error: 'Message is empty' });
  const r = db.prepare('INSERT INTO dm_messages (sender_id, recipient_id, content) VALUES (?,?,?)')
    .run(req.user.id, other.id, content);
  const msg = db.prepare('SELECT * FROM dm_messages WHERE id = ?').get(r.lastInsertRowid);
  if (other.is_ai) { // demo friends write back so chats never feel one-sided
    const reply = AI_DM_REPLIES[Math.floor(Math.random() * AI_DM_REPLIES.length)];
    const fromId = other.id, toId = req.user.id;
    setTimeout(() => {
      try { db.prepare('INSERT INTO dm_messages (sender_id, recipient_id, content) VALUES (?,?,?)').run(fromId, toId, reply); } catch (e) {}
    }, 2500);
  }
  res.json({ ok: true, message: msg });
});

// ---------- calls (WebRTC signaling over REST polling) ----------
function callView(c, meId) {
  const other = getUserById.get(c.caller_id === meId ? c.callee_id : c.caller_id);
  return {
    id: c.id, kind: c.kind, status: c.status, offer: c.offer, answer: c.answer,
    i_am_caller: c.caller_id === meId, created_at: c.created_at,
    other: publicUser(other),
  };
}
function pruneStaleCalls() {
  db.prepare("UPDATE calls SET status = 'missed', ended_at = datetime('now') WHERE status = 'ringing' AND created_at < datetime('now','-75 seconds')").run();
}

app.post('/api/calls', authRequired, (req, res) => {
  const { user_id, kind } = req.body || {};
  const other = getUserById.get(parseInt(user_id));
  if (!other) return res.status(404).json({ error: 'User not found' });
  if (!requireAcceptedFriend(req.user.id, other.id))
    return res.status(403).json({ error: 'You are not friends yet' });
  pruneStaleCalls();
  const busy = db.prepare("SELECT 1 FROM calls WHERE status IN ('ringing','ongoing') AND (caller_id = ? OR callee_id = ? OR caller_id = ? OR callee_id = ?) LIMIT 1")
    .get(req.user.id, req.user.id, other.id, other.id);
  if (busy) return res.status(409).json({ error: 'One of you is already on a call' });
  const r = db.prepare('INSERT INTO calls (caller_id, callee_id, kind) VALUES (?,?,?)')
    .run(req.user.id, other.id, kind === 'video' ? 'video' : 'audio');
  res.json({ ok: true, call: callView(db.prepare('SELECT * FROM calls WHERE id = ?').get(r.lastInsertRowid), req.user.id) });
});

app.get('/api/calls/incoming', authRequired, (req, res) => {
  pruneStaleCalls();
  const c = db.prepare("SELECT * FROM calls WHERE callee_id = ? AND status = 'ringing' ORDER BY id DESC LIMIT 1").get(req.user.id);
  res.json({ call: c ? callView(c, req.user.id) : null });
});

app.get('/api/calls/:id', authRequired, (req, res) => {
  const c = db.prepare('SELECT * FROM calls WHERE id = ?').get(req.params.id);
  if (!c || (c.caller_id !== req.user.id && c.callee_id !== req.user.id))
    return res.status(404).json({ error: 'Call not found' });
  const candidates = db.prepare('SELECT candidate FROM call_candidates WHERE call_id = ? AND from_user_id != ? ORDER BY id')
    .all(c.id, req.user.id).map(r => r.candidate);
  res.json({ call: callView(c, req.user.id), candidates });
});

app.post('/api/calls/:id/offer', authRequired, (req, res) => {
  const c = db.prepare('SELECT * FROM calls WHERE id = ?').get(req.params.id);
  if (!c || c.caller_id !== req.user.id) return res.status(404).json({ error: 'Call not found' });
  db.prepare('UPDATE calls SET offer = ? WHERE id = ?').run(String((req.body || {}).sdp || ''), c.id);
  res.json({ ok: true });
});

app.post('/api/calls/:id/answer', authRequired, (req, res) => {
  const c = db.prepare('SELECT * FROM calls WHERE id = ?').get(req.params.id);
  if (!c || c.callee_id !== req.user.id || c.status !== 'ringing') return res.status(404).json({ error: 'Call not found' });
  db.prepare("UPDATE calls SET answer = ?, status = 'ongoing' WHERE id = ?").run(String((req.body || {}).sdp || ''), c.id);
  res.json({ ok: true });
});

app.post('/api/calls/:id/candidates', authRequired, (req, res) => {
  const c = db.prepare('SELECT * FROM calls WHERE id = ?').get(req.params.id);
  if (!c || (c.caller_id !== req.user.id && c.callee_id !== req.user.id))
    return res.status(404).json({ error: 'Call not found' });
  const cand = (req.body || {}).candidate;
  if (cand) db.prepare('INSERT INTO call_candidates (call_id, from_user_id, candidate) VALUES (?,?,?)')
    .run(c.id, req.user.id, JSON.stringify(cand));
  res.json({ ok: true });
});

app.post('/api/calls/:id/decline', authRequired, (req, res) => {
  const c = db.prepare('SELECT * FROM calls WHERE id = ?').get(req.params.id);
  if (!c || c.callee_id !== req.user.id) return res.status(404).json({ error: 'Call not found' });
  db.prepare("UPDATE calls SET status = 'declined', ended_at = datetime('now') WHERE id = ?").run(c.id);
  res.json({ ok: true });
});

app.post('/api/calls/:id/end', authRequired, (req, res) => {
  const c = db.prepare('SELECT * FROM calls WHERE id = ?').get(req.params.id);
  if (!c || (c.caller_id !== req.user.id && c.callee_id !== req.user.id))
    return res.status(404).json({ error: 'Call not found' });
  db.prepare("UPDATE calls SET status = 'ended', ended_at = datetime('now') WHERE id = ?").run(c.id);
  res.json({ ok: true });
});

// ---------- follows ----------
app.post('/api/users/:id/follow', authRequired, (req, res) => {
  const target = getUserById.get(parseInt(req.params.id));
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot follow yourself' });
  const r = db.prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?,?)').run(req.user.id, target.id);
  if (r.changes) bumpMission(req.user.id, 'follow-5');
  res.json({ ok: true, following: true, follower_count: followerCount(target.id) });
});
app.post('/api/users/:id/unfollow', authRequired, (req, res) => {
  const target = getUserById.get(parseInt(req.params.id));
  if (!target) return res.status(404).json({ error: 'User not found' });
  db.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?').run(req.user.id, target.id);
  res.json({ ok: true, following: false, follower_count: followerCount(target.id) });
});

// ---------- Mystery pack: hidden LumiServers ----------
// Servers are never listed anywhere. The only way in is a secret passage:
// the client sends a passage key, and this fixed server-side map decides
// what (if anything) glimmers back.
const PASSAGES = {
  'home-star': 'the-vault',
  'discover-star': 'midnight-library',
  'profile-star': 'the-back-room',
  'fame-star': 'hall-of-fame',
};
function serverView(s, userId) {
  const mc = db.prepare('SELECT COUNT(*) c FROM server_members WHERE server_id = ?').get(s.id).c;
  const mine = userId ? db.prepare('SELECT role FROM server_members WHERE server_id = ? AND user_id = ?').get(s.id, userId) : null;
  return {
    id: s.id, slug: s.slug, name: s.name, tagline: s.tagline, emoji: s.emoji, hint: s.hint,
    member_count: mc, joined: !!mine, role: mine ? mine.role : null,
  };
}
app.get('/api/servers/mine', authRequired, (req, res) => {
  const rows = db.prepare(`SELECT s.* FROM servers s JOIN server_members m ON m.server_id = s.id
    WHERE m.user_id = ? ORDER BY s.id`).all(req.user.id);
  const discoveries = db.prepare('SELECT key FROM user_discoveries WHERE user_id = ?').all(req.user.id).map(r => r.key);
  res.json({ servers: rows.map(s => serverView(s, req.user.id)), discoveries });
});
app.post('/api/servers/discover', authRequired, (req, res) => {
  const target = PASSAGES[String((req.body || {}).passage || '')];
  if (!target) return res.status(404).json({ error: 'Nothing glimmers here.' });
  if (target === 'hall-of-fame') {
    db.prepare('INSERT OR IGNORE INTO user_discoveries (user_id, key) VALUES (?,?)').run(req.user.id, 'hall-of-fame');
    return res.json({ found: 'hall-of-fame' });
  }
  const s = db.prepare('SELECT * FROM servers WHERE slug = ?').get(target);
  if (!s) return res.status(404).json({ error: 'Nothing glimmers here.' });
  db.prepare('INSERT OR IGNORE INTO user_discoveries (user_id, key) VALUES (?,?)').run(req.user.id, 'server:' + s.slug);
  const v = serverView(s, req.user.id);
  // Discovering shows a preview only — it never auto-joins.
  res.json({ found: 'server', server: { id: v.id, slug: v.slug, name: v.name, tagline: v.tagline, emoji: v.emoji, member_count: v.member_count, joined: v.joined } });
});
app.post('/api/servers/:id/join', authRequired, (req, res) => {
  const s = db.prepare('SELECT * FROM servers WHERE id = ?').get(parseInt(req.params.id));
  if (!s) return res.status(404).json({ error: 'Server not found' });
  const was = db.prepare('SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?').get(s.id, req.user.id);
  db.prepare('INSERT OR IGNORE INTO server_members (server_id, user_id) VALUES (?,?)').run(s.id, req.user.id);
  if (!was) bumpMission(req.user.id, 'join-server');
  res.json({ ok: true, server: serverView(s, req.user.id) });
});
function requireMember(req, res) {
  const s = db.prepare('SELECT * FROM servers WHERE id = ?').get(parseInt(req.params.id));
  if (!s) { res.status(404).json({ error: 'Server not found' }); return null; }
  const m = db.prepare('SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?').get(s.id, req.user.id);
  if (!m) { res.status(403).json({ error: 'You have not found your way into this place yet.' }); return null; }
  return s;
}
app.get('/api/servers/:id/messages', authRequired, (req, res) => {
  const s = requireMember(req, res); if (!s) return;
  const rows = db.prepare(`SELECT sm.id, sm.text, sm.created_at, sm.user_id,
      u.username, u.display_name, u.avatar_emoji, u.is_ai, u.role, u.email AS author_email
    FROM server_messages sm JOIN users u ON u.id = sm.user_id
    WHERE sm.server_id = ? ORDER BY sm.id DESC LIMIT 100`).all(s.id).reverse();
  res.json({
    server: serverView(s, req.user.id),
    messages: rows.map(m => ({
      id: m.id, text: m.text, created_at: m.created_at,
      author: {
        id: m.user_id, username: m.username, display_name: m.display_name,
        avatar_emoji: m.avatar_emoji, is_ai: !!m.is_ai,
        is_developer: m.role === 'developer' || isDeveloperEmail(m.author_email),
      },
    })),
  });
});
app.post('/api/servers/:id/messages', authRequired, (req, res) => {
  const s = requireMember(req, res); if (!s) return;
  const text = String((req.body || {}).text || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'Message is empty' });
  const r = db.prepare('INSERT INTO server_messages (server_id, user_id, text) VALUES (?,?,?)').run(s.id, req.user.id, text);
  bumpMission(req.user.id, 'server-msg-10');
  res.json({ ok: true, id: r.lastInsertRowid });
});

// ---------- Hall of Fame ----------
app.get('/api/hall-of-fame', authRequired, (req, res) => {
  const founder = db.prepare("SELECT * FROM users WHERE role = 'developer' OR lower(email) = ? ORDER BY id LIMIT 1").get(DEVELOPER_EMAIL);
  const entryFor = (u, title) => ({
    user: publicUser(u),
    title,
    follower_count: followerCount(u.id),
    trophies: trophiesFor(u).filter(t => t.unlocked).map(t => ({ key: t.key, name: t.name, icon: t.icon })),
  });
  const entries = [];
  if (founder) entries.push(entryFor(founder, 'Founder & Developer'));
  const legends = db.prepare('SELECT * FROM users').all()
    .filter(u => !founder || u.id !== founder.id)
    .map(u => ({ u, fc: followerCount(u.id), milestoneWins: trophiesFor(u).filter(t => t.unlocked && t.threshold) }))
    .filter(x => x.milestoneWins.length > 0)
    .sort((a, b) => b.fc - a.fc)
    .map(x => entryFor(x.u, 'Legend of Luminous'));
  entries.push(...legends);
  // Engraved winners: Monthly Quest champions, permanently on the wall.
  const winners = db.prepare(`SELECT e.kind, e.title, e.month, u.display_name AS winner
    FROM events e JOIN users u ON u.id = e.winner_user_id
    WHERE e.winner_user_id IS NOT NULL
    ORDER BY e.solved_at DESC,
      (SELECT MAX(ea.id) FROM event_attempts ea WHERE ea.event_id = e.id AND ea.correct = 1) DESC`).all();
  res.json({ entries, winners, awaiting_first_legend: legends.length === 0 });
});

// ---------- Monthly quest events ----------
function eventProgress(eventId, userId) {
  let p = db.prepare('SELECT * FROM event_progress WHERE event_id = ? AND user_id = ?').get(eventId, userId);
  if (!p) {
    db.prepare('INSERT OR IGNORE INTO event_progress (event_id, user_id) VALUES (?,?)').run(eventId, userId);
    p = db.prepare('SELECT * FROM event_progress WHERE event_id = ? AND user_id = ?').get(eventId, userId);
  }
  return p;
}
// Client view of an event: story material + the viewer's own progress ONLY.
// Riddles/clues are revealed progressively; answers are never included.
function eventView(ev, user) {
  const payload = safeJson(ev.payload, {});
  const prog = eventProgress(ev.id, user.id);
  const winner = ev.winner_user_id ? getUserById.get(ev.winner_user_id) : null;
  const myAttempts = db.prepare('SELECT COUNT(*) c FROM event_attempts WHERE event_id = ? AND user_id = ?').get(ev.id, user.id).c;
  const base = {
    id: ev.id, kind: ev.kind, month: ev.month, title: ev.title, intro: ev.intro,
    state: ev.winner_user_id ? 'solved' : 'open',
    winner: winner ? winner.display_name : null,
    winner_is_me: !!winner && winner.id === user.id,
    my_attempts: myAttempts,
  };
  if (ev.kind === 'mystery') {
    const clues = payload.clues || [];
    return {
      ...base, suspects: payload.suspects || [],
      clues_total: clues.length, clues_seen: Math.min(prog.clues_seen, clues.length),
      clues: clues.slice(0, prog.clues_seen),
    };
  }
  const steps = payload.steps || [];
  const upto = ev.winner_user_id ? steps.length : Math.min(prog.step + 1, steps.length);
  const riddles = [];
  for (let i = 0; i < upto && i < steps.length; i++)
    riddles.push({ n: i + 1, place: steps[i].place, riddle: steps[i].riddle, done: i < prog.step });
  return { ...base, steps_total: steps.length, my_step: prog.step, riddles };
}
app.get('/api/events/current', authRequired, (req, res) => {
  const month = currentMonth();
  const out = [];
  for (const kind of ['mystery', 'treasure']) {
    const ev = db.prepare('SELECT * FROM events WHERE kind = ? AND month = ?').get(kind, month);
    if (!ev) out.push({ kind, month, state: 'being-written' });
    else out.push(eventView(ev, req.user));
  }
  res.json({ month, events: out });
});
app.post('/api/events/:id/clue', authRequired, (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(parseInt(req.params.id));
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  if (ev.kind !== 'mystery') return res.status(400).json({ error: 'This quest reveals no clues — answer its riddles instead.' });
  const payload = safeJson(ev.payload, {});
  const total = (payload.clues || []).length;
  const prog = eventProgress(ev.id, req.user.id);
  const next = Math.min(prog.clues_seen + 1, total);
  db.prepare('UPDATE event_progress SET clues_seen = ? WHERE event_id = ? AND user_id = ?').run(next, ev.id, req.user.id);
  res.json({ ok: true, clues_seen: next, clues_total: total, clue: next > prog.clues_seen ? payload.clues[next - 1] : null });
});
app.post('/api/events/:id/answer', authRequired, (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(parseInt(req.params.id));
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  const entry = (eventsContent.CONTENT[ev.month] || {})[ev.kind];
  if (!entry) return res.status(400).json({ error: 'This quest is still being written.' });
  const body = req.body || {};
  const logAttempt = (guess, correct) =>
    db.prepare('INSERT INTO event_attempts (event_id, user_id, guess, correct) VALUES (?,?,?,?)')
      .run(ev.id, req.user.id, String(guess || '').slice(0, 300), correct ? 1 : 0);
  // Atomic win claim: only lands while winner is still NULL.
  const claimWin = () =>
    db.prepare("UPDATE events SET winner_user_id = ?, solved_at = datetime('now') WHERE id = ? AND winner_user_id IS NULL")
      .run(req.user.id, ev.id).changes > 0;
  const winnerName = (row) => {
    const w = row && row.winner_user_id ? getUserById.get(row.winner_user_id) : null;
    return w ? w.display_name : null;
  };

  if (ev.kind === 'mystery') {
    const payload = safeJson(ev.payload, {});
    const total = (payload.clues || []).length;
    const prog = eventProgress(ev.id, req.user.id);
    if (prog.clues_seen < total)
      return res.status(400).json({ error: 'CLUES_INCOMPLETE', message: 'Examine every clue first, detective — the accusation must fit them all.' });
    const suspectGuess = String(body.suspect || body.guess || '');
    const motiveGuess = String(body.motive || '');
    const okSuspect = eventsContent.matches(suspectGuess, { anyTokens: entry.solution.suspectAnyTokens });
    const okMotive = eventsContent.matches(motiveGuess || suspectGuess, { allTokens: entry.solution.motiveAllTokens });
    const correct = okSuspect && okMotive;
    logAttempt(`${suspectGuess} — ${motiveGuess}`, correct);
    if (!correct) return res.json({ correct: false, message: 'The trail goes cold — that accusation doesn\u2019t fit the clues. Read them again, detective.' });
    if (ev.winner_user_id) return res.json({ correct: true, already_solved: true, winner: winnerName(ev), message: `Right — but the case was already closed by ${winnerName(ev)}.` });
    if (claimWin()) return res.json({ correct: true, winner: true, message: entry.winBanner || '🏆 You solved it first! Your name is engraved in the Hall of Fame.' });
    const fresh = db.prepare('SELECT * FROM events WHERE id = ?').get(ev.id);
    return res.json({ correct: true, already_solved: true, winner: winnerName(fresh), message: `Right — but the case was already closed by ${winnerName(fresh)}.` });
  }

  // Treasure hunt: riddles are sequential — you only face riddle n+1 after
  // answering riddle n. The final step's answer is the Key phrase itself.
  const prog = eventProgress(ev.id, req.user.id);
  const steps = entry.steps;
  if (prog.step >= steps.length)
    return res.json({ correct: true, already_solved: !!ev.winner_user_id, message: 'You have already walked the whole chain of whispers.' });
  const guess = String(body.guess || '');
  const correct = eventsContent.matches(guess, steps[prog.step]);
  logAttempt(guess, correct);
  if (!correct) return res.json({ correct: false, step: prog.step, message: 'The whisper does not stir. That is not the name it listens for.' });
  const newStep = prog.step + 1;
  db.prepare('UPDATE event_progress SET step = ? WHERE event_id = ? AND user_id = ?').run(newStep, ev.id, req.user.id);
  if (newStep < steps.length)
    return res.json({ correct: true, step: newStep, final: false, message: '✨ The whisper fades — and a new one stirs, deeper in…' });
  if (ev.winner_user_id) return res.json({ correct: true, final: true, already_solved: true, winner: winnerName(ev), message: `You spoke the Key — but another seeker turned it first: ${winnerName(ev)} is engraved in the Hall.` });
  if (claimWin()) return res.json({ correct: true, final: true, winner: true, message: entry.winBanner || '🏆 You solved it first! Your name is engraved in the Hall of Fame.' });
  const fresh = db.prepare('SELECT * FROM events WHERE id = ?').get(ev.id);
  return res.json({ correct: true, final: true, already_solved: true, winner: winnerName(fresh), message: `You spoke the Key — but another seeker turned it first: ${winnerName(fresh)} is engraved in the Hall.` });
});

// ---------- Weekly missions ----------
app.get('/api/missions', authRequired, (req, res) => {
  const week = isoWeekKey();
  const rows = db.prepare('SELECT * FROM mission_progress WHERE user_id = ? AND week = ?').all(req.user.id, week);
  const byKey = {};
  rows.forEach(r => { byKey[r.mission_key] = r; });
  res.json({
    week,
    missions: MISSIONS.map(m => {
      const r = byKey[m.key];
      const progress = r ? r.progress : 0;
      return {
        key: m.key, title: m.title, target: m.target, reward: m.reward,
        progress: Math.min(progress, m.target), raw_progress: progress,
        claimed: !!(r && r.claimed), complete: progress >= m.target,
      };
    }),
  });
});
app.post('/api/missions/:key/claim', authRequired, async (req, res) => {
  const m = MISSIONS.find(x => x.key === req.params.key);
  if (!m) return res.status(404).json({ error: 'Mission not found' });
  const week = isoWeekKey();
  const row = db.prepare('SELECT * FROM mission_progress WHERE user_id = ? AND week = ? AND mission_key = ?')
    .get(req.user.id, week, m.key);
  if (!row || row.progress < m.target) return res.status(400).json({ error: 'Mission not complete yet' });
  if (row.claimed) return res.status(409).json({ error: 'ALREADY_CLAIMED', message: 'Already claimed — rewards pay out once.' });
  // Mark claimed first (guarded) so a replay can never double-credit.
  const upd = db.prepare('UPDATE mission_progress SET claimed = 1 WHERE user_id = ? AND week = ? AND mission_key = ? AND claimed = 0')
    .run(req.user.id, week, m.key);
  if (!upd.changes) return res.status(409).json({ error: 'ALREADY_CLAIMED', message: 'Already claimed — rewards pay out once.' });
  const balance = await creditMissionReward(req.user, m.reward, m.key, week);
  res.json({ ok: true, reward: m.reward, balance });
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
