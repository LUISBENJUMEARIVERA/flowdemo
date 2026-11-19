# Flow Studio

Aplicación web para generar videos con **Google Gemini (`gemini-omni-1.2-flash` + `gemini-4-hydrogen`)** usando **dos fotos como ingredientes** (un fondo/escenario y una persona/personaje), con ingreso de Google API Key desde la interfaz, selector de duración por botones y **compensación automática multi-escena** para mantener la consistencia de personaje y entorno cuando se supera el límite de una sola toma.

## Características

- **API Key desde la interfaz**: Ingresa y verifica tu Google Gemini API Key directamente en la barra superior (se guarda en `localStorage` de tu navegador, nunca en el repositorio).
- **Ingredientes visuales**: Sube una foto del **fondo** y una foto de la **persona** + prompt descriptivo.
- **Selector de duración por botones**: `5s`, `8s`, `10s`, `15s`, `20s`, `25s`, `30s`, `45s` y `60s`, con soporte para modo **Omni 1.2 Flash (15s/toma)** o **Google Flow Estricto (8s/toma)**.
- **Compensación multi-escena consistente**: Si la duración elegida supera el límite por toma, `gemini-4-hydrogen` fija anclas visuales del personaje y escenario y `gemini-omni-1.2-flash` encadena las extensiones (`previous_interaction_id`) re-inyectando las fotos de referencia en cada escena.
- **Puerto libre automático**: Se inicia en cualquier puerto libre asignado por el sistema operativo y abre el navegador automáticamente.

## Instalación y uso desde la terminal

### Requisitos
- [Node.js](https://nodejs.org/) v20 o superior
- Una Google Gemini API Key activa

### 1. Clonar e instalar
```bash
git clone https://github.com/LUISBENJUMEARIVERA/flowdemo.git
cd flowdemo
npm install
```

### 2. Iniciar la aplicación
```bash
npm start
```
Esto compila la interfaz, arranca el servidor en un puerto libre disponible (por ejemplo `http://127.0.0.1:xxxxx`) y abre tu navegador automáticamente.

> En **Windows**, también puedes hacer doble clic en `launch.bat` para instalar dependencias (si faltan), compilar e iniciar la app automáticamente.
