# Spotify Lyrics PiP

Ventana flotante y siempre-visible (estilo Picture-in-Picture) que muestra, sincronizadas, las letras de lo que esté sonando en tu cuenta de Spotify — en cualquier dispositivo (móvil, escritorio, web player). Las letras se obtienen de [lrclib.net](https://lrclib.net), una base de datos pública y gratuita de letras sincronizadas.

## 1. Crear tu app en el Spotify Developer Dashboard

Spotify requiere que cada app tenga su propio Client ID (es gratis y toma dos minutos):

1. Entra a https://developer.spotify.com/dashboard e inicia sesión con tu cuenta de Spotify.
2. "Create app" → ponle el nombre que quieras (p. ej. "Lyrics PiP").
3. En **Redirect URIs** agrega exactamente: `http://127.0.0.1:8888/callback`
4. En **APIs used** marca "Web API".
5. Guarda y entra a "Settings" de la app recién creada — copia el **Client ID**.

## 2. Configurar el proyecto

```bash
npm install
copy config.example.json config.json
```

Edita `config.json` y pega tu Client ID:

```json
{
  "clientId": "TU_CLIENT_ID_AQUI",
  "redirectPort": 8888
}
```

## 3. Ejecutar

```bash
npm start
```

Aparece un icono verde en la bandeja del sistema y una ventanita flotante. Clic derecho en el icono de bandeja → "Iniciar sesión con Spotify" abre tu navegador para autorizar la app. Reproduce algo en Spotify desde cualquier dispositivo de tu cuenta y las letras deberían empezar a sincronizarse en unos segundos.

## Uso

- **Arrastrar**: clic y arrastra la parte de arriba de la ventana para moverla.
- **Ocultar/mostrar**: el botón "×" o el icono de la bandeja.
- **Click-through**: desde el menú de la bandeja, deja que los clics atraviesen la ventana (para no interferir con lo que hay debajo).
- **Opacidad**: presets de 40/70/100% desde el menú de la bandeja.
- **Salir**: solo desde "Salir" en el menú de la bandeja (el botón "×" solo oculta la ventana).

La sesión (refresh token) se guarda cifrada en tu equipo, así que no hace falta volver a iniciar sesión cada vez que abres la app.

## Notas

- Funciona con cuentas Free y Premium (solo se necesita el permiso de lectura de reproducción, no de control).
- Si una canción no está en lrclib.net, se muestra un aviso — no todas las canciones tienen letras sincronizadas disponibles.
- El Client ID y los tokens nunca llegan al proceso de la interfaz (renderer); solo el proceso principal de Electron habla con Spotify y lrclib.net.

## Distribuir la app a otras personas

Para que tus amigos puedan simplemente instalar la app y usarla (sin crear su propia app de Spotify ni tocar `config.json`), el Client ID va embebido en el instalador. El Client ID **no es secreto** (se usa OAuth con PKCE, sin client secret), así que es seguro incluirlo en el código que compartes.

### 1. Completar el Client ID de distribución

Edita [src/default-config.js](src/default-config.js) y pega el Client ID de tu app de Spotify (la misma que creaste en el paso 1 de arriba):

```js
module.exports = {
  clientId: 'TU_CLIENT_ID_AQUI',
  redirectPort: 8888,
};
```

### 2. Agregar a tus amigos en el Spotify Dashboard

Mientras tu app de Spotify esté en **Development Mode** (el estado por defecto), solo los usuarios que agregues explícitamente pueden usarla — hasta 25. En el dashboard de tu app → **User Management** → agrega el email de la cuenta de Spotify de cada amigo. Sin esto, verán un error de Spotify al intentar iniciar sesión aunque el Client ID sea correcto.

### 3. Compilar el instalador

```bash
npm run dist
```

Esto genera `dist\Spotify Lyrics Setup 1.0.0.exe` — un instalador de Windows normal (NSIS), autocontenido, que no requiere que quien lo instale tenga Node ni Electron.

### 4. Publicarlo en GitHub Releases

```bash
gh release create v1.0.0 "dist/Spotify Lyrics Setup 1.0.0.exe" --title "v1.0.0" --notes "Primera versión"
```

(Requiere tener el repo ya subido a GitHub y `gh` autenticado.) Tus amigos descargan el `.exe` desde la página de Releases del repo y lo instalan como cualquier otro programa.
