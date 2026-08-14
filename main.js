const { app, ipcMain, BrowserWindow } = require('electron');
const { loadConfig } = require('./src/config');
const { Auth } = require('./src/auth');
const { SpotifyPoller } = require('./src/spotify');
const { fetchLyricsForTrack } = require('./src/lyrics');
const playbackControl = require('./src/playbackControl');
const windowManager = require('./src/windowManager');
const tray = require('./src/tray');
const store = require('./src/store');

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let auth;
let poller;
let lastDeviceId = null;

function send(channel, payload) {
  const win = windowManager.getWindow();
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function wireSpotifyEvents() {
  poller.on('idle', (payload) => {
    lastDeviceId = null;
    send('playback:idle', payload);
  });
  poller.on('tick', (payload) => {
    if (payload.deviceId) lastDeviceId = payload.deviceId;
    send('playback:tick', payload);
  });
  poller.on('trackChanged', async (track) => {
    send('track:changed', track);
    const lyrics = await fetchLyricsForTrack(track);
    send('lyrics:loaded', { trackId: track.trackId, ...lyrics });
  });
}

function wireIpc() {
  ipcMain.handle('auth:login', () => auth.login());
  ipcMain.handle('auth:logout', () => auth.logout());
  ipcMain.handle('auth:getState', () => ({ loggedIn: auth.isLoggedIn() }));

  ipcMain.on('window:setClickThrough', (_e, value) => windowManager.setClickThrough(value));
  ipcMain.on('window:setOpacity', (_e, value) => windowManager.setOpacity(value));
  ipcMain.on('window:hide', () => windowManager.toggleVisibility());
  ipcMain.on('window:minimize', () => windowManager.minimize());
  ipcMain.on('app:quit', () => app.quit());

  const runControl = async (fn) => {
    const result = await fn(auth, lastDeviceId);
    if (result.ok) {
      // Spotify's own backend needs a moment to apply the change before it
      // shows up in currently-playing; polling instantly would often still
      // read the pre-command state. A short delay avoids that race.
      setTimeout(() => poller.pollNow(), 350);
    }
    return result;
  };

  ipcMain.handle('playback:play', () => runControl(playbackControl.play));
  ipcMain.handle('playback:pause', () => runControl(playbackControl.pause));
  ipcMain.handle('playback:next', () => runControl(playbackControl.next));
  ipcMain.handle('playback:previous', () => runControl(playbackControl.previous));

  ipcMain.handle('theme:get', () => store.getSetting('theme', 'dark'));
  ipcMain.on('theme:set', (_e, theme) => store.setSetting('theme', theme));

  auth.on('state', (state) => send('auth:state', state));
}

app.whenReady().then(async () => {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    // Without a valid config we can't authenticate; log the error and leave
    // the window in its empty state instead of crashing silently.
    console.error(err.message);
    config = { clientId: '', redirectPort: 8888 };
  }

  auth = new Auth(config);
  poller = new SpotifyPoller(auth);

  windowManager.createWindow();
  tray.createTray(auth);
  wireIpc();
  wireSpotifyEvents();

  await auth.init();
  poller.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) windowManager.createWindow();
  });
});

// Tray app: subscribing to this event without calling app.quit() stops
// Electron from auto-quitting when the window closes; quitting only happens
// via "Quit" in the tray menu.
app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  if (poller) poller.stop();
});
