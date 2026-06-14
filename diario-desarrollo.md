# Diario de Desarrollo — Advance Engine

## 23 Mayo 2026 — Hello GBA

Me pase el día documentándome sobre la GBA, su hardware, el CPU ARM7TDMI, modos de video, registro de sonido, todo. Hice mi primera ROM: una pantalla negra con un único píxel blanco en el centro. Lo llamé "Hello GBA".

También empecé a buscar herramientas para hacer la interfaz gráfica del motor. Encontré ImGui y decidí usarlo como base para el editor visual. Me gustó lo liviano que era y que se podía integrar directo con OpenGL.

## 24 Mayo 2026 — El primer prototipo (y el fracaso)

Desarrollé una demo básica con un entorno visual bastante obsoleto. El motor gráfico que usé era una porquería, pero logré que pudiera hacer una ROM básica con un cubo y un player (otro cubo). Nada fancy, pero funcionaba... hasta que intenté hacer el pipeline y se rompió TODO.

Aun así de esa primera versión pude conservar la estructura de lo que se podía hacer: launcher, editor, exportación. La base conceptual quedó, solo había que reescribirla bien.

## 27 Mayo 2026 — La base definitiva

Initial commit del proyecto. Advance Engine arranca con Electron + React + Vite + TypeScript. Definí las tecnologías que usaría, creé la estructura básica de carpetas, y armé una pequeña lista de pendientes.

Adiós ImGui, hola React. El objetivo: un IDE visual moderno para hacer juegos de GBA sin tener que escribir C manualmente.

## 28 Mayo 2026 — Maratón de código

Este día fue una locura, como 25 commits en un solo día. Arranqué con el editor screen, toolbar de mundo, zoom controls, ventana frameless con window restore. Después agregué el cloud shader para los créditos, limpieza de código muerto, MusicTab refactor con paneles redimensionables.

El SpriteTab empezó a tomar forma: center canvas on mount, persist zoom, playback toolbar con onion skin, grid toggle, frame selector, compact frames bar, hierarchy, context menu (Renombrar/Eliminar).

MusicTab también avanzó: piano keyboard de verdad, bigger cells, auto-select first pattern, preset instruments con colores, channels section con mute/solo/hide, toolbar con pencil/eraser/select, iconos SVG estilo cápsula.

Después de horas de scrollbars (auto, visibles, más visibles, fixes), zoom controls, cells cuadradas, keyboard range de C8 a C3 (72 notas), settings modal con sprite icons y grid/checkerboard, tab animations con Framer Motion.

Básicamente senté las bases de casi todo el editor en un solo día.

## 29 Mayo 2026 — Piano roll de verdad

MusicTab: piano roll con playhead arrows, chunk dividers, key colors, grid settings.

## 30 Mayo 2026 — Pipeline y escenas

v0.30.0: Pipeline de proyecto con openProject/loadProject fixes. ImagenTab con jerarquía plana, normalización de rutas IPC. RULES.md y CONTINUACION.md pasan a ser locales (no se suben a git).

Después: undo/redo para escenas (Ctrl+Z/Y), copy/paste escena (Ctrl+C/V), paste en posición del cursor, escenas nuevas aparecen en la posición del cursor, pan con rueda del ratón en MundoTab y MusicTab, drag de escenas con transform GPU.

SplashScreen se integra en el canvas con jerarquía e inspector. Drag de escenas y splash corregido con stopPropagation y división por zoom.

## 31 Mayo 2026 — Exportación GBA funcional

v0.33.0: SplashScreen GBA funcional + exportación ROM. La imagen del splash se pixelea a BGR555 y se incrusta en el C code. GenerateMakefile con devkitARM + gbafix. También la verificación de devkitARM al iniciar el programa.

## 1 Junio 2026 — MundoTab refinado

v0.34.0: MundoTab grid (pixel grid 1x1 a 64x64 dentro de SceneCards con viewBox). SceneCard rediseñada sin marco, bordes planos al seleccionar, hover sutil. Menú contextual en canvas y jerarquía. Zoom centrado en escena seleccionada (Ctrl+wheel). ImagenTab rescale toggle. emuWindow (ventana del emulador).

## 2 Junio 2026 — SpriteTab pesado

SpriteTab: frame grid con paginación y selección de brush. Animation playback con timeline. Auto tile-size según el tileset. Drag-drop de frames en timeline. Hierarchy highlight. Frame deletion. Skip-frames modal con auto-detect de tiles vacíos, dim/hide skipped frames en timeline, frame grid e inspector.

Soporte de video para SplashScreen (videoPath, videoFps). Auto-dimensions de escenas según la imagen de fondo. Click animation toggle.

## 5 Junio 2026 — El sonido en mGBA era un mito

**v0.37.0**. Resulta que todos los test ROMs que había hecho para probar el sonido del GBA funcionaban en PizzaBoy (emulador de celular) pero **no en mGBA**. Y mGBA es el emulador estándar para desarrollo GBA, así que esto era un problema GRAVE.

Hice un test ROM minimalista (`test_mgba_fix.c`) que reproduce una secuencia de colores (rojo, verde, azul, púrpura, blanco) con un pitido en cada cambio. Lo compilé, lo probé en mGBA... **sin sonido**.

Comparé bit por bit mi inicialización con guías de GBA sound programming. El problema era doble:

1. **Orden de inicialización**: mGBA requiere que `REG_SNDBIAS` se escriba **antes** de habilitar el master sound (`REG_SOUNDCNT_X bit 7`). Mi código tenía el bias al final.
2. **Bit shifts incorrectos en noteOn()**: Tenía los shifts de duty (`<<6` -> `<<0`), volume (`<<13` -> `<<11`), envDir (`<<11` -> `<<8`) y envSweep (`<<8` -> `<<4`) en las posiciones equivocadas.

Después de arreglar esos dos problemas... y nada. Seguía sin sonido.

Resulta que había un tercer problema: **ningún test ROM** tenía ambos bits (bit 7 de master enable + bit 14 de trigger) a la vez. Creé `test_mgba_fix_final.c` con los dos bits... anda perfecto.

Apliqué las mismas correcciones al generador de ROMs (`gba_export.ts`):
- initSound() ahora hace: bias -> master enable -> DMG volume -> routing
- noteOn() usa los shifts correctos (duty `<<0`, volume `<<11`, envDir `<<8`, envSweep `<<4`)
- Volumen máximo ahora es 15 en vez de 7 (`sustain*15` en vez de `sustain*7`)
- La música arranca durante el splash, no después (merge del loop de splash con el loop de música)

Hoy también:
- **EditorTopBar**: los ítems de menú ahora ejecutan acciones reales (undo/redo/cut/copy/paste/delete según el tab activo). Keyboard shortcuts redirigen a spriteUndo/spriteRedo cuando estamos en SpriteTab.
- **SpriteTab copy/paste**: cut/copy/paste de frames y animaciones completas. Undo/redo stack propio del sprite (spriteUndo/spriteRedo con snapshot del spriteSheets).
- **Animation mode/speed**: `loop: boolean` se reemplaza por `mode: 'once' | 'loop' | 'pingpong'` + `speed` (0.25 a 4).
- En la store: clipboard de frames y animaciones (`_copiedFrame`, `_copiedAnimation`), `previewAnimId`, `currentFrameIdx`, `exportSplashState`.

Bueno, después de como 5 horas de debuggear sonido de GBA, **YA FUNCIONA**. La ROM exportada reproduce el splash con la canción de fondo en mGBA.

También creé el `diario-desarrollo.md` con toda la historia del proyecto, actualicé `RULES.md` con las reglas del diario y los commits, arreglé el nombre del proyecto (Advance Engine, no Studio), y subí la versión a v0.37.0.

## 6 Junio 2026 — Portadas, protocolo atom y aspect ratio

**v0.37.1**. El cartucho se veía cuadrado porque el contenedor usaba aspect ratio 4:3 (240×180) pero los PNG del cartucho son 480×270 (16:9). Ajusté `SIZES` en `CartuchoDisplay.tsx` para que coincidan.

El protocolo `atom://` para servir portadas locales fallaba con `ERR_UNEXPECTED` en Electron 31 porque `net.fetch(pathToFileURL(...))` no funciona bien con `file://` en este contexto. Lo reemplacé por `fs.readFileSync` directo.

Además, el formato `atom://C:/Users/...` no es una URL válida — Chromium interpreta `C:` como host/puerto. Cambié a `atom://local/<ruta>` y uso `new URL()` para parsear correctamente.

Ahora la portada se copia al directorio del proyecto (`<projectDir>/cover.png`) al guardar en ModificarPortadaScreen y al crear el proyecto desde CrearScreen, mediante el nuevo IPC `file:copyCover`. Esto permite que la portada viaje con el proyecto.

## 7 Junio 2026 — Layout del grid settings y preview con checkerboard

**v0.37.2**. El tab Mundo de SettingsModal estaba todo desordenado. Rediseñé el layout: título "Grid" con toggle inline, tamaños y colores en filas pareadas, preview 180x126 con checkerboard, controles compactos. También hice que las escenas fueran coherentes entre ellas de tamaño: tenían un fallo al cargar una escena de una dimensión diferente, esta acortaba la escena para que se viera "bien", así que mejor apliqué un escalado absoluto. 

## 8 Junio 2026 — Conexiones visuales entre escenas y settings de colores

**v0.37.3**. Las conexiones entre escenas ahora se ven bonitas: curvas bezier con flechas, solo se muestran las de la escena seleccionada (azul salida, naranja entrada), y las líneas van al frente (zIndex 100). Al hacer clic en una conexión en la jerarquía, la línea hace una animación de flujo con glow.

También:
- Escenas con cámara (width>240 o height>160) muestran badge "CAM x,y" en el título
- Línea temporal punteada sigue al mouse mientras se conecta
- El SVG de conexiones ahora calcula bounds dinámicamente (no más clipping en 8000x8000)
- Settings > Mundo: nueva sección "Conexiones" con colores de salida/entrada configurables
- Los items de conexión en la jerarquía muestran un círculo del color real
- Cada control en Settings > Mundo tiene botón de reset al estilo Godot (↩ aparece al hover)
- Footer de Settings > Mundo: "Restablecer" a la izquierda (solo visible si hay cambios), Cancelar/Aplicar a la derecha

Todo compila sin errores.

## 12 Junio 2026 — Colisión tile-based: fases 1.1 a 1.8 completadas, comienzo de rampas

**v0.38.0**. Trabajé todo el día en el sistema de colisión para las escenas. Fue un día de prueba y error, especialmente con las rampas.

### Lo que quedó funcionando:
- **Tipos de colisión**: Sólido (rojo), One-way ↑↓←→ (amarillo, naranja, azul, cyan), Escalera (verde), Rampa ↘ (rosa), Rampa ↙ (morado)
- **Tool flotante**: barra de colisión flotante dentro del canvas (position absolute, blur backdrop) con paleta de 8 colores
- **Slider de tamaño**: solo visible en modo Dibujar, de 1 a 6 tiles (8px a 48px)
- **Dibujar (✎)**: pinta tiles centrados en el cursor. Con interpolación Bresenham para trazos continuos sin huecos
- **Cuadro (▢)**: arrastras rectángulo libre, al soltar rellena todos los tiles que abarca. Un solo batch
- **Clic derecho**: borra (COLLISION_EMPTY) en todos los modos
- **Renderizado**: tiles sin borde individual (color sólido), one-way se ven como medio tile (8x4)

### Escalera:
Terminó con un patrón de dos ventanas transparentes de 4×2 (columnas 2-5, filas 2-3 y 6-7) sobre fondo verde. Quedó limpio.

### Rampas completadas:
- Al seleccionar un color de rampa (rosa↘ o morado↙), auto-switch a lápiz y bloquea otras herramientas
- Preview con línea Bresenham pixel-art blanca (píxel a píxel, esquinas suaves)
- Al soltar, usa patrones escalera desde `escalónes.txt` para pasos enteros (1-8 tiles de ancho, 1 tile de alto)
- Solo pinta el primer segmento (N tiles × 1 tile desde la esquina de inicio) — nada de relleno sólido
- Cada tile guarda 8 valores de 4 bits (píxeles por fila) + un bit de dirección (forward) codificados con aritmética (no bitwise) para evitar overflow de 32 bits
- Los valores se almacenan como 100+ (encoded slopes), no como COLLISION_SOLID
- Colores: rosa (#ff66bb) para forward (base abajo), morado (#bb66ff) para !forward (base arriba)

### Problemas encontrados y resueltos:
- `COLLISION_SOLID` import eliminado → ReferenceError en MundoTab.tsx (fix: importarlo)
- Zoom no se aplicaba en coordenadas de colisión → dividir por dragZoom
- React re-render storm por llamar `setCollisionTile` por cada tile → fix con `batchCollisionTiles`
- Sobreescritura de paintRect durante drag → fix con paintStartRef.current como flag
- Linea siempre a 45° → se cambió a libre para que el ángulo determine el patrón de relleno
- encodeSlope con bitwise daba valores negativos (overflow 32-bit signed) → fix con Math.pow/floor/%
- Dirección de relleno (left-filled vs right-filled) corregida según la convención del archivo escalónes.txt

## 13 Junio 2026 — Reconstrucción y estabilización de rampas

**v0.38.0 (continuación)**. Después de varios intentos de intercambiar fórmulas, normalizar tileX y experimentar con la flag forward, revertí todo y reconstruí el código desde el diff. Quedó el código completo y funcional:
- Staircase patterns para pasos enteros (1-8)
- Math fallback para pendientes no enteras
- Encode/decode aritmético (sin bitwise)
- Bresenham pixel line preview
- Renderizado de slopes via decodeSlope (slot-based) junto con half-tile blocks y paleta original

## Pendientes

- Wrapper .exe con mGBA incrustado para distribuir proyectos
- Licencia MLP2.0
- Sistema de scripting por bloques
- Emulador interno para el botón Play
- Soporte multilenguaje (ES/EN/JP/RU)
