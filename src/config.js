const fs = require('fs');
const path = require('path');
const defaultConfig = require('./default-config');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const EXAMPLE_PATH = path.join(__dirname, '..', 'config.example.json');

// config.json (gitignored) es un override local opcional para desarrollo —
// útil si quieres probar con tu propio Client ID sin tocar default-config.js,
// que es el que se embebe en el instalador final.
function loadLocalOverride() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch (err) {
    throw new Error(`config.json inválido: ${err.message}`);
  }
}

function loadConfig() {
  const override = loadLocalOverride();
  const config = { ...defaultConfig, ...override };

  if (!config.clientId || config.clientId === 'TU_CLIENT_ID_DE_SPOTIFY') {
    throw new Error(
      `Falta un Client ID de Spotify válido. Complétalo en src/default-config.js (para distribuir la app) ` +
        `o copia config.example.json a config.json y pega ahí tu propio Client ID (solo para desarrollo local).\n(${EXAMPLE_PATH})`
    );
  }
  if (!config.redirectPort) config.redirectPort = 8888;
  return config;
}

module.exports = { loadConfig };
