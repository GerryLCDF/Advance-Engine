# 06 — Módulo Sound (Efectos de sonido)

El editor **Sound** permite gestionar los efectos de sonido (SFX) del proyecto, reproducirlos para previsualizarlos en tiempo real y configurar cómo se sintetizan para el hardware de audio del GBA.

## 1. Lista de sonidos (`SOUNDS`)

En la jerarquía lateral izquierda se listan todos los efectos del proyecto:

- **Crear (+):** añade un nuevo sonido rellenado con un preset por defecto.
- Cada elemento muestra su **nombre**, su archivo de origen (si tiene) o su duración en segundos (si es sintetizado), e el icono de su tipo (`Pulse`, `Wave` o `Noise`).

## 2. Inspector de sonido

### 2.1. Ajustes

- **Nombre:** identificador del efecto.
- **Uso:** **SFX** (efecto puntual) o **Música** (tema de fondo). Determina cómo se integra en el editor y en la exportación.
- **Archivo:** permite cargar un **WAV/MP3** mediante `+ Cargar WAV/MP3` (botón con borde discontinuo), o desvincularlo (✕) para volver a la síntesis.
- **Volumen:** nivel del master en porcentaje (0-100%).
- **Pitch:** afinación relativa, en semitonos (-12 a +12).
- **Speed:** velocidad de reproducción (0.25x a 4x).
- **Delay:** retardo inicial del disparo (0-2 s).
- **Ataque (Attack):** tiempo de subida del volumen (0-1 s).
- **Release:** tiempo de caída del volumen (0-2 s).
- **Forma de onda:** previsualización en canvas del audio (sintetizado o importado) con controles de reproducción.

### 2.2. Exportación GBA

Configura cómo el efecto se traduce al chip de sonido:

- **Tipo de canal:** **Pulse**, **Wave** o **Noise** (define el oscilador PSG que lo reproducirá).
- **Frecuencia / Nota:** tono base del efecto.

![CAPTURA: editor de sonido con la lista de SFX y la forma de onda → `assets/sound-editor.png`]

## 3. Integración con los actores

Una vez creado, el sonido queda disponible en el inspector de cualquier actor del módulo **Mundo**, en el bloque **Audio > Sonido**, para que se dispare ante eventos de colisión, disparadores o acciones del jugador.

---

**Anterior:** [05 — Módulo Music](05-music.md) · **Siguiente:** [07 — Módulo Diálogo](07-dialogo.md)