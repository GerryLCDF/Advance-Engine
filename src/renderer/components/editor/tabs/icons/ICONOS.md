# Iconos de la aplicación

Lista simple: `glifo` nombre {} — dónde se usa.
En el `{}` pega solo el nombre del componente de tabler.io (ej. `IconPlus`), NO la línea del `import`: el import lo pongo yo centralizado en `tabs/icons/index.tsx`, con un wrapper que traduce `size`/`strokeWidth` a los props de Tabler, así los call sites no cambian. Cuando elijas uno, borro el SVG viejo y dejo solo el wrapper.
`①` = hoy es un SVG propio en `icons/index.tsx` y se migra a ese link.

## Interfaz

- `✕` x {IconXFilled} — cerrar ventana/modal, eliminar ítem, escena, bloque o frame (AppHeader, EditorTopBar, ThemeModal, HierarchyPanel, MundoTab, DialogoTab, SpriteTab, ScriptingTab, SetupCheckModal)
- `✓` check {IconCheck} — tile elegido, devkitARM instalado (SpriteTab, SetupCheckModal)
- `⏳` loader {} — comprobando devkitARM (SetupCheckModal)
- `＋` plus {IconPlus} — agregar (SoundTab, MundoTab, ScriptingTab)
- `↩` rotate-ccw {IconArrowBack} — restablecer valor, slider o knob (SettingsModal, SoundTab)
- `⚙` settings {IconSettingsFilled} — ajustes (RecientesScreen, TodosProyectosScreen, SettingsModal)
- `←` arrow-left {IconArrowNarrowLeftDashed} — volver (EditarScreen, CreditosScreen, TodosProyectosScreen)
- `─` minus {esl que esta} — minimizar ventana (EditorTopBar)
- `□` maximize {el que esta} — maximizar ventana (EditorTopBar)
- `▲` `▼` chevron-down {IconConeFilled} — desplegables y colapsar sección (MundoTab, HierarchyPanel, MusicTab)
- `⚠` triangle-alert {IconAlertTriangleFilled} — aviso de tamaño, advertencia del inspector (MundoTab)

## Mundo

- `✥` move {IconDirectionArrows} — mover o arrastrar escenas (MundoTab) ①
- `▦` grid-3x3 {IconGrid3x3} — pintar colisión (MundoTab) ①
- `▢` square {IconSquare} — cuadro de colisión (MundoTab) ①
- `▤` paint-bucket {IconBucketDroplet} — bote de relleno (MundoTab) ①
- `⌾` wand-sparkles {IconWand} — barita y estado vacío de Sprite (MundoTab, SpriteTab) ①
- `🌍` globe {IconSquareRotatedFilled} — escena (MundoTab, SettingsModal) ①
- `🏠` home {IconHome2Filled} — splash (MundoTab) ①
- `🤖` bot {IconUserFilled} — actor (MundoTab)
- `→` `🔗` link-2 {IconPlug} — conectar escenas (MundoTab); en Tabler: plug-connected {IconPlugConnected}
- `🎬` clapperboard {} — badge de video del splash (MundoTab)
- `🎵` music {} — música de escena y splash, canción (MundoTab, MusicTab, SettingsModal) ①

## Sprite

- `🎨` palette {} — sprite (SpriteTab, SettingsModal, ModificarPortadaScreen)
- `✎` pencil {} — renombrar, dibujar colisión, editar notas (SpriteTab, MundoTab, DialogoTab, MusicTab) ①

## Imagen

- `🖼` image {} — estado vacío, pestaña Imagen, portada (ImagenTab, SettingsModal, ModificarPortadaScreen)
- `👁` eye {} — capa visible, instrumento visible (ImagenTab, MusicTab) ①
- `👁🗨` eye-off {} — capa oculta (ImagenTab) ①
- `📄` file-text {} — nombre de capa y página de diálogo (ImagenTab, DialogoTab)

## Music

- `💾` save {} — guardar patrón (MusicTab) ①
- `▶` play {} — reproducir animación, transporte o preview (MundoTab, MusicTab, SpriteTab, SoundTab, EditorTopBar)
- `■` square {} — detener (MusicTab, SoundTab, EditorTopBar)
- `⏸` pause {} — pausar animación (MundoTab)
- `✎` pencil {} — modo dibujo de notas (MusicTab) ①
- `⌖` mouse-pointer {} — modo selección (MusicTab) ①
- `▨` eraser {} — borrador (MusicTab) ①
- `◻` activity {} — canal Pulse, patrón activo (MusicTab) ①
- `〰` audio-waveform {} — canal Wave, forma de onda (MusicTab, SoundTab) ①
- `≋` waves {} — canal Noise, forma de ruido (MusicTab, SoundTab) ①
- `👁` eye {} — instrumento visible (MusicTab) ①

## Sound

- `🔊` volume-2 {} — estado vacío, pestaña Sound (SoundTab, SettingsModal) ①
- `＋` plus {} — importar sonido (SoundTab)
- `▶` play {} — previsualizar (SoundTab)
- `■` square {} — detener preview (SoundTab)
- `↩` rotate-ccw {} — restablecer knob (SoundTab)

## Dialogo

- `💬` message-square {} — diálogo y estado vacío (DialogoTab, SettingsModal)
- `📄` file-text {} — página de diálogo (DialogoTab)

## Scripting

- `💻` code-2 {} — estado vacío, pestaña Scripting (ScriptingTab, SettingsModal) ①

## Portada

- `📐` ruler {} — requisito de dimensiones (ModificarPortadaScreen)
- `🗂` file-archive {} — requisito de formato PNG (ModificarPortadaScreen)

## Ajustes

- `🌐` languages {} — sección idioma (SettingsModal)
- `🎨` brush {} — sección apariencia (SettingsModal)

## Importados y sin uso (se pueden borrar)

- `Link2Icon`, `ArrowRightIcon` (conexión), `MinusIcon` (borrar escena, ya se usa `✕`), `Grid2x2Icon`, `MoreVerticalIcon`, `ConstructionIcon`
