const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lyricsAPI', {
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getAuthState: () => ipcRenderer.invoke('auth:getState'),

  onAuthState: (cb) => ipcRenderer.on('auth:state', (_e, payload) => cb(payload)),
  onPlaybackTick: (cb) => ipcRenderer.on('playback:tick', (_e, payload) => cb(payload)),
  onTrackChanged: (cb) => ipcRenderer.on('track:changed', (_e, payload) => cb(payload)),
  onLyricsLoaded: (cb) => ipcRenderer.on('lyrics:loaded', (_e, payload) => cb(payload)),
  onPlaybackIdle: (cb) => ipcRenderer.on('playback:idle', (_e, payload) => cb(payload)),

  setClickThrough: (value) => ipcRenderer.send('window:setClickThrough', value),
  setOpacity: (value) => ipcRenderer.send('window:setOpacity', value),
  hideWindow: () => ipcRenderer.send('window:hide'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  quit: () => ipcRenderer.send('app:quit'),

  play: () => ipcRenderer.invoke('playback:play'),
  pause: () => ipcRenderer.invoke('playback:pause'),
  next: () => ipcRenderer.invoke('playback:next'),
  previous: () => ipcRenderer.invoke('playback:previous'),

  getTheme: () => ipcRenderer.invoke('theme:get'),
  setTheme: (theme) => ipcRenderer.send('theme:set', theme),
});
