# ExtraerFacebook — Extractor de Comentarios y Candidatos

Servicio Node.js + Puppeteer para extracción automatizada de comentarios y participantes de publicaciones en grupos y páginas de Facebook.

## Archivos clave

- `server.js`: API HTTP que expone el servicio de scraping.
- `scraper.js`: Automatización de navegación e interactividad con Facebook.
- `proxy.js`: Gestión y rotación de proxies de conexión.
- `monitor.sh`: Script de supervisión del proceso.

## Instalación y Configuración

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Configurar cookies de sesión:
   ```bash
   cp cookies.example.json REDACTED_COOKIES
   ```
   Completar `REDACTED_COOKIES` con una sesión válida de Facebook.
3. Iniciar el servicio:
   ```bash
   npm start
   ```
