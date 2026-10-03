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

## 23 Septiembre 2026 — v0.49.15 Actores exportados a GBA (sprites software sobre MODE 3)

Primer paso real de actores → ROM: los actores de la escena objetivo del splash ahora se exportan como **sprites renderizados por software sobre el framebuffer** (MODE 3 sigue siendo el modo, sin OAM todavía). También corregí la escala 1:1 del sprite al elegir spritesheet (antes el actor medía 2× el tile).

- **`gba_export.ts`**: nuevo tipo `GBAExportedActor` + `generateActorsData()` → genera en C la pool de sprites únicos (arrays `u16` planos, bit15 = transparente), la tabla `GBAFrame`, y la lógica de runtime completa:
  - `initActors()` construye cada actor (x/y/z, tamaño, frames, delays vsync, modo once/loop/pingpong);
  - `restoreActorRect()` restaura el fondo desde un snapshot `gActorBack` (porque MODE 3 no tiene hardware de sprites);
  - `drawActorRect()` pinta cada frame con transparencia por píxel (`0x8000`);
  - `advanceAllActors()` avanza las animaciones (solo si `frameCount` > 1);
  - `drawAllActors()` ordena por z (insertion sort) y dibuja en orden.
- **Integración en el runtime**: `generateGBAProject` acepta `actors?`; al haberlos, tras `fillScene()` se hace `sceneInit()` (snapshot del fondo + init + primer draw) y el `while(1)` del bucle de escena pasa a `restoreAllActors → advanceAllActors → drawAllActors` cada vsync, compatible con la música (sceneLoop con/Sin).
- **`useAppStore.ts`**: en el export, tras resolver la escena objetivo, recolecta `targetScene.actors`, lee cada spritesheet con `convertImageToGbaBase64Exact`, extrae los tiles por `tileIndex` (grid cols×rows), marca transparente todo píxel con brillo ≥ 384 (misma convención white→transparent), y arma frames/delays desde la animación idle (velocidad respetada, máx 32 frames por anim).
- **Posición relativa a cámara**: `x - cameraX`, `y - cameraY`. Orden de dibujo = z del actor.
- **Escala 1:1**: el inspector al elegir spritesheet fija `width=height=tileWidth/tileHeight` (antes `*2`), así 1 píxel del sprite = 1 píxel de escena.

Pendiente: colisiones/interacción runtime, y migrar a sprites OAM (tiles 4bpp + paletas) cuando haya gameplay.

`src/version.ts`: 0.49.14 -> 0.49.15

## 23 Septiembre 2026 — v0.49.16 Colisiones runtime en la ROM (tiles + actor-actor + demo D-pad)

Los actores ahora chocan de verdad en la GBA. Antes la `collisionMap` era solo datos estáticos en el C; hoy la integro en un runtime de física por software:

- **Collider por actor exportado**: `GBAExportedActor` gana `collider/colliderW/colliderH`; el struct `GBAActor` incorpora `hasCollider`, `cw`, `ch` (tamaño del collider, centrado en el sprite) y `vx/vy`. El collider del inspector (toggle + ancho/alto) ahora viaja a la ROM.
- **Física tile-map (C)**: bloques auxiliares `solidTile()` (sólido, one-way ↑/↓/←/→ según dirección de movimiento, escalera pasable), `rectHitsSolid()` (AABB contra el grid), `moveActorCollide()` (movimiento axial, resuelve X e Y por separado) y `actorBox()` (caja en coords mundo = posición relativa + `CAM_X/CAM_Y`).
- **Actor-actor**: `rectsOverlap()` + `updatePlayer()` empujan al jugador por el eje de menor intrusión cuando toca otro actor con collider.
- **Demo D-pad**: `PLAYER_INDEX 0` (el primer actor es el jugador de prueba) se mueve con le D-pad de la GBA (`REG_KEYINPUT`) a `PLAYER_SPEED 2` px/vsync, con colisiones tiles y entre actores activas en el mismo `while(1)` de la escena.
- **Normalización del map**: los valores de rampas codificadas (>255, desbordarían `u8`) se reducen a sólido (1) al exportar; se conservan 0 vacío, 1 sólido, 2-5 one-ways y 6 escalera.
- **Cámara exportada**: `CAM_X/CAM_Y` desde `targetScene.cameraX/Y` (o 0) para mapear posiciones relativas a tiles mundo.

Soporta escenas con o sin `collisionMap` (sin mapa el jugador se mueve libre; el empuje actor-actor sigue activo). Pendiente: gravedad/plataformas, y migrar a OAM cuando haya gameplay.

`src/version.ts`: 0.49.15 -> 0.49.16

## 23 Septiembre 2026 — v0.49.17 Fix linker ROM: gActorBack a EWRAM + REG_KEYINPUT

Al exporta la escena con colision angió el linker de devkitARM: `gActorBack[PIXEL_COUNT]` (76 KB) es una variable de escritura y el layout básico la pone en **IWRAM (32 KB)**, desbordando (`address 0x3012d00 of `.init_array` is not within region 'iwram'`).

- `gActorBack` ahora se declara con `__attribute__((section(".ewram"), aligned(4)))` → va a la EWRAM de 256 KB (dirección `0x02000000`), donde hay espacio de sobra. Verificado con `arm-none-eabi-size`/`objdump`: sección `.ewram` 0x12c00 bytes.
- `REG_KEYINPUT` ya lo define `libgba/gba_input.h`; ahora el define generado va dentro de `#ifndef` para evitar el warning de redefinición (usamos el registro real de libgba).
- Warnings `runToBlack_Exit`/`runToScene_Entry` sin uso: preexistentes e inofensivos.

Código validado compilando + linkeando con la toolchain real devkitARM (`arm-none-eabi-gcc` + `gba.specs`).

`src/version.ts`: 0.49.16 -> 0.49.17

## 23 Septiembre 2026 — v0.49.18 Fixes transición: sprite visible + transparencia por canal alpha

Problemas reportados probando la v0.49.17: (1) durante la transición de entrada el sprite del jugador no se veía (nunca aparecía hasta terminar la transición completa), y (2) al aparecer el jugador la transparencia estaba invertida: lo que debía ser transparente salía negro y los grises/blancos del sprite salían transparentes.

Causa raíz de (1): los actores solo se dibujan en `sceneInit()` que corre DESPUÉS de `cover`+`reveal`+`fillScene`. Durante la animación del tileset no se dibujaba ningún actor.

Fix (1):
- `runToScene_*`/`fadeToScene` ahora llaman `initActors()` + `drawAllActors(screen)` al inicio y `drawAllActors(screen)` tras detectar cada grupo de tiles, así el sprite queda visible y por encima de la escena mientras se revela.
- Forward declarations `static void initActors(void);` y `static void drawAllActors(u16* screen);` antes de las transiciones (los actores se definen más abajo en el archivo).
- Solo se inyectan cuando `hasActors && hasTransition`; sin actores el C generado no cambia (verificado).

Causa raíz de (2): el export de sprites usaba una heurística de brillo (`r+g+b*8 >= 384 → transparente`), pero el sprite del usuario tiene transparencia real por canal alpha del PNG. El píxel transparente → negro opaco en ROM, y los píxeles claros del cuerpo → transparentes.

Fix (2):
- Nuevo IPC `file:convertImageToGbaBase64ExactAlpha` (electron/main.ts + preload + global.d.ts) que convierte BGRA→RGB555 preservando el alpha: si `alpha < 128` escribe `0x8000` (bit de transparencia igual al runtime de actores), si no el color `0x0000..0x7FFF`.
- `useAppStore.ts` usa el nuevo IPC para tilesets de actor y la extracción de frames pasa a `val & 0x8000 → transparente` (ya no heurística de brillo).
- El preview del editor ya mostraba el alpha real del PNG (`drawImage`/`url()`), así que ahora el editor y la ROM coinciden. El preview de tilesets de transición sigue con blanco→transparente (correcto para el sistema de transición).

La transparencia de los tilesets/gradientes de transición NO se tocó (`convertImageToGbaBase64Exact` intacto, `valToMask` en low 15 bits).

Validado: `npx tsc --noEmit`, `npm run build:renderer`, y generación de C con actor+custom transition y con fade+actor compilando/ linkeando con devkitARM real.

`src/version.ts`: 0.49.17 -> 0.49.18

## 0.49.19 — Fix exportación: "make: No se hace nada para 'all'" (Electron desactualizado)

Bug reportado: tras exportar, la app decía `[OK] ROM compilada` pero el log terminaba en `make: No se hace nada para 'all'` — la ROM no se regeneraba.

Causa raíz: el binario de Electron que correba el usuario estaba compilado el 22 sep (antes del IPC `file:convertImageToGbaBase64ExactAlpha` de la 0.49.18). En `generateBuildFiles` se llamaba `api.file.convertImageToGbaBase64ExactAlpha(...)` → método inexistente → TypeError → el `catch { return false; }` tragaba el error en silencio → NO se reescribía `main.c` (su mtime quedaba más viejo que `main.o`/`.gba`) → make no tenía nada que recompilar.

Fix:
- Reconstruido `dist/electron/` (`npm run build:electron`): ahora `main.js` y `preload.js` exponen el IPC nuevo (verificado con grep).
- `generateBuildFiles` ya no traga errores: el `catch` final ahora reporta `[ERROR] generateBuildFiles: <mensaje>` en el log de exportación.
- `exportGBA` y `playEmulator` ahora comprueban el retorno de `generateBuildFiles()` y abortan antes de `make` si falló, con un mensaje claro indicando que puede ser un Electron desactualizado (reiniciar la app).

Validado: `npx tsc --noEmit`, `npm run build:renderer`, `npm run build:electron` (IPC presente en ambos dist).

Nota para el usuario: reiniciar la app para tomar el Electron nuevo; el export regenera main.c y make recompila.

`src/version.ts`: 0.49.18 -> 0.49.19

## 26 Septiembre 2026 — v0.50.0 Scripting real + estados vacíos grises

Volví al editor después de andar con el export GBA. Lo primero fue la pestaña **Scripting**, que era un `ComingSoon`:

- Tipos `ScriptData` con tres modos (`blocks` / `language` / `cCode`) y store con `addScript(mode)`, `updateScript`, `removeScript`, `setScriptMode`. Al cargar proyecto migré el `code` viejo a `language`.
- El editor de texto quedó con gutter numérico, Tab/Shift+Tab multilínea, Enter con indentación, `Ctrl+/`, autocierre de llaves/paréntesis y contador de delimitadores balanceados. Al principio el gutter quedaba muy espaciado (las líneas se veían doubles), así que el número va en un div por línea con altura fija de 16px, igual que el `lineHeight` del textarea.
- La asignación de scripts se hace desde la pestaña, no en el Mundo: primero `@ todos` en checkbox (se veía mal), luego dos `<select>` (escena y actor) con la lista de asignados debajo y un ✕ para quitar. Al borrar un script limpio los `scriptId` que queden colgados en cualquier actor.
- En el export, un script C solo entra al C final si está asignado a un actor; los que no, se avisan por log. `gSelf` apunta al actor de cada llamada, así que un mismo script mueve varios actores.

Después me fijé en que **todas las pestañas se veían con fondo gris cuando no había nada seleccionado**, y que cada una tenía su propio texto suelto. Hice un componente compartido `EmptyState` (`src/renderer/components/editor/EmptyState.tsx`): icono, título, hint y acción opcional, con fondo `var(--bg-canvas)`. Lo metí en Sprite, Imagen, Music, Sound y Dialogo.

- Los lienzos de Sprite e Imagen ahora fijan su propio fondo (antes heredaban el `#1e1e24` de `EditorScreen`) y el `EmptyState` va en `position:absolute; inset:0` para no romper ni el pan/zoom ni el drag-and-drop; el hint cambia a "Suelta la imagen aquí" cuando hay `dragOver`.
- Sound conserva su drop-zone (los handlers y el outline dashed) y pasa el botón "+ Cargar WAV/MP3" como `action`.
- Music solo muestra el estado vacío cuando no hay patrón seleccionado, porque el grid ya era inerte (`if (!patternSong || !selectedPattern) return;`). Como eso desmonta el piano roll, el efecto de scroll con Ctrl+Wheel pasó a depender de `gridMounted` para enganchar los listeners cuando el grid vuelve.
- Dialogo alterna `display: block` con padding cuando hay página (para no romper el `maxWidth: 520` centrado) y `flex` sin padding cuando está vacío.

El usuario pidió que los iconos quedaran **grises como los de Scripting**: en vez de `var(--accent)` usan `currentColor` heredando `--text-muted`, que es lo que ya hacía el `CodeIcon` de Scripting. Los cinco iconos quedaron anotados en `ICONOS.md` (sección "Estados vacíos") con su link de Lucide propuesto, porque varios de ellos seguro cambian al migrar: el de Imagen debería ser `image` (no `grid-3x3`) y el de Dialogo `message-square` (no `pencil`). También corregí las filas de `WandIcon` y `Grid3x3Icon`, que ya no están huérfanos.

Tests: `npx tsc --noEmit -p tsconfig.json` y `npm run build:renderer` sin errores ni warnings nuevos.

`src/version.ts`: 0.49.19 -> 0.50.0

## 26 Septiembre 2026 — v0.50.1 Migración a iconos de tabler.io

Decidí cambiar de librería: en vez de `lucide-react` vamos a usar `@tabler/icons-react` (la web de tabler.io deja copiar el código de cada icono).

- Instalé `@tabler/icons-react@3.48.0` (ESM, `sideEffects: false`, así que Vite hace tree-shaking de lo que no usemos).
- Dejé el adaptador `tabs/icons/tabler.tsx`: `tabler(Icono, 'Nombre')` devuelve un componente con la MISMA firma que los SVG nuestros (`size`, `strokeWidth`), y por dentro traduce a los props de Tabler (`size`, `stroke`). Así ningún call site cambia: cuando aprobemos un icono, en `tabs/icons/index.tsx` borro el SVG viejo y dejo una línea `export const PlusIcon = tabler(TablerIconPlus, 'IconPlus')`.
- Dejé el ejemplo comentado en la cabecera de `index.tsx` y un probe temporal para comprobar que compila (import directo de `@tabler/icons-react` + wrapper); tsc y build limpios.
- `ICONOS.md` ahora es una lista corta (`glifo` nombre `{}` — dónde se usa) y entre las llaves va SOLO el nombre del componente (`IconPlus`); el `import` no lo escribe nadie porque lo tengo centralizado.

Tests: `npx tsc --noEmit -p tsconfig.json`, `npm run build:renderer` y el probe de tipos con iconos de Tabler.

`src/version.ts`: 0.50.0 -> 0.50.1

## 26 Septiembre 2026 — v0.50.2 Árbol de jerarquía con iconos componentizados

Mientras el usuario anda buscando los iconos en tabler.io, adelanté la parte que no dependía de esa decisión: el árbol de jerarquía.

Antes, varias filas del árbol seguían siendo emoji sueltos (strings) mientras otras ya usaban componentes SVG, y el `HierarchyPanel` los renderizaba de dos formas distintas (`textAlign: center` para strings vs `flex` para nodos), así que no quedaban alineados.

Qué hice:
- `HierarchyPanel`: un solo slot de icono (16px, `display: flex`, centrado, `lineHeight: 1`) para strings y para nodos. Sigue aceptando `string`, así que los marcadores `◧`/`◱` de ScriptingTab no se rompen.
- Reemplacé los emoji por componentes en las jerarquías: splash `🏠` → `HomeIcon`, escena `🌍` → `GlobeIcon`, actor `🤖` → `BotIcon`, diálogo `💬` → `MessageSquareIcon`, página `📄` → `FileTextIcon`, sprite `🎨` → `PaletteIcon`, y el preview de animación `▶`/`▶▶` → `PlayIcon` (doble cuando está sonando).
- `BotIcon`, `MessageSquareIcon`, `FileTextIcon` y `PaletteIcon` ya nacieron como wrappers de Tabler (`IconRobot`, `IconMessage`, `IconFileText`, `IconPalette`) en `tabs/icons/index.tsx`, para no escribir SVGs nuevos que vamos a borrar. Si el usuario prefiere otro icono de tabler, es cambiar una línea por icono.

Las 4 elegidas son provisionales: en `ICONOS.md` dejé los `{}` vacíos (los va llenando el usuario) y anoté acá cuáles usé de andamiaje.

Tests: `npx tsc --noEmit -p tsconfig.json` y `npm run build:renderer` limpios.

`src/version.ts`: 0.50.1 -> 0.50.2

## 26 Septiembre 2026 — v0.51.0 Panel de jerarquía con el look de component-list

El usuario me apuntó `/home/gerardo/Documentos/animaciones` como referencia: el componente `component-list` de esa galería (lista de tarjetas con reordenación, chips de icono, botones solo/mute/ojo/eliminar y encabezado con contador) le interesa sobre todo por los **botones por fila activables**, porque en Music ya existía ese estado (canales con visible/solo/muted) pero dibujado a mano con letras "S" y "M". El radial menu ya lo teníamos copiado de ahí, así que no era el que estaba buscando.

Antes de tocar nada saqué una rama: `nuevo-menu`, con un checkpoint del estado previo (0.50.2) para poder volver atrás si se rompe.

Qué cambié:

- `HierarchyPanel.tsx` reescrito por dentro, con la MISMA API pública, para que las ocho pestañas no tocaran código: `sections`, `items`, `children`, nodos `isHeader`, `selectedId`, `onSelect`, `onRemove`, `onContextMenu`, `editingId`/`onRename`, `onDoubleClick`, `removable`, `actions`, `subtitle`, `color`.
  - Del demo tomé la estructura: encabezado con chevron + título + contador + acciones + botón agregar, fila tipo tarjeta con chip de icono, y framer-motion en el expand/collapse (altura + opacidad, 0.14s).
  - Del demo NO tomé el `Reorder.Group` ni el grip: el arrastre de escenas es en el canvas y meter un drag dentro del panel se pelearía. Tampoco el texto grande de "N de M componentes" porque nuestro panel es angosto (~220px).
  - Fila compacta de 34px (el demo usa 52px y en 220px entran muy pocas filas) y chip de 22px.
  - Colores: fuera todos los hex sueltos (`#666`, `#555`, `#c4a0f0`, `#2a2a30`, y los `#00a86b`/`#191919`/`#212121` del demo). Ahora todo pasa por `--bg-raised`, `--bg-splitter`, `--accent`, `--text`, `--text-secondary`, `--text-muted`. La selección cambió de "texto morado" a fila con tinte de acento y borde de acento.
- `RowIconButton` exportado desde `HierarchyPanel.tsx`: botón de 22px, estado activo con degradado de `--accent`, variante `danger` (rojo al hover) para eliminar, tooltip y `whileTap` de framer-motion.
- API nueva para no repetir markup:
  - `HierarchyItem.toggles?: { eye?, solo?, mute? }` — el panel pinta los botones estándar.
  - `HierarchyItem.dimmed?: boolean` — atenúa la fila (0.42).
  - `HierarchySection.subtitle?: string`.
- Music: los `<span>` con letras "S"/"M" y el ojo bespoke se reemplazaron por `toggles` sobre el mismo `toggleChannel`/`channelStates` (la lógica no se tocó), y las filas que no están en solo se atenúan cuando hay un solo activo.
- Imagen: el ojo de las capas sale del slot `icon` y pasa a `toggles.eye`; la fila se atenúa si la capa está oculta y el chip ahora es `LayersIcon`.
- Iconos: instalé `@tabler/icons-react` (ya estaba) y **desinstalé `lucide-react`**. Migré el radial menu (MundoTab usaba `MapPin, User, Link2, Shield` de lucide) a `IconMapPin`, `IconUser`, `IconLink`, `IconShield`, y cambié el tipo `LucideIcon` por el tipo `Icon` de Tabler en `RadialMenu.tsx`. `EyeIcon`, `EyeOffIcon` y `VolumeIcon` dejaron de ser SVG propios y ahora son wrappers. En `tabler.tsx` tuve que ampliar `size`/`strokeWidth` a `string | number` porque el tipo `Icon` de Tabler acepta las dos.
- Créditos: la entrada de Lucide en `DEFAULT_CREDITS` pasó a Tabler (MIT).
- `ICONOS.md`: secciones nuevas para los iconos del panel y del radial menu, con el `{}` vacío y anotando qué nombre provisional usé, para que el usuario los cambie si quiere.

Tests: `npx tsc --noEmit -p tsconfig.json`, `npm run build:renderer` y `npm run build:electron` limpios. No pude tomar captura (no hay navegador headless en la máquina), así que el look final lo revisa el usuario con `npm run dev`.

Pendiente del usuario: los nombres que ya llenó en `ICONOS.md` (IconXFilled, IconConeFilled, IconBucketDroplet, IconPlugConnected...) — todavía NO los apliqué a los SVG viejos; solo apliqué los provisionales del panel y del radial.

`src/version.ts`: 0.50.2 -> 0.51.0

## 26 Septiembre 2026 — v0.51.0 ajustes de Panel de jerarquía (colores planos, confirmar borrado, splash sin X)

El usuario probó el panel nuevo (`nuevo-menu`) y pidió cuatro cosas "gráficas", tal cual:

1. **Opción de color plano o degradado en Ajustes → General.** En el `component-list` del que copiamos el look había un flag `flat` que apagaba los degradados, así que lo metí como ajuste global y no como cosa del panel: store `flatColors` (persistido en `advance-engine-settings` con el resto de ajustes globales) y `main.tsx:applyFlatColors()` escribiendo la variable CSS `--accent-fill` en `:root`. El panel la usa en los dos únicos sitios con degradado (el chip del icono de la fila seleccionada y el fondo de los `RowIconButton` activos). Radial menu lo dejo como estaba porque ya tenía su `solid` por ítem. Por defecto sigue el degradado, que es lo que había.
2. **Que el `✕` pregunte antes de eliminar.** El `component-list` traía esa confirmación. La metí como `confirmId` en el panel en vez de `window.confirm` (que es lo que usa ScriptingTab) porque el nativo bloquea el renderer y se ve feo: la fila se convierte en "¿Eliminar?" con `✓` (rojo al hover, `danger`) y `✕` para cancelar. `CheckIcon` es wrapper nuevo de Tabler (`IconCheck`, que es justo lo que había puesto en ICONOS.md).
3. **El SplashScreen de Mundo sin `✕`.** El panel solo pinta el botón si `removable !== false`, y Mundo no lo tenía puesto, así que el `onRemove` del splash era un no-op silencioso: `removable: false` y listo.
4. **El vacío sin recuadro punteado.** "Sin elementos" ahora es solo texto (`--text-muted` 10px centrado), sin el `border: 1px dashed`.

De paso, dos bugs que vi al revisar: el toggle de mute pintaba el icono invertido (`on` = mute, pero mostraba el altavoz encendido) y el `disabled` de `RowIconButton` solo bajaba la opacidad pero aún disparaba el `onClick`. Ambos corregidos.

Y un third que me colé yo: para arreglar "la fila se queda marcada" puse un `useRef` + `useEffect` **dentro de `renderNode`**, que se llama en bucle, y React aploó con "Rendered more hooks than during the previous render" (reventó el panel entero). Dos cosas:

1. Los hooks solo pueden vivir al principio de `HierarchyPanel`; `renderNode` es una función normal que se llama por cada ítem. Fuera.
2. El hover de la fila ya no se pinta mutando `e.currentTarget.style.background` en `onMouseEnter/Leave`. Eso deja el DOM fuera de lo que React cree y por eso la fila podía quedarse con el tinte de hover pegado. Ahora el fondo y el borde viven en `index.css` (`.hp-row`, `.hp-row:hover:not([data-selected='true']):not([data-editing='true'])`, `.hp-row[data-selected='true']`) y la fila solo pone `className` + `data-selected`/`data-editing`. Cero estado, cero staleness.

`src/version.ts`: sigue en 0.51.0 (mismo bloque de trabajo, aún sin commitear).

## 26 Septiembre 2026 — Colores en el editor de C Directo

El usuario preguntó si se podía colorear donde se escribe código. La opción "gorda" era meter CodeMirror o Monaco, pero el editor que ya teníamos es un `<textarea>` propio con gutter, tab/auto-indent y snippets; cambiarlo por una librería me trae por debajo la barra (atajos, undo, IME) y mete ~300 kB. Así que fui por la técnica clásica: un `<pre>` con el texto coloreado detrás del `<textarea>` con `color: transparent` y `caretColor` visible.

- `src/renderer/components/editor/codeHighlight.ts`: tokenizador de C en una pasada, sin dependencias. Cubre `//` y `/* */`, preprocesador (`#include <gba.h>` pinta la cabecera aparte), cadenas y caracteres con escapes, números (hex, bin, exponente, sufijos), palabras clave de C, tipos de devkitARM (`u8`, `s8`, `u16`, `s16`, `u32`, `s32`…), la API del motor (`gActors`, `gSelf`, `PLAYER_INDEX`, `REG_KEYINPUT`, `moveActorCollide`, `movePlayer`, `noteOn`…) y cualquier llamada a función (identificador seguido de `(`). Un `/*` sin cerrar se come hasta el final, como en cualquier editor.
- Lo probé aparte con esbuild + node (el repo no tiene runner de tests) y revisé a mano la salida de tokens para comentarios, `#include`, chars con escape (`'\n'`, `'\''`), cadenas con comilla escapada y números.
- En `ScriptingTab`, el `<pre>` y el `<textarea>` comparten un objeto `CODE_METRICS` (mismo font-family, 12px, line-height 16px, `white-space: pre`, `tabSize: 2`, padding `10px 12px`) para que no se descuadre ni una línea.
- El scroll se sincroniza con `transform: translate(-scrollLeft, -scrollTop)` en el `<pre>`, NO con `scrollTop`: el `<pre>` va con `overflow` visible y es el contenedor (`overflow: hidden`) el que recorta; si le pongo `overflow: hidden` al `<pre>` se comería las líneas largas.
- El gutter sigue funcionando (sigue siendo `.code-gutter` hermano del textarea dentro del mismo div).

Paleta One Dark sobre el fondo `#0d0d14` del editor, en `TOKEN_COLOR`.

## 26 Septiembre 2026 — Los iconos NO se aplicaban (el bug de verdad)

El usuario avisó: «los iconos de grid, paint bucket y eso no se aplican». Ten��a razón, y la causa era más tonta de lo que parecía: **los wrappers sí estaban cambiados, pero nadie los usaba**. `Grid3x3Icon`, `PaintBucketIcon`, `SquareIcon`, `MoveIcon` y `WandIcon` estaban importados en MundoTab y **no aparecían en ni un solo JSX**; los botones de la barra de herramientas seguían siendo texto: `✥` (mover), `+` (agregar escena), `🔗` (conectar), `▦` (colisión), `▤` (bote), `⌾` (barita), `▢` (cuadro), `✎` (pincel) y `×` (cerrar el panel de colisiones).

O sea: yo había hecho el cambio correcto en la capa equivocada. Cambiar la definición de los wrappers solo sirve si el call site **renderiza** ese wrapper. Por eso el `WandIcon` sí se veía (lo usa el EmptyState de Sprite) pero el bote y el grid no.

Lo que hice: sustituir cada glifo por su componente en la barra principal y en la del panel de colisiones (que tenía las mismas herramientas duplicadas con títulos ligeramente distintos: "Barita" vs "Varita", por eso el replace(global) no enganchaba a la primera y tuve que cubrir las dos variantes). El `+` de "agregar escena" también era `+` de texto y ahora es `PlusIcon`. El botón de cerrar del panel de colisiones (`×`) pasó a `XIcon` con `display:grid; placeItems:center`, porque un SVG no se centra como un carácter.

El `✎` (pincel de dibujar colisión) no estaba en ICONOS.md. Al final usé `PencilIcon` (IconPencil) — es el mismo glifo de lápiz que ya habías elegido para renombrar/editar, y dejarlo como texto entre cuatro iconos de Tabler se veía peor. Si prefieres otro, es una línea.

Los `▲▼` de MusicTab siguen siendo texto a propósito: son indicadores de scroll del grid, no desplegables.

Comprobación: 0 apariciones de `✥ ▦ ▢ ▤ ⌾ 🔗 ✎` en todo el renderer. `tsc`, `build:renderer` y `build:electron` pasan.

Lección: al migrar iconos hay que buscar los **glifos** (`grep -F` por carácter), no los nombres de los wrappers. Un import que no se usa es la señal de que el call site sigue siendo texto.

## 26 Septiembre 2026 — Los mismos iconos en el menú de opciones emergentes

Petición: «esos mismos iconos que sean los que aparecen en el menu de opciones emergentes». O sea, que el radial menu de Mundo use los mismos iconos que los botones de la barra, no los suyos (MapPin/User/Link/Shield, que además tenían `{}` sin elegir en ICONOS.md).

Mapeo por concepto, que es 1:1 con la barra: Escena → `PlusIcon` (el «+ Agregar escena»), Actor → `BotIcon` (IconUserFilled), Link → `Link2Icon` (IconPlug), Colisiones → `Grid3x3Icon`. De paso el botón «Agregar actor» de la barra dejó de usar `UserIcon` (IconUser, outline) y pasó a `BotIcon`, porque la jerarquía ya usaba el relleno y ahora los tres sitios (jerarquía, botón y radial) pintan el mismo actor.

Eso obligó a tres arreglos de fondo:

1. **`tabler()` no reenviaba `color`.** El radial hace `<item.Icon color="#fff" strokeWidth={2.2} />`; nuestro wrapper solo aceptaba `size`/`strokeWidth`, así que el `color` se perdía y los iconos salían del color del texto (invisibles sobre el disco de color). Añadido `color` a `IconProps`.

2. **`RadialMenuItem.Icon` estaba tipado como `Icon as TablerIconType`**, que es un `ForwardRefExoticComponent` con props propias: un wrapper nuestro no es asignable. Lo cambié por un tipo estructural (`RadialMenuIcon`) que acepta los dos.

3. **La lógica estaba atada al icono**: `onRadialPick` comparaba `item.iconName === 'Shield'` / `'MapPin'` / `'Link2'` / `'User'`. O sea, el menú se rompía en silencio si cambiabas un icono (justo lo que pasó al unificar). Renombré el campo a `action` con valores semánticos (`scene`/`actor`/`link`/`collisions`): la acción ya no depende del dibujo. Es el mismo error de acoplamiento que el de los wrappers sin usar, pero por el otro lado.

`MapPinIcon`, `UserIcon`, `LinkIcon` y `ShieldIcon` quedaron sin uso (los borro de los imports de MundoTab; los wrappers siguen exportados por si acaso, anotados en ICONOS.md). `tsc` + ambos builds pasan.

## 26 Septiembre 2026 — Reutilizar los iconos que ya teníamos

Petición: «los iconos que se utilizan en otros lados, o sea que se pueden reutilizar, como pause, stop, eye, eye close, etc». Es decir: cuando un concepto ya tiene icono en alguna parte de la app, se usa ese, no se inventa un glifo nuevo ni un emoji.

Lo que había:

- `EditorTopBar`: `▶ PLAY`, `■ STOP` y los botones de ventana `─` / `□` como texto.
- `MundoTab`: el botón de animación era `'▶ Reproducir' : '⏸ Pausar'` (string con glifo dentro).
- Zoom de ImagenTab/MusicTab/SpriteTab: `−` y `+` como texto.
- `SettingsModal`: la sidebar usaba `⚙🎨🌐🌍` y el placeholder de cada sección `💻🎨🖼🎵🔊💬`, todo emoji.
- `SpriteTab` tenía **12 SVG defined localmente** (Play, Pause, SkipBack, SkipForward, SkipStart, SkipEnd, ChevronLeft, ChevronRight, OnionSkin, Grid, Pencil, Trash), de los cuales 4 ni siquiera se usaban (SkipStart, SkipEnd, ChevronLeft, ChevronRight). Y `PencilIcon`/`PlayIcon` existían además en el índice común, o sea dos definiciones distintas del mismo icono.

Qué hice: los glifos pasaron a los wrappers que ya existían (`PlayIcon`, `StopIcon`, `MinusIcon`, `SquareIcon`, `PlusIcon`) y añadí `PauseIcon` al índice. En Ajustes reutilicé el icono de cada pestaña en vez del emoji. Y borré los 12 SVG locales de SpriteTab: sus call sites importan del índice común, con wrappers nuevos `PauseIcon`=IconPlayerPause, `SkipBackIcon`/`SkipForwardIcon`, `TrashIcon`=IconTrash, `OnionSkinIcon`=IconLayersIntersect. El `GridIcon` local (cuadrícula del onion skin) se resolvió con `Grid3x3Icon`, que ya existía.

Ojo con un detalle: el `PencilIcon` de SpriteTab era relleno (`fill="currentColor"`) y el del índice común es de trazo. Al unificar, el botón «Renombrar» de Sprite pasó a trazo, que es lo consistente con DialogoTab y MundoTab. Si prefieres el relleno para renombrar, se revierte en una línea.

`tsc` + ambos builds pasan.

## 26 Septiembre 2026 — Estados vacíos con sección propia en ICONOS.md

Preguntó dónde estaba el apartado de los iconos que salen "cuando no hay nada seleccionado". El problema es que **no había apartado**: cada uno estaba anotado en la sección de su pestaña (Sprite, Imagen, Music, Sound, Dialogo, Scripting), seis líneas separadas. Ahora hay una sección única, «Estados vacíos (cuando no hay nada seleccionado)», con una fila por sitio, la ruta del archivo y el `{}` para elegir.

En esa sección hay que distinguir dos wrappers por línea, y es el detalle que choca al editarla: el **genérico** (`PencilIcon`, `Grid3x3Icon`, `MusicIcon`, `VolumeIcon`, `WandIcon`) lo usan también los botones de la pestaña —«Renombrar», «bote», los toggles—, mientras que el del estado vacío es un wrapper **exclusivo** de ese `EmptyState`. Cambiar el `{Icon…}` del estado vacío no debe tocar el genérico, o «Renombrar» y compañía cambian de icono sin avisar.

Los eligió y quedaron puestos: Dialogo → `MessageFilledIcon` (IconMessageFilled), Imagen → `PhotoPentagonIcon` (IconPhotoPentagon), Music → `ClefIcon` (IconClef), Sound → `HeadphonesFilledIcon` (IconHeadphonesFilled), Sprite → `AugmentedRealityIcon` (IconAugmentedReality). Los cinco verificados contra `@tabler/icons-react` antes de usarlos.

Siguen sin icono: **Scripting** y **Mundo** (solo texto del inspector). Y ojo, el "nada seleccionado" del **inspector** es otro sitio: `InspectorPanel` muestra `emptyMessage="Selecciona un …"` (7 llamadas) y es solo texto, sin icono.

`tsc` + ambos builds pasan.

## 26 Septiembre 2026 — Minimapa en el editor de C

Pidió poner «un preview al lado, como lo tienen la mayoría de editores de código». Se podría haber hecho un panel de documentación de la API, un preview del `main.c` generado o un mockup de la pantalla, pero lo que de verdad tiene casi todos los editores de código al lado del texto es el **minimapa**, así que fue eso. Pregunté antes de construir y eligió minimapa.

Cómo quedó: columna de 56 px a la derecha del editor, con una barrita por línea. El ancho de la barrita es proporcional a lo larga que es la línea (tope de 100 caracteres, mínimo 2 px) y el color es el del primer token no vacío, con menos opacidad en comentarios y en texto plano: así se ve de un vistazo dónde están los bloques y dónde los comentarios, que es justo para lo que se usa un minimapa. Encima va el rectángulo claro con el borde de acento que marca la zona visible; clic o arrastre llevan esa línea al centro de la vista. Botón `minimapa` en la barra para apagarlo.

Tres detalles que salieron por el camino y que costaron:

- **El cursor no puede pasar por estado.** El `onScroll` del textarea ya mutaba el `<pre>` y el gutter directamente, sin re-render, a propósito: si no, cada scroll re-renderizaría los miles de `<span>` del resaltado y el editor iría a trompicones. El minimapa mantiene esa regla (`mmSync()` escribe `style.height` y `style.transform` del slider), y solo usa estado para el alto de las filas, que cambia pocas veces.
- **El alto del panel se mide después del layout**, no antes: en el primer render `clientHeight` es 0 y el pitch daba 0. Va en `useLayoutEffect` y en **estado** y no en ref, porque un ref cambia sin re-renderizar y las filas se quedaban con el valor viejo.
- **`preventDefault` en el `pointerdown`**: sin él, el clic en el minimapa saca el foco del textarea y se pierden las teclas justo en el momento en el que estás usando el minimapa. Pequeño detalle que se nota muchísimo.

Además, un archivo largo no cabe: en vez de recortar (y que el clic apunte a la línea equivocada), las líneas se **comprimen** (`mmPitch` baja de 3 px hasta un mínimo de 3, no de 1) para que el archivo entero siga siendo navegable, igual que hace VS Code.

Comprobado con simulación de la matemática (`/tmp/opencode/mm_sim.mjs`): anchos por línea, alto y posición del cursor para scroll 0 y scroll al final, y el mapeo del clic a línea. `tsc` + ambos builds pasan.

## 26 Septiembre 2026 — Ctrl+C y Ctrl+V=dead en todo el editor

Avisó de que copiar y pegar no funcionaban en el editor de C. No era culpa del minimapa: `EditorTopBar` mete un `keydown` en `window` para los atajos de proyecto, y en ese handler se hacía `preventDefault()` de `ctrl+x`, `ctrl+c`, `ctrl+v`, `ctrl+a` y `Delete` **sin mirar dónde estaba el foco**.

Y aquí está lo tramposo: un `keydown` del textarea sube en burbuja hasta el window, así que ese `preventDefault()` se ejecutaba igualmente y **mataba la acción nativa** (copiar/pegar/cortar/seleccionar todo/borrar no son "acciones" que ocurran en el keydown, ocurren como efecto por defecto; si lo cancelas, no pasan). O sea que el arreglo no era "dejar pasar el Ctrl+C", era **no llamar a preventDefault cuando el foco está en un campo editable**.

MundoTab, MusicTab y SoundTab ya tenían esa guarda al principio de su handler; `EditorTopBar` era el único que se la saltaba, y como la barra está montada en todas las pestañas, el fallo era global: renombrar, editar diálogo, escribir un nombre… nada de eso tenía portapapeles.

La cura, al principio del handler y **después** de Ctrl+S:

```
if (ctrl && e.key === 's') { … guardar … return; }   // guardar sí funciona escribiendo
if (target es INPUT/TEXTAREA/SELECT/contentEditable) return;   // manda el campo
```

De paso salió un bug que no había buscado: Ctrl+Z dentro de un campo ejecutaba **las dos** historias — la del editor de C (`stepHistory`) y el `undo()` del proyecto, porque el handler global estaba antes de cualquier guarda. Escribir código y deshacer movía escenas. Ahora cada campo deshace lo suyo.

Comprobado con simulación del bubbling (`/tmp/opencode/keys_sim.mjs`): con foco en el textarea, `c/v/x/a/z` y Supr llegan sin `preventDefault` y Ctrl+S sigue guardando; con foco en el canvas, los atajos globales siguen haciendo lo suyo.

`src/version.ts`: sigue en 0.51.0 (mismo bloque sin commitear).

## 26 Septiembre 2026 — Zoom del editor de C con Ctrl+rueda

Pidió "una forma de zoomear, Ctrl más la rueda del ratón". Ojo con el detalle técnico: el `onWheel` de React va montado en el root **como listener pasivo**, así que un `e.preventDefault()` dentro no sirve y el navegador se come el gesto (en Electron, además, dispara el zoom de la página). La solución fue un `addEventListener('wheel', …, { passive: false })` nativo sobre el contenedor del editor, con cleanup en el `useEffect`, y ahí sí el `preventDefault`.

- Tamaño en el store como `codeFontSize` (9–26 px, default 12) con `clampFontSize()`, persistido en `advance-engine-settings` junto al resto de ajustes globales, así que el zoom se recuerda al cerrar y abrir la app. Ojo: es el tamaño del CATA, no el `fontSize` general de la interfaz.
- El gutter tenía `fontSize: 12` y `CODE_LINE_HEIGHT: 16` fijos; ahora salen de `codeLineHeight(size) = size * 1.34` (misma proporción que 12/16) para que los números no se desalineen al hacer zoom.
- `CODE_METRICS` era un objeto constante; ahora es `codeMetrics(size)` (mismo contenido) para que `<pre>` y `<textarea>` compartan métricas con el tamaño nuevo.
- Indicador de porcentaje a la derecha de la barra de snippets, con clic para resetear a 100%.

`src/version.ts`: sigue en 0.51.0 (mismo bloque sin commitear).

## 26 Septiembre 2026 — Ctrl+Z / Ctrl+Y en el editor de C

Pidió deshacer. El mensaje quedó a medias ("y"…) y asumí que el "y" era el redo, así que van los dos atajos: `Ctrl+Z` deshace, `Ctrl+Y` y `Ctrl+Shift+Z` rehacen.

Por qué NO me fié del undo nativo del `<textarea>`: es un campo controlado (el valor vive en el store) y sobre todo cada insert de snippet, el Tab/Shift+Tab y el auto-cierre de llaves escriben el value por código, que es exactamente lo que limpia la pila de undo del navegador. O sea, deshacías el snippet y se comía lo que habías escrito antes.

Implementación (`ScriptingTab:CodeEditor`):
- Pila propia en una ref: `histRef = { stack: string[], index: number, at: number }`, tope de 200 entradas. No usa `useState` a propósito: solo se lee en los handlers, y así no re-renderiza el editor en cada tecla.
- `setValue(v, typed)` es el único punto de escritura. Si `typed` y han pasado menos de 600 ms desde el último cambio, **sustituye** el tope de la pila en vez de apilar: escribir una línea entera es un solo Ctrl+Z, no 40 (como el undo por palabra de VS Code). Los snippets y los atajos de bloque pasan `typed=false` → paso propio.
- `stepHistory(dir)` mueve el índice, escribe por el store y en el `requestAnimationFrame` devuelve el foco y coloca el cursor (limitado al largo del texto, para no petar si el undo borra mucho).
- La pila se reinicia al cambiar de `script.id`.
- Un paso hacia atrás más allá del inicio no hace nada (no revienta), y al editar tras deshacer se recorta la cola de redo (comportamiento estándar).

Como el repo no tiene runner de tests, volqué la lógica del historial a una simulación en node y la pasé por 8 casos: agrupación de ráfaga, redo, undo en el tope, snippet tras deshacer, recorte de la cola, separación por pausa >600 ms y el tope de 200. Las dos primeras "fallas" eran expectativas mías mal puestas (esperaba que el undo volviera a un estado que el propio recorte de la cola ya había descartado); el código estaba bien.

`src/version.ts`: sigue en 0.51.0 (mismo bloque sin commitear).

## 26 Septiembre 2026 — Iconos de ICONOS.md aplicados

El usuario pidió dos cosas: que en la jerarquía de Scripting el script de Bloques llevara una pieza de rompecabezas (el AdvanceCode lo dejó a medias con "un ...." y pasó a lo segundo), y que fuera aplicando los iconos que ya había puesto en `ICONOS.md`.

Cómo lo abordé: en vez de cambiar los call sites, cambié la **definición** de cada wrapper en `tabs/icons/index.tsx`. Los call sites siguen llamando a `PlusIcon`, `HomeIcon`, etc. y no se tocan; lo único que cambia es qué Tabler hay detrás. Los 9 SVG legacy que elegiste (`Wand`, `Square`, `Home`, `Globe`, `PaintBucket`, `Move`, `Plus`, `Grid3x3`, `Link2`) se borraron y dejaron solo la línea `tabler(...)`. `BotIcon` pasó de `IconRobot` a `IconUserFilled` (había puesto user para el actor) y `EyeOffIcon` de `IconEyeOff` a `IconEyeClosed`. De paso quedaron limpios los imports que ya no se usaban (`IconRobot`, `IconEyeOff`, `IconChevronDown`).

Wrappers nuevos, porque en la lista no les había puesto componente y eran glifos de texto: `RotateCcwIcon` (IconArrowBack), `SettingsIcon` (IconSettingsFilled), `ArrowLeftIcon` (IconArrowNarrowLeftDashed), `TriangleAlertIcon` (IconAlertTriangleFilled), `LoaderIcon` (IconLoader2), `PuzzleIcon` (IconPuzzle) y `AdvanceCodeIcon` (IconFileCodeFilled, el que dejó suelto al final del archivo).

Ojo con los glifos: `ICONOS.md` listaba el ✕ en 8 sitios, pero muchos no eran un icono sino texto dentro de un botón (`<WinBtn label="✕">`). Para esos cambié `label: string` por `label: React.ReactNode` y pasé el icono como hijo. También añadí `display: grid; placeItems: center` donde el glifo estaba centrado con `textAlign`/`lineHeight`, porque un SVG no se centra igual que un carácter. Con eso quedan **0 apariciones de `✕`** en el renderer.

Los desplegables de Mundo (`sceneDropdownOpen ? '▲' : '▼'`, 5 sitios) ahora son `ChevronDownIcon` con `transform: rotate(180deg)` cuando están abiertos. Ojo: los `▲`/`▼` de MusicTab NO los toqué, esos son indicadores de scroll del grid, no desplegables.

Lo que dejé como estaba: los `✓` de texto dentro de listas de código en ScriptingTab, el `✓` de "Todo listo" (ese sí lo pasé a `CheckIcon`), los `⚠` dentro de frases de texto largo y el loader `⏳` de SetupCheckModal, que lo pasé a `IconLoader2` provisional. En la sidebar de Ajustes solo el `⚙` es componente; `🎨`, `🌐` y `🌍` siguen con su emoji porque en la lista siguen vacíos.

`src/version.ts`: sigue en 0.51.0 (mismo bloque sin commitear).

## 27 Septiembre 2026 — Estados vacíos, minimapa del editor y primitivas de movimiento

Tres bloques en una sesión.

### Estados vacíos con icono dedicado

`ICONOS.md` seguía con una columna de componente vacía en la sección de estados vacíos de las cinco pestañas, así que elegí Tabler para cada una y apliqué el cambio en `tabs/icons/index.tsx` (otra vez en la definición, no en los call sites): Dialogo → `IconMessageFilled`, Imagen → `IconPhotoPentagon`, Music → `IconClef`, Sound → `IconHeadphonesFilled`, Sprite → `IconAugmentedReality`. Los cinco `EmptyState` ya existían; solo cambió el icono que reciben.

### Minimapa del editor de C

Columna de 56 px a la derecha del editor, con una barrita por línea del archivo. El ancho sale de `min(trimmed.length, 100)/100` y el color del primer token no vacío de la línea (los comentarios a 0.3 de opacidad, para que destaquen las líneas de código). Clic o arrastre → la línea tocada queda **centrada** en la vista.

Dos detalles que costaron: el sincronizador muta `style.height`/`style.transform` del rectángulo desde el `onScroll` del textarea, porque si fuera estado de React cada scroll re-renderizaría los miles de `<span>` del resaltado. Y cuando el archivo no cabe entero hay que **comprimir** las filas (`max(3, min(3, floor(availH/n)))`) en vez de recortarlas, porque si no el clic apuntaría a la línea equivocada. `onPointerDown` va con `preventDefault()` para que el clic no saque el foco del textarea.

### Coger el bug del portapapeles de paso

`EditorTopBar` tenía un `keydown` en `window` con atajos de proyecto y hacía `preventDefault()` de `ctrl+x/c/v/a` y `Delete` **sin mirar dónde estaba el foco**. El `keydown` de un textarea sube en burbuja hasta el window, así que allí moría la acción nativa: en **ningún** campo de texto se podía copiar, pegar, cortar, seleccionar todo ni borrar. La cura es una guarda al principio del handler que devuelve si `e.target` es un input/textarea/select o `isContentEditable` (Ctrl+S se queda antes de la guarda, para poder guardar escribiendo en un campo). `MundoTab`/`MusicTab`/`SoundTab` ya tenían esa guarda; `EditorTopBar` era el único que se la saltaba. Efecto colateral bienvenido: Ctrl+Z dentro de un campo ya no dispara además el `undo()` del proyecto.

### Primitivas de movimiento (lo gordo de la sesión)

El usuario pedía bases de escenas para distinguir plataformas de topdown, pero al mirar el motor me di cuenta de que el nivel ya es el mapa de tiles y de que lo único que cambia entre un plataformas y un laberinto son **~40 líneas**. Así que en vez de un sistema de plantillas metí dos primitivas en el template: `moveTopDown` (4 direcciones, sin gravedad) y `movePlatformer` (gravedad + coyote time + jump buffer + salto variable, respetando one-way). Todo ajustable con `#define`.

Dos bugs que solo aparecieron al ejecutar el C de verdad:

- **Velocidad pegada al muro.** La primera versión hacía `if (a->vx) a->vy = 0;` queriendo limpiar la velocidad al chocar de lado. Pero eso (a) anulaba el movimiento vertical en diagonal y (b) no frenaba nada al bajar recto, porque bajando solo `vx == 0` y la condición no se cumplía nunca. Ahora se compara la posición antes/después por eje: `if (a->x == ox) a->vx = 0; if (a->y == oy) a->vy = 0;`.
- **Rebote automático al mantener A.** `JUMP_BUFFER` era un `#define` muerto: `jumpBuf` contaba hasta 255 mientras A siguiera pulsado, así que mantener A rebotaba solo al aterrizar. Ahora el buffer se arma en el **flanco de pulsación** (campo `jumpHeld` por actor) y vale `JUMP_BUFFER` vsyncs: mantener A = un salto, soltar y volver a pulsar = otro.

Y un aviso sobre el harness, que me costó un rato: `generateGBAProject` tiene 35 parámetros, y el `gen.cjs` de pruebas se había quedado corto en cuatro (los `Fw/Fh` de las dos transiciones). Como en JavaScript un argumento mal colocado no da error sino `undefined`, los actores llegaban como `collisionMap` y el `main.c` salía **sin primitivas y sin `solidTile`**. El síntoma era el log `[WARN] Script "salto" NO está asignado a ningún actor`; la pista buena fue que el `main.c` generado no contenía ni una vez `movePlatformer`. La lección: si el C generado sale incompleto, sospechar del orden de los argumentos antes que del template.

Verificado sobre el C real (extraído del `main.c` a un test host con `gcc -Wall -Wextra`, no una reimplementación en JS): 10/10 en caída, altura de salto (55 px en 16 frames), one-way por encima y desde dentro, coyote time, subida a través del one-way, aceleración y frenada topdown, frenado contra suelo y contra muro, sin rebote manteniendo A y pulso anticipado. Ambas ramas (con mapa de colisiones y con el stub sin mapa) compilan con devkitARM y generan ROM.

`PLAYER_SPEED` desapareció del template (era el define de la velocidad del D-pad, ya innecesario) y también del doc, junto con el ejemplo 6 que enseñaba a hacer a mano la gravedad que ahora hace `movePlatformer` en una línea.

`src/version.ts`: sigue en 0.51.0 (mismo bloque sin commitear).
