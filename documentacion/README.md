# Advance Studio — Documentación

Bienvenido a la documentación de **Advance Studio**, el motor y editor de juegos para **Game Boy Advance**. Aquí encontrarás guías de uso, referencia de los editores y consejos para sacarle el máximo partido a la plataforma.

> **Estado:** versión alfa. Algunas secciones pueden evolucionar a medida que se agregan funcionalidades.

---

## Índice

| Sección | Contenido |
| :--- | :--- |
| [00 — Primeros pasos](00-inicio.md) | Primer arranque, instalación de devkitARM, crear/importar proyectos y personalización del cartucho. |
| [01 — Interfaz de la aplicación](01-interfaz.md) | Barra superior, opciones, menús de la aplicación y pestañas del editor. |
| [02 — Módulo Mundo](02-mundo.md) | Editor de escenas: lienzo, actores, colisiones, transiciones e inspector. |
| [03 — Módulo Sprite](03-sprite.md) | Hojas de sprites, filtrado de frames y creación de animaciones. |
| [04 — Módulo Imagen](04-imagen.md) | Fondos, capas con parallax y fondos animados. |
| [05 — Módulo Music](05-music.md) | Secuenciador chiptune con piano roll y tracker. |
| [06 — Módulo Sound](06-sound.md) | Efectos de sonido (SFX) y su integración con los actores. |
| [07 — Módulo Diálogo](07-dialogo.md) | Conversaciones, páginas de texto y vínculo con los NPCs. |
| [08 — Scripting](08-scripting.md) | Lógica y comportamiento: C Directo funcional; enlace a la guía completa de C. |
| [09 — Exportar y probar](09-exportar.md) | Jugar en el emulador integrado, exportar la ROM y límites de la plataforma GBA. |
| [10 — Programar en C para la GBA](10-programar-c-gba.md) | Guía de referencia completa: hardware, memoria, MODE 3, actores, colisiones, sonido, entrada y tu C Directo. |

---

## Checklist de capturas pendientes

La documentación contiene marcadores `![CAPTURA: …]` en los sitios donde hace falta una imagen. Toma las capturas indicadas y guárdalas en `assets/` con los nombres que sugiere cada marcador.

- [ ] **`editor-barra.png`** → barra superior del editor (tabs de módulos, IMPORTAR, EXPORT, PLAY).
- [ ] **`editor-consola.png`** → consola de depuración con salida de compilación.
- [ ] **`mundo-herramientas-colisiones.png`** → barra de colisiones con todos los tipos (sólida, semisólidas, escalera, rampas) y herramientas de trazado.
- [ ] **`mundo-menu-radial.png`** → menú radial inferior abierto.
- [ ] **`mundo-inspector-actor.png`** → inspector lateral de un actor con sus bloques.
- [ ] **`sprite-importado.png`** → hoja de sprites importada con su grilla H×V frames.
- [ ] **`sprite-skip-frames.png`** → modal “Saltar frames vacíos” con frames ignorados en rojo.
- [ ] **`sprite-animacion.png`** → editor de animación con timeline, onion skin y modos de ciclo.
- [ ] **`imagen-inspector-capa.png`** → inspector de capa con parallax X/Y y opción de animación.
- [ ] **`imagen-fondo-animado.png`** → barra inferior de fondo animado con la matriz y modos de reproducción.
- [ ] **`music-pianoroll.png`** → Módulo Music en vista PNO (piano roll).
- [ ] **`music-tracker.png`** → Módulo Music en vista TRK (tracker) con los cuatro canales.
- [ ] **`sound-editor.png`** → Módulo Sound con lista de SFX y forma de onda.
- [ ] **`dialogo-editor.png`** → Módulo Diálogo con un diálogo y sus páginas.
- [ ] **`emulador-play.png`** → emulador integrado ejecutando la ROM.
- [ ] **`exportar-rom.png`** → menú EXPORT desplegado con “Exportar ROM GBA”.

Cuando termines, renombra (o elimina) los marcadores en cada archivo.