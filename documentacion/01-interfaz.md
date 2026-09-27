# 01 — Interfaz de la aplicación

## 1.1. Barra de título

En la parte superior se muestra el logo y el nombre de la aplicación (**Advance Studio**), la versión en uso y los accesos a **Documentación**, **Créditos** y **Opciones**.

Desde aquí también se cierra la ventana con el botón ✕.

## 1.2. Menú de opciones

Opción | Estado | Descripción
:--- | :--- | :---
**Idioma** | Próximamente | Cambio de idioma de la interfaz.
**Aspecto** | Operativo | Abre el selector de tema visual.
**Escala** | Próximamente | Ajuste de la escala de la interfaz.

## 1.3. Pestañas del launcher

La barra inferior del lanzador agrupa las tres vistas principales:

- **Reciente:** proyectos abiertos recientemente.
- **Crear:** formulario de creación de proyectos.
- **Importar:** vinculación de proyectos existentes.

## 1.4. Editor de proyectos

Al abrir un proyecto se entra al **editor**, una pantalla a pantalla completa con:

### Menús de la aplicación (barra superior izquierda)
- **Archivo:** nuevo proyecto, abrir, guardar (Ctrl+S), guardar como, salir a la lista de proyectos, recargar o cerrar.
- **Edición:** deshacer (Ctrl+Z), rehacer (Ctrl+Y), cortar/copiar/pegar, eliminar (Del) y seleccionar todo (Ctrl+A).
- **Vista / Ejecución:** iniciar (Play), detener (Stop) y exportar ROM GBA.
- **Ventana / Ayuda:** accesos a los módulos, tema, idioma y visibilidad de colisiones/conexiones.

### Pestañas de los módulos (centradas)
El editor cuenta con las siguientes pestañas de módulo:

| Pestaña | Módulo |
| :--- | :--- |
| Mundo | Escenas, actores y colisiones. |
| Scripting | Lógica del juego (próximamente). |
| Sprite | Hojas de sprites y animaciones. |
| Imagen | Fondos y capas. |
| Music | Secuenciador chiptune. |
| Sound | Efectos de sonido. |
| Dialogo | Conversaciones y textos. |

En cada pestaña el nombre del proyecto aparece centrado en la parte superior, con un indicador `*` si hay cambios sin guardar. La pestaña activa se resalta con un borde superior de color de acento.

### Barra derecha del editor

- **IMPORTAR:** incorpora assets externos al proyecto (imágenes, sonidos, sprites, etc.).
- **EXPORT:** menú desplegable con las acciones de salida:
  - Guardar proyecto.
  - Exportar ROM GBA (compila y genera la ROM ejecutable, y abre la carpeta de build).
  - Exportar canciones, sprites, fondos y scripts.
  - Abrir la carpeta del proyecto.
- **PLAY:** compila el estado actual y lo ejecuta en el emulador integrado.
- **STOP:** detiene el emulador.

![CAPTURA: barra superior del editor con las pestañas de módulos, IMPORTAR, EXPORT y PLAY → `assets/editor-barra.png`]

## 1.5. Consola de depuración

En el panel inferior del editor se muestra la **consola de depuración**, donde se registran:
- Carga de proyectos y rutas de assets.
- Salida de compilación al ejecutar PLAY o exportar la ROM.
- Alertas de dependencias faltantes, rendimiento y código no utilizado para optimización de la ROM.

![CAPTURA: consola inferior con la salida de compilación → `assets/editor-consola.png`]

---

**Siguiente:** [02 — Módulo Mundo](02-mundo.md)