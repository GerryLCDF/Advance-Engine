# 05 — Módulo Music (Chiptune Tracker & Sequencer)

El editor **Music** es una herramienta integrada de composición y secuenciación chiptune, orientada al hardware de audio PSG (*Programmable Sound Generator*) clásico retro. Permite crear temas musicales con dos interfaces intercambiables: un **Piano Roll** gráfico y una vista tradicional de **Tracker**.

## 1. Jerarquía lateral y canales

### 1.1. Lista de canciones (`SONGS`)
- Permite crear (+), renombrar y gestionar las canciones del proyecto.
- Muestra el nombre del tema activo y su velocidad en BPM.

### 1.2. Canales de hardware (`CHANNELS`)
El sistema emula la arquitectura de sonido PSG de 4 canales:

- **Pulse 1:** canal de pulso u onda cuadrada con soporte de barrido de frecuencia (*sweep*). Ideal para melodías principales.
- **Pulse 2:** segundo canal de pulso. Para contramelodías, armonías o acompañamiento.
- **Wave:** canal de onda personalizada programable por tabla de muestras. Predominante para líneas de bajo.
- **Noise:** generador de ruido pseudoaleatorio blanco/percusivo. Para efectos rítmicos (batería, platillos, golpes).

> **Controles rápidos por canal:**
> - **Visibilidad (ojo):** muestra u oculta las notas de ese canal en el lienzo.
> - **S (Solo):** silencia todos los demás canales.
> - **M (Mute):** enmudece el canal activo.

### 1.3. Biblioteca de instrumentos (`INSTRUMENTS`)
Catálogo de timbres sonoros agrupados por tipo de síntesis:

- **DUTY:** instrumentos basados en ciclo de trabajo de pulsos (12.5%, 25%, 50%, 75%).
- **WAVE:** formas de onda predefinidas para síntesis por tabla.
- **NOISE:** presets de percusión y efectos sonoros (White Noise, Snare, Hi-Hat, Metallic, Gritty 7-bit…).
- **SURDO / Personalizados:** bancos propios; permite crear instrumentos asignando color, nombre y propiedades físicas del oscilador.

## 2. Modos de edición y espacio de trabajo

La interfaz tiene dos modos de composición intercambiables (conmutador superior derecho):

- **PNO (Piano Roll):** representación visual con teclado de frecuencias cromáticas en el eje vertical y tiempo en el horizontal.
- **TRK (Tracker):** vista secuenciador vertical por pasos; cada columna es un canal (Pulse 1, Pulse 2, Wave, Noise) y muestra la nota junto al instrumento asignado.

### Controles de la barra superior de edición
- **Guardar (💾):** almacena los cambios en el archivo de audio.
- **Reproducir (▶) / Pausa / Stop (⏹):** transporte de la canción o patrón activo.
- **Lápiz:** dibuja notas o disparadores en el lienzo.
- **Selección / Cursor:** arrastra, mueve y reubica notas existentes.
- **Goma:** elimina notas individuales.
- **Selector de pasos (Steps):** longitud del compás/patrón activo (8, 16, 32 o 64 pasos).
- **Selector rápido de instrumento (Inst):** preset que se aplicará al pintar.
- **Canal activo:** indicador y selector del canal en el que se escribe.
- **Zoom / Escala (-, 2x, +):** escala visual de las celdas.

## 3. Secuenciación de patrones (`PATTERNS`)

En la barra inferior se gestiona la estructura compositiva del tema:

- **Línea de patrones:** encadena bloques musicales secuenciales (p. ej. `1: E35_`, `2: …`).
- Cada patrón almacena la combinación de notas de los cuatro canales para una cantidad definida de pasos.
- Durante la reproducción, los patrones se ejecutan en orden secuencial a lo largo de la línea temporal.
- **Panel rápido de canales inferior (CH):** muestra el estado de cada oscilador con accesos a Mute (M) y Solo (S).

![CAPTURA: vista PNO (piano roll) con notas → `assets/music-pianoroll.png`]
![CAPTURA: vista TRK (tracker) con los cuatro canales → `assets/music-tracker.png`]

## 4. Panel inspector

Las opciones del panel lateral derecho se adaptan al elemento seleccionado:

### 4.1. Propiedades de la canción (selección global)
- **Nombre:** título descriptivo de la pista.
- **Artista:** créditos de autoría o compositor.
- **Tempo:** control de perilla y valor numérico que define los BPM y la velocidad global de la secuencia.

### 4.2. Propiedades de instrumento / frecuencia (nota o preset)
- **Nombre e identificador de color:** etiqueta visual para distinguir notas e instrumentos.
- **LENGTH (Duración):** tiempo de decaimiento o sostenimiento de la nota.
- **VOL INICIAL (Volumen inicial):** ganancia del ataque al disparar la nota.
- **CHANGE (Envolvente):** gradiente de subida o bajada progresiva de volumen.
- **Octavas de prueba (C3…C8):** escucha previa del instrumento en distintas octavas.
- **Visor osciloscopio:** forma de onda generada en tiempo real.
- **Duty Cycle:** porcentaje del ciclo de onda cuadrada (12.5%, 25%, 50%, 75%).
- **Sweep Shift & Hz:** desplazamiento dinámico de tono (frecuencia de barrido en fracciones como 1/128 Hz), ideal para subida, caída o vibrato.

### 4.3. Propiedades de canal
- Información técnica del oscilador seleccionado: nombre (`Pulse 1`, `Pulse 2`, `Wave`, `Noise`), **volumen general** y **pan/panning** (izquierda / centro / derecha).

---

**Anterior:** [04 — Módulo Imagen](04-imagen.md) · **Siguiente:** [06 — Módulo Sound](06-sound.md)