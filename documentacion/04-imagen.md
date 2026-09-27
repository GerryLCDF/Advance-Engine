# 04 — Módulo Imagen (Fondos y capas)

El editor **Imagen** está enfocado en la gestión, optimización y configuración de los fondos y capas visuales del proyecto. Su diseño está orientado al ahorro de recursos de memoria (VRAM/ROM), tanto para la compilación en hardware destino (Game Boy Advance) como para el flujo de trabajo del desarrollador.

## 1. Métodos de importación

Los archivos de imagen (fondos estáticos, panoramas o secuencias de capas) pueden integrarse de dos maneras:

- **Arrastrar y soltar (Drag & Drop):** arrastrando el archivo desde el explorador del sistema hacia el canvas central.
- **Botón IMPORTAR:** mediante la opción global de la barra de herramientas superior.

Las imágenes importadas se listan en el árbol lateral izquierdo (`IMÁGENES`). Al seleccionar una, el canvas muestra la previsualización y el inspector habilita sus propiedades de capa.

## 2. Inspector de capa (propiedades del fondo)

| Parámetro | Tipo / Control | Descripción |
| :--- | :--- | :--- |
| **Visible** | Checkbox | Determina si la capa se renderiza o se oculta en el visor y en el juego. |
| **Parallax X** | Entero | Factor de desplazamiento horizontal respecto a la cámara. Permite generar sensación de profundidad. |
| **Parallax Y** | Entero | Factor de desplazamiento vertical respecto a la cámara. |
| **Velocidad** | Entero | Velocidad base a la que se traslada el parallax continuo o sincronizado. |
| **Ruta** | Texto | Ruta de almacenamiento local del recurso original en disco. |
| **Reescalar** | Checkbox | Convierte y ajusta automáticamente dimensiones mayores a la resolución nativa del GBA (240×160 px). Útil para pruebas rápidas o efectos visuales específicos. |
| **Resolución** | Texto informativo | Dimensiones nativas de la imagen importada (p. ej. 240×160 px, 480×640 px…). |
| **Animación** | Checkbox | Habilita el modo de fondo animado cuando la imagen es un múltiplo de la resolución base (varios frames integrados en una sola textura). |
| **Vel. animación** | Entero | Sincronizado con la barra inferior; define la cadencia de cambio entre fotogramas del fondo. |

![CAPTURA: inspector de capa con parallax X/Y, velocidad y opción de animación → `assets/imagen-inspector-capa.png`]

## 3. Fondos animados y barra de control inferior

Cuando una imagen supera las dimensiones estándar en múltiplos enteros (duplicando o triplicando el tamaño para alojar varios cuadros de animación, por ejemplo 2×4 frames), se activa la opción de **Animación**.

Al marcar la casilla **Animación** se despliega una barra contextual en la parte inferior del editor:

- **Indicador de matriz:** muestra el cálculo de fotogramas detectados (p. ej. `Animación (2x4 frames)`).
- **Slider de velocidad:** control deslizante interactivo con valor numérico para acelerar o desacelerar el ciclo de cuadros.
- **Modos de reproducción:**
  - **Repetición (bucle continuo):** ciclo secuencial indefinido, con reinicio automático.
  - **Una vez:** reproduce la secuencia una sola vez y se detiene en el último cuadro.
  - **Ping-pong:** recorre los cuadros hacia adelante y luego en reversa.
  - **Aleatorio:** selección no lineal / random, ideal para efectos de centelleo, agua o ruido ambiental.

![CAPTURA: barra inferior de fondo animado con la matriz (p. ej. 2×4 frames) y modos de reproducción → `assets/imagen-fondo-animado.png`]

## 4. Uso en escenas

- **Integración con el Módulo Mundo:** una vez configurada la imagen y sus parámetros de parallax/animación, queda disponible de inmediato en el inspector de cualquier escena del módulo **Mundo** bajo el selector **Imagen de fondo**.

*(Funcionalidad planificada:* editor de tilesets integrado que permita pintar y ensamblar fondos directamente desde spritesheets dentro del motor, sin herramientas externas de dibujo.*)*

---

**Anterior:** [03 — Módulo Sprite](03-sprite.md) · **Siguiente:** [05 — Módulo Music](05-music.md)