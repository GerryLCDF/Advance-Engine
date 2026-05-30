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
│   ├── main.ts                  # BrowserWindow, IPC handlers, persistencia, snap
│   └── preload.ts               # contextBridge → window.advanceAPI
├── src/
│   ├── version.ts               # Versión actual (semver)
│   └── renderer/
│       ├── main.tsx             # Entry point React con ThemeApplier + ErrorBoundary
│       ├── index.css            # Variables CSS globales
│       ├── global.d.ts          # Tipos de advanceAPI
│       ├── types/               # Project, TemplateId, ActiveScreen, editor types
│       ├── store/useAppStore.ts # Estado global Zustand (proyectos, editor, setting)
│       ├── components/
│       │   ├── AppHeader.tsx    # Cabecera con logo y versión
│       │   ├── TabBar.tsx       # Navegación inferior
│       │   ├── CartuchoDisplay.tsx  # Renderizado por capas del cartucho GBA
│       │   ├── CartuchoPanel.tsx    # Panel lateral del cartucho
│       │   └── editor/
│       │       ├── EditorTopBar.tsx # Menú Archivos/Editar/Juego/Plugin/Help
│       │       ├── SettingsModal.tsx # Modal de configuración con pestañas y sidebar
│       │       ├── ThemeModal.tsx    # Modal de personalización de tema (legacy)
│       │       ├── HierarchyPanel.tsx
│       │       ├── InspectorPanel.tsx
│       │       ├── ResizableEditorLayout.tsx
│       │       ├── TabBar.tsx
│       │       └── tabs/
│       │           ├── MundoTab.tsx      # Editor de escenas y actores
│       │           ├── SpriteTab.tsx     # Editor de sprites y animaciones
│       │           ├── ImagenTab.tsx     # Editor de fondos y capas
│       │           ├── MusicTab.tsx      # Piano roll con patrones e instrumentos
│       │           ├── DialogoTab.tsx    # Editor de diálogos
│       │           └── ComingSoonTab.tsx # Placeholder (Scripting, Sound)
│       └── screens/
│           ├── Launcher.tsx          # Orquestador de pantallas
│           ├── RecientesScreen.tsx
│           ├── CrearScreen.tsx
│           ├── ImportarScreen.tsx
│           ├── EditarScreen.tsx
│           ├── TodosProyectosScreen.tsx
│           ├── ModificarPortadaScreen.tsx
│           ├── CreditosScreen.tsx    # Créditos con fondo de nubes animado
│           └── EditorScreen.tsx      # Editor principal con 7 tabs + animaciones
├── public/
│   ├── icon.png                 # Icono de la aplicación (1024×1024)
│   ├── icon.ico                 # Icono para empaquetado Windows
│   ├── nubes.html               # Shader WebGL de nubes para créditos
│   └── recursos/                # Assets del cartucho GBA
├── .gitignore
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.electron.json
└── package.json
```

## Funcionalidades

### Launcher
- **AppHeader** con logo, versión y enlaces a Documentación/Créditos
- **Tabs:** Recientes, Crear, Importar, Todos los proyectos
- Persistencia local de proyectos via `projects.json` en `userData`
- Portadas PNG (480×270 px obligatorio)

### Editor
- Pantalla completa con 7 pestañas: Mundo, Scripting, Sprite, Imagen, Music, Sound, Dialogo
- **Top bar** con menús Archivos/Editar/Juego/Plugin/Help y controles de ventana
- **Help > Tabs**: abre modal de configuración y cambia a la pestaña correspondiente
- **Help > General**: modal con sidebar (General, Apariencia, Idioma)
- Paneles redimensionables: jerarquía (izquierda), inspector (derecha)
- Animaciones entre pestañas con Framer Motion (`AnimatePresence`)
- Temas personalizables (7 predefinidos + colores personalizados + tamaño texto)

### Mundo
- Editor visual de escenas con zoom/pan y drag
- Herramientas: seleccionar, añadir escena, conectar escenas
- Escenas con actores, propiedades y dimensiones

### Sprite
- Editor de spritesheets y animaciones
- Grid de tiles con paginación y selección de brush
- Línea de tiempo de frames con reproducción (play/pause)
- Papel cebolla (onion skin) y cuadrícula
- Zoom y paneo con scroll y drag

### Imagen
- Editor de fondos con múltiples capas
- Parallax, velocidad y visibilidad por capa

### Music
- Piano roll (PNO) con teclado tipo piano real + grid, o vista tracker (TRK) compacta
- Botón de cambio PNO/TRK junto al zoom; vista predeterminada configurable en Ajustes
- Celdas coloreadas por color del instrumento (no por canal)
- Reproducción GBA real: 4-bit DAC, envelope, LFSR 15-bit noise, polyBLEP anti-aliasing
- Caché de buffers de audio para reproducción sin lag
- Secuenciación multi-patrón con loop; playhead arrastrable
- 5 patrones de demo con distintos moods: Alegre, Oscura, Terror, Agua, Bosque
- Botones Play/Stop en toolbar (antes no funcionaban)
- Undo/Redo (Ctrl+Z / Ctrl+Y) para todas las operaciones musicales
- Patrones redimensionables (16/32/48/64 pasos)
- Instrumentos por canal: Duty, Wave, Noise
- Modos: lápiz, seleccionar, borrador
- Zoom con Ctrl+Wheel, scroll horizontal con Shift+Wheel
- Fondo configurable: cuadrícula o ajedrez
- Atajos de teclado (Ctrl+Z/Y/X/C/V/A, Del, Espacio play/pause, R reset)

### Diálogo
- Editor de diálogos con múltiples páginas
- Opciones de elección por página

### Ventana
- Frameless con controles personalizados
- Window snapping estilo Aero Snap (solo Windows)
- Maximizado automático al abrir editor

## Navegación

Usa `activeScreen` + `AnimatePresence` (sin React Router). Las pantallas se superponen con `position: absolute`.

- **Launcher:** AppHeader + contenido de tab (Reciente/Crear/Importar) + TabBar
- **Overlays:** Editar, ModificarPortada, TodosProyectos, Creditos
- **Editor:** Pantalla completa (fixed, zIndex 100) con 7 tabs

## Tecnologías

- **Electron** — ventana nativa + IPC + diálogos
- **React 18** — UI
- **TypeScript** — tipado
- **Zustand** — estado global
- **Framer Motion** — animaciones
- **Vite** — bundler del renderer

## Versión

Definida en `src/version.ts` — semver. Actual: **0.5.0**
