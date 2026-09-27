## Goal
Generate a transition where each tile (8×8 block) plays the full tileset animation (all frames) sequentially as a **pixel‑level mask** — each pixel of the 8×8 tile is controlled individually by the corresponding pixel of the tileset frame.

## Constraints & Preferences
- White/bright pixels in source image → `0x7FFF` in `.h` / `gTilesetPixel` → **reveals** scene pixel in ROM
- Black/dark pixels in source image → `0x0000` in `.h` / `gTilesetPixel` → **hides** (black) pixel in ROM
- `.h` file stores flat `tilesetData[W*H]` with `TILESET_W/H/COLS/ROWS/FRAMES/FRAME_DELAY` defines (import‑time format)
- At export time, each frame is extracted as `fw×fh` pixel array WITHOUT resampling → `gTilesetPixel[FRAMES][FH][FW]`
- The C code uses `gTilesetPixel[f][tileY][tileX]` — each of the 8×8 pixels within the tile is controlled by the tileset frame pixel
- **Entry** (negro → escena): frames **7→0** (reversed). Tile starts black → full scene (frame 7) → progressively hides (frames 6→0) → **force full scene** at end
- **Exit** (escena → negro): frames **0→7** (forward). `mask==0 → black`, `mask!=0 → scene`. Tile starts full scene → progressively covers → frame 7 restores scene → **force black** at end (cortinilla)
- Scene background should NOT be `#000000` or transition is invisible
- The splash connection (`__splash_conn__`) is virtual and NOT stored in `sceneConnections` — its entryTransition IS `splashScreen.entryTransition`

## Progress
### Done
- **Scripting (Fase 1 — UI del Sistema de Código)**: pestaña `Scripting` real (reemplaza ComingSoon). Tipo `ScriptData` (`blocks`/`language`/`cCode`), store con `addScript(mode)/updateScript/removeScript/setScriptMode`, jerarquía agrupada por modo, selector de modo [Bloques][Mi Lenguaje][C Directo] con confirm al cambiar, editor de texto con gutter numeral + tab/auto-indent, lienzo visual de bloques con paleta de 8, inspector con ayuda y badge "Próximamente" de exportación. Migración de `code` legacy → `language` al cargar. TS + build OK.
- **Estados vacíos unificados (Sprite / Imagen / Music / Sound / Dialogo)**: nuevo componente compartido `src/renderer/components/editor/EmptyState.tsx` (icono `var(--accent)` 40px + título + hint + `action` opcional, fondo `var(--bg-canvas)`). Sustituye los textos sueltos "Selecciona un sprite…", "Arrastra una imagen aquí", "Crea o selecciona un diálogo", etc.
  - Iconos: Sprite `WandIcon`, Imagen `Grid3x3Icon`, Music `MusicIcon`, Sound `VolumeIcon`, Dialogo `PencilIcon`
  - Los lienzos de Sprite e Imagen ahora fijan `background: var(--bg-canvas)` (antes heredaban el gris `#1e1e24` de `EditorScreen`) y el EmptyState va en `position:absolute; inset:0` para no romper pan/zoom ni drag-and-drop (el hint cambia a "Suelta la imagen aquí" con `dragOver`)
  - Sound conserva la drop-zone (handlers `onDragOver/onDrop` + outline dashed) y pasa el botón "+ Cargar WAV/MP3" como `action`
  - Music: el EmptyState sustituye al grid cuando no hay patrón seleccionado (`!selectedPattern`, el grid ya era inerte por `if (!patternSong || !selectedPattern) return;`); el efecto de listeners de `pianoRollRef` pasó a deps `[gridMounted]` para reengancharse al montar/desmontar el grid
  - Dialogo: el contenedor del editor cambia a `display:flex` sin padding en vacío y a `block` con padding 16 cuando hay página (para no alterar el `maxWidth:520` centrado)
  - TS + build OK
- `transitionHeader.ts`: generates flat `tilesetData[W*H]` + dimension defines; threshold `brightness >= 384` → `0x7FFF` (reveal)
- `MundoTab.tsx`: auto-generates `.h` when importing a tileset; preview renders white pixels as transparent over checkerboard
- `gba_export.ts`:
  - `generateTransitionData` generates **sequential tile animation** with **pixel‑level mask** (`gTilesetPixel[f][tileY][tileX]`)
  - Entry: frames 7→0 (reverse) + force reveal at end of each tile
  - Exit: frames 0→7 (forward), mask=0 → black, + force black at end (curtain)
  - `generateGBAProject` accepts `entryTilesetFrames`, `entryTilesetFw`, `entryTilesetFh`
- `useAppStore.ts` export:
  - Reads `.h` flat `tilesetData[W*H]` + dimension defines, extracts per-pixel frame data (`fw×fh` per frame, NOT resampled to tile grid)
  - Fallback conversion from GBA base64 with same per-pixel extraction
  - Entry transition reads from `splashScreen.entryTransition` directly
  - `valToMask`: `r+g+b >= 30` → reveal, `< 30` → hide
- `FxAsset` type: added `hFilePath?: string` for auto-generated `.h`
- Build passes with no errors
- Commit `6e590e6` on `feature/transition-system`
- **Fix transiciones tileset sin actores durante el reveal**: `generateTransitionData()` ahora genera `runToScene_*` con `drawActors=false` — los actores se dibujan solo al entrar a la escena (`sceneInit` en `main`), no por delante de la transición ni siendo borrados por el reveal
  - Confirmado en emulador (gbajs + ROM del proyecto): durante el reveal `nA=0` (sin actores); en escena los 2 actores presentes y animando de forma estable (`nA≈434`, timers avanzando)
  - Fades (`fadeToScene`/`fadeToBlack`) siguen dibujando actores cada frame (comportamiento intacto)
  - Harness: `/tmp/opencode/actor_test/` (`repro2.cjs`+`repro_trans_main.c`+`instrument2.cjs`/`framelog2.json`)
- **Fix parpadeo del actor en mGBA/flashcart**: el segundo actor parpadeaba "siempre" en hardware/mGBA pero no en gbajs
  - **Causa raíz**: timing de VBLANK. `restoreAllActors` (≈14.6K ciclos/actor) + `drawAllActors` (≈22.5K/actor, ~36 ciclos por píxel opaco) ≈ 74-80K ciclos/frame contra un presupuesto de ~83.8K (68 líneas × 1232 ciclos) → margen casi nulo. El desbordamiento caía sobre el rect del ÚLTIMO actor dibujado (actor2, y=54) justo cuando el LCD barre esas líneas → tear/parpadeo. gbajs no lo muestra porque copia VRAM entera a fin de frame (ignora timing intraframe)
  - **Fix**: pase **fusión borrar-por-deltas + pintado con transparencia real**. `eraseActorRect()` restaura de `gActorBack` SOLO las franjas del rect anterior que el rect actual no cubre (no hace nada si el actor no se movió/el frame mantiene tamaño); `drawActorRect()` pinta **saltando** píxeles transparentes (`px & 0x8000 → continue`) en vez de escribir el fondo, dejando ver al actor de detrás (menor z) o la escena. `drawAllActors`: pasa borra todos los `eraseActorRect` antes del z-sort de pintado. Nuevo campo `GBAActor.prevX/prevY/prevW/prevH` (init en `initActors`). Eliminado `restoreAllActors`/`restoreActorRect`. Coste: borrado solo franjas de movimiento (− coste ≈ 0 para actores estáticos) + pintado ~14-16 ciclos/píxel opaco
  - **Overlap AHORA correcto**: la transparencia «skip» deja ver al actor de menor `z` detrás; ya no escribe el fondo snapshot sobre el vecino. Sin restricciones de solape.
  - `fadeToScene` usa `drawAllActorsOpaque` (transparente = NO escribir, deja ver la escena fundida, no depende de `gActorBack`). Prototipos añadidos cuando `hasActors && hasTransition`
  - Verificado en emulador (`framelog4.json`, `instrument4.cjs`): escena estable (`dg=0` entre frames de animación), walk animando cada 6 vsyncs (px opacos 555↔551), reveal sin actores intacto
- **Optimización de dibujo de actores (recorte al rect visible + bucle con punteros)**: con 3 actores 21×31 en pantalla, las animaciones iban más lentas en hardware (presupuesto VBLANK ~83.8K ciclos casi cubierto). El nuevo `drawActorRect`/`drawActorRectOpaque` calcula el sub-rectángulo visible (`x0/y0/x1/y1` clamp a 240×160, return si vacío) e itera punteros incrementales (`sp`, `pb`, `pimg`)
  - Inner loop ahora ~14-16 ciclos/píxel opaco (antes ~19-23), ~18-20 con transparente (bg EWRAM), y píxeles fuera de pantalla = 0 trabajo
  - 3 actores 21×31 plenos ≈ ~30-40K ciclos/frame → margen holgado
  - Verificado en emulador en ROM REAL del proyecto (`framelog5.json`, `instrument5.cjs`, `repro2.cjs` con ACTOR_COUNT=3): los 3 actores presentes y estables (`dg=0` entre frames), animación en cadencia exacta de 6 vsyncs (gap dist {6:104})
- **Scripting C Directo exportable (Fase 1 funcional)**: `gba_export.ts` lee `state.scripts`, filtra modo `c` con `cCode` y emite `// ── Scripts de usuario (C Directo) ──` verbatim ANTES de `main()`. Contrato: `void script_init(void)` (una vez al entrar a escena) / `void script_update(void)` (cada frame); dispatchers estáticos `userScriptsInit()`/`userScriptsUpdate()` llaman SOLO con exactamente 1 definición (warns de duplicado/faltante en log). Hooks: `userScriptsInit()` tras `drawAllActors()` en `sceneInit()`; `userScriptsUpdate()` cada frame en los tres bucles de `sceneLoop()` (actores/música/pelado — el bucle sin actores ya no es `waitVSync` pelado si hay scripts). API expuesta: `gActors[]`, `PLAYER_INDEX`, `moveActorCollide`, `movePlayer`, `REG_KEYINPUT` (bits 4-11), reglas GBA (u8/s16, sin float, sin malloc). `addScript('c')` prefilla plantilla init/update; badge inspector "Activo". Verificado: TS + build OK; `main.c` con 6 actores + script compila con devkitPro y genera `repro_trans.gba`.
- **Guía completa `documentacion/10-programar-c-gba.md`**: programar en C para GBA (hardware, mapa de memoria, IO, MODE 3, RGB555, cronometraje/VBLANK 83.8K, template del main.c, actores `GBAActor`, entrada `REG_KEYINPUT`, colisiones/solidTile, sonido APU/noteOn, frames/vsyncs, contrato C Directo, 7 ejemplos de scripts, optimización, depuración, cheat-sheet, glosario). README índice fila 10; `08-scripting.md` reescrito (C directo funcional + enlace); pie de `09` → 10.
- **Fix**: el comentario del header de scripts decía mapa de teclas GBA equivocado (`bit 4=A...`); corregido al mapa real `b0=A b1=B b2=SELECT b3=START b4=RIGHT b5=LEFT b6=UP b7=DOWN b8=R b9=L` (0=pulsado).

### In Progress
- Usuario re-exporta el proyecto (nuevo template con recorte al rect visible + bucle punteros) → build ROM → validar en mGBA/flashcart que con 3 actores las animaciones ya no se ralentizan

## Key Decisions
- **Pixel‑level mask** (`gTilesetPixel[f][tileY][tileX]`) instead of per‑tile binary (`gTileset[f][ty * tilesX + tx]`) — each pixel of the 8×8 tile is independently controlled
- **White reveals, black hides** — threshold inverted from original so bright source pixels become `0x7FFF` (reveal scene)
- **Entry reversed (7→0)**: tile flashes full scene then progressively hides, ends fully revealed
- **Exit forward (0→7)**: tile progressively shows more black, force black at end ensures curtain fully closed
- `.h` auto‑generated on import (`MundoTab.tsx`) and saved alongside the source image

## Actor Budget (VBLANK)
- Todo el dibujo de la escena corre dentro del VBLANK (~83.800 ciclos/frame = 68 líneas × 1232). Si el trabajo lo supera, `waitVSync()` pierde el frame → el bucle baja a ~30fps y las animaciones (retardos en vsyncs) se ralentizan.
- El máximo real NO es un número de actores: es **píxeles de sprite visibles en cámara por frame** ≈ `83.800 ÷ ~15 ciclos/píxel ≈ ~5.600 px`.
- **Fuera de cámara → coste ~0 en VBLANK**: `drawActorRect` hace clamp del rect a la pantalla y `return` si queda vacío (solo se paga el chequeo + `advanceAllActors`, ~decenas de ciclos/actor). Un actor medio fuera paga solo el sub-rect visible.
- Regla práctica: 5-6 actores de 21×31 (651 px) cómodos; 1 jefe de 64×64 (4096 px) + 2 pequeños también caben; el presupuesto es aditivo por área en cámara.
- Se pueden colocar todos los actores que se quiera en la escena; solo cuentan los que la cámara enfoca en ese momento.
- **Fix parpadeo por estallidos de borrado**: cuando todos los actores animan con el mismo delay, avanzan de frame en el MISMO vsync → estallido de borrados full-rect ≈ 79K ciclos (presupuesto 83.8K) → overflow → parpadeo del último actor dibujado. Doble fix en `gba_export.ts`: (1) `eraseActorRect` para actores QUIETOS borra solo la **diferencia** de animación (píxeles donde el frame anterior es opaco y el nuevo transparente; branch que lee `a->frames[a->prevFrame]` vs `cf`); el borrado full-rect solo para actores que se MOVIERON. (2) `initActors` desfasa las fases de animación (`timer = ai*7`) para que los avances no coincidan. Verificado: `main.c` real del usuario (6 actores 21×31 delay=6, 5 en cámara, splash, transiciones, mapa 60×80, script) parcheado y compilado con devkitPro → ROM OK, 0 errores.
- **Fix ralentización de animaciones al caminar (gbajs)**: `drawAllActors` repintaba TODOS los actores cada frame activo. Con 5 actores y 1 animado los frames activos eran 1 de cada 6 (se veía bien); al caminar CADA frame es activo → 5-6× erase+paint → la cadencia de animación (delay vsyncs) se estiraba. Fix: `drawAllActors(screen, filterDirty)` repinta SOLO los actores que cambian o cuyo rect (anterior∪actual) intersecta el rect sucio (`gDirtyX0/Y0/X1/Y1`); los que quedan fuera del rect ya están correctos en `gBackBuf` → coste ~0 por actor estático al caminar (borrado por el "mover" + pintado del jugador + blit ~2K px). `filterDirty=0` en `sceneInit`/transiciones (siempre dibujan todo); `filterDirty=1` en el bucle. Verificado por sim (`dirtyfilter_sim.cjs`): 0 px distintos vs dibujo completo con jugador cruzándose con un NPC (z menor) y 3 animaciones solapadas.
- **Fix parpadeo del actor que se mueve (mGBA)**: dos causas (1) el jugador se pintaba PRIMERO (z=0, índice 0) y al cruzar un NPC del mismo `z` el NPC lo tapaba → titilaba/desaparecía. `drawAllActors` ahora ordena por `paintKey = z*2 + (idx==PLAYER_INDEX)` → el jugador va por DELANTE entre iguales `z` (z sigue mandando entre capas). `PLAYER_INDEX` movido a la sección de actores (antes estaba en `playerDemo`, tras `drawAllActors`). (2) los scripts de usuario que movían al jugador duplicaban el `movePlayer` del motor (4 px/frame) → script de ejemplo corregido y documentado. Verificado: `main.c` real del usuario parcheado (erase diff + paintKey + timers) compila OK en devkitPro, 0 errores.
- **Fix ralentización de animaciones al caminar (medición)**: el instrumento (`instrument7.cjs`) sobre la ROM real del usuario muestra coste por frame PLANO al caminar (idle 2.28ms vs walk 2.33ms, ~60fps con rAF) — NO hay ralentización de emulación. El problema percibido era la **cadencia de animación**: delays de 100ms/frame (6 vsyncs) con cuerpo desplazándose 2px/frame (120px/s) → la zancada se percibe lentísima al caminar. Fix: `WALK_ANIM_BOOST` (define, default 2) — **booste a nivel de ESCENA**: si CUALQUIER actor se movió desde el avance anterior (`lastX/lastY`, comparadas en el avance previo), TODAS las animaciones avanzan ×2 por vsync (el que camina cicla cada 3 vsyncs y los NPC de alrededor acompañan la marcha); en reposo los delays quedan exactos (6,6,6). Cap por `delay`: `timer += min(delay, BOOST)` si la escena se mueve → una animación a 60fps (delay=1) nunca se vuelve MÁS lenta al caminar. Detección por `lastX/lastY` (capturadas en `advanceAllActors`) y NO por `prevX`: `prevX` se sincroniza con `x` al pintar en el MISMO frame en que el script mueve → `x != prevX` solo era cierto el primer frame y el boost quedaba muerto (medido en sim: reposo 6,6,6 / caminando 3,3,3 / reposo 6,6,6). Medición adicional `instrument8.cjs`: ciclos/frame CONSTANTES 280896 idle=walk (sin overshoot de VBLANK) → imposible drop de fps por este ROM en gbajs NI mGBA (presupuesto de trabajo activo ~20K << 197K).
- **Script C controla al jugador (por-actor)**: un script C SOLO se ejecuta si está **asignado** (`scriptId`) a algún actor de la escena en el Mundo → Inspector → Script. El export calcula `activeScripts` (asignados); los no asignados se avisan por log y se omiten (`hasActiveScripts`). Cada script se ejecuta **por cada actor asignado** con la variable global `GBAActor* gSelf` apuntando a ESE actor (los puntos de entrada se renombran a `script_u<i>_init/update` para evitar colisiones entre varios scripts). El esqueleto de `addScript('c')` mueve `gSelf` con `moveActorCollide` (2 px/frame). Si el proyecto tiene CUALQUIER script C (asignado o no), `updatePlayer()` **no** auto-mueve al jugador ("sin script asignado → no hace nada"). Sin NINGÚN script C en el proyecto, el motor mueve al jugador solo vía `movePlayer` (compatibilidad con proyectos sin scripting). `moveActorCollide` siempre está definido (sin mapa = desplazamiento simple; con mapa = respeta tiles sólidos).
- Memoria no es límite: `gActorBack` = 240×160 u16 en EWRAM (76.8KB), frames en ROM, `gActors` pequeño.
- **Fix parpadeo por corte de VRAM (mGBA/hardware) — DOBLE BUFFER**: los actores ya NO se dibujan en VRAM. Se dibujan en `gBackBuf` (EWRAM, 76.8KB) durante el tiempo de frame ACTIVO (presupuesto ~556K ciclos, cualquier estallido de erase/paint cabe sin penalización) y solo en el VBLANK se copia a VRAM (`blitDirtyRect()`, bucle u16 por fila sobre la región sucia). Con esto es IMPOSIBLE que un frame se corte a mitad: el parpadeo del actor que se mueve (que mGBA mostraba porque el jugador se pinta al último y sus últimos writes caían sobre VBLANK finito) queda eliminado por construcción. Bucle: `waitVSync → if (gDirty){blitDirtyRect(); gDirty=0;} → advance/update/script → if (actorsChanged()){computeDirtyRect(); drawAllActors(gBackBuf); gDirty=1;}` — con **redibujado diferido**: si nada cambió (escena estática, animaciones con delay>1, sin teclas) NO se blitea NI se re-dibuja → el frame cuesta casi nada (máximo margen, y gbajs rápido); solo los frames con movimiento/avance de animación pagan el blit+draw. **Blit por rectángulo sucio** (`gDirtyX0/Y0/X1/Y1`): `computeDirtyRect()` suma la unión de rects (anterior∪actual) de todos los actores ANTES de `drawAllActors` (que muta `prev*`) y `blitDirtyRect()` copia SOLO esa zona de `gBackBuf`→VRAM en el VBLANK (~2-2.5K px por frame activo al caminar en vez de 38400 del blit completo → ~17x menos; verificado por sim: 0 px distintos vs blit completo). Sin DMA (bucle u16 por fila; región pequeña). Las transiciones (fades/cortinillas) siguen escribiendo a VRAM directo (pre-loop). Las fades usan `drawAllActorsOpaque` igual que antes.

## Time Estimate
- Total transition time = `tilesX × tilesY × TILESET_FRAMES × FRAME_DELAY` vsyncs
  - tilesX = ceil(240 / tileSize), tilesY = ceil(160 / tileSize)
  - For 30×20 tiles × 8 frames × FRAME_DELAY=5 → 24000 vsyncs ≈ **400 seconds** (6.7 min)
- Adjust `animSpeed` in inspector to control total duration

## Next Steps
1. Usuario re‑exporta el proyecto para obtener el nuevo C (doble buffer + blit por rect sucio + `WALK_ANIM_BOOST=2` scene‑level) — verificar que al caminar la zancada del que camina Y las animaciones de los NPC acompañan al desplazamiento (×2 solo mientras la escena se mueve; en reposo, delays exactos)
2. Build ROM and test — el actor movido por script ya no deja rastros; la transparencia deja ver al actor de atrás (z) en vez de cortarlo; los tiles de colisión exigen `moveActorCollide` en el script
3. Ajustar `animSpeed` si la transición es demasiado lenta/rápida
4. Validar en mGBA/flashcart que el actor que se mueve ya no parpadea aunque haya otros actores (doble buffer)

## Relevant Files
- `src/renderer/utils/transitionHeader.ts`: .h generation, brightness threshold
- `src/renderer/store/useAppStore.ts`: export reads splash `entryTransition`, parses `.h`, extracts per-pixel frames; lines 829‑982
- `src/renderer/utils/gba_export.ts`:
  - `generateTransitionData()` lines 243‑337: generates sequential tile C code with `gTilesetPixel[f][tileY][tileX]`
  - `generateGBAProject()` lines 340‑686: accepts `entryTilesetFrames`, `entryTilesetFw`, `entryTilesetFh`
  - Template de actores: `eraseActorRect` (borrado por deltas del rect anterior, resto de `gActorBack`), `drawActorRect` (transparencia «skip», registra `prevX/Y/W/H`), `drawActorRectOpaque`/`drawAllActorsOpaque` (fade), `drawAllActors` (borra todos → z-sort → pinta), `advanceAllActors`, `initActors` (inicializa `prevX/Y/W/H`); scene loop sin `restoreAllActors`; `sceneInit` snapshot `gActorBack` + init + draw inicial
- `src/renderer/components/editor/tabs/MundoTab.tsx`: auto-generates `.h` on import; preview with white→transparent
- `src/renderer/types/editor.ts`: `FxAsset.hFilePath` field
