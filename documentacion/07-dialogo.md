# 07 — Módulo Diálogo (Conversaciones y textos)

El editor **Diálogo** permite crear conversaciones con ramificación, páginas de texto y el vínculo con los NPCs y actores interactivos del mundo. Cada diálogo se organiza en **páginas** y puede tener **opciones** que derivan en otras páginas.

## 1. Jerarquía lateral

En el árbol lateral se listan los **diálogos** del proyecto. Al seleccionar uno, el inspector permite configurar sus propiedades.

Cada diálogo muestra una pequeña previsualización de su primera página de texto y, si está vinculado a una escena, el nombre de esa escena.

## 2. Inspector de diálogo

### Propiedades del diálogo
- **Nombre:** identificador del diálogo.
- **Escena:** escena del módulo **Mundo** a la que está vinculado (o “(sin vínculo)”).

### Páginas
Cada página contiene:
- **Texto:** contenido de la página (área de texto multilínea). El previsualizador de la jerarquía muestra el principio.
- **Opciones:** respuestas que el jugador puede elegir; cada opción apunta a otra página y permite ramificar la conversación.

## 3. Flujo de trabajo típico

1. Crea un diálogo y asígnale un nombre.
2. Vincula la **Escena** donde aparecerá el NPC.
3. Escribe el **Texto** de la primera página.
4. Añade **Opciones** para ramificar hacia otras páginas (un enlace a tantas opciones por página como respuestas quieras).
5. En el módulo **Mundo**, selecciona el actor que hablará y asígnale el diálogo en el bloque **Script / Diálogo**.

![CAPTURA: diálogo abierto con sus páginas y opciones → `assets/dialogo-editor.png`]

---

**Anterior:** [06 — Módulo Sound](06-sound.md) · **Siguiente:** [08 — Scripting](08-scripting.md)