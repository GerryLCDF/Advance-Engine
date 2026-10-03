# Iconos de la aplicación

Lista simple: `glifo` nombre {} — dónde se usa.
En el `{}` pega solo el nombre del componente de tabler.io (ej. `IconPlus`), NO la línea del `import`: el import lo pongo yo centralizado en `tabs/icons/index.tsx`, con un wrapper que traduce `size`/`strokeWidth` a los props de Tabler, así los call sites no cambian. Cuando elijas uno, borro el SVG viejo y dejo solo el wrapper.
`①` = hoy es un SVG propio en `icons/index.tsx` y se migra a ese link.

## Interfaz

- `✕` x {IconXFilled} ✔ — cerrar ventana/modal, eliminar ítem, escena, bloque o frame (AppHeader, EditorTopBar, ThemeModal, HierarchyPanel, MundoTab, DialogoTab, SpriteTab, ScriptingTab, SetupCheckModal)
- `✓` check {IconCheck} ✔ — tile elegido, devkitARM instalado (SpriteTab, SetupCheckModal)
- `⏳` loader {} — comprobando devkitARM (SetupCheckModal)
- `＋` plus {IconPlus} ✔ — agregar (SoundTab, MundoTab, ScriptingTab)
- `↩` rotate-ccw {IconArrowBack} ✔ — restablecer valor, slider o knob (SettingsModal, SoundTab)
- `⚙` settings {IconSettingsFilled} ✔ — ajustes (RecientesScreen, TodosProyectosScreen, SettingsModal)
- `←` arrow-left {IconArrowNarrowLeftDashed} ✔ — volver (EditarScreen, CreditosScreen, TodosProyectosScreen)
- `─` minus {IconMinus} ✔ — minimizar ventana (EditorTopBar) y zoom out (ImagenTab, MusicTab, SpriteTab)
- `□` maximize {IconSquare} ✔ — maximizar ventana (EditorTopBar)
- `▲` `▼` chevron-down {IconConeFilled} ✔ — desplegables y colapsar sección (MundoTab, HierarchyPanel, MusicTab)
- `⚠` triangle-alert {IconAlertTriangleFilled} ✔ — aviso de tamaño, advertencia del inspector (MundoTab)

## Mundo

- `✥` move {IconDirectionArrows} ✔ — mover o arrastrar escenas (MundoTab) ①
- `▦` grid-3x3 {IconGrid3x3} ✔ — pintar colisión (MundoTab) ①
- `▢` square {IconSquare} ✔ — cuadro de colisión (MundoTab) ①
- `▤` paint-bucket {IconBucketDroplet} ✔ — bote de relleno (MundoTab) ①
- `⌾` wand-sparkles {IconWand} ✔ — barita y estado vacío de Sprite (MundoTab, SpriteTab) ①
- `🌍` globe {IconSquareRotatedFilled} ✔ — escena (MundoTab, SettingsModal) ①
- `🏠` home {IconHome2Filled} ✔ — splash (MundoTab) ①
- `🤖` bot {IconUserFilled} ✔ — actor (MundoTab)
- `→` `🔗` link-2 {IconPlug} ✔ — conectar escenas (MundoTab); en Tabler: plug-connected {IconPlugConnected}
- `🎬` clapperboard {} — badge de video del splash (MundoTab)
- `🎵` music {} — música de escena y splash, canción (MundoTab, MusicTab, SettingsModal) ①

## Sprite

- `🎨` palette {} — sprite (SpriteTab, SettingsModal, ModificarPortadaScreen) · estado vacío: ver «Estados vacíos»
- `✎` pencil {} — renombrar, dibujar colisión, editar notas (SpriteTab, MundoTab, DialogoTab, MusicTab) ①

## Imagen

- `🖼` image {} — pestaña Imagen, portada (ImagenTab, SettingsModal, ModificarPortadaScreen) · estado vacío: ver «Estados vacíos»
- `👁` eye {IconEye} ✔ — capa visible, instrumento visible (ImagenTab, MusicTab) ①
- `👁🗨` eye-off {IconEyeClosed} ✔ — capa oculta (ImagenTab) ① ✔ aplicado
- `📄` file-text {} — nombre de capa y página de diálogo (ImagenTab, DialogoTab)

## Music

- `💾` save {} — guardar patrón (MusicTab) ①
- `▶` play {IconPlayerPlay} ✔ — reproducir animación, transporte o preview (MundoTab, MusicTab, SpriteTab, SoundTab, EditorTopBar)
- `■` square {IconPlayerStop} ✔ — detener (MusicTab, SoundTab, EditorTopBar)
- `⏸` pause {IconPlayerPause} ✔ — pausar animación (MundoTab, SpriteTab)
- `✎` pencil {} — modo dibujo de notas (MusicTab) ①
- `⌖` mouse-pointer {} — modo selección (MusicTab) ①
- `▨` eraser {} — borrador (MusicTab) ①
- `◻` activity {} — canal Pulse, patrón activo (MusicTab) ①
- `〰` audio-waveform {} — canal Wave, forma de onda (MusicTab, SoundTab) ①
- `≋` waves {} — canal Noise, forma de ruido (MusicTab, SoundTab) ①
- `👁` eye {IconEye} — instrumento visible (MusicTab) ①

## Sound

- `🔊` volume-2 {} — pestaña Sound (SoundTab, SettingsModal) · estado vacío: ver «Estados vacíos»
- `＋` plus {} — importar sonido (SoundTab)
- `▶` play {} — previsualizar (SoundTab)
- `■` square {} — detener preview (SoundTab)
- `↩` rotate-ccw {} — restablecer knob (SoundTab)

## Dialogo

- `💬` message-square {} — diálogo (DialogoTab, SettingsModal) · estado vacío: ver «Estados vacíos»
- `📄` file-text {} — página de diálogo (DialogoTab)

## Scripting

- `💻` code-2 {} — pestaña Scripting (ScriptingTab, SettingsModal) · estado vacío: ver «Estados vacíos»

## Portada

- `📐` ruler {} — requisito de dimensiones (ModificarPortadaScreen)
- `🗂` file-archive {} — requisito de formato PNG (ModificarPortadaScreen)

## Ajustes

- `🌐` languages {} — sección idioma (SettingsModal) — sigue con emoji (sin equivalente aún)
- `🎨` brush {} — sección apariencia (SettingsModal) — ahora `PaletteIcon` (el mismo de Sprite)
- `🌍` globe {IconSquareRotatedFilled} ✔ — sección mundo (SettingsModal) — mismo icono que las escenas

## Sprite — iconos que ahora son comunes (ya no viven en SpriteTab)

Estaban duplicados como SVG locales dentro de `SpriteTab.tsx`; ahora son wrappers de Tabler en `icons/index.tsx` y los reutiliza quien los necesite:

- `⏮` skip-back {} — frame anterior (SpriteTab) — hoy `IconPlayerSkipBack`
- `⏭` skip-forward {} — frame siguiente (SpriteTab) — hoy `IconPlayerSkipForward`
- `🗑` trash {} — eliminar frame (SpriteTab) — hoy `IconTrash`
- onion-skin {} —rangos fantasma (SpriteTab) — hoy `IconLayersIntersect`
- `▦` grid {} — mostrar cuadrícula del onion skin (SpriteTab) — hoy `Grid3x3Icon`

## Estados vacíos (cuando no hay nada seleccionado) ← edita aquí

Son los iconos grandes que salen en el lienzo cuando no has elegido nada. Todos se pasan a
`EmptyState` (`components/editor/EmptyState.tsx`) con `icon={<Wrapper size={40} />}`, así que
para cambiarlos basta con buscar `icon={<` en el archivo. Todos comparten tamaño (40) y color.

Cada línea lleva **dos** wrappers: el genérico (`PencilIcon`, `Grid3x3Icon`…) que usan los botones
de la pestaña, y el del estado vacío, que es un wrapper aparte. Al cambiar el `{Icon…}` solo se
toca el del estado vacío; el genérico no se mueve.

- `PencilIcon` {IconMessageFilled} ✔ — Dialogo: sin diálogos **y** sin página (`DialogoTab.tsx`, 2 sitios) — ahora `MessageFilledIcon`
- `Grid3x3Icon` {IconPhotoPentagon} ✔ — Imagen: sin imagen (`ImagenTab.tsx`) — ahora `PhotoPentagonIcon`
- `MusicIcon` {IconClef} ✔ — Music: sin patrón (`MusicTab.tsx`) — ahora `ClefIcon`
- `VolumeIcon` {IconHeadphonesFilled} ✔ — Sound: sin sonido (`SoundTab.tsx`) — ahora `HeadphonesFilledIcon`
- `WandIcon` {IconAugmentedReality} ✔ — Sprite: sin sprite (`SpriteTab.tsx`) — ahora `AugmentedRealityIcon`
- (ninguno) {} — Scripting: sin script — hoy **no hay icono**, solo el texto del inspector
- (ninguno) {} — Mundo: sin escena — hoy **no hay icono**, solo el texto del inspector

Nota: el "nada seleccionado" del **inspector** es otro sitio distinto: `InspectorPanel` recibe
`emptyMessage="Selecciona un …"` (7 llamadas: Dialogo, Imagen×2, Music, Sound, Scripting,
Sprite, Mundo) y **no tiene icono**, solo texto. Si quieres icono ahí, dime y lo agrego.

## Panel de jerarquía (HierarchyPanel, botón por fila)

Estos ya están puestos con un nombre provisional de Tabler, cambialos si quieres otros:

- `🗂` stack-2 {} — chip de icono de la capa (ImagenTab) — hoy `IconStack2`
- `👁` eye {} — botón mostrar/ocultar (MusicTab canales, ImagenTab capas) — hoy `IconEye` / `IconEyeOff`
- `◎` focus {} — botón solo (MusicTab) — hoy `IconFocus`
- `🔊` volume {} — botón mute (MusicTab) — hoy `IconVolume` / `IconVolumeOff`
- `✕` x {} — eliminar ítem del árbol (HierarchyPanel) — hoy `IconX`
- `▼` chevron-down {} — colapsar sección/grupo (HierarchyPanel) — hoy `IconChevronDown`

## Radial menu (MundoTab)

Ahora usan **los mismos iconos que los botones de la barra** (lo pediste: "esos mismos iconos que sean los que aparezcan en el menú de opciones emergentes"):

- ítem **Escena** — `PlusIcon` (`IconPlus`), el mismo del botón «Agregar escena» ✔
- ítem **Actor** — `BotIcon` (`IconUserFilled`), el mismo del botón «Agregar actor» y de la jerarquía ✔
- ítem **Link** — `Link2Icon` (`IconPlug`), el mismo del botón «Conectar escenas» ✔
- ítem **Colisiones** — `Grid3x3Icon` (`IconGrid3x3`), el mismo del botón «Pintar colisión» ✔

`RadialMenuItem` ya no usa `iconName` (la lógica dependía del nombre del icono, así que cambiar un icono rompía el menú): ahora el campo es `action` (`scene` / `actor` / `link` / `collisions`).

## Importados y sin uso (se pueden borrar)

- `ArrowRightIcon` (conexión), `MinusIcon` (borrar escena, ya se usa `✕`), `Grid2x2Icon`, `MoreVerticalIcon`, `ConstructionIcon`
- `MapPinIcon`, `UserIcon`, `LinkIcon`, `ShieldIcon` — se usaban solo en el radial menu; quedaron sin uso al unificar sus iconos

- `🧩` puzzle {} — script en modo Bloques (ScriptingTab) — hoy `IconPuzzle`
- `📄` file-code-filled {} — script en modo AdvanceCode (ScriptingTab) — hoy `IconFileCodeFilled` (lo anotaste al final del archivo)
- `⏳` loader {} — comprobando devkitARM (SetupCheckModal) — hoy `IconLoader2`
- `↩` rotate-ccw {} — restablecer valor/slider/knob (SettingsModal, SoundTab) — hoy `IconArrowBack`
- `⚙` settings {} — ajustes (RecientesScreen, TodosProyectosScreen, SettingsModal) — hoy `IconSettingsFilled`

(✔ = ya aplicado: el SVG viejo se borró y quedó solo el wrapper de Tabler)
