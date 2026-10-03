Aquí tienes el resumen completo de todo lo que hemos diseñado y acordado para el lenguaje de Advance Engine:

Filosofía y Arquitectura: Lenguaje de nivel medio con relación de transpilación 1:1 hacia código C, sin recolector de basura ni memoria dinámica (malloc), optimizado para el procesador ARM7TDMI de la Game Boy Advance.

Tipos de Datos Nativos:

u8 / s8: Enteros de 8 bits (sin signo / con signo).

u16 / s16: Enteros de 16 bits para coordenadas y registros.

u32 / s32: Enteros de 32 bits para cálculos grandes.

fixed: Matemáticas con punto fijo (supliendo la falta de FPU nativo).

bool: Valores booleanos (true / false).

Declaración de Variables:

mutable: Para variables que cambian y residen en memoria RAM (EWRAM/IWRAM), por ejemplo mutable pos_x: s16 = 120.

static: Para valores fijos grabados en la memoria ROM del cartucho, por ejemplo static LIMITE_PANTALLA: u16 = 240.

Estructura de Datos: Bloque entity para definir el molde de datos de los elementos del juego (transpila a un typedef struct en C).

Bloque de Lógica y Comportamiento: logic <Nombre> for <Entity> para implementar funciones separadas de los datos (transpila a funciones planas en ROM con prefijo de entidad).

Declaración de Funciones: Palabra clave function.

Referencia al Objeto: this explícito en los parámetros de la función (ej. mutable this para modificar la entidad o this para solo lectura, mapeándose a un puntero en C).

Estructuras de Control:

if, else if, else: Paréntesis obligatorios en las condiciones y operadores clásicos (&&, ||, !).

while: Bucle condicional con paréntesis obligatorios y bloque entre llaves {}.

for (Rango Simplificado): Sintaxis moderna con in y .., por ejemplo for (i in 0..10).

for (Control Manual): Sintaxis explícita con elementos separados por comas, por ejemplo for (mutable i: u8 = 10, i > 0, i -= 2).

Comentarios:

Línea única con //.

Multilínea con /* ... */.

Estilo Visual General: Bloques delimitados por llaves {} y eliminación de puntos y coma ; al final de las líneas.

Sistema de Entrada (Input): Objeto global input con métodos semánticos (input.is_pressed(...) e input.is_released(...)) y constantes de botones de GBA (BUTTON_A, BUTTON_UP, etc.), que transpilan directamente a operaciones de máscaras de bits sobre REG_KEYINPUT.