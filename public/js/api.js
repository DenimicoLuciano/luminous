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
  // Streaming POST: opts in server-side by sending { stream: true }. When
  // the server answers with text/event-stream, onToken(content) fires per
  // token and the promise resolves with the final `done` frame's data.
  // When the server answers plain JSON instead (provider fallback, AI not
  // configured, errors), this behaves exactly like req('POST', ...).
  async streamPost(path, body, onToken, timeoutMs = 100000) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    let ctl = null, timer = null;
    const opts = { method: 'POST', headers, body: JSON.stringify({ ...(body || {}), stream: true }) };
    if (typeof AbortController !== 'undefined') {
      ctl = new AbortController();
      opts.signal = ctl.signal;
      timer = setTimeout(() => ctl.abort(), timeoutMs);
    }
    let res;
    try { res = await fetch('/api' + path, opts); }
    finally { if (timer) clearTimeout(timer); }
    const ctype = res.headers.get('content-type') || '';
    if (!ctype.includes('text/event-stream') || !res.body) {
      let data = null;
      try { data = await res.json(); } catch (e) { /* non-json */ }
      if (!res.ok) {
        const err = new Error((data && data.error) || 'Request failed');
        err.status = res.status; err.data = data;
        throw err;
      }
      return data;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '', result = null, streamErr = null;
    const handleEvent = (raw) => {
      let type = 'message', dataStr = '';
      for (const ln of raw.split('\n')) {
        if (ln.startsWith('event:')) type = ln.slice(6).trim();
        else if (ln.startsWith('data:')) dataStr += ln.slice(5).trim();
      }
      if (!dataStr) return;
      let j = null;
      try { j = JSON.parse(dataStr); } catch (e) { return; }
      if (type === 'token' && j.content && onToken) onToken(j.content);
      else if (type === 'done') result = j;
      else if (type === 'error') { streamErr = new Error(j.message || 'AI_ERROR'); streamErr.data = j; }
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        handleEvent(buf.slice(0, idx));
        buf = buf.slice(idx + 2);
      }
    }
    if (buf.trim()) handleEvent(buf);
    if (streamErr) throw streamErr;
    return result || { aiConfigured: true, reply: null };
  },

  // Upload with progress (XHR — fetch has no upload progress events).
  // Same /api prefix, auth header and error shape as req().
  uploadProgress(path, formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api' + path);
      if (API.token) xhr.setRequestHeader('Authorization', 'Bearer ' + API.token);
      if (xhr.upload && onProgress) xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      xhr.onload = () => {
        let data = null;
        try { data = JSON.parse(xhr.responseText); } catch (e) { /* non-json */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else {
          const err = new Error((data && data.error) || 'Request failed');
          err.status = xhr.status; err.data = data;
          reject(err);
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(formData);
    });
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
