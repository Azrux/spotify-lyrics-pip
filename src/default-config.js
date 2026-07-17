// Client ID of the Spotify app bundled with the installer.
// It's not a secret (this app uses OAuth PKCE, no client secret involved),
// so it's safe to keep here and commit it. Fill it in before building the
// installer for others with "npm run dist" — see README.md.
//
// For local development you can still use config.json (gitignored) to test
// with your own Client ID without touching this file.
module.exports = {
  clientId: '',
  redirectPort: 8888,
};
