const { Tray, Menu, nativeImage, app } = require('electron');
const store = require('./store');
const windowManager = require('./windowManager');

let tray = null;

// Genera un icono simple (círculo verde) en memoria, sin depender de archivos externos.
function buildTrayIcon() {
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4); // BGRA
  const cx = size / 2 - 0.5;
  const cy = size / 2 - 0.5;
  const radius = size / 2 - 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const inside = dx * dx + dy * dy <= radius * radius;
      const i = (y * size + x) * 4;
      if (inside) {
        buffer[i] = 0x2a; // B
        buffer[i + 1] = 0xd6; // G
        buffer[i + 2] = 0x4b; // R
        buffer[i + 3] = 0xff; // A
      } else {
        buffer[i] = 0;
        buffer[i + 1] = 0;
        buffer[i + 2] = 0;
        buffer[i + 3] = 0;
      }
    }
  }

  return nativeImage.createFromBitmap(buffer, { width: size, height: size });
}

function buildMenu(auth) {
  const loggedIn = auth.isLoggedIn();
  const clickThrough = store.getSetting('clickThrough', false);
  const opacity = store.getSetting('opacity', 1);

  return Menu.buildFromTemplate([
    {
      label: loggedIn ? 'Cerrar sesión de Spotify' : 'Iniciar sesión con Spotify',
      click: () => (loggedIn ? auth.logout() : auth.login().catch((err) => console.error(err))),
    },
    { type: 'separator' },
    { label: 'Mostrar/Ocultar ventana', click: () => windowManager.toggleVisibility() },
    {
      label: 'Click-through (dejar pasar clics)',
      type: 'checkbox',
      checked: clickThrough,
      click: (item) => windowManager.setClickThrough(item.checked),
    },
    {
      label: 'Opacidad',
      submenu: [0.4, 0.7, 1].map((value) => ({
        label: `${Math.round(value * 100)}%`,
        type: 'radio',
        checked: Math.abs(opacity - value) < 0.01,
        click: () => windowManager.setOpacity(value),
      })),
    },
    { type: 'separator' },
    { label: 'Salir', click: () => app.quit() },
  ]);
}

function createTray(auth) {
  tray = new Tray(buildTrayIcon());
  tray.setToolTip('Spotify Lyrics PiP');
  tray.setContextMenu(buildMenu(auth));

  auth.on('state', () => {
    if (tray) tray.setContextMenu(buildMenu(auth));
  });

  tray.on('click', () => windowManager.toggleVisibility());

  return tray;
}

function refreshTrayMenu(auth) {
  if (tray) tray.setContextMenu(buildMenu(auth));
}

module.exports = { createTray, refreshTrayMenu };
