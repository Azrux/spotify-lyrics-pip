const BASE_URL = 'https://api.spotify.com/v1/me/player';

// Remote-controls whatever Spotify Connect device is currently active (phone,
// desktop app, speaker...) — this app never plays audio itself. All of these
// endpoints require Spotify Premium and the user-modify-playback-state scope.
async function sendCommand(auth, method, path, deviceId) {
  const token = await auth.getValidAccessToken();
  if (!token) return { ok: false, reason: 'logged_out' };

  // Without an explicit device_id, Spotify infers "the active device" —
  // which is unreliable right after another command was just sent (it can
  // silently no-op instead of erroring). Targeting the device we last saw
  // in a poll makes this deterministic.
  const url = new URL(`${BASE_URL}${path}`);
  if (deviceId) url.searchParams.set('device_id', deviceId);

  let res;
  try {
    res = await fetch(url, {
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
    console.error(`Spotify 403 on ${method} ${path}: "${message}"`);
    if (/scope/i.test(message)) {
      // The stored token predates the playback-control permission — force a
      // fresh login so the next authorization includes the new scope.
      auth.logout();
      return { ok: false, reason: 'needs_reauth' };
    }
    if (/premium/i.test(message)) {
      return { ok: false, reason: 'premium_required' };
    }
    return { ok: false, reason: 'error', message };
  }

  if (res.status === 401) {
    auth.logout();
    return { ok: false, reason: 'logged_out' };
  }

  console.error(`Spotify ${res.status} on ${method} ${path}`);
  return { ok: false, reason: 'error', status: res.status };
}

const play = (auth, deviceId) => sendCommand(auth, 'PUT', '/play', deviceId);
const pause = (auth, deviceId) => sendCommand(auth, 'PUT', '/pause', deviceId);
const next = (auth, deviceId) => sendCommand(auth, 'POST', '/next', deviceId);
const previous = (auth, deviceId) => sendCommand(auth, 'POST', '/previous', deviceId);

module.exports = { play, pause, next, previous };
