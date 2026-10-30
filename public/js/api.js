// Luminous API client
const API = {
  token: sessionStorage.getItem('luminous_token') || localStorage.getItem('luminous_token') || null,

  async req(method, path, body, isForm = false, timeoutMs = 0) {
    const headers = {};
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    let payload;
    if (body && !isForm) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    else if (body) payload = body;
    const opts = { method, headers, body: payload };
    let timer = null;
    if (timeoutMs > 0 && typeof AbortController !== 'undefined') {
      const ctl = new AbortController();
      opts.signal = ctl.signal;
      timer = setTimeout(() => ctl.abort(), timeoutMs);
    }
    let res;
    try { res = await fetch('/api' + path, opts); }
    finally { if (timer) clearTimeout(timer); }
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-json */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || 'Request failed');
      err.status = res.status; err.data = data;
      throw err;
    }
    return data;
  },
  get: (p) => API.req('GET', p),
  post: (p, b, timeoutMs) => API.req('POST', p, b, false, timeoutMs || 0),
  patch: (p, b) => API.req('PATCH', p, b),
  del: (p) => API.req('DELETE', p),
  upload: (p, formData) => API.req('POST', p, formData, true),

  setToken(t, remember = true) {
    this.token = t;
    sessionStorage.removeItem('luminous_token');
    localStorage.removeItem('luminous_token');
    if (t) (remember ? localStorage : sessionStorage).setItem('luminous_token', t);
  },
};
