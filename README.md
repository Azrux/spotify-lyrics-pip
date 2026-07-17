# Spotify Lyrics PiP

A floating, always-on-top window (like YouTube's Picture-in-Picture) that shows synced lyrics for whatever is currently playing on your Spotify account — from any device (phone, desktop, web player). Lyrics come from [lrclib.net](https://lrclib.net), a free public database of synced lyrics.

## 1. Create your app in the Spotify Developer Dashboard

Spotify requires each app to have its own Client ID (free, takes two minutes):

1. Go to https://developer.spotify.com/dashboard and log in with your Spotify account.
2. "Create app" → give it any name (e.g. "Lyrics PiP").
3. Under **Redirect URIs** add exactly: `http://127.0.0.1:8888/callback`
4. Under **APIs used** check "Web API".
5. Save, then open the new app's "Settings" and copy the **Client ID**.

## 2. Set up the project

```bash
npm install
copy config.example.json config.json
```

Edit `config.json` and paste your Client ID:

```json
{
  "clientId": "YOUR_CLIENT_ID_HERE",
  "redirectPort": 8888
}
```

## 3. Run it

```bash
npm start
```

A green icon appears in the system tray along with a small floating window. Right-click the tray icon → "Log in with Spotify" opens your browser to authorize the app. Play something on Spotify from any device on your account, and lyrics should start syncing within a couple of seconds.

## Usage

- **Drag**: click and drag the top of the window to move it.
- **Playback controls**: prev / play-pause / next at the bottom remote-control whatever Spotify Connect device is currently active (phone, desktop app, speaker). **Requires Spotify Premium** — Spotify itself blocks these endpoints for Free accounts, and the app will show a toast ("Requires Spotify Premium") instead of failing silently.
- **Background**: the 🎨 button opens a color picker (dark/midnight/forest/wine/light) for the panel background.
- **Minimize**: the "–" button minimizes to the taskbar like a normal window (it no longer floats over other apps while minimized).
- **Quit**: the "×" button now really quits the app. Use the tray icon (or minimize) if you just want it out of the way.
- **Click-through**: from the tray menu, let clicks pass through the window (so it doesn't interfere with whatever's underneath).
- **Opacity**: 40/70/100% presets from the tray menu.

Your session (refresh token) is stored encrypted on your machine, so you won't need to log in again every time you open the app.

> If you had already logged in before playback controls were added, you'll be asked to log in again once — the new controls need an extra permission (`user-modify-playback-state`) that older sessions don't have.

## Notes

- Reading what's playing works with both Free and Premium accounts. **Controlling** playback (play/pause/skip) requires Premium — that's a Spotify API restriction, not something this app can work around.
- If a track isn't on lrclib.net, you'll see a notice — not every song has synced lyrics available.
- The Client ID and tokens never reach the UI process (renderer); only Electron's main process talks to Spotify and lrclib.net.

## Distributing the app to other people

For friends to just install and use the app (without creating their own Spotify app or touching `config.json`), the Client ID ships embedded in the installer. The Client ID **is not a secret** (this uses OAuth with PKCE, no client secret involved) — it's even visible in the browser address bar during every login — but to keep it out of the git history anyway, it's injected at build time by a GitHub Actions workflow ([.github/workflows/release.yml](.github/workflows/release.yml)) instead of being committed in `src/default-config.js` (which stays blank in git).

### 1. Add your friends in the Spotify Dashboard

While your Spotify app is in **Development Mode** (the default), only users you explicitly add can use it — up to 25. In your app's dashboard → **User Management**, add each friend's Spotify account email. Without this, they'll get an error from Spotify when trying to log in, even with a correct Client ID.

### 2. Add the Client ID as a repository secret (one-time setup)

```bash
gh secret set SPOTIFY_CLIENT_ID --body "YOUR_CLIENT_ID_HERE"
```

### 3. Cut a release

```bash
git tag v1.0.1
git push origin v1.0.1
```

Pushing a tag matching `v*` triggers the workflow: it installs dependencies, bakes the Client ID from the secret into `src/default-config.js` (only inside the CI runner, never committed), builds the Windows installer with `electron-builder`, and publishes it as a GitHub Release with the `.exe` attached — automatically, from `git push` to a downloadable installer.

Your friends can then download the `.exe` from the repo's Releases page and install it like any other program — no setup on their end.

### Testing a packaged build locally

To test `npm run dist` on your own machine without going through CI, temporarily paste your Client ID into `src/default-config.js`, build, test the installer — then revert the file (or just don't commit it) so the blank placeholder stays in git.
