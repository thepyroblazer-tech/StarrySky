/* Spotify Web API client: PKCE login (no client secret), token refresh, request helper. */
(function () {
  'use strict';

  const SCOPES = [
    'user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing',
    'playlist-read-private', 'playlist-read-collaborative',
    'user-library-read', 'user-library-modify', 'user-read-recently-played',
  ].join(' ');

  const KEY = k => 'starrysky:' + k;
  const get = k => { try { return JSON.parse(localStorage.getItem(KEY(k))); } catch (e) { return null; } };
  const set = (k, v) => { try { v == null ? localStorage.removeItem(KEY(k)) : localStorage.setItem(KEY(k), JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const native = () => window.StarryNative;

  function redirectUri() {
    return native() ? native().redirectUri() : location.origin + location.pathname;
  }

  function b64url(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function randomBytes(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; }

  async function login(clientId) {
    const verifier = b64url(randomBytes(64));
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const state = b64url(randomBytes(16));
    set('pkce', { verifier, state, clientId });
    const url = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
      client_id: clientId, response_type: 'code', redirect_uri: redirectUri(),
      code_challenge_method: 'S256', code_challenge: challenge, scope: SCOPES, state,
    });
    if (native()) native().openExternal(url); else location.href = url;
  }

  async function tokenRequest(body) {
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error_description || j.error || ('Login failed (' + r.status + ')')); e.status = r.status; throw e; }
    return j;
  }

  function saveToken(t) {
    const old = get('token') || {};
    set('token', { access: t.access_token, refresh: t.refresh_token || old.refresh, exp: Date.now() + (t.expires_in - 60) * 1000 });
  }

  /** Returns true when the URL was a Spotify login redirect that we handled. */
  async function handleRedirect(urlStr) {
    const p = new URL(urlStr).searchParams;
    const code = p.get('code'), err = p.get('error'), state = p.get('state');
    if (!code && !err) return false;
    const pk = get('pkce'); set('pkce', null);
    if (err) throw new Error(err === 'access_denied' ? 'Login was cancelled.' : 'Spotify said: ' + err);
    if (!pk || pk.state !== state) throw new Error('That login link is old. Tap Connect again.');
    const tok = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), client_id: pk.clientId, code_verifier: pk.verifier });
    set('clientId', pk.clientId); saveToken(tok);
    return true;
  }

  let refreshing = null;
  async function accessToken() {
    const t = get('token');
    if (!t) { const e = new Error('Not logged in'); e.status = 401; e.auth = true; throw e; }
    if (Date.now() < t.exp) return t.access;
    if (!refreshing) {
      refreshing = tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: get('clientId') })
        .then(saveToken)
        .catch(e => { if (e.status === 400 || e.status === 401) { set('token', null); e.auth = true; } throw e; })
        .finally(() => { refreshing = null; });
    }
    await refreshing;
    return get('token').access;
  }

  async function api(path, opts = {}) {
    const { method = 'GET', body, query } = opts;
    let url = path.startsWith('http') ? path : 'https://api.spotify.com/v1' + path;
    if (query) url += (url.includes('?') ? '&' : '?') + new URLSearchParams(query);
    for (let attempt = 0; attempt < 3; attempt++) {
      const headers = { Authorization: 'Bearer ' + await accessToken() };
      if (body) headers['Content-Type'] = 'application/json';
      const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
      if (r.status === 401 && attempt === 0) { const t = get('token'); if (t) { t.exp = 0; set('token', t); } continue; }
      if (r.status === 429) { await sleep(Math.min(+(r.headers.get('Retry-After') || 1), 5) * 1000); continue; }
      if (r.status === 204 || r.status === 202) return null;
      const text = await r.text();
      let j = null; try { j = text ? JSON.parse(text) : null; } catch (e) { /* non-JSON body */ }
      if (!r.ok) {
        const e = new Error((j && j.error && (j.error.message || j.error)) || ('Spotify error ' + r.status));
        e.status = r.status; e.reason = j && j.error && j.error.reason; throw e;
      }
      return j;
    }
    throw new Error('Spotify is busy. Try again in a moment.');
  }

  window.Spotify = {
    login, handleRedirect, api, redirectUri, get, set,
    loggedIn: () => !!get('token'),
    clientId: () => get('clientId'),
    logout: () => set('token', null),
  };
})();
