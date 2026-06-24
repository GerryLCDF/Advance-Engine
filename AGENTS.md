## Goal
Generate a transition where each tile (8×8 block) plays the full tileset animation (all frames) sequentially — tile (0,0) plays frames 0→1→...→7, then tile (0,1) plays frames 0→1→...→7, etc. — instead of applying each frame as a full‑screen mask.

## Constraints & Preferences
- Black pixels in source image → `0x7FFF` in `.h` → `0x7FFF` in `gTileset` → **reveals** tile pixel in ROM
- White/bright pixels in source image → `0x0000` in `.h` → `0x0000` in `gTileset` → **hides** tile pixel in ROM
- The `.h` file stores a flat `tilesetData[W*H]` with `TILESET_W/H/COLS/ROWS/FRAMES/FRAME_DELAY` defines (import‑time format)
- At export time, each frame is resampled from source fw×fh → `TILESET_TILES_X × TILESET_TILES_Y` (depends on tileSize)
- The C code uses `gTileset[f][ty * TILESET_TILES_X + tx]` — every screen tile gets a unique mask pixel per frame
- **Entry**: screen starts black → each tile plays frames 0→F-1 sequentially → tile ends fully revealed → next tile starts
- **Exit**: screen starts with scene → each tile plays frames F-1→0 in reverse sequentially → tiles progressively set to black → tile fully hidden at end → next tile starts
- Scene background should NOT be `#000000` or transition is invisible
- The splash connection (`__splash_conn__`) is virtual and NOT stored in `sceneConnections` — its entryTransition IS `splashScreen.entryTransition`

## Progress
### Done
- `transitionHeader.ts`: outputs flat `tilesetData[W*H]` array with `TILESET_W/H/COLS/ROWS/FRAMES/FRAME_DELAY` defines
- `gba_export.ts`:
  - `generateTransitionData` generates **sequential tile animation**: outer loop is tile (ty, tx), inner loop is frames (f)
  - Entry: tiles animate forward (f=0→F-1), Exit: tiles animate in reverse (f=F-1→0) with final force‑hide
  - Both entry and exit receive `sceneData` pointer to restore scene pixels where mask reveals
  - `generateGBAProject` accepts `entryTilesetFrames`, `entryTilesetTilesX`, `entryTilesetTilesY`
- `useAppStore.ts` export:
  - Reads `.h` flat `tilesetData[W*H]` + dimension defines, parses hex values, resamples each frame to `tilesX × tilesY`
  - Fallback conversion: builds source pixel array from GBA base64, then same resampling to tile grid
  - Entry transition reads from `splashScreen.entryTransition` directly (no virtual connection lookup)
  - Fixed brightness threshold: uses `r+g+b` from RGB555 channels, threshold `< 30`
- Build passes with no errors

### In Progress
- User needs to re‑export the project to get the new sequential tile animation C code

## Key Decisions
- **Sequential tile animation**: Instead of progressive frame‑by‑frame reveal (frame 0 reveals some tiles, frame 1 adds more, etc.), each tile individually plays the full animation cycle before the next tile starts
- `.h` intermediate file uses simple flat `tilesetData[W*H]` format (import‑time), final resizing happens at export time where tileSize is known
- The splash connection is virtual (`__splash_conn__`), not a real `SceneConnection` — its inspector modifies `splashScreen.entryTransition` directly
- Exit transition uses **reverse frame order** so tiles progressively hide from scene → black

## Time Estimate
- Total transition time = `TILESET_TILES_X × TILESET_TILES_Y × TILESET_FRAMES × FRAME_DELAY` vsyncs
- For 30×20 tiles × 8 frames × FRAME_DELAY=5 → 24000 vsyncs ≈ **400 seconds** (6.7 min)
- Adjust `animSpeed` in the inspector (lower = faster per tile) to control total duration

## Next Steps
1. User re‑exports the project
2. Build and test the ROM — verify tiles animate one by one, each playing the full tile's animation cycle
3. Adjust `animSpeed` in the inspector if transition is too slow/fast

## Relevant Files
- `src/renderer/utils/transitionHeader.ts`: generates flat `tilesetData[W*H]` + `TILESET_W/H/COLS/ROWS/FRAMES/FRAME_DELAY` defines
- `src/renderer/store/useAppStore.ts`: export reads splash `entryTransition`, regex matches `tilesetData`, resamples frames to tile grid; lines 829‑982
- `src/renderer/utils/gba_export.ts`:
  - `generateTransitionData()` lines 243‑366: generates sequential tile animation C code
  - `generateGBAProject()` lines 368‑499: accepts `entryTilesetFrames`, `entryTilesetTilesX`, `entryTilesetTilesY`; calls `runExitTransition(sceneData)`
- Old `.h` files with `gTileset[N][64]` format (e.g. `triangular.h`) will NOT match the new regex — user MUST re‑import
