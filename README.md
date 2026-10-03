# Advance Engine

Motor de desarrollo visual para Game Boy Advance hecho con Electron + React + Vite + TypeScript.

## Requisitos

- Node.js 18+
- npm 9+
- Windows 10/11 (x64) o Linux (x64/arm64)
- devkitARM (para exportar ROMs GBA) — en el check de inicio de la app hay un botón "Instalar devkitPro" que lo instala automáticamente (Linux vía pkexec, Windows con el instalador oficial, macOS con el pkg oficial y diálogo del sistema)

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
│   ├── preload.ts               # contextBridge → window.advanceAPI
│   └── emuWindow.ts             # Ventana frameless del emulador GBA
├── src/
│   ├── version.ts               # Versión actual (semver)
│   └── renderer/
│       ├── main.tsx             # Entry point React con ThemeApplier + ErrorBoundary
│       ├── index.css            # Variables CSS globales
│       ├── global.d.ts          # Tipos de advanceAPI (emu.play, emu.stop, etc.)
│       ├── types/               # Project, TemplateId, ActiveScreen, editor types
│       ├── store/useAppStore.ts # Estado global Zustand (proyectos, editor, setting)
│       ├── components/
│       │   ├── AppHeader.tsx    # Cabecera con logo y versión
│       │   ├── TabBar.tsx       # Navegación inferior
│       │   ├── CartuchoDisplay.tsx  # Renderizado por capas del cartucho GBA
│       │   ├── CartuchoPanel.tsx    # Panel lateral del cartucho
│       │   └── editor/
│       │       ├── EditorTopBar.tsx # Menú Archivos/Editar/Juego/Plugin/Help + PLAY/STOP
│       │       ├── SettingsModal.tsx # Modal de configuración con pestañas y sidebar
│       │       ├── ThemeModal.tsx    # Modal de personalización de tema (legacy)
│       │       ├── HierarchyPanel.tsx
│       │       ├── InspectorPanel.tsx
│       │       ├── ResizableEditorLayout.tsx
│       │       ├── TabBar.tsx
│       │       └── tabs/
│       │           ├── MundoTab.tsx      # Editor de escenas con grid, zoom, contexto
│       │           ├── SpriteTab.tsx     # Editor de sprites y animaciones
│       │           ├── ImagenTab.tsx     # Editor de fondos y capas con rescale
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
│   ├── emulator/                # UI del emulador GBA interno (index.html)
│   └── recursos/                # Assets del cartucho GBA
├── tools/
│   └── gba_quantize.lua         # Script Aseprite para cuantizar a BGR555
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
- Herramientas: mover, añadir escena, conectar escenas, eliminar, pintar colisión
- SceneCards con mini-map, grid pixel configurable (1×1 a 64×64), hover y selección
- Menú contextual (Renombrar/Eliminar) en canvas y jerarquía
- Zoom centrado en escena seleccionada (Ctrl+wheel)
- Escenas con actores, propiedades, dimensiones, imagen de fondo y canción
- Terminal del pipeline con auto-scroll y botones Copiar/Limpiar

### Sprite
- Editor de spritesheets y animaciones
- Grid de tiles con paginación y selección de brush
- Línea de tiempo de frames con reproducción (play/pause)
- Papel cebolla (onion skin) y cuadrícula
- Zoom y paneo con scroll y drag

### Imagen
- Editor de fondos con múltiples capas
- Parallax, velocidad, visibilidad y rescale por capa
- Preview individual por capa seleccionada con tamaño real (rescale=false) o escalado (rescale=true)
- Eliminación física de archivos del disco al remover capas
- Carga de imágenes desde diálogo nativo, con limpieza automática de URLs obsoletas

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

### Sound
- Editor de efectos de sonido con tipo Pulse/Wave/Noise
- Parámetros editables: nota, duración, volumen, duty cycle, envelope, sweep
- Previsualización en tiempo real con Web Audio API
- Importación de archivos WAV/MP3/OGG
- Forma de onda visualizada según el tipo seleccionado

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
- **devkitARM** — toolchain GBA (Makefile + arm-none-eabi-gcc)

## Exportación GBA

Advance Engine puede generar una ROM `.gba` directamente desde el editor:

- **Splash Screen personalizado**: imagen de fondo (redimensionada a 240×160) con duración configurable en segundos. Se convierte a formato BGR555 (15-bit) y se incluye como array C en el código fuente.
- **Compilación**: genera `main.c` y `Makefile`, luego ejecuta `make` mediante `devkitARM` para producir el `.elf` y el `.gba`.
- La conversión de píxeles usa `R>>3 | G>>3<<5 | B>>3<<10` para mapear RGB888 → BGR555.
- Tool auxiliar: `tools/gba_quantize.lua` (script Aseprite) para cuantizar sprites al espacio de color GBA de 32768 colores, con dithering Floyd-Steinberg opcional.
- **Música en ROM**: La canción asignada al SplashScreen (`backgroundSong`) se incrusta en el código C y se reproduce durante el bucle principal usando los 4 canales de sonido del GBA (Pulse 1/2, Wave, Noise).

## Versión

Definida en `src/version.ts` — semver. Actual: **0.51.0**

### v0.51.0 — Panel de jerarquía con look de component-list + iconos Tabler
- **Nuevo `HierarchyPanel`**: mismo look que el componente `component-list` (filas tipo tarjeta con chip de icono, encabezado con contador y colapsar, framer-motion en el expand/collapse), pero conservando el árbol completo: secciones, hijos anidados, grupos `isHeader`, renombrado en línea, menú contextual y eliminar al hover. Fila compacta de 34px y colores del tema (`--bg-raised`, `--accent`, `--text-secondary`), sin los colores hardcodeados del demo.
- **`RowIconButton`** exportado: botón de icono de 22px con estado activo (degradado de `--accent`), `danger` para eliminar y tooltip. Basis de los toggles estándar.
- **Toggles por ítem**: `toggles: { eye, solo, mute }` con `dimmed` para atenuar filas.
  - Music: los toggles de canal (visible/solo/mute) pasan de letras "S"/"M" a iconos, y las filas se atenúan cuando hay un canal en solo.
  - Imagen: el ojo de las capas pasa a botón y la fila se atenúa si la capa está oculta.
- **Iconos aplicados de `ICONOS.md`**: los que elegiste ya son Tabler (el SVG viejo se borró): cerrar `IconXFilled`, ajustes `IconSettingsFilled`,desplegables `IconConeFilled`, aviso `IconAlertTriangleFilled`, mover `IconDirectionArrows`, colisión `IconSquare`/`IconGrid3x3`, relleno `IconBucketDroplet`, escena `IconSquareRotatedFilled`, splash `IconHome2Filled`, actor `IconUserFilled`, conectar `IconPlug`, ojo `IconEye`/`IconEyeClosed`, restablecer `IconArrowBack`, y en la jerarquía de Scripting: Bloques = pieza de rompecabezas, AdvanceCode = `IconFileCodeFilled`. También se eliminaron los glifos de texto sueltos (`✕`, `⚙`, `⚠`, `↩`, `▲▼`) y los botones de las barras de Mundo, que eran `✥ + 🔗 ▦ ▤ ⌾ ▢ ✎ ×`.
- **Un solo origen de iconos**: `@tabler/icons-react` (wrapper `tabler()` que traduce `size`/`strokeWidth`). `lucide-react` desinstalado, radial menu migrado a Tabler y créditos actualizados.
- **Ajustes → General → Colores planos**: interruptor que cambia los rellenos de acento del panel (chip del icono de la fila y botones de ojo/solo/mute activados) entre degradado (por defecto) y color plano. Se implementa con la variable CSS `--accent-fill` (`main.tsx:applyFlatColors`), así que un solo ajuste manda en todos los sitios.
- **Deshacer/rehacer en el editor de C Directo**: `Ctrl+Z` y `Ctrl+Y` (o `Ctrl+Shift+Z`) con historial propio, agrupando lo escrito seguido en un solo paso e incluyendo los snippets y el auto-cierre de llaves (que el undo del navegador perdía).
- **Zoom en el editor de C Directo**: `Ctrl` + rueda del ratón agranda o achica el texto (9–26 px, se recuerda entre sesiones). El gutter y el interlineado se ajustan con la letra y hay un indicador de porcentaje en la barra de snippets (clic para volver al 100%).
- **Resaltado de sintaxis en el editor de C Directo**: tokenizador propio (sin dependencias) pintado sobre un `<pre>` detrás del textarea — comentarios, `#include`, cadenas, números, palabras clave, tipos de devkitARM (`u8`, `s16`…) y la API del motor (`gSelf`, `moveActorCollide`, `REG_KEYINPUT`…).
- **Confirmación al eliminar**: el `✕` de cada fila pregunta "¿Eliminar?" con `✓` / `✕` antes de borrar, como en el `component-list` original. El SplashScreen de Mundo va con `removable: false` (no se puede borrar) y el estado vacío "Sin elementos" ya no dibuja el recuadro punteado.

### v0.50.0 — Scripting y estados vacíos unificados
- **Pestaña Scripting**: sistema de código con tres modos (Bloques / Mi Lenguaje / C Directo). C Directo es el único funcional por ahora: editor con gutter, auto-indent, autocierre de delimitadores y snippets; los scripts se asignan a actores (escena → actor) desde el inspector y solo se exportan si están asignados.
- **Estados vacíos unificados**: componente compartido `EmptyState` (icono gris + título + hint + acción opcional, fondo `--bg-canvas`) en Sprite, Imagen, Music, Sound y Dialogo, igual que Scripting. Los lienzos de Sprite/Imagen dejan de heredar el gris de la app y conservan pan/zoom y drag-and-drop.
- Los iconos usados quedan documentados en `src/renderer/components/editor/tabs/icons/ICONOS.md` para la migración a Lucide.

### v0.40.0 — Transiciones entre escenas
- Modelo de datos `TransitionConfig` + `FxAsset` (gradientes y tilesets)
- UI de inspector para configurar entrada/salida por conexión y splash
- Preview animada en vivo (A → entrada → pausa → salida → B)
- Transición personalizada con máscara de umbral por gradiente/tileset
- Previsualización de tilesets con animación ping-pong y fondo ajedrez
- Eliminación de conexiones desde menú contextual e inspector

### v0.42.0 — Transición secuencial por grupos de brillo + gradiente .h
- **Grupos de brillo**: tiles con el mismo valor de brillo animan simultáneamente (grupos ordenados de más brillante a más oscuro), reemplazando el modelo wave anterior
- **Gradiente exportable a .h**: auto-generación al importar en MundoTab, con `#define GRADIENT_W/H` y `gradientData[W*H]`
- **Salida mejorada**: cada frame limpia el tile a negro antes de escribir, asegurando que todos los frames de tileset se vean completos; frames iteran en reversa (7→0)
- **Entrada mejorada**: frames iteran en orden 0→7 con force black al final
- Correcciones críticas: bug de gW=0/gH=0 en entry, parsing de gradiente con llaves anidadas, lectura correcta de exit tileset desde .h

### v0.46.0 — SoundTab + exportación collision map
- **SoundTab**: editor de efectos de sonido con Pulse/Wave/Noise, preview en tiempo real, importación de WAV/MP3
- **Collision map exportado a C**: `#define COLLISION_COLS/ROWS/TILE_SIZE` + `const u8 collisionMap[ROWS][COLS]` en ROM exportada

### v0.43.0 — Control de duración de transición (0.1s-60s)
- **Duración configurable**: slider 0.1s a 60s con step 0.1s, control independiente por entrada/salida
- **Merge automático de grupos**: cuando hay más grupos de brillo que VSyncs disponibles, mergea grupos consecutivos para que cada uno tenga al menos 1 VSync (precisión máxima)
- **Preview sincronizado**: la preview responde al cambio de duración
- **Código C optimizado**: `waitVSync()` movido fuera del loop de frames (espera por grupo, no por frame de tileset)
