const titleEl = document.getElementById('track-title');
const artistEl = document.getElementById('track-artist');
const loginBtn = document.getElementById('login-btn');
const minimizeBtn = document.getElementById('minimize-btn');
const closeBtn = document.getElementById('close-btn');
const themeBtn = document.getElementById('theme-btn');
const themePopover = document.getElementById('theme-popover');
const swatchButtons = document.querySelectorAll('.swatch');
const toastEl = document.getElementById('toast');
const stateMessageEl = document.getElementById('state-message');
const lyricsEl = document.getElementById('lyrics');
const prevBtn = document.getElementById('prev-btn');
const playPauseBtn = document.getElementById('play-pause-btn');
const nextBtn = document.getElementById('next-btn');

let isLoggedIn = false;
let currentTrackId = null;
let lyricLines = null; // [{timeSec, text}] | null
let lyricLineEls = [];
let activeLineIndex = -1;

let isPlaying = false;
let baseProgressMs = 0;
let baseWallClockMs = 0;
let rafHandle = null;

function setState(message) {
  if (message) {
    stateMessageEl.textContent = message;
    stateMessageEl.classList.remove('hidden');
    lyricsEl.classList.add('hidden');
  } else {
    stateMessageEl.classList.add('hidden');
    lyricsEl.classList.remove('hidden');
  }
}

function resetLyricsView() {
  lyricLines = null;
  lyricLineEls = [];
  activeLineIndex = -1;
  lyricsEl.innerHTML = '';
}

function renderSyncedLines(lines) {
  resetLyricsView();
  lyricLines = lines;
  const frag = document.createDocumentFragment();
  for (const line of lines) {
    const div = document.createElement('div');
    div.className = 'lyric-line';
    div.textContent = line.text || '♪';
    frag.appendChild(div);
    lyricLineEls.push(div);
  }
  lyricsEl.appendChild(frag);
  setState(null);
}

function renderPlainText(text) {
  resetLyricsView();
  const div = document.createElement('div');
  div.className = 'lyric-line plain active';
  div.textContent = text;
  lyricsEl.appendChild(div);
  setState(null);
}

function stopInterpolation() {
  if (rafHandle) cancelAnimationFrame(rafHandle);
  rafHandle = null;
}

function findActiveIndex(currentSec) {
  if (!lyricLines || lyricLines.length === 0) return -1;
  let lo = 0;
  let hi = lyricLines.length - 1;
  if (currentSec < lyricLines[0].timeSec) return -1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (lyricLines[mid].timeSec <= currentSec) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function tickInterpolation() {
  if (!isPlaying) return;
  const currentMs = baseProgressMs + (Date.now() - baseWallClockMs);
  const currentSec = currentMs / 1000;

  if (lyricLines && lyricLines.length > 0) {
    const idx = findActiveIndex(currentSec);
    if (idx !== activeLineIndex) {
      if (activeLineIndex >= 0 && lyricLineEls[activeLineIndex]) {
        lyricLineEls[activeLineIndex].classList.remove('active');
      }
      if (idx >= 0 && lyricLineEls[idx]) {
        lyricLineEls[idx].classList.add('active');
        lyricLineEls[idx].scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      activeLineIndex = idx;
    }
  }

  rafHandle = requestAnimationFrame(tickInterpolation);
}

function startInterpolation() {
  stopInterpolation();
  rafHandle = requestAnimationFrame(tickInterpolation);
}

function updateHeader(title, artist) {
  titleEl.textContent = title || 'Spotify Lyrics';
  artistEl.textContent = artist || '';
}

function updateLoginUI() {
  loginBtn.title = isLoggedIn ? 'Log out' : 'Connect to Spotify';
  loginBtn.style.color = isLoggedIn ? '#2ad64b' : '';
}

loginBtn.addEventListener('click', () => {
  if (isLoggedIn) window.lyricsAPI.logout();
  else window.lyricsAPI.login();
});

minimizeBtn.addEventListener('click', () => window.lyricsAPI.minimizeWindow());
closeBtn.addEventListener('click', () => window.lyricsAPI.quit());

let toastTimer = null;
function showToast(message) {
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2600);
}

const CONTROL_ERROR_MESSAGES = {
  premium_required: 'Requires Spotify Premium',
  no_active_device: 'No active Spotify device',
  needs_reauth: 'Please log in again',
  logged_out: 'Connect your Spotify account first',
  network_error: "Can't reach Spotify right now",
  error: 'Something went wrong',
};

function handleControlResult(result) {
  if (!result || result.ok) return;
  showToast(CONTROL_ERROR_MESSAGES[result.reason] || CONTROL_ERROR_MESSAGES.error);
}

themeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  themePopover.classList.toggle('hidden');
});

document.addEventListener('click', () => themePopover.classList.add('hidden'));

swatchButtons.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const theme = btn.dataset.theme;
    applyTheme(theme);
    window.lyricsAPI.setTheme(theme);
    themePopover.classList.add('hidden');
  });
});

function applyTheme(theme) {
  if (theme === 'dark') document.body.removeAttribute('data-theme');
  else document.body.setAttribute('data-theme', theme);
}

window.lyricsAPI.getTheme().then((theme) => applyTheme(theme));

prevBtn.addEventListener('click', () => window.lyricsAPI.previous().then(handleControlResult));
nextBtn.addEventListener('click', () => window.lyricsAPI.next().then(handleControlResult));

// While this is in the future, poll ticks are ignored for the play/pause
// icon specifically — Spotify's backend takes a beat to apply a command, so
// a tick can land mid-flight still reporting the pre-command state and
// flicker the icon back before the real update arrives.
let iconOverrideUntil = 0;
const ICON_OVERRIDE_MS = 2500;

playPauseBtn.addEventListener('click', () => {
  const wasPlaying = isPlaying;
  updatePlayPauseIcon(!wasPlaying);
  iconOverrideUntil = Date.now() + ICON_OVERRIDE_MS;
  const action = wasPlaying ? window.lyricsAPI.pause() : window.lyricsAPI.play();
  action.then((result) => {
    if (!result.ok) {
      iconOverrideUntil = 0;
      updatePlayPauseIcon(wasPlaying);
      handleControlResult(result);
    }
  });
});

function updatePlayPauseIcon(playing) {
  playPauseBtn.textContent = playing ? '⏸' : '▶';
}

window.lyricsAPI.onAuthState(({ loggedIn }) => {
  isLoggedIn = loggedIn;
  updateLoginUI();
  if (!loggedIn) {
    updateHeader('Spotify Lyrics', '');
    resetLyricsView();
    stopInterpolation();
    setState('Connect your Spotify account to get started');
  }
});

window.lyricsAPI.onTrackChanged((track) => {
  currentTrackId = track.trackId;
  updateHeader(track.title, track.artist);
  resetLyricsView();
  setState('Loading lyrics…');
});

window.lyricsAPI.onLyricsLoaded((result) => {
  if (result.trackId !== currentTrackId) return; // arrived late, track already changed
  if (result.status === 'synced') {
    renderSyncedLines(result.lines);
  } else if (result.status === 'plain') {
    renderPlainText(result.text);
  } else if (result.status === 'instrumental') {
    resetLyricsView();
    setState('🎵 Instrumental');
  } else {
    resetLyricsView();
    setState('No lyrics found for this track');
  }
});

window.lyricsAPI.onPlaybackTick(({ isPlaying: playing, progressMs }) => {
  isPlaying = playing;
  baseProgressMs = progressMs;
  baseWallClockMs = Date.now();
  if (Date.now() >= iconOverrideUntil) updatePlayPauseIcon(playing);
  if (playing) startInterpolation();
  else stopInterpolation();
});

window.lyricsAPI.onPlaybackIdle(({ reason }) => {
  isPlaying = false;
  updatePlayPauseIcon(false);
  stopInterpolation();
  currentTrackId = null;
  resetLyricsView();
  updateHeader('Spotify Lyrics', '');

  const messages = {
    logged_out: 'Connect your Spotify account to get started',
    nothing_playing: 'Nothing playing right now',
    ad: 'Ad playing…',
    offline: 'Offline — retrying…',
  };
  setState(messages[reason] || 'Nothing playing right now');
});

window.lyricsAPI.getAuthState().then(({ loggedIn }) => {
  isLoggedIn = loggedIn;
  updateLoginUI();
});
