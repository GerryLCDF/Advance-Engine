# 03 — Módulo Sprite (Editor de sprites y animaciones)

El editor **Sprite** permite importar hojas de sprites (*spritesheets*), configurar su segmentación mediante grillas horizontales y verticales, descartar celdas vacías mediante filtrado automático o manual, y construir secuencias de animación listas para utilizarlas directamente en los actores del módulo **Mundo**.

## 1. Importación y gestión de sprites

Los recursos gráficos pueden integrarse al proyecto de dos maneras:

- **Arrastrar y soltar (Drag & Drop):** arrastrando el archivo de imagen desde el explorador del sistema hacia el canvas de trabajo.
- **Botón Importar:** mediante la opción global **IMPORTAR** de la barra superior del editor.

En el panel lateral izquierdo (**Jerarquía**) se listan todas las hojas de sprites cargadas bajo la sección `SPRITES`. Al seleccionar un elemento se despliegan sus propiedades en el panel derecho (**Inspector**).

## 2. Inspector de sprite

| Campo | Tipo / Formato | Descripción |
| :--- | :--- | :--- |
| **Nombre** | Texto | Identificador único del spritesheet en el proyecto. |
| **Ruta** | Archivo local | Ubicación en disco del recurso original. |
| **Cargar imagen** | Botones (Seleccionar imagen / Quitar) | Permite sustituir o actualizar el archivo fuente, o desvincularlo. |
| **H frames** | Entero | Cantidad de divisiones horizontales (columnas). |
| **V frames** | Entero | Cantidad de divisiones verticales (filas). |
| **Tile size** | Ancho × Alto (px) | Tamaño resultante por celda, calculado a partir de la resolución total y los frames H×V. |
| **Frame** | Índice 0..N | Fotograma actualmente activo o enfocado en el inspector. |
| **Previsualización** | ⏮ / ▶ / ⏭ | Reproducción de la secuencia de cuadros en tiempo real. |

![CAPTURA: hoja de sprites importada con su grilla H×V frames → `assets/sprite-importado.png`]

## 3. Filtrado de cuadros vacíos (función *Skip*)

En muchas hojas de sprites existen celdas sin contenido que corresponden a espacios sobrantes. Para evitar que esos huecos vacíos entren en las animaciones o consuman memoria innecesaria, se usa la herramienta **Skip**:

1. **Apertura del visor:** al pulsar **Skip** en la esquina inferior derecha se abre el cuadro modal **“Saltar frames vacíos”**, con la matriz completa numerada en orden ascendente (índices base 0).
2. **Detección automática (Auto):** analiza píxel a píxel cada cuadro; si una celda no contiene color (completamente transparente o vacía), la marca en **rojo** como cuadro ignorado.
3. **Selección manual:** puedes hacer clic sobre cualquier fotograma para alternar su estado entre activo e ignorado (fondo rojo con borde activo).
4. **Sincronización con el timeline:** al cerrar la ventana modal (✕), los cuadros descartados quedan reflejados en rojo en la línea de tiempo inferior (`Frames (N)`), impidiendo su inserción errónea en secuencias posteriores.

![CAPTURA: modal “Saltar frames vacíos” con la matriz y frames ignorados en rojo → `assets/sprite-skip-frames.png`]

## 4. Creación y edición de animaciones

Debajo de la lista de spritesheets, en el árbol lateral, se encuentra la sección `ANIMACIONES`:

- **Crear animación (+):** añade un nuevo recurso de animación al que se le puede asignar un nombre representativo (Caminar_Abajo, Ataque, Idle…).
- **Asignación de frames:**
  - **Modo manual (1 a 1):** inserción secuencial fotograma por fotograma.
  - **Selector rápido por lote (+ en el timeline):** despliega el catálogo de **tiles disponibles**, que lista únicamente los sprites validados (excluyendo los marcados con *Skip*). Selecciona los fotogramas en el orden deseado y pulsa **OK**.
- **Gestión de la secuencia:** dentro de la tira de animación se pueden reordenar, eliminar o duplicar fotogramas para ajustar los tiempos de exposición.

### 4.1. Propiedades de reproducción de la animación

- **Modos de ciclo:**
  - **Loop:** se reinicia continuamente de forma indefinida.
  - **Once:** se ejecuta una sola vez y se detiene en el fotograma final.
  - **Ping-Pong:** avanza hasta el final y se reproduce en sentido inverso, repitiendo el ciclo.
- **Control temporal:** **Velocidad / FPS / Duración del frame (ms)**: tiempo de persistencia de cada cuadro. **Frame principal** y **frame final**: marcadores de entrada y salida del bucle.
- **Herramientas de visualización:**
  - **Papel cebolla (Onion Skin):** superpone con transparencia el fotograma anterior y posterior para verificar la fluidez del movimiento.
  - **Grid:** rejilla píxel a píxel sobre el visor para revisar alineación y puntos de pivote.

![CAPTURA: editor de animación con timeline, onion skin y modos de ciclo → `assets/sprite-animacion.png`]

## 5. Integración con el módulo Mundo

Las animaciones generadas quedan registradas globalmente en el proyecto. No requieren exportación adicional: al regresar a la pestaña **Mundo** y seleccionar un actor, el desplegable **Sprite > Animación** del inspector lista inmediatamente las secuencias creadas.

---

**Anterior:** [02 — Módulo Mundo](02-mundo.md) · **Siguiente:** [04 — Módulo Imagen](04-imagen.md)