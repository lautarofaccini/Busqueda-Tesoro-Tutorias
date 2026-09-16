# Prueba Local en LAN (Wi-Fi)

Esta guía explica cómo probar la aplicación completa desde tu teléfono celular, escaneando los QRs reales, mientras todo se ejecuta localmente en tu PC.

## Requisitos
1. Tu PC y tu celular deben estar conectados a la **misma red Wi-Fi**.
2. Tu firewall de Windows debe permitir conexiones entrantes al puerto `5173`. Si al intentar entrar desde el celular no carga, revisá el Firewall.

## Instrucciones

### 1. Iniciar los servidores en modo LAN
Abre una terminal en la raíz del proyecto y ejecuta:

```bash
npm run dev:lan
```

Este comando inicia tanto el frontend (Vite) como el backend (Wrangler). Vite se expondrá a la red local usando `--host`.
En la terminal verás algo parecido a esto:
```
  ➜  Network:  http://192.168.1.50:5173/
```
Anota esa IP (`192.168.1.50` es un ejemplo, la tuya será diferente).

### 2. Configurar los QRs
Abre el navegador en tu PC y entra al **Admin Console**:
http://localhost:5173/admin
(Contraseña: `local_secret` si no la has cambiado en .dev.vars)

Ve a la pestaña **QR** e ingresa la **Base URL** usando la IP de tu PC que anotaste en el paso 1. Por ejemplo:
`http://192.168.1.50:5173`

Asegúrate de NO usar `localhost` ni `127.0.0.1`.

### 3. Jugar desde el celular
- Escanea directamente con la cámara de tu celular los QRs que ves en la pestaña **QR** de tu PC.
- Inicia escaneando el **Start QR**.
- Puedes mantener abiertas las imágenes SVG en varias pestañas de tu PC y pretender que vas caminando por la facultad.
- Puedes pausar o finalizar el juego desde el Admin Console y ver los cambios en tiempo real en tu celular.

### Notas adicionales
- Los resultados de tu sesión de prueba se verán en la pestaña **Resumen**.
- Si necesitas reiniciar la base de datos de prueba a cero:
  ```bash
  npm run db:reset:local
  ```
