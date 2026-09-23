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

## 14 Junio 2026 — Rampas fijas: cuatro herramientas, sin auto-deteccion

**v0.39.0**. Volvi a trabajar en las rampas de colision, pero esta vez con un enfoque completamente distinto. En vez de detectar automaticamente la direccion de la pendiente segun el arrastre, cada boton de rampa produce exactamente el mismo triangulo sin importar como arrastres.

### Los cuatro tipos de rampa:
- **Rosa (7)**: `/` abajo → triangulo (0,8)→(8,0)→(8,8), alineado derecha, cuenta derecha→izquierda
- **Verde (10)**: `\` abajo → triangulo (0,0)→(8,8)→(0,8), alineado izquierda, cuenta izquierda→derecha
- **Naranja (11)**: `\` arriba → triangulo (0,0)→(8,8)→(8,0), alineado derecha, cuenta derecha→izquierda
- **Morado (8)**: `/` arriba → triangulo (0,8)→(8,0)→(0,0), alineado izquierda, cuenta izquierda→derecha

### Cambios clave:
- Elimine la auto-deteccion de pendiente (slope direction). Cada boton tiene flags explicitas: `forceBackslash`, `isBelow`, `encodeForward`, `isMirror`
- `tilePixelCounts` reescrito: itera 8 ramp-rows en vez de 16 pixel-rows, muestrea centros de celda (`ppRamp/2`), devuelve counts 0-8 en vez de 0-16
- Elimine la rama diagonal limpia (analytic branch). Siempre usa el fallback de ramp-rows — 64 checks por tile es suficientemente rapido y evita bugs de precision en direccion `\`
- Logica de direccion de conteo corregida: rosa/naranja cuentan derecha→izquierda, verde/morado izquierda→derecha
- `encodeForward` corregido: `COLLISION_SLOPE || COLLISION_SLOPE_INV_MIRROR` (rosa/naranja → true/right-aligned; verde/morado → false/left-aligned)
- Los botones de rampa ya no hacen auto-switch a `tool='collision'` ni `brush='draw'` al hacer clic. Son solo selectores de valor de pintura; el usuario debe activar explicitamente la herramienta de colision
- SVG de iconos en la paleta corregidos para cada triangulo
- Orden de botones en la paleta: 7→10→11→8 (rosa→verde→naranja→morado)
- Renderizado de tiles codificados: corregido el swap de color mirror (`forward ? '#ffbb66' : '#66ffbb'`)
- `isRamp` en `onMouseMove` actualizado para incluir los 4 valores (7, 8, 10, 11) para que verde/naranja no muestren rectangulo de preview

### Problema conocido:
Verde (y posiblemente naranja) puede dibujar tiles extras mas alla de la linea. Queda pendiente para futuro, no bloquea.

## 16 Junio 2026 — Transiciones entre escenas: preview, custom FX y conexiones borrables

**v0.40.0**. Arranque con el sistema de transiciones. Ya tenia el modelo de datos (`TransitionConfig`, `FxAsset`) pero faltaba casi toda la UI.

### Lo nuevo:

**TransitionContent** — componente que renderiza todos los controles de configuracion de transicion: selector de tipo (instant, fade, scroll, curtain, custom), direccion, duracion, y para el tipo custom: selector de gradiente/tileset, botones de importacion, drop zones, pickers de color de gradiente, config de grilla/animacion de tileset.

**TransitionPreview** — canvas animado en vivo que muestra escena A → transicion de entrada → pantalla de pausa → transicion de salida → escena B, en un loop continuo. Usa `requestAnimationFrame` con refs para evitar re-renders.

**drawTransition** — funcion que dibuja cada tipo de transicion en un canvas. Para el tipo `custom`, reescribi la logica varias veces. Primero intente con una sola fila del gradiente estirada (se veia como un fade generico, no seguia la forma del gradiente). Despues lo reescribi con `ImageData` por pixel: compara el brillo de cada pixel de la imagen de mascara contra un umbral (`1-t`). Si el brillo es menor al umbral, muestra el pixel de la escena A; si no, muestra el de la pantalla de pausa. Esto hace que la transicion siga exactamente la forma del gradiente/tileset.

Tambien separe refs de imagenes por entrada/salida (`entryGradRef`, `exitGradRef`, etc.) y deje de limpiar las refs viejas al recargar, para evitar flickers mientras la imagen nueva se carga.

**TilesetAnimPreview** — preview de tileset con animacion ping-pong, fondo ajedrez, `imageSmoothingEnabled = false` y `imageRendering: pixelated` para que los pixeles se vean nitidos.

**Conexiones borrables**:
- Menu contextual en jerarquia y en canvas (flechas SVG cliqueables con hit area transparente mas ancho)
- Boton de eliminar en el inspector (solo conexiones, no splash)

**InspectorPanel** ahora hace scroll con `overflow-y: auto` cuando el contenido es largo.

**Canvas de preview** con `imageRendering: pixelated` y `aspectRatio: 3/2` para que se vea como en el emulador.

### Fixes:
- Tileset preview borroso → `imageRendering: pixelated` en CSS + `imageSmoothingEnabled = false` en contexto
- Transicion personalizada no seguia el gradiente → reescrita con ImageData threshold
- Flicker en preview cuando cambiaba config → refs separadas por entrada/salida, no limpiar refs viejas
- Preview alargada → `maxWidth: 360` + `aspectRatio: 3/2`

### Pendiente:
- Exportacion GBA de transiciones (generar codigo segun config)
- Centralizar textos visibles en diccionario multidioma (RULES.md lo exige)
- Reemplazar iconos Unicode/emoji que todavia aparecen en preview (pause, flechas)

## 24 Junio 2026 — Cambio radical: máscara píxel a píxel + secuencial por tile

**v0.40.1 → v0.41.0 (sin tag aún)**. Todo el día iterando sobre la transición custom con el usuario hasta dar con el comportamiento exacto que quería.

### El problema original
La transición usaba `gTileset[f][ty * TILESET_TILES_X + tx]` — un solo valor por tile por frame. Si el valor era `0x7FFF`, el tile COMPLETO se revelaba; si era `0x0000`, el tile COMPLETO se ocultaba. No había animación DENTRO del tile. El tileset de 8×8 por frame se remuestreaba a 30×20 tiles, perdiendo toda la información de píxel.

El usuario reportó: "no reproduce la animacion del tileset, espera un poco el bloque limpio y pasa al siguiente".

### La solución: gTilesetPixel[f][fh][fw]
En lugar de remuestrear a la grilla de tiles, cada frame se mantiene como su resolución original (fw×fh = 8×8) y se usa directamente como máscara PIXEL A PÍXEL dentro de cada tile:

```c
gTilesetPixel[f][tileY][tileX] != 0 → scene pixel
gTilesetPixel[f][tileY][tileX] == 0 → black pixel
```

Cada tile ahora muestra los 8 frames completos del tileset como animación de píxeles.

### Orden de frames
Después de varias correcciones, quedó:

| Transición | Orden de frames | Lógica | Final |
|------------|----------------|--------|-------|
| **Entry** (negro → escena) | 7→0 (reverso) | mask≠0 → escena | force escena completa |
| **Exit** (escena → negro) | 0→7 (directo) | mask=0 → negro | force negro (cortinilla) |

Entry: tile empieza negro → frame 7 muestra escena completa → frames 6→0 ocultan progresivamente → force escena al final.
Exit: tile empieza con escena → frames 0→6 cubren con negro → frame 7 restaura escena → force negro (cortínilla cerrada).

### Threshold corregido
El `.h` guardaba `0x7FFF` para píxeles oscuros y `0x0000` para brillantes, al revés de lo que el usuario quería. Se invirtió:

- **Blanco** (brightness ≥ 384) → `0x7FFF` → **revela** escena
- **Negro** (brightness < 384) → `0x0000` → **oculta** (pone negro)

### Auto-generación de .h
Al importar un tileset en MundoTab, se genera automáticamente un `.h` con `tilesetData[W*H]` y defines de dimensiones, guardado junto a la imagen. El campo `FxAsset.hFilePath` almacena la ruta.

### Preview mejorado
El preview de tileset ahora renderiza el blanco como transparente sobre un fondo checkered oscuro (`#666/#444`), para que se vea qué partes del tile revelarán la escena.

### Archivos modificados
- `src/renderer/utils/gba_export.ts`: transiciones con `gTilesetPixel[f][tileY][tileX]`, entry reverso, exit directo + force
- `src/renderer/store/useAppStore.ts`: extrae frames como `fw×fh` sin remuestrear, nueva `valToMask`
- `src/renderer/utils/transitionHeader.ts`: **nuevo** — genera `.h` desde imagen
- `src/renderer/components/editor/tabs/MundoTab.tsx`: auto-genera `.h` al importar, preview con blanco transparente
- `src/renderer/types/editor.ts`: `FxAsset.hFilePath`
- `AGENTS.md`: **nuevo** — diario de sesión técnica para el agente

### Tiempo estimado de transición
Con 30×20 tiles × 8 frames × `FRAME_DELAY`:
- `animSpeed=1` → 80s
- `animSpeed=5` → 400s (6.7 min)

## 26 Junio 2026 — Gradientes + grupos de brillo + salida limpia en reversa

**v0.42.0**. Volví a trabajar en las transiciones después de que el usuario reportara dos bugs: la entrada no aparecía (gW=0, gH=0 cuando no se asignaba gradiente) y la salida solo mostraba el frame 0.

### Lo nuevo:

**Gradiente como .h** — `transitionGradientHeader.ts` genera `#define GRADIENT_W/H` y `const u8 gradientData[W*H]` a partir de la imagen de gradiente. MundoTab auto-genera el .h al importar, igual que con tilesets.

**Grupos de brillo** — En lugar del modelo wave anterior (que calculaba `startFrame` y `maxDelay` por tile), ahora se agrupan tiles por su valor exacto de brillo y los grupos se ordenan de más brillante a más oscuro. Todos los tiles del mismo grupo animan simultáneamente. Se generan `gGroupOffsets_tag[N+1]` y `gTileOrder_tag[count]` en C.

**Salida reescrita** — Ahora cada frame limpia el tile a negro ANTES de escribir la máscara. Esto asegura que todos los frames del tileset se vean completos (antes los frames se acumulaban aditivamente). Los frames se iteran en reversa (7→0) para que el tile empiece mostrando el frame más brillante (casi toda la escena) y termine en negro.

**Entrada reescrita** — Frames en orden 0→7 (forward), sin limpieza previa, force black al final.

### Bugs corregidos:
1. **gW=0, gH=0 en Entry** — Cuando no se asignaba gradiente, `gW=gH=0` hacía que el loop de tiles nunca se ejecutara. Solución: default a `tilesX/tilesY` cuando no hay gradiente.
2. **Parsing de gradiente con llaves anidadas** — El regex anterior no manejaba arrays 2D con `{...}` anidados. Solución: `replace(/[{};\s\n\r]/g, '')` — simple y funciona con cualquier formato.
3. **Lectura de exit tileset** — `hFilePath` no se asignaba correctamente al leer exit tileset. Solución: buscar el .h en `auxPaths` para el exit.

### Archivos modificados:
- `src/renderer/utils/transitionGradientHeader.ts`: **nuevo** — genera .h desde imagen de gradiente
- `src/renderer/utils/gba_export.ts`: `generateTransitionData()` reescrita con grupos de brillo, `seqFn` template con flags `clearBeforeFrame` y `reverseFrames`, `runToBlack_Entry` y `runToScene_Exit`
- `src/renderer/store/useAppStore.ts`: lectura de gradiente con .h primero, fallback a imagen; parsing de arrays C anidados; lectura correcta de exit tileset
- `src/renderer/components/editor/tabs/MundoTab.tsx`: auto-genera .h para gradiente al importar
- `AGENTS.md`, `diario-desarrollo.md`, `README.md`, `src/version.ts`: documentación y versión

El usuario confirmó que ambas transiciones (entrada y salida) funcionan correctamente.

## 29 Junio 2026 — Control de velocidad + merge de grupos para duraciones cortas

**v0.42.0**. Sesión centrada en implementar el control de velocidad de la transición, iterando varios enfoques hasta dar con el que el usuario quería.

### Iteraciones:
1. **Primer intento**: slider `animSpeed` (VSyncs/frame) separado del tileset. Tenía duplicado con el de `TilesetOptions`.
2. **Segundo intento**: invertir la relación (más alto = más rápido). Pero la preview no respondía al cambio.
3. **Tercer intento**: preview usa `animSpeed` directamente para el tick (`speed * 30ms`). Se nota el cambio en preview.
4. **Cuarto intento**: `animSpeed = duración total en segundos` (1-60). El C calcula `frameDelay = round(segundos × 60 / grupos)`.
5. **Quinto intento**: mover `waitVSync()` fuera del loop de frames (espera por grupo, no por frame). Reduce pasos de `grupos×frames` a solo `grupos`.
6. **Sexto intento**: mergear grupos cuando `frameDelay < 1`. Si hay 256 grupos y 0.5s (30 VSyncs), mergea a 30 grupos para que cada uno tenga exactamente 1 VSync.
7. **Final**: UI acepta 0.1s - 60s con step 0.1. El preview sincronizado. La ROM respeta la duración exacta dentro del mínimo hardware (1 VSync por grupo).

### Archivos modificados:
- `src/renderer/types/editor.ts`: `TransitionConfig.animSpeed` default 5 (segundos)
- `src/renderer/utils/gba_export.ts`: merge de grupos, `waitVSync` por grupo, `frameDelay` calculado
- `src/renderer/store/useAppStore.ts`: speed = total segundos, sin fallback a tileset
- `src/renderer/components/editor/tabs/MundoTab.tsx`: UI duración 0.1-60s, preview usa segundos
- `PENDIENTES.md`: marcado control de velocidad completado

### Conclusión
El sistema de transiciones está completo. El usuario confirmó que funciona y cerró el tema.

## 1 Julio 2026 — Hierarquía: rename inline, conexión no deselecciona escena, menú contextual fijo

**v0.44.0**. Sesión de bugfixes y pulido de la jerarquía/conexiones.

### Bugs corregidos

1. **Middle-mouse-button no funcionaba en SceneCards** — El `e.stopPropagation()` en `handleMouseDown` tragaba el botón del medio (button === 1), impediendo el pan con rueda sobre el canvas. Fix: `if (e.button === 1) return` antes del `stopPropagation`.

2. **Seleccionar conexión deseleccionaba la escena** — Al hacer clic en una conexión de la jerarquía, se asignaba `selectedNodeId` al id de la conexión, perdiendo la selección de la escena y ocultando todas las conexiones. Fix: separar en `highlightedConnId` (estado local) + `selectedNodeId` (apunta a la escena). `selectedConnection` deriva de `highlightedConnId || selectedNodeId`.

3. **Secciones del inspector duplicadas** — Cuando se seleccionaba una conexión, el inspector seguía mostrando las secciones de escena/splash porque los `if (selectedScene)` y `if (selectedSplash)` no verificaban si había una conexión activa. Fix: agregar `&& !selectedConnection` a ambos guards.

### Features

4. **Rename inline en jerarquía** — Al hacer doble-clic en una escena, o "Renombrar" en el menú contextual, aparece un `<input>` inline con el nombre seleccionado. Enter/blur guarda, Escape cancela. Usa un solo `editingInputRef` global en vez de hooks por nodo para evitar "Rendered more hooks" errors.

5. **Menú contextual fuera del canvas** — El `ctxMenu` (backdrop + menú) estaba anidado dentro del center `ResizableEditorLayout`, donde los eventos eran interceptados por los handlers del canvas (drag/pan/zoom). Fix: mover el menú contextual **fuera** del layout, como sibling al mismo nivel del return, con `zIndex: 1000`. Ahora los clics en "Renombrar" y "Eliminar escena" funcionan correctamente.

### Archivos modificados
- `src/renderer/components/editor/HierarchyPanel.tsx`: props `editingId`, `onRename`, `onEditingChange`, `onDoubleClick`; renderizado condicional de `<input>` inline
- `src/renderer/components/editor/tabs/MundoTab.tsx`: `highlightedConnId`, `editingId`; `selectedConnection` derivado; guards en inspector; SVG onClick actualizado; `handleRemove` limpia `highlightedConnId`; menú contextual movido fuera del layout; SceneCard pasa button===1
- `src/version.ts`: 0.43.0 → 0.44.0

## 6 Julio 2026 — SoundTab funcional + collision map en exportación C

**v0.46.0**. Implementé dos features que estaban pendientes hace rato.

### Collision map exportado a C (1.9)
El mapa de colisión de la escena destino (nextSceneId) ahora se exporta como `const u8 collisionMap[ROWS][COLS]` en el `main.c`. Define `COLLISION_COLS`, `COLLISION_ROWS`, `COLLISION_TILE_SIZE`.

### SoundTab
Reemplacé el `ComingSoonTab` de Sound por un editor completo:
- **SoundEffect type**: define tipo (duty/wave/noise), duración, volumen, nota, envelope, duty cycle, sweep
- **Jerarquía**: lista todos los sonidos con icono según tipo y preview button
- **Inspector**: controles para nombre, tipo, nota, duración, volumen, duty cycle, envelope, sweep shift + visualización de forma de onda
- **Preview**: usa `playGBASound()` de `gba_audio.ts` para reproducción en tiempo real
- **Importación**: nuevo IPC `dialog:openAudio` para seleccionar WAV/MP3/OGG, el archivo se reproduce con Web Audio API
- Store: `sounds` tipado como `SoundEffect[]`, acciones `addSound(overrides?)`, `updateSound`, `removeSound`
- Añadido `dialog:openAudio` en Electron main + preload + global.d.ts

### Archivos modificados
- `src/renderer/types/editor.ts`: `SoundEffect` interface + `defaultSoundEffect()`
- `src/renderer/store/useAppStore.ts`: sounds tipado, CRUD completo, `addSound` acepta overrides
- `src/renderer/components/editor/tabs/SoundTab.tsx`: **nuevo** — editor completo
- `src/renderer/screens/EditorScreen.tsx`: SoundTab registrado
- `src/renderer/utils/gba_export.ts`: collision map export params + C array generation
- `electron/main.ts`: `dialog:openAudio` IPC handler
- `electron/preload.ts`: `openAudio` expuesto
- `src/renderer/global.d.ts`: `openAudio` type
- `PENDIENTES.md`: marcado 1.9 + SoundTab items
- `src/version.ts`, `README.md`, `diario-desarrollo.md`: docs

## 14 Septiembre 2026 — v0.47.0 Auto-instalacion de devkitARM (Linux y Windows)

Arreglé el check de herramientas del inicio: solo aparecía la primera vez por un flag de localStorage (`advance-studio-setup-done`). Ahora comprueba devkitARM en cada arranque y muestra el modal solo si falta la herramienta.

El cambio gordo del día: el botón "Instalar devkitPro". Antes el modal solo te mandaba a descargar devkitPro manualmente; ahora lo instala solo:

- **Linux**: corre un script bash vía `pkexec` (Electron spawn) que instala `pacman` si no existe, confía la keyring de devkitPro (`BC26F752...`), agrega los repos `[dkp-libs]` y `[dkp-linux]` a `/etc/pacman.conf`, y ejecuta `pacman -S gba-dev` (devkitARM + libgba). Al final también agrega `DEVKITPRO`/`DEVKITARM`/PATH al `.bashrc` del usuario (usa la variable `PKEXEC_UID`). Si el usuario cancela la ventana de polkit, se detecta (exit 126/127) y se muestra "Instalación cancelada".
- **Windows**: descarga `devkitProUpdater-3.0.3.exe` (NSIS oficial) con PowerShell y lo ejecuta en silencio (`/S`). Instala en `c:\devkitPro`, que es la ruta que ya busca `checkDevkitARM`.
- **macOS**: descarga el `.pkg` oficial (`devkitpro-pacman-installer.pkg` v6.0.2) con `curl` y lo instala con `osascript ... with administrator privileges` (pide la contraseña del sistema), después corre `dkp-pacman -S --noconfirm gba-dev`. Best-effort: no probado en hardware mac.
- El progreso se transmite al renderer por un canal IPC (`system:devkit-install-progress`) y se muestra en un log dentro del modal.

Detalles técnicos: en el renderer no existe `process` (contextIsolation true), así que expuse `platform` en preload para saber si es Linux (para el hint de pkexec). El progreso usa `runStream()` con `spawn` en main para no quedarse sin output stream; timeout de 15-20 min según plataforma.

### Archivos modificados
- `electron/main.ts`: `system:installDevkitPro` + `runStream()` + script Linux + lógica Windows
- `electron/preload.ts`: `installDevkitPro`, `onDevkitInstallProgress`, `platform`
- `src/renderer/global.d.ts`: tipos de las 3 APIs nuevas
- `src/renderer/components/SetupCheckModal.tsx`: botón "Instalar devkitPro", log de progreso, re-check al terminar; el check corre en cada arranque
- `src/renderer/main.tsx`: quité el flag `advance-studio-setup-done`, muestro el modal solo si falta la herramienta
- `src/renderer/components/editor/tabs/MundoTab.tsx`: import faltante de `TransitionType` (error de typecheck pre-existente)
- `src/version.ts`: 0.46.0 -> 0.47.0
- `README.md`: requisitos (Linux + auto-instalación)
- `PENDIENTES.md`: item de auto-instalación marcado

## 15 Septiembre 2026 — v0.47.1 Degradado del nombre anclado a la base del cartucho

En la pantalla "Modificar Cartucho" el nombre del proyecto se veía sobre la portada con un degradado negro que terminaba en el borde de la ventana del cartucho (quedaba flotando más arriba de la base). La capa del nombre (Layer 3 en `CartuchoDisplay`) usaba los insets de la ventana (`top 11% … bottom 18%`), así que el degradado solo cubría hasta el final de la portada.

Lo cambié para que la capa ocupe todo el cartucho (`inset: 0`) con un degradado `to bottom` anclado a la base, y el nombre centrado abajo.

### Archivos modificados
- `src/renderer/components/CartuchoDisplay.tsx`: Layer 3 ahora cubre todo el cartucho con degradado anclado a la base
- `src/version.ts`: 0.47.0 -> 0.47.1

## 15 Septiembre 2026 — v0.48.0 Selector de colores de cartucho (Color plano / Color transparente)

Rediseñé la sección "Colores:" de Modificar Cartucho. Ahora hay dos botones centrados: "Color plano" y "Color transparente". Al hacer clic en uno se abre un menú con una cuadrícula de 2×5 con las 10 opciones: los 9 colores fijos (gris, blanco, rojo, verde, azul, morado, café, amarillo, negro) más el "Color propio".

El selector se guarda como un string encodificado `${style}:${colorKey}` o `${style}:custom:#rrggbb`, y los valores legacy (`cartucho`, `cartuchotransparente`, `cartucho_color`) siguen resueltos para no romper proyectos existentes.

Carpeta nueva `public/recursos/cartuchos/` con las 18 imágenes nuevas (480×270) que pasó el usuario (copiadas de `/home/gerardo/Imagenes/advance engine/cartuchos`, nombres normalizados a guion bajo). Para el "Color propio" se tiñe el cartucho blanco con un filtro CSS generado desde el hex (`sepia + hue-rotate + saturate + brightness`).

Feedback visual: hover (escala 1.07) y clic (escala 0.94) en botones y opciones, borde de selección encendido.

### Archivos modificados
- `public/recursos/cartuchos/*.png`: 18 imágenes nuevas (9 colores × plano/transparente)
- `src/renderer/types/index.ts`: `TemplateId` -> string (formato encodificado), `CARTUCHO_STYLES`, `CARTUCHO_COLORS`
- `src/renderer/utils/cartuchos.ts`: `parseTemplate`, `encodeTemplate`, `encodeCustomTemplate`, `cartuchoFile`, `hexToHsl`, `hexToFilter`
- `src/renderer/components/CartuchoDisplay.tsx`: resuelve la plantilla con `parseTemplate` y aplica el filtro del color propio
- `src/renderer/components/CartuchoColorPicker.tsx`: nuevo selector (2 botones + cuadrícula 2×5 + color propio)
- `src/renderer/screens/ModificarPortadaScreen.tsx`: sección "Colores:" usa el nuevo picker
- `src/version.ts`: 0.47.1 -> 0.48.0

## 15 Septiembre 2026 — v0.48.1 Ajustes del selector de colores (feedback del usuario)

Ajustes menores sobre el picker de cartuchos según comentarios del usuario:

- Los botones de estilo ya no son botones de texto: ahora son miniaturas del **cartucho gris** (gris = plano, gris trans = transparente), centradas, con hover/clic.
- Al elegir un color el menú **ya no se cierra**: se aplica en vivo al preview y el usuario puede seguir probando combinaciones.
- El **color propio** se actualiza en vivo mientras se arrastra el selector nativo; el menú tampoco se cierra.
- Se **quitaron Blanco y Negro** de las opciones (los más cercanos a blanco/negro) → quedan 7 colores + "Color propio" en una cuadrícula 4×2.
- Corregido el **swap de nombres del negro**: `cartucho_negro.png` (sólido) y `cartucho_negro_trans.png` (transparente) estaban intercambiados; ya están en su sitio.

### Archivos modificados
- `public/recursos/cartuchos/cartucho_negro*.png`: swap de contenidos
- `src/renderer/types/index.ts`: `CARTUCHO_COLORS` sin blanco/negro (7 colores)
- `src/renderer/components/CartuchoColorPicker.tsx`: miniaturas gris como botones de estilo, menú que no se cierra, color propio en vivo, cuadrícula 4×2
- `src/version.ts`: 0.48.0 -> 0.48.1

## 15 Septiembre 2026 — v0.48.2 Blanco y Negro de vuelta en los predefinidos

Aclaración del usuario: Blanco y Negro SÍ van en la selección de predefinidos (son 9 colores de nuevo, cuadrícula 2×5). Lo que se restringe es el **color propio**: su tinte ya no deja el cartucho pegado a casi-blanco/casi-negro.

`hexToFilter` ahora delimita la luminancia del color elegido al rango 18-82% y fuerza una saturación mínima, para que el color propio siempre pinte un cartucho con color visible (el selector nativo del navegador no se puede restringir, así que es el filtro el que evita los extremos).

### Archivos modificados
- `src/renderer/types/index.ts`: `CARTUCHO_COLORS` de nuevo con los 9 colores (blanco y negro incluidos)
- `src/renderer/utils/cartuchos.ts`: `hexToFilter` delimita L a [18,82] y S mínima
- `src/renderer/components/CartuchoColorPicker.tsx`: cuadrícula de vuelta a 2×5
- `src/version.ts`: 0.48.1 -> 0.48.2

## 15 Septiembre 2026 — v0.49.0 Calcomania delantera de cartucho

Los cartuchos GBA llevan una calcomania (etiqueta) en el frente. El usuario pasó dos PNG estaticos: `recorte.png` (mascara blanco/negro, blanco=visible) y `plantilla.png` (silueta blanca de la zona delantera). La idea: el usuario carga su propio diseño (importar imagen PNG, como la portada) y este se **recorta con la mascara** sobre la zona delantera.

Corré un analisis de pixeles (no puedo ver imagenes con este modelo) para deducir la geometria:
- La zona blanca de `recorte.png` (x 18.75-81.04%, y 25.93-84.81%) coincide al 100% con la silueta blanca de `plantilla.png`.
- En los cartuchos (ej. `cartucho_gris.png`) esa zona es el rectangulo blanco de la etiqueta delantera → la calcomania se pinta exactamente ahí, encima.

Implementación:
- `public/recursos/calcomania/recorte.png` y `plantilla.png` (assets).
- `Project.calcomaniaPath` ('' = plantilla por defecto) en types, store (drafts) y electron (interface + create default).
- `file:copyCalcomania` IPC (+ preload + global.d.ts): copia el diseño a `calcomania.png` dentro de la carpeta del proyecto.
- `CartuchoDisplay` nueva capa Mask: `mask-image` con `recorte.png` (100% 100%) sobre `plantilla.png` o el diseño importado; zIndex 4, el nombre pasa a zIndex 5.
- `ModificarPortadaScreen`: botón "Cambiar calcomanía" (importa PNG), "Quitar calcomanía" para volver a la plantilla, preview en vivo y guardado.
- Recientes y Todos-proyectos: muestran la calcomanía del proyecto.

### Archivos modificados
- `public/recursos/calcomania/`: recorte.png + plantilla.png
- `src/renderer/types/index.ts`: `Project.calcomaniaPath`
- `src/renderer/store/useAppStore.ts`: draftCalcomaniaPath + default en addProject + demos
- `src/renderer/screens/ModificarPortadaScreen.tsx`: botón calcomanía + guardado
- `src/renderer/components/CartuchoDisplay.tsx`: capa con mask-image
- `src/renderer/screens/RecientesScreen.tsx`, `TodosProyectosScreen.tsx`: pasan calcomaniaPath
- `electron/main.ts`: Project interface + file:copyCalcomania + default en create
- `electron/preload.ts`, `src/renderer/global.d.ts`: copyCalcomania
- `src/version.ts`: 0.48.2 -> 0.49.0

## 15 Septiembre 2026 — v0.49.1 La calcomania y la portada son lo mismo

El usuario me aclaró algo importante: **la calcomania ES la portada**, no son cosas diferentes. El botón que carga el diseño es el mismo de siempre ("Cambiar portada") y ese diseño va **por delante** del cartucho. Mi idea de un botón e IPC separados estaba de más, y además al cargar no se veía nada porque el diseño quedaba detrás del marco opaco del cartucho.

### Cambios
- `CartuchoDisplay`: la portada ahora se pinta como **capa delantera** (zIndex 4) recortada por `recorte.png`; sin portada queda la plantilla blanca. Quité la portada interior (ventana) y el segundo marco que la tapaban (el cartucho no tiene ventana transparente).
- Quité `Project.calcomaniaPath`, los drafts, `file:copyCalcomania` (IPC, preload, global.d.ts) y los botones "Cambiar/Quitar calcomanía": se reutiliza el flujo de `coverPath`.
- `src/version.ts`: 0.49.0 -> 0.49.1

## 15 Septiembre 2026 — v0.49.2 Arreglada la calcomanía que no se veía

Seguía sin mostrarse la calcomanía. Encontré el bug de verdad: en Linux las rutas absolutas empiezan con `/`, y la resolución de imagen trataba eso como ruta web → `<img src="/home/...">` pedía `http://localhost:5173/home/...` (404) → caía al fallback blanco (invisible contra la etiqueta blanca).

### Cambios
- `CartuchoDisplay`: las rutas absolutas del sistema ahora se sirven siempre por `atom://local/...` (detectando `atom://` o `http(s)://`; nunca `/` web para datos del proyecto).
- `CrearScreen` y `ModificarPortadaScreen`: la condición para copiar la portada al proyecto pasó de `!startsWith('/')` a `!startsWith('atom://')` (en Linux las absolutas empiezan con `/` y sí deben copiarse).
- El botón se llama **"Colocar calcomanía"** (pide el usuario).
- `src/version.ts`: 0.49.1 -> 0.49.2

## 15 Septiembre 2026 — v0.49.3 Assets de cartucho y calcomanía al repo

El usuario pidió que quien descargue el proyecto pueda disfrutar de la experiencia completa, así que forcé a git (estaban en `recursos/`, gitignored) los assets nuevos:
- Los 20 cartuchos de color (sólido + transparente × 10 colores) en `public/recursos/cartuchos/`.
- La calcomanía: `recorte.png` (máscara) y `plantilla.png` (silueta blanca) en `public/recursos/calcomania/`.
- Las 4 bases (`cartucho.png`, `cartucho_color.png`, `cartuchotransparente.png`, `portada.png`) ya estaban versionadas.

`src/version.ts`: 0.49.2 -> 0.49.3

## 17 Septiembre 2026 — v0.49.4 Fix: ruta con separador mezclado al abrir proyectos

Al crear/abrir un proyecto salía:
`[ERROR] ENOENT no such file or directory, open '/home/gerardo/Documentos/AdvanceEngineProjects\prueva sprite/project.json'`

La ruta salía con un `\` incrustado porque `openProject` en la store construía la ruta con `projectsDir + '\\' + project.name` (separador de Windows hardcodeado). En Linux eso dejaba un backslash mezclado: `...\prueva sprite` (inexistente) → ENOENT.

`src/renderer/store/useAppStore.ts` ahora une con `/` (válido también en Windows) normalizando los `\` sobrantes. `src/version.ts`: 0.49.3 -> 0.49.4

## 17 Septiembre 2026 — v0.49.5 Fix: Skip/auto de sprites marcaba todo como vacío

En la pestaña Sprites, el botón **Skip** abría el modal pero todos los tiles se veían vacíos y **Auto** marcaba todos como omitidos.

Causa raíz: era el mismo bug de separadores de ruta. Al arrastrar un spritesheet, `destPath` se construía con el `projectDir` que tenía `\` incrustado (`...AdvanceEngineProjects\prueva sprite`), se guardaba así en `tilesetPath` y hasta se creaba una carpeta basura con `\` literal en Linux. `readImage` no encontraba el archivo → `tilesetUrl` vacío → modal vacío + Auto marcaba todo.

### Cambios
- `electron/main.ts`: nuevo helper `normPath()` (convierte `\` → `/`) aplicado a `file:copy`, `file:copyCover`, `file:readImage`, `file:readVideo` y `dir:create`. Así rutas con separador Windows funcionan también en Linux.
- `SpriteTab.tsx`: `destPath` del drag&drop normaliza `\` antes de guardarlo en `tilesetPath`.
- `SpriteTab.tsx`: `autoDetectEmpty` endurecido — si la imagen no carga (naturalWidth 0) no marca nada (evita el "marca todos"); calcula tile size desde la imagen si hace falta; todo con try/catch.
- Limpié las carpetas basura `AdvanceEngineProjects\prueva sprite` y `...\prueva cartucho portada` creadas por el bug.
- `src/version.ts`: 0.49.4 -> 0.49.5

## 17 Septiembre 2026 — v0.49.6 Fix visual: tiles con contenido de otros en Skip

Con un spritesheet de 273×186 dividido en 16×6, en el modal Skip se veía contenido de otros tiles (bleeding). Causa: `tileWidth/tileHeight` se calculaban UNA vez al cargar la imagen con la grilla inicial 1×1 (→ 273×186) y el efecto estaba deliberadamente diseñado para no recalcular al cambiar H/V. Al cortar en 16×6, los previews seguían recortando tiles de 273px → veías pedazos de otros tiles.

El efecto ahora recalcula `tileWidth = floor(ancho / cols)` y `tileHeight = floor(alto / rows)` también cuando cambian cols/rows (con guarda anti-loop). `src/version.ts`: 0.49.5 -> 0.49.6

## 17 Septiembre 2026 — v0.49.7 Tiles exactos por canvas (fin del sangrado y del píxel comido)

Con el sheet de 273×186 (16×6), seguía viéndose contenido de tiles vecinos y se "comía" un píxel del borde derecho. Era porque el fondo se dibujaba con `background-size = cols×tileWidth` (272) sobre una imagen de 273 → reescalado (0.996) que sangra vecinos y pierde el último píxel; además 273/16 no es entero.

Solución: nuevo componente `TileThumb` que recorta cada tile con un `<canvas>` y `drawImage`, usando **fronteras redondeadas** (`sx = round(col*W/cols)`, `sx2 = round((col+1)*W/cols)`) que reparten el píxel sobrante entre columnas/filas, y `imageSmoothingEnabled = false`. Así no hay reescalado, no se sangra y no se pierde ningún píxel.

- `TileThumb` reemplaza el `backgroundPosition`/`backgroundSize` en el modal **Skip** y en el selector de frames de animación.
- Lienzo principal: `backgroundSize` ahora usa el tamaño natural de la imagen (`spriteImgSize`) en vez de `cols×tileWidth` (evita el reescalado).
- `autoDetectEmpty` muestrea con las mismas fronteras redondeadas.
- `src/version.ts`: 0.49.6 -> 0.49.7

## 17 Septiembre 2026 — v0.49.8 Fix exportación: entorno devkitPro para `make`

Al exportar salía `arm-none-eabi-gcc: No existe el fichero o el directorio` y el include aparecía como `-I/libgba/include`. Causa: `system:runCommand` ejecutaba `make` heredando el entorno de la app, que no tiene `DEVKITPRO`/`DEVKITARM` ni el PATH de devkitARM (la instalación los escribe en `~/.bashrc`, pero Electron no es un shell de login). Así `$(DEVKITPRO)` quedaba vacío y `make` no encontraba el compilador.

Añadido `detectDevkitRoot()` + `withDevkitEnv()` en `electron/main.ts`: detecta la raíz (`/opt/devkitpro`, `C:\devkitPro`, etc. o `$DEVKITPRO`) y construye un entorno con `DEVKITPRO`, `DEVKITARM` y `PATH` incluyendo `devkitARM/bin` y `tools/bin`. `system:runCommand` ahora pasa ese entorno a `exec`. Requiere recompilar Electron. `src/version.ts`: 0.49.7 -> 0.49.8

## 17 Septiembre 2026 — v0.49.9 Abrir carpeta build al exportar (sin duplicar ventanas)

Al pulsar "Exportar ROM GBA" ahora se abre la carpeta `build` del proyecto (antes abría la raíz del proyecto). Si esa carpeta ya está abierta en el administrador de archivos, no abre otra ventana: en Linux `isFolderOpenInFM()` mira con `ps ax -o args=` si algún gestor (nautilus/org.gnome.Nautilus, dolphin, thunar, nemo, caja, pcmanfm) ya muestra esa ruta y si es el caso devuelve `'ya-abierta'` sin llamar a `shell.openPath`. El ítem "Abrir carpeta del proyecto" sigue abriendo la raíz. `src/version.ts`: 0.49.8 -> 0.49.9

## 17 Septiembre 2026 — v0.49.10 Menú Opciones en el launcher (+ aspecto funcional)

En la pantalla inicial agregué el botón **"Opciones"** en la fila de pills (Documentación/Créditos), alineado a la derecha justo debajo de "V alfa {VERSION}". Al pulsarlo abre un menú desplegable con:

- **Idioma** — sin funcionalidad por ahora (etiqueta "próximamente").
- **Aspecto** — abre el `ThemeModal` (temas predefinidos, color de fondo/accento y tamaño de texto); funcionaba de verdad porque el tema ya se aplica con `--app-font-size`, `--bg-panel`, etc. y persiste en localStorage. El modal estaba definido pero abandonado, lo conecté aquí.
- **Escala** — sin funcionalidad por ahora (etiqueta "próximamente").

El menú cierra con clic fuera o al elegir una opción. Renderer-only (HMR). `src/version.ts`: 0.49.9 -> 0.49.10

## 21 Septiembre 2026 — v0.49.11 Menú radial +/X en la ventana Mundo

Agregué el componente **`RadialMenu`** de la librería **Kukul** (instalada desde local `file:../animaciones`, v1.1.0, ya que el npm sigue en 1.0.0 sin las props `items`/`onPick`) flotando en la esquina inferior derecha del canvas de escenas de la ventana Mundo.

- **+ que rota a X** al pulsarlo; las opciones salen una por una (procencia).
- **3 opciones**: `Opcion1`, `Opcion2`, `Opcion3` con iconos de lucide-react (MapPin, ListChecks, Zap).
- **Color igual al resto de la interfaz**: los items y el centro usan `themeAccent` del store (`--accent`), así sigue el tema configurable de la app.
- `onPick` muestra un toast temporal "X seleccionado" (2.2s) centrado en el canvas.
- El menú no escala con el zoom/pan del canvas (anchor absoluto `right:16 bottom:16`).

Kukul quedó instalada como `@gerardolcdf/kukul: file:../animaciones` y añadí `lucide-react` como dependencia directa. Renderer-only (HMR). `src/version.ts`: 0.49.10 -> 0.49.11

## 22 Septiembre 2026 — v0.49.12 RadialMenu copiado al proyecto (sin dep kukul)

Como vamos a modificar el menú a nuestro gusto, dejé de usar el paquete `@gerardolcdf/kukul` y **copié el componente dentro del proyecto**: `src/renderer/components/editor/tabs/RadialMenu.tsx`.

- Copiado **sin la capa de settings genéricos** de kukul: props planas (`count`, `centerColor`, `glow`, `solid`, `noShadow`, `wobble`, `items`, `onPick`, `open`, `onOpenChange`) — más fácil de modificar.
- `MundoTab.tsx` ahora importa `./RadialMenu` (relativo) y pasa `count={3}` + `centerColor={themeAccent}`.
- Desinstalé `@gerardolcdf/kukul` de package.json; el bundle ya no lo contiene (tamaño bajó). Siguen `framer-motion` y `lucide-react` como dependencias directas.
- Build renderer OK, kukul 0 referencias en dist. `src/version.ts`: 0.49.11 -> 0.49.12

## 23 Septiembre 2026 — v0.49.13 RadialMenu funcional (Escena/Actor/Link/Colisiones) + zoom al cursor

Terminé de darle forma al menú radial y conectarlo con el mundo:

- **4 opciones**: Escena (MapPin), Actor (User), Link (Link2), Colisiones (Shield), del color de la interfaz (`themeAccent`).
- **Fan configurable**: prop `fan: [number,number]` en radianes; abanico por defecto hacia arriba-derecha (`[-π/2, 0]`). Quité el glOF del círculo central (solo sombra suave), las opciones sin brillo (`noShadow`) y sin temblor (`wobble={false}`).
- **Escena**: clic → crea una escena vacía en el centro del canvas. **Link**: activa el modo conectar (clic origen → destino); al completar la conexión vuelve a Mover.
- **Colisiones**: abre un renglón horizontal (igual que la toolbar superior) con las 4 herramientas (bote ▤, varita ⌾, lápiz ✎, cuadrado ▢) + los 10 tipos de colisión, con animación de entrada/salida (spring, desde la izquierda). Al reabrir el menú radial se cierra.
- **Toolbar del canvas**: agregado botón Actor (icono User). Eliminado el botón "Eliminar escena" (tool `remove` inerte).
- **Comportamiento Mover por defecto**: con el menú cerrado y sin operación activa, clic izquierdo sobre una escena la arrastra y clic en el vacío panea la vista (sin usar la rueda). `data-scene-card` marca las tarjetas para no paneear sobre ellas.
- **Zoom al cursor**: refactorizado el zoom Ctrl+rueda con refs (`zoomRef/panXRef/panYRef`) sincronizados; ahora mantiene fijo el punto del mundo bajo el ratón (antes el pan se desincronizaba).
- Tipos de colisión extraídos a constante `COLLISION_TYPES` compartida entre toolbar y panel radial.

`src/version.ts`: 0.49.12 -> 0.49.13

## 23 Septiembre 2026 — v0.49.14 Actores: colocación, edición completa y preview en escena

¡Los actores dejan de ser un botón muerto! Ahora se pueden crear, mover y editar desde la ventana Mundo (ramas formales en `actores`, commit separado).

- **Tipo `Actor` ampliado**: comportamiento (`estático`/`interactuable`/`objeto`, reemplazando el `type` viejo sin uso), **capa Z** (orden de dibujo; en GBA se mapeará a prioridad OAM cuando haya sprites), `animId` (animación idle), collider con ancho/alto, `soundId` (SFX), `musicId` (canción del secuenciador), `scriptId` y `dialogueId`.
- **`addActor` ahora acepta `overrides` y devuelve el id** para poder seleccionar al actor recién creado.
- **Colocación al centro**: clic en el botón Actor de la toolbar o en la opción Actor del menú radial → crea el actor en el centro de la escena seleccionada y lo selecciona. Si no hay escena seleccionada, aviso en el toast.
- **Render en el mini-map de la escena**: cada actor se dibuja con su **sprite real** (recorte del tile del frame idle del spritesheet, con `backgroundSize/Position`, sin resample). Collider rojo punteado cuando está activo; borde destacado cuando está seleccionado.
- **Arrastrar**: con el menú cerrado (modo Mover), hacer clic y arrastrar sobre un actor lo mueve (`updateActor`) sin arrastrar la escena.
- **Inspector**: al seleccionar un actor aparecen las secciones *Actor* (nombre, comportamiento, X/Y/Z, ancho/alto), *Sprite* (spritesheet + animación idle, auto-tamaño desde el tile), *Colisión* (toggle + dimensiones), *Audio* (SFX + Música) y *Script/Diálogo*.
- **Jerarquía**: cada escena lista sus actores como hijos (🤖), seleccionables, renombrables y eliminables (✕).

`src/version.ts`: 0.49.13 -> 0.49.14
