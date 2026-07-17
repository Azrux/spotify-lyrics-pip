const fs = require('fs');
const path = require('path');
const defaultConfig = require('./default-config');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const EXAMPLE_PATH = path.join(__dirname, '..', 'config.example.json');

// config.json (gitignored) is an optional local override for development —
// useful if you want to test with your own Client ID without touching
// default-config.js, which is the one embedded in the final installer.
function loadLocalOverride() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch (err) {
    throw new Error(`Invalid config.json: ${err.message}`);
  }
}

function loadConfig() {
  const override = loadLocalOverride();
  const config = { ...defaultConfig, ...override };

  if (!config.clientId || config.clientId === 'YOUR_SPOTIFY_CLIENT_ID') {
    throw new Error(
      `Missing a valid Spotify Client ID. Fill it in at src/default-config.js (to distribute the app) ` +
        `or copy config.example.json to config.json and paste your own Client ID there (for local development only).\n(${EXAMPLE_PATH})`
    );
  }
  if (!config.redirectPort) config.redirectPort = 8888;
  return config;
}

module.exports = { loadConfig };
