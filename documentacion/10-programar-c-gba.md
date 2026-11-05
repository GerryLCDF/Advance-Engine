# 10 — Programar en C para la Game Boy Advance

> **Aplica a:** el código **C Directo** que escribes en el módulo Sin embargo, se inserta *verbatim* en el `main.c` que genera Advance Engine antes del `main()`. Todo lo explicado aquí vale para ese código, y al mismo tiempo es una referencia completa del hardware y del template que produce el motor.
>
> **Prerrequisito:** contar con **devkitARM** instalado (ver [00 — Primeros pasos](00-inicio.md)). El pipeline genera `main.c` + `Makefile` y compila con `arm-none-eabi-gcc` + `libgba`.

---

## Índice

1. [Conceptos básicos del hardware GBA](#101-conceptos-básicos-del-hardware-gba)
2. [Mapa de memoria](#102-mapa-de-memoria)
3. [Registros de entrada/salida (I/O)](#103-registros-de-entradasalida-io)
4. [Video: el motivo por el que el motor usa MODE 3](#104-video-el-motivo-por-el-que-el-motor-usa-mode-3)
5. [Tiempo, scanlines y VBLANK (el presupuesto sagrado)](#105-tiempo-scanlines-y-vblank-el-presupuesto-sagrado)
6. [Estructura del `main.c` generado](#106-estructura-del-mainc-generado)
7. [Tipos y convenciones del código generado](#107-tipos-y-convenciones-del-código-generado)
8. [Sistema de actores (las entidades del juego)](#108-sistema-de-actores-las-entidades-del-juego)
9. [Entrada: leer los botones](#109-entrada-leer-los-botones)
10. [Movimiento y colisiones](#1010-movimiento-y-colisiones) — incluye las primitivas `movePlatformer` / `moveTopDown`
11. [Sonido: la APU del GBA](#1011-sonido-la-apu-del-gba)
12. [Frames, vsyncs y animación](#1012-frames-vsyncs-y-animación)
13. [El C Directo de tus scripts: contrato y API](#1013-el-c-directo-de-tus-scripts-contrato-y-api)
14. [Ejemplos de scripts listos para copiar](#1014-ejemplos-de-scripts-listos-para-copiar)
15. [Varias escenas en la ROM: `switchScene`, `near` y `gJp`](#1015-varias-escenas-en-la-rom-switchscene-near-y-gjp)
16. [Optimización y reglas de oro](#1016-optimización-y-reglas-de-oro)
17. [Depuración en la consola real vs. emuladores](#1017-depuración-en-la-consola-real-vs-emuladores)
18. [Referencia rápida (cheat-sheet)](#1018-referencia-rápida-cheat-sheet)
19. [Glosario](#1019-glosario)

---

## 10.1. Conceptos básicos del hardware GBA

### El SoC y su CPU

La GBA es una consola portátil de Nintendo lanzada en 2001. Su corazón es un **ARM7TDMI**:

| Propiedad | Valor |
| :--- | :--- |
| Arquitectura | ARM7TDMI (RISC de 32 bits) |
| Modos de instrucción | **ARM** (32 bits, 4 bytes) y **THUMB** (16 bits, 2 bytes) |
| Reloj de CPU | 16.78 MHz (misma velocidad del bus) |
| Frecuencia de fotograma | ~59.73 fps (280.896 ciclos por frame) |
| Rendimiento típico | ~16,8 MIPS (Thumb) / más con ARM |
| Revisión | Numerosa; la mayoría de ROMs corren en cualquiera |

La CPU tiene además un repertorio pequeño: registros R0-R15, CPSR/SPSR. No hay FPU: **todo punto flotante lo tienes que evitar** (ver [16](#1016-optimización-y-reglas-de-oro)).

La placa se divide conceptualmente en:

- **CPU (ARM7TDMI)**
- **PPU de video** (modos 0-5, sin sprite hardware en MODE 3)
- **APU de sonido** (4 canales: 2 pulse, 1 wave, 1 ruido)
- **BIOS** (bloquea algunos servicios; no modificable)

Para nosotros (render por software) la CPU **dibuja cada píxel ella misma**, escribiendo directamente en VRAM. De ahí nace el *presupuesto de VBLANK* (sección 5).

---

## 10.2. Mapa de memoria

El GBA expone 32 MB de direcciones. Las regiones que nos importan:

| Región | Rango | Tamaño | Uso típico | Velocidad |
| :--- | :--- | :--- | :--- | :--- |
| **BIOS** | `0x00000000` | 16 KB | Sistemas del sistema (no copiar/leer) | 1 ciclo |
| **EWRAM** | `0x02000000` | 256 KB | Datos grandes, buffers, tu `gActorBack` | 2 est. (lenta) |
| **IWRAM** | `0x03000000` | 32 KB | Stack, variables calientes | 1 ciclo (rápida) |
| **I/O** | `0x04000000` | 1 KB | Registros de video, sonido, entrada | — |
| **Paleta** | `0x05000000` | 1 KB | Paleta 256×2 (no usado en MODE 3 directo) | — |
| **VRAM** | `0x06000000` | 96 KB | Framebuffer / tiles / sprites | 1 est. |
| **OAM** | `0x07000000` | 1 KB | Sprites hardware (no usados por el motor) | — |
| **ROM (PAK)** | `0x08000000` | ≤ 32 MB | Código + datos constantes | 2-4 est. |

**Lecturas clave:**

1. **VRAM en MODE 3** son 96 KB: el framebuffer de 240×160×2 bytes ocupa 76.800 B (75 KB). El píxel de la esquina `(x, y)` vive en `((u16*)0x06000000)[y*240 + x]`. El template lo hace con `u16* screen = (u16*)VRAM;` y `screen[pos]`.
2. **EWRAM es lenta** (2 estados de espera). El motor mete ahí `gActorBack` porque 240×160 no cabe cómodo y es solo lectura por píxel durante el render.
3. **IWRAM es lo más rápido** para variables; el compilador `-O2` ya coloca el stack ahí vía `gba.specs`. No declares arrays enormes locales: el stack es pequeño.
4. **ROM es de solo lectura** y los datos `static const` quedan ahí. Cómodo para tablas grandes (frames de sprites, tabla de periodos, escenas).

> En un proyecto Advance Engine todo lo anterior ya está bien repartido por el template. Cuando *tú* escribas C Directo intenta respetar esta jerarquía: tablas en `const` (ROM), buffers grandes `static` (EWRAM), variables de trabajo locales (IWRAM).

---

## 10.3. Registros de entrada/salida (I/O)

Los registros se direccionan como punteros con `volatile`. El `#include <gba.h>` de libgba ya define la mayoría; el template define los que necesita por seguridad con macros propias:

| Registro | Dirección | Acceso | Qué es |
| :--- | :--- | :--- | :--- |
| `REG_DISPCNT` | `0x04000000` | RW | Control de la pantalla (modo + layers) |
| `REG_VCOUNT` | `0x04000006` | R | Scanline actual (0-227) |
| `REG_KEYINPUT` | `0x04000130` | R | Estado de los botones (**0 = pulsado**) |
| `REG_SND1SWEEP` | `0x04000060` | RW | Canal 1: barrido de frecuencia |
| `REG_SND1CNT` | `0x04000062` | RW | Canal 1: duty + envolvente |
| `REG_SND1FREQ` | `0x04000064` | RW | Canal 1: periodo + key on |
| `REG_SND2CNT` | `0x04000068` | RW | Canal 2: duty + envolvente |
| `REG_SND2FREQ` | `0x0400006C` | RW | Canal 2: periodo + key on |
| `REG_SND3CNT_L` | `0x04000070` | RW | Canal 3 (wave): control |
| `REG_SND3CNT_H` | `0x04000072` | RW | Canal 3 (wave): control alto |
| `REG_SND3FREQ` | `0x04000074` | RW | Canal 3 (wave): periodo + key on |
| `REG_SND4CNT` | `0x04000078` | RW | Canal 4 (ruido): envolvente |
| `REG_SND4FREQ` | `0x0400007C` | RW | Canal 4 (ruido): ratio + key on |
| `REG_SNDCTL` | `0x04000080` | RW | Control general (volúmenes, enable) |
| `REG_SNDCNTH` | `0x04000082` | RW | Enable/atención del canal |
| `REG_SNDCNTX` | `0x04000084` | RW | Volumen del canal |
| `REG_SNDBIAS` | `0x04000088` | RW | Bias PWM (sesgo del DAC) |
| Wave RAM | `0x04000090` | RW | 16 muestras de 4 bits del canal 3 |

El template genera estas definiciones útiles en casi todos los main.c:

```c
#define REG_SND1SWEEP *(vu16*)(0x04000060)
#define REG_SND2CNT   *(vu16*)(0x04000068)
// ... y así con todos los de sonido
```

**Regla de oro de los registros:** acceder siempre a través de punteros `volatile`. Libgba los llama `REG_*/IO_*`; el template usa `REG_DISPCNT`, `REG_VCOUNT`, `REG_KEYINPUT`.

---

## 10.4. Video: el motivo por el que el motor usa MODE 3

El GBA tiene 6 modos de video:

| Modo | Tipo | Pantalla |
| :--- | :--- | :--- |
| 0 | Tiles 4 BG, todo por carácter | 4 planos |
| 1 | Tiles + 1 rotación/escala | — |
| 2 | Tiles rotación/escala | 2 BG |
| **3** | **Bitmap 240×160, 16-bit por píxel** | **1 framebuffer** |
| 4 | Bitmap 240×160, 8-bit + paleta | 1-2 framebuffers |
| 5 | Bitmap 160×128, 16-bit | 1-2 framebuffers |

**Advance Engine usa MODE 3**: el más sencillo para un render por software. `main()` hace:

```c
REG_DISPCNT = MODE_3 | BG2_ENABLE;
u16* screen = (u16*)VRAM;
```

- Cada píxel es un `u16` (2 bytes) en **formato RGB555**.
- BG2_ENABLE (bit 10 = 0x400) activa el plano sobre el que se dibuja.
- No hay sprites hardware en modo bitmap: **los actores del motor los dibuja la CPU** (ver sección 8).

### El formato de píxel RGB555

```
15 14 13 12 11 10 9 8 7 6 5 4 3 2 1 0
 x  B  B  B  B  B G G G G G R R R R R
    x  ·          bits del color         ·
```

- Rojo (5 bits), verde (5), azul (5) = **32 niveles por canal** → 32.768 colores posibles.
- El bit 15 no se usa en MODE 3 (el template lo reserva para marcadores internos del sprite: **bit15 = 1 significa píxel transparente** en los frames de los actores).

Para convertir un color CSS/RGB (0-255) al valor GBA usa la misma fórmula que el motor:

```c
#define RGB555(r, g, b) ((((r) >> 3) | (((g) >> 3) << 5) | (((b) >> 3) << 10)) & 0x7FFF)
```

Ejemplo: `RGB555(255, 0, 0)` → `0x7C00` (rojo puro), `RGB555(0,0,255)` → `0x001F` (azul puro), blanco → `0x7FFF`.

### Escribir un píxel / rellenar la pantalla

```c
// Un píxel
screen[y * 240 + x] = RGB555(255, 255, 255);

// Barrer toda la pantalla (patrón que usa el motor para fondos)
for (i = 0; i < PIXEL_COUNT; i++) screen[i] = color;
// con PIXEL_COUNT = 240*160 = 38400
```

> **No escribas VRAM fuera del VBLANK** si puedes evitarlo: verás artefactos ("tearing"). El motor dibuja la escena dentro de `waitVSync()`. Los scripts que muestran texto propio deberían hacer lo mismo.

---

## 10.5. Tiempo, scanlines y VBLANK (el presupuesto sagrado)

### Cronometraje real de la consola

- El LCD dibuja **228 líneas por frame**: 160 visibles + 68 de blanking.
- Cada línea dura **1232 ciclos** de CPU.
- Frame total = 228 × 1232 = **280.896 ciclos** → **59,73 fps**.
- El intervalo donde la pantalla no barre (VBLANK) = 68 × 1232 = **~83.800 ciclos**.

```c
static void waitVSync(void) {
  while (REG_VCOUNT >= SCREEN_H);   // esperar a que deje la zona visible
  while (REG_VCOUNT < SCREEN_H);    // y que entre en la zona de blanking
}
```

El template llama `waitVSync()` en cada vuelta del bucle de juego. Entre un `waitVSync()` y el siguiente **puedes hacer ~83.800 ciclos de trabajo sin perder el frame**.

### La regla del presupuesto

Si tu frame hace más trabajo del que cabe en VBLANK:

1. El frame siguiente se come; el game loop **baja a ~30 fps** (o peor).
2. Las animaciones (retardadas en vsyncs) se ralentizan.
3. En consola real verás *parpadeos* en la zona inferior donde el LCD ya pilló el rect del último actor.

El motor está optimizado para que esto no pase (ver [16](#1016-optimización-y-reglas-de-oro)):

- El render de actores cuesta **~15 ciclos por píxel opaco** (dibujado y borrado en una sola pasada).
- Regla práctica: **~5.600 px de sprite en cámara por frame** caben holgados.
- Los actores fuera de cámara apenas cuestan (clamp del rect → 0 trabajo por píxel).

**Tus scripts deben ser ligeros:** unas decenas de operaciones por actor por frame son irrelevantes; bucles anidados de miles de iteraciones dentro del VBLANK romperán el ritmo.

---

## 10.6. Estructura del `main.c` generado

Un `main.c` de Advance Engine sigue este orden (parcial dependiendo del proyecto):

```
1.  Encabezado (nombre, autor, fecha)
2.  #include <gba.h> y <string.h>
3.  SCREEN_W, SCREEN_H, PIXEL_COUNT, waitVSync()
4.  Prototipos de actores (si hay actores + transición)
5.  Fade transitions (si se usan fades)
6.  Splash screen (si lo hay)
7.  Escena (sceneData / SCENE_COLOR)
8.  Mapa de colisiones (si hay)
9.  Sound types + initSound() + noteOn() + tabla de periodos
10. Canciones (splash y/o escena)
11. Transiciones custom de tileset (runToScene/runToBlack)
12. Actores: sprites const, pool gFrames, gActors, physics, draw
13. Scripts de usuario (tu C Directo) + userScriptsInit/Update
14. int main() { init, splash, fill, sceneInit, sceneLoop }
```

### `main()` visto por dentro

```c
int main() {
  REG_DISPCNT = MODE_3 | BG2_ENABLE;
  u16* screen = (u16*)VRAM;
  // [si splash] mostrar splashScreenData durante SPLASH_DURATION
  // [si entrada custom] runToScene_Entry(sceneData, N);  // transición
  // o [si fade]          fadeToScene(sceneData, N);
  // luego se pinta la escena en el framebuffer y entra el bucle:
  // sceneInit();   -> snapshot del fondo + initActors() + dibujo inicial
  // sceneLoop();   -> while(1) { waitVSync(); actorLoopBody(); }
}
```

### Funciones de la escena (te serán visibles desde tus scripts)

```c
// Fondo de la escena (framebuffer)
const u16 sceneData[PIXEL_COUNT] = { ... };  // o SCENE_COLOR

// Inicializa la escena: copia el fondo a gActorBack, pone actores en su
// sitio, los dibuja por primera vez, y si tienes scripts llama script_init()
static void sceneInit(void);

// Bucle infinito de juego
static void sceneLoop(void);

// Cuerpo de cada frame (llamado tras waitVSync)
static void advanceAllActors(void);   // animación automática de sprites
static void updatePlayer(void);       // input + colisiones + empuje actor-actor
static void drawAllActors(u16* screen); // orden z + píxeles
```

> Tú no escribes `main()`. Tu código se inserta **un nivel por debajo**: un archivo válido que solo existe por sus funciones `script_init`/`script_update` (ver [13](#1013-el-c-directo-de-tus-scripts-contrato-y-api)).

---

## 10.7. Tipos y convenciones del código generado

libgba define los tipos que usa el template (`#include <gba.h>`):

| Tipo | Ancho | Volátil | Signo | Para qué |
| :--- | :--- | :--- | :--- | :--- |
| `s8` `/` `s16` `/` `s32` | 8/16/32 | sí | con signo | matemática |
| `u8` `/` `u16` `/` `u32` | 8/16/32 | no | sin | datos, colores, direcciones |
| `vu8` `/` `vu16` `/` `vu32` | 8/16/32 | **sí** | sin | registros de hardware |
| `int` | 32 | no | con | bucles y aritmética por defecto |

Convenciones del template que deberías respetar en tus scripts:

- **Todo es 32 bits por defecto.** No uses `long` a lo loco: `int` cuesta igual y más simple.
- Los colores y valores de registro son `u16`.
- Las posiciones de actores son `s16` (rango ±32767; fuera de ahí te preguntarás por qué se rompen).
- Las funciones estáticas del template pueden llamarse desde tus scripts porque están definidas **arriba** de la sección de scripts (mismo archivo, mismo scope). No necesitas prototipos.
- Los símbolos `static` dentro de tus scripts (variables auxiliares) son perfectos porque tu bloque vive al nivel del archivo.

### Atributos de sección que verás en el código

```c
static u16 gActorBack[240*160] __attribute__((section(".ewram"), aligned(4)));
```

- `section(".ewram")` → coloca el buffer en EWRAM (256 KB) en vez de en el BSS. 240×160×2 = 76.800 B no cabe en IWRAM stack-rooted.
- `aligned(4)` → acceso eficiente a mitad de palabra.

Consejo: para tu propio buffer grande (p. ej. un mini-buffer de texto), aplica el mismo atributo; si lo declaras local te explota el stack (32 KB).

---

## 10.8. Sistema de actores (las entidades del juego)

### El struct `GBAActor`

```c
typedef struct {
  s16 x, y;         // posición top-left del sprite EN PANTALLA (relativa a cámara)
  s16 z;            // orden de dibujo: menor z se dibuja primero (atrás)
  u16 w, h;         // tamaño del sprite
  u8 hasCollider;   // 1 = participa en colisiones (y hace que updatePlayer lo mueva)
  u16 cw, ch;       // tamaño del collider (el editor lo centra en el sprite por defecto)
  s16 cox, coy;     // desplazamiento px del collider respecto al centro del sprite (Offset X/Y del inspector)
  s16 vx, vy;       // velocidad en px/vsync (la usan las primitivas de movimiento)
  s8 face;          // 1 mira a la derecha, 0 a la izquierda (lo pone el D-pad)
  u8 coyote;        // vsyncs desde el último suelo (salto con margen)
  u8 jumpBuf;       // vsyncs que un salto queda pendiente de aterrizaje
  u8 jumpHeld;      // A sigue pulsado (para armar el buffer solo al pulsar)
  const GBAFrame* frames[32];  // punteros a frames de la animación
  u16 delays[32];              // duración de cada frame EN VSYNCS
  u8 frameCount;               // nº de frames
  u8 mode;                     // 0=once, 1=loop, 2=pingpong
  u8 frame;                    // frame actual
  s8 dir;                      // +1/-1 (para pingpong)
  u16 timer;                   // contador interno de vsyncs de la animación
  u8 animSpeed;                // paso por vsync del avance (0/1 = cadencia exacta, 2+ = más rápido)
} GBAActor;
```

`GBAFrame` es:

```c
typedef struct {
  const u16* img;  // píxeles RGB555; bit15=1 => transparente
  u16 w, h;
} GBAFrame;
```

### La lista global

```c
#define ACTOR_COUNT  <n>        // 1..64
#define PLAYER_INDEX 0          // el actor 0 es "el jugador"
#define MAX_ACTOR_FRAMES 32
#define CAM_X 0                 // offset de cámara (si lo configuraste)
#define CAM_Y 0

static GBAActor gActors[ACTOR_COUNT];
```

### Ciclo de vida de un actor

1. **`initActors()`** (dentro de `sceneInit`): posiciona actores, engancha `frames[]` y `delays[]` a imágenes del pool, ajusta `mode`, `hasCollider`, `cw/ch`.
2. **`advanceAllActors()`** (cada frame): si `frameCount > 1`, incrementa `timer`; cuando `timer >= delays[frame]` avanza el `frame` según el `mode`:
   - `mode 0` (*once*): sube hasta `frameCount-1` y se queda.
   - `mode 1` (*loop*): `(frame+1) % frameCount`.
   - `mode 2` (*pingpong*): sube/baja alternando según `dir`.
3. **`updatePlayer()`** (cada frame, solo si `gActors[PLAYER_INDEX].hasCollider == 1`): mueve al jugador con colisiones **solo si no hay script C** (con script C lo mueve tu `script_update`) y empuja a otros actores. (ver seccion 9, 10 y 10.14).
4. **`drawAllActors(screen)`** (cada frame): ordena por `z` y dibuja `drawActorRect` uno a uno.

### La cadencia de la animación y `animSpeed`

`advanceAllActors()` hace avanzar el `timer` de cada actor y pasa al siguiente `frame` cuando `timer >= delays[frame]`. Es decir:

- **Velocidad base**: `delays[frame]` vsyncs por frame (el exportador lo calcula en el editor a partir de la duración de cada frame del sprite). Con `delays` de 6 vsyncs → 10 fps de animación.
- **`animSpeed`** (campo del actor, `0/1` = normal): cada vsync el `timer` avanza `animSpeed` ticks en vez de 1. Lo escribe tu script y solo afecta al actor que lo toca.
- **No hay aceleración automática**: el motor NO sube la velocidad de nadie por moverse (ni del que camina ni de los NPC). Toda velocidad distinta de la cadencia exacta sale de tu código.

#### Acelerar la zancada solo al caminar

El uso típico es que la animación del que camina acompañe el desplazamiento. En `script_update` sube `animSpeed` mientras mueves con `gSelf` y lo devuelves a `1` al soltar:

```c
static void script_update(void) {
  u16 keys = ~REG_KEYINPUT & 0x3FF;
  if (keys & (KEY_UP | KEY_DOWN | KEY_LEFT | KEY_RIGHT)) {
    moveTopDown(gSelf, keys);     // o moveActorCollide / movePlatformer
    gSelf->animSpeed = 2;         // zancada ×2 SOLO mientras este actor camina
  } else {
    gSelf->animSpeed = 1;         // cadencia exacta al parar
  }
}
```

Solo cambia la animación del actor cuyo `animSpeed` tocas; el resto de la escena sigue con su cadencia exacta aunque el mundo se mueva.

### To-codigo ejemplo: leer el actor del jugador

```c
void script_update(void) {
  GBAActor* p = &gActors[PLAYER_INDEX];
  p->x += 1;            // mueves 1 px por frame (60 px/s)
}
```

**Consejos de la API de actores desde scripts:**

- Cada vuelta de `script_update` ejecuta **después** de `advanceAllActors`/`updatePlayer` y **antes** de `drawAllActors`. O sea: lees estado ya animado y tus cambios se pintan ese mismo frame.
- Para "saltar" a un frame concreto de la animación: `a->frame = k; a->timer = 0;`
- Para usar otra animación (otro set de frames) necesitarías re-mapear `a->frames[i]`; en la versión actual de export el set está fijado en `initActors`. Puedes cambiar `a->frame` y `a->mode`, o compartir frames entre actores (el pool deduplica imágenes).
- `z` controla quién tapa a quién. Cámbialo a voluntad (incluso cada frame) para efectos "clase de profundidad".
- `vx`/`vy` son campos **libres**: úsalos para tu propia física (gravedad, obstáculos, NPCs).

---

## 10.9. Entrada: leer los botones

### La verdad sobre `REG_KEYINPUT`

`REG_KEYINPUT` es un registro de 16 bits de solo lectura en `0x04000130`.

**Bit = 0 significa botón PULSADO** (activo por nivel bajo). Bit = 1 significa suelto.

| Bit | Botón | Bit | Botón |
| :--- | :--- | :--- | :--- |
| 0 | **A** | 5 | **←** (LEFT) |
| 1 | **B** | 6 | **↑** (UP) |
| 2 | **SELECT** | 7 | **↓** (DOWN) |
| 3 | **START** | 8 | **R** |
| 4 | **→** (RIGHT) | 9 | **L** |

Los bits 10-15 están sin cablear (los ignoras, no los leas).

> ⚠️ Es el **mapa real del GBA** (`b0=A, b1=B, b2=SELECT, b3=START, b4=RIGHT, b5=LEFT, b6=UP, b7=DOWN, b8=R, b9=L`). No lo confundas: el comtexto inverso te dará un jugador que anda al revés. Será un bug muy habitual.

### El patrón estándar para "botón pulsado"

```c
u16 keys = ~REG_KEYINPUT & 0x3FF;   // invertir bits + enmascarar a los 10 botones
if (keys & (1 << 0)) { /* A pulsado */ }
if (keys & (1 << 4)) { /* derecha */ }
```

El template trae los botones ya enmascarados con constantes, para no contar shifts a mano:

```c
#define KEY_RIGHT 0x010
#define KEY_LEFT  0x020
#define KEY_UP    0x040
#define KEY_DOWN  0x080
#define KEY_A     0x001
#define KEY_B     0x002
#define KEY_SHOULDER 0x300   // R y L a la vez (correr)

if (keys & KEY_RIGHT) { /* derecha */ }
```

Y `movePlayer()` mueve al jugador con [`moveTopDown`](#primitivas-de-movimiento-listos-para-usar):

### Detectar "recién pulsado" (flancos: edge/rising)

El D-pad "mantener" mueve cada frame. Para saltar o disparar solo **en el frame en que se presiona** guarda el estado anterior:

```c
static u16 prevKeys = 0;

void script_update(void) {
  u16 keys = ~REG_KEYINPUT & 0x3FF;
  u16 justPressed = keys & ~prevKeys;    // 1 en botones recién pulsados
  u16 justReleased = prevKeys & ~keys;   // 1 en botones recién soltados
  prevKeys = keys;

  if (justPressed & (1 << 0)) { /* acción de salto: se dispara UNA vez */ }
}
```

### Controles en simultáneo y prioridad

- `justPressed` es un conjunto de bits: puedes exigir **combinaciones**:

```c
if ((justPressed & (1 << 0)) && (justPressed & (1 << 1))) { /* A+B */ }
```

- Decide tú la prioridad en el código: `if / else if` es más predecible que varias comprobaciones independientes que provoquen "picos".

---

## 10.10. Movimiento y colisiones

### Coordenadas y cámara

En el mundo del template, cada actor guarda su posición **en pantalla** (`x, y`), porque el motor está pensado para pantalla fija 240×160. `CAM_X/CAM_Y` suman un offset de mundo a la colisión:

```c
// Coordenadas del collider en el MUNDO:
static inline void actorBox(const GBAActor* a, s16* bx, s16* by, s16* bw, s16* bh) {
  *bw = a->cw ? a->cw : a->w;
  *bh = a->ch ? a->ch : a->h;
  *bx = a->x + CAM_X + (a->w - *bw) / 2;   // collider centrado
  *by = a->y + CAM_Y + (a->h - *bh) / 2;
}
```

- Si en el inspector de Mundo el actor tiene **collider**, el template rellena `cw/ch` con su tamaño (o el del sprite si no). El collider queda **centrado** sobre el sprite.

### El mapa de colisiones y sus tipos de tile

Si tu escena tiene mapa de colisiones (editado en el Módulo Mundo), el template emite:

```c
#define COLLISION_COLS ...
#define COLLISION_ROWS ...
#define COLLISION_TILE_SIZE 8   // tamaño de tile, en px
#define CAM_X ...
#define CAM_Y ...
const u8 collisionMap[ROWS][COLS] = { ... };
```

**Valores de tile en el mapa** (según `solidTile`):

| Valor | Tipo | Bloquea |
| :--- | :--- | :--- |
| `0` | Vacío | nada |
| `1` | Sólido | siempre |
| `2` | One-way ↑ | solo al **caer** (dirY > 0) |
| `3` | One-way ↓ | solo al **subir** (dirY < 0) |
| `4` | One-way ← | solo yendo a la **derecha** (dirX > 0) |
| `5` | One-way → | solo yendo a la **izquierda** (dirX < 0) |
| `6` | Escalera | pasable (no bloquea) |

```c
static inline u8 solidTile(u8 v, int dirX, int dirY) {
  if (v == 1) return 1;                      // sólido
  if (v == 2) return dirY > 0;               // one-way up: bloquea cayendo
  if (v == 3) return dirY < 0;               // one-way down: bloquea saltando
  if (v == 4) return dirX > 0;               // one-way left: bloquea a la derecha
  if (v == 5) return dirX < 0;               // one-way right: bloquea a la izquierda
  return 0;
}
```

### `rectHitsSolid` y `moveActorCollide`

```c
// ¿El rectángulo de mundo (bx,by,bw,bh) toca algún tile sólido PARA la
// dirección (dx,dy)?
static inline int rectHitsSolid(s16 bx, s16 by, s16 bw, s16 bh, s16 dx, s16 dy);

// Mueve un actor resolviendo eje por eje (X e Y por separado):
// se mueve, comprueba, y si choca, revierte.
static void moveActorCollide(GBAActor* a, s16 dx, s16 dy);
```

`moveActorCollide` es la mejor herramienta: permite deslizar por paredes (no se atasca en diagonales). Úsalo con **desplazamientos pequeños** (2-4 px por frame).

### Empuje actor-actor

```c
static void updatePlayer(void) {
  GBAActor* p = &gActors[PLAYER_INDEX];
  if (!p->hasCollider) return;            // sin collider no mueve nada
  keys = ~REG_KEYINPUT & 0x3FF;
  movePlayer(keys, p);                     // = moveTopDown(p, keys)
  // ... empuja a cualquier otro actor con collider usando el eje de
  // menor intrusión (AABB)
}
```

O sea: el jugador **empuja** a los demás (si ambos tienen collider). Para que un NPC no lo haga, déjale `hasCollider = 0` (o que solo él no colisione). Si quieres que *todos* se empujen entre sí, replica ese bucle en tu script.

### Física manual con enteros (gravedad sin float)

Ejemplo de física "gravedad simple" para un NPC, usando `vx/vy` y un collider:

```c
void script_update(void) {
  GBAActor* e = &gActors[1];       // un "enemigo"
  if (!e->hasCollider) return;

  e->vy += 1;                       // gravedad: +1 px/vsync²
  if (e->vy > 4) e->vy = 4;         // velocidad terminal
  moveActorCollide(e, 0, e->vy);    // colisión vertical (aplica suelo/techo automáticamente)

  // patrulla: rebota en paredes
  if (e->vx == 0) e->vx = 1;
  if (e->vx > 0) moveActorCollide(e, 1, 0); else moveActorCollide(e, -1, 0);
}
```

> Como las posiciones son enteros, la gravedad "1 px por frame al cuadrado" funciona fina a 60 fps. No clames duplicar con `/=2` si no es potencia de 2 (ver [16](#1016-optimización-y-reglas-de-oro)).

### Primitivas de movimiento (listos para usar)

Escribir la física a mano para cada juego es repetitivo, así que el template trae **dos primitivas ya resueltas** que solo tienes que llamar. No son "bases" ni "niveles" prefabricados: el nivel ya es tu mapa de tiles, y lo único que cambia entre un plataformas y un laberinto topdown es qué primitiva llamas.

**Todo se ajusta con `#define`s**, así que el comportamiento se cambia en un sitio y afecta a todos tus scripts:

```c
#define WALK_SPEED 2        // px/vsync horizontal máximo
#define RUN_SPEED 3         // con R/L (shoulder)
#define ACCEL 1             // aceleración horizontal (1 = respuesta inmediata)
#define FRICTION 1          // frenada en suelo
#define GRAVITY 1           // px/vsync² (entero: en GBA no hay floats)
#define MAX_FALL 5          // velocidad máxima de caída
#define JUMP_VEL -11        // impulso del salto (negativo = hacia arriba)
#define COYOTE_FRAMES 5     // vsyncs de margen tras salir de la plataforma
#define JUMP_BUFFER 5       // vsyncs que un salto espera a que haya suelo
#define JUMP_CUT_VEL -3     // salto corto: soltar A corta la subida
```

#### `movePlatformer(actor, keys)` — plataformas

```c
static void movePlatformer(GBAActor* a, u16 keys);
```

Gravedad + salto "de Orphan Knife", con las tres ayudas que hacen que un salto se sienta bien:

- **Coyote time**: si acabas de salir de una plataforma, aún puedes saltar durante `COYOTE_FRAMES`. Pulsa A medio frame después de abandonar el borde y el salto cuenta.
- **Jump buffer**: si pulsas A hasta `JUMP_BUFFER` vsyncs *antes* de tocar suelo, el salto se guarda y se dispara al aterrizar. Evita el "pulsé tarde y no saltó".
- **Salto variable**: soltar A mientras subes recorta la velocidad a `JUMP_CUT_VEL`. Mantenerlo pulsado = salto alto; un toque = salto corto.
- Los tiles **one-way** solo bloquean si vienes cayendo, así que puedes subir atravesándolos.

Tu script completo de plataformas es literalmente esto:

```c
void script_update(void) {
  u16 keys = ~REG_KEYINPUT & 0x3FF;
  movePlatformer(gSelf, keys);
}
```

#### `moveTopDown(actor, keys)` — laberinto / RPG / menús

```c
static void moveTopDown(GBAActor* a, u16 keys);
```

Cuatro direcciones con aceleración y frenada, **sin gravedad**. Correr con `R`/`L`:

```c
void script_update(void) {
  u16 keys = ~REG_KEYINPUT & 0x3FF;
  moveTopDown(gSelf, keys);
}
```

Si el actor choca contra un tile, esa velocidad se pone a 0 (para no quedarse "pegado" al muro con la velocidad máxima cargada).

#### `onFloor(actor)` — ¿está en el suelo?

```c
static int onFloor(GBAActor* a);
```

Mira un tile por debajo del collider. Útil para tus propias decisiones (patrullas, enemigos que solo se mueven en suelo, animaciones de "en el aire"):

```c
void script_update(void) {
  GBAActor* e = &gActors[1];
  if (onFloor(e) && (REG_KEYINPUT & 0x200) == 0) {
    // solo patrulla si toca suelo
  }
}
```

> **Nada te obliga a usarlas.** Si una primitiva no encaja con tu juego, ignórala y mueve `gSelf` a mano con `moveActorCollide` — la sección anterior. Están ahí para ahorrarte el 90% de la física, no para imponerte un género.


### Teletransporte y limites

```c
p->x = 100; p->y = 80;      // la posición se aplica ANTES del draw del frame
// si reciclás a fuera de pantalla, recuerda drawActorRect hace clamp y lo ignora
// (baja coste), pero volverá visible al read-regresar.
```

---

## 10.11. Sonido: la APU del GBA

### La APU en resumen

4 canales efectivos de síntesis (más un DMA de muestras PCM que el motor no usa):

| Canal | Nombre | Síntesis |
| :--- | :--- | :--- |
| 1 | **Pulse 1** | onda cuadrada + barrido de frecuencia (sweep) |
| 2 | **Pulse 2** | onda cuadrada (sin barrido) |
| 3 | **Wave** | 16 muestras de 4 bits (wave RAM) |
| 4 | **Noise** | ruido pseudoaleatorio |

### `noteOn()`: la función que toca una nota

El template genera (para el editor de sonido del proyecto) una función `noteOn(int ch, const GBAInst* inst, u16 period)` y una tabla de periodos:

```c
// De la frecuencia (Hz) al valor de registro:
// period ≈ round(2048 - 131072 / freq)
const u16 gNotePeriods[96] = { ... };   // C1..B8

typedef struct {
  u8 volume;    // 0-15
  u8 duty;      // relación de la onda cuadrada (0-3)
  u8 envDir;    // 0=decay, 1=attack
  u8 envSweep;  // rápidez del cambio de volumen (0-7)
  u8 sweepShift;// 0-7 (si 0, no hay barrido)
  u8 sweepTime; // 0-7
  u8 sweepDir;  // 0=down, 1=up
} GBAInst;
```

`noteOn` aplica:

```c
static void noteOn(int ch, const GBAInst* inst, u16 period) {
  u16 dutyVal  = (inst->duty & 3);
  u16 envVal   = ((inst->volume & 0xF) << 11)
               | ((inst->envDir & 1) << 8)
               | ((inst->envSweep & 7) << 4);
  u16 freqVal  = 0xC000 | (period & 0x07FF);   // frecuencia + key-on en bit 14
  switch (ch) { ... /* escribe REG_SND1/2/3/4* */ }
}
```

### Duty cycles (onda cuadrada)

El campo `duty` (0-3) controla la proporción alto/bajo de la onda:

| duty | Onda | Sonoridad |
| :--- | :--- | :--- |
| 0 | 12.5% | flauta fina, "tu-tu" |
| 1 | 25% | timbre más nasal |
| 2 | 50% | onda cuadrada clásica (melodías) |
| 3 | 75% | timbre parecido al 25% invertido |

### Reproducir un SFX desde un script

Estrategia práctica: **roba un canal** mientras no toque música de fondo, o añade tu propio sonido si el proyecto no tiene song. Un mini-SFX de impacto para el canal 2:

```c
// Un disparo corto en el canal 2 (pulse), una sola vez al pulsar A
static u32 sfxTimer = 0;

static void playImpact(void) {
  GBAInst sfx;
  sfx.volume = 12;
  sfx.duty = 1;
  sfx.envDir = 0;       // decay
  sfx.envSweep = 6;     // cae rápido
  sfx.sweepShift = 0;   // sin sweep de frecuencia
  sfx.sweepTime = 0;
  sfx.sweepDir = 0;
  noteOn(1, &sfx, (u16)(2048 - 131072 / 880)); // ~880 Hz (A5)
}

void script_update(void) {
  u16 keys = ~REG_KEYINPUT & 0x3FF;
  if (keys & (1 << 0)) {   // A
    playImpact();
    REG_SND2FREQ = 0;      // luego lo apagamos (o deja que decay haga el resto)
  }
}
```

> Si el proyecto tiene música de fondo, los canales 1-4 los ocupará el secuenciador. Para un SFX propio sin chocar, podrías bajar un canal de la canción en ese instante o **reutilizar el canal 4 (ruido)** para percusión/golpes, que es de lo que menos se entromete. En versiones futuras se prevén SFX dedicados.

### Wave RAM del canal 3

```c
static void initWaveRAM(void) {
  vu16* wave = (vu16*)0x04000090;
  const u16 waveData[8] = { 0x0123,0x4567,0x89AB,0xCDEF, 0x0123,0x4567,0x89AB,0xCDEF };
  int i;
  for (i=0;i<8;i++) wave[i] = waveData[i];
}
```

16 muestras de 4 bits, el template las carga en `initSound()`. Si defines tu propia forma de onda aquí podrás crear timbres distintos para el canal 3 (p. ej., una onda triangular o un cuado-suave).

### Valores típicos de `initSound()`

```c
REG_SNDBIAS = 0x200;      // sesgo correcto del DAC (136' ciclo)
REG_SNDCNTX = 0x0080;     // volumen del sonido al 100% (canal master)
REG_SNDCNTH = 0x0002;
REG_SNDCTL  = 0xFF77;     // Master: full, y enable de los 4 canales
REG_SND3CNT_L = 0x0080;   // wave al 100%, sin output tweak
REG_SND3CNT_H = 0x0001;
initWaveRAM();
```

### Canciones y el bucle de tiempo

Si el proyecto tiene música, el template genera `SONG_BPM...`, `SONG_STEPS...`, las constantes de la canción y:

```c
while (1) {
  waitVSync();
  accum += SONG_BPM_Scene;
  if (accum >= 900) {          // avanza un "paso" (16th de compás)
    accum -= 900;
    playStep_Scene(step);      // toca las notas del paso
    step++; if (step >= SONG_STEPS_Scene) step = 0;
  }
  advanceAllActors(); updatePlayer(); userScriptsUpdate(); drawAllActors(screen);
}
```

Con BPM=900 un paso coincide con un frame (60 pasos/s). Cambia el acumulador si quieres un tempo distinto, no el umbral.

---

## 10.12. Frames, vsyncs y animación

Todo el sistema de timing del motor se basa en **vsyncs = frames**:

- `waitVSync()` se llama una vez por vuelta del bucle → **1 frame = 1/60 s**.
- `delays[i]` guarda cuántos vsyncs dura cada frame de la animación. En el inspector, el motor **convierte** milisegundos → vsyncs (`round(ms*60/1000)`).
- Para una animación propia desde script, haz algo equivalente: un contador de frames y cambia `a->frame` cuando toque.

```c
// Parpadeo cada 30 frames (0,5 s)
static u16 blink = 0;
void script_update(void) {
  GBAActor* a = &gActors[1];
  if (++blink < 30) a->frame = 0;
  else if (blink < 60) { a->frame = 1; if (blink >= 60) blink = 0; }
}
```

**Regla práctica:** nunca pongas retardos en milisegundos a mano; cuenta vsyncs (`u16 timer`). Un "delay(500)" bloqueante deja el juego congelado porque **no hay otro hilo**: tu script y el render comparten el mismo frame.

---

## 10.13. El C Directo de tus scripts: contrato y API

### Cómo se inserta tu código

Cuando exportas con un script en modo **C Directo** cuyo campo `cCode` no está vacío, `gba_export.ts`:

1. Coloca tu código **verbatim** (tal cual, `\n` `\n`) dentro del `main.c`, en la sección `// ── Scripts de usuario (C Directo) ──` **antes** de `int main()`.
2. Genera dos dispatchers:

```c
static void userScriptsInit(void) {
  script_init();          // si existe EXACTAMENTE 1 definición
  // o: // script_init(): N definiciones — sin llamada
}
static void userScriptsUpdate(void) {
  script_update();
}
```

3. Llama `userScriptsInit()` dentro de `sceneInit()` (tras `initActors()+drawAllActors`) y `userScriptsUpdate()` **en cada vuelta** del bucle de juego (con actores, con música y, si no hay actores, ¡también!). Por eso tu `script_update` corre siempre a 60 fps.

### El contrato exacto

```c
void script_init(void) {
  //  1 vez, al entrar en la escena (después de que los actores estén colocados).
}
void script_update(void) {
  //  cada frame del juego, justo antes del drawAllActors.
}
```

- **Ambos son opcionales.** Si no defines `script_update`, tu script es solo setup. Si no defines ninguno, el export ya te avisa con un warning.
- **Debe haber EXACTAMENTE 1 definición** de cada uno. Si hay varias (o varias scripts con la misma función), el motor no llama a ninguna y un warning lo indica en la consola de export. Con `cCode` así, el compilador dará símbolo duplicado si defines por duplicado.
- Para que el contract se comprenda bien: **no escribas `void script_update(void)` dentro de bloques ni con parámetros**. Es la forma exacta que detecta el detector (con espacios tolerables).

### Qué hay disponible dentro de tus scripts (API completa)

Todo lo ya definido arriba en el archivo (estático si es `static`) es accesible:

- `gActors[ACTOR_COUNT]`, `GBAActor`, `GBAFrame`, `PLAYER_INDEX`, `CAM_X/CAM_Y` (single-scene; en multi-escena son `gCamX/gCamY`, ver [10.15](#1015-varias-escenas-en-la-rom-switchscene-near-y-gjp)), `MAX_ACTOR_FRAMES`.
- `moveActorCollide(a, dx, dy)`, `movePlayer(u16 keys, GBAActor* p)`, `updatePlayer()`, `actorBox()`, `rectsOverlap()`, `rectHitsSolid()` (si hay mapa), `solidTile()`, `advanceAllActors()`, `initActors()`.
- **Primitivas de movimiento:** `moveTopDown(a, keys)`, `movePlatformer(a, keys)`, `onFloor(a)`, `approach(&v, target, step)`.
- **Múltiples escenas:** `switchScene(n)`, `near(a, b, dist)`, `gJp`, `gScene` (ver [10.15](#1015-varias-escenas-en-la-rom-switchscene-near-y-gjp)).
- Botones: `KEY_A`, `KEY_B`, `KEY_UP`, `KEY_DOWN`, `KEY_LEFT`, `KEY_RIGHT`, `KEY_SHOULDER`.
- `REG_KEYINPUT` (`0x04000130`), mapa de bits correcto (ver [9](#109-entrada-leer-los-botones)).
- **Diálogos:** `showDialogue(id)`, `nextDialogueRow()`, `hideDialogue()`, `gLang` (ver [10.13.1](#10131-diálogos-e-idiomas)).
- `SCREEN_W=240`, `SCREEN_H=160`, `PIXEL_COUNT=38400`, `screen` **no** está como símbolo: usa `(u16*)VRAM` si quieres pintar.
- `REG_SND1..4*`, `noteOn()`, `GBAInst`, `gNotePeriods` (si hay sonido en el proyecto).
- `waitVSync()`.
- Defines condicionales: `ACTOR_COUNT`, `COLLISION_*` (si hay mapa).

### 10.13.1. Diálogos e idiomas

Si el proyecto tiene diálogos, el motor exporta estas funciones y la variable global:

```c
void showDialogue(int id);            // muestra el diálogo `id` desde la fila 0
void showDialogueRow(const char* key); // salta a una fila por su código o su ID
void nextDialogueRow(void);           // avanza a la siguiente fila (si está visible)
void hideDialogue(void);              // oculta el diálogo
extern int gLang;                     // idioma activo: 0 = primera columna, 1 = segunda, …
```

- `id` es el **orden del diálogo en el editor** (0, 1, 2…), no el ID de la fila.
- `showDialogueRow(key)` busca la primera fila cuyo **campo Código** o cuyo **ID completo** coincida con `key` y la muestra. Si no encuentra ninguna, no hace nada.
- El texto mostrado es `texto[fila][gLang]`. Cambia `gLang` antes de `showDialogue`/`showDialogueRow` para elegir el idioma (el índice sigue el orden de las columnas de la tabla de Diálogo).
- `nextDialogueRow()` y `hideDialogue()` no hacen nada si el diálogo está oculto.
- El motor dibuja la caja y el texto en la parte inferior de la pantalla; no tienes que pintarlos.

```c
void script_update(void) {
  static int shown = 0;
  gLang = 1;                              // 0 = primer idioma, 1 = segundo
  if (!shown) { showDialogue(0); shown = 1; }
  if (gJp & 8) { showDialogueRow("saludo"); } // START: fila por código
  if (gJp & 1) nextDialogueRow();         // A: siguiente fila
  if (gJp & 2) hideDialogue();            // B: ocultar
}
```

También puedes usar el ID completo de la fila: `showDialogueRow("Nuevo diálogo 3-002-1")`.

### Reglas obligatorias de tu código

| Regla | Por qué |
| :--- | :--- |
| **Sin `float`/`double`** | No hay FPU; el compilador simula con soft-float lentísimo. |
| **Sin `malloc`/`free`** | No hay gestor de memoria; declara estáticos. |
| **Sin `printf` a pantalla** | No hay consola. Para depurar, ver [17](#1017-depuración). |
| **Sin bucles infinitos bloqueantes** | Congelan el render. Usa contadores por vsync. |
| **No escribas VRAM fuera de VBLANK** | Tearing en consola real. |
| **Código corto por frame** | Presupuesto VBLANK (~83.8K ciclos). |
| **Sin I/O de archivos** | No existe. No hay filesystem. |

---

## 10.14. Ejemplos de scripts listos para copiar

### 1. Mover a un actor con el D-pad (con y sin colisiones)

**Jugador / actores:** un script SOLO se ejecuta si está **asignado a un actor** (Mundo → Inspector → Script). El motor llama al script **una vez por cada actor asignado**, con la variable global `GBAActor* gSelf` apuntando al actor en cuestión — usa `gSelf` para mover a ESE actor (no `gActors[PLAYER_INDEX]`, que siempre mueve al jugador). Si el proyecto tiene script C pero no le asignas ninguno al jugador, el jugador **no hace nada**. Si el proyecto no tiene NINGÚN script C, el motor mueve al jugador solo con el D-pad usando `moveTopDown` (2 px/frame, con colisiones de tiles) — cambia `WALK_SPEED` si quieres otra velocidad.

> Atajo: si solo quieres moverte, no escribas la física. `movePlatformer(gSelf, keys)` te da plataformas completas y `moveTopDown(gSelf, keys)` un laberinto, ambos con colisiones. Ver [10.10](#primitivas-de-movimiento-listos-para-usar).

El ejemplo sirve para **cualquier actor** (jugador o NPC) con mando. **Importante para que los tiles de colisión funcionen:** si mueves un actor `+= 2` a pelo, **ignora el mapa de colisiones** (no lo detecta → atraviesa o «se frena» por el empuje de otros actores). Para chocar con tiles usa `moveActorCollide()`:

```c
// Mueve al actor asignado (gSelf) respetando el mapa de colisiones de la escena
void script_update(void) {
  GBAActor* p = gSelf;
  u16 keys = ~REG_KEYINPUT & 0x3FF;
  if (keys & (1 << 5)) moveActorCollide(p, -2, 0); // izquierda
  if (keys & (1 << 4)) moveActorCollide(p,  2, 0); // derecha
  if (keys & (1 << 6)) moveActorCollide(p,  0, -2); // arriba
  if (keys & (1 << 7)) moveActorCollide(p,  0,  2); // abajo
}
```

Si tu escena **no** tiene mapa de colisiones (o no quieres chocar), la versión directa:

```c
void script_update(void) {
  GBAActor* p = gSelf;
  u16 keys = ~REG_KEYINPUT & 0x3FF;
  if (keys & (1 << 4)) p->x += 2;   // derecha (bit4)
  if (keys & (1 << 5)) p->x -= 2;   // izquierda (bit5)
  if (keys & (1 << 6)) p->y -= 2;   // arriba
  if (keys & (1 << 7)) p->y += 2;   // abajo
}
```

> El collider del actor en el inspector solo interviene en el empuje **actor-actor** (`updatePlayer`) y en `moveActorCollide` (usa el collider centrado `cw/ch`). Para que un movimiento propio respete tiles, la llamada a `moveActorCollide` es obligatoria.

### 2. Disparar SFX al pulsar A (una vez)

```c
static u16 prevKeys = 0;
static int shotHeld = 0;

static void playShot(void) {
  GBAInst sfx;
  sfx.volume = 10; sfx.duty = 2; sfx.envDir = 0;
  sfx.envSweep = 5; sfx.sweepShift = 0; sfx.sweepTime = 0; sfx.sweepDir = 0;
  noteOn(1, &sfx, (u16)(2048 - 131072 / 440));
}

void script_update(void) {
  u16 keys = ~REG_KEYINPUT & 0x3FF;
  u16 justPressed = keys & ~prevKeys;
  prevKeys = keys;
  if (justPressed & (1 << 1)) playShot();   // A (bit1)
}
```

### 3. Enemigo que patrulla y se teletransporta al llegar al borde

```c
void script_update(void) {
  GBAActor* e = &gActors[1];
  e->x += 1;
  if (e->x > 230) e->x = -21;   // fuera de cámara por la izquierda
}
```

### 4. Cambiar la animación de un actor (frame/modo)

```c
void script_update(void) {
  GBAActor* p = &gActors[PLAYER_INDEX];
  if (p->x % 20 < 10) { p->frame = 0; }
  else                 { p->frame = 1; }
  p->timer = 0;   // reinicia el contador para que no "salte" solo
}
```

### 5. Ice-física: inercia con entero (sin float)

```c
static s16 vx = 0;
void script_update(void) {
  GBAActor* p = &gActors[PLAYER_INDEX];
  u16 keys = ~REG_KEYINPUT & 0x3FF;
  if (keys & (1 << 4)) vx += 1;
  if (keys & (1 << 5)) vx -= 1;
  vx -= vx / 8;             // fricción aproximada (divisible por potencia de 2)
  if (vx > 4)  vx = 4;
  if (vx < -4) vx = -4;
  p->x += vx;
}
```

### 6. Plataformas completas (gravedad, salto, coyote y buffer)

```c
void script_update(void) {
  GBAActor* p = gSelf;
  u16 keys = ~REG_KEYINPUT & 0x3FF;
  movePlatformer(p, keys);   // todo el trabajo, una línea
}
```

Antes de que existieran las primitivas esto era ~20 líneas de `vy += GRAVITY`, saturar a `MAX_FALL`, detectar suelo a mano y vigilar `vy == 0` para saltar. Ya no hace falta: `movePlatformer` lo hace y además añade coyote time, jump buffer y salto variable. Ajusta el comportamiento tocando los `#define` de [10.10](#primitivas-de-movimiento-listos-para-usar).

Si tu actor es un NPC con gravedad pero control manual (por ejemplo, una pelota o un enemigo que cae), usa `onFloor` para saber si tocó suelo:

```c
static u8 prevFloor = 0;
void script_update(void) {
  GBAActor* p = gSelf;
  p->vy += 1;
  if (p->vy > 5) p->vy = 5;
  moveActorCollide(p, 0, p->vy);
  u8 suelo = onFloor(p);
  if (suelo && !prevFloor) p->vy = 0;   //acaba de tocar suelo: anula la caída
  prevFloor = suelo;
}
```

> `onFloor` mira un tile por debajo del collider en la dirección de caída, así que respeta los tiles one-way igual que el resto de la física.

### 7. Contador de frames y condición cada N segundos

```c
static u32 tick = 0;
void script_update(void) {
  tick++;
  if (tick % 180 == 0) {   // cada 3 s (180/60)
    GBAActor* p = &gActors[PLAYER_INDEX];
    p->y -= 20;            // pequeño salto
  }
}
```

---

## 10.15. Varias escenas en la ROM: `switchScene`, `near` y `gJp`

El export **embebe TODAS las escenas del proyecto** en la ROM. La escena de inicio es la que el splash tiene definida como siguiente; cambiar de escena en mitad del juego es una llamada de script.

### Cómo se numeran las escenas

El índice de escena es el **orden en el editor** (la lista de escenas de Mundo, de arriba abajo): la escena 0 es la primera, la escena `N-1` la última (N = total). No depende del nombre. Las **conexiones** del editor sí se exportan: definen la transición que se reproduce al cambiar de escena (ver más abajo).

- `gScene` — índice de la escena actual (lectura).
- `switchScene(n)` — pide cambiar a la escena `n`. El motor reproduce la **transición de entrada de la conexión `gScene→n`** (fade, instantánea o cortinilla de tileset), carga la escena nueva (imagen, colisión, cámara, actores y sus scripts) y la revela. Si no hay conexión definida usa el fade por defecto (~1 s). Si `n` está fuera de rango no hace nada.
- `switchScene(n, "nombre")` — igual, pero elige la conexión cuyo campo **Nombre** sea `"nombre"` (útil si hay varias conexiones al mismo destino). Si el nombre no coincide con ninguna, se usa el fade por defecto. En AdvanceCode se escribe igual.

### Transición por conexión

En Mundo, cada **conexión** entre escenas tiene una transición de **Entrada** (la que se ve al llegar a la escena destino) de tipo *instantánea*, *fade* o *cortinilla* (tileset animado + degradado). El export la compila a una pareja `runToBlack_CTi` / `runToScene_CTi` y `switchScene` la localiza por `(origen, destino)`:

```c
switchScene(1);            // primera conexión gScene→1
switchScene(1, "puerta");  // la conexión llamada "puerta"
```

Por debajo hay una tabla `gTransFrom/gTransTo/gTransName/gTransKind/gTransFrames/gTransCover/gTransReveal` y `findTransition(from, to, name)`. Si una conexión se configuró como cortinilla pero no tiene tileset válido, se degrada a fade y se avisa en el log de exportación.

### Proximidad: `near(a, b, dist)`

Devuelve `1` si la caja de `dist` px alrededor del **centro** de `b` toca al actor `a` (`|centroX_a − centroX_b| ≤ dist` y lo mismo en Y). Pensada para «hablar» / «usar» pegado a un personaje:

```c
void script_update(void) {
  // pegado al jugador + pulsas A → cambio a la escena 1
  if (near(gSelf, &gActors[PLAYER_INDEX], 20) && (gJp & KEY_A)) {
    switchScene(1);
  }
}
```

`dist` son píxeles de pantalla; 20 ≈ medio cuerpo del jugador. Ajusta a la escala de tu juego.

### Flanco de teclas: `gJp`

`REG_KEYINPUT` dice si una tecla está pulsada **ahora**; `gJp` (just-pressed) tiene **solo los bits que se pulsaron ESTE frame** (flanco de subida). Mismos bits que `REG_KEYINPUT` (0 = pulsado). Evita guardar a mano el estado anterior: `if (gJp & KEY_A)` se ejecuta una sola vez por pulsación, aunque mantengas la tecla.

> El motor resetea el flanco al cambiar de escena para que no se cuele el botón que provocó el cambio.

### Qué cambia al pasar de escena

- **Imagen, colisión y cámara** son por escena: `gColMap`/`gColCols`/`gColRows`/`gColTile` y `gCamX`/`gCamY` se actualizan al cargar (ya no son macros `CAM_X`/`CAM_Y` en multi-escena; úsalos como variables).
- **Actores**: cada escena configura las **suyas** en `gActors[0..count-1]`. `ACTOR_COUNT` es el máximo entre todas las escenas; los huecos sobrantes quedan a 0 (`frameCount == 0`) y no se dibujan ni colisionan.
- **Scripts**: el script asignado a un actor se llama con `gSelf` apuntando a ESE actor (índice de su escena). Ponerle un script a un actor nuevo de otra escena = cambiar de escena al momento.
- **Jugador**: `PLAYER_INDEX` siempre es `0`, así que en cada escena el actor en la posición 0 es el «jugador» de esa escena (los scripts lo mueven; si su actor no tiene collider, `updatePlayer` no hace nada).
- **Música**: por ahora solo suena la canción de la **escena de inicio**; música por escena queda pendiente.
- `sceneData` en el código generado es SIEMPRE la escena de inicio (tras el splash); las demás van `sceneData_1 … sceneData_{N-1}` (no las referencies con índices fijos: son nombres generados).

---

## 10.16. Optimización y reglas de oro

### Lo más importante: no romper el presupuesto del frame

- **~83.800 ciclos** de VBLANK.
- Render de sprites: **~15 ciclos/píxel opaco** (borrado por deltas del rect anterior + pintado con transparencia por «skip»).
- Límite holgado: **~5.600 px de sprite en cámara**. Un actor de 21×31 (651 px) cuesta ~10 K ciclos; tres así ~30 K, queda margen.
- Fuera de cámara el coste es ~0 (el `drawActorRect` clampa y devuelve).

### Reglas de coste de CPU (ARM7TDMI)

| Operación | Coste relativo | Consejo |
| :--- | :--- | :--- |
| Suma/producto `int` | 1 | Tu pan de cada día |
| `>>` / `<<` | 1 | Usa potencias de 2 para dividir/multiplicar |
| `%` (módulo) | muy alto | Evita `% n`; si `n` es potencia de 2, usa `& (n-1)` |
| División `/` | muy alto | Evita dividir por constantes no-potencia de 2 |
| `float` | catastrófico | Prohibido |
| Acceso a EWRAM | lento | Tablas grandes en `const` (ROM), buffer en EWRAM |
| `memcpy` de 76 KB | lento | El motor ya evita copiar la escena entera |

Ejemplos:

```c
// mal (cada frame):
// int idx = p->frame % 13;
// bien:
int idx = p->frame & 15;       // asumiendo frameCount = 16 o potencia de 2

// mal: vx /= 10;   → mejor:
vx -= vx / 8;                  // o vx >>= 3 si no necesitas precisión
```

### Optimizaciones propias recomendadas

- Declara funciones pequeñas `static inline` (el indica al compilador `-O2` que las expanda).
- Haz `const` las tablas: vivirán en ROM y no ensucian EWRAM ni IWRAM.
- Accede a VRAM como `u16*` con buffer local, no con punteros `volatile` en el bucle interior (el template ya lo hace).
- Reusa los campos libres del actor (`vx`, `vy`, `timer`, `dir`) antes que declarar 50 variables globales tuyas.
- Si pintas algo propio (mini-barra, texto precomputed), hazlo dentro del mismo VBLANK y con pocos píxeles.

### Casos que se ven mal en consola real pero no en gbajs

- Tear/parpadeo en la zona baja de la pantalla → sobrepaso de VBLANK.
- Juego a mitad de FPS → el frame entero hace más trabajo de lo que cabe.
- La solución de ambos es reducir trabajo por frame (actores visibles, píxeles propios, scripts ligeros), no parchear.

---

## 10.17. Depuración en la consola real vs. emuladores

| Entorno | Qué detecta | Qué oculta |
| :--- | :--- | :--- |
| **Emulador integrado (gbajs)** | Lógica, colisiones, transiciones | Timing intraframe (copia VRAM al final de frame) |
| **mGBA** | Timing VBLANK, precisa | — (muy fiel) |
| **Flashcart / GBA real** | Todo lo real | — |

### Técnicas de depuración sin `printf`

1. **Pausa por botón:** traba el juego y avanza frame a frame.

```c
static u8 paused = 0;
static u16 kprev = 0;
void script_update(void) {
  u16 keys = ~REG_KEYINPUT & 0x3FF;
  if ((keys & ~kprev) & (1 << 3)) paused = !paused; // START pausa
  kprev = keys;
  if (paused) return;
  // ... resto de la lógica
}
```

2. **Estados visibles en el sprite:** cambia el `frame` del actor según un estado (etiqueta barata de estado).
3. **Parpadeo centinela:** alterna el color de un píxel en pantalla (`screen[y*240+x]`) para contar loops o detectar caminos no tomados.
4. **Contadores en `gActors`:** escribe en `p->vx` un valor de depuración y míralo en los loggers del emulador con frame-step.

### La consola de export

Los avisos del export (`[WARN]`, `[OK]`) los verás en el panel inferior del editor al **EXPORTAR** o al compilar con **PLAY**. Presta atención a:
- Scripts sin `script_update()`.
- `script_init/update` duplicados (símbolos repetidos).
- Actores > 64 (se truncan).
- Transiciones largas (recuerda ajustar velocidad).

---

## 10.18. Referencia rápida (cheat-sheet)

### Constantes y símbolos del template

| Símbolo | Valor | Nota |
| :--- | :--- | :--- |
| `SCREEN_W`, `SCREEN_H` | 240, 160 | píxeles |
| `PIXEL_COUNT` | 38400 | 240×160 |
| `VRAM` | `0x06000000` | `screen = (u16*)VRAM` |
| `ACTOR_COUNT` | 1-64 | segun actores exportados |
| `PLAYER_INDEX` | 0 | el actor 0 |
| `WALK_SPEED` / `RUN_SPEED` | 2 / 3 | px/vsync (shoulder = correr) |
| `ACCEL` / `FRICTION` | 1 / 1 | aceleración y frenada |
| `GRAVITY` / `MAX_FALL` | 1 / 5 | px/vsync² y velocidad terminal |
| `JUMP_VEL` / `JUMP_CUT_VEL` | -11 / -3 | impulso y corte del salto |
| `COYOTE_FRAMES` / `JUMP_BUFFER` | 5 / 5 | margen tras el borde / antes de aterrizar |
| `MAX_ACTOR_FRAMES` | 32 | frames por actor |
| `CAM_X`, `CAM_Y` | 0 por defecto | offset de mundo (single-scene); en multi-escena `gCamX`/`gCamY` |
| `gScene` / `gSceneTarget` | — | escena actual / escena pedida (multi-escena) |
| `gJp` | — | flanco de teclas: bits pulsados ESTE frame |
| `gActorBack[]` | EWRAM | fondo de actores |
| `gActors[]` | — | lista global |

### Registros

| Registro | Dir | Leer/Uso |
| :--- | :--- | :--- |
| `REG_DISPCNT` | `0x04000000` | `MODE_3 \\| BG2_ENABLE` |
| `REG_VCOUNT` | `0x04000006` | scanline actual |
| `REG_KEYINPUT` | `0x04000130` | botones (0=pulsado) |
| `REG_SND1SWEEP/CNT/FREQ` | `0x60/62/64` | canal 1 |
| `REG_SND2CNT/FREQ` | `0x68/6C` | canal 2 |
| `REG_SND3CNT_L/H, FREQ` | `0x70/72/74` | canal 3 wave |
| `REG_SND4CNT/FREQ` | `0x78/7C` | canal 4 ruido |
| `REG_SNDCTL/CNTH/CNTX/BIAS` | `0x80/82/84/88` | master |

### Mapa de bits de `REG_KEYINPUT`

```
bit 0 A · bit 1 B · bit 2 SELECT · bit 3 START
bit 4 RIGHT · bit 5 LEFT · bit 6 UP · bit 7 DOWN
bit 8 R · bit 9 L   —  bit = 0 → PULSADO
```

```c
u16 keys = ~REG_KEYINPUT & 0x3FF;          // con 1 = pulsado
u16 jp   = keys & ~prevKeys; prevKeys = keys; // flanco
```

### Funciones útiles

| Función | Resultado |
| :--- | :--- |
| `waitVSync()` | espera al VBLANK |
| `actorBox(a,&bx,&by,&bw,&bh)` | collider en coords mundo |
| `rectHitsSolid(bx,by,bw,bh,dx,dy)` | ¿choca con tiles? |
| `moveActorCollide(a,dx,dy)` | mueve con colision, por ejes |
| `gSelf->animSpeed` | paso/vsync de la animación (2 = doble, ver [10.8](#108-sistema-de-actores-las-entidades-del-juego)) |
| `movePlayer(keys,p)` | D-pad del jugador |
| `updatePlayer()` | input + push actor-actor |
| `showDialogue(id)` | muestra el diálogo `id` desde la fila 0 (ver [10.13.1](#10131-diálogos-e-idiomas)) |
| `showDialogueRow(key)` | salta a una fila por su código o ID |
| `nextDialogueRow()` | avanza a la siguiente fila |
| `hideDialogue()` | oculta el diálogo |
| `gLang = n` | elige el idioma (0 = primera columna, 1 = segunda…) |
| `initActors()` / `advanceAllActors()` | animación automática |
| `drawAllActors(screen)` | z-sort + dibujado |
| `near(a,b,dist)` | ¿±`dist` px entre centros? (proximidad) |
| `switchScene(n[, "nombre"])` | cambia de escena con la transición de la conexión (multi-escena) |
| `noteOn(ch,&inst,period)` | dispara una nota/SFX |

### Fórmulas

| Fórmula | Uso |
| :--- | :--- |
| `RGB555(r,g,b) = ((r>>3)|((g>>3)<<5)|((b>>3)<<10)) & 0x7FFF` | color de píxel |
| `period = round(2048 − 131072/freq)` | nota → registro de periodo |
| `6.7 MHz → 280.896 ciclos/frame → 59,73 fps` | timing base |
| `píxeles de sprite en cámara ≤ ~5.600` | presupuesto VBLANK |

---

## 10.19. Glosario

- **AABB** — caja alineada a los ejes; el rect de colisión del actor.
- **APU** — Audio Processing Unit (la parte de sonido del GBA).
- **BG2_ENABLE** — bit que activa el bitmap de MODE 3.
- **EWRAM** — External Work RAM, 256 KB, lenta.
- **IWRAM** — Internal Work RAM, 32 KB, rápida (stack).
- **Key-on** — bit que "enciende" la nota del canal (en `REG_*FREQ`, bit 14 del valor que escribe `noteOn`).
- **MODE 3** — modo bitmap 240×160 con píxeles RGB555.
- **OAM** — Objeto Attribute Memory: tabla de sprites hardware (no usada por el motor).
- **PPU** — unidad de pintado de píxeles.
- **RGB555** — 15 bits de color directo (5 por canal).
- **Scanline / VCOUNT** — línea horizontal actual del LCD; `REG_VCOUNT` la lee.
- **VBLANK** — periodo vertical blanking (68 líneas): momento seguro para pintar.
- **Vsync** — "vertical sync": la espera de `waitVSync()`. 1 frame.
- **z-sort** — ordenar actores por `z` para decidir quién tapa a quién.
- **Wave RAM** — banco de 16 muestras de 4 bits del canal 3.
- **Thumb / ARM** — los dos repertorios de instrucciones del ARM7TDMI.

---

**Anterior:** [09 — Exportar y probar](09-exportar.md) · **Volver al [índice](README.md)**