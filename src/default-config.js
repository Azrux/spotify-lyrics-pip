// Client ID de la app de Spotify que se distribuye con el instalador.
// No es un secreto (se usa OAuth PKCE, sin client secret), así que es seguro
// dejarlo aquí y commitearlo. Complétalo antes de compilar el instalador
// para tus amigos con "npm run dist" — ver README.md.
//
// Para desarrollo local puedes seguir usando config.json (gitignored) para
// probar con tu propio Client ID sin tocar este archivo.
module.exports = {
  clientId: '',
  redirectPort: 8888,
};
