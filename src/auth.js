const crypto = require('crypto');
const http = require('http');
const { EventEmitter } = require('events');
const { shell } = require('electron');
const store = require('./store');

const SCOPES = 'user-read-currently-playing user-read-playback-state';
const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const TOKEN_EXPIRY_SAFETY_MS = 60_000;

const SUCCESS_HTML = `<!doctype html><html><body style="font-family:sans-serif;text-align:center;margin-top:15vh">
<h2>Spotify login complete</h2><p>You can close this tab now.</p></body></html>`;

const ERROR_HTML = (msg) => `<!doctype html><html><body style="font-family:sans-serif;text-align:center;margin-top:15vh">
<h2>Login failed</h2><p>${msg}</p><p>You can close this tab and try again.</p></body></html>`;

class Auth extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.accessToken = null;
    this.expiresAt = 0;
    this.refreshToken = null;
    this.isAuthenticating = false;
    this.pendingLogin = null;
  }

  isLoggedIn() {
    return !!this.refreshToken;
  }

  emitState() {
    this.emit('state', { loggedIn: this.isLoggedIn() });
  }

  // Tries to restore a saved session on app startup.
  async init() {
    const stored = store.loadRefreshToken();
    if (!stored) {
      this.emitState();
      return;
    }
    this.refreshToken = stored;
    try {
      await this.refreshAccessToken();
    } catch (err) {
      console.error('Could not restore saved session:', err.message);
      this.refreshToken = null;
      store.clearRefreshToken();
    }
    this.emitState();
  }

  login() {
    if (this.isAuthenticating) return this.pendingLogin;
    this.isAuthenticating = true;
    this.pendingLogin = this._doLogin().finally(() => {
      this.isAuthenticating = false;
      this.pendingLogin = null;
    });
    return this.pendingLogin;
  }

  async _doLogin() {
    const verifier = crypto.randomBytes(64).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const state = crypto.randomBytes(16).toString('hex');
    const port = this.config.redirectPort;
    const redirectUri = `http://127.0.0.1:${port}/callback`;

    const code = await this._waitForCode(port, state, () => {
      const url = new URL(AUTHORIZE_URL);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', this.config.clientId);
      url.searchParams.set('scope', SCOPES);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('code_challenge_method', 'S256');
      url.searchParams.set('code_challenge', challenge);
      url.searchParams.set('state', state);
      shell.openExternal(url.toString());
    });

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.config.clientId,
      code_verifier: verifier,
    });

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      throw new Error(`Failed to exchange code for tokens (${res.status})`);
    }
    const data = await res.json();
    this._applyTokenResponse(data);
    this.emitState();
  }

  _waitForCode(port, expectedState, openAuthUrl) {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const url = new URL(req.url, `http://127.0.0.1:${port}`);
        if (url.pathname !== '/callback') {
          res.writeHead(404).end();
          return;
        }
        const error = url.searchParams.get('error');
        const state = url.searchParams.get('state');
        const code = url.searchParams.get('code');

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html' }).end(ERROR_HTML(error));
          server.close();
          reject(new Error(`Spotify returned an error: ${error}`));
          return;
        }
        if (state !== expectedState) {
          res.writeHead(200, { 'Content-Type': 'text/html' }).end(ERROR_HTML('invalid state'));
          server.close();
          reject(new Error('The state parameter does not match (possible CSRF)'));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' }).end(SUCCESS_HTML);
        server.close();
        resolve(code);
      });

      server.on('error', reject);
      server.listen(port, '127.0.0.1', () => {
        openAuthUrl();
      });
    });
  }

  _applyTokenResponse(data) {
    this.accessToken = data.access_token;
    this.expiresAt = Date.now() + data.expires_in * 1000 - TOKEN_EXPIRY_SAFETY_MS;
    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
      store.saveRefreshToken(this.refreshToken);
    }
  }

  async refreshAccessToken() {
    if (!this.refreshToken) throw new Error('No refresh token available');
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: this.config.clientId,
    });
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      throw new Error(`Failed to refresh token (${res.status})`);
    }
    const data = await res.json();
    this._applyTokenResponse(data);
  }

  async getValidAccessToken() {
    if (!this.refreshToken) return null;
    if (this.accessToken && Date.now() < this.expiresAt) return this.accessToken;
    try {
      await this.refreshAccessToken();
      return this.accessToken;
    } catch (err) {
      console.error('Refresh token invalid or revoked:', err.message);
      this.logout();
      return null;
    }
  }

  logout() {
    this.accessToken = null;
    this.expiresAt = 0;
    this.refreshToken = null;
    store.clearRefreshToken();
    this.emitState();
  }
}

module.exports = { Auth };
