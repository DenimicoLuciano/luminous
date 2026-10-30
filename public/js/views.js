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
  <span class="muted">The server owner needs to set an <code>OPENAI_API_KEY</code> environment variable and redeploy. Everything else in Luminous works without it.</span></div>`;

/* ---------------- friends helpers ---------------- */
function tierChip(t) {
  if (!t) return '';
  return `<span class="tier-chip tier-${t.key}">${t.emoji} ${t.label}</span>`;
}
function friendRow(f) {
  const u = f.user, t = f.tier;
  const sub = t.next
    ? `Friends for ${t.days} day${t.days === 1 ? '' : 's'} · ${t.next.inDays} day${t.next.inDays === 1 ? '' : 's'} to ${t.next.label}`
    : `Friends for ${t.days} days · top level!`;
  return `<div class="card friend-card">
    <div class="friend-row">${avatarHtml(u, 48)}
      <div class="grow">
        <div class="name"><a href="#/profile/${esc(u.username)}" style="color:inherit">${esc(u.display_name)}</a> ${badgesHtml(u)}${f.unread ? ` <span class="badge unread">${f.unread} new</span>` : ''}</div>
        <div class="muted">@${esc(u.username)}${f.last_message ? ' · ' + esc(f.last_message.content.slice(0, 42)) : ''}</div>
        <div class="tier-line">${tierChip(t)} <span class="muted">${sub}</span></div>
      </div>
    </div>
    <div class="friend-actions">
      <a class="btn small" href="#/chat/${u.id}">💬 Message</a>
      <button class="btn small" data-call-kind="audio" data-call-user="${u.id}" data-call-name="${esc(u.display_name)}">📞 Call</button>
      <button class="btn small" data-call-kind="video" data-call-user="${u.id}" data-call-name="${esc(u.display_name)}">🎥 Video</button>
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
  return `<div class="msg ${mine ? 'me' : 'them'}"><div class="bubble">${esc(m.content)}</div><div class="msg-time">${timeAgo(m.created_at)}</div></div>`;
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

  /* ---------------- FEED ---------------- */
  async feed(el) {
    el.innerHTML = `<div class="card center"><div class="muted">Loading your feed…</div></div>`;
    try {
      const { posts } = await API.get('/feed?limit=30');
      await CONFIG_READY;
      if (!posts.length) { el.innerHTML = `<div class="card center">No posts yet — be the first! <div class="mt"><a class="btn" href="#/create">Create a post</a></div></div>`; return; }
      const items = []; let seenReg = 0;
      for (const p of posts) { items.push(p); if (!p.is_ad) { seenReg++; if (ADSTERRA_KEY && seenReg % 6 === 0) items.push({ _adSlot: 'network' }); } }
      el.innerHTML = items.map(p => p._adSlot === 'network' ? netAdCard() : postCard(p)).join('');
      mountNetAds(el);
      // count views (fire-and-forget); AI views never count toward earnings (server-side)
      posts.forEach(p => { if (!p.is_ad) API.post(`/posts/${p.id}/view`).catch(() => {}); });
    } catch (e) { el.innerHTML = `<div class="card center">Couldn't load the feed. Try again.</div>`; }
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
        ${App.user ? `<button class="btn small" id="goLive">Go Live</button>` : `<span class="muted">Log in to go live</span>`}</div></div>
      ${streams.length ? streams.map(s => `
        <div class="card"><div class="row">
          ${avatarHtml(s)}<div class="grow"><div class="name"><b>${esc(s.display_name)}</b> ${badgesHtml(s)}</div>
          <div class="post-time">${esc(s.title)} · 👁 ${s.viewers_now || 0} watching · 🎤 ${s.on_stage || 0} on stage · 🪙 ${s.coins_earned}</div></div>
          <span class="live-badge">LIVE</span></div>
          <div class="mt"><a class="btn small" href="#/live/${s.id}">Join</a></div></div>`).join('')
        : `<div class="card center muted">Nobody is live right now.</div>`}`;
    const btn = document.getElementById('goLive');
    if (btn) btn.onclick = async () => {
      const title = prompt('Stream title:', 'Live now ✨') || 'Live now ✨';
      try {
        const { id } = await API.post('/live/start', { title });
        App.checkMilestones();
        location.hash = '#/live/' + id;
      } catch (e) { toast(e.data?.error === 'You already have a live stream' ? 'You already have a live stream' : 'Could not start stream'); }
    };
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
        <div class="live-host-chip">${avatarHtml(stream, 30)}<div class="lhc-txt"><b>${esc(stream.display_name)}</b><span>${esc(stream.title || '')}</span></div><span class="live-badge">LIVE</span></div>
        <div class="live-top-right"><span class="live-pill">👁 <span id="lvViewers">${stream.viewers_now || 0}</span></span><span class="live-pill">🪙 <span id="lvCoins">${stream.coins_earned || 0}</span></span><button class="live-x" id="lvClose">✕</button></div>
      </div>
      <div class="live-invite hidden" id="lvInvite"></div>
      <div class="live-hearts" id="lvHearts"></div>
      <div class="live-rail">
        <button class="rail-btn" id="lvTap">❤️<span>Like</span></button>
        <button class="rail-btn" id="lvShare">↗️<span>Share</span></button>
        <button class="rail-btn" id="lvGift">🎁<span>Gift</span></button>
        ${isHost ? `<button class="rail-btn" id="lvHost">🎛️<span>Host</span></button>` : `<button class="rail-btn" id="lvStageBtn">🎤<span>Stage</span></button>`}
      </div>
      <div class="live-bottom">
        <div class="live-chat" id="lvChat"></div>
        ${App.user ? `<form class="live-comment" id="lvCommentForm"><input id="lvCommentIn" placeholder="Say something…" maxlength="300" autocomplete="off"><button class="btn small" type="submit">Send</button></form>`
          : `<div class="live-comment"><button class="btn small grow" onclick="Views.authModal()">Log in to comment, tap & gift</button></div>`}
        <div class="live-toggles hidden" id="lvToggles"><button class="rail-btn mini" id="lvMic">🎙️</button><button class="rail-btn mini" id="lvCam">📷</button></div>
      </div>
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
      else if (e.kind === 'gift') chatLine(`🎁 <b>${esc(e.display_name || 'Someone')}</b> sent ${e.coins} coins${e.note ? ' — ' + esc(e.note) : ''}`, true);
      else if (e.kind === 'stage') chatLine(`🎤 <b>${esc(e.display_name || 'Someone')}</b> ${esc(e.note || '')}`, true);
    }
    (data.events || []).slice(-25).forEach(showEvent);

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

    /* ---------------- stage presence ---------------- */
    async function startStage() {
      if (onStage || destroyed) return;
      if (!RTC_OK) { toast('Live video is not supported in this browser'); return; }
      try { localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); }
      catch (e) { toast('Camera/mic permission is needed to join the stage 🎤'); return; }
      onStage = true;
      $('lvToggles').classList.remove('hidden');
      renderSig = ''; renderStage();
      // full mesh: I initiate to stage members with a higher user id (lower id offers — same rule as calls)
      stageUsers().forEach(u => { if (App.user && u.user_id > App.user.id) offerTo(u.user_id); });
      if (isHost) syncViewerLinks();
    }
    function stopStage() {
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      localStream = null;
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
      let bal = '—';
      try { const w = await API.get('/wallet'); bal = w.wallet ? w.wallet.coins : 0; } catch (e) {}
      openSheet(`<h4>🎁 Send a gift</h4><div class="muted">Your wallet: 🪙 <span id="lvBal">${bal}</span></div>
        <div class="gift-row mt"><button class="btn small ghost" id="lvFreeGift">🎁 Free gift (+1)</button>
        <button class="btn small ghost" data-gift="10">🪙 10</button><button class="btn small ghost" data-gift="50">💰 50</button>
        <button class="btn small ghost" data-gift="100">💎 100</button><button class="btn small ghost" data-gift="500">👑 500</button></div>
        <div class="muted mt">Gifts go to ${esc(stream.display_name)}'s stream. Free gift every 20s.</div>`);
      $('lvFreeGift').onclick = async () => {
        if (freeCooldown) { toast('Free gift cooling down… ⏳'); return; }
        const r = await API.post(`/live/${id}/free-gift`).catch(() => null);
        if (r && !r.cooldown) { toast('Free gift sent! 🎁'); freeCooldown = true; setTimeout(() => freeCooldown = false, 20000); }
        else toast('Free gift cooling down… ⏳');
      };
      sheetEl.querySelectorAll('[data-gift]').forEach(b => b.onclick = async () => {
        const coins = +b.dataset.gift;
        try { await API.post(`/live/${id}/gift`, { coins }); toast(`Sent ${coins} coins! 🪙`); App.refreshAuth(); closeSheet(); }
        catch (e) { toast(e.data?.error || 'Could not send gift'); }
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
      if (localStream) localStream.getTracks().forEach(t => t.stop());
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
    if (cam) cam.onclick = () => { if (!localStream) return; const t = localStream.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; cam.classList.toggle('off', !t.enabled); cam.textContent = t.enabled ? '📷' : '🚫'; } };

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
        <div class="card mentor-card" data-key="${esc(m.key)}">
          <div class="big">${esc(m.emoji)}</div><b>${esc(m.name)}</b>
          <div class="muted">${esc(m.tagline)}</div></div>`).join('') + `</div>`;
    el.querySelectorAll('.mentor-card').forEach(c => c.onclick = () => location.hash = '#/mentors/' + c.dataset.key);
  },

  async mentorChat(el, key) {
    const { mentors, aiConfigured } = await API.get('/mentors');
    const m = mentors.find(x => x.key === key);
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
      box.innerHTML += `<div class="msg assistant" id="typing"><i>typing…</i></div>`;
      box.scrollTop = box.scrollHeight;
      try {
        const r = await API.post(`/mentors/${key}/chat`, { message: text }, 100000);
        document.getElementById('typing')?.remove();
        if (r.aiConfigured) box.innerHTML += `<div class="msg assistant">${esc(r.reply)}</div>`;
        else box.innerHTML += `<div class="msg assistant"><i>⚠️ AI is not configured on this server yet.</i></div>`;
      } catch (e) { document.getElementById('typing')?.remove(); box.innerHTML += e && e.name === 'AbortError' ? `<div class="msg assistant"><i>⏳ The AI lane is very slow right now — if a reply arrives late it will show when you reopen this chat.</i></div>` : `<div class="msg assistant"><i>Something went wrong.</i></div>`; }
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
      box.innerHTML += `<div class="msg user">${esc(text)}</div><div class="msg assistant" id="typing"><i>typing…</i></div>`;
      box.scrollTop = box.scrollHeight;
      try {
        const r = await API.post(`/companions/${id}/chat`, { message: text }, 100000);
        document.getElementById('typing')?.remove();
        box.innerHTML += r.aiConfigured ? `<div class="msg assistant">${esc(r.reply)}</div>` : `<div class="msg assistant"><i>⚠️ AI is not configured on this server yet.</i></div>`;
      } catch (e) { document.getElementById('typing')?.remove(); if (e && e.name === 'AbortError') box.innerHTML += `<div class="msg assistant"><i>⏳ The AI lane is very slow right now — if a reply arrives late it will show when you reopen this chat.</i></div>`; }
      box.scrollTop = box.scrollHeight;
    };
    document.getElementById('chatSend').onclick = send;
    document.getElementById('chatIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  },

  /* ---------------- WALLET ---------------- */
  async wallet(el) {
    const { wallet, payouts, canEarn, payoutThresholdCents, earnPer1kViews, payoutMethod } = await API.get('/wallet');
    const earnDollars = (wallet.earnings_cents / 100).toFixed(2);
    el.innerHTML = `
      <div class="card"><h3 style="margin:0 0 10px">👛 Wallet</h3>
        <div class="stat-grid">
          <div class="stat card"><div class="num">🪙 ${wallet.coins}</div><div class="muted">coins</div></div>
          <div class="stat card"><div class="num">$${earnDollars}</div><div class="muted">ad earnings</div></div>
        </div></div>
      <div class="card"><h4 style="margin:0 0 8px">💳 Cashout method</h4>
        <div id="pmBox"></div>
      </div>
      <div class="card"><h4 style="margin:0 0 8px">💰 Creator earnings</h4>
        ${canEarn ? `
          <div class="muted">You earn <b>55% of ad revenue</b> — <b>$${earnPer1kViews.toFixed(2)} per 1,000 real views</b> on your posts. (AI demo-account views never count.)</div>
          <div class="mt row"><button class="btn" id="payoutBtn" ${wallet.earnings_cents < payoutThresholdCents ? 'disabled' : ''}>
            Request payout ($${earnDollars})</button></div>
          ${wallet.earnings_cents < payoutThresholdCents ? `<div class="muted mt">Minimum payout is $10.00.</div>` : ''}`
        : `<div class="notice">Earnings are for <b>Business</b> and <b>Creator</b> accounts with the <b>✓ Approved</b> identity badge.
            <div class="mt"><a class="btn small" href="#/settings">Upgrade in Settings</a></div></div>`}
      </div>
      <div class="card"><h4 style="margin:0 0 8px">Payout history</h4>
        ${payouts.length ? payouts.map(p => `<div class="row"><div class="grow">$${(p.amount_cents / 100).toFixed(2)} · ${timeAgo(p.created_at)}${p.destination ? ` · to ${esc(p.destination)}` : ''}</div><span class="badge">${esc(p.status)}</span></div>`).join('')
          : `<div class="muted">No payouts yet.</div>`}</div>`;
    // ---- cashout method wiring ----
    const pmBox = document.getElementById('pmBox');
    const pmLabel = (pm) => pm.method === 'paypal' ? `PayPal — ${esc(pm.paypal_email)}` : `Visa debit •••• ${esc(pm.card_last4 || '')} (${esc(pm.card_name || '')})`;
    const pmForm = () => {
      pmBox.innerHTML = `<div class="muted">Where should your cashouts go? You can save this <b>now</b> — you don't need to reach the $10 minimum first.</div>
        <div class="mt"><select id="pmMethod" style="width:100%">
          <option value="paypal">PayPal</option>
          <option value="visa_debit">Visa debit card</option>
        </select></div>
        <div id="pmFields" class="mt"></div>
        <div class="row mt"><button class="btn small" id="pmSave">Save cashout method</button>
        ${payoutMethod ? '<button class="btn small ghost" id="pmCancel">Cancel</button>' : ''}</div>`;
      const fields = document.getElementById('pmFields');
      const draw = () => {
        const m = document.getElementById('pmMethod').value;
        fields.innerHTML = m === 'paypal'
          ? `<input id="pmEmail" type="email" placeholder="Your PayPal email" style="width:100%">`
          : `<input id="pmName" placeholder="Name on card" style="width:100%">
             <input id="pmLast4" inputmode="numeric" maxlength="4" placeholder="Last 4 digits ONLY" class="mt" style="width:100%">
             <div class="muted mt">For safety we only ever store the <b>last 4 digits</b> — never enter your full card number.</div>`;
      };
      document.getElementById('pmMethod').onchange = draw; draw();
      const cancel = document.getElementById('pmCancel'); if (cancel) cancel.onclick = pmShow;
      document.getElementById('pmSave').onclick = async () => {
        const m = document.getElementById('pmMethod').value;
        const body = { method: m };
        if (m === 'paypal') body.paypal_email = document.getElementById('pmEmail').value;
        else { body.card_name = document.getElementById('pmName').value; body.card_last4 = document.getElementById('pmLast4').value; }
        try { await API.post('/wallet/payout-method', body); toast('Cashout method saved'); Views.wallet(el); }
        catch (e) { toast(e.data?.error || 'Could not save'); }
      };
    };
    const pmShow = () => {
      if (payoutMethod) {
        pmBox.innerHTML = `<div class="row"><span class="grow">${pmLabel(payoutMethod)}</span>
          <button class="btn small ghost" id="pmChange">Change</button>
          <button class="btn small ghost" id="pmRemove">Remove</button></div>
          <div class="muted mt">This is where payouts will be sent when you cash out.</div>`;
        document.getElementById('pmChange').onclick = pmForm;
        document.getElementById('pmRemove').onclick = async () => { try { await API.del('/wallet/payout-method'); toast('Cashout method removed'); Views.wallet(el); } catch (e) { toast('Could not remove'); } };
      } else pmForm();
    };
    pmShow();
    const btn = document.getElementById('payoutBtn');
    if (btn) btn.onclick = async () => {
      try { const r = await API.post('/wallet/payout'); toast(`Payout requested: $${(r.amount_cents / 100).toFixed(2)} 🎉`); Views.wallet(el); App.refreshAuth(); }
      catch (e) { toast(e.data?.error || 'Payout failed'); }
    };
  },

  /* ---------------- PROFILE ---------------- */
  async profile(el, username) {
    let data;
    try { data = await API.get('/users/' + encodeURIComponent(username)); }
    catch (e) { el.innerHTML = `<div class="card center">User not found.</div>`; return; }
    const { user: u, posts, lums, milestones, isOwn } = data;
    const tab = App._profileTab || 'posts';
    const statusColor = { active: '#22c55e', away: '#f59e0b', offline: '#6b7280' }[u.status] || '#22c55e';
    el.innerHTML = `
      <div class="card">
        <div class="profile-banner" style="background:${esc(u.profile_color)}"></div>
        <div class="profile-head">${avatarHtml(u, 76)}
          <div class="grow"><h2 style="margin:0">${esc(u.display_name)}</h2>
            <div class="muted">@${esc(u.username)}</div>
            ${u.is_developer ? `<div class="dev-title">👨‍💻 Founder &amp; Developer of Luminous</div>` : ''}
            <div class="mt">${badgesHtml(u)}</div></div>
          ${isOwn ? `<a class="btn small ghost" href="#/settings">Edit</a>` : ''}
        </div>
        <div class="mt"><span class="status-dot" style="background:${statusColor}"></span><span class="muted">${esc(u.status)}</span>
          ${u.public_age ? ` · <span class="muted">${u.public_age} yrs old</span>` : ''}</div>
        ${u.bio ? `<div class="mt">${esc(u.bio)}</div>` : ''}
        ${u.hobbies?.length ? `<div class="chips">${u.hobbies.map(h => `<span class="chip">${esc(h)}</span>`).join('')}</div>` : ''}
        <div class="mt"><b>Level ${u.level}</b> <span class="muted">· ${u.xp} XP</span>
          <div class="level-bar"><i style="width:${Math.min(100, (u.xp / (100 * u.level * u.level)) * 100)}%"></i></div></div>
      </div>
      <div class="tabs">
        <button data-t="posts" class="${tab === 'posts' ? 'active' : ''}">Posts</button>
        <button data-t="lums" class="${tab === 'lums' ? 'active' : ''}">Lums</button>
        <button data-t="milestones" class="${tab === 'milestones' ? 'active' : ''}">Milestones</button>
      </div>
      <div id="ptab"></div>`;
    el.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { App._profileTab = b.dataset.t; Views.profile(el, username); });
    const ptab = document.getElementById('ptab');
    if (tab === 'posts') ptab.innerHTML = posts.length ? posts.map(postCard).join('') : `<div class="card center muted">No posts yet.</div>`;
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
    el.innerHTML = `<div class="card"><h3 style="margin:0 0 10px">⚙️ Customize profile</h3>
      <div class="form-grid">
        <label class="f">Display name<input id="sName" value="${esc(u.display_name)}" maxlength="60"></label>
        <label class="f">Bio<textarea id="sBio" maxlength="500">${esc(u.bio || '')}</textarea></label>
        <div class="two">
          <label class="f">Public age<input id="sAge" type="number" min="13" max="120" value="${u.public_age || ''}" placeholder="—"></label>
          <label class="f">Status<select id="sStatus">
            <option value="active" ${u.status === 'active' ? 'selected' : ''}>🟢 Active</option>
            <option value="away" ${u.status === 'away' ? 'selected' : ''}>🟡 Away</option>
            <option value="offline" ${u.status === 'offline' ? 'selected' : ''}>⚫ Offline</option></select></label>
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
    document.getElementById('sSave').onclick = async () => {
      try {
        await API.patch('/profile', {
          display_name: document.getElementById('sName').value,
          bio: document.getElementById('sBio').value,
          public_age: document.getElementById('sAge').value || null,
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
  async create(el) {
    if (!App.user) { el.innerHTML = `<div class="card center">Log in to create. <div class="mt"><button class="btn" onclick="Views.authModal()">Log in / Sign up</button></div></div>`; return; }
    el.innerHTML = `<div class="card"><h3 style="margin:0 0 10px">＋ Create</h3>
      <div class="tabs">
        <button data-t="post" class="active">📝 Post</button>
        <button data-t="story">📖 Story</button>
        <button data-t="lum">🎬 Lum</button>
      </div><div id="ctab"></div></div>`;
    const ctab = document.getElementById('ctab');
    const show = (t) => {
      el.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.t === t));
      if (t === 'post') ctab.innerHTML = `
        <div class="form-grid"><textarea id="pText" maxlength="2000" placeholder="What's on your mind?"></textarea>
        <label class="f">Photo (optional)<input id="pImg" type="file" accept="image/*"></label>
        <label class="check-row"><input id="pPlan" type="checkbox"> <span>🕒 Plan for a specific date &amp; time</span></label>
        <label class="f hidden" id="pWhenF">Publish at<input id="pWhen" type="datetime-local"></label>
        <button class="btn" id="pGo">Publish post</button></div>
        <div id="planList"></div>`;
      if (t === 'story') ctab.innerHTML = `
        <div class="form-grid"><textarea id="sText" maxlength="500" placeholder="Story text…"></textarea>
        <label class="f">Image (optional)<input id="sImg" type="file" accept="image/*"></label>
        <div class="muted">Stories disappear after 24 hours.</div>
        <button class="btn" id="sGo">Share story</button></div>`;
      if (t === 'lum') ctab.innerHTML = `
        <div class="form-grid"><input id="lCap" maxlength="500" placeholder="Caption…">
        <label class="f">Video<input id="lVid" type="file" accept="video/*"></label>
        <button class="btn" id="lGo">Upload Lum</button></div>`;
      const planBox = document.getElementById('pPlan');
      if (planBox) {
        planBox.onchange = () => {
          document.getElementById('pWhenF').classList.toggle('hidden', !planBox.checked);
          document.getElementById('pGo').textContent = planBox.checked ? '🕒 Plan post' : 'Publish post';
        };
        loadPlannedPosts();
      }
      const go = async (btnId, fn) => {
        const b = document.getElementById(btnId);
        if (b) b.onclick = async () => { b.disabled = true; b.textContent = 'Publishing…'; try { await fn(); } finally { b.disabled = false; } };
      };
      go('pGo', async () => {
        const fd = new FormData();
        fd.append('content', document.getElementById('pText').value);
        const f = document.getElementById('pImg').files[0]; if (f) fd.append('image', f);
        const plan = document.getElementById('pPlan');
        if (plan && plan.checked) {
          const w = document.getElementById('pWhen').value;
          if (!w) { toast('Pick the date and time first 🕒'); return; }
          fd.append('publish_at', new Date(w).toISOString());
          try {
            const r = await API.upload('/posts/schedule', fd);
            toast(`Planned for ${new Date(r.publish_at.replace(' ', 'T') + 'Z').toLocaleString()} 🕒`);
            document.getElementById('pText').value = '';
            document.getElementById('pGo').textContent = '🕒 Plan post';
            loadPlannedPosts();
          } catch (e) { toast(e.data?.error || 'Could not plan the post'); document.getElementById('pGo').textContent = '🕒 Plan post'; }
          return;
        }
        try { await API.upload('/posts', fd); toast('Posted! ✨'); App.checkMilestones(); location.hash = '#/'; }
        catch (e) { toast(e.data?.error || 'Could not publish'); }
      });
      go('sGo', async () => {
        const fd = new FormData();
        fd.append('text', document.getElementById('sText').value);
        const f = document.getElementById('sImg').files[0]; if (f) fd.append('image', f);
        try { await API.upload('/stories', fd); toast('Story shared! 📖'); App.checkMilestones(); location.hash = '#/stories'; }
        catch (e) { toast(e.data?.error || 'Could not share'); }
      });
      go('lGo', async () => {
        const fd = new FormData();
        fd.append('caption', document.getElementById('lCap').value);
        const f = document.getElementById('lVid').files[0]; if (f) fd.append('video', f);
        try { await API.upload('/lums', fd); toast('Lum uploaded! 🎬'); App.checkMilestones(); location.hash = '#/lums'; }
        catch (e) { toast(e.data?.error || 'Could not upload'); }
      });
    };
    el.querySelectorAll('.tabs button').forEach(b => b.onclick = () => show(b.dataset.t));
    show('post');
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
          <div class="grow"><div class="name">${esc(friend.display_name)} ${badgesHtml(friend)}</div>
          <div>${tierChip(data.tier)} <span class="muted">@${esc(friend.username)}</span></div></div>
          <button class="btn small" id="chatCallAudio">📞</button>
          <button class="btn small" id="chatCallVideo">🎥</button>
        </div>
        <div class="card chat-box" id="chatBox">${data.messages.length ? data.messages.map(msgHtml).join('') : `<div class="muted center">No messages yet — say hi! 👋</div>`}</div>
        <div class="card chat-input-row"><input id="chatInput" placeholder="Message ${esc(friend.display_name)}…"><button class="btn" id="chatSend">Send</button></div>`;
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
        try { await API.post(`/dm/${userId}`, { content: v }); await refresh(); const b3 = document.getElementById('chatBox'); if (b3) b3.scrollTop = b3.scrollHeight; }
        catch (e) { toast(e.data?.error || 'Could not send'); }
      };
      document.getElementById('chatSend').onclick = send;
      document.getElementById('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
      document.getElementById('chatCallAudio').onclick = () => CallUI.start(userId, 'audio', friend.display_name);
      document.getElementById('chatCallVideo').onclick = () => CallUI.start(userId, 'video', friend.display_name);
      if (window._chatTimer) clearInterval(window._chatTimer);
      window._chatTimer = setInterval(refresh, 3000);
    } catch (e) {
      el.innerHTML = `<div class="card center"><h3>💬 Chat unavailable</h3><div class="muted">${esc(e.data?.error || 'You are not friends yet')}</div><div class="mt"><a class="btn" href="#/friends">Back to friends</a></div></div>`;
    }
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
