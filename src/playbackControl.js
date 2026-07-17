const BASE_URL = 'https://api.spotify.com/v1/me/player';

// Remote-controls whatever Spotify Connect device is currently active (phone,
// desktop app, speaker...) — this app never plays audio itself. All of these
// endpoints require Spotify Premium and the user-modify-playback-state scope.
async function sendCommand(auth, method, path) {
  const token = await auth.getValidAccessToken();
  if (!token) return { ok: false, reason: 'logged_out' };

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    return { ok: false, reason: 'network_error' };
  }

  if (res.status === 204 || res.ok) return { ok: true };

  if (res.status === 404) return { ok: false, reason: 'no_active_device' };

  if (res.status === 403) {
    let message = '';
    try {
      const data = await res.json();
      message = (data.error && data.error.message) || '';
    } catch {
      // ignore, fall through with empty message
    }
    if (/scope/i.test(message)) {
      // The stored token predates the playback-control permission — force a
      // fresh login so the next authorization includes the new scope.
      auth.logout();
      return { ok: false, reason: 'needs_reauth' };
    }
    return { ok: false, reason: 'premium_required' };
  }

  if (res.status === 401) {
    auth.logout();
    return { ok: false, reason: 'logged_out' };
  }

  return { ok: false, reason: 'error', status: res.status };
}

const play = (auth) => sendCommand(auth, 'PUT', '/play');
const pause = (auth) => sendCommand(auth, 'PUT', '/pause');
const next = (auth) => sendCommand(auth, 'POST', '/next');
const previous = (auth) => sendCommand(auth, 'POST', '/previous');

module.exports = { play, pause, next, previous };
