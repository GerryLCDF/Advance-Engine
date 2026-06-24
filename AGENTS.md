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

### In Progress
- (none — waiting for user test)

## Key Decisions
- **Pixel‑level mask** (`gTilesetPixel[f][tileY][tileX]`) instead of per‑tile binary (`gTileset[f][ty * tilesX + tx]`) — each pixel of the 8×8 tile is independently controlled
- **White reveals, black hides** — threshold inverted from original so bright source pixels become `0x7FFF` (reveal scene)
- **Entry reversed (7→0)**: tile flashes full scene then progressively hides, ends fully revealed
- **Exit forward (0→7)**: tile progressively shows more black, force black at end ensures curtain fully closed
- `.h` auto‑generated on import (`MundoTab.tsx`) and saved alongside the source image

## Time Estimate
- Total transition time = `tilesX × tilesY × TILESET_FRAMES × FRAME_DELAY` vsyncs
  - tilesX = ceil(240 / tileSize), tilesY = ceil(160 / tileSize)
  - For 30×20 tiles × 8 frames × FRAME_DELAY=5 → 24000 vsyncs ≈ **400 seconds** (6.7 min)
- Adjust `animSpeed` in inspector to control total duration

## Next Steps
1. User re‑exports project to get new C code
2. Build ROM and test — each tile shows full 8‑frame pixel animation sequentially
3. Adjust `animSpeed` if transition is too slow/fast

## Relevant Files
- `src/renderer/utils/transitionHeader.ts`: .h generation, brightness threshold
- `src/renderer/store/useAppStore.ts`: export reads splash `entryTransition`, parses `.h`, extracts per-pixel frames; lines 829‑982
- `src/renderer/utils/gba_export.ts`:
  - `generateTransitionData()` lines 243‑337: generates sequential tile C code with `gTilesetPixel[f][tileY][tileX]`
  - `generateGBAProject()` lines 340‑686: accepts `entryTilesetFrames`, `entryTilesetFw`, `entryTilesetFh`
- `src/renderer/components/editor/tabs/MundoTab.tsx`: auto-generates `.h` on import; preview with white→transparent
- `src/renderer/types/editor.ts`: `FxAsset.hFilePath` field
