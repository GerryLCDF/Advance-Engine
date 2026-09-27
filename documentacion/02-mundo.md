# 02 — Módulo Mundo (Editor de escenas)

El editor **Mundo** constituye el entorno central para la maquetación espacial, jerarquía de niveles y flujo de navegación del juego. Desde este panel se distribuyen las escenas, se gestionan los actores (estáticos o dinámicos), se definen máscaras de colisión precisas y se trazan las transiciones entre pantallas.

## 1. Barra de herramientas superior

### 1.1. Herramientas de edición y maquetado (izquierda)

- **Navegación / Selección:** permite seleccionar, arrastrar e inspeccionar entidades dentro del canvas.
- **Agregar Escena (+):** activa el modo de creación de escena. Al pulsar este botón y hacer clic en cualquier área libre del lienzo, se instancia una nueva escena en esa coordenada.
- **Agregar Actor:** genera un nuevo actor situado en el centro de la escena actualmente seleccionada.
- **Vincular Escenas (Link):** permite trazar transiciones entre escenas mediante líneas visuales punteadas con codificación por color:
  - **Naranja:** transición unidireccional de la escena **A** hacia la escena **B**.
  - **Azul:** transición unidireccional de la escena **B** hacia la escena **A**.
- **Colisiones:** abre la paleta contextual flotante para pintar o delimitar máscaras de impacto.
- **Alternar Cuadrícula (Grid):** activa o desactiva la visualización de la cuadrícula en píxeles.
- **Configuración de Grid (⋮):** selector del tamaño de celda. Permite definir pasos de 1×1, 2×2, 4×4, 8×8, 16×16, 32×32 o 64×64 píxeles.

### 1.2. Operaciones globales y ejecución (derecha)

- **IMPORTAR:** permite cargar al proyecto assets externos como scripts, escenas completas, hojas de sprites, audio o pistas MIDI.
- **EXPORTAR:** permite extraer recursos individuales (útil si se perdió el asset de origen) o compilar y generar la **ROM** ejecutable final.
- **PLAY:** inicia el emulador interno. Compila el estado actual y lo ejecuta embebido para pruebas directas.
- **STOP:** finaliza la ejecución del emulador.

## 2. Menú radial inferior (acceso rápido)

Ubicado en la esquina inferior izquierda, este menú radial replica las herramientas clave de inserción:

- **Nueva escena:** instancia automáticamente una nueva escena en el centro visual de la cámara.
- **Nuevo actor:** agrega un actor en el centro de la escena activa.
- **Vincular:** habilita el modo de interconexión lógica entre escenas.
- **Colisiones:** despliega la barra contextual de pintura de colisiones.

![CAPTURA: menú radial inferior abierto → `assets/mundo-menu-radial.png`]

## 3. Sistema de colisiones

Al activar la herramienta de colisiones se abre una barra de acción con dos bloques: herramientas de trazado y modos de colisión.

### 3.1. Modos de trazado

- **Bote de pintura:** rellena áreas contiguas con la colisión seleccionada.
- **Varita mágica:** selecciona y asigna colisión según contornos continuos.
- **Lápiz:** asignación celda por celda según la resolución de la cuadrícula.
- **Rectángulo:** trazado de áreas rectangulares de colisión rápida.

### 3.2. Tipos de superficie y comportamiento

- **Colisión sólida (roja):** bloqueo total en los cuatro ejes cardinales.
- **Semisólidas unidireccionales:** bloquean en un sentido y permiten el traspaso en el opuesto (disponibles en los cuatro sentidos; estándar para plataformas que se pueden atravesar desde el salto inferior).
- **Escaleras (verde):** diseñadas para mecánicas de ascenso/descenso vertical en juegos de plataformas.
- **Rampas / pendientes:** permiten unir dos vértices de la cuadrícula con el grado de inclinación deseado (no solo ángulos de 45°, en las cuatro direcciones).

![CAPTURA: barra de colisiones con todos los tipos y herramientas → `assets/mundo-herramientas-colisiones.png`]

## 4. Lienzo, escenas y presupuesto de rendimiento

- **SplashScreen:** escena obligatoria de arranque que no puede suprimirse. En ella se define la imagen estática inicial y la pista musical de introducción.
- **Escenas de juego:** admiten personalización de nombre, resolución de lienzo (ancho × alto), imagen de fondo y pista musical.

### Límites de cámara y rendimiento del hardware

La cámara puede desplazarse y redimensionarse según la extensión del nivel. El dibujo de la escena ocurre dentro del **intervalo de VBLANK** del GBA (~83.800 ciclos por frame), por lo que el factor que limita el rendimiento son los **píxeles de sprite visibles en pantalla**, no el número de actores:

- Presupuesto real: **~5.600 px de sprite en cámara** por frame.
- Ejemplos: **5-6 actores de 21×31 px**, o bien **1 actor de 64×64 px + 2 actores de 16×16 px**.
- Los actores **fuera de cámara apenas gastan tiempo**: solo se paga el recorte del rectángulo y la actualización de sus timers. Puedes colocar todos los actores que necesites en la escena; solo cuentan los que la cámara enfoca en ese momento.
- Un actor parcialmente fuera de pantalla solo paga la parte visible de su rectángulo.

*(Cargar más píxeles de sprite dentro del encuadre activo provocará ralentización de las animaciones y caída de fotogramas en hardware real.)*

## 5. Inspector lateral (propiedades del actor y contexto)

Al seleccionar un actor en escena, el panel lateral derecho desglosa sus atributos editables:

| Bloque | Parámetros | Propósito |
| :--- | :--- | :--- |
| **Actor** | Nombre, Comportamiento, Posición X, Posición Y, Capa Z, Ancho, Alto | Define el ID, su clase lógica (Estático, Interactivo / NPC, Objeto simple), coordenadas en píxeles, plano de profundidad y escala. |
| **Sprite** | Spritesheet, Animación | Enlaza la hoja de sprites y la animación que se reproducirá por defecto al iniciar el nivel. |
| **Colisión** | Collider (booleano), Ancho del collider, Alto del collider | Activa la caja de impacto y permite desligar su tamaño respecto al tamaño visual del sprite. |
| **Audio** | Sonido, Música | Enlaza efectos de audio (SFX) o temas específicos detonados por el actor. |
| **Script / Diálogo** | Script, Diálogo | Vincula rutinas de código o tablas de texto conversacional. |
| **Escena** | Nombre, Ancho (px), Alto (px), Imagen de fondo, Canción de fondo | Contexto de la escena contenedora; permite reajustar metadatos y assets del nivel sin deseleccionar la entidad. |

![CAPTURA: inspector lateral de un actor con sus bloques → `assets/mundo-inspector-actor.png`]

## 6. Transiciones entre escenas

Al **vincular dos escenas** se puede configurar la transición de entrada y salida:

- **Instantánea:** cambio de pantalla sin transición.
- **Fundido (fade):** fundido a negro o desde negro.
- **Tileset personalizado:** cada bloque de 8×8 de la pantalla reproduce un tileset de animación como máscara píxel a píxel (blanco revela la escena, negro la oculta). El tiempo total se ajusta con la velocidad en el inspector.

---

**Anterior:** [01 — Interfaz de la aplicación](01-interfaz.md) · **Siguiente:** [03 — Módulo Sprite](03-sprite.md)