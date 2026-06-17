# Inventario de iconos del editor

Aca voy llevando registro de todos los iconos que tiene el editor.
Cuando los vaya reemplazando por SVGs personalizados o Lucide, los marco.
**Mientras no tenga los iconos personalizados, uso emojis/Unicode como temporales.**

https://tabler.io/icons

La libreria que pienso usar es `lucide-react` (instalar con `npm install lucide-react`).
Tamaño: `size={14}`, `strokeWidth={1.5}` para que se vea consistente con MusicTab.

## Como nombrar los archivos

Pon el SVG en la carpeta `icons/` con el nombre que aparece en **`<nombre>.svg`**.
Puedes hacerlos en cualquier orden, yo los voy integrando cuando los vea.

---

## MundoTab

- [x] `move.svg` — ✥ Mano o flechas cruzadas (4 direcciones) para mover/arrastrar escenas
- [x] `plus.svg` — + Signo + para agregar escena nueva
- [x] `minus.svg` — - Signo - para eliminar escena seleccionada
- [x] `link2.svg` — 🔗 Dos circulos unidos por una linea (conexion entre escenas)
- [x] `arrow-right.svg` — → Flecha hacia la derecha (se muestra mientras conectas escenas).
- [x] `grid3x3.svg` — ▦ Grid/cuadricula 4x4 para pintar colisiones
- [x] `grid2x2.svg` — # Grid/cuadricula 2x2 para mostrar/ocultar el grid
- [x] `more-vertical.svg` — ⋮ Tres puntos verticales para menu de tamaño del grid
- [x] `paint-bucket.svg` — ▤ Cubeta de pintura para relleno (proximamente)
- [x] `wand.svg` — ⌾ Varita magica para seleccion (proximamente)
- [x] `pencil.svg` — ✎ Lapiz para dibujar tiles de colision. Nota: tu SVG era filled (edit), lo converti a outline.
- [x] `square.svg` — ▢ Cuadrado con esquinas redondeadas para dibujar rectangulos
- [x] `globe.svg` — 🌍 Puse un globo generico de mi parte porque el SVG que pusiste era un iMac. Si quieres cambiar el globo por otro diseño, solo reemplaza el archivo.
- [x] `home.svg` — 🏠 Casita para el icono de SplashScreen en la jerarquia. Nota: tu SVG era filled, lo converti a outline para consistencia.
- [ ] Triangulos de rampas — SVG inline (pendiente)

## MusicTab

- [x] `save.svg` — Disquete para guardar la cancion
- [x] `play.svg` — ▶ Triangulo hacia la derecha para reproducir
- [x] `stop.svg` — ■ Cuadrado para detener
- [x] `pencil2.svg` — ✎ Lapiz para modo dibujo (editar notas), filled (Tabler pencil)
- [x] `mouse-pointer.svg` — Flecha de cursor para modo seleccion
- [x] `eraser.svg` — Goma/borrador para borrar notas
- [x] `music.svg` — 🎵 Nota musical para el icono de cancion en jerarquia
- [x] `activity.svg` — ◻ Linea de pulso/cardiaco para canal Pulse
- [x] `wave.svg` — 〰 Onda sinusoidal para canal Wave
- [ ] `volume.svg` — (actualmente es wave-sine, necesito un SVG de onda de ruido/estatica para canal Noise) ← REEMPLAZAR
- [x] `noise.svg` — Onda de ruido/estatica para canal Noise (inline por ahora, reemplazar cuando tengas el SVG)

## SpriteTab

- [ ] `skip-back.svg` — ⏮ Triangulo izquierdo + barra vertical para frame anterior
- [ ] `play.svg` — ▶ Triangulo derecha para reproducir animacion
- [ ] `pause.svg` — ⏸ Dos barras verticales para pausar
- [ ] `skip-forward.svg` — ⏭ Triangulo derecho + barra vertical para frame siguiente
- [ ] `onion-skin.svg` — (SVG propio) Tres cuadros concentricos (papel cebolla)
- [ ] `grid.svg` — (SVG propio) Cuadricula para mostrar/ocultar el grid
- [ ] `pencil.svg` — ✎ Lapiz para renombrar
- [ ] `trash.svg` — 🗑 Bote de basura para eliminar
- [ ] `palette.svg` — 🎨 Paleta de pintor para icono de Sprite en jerarquia
- [ ] `fast-forward.svg` — ▶▶ Dos triangulos a la derecha para animaciones en jerarquia
- [ ] `zoom-out.svg` — − Lupa con signo - para alejar
- [ ] `zoom-in.svg` — + Lupa con signo + para acercar
- [ ] `x.svg` — ✕ Equis para cerrar/eliminar
- [ ] `check.svg` — ✓ Palomita para indicar tile seleccionado

## ImagenTab

- [ ] `zoom-out.svg` — − Lupa con signo - para alejar
- [ ] `zoom-in.svg` — + Lupa con signo + para acercar
- [x] `eye.svg` — 👁 Ojo para capa visible
- [x] `eye-off.svg` — 👁‍🗨 Ojo tachado para capa oculta
- [ ] `image.svg` — 🖼 Cuadro con paisaje para estado vacio

## DialogoTab

- [ ] `message-square.svg` — 💬 Burbuja de texto para item de dialogo
- [ ] `file-text.svg` — 📄 Hoja con texto para pagina de dialogo
- [ ] `x.svg` — ✕ Equis para quitar opcion
- [ ] `plus.svg` — + Signo + para agregar opcion

## EditorTopBar

- [ ] `minus.svg` — ─ Signo - para minimizar ventana
- [ ] `maximize.svg` — □ Cuadrado para maximizar ventana
- [ ] `x.svg` — ✕ Equis para cerrar ventana
- [ ] `play.svg` + texto PLAY — ▶ Triangulo para iniciar emulador
- [ ] `square.svg` + texto STOP — ■ Cuadrado para detener emulador

## ComingSoonTab

- [ ] `construction.svg` — 🚧 Casco/llave inglesa para pestana proximamente

## App (icono de la aplicacion)

- [ ] Cambiar el icono `.ico` / `.png` de la app (actualmente el default de Electron)
