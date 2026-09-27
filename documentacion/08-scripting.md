# 08 — Scripting

> **Estado:** C Directo funcional; Bloques y AdvanceCode próximamente.

El módulo **Scripting** es el entorno dedicado a la lógica del juego: comportamiento de actores, eventos globales y mecánicas.

## 8.1. Modos de script

| Modo | Estado |
| :--- | :--- |
| **Bloques** | Visual, próximamente |
| **AdvanceCode** | Sintaxis propia, próximamente |
| **C Directo** | **Funcional**: se compila e inserta en la ROM |

## 8.2. C Directo (funcional)

Cada script en modo **C Directo** con código escrito se inserta *verbatim* en el `main.c` generado antes de `main()`. El contrato:

```c
void script_init(void)   // se llama UNA vez al entrar en la escena
void script_update(void) // se llama CADA frame del juego (60 fps)
```

- Debe haber **exactamente 1 definición** de cada función (los duplicados dan símbolo repetido y saltan avisos en la consola de export).
- API disponible: `gActors[]`, `PLAYER_INDEX`, `moveActorCollide()`, `movePlayer()`, `REG_KEYINPUT` (bits reales: 0=A 1=B 2=SELEC 3=START 4=RD 5=LEFT 6=UP 7=DOWN 8=R 9=L, **0 = pulsado**), y `noteOn()` para SFX.
- Reglas de la plataforma: solo enteros (`u8/s16/int`), sin `float`, sin `malloc`, sin `printf`.

## 8.3. Asignar el script a un actor (obligatorio)

Un script **solo se compila en la ROM si está asignado a al menos un actor**. Si nadie lo usa, el export lo omite y avisa por consola.

Se asigna de dos formas equivalentes:

- **Pestaña Scripting** → selecciona el script → inspector → sección **Actores** → elige la **escena** en el primer desplegable y el **actor** en el segundo. El actor queda asignado (aparece en la lista *Asignados*, con ✕ para quitarlo).
- **Pestaña Mundo** → selecciona el actor → inspector → campo **Script**.

Cada actor admite un solo script (marcarlo en otro script lo reasigna). Al eliminar un script, la asignación se limpia sola en todos los actores.

Con `gSelf` el script apunta al actor que lo está ejecutando, así que un mismo script sirve para varios actores:

```c
void script_update(void) {
  GBAActor* p = gSelf;   // el actor al que está asignado ESTE script
  u16 keys = ~REG_KEYINPUT & 0x3FF;
  if (keys & (1 << 4)) moveActorCollide(p, 2, 0);
}
```

## 8.4. Indicador de exportación

La pestaña Scripting muestra en el título y en el inspector en qué estado está el script:

| Estado | Significado |
| :--- | :--- |
| **Se exporta** | Modo C, con código, asignado a ≥1 actor y define `script_update()`. Entra en la ROM. |
| **Sin asignar** | Tiene código pero ningún actor lo usa → **no se exporta**. |
| **Falta script_update** | Está asignado, pero sin `script_update()` el motor no ejecutará nada. |
| **Vacío** | No hay código escrito. |
| **Próximamente** | Modo Bloques o AdvanceCode (aún no generan código). |

## 8.5. Ayudas del editor

- **Insertar**: botones con los fragmentos más usados (`script_update()`, `script_init()`, leer teclas, mover `gSelf`, bucle de frames, datos del actor) que se insertan en la posición del cursor.
- **Atajos**: `Tab` indenta (o desindenta con `Shift+Tab`) la línea o el bloque seleccionado, `Enter` conserva la indentación y añade un nivel tras `{`, y `Ctrl+/` comenta o descomenta la línea.
- **Auto-cierre**: al escribir `{`, `(` o `[` se inserta su pareja; al escribir el cierre con la pareja justo al lado, solo avanza el cursor.
- **Balance**: la barra superior avisa si quedan llaves o paréntesis sin cerrar (ignora comentarios y cadenas).

> 📖 **Para aprender a fondo, lee [10 — Programar en C para la GBA](10-programar-c-gba.md)**: hardware, mapa de memoria, MODE 3, actores, colisiones, sonido, ejemplos completos de scripts y cheat-sheet final.

---

**Anterior:** [07 — Módulo Diálogo](07-dialogo.md) · **Siguiente:** [09 — Exportar y probar](09-exportar.md)