const { EventEmitter } = require('events');

const CURRENTLY_PLAYING_URL =
  'https://api.spotify.com/v1/me/player/currently-playing?additional_types=track';
const POLL_INTERVAL_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

class SpotifyPoller extends EventEmitter {
  constructor(auth) {
    super();
    this.auth = auth;
    this.lastTrackId = null;
    this.consecutiveFailures = 0;
    this.stopped = true;
    this.timer = null;
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this._scheduleNext(0);
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  _scheduleNext(delayMs) {
    if (this.stopped) return;
    this.timer = setTimeout(() => this._pollOnce(), delayMs);
  }

  async _pollOnce() {
    if (this.stopped) return;

    const token = await this.auth.getValidAccessToken();
    if (!token) {
      this.lastTrackId = null;
      this.emit('idle', { reason: 'logged_out' });
      this._scheduleNext(POLL_INTERVAL_MS);
      return;
    }

    let res;
    try {
      res = await fetch(CURRENTLY_PLAYING_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error('Network failure querying currently-playing:', err.message);
      this._handleNetworkFailure();
      return;
    }

    if (res.status === 429) {
      const retryAfterSec = parseInt(res.headers.get('Retry-After') || '5', 10);
      this._scheduleNext(retryAfterSec * 1000);
      return;
    }

    if (res.status === 401) {
      // The token may have been revoked right between polls; getValidAccessToken
      // already tried to refresh it, so a 401 here is treated as an invalid session.
      this.lastTrackId = null;
      this.emit('idle', { reason: 'logged_out' });
      this._scheduleNext(POLL_INTERVAL_MS);
      return;
    }

    if (res.status === 204) {
      this.consecutiveFailures = 0;
      this.lastTrackId = null;
      this.emit('idle', { reason: 'nothing_playing' });
      this._scheduleNext(POLL_INTERVAL_MS);
      return;
    }

    if (!res.ok) {
      this._handleNetworkFailure();
      return;
    }

    this.consecutiveFailures = 0;

    let data;
    try {
      data = await res.json();
    } catch {
      this.emit('idle', { reason: 'nothing_playing' });
      this._scheduleNext(POLL_INTERVAL_MS);
      return;
    }

    if (data.currently_playing_type === 'ad' || !data.item) {
      this.lastTrackId = null;
      this.emit('idle', { reason: data.currently_playing_type === 'ad' ? 'ad' : 'nothing_playing' });
      this._scheduleNext(POLL_INTERVAL_MS);
      return;
    }

    const item = data.item;
    const trackId = item.id;

    if (trackId !== this.lastTrackId) {
      this.lastTrackId = trackId;
      this.emit('trackChanged', {
        trackId,
        title: item.name,
        artist: item.artists.map((a) => a.name).join(', '),
        album: item.album ? item.album.name : '',
        durationMs: item.duration_ms,
      });
    }

    this.emit('tick', {
      isPlaying: data.is_playing,
      progressMs: data.progress_ms,
      trackId,
      serverTimeMs: Date.now(),
    });

    this._scheduleNext(POLL_INTERVAL_MS);
  }

  _handleNetworkFailure() {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= 2) {
      this.emit('idle', { reason: 'offline' });
    }
    const backoff = Math.min(POLL_INTERVAL_MS * 2 ** this.consecutiveFailures, MAX_BACKOFF_MS);
    this._scheduleNext(backoff);
  }
}

module.exports = { SpotifyPoller };
