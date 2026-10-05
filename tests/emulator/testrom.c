// ROM de prueba del emulador. NO es un juego: dibuja cosas que el test puede
// medir con precisión para distinguir "emula de verdad" de "pantalla negra".
//
// Tres señales, todas en pantalla:
//
//  1. Fondo: damero de dos verdes. Garantiza >1 color y que no sea negro, así que
//     si el test ve negro es que el core no está dibujando.
//
//  2. Cuadro central: blanco si se pulsa A/B/START, si no un rojo que recorre
//     0..31. Sirve para comprobar que la emulación avanza y que una tecla llega.
//
//  3. Tira de 10 celdas (esquina superior izquierda, 8x8 cada una), una por bit
//     de REG_KEYINPUT en orden: A B SELECT START RIGHT LEFT UP DOWN R L.
//     La celda se pone blanca si ese botón está pulsado. Es lo que permite
//     verificar que CADA botón va al botón GBA correcto y no a otro.
//
// OJO con el modo de vídeo: se usa REG_DISPCNT = MODE_3 | BG2_ENABLE tal cual lo
// usa el main.c que genera el exportador (gba_export.ts). Escribir
// `(3 << 12) | BG2_ON` parece equivalente y NO lo es: con eso sale negro.
#include <gba.h>

#define BOX 8
#define BOX_X ((240 - BOX) / 2)
#define BOX_Y ((160 - BOX) / 2)

#define CELL 8
#define CELLS 10

// Espera a VBlank polledando VCOUNT. Con VBlankIntrWait() esta ROM se quedaba
// colgada: sin handler de IRQ, la espera por IRQ no termina nunca.
static void waitVBlank(void) {
  while (REG_VCOUNT >= 160) {}
  while (REG_VCOUNT < 160) {}
}

static void fillRect(int x, int y, int w, int h, u16 color) {
  for (int j = y; j < y + h; j++) {
    vu16* row = &((vu16*)VRAM)[j * 240 + x];
    for (int i = 0; i < w; i++) row[i] = color;
  }
}

int main(void) {
  REG_DISPCNT = MODE_3 | BG2_ENABLE;

  vu16* vram = (vu16*)VRAM;

  // Fondo fijo: damero. Se pinta una sola vez.
  for (int y = 0; y < 160; y++) {
    for (int x = 0; x < 240; x++) {
      vram[y * 240 + x] = ((x + y) & 1) ? RGB5(4, 28, 4) : RGB5(4, 16, 4);
    }
  }

  u32 counter = 0;
  for (;;) {
    counter++;

    u16 pressed = (u16)(~REG_KEYINPUT & 0x3FF);

    // (2) cuadro central
    u16 color = (pressed & (KEY_A | KEY_B | KEY_START))
      ? RGB5(31, 31, 31)
      : RGB5(counter & 0x1F, 0, 0);
    fillRect(BOX_X, BOX_Y, BOX, BOX, color);

    // (3) tira de celdas: bit i → celda i
    for (int i = 0; i < CELLS; i++) {
      fillRect(i * CELL, 0, CELL, CELL,
               (pressed & (1 << i)) ? RGB5(31, 31, 31) : RGB5(1, 1, 1));
    }

    waitVBlank();
  }
}