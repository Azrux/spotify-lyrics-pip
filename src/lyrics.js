const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const GET_URL = 'https://lrclib.net/api/get';
const SEARCH_URL = 'https://lrclib.net/api/search';

const memoryCache = new Map();
let cacheDir = null;

function getCacheDir() {
  if (!cacheDir) {
    cacheDir = path.join(app.getPath('userData'), 'lyrics-cache');
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

function cacheFilePath(trackId) {
  return path.join(getCacheDir(), `${trackId}.json`);
}

function readDiskCache(trackId) {
  const file = cacheFilePath(trackId);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

function writeDiskCache(trackId, result) {
  try {
    fs.writeFileSync(cacheFilePath(trackId), JSON.stringify(result), 'utf-8');
  } catch (err) {
    console.error('Could not write lyrics cache:', err.message);
  }
}

// Converts LRC text (syncedLyrics) into [{ timeSec, text }], sorted by time.
function parseLRC(lrc) {
  const timeTagRe = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
  let offsetMs = 0;
  const result = [];

  for (const rawLine of lrc.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const offsetMatch = line.match(/^\[offset:\s*(-?\d+)\]$/i);
    if (offsetMatch) {
      offsetMs = parseInt(offsetMatch[1], 10);
      continue;
    }

    timeTagRe.lastIndex = 0;
    const timestamps = [];
    let match;
    let lastIndex = 0;
    while ((match = timeTagRe.exec(line)) !== null) {
      const frac = match[3] ? parseFloat(`0.${match[3]}`) : 0;
      timestamps.push(parseInt(match[1], 10) * 60 + parseInt(match[2], 10) + frac);
      lastIndex = timeTagRe.lastIndex;
    }
    if (timestamps.length === 0) continue; // metadata line without a timestamp ([ar:], [ti:], etc.)

    const text = line.slice(lastIndex).trim();
    for (const t of timestamps) {
      result.push({ timeSec: t + offsetMs / 1000, text });
    }
  }

  return result.sort((a, b) => a.timeSec - b.timeSec);
}

function classify(data) {
  if (!data) return { status: 'not_found' };
  if (data.instrumental) return { status: 'instrumental' };
  if (data.syncedLyrics) {
    try {
      const lines = parseLRC(data.syncedLyrics);
      if (lines.length > 0) return { status: 'synced', lines };
    } catch (err) {
      console.error('Error parsing LRC, falling back to plain text:', err.message);
    }
  }
  if (data.plainLyrics) return { status: 'plain', text: data.plainLyrics };
  return { status: 'not_found' };
}

async function queryLrclib(params) {
  const url = new URL(GET_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`lrclib /get returned ${res.status}`);
  return res.json();
}

async function searchLrclib(params) {
  const url = new URL(SEARCH_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`lrclib /search returned ${res.status}`);
  const results = await res.json();
  if (!Array.isArray(results) || results.length === 0) return null;
  const withSync = results.find((r) => r.syncedLyrics);
  return withSync || results[0];
}

async function fetchLyricsForTrack({ trackId, title, artist, album, durationMs }) {
  if (memoryCache.has(trackId)) return memoryCache.get(trackId);

  const disk = readDiskCache(trackId);
  if (disk) {
    memoryCache.set(trackId, disk);
    return disk;
  }

  const durationSec = Math.round(durationMs / 1000);
  let raw = null;
  try {
    raw = await queryLrclib({
      track_name: title,
      artist_name: artist,
      album_name: album,
      duration: durationSec,
    });
    if (!raw) {
      raw = await searchLrclib({ track_name: title, artist_name: artist });
    }
  } catch (err) {
    console.error('Failed querying lrclib.net:', err.message);
    return { status: 'not_found' };
  }

  const result = classify(raw);
  memoryCache.set(trackId, result);
  writeDiskCache(trackId, result);
  return result;
}

module.exports = { fetchLyricsForTrack, parseLRC };
