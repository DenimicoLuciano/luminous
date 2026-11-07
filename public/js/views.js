// Luminous views — every screen of the SPA
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const timeAgo = (iso) => {
  const s = Math.floor((Date.now() - new Date((iso || '').replace(' ', 'T') + 'Z').getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
};
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => t.remove(), 3800);
}
function openModal(html) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="card modal">${html}</div></div>`;
}
function closeModal() { document.getElementById('modalRoot').innerHTML = ''; }

function avatarHtml(u, size) {
  return `<div class="avatar"${size ? ` style="width:${size}px;height:${size}px;font-size:${size * 0.55}px"` : ''}>${esc(u.avatar_emoji || '✨')}</div>`;
}
function badgesHtml(u) {
  let h = '';
  if (u.is_developer || u.role === 'developer') h += `<span class="badge dev">🛠️ Developer</span>`;
  if (u.verified) h += `<span class="badge">✓ Approved</span>`;
  if (u.is_ai) h += `<span class="badge ai">🤖 AI</span>`;
  if (u.account_type && u.account_type !== 'personal') h += `<span class="badge">${esc(u.account_type)}</span>`;
  return h;
}
const linkify = (s) => s.replace(/(https?:\/\/[^\s<]+)/g, (u) => '<a href="' + u + '" target="_blank" rel="noopener noreferrer" style="color:#a78bfa;text-decoration:underline">' + u + '</a>');
let ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }];
let ADSTERRA_KEY = null;
let ADSTERRA_SRC = null;
const CONFIG_READY = fetch('/api/config').then(r => r.json()).then(c => { if (c && Array.isArray(c.iceServers) && c.iceServers.length) ICE_SERVERS = c.iceServers; if (c && c.adsterraKey) ADSTERRA_KEY = c.adsterraKey; if (c && c.adsterraSrc) ADSTERRA_SRC = c.adsterraSrc; }).catch(() => {});
function postCard(p) {
  const ad = p.is_ad || p._adSlot;
  return `<div class="card${ad ? ' ad-card' : ''}">
    <div class="post-head">
      <a href="#/profile/${esc(p.username)}">${avatarHtml(p)}</a>
      <div class="post-meta grow">
        <div class="name"><a href="#/profile/${esc(p.username)}" style="color:inherit">${esc(p.display_name)}</a>${badgesHtml(p)}${ad ? '<span class="badge ad">Sponsored</span>' : ''}</div>
        <div class="post-time">@${esc(p.username)} · ${timeAgo(p.created_at)} · 👁 ${p.views || 0}</div>
      </div>
    </div>
    ${p.content ? `<div class="post-content">${linkify(esc(p.content))}</div>` : ''}
    ${p.image_url ? `<img class="post-img" src="${esc(p.image_url)}" loading="lazy" alt="post image">` : ''}
  </div>`;
}
function netAdCard() {
  return `<div class="card ad-card">
    <div class="post-head"><div class="post-meta grow">
      <div class="name">Luminous <span class="badge ad">Sponsored</span></div>
      <div class="post-time">Ad · paid network</div>
    </div></div>
    <div class="net-ad-slot" data-netad style="display:flex;justify-content:center;padding:6px 0"></div>
  </div>`;
}
function mountNetAds(root) {
  if (!ADSTERRA_KEY) return;
  root.querySelectorAll('[data-netad]').forEach(slot => {
    if (slot.dataset.done) return; slot.dataset.done = '1';
    window.atOptions = { key: ADSTERRA_KEY, format: 'iframe', height: 250, width: 300, params: {} };
    const sc = document.createElement('script');
    sc.async = true;
    sc.src = ADSTERRA_SRC || ('https://bicea.org/22/' + ADSTERRA_KEY);
    slot.appendChild(sc);
  });
}
const aiNotice = () => `<div class="notice">🤖 <b>AI is not configured on this server yet.</b><br>
  <span class="muted">The server owner needs to set an <code>LUMIAI_API_KEY</code> environment variable and redeploy. Everything else in Luminous works without it.</span></div>`;

/* ---------------- appearance customization (per-screen backgrounds + accent) ----------------
   Saved ONLY in this browser (localStorage), like the ChatGPT concept:
   keys luminous_bg_<screen> per screen + luminous_accent for the accent color. */
const Appearance = {
  SCREENS: [
    { key: 'home', label: 'Home' },
    { key: 'discover', label: 'Discover' },
    { key: 'live', label: 'Live' },
    { key: 'profile', label: 'Profile' },
    { key: 'messages', label: 'Messages / Chat' },
  ],
  GRADIENTS: [
    { name: 'Midnight Violet', css: 'linear-gradient(160deg,#241048 0%,#120826 55%,#2b0a33 100%)' },
    { name: 'Nebula Plum', css: 'linear-gradient(150deg,#3b1160 0%,#170a30 52%,#4a0e3f 100%)' },
    { name: 'Starfall Deep', css: 'linear-gradient(165deg,#0b1030 0%,#170b33 60%,#05070f 100%)' },
    { name: 'Rose Eclipse', css: 'linear-gradient(155deg,#330b2e 0%,#180826 55%,#12061f 100%)' },
    { name: 'Aurora Mystery', css: 'linear-gradient(150deg,#0d2133 0%,#1c0b38 58%,#2e0a3a 100%)' },
    { name: 'Ember Dusk', css: 'linear-gradient(160deg,#2e1408 0%,#1a0a2a 55%,#0d0618 100%)' },
  ],
  SOLIDS: ['#0d0716', '#150b26', '#1d0f38', '#2a1245', '#30162b', '#0a1a2f', '#101b10', '#2b0a10'],
  ACCENTS: [
    { name: 'Violet', value: '#a855f7' },
    { name: 'Magenta', value: '#ec4899' },
    { name: 'Lavender', value: '#c084fc' },
    { name: 'Fuchsia', value: '#d946ef' },
    { name: 'Star Gold', value: '#e9c46a' },
    { name: 'Moon Teal', value: '#2dd4bf' },
    { name: 'Ice Blue', value: '#60a5fa' },
  ],
  DEFAULT: () => ({ type: 'gradient', gradient: 0, color: '#150b26', overlay: 45, photo: null }),

  key(screen) { return 'luminous_bg_' + screen; },
  load(screen) {
    try { const raw = localStorage.getItem(this.key(screen)); return raw ? { ...this.DEFAULT(), ...JSON.parse(raw) } : null; }
    catch (e) { return null; }
  },
  save(screen, cfg) {
    try { localStorage.setItem(this.key(screen), JSON.stringify(cfg)); return true; }
    catch (e) { return false; } // quota — usually a photo that is still too large
  },
  reset(screen) { try { localStorage.removeItem(this.key(screen)); } catch (e) {} },
  resetAll() { this.SCREENS.forEach(s => this.reset(s.key)); },

  cssFor(cfg) {
    if (!cfg) return '';
    if (cfg.type === 'photo' && cfg.photo) return `url("${cfg.photo}")`;
    if (cfg.type === 'solid') return cfg.color || '#150b26';
    const g = this.GRADIENTS[cfg.gradient || 0] || this.GRADIENTS[0];
    return g.css;
  },
  styleFor(cfg) {
    if (!cfg) return '';
    if (cfg.type === 'photo' && cfg.photo) return `background-image:url("${cfg.photo}");background-size:cover;background-position:center`;
    return `background:${this.cssFor(cfg)}`;
  },

  applyCfg(cfg) {
    const bg = document.getElementById('screenBg');
    const shade = document.getElementById('screenShade');
    if (!bg || !shade) return;
    if (!cfg) {
      bg.style.background = ''; bg.style.backgroundImage = '';
      shade.style.opacity = '0';
      document.body.classList.remove('has-custom-bg');
      return;
    }
    if (cfg.type === 'photo' && cfg.photo) {
      bg.style.background = '';
      bg.style.backgroundImage = `url("${cfg.photo}")`;
    } else {
      bg.style.backgroundImage = '';
      bg.style.background = this.cssFor(cfg);
    }
    shade.style.opacity = String(Math.min(90, Math.max(0, cfg.overlay ?? 45)) / 100);
    document.body.classList.add('has-custom-bg');
  },
  screenForHash(hash) {
    if (!hash || hash === '#/' || hash === '#') return 'home';
    if (hash === '#/discover') return 'discover';
    if (hash === '#/live' || hash.startsWith('#/live/')) return 'live';
    if (hash.startsWith('#/profile')) return 'profile';
    if (hash === '#/friends' || hash.startsWith('#/chat/')) return 'messages';
    return null; // other screens keep the standard mystery theme
  },
  applyForHash(hash) { this.applyCfg(this.screenForHash(hash) ? this.load(this.screenForHash(hash)) : null); },
  applyForScreen(screen) { this.applyCfg(screen ? this.load(screen) : null); },

  accent() { try { return localStorage.getItem('luminous_accent') || '#a855f7'; } catch (e) { return '#a855f7'; } },
  setAccent(v) {
    try { localStorage.setItem('luminous_accent', v); } catch (e) {}
    document.documentElement.style.setProperty('--accent', v);
  },
  initAccent() { document.documentElement.style.setProperty('--accent', this.accent()); },

  downscalePhoto(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const MAX = 1280;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve(cv.toDataURL('image/jpeg', 0.82));
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  },
};

/* video (Lum) card used by the feed's Video tab — real /lums data */
function lumCard(l) {
  return `<div class="card lum-card">
    <div class="post-head">
      <a href="#/profile/${esc(l.username)}">${avatarHtml(l)}</a>
      <div class="post-meta grow">
        <div class="name"><a href="#/profile/${esc(l.username)}" style="color:inherit">${esc(l.display_name)}</a>${badgesHtml(l)}</div>
        <div class="post-time">@${esc(l.username)} · 🎬 Lum · 👁 ${l.views || 0}</div>
      </div>
    </div>
    ${l.video_url ? `<a href="#/lums"><video src="${esc(l.video_url)}" muted playsinline preload="metadata"></video></a>` : ''}
    ${l.caption ? `<div class="post-content">${esc(l.caption)}</div>` : ''}
  </div>`;
}

/* ---------------- friends helpers ---------------- */
function tierChip(t) {
  if (!t) return '';
  return `<span class="tier-chip tier-${t.key}">${t.emoji} ${t.label}</span>`;
}
const PRESENCE_COLORS = { active: '#22c55e', away: '#f59e0b', busy: '#ef4444', offline: '#6b7280' };
function presenceDotHtml(u, withLabel) {
  if (!u || !u.presence) return '';
  const c = PRESENCE_COLORS[u.presence] || '#6b7280';
  return `<span class="presence"><span class="status-dot" style="background:${c}"></span>${withLabel ? `<span class="muted">${esc(u.presence_label || '')}</span>` : ''}</span>`;
}
function streakChipHtml(streak) {
  if (!streak || !streak.current) return '';
  const dim = streak.at_risk ? ' dim' : '';
  return `<span class="streak-chip${dim}" title="Streak: ${streak.current} day${streak.current === 1 ? '' : 's'}${streak.at_risk ? ' — at risk, message today!' : ''}">${streak.emoji || '🔥'} ${streak.current}${streak.at_risk ? ' ⏳' : ''}</span>`;
}
function friendRow(f) {
  const u = f.user, t = f.tier;
  const sub = f.family
    ? `Family 👨‍👩‍👧 · friends for ${t.days} days`
    : t.next
      ? `Friends for ${t.days} day${t.days === 1 ? '' : 's'} · ${t.next.inDays} day${t.next.inDays === 1 ? '' : 's'} to ${t.next.label}`
      : `Friends for ${t.days} days · top level!`;
  const familyBtn = f.family
    ? `<button class="btn small ghost" data-family-remove="${u.id}">Remove Family status</button>`
    : (t && t.key === 'best' ? `<button class="btn small ghost" data-family-make="${u.id}">👨‍👩‍👧 Make Family</button>` : '');
  return `<div class="card friend-card">
    <div class="friend-row">${avatarHtml(u, 48)}
      <div class="grow">
        <div class="name"><a href="#/profile/${esc(u.username)}" style="color:inherit">${esc(u.display_name)}</a> ${presenceDotHtml(u)} ${badgesHtml(u)}${f.unread ? ` <span class="badge unread">${f.unread} new</span>` : ''} ${streakChipHtml(f.streak)}</div>
        <div class="muted">@${esc(u.username)}${f.last_message ? ' · ' + esc(f.last_message.content.slice(0, 42)) : ''}</div>
        <div class="tier-line">${tierChip(t)} <span class="muted">${sub}</span></div>
      </div>
    </div>
    <div class="friend-actions">
      <a class="btn small" href="#/chat/${u.id}">💬 Message</a>
      <button class="btn small" data-call-kind="audio" data-call-user="${u.id}" data-call-name="${esc(u.display_name)}">📞 Call</button>
      <button class="btn small" data-call-kind="video" data-call-user="${u.id}" data-call-name="${esc(u.display_name)}">🎥 Video</button>
      ${familyBtn}
      <button class="btn small ghost" data-remove="${f.friendship_id}">Remove</button>
    </div>
  </div>`;
}
function personRow(r) {
  const u = r.user;
  let action = '';
  if (r.rel === 'none') action = `<button class="btn small" data-add="${u.id}">➕ Add friend</button>`;
  else if (r.rel === 'pending_out') action = `<span class="muted">Request sent</span>`;
  else if (r.rel === 'pending_in') action = `<button class="btn small" data-accept="${r.friendship_id}">Accept</button>`;
  else action = `<a class="btn small" href="#/chat/${u.id}">💬 Message</a>`;
  return `<div class="friend-row">${avatarHtml(u, 44)}
    <div class="grow"><div class="name">${esc(u.display_name)} ${badgesHtml(u)}</div><div class="muted">@${esc(u.username)}</div></div>${action}</div>`;
}
function msgHtml(m) {
  const mine = App.user && m.sender_id === App.user.id;
  const img = m.image_url ? `<img class="msg-img" src="${esc(m.image_url)}" alt="Photo">` : '';
  const txt = m.content ? `<div class="bubble">${esc(m.content)}</div>` : '';
  return `<div class="msg ${mine ? 'me' : 'them'}">${img}${txt}<div class="msg-time">${timeAgo(m.created_at)}</div></div>`;
}

/* ---------------- Mystery pack helpers ---------------- */
// A secret passage: a tiny shimmering glimmer hidden in a dark corner of a
// screen. Most people scroll right past it. It is not labelled anywhere.
const passageStarHtml = (key, extraCls) => `<button type="button" class="passage-star ${extraCls || ''}" data-passage="${key}" aria-label="a faint glimmer">✦</button>`;
function wirePassageStars(root) {
  root.querySelectorAll('[data-passage]').forEach(b => b.onclick = () => Views.discoverPassage(b.dataset.passage));
}

function trophyCaseHtml(u) {
  const trophies = u.trophies || [];
  if (!trophies.length) return '';
  const hint = (t) => {
    if (t.unlocked) return 'Unlocked ✦';
    if (t.threshold) return `Reach ${t.threshold.toLocaleString()} followers`;
    if (t.key === 'mystery-winner') return 'Win a Monthly Quest — Murder Mystery';
    if (t.key === 'treasure-winner') return 'Win a Monthly Quest — Treasure Hunt';
    if (t.key === 'founder') return 'The Founder only';
    return 'Locked';
  };
  return `<div class="card trophy-case">
    <h3 style="margin:0">🏆 Creator Awards</h3>
    <div class="muted" style="margin:4px 0 12px">Channel milestones — 1K · 100K · 1M followers. Like play buttons, but shinier: these unlock at real follower counts, earned one follow at a time.</div>
    <div class="trophy-grid">${trophies.map(t => `
      <div class="trophy ${t.unlocked ? 'unlocked' : 'locked'}">
        <div class="trophy-icon">${t.icon}</div>
        <div class="trophy-name">${t.unlocked ? esc(t.name) : '✦ ✦ ✦'}</div>
        <div class="muted trophy-hint">${esc(t.unlocked ? t.name : hint(t))}</div>
      </div>`).join('')}</div>
  </div>`;
}

// Monthly Quest panel (rendered inside its home server: the Murder Mystery
// lives in The Midnight Library, the Treasure Hunt starts in The Vault).
async function renderEventPanel(kind) {
  const wrap = document.getElementById('evPanel');
  if (!wrap) return;
  let data;
  try { data = await API.get('/events/current'); } catch (e) { wrap.innerHTML = ''; return; }
  const ev = (data.events || []).find(e => e.kind === kind);
  if (!ev) { wrap.innerHTML = ''; return; }
  const head = kind === 'mystery' ? '📖 Monthly Quest — Murder Mystery' : '🗺️ Monthly Quest — Treasure Hunt';
  if (ev.state === 'being-written') {
    wrap.innerHTML = `<div class="card event-panel"><h3 style="margin:0">${head}</h3>
      <div class="muted mt">✍️ This month's ${kind === 'mystery' ? 'case' : 'hunt'} is still being written by the Founder. Check back soon — the darkness is patient.</div></div>`;
    return;
  }
  const fb = Views._evFeedback && Views._evFeedback[kind];
  let h = `<div class="card event-panel"><h3 style="margin:0">${head}</h3>
    <div class="event-title">${esc(ev.title)}</div>
    <div class="muted">${esc(ev.month)} · ${ev.state === 'solved' ? `Solved by <b>${esc(ev.winner)}</b> 🏆` : 'Still open — the first to solve it is engraved in the Hall of Fame'}</div>
    <p class="event-intro">${esc(ev.intro)}</p>`;
  if (ev.state === 'solved') h += `<div class="event-solved">🏆 ${ev.winner_is_me ? 'You solved it — your name is engraved in the Hall of Fame.' : `Solved by ${esc(ev.winner)}. The next quest opens with a new month.`}</div>`;
  if (kind === 'mystery') {
    h += `<h4 class="event-sub">The suspects</h4><div class="suspect-grid">${(ev.suspects || []).map(s => `
      <div class="suspect"><div class="suspect-name">${esc(s.name)}</div><div class="muted">${esc(s.role)}</div><div class="suspect-blurb">${esc(s.blurb)}</div></div>`).join('')}</div>`;
    h += `<h4 class="event-sub">Clues (${ev.clues_seen}/${ev.clues_total})</h4>`;
    h += ev.clues.length ? ev.clues.map(c => `<div class="clue">${esc(c)}</div>`).join('') : `<div class="muted">No clues examined yet, detective.</div>`;
    if (ev.state === 'open') {
      if (ev.clues_seen < ev.clues_total) h += `<button class="btn small mt" id="evClueBtn">🔍 Examine the next clue</button>`;
      else h += `<div class="event-answer">
          <label class="f">Name the informant<select id="evSuspect">${(ev.suspects || []).map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('')}</select></label>
          <label class="f">Why did they do it? (the motive, in your words)<input id="evMotive" maxlength="200" placeholder="One word can hang a case…"></label>
          <button class="btn small" id="evAccuseBtn">⚖️ Make the accusation</button>
          <div class="muted mt">Your attempts so far: ${ev.my_attempts} · Wrong accusations cost nothing but pride.</div></div>`;
    }
  } else {
    h += `<h4 class="event-sub">The chain of whispers (${ev.my_step}/${ev.steps_total})</h4>`;
    h += (ev.riddles || []).map(r => `<div class="clue ${r.done ? 'done' : 'current'}"><b>Whisper ${r.n} — ${esc(r.place)}</b><br>${esc(r.riddle)}${r.done ? ' <span class="badge">✓ answered</span>' : ''}</div>`).join('');
    for (let i = (ev.riddles || []).length; i < ev.steps_total; i++) h += `<div class="clue locked">🔒 A whisper you have not reached yet…</div>`;
    if (ev.state === 'open' && ev.my_step < ev.steps_total) h += `<div class="event-answer">
        <label class="f">Answer the whisper<input id="evGuess" maxlength="200" placeholder="Speak the name it listens for…"></label>
        <button class="btn small" id="evAnswerBtn">🗝️ Answer</button>
        <div class="muted mt">Your attempts so far: ${ev.my_attempts}</div></div>`;
  }
  if (fb) h += `<div class="event-feedback">${esc(fb)}</div>`;
  h += `</div>`;
  wrap.innerHTML = h;
  const setFb = (msg) => { Views._evFeedback = Views._evFeedback || {}; Views._evFeedback[kind] = msg; };
  const clueBtn = document.getElementById('evClueBtn');
  if (clueBtn) clueBtn.onclick = async () => { try { await API.post(`/events/${ev.id}/clue`, {}); renderEventPanel(kind); } catch (e) { toast('Could not examine the clue'); } };
  const accBtn = document.getElementById('evAccuseBtn');
  if (accBtn) accBtn.onclick = async () => {
    try {
      const r = await API.post(`/events/${ev.id}/answer`, { suspect: document.getElementById('evSuspect').value, motive: document.getElementById('evMotive').value });
      setFb(r.message || (r.correct ? 'Correct!' : 'Not quite.'));
    } catch (e) { setFb((e.data && e.data.message) || 'Could not submit that accusation'); }
    renderEventPanel(kind);
  };
  const ansBtn = document.getElementById('evAnswerBtn');
  if (ansBtn) {
    const submit = async () => {
      try {
        const r = await API.post(`/events/${ev.id}/answer`, { guess: document.getElementById('evGuess').value });
        setFb(r.message || '');
      } catch (e) { setFb('Could not submit that answer'); }
      renderEventPanel(kind);
    };
    ansBtn.onclick = submit;
    const gi = document.getElementById('evGuess');
    if (gi) gi.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }
}

/* ---------------- calls (WebRTC over REST signaling) ---------------- */
const CallUI = {
  pc: null, stream: null, callId: null, poll: null, seenCandidates: 0, remoteSet: false,

  _overlay(html) {
    let ov = document.getElementById('callOverlay');
    if (!ov) { ov = document.createElement('div'); ov.id = 'callOverlay'; document.body.appendChild(ov); }
    ov.innerHTML = `<div class="call-box">${html}</div>`;
    return ov;
  },
  _close() {
    if (this.poll) { clearInterval(this.poll); this.poll = null; }
    if (this.pc) { try { this.pc.close(); } catch (e) {} this.pc = null; }
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    window._activeCall = false; this.callId = null; this.seenCandidates = 0; this.remoteSet = false;
    const ov = document.getElementById('callOverlay');
    if (ov) ov.remove();
  },
  _callScreen(kind, name, status) {
    this._overlay(`
      ${kind === 'video'
        ? `<video id="callRemote" autoplay playsinline></video><video id="callLocal" autoplay muted playsinline></video>`
        : `<div class="call-avatar">📞</div>`}
      <div class="call-name">${esc(name)}</div>
      <div class="call-status" id="callStatus">${esc(status)}</div>
      <button class="btn hangup" id="callEnd">📵 End call</button>`);
    document.getElementById('callEnd').onclick = () => this.hangup(true);
  },
  async _setup(kind) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' });
    const local = document.getElementById('callLocal');
    if (local) local.srcObject = this.stream;
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.stream.getTracks().forEach(t => this.pc.addTrack(t, this.stream));
    this.pc.ontrack = (e) => {
      const remote = document.getElementById('callRemote');
      if (remote && e.streams[0]) remote.srcObject = e.streams[0];
    };
    this.pc.onicecandidate = (e) => {
      if (e.candidate && this.callId) API.post(`/calls/${this.callId}/candidates`, { candidate: e.candidate.toJSON() }).catch(() => {});
    };
  },
  _setStatus(s) { const el = document.getElementById('callStatus'); if (el) el.textContent = s; },
  _pollLoop(isCaller) {
    this.poll = setInterval(async () => {
      if (!this.callId || !this.pc) return;
      try {
        const { call, candidates } = await API.get(`/calls/${this.callId}`);
        if (['ended', 'declined', 'missed'].includes(call.status)) { toast('Call ended'); this._close(); return; }
        if (isCaller && call.answer && !this.remoteSet) {
          await this.pc.setRemoteDescription({ type: 'answer', sdp: call.answer });
          this.remoteSet = true;
        }
        for (; this.seenCandidates < candidates.length; this.seenCandidates++) {
          try { await this.pc.addIceCandidate(JSON.parse(candidates[this.seenCandidates])); } catch (e) {}
        }
        if (call.status === 'ongoing') this._setStatus('Connected ✅');
      } catch (e) { /* ignore */ }
    }, 1500);
  },
  async start(userId, kind, name) {
    if (window._activeCall) return;
    try {
      const { call } = await API.post('/calls', { user_id: userId, kind });
      this.callId = call.id;
      window._activeCall = true;
      this._callScreen(kind, name, 'Calling…');
      await this._setup(kind);
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      await API.post(`/calls/${this.callId}/offer`, { sdp: offer.sdp });
      this._setStatus('Ringing…');
      this._pollLoop(true);
    } catch (e) {
      toast(e.data?.error || 'Could not start the call — check camera/mic permission');
      this._close();
    }
  },
  incoming(call) {
    if (window._activeCall || document.getElementById('callOverlay')) return;
    this.callId = call.id;
    const name = call.other ? call.other.display_name : 'A friend';
    this._overlay(`
      <div class="call-avatar">${call.kind === 'video' ? '🎥' : '📞'}</div>
      <div class="call-name">${esc(name)}</div>
      <div class="call-status">Incoming ${call.kind} call…</div>
      <div class="row" style="justify-content:center;gap:10px">
        <button class="btn" id="callAccept">✅ Answer</button>
        <button class="btn hangup" id="callDecline">Decline</button>
      </div>`);
    document.getElementById('callDecline').onclick = async () => {
      try { await API.post(`/calls/${call.id}/decline`, {}); } catch (e) {}
      this._close();
    };
    document.getElementById('callAccept').onclick = () => this._accept(call, name);
  },
  async _accept(call, name) {
    try {
      window._activeCall = true;
      this._callScreen(call.kind, name, 'Connecting…');
      await this._setup(call.kind);
      let offerSdp = call.offer;
      for (let i = 0; !offerSdp && i < 20; i++) {
        await new Promise(r => setTimeout(r, 800));
        const d = await API.get(`/calls/${call.id}`);
        offerSdp = d.call.offer;
        if (['ended', 'declined', 'missed'].includes(d.call.status)) { this._close(); return; }
      }
      if (!offerSdp) { toast('Call could not connect'); this._close(); return; }
      await this.pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
      this.remoteSet = true;
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      await API.post(`/calls/${call.id}/answer`, { sdp: answer.sdp });
      this._setStatus('Connected ✅');
      this._pollLoop(false);
    } catch (e) {
      toast('Could not answer — check camera/mic permission');
      this._close();
    }
  },
  async hangup(notify) {
    const id = this.callId;
    this._close();
    if (notify && id) { try { await API.post(`/calls/${id}/end`, {}); } catch (e) {} }
  },
};

async function loadScheduledLums() {
  const box = document.getElementById('lumPlanList');
  if (!box || !App.user) return;
  try {
    const { lums } = await API.get('/lums/scheduled');
    box.innerHTML = lums.length ? `<div class="card" style="margin-top:12px"><h4 style="margin:0 0 8px">🕒 Your planned Lums</h4>` +
      lums.map(l => `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line, #333)">
        <div class="grow"><div>${esc((l.caption || '🎬 Lum').slice(0, 80))}</div>
        <div class="post-time">Publishes ${esc(new Date(l.publish_at.replace(' ', 'T') + 'Z').toLocaleString())}</div></div>
        <button class="btn small ghost" data-cancel-lum="${l.id}">Cancel</button></div>`).join('') + `</div>` : '';
    box.querySelectorAll('[data-cancel-lum]').forEach(b => b.onclick = async () => {
      try { await API.post('/lums/' + b.dataset.cancelLum + '/cancel-schedule', {}); toast('Planned Lum cancelled'); loadScheduledLums(); }
      catch (e) { toast('Could not cancel'); }
    });
  } catch (e) { box.innerHTML = ''; }
}

/* ---------------- CAMERA (filters + stickers, Snapchat-style) ----------------
   One reusable full-screen camera sheet. Looks are CSS filter strings shown
   live on the preview and baked into the capture via canvas ctx.filter, so
   what you see is what sends. Stickers are user-placed (drag to move,
   ＋/－ to scale, ✕ to remove) — there is NO face tracking and no copy
   claims any. Falls back to a file pick when the camera is unavailable. */
const CAM_FILTERS = [
  ['Normal', 'none'],
  ['Noir', 'grayscale(1) contrast(1.25) brightness(1.05)'],
  ['Vintage', 'sepia(0.55) contrast(1.05) brightness(1.02) saturate(0.85)'],
  ['Neon', 'saturate(1.7) hue-rotate(18deg) contrast(1.1)'],
  ['Dreamy', 'brightness(1.12) saturate(1.25) contrast(0.92)'],
  ['Frost', 'brightness(1.08) hue-rotate(-14deg) saturate(0.8) contrast(1.02)'],
  ['Sunset', 'sepia(0.35) saturate(1.45) hue-rotate(-10deg) brightness(1.05)'],
  ['Pop', 'contrast(1.35) saturate(1.9) brightness(1.06)'],
  ['Grain', 'grayscale(0.85) contrast(1.3) brightness(1.1)'],
  ['Mirror', 'none'], // mirror is a transform, handled specially
];
const CAM_STICKERS = ['👑', '🕶️', '🐶', '🥸', '🌈', '⭐', '❤️', '🎩'];
const CameraUI = {
  // opts: { onCapture(file) } — called with the baked JPEG File on Send.
  open(opts) {
    if (!App.user) { Views.authModal(); return; }
    const root = document.createElement('div');
    root.className = 'camera-root';
    root.innerHTML = `
      <div class="camera-head"><button class="btn small ghost" id="camClose">✕ Close</button>
        <div class="grow center" style="font-weight:800">📸 Live photo</div>
        <button class="btn small ghost" id="camFlip">🔄 Flip</button></div>
      <div class="camera-stage" id="camStage">
        <video id="camVideo" autoplay playsinline muted></video>
        <div class="cam-fallback hidden" id="camFallback">
          <div style="font-size:44px">📷</div>
          <div class="muted">Camera isn't available here — pick a photo instead.</div>
          <button class="btn mt" id="camPick">Choose photo</button>
        </div>
        <img id="camShot" class="hidden" alt="Your capture">
        <div id="camStickers"></div>
      </div>
      <div class="cam-rail" id="camRail">${CAM_FILTERS.map(([n], i) => `<button class="cam-filter${i === 0 ? ' active' : ''}" data-camf="${i}">${n}</button>`).join('')}</div>
      <div class="cam-rail" id="camStickerRail">${CAM_STICKERS.map(s => `<button class="cam-sticker-btn" data-sticker="${s}">${s}</button>`).join('')}<span class="muted" style="align-self:center">Tap a sticker, then drag it into place</span></div>
      <div class="camera-foot">
        <button class="btn ghost" id="camRetake" style="display:none">↩ Retake</button>
        <button class="cam-shutter" id="camShutter" aria-label="Take photo"></button>
        <button class="btn" id="camSend" style="display:none">Send ➤</button>
      </div>
      <input type="file" id="camFile" accept="image/*" class="hidden">`;
    document.body.appendChild(root);
    document.documentElement.style.overflow = 'hidden';
    const video = root.querySelector('#camVideo');
    const stage = root.querySelector('#camStage');
    const shot = root.querySelector('#camShot');
    const stickerLayer = root.querySelector('#camStickers');
    let stream = null, facing = 'user', filterIdx = 0, captured = null, shotUrl = null;
    const placed = []; // {el, emoji, scale}
    const cleanup = () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (shotUrl) URL.revokeObjectURL(shotUrl);
      root.remove();
      document.documentElement.style.overflow = '';
    };
    const applyPreviewFilter = () => {
      const f = CAM_FILTERS[filterIdx][1];
      video.style.filter = f === 'none' ? '' : f;
      video.style.transform = CAM_FILTERS[filterIdx][0] === 'Mirror' ? 'scaleX(-1)' : '';
      shot.style.filter = video.style.filter;
      shot.style.transform = video.style.transform;
    };
    const startCam = async () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
        video.srcObject = stream;
        root.querySelector('#camFallback').classList.add('hidden');
        video.classList.remove('hidden');
      } catch (e) {
        video.classList.add('hidden');
        root.querySelector('#camFallback').classList.remove('hidden');
      }
    };
    root.querySelector('#camClose').onclick = cleanup;
    root.querySelector('#camFlip').onclick = () => { facing = facing === 'user' ? 'environment' : 'user'; startCam(); };
    root.querySelector('#camPick').onclick = () => root.querySelector('#camFile').click();
    root.querySelector('#camFile').onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      captured = f;
      if (shotUrl) URL.revokeObjectURL(shotUrl);
      shotUrl = URL.createObjectURL(f);
      shot.src = shotUrl;
      shot.classList.remove('hidden');
      video.classList.add('hidden');
      root.querySelector('#camFallback').classList.add('hidden');
      root.querySelector('#camShutter').style.display = 'none';
      root.querySelector('#camRetake').style.display = '';
      root.querySelector('#camSend').style.display = '';
    };
    root.querySelectorAll('[data-camf]').forEach(b => b.onclick = () => {
      filterIdx = +b.dataset.camf;
      root.querySelectorAll('[data-camf]').forEach(x => x.classList.toggle('active', x === b));
      applyPreviewFilter();
    });
    root.querySelectorAll('[data-sticker]').forEach(b => b.onclick = () => {
      const el = document.createElement('div');
      el.className = 'cam-sticker';
      el.textContent = b.dataset.sticker;
      el.style.left = '50%'; el.style.top = '38%';
      const entry = { el, scale: 1, emoji: b.dataset.sticker };
      const tools = document.createElement('span');
      tools.className = 'cam-sticker-tools';
      tools.innerHTML = `<button data-st="plus">＋</button><button data-st="minus">－</button><button data-st="del">✕</button>`;
      el.appendChild(tools);
      tools.querySelector('[data-st="plus"]').onclick = (ev) => { ev.stopPropagation(); entry.scale = Math.min(3, entry.scale + 0.25); el.style.fontSize = (54 * entry.scale) + 'px'; };
      tools.querySelector('[data-st="minus"]').onclick = (ev) => { ev.stopPropagation(); entry.scale = Math.max(0.4, entry.scale - 0.25); el.style.fontSize = (54 * entry.scale) + 'px'; };
      tools.querySelector('[data-st="del"]').onclick = (ev) => { ev.stopPropagation(); el.remove(); const i = placed.indexOf(entry); if (i >= 0) placed.splice(i, 1); };
      let drag = null;
      el.addEventListener('pointerdown', (ev) => {
        if (ev.target.closest('.cam-sticker-tools')) return;
        drag = { dx: ev.clientX - el.offsetLeft, dy: ev.clientY - el.offsetTop };
        el.setPointerCapture(ev.pointerId);
      });
      el.addEventListener('pointermove', (ev) => {
        if (!drag) return;
        const r = stage.getBoundingClientRect();
        el.style.left = (ev.clientX - r.left - drag.dx) + 'px';
        el.style.top = (ev.clientY - r.top - drag.dy) + 'px';
      });
      el.addEventListener('pointerup', () => { drag = null; });
      stickerLayer.appendChild(el);
      placed.push(entry);
    });
    root.querySelector('#camShutter').onclick = () => {
      if (!stream || !video.videoWidth) { root.querySelector('#camFile').click(); return; }
      const c = document.createElement('canvas');
      c.width = video.videoWidth; c.height = video.videoHeight;
      const ctx = c.getContext('2d');
      const fname = CAM_FILTERS[filterIdx][0];
      if (fname === 'Mirror') { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
      try { ctx.filter = CAM_FILTERS[filterIdx][1]; } catch (e) { /* older canvas: preview filter only */ }
      ctx.drawImage(video, 0, 0);
      // vignette for Vintage, extra grain for Grain/Pop posterize feel
      ctx.filter = 'none';
      if (fname === 'Vintage') {
        const g = ctx.createRadialGradient(c.width / 2, c.height / 2, c.width / 3, c.width / 2, c.height / 2, c.width / 1.1);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,8,0,0.45)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
      }
      if (fname === 'Grain') {
        const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
        for (let i = 0; i < d.length; i += 16) { const n = (Math.random() - 0.5) * 36; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
        ctx.putImageData(img, 0, 0);
      }
      if (fname === 'Pop') {
        const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
        for (let i = 0; i < d.length; i += 4) { d[i] = Math.round(d[i] / 64) * 64; d[i + 1] = Math.round(d[i + 1] / 64) * 64; d[i + 2] = Math.round(d[i + 2] / 64) * 64; }
        ctx.putImageData(img, 0, 0);
      }
      // stickers baked at their stage-relative positions
      const sr = stage.getBoundingClientRect();
      for (const s of placed) {
        const r = s.el.getBoundingClientRect();
        const cx = (r.left - sr.left + r.width / 2) / sr.width * c.width;
        const cy = (r.top - sr.top + r.height / 2) / sr.height * c.height;
        ctx.font = `${(54 * s.scale) / sr.width * c.width}px serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(s.emoji, cx, cy);
      }
      c.toBlob((blob) => {
        if (!blob) { toast('Could not capture — try again'); return; }
        captured = new File([blob], 'live-photo.jpg', { type: 'image/jpeg' });
        if (shotUrl) URL.revokeObjectURL(shotUrl);
        shotUrl = URL.createObjectURL(blob);
        shot.src = shotUrl;
        shot.classList.remove('hidden');
        shot.style.filter = ''; shot.style.transform = '';
        video.classList.add('hidden');
        stickerLayer.innerHTML = ''; placed.length = 0;
        root.querySelector('#camShutter').style.display = 'none';
        root.querySelector('#camRetake').style.display = '';
        root.querySelector('#camSend').style.display = '';
      }, 'image/jpeg', 0.9);
    };
    root.querySelector('#camRetake').onclick = () => {
      captured = null;
      shot.classList.add('hidden');
      root.querySelector('#camShutter').style.display = '';
      root.querySelector('#camRetake').style.display = 'none';
      root.querySelector('#camSend').style.display = 'none';
      if (stream) video.classList.remove('hidden'); else root.querySelector('#camFallback').classList.remove('hidden');
    };
    root.querySelector('#camSend').onclick = () => {
      if (!captured) return;
      const f = captured;
      cleanup();
      opts.onCapture(f);
    };
    applyPreviewFilter();
    startCam();
  },
};

async function loadPlannedPosts() {
  const box = document.getElementById('planList');
  if (!box || !App.user) return;
  try {
    const { scheduled } = await API.get('/posts/scheduled');
    box.innerHTML = scheduled.length ? `<div class="card" style="margin-top:12px"><h4 style="margin:0 0 8px">🕒 Your planned posts</h4>` +
      scheduled.map(s => `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line, #333)">
        <div class="grow"><div>${esc((s.content || '📷 Photo post').slice(0, 80))}</div>
        <div class="post-time">Publishes ${esc(new Date(s.publish_at.replace(' ', 'T') + 'Z').toLocaleString())}</div></div>
        <button class="btn small ghost" data-cancel-plan="${s.id}">Cancel</button></div>`).join('') + `</div>` : '';
    box.querySelectorAll('[data-cancel-plan]').forEach(b => b.onclick = async () => {
      try { await API.del('/posts/scheduled/' + b.dataset.cancelPlan); toast('Planned post cancelled'); loadPlannedPosts(); }
      catch (e) { toast('Could not cancel'); }
    });
  } catch (e) { box.innerHTML = ''; }
}

const Views = {

  /* ---------------- FEED (Home: stories row · tabs · composer) ---------------- */
  async feed(el) {
    el.innerHTML = `<div class="card center"><div class="muted">Loading your feed…</div></div>`;
    let posts = [], trays = [], friendNames = new Set(), statusByUser = {};
    try {
      const feedData = await API.get('/feed?limit=30');
      posts = feedData.posts || [];
      await CONFIG_READY;
    } catch (e) { el.innerHTML = `<div class="card center">Couldn't load the feed. Try again.</div>`; return; }
    // stories + friends are best-effort extras on top of the feed
    try { const s = await API.get('/stories'); trays = s.trays || []; } catch (e) { /* no stories row */ }
    if (App.user) {
      try {
        const f = await API.get('/friends');
        (f.friends || []).forEach(fr => { friendNames.add(fr.user.username); if (fr.user.status) statusByUser[fr.user.username] = fr.user.status; });
      } catch (e) { /* Following tab will just show your own posts */ }
    }
    Views._trays = trays;

    /* ---- stories row (real trays from /stories; own circle first) ---- */
    const statusDot = (username, own) => {
      const st = own ? (App.user && App.user.status) : statusByUser[username];
      return st ? `<span class="story-online ${st === 'active' ? '' : esc(st)}" title="${esc(st)}"></span>` : '';
    };
    const ownTray = App.user ? trays.find(t => t.user.username === App.user.username) : null;
    const otherTrays = trays.filter(t => !App.user || t.user.username !== App.user.username);
    const storyItem = (t, i) => `
      <div class="story-item"><button class="story-dot" data-story="${i}" aria-label="${esc(t.user.display_name)}'s story">
        <span class="story-ring2"><span>${esc(t.user.avatar_emoji || '✦')}</span></span>${statusDot(t.user.username, false)}</button>
        <div class="story-name">${esc(t.user.username)}</div></div>`;
    const storiesHtml = `
      <div class="story-item own"><button class="story-dot" id="yourStory" aria-label="Your story">
        <span class="story-ring2"><span>${App.user ? esc(App.user.avatar_emoji || '✦') : '✦'}</span></span>
        <span class="story-plus">＋</span></button>
        <div class="story-name">Your story</div></div>
      ${otherTrays.map(storyItem).join('')}`;

    /* ---- create bar (opens the modern create sheet; the old composer
       card is retired — creating happens in Views.createMenu/createEditor,
       posting through the same endpoints as always) ---- */
    const composerHtml = App.user ? `
      <div class="card create-bar">
        ${avatarHtml(App.user, 44)}
        <button class="composer-bubble grow" id="cbOpen">What's happening in your world?</button>
        <button class="cb-quick" id="cbPhoto" title="New post">▦</button>
        <button class="cb-quick" id="cbCam" title="Camera">📸</button>
        <button class="cb-quick" id="cbLum" title="New Lum">🎬</button>
      </div>` : `
      <div class="card composer center">
        <div style="font-size:17px;font-weight:800">✦ What's happening in your world?</div>
        <div class="muted mt">Log in to post, share stories and go live.</div>
        <div class="mt"><button class="btn" onclick="Views.authModal()">Log in / Sign up</button></div>
      </div>`;

    el.innerHTML = `
      <section class="panel">
        <div class="stories-head"><h3>Stories</h3><a class="add-story" href="#/create">＋ Add story</a></div>
        <div class="stories-row">${storiesHtml}</div>
        <div class="feed-tabs" id="feedTabs">
          <button data-ft="foryou" class="active">For you</button>
          <button data-ft="following">Following</button>
          <button data-ft="video">Video</button>
        </div>
      </section>
      ${composerHtml}
      <div id="feedList"></div>
      ${passageStarHtml('home-star', 'ps-home')}`;

    // story circles open the existing viewer; "Your story" opens yours or the creator
    el.querySelectorAll('[data-story]').forEach(btn => btn.onclick = () => Views.storyViewer(otherTrays[+btn.dataset.story], 0));
    const ys = document.getElementById('yourStory');
    if (ys) ys.onclick = () => {
      if (!App.user) { Views.authModal(); return; }
      if (ownTray) Views.storyViewer(ownTray, 0); else Views.createEditor('story');
    };

    /* ---- tabs ---- */
    const list = document.getElementById('feedList');
    let viewsCounted = false, lumsCache = null;
    const withAds = (arr) => {
      const items = []; let seenReg = 0;
      for (const p of arr) { items.push(p); if (!p.is_ad) { seenReg++; if (ADSTERRA_KEY && seenReg % 6 === 0) items.push({ _adSlot: 'network' }); } }
      return items.map(p => p._adSlot === 'network' ? netAdCard() : postCard(p)).join('');
    };
    const renderTab = async (tab) => {
      el.querySelectorAll('#feedTabs button').forEach(b => b.classList.toggle('active', b.dataset.ft === tab));
      if (tab === 'video') {
        list.innerHTML = `<div class="card center"><div class="muted">Loading videos…</div></div>`;
        try {
          if (!lumsCache) { const d = await API.get('/lums'); lumsCache = d.lums || []; }
          list.innerHTML = lumsCache.length ? lumsCache.map(lumCard).join('') : `<div class="card center muted">No videos yet — tap ＋ Create and post a Lum. 🎬</div>`;
        } catch (e) { list.innerHTML = `<div class="card center">Couldn't load videos.</div>`; }
        return;
      }
      if (tab === 'following') {
        if (!App.user) { list.innerHTML = `<div class="card center"><div class="muted">Log in to see posts from your friends.</div><div class="mt"><button class="btn" onclick="Views.authModal()">Log in / Sign up</button></div></div>`; return; }
        const mine = posts.filter(p => !p.is_ad && (p.username === App.user.username || friendNames.has(p.username)));
        list.innerHTML = mine.length ? mine.map(postCard).join('') : `<div class="card center muted">Nothing from your circle yet — when your friends post, it lands here. 👥</div>`;
        return;
      }
      // For you — the full feed, house ads as delivered + network slot every ~6 posts
      list.innerHTML = posts.length ? withAds(posts) : `<div class="card center">No posts yet — be the first! ✨</div>`;
      mountNetAds(list);
      if (!viewsCounted) {
        viewsCounted = true;
        // count views (fire-and-forget); AI views never count toward earnings (server-side)
        posts.forEach(p => { if (!p.is_ad) API.post(`/posts/${p.id}/view`).catch(() => {}); });
      }
    };
    el.querySelectorAll('#feedTabs button').forEach(b => b.onclick = () => renderTab(b.dataset.ft));
    renderTab(Views._feedTab && ['following', 'video'].includes(Views._feedTab) ? Views._feedTab : 'foryou');
    el.querySelectorAll('#feedTabs button').forEach(b => b.addEventListener('click', () => { Views._feedTab = b.dataset.ft; }));
    wirePassageStars(el);

    /* ---- create bar wiring ---- */
    if (App.user) {
      document.getElementById('cbOpen').onclick = () => Views.createMenu();
      document.getElementById('cbPhoto').onclick = () => Views.createEditor('post');
      document.getElementById('cbLum').onclick = () => Views.createEditor('lum');
      document.getElementById('cbCam').onclick = () => CameraUI.open({ onCapture: (file) => Views.createEditor('post', file) });
    }
  },

  /* ---------------- STORIES ---------------- */
  async stories(el) {
    el.innerHTML = `<div class="card"><h3 style="margin:0 0 10px">📖 Stories <span class="muted">· disappear after 24h</span></h3><div class="tray" id="tray"><div class="muted">Loading…</div></div>
      <div class="mt"><a class="btn small" href="#/create">＋ New Story</a></div></div>`;
    try {
      const { trays } = await API.get('/stories');
      const tray = document.getElementById('tray');
      if (!trays.length) { tray.innerHTML = `<div class="muted">No active stories right now.</div>`; return; }
      tray.innerHTML = trays.map((t, i) => `
        <div><button class="story-ring" data-i="${i}"><span>${esc(t.user.avatar_emoji)}</span></button>
        <div class="story-label">${esc(t.user.display_name)}</div></div>`).join('');
      tray.querySelectorAll('.story-ring').forEach(btn => {
        btn.onclick = () => Views.storyViewer(trays[+btn.dataset.i], 0);
      });
      Views._trays = trays;
    } catch (e) { document.getElementById('tray').innerHTML = `<div class="muted">Couldn't load stories.</div>`; }
  },

  storyViewer(tray, idx) {
    const stories = tray.stories;
    let i = idx, timer = null, progress = 0;
    const root = document.createElement('div');
    root.className = 'viewer';
    document.body.appendChild(root);
    const close = () => { clearInterval(timer); root.remove(); };

    function render() {
      const s = stories[i];
      root.innerHTML = `
        <div class="viewer-bars">${stories.map((_, k) => `<i><b id="bar${k}" style="width:${k < i ? 100 : 0}%"></b></i>`).join('')}</div>
        <div class="viewer-head">${avatarHtml(tray.user, 36)}
          <div><b>${esc(tray.user.display_name)}</b> ${badgesHtml(tray.user)}<div class="muted" style="color:#ccc">${timeAgo(s.created_at)}</div></div>
          <button class="viewer-close" id="vClose">✕</button></div>
        <div class="viewer-body">
          <div class="viewer-tap left" id="vPrev"></div>
          ${s.image_url ? `<img src="${esc(s.image_url)}">` : `<div class="viewer-text">${esc(s.text)}</div>`}
          ${s.image_url && s.text ? `<div class="lum-cap">${esc(s.text)}</div>` : ''}
          <div class="viewer-tap right" id="vNext"></div>
        </div>
        <div class="muted" style="color:#ccc;text-align:center;font-size:12px" id="vReplies"></div>
        <div class="viewer-reply"><input id="vReply" placeholder="Reply to ${esc(tray.user.display_name)}…" maxlength="500">
          <button class="btn small" id="vSend">Send</button></div>`;
      document.getElementById('vClose').onclick = close;
      document.getElementById('vPrev').onclick = () => { i = Math.max(0, i - 1); restart(); };
      document.getElementById('vNext').onclick = () => next();
      document.getElementById('vSend').onclick = sendReply;
      document.getElementById('vReply').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendReply(); });
      loadReplies();
      restart();
    }
    function restart() {
      clearInterval(timer); progress = 0;
      timer = setInterval(() => {
        progress += 2;
        const bar = document.getElementById('bar' + i);
        if (bar) bar.style.width = Math.min(100, progress) + '%';
        if (progress >= 100) next();
      }, 100);
    }
    function next() { if (i < stories.length - 1) { i++; render(); } else close(); }
    async function loadReplies() {
      if (!App.user) return;
      try {
        const { replies } = await API.get(`/stories/${stories[i].id}/replies`);
        document.getElementById('vReplies').textContent = replies.length ? `💬 ${replies.length} repl${replies.length > 1 ? 'ies' : 'y'}` : '';
      } catch (e) { /* ignore */ }
    }
    async function sendReply() {
      const input = document.getElementById('vReply');
      const text = input.value.trim();
      if (!text) return;
      if (!App.user) { toast('Log in to reply to stories'); return; }
      try { await API.post(`/stories/${stories[i].id}/replies`, { text }); input.value = ''; toast('Reply sent 💬'); App.checkMilestones(); }
      catch (e) { toast('Could not send reply'); }
    }
    render();
  },

  /* ---------------- LUMS ---------------- */
  async lums(el) {
    el.innerHTML = `<div class="card center"><div class="muted">Loading Lums…</div></div>`;
    try {
      const { lums } = await API.get('/lums');
      if (!lums.length) { el.innerHTML = `<div class="card center">No Lums yet. <div class="mt"><a class="btn" href="#/create">Upload a Lum</a></div></div>`; return; }
      el.innerHTML = `<div class="lums-scroll">` + lums.map(l => `
        <div class="lum" data-id="${l.id}">
          ${l.video_url ? `<video src="${esc(l.video_url)}" loop playsinline preload="metadata"></video>`
            : `<div class="viewer-body"><div class="viewer-text">${esc(l.caption || '🎬')}</div></div>`}
          <div class="lum-cap">
            <div class="row"><b>${esc(l.display_name)}</b> ${badgesHtml(l)}</div>
            <div>${esc(l.caption || '')}</div>
            <div class="muted" style="color:#ddd">👁 ${l.views || 0} views</div>
          </div>
        </div>`).join('') + `</div>`;
      const seen = new Set();
      const io = new IntersectionObserver((entries) => {
        entries.forEach(en => {
          const v = en.target.querySelector('video');
          const id = en.target.dataset.id;
          if (en.isIntersecting) {
            if (v) v.play().catch(() => {});
            if (!seen.has(id)) { seen.add(id); API.post(`/lums/${id}/view`).catch(() => {}); }
          } else if (v) v.pause();
        });
      }, { threshold: 0.6 });
      el.querySelectorAll('.lum').forEach(x => io.observe(x));
    } catch (e) { el.innerHTML = `<div class="card center">Couldn't load Lums.</div>`; }
  },

  /* ---------------- LIVE ---------------- */
  async live(el) {
    const { streams } = await API.get('/live');
    el.innerHTML = `
      <div class="card"><div class="row"><h3 style="margin:0" class="grow">🔴 Live</h3>
        <a class="btn small ghost" href="#/live-rankings">🏆 Rankings</a>
        ${App.user ? `<button class="btn small" id="goLive">Go Live</button>` : `<span class="muted">Log in to go live</span>`}</div></div>
      ${streams.length ? streams.map(s => `
        <div class="card"><div class="row">
          ${avatarHtml(s)}<div class="grow"><div class="name"><b>${esc(s.display_name)}</b> ${badgesHtml(s)}</div>
          <div class="post-time">${esc(s.title)} · 👁 ${s.viewers_now || 0} watching · 🎤 ${s.on_stage || 0} on stage · 🪙 ${s.coins_earned}</div></div>
          <span class="live-badge">LIVE</span></div>
          <div class="mt"><a class="btn small" href="#/live/${s.id}">Join</a></div></div>`).join('')
        : `<div class="card center muted">Nobody is live right now.</div>`}`;
    const btn = document.getElementById('goLive');
    if (btn) btn.onclick = () => Views.startLiveFlow();
  },

  async liveRoom(el, id) {
    let data;
    try { data = await API.get('/live/' + id); }
    catch (e) { el.innerHTML = `<div class="card center">Stream not found.</div>`; return; }
    const stream = data.stream;
    const isHost = !!(App.user && App.user.id === stream.user_id);
    const RTC_OK = typeof RTCPeerConnection !== 'undefined';
    const ICE = { iceServers: ICE_SERVERS };

    el.innerHTML = `
    <div class="live-room" id="lvRoom">
      <div class="live-stage layout-1" id="lvStage"></div>
      <div class="live-top">
        <div class="live-host-chip">${avatarHtml(stream, 30)}<div class="lhc-txt"><b>${esc(stream.display_name)}</b><span>${esc(stream.title || '')}</span></div><span class="live-badge">LIVE</span>${stream.weekly_champion ? `<span class="live-pill champ">👑 Weekly Champion</span>` : ''}${stream.weekly_rank ? `<span class="live-pill">🏆 #${stream.weekly_rank} this week</span>` : ''}</div>
        <div class="live-top-right"><span class="live-pill">👁 <span id="lvViewers">${stream.viewers_now || 0}</span></span><span class="live-pill">🪙 <span id="lvCoins">${stream.coins_earned || 0}</span></span><button class="live-x" id="lvClose">✕</button></div>
      </div>
      <div class="live-invite hidden" id="lvInvite"></div>
      <div class="live-hearts" id="lvHearts"></div>
      <div class="gift-fx" id="lvGiftFx"></div>
      <div class="top-gifter hidden" id="lvTopGifter"></div>
      <div class="live-rail">
        <button class="rail-btn" id="lvTap">❤️<span>Like</span></button>
        <button class="rail-btn" id="lvShare">↗️<span>Share</span></button>
        <button class="rail-btn" id="lvGift">🎁<span>Gift</span></button>
        <button class="rail-btn" id="lvFiltersBtn">✨<span>Filters</span></button>
        <button class="rail-btn" id="lvSound">🔊<span>Sound</span></button>
        ${isHost ? `<button class="rail-btn" id="lvHost">🎛️<span>Host</span></button>` : `<button class="rail-btn" id="lvStageBtn">🎤<span>Stage</span></button>`}
      </div>
      <div class="live-bottom">
        <div class="live-chat" id="lvChat"></div>
        ${App.user ? `<form class="live-comment" id="lvCommentForm"><input id="lvCommentIn" placeholder="Say something…" maxlength="300" autocomplete="off"><button class="btn small" type="submit">Send</button></form>`
          : `<div class="live-comment"><button class="btn small grow" onclick="Views.authModal()">Log in to comment, tap & gift</button></div>`}
        <div class="live-toggles hidden" id="lvToggles"><button class="rail-btn mini" id="lvMic">🎙️</button><button class="rail-btn mini" id="lvCam">📷</button></div>
      </div>
      <div class="live-filter-rail hidden" id="lvFilterRail"></div>
      <div class="live-sheet hidden" id="lvSheet"></div>
      <div class="live-ended hidden" id="lvEnded"></div>
    </div>`;

    const $ = (x) => document.getElementById(x);
    const stageEl = $('lvStage'), chatEl = $('lvChat'), sheetEl = $('lvSheet');
    let participants = data.participants || [];
    let myPart = data.me || null;
    let onStage = false, localStream = null, destroyed = false, ended = false;
    let lastSignalId = 0, stageSig = '', renderSig = '', prevMyStatus = myPart ? myPart.status : null;
    const seenEvents = new Set();
    const peers = new Map();      // stage mesh: uid -> {pc, stream, cand:[], remoteSet}
    const viewerPcs = new Map();  // host -> viewer pcs
    let recvPc = null, recvCand = [], recvRemoteSet = false, trackOrder = null;
    let hostCandPre = []; const relinkCount = new Map();
    const recvStreams = new Map();
    const timers = [];
    const every = (fn, ms) => { const t = setInterval(fn, ms); timers.push(t); };
    const partOf = (uid) => participants.find(p => p.user_id === uid);
    const nameOf = (uid) => { const p = partOf(uid); return p ? p.display_name : (uid === stream.user_id ? stream.display_name : 'Someone'); };
    const stageUsers = () => participants.filter(p => p.status === 'joined' && ['host', 'cohost', 'guest'].includes(p.role));
    const sigSend = (to, kind, payload) => API.post(`/live/${id}/signal`, { to_id: to, kind, payload: typeof payload === 'string' ? payload : JSON.stringify(payload || {}) }).catch(() => {});

    /* ---------------- gift catalogue, FX, sounds, top gifter ---------------- */
    const GIFT_CATALOG = [
      { name: 'Rose', emoji: '🌹', price: 1 }, { name: 'Heart', emoji: '❤️', price: 5 },
      { name: 'Applause', emoji: '👏', price: 10 }, { name: 'Balloons', emoji: '🎈', price: 25 },
      { name: 'Sundae', emoji: '🍦', price: 49 }, { name: 'Mixtape', emoji: '🎵', price: 99 },
      { name: 'Fireworks', emoji: '🎆', price: 199 }, { name: 'Crown', emoji: '👑', price: 299 },
      { name: 'Rocket', emoji: '🚀', price: 499 }, { name: 'Diamond', emoji: '💎', price: 999 },
      { name: 'Lion', emoji: '🦁', price: 2999 }, { name: 'Galaxy', emoji: '🌌', price: 4999 },
      { name: 'Lumi Castle', emoji: '🏰', price: 9999 },
    ];
    const giftFromNote = (note) => GIFT_CATALOG.find(g => note && note.includes(g.name)) || null;
    const giftTier = (g) => g.price >= 2999 ? 'big' : g.price >= 199 ? 'mid' : 'small';
    // Synthesized gift sounds (WebAudio — no audio files, no recordings).
    const GiftSound = {
      ctx: null,
      get enabled() { return localStorage.getItem('luminous_gift_sound') !== 'off'; },
      set enabled(v) { localStorage.setItem('luminous_gift_sound', v ? 'on' : 'off'); },
      ensure() {
        if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ } }
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      },
      tone(freq, at, dur, type, vol) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type || 'sine'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(vol || 0.12, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        o.connect(g).connect(this.ctx.destination);
        o.start(at); o.stop(at + dur + 0.05);
      },
      boom(at) {
        const len = this.ctx.sampleRate * 0.5;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = this.ctx.createBufferSource(); src.buffer = buf;
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
        const g = this.ctx.createGain(); g.gain.value = 0.22;
        src.connect(f).connect(g).connect(this.ctx.destination);
        src.start(at);
      },
      play(tier) {
        if (!this.enabled) return;
        this.ensure();
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        if (tier === 'small') { this.tone(660, t, 0.12); this.tone(880, t + 0.07, 0.16); }
        else if (tier === 'mid') { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.09, 0.24, 'triangle', 0.12)); }
        else {
          [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, t + i * 0.11, 0.5, 'triangle', 0.13));
          this.boom(t + 0.1); this.boom(t + 0.5);
        }
      },
    };
    const fxEl = $('lvGiftFx');
    const giftTotals = new Map();
    const comboMap = new Map();
    let fxLive = false; // animations only for gifts that arrive after room load
    function bumpTopGifter(name, coins) {
      if (!name || !coins) return;
      giftTotals.set(name, (giftTotals.get(name) || 0) + coins);
      let top = null, topCoins = 0;
      for (const [n, c] of giftTotals) if (c > topCoins) { top = n; topCoins = c; }
      const tg = $('lvTopGifter');
      if (tg && top) { tg.textContent = `🏆 Top gifter: ${top} · 🪙 ${topCoins}`; tg.classList.remove('hidden'); }
    }
    function giftFx(e, g, combo) {
      if (!fxEl || !g) return;
      const tier = giftTier(g);
      if (tier === 'small') {
        const s = document.createElement('span');
        s.className = 'gift-float';
        s.style.left = (8 + Math.random() * 70) + '%';
        s.innerHTML = `${g.emoji}${combo > 1 ? `<b class="combo">×${combo}</b>` : ''}`;
        fxEl.appendChild(s);
        setTimeout(() => s.remove(), 2800);
      } else if (tier === 'mid') {
        const d = document.createElement('div');
        d.className = 'gift-mid fx-' + g.name.toLowerCase().replace(/\s+/g, '-');
        d.innerHTML = `<span class="gm-emoji">${g.emoji}</span>` +
          Array.from({ length: 10 }, (_, i) => `<span class="gm-spark" style="--a:${i * 36}deg">✦</span>`).join('') +
          (combo > 1 ? `<b class="combo">×${combo}</b>` : '');
        fxEl.appendChild(d);
        setTimeout(() => d.remove(), 2400);
      } else {
        const d = document.createElement('div');
        d.className = 'gift-big fx-' + g.name.toLowerCase().replace(/\s+/g, '-');
        d.innerHTML = `<span class="gb-emoji">${g.emoji}</span><div class="gb-name">${esc(g.name)}</div>
          <div class="gb-from">${esc(e.display_name || 'Someone')} sent it!</div>` +
          (combo > 1 ? `<b class="combo">×${combo}</b>` : '');
        fxEl.appendChild(d);
        setTimeout(() => d.remove(), 3200);
      }
      GiftSound.play(tier);
    }

    /* ---------------- chat / events ---------------- */
    function chatLine(html, sys) {
      const d = document.createElement('div');
      d.className = 'lv-msg' + (sys ? ' sys' : '');
      d.innerHTML = html;
      chatEl.appendChild(d);
      while (chatEl.children.length > 60) chatEl.removeChild(chatEl.firstChild);
      chatEl.scrollTop = chatEl.scrollHeight;
    }
    function showEvent(e) {
      if (seenEvents.has(e.id)) return;
      seenEvents.add(e.id);
      if (e.kind === 'comment') chatLine(`<b>${esc(e.display_name || 'Someone')}</b> ${esc(e.note || '')}`);
      else if (e.kind === 'gift') {
        const g = giftFromNote(e.note);
        bumpTopGifter(e.display_name, e.coins);
        if (g) {
          const key = (e.display_name || '') + '|' + g.name;
          const now = Date.now();
          const prev = comboMap.get(key);
          const combo = prev && now - prev.at < 5000 ? prev.n + 1 : 1;
          comboMap.set(key, { n: combo, at: now });
          chatLine(`🎁 <b>${esc(e.display_name || 'Someone')}</b> sent ${g.emoji} ${esc(g.name)}${combo > 1 ? ` ×${combo}` : ''}`, true);
          if (fxLive) giftFx(e, g, combo);
        } else {
          chatLine(`🎁 <b>${esc(e.display_name || 'Someone')}</b> sent ${e.coins} coins${e.note ? ' — ' + esc(e.note) : ''}`, true);
        }
      }
      else if (e.kind === 'rank') chatLine(`📈 <b>${esc(e.display_name || 'The host')}</b> ${esc(e.note || '')}`, true);
      else if (e.kind === 'stage') chatLine(`🎤 <b>${esc(e.display_name || 'Someone')}</b> ${esc(e.note || '')}`, true);
    }
    (data.events || []).slice(-25).forEach(showEvent);
    fxLive = true;

    /* ---------------- stage rendering ---------------- */
    function streamFor(uid) {
      if (App.user && uid === App.user.id) return localStream;
      const p = peers.get(uid);
      if (p && p.stream) return p.stream;
      return recvStreams.get(uid) || null;
    }
    function renderStage() {
      const users = stageUsers();
      const sig = users.map(u => u.user_id + ':' + (streamFor(u.user_id) ? 1 : 0)).join(',');
      if (sig === renderSig) return;
      renderSig = sig;
      const n = users.length;
      stageEl.className = 'live-stage ' + (n <= 1 ? 'layout-1' : n === 2 ? 'layout-2' : 'layout-multi');
      stageEl.innerHTML = users.map(u => {
        const s = streamFor(u.user_id);
        return `<div class="live-box">${s ? `<video id="lv-vid-${u.user_id}" autoplay playsinline ${App.user && u.user_id === App.user.id ? 'muted' : ''}></video>`
          : `<div class="live-box-empty"><div class="lbe-ava">${esc(u.avatar_emoji || '🎥')}</div><div class="muted">connecting…</div></div>`}
          <div class="live-box-tag">${u.role === 'host' ? '👑' : '🎤'} ${esc(u.display_name)}</div></div>`;
      }).join('') || `<div class="live-box"><div class="live-box-empty"><div class="lbe-ava">${esc(stream.avatar_emoji || '🔴')}</div><div class="muted">Waiting for the host's video…</div></div></div>`;
      users.forEach(u => {
        const v = document.getElementById('lv-vid-' + u.user_id);
        const s = streamFor(u.user_id);
        if (v && s && v.srcObject !== s) {
          v.srcObject = s;
          const mine = App.user && u.user_id === App.user.id;
          if (!mine) {
            v.title = 'Tap video for sound on/off';
            v.onclick = () => { v.muted = !v.muted; toast(v.muted ? 'Sound off' : 'Sound on'); };
          }
          const pr = v.play();
          if (pr && pr.catch) pr.catch(() => { if (!mine && !v.muted) { v.muted = true; v.play().catch(() => {}); } });
        }
      });
      applyPreviewFilter();
    }

    /* ---------------- WebRTC: stage mesh ---------------- */
    function wirePc(pc, uid, store) {
      pc.ontrack = (ev) => {
        if (!store.stream) store.stream = new MediaStream();
        if (!store.stream.getTracks().includes(ev.track)) store.stream.addTrack(ev.track);
        renderStage();
      };
      pc.onicecandidate = (ev) => { if (ev.candidate) sigSend(uid, 'candidate', ev.candidate.toJSON()); };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          const n = (relinkCount.get(uid) || 0) + 1; relinkCount.set(uid, n);
          closePeer(uid);
          if (n <= 4) sigSend(uid, 'relink', {});
          renderSig = ''; renderStage();
        }
      };
    }
    function makePeer(uid) {
      let p = peers.get(uid);
      if (p) return p;
      const pc = new RTCPeerConnection(ICE);
      p = { pc, stream: null, cand: [], remoteSet: false };
      peers.set(uid, p);
      wirePc(pc, uid, p);
      if (localStream) localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
      return p;
    }
    async function flushCand(p, pc) {
      for (const c of p.cand.splice(0)) { try { await pc.addIceCandidate(c); } catch (e) {} }
    }
    async function offerTo(uid) {
      const p = makePeer(uid);
      try {
        const offer = await p.pc.createOffer();
        await p.pc.setLocalDescription(offer);
        sigSend(uid, 'offer', p.pc.localDescription.toJSON());
      } catch (e) {}
    }
    function closePeer(uid) {
      const p = peers.get(uid);
      if (p) { try { p.pc.close(); } catch (e) {} peers.delete(uid); }
      const v = viewerPcs.get(uid);
      if (v) { try { v.pc.close(); } catch (e) {} viewerPcs.delete(uid); }
    }

    /* ---------------- WebRTC: host -> viewer forwarding ---------------- */
    function buildViewerLink(vuid) {
      closePeer(vuid);
      const pc = new RTCPeerConnection(ICE);
      const link = { pc, cand: [], remoteSet: false };
      viewerPcs.set(vuid, link);
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          const n = (relinkCount.get(vuid) || 0) + 1; relinkCount.set(vuid, n);
          closePeer(vuid);
          if (n <= 4) sigSend(vuid, 'relink', {});
        }
      };
      const trackOwner = new Map();
      const addSrc = (s, owner) => { if (s) s.getTracks().forEach(t => { pc.addTrack(t, s); trackOwner.set(t.id, owner); }); };
      addSrc(localStream, App.user.id);
      stageUsers().forEach(u => { if (u.user_id !== App.user.id) { const p = peers.get(u.user_id); if (p) addSrc(p.stream, u.user_id); } });
      pc.onicecandidate = (ev) => { if (ev.candidate) sigSend(vuid, 'candidate', ev.candidate.toJSON()); };
      const order = pc.getSenders().map(s => trackOwner.get(s.track.id) || App.user.id);
      sigSend(vuid, 'track-map', { order });
      pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => sigSend(vuid, 'offer', pc.localDescription.toJSON())).catch(() => {});
    }
    function syncViewerLinks() {
      if (!isHost || !onStage) return;
      const viewers = participants.filter(p => p.role === 'viewer' && p.status === 'joined');
      viewers.forEach(v => {
        const link = viewerPcs.get(v.user_id);
        if (!link) buildViewerLink(v.user_id);
        else if (['failed', 'closed'].includes(link.pc.connectionState)) { closePeer(v.user_id); buildViewerLink(v.user_id); }
      });
      [...viewerPcs.keys()].forEach(uid => { if (!partOf(uid) || partOf(uid).role !== 'viewer') closePeer(uid); });
    }
    function rebuildViewerLinks() {
      if (!isHost) return;
      [...viewerPcs.keys()].forEach(uid => closePeer(uid));
      syncViewerLinks();
    }

    /* ---------------- WebRTC: viewer receive ---------------- */
    function mapRecvTracks() {
      if (!recvPc || !trackOrder) return;
      const groups = new Map();
      recvPc.getReceivers().forEach((r, i) => {
        const uid = trackOrder[i];
        if (uid == null || !r.track) return;
        if (!groups.has(uid)) groups.set(uid, new MediaStream());
        const ms = groups.get(uid);
        if (!ms.getTracks().includes(r.track)) ms.addTrack(r.track);
      });
      recvStreams.clear();
      groups.forEach((ms, uid) => recvStreams.set(uid, ms));
      renderSig = '';
      renderStage();
    }

    /* ---------------- signaling ---------------- */
    async function handleSignal(s) {
      lastSignalId = Math.max(lastSignalId, s.id);
      let payload = {};
      try { payload = JSON.parse(s.payload || '{}'); } catch (e) { return; }
      const from = s.from_id;
      try {
        if (s.kind === 'relink') {
          if (isHost && onStage) { const fp = partOf(from); if (fp && fp.role === 'viewer' && fp.status === 'joined') { closePeer(from); buildViewerLink(from); } }
          if (!onStage && from === stream.user_id && recvPc) { try { recvPc.close(); } catch (e) {} recvPc = null; recvRemoteSet = false; recvCand = []; recvStreams.delete(stream.user_id); renderSig = ''; renderStage(); }
          if (onStage && peers.has(from)) { closePeer(from); if (App.user && App.user.id < from) offerTo(from); }
          return;
        }
        if (s.kind === 'track-map') { trackOrder = payload.order || null; setTimeout(mapRecvTracks, 350); return; }
        if (s.kind === 'bye') { closePeer(from); if (recvPc && from === stream.user_id) { /* host link may rebuild */ } renderStage(); return; }
        if (s.kind === 'candidate') {
          const cand = new RTCIceCandidate(payload);
          if (from === stream.user_id && !peers.has(from)) {
            if (recvPc) { if (recvRemoteSet) { try { await recvPc.addIceCandidate(cand); } catch (e) {} } else recvCand.push(cand); }
            else if (!onStage) hostCandPre.push(cand);
            return;
          }
          const vp = viewerPcs.get(from);
          if (vp) { if (vp.remoteSet) { try { await vp.pc.addIceCandidate(cand); } catch (e) {} } else vp.cand.push(cand); return; }
          const p = peers.get(from);
          if (p) { if (p.remoteSet) { try { await p.pc.addIceCandidate(cand); } catch (e) {} } else p.cand.push(cand); }
          return;
        }
        if (s.kind === 'offer') {
          const fromPart = partOf(from);
          const fromIsStage = fromPart && fromPart.status === 'joined' && ['host', 'cohost', 'guest'].includes(fromPart.role);
          if (onStage && fromIsStage) {
            const p = makePeer(from);
            await p.pc.setRemoteDescription(new RTCSessionDescription(payload));
            p.remoteSet = true; await flushCand(p, p.pc);
            const ans = await p.pc.createAnswer();
            await p.pc.setLocalDescription(ans);
            sigSend(from, 'answer', p.pc.localDescription.toJSON());
          } else if (!onStage && from === stream.user_id) {
            if (recvPc) { try { recvPc.close(); } catch (e) {} }
            recvPc = new RTCPeerConnection(ICE);
            recvRemoteSet = false; recvCand = [];
            recvPc.ontrack = () => setTimeout(mapRecvTracks, 350);
            recvPc.onconnectionstatechange = () => {
              if (recvPc && recvPc.connectionState === 'failed') {
                try { recvPc.close(); } catch (e) {} recvPc = null; recvRemoteSet = false; recvCand = [];
                sigSend(stream.user_id, 'relink', {});
              }
            };
            recvPc.onicecandidate = (ev) => { if (ev.candidate) sigSend(from, 'candidate', ev.candidate.toJSON()); };
            await recvPc.setRemoteDescription(new RTCSessionDescription(payload));
            recvRemoteSet = true;
            for (const c of recvCand.splice(0)) { try { await recvPc.addIceCandidate(c); } catch (e) {} }
            for (const c of hostCandPre.splice(0)) { try { await recvPc.addIceCandidate(c); } catch (e) {} }
            const ans = await recvPc.createAnswer();
            await recvPc.setLocalDescription(ans);
            sigSend(from, 'answer', recvPc.localDescription.toJSON());
            setTimeout(mapRecvTracks, 600); setTimeout(mapRecvTracks, 1600);
          }
          return;
        }
        if (s.kind === 'answer') {
          const vp = viewerPcs.get(from);
          if (vp) { try { await vp.pc.setRemoteDescription(new RTCSessionDescription(payload)); vp.remoteSet = true; for (const c of vp.cand.splice(0)) { try { await vp.pc.addIceCandidate(c); } catch (e) {} } } catch (e) {} return; }
          const p = peers.get(from);
          if (p) { await p.pc.setRemoteDescription(new RTCSessionDescription(payload)); p.remoteSet = true; await flushCand(p, p.pc); }
          return;
        }
      } catch (e) { /* ignore malformed signal */ }
    }

    /* ---------------- live filters (TikTok-style) ----------------
       The HOST's camera runs through a canvas: looks via ctx.filter, fun
       overlays drawn per frame, and canvas.captureStream() is what's
       published — viewers see the filtered feed. Switching filters only
       changes the drawing, never the stream. Guests/co-hosts get the
       looks on their own preview only. If canvas capture is missing,
       the host degrades to preview-only with an honest note. */
    const LIVE_LOOKS = [
      ['natural', 'Natural', 'none'], ['glow', 'Glow', 'brightness(1.12) saturate(1.1) contrast(0.95)'],
      ['vivid', 'Vivid', 'saturate(1.55) contrast(1.08)'], ['warm', 'Warm', 'sepia(0.32) saturate(1.3) brightness(1.04)'],
      ['cool', 'Cool', 'hue-rotate(-14deg) saturate(0.9) brightness(1.05)'], ['noir', 'Noir', 'grayscale(1) contrast(1.25)'],
      ['vintage', 'Vintage', 'sepia(0.55) contrast(1.02) saturate(0.85)'], ['neon', 'Neon', 'saturate(1.8) hue-rotate(20deg) contrast(1.12)'],
    ];
    const LIVE_FUN = [['crown', '👑 Crown'], ['shades', '🕶️ Shades'], ['hearts', '❤️ Hearts'], ['sparkle', '⭐ Sparkle frame']];
    const filterState = { look: 'natural', fun: null };
    let rawStream = null, pipe = null;
    const lookCss = (id) => (LIVE_LOOKS.find(l => l[0] === id) || LIVE_LOOKS[0])[2];
    const CAPTURE_OK = typeof HTMLCanvasElement !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
    function drawFunOverlay(ctx, w, h) {
      const t = Date.now();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (filterState.fun === 'crown') { ctx.font = `${Math.round(w * 0.22)}px serif`; ctx.fillText('👑', w / 2, h * 0.15); }
      else if (filterState.fun === 'shades') { ctx.font = `${Math.round(w * 0.3)}px serif`; ctx.fillText('🕶️', w / 2, h * 0.34); }
      else if (filterState.fun === 'hearts') {
        ctx.font = `${Math.round(w * 0.09)}px serif`;
        for (let i = 0; i < 6; i++) {
          const x = (i * 173 + t / 22) % w;
          const y = h - ((t / 9 + i * 140) % (h * 1.1));
          ctx.fillText('❤️', x, y);
        }
      } else if (filterState.fun === 'sparkle') {
        ctx.font = `${Math.round(w * 0.1)}px serif`;
        [[0.08, 0.1], [0.92, 0.1], [0.08, 0.9], [0.92, 0.9], [0.5, 0.06]].forEach(([px, py], i) => {
          ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t / 300 + i);
          ctx.fillText('⭐', w * px, h * py);
        });
        ctx.globalAlpha = 1;
      }
    }
    function startPipe(raw) {
      const canvas = document.createElement('canvas');
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.srcObject = raw;
      v.play().catch(() => {});
      const ctx = canvas.getContext('2d');
      pipe = { canvas, video: v, raf: 0 };
      const draw = () => {
        if (!pipe) return;
        if (v.videoWidth) {
          if (canvas.width !== v.videoWidth) { canvas.width = v.videoWidth; canvas.height = v.videoHeight; }
          try { ctx.filter = lookCss(filterState.look); } catch (e) { /* older canvas */ }
          ctx.drawImage(v, 0, 0);
          try { ctx.filter = 'none'; } catch (e) {}
          if (filterState.fun) drawFunOverlay(ctx, canvas.width, canvas.height);
        }
        pipe.raf = requestAnimationFrame(draw);
      };
      draw();
      const out = canvas.captureStream(30);
      return new MediaStream([...out.getVideoTracks(), ...raw.getAudioTracks()]);
    }
    function stopPipe() {
      if (!pipe) return;
      cancelAnimationFrame(pipe.raf);
      try { pipe.video.srcObject = null; } catch (e) {}
      pipe = null;
    }
    function applyPreviewFilter() {
      // Guests / degraded hosts: dress up the self-view only.
      if (pipe || !localStream) return;
      stageEl.querySelectorAll('video').forEach(vid => {
        if (vid.srcObject === localStream) vid.style.filter = lookCss(filterState.look) === 'none' ? '' : lookCss(filterState.look);
      });
    }
    function renderFilterRail() {
      const rail = $('lvFilterRail');
      if (!rail) return;
      const note = isHost
        ? (CAPTURE_OK ? 'Viewers see your filtered feed ✨' : 'This browser can’t stream filters — the look applies to your preview; viewers see your plain feed.')
        : 'Filters dress up your own preview — your published feed stays plain.';
      rail.innerHTML = `
        <div class="fr-row"><span class="fr-label">Looks</span>${LIVE_LOOKS.map(([id2, label]) => `<button class="fr-chip${filterState.look === id2 ? ' active' : ''}" data-look="${id2}">${label}</button>`).join('')}</div>
        <div class="fr-row"><span class="fr-label">Fun</span><button class="fr-chip${!filterState.fun ? ' active' : ''}" data-fun="">None</button>${LIVE_FUN.map(([id2, label]) => `<button class="fr-chip${filterState.fun === id2 ? ' active' : ''}" data-fun="${id2}">${label}</button>`).join('')}</div>
        <div class="muted" style="padding:2px 4px 4px">${note}</div>`;
      rail.querySelectorAll('[data-look]').forEach(b => b.onclick = () => { filterState.look = b.dataset.look; renderFilterRail(); applyPreviewFilter(); });
      rail.querySelectorAll('[data-fun]').forEach(b => b.onclick = () => { filterState.fun = b.dataset.fun || null; renderFilterRail(); applyPreviewFilter(); });
    }

    /* ---------------- stage presence ---------------- */
    async function startStage() {
      if (onStage || destroyed) return;
      if (!RTC_OK) { toast('Live video is not supported in this browser'); return; }
      try { rawStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); }
      catch (e) { toast('Camera/mic permission is needed to join the stage 🎤'); return; }
      // Host publishes the filtered canvas feed when the browser supports
      // it; everyone else publishes their camera as before (filters are
      // preview-only for guests/co-hosts).
      if (isHost && CAPTURE_OK) {
        try { localStream = startPipe(rawStream); } catch (e) { localStream = rawStream; }
      } else localStream = rawStream;
      onStage = true;
      applyPreviewFilter();
      $('lvToggles').classList.remove('hidden');
      renderSig = ''; renderStage();
      // full mesh: I initiate to stage members with a higher user id (lower id offers — same rule as calls)
      stageUsers().forEach(u => { if (App.user && u.user_id > App.user.id) offerTo(u.user_id); });
      if (isHost) syncViewerLinks();
    }
    function stopStage() {
      stopPipe();
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      if (rawStream && rawStream !== localStream) rawStream.getTracks().forEach(t => t.stop());
      localStream = null; rawStream = null;
      [...peers.keys()].forEach(uid => { sigSend(uid, 'bye', {}); closePeer(uid); });
      if (isHost) [...viewerPcs.keys()].forEach(uid => closePeer(uid));
      onStage = false;
      $('lvToggles').classList.add('hidden');
      renderSig = ''; renderStage();
    }

    /* ---------------- sheets (gifts / stage / host) ---------------- */
    function openSheet(html) { sheetEl.innerHTML = html + `<button class="btn ghost small mt" id="lvSheetClose" style="width:100%">Close</button>`; sheetEl.classList.remove('hidden'); $('lvSheetClose').onclick = closeSheet; }
    function closeSheet() { sheetEl.classList.add('hidden'); sheetEl.innerHTML = ''; }
    let freeCooldown = false;
    async function openGifts() {
      let bal = 0;
      try { const w = await API.get('/wallet'); bal = w.wallet ? w.wallet.coins : 0; } catch (e) {}
      openSheet(`<h4>🎁 Send a gift</h4>
        <div class="muted">Your balance: 🪙 <span id="lvBal">${bal}</span> · gifts land in ${esc(stream.display_name)}'s stream coins.</div>
        <div class="gift-grid mt">${GIFT_CATALOG.map(g => `
          <button class="gift-item" data-gift-item="${esc(g.name)}" ${bal < g.price ? 'disabled' : ''}>
            <span class="gi-emoji">${g.emoji}</span><span class="gi-name">${esc(g.name)}</span><span class="gi-price">🪙 ${g.price.toLocaleString()}</span>
          </button>`).join('')}</div>
        ${bal < 1 ? `<div class="muted mt">Not enough coins yet — earn them by watching, tapping ❤️ and sharing streams, going live, and finishing weekly missions. Coins are earned, never bought.</div>` : ''}
        <div class="gift-row mt"><button class="btn small ghost" id="lvFreeGift">🎁 Free gift (+1)</button></div>
        <div class="muted mt">Free gift every 20s.</div>`);
      $('lvFreeGift').onclick = async () => {
        if (freeCooldown) { toast('Free gift cooling down… ⏳'); return; }
        const r = await API.post(`/live/${id}/free-gift`).catch(() => null);
        if (r && !r.cooldown) { toast('Free gift sent! 🎁'); freeCooldown = true; setTimeout(() => freeCooldown = false, 20000); }
        else toast('Free gift cooling down… ⏳');
      };
      sheetEl.querySelectorAll('[data-gift-item]').forEach(b => b.onclick = async () => {
        const g = GIFT_CATALOG.find(x => x.name === b.dataset.giftItem);
        if (!g) return;
        b.disabled = true;
        try {
          await API.post(`/live/${id}/gift`, { coins: g.price, note: `${g.emoji} ${g.name}` });
          toast(`Sent ${g.emoji} ${g.name}!`); App.refreshAuth(); closeSheet();
        } catch (e) { toast(e.data?.error || 'Could not send gift'); b.disabled = false; }
      });
    }

    function openStageSheet() {
      const mine = myPart;
      let body = '';
      if (mine && mine.role === 'cohost' && mine.status === 'invited') {
        body = `<p>👑 You've been invited to co-host this stream.</p><div class="row"><button class="btn small" id="lvAccept">Accept & join stage</button><button class="btn small ghost" id="lvDecline">Decline</button></div>`;
      } else if (onStage) {
        body = `<p>You're on stage 🎤</p><button class="btn small ghost" id="lvLeave">Leave stage</button>`;
      } else if (mine && mine.status === 'requested') {
        body = `<p>⏳ Waiting for ${esc(stream.display_name)} to approve your request…</p><button class="btn small ghost" id="lvLeave">Cancel request</button>`;
      } else {
        body = `<p>Ask ${esc(stream.display_name)} to bring you on stage as a guest.</p><button class="btn small" id="lvRequest">🎤 Request to join stage</button>`;
      }
      const on = stageUsers();
      body += `<h4 class="mt">On stage (${on.length}/6)</h4>` + (on.map(u => `<div class="row"><span class="grow">${u.role === 'host' ? '👑' : '🎤'} ${esc(u.display_name)}</span></div>`).join('') || '<div class="muted">Nobody yet.</div>');
      openSheet(`<h4>🎤 Stage</h4>` + body);
      const acc = $('lvAccept'), dec = $('lvDecline'), req = $('lvRequest'), lev = $('lvLeave');
      if (acc) acc.onclick = async () => { await API.post(`/live/${id}/respond-invite`, { accept: true }).catch(() => {}); closeSheet(); pollState(); };
      if (dec) dec.onclick = async () => { await API.post(`/live/${id}/respond-invite`, { accept: false }).catch(() => {}); closeSheet(); pollState(); };
      if (req) req.onclick = async () => { try { await API.post(`/live/${id}/request-guest`); toast('Request sent 🎤'); closeSheet(); pollState(); } catch (e) { toast(e.data?.error || 'Could not request'); } };
      if (lev) lev.onclick = async () => { stopStage(); await API.post(`/live/${id}/leave-stage`).catch(() => {}); closeSheet(); pollState(); };
    }
    function openHostSheet(d) {
      const reqs = participants.filter(p => p.status === 'requested');
      const invited = participants.filter(p => p.status === 'invited');
      const on = stageUsers();
      openSheet(`<h4>🎛️ Host controls</h4>
        <div class="muted">🪙 ${d.stream.coins_earned} coins · 👁 ${d.stream.viewers_now} watching · peak ${d.stream.viewers || 0}</div>
        <h4 class="mt">Guest requests</h4>
        ${reqs.length ? reqs.map(p => `<div class="row"><span class="grow">🎤 ${esc(p.display_name)}</span><button class="btn small" data-acc="${p.user_id}">✓ Bring on</button><button class="btn small ghost" data-den="${p.user_id}">✗</button></div>`).join('') : '<div class="muted">No requests right now.</div>'}
        ${invited.length ? `<div class="muted mt">Invited, waiting: ${invited.map(p => esc(p.display_name)).join(', ')}</div>` : ''}
        <h4 class="mt">Invite a co-host</h4>
        <div class="row"><input id="lvCohostIn" placeholder="Username" class="grow"><button class="btn small" id="lvCohostBtn">Invite</button></div>
        <h4 class="mt">On stage (${on.length}/6)</h4>
        ${on.map(u => `<div class="row"><span class="grow">${u.role === 'host' ? '👑' : '🎤'} ${esc(u.display_name)}</span>${u.user_id !== App.user.id ? `<button class="btn small ghost" data-rem="${u.user_id}">Remove</button>` : ''}</div>`).join('')}
        <div class="row mt"><button class="btn small" id="lvWithdraw">Withdraw (needs 1,000 🪙)</button><button class="btn small ghost" id="lvEnd">End stream</button></div>`);
      sheetEl.querySelectorAll('[data-acc]').forEach(b => b.onclick = async () => { await API.post(`/live/${id}/decide-guest`, { user_id: +b.dataset.acc, approve: true }).catch(() => {}); await pollState(); openHostSheet(lastData); });
      sheetEl.querySelectorAll('[data-den]').forEach(b => b.onclick = async () => { await API.post(`/live/${id}/decide-guest`, { user_id: +b.dataset.den, approve: false }).catch(() => {}); await pollState(); openHostSheet(lastData); });
      sheetEl.querySelectorAll('[data-rem]').forEach(b => b.onclick = async () => { await API.post(`/live/${id}/remove`, { user_id: +b.dataset.rem }).catch(() => {}); await pollState(); openHostSheet(lastData); });
      $('lvCohostBtn').onclick = async () => {
        const username = $('lvCohostIn').value.trim();
        if (!username) return;
        try { await API.post(`/live/${id}/invite-cohost`, { username }); toast('Co-host invite sent 👑'); await pollState(); openHostSheet(lastData); }
        catch (e) { toast(e.data?.error || 'Could not invite'); }
      };
      $('lvWithdraw').onclick = async () => {
        try { const r = await API.post(`/live/${id}/withdraw`); toast(`Withdrew ${r.withdrawn} coins! 🪙`); App.checkMilestones(); App.refreshAuth(); }
        catch (e) { toast(e.data?.error || 'Withdrawal failed'); }
      };
      $('lvEnd').onclick = endStream;
    }

    /* ---------------- end / cleanup ---------------- */
    let lastData = data;
    async function endStream() {
      if (!confirm('End this stream? Coins move to your wallet.')) return;
      let earned = stream.coins_earned;
      try { const r = await API.post(`/live/${id}/end`); earned = r.earned != null ? r.earned : earned; } catch (e) {}
      App.checkMilestones(); App.refreshAuth();
      showEnded(earned);
    }
    function showEnded(earned) {
      if (ended) return;
      ended = true;
      stopStage();
      timers.forEach(clearInterval);
      $('lvEnded').innerHTML = `<div class="card center"><h3>Stream ended</h3>
        <div class="muted">${isHost ? `You earned 🪙 ${earned || 0} coins this stream.` : 'Thanks for watching!'}</div>
        <div class="mt"><a class="btn" href="#/live">Back to Live</a></div></div>`;
      $('lvEnded').classList.remove('hidden');
    }
    function cleanup() {
      if (destroyed) return;
      destroyed = true;
      timers.forEach(clearInterval);
      if (window._liveCleanup === cleanup) window._liveCleanup = null;
      [...peers.keys()].forEach(uid => sigSend(uid, 'bye', {}));
      if (recvPc) sigSend(stream.user_id, 'bye', {});
      [...peers.keys()].forEach(uid => closePeer(uid));
      if (recvPc) { try { recvPc.close(); } catch (e) {} recvPc = null; }
      stopPipe();
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      if (rawStream && rawStream !== localStream) rawStream.getTracks().forEach(t => t.stop());
      localStream = null; rawStream = null;
      if (onStage && !isHost && App.user) API.post(`/live/${id}/leave-stage`).catch(() => {});
      onStage = false;
    }
    window._liveCleanup = cleanup;

    /* ---------------- polling ---------------- */
    async function pollState() {
      if (destroyed || ended) return;
      let d;
      try { d = await API.get('/live/' + id); } catch (e) { return; }
      lastData = d;
      if (d.stream.status !== 'live') { showEnded(d.stream.coins_earned); return; }
      $('lvViewers').textContent = d.stream.viewers_now || 0;
      $('lvCoins').textContent = d.stream.coins_earned || 0;
      participants = d.participants || [];
      const prevStatus = prevMyStatus;
      myPart = d.me || myPart;
      // my-stage transitions
      if (App.user && myPart) {
        if (myPart.status === 'invited' && myPart.role === 'cohost') renderInvite();
        else $('lvInvite').classList.add('hidden');
        if (myPart.status === 'joined' && ['guest', 'cohost'].includes(myPart.role) && !onStage) startStage();
        if (myPart.status === 'kicked' && onStage) { toast('The host removed you from the stage'); stopStage(); }
        if (prevStatus === 'requested' && myPart.status === 'denied') toast('The host passed on your stage request this time');
        prevMyStatus = myPart.status;
      }
      // events
      (d.events || []).forEach(showEvent);
      // stage composition changes
      const sig = stageUsers().map(u => u.user_id).join(',');
      const changed = sig !== stageSig;
      stageSig = sig;
      renderStage();
      if (changed) {
        if (onStage) stageUsers().forEach(u => { if (App.user && u.user_id > App.user.id && !peers.has(u.user_id)) offerTo(u.user_id); });
        if (isHost && onStage) rebuildViewerLinks();
      }
      if (isHost) syncViewerLinks();
      if (!isHost && !onStage && App.user && !recvPc && !recvStreams.get(stream.user_id)) {
        const nowTs = Date.now();
        if (!liveRoom._needLinkAt || nowTs - liveRoom._needLinkAt > 15000) { liveRoom._needLinkAt = nowTs; sigSend(stream.user_id, 'relink', {}); }
      }
      // drop peers for people who left the stage
      if (onStage) [...peers.keys()].forEach(uid => { const p = partOf(uid); if (!p || p.status !== 'joined') closePeer(uid); });
    }
    function renderInvite() {
      const inv = $('lvInvite');
      inv.innerHTML = `<span>👑 <b>${esc(stream.display_name)}</b> invited you to co-host!</span><span class="row"><button class="btn small" id="lvInvAcc">Accept</button><button class="btn small ghost" id="lvInvDec">Decline</button></span>`;
      inv.classList.remove('hidden');
      $('lvInvAcc').onclick = async () => { await API.post(`/live/${id}/respond-invite`, { accept: true }).catch(() => {}); inv.classList.add('hidden'); pollState(); };
      $('lvInvDec').onclick = async () => { await API.post(`/live/${id}/respond-invite`, { accept: false }).catch(() => {}); inv.classList.add('hidden'); pollState(); };
    }
    async function pollSignals() {
      if (destroyed || ended || !App.user) return;
      try {
        const { signals } = await API.get(`/live/${id}/signals?since=${lastSignalId}`);
        for (const s of signals) await handleSignal(s);
      } catch (e) { /* ignore */ }
    }

    /* ---------------- rail + comment wiring ---------------- */
    let taps = 0, tapTimer = null;
    const flushTaps = () => {
      if (taps <= 0) return;
      const n = taps; taps = 0;
      API.post(`/live/${id}/tap`, { taps: n }).catch(() => {});
    };
    $('lvTap').onclick = () => {
      if (!App.user) { toast('Log in to like 💜'); return; }
      taps++;
      const h = document.createElement('div');
      h.className = 'lv-heart';
      h.textContent = ['❤️', '💜', '💛', '✨'][Math.floor(Math.random() * 4)];
      h.style.right = (8 + Math.random() * 30) + 'px';
      $('lvHearts').appendChild(h);
      setTimeout(() => h.remove(), 1800);
      clearTimeout(tapTimer); tapTimer = setTimeout(flushTaps, 1200);
      if (taps >= 10) flushTaps();
    };
    $('lvShare').onclick = async () => {
      if (!App.user) { toast('Log in to share 📣'); return; }
      const r = await API.post(`/live/${id}/share`).catch(() => null);
      toast(r && !r.already ? 'Shared! +10 coins 📣' : 'Already shared');
    };
    $('lvGift').onclick = () => { if (!App.user) { toast('Log in to send gifts 🎁'); return; } openGifts(); };
    const filtersBtn = $('lvFiltersBtn');
    if (filtersBtn) filtersBtn.onclick = () => { const r = $('lvFilterRail'); r.classList.toggle('hidden'); if (!r.classList.contains('hidden')) renderFilterRail(); };
    const soundBtn = $('lvSound');
    if (soundBtn) {
      const paint = () => { soundBtn.innerHTML = GiftSound.enabled ? '🔊<span>Sound</span>' : '🔇<span>Muted</span>'; };
      paint();
      soundBtn.onclick = () => { GiftSound.enabled = !GiftSound.enabled; if (GiftSound.enabled) GiftSound.ensure(); paint(); toast(GiftSound.enabled ? 'Gift sounds on 🔊' : 'Gift sounds off 🔇'); };
    }
    const sb = $('lvStageBtn'); if (sb) sb.onclick = openStageSheet;
    const hb = $('lvHost'); if (hb) hb.onclick = () => openHostSheet(lastData);
    $('lvClose').onclick = () => { if (isHost) endStream(); else { cleanup(); location.hash = '#/live'; } };
    const cf = $('lvCommentForm');
    if (cf) cf.onsubmit = async (ev) => {
      ev.preventDefault();
      const inp = $('lvCommentIn');
      const text = inp.value.trim();
      if (!text) return;
      inp.value = '';
      try {
        const r = await API.post(`/live/${id}/comment`, { text });
        showEvent({ id: r.id, kind: 'comment', display_name: App.user.display_name, note: text });
      } catch (e) { toast('Could not send comment'); }
    };
    const mic = $('lvMic'), cam = $('lvCam');
    if (mic) mic.onclick = () => { if (!localStream) return; const t = localStream.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; mic.classList.toggle('off', !t.enabled); mic.textContent = t.enabled ? '🎙️' : '🔇'; } };
    if (cam) cam.onclick = () => { if (!localStream) return; const t = (rawStream && rawStream.getVideoTracks()[0]) || localStream.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; cam.classList.toggle('off', !t.enabled); cam.textContent = t.enabled ? '📷' : '🚫'; } };

    /* ---------------- boot ---------------- */
    renderStage();
    if (App.user) {
      try {
        const j = await API.post(`/live/${id}/join`);
        if (j && j.participant) { myPart = { ...(myPart || {}), ...j.participant }; prevMyStatus = myPart.status; }
      } catch (e) {}
      API.post(`/live/${id}/watch`).catch(() => {});
      every(() => { if (!destroyed && !ended) API.post(`/live/${id}/heartbeat`).catch(() => {}); }, 15000);
      every(() => { if (!destroyed && !ended) API.post(`/live/${id}/watch`).catch(() => {}); }, 60000);
      every(pollSignals, 1400);
      if (isHost || (myPart && ['guest', 'cohost'].includes(myPart.role) && myPart.status === 'joined')) startStage();
      if (myPart && myPart.status === 'invited' && myPart.role === 'cohost') renderInvite();
    }
    every(pollState, 3000);
  },

  /* ---------------- MENTORS ---------------- */
  async mentors(el) {
    const { mentors, aiConfigured } = await API.get('/mentors');
    el.innerHTML = `<div class="card"><h3 style="margin:0 0 6px">💫 AI Mentors</h3>
      <div class="muted">Real AI guidance on fitness, growth, mindset, nutrition, and business.</div>
      <div class="mt"><a class="btn small ghost" href="#/companions">💜 My AI Companions</a></div></div>
      ${aiConfigured ? '' : aiNotice()}
      <div class="mentor-grid">` + mentors.map(m => `
        <div class="card mentor-card" data-key="${esc(m.key || m.KEY)}">
          <div class="big">${esc(m.emoji)}</div><b>${esc(m.name)}</b>
          <div class="muted">${esc(m.tagline)}</div></div>`).join('') + `</div>`;
    el.querySelectorAll('.mentor-card').forEach(c => c.onclick = () => location.hash = '#/mentors/' + c.dataset.key);
  },

  async mentorChat(el, key) {
    const { mentors, aiConfigured } = await API.get('/mentors');
    const m = mentors.find(x => (x.key || x.KEY) === key);
    if (!m) { el.innerHTML = `<div class="card">Mentor not found.</div>`; return; }
    el.innerHTML = `<div class="card">
      <div class="row"><div style="font-size:36px">${esc(m.emoji)}</div>
        <div class="grow"><h3 style="margin:0">${esc(m.name)}</h3><div class="muted">${esc(m.tagline)}</div></div>
        <a class="btn small ghost" href="#/mentors">← All</a></div>
      ${aiConfigured ? '' : aiNotice()}
      <div class="chat" id="chat"></div>
      <div class="chat-input"><input id="chatIn" placeholder="Ask ${esc(m.name)}…" maxlength="2000">
        <button class="btn" id="chatSend">Send</button></div></div>`;
    const box = document.getElementById('chat');
    const load = async () => {
      try {
        const { messages } = await API.get(`/mentors/${key}/history`);
        box.innerHTML = messages.map(x => `<div class="msg ${x.role}">${esc(x.content)}</div>`).join('') || `<div class="muted center">Say hi to ${esc(m.name)} 👋</div>`;
        box.scrollTop = box.scrollHeight;
      } catch (e) { /* ignore */ }
    };
    await load();
    const send = async () => {
      const inp = document.getElementById('chatIn');
      const text = inp.value.trim(); if (!text) return;
      inp.value = '';
      box.innerHTML += `<div class="msg user">${esc(text)}</div>`;
      box.scrollTop = box.scrollHeight;
      try {
        // Instant-response presentation: no typing indicator, no
        // word-by-word reveal. Streamed chunks are buffered invisibly
        // (no onToken callback) and the reply renders once, complete.
        const r = await API.streamPost(`/mentors/${key}/chat`, { message: text }, null);
        if (r.aiConfigured) box.innerHTML += `<div class="msg assistant">${esc(r.reply)}</div>`;
        else box.innerHTML += `<div class="msg assistant"><i>⚠️ AI is not configured on this server yet.</i></div>`;
      } catch (e) { box.innerHTML += e && e.name === 'AbortError' ? `<div class="msg assistant"><i>⏳ The AI lane is very slow right now — if a reply arrives late it will show when you reopen this chat.</i></div>` : `<div class="msg assistant"><i>Something went wrong.</i></div>`; }
      box.scrollTop = box.scrollHeight;
    };
    document.getElementById('chatSend').onclick = send;
    document.getElementById('chatIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  },

  /* ---------------- COMPANIONS ---------------- */
  async companions(el) {
    const { companions, aiConfigured } = await API.get('/companions');
    el.innerHTML = `<div class="card"><div class="row"><h3 style="margin:0" class="grow">💫 AI Companions</h3>
        <button class="btn small" id="newComp" ${companions.length >= 5 ? 'disabled' : ''}>＋ New (${companions.length}/5)</button></div>
        <div class="muted">Create up to 5 companions with their own personality. Your first unlocks the <b>Kindred Spirit</b> milestone.</div></div>
      ${aiConfigured ? '' : aiNotice()}
      ${companions.length ? `<div class="comp-grid">` + companions.map(c => `
        <div class="card comp-card" data-id="${c.id}" style="--accent:${esc(c.color)};border-top-color:${esc(c.color)}">
          <div style="font-size:44px">${esc(c.avatar_emoji)}</div><b>${esc(c.name)}</b>
          <div class="muted">${c.age} · ${esc(c.gender)}</div>
          <div class="mt"><button class="btn small ghost" data-del="${c.id}">Remove</button></div>
        </div>`).join('') + `</div>`
        : `<div class="card center muted">No companions yet — create your first! 💫</div>`}`;
    document.getElementById('newComp').onclick = () => Views.companionForm();
    el.querySelectorAll('.comp-card').forEach(card => card.onclick = (e) => {
      if (e.target.dataset.del) return;
      location.hash = '#/companions/' + card.dataset.id;
    });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('Remove this companion?')) return;
      await API.del('/companions/' + b.dataset.del).catch(() => {});
      Views.companions(el);
    });
  },

  companionForm() {
    openModal(`<h3 style="margin-top:0">💫 New companion</h3>
      <div class="form-grid">
        <label class="f">Name<input id="cName" maxlength="40" placeholder="e.g. Nova"></label>
        <div class="two">
          <label class="f">Avatar emoji<input id="cEmoji" maxlength="8" value="💫"></label>
          <label class="f">Color<input id="cColor" type="color" value="#a855f7" style="height:44px"></label>
        </div>
        <div class="two">
          <label class="f">Age (18–99)<input id="cAge" type="number" min="18" max="99" value="25"></label>
          <label class="f">Gender<select id="cGender"><option value="woman">Woman (she/her)</option><option value="man">Man (he/him)</option><option value="nonbinary">Non-binary (they/them)</option><option value="other">Other (they/them)</option></select></label>
        </div>
        <label class="f">Traits (up to 4, comma separated)<input id="cTraits" placeholder="witty, loyal, curious, calm"></label>
        <label class="f">Interests (up to 5, comma separated)<input id="cInterests" placeholder="music, hiking, sci-fi, cooking"></label>
        <label class="f">Job / vibe<input id="cJob" maxlength="120" placeholder="e.g. late-night radio host energy"></label>
        <label class="f">Backstory<textarea id="cBack" maxlength="1000" placeholder="Where did you two meet? What's their story?"></textarea></label>
        <div class="row"><button class="btn grow" id="cSave">Create companion</button>
        <button class="btn ghost" onclick="closeModal()">Cancel</button></div>
      </div>`);
    document.getElementById('cSave').onclick = async () => {
      const csv = (id) => document.getElementById(id).value.split(',').map(s => s.trim()).filter(Boolean);
      try {
        const r = await API.post('/companions', {
          name: document.getElementById('cName').value.trim() || 'Companion',
          avatar_emoji: document.getElementById('cEmoji').value.trim() || '💫',
          color: document.getElementById('cColor').value,
          age: document.getElementById('cAge').value,
          gender: document.getElementById('cGender').value,
          traits: csv('cTraits'), interests: csv('cInterests'),
          job_vibe: document.getElementById('cJob').value.trim(),
          backstory: document.getElementById('cBack').value.trim(),
        });
        closeModal();
        if (r.milestone) toast(`🏆 Milestone unlocked: ${r.milestone.name}!`);
        App.checkMilestones();
        location.hash = '#/companions/' + r.id;
      } catch (e) { toast(e.data?.error || 'Could not create companion'); }
    };
  },

  async companionChat(el, id) {
    const { companions, aiConfigured } = await API.get('/companions');
    const c = companions.find(x => x.id === +id);
    if (!c) { el.innerHTML = `<div class="card">Companion not found.</div>`; return; }
    el.innerHTML = `<div class="card">
      <div class="row"><div style="font-size:36px">${esc(c.avatar_emoji)}</div>
        <div class="grow"><h3 style="margin:0">${esc(c.name)}</h3>
        <div class="muted">${c.age} · ${esc(c.gender)} · ${esc((c.traits || []).join(', '))}</div></div>
        <a class="btn small ghost" href="#/companions">← All</a></div>
      ${aiConfigured ? '' : aiNotice()}
      <div class="chat" id="chat"></div>
      <div class="chat-input"><input id="chatIn" placeholder="Chat with ${esc(c.name)}…" maxlength="2000">
        <button class="btn" id="chatSend">Send</button></div></div>`;
    const box = document.getElementById('chat');
    try {
      const { messages } = await API.get(`/companions/${id}/history`);
      box.innerHTML = messages.map(x => `<div class="msg ${x.role}">${esc(x.content)}</div>`).join('') || `<div class="muted center">Say hi to ${esc(c.name)} 💫</div>`;
      box.scrollTop = box.scrollHeight;
    } catch (e) { /* ignore */ }
    const send = async () => {
      const inp = document.getElementById('chatIn');
      const text = inp.value.trim(); if (!text) return;
      inp.value = '';
      box.innerHTML += `<div class="msg user">${esc(text)}</div>`;
      box.scrollTop = box.scrollHeight;
      try {
        // Instant-response presentation: no typing indicator, no
        // word-by-word reveal. Streamed chunks are buffered invisibly
        // (no onToken callback) and the reply renders once, complete.
        const r = await API.streamPost(`/companions/${id}/chat`, { message: text }, null);
        box.innerHTML += r.aiConfigured ? `<div class="msg assistant">${esc(r.reply)}</div>` : `<div class="msg assistant"><i>⚠️ AI is not configured on this server yet.</i></div>`;
      } catch (e) { if (e && e.name === 'AbortError') box.innerHTML += `<div class="msg assistant"><i>⏳ The AI lane is very slow right now — if a reply arrives late it will show when you reopen this chat.</i></div>`; }
      box.scrollTop = box.scrollHeight;
    };
    document.getElementById('chatSend').onclick = send;
    document.getElementById('chatIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  },

  /* ---------------- WALLET ---------------- */
  async wallet(el) {
    const { wallet, canEarn, earnPer1kViews } = await API.get('/wallet');
    const earnDollars = (wallet.earnings_cents / 100).toFixed(2);
    el.innerHTML = `
      <div class="card"><h3 style="margin:0 0 10px">👛 Wallet</h3>
        <div class="stat-grid">
          <div class="stat card"><div class="num">🪙 ${wallet.coins}</div><div class="muted">coins</div></div>
          <div class="stat card"><div class="num">$${earnDollars}</div><div class="muted">ad earnings</div></div>
        </div></div>
      <div class="card"><h4 style="margin:0 0 8px">🏦 Withdraw</h4>
        <div class="muted">Luminous is where you earn. Lumibank is where you withdraw.</div>
        <div class="mt"><a class="btn" href="https://muse.ai/s/lumibank-xdxr6exq7xpxgxoxi9/XVwLxZ6SIAy_7zXHV572ox2fXuZUFhJ7YsDHIAgmFUM" target="_blank" rel="noopener">Withdraw on Lumibank</a></div>
      </div>
      <div class="card"><h4 style="margin:0 0 8px">💰 Creator earnings</h4>
        ${canEarn ? `
          <div class="muted">You earn <b>55% of ad revenue</b> — <b>$${earnPer1kViews.toFixed(2)} per 1,000 real views</b> on your posts. (AI demo-account views never count.)</div>`
        : `<div class="notice">Earnings are for <b>Business</b> and <b>Creator</b> accounts with the <b>✓ Approved</b> identity badge.
            <div class="mt"><a class="btn small" href="#/settings">Upgrade in Settings</a></div></div>`}
      </div>`;
  },

  /* ---------------- PROFILE ---------------- */
  async profile(el, username) {
    let data;
    try { data = await API.get('/users/' + encodeURIComponent(username)); }
    catch (e) { el.innerHTML = `<div class="card center">User not found.</div>`; return; }
    const { user: u, posts, lums, milestones, isOwn, relationship } = data;
    let tab = App._profileTab || 'posts';
    if (tab === 'scheduled' && !isOwn) tab = 'posts';
    const statsRow = [
      u.public_age ? `Age ${u.public_age}` : '',
      u.height ? `Height ${esc(u.height)}` : '',
      u.weight ? `Weight ${esc(u.weight)}` : '',
    ].filter(Boolean).join(' · ');
    el.innerHTML = `
      <div class="card">
        <div class="profile-banner" style="background:${esc(u.profile_color)}"></div>
        <div class="profile-head">${avatarHtml(u, 76)}
          <div class="grow"><h2 style="margin:0">${esc(u.display_name)} ${presenceDotHtml(u, true)}</h2>
            <div class="muted">@${esc(u.username)}</div>
            ${u.is_developer ? `<div class="dev-title">👨‍💻 Founder &amp; Developer of Luminous</div>` : ''}
            <div class="mt">${badgesHtml(u)}${u.weekly_champion ? ` <span class="badge champ">👑 Weekly Champion</span>` : ''}${relationship === 'family' ? ` <span class="badge champ">👨‍👩‍👧 Family</span>` : ''}</div></div>
          ${isOwn ? `<span class="row"><a class="btn small ghost" href="#/companion">🐾 Companion</a><a class="btn small ghost" href="#/appearance">✦ Appearance</a><a class="btn small ghost" href="#/settings">Edit</a></span>` : (App.user ? `<span class="row"><button class="btn small" id="followBtn">${u.is_following ? 'Following ✓' : 'Follow'}</button><button class="btn small ghost" id="notifyBtn" title="Notify me when they post">${u.notify ? '🔔 On' : '🔔'}</button></span>` : '')}
        </div>
        ${!isOwn && App.user && relationship === 'best' ? `<div class="mt"><button class="btn small ghost" id="familyBtn">👨‍👩‍👧 Make Family</button> <span class="muted">Best Friends can become Family</span></div>` : ''}
        ${!isOwn && App.user && relationship === 'family' ? `<div class="mt"><button class="btn small ghost" id="familyBtn">Remove Family status</button></div>` : ''}
        ${u.bio ? `<div class="mt">${esc(u.bio)}</div>` : ''}
        ${statsRow ? `<div class="profile-stats">${statsRow}</div>` : ''}
        ${u.companion ? `<div class="mt"><span class="chip">🐾 ${esc(u.companion.name)} the ${esc(u.companion.species)}</span></div>` : ''}
        ${u.hobbies?.length ? `<div class="chips">${u.hobbies.map(h => `<span class="chip">${esc(h)}</span>`).join('')}</div>` : ''}
        <div class="mt"><b>${u.follower_count ?? 0}</b> <span class="muted">Followers</span> · <b>${u.following_count ?? 0}</b> <span class="muted">Following</span></div>
        <div class="mt"><b>Level ${u.level}</b> <span class="muted">· ${u.xp} XP</span>
          <div class="level-bar"><i style="width:${Math.min(100, (u.xp / (100 * u.level * u.level)) * 100)}%"></i></div></div>
      </div>
      ${trophyCaseHtml(u)}
      <div class="tabs">
        <button data-t="posts" class="${tab === 'posts' ? 'active' : ''}">Posts</button>
        <button data-t="lums" class="${tab === 'lums' ? 'active' : ''}">Lums</button>
        <button data-t="milestones" class="${tab === 'milestones' ? 'active' : ''}">Milestones</button>
        ${isOwn ? `<button data-t="scheduled" class="${tab === 'scheduled' ? 'active' : ''}">🕓 Scheduled</button>` : ''}
      </div>
      <div id="ptab"></div>
      ${passageStarHtml('profile-star', 'ps-profile')}
      <div class="brand-foot">✦ <b>LUMINOUS</b> · Built for creativity, connection, and growth.</div>`;
    el.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { App._profileTab = b.dataset.t; Views.profile(el, username); });
    wirePassageStars(el);
    const followBtn = document.getElementById('followBtn');
    if (followBtn) followBtn.onclick = async () => {
      followBtn.disabled = true;
      try {
        await API.post(`/users/${u.id}/${u.is_following ? 'unfollow' : 'follow'}`, {});
        Views.profile(el, username);
      } catch (e) { toast(e.data?.error || 'Could not follow'); followBtn.disabled = false; }
    };
    const notifyBtn = document.getElementById('notifyBtn');
    if (notifyBtn) notifyBtn.onclick = async () => {
      if (!u.is_following) { toast('Follow them first to get post notifications 🔔'); return; }
      try {
        const r = await API.post(`/users/${u.id}/notify`, { enabled: !u.notify });
        toast(r.notify ? `🔔 You'll be notified when ${u.display_name} posts` : '🔕 Post notifications off');
        Views.profile(el, username);
      } catch (e) { toast(e.data?.error || 'Could not update notifications'); }
    };
    const familyBtn = document.getElementById('familyBtn');
    if (familyBtn) familyBtn.onclick = async () => {
      const make = relationship === 'best';
      if (!make && !confirm('Remove Family status? You stay Best Friends.')) return;
      try {
        await API.post(`/friends/${u.id}/family`, { family: make });
        toast(make ? 'You’re family now 👨‍👩‍👧' : 'Back to Best Friends ⭐');
        Views.profile(el, username);
      } catch (e) { toast(e.data?.message || e.data?.error || 'Could not update'); }
    };
    const ptab = document.getElementById('ptab');
    if (tab === 'scheduled' && isOwn) {
      ptab.innerHTML = `<div class="muted" style="margin:4px 0 8px">Scheduled posts publish automatically at their time.</div><div id="planList"></div><div id="lumPlanList"></div>`;
      loadPlannedPosts();
      loadScheduledLums();
    }
    else if (tab === 'posts') ptab.innerHTML = posts.length ? posts.map(postCard).join('') : `<div class="card center muted">No posts yet.</div>`;
    else if (tab === 'lums') ptab.innerHTML = lums.length ? lums.map(l => `<div class="card"><b>${esc(l.caption || '🎬')}</b><div class="muted">👁 ${l.views} · ${timeAgo(l.created_at)}</div></div>`).join('') : `<div class="card center muted">No Lums yet.</div>`;
    else {
      const { milestones: all } = await API.get('/milestones').catch(() => ({ milestones: [] }));
      const unlocked = new Set(milestones.map(m => m.key));
      ptab.innerHTML = `<div class="ms-grid">` + (all.length ? all : []).map(m => `
        <div class="ms ${unlocked.has(m.key) ? '' : 'locked'}"><div class="t">${unlocked.has(m.key) ? '🏆' : '🔒'} ${esc(m.name)}</div>
        <div class="muted">${esc(m.description)} · +${m.xp_reward} XP</div></div>`).join('') + `</div>`;
    }
  },

  /* ---------------- SETTINGS ---------------- */
  async settings(el) {
    const { user: u } = await API.get('/auth/me');
    // Height/weight are stored as composed display strings ("5'11\"", "180 cm",
    // "82 kg", "180 lb") — parse them back into the unit inputs for editing.
    const hCm = /^(\d+(?:\.\d+)?)\s*cm$/.exec(u.height || '');
    const hFt = /^(\d+)'(\d+)"$/.exec(u.height || '');
    const wKg = /^(\d+(?:\.\d+)?)\s*kg$/.exec(u.weight || '');
    const wLb = /^(\d+(?:\.\d+)?)\s*lb$/.exec(u.weight || '');
    el.innerHTML = `<div class="card"><h3 style="margin:0 0 10px">⚙️ Customize profile</h3>
      <div class="form-grid">
        <label class="f">Display name<input id="sName" value="${esc(u.display_name)}" maxlength="60"></label>
        <label class="f">Bio<textarea id="sBio" maxlength="500">${esc(u.bio || '')}</textarea></label>
        <div class="two">
          <label class="f">Public age<input id="sAge" type="number" min="13" max="120" value="${u.public_age || ''}" placeholder="—"></label>
          <label class="f">Status<select id="sStatus">
            <option value="active" ${u.status === 'active' ? 'selected' : ''}>🟢 Active</option>
            <option value="away" ${u.status === 'away' ? 'selected' : ''}>🟡 Away</option>
            <option value="busy" ${u.status === 'busy' ? 'selected' : ''}>🔴 Busy</option>
            <option value="offline" ${u.status === 'offline' ? 'selected' : ''}>⚫ Offline</option></select></label>
        </div>
        <div class="two">
          <label class="f">Height — unit<select id="sHUnit">
            <option value="cm" ${!hFt ? 'selected' : ''}>cm</option>
            <option value="ftin" ${hFt ? 'selected' : ''}>ft / in</option></select></label>
          <span class="f" id="sHCmWrap" style="${hFt ? 'display:none' : ''}">Height (cm)<input id="sHCm" type="number" min="0" step="0.1" value="${hCm ? hCm[1] : ''}" placeholder="—"></span>
          <span class="f" id="sHFtWrap" style="${hFt ? '' : 'display:none'}">Height (ft + in)<span class="row"><input id="sHFt" type="number" min="0" value="${hFt ? hFt[1] : ''}" placeholder="ft"><input id="sHIn" type="number" min="0" max="11" value="${hFt ? hFt[2] : ''}" placeholder="in"></span></span>
        </div>
        <div class="two">
          <label class="f">Weight — unit<select id="sWUnit">
            <option value="kg" ${!wLb ? 'selected' : ''}>kg</option>
            <option value="lbs" ${wLb ? 'selected' : ''}>lbs</option></select></label>
          <label class="f">Weight<input id="sWVal" type="number" min="0" step="0.1" value="${wKg ? wKg[1] : (wLb ? wLb[1] : '')}" placeholder="—"></label>
        </div>
        <div class="two">
          <label class="f">Profile color<input id="sColor" type="color" value="${esc(u.profile_color || '#a855f7')}" style="height:44px"></label>
          <label class="f">Avatar emoji<input id="sEmoji" value="${esc(u.avatar_emoji)}" maxlength="8"></label>
        </div>
        <div class="two">
          <label class="f">Layout<select id="sLayout">
            <option value="grid" ${u.layout === 'grid' ? 'selected' : ''}>Grid</option>
            <option value="list" ${u.layout === 'list' ? 'selected' : ''}>List</option></select></label>
          <label class="f">Hobbies (comma separated)<input id="sHobbies" value="${esc((u.hobbies || []).join(', '))}"></label>
        </div>
        <button class="btn" id="sSave">Save profile</button>
      </div></div>
      <div class="card"><h3 style="margin:0 0 10px">💼 Account type</h3>
        <div class="muted">Current: <b>${esc(u.account_type)}</b> ${u.verified ? '<span class="badge">✓ Approved</span>' : ''}</div>
        <div class="row mt">
          <select id="sType">
            <option value="personal">Personal</option>
            <option value="business">Business</option>
            <option value="creator">Content Creator</option>
          </select>
          <button class="btn small" id="sTypeBtn">Switch</button>
        </div>
        ${['business', 'creator'].includes(u.account_type) && !u.verified ? `
          <div class="notice mt">Business/Creator accounts earn <b>55% of ad revenue ($3.30 / 1,000 views)</b> once identity-verified.
          <div class="mt"><button class="btn small" id="sVerify">✓ Verify my identity</button></div></div>` : ''}
        ${u.verified ? `<div class="muted mt">✓ Identity verified — you're earning on real post views.</div>` : ''}
      </div>`;
    document.getElementById('sType').value = u.account_type;
    const hUnit = document.getElementById('sHUnit');
    hUnit.onchange = () => {
      document.getElementById('sHCmWrap').style.display = hUnit.value === 'cm' ? '' : 'none';
      document.getElementById('sHFtWrap').style.display = hUnit.value === 'ftin' ? '' : 'none';
    };
    document.getElementById('sSave').onclick = async () => {
      try {
        let height = '';
        if (hUnit.value === 'cm') { const v = document.getElementById('sHCm').value.trim(); if (v) height = `${v} cm`; }
        else { const ft = document.getElementById('sHFt').value.trim(), inch = document.getElementById('sHIn').value.trim(); if (ft) height = `${ft}'${inch || 0}"`; }
        const wv = document.getElementById('sWVal').value.trim();
        const weight = wv ? `${wv} ${document.getElementById('sWUnit').value === 'lbs' ? 'lb' : 'kg'}` : '';
        await API.patch('/profile', {
          display_name: document.getElementById('sName').value,
          bio: document.getElementById('sBio').value,
          public_age: document.getElementById('sAge').value || null,
          height, weight,
          status: document.getElementById('sStatus').value,
          profile_color: document.getElementById('sColor').value,
          avatar_emoji: document.getElementById('sEmoji').value || '✨',
          layout: document.getElementById('sLayout').value,
          hobbies: document.getElementById('sHobbies').value.split(',').map(s => s.trim()).filter(Boolean),
        });
        toast('Profile saved ✨'); App.refreshAuth();
      } catch (e) { toast('Could not save'); }
    };
    document.getElementById('sTypeBtn').onclick = async () => {
      try { await API.post('/profile/account-type', { account_type: document.getElementById('sType').value }); toast('Account type updated'); Views.settings(el); App.refreshAuth(); }
      catch (e) { toast('Could not switch'); }
    };
    const v = document.getElementById('sVerify');
    if (v) v.onclick = async () => {
      try {
        const r = await API.post('/profile/verify');
        if (r.milestone) toast(`🏆 Milestone unlocked: ${r.milestone.name}!`);
        toast('✓ Identity verified — Approved badge earned'); Views.settings(el); App.refreshAuth();
      } catch (e) { toast(e.data?.error || 'Verification failed'); }
    };
  },

  /* ---------------- CREATE ---------------- */
  /* ---------------- CREATE (modern sheet flow) ---------------- */
  async startLiveFlow() {
    if (!App.user) { Views.authModal(); return; }
    const title = prompt('Stream title:', 'Live now ✨') || 'Live now ✨';
    try {
      const { id } = await API.post('/live/start', { title });
      App.checkMilestones();
      location.hash = '#/live/' + id;
    } catch (e) { toast(e.data?.error === 'You already have a live stream' ? 'You already have a live stream' : 'Could not start stream'); }
  },

  // Bottom-sheet Create menu (raised ＋ button / FAB / create bar).
  createMenu() {
    if (!App.user) { Views.authModal(); return; }
    const old = document.getElementById('createRoot');
    if (old) old.remove();
    const root = document.createElement('div');
    root.id = 'createRoot';
    root.className = 'sheet-overlay';
    root.innerHTML = `
      <div class="sheet-panel">
        <div class="sheet-grip"></div>
        <div class="row"><h3 style="margin:0" class="grow">Create</h3>
          <button class="icon-btn" id="cmClose" aria-label="Close">✕</button></div>
        <button class="create-opt" data-co="post"><span class="co-ic">📸</span><span class="grow"><b>Post</b><div class="muted">Photo post for your feed</div></span></button>
        <button class="create-opt" data-co="lum"><span class="co-ic">🎬</span><span class="grow"><b>Lum</b><div class="muted">Short video</div></span></button>
        <button class="create-opt" data-co="story"><span class="co-ic">📖</span><span class="grow"><b>Story</b><div class="muted">Disappears in 24 hours</div></span></button>
        <button class="create-opt" data-co="camera"><span class="co-ic">🤳</span><span class="grow"><b>Camera</b><div class="muted">Fun filters &amp; stickers</div></span></button>
        <button class="create-opt" data-co="live"><span class="co-ic">🔴</span><span class="grow"><b>Go Live</b><div class="muted">Stream to your people</div></span></button>
      </div>`;
    document.body.appendChild(root);
    document.documentElement.style.overflow = 'hidden';
    const close = () => { root.remove(); document.documentElement.style.overflow = ''; };
    root.addEventListener('click', (e) => { if (e.target === root) close(); });
    root.querySelector('#cmClose').onclick = close;
    root.querySelectorAll('[data-co]').forEach(b => b.onclick = () => {
      const k = b.dataset.co;
      close();
      if (k === 'live') Views.startLiveFlow();
      else if (k === 'camera') CameraUI.open({ onCapture: (file) => Views.createEditor('post', file) });
      else Views.createEditor(k);
    });
  },

  // Two-step full-screen create sheet: (1) pick media, (2) preview + caption.
  // Posts/Lums can be scheduled (Posts → the planned-posts system,
  // Lums → publish_at). Same endpoints + field names as the old composer.
  createEditor(kind, presetFile) {
    if (!App.user) { Views.authModal(); return; }
    const old = document.getElementById('editorRoot');
    if (old) old.remove();
    const TITLES = { post: 'New post', lum: 'New Lum', story: 'New story' };
    const MAXLEN = { post: 2000, lum: 500, story: 500 };
    const ACCEPT = { post: 'image/*,video/*', lum: 'video/*', story: 'image/*' };
    const root = document.createElement('div');
    root.id = 'editorRoot';
    root.className = 'editor-overlay';
    root.innerHTML = `
      <div class="editor-head">
        <button class="btn small ghost" id="edClose">✕</button>
        <div class="grow center" style="font-weight:800">${TITLES[kind]}</div>
        <button class="btn small" id="edPost" disabled>Post</button>
      </div>
      <div class="editor-progress hidden" id="edProg"><span id="edProgFill"></span></div>
      <div class="editor-body">
        <div id="edStep1">
          <button class="pick-zone" id="edPick">
            <span style="font-size:42px">${kind === 'lum' ? '🎬' : '🖼️'}</span>
            <b>${kind === 'lum' ? 'Tap to choose a video' : 'Tap to choose media'}</b>
            <span class="muted">${kind === 'lum' ? 'Videos post as a Lum' : kind === 'story' ? 'A photo for your story' : 'Photo, or a video (posts as a Lum)'}</span>
          </button>
          <button class="btn ghost" id="edCamera" style="width:100%;margin-top:10px">📸 Camera — filters &amp; stickers</button>
          ${kind === 'post' ? `<button class="btn ghost" id="edTextOnly" style="width:100%;margin-top:10px">Text only →</button>` : ''}
          <input type="file" id="edFile" accept="${ACCEPT[kind]}" class="hidden">
        </div>
        <div id="edStep2" class="hidden">
          <div class="preview-wrap" id="edPreview"></div>
          <div class="row mt"><span class="muted grow" id="edFileName"></span><button class="btn small ghost" id="edChange">Change</button></div>
          <textarea id="edCaption" maxlength="${MAXLEN[kind]}" placeholder="${kind === 'story' ? 'Story text…' : 'Write a caption… #hashtags welcome'}"></textarea>
          <div class="row"><span class="cap-count" id="edCount">0/${MAXLEN[kind]}</span><span class="grow"></span></div>
          <div class="tag-chips" id="edTags"></div>
          ${kind === 'post' ? `<div class="feel-row" id="edFeelRow"></div>
          <div class="row mt"><button class="chip-btn" id="edFeelBtn">◎ Feeling</button><span class="muted" id="edFeelLabel"></span></div>` : ''}
          ${kind !== 'story' ? `
          <div class="sched-row">
            <div class="grow"><b>🕒 Schedule</b><div class="muted">Publish at a specific date &amp; time</div></div>
            <button class="toggle-pill" id="edSchedToggle" aria-pressed="false"><span></span></button>
          </div>
          <div class="hidden" id="edSchedBox">
            <input type="datetime-local" id="edWhen">
            <div class="muted mt">Scheduled posts publish automatically at their time.</div>
          </div>` : ''}
        </div>
      </div>`;
    document.body.appendChild(root);
    document.documentElement.style.overflow = 'hidden';
    let file = presetFile || null, fileUrl = null, feeling = '', scheduled = false;
    const $ = (id) => root.querySelector('#' + id);
    const close = () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      root.remove();
      document.documentElement.style.overflow = '';
    };
    const goFeed = () => {
      if (!location.hash || location.hash === '#/' || location.hash === '#') {
        const appEl = document.getElementById('app');
        if (appEl) Views.feed(appEl);
      } else location.hash = '#/';
    };
    const setFile = (f) => {
      file = f || null;
      if (fileUrl) { URL.revokeObjectURL(fileUrl); fileUrl = null; }
      const pv = $('edPreview');
      if (file) {
        fileUrl = URL.createObjectURL(file);
        pv.innerHTML = file.type.startsWith('video/')
          ? `<video src="${fileUrl}" controls playsinline></video>`
          : `<img src="${fileUrl}" alt="Selected media">`;
        $('edFileName').textContent = file.name || 'Camera photo';
      } else if (kind === 'post') {
        pv.innerHTML = `<div class="text-preview">${avatarHtml(App.user, 40)}<div><b>${esc(App.user.display_name)}</b><div class="muted">Text post</div></div></div>`;
        $('edFileName').textContent = '';
      }
      $('edStep1').classList.add('hidden');
      $('edStep2').classList.remove('hidden');
      updatePostBtn();
    };
    const updatePostBtn = () => {
      const btn = $('edPost');
      btn.textContent = scheduled ? 'Schedule' : (kind === 'story' ? 'Share' : 'Post');
      const hasText = $('edCaption').value.trim().length > 0;
      btn.disabled = !(file || (kind === 'post' && hasText) || (kind === 'story' && hasText));
    };
    $('edClose').onclick = close;
    $('edPick').onclick = () => $('edFile').click();
    $('edChange').onclick = () => $('edFile').click();
    $('edFile').onchange = () => { const f = $('edFile').files[0]; if (f) setFile(f); };
    const camBtn = $('edCamera');
    if (camBtn) camBtn.onclick = () => CameraUI.open({ onCapture: (f) => setFile(f) });
    const textOnly = $('edTextOnly');
    if (textOnly) textOnly.onclick = () => setFile(null);
    const cap = $('edCaption');
    cap.addEventListener('input', () => {
      $('edCount').textContent = `${cap.value.length}/${MAXLEN[kind]}`;
      const tags = [...new Set((cap.value.match(/#[\p{L}\p{N}_]+/gu) || []))].slice(0, 8);
      $('edTags').innerHTML = tags.map(t => `<span class="tag-chip">${esc(t)}</span>`).join('');
      updatePostBtn();
    });
    if (kind === 'post') {
      const FEELINGS = [['😊', 'happy'], ['🥰', 'loved'], ['🔥', 'fired up'], ['✨', 'inspired'], ['😴', 'sleepy'], ['😎', 'cool']];
      const row = $('edFeelRow');
      row.innerHTML = FEELINGS.map(([e, l]) => `<button class="feel-btn" data-feel="${e}|${l}">${e} ${l}</button>`).join('');
      $('edFeelBtn').onclick = () => row.classList.toggle('open');
      row.querySelectorAll('[data-feel]').forEach(b => b.onclick = () => {
        const [e, l] = b.dataset.feel.split('|');
        feeling = ` — feeling ${e} ${l}`;
        $('edFeelLabel').textContent = `Feeling ${e} ${l}`;
        row.classList.remove('open');
      });
    }
    if (kind !== 'story') {
      const t = new Date(Date.now() + 24 * 3600 * 1000);
      const pad = (n) => String(n).padStart(2, '0');
      $('edWhen').value = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;
      $('edSchedToggle').onclick = () => {
        scheduled = !scheduled;
        $('edSchedToggle').classList.toggle('on', scheduled);
        $('edSchedToggle').setAttribute('aria-pressed', String(scheduled));
        $('edSchedBox').classList.toggle('hidden', !scheduled);
        updatePostBtn();
      };
    }
    $('edPost').onclick = async () => {
      const btn = $('edPost');
      const text = cap.value.trim();
      // A video chosen in the Post editor posts as a Lum (legacy behaviour).
      const effKind = (kind === 'post' && file && file.type.startsWith('video/')) ? 'lum' : kind;
      if (effKind === 'lum' && !file) { toast('Choose a video first 🎬'); return; }
      if (effKind === 'post' && !text && !file) { toast('Write something or add a photo first ✦'); return; }
      if (effKind === 'story' && !text && !file) { toast('Add text or a photo first 📖'); return; }
      let whenIso = null;
      if (scheduled && effKind !== 'story') {
        const w = $('edWhen').value;
        if (!w) { toast('Pick the date and time first 🕒'); return; }
        const when = new Date(w);
        if (isNaN(when) || when.getTime() < Date.now() + 60000) { toast('Pick a date and time at least a minute from now 🕒'); return; }
        whenIso = when.toISOString();
      }
      btn.disabled = true;
      btn.textContent = scheduled ? 'Scheduling…' : 'Posting…';
      const prog = $('edProg'), fill = $('edProgFill');
      prog.classList.remove('hidden');
      fill.style.width = '8%';
      try {
        const fd = new FormData();
        let path;
        if (effKind === 'lum') {
          fd.append('caption', text); fd.append('video', file);
          if (whenIso) fd.append('publish_at', whenIso);
          path = '/lums';
        } else if (effKind === 'story') {
          fd.append('text', text); if (file) fd.append('image', file);
          path = '/stories';
        } else {
          fd.append('content', (text + feeling).trim()); if (file) fd.append('image', file);
          if (whenIso) fd.append('publish_at', whenIso);
          path = whenIso ? '/posts/schedule' : '/posts';
        }
        await API.uploadProgress(path, fd, (r) => { fill.style.width = Math.max(8, Math.round(r * 92)) + '%'; });
        fill.style.width = '100%';
        if (scheduled) {
          toast(`Planned for ${new Date(whenIso).toLocaleString()} 🕒`);
        } else if (effKind === 'lum') { toast('Lum posted! 🎬'); App.checkMilestones(); }
        else if (effKind === 'story') { toast('Story shared! 📖'); App.checkMilestones(); }
        else { toast('Posted! ✦'); App.checkMilestones(); }
        const destTab = effKind === 'lum' && !scheduled ? 'video' : null;
        close();
        if (destTab) Views._feedTab = destTab;
        goFeed();
      } catch (e) {
        toast(e.data?.error || 'Could not publish');
        btn.disabled = false;
        updatePostBtn();
        prog.classList.add('hidden');
      }
    };
    if (presetFile) setFile(presetFile);
    updatePostBtn();
  },

  /* ---------------- CREATE HUB (#/create) ---------------- */
  async create(el) {
    if (!App.user) { el.innerHTML = `<div class="card center">Log in to create. <div class="mt"><button class="btn" onclick="Views.authModal()">Log in / Sign up</button></div></div>`; return; }
    el.innerHTML = `
      <div class="card">
        <h3 style="margin:0 0 10px">＋ Create</h3>
        <button class="create-opt" data-hub="post"><span class="co-ic">📸</span><span class="grow"><b>Post</b><div class="muted">Photo post for your feed</div></span></button>
        <button class="create-opt" data-hub="lum"><span class="co-ic">🎬</span><span class="grow"><b>Lum</b><div class="muted">Short video</div></span></button>
        <button class="create-opt" data-hub="story"><span class="co-ic">📖</span><span class="grow"><b>Story</b><div class="muted">Disappears in 24 hours</div></span></button>
        <button class="create-opt" data-hub="camera"><span class="co-ic">🤳</span><span class="grow"><b>Camera</b><div class="muted">Fun filters &amp; stickers</div></span></button>
        <button class="create-opt" data-hub="live"><span class="co-ic">🔴</span><span class="grow"><b>Go Live</b><div class="muted">Stream to your people</div></span></button>
      </div>
      <div class="card">
        <h4 style="margin:0 0 6px">🕓 Scheduled</h4>
        <div class="muted">Scheduled posts publish automatically at their time.</div>
        <div id="planList"></div>
        <div id="lumPlanList"></div>
      </div>`;
    el.querySelectorAll('[data-hub]').forEach(b => b.onclick = () => {
      const k = b.dataset.hub;
      if (k === 'live') Views.startLiveFlow();
      else if (k === 'camera') CameraUI.open({ onCapture: (file) => Views.createEditor('post', file) });
      else Views.createEditor(k);
    });
    loadPlannedPosts();
    loadScheduledLums();
  },

  /* ---------------- NOTIFICATIONS ---------------- */
  async notifications(el) {
    if (!App.user) { el.innerHTML = `<div class="card center">Log in to see notifications.</div>`; return; }
    el.innerHTML = `<div class="card center"><div class="muted">Loading notifications…</div></div>`;
    try {
      const { notifications, unread } = await API.get('/notifications');
      el.innerHTML = `
        <div class="card"><div class="row"><h3 style="margin:0" class="grow">🔔 Notifications</h3>
          ${unread ? `<button class="btn small ghost" id="notifRead">Mark all read</button>` : ''}</div>
          ${notifications.length ? notifications.map(n => `
            <a class="notif-row${n.read ? '' : ' unread'}" href="${n.type === 'lum' ? '#/lums' : '#/profile/' + esc(n.actor?.username || '')}">
              ${n.actor ? avatarHtml(n.actor, 40) : ''}
              <span class="grow">🔔 <b>${esc(n.actor?.display_name || 'Someone')}</b> posted a new ${n.type === 'lum' ? 'Lum 🎬' : 'post'}
              <div class="post-time">${timeAgo(n.created_at)}</div></span>
              ${n.read ? '' : '<span class="notif-dot"></span>'}
            </a>`).join('') : `<div class="muted center" style="padding:18px">No notifications yet. Tick the 🔔 on a friend's profile to hear when they post.</div>`}
        </div>`;
      App.refreshBell();
      const btn = document.getElementById('notifRead');
      if (btn) btn.onclick = async () => {
        try { await API.post('/notifications/read', {}); Views.notifications(el); }
        catch (e) { toast('Could not mark read'); }
      };
    } catch (e) { el.innerHTML = `<div class="card center">Couldn't load notifications.</div>`; }
  },

  /* ---------------- FURRY COMPANION ---------------- */
  async myCompanion(el) {
    if (!App.user) { el.innerHTML = `<div class="card center">Log in to meet your companion.</div>`; return; }
    el.innerHTML = `<div class="card center"><div class="muted">Fetching your companion…</div></div>`;
    let data;
    try { data = await API.get('/companion'); }
    catch (e) { el.innerHTML = `<div class="card center">Couldn't load your companion.</div>`; return; }
    const p = data.pet;
    if (!p) {
      const breeds = data.breeds || { dog: [], cat: [] };
      el.innerHTML = `
        <div class="card center">
          <div style="font-size:52px">🐾</div>
          <h3 style="margin:6px 0">Adopt a furry companion</h3>
          <div class="muted">A dog or cat of your own inside Luminous. Feed them, give them water,
          and give them attention every day to grow your bond. They never leave — they always wait for you. ❤️</div>
        </div>
        <div class="card"><div class="form-grid">
          <label class="f">Species<select id="petSpecies">
            <option value="dog">🐶 Dog</option><option value="cat">🐱 Cat</option></select></label>
          <label class="f">Breed<select id="petBreed"></select></label>
          <label class="f">Name<input id="petName" maxlength="20" placeholder="e.g. Biscuit"></label>
          <label class="f">Age (years)<input id="petAge" type="number" min="0" max="20" value="1"></label>
          <div class="muted" id="petStageHint"></div>
          <button class="btn" id="petAdopt">Adopt 🐾</button>
        </div></div>`;
      const breedSel = document.getElementById('petBreed');
      const stageHint = () => {
        const sp = document.getElementById('petSpecies').value;
        const age = parseInt(document.getElementById('petAge').value) || 0;
        document.getElementById('petStageHint').textContent =
          age < 1 ? (sp === 'dog' ? 'Life stage: Puppy 🐶' : 'Life stage: Kitten 🐱')
            : age <= 7 ? 'Life stage: Adult' : 'Life stage: Senior';
      };
      const fillBreeds = () => {
        const sp = document.getElementById('petSpecies').value;
        breedSel.innerHTML = (breeds[sp] || []).map(b => `<option>${esc(b)}</option>`).join('');
        stageHint();
      };
      document.getElementById('petSpecies').onchange = fillBreeds;
      document.getElementById('petAge').oninput = stageHint;
      fillBreeds();
      document.getElementById('petAdopt').onclick = async () => {
        try {
          await API.post('/companion/adopt', {
            species: document.getElementById('petSpecies').value,
            breed: breedSel.value,
            name: document.getElementById('petName').value,
            age_years: parseInt(document.getElementById('petAge').value) || 0,
          });
          toast('Welcome home! 🐾');
          Views.myCompanion(el);
        } catch (e) { toast(e.data?.error || 'Could not adopt'); }
      };
      return;
    }
    const meter = (label, icon, v) => `
      <div class="pet-meter"><span class="pm-label">${icon} ${label}</span>
        <div class="pm-bar"><i style="width:${v}%"></i></div><b>${v}%</b></div>`;
    const readyIn = (ms) => ms <= 0 ? '' : ` <span class="muted">(again in ${Math.ceil(ms / 3600000)}h)</span>`;
    el.innerHTML = `
      <div class="card pet-home">
        <div class="pet-scene"><span class="pet-big">${p.emoji}</span><span class="pet-face">${p.face}</span></div>
        <h3 style="margin:4px 0">${esc(p.name)}</h3>
        <div class="muted">${esc(p.breed)} ${p.species === 'dog' ? 'dog' : 'cat'} · ${p.age_years} yr${p.age_years === 1 ? '' : 's'} old · ${esc(p.stage)}</div>
        <div class="pet-mood">${esc(p.mood_label)} — “${esc(p.line)}”</div>
        ${meter('Food', '🍖', p.meters.food)}
        ${meter('Water', '💧', p.meters.water)}
        ${meter('Love', '❤️', p.meters.love)}
        <div class="row mt">
          <button class="btn small" data-care="food" ${p.care_ready_in.food > 0 ? 'disabled' : ''}>🍖 Feed</button>
          <button class="btn small" data-care="water" ${p.care_ready_in.water > 0 ? 'disabled' : ''}>💧 Give Water</button>
          <button class="btn small" data-care="play" ${p.care_ready_in.play > 0 ? 'disabled' : ''}>❤️ Play / Pet</button>
        </div>
        <div class="muted mt">Care counts once per kind every ~6 hours.${p.care_ready_in.food > 0 ? readyIn(p.care_ready_in.food) : ''}</div>
        <div class="pet-bond mt">🔥 Care streak: <b>${p.care_streak} day${p.care_streak === 1 ? '' : 's'}</b> · Bond Lv ${p.bond_level} — <b>${esc(p.bond_title)}</b> (${p.bond_xp} care days)</div>
        <div class="row mt">
          <button class="btn small ghost" id="petRename">✏️ Rename</button>
        </div>
        <div class="muted mt">${esc(p.name)} always waits for you — a missed day only makes them sad, never gone. 🐾</div>
      </div>`;
    el.querySelectorAll('[data-care]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try {
        const r = await API.post('/companion/care', { kind: b.dataset.care });
        if (r.care_day) toast('Care day complete! Bond grows ❤️');
        else if (!r.counted) toast('Already cared for recently — it counts again in a few hours');
        else toast('💚 ' + p.name + ' feels cared for');
        Views.myCompanion(el);
      } catch (e) { toast(e.data?.error || 'Could not care'); b.disabled = false; }
    });
    document.getElementById('petRename').onclick = async () => {
      const name = prompt('New name:', p.name);
      if (!name || !name.trim()) return;
      try { await API.post('/companion/rename', { name: name.trim() }); toast('Renamed ✨'); Views.myCompanion(el); }
      catch (e) { toast(e.data?.error || 'Could not rename'); }
    };
  },

  /* ---------------- WEEKLY LIVE RANKINGS ---------------- */
  async liveRankings(el) {
    const board = Views._rankBoard || 'hosts';
    const period = Views._rankPeriod || 'current';
    el.innerHTML = `<div class="card center"><div class="muted">Loading rankings…</div></div>`;
    let data;
    try { data = await API.get(`/live/rankings?board=${board}&period=${period}`); }
    catch (e) { el.innerHTML = `<div class="card center">Couldn't load rankings.</div>`; return; }
    const move = (m) => m === 'NEW' ? '<span class="rank-new">NEW</span>'
      : m > 0 ? `<span class="rank-up">▲${m}</span>` : m < 0 ? `<span class="rank-down">▼${-m}</span>` : '<span class="muted">—</span>';
    const medal = ['🥇', '🥈', '🥉'];
    const row = (e) => `
      <div class="rank-row${e.rank <= 3 ? ' podium' : ''}">
        <span class="rank-num">${medal[e.rank - 1] || '#' + e.rank}</span>
        ${e.user ? avatarHtml(e.user, 40) : ''}
        <span class="grow"><a href="#/profile/${esc(e.user?.username || '')}" style="color:inherit"><b>${esc(e.user?.display_name || 'Someone')}</b></a>
          <div class="muted">@${esc(e.user?.username || '')}</div></span>
        ${move(e.movement)}
        <b>🪙 ${e.total}</b>
      </div>`;
    el.innerHTML = `
      <div class="card">
        <h3 style="margin:0 0 8px">🏆 Live Rankings</h3>
        <div class="feed-tabs">
          <button data-rb="hosts" class="${board === 'hosts' ? 'active' : ''}">🏆 Top Hosts</button>
          <button data-rb="gifters" class="${board === 'gifters' ? 'active' : ''}">💝 Top Gifters</button>
        </div>
        <div class="feed-tabs" style="margin-top:6px">
          <button data-rp="current" class="${period === 'current' ? 'active' : ''}">This week</button>
          <button data-rp="last" class="${period === 'last' ? 'active' : ''}">Last week</button>
        </div>
        <div class="muted" style="margin:8px 0">Week of ${esc(data.week_key)} · Monday to Sunday (Toronto) · from real gift events only</div>
        ${data.me ? `<div class="rank-row me"><span class="rank-num">#${data.me.rank}</span><span class="grow"><b>You</b></span><b>🪙 ${data.me.total}</b></div>` : ''}
        ${data.entries.length ? data.entries.map(row).join('') : `<div class="muted center" style="padding:16px">No gifts yet ${period === 'current' ? 'this week' : 'that week'} — the board is wide open. 🎁</div>`}
        <div class="muted mt">Last week's #1 host wears the 👑 Weekly Champion crown all week. Badges and bragging rights only — no coin prizes.</div>
      </div>`;
    el.querySelectorAll('[data-rb]').forEach(b => b.onclick = () => { Views._rankBoard = b.dataset.rb; Views.liveRankings(el); });
    el.querySelectorAll('[data-rp]').forEach(b => b.onclick = () => { Views._rankPeriod = b.dataset.rp; Views.liveRankings(el); });
  },

  /* ---------------- MORE MENU (header ☰) ---------------- */
  moreMenu() {
    const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    const item = (href, icon, label) => `<a href="${href}" onclick="closeModal()"><span class="mi">${icon}</span>${label}</a>`;
    openModal(`<div class="row"><span class="logo-tile" style="width:38px;height:38px;font-size:19px;border-radius:12px">✦</span>
        <h3 style="margin:0" class="grow">LUMINOUS</h3>
        <button class="icon-btn" onclick="closeModal()" aria-label="Close">✕</button></div>
      <div class="more-list mt">
        ${item('#/stories', '📖', 'Stories')}
        ${item('#/lums', '🎬', 'Lums')}
        ${item('#/friends', '👥', 'Friends & Messages')}
        ${item('#/mentors', '💫', 'AI Mentors')}
        ${item('#/companions', '🪄', 'AI Companions')}
        ${item('#/wallet', '👛', 'Wallet')}
        ${item('#/live-rankings', '🏆', 'Live Rankings')}
        ${App.user ? item('#/companion', '🐾', 'My Companion') : ''}
        ${App.user ? item('#/notifications', '🔔', 'Notifications') : ''}
        ${App.user ? item('#/missions', '🎯', 'Weekly Missions') : ''}
        ${Views._discCache && Views._discCache.servers && Views._discCache.servers.length ? `<button id="mmServers"><span class="mi">🕯️</span>My Servers</button>` : ''}
        ${Views._discCache && Views._discCache.discoveries && Views._discCache.discoveries.includes('hall-of-fame') ? item('#/hall-of-fame', '🏆', 'Hall of Fame') : ''}
        <a href="https://muse.ai/s/lumiads-qxs6exenbxdgxwxi/W9lB2q9kRmrNpisoDNRkXdSmpbmOtKiZpN8J6BQKAeI" target="_blank" rel="noopener" onclick="closeModal()"><span class="mi">📣</span>LumiAds · Advertise here</a>
        ${item('#/appearance', '✦', 'Customize appearance')}
        ${App.user ? item('#/settings', '⚙️', 'Settings') : ''}
        ${App.user && App.user.is_developer ? item('#/admin', '🛠️', 'Admin') : ''}
        <button id="mmTheme"><span class="mi">${theme === 'dark' ? '☀️' : '🌙'}</span>${theme === 'dark' ? 'Light mode' : 'Dark mystery mode'}</button>
        ${App.user
          ? `<button id="mmLogout"><span class="mi">🚪</span>Log out</button>`
          : `<button id="mmLogin"><span class="mi">🔑</span>Log in / Sign up</button>`}
      </div>
      <div class="brand-foot">✦ <b>LUMINOUS</b> · Built for creativity, connection, and growth.</div>`);
    document.getElementById('mmTheme').onclick = () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('luminous_theme', next);
      Views.moreMenu();
    };
    const mmSrv = document.getElementById('mmServers');
    if (mmSrv) mmSrv.onclick = () => Views.myServers();
    // Hidden things stay hidden until found: refresh what this user has
    // discovered, and quietly re-render the open menu if it changed.
    if (App.user) {
      API.get('/servers/mine').then(d => {
        const changed = JSON.stringify(d) !== JSON.stringify(Views._discCache || null);
        Views._discCache = d;
        if (changed && document.getElementById('modalRoot').innerHTML) Views.moreMenu();
      }).catch(() => {});
    }
    const login = document.getElementById('mmLogin');
    if (login) login.onclick = () => { closeModal(); Views.authModal(); };
    const logout = document.getElementById('mmLogout');
    if (logout) logout.onclick = async () => {
      try { await API.post('/auth/logout', {}); } catch (e) { /* ignore */ }
      API.setToken(null); App.user = null; closeModal(); App.refreshAuth(); App.route();
      toast('Logged out — see you soon ✦');
    };
  },

  /* ---------------- APPEARANCE (✦ Customize appearance) ---------------- */
  async appearance(el) {
    let screen = 'home';
    let pending = Appearance.load(screen) || Appearance.DEFAULT();
    const ACCENT = () => Appearance.accent();
    el.innerHTML = `
      <div class="card">
        <h2 style="margin:0 0 8px">✦ Section appearance</h2>
        <div class="muted" style="font-size:14px;line-height:1.55">Choose a different background for each part of Luminous. Changes are saved in this browser on this device.</div>
        <div class="form-grid mt">
          <label class="f">Choose a screen
            <select id="apScreen">${Appearance.SCREENS.map(s => `<option value="${s.key}">${s.label}</option>`).join('')}</select></label>
          <label class="f">Background type
            <select id="apType">
              <option value="photo">Personal photo</option>
              <option value="solid">Solid color</option>
              <option value="gradient">Gradient</option>
            </select></label>
          <div class="ap-type-box" id="apTypeBox"></div>
          <label class="f">Dark overlay <span id="apOverlayVal"></span>
            <input type="range" id="apOverlay" min="0" max="90" step="1"></label>
          <label class="f">Live preview</label>
          <div class="ap-preview" id="apPreview"><span>Live preview</span></div>
          <label class="f">Accent color — buttons, rings & highlights</label>
          <div class="swatches" id="apAccents"></div>
          <button class="btn" id="apSave" style="justify-self:start;padding:14px 28px;font-size:16.5px">Save this screen</button>
          <button class="btn pill-outline" id="apReset" style="justify-self:start">Reset this screen</button>
          <button class="btn pill-outline" id="apResetAll" style="justify-self:start">Reset all screens</button>
          <div class="muted" style="font-size:14px">✦ Choose a screen and customize its background.</div>
        </div>
      </div>`;

    const $ = (id) => document.getElementById(id);
    const typeBox = $('apTypeBox'), preview = $('apPreview'), overlayIn = $('apOverlay');

    const drawPreview = () => {
      if (pending.type === 'photo' && pending.photo) {
        preview.style.background = '';
        preview.style.backgroundImage = `url("${pending.photo}")`;
        preview.style.backgroundSize = 'cover'; preview.style.backgroundPosition = 'center';
      } else {
        preview.style.backgroundImage = '';
        preview.style.background = Appearance.cssFor(pending);
      }
      preview.style.boxShadow = `inset 0 0 0 999px rgba(5,2,12,${(pending.overlay || 0) / 100})`;
      $('apOverlayVal').textContent = `${pending.overlay}%`;
      overlayIn.value = pending.overlay;
    };
    const drawTypeBox = () => {
      $('apType').value = pending.type;
      if (pending.type === 'photo') {
        typeBox.innerHTML = `<label class="f">Wallpaper photo</label>
          <label class="ap-pick" for="apFile">🖼️ Choose from camera roll</label>
          <input type="file" id="apFile" accept="image/*" class="hidden">
          <div class="muted">Opens your camera roll / photo gallery — pick any picture to use as this screen's wallpaper. Images are resized before saving.</div>
          <div class="muted" id="apPhotoState">${pending.photo ? 'A photo is set for this screen — pick a new one to replace it.' : 'No photo set yet for this screen.'}</div>`;
        $('apFile').onchange = async () => {
          const f = $('apFile').files[0];
          if (!f) return;
          try {
            pending.photo = await Appearance.downscalePhoto(f);
            $('apPhotoState').textContent = 'Photo ready — check the live preview, then Save this screen.';
            drawPreview();
          } catch (e) { toast('That image could not be read'); }
        };
      } else if (pending.type === 'solid') {
        typeBox.innerHTML = `<label class="f">Preset colors</label>
          <div class="swatches">${Appearance.SOLIDS.map(c => `<button class="swatch${pending.color === c ? ' sel' : ''}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>
          <label class="f">…or any color<input type="color" id="apColor" value="${esc(pending.color || '#150b26')}" style="height:46px"></label>`;
        typeBox.querySelectorAll('[data-color]').forEach(b => b.onclick = () => { pending.color = b.dataset.color; drawTypeBox(); drawPreview(); });
        $('apColor').oninput = () => { pending.color = $('apColor').value; drawPreview(); };
        $('apColor').onchange = drawTypeBox;
      } else {
        typeBox.innerHTML = `<label class="f">Mystery gradients</label>
          <div class="grad-presets">${Appearance.GRADIENTS.map((g, i) => `<button class="grad-preset${pending.gradient === i ? ' sel' : ''}" data-grad="${i}" style="background:${g.css}" title="${esc(g.name)}" aria-label="${esc(g.name)}"></button>`).join('')}</div>
          <div class="muted" id="apGradName">${esc((Appearance.GRADIENTS[pending.gradient || 0] || {}).name || '')}</div>`;
        typeBox.querySelectorAll('[data-grad]').forEach(b => b.onclick = () => {
          pending.gradient = +b.dataset.grad; drawTypeBox(); drawPreview();
        });
      }
    };
    const drawAccents = () => {
      $('apAccents').innerHTML = Appearance.ACCENTS.map(a =>
        `<button class="swatch${ACCENT() === a.value ? ' sel' : ''}" data-accent="${a.value}" style="background:${a.value}" title="${esc(a.name)}" aria-label="${esc(a.name)}"></button>`).join('');
      $('apAccents').querySelectorAll('[data-accent]').forEach(b => b.onclick = () => {
        Appearance.setAccent(b.dataset.accent);
        drawAccents();
        toast('Accent updated ✦');
      });
    };
    const loadScreen = (key) => {
      screen = key;
      pending = Appearance.load(screen) || Appearance.DEFAULT();
      drawTypeBox(); drawPreview();
    };

    $('apScreen').onchange = () => loadScreen($('apScreen').value);
    $('apType').onchange = () => { pending.type = $('apType').value; drawTypeBox(); drawPreview(); };
    overlayIn.oninput = () => { pending.overlay = +overlayIn.value; drawPreview(); };
    $('apSave').onclick = () => {
      if (pending.type === 'photo' && !pending.photo) { toast('Pick a photo first — or switch the background type'); return; }
      if (Appearance.save(screen, pending)) {
        toast(`Saved — ${esc(Appearance.SCREENS.find(s => s.key === screen).label)} background updated ✦`);
        if (Appearance.screenForHash(location.hash || '#/') === screen) Appearance.applyForScreen(screen);
      } else {
        toast('Could not save — the photo may be too large for this browser');
      }
    };
    $('apReset').onclick = () => { Appearance.reset(screen); loadScreen(screen); toast('Screen reset to the mystery theme'); };
    $('apResetAll').onclick = () => { Appearance.resetAll(); loadScreen(screen); Appearance.applyForHash(location.hash || '#/'); toast('All screens reset'); };

    drawAccents();
    loadScreen('home');
  },

  /* ---------------- ADMIN (developer only) ---------------- */
  async admin(el) {
    if (!App.user?.is_developer) { el.innerHTML = `<div class="card center">🛠️ Developer access only.</div>`; return; }
    el.innerHTML = `<div class="card center"><div class="muted">Loading admin panel…</div></div>`;
    let stats, users, content;
    try {
      [stats, { users }, content] = await Promise.all([
        API.get('/admin/stats'), API.get('/admin/users'), API.get('/admin/content'),
      ]);
    } catch (e) { el.innerHTML = `<div class="card center">Could not load the admin panel.</div>`; return; }
    const statCard = (num, label) => `<div class="stat card"><div class="num">${num}</div><div class="muted">${label}</div></div>`;
    const modRow = (kind, id, title, author) => `
      <div class="row" style="padding:6px 0;border-bottom:1px solid var(--line, #333)">
        <div class="grow"><div>${esc(title || '(no text)')}</div>
        <div class="post-time">by ${esc(author || '')}</div></div>
        <button class="btn small ghost" data-del="${kind}:${id}">🗑 Delete</button></div>`;
    el.innerHTML = `
      <div class="card"><h3 style="margin:0 0 10px">🛠️ Admin Panel <span class="badge dev">Developer</span></h3>
        <div class="stat-grid">
          ${statCard(stats.users, 'users')}
          ${statCard(stats.posts, 'posts')}
          ${statCard(stats.stories, 'stories')}
          ${statCard(stats.lums, 'lums')}
          ${statCard(stats.live_streams, 'live streams')}
          ${statCard(stats.live_now, 'live now')}
        </div></div>
      <div class="card"><h4 style="margin:0 0 8px">👥 Users</h4>
        ${users.map(u => `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line, #333)">
          ${avatarHtml(u, 36)}
          <div class="grow"><div class="name"><b>${esc(u.display_name)}</b> ${badgesHtml(u)}</div>
            <div class="post-time">@${esc(u.username)} · ${esc(u.account_type)}${u.email ? ' · ' + esc(u.email) : ''}</div></div>
          ${['business', 'creator'].includes(u.account_type)
            ? `<button class="btn small ${u.verified ? 'ghost' : ''}" data-verify="${u.id}:${u.verified ? 0 : 1}">${u.verified ? 'Unverify' : '✓ Verify'}</button>`
            : ''}
        </div>`).join('')}
      </div>
      <div class="card"><h4 style="margin:0 0 8px">🔑 Password reset requests</h4>
        <div id="resetList"><div class="muted">Loading…</div></div>
      </div>
      <div class="card"><h4 style="margin:0 0 8px">🛡 Moderation — recent posts</h4>
        ${content.posts.length ? content.posts.map(p => modRow('posts', p.id, (p.content || '').slice(0, 90), '@' + p.username)).join('') : '<div class="muted">No posts.</div>'}
        <h4 style="margin:14px 0 8px">Recent stories</h4>
        ${content.stories.length ? content.stories.map(s => modRow('stories', s.id, (s.text || '').slice(0, 90), '@' + s.username)).join('') : '<div class="muted">No stories.</div>'}
        <h4 style="margin:14px 0 8px">Recent Lums</h4>
        ${content.lums.length ? content.lums.map(l => modRow('lums', l.id, (l.caption || '').slice(0, 90), '@' + l.username)).join('') : '<div class="muted">No Lums.</div>'}
      </div>`;
    el.querySelectorAll('[data-verify]').forEach(b => b.onclick = async () => {
      const [id, val] = b.dataset.verify.split(':');
      try {
        await API.post(`/admin/users/${id}/verify`, { verified: val === '1' });
        toast(val === '1' ? '✓ Account verified' : 'Verification removed');
        Views.admin(el);
      } catch (e) { toast(e.data?.error || 'Could not update verification'); }
    });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const [kind, id] = b.dataset.del.split(':');
      if (!confirm(`Delete this ${kind.slice(0, -1)}? This cannot be undone.`)) return;
      try { await API.del(`/admin/${kind}/${id}`); toast('Deleted 🗑'); Views.admin(el); }
      catch (e) { toast(e.data?.error || 'Could not delete'); }
    });
    // password reset requests — the developer hands the code to the user
    try {
      const { resets } = await API.get('/admin/password-resets');
      const box = document.getElementById('resetList');
      if (box) {
        box.innerHTML = resets.length ? resets.map(r => `
          <div class="row" style="padding:6px 0;border-bottom:1px solid var(--line, #333)">
            <div class="grow"><div class="name"><b>${esc(r.display_name)}</b></div>
            <div class="post-time">@${esc(r.username)} · ${esc(r.email || '')} · asked ${timeAgo(r.created_at)} ago · expires ${esc(r.expires_at)} UTC</div></div>
            <span class="badge" data-code-slot="${r.id}" style="display:none"></span>
            <button class="btn small" data-show-code="${r.id}">Show code</button>
            <button class="btn small ghost" data-dismiss-reset="${r.id}">Dismiss</button>
          </div>`).join('') : '<div class="muted">No pending requests.</div>';
        box.querySelectorAll('[data-show-code]').forEach(b => b.onclick = async () => {
          try {
            const { code } = await API.post(`/admin/password-resets/${b.dataset.showCode}/code`, {});
            const slot = box.querySelector(`[data-code-slot="${b.dataset.showCode}"]`);
            if (slot) { slot.textContent = 'Code: ' + code; slot.style.display = ''; }
            b.style.display = 'none';
          } catch (e) { toast('Could not load the code'); }
        });
        box.querySelectorAll('[data-dismiss-reset]').forEach(b => b.onclick = async () => {
          try { await API.post(`/admin/password-resets/${b.dataset.dismissReset}/dismiss`, {}); Views.admin(el); }
          catch (e) { toast('Could not dismiss'); }
        });
      }
    } catch (e) { /* reset list is optional in the panel */ }
  },

  /* ---------------- DISCOVER ---------------- */
  async discover(el) {
    el.innerHTML = `
      <div class="card"><h3 style="margin-top:0">🔍 Discover</h3>
        <div class="search-row"><input id="discQ" placeholder="Search people and videos…"><button class="btn small" id="discBtn">Search</button></div>
        <div id="discPeople" class="mt"></div>
      </div>
      <h3 class="section-title">🎬 Videos for you</h3>
      <div id="discVids"><div class="card center"><div class="muted">Loading videos…</div></div></div>`;
    const loadVids = async (q) => {
      try {
        const { lums } = await API.get('/lums' + (q ? '?q=' + encodeURIComponent(q) : ''));
        const vids = document.getElementById('discVids');
        if (!vids) return;
        vids.innerHTML = lums.length ? `<div class="lum-grid">` + lums.map(l => `
          <a class="lum-mini" href="#/lums">
            ${l.video_url ? `<video src="${esc(l.video_url)}" muted playsinline preload="metadata"></video>` : `<div class="lum-mini-fallback">🎬</div>`}
            <div class="lum-mini-cap"><b>${esc(l.display_name)}</b> · 👁 ${l.views || 0}<br>${esc((l.caption || '').slice(0, 60))}</div>
          </a>`).join('') + `</div>`
          : `<div class="card center"><div class="muted">No videos matched.</div></div>`;
      } catch (e) { /* ignore */ }
    };
    await loadVids('');
    const run = async () => {
      const q = document.getElementById('discQ').value.trim();
      loadVids(q);
      const ppl = document.getElementById('discPeople');
      if (!ppl) return;
      if (q.length < 2) { ppl.innerHTML = ''; return; }
      if (!App.user) { ppl.innerHTML = `<div class="muted">Log in to search people and add friends.</div>`; return; }
      try {
        const { results } = await API.get('/friends/search?q=' + encodeURIComponent(q));
        ppl.innerHTML = results.length ? `<h4 style="margin:6px 0">People</h4>` + results.map(personRow).join('') : `<div class="muted">No people matched “${esc(q)}”.</div>`;
        ppl.querySelectorAll('[data-add]').forEach(b => b.onclick = async () => {
          try { const r = await API.post('/friends/request', { user_id: parseInt(b.dataset.add) }); toast(r.accepted ? 'You are now friends! 🎉' : 'Friend request sent 👋'); run(); }
          catch (e) { toast(e.data?.error || 'Could not add'); }
        });
        ppl.querySelectorAll('[data-accept]').forEach(b => b.onclick = async () => {
          try { await API.post(`/friends/${b.dataset.accept}/accept`, {}); toast('You are now friends! 🎉'); run(); }
          catch (e) { toast(e.data?.error || 'Could not accept'); }
        });
      } catch (e) { /* ignore */ }
    };
    document.getElementById('discBtn').onclick = run;
    let deb = null;
    document.getElementById('discQ').addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(run, 450); });
    document.getElementById('discQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    const dv = document.getElementById('discVids');
    if (dv) dv.insertAdjacentHTML('afterend', passageStarHtml('discover-star', 'ps-discover'));
    wirePassageStars(el);
  },

  /* ---------------- FRIENDS ---------------- */
  async friends(el) {
    el.innerHTML = `<div class="card center"><div class="muted">Loading friends…</div></div>`;
    try {
      const data = await API.get('/friends');
      const reqHtml = data.incoming.length ? `<div class="card"><h3 style="margin-top:0">👋 Friend requests</h3>${data.incoming.map(f => `
        <div class="friend-row">${avatarHtml(f.user, 44)}
          <div class="grow"><div class="name">${esc(f.user.display_name)} ${badgesHtml(f.user)}</div><div class="muted">@${esc(f.user.username)} wants to be friends</div></div>
          <button class="btn small" data-accept="${f.friendship_id}">Accept</button>
          <button class="btn small ghost" data-decline="${f.friendship_id}">Decline</button>
        </div>`).join('')}</div>` : '';
      const outHtml = data.outgoing.length ? `<div class="card"><h3 style="margin-top:0">⏳ Sent requests</h3>${data.outgoing.map(f => `
        <div class="friend-row">${avatarHtml(f.user, 44)}
          <div class="grow"><div class="name">${esc(f.user.display_name)}</div><div class="muted">@${esc(f.user.username)} · waiting…</div></div>
          <button class="btn small ghost" data-remove="${f.friendship_id}">Cancel</button>
        </div>`).join('')}</div>` : '';
      const listHtml = data.friends.length ? data.friends.map(friendRow).join('')
        : `<div class="card center"><div class="muted">No friends yet — search above and add someone! The AI crew accepts instantly. 🤖</div></div>`;
      el.innerHTML = `
        <div class="card"><h3 style="margin-top:0">👥 Add friends</h3>
          <div class="search-row"><input id="friendSearch" placeholder="Search by name or @username…"><button class="btn small" id="friendSearchBtn">Search</button></div>
          <div id="friendResults" class="mt"></div>
          <div class="muted mt">Every friendship starts as 🤝 <b>Acquaintances</b> and grows the longer you stay friends: 🙂 <b>Friends</b> at 7 days · 💛 <b>Close Friends</b> at 30 days · ⭐ <b>Best Friends</b> at 90 days</div>
        </div>
        ${reqHtml}${outHtml}
        <h3 class="section-title">Your friends (${data.friends.length})</h3>
        ${listHtml}`;
      const rerun = () => Views.friends(el);
      el.querySelectorAll('[data-accept]').forEach(b => b.onclick = async () => {
        try { await API.post(`/friends/${b.dataset.accept}/accept`, {}); toast('You are now friends! 🎉'); rerun(); }
        catch (e) { toast(e.data?.error || 'Could not accept'); }
      });
      el.querySelectorAll('[data-decline]').forEach(b => b.onclick = async () => {
        try { await API.post(`/friends/${b.dataset.decline}/decline`, {}); rerun(); }
        catch (e) { toast(e.data?.error || 'Could not decline'); }
      });
      el.querySelectorAll('[data-remove]').forEach(b => b.onclick = async () => {
        if (!confirm('Remove this friend / request?')) return;
        try { await API.del(`/friends/${b.dataset.remove}`); rerun(); }
        catch (e) { toast(e.data?.error || 'Could not remove'); }
      });
      el.querySelectorAll('[data-call-kind]').forEach(b => b.onclick = () =>
        CallUI.start(parseInt(b.dataset.callUser), b.dataset.callKind, b.dataset.callName));
      el.querySelectorAll('[data-family-make]').forEach(b => b.onclick = async () => {
        try { await API.post(`/friends/${b.dataset.familyMake}/family`, { family: true }); toast('You’re family now 👨‍👩‍👧'); rerun(); }
        catch (e) { toast(e.data?.message || e.data?.error || 'Family unlocks at Best Friends (90 days)'); }
      });
      el.querySelectorAll('[data-family-remove]').forEach(b => b.onclick = async () => {
        if (!confirm('Remove Family status? You stay Best Friends.')) return;
        try { await API.post(`/friends/${b.dataset.familyRemove}/family`, { family: false }); toast('Back to Best Friends ⭐'); rerun(); }
        catch (e) { toast(e.data?.error || 'Could not update'); }
      });
      const doSearch = async () => {
        const q = document.getElementById('friendSearch').value.trim();
        const box = document.getElementById('friendResults');
        if (q.length < 2) { box.innerHTML = `<div class="muted">Type at least 2 characters.</div>`; return; }
        try {
          const { results } = await API.get('/friends/search?q=' + encodeURIComponent(q));
          box.innerHTML = results.length ? results.map(personRow).join('') : `<div class="muted">No one matched “${esc(q)}”.</div>`;
          box.querySelectorAll('[data-add]').forEach(b => b.onclick = async () => {
            try { const r = await API.post('/friends/request', { user_id: parseInt(b.dataset.add) }); toast(r.accepted ? 'You are now friends! 🎉' : 'Friend request sent 👋'); rerun(); }
            catch (e) { toast(e.data?.error || 'Could not add'); }
          });
          box.querySelectorAll('[data-accept]').forEach(b => b.onclick = async () => {
            try { await API.post(`/friends/${b.dataset.accept}/accept`, {}); toast('You are now friends! 🎉'); rerun(); }
            catch (e) { toast(e.data?.error || 'Could not accept'); }
          });
        } catch (e) { box.innerHTML = `<div class="muted">Search failed — try again.</div>`; }
      };
      document.getElementById('friendSearchBtn').onclick = doSearch;
      document.getElementById('friendSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
    } catch (e) {
      el.innerHTML = `<div class="card center">Couldn't load friends. <div class="mt"><button class="btn" onclick="Views.friends(document.getElementById('app'))">Retry</button></div></div>`;
    }
  },

  /* ---------------- CHAT ---------------- */
  async chat(el, userId) {
    userId = parseInt(userId);
    el.innerHTML = `<div class="card center"><div class="muted">Opening chat…</div></div>`;
    try {
      const data = await API.get(`/dm/${userId}`);
      const friend = data.friend;
      el.innerHTML = `
        <div class="card chat-head">
          <a class="btn small ghost" href="#/friends">←</a>${avatarHtml(friend, 44)}
          <div class="grow"><div class="name">${esc(friend.display_name)} ${badgesHtml(friend)} <span id="chatStreak"></span></div>
          <div>${tierChip(data.tier)} ${presenceDotHtml(friend, true)} <span class="muted">@${esc(friend.username)}</span></div></div>
          <button class="btn small" id="chatCallAudio">📞</button>
          <button class="btn small" id="chatCallVideo">🎥</button>
        </div>
        <div class="card streak-panel" id="streakPanel"><div class="muted">Loading your streak…</div></div>
        <div class="card chat-box" id="chatBox">${data.messages.length ? data.messages.map(msgHtml).join('') : `<div class="muted center">No messages yet — say hi! 👋</div>`}</div>
        <div class="card chat-input-row"><button class="btn small ghost" id="chatCam" title="Send a live photo with filters">📸 Live photo</button><input id="chatInput" placeholder="Message ${esc(friend.display_name)}…"><button class="btn" id="chatSend">Send</button></div>`;
      const box = document.getElementById('chatBox');
      box.scrollTop = box.scrollHeight;
      const refresh = async () => {
        try {
          const d = await API.get(`/dm/${userId}`);
          const b2 = document.getElementById('chatBox');
          if (!b2) { if (window._chatTimer) { clearInterval(window._chatTimer); window._chatTimer = null; } return; }
          const nearBottom = b2.scrollHeight - b2.scrollTop - b2.clientHeight < 140;
          b2.innerHTML = d.messages.length ? d.messages.map(msgHtml).join('') : `<div class="muted center">No messages yet — say hi! 👋</div>`;
          if (nearBottom) b2.scrollTop = b2.scrollHeight;
        } catch (e) { /* ignore */ }
      };
      const send = async () => {
        const inp = document.getElementById('chatInput');
        const v = inp.value.trim();
        if (!v) return;
        inp.value = '';
        try { await API.post(`/dm/${userId}`, { content: v }); await refresh(); const b3 = document.getElementById('chatBox'); if (b3) b3.scrollTop = b3.scrollHeight; renderStreak(); }
        catch (e) { toast(e.data?.error || 'Could not send'); }
      };
      document.getElementById('chatSend').onclick = send;
      document.getElementById('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
      document.getElementById('chatCallAudio').onclick = () => CallUI.start(userId, 'audio', friend.display_name);
      document.getElementById('chatCallVideo').onclick = () => CallUI.start(userId, 'video', friend.display_name);
      document.getElementById('chatCam').onclick = () => CameraUI.open({
        onCapture: async (file) => {
          try {
            const fd = new FormData();
            fd.append('image', file);
            await API.upload(`/dm/${userId}`, fd);
            await refresh();
            const b3 = document.getElementById('chatBox');
            if (b3) b3.scrollTop = b3.scrollHeight;
            renderStreak();
          } catch (e) { toast(e.data?.error || 'Could not send photo'); }
        },
      });
      /* ---- streak panel ---- */
      const STREAK_EMOJI_SET = ['🔥', '⚡', '❤️', '💎', '⭐', '🌙', '🎮', '✝️', '💜', '✨'];
      const renderStreak = async () => {
        const panel = document.getElementById('streakPanel');
        if (!panel) return;
        let s;
        try { s = await API.get(`/messages/${userId}/streak`); }
        catch (e) { panel.innerHTML = `<div class="muted">Streak unavailable right now.</div>`; return; }
        (s.rewards || []).forEach(r => toast(`${s.emoji} ${r.milestone}-day streak! +${r.coins} coins each 🎉`));
        const chip = document.getElementById('chatStreak');
        if (chip) chip.innerHTML = streakChipHtml(s);
        const ch = s.challenge || {};
        const meConfirmed = (ch.confirmed_by || []).includes(App.user.id);
        const otherConfirmed = (ch.confirmed_by || []).some(id => id !== App.user.id);
        let challengeHtml;
        if (ch.completed) challengeHtml = `<div class="streak-done">✓ Today's challenge complete — today is secured!</div>`;
        else if (ch.measurable) challengeHtml = `<div class="muted">${esc(ch.progress?.label || '')}</div><button class="btn small mt" id="streakConfirm">We did it ✓</button>`;
        else if (meConfirmed) challengeHtml = `<div class="muted">You confirmed ✓ — waiting for ${esc(friend.display_name)} to tap too…</div>`;
        else challengeHtml = `<button class="btn small" id="streakConfirm">We did it ✓</button>${otherConfirmed ? `<div class="muted mt">${esc(friend.display_name)} already confirmed — your tap completes it!</div>` : ''}`;
        panel.innerHTML = `
          <div class="row"><b>${s.emoji} Streak</b><span class="grow"></span>
            <span>${s.emoji} <b>${s.current}</b> day${s.current === 1 ? '' : 's'} · longest ${s.longest}</span></div>
          ${s.at_risk ? `<div class="streak-risk">⏳ At risk — keep the streak alive before midnight!</div>` : ''}
          ${!s.today_secured && !ch.completed ? `<div class="muted mt">Message each other today (or finish the challenge) to secure day ${s.current + 1}.</div>` : ''}
          <div class="mt"><div class="muted">Today's duo challenge</div><b>${esc(ch.title || '')}</b>
            <div class="mt">${challengeHtml}</div></div>
          <div class="mt"><div class="muted">Your streak emoji</div>
            <div class="emoji-row">${STREAK_EMOJI_SET.map(e => `<button class="emoji-pick${e === s.emoji ? ' active' : ''}" data-emoji="${e}">${e}</button>`).join('')}</div></div>
          ${s.timeline && s.timeline.length ? `<div class="mt"><div class="muted">Timeline</div>${s.timeline.map(t => `<div class="streak-tl"><span>${esc(t.day)}</span> ${esc(t.label)}</div>`).join('')}</div>` : ''}`;
        const confirmBtn = document.getElementById('streakConfirm');
        if (confirmBtn) confirmBtn.onclick = async () => {
          confirmBtn.disabled = true;
          try {
            const r = await API.post(`/messages/${userId}/streak/challenge/confirm`, {});
            (r.rewards || []).forEach(x => toast(`${r.emoji} ${x.milestone}-day streak! +${x.coins} coins each 🎉`));
            if (r.challenge?.completed) toast('Challenge complete — today is secured! ✓');
            renderStreak();
          } catch (e) { toast(e.data?.error || 'Could not confirm'); confirmBtn.disabled = false; }
        };
        panel.querySelectorAll('[data-emoji]').forEach(b => b.onclick = async () => {
          try { await API.post(`/messages/${userId}/streak/emoji`, { emoji: b.dataset.emoji }); renderStreak(); }
          catch (e) { toast('Could not change emoji'); }
        });
      };
      renderStreak();
      if (window._chatTimer) clearInterval(window._chatTimer);
      window._chatTimer = setInterval(refresh, 3000);
    } catch (e) {
      el.innerHTML = `<div class="card center"><h3>💬 Chat unavailable</h3><div class="muted">${esc(e.data?.error || 'You are not friends yet')}</div><div class="mt"><a class="btn" href="#/friends">Back to friends</a></div></div>`;
    }
  },

  /* ---------------- MYSTERY PACK: passages, servers, hall, missions ---------------- */
  async discoverPassage(key) {
    if (!App.user) { Views.authModal(); return; }
    let r;
    try { r = await API.post('/servers/discover', { passage: key }); }
    catch (e) { toast('The darkness keeps its secret… for now.'); return; }
    if (r.found === 'hall-of-fame') {
      openModal(`<div class="center"><div style="font-size:40px">🏆</div>
        <h3 style="margin:6px 0">You found the Hall of Fame</h3>
        <div class="muted">Hidden beneath the Vault, where the legends of Luminous hang in gold. Few ever find this door.</div>
        <div class="mt"><button class="btn" onclick="closeModal();location.hash='#/hall-of-fame'">Enter the Hall</button></div></div>`);
      return;
    }
    if (r.found === 'server') {
      const s = r.server;
      openModal(`<div class="center"><div style="font-size:40px">🕯️</div>
        <h3 style="margin:6px 0">You found a secret passage…</h3>
        <div style="font-size:22px">${esc(s.emoji)} <b>${esc(s.name)}</b></div>
        <div class="muted mt">${esc(s.tagline)} · ${s.member_count} member${s.member_count === 1 ? '' : 's'} slipped inside before you</div>
        <div class="mt"><button class="btn" id="dpJoin">${s.joined ? 'Enter' : 'Step inside'}</button>
        <button class="btn ghost" onclick="closeModal()">Not yet</button></div></div>`);
      document.getElementById('dpJoin').onclick = async () => {
        if (!s.joined) {
          try { await API.post(`/servers/${s.id}/join`, {}); }
          catch (e) { toast('The passage sealed itself — try again'); return; }
        }
        closeModal();
        location.hash = '#/servers/' + s.id;
      };
    }
  },

  async myServers() {
    let data;
    try { data = await API.get('/servers/mine'); } catch (e) { toast('Could not open your passages'); return; }
    Views._discCache = data;
    openModal(`<div class="row"><span class="logo-tile" style="width:38px;height:38px;font-size:19px;border-radius:12px">🕯️</span>
      <h3 style="margin:0" class="grow">My Servers</h3>
      <button class="icon-btn" onclick="closeModal()" aria-label="Close">✕</button></div>
      <div class="more-list mt">${data.servers.length ? data.servers.map(s => `<a href="#/servers/${s.id}" onclick="closeModal()"><span class="mi">${esc(s.emoji)}</span>${esc(s.name)}<span class="muted"> · ${s.member_count} members</span></a>`).join('') : '<div class="muted">You have not slipped into any hidden server yet.</div>'}</div>
      <div class="brand-foot">🕯️ These places are not listed anywhere. You found them.</div>`);
  },

  async server(el, id) {
    id = parseInt(id);
    el.innerHTML = `<div class="card center"><div class="muted">Slipping through the passage…</div></div>`;
    let data;
    try { data = await API.get(`/servers/${id}/messages`); }
    catch (e) {
      el.innerHTML = `<div class="card center"><h3>🕯️ A locked darkness</h3><div class="muted">${esc(e.data?.error || 'You have not found this place yet.')}</div><div class="mt"><a class="btn" href="#/">Back to the light</a></div></div>`;
      return;
    }
    const s = data.server;
    const evKind = s.slug === 'midnight-library' ? 'mystery' : (s.slug === 'the-vault' ? 'treasure' : null);
    const msgRow = (m) => `<div class="srv-msg">${avatarHtml(m.author, 34)}
      <div class="grow"><div class="name">${esc(m.author.display_name)} ${badgesHtml(m.author)} <span class="muted">@${esc(m.author.username)} · ${timeAgo(m.created_at)}</span></div>
      <div class="srv-text">${esc(m.text)}</div></div></div>`;
    el.innerHTML = `
      <div class="card server-head">
        <div class="row"><span class="server-emoji">${esc(s.emoji)}</span>
          <div class="grow"><h2 style="margin:0">${esc(s.name)}</h2>
          <div class="muted">${esc(s.tagline)} · ${s.member_count} member${s.member_count === 1 ? '' : 's'}</div></div>
          ${s.slug === 'the-vault' ? passageStarHtml('fame-star', 'ps-vault') : ''}
        </div>
        ${s.hint ? `<div class="server-hint">🕯️ ${esc(s.hint)}</div>` : ''}
      </div>
      ${evKind ? '<div id="evPanel"></div>' : ''}
      <div class="card chat-box" id="srvBox">${data.messages.length ? data.messages.map(msgRow).join('') : `<div class="muted center">Silence… be the first voice in the dark. 🕯️</div>`}</div>
      <div class="card chat-input-row"><input id="srvInput" maxlength="500" placeholder="Whisper into ${esc(s.name)}…"><button class="btn" id="srvSend">Send</button></div>`;
    wirePassageStars(el);
    if (evKind) renderEventPanel(evKind);
    const box = document.getElementById('srvBox');
    if (box) box.scrollTop = box.scrollHeight;
    const refresh = async () => {
      try {
        const d = await API.get(`/servers/${id}/messages`);
        const b2 = document.getElementById('srvBox');
        if (!b2) { if (window._serverTimer) { clearInterval(window._serverTimer); window._serverTimer = null; } return; }
        const nearBottom = b2.scrollHeight - b2.scrollTop - b2.clientHeight < 140;
        b2.innerHTML = d.messages.length ? d.messages.map(msgRow).join('') : `<div class="muted center">Silence… be the first voice in the dark. 🕯️</div>`;
        if (nearBottom) b2.scrollTop = b2.scrollHeight;
      } catch (e) { /* ignore */ }
    };
    const send = async () => {
      const inp = document.getElementById('srvInput');
      const v = inp.value.trim();
      if (!v) return;
      inp.value = '';
      try { await API.post(`/servers/${id}/messages`, { text: v }); await refresh(); const b3 = document.getElementById('srvBox'); if (b3) b3.scrollTop = b3.scrollHeight; }
      catch (e) { toast(e.data?.error || 'Could not send'); }
    };
    document.getElementById('srvSend').onclick = send;
    document.getElementById('srvInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    if (window._serverTimer) clearInterval(window._serverTimer);
    window._serverTimer = setInterval(refresh, 5000);
  },

  async hallOfFame(el) {
    el.innerHTML = `<div class="card center"><div class="muted">Polishing the gold…</div></div>`;
    let data;
    try { data = await API.get('/hall-of-fame'); }
    catch (e) { el.innerHTML = `<div class="card center">The Hall sleeps. Try again.</div>`; return; }
    const plaque = (e) => `<div class="hof-plaque">
        <div class="hof-avatar">${avatarHtml(e.user, 64)}</div>
        <div class="hof-name">${esc(e.user.display_name)}</div>
        <div class="hof-title">${esc(e.title)}</div>
        <div class="muted">@${esc(e.user.username)} · ${e.follower_count} followers</div>
        <div class="hof-trophies">${e.trophies.length ? e.trophies.map(t => `<span class="hof-trophy">${t.icon} ${esc(t.name)}</span>`).join('') : '<span class="muted">—</span>'}</div>
      </div>`;
    el.innerHTML = `
      <div class="card hof-head"><h2 style="margin:0">🏆 Hall of Fame</h2>
        <div class="muted mt">A hidden hall beneath Luminous, where legends hang in gold. It cannot be searched for. It can only be found.</div></div>
      <div class="hof-grid">${data.entries.map(plaque).join('')}</div>
      ${data.awaiting_first_legend ? `<div class="card center muted">The hall awaits its first legend. Reach 1,000 followers and take your place beside the Founder.</div>` : ''}
      <h3 class="section-title">✒️ Engraved Winners — Monthly Quests</h3>
      ${data.winners && data.winners.length ? `<div class="hof-grid">${data.winners.map(w => `
        <div class="hof-plaque winner"><div style="font-size:30px">${w.kind === 'mystery' ? '🔎' : '🗺️'}</div>
          <div class="hof-name">${esc(w.winner)}</div>
          <div class="hof-title">${esc(w.title)}</div>
          <div class="muted">${esc(w.month)} · ${w.kind === 'mystery' ? 'Murder Mystery' : 'Treasure Hunt'}</div></div>`).join('')}</div>`
        : `<div class="card center muted">No quest has been conquered yet. The first engraving awaits its name.</div>`}
      <div class="brand-foot">✦ <b>LUMINOUS</b> · Fame, here, is earned in the dark and kept in the light.</div>`;
  },

  async missions(el) {
    el.innerHTML = `<div class="card center"><div class="muted">Loading this week's missions…</div></div>`;
    let data;
    try { data = await API.get('/missions'); }
    catch (e) { el.innerHTML = `<div class="card center">Couldn't load missions.</div>`; return; }
    el.innerHTML = `
      <div class="card"><h2 style="margin:0">🎯 Weekly Missions</h2>
        <div class="muted mt">Week ${esc(data.week)} · New missions every Monday.</div>
        <div class="muted">Missions earn coins and grow your channel — Creator Awards unlock at real follower milestones.</div></div>
      ${data.missions.map(m => {
        const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
        return `<div class="card mission">
          <div class="row"><div class="grow"><b>${esc(m.title)}</b>
            <div class="muted">${m.progress}/${m.target} · Reward: ${m.reward} LUMI</div></div>
            ${m.claimed ? '<span class="badge">✓ Claimed</span>' : (m.complete ? `<button class="btn small" data-claim="${esc(m.key)}">Claim ${m.reward} LUMI</button>` : `<span class="muted">${pct}%</span>`)}
          </div>
          <div class="level-bar mt"><i style="width:${pct}%"></i></div></div>`;
      }).join('')}
      <div class="brand-foot">✦ <b>LUMINOUS</b> · Small steps, every week, compound.</div>`;
    el.querySelectorAll('[data-claim]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { const r = await API.post(`/missions/${b.dataset.claim}/claim`, {}); toast(`Claimed ${r.reward} LUMI 🎉`); Views.missions(el); App.refreshAuth(); }
      catch (e) { toast(e.data?.message || e.data?.error || 'Could not claim'); b.disabled = false; }
    });
  },

  /* ---------------- AUTH MODAL ---------------- */
  authModal() {
    openModal(`<h3 style="margin-top:0">✨ Welcome to Luminous</h3>
      <div class="tabs"><button id="tabLogin" class="active">Log in</button><button id="tabReg">Sign up</button></div>
      <div class="form-grid" id="authForm">
        <label class="f" id="emailF">Email<input id="aEmail" type="email"></label>
        <label class="f hidden" id="userF">Username<input id="aUser" maxlength="24"></label>
        <label class="f hidden" id="nameF">Display name<input id="aName" maxlength="60"></label>
        <label class="f">Password<span class="pw-wrap"><input id="aPass" type="password"><button type="button" id="aPassEye" class="pw-eye" aria-label="Show password" title="Show password">👁️</button></span></label>
        <label class="check-row"><input id="aRemember" type="checkbox" checked> <span>Keep me signed in</span></label>
        <label class="f hidden" id="typeF">Account type<select id="aType">
          <option value="personal">Personal</option><option value="business">Business</option><option value="creator">Content Creator</option></select></label>
        <button class="btn" id="aGo">Log in</button>
        <button type="button" class="btn small ghost" id="aForgot">Forgot password?</button>
        <div class="auth-or"><span>or</span></div>
        <button type="button" class="btn ghost" id="aLumiail">✉️ Sign in with Lumiail</button>
        <div class="hidden" id="lumiailBox">
          <label class="f">Lumiail address<input id="lAddr" type="email" placeholder="you@lumiail.ca"></label>
          <label class="f">Lumiail password<input id="lPass" type="password"></label>
          <button type="button" class="btn" id="lGo">Continue with Lumiail</button>
          <div class="muted">Your Lumiail password is checked by Lumiail itself — Luminous never stores it. First sign-in creates your linked Luminous account automatically.</div>
        </div>
      </div>`);
    const passEye = document.getElementById('aPassEye');
    passEye.onclick = () => {
      const inp = document.getElementById('aPass');
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      passEye.textContent = show ? '🙈' : '👁️';
      passEye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      passEye.title = show ? 'Hide password' : 'Show password';
      inp.focus();
    };
    let mode = 'login';
    const setMode = (m) => {
      mode = m;
      document.getElementById('tabLogin').classList.toggle('active', m === 'login');
      document.getElementById('tabReg').classList.toggle('active', m === 'register');
      ['userF', 'nameF', 'typeF'].forEach(id => document.getElementById(id).classList.toggle('hidden', m === 'login'));
      document.getElementById('aGo').textContent = m === 'login' ? 'Log in' : 'Create account';
    };
    document.getElementById('tabLogin').onclick = () => setMode('login');
    document.getElementById('tabReg').onclick = () => setMode('register');
    document.getElementById('aForgot').onclick = () => Views.forgotModal();
    document.getElementById('aLumiail').onclick = () => {
      document.getElementById('lumiailBox').classList.toggle('hidden');
      const f = document.getElementById('lAddr'); if (f) f.focus();
    };
    document.getElementById('lGo').onclick = async () => {
      try {
        const r = await API.post('/auth/lumiail', {
          address: document.getElementById('lAddr').value.trim(),
          password: document.getElementById('lPass').value,
        });
        API.setToken(r.token, document.getElementById('aRemember').checked);
        closeModal();
        await App.refreshAuth();
        toast(`Welcome, ${r.user.display_name}! ✨`);
        App.route();
      } catch (e) { toast(e.data?.error || 'Lumiail sign-in failed'); }
    };
    document.getElementById('aGo').onclick = async () => {
      try {
        const email = document.getElementById('aEmail').value.trim();
        const password = document.getElementById('aPass').value;
        let r;
        if (mode === 'login') r = await API.post('/auth/login', { email, password });
        else r = await API.post('/auth/register', {
          email, password,
          username: document.getElementById('aUser').value.trim(),
          display_name: document.getElementById('aName').value.trim(),
          account_type: document.getElementById('aType').value,
        });
        API.setToken(r.token, document.getElementById('aRemember').checked);
        closeModal();
        await App.refreshAuth();
        toast(`Welcome, ${r.user.display_name}! ✨`);
        App.route();
      } catch (e) { toast(e.data?.error || 'Authentication failed'); }
    };
  },

  /* ---------------- FORGOT PASSWORD ---------------- */
  forgotModal() {
    openModal(`<h3 style="margin-top:0">🔑 Reset your password</h3>
      <div class="form-grid">
        <label class="f">Email<input id="fEmail" type="email"></label>
        <button class="btn" id="fRequest">Request reset code</button>
        <div class="muted">The app owner sees your request in the Admin tab and gives you a 6-digit code (good for 30 minutes). Ask them for it, then finish here.</div>
        <label class="f hidden" id="fCodeF">Reset code<input id="fCode" inputmode="numeric" maxlength="6"></label>
        <label class="f hidden" id="fPassF">New password<span class="pw-wrap"><input id="fPass" type="password"><button type="button" id="fPassEye" class="pw-eye" aria-label="Show password" title="Show password">👁️</button></span></label>
        <button class="btn hidden" id="fReset">Set new password</button>
        <button class="btn small ghost" id="fBack">← Back to log in</button>
      </div>`);
    const eye = document.getElementById('fPassEye');
    eye.onclick = () => {
      const inp = document.getElementById('fPass');
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      eye.textContent = show ? '🙈' : '👁️';
      inp.focus();
    };
    document.getElementById('fBack').onclick = () => Views.authModal();
    document.getElementById('fRequest').onclick = async () => {
      const email = document.getElementById('fEmail').value.trim();
      if (!email) { toast('Enter your email first'); return; }
      try {
        await API.post('/auth/forgot', { email });
        ['fCodeF', 'fPassF', 'fReset'].forEach(id => document.getElementById(id).classList.remove('hidden'));
        toast('Request sent — ask the app owner for your code 🔑');
      } catch (e) { toast('Could not send the request'); }
    };
    document.getElementById('fReset').onclick = async () => {
      try {
        const r = await API.post('/auth/reset', {
          email: document.getElementById('fEmail').value.trim(),
          code: document.getElementById('fCode').value.trim(),
          new_password: document.getElementById('fPass').value,
        });
        API.setToken(r.token);
        closeModal();
        await App.refreshAuth();
        toast(`Password updated — welcome back, ${r.user.display_name}! 🎉`);
        App.route();
      } catch (e) { toast(e.data?.error || 'Reset failed'); }
    };
  },
};
