# 08 — Scripting

> **Estado:** AdvanceCode y C funcionales; Bloques próximamente.

El módulo **Scripting** es el entorno dedicado a la lógica del juego: comportamiento de actores, eventos globales y mecánicas.

## 8.1. Modos de script

Cada script elige un modo con el selector `[Bloques] [AdvanceCode] [C]` del título:

| Modo | Estado |
| :--- | :--- |
| **Bloques** | Visual, próximamente |
| **AdvanceCode** | **Funcional**: se transpila a C y se inserta en la ROM |
| **C** | **Funcional**: se inserta *verbatim* en la ROM |

El código de cada modo se guarda por separado, así que puedes empezar en AdvanceCode y bajar a C sin perder nada. Al cambiar de modo se te pide confirmación.

## 8.2. AdvanceCode (funcional)

Lenguaje propio de **nivel medio** que transpila **1:1 a C** (sin recolector de basura ni `malloc`), pensado para el ARM7TDMI de la GBA. Elimina el puntos y coma (`;`) al final de línea — el transpilador los coloca en el C — y usa llaves `{}` para los bloques.

### Lógica y contrato

La unidad es `logic <Nombre> for <Entidad>`. Sus bloques `on start` / `on update` son **el contrato del motor**:

```advancecode
logic Puerta for Hero {
  mutable abierta: bool = false

  on start {
    abierta = false
  }

  on update {
    if (input.pressed(BUTTON_A)) {
      abierta = true
    }
  }
}
```

- `on update` → `void script_update(void)`: se ejecuta **cada frame** (60 fps).
- `on start` → `void script_init(void)`: se ejecuta **una vez** al entrar en la escena.
- Dentro de ambos, `this` es **el actor al que está asignado el script** (en C, `gSelf`).

### Variables y datos

| AdvanceCode | C generado |
| :--- | :--- |
| `mutable vida: s16 = 3` | `static s16 vida = 3;` (RAM) |
| `static LIMITE: u16 = 240` | `static const u16 LIMITE = 240;` (ROM) |
| `entity Item { valor: u8  activo: bool }` | `typedef struct { u8 valor; u8 activo; } Item;` |

Tipos: `u8/s8`, `u16/s16`, `u32/s32`, `bool` (→ `u8`), `fixed` (→ `s16`, punto fijo a mano).

### Funciones

```advancecode
function doblar(mutable this, x: u16) -> u16 {
  return x * 2
}
```

Transpila a una función plana con prefijo de entidad (`Hero_doblar`). En los parámetros, `mutable this` / `this` se mapean al puntero del actor; dentro del cuerpo `this.campo` → `this->campo`.

### Control de flujo

| Sintaxis | C generado |
| :--- | :--- |
| `if cond { } else if cond { } else { }` | `if (cond) { } else if (cond) { } else { }` (paréntesis opcionales) |
| `while cond { }` | `while (cond) { }` |
| `for i in 0..10 { }` | `for (i = 0; i <= 10; i++) { }` |
| `for mutable i: u8 = 10, i > 0, i -= 2 { }` | `for (u8 i = 10; i > 0; i -= 2) { }` |

Operadores: `&&`, `||`, `!`, aritméticos y comparaciones clásicas.

### Entrada (input)

| AdvanceCode | Significado |
| :--- | :--- |
| `input.is_pressed(BUTTON_A)` | ¿está pulsado **ahora**? |
| `input.is_released(BUTTON_A)` | ¿está **sin pulsar** ahora? |
| `input.pressed(BUTTON_A)` | **flanco**: se pulsó justo **este frame** (una sola vez) |
| `keys` | atajo: máscara de teclas pulsadas (`~REG_KEYINPUT & 0x3FF`) |

Botones: `BUTTON_A/B/SELECT/START/RIGHT/LEFT/UP/DOWN/R/L`.

### Áreas y escenas

- `actor_in_area(otro)` → `1` si ese **otro** actor está dentro del **área del que ejecuta** el script (`this`). `otro` es el **índice** del actor (p.ej. `PLAYER_INDEX` o `1`).
- `actor_entered(otro)` / `actor_exit(otro)` → `1` **solo el frame** en que el otro actor entra/sale del área de `this` (flanco).
- `switchScene(n)`, `near(a, b, dist)`, `gJp`, `gScene`: la API multi-escena (ver [8.8](#88-cambiar-de-escena-desde-un-script)).

### Todo lo demás es C

Cualquier llamada que no sea del lenguaje (la API del motor, `REG_KEYINPUT`, `gActors`, …) se transpila **verbatim**. Eso permite usar directamente las primitivas de movimiento:

```advancecode
logic Hero for Hero {
  on update {
    moveTopDown(this, keys)      // o movePlatformer(this, keys)
  }
}
```

**Regla de oro:** lo que no se reconoce emite un **error de transpilación** que se lista en el inspector (pestaña Scripting → Exportación GBA) y el script **no entra a la ROM**. Nada de código basura.

## 8.3. C (funcional)

Cada script en modo **C** con código escrito se inserta *verbatim* en el `main.c` generado antes de `main()`. El contrato:

```c
void script_init(void)   // se llama UNA vez al entrar en la escena
void script_update(void) // se llama CADA frame del juego (60 fps)
```

- Debe haber **exactamente 1 definición** de cada función (los duplicados dan símbolo repetido y saltan avisos en la consola de export).
- API disponible: `gActors[]`, `PLAYER_INDEX`, `moveActorCollide()`, `movePlayer()`, `REG_KEYINPUT` (bits reales: 0=A 1=B 2=SELEC 3=START 4=RD 5=LEFT 6=UP 7=DOWN 8=R 9=L, **0 = pulsado**), `noteOn()` para SFX, y para multi-escena **`switchScene()`, `near()`, `gJp` y `gScene`** (ver [8.8](#88-cambiar-de-escena-desde-un-script)).
- Reglas de la plataforma: solo enteros (`u8/s16/int`), sin `float`, sin `malloc`, sin `printf`.

## 8.4. Asignar el script a un actor (obligatorio)

Un script **solo se compila en la ROM si está asignado a al menos un actor**. Si nadie lo usa, el export lo omite y avisa por consola.

Se asigna de dos formas equivalentes:

- **Pestaña Scripting** → selecciona el script → inspector → sección **Actores** → elige la **escena** en el primer desplegable y el **actor** en el segundo. El actor queda asignado (aparece en la lista *Asignados*, con ✕ para quitarlo).
- **Pestaña Mundo** → selecciona el actor → inspector → campo **Script**.

Cada actor admite un solo script (marcarlo en otro script lo reasigna). Al eliminar un script, la asignación se limpia sola en todos los actores.

Con `this` (AdvanceCode) o `gSelf` (C) el script apunta al actor que lo está ejecutando, así que un mismo script sirve para varios actores:

```c
void script_update(void) {
  GBAActor* p = gSelf;   // el actor al que está asignado ESTE script
  u16 keys = ~REG_KEYINPUT & 0x3FF;
  if (keys & (1 << 4)) moveActorCollide(p, 2, 0);
}
```

## 8.5. Indicador de exportación

La pestaña Scripting muestra en el título y en el inspector en qué estado está el script:

| Estado | Significado |
| :--- | :--- |
| **Se exporta** | Tiene código, está asignado a ≥1 actor y define `on update`/`script_update()`. Entra en la ROM. |
| **Sin asignar** | Tiene código pero ningún actor lo usa → **no se exporta**. |
| **Falta script_update** | Está asignado, pero sin `on update`/`script_update()` el motor no ejecutará nada. |
| **Errores** | (solo AdvanceCode) la transpilación falló; se listan los errores en el inspector y el script no entra a la ROM. |
| **Vacío** | No hay código escrito. |
| **Próximamente** | Modo Bloques (aún no genera código). |

## 8.6. Ayudas del editor

- **Insertar**: botones con los fragmentos más usados (contrato `on start`/`on update`, variables, `si/si no`, topdown/plataformas, `actor_in_area`, `actor_entered`…). El catálogo cambia según el modo (AdvanceCode o C).
- **Atajos**: `Tab` indenta (o desindenta con `Shift+Tab`) la línea o el bloque seleccionado, `Enter` conserva la indentación y añade un nivel tras `{`, y `Ctrl+/` comenta o descomenta la línea.
- **Auto-cierre**: al escribir `{`, `(` o `[` se inserta su pareja; al escribir el cierre con la pareja justo al lado, solo avanza el cursor.
- **Balance**: la barra superior avisa si quedan llaves o paréntesis sin cerrar (ignora comentarios y cadenas).
- **Minimapa**: la columna de la derecha muestra una barrita por línea (el ancho es la longitud de la línea y el color el de su sintaxis, para ver de un vistazo dónde están los comentarios). El rectángulo claro marca la zona que estás viendo: haz clic o arrástralo para desplazarte, y la línea que toques queda en el centro. Si el archivo es más largo que el panel, las líneas se comprimen para que quepan todas. Se enciende y apaga con el botón **minimapa** de la barra.

### Movimiento: no escribas la física a mano

El template trae dos primitivas listas. Si tu actor se mueve con el D-pad, esto es todo tu script:

```c
void script_update(void) {
  u16 keys = ~REG_KEYINPUT & 0x3FF;
  movePlatformer(gSelf, keys);   // plataformas: gravedad, salto, coyote, buffer
  // o bien:
  // moveTopDown(gSelf, keys);    // laberinto / RPG / menús, sin gravedad
}
```

En AdvanceCode es aún más corto: `moveTopDown(this, keys)`.

Ambas respetan los tiles de colisión, se ajustan con `#define` (`WALK_SPEED`, `JUMP_VEL`, `GRAVITY`…) y no te obligan a nada: si no encajan, mueve `gSelf` a mano. Detalle en [10.10](10-programar-c-gba.md#primitivas-de-movimiento-listos-para-usar).

### Velocidad de la animación (`animSpeed`)

Las animaciones corren **siempre a su cadencia exacta** (los `delays` que pusiste en el sprite): el motor no acelera nada automáticamente al caminar. Si quieres que la zancada del que camina avance más rápido mientras se mueve, súbele el campo `animSpeed` a **ese actor** solo mientras lo estés moviendo:

```c
void script_update(void) {
  u16 keys = ~REG_KEYINPUT & 0x3FF;
  if (keys & (KEY_UP | KEY_DOWN | KEY_LEFT | KEY_RIGHT)) {
    moveTopDown(gSelf, keys);
    gSelf->animSpeed = 2;   // solo este actor, solo mientras camina
  } else {
    gSelf->animSpeed = 1;   // cadencia exacta al parar
  }
}
```

`animSpeed` es el paso por vsync del avance (`0/1` = normal, `2` = doble, …) y solo afecta al actor que lo tocas; los NPC quietos siguen con su cadencia normal. Más detalle en [10.8](10-programar-c-gba.md#la-cadencia-de-la-animación-y-animspeed).

## 8.7. Áreas (regiones del actor)

El **área** es una propiedad del **actor**, igual que su caja de colisión: un rectángulo (Ancho / Alto / Offset) que va pegado a él y **se mueve con él**. Sirve para detección de zonas desde el script del propio actor: «¿el jugador está dentro de mi área?».

Cómo definirla:

1. Pestaña **Mundo** → selecciona el actor → inspector → sección **Área**.
2. Activa el interruptor y ajusta **Ancho área / Alto área / Offset X / Offset Y** (por defecto, el tamaño del sprite).
3. El rectángulo azul se dibuja sobre la tarjeta del actor para que veas su alcance.

Desde el script (AdvanceCode), el área consultada es **la del actor que ejecuta** (`this`); el argumento es el **índice del otro** actor:

```advancecode
logic Puerta for Trigger {
  on update {
    if (actor_in_area(PLAYER_INDEX)) {
      this.animSpeed = 2        // el jugador está dentro de mi área
    }

    if (actor_entered(PLAYER_INDEX)) {
      switchScene(1)            // al entrar en mi área, cambia de escena una sola vez
    }
  }
}
```

En C los hooks son `actorInArea(gSelf, &gActors[PLAYER_INDEX])`, `actorEnteredArea(...)`, `actorExitedArea(...)`, `actorOutArea(...)`. Se admiten hasta **32 actores** (el contacto se guarda como bitmask por actor).

## 8.8. Cambiar de escena desde un script

El export **embebe todas las escenas del proyecto** en la ROM. Para saltar de una a otra usa `switchScene(n)`, donde **n es el orden en el editor** (la escena 0 es la primera de la lista de Mundo, la última es `N-1`).

Lo típico: un NPC con su script hace de puerta. Interactúa y cambias de escena:

```c
void script_update(void) {
  // pegados + pulsas A → escena 1 (segunda de la lista)
  if (near(gSelf, &gActors[PLAYER_INDEX], 20) && (gJp & KEY_A)) {
    switchScene(1);
  }
}
```

En AdvanceCode:

```advancecode
logic Puerta for NPC {
  on update {
    if (input.pressed(BUTTON_A) && actor_in_area(PLAYER_INDEX)) {
      switchScene(1)
    }
  }
}
```

- `actor_in_area(PLAYER_INDEX)`: `1` si el jugador está dentro del **área del propio NPC** (la que dibujas en el inspector del actor; ver [8.7](#87-áreas-regiones-del-actor)).
- `gJp`: flanco de teclas — bits pulsados **solo este frame** (mismos bits que `REG_KEYINPUT`). Para que una acción de botón ocurra una vez, no todo el rato.
- `gScene`: la escena actual (lectura).
- `near(a, b, dist)`: solo disponible en C; ACod no admite la `&` unaria, así que para proximidad usa `actor_in_area`.

### Elegir la animación de transición por nombre

La conexión origen→destino de cada escena puede tener su propia **transición de entrada** ([Mundo → inspector de la conexión](05-mundo.md)). Al hacer `switchScene(n)` el motor usa la de la conexión `gScene→n`; si quieres desambiguar (varias conexiones al mismo destino), pásale el **nombre** de la conexión como 2º argumento:

```c
switchScene(1);            // primera conexión hacia la escena 1
switchScene(1, "puerta");  // la conexión llamada "puerta"
```

En AdvanceCode se escribe igual (`switchScene(1, "puerta")`). Si no hay conexión coincidente se usa el fade por defecto. El nombre se edita en el campo **Nombre** del inspector de la conexión; si lo dejas vacío se usa el nombre del tileset/gradiente elegido.

Al cambiar, el motor reproduce la transición configurada (fade/cortinilla/tileset), carga imagen/colisión/cámara/actores (con sus áreas y scripts) de la escena nueva y termina de revelarla. Cada escena usa sus propios actores: el que en la escena nueva tiene el script «puerta» es el que reacciona. Detalle completo (incluido cómo se numeran y la música): [10.15 en 10](10-programar-c-gba.md#1015-varias-escenas-en-la-rom-switchscene-near-y-gjp).

> 📖 **Para aprender a fondo, lee [10 — Programar en C para la GBA](10-programar-c-gba.md)**: hardware, mapa de memoria, MODE 3, actores, colisiones, sonido, ejemplos completos de scripts y cheat-sheet final.

---

**Anterior:** [07 — Módulo Diálogo](07-dialogo.md) · **Siguiente:** [09 — Exportar y probar](09-exportar.md)
