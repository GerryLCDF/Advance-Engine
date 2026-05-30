# Advance Studio — AI Rules

## Proyecto
Advance Studio es un IDE visual para crear videojuegos de Game Boy Advance. Frontend: Electron + React 18 + TypeScript + Vite + Zustand + Framer Motion. Backend: Electron main process con IPC.

## Versión
Definida en `src/version.ts`. **Formato semver**: `X.Y.Z`. Cada modificación sube la versión.

**Cómo se incrementa:**
- **Z (patch)** — bugfixes, cambios mínimos (arreglar un error, ajustar un color, etc.)
- **Y (minor)** — cambios medianos (nueva feature, rediseño de un componente, nueva sección en el inspector)
- **X (major)** — cambios grandes (refactor completo, cambio de arquitectura, nueva pantalla principal)

**Siempre subir la versión inmediatamente después de hacer cualquier cambio en el código.**
**Cuando se incremente X (major) o Y (minor), actualizar `README.md` con los cambios relevantes.**

## Convenciones de código
- **NO añadir comentarios** a menos que el usuario lo pida explícitamente.
- Usar tersailles (bienes con viñetas, no párrafos).
- No usar emojis.
- `style` inline con objetos, sin clases CSS.
- TypeScript strict, tipar todo.
- Estados globales en Zustand (`useAppStore`).
- **Todo texto visible en la UI debe estar centralizado** para permitir traducción. Al agregar strings nuevos, crearlos en un objeto/diccionario con soporte para español latino, inglés, japonés y ruso. No hardcodear texto visible.

## Archivos clave
- `electron/main.ts` — proceso principal, ventana frameless, IPC, projects.json, carpetas de proyecto (backgrounds/, fonts/, music/, sounds/, sprites/, tilesets/, ui/, avatars/, script/, dialog/)
- `electron/preload.ts` — contextBridge (`window.advanceAPI`) con métodos project, file, dir, system, shell
- `src/renderer/store/useAppStore.ts` — estado global (temas, canciones, presets, settings, editorTab, backgrounds, spriteSheets, scenes, sceneConnections, pipeline)
- `src/renderer/components/editor/EditorTopBar.tsx` — barra superior con menús (Archivos, Editar, Juego, Ayuda, Ver) + tabs + menú EXPORT con guardar, exportar GBA, exportar assets
- `src/renderer/components/editor/SettingsModal.tsx` — modal de configuración con pestañas + sidebar (incluye piano colors, grid toggle/opacidad, image smoothing)
- `src/renderer/components/editor/InspectorPanel.tsx` — panel genérico con `fields` opcional + `content` para secciones custom
- `src/renderer/components/editor/tabs/MusicTab.tsx` — piano roll, instrumentos, knobs (Knob component), wave graph, playhead con flechas
- `src/renderer/components/editor/tabs/SpriteTab.tsx` — editor de sprites con transporte e iconos SVG
- `src/renderer/components/editor/tabs/MundoTab.tsx` — canvas de escenas con SceneCard arrastrable, mini-mapa 3:2, toolbar cápsula, conexiones, inspector de escena
- `src/renderer/components/editor/tabs/ImagenTab.tsx` — gestor de imágenes con drag-drop, preview con zoom/pan, jerarquía plana de capas, fillColor picker
- `src/renderer/components/SetupCheckModal.tsx` — verificación de devkitARM al primer inicio
- `src/renderer/utils/gba_export.ts` — generación de main.c (metadatos GBA, escenas, sprites, canciones) + Makefile, hexToGBA15
- `src/renderer/utils/project_persistence.ts` — saveProject, loadProject, saveAsset, loadAsset, copyImageToProject, readImageAsDataUrl
- `src/renderer/screens/EditorScreen.tsx` — wrapper con AnimatePresence para transiciones de tabs
- `src/renderer/screens/CrearScreen.tsx` — formulario de creación con CartuchoPanel, ruta, plantillas
- `src/renderer/types/editor.ts` — tipos (Song, EditorTab, Instrument, InstrumentPreset, Background, BackgroundLayer, Scene, SpriteSheet, etc.)
- `src/version.ts` — versión semver
- `README.md` — documentación del proyecto

## Arquitectura / Decisiones
- Piano roll: grid con fondo CSS (líneas o checkerboard) en `pianoRollBg` de Zustand.
- Knobs (perillas) en MusicTab: dial SVG con arco de color (`var(--accent-light)`), arrastre vertical para cambiar valor, tooltip en hover. Soporte bipolar (centro arriba, positivo a derecha, negativo a izquierda).
- Temas: 7 presets en SettingsModal; se aplican con `setTheme(bgPanel, accent)`.
- InspectorPanel: `fields` opcional + `content` para ReactNode custom.
- Ventana frameless con `-webkit-app-region: drag` en zonas no interactivas.
- Exportación GBA: genera C + Makefile, compila con devkitARM externo vía `make`.
- Proyectos se guardan en `Documents/AdvanceEngineProjects/<nombre>/` con `project.json` + `editor-state.json`.
- Estados de editor: `dirty` flag con asterisco en barra de título, Ctrl+S para guardar.
- ImagenTab: jerarquía plana de capas (sin anidamiento bajo fondos), auto-crea fondo "Assets" al soltar imagen.
- `loadProject` restaura todos los campos: backgrounds, spriteSheets, songs, sounds, dialogues, scripts.

## Flujo
1. Launcher (AppHeader) → Nuevo/Abrir proyecto → EditorScreen
2. EditorScreen → EditorTopBar + tabs con AnimatePresence
3. Cada tab tiene su propio panel de jerarquía (izquierda) + inspector (derecha)
4. SettingsModal se abre desde Help o desde Editar > Settings

## Estructura de datos (Song)
```ts
interface Song {
  id: string; title: string; artist: string; bpm: number;
  patternLength: number; rows: NoteRow[]; instruments: Instrument[];
}
```

## Glosario (nombres de UI en español)
- Mundo, Scripting, Sprite, Imagen, Music, Sound, Dialogo — tabs del editor
- Archivos, Editar, Juego, Ayuda, Ver — menús
- Cerrar, Salir a la lista de proyectos — acciones de Archivos
- Perillas = Knobs (componente dial rotatorio)
