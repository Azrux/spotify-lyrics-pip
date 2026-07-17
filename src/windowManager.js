const path = require('path');
const { BrowserWindow, screen } = require('electron');
const store = require('./store');

const DEFAULT_BOUNDS = { width: 420, height: 160, x: undefined, y: undefined };
const DEFAULT_OPACITY = 1;
let win = null;
let saveBoundsTimer = null;

function boundsAreOnScreen(bounds) {
  if (bounds.x === undefined || bounds.y === undefined) return true;
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return (
      bounds.x >= a.x &&
      bounds.y >= a.y &&
      bounds.x < a.x + a.width &&
      bounds.y < a.y + a.height
    );
  });
}

function createWindow() {
  const savedBounds = store.getSetting('windowBounds', DEFAULT_BOUNDS);
  const bounds = boundsAreOnScreen(savedBounds) ? savedBounds : DEFAULT_BOUNDS;
  const opacity = store.getSetting('opacity', DEFAULT_OPACITY);
  const clickThrough = store.getSetting('clickThrough', false);

  // Solo incluir x/y si son números reales; si no, Electron centra la ventana sola.
  const boundsOpts = { width: bounds.width, height: bounds.height };
  if (typeof bounds.x === 'number' && typeof bounds.y === 'number') {
    boundsOpts.x = bounds.x;
    boundsOpts.y = bounds.y;
  }

  win = new BrowserWindow({
    ...boundsOpts,
    minWidth: 260,
    minHeight: 90,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: true,
    skipTaskbar: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setOpacity(opacity);
  if (clickThrough) win.setIgnoreMouseEvents(true, { forward: true });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  const persistBounds = () => {
    clearTimeout(saveBoundsTimer);
    saveBoundsTimer = setTimeout(() => {
      if (!win || win.isDestroyed()) return;
      store.setSetting('windowBounds', win.getBounds());
    }, 500);
  };
  win.on('move', persistBounds);
  win.on('resize', persistBounds);
  win.on('closed', () => {
    win = null;
  });

  return win;
}

function getWindow() {
  return win;
}

function setClickThrough(enabled) {
  if (!win || win.isDestroyed()) return;
  win.setIgnoreMouseEvents(!!enabled, { forward: true });
  store.setSetting('clickThrough', !!enabled);
}

function setOpacity(value) {
  if (!win || win.isDestroyed()) return;
  const clamped = Math.min(1, Math.max(0.15, value));
  win.setOpacity(clamped);
  store.setSetting('opacity', clamped);
}

function toggleVisibility() {
  if (!win || win.isDestroyed()) {
    createWindow();
    return;
  }
  if (win.isVisible()) win.hide();
  else win.show();
}

module.exports = { createWindow, getWindow, setClickThrough, setOpacity, toggleVisibility };
