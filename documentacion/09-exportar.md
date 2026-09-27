# 09 — Exportar y probar

## 9.1. Emulador integrado (PLAY / STOP)

El botón **PLAY** de la barra del editor compila el estado actual del proyecto (genera el código C, lo compila con devkitARM y produce la ROM) y la ejecuta en el **emulador integrado** dentro de la aplicación. El botón **STOP** detiene el emulador.

- Requiere tener **devkitARM** instalado (ver [00 — Primeros pasos](00-inicio.md)).
- Es la forma más rápida de probar escenas, actores y transiciones sin salir del editor.
- **Nota:** el emulador integrado es más tolerante que el hardware real con el reparto de tiempos (no muestra ciertos defectos de timing). Para asegurarte del rendimiento final, prueba la ROM en un emulador fiel (p. ej. mGBA) o en una consola real.

![CAPTURA: emulador integrado ejecutando la ROM con el botón PLAY → `assets/emulador-play.png`]

## 9.2. Exportar la ROM

El botón **EXPORT** abre un menú con las acciones de salida:

- **Guardar proyecto:** persiste el estado actual.
- **Exportar ROM GBA:** guarda el proyecto, compila y genera la **ROM ejecutable** (archivo `.gba`), y abre automáticamente la carpeta de build del proyecto.
- **Exportar canciones / sprites / fondos / scripts:** extrae recursos individuales (útil si se perdió el asset de origen).
- **Abrir carpeta del proyecto:** abre la carpeta raíz del proyecto en el explorador.

La ROM exportada puede correrse en cualquier emulador de GBA o volcarse a una **flashcart** para probarla en consola real.

![CAPTURA: menú EXPORT desplegado con “Exportar ROM GBA” → `assets/exportar-rom.png`]

## 9.3. Consola de depuración

El panel inferior del editor registra la salida del pipeline:

- Carga de proyectos y rutas de assets.
- Salida de compilación al usar **PLAY** o **Exportar ROM GBA**.
- Alertas de dependencias faltantes, rendimiento y código no utilizado.

![CAPTURA: consola inferior con la salida de compilación → `assets/editor-consola.png`]

## 9.4. Límites de la plataforma GBA

El GBA dibuja por software (sin hardware de sprites); todo el render de la escena ocurre dentro del intervalo de **VBLANK** (~83.800 ciclos por frame, 68 líneas × 1232 ciclos). Si el trabajo supera ese tiempo, la aplicación pierde frames y las animaciones se ralentizan.

### Regla de presupuesto
El límite no es un número fijo de actores: es la **cantidad de píxeles de sprite visibles por la cámara**:

```
~83.800 ciclos ÷ ~15 ciclos por píxel ≈ ~5.600 px de sprite en cámara por frame
```

| Combinación de sprites | ¿Cabe? |
| :--- | :--- |
| 5-6 actores de 21×31 px (651 px c/u) | Cómodo |
| 1 actor de 64×64 px (4096 px) + 2 de 16×16 | Bien |
| ~21 actores de 16×16 px (256 px c/u) | Al límite |
| Más elementos en el encuadre activo | Ralentiza animaciones |

### Actores fuera de cámara
- Los actores **fuera de la cámara apenas gastan VBLANK**: solo el recorte de su rectángulo y la actualización de sus timers (~decenas de ciclos).
- Un actor **parcialmente fuera** de pantalla solo paga la parte visible.
- Puedes colocar **todos los actores que quieras** en la escena; solo cuentan los que el encuadre enfoca en ese momento.

### Otros límites
- **Memoria:** no es el límite. El fondo de los actores (`gActorBack`) es 240×160 en EWRAM (~76.8 KB), los frames de los sprites van en ROM y la lista de actores es pequeña.
- **Transiciones:** una transición de tileset de 30×20 tiles × 8 frames × velocidad 5 equivale a ~24.000 vsyncs ≈ 6-7 minutos; ajusta la velocidad en el inspector para acortarla.

---

**Anterior:** [08 — Scripting](08-scripting.md) · **Siguiente:** [10 — Programar en C para la GBA](10-programar-c-gba.md) · **Volver al [índice](README.md)**