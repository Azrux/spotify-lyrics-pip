const titleEl = document.getElementById('track-title');
const artistEl = document.getElementById('track-artist');
const loginBtn = document.getElementById('login-btn');
const hideBtn = document.getElementById('hide-btn');
const stateMessageEl = document.getElementById('state-message');
const lyricsEl = document.getElementById('lyrics');

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

hideBtn.addEventListener('click', () => window.lyricsAPI.hideWindow());

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
  if (playing) startInterpolation();
  else stopInterpolation();
});

window.lyricsAPI.onPlaybackIdle(({ reason }) => {
  isPlaying = false;
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
