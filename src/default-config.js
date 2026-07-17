// Client ID of the Spotify app bundled with the installer.
//
// This stays blank in git — the GitHub Actions release workflow
// (.github/workflows/release.yml) overwrites this file at build time using
// the SPOTIFY_CLIENT_ID repository secret, so the real value never lives in
// git history. See README.md → "Distributing the app to other people".
//
// For local development, use config.json (gitignored) to test with your own
// Client ID without touching this file. To test a *packaged* build locally
// (npm run dist), you can temporarily paste your Client ID below — just
// don't commit it.
module.exports = {
  clientId: '',
  redirectPort: 8888,
};
