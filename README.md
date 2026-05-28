# Advance Studio

Motor de desarrollo visual para Game Boy Advance hecho con Electron + React + Vite + TypeScript.

## Requisitos

- Node.js 18+
- npm 9+
- Windows 10/11

## Instalación

```bash
npm install
```

## Comandos

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Lanza Vite + Electron en paralelo (desarrollo) |
| `npm run build:renderer` | Compila el renderer con Vite |
| `npm run build:electron` | Compila Electron con tsc |
| `npm run build` | Build completo de producción |

## Estructura

```
advance-engine/
├── electron/                    # Proceso principal de Electron
│   ├── main.ts                  # BrowserWindow, IPC handlers, persistencia
│   └── preload.ts               # contextBridge → window.advanceAPI
├── src/
│   ├── version.ts               # Versión actual (semver)
│   └── renderer/
│       ├── main.tsx             # Entry point React
│       ├── index.css            # Variables CSS globales
│       ├── global.d.ts          # Tipos de advanceAPI
│       ├── types/               # Project, TemplateId, ActiveScreen, editor
│       ├── store/useAppStore.ts # Estado global Zustand
│       ├── components/
│       │   ├── AppHeader.tsx    # Cabecera con logo y versión
│       │   ├── TabBar.tsx       # Navegación inferior
│       │   ├── CartuchoDisplay.tsx  # Renderizado por capas del cartucho GBA
│       │   ├── CartuchoPanel.tsx    # Panel lateral del cartucho
│       │   └── editor/          # Componentes del editor (topbar, panels, tabs)
│       └── screens/
│           ├── Launcher.tsx     # Orquestador de pantallas
│           ├── RecientesScreen.tsx
│           ├── CrearScreen.tsx
│           ├── ImportarScreen.tsx
│           ├── EditarScreen.tsx
│           ├── TodosProyectosScreen.tsx
│           ├── ModificarPortadaScreen.tsx
│           ├── CreditosScreen.tsx     # Créditos con fondo de nubes animado
│           └── EditorScreen.tsx       # Editor principal (5 tabs)
├── public/
│   ├── icon.png                 # Icono de la aplicación (1024x1024)
│   ├── icon.ico                 # Icono para empaquetado Windows
│   ├── nubes.html               # Shader WebGL de nubes para creditos
│   └── recursos/                # Assets del cartucho GBA
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.electron.json
└── package.json
```

## Navegación

Usa `activeScreen` + `AnimatePresence` (sin React Router). Las pantallas se superponen con `position: absolute`.

- **Launcher:** AppHeader + contenido de tab (Reciente/Crear/Importar) + TabBar
- **Overlays:** Editar, ModificarPortada, TodosProyectos, Creditos
- **Editor:** Pantalla completa (fixed, zIndex 100) con 5 tabs: Mundo, Sprite, Imagen, Music/Sound, Dialogo

## Versión

Definida en `src/version.ts` — semver. Actual: **0.2.0**
