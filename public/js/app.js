// Luminous app shell — state, router, theme, nav
const App = {
  user: null,
  wallet: null,
  milestones: [],
  _profileTab: 'posts',

  async init() {
    // theme (dark mystery by default; toggle lives in the ☰ More menu)
    const saved = localStorage.getItem('luminous_theme') || 'dark';
    document.documentElement.dataset.theme = saved;
    // saved accent color re-themes buttons/rings/highlights via CSS variables
    if (typeof Appearance !== 'undefined') Appearance.initAccent();

    document.getElementById('fab').onclick = () => location.hash = '#/create';
    const moreBtn = document.getElementById('moreBtn');
    if (moreBtn) moreBtn.onclick = () => Views.moreMenu();

    if (API.token) await this.refreshAuth().catch(() => API.setToken(null));
    this.renderNav();
    window.addEventListener('hashchange', () => this.route());
    this.route();

    // incoming-call watcher: pops the ring screen when a friend calls you
    setInterval(async () => {
      if (!this.user || !API.token || window._activeCall || document.getElementById('callOverlay')) return;
      try {
        const { call } = await API.get('/calls/incoming');
        if (call) CallUI.incoming(call);
      } catch (e) { /* ignore */ }
    }, 4000);
  },

  async refreshAuth() {
    if (!API.token) { this.user = null; this.renderNav(); return; }
    const { user, wallet, milestones } = await API.get('/auth/me');
    this.user = user; this.wallet = wallet; this.milestones = milestones;
    this.renderNav();
  },

  async checkMilestones() {
    if (!API.token) return;
    try {
      const before = new Set(this.milestones.filter(m => m.unlocked).map(m => m.key));
      const { milestones } = await API.get('/auth/me');
      this.milestones = milestones;
      milestones.forEach(m => {
        if (m.unlocked && !before.has(m.key)) toast(`🏆 Milestone unlocked: ${m.name}! (+${m.xp_reward} XP)`);
      });
      const { user, wallet } = await API.get('/auth/me');
      this.user = user; this.wallet = wallet;
      this.renderNav();
    } catch (e) { /* ignore */ }
  },

  renderNav() {
    // Floating bottom nav (concept layout): Home · Discover · Create · LIVE · Profile.
    // Everything else (Friends, Stories, Lums, Mentors, Companions, Wallet, Settings,
    // Appearance, Admin) lives in the header's ☰ More menu.
    const items = [
      ['#/', '⌂', 'Home', ''],
      ['#/discover', '🔍', 'Discover', ''],
      ['#/create', '＋', 'Create', 'nav-create'],
      ['#/live', '◎', 'LIVE', ''],
      [this.user ? '#/profile/' + this.user.username : '#/profile', this.user ? (this.user.avatar_emoji || '●') : '●', 'Profile', ''],
    ];
    const hash = location.hash || '#/';
    const isActive = (h) => {
      if (h === '#/') return hash === '#/' || hash === '#' || hash === '';
      if (h === '#/profile' || h.startsWith('#/profile/')) return hash.startsWith('#/profile');
      return hash === h || hash.startsWith(h + '/');
    };
    document.getElementById('navpill').innerHTML = items.map(([h, e, l, cls]) =>
      `<a href="${h}" class="${cls}${isActive(h) ? ' active' : ''}"><span class="e">${e}</span>${l}</a>`).join('');
    document.getElementById('fab').classList.toggle('hidden', !this.user);

    const area = document.getElementById('authArea');
    if (this.user) {
      area.innerHTML = `<button class="icon-btn avatar-btn" id="meBtn" title="${esc(this.user.display_name)}">${esc(this.user.avatar_emoji)}</button>`;
      document.getElementById('meBtn').onclick = () => location.hash = '#/profile/' + this.user.username;
    } else {
      area.innerHTML = `<button class="btn small" id="loginBtn">Log in</button>`;
      document.getElementById('loginBtn').onclick = () => Views.authModal();
    }
  },

  route() {
    const el = document.getElementById('app');
    const hash = location.hash || '#/';
    if (window._chatTimer && !hash.startsWith('#/chat/')) { clearInterval(window._chatTimer); window._chatTimer = null; }
    if (window._liveCleanup && !hash.startsWith('#/live/')) { try { window._liveCleanup(); } catch (e) {} window._liveCleanup = null; }
    this.renderNav();
    window.scrollTo(0, 0);
    // per-screen custom background (Appearance feature, localStorage only)
    if (typeof Appearance !== 'undefined') Appearance.applyForHash(hash);
    const needAuth = ['#/mentors', '#/companions', '#/wallet', '#/settings', '#/create', '#/admin', '#/friends', '#/chat'];
    if (!this.user && needAuth.some(p => hash === p || hash.startsWith(p + '/'))) {
      el.innerHTML = `<div class="card center"><h3>✨ Join Luminous</h3><div class="muted">Log in or create an account to use this feature.</div>
        <div class="mt"><button class="btn" onclick="Views.authModal()">Log in / Sign up</button></div></div>`;
      return;
    }
    if (hash === '#/' || hash === '#') Views.feed(el);
    else if (hash === '#/appearance') Views.appearance(el);
    else if (hash === '#/profile') {
      if (this.user) { location.hash = '#/profile/' + this.user.username; return; }
      el.innerHTML = `<div class="card center"><h3>✦ Your profile awaits</h3><div class="muted">Log in or create an account to see your profile.</div>
        <div class="mt"><button class="btn" onclick="Views.authModal()">Log in / Sign up</button></div></div>`;
    }
    else if (hash === '#/discover') Views.discover(el);
    else if (hash === '#/friends') Views.friends(el);
    else if (hash.startsWith('#/chat/')) Views.chat(el, hash.split('/')[2]);
    else if (hash === '#/stories') Views.stories(el);
    else if (hash === '#/lums') Views.lums(el);
    else if (hash === '#/live') Views.live(el);
    else if (hash.startsWith('#/live/')) Views.liveRoom(el, hash.split('/')[2]);
    else if (hash === '#/mentors') Views.mentors(el);
    else if (hash.startsWith('#/mentors/')) Views.mentorChat(el, hash.split('/')[2]);
    else if (hash === '#/companions') Views.companions(el);
    else if (hash.startsWith('#/companions/')) Views.companionChat(el, hash.split('/')[2]);
    else if (hash === '#/wallet') Views.wallet(el);
    else if (hash.startsWith('#/profile/')) Views.profile(el, decodeURIComponent(hash.split('/')[2]));
    else if (hash === '#/settings') Views.settings(el);
    else if (hash === '#/create') Views.create(el);
    else if (hash === '#/admin') Views.admin(el);
    else Views.feed(el);
  },
};

// companions nav entry lives under Mentors — add quick link in topbar area via navpill overflow
document.addEventListener('DOMContentLoaded', () => App.init());
