const { app, ipcMain, BrowserWindow } = require('electron');
const { loadConfig } = require('./src/config');
const { Auth } = require('./src/auth');
const { SpotifyPoller } = require('./src/spotify');
const { fetchLyricsForTrack } = require('./src/lyrics');
const windowManager = require('./src/windowManager');
const tray = require('./src/tray');

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let auth;
let poller;

function send(channel, payload) {
  const win = windowManager.getWindow();
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function wireSpotifyEvents() {
  poller.on('idle', (payload) => send('playback:idle', payload));
  poller.on('tick', (payload) => send('playback:tick', payload));
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
  ipcMain.on('app:quit', () => app.quit());

  auth.on('state', (state) => send('auth:state', state));
}

app.whenReady().then(async () => {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    // Sin config.json válido no podemos autenticar; mostramos el error en consola
    // y dejamos la ventana vacía en vez de crashear silenciosamente.
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

// App de bandeja: al suscribirse a este evento sin llamar a app.quit(), Electron
// no sale automáticamente al cerrar la ventana; solo se sale desde "Salir" del tray.
app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  if (poller) poller.stop();
});
