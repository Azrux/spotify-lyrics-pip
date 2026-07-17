const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

let settingsPath = null;

function getSettingsPath() {
  if (!settingsPath) {
    settingsPath = path.join(app.getPath('userData'), 'settings.json');
  }
  return settingsPath;
}

function readAll() {
  const p = getSettingsPath();
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return {};
  }
}

function writeAll(data) {
  const p = getSettingsPath();
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
}

function getSetting(key, fallback) {
  const data = readAll();
  return key in data ? data[key] : fallback;
}

function setSetting(key, value) {
  const data = readAll();
  data[key] = value;
  writeAll(data);
}

function saveRefreshToken(refreshToken) {
  if (!safeStorage.isEncryptionAvailable()) return false;
  const encrypted = safeStorage.encryptString(refreshToken).toString('base64');
  setSetting('refreshToken', encrypted);
  return true;
}

function loadRefreshToken() {
  if (!safeStorage.isEncryptionAvailable()) return null;
  const encrypted = getSetting('refreshToken', null);
  if (!encrypted) return null;
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
  } catch {
    return null;
  }
}

function clearRefreshToken() {
  const data = readAll();
  delete data.refreshToken;
  writeAll(data);
}

module.exports = {
  getSetting,
  setSetting,
  saveRefreshToken,
  loadRefreshToken,
  clearRefreshToken,
};
