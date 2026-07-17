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
- **Hide/show**: the "×" button or the tray icon.
- **Click-through**: from the tray menu, let clicks pass through the window (so it doesn't interfere with whatever's underneath).
- **Opacity**: 40/70/100% presets from the tray menu.
- **Quit**: only via "Quit" in the tray menu (the "×" button just hides the window).

Your session (refresh token) is stored encrypted on your machine, so you won't need to log in again every time you open the app.

## Notes

- Works with both Free and Premium accounts (only playback *read* access is needed, not control).
- If a track isn't on lrclib.net, you'll see a notice — not every song has synced lyrics available.
- The Client ID and tokens never reach the UI process (renderer); only Electron's main process talks to Spotify and lrclib.net.

## Distributing the app to other people

For friends to just install and use the app (without creating their own Spotify app or touching `config.json`), the Client ID ships embedded in the installer. The Client ID **is not a secret** (this uses OAuth with PKCE, no client secret involved), so it's safe to include in the code you share.

### 1. Fill in the distribution Client ID

Edit [src/default-config.js](src/default-config.js) and paste the Client ID from your Spotify app (the same one from step 1 above):

```js
module.exports = {
  clientId: 'YOUR_CLIENT_ID_HERE',
  redirectPort: 8888,
};
```

### 2. Add your friends in the Spotify Dashboard

While your Spotify app is in **Development Mode** (the default), only users you explicitly add can use it — up to 25. In your app's dashboard → **User Management**, add each friend's Spotify account email. Without this, they'll get an error from Spotify when trying to log in, even with a correct Client ID.

### 3. Build the installer

```bash
npm run dist
```

This produces `dist\Spotify Lyrics Setup 1.0.0.exe` — a standard, self-contained Windows (NSIS) installer that doesn't require Node or Electron on the target machine.

### 4. Publish it to GitHub Releases

```bash
gh release create v1.0.0 "dist/Spotify Lyrics Setup 1.0.0.exe" --title "v1.0.0" --notes "First release"
```

(Requires the repo already pushed to GitHub and `gh` authenticated.) Your friends can then download the `.exe` from the repo's Releases page and install it like any other program.
