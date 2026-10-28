## 🌐 Contexto del VPS e Infraestructura Compartida
Este proyecto se ejecuta en el VPS (`carmay-dev`). La información de servicios, puertos y dependencias compartidas está unificada:

- **Skills globales del servidor:** Accedidos vía `.agents/skills` (apunta a `~/.config/opencode/skills/`). Utiliza la skill `vps-services-and-infrastructure` para consultar detalles de conectividad.
- **MCPs globales:** Centralizados exclusivamente en `~/.config/opencode/opencode.json`.
- **Servicios clave en localhost:**
  - **WhatsApp Baileys REST API:** `http://localhost:3000` (requiere header `x-api-key`). Usado por `whatsappAPI`, `ROBERTO` y flujos n8n.
  - **n8n Automation Engine:** `http://localhost:5678` (`https://carmayn8n.cloud`).
  - **AsereAI Core API (FastAPI + Playwright):** `http://localhost:8000` (`https://asere.carmayn8n.cloud`).
  - **OmniRoute Proxy LLM:** `http://localhost:20128` (`https://omni.carmayn8n.cloud`).
- **Guía completa de arquitectura y reglas:** Ver `/home/carmay-dev/proyectos/CONVENCIONES_VPS.md`.

# AGENTS.md — ExtraerFacebook

- **Servicios clave en localhost:**
