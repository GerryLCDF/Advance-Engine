// ROM de prueba del emulador. NO es un juego: dibuja cosas que el test puede
// medir con precisión para distinguir "emula de verdad" de "pantalla negra".
//
//   - Fondo: damero de dos verdes. Garantiza >1 color y que no sea negro, así que
//     si el test ve negro es que el core no está dibujando.
//   - Cuadro central: su brillo = contador de frames. Si cambia entre muestras,
//     la emulación AVANZA (no es una imagen fija).
//   - A/B/START pulsado → el cuadro se pone blanco. Así el test comprueba que la
//     ENTRADA llega a la ROM, que es justo lo que un emulador en negro no
//     puede demostrar.
//
// OJO con el modo: se usa REG_DISPCNT = MODE_3 | BG2_ENABLE tal cual lo usa el
// main.c que genera el exportador (gba_export.ts). Escribir `(3 << 12) | BG2_ON`
// parece equivalente y NO lo es: con eso la pantalla sale negra.
#include <gba.h>

#define BOX 8
#define BOX_X ((240 - BOX) / 2)
#define BOX_Y ((160 - BOX) / 2)

// Espera a VBlank polledando VCOUNT. Con VBlankIntrWait() esta ROM se quedaba
// colgada: sin handler de IRQ, la espera por IRQ no termina nunca.
static void waitVBlank(void) {
  while (REG_VCOUNT >= 160) {}
  while (REG_VCOUNT < 160) {}
}

static void drawBox(u16 color) {
  for (int y = BOX_Y; y < BOX_Y + BOX; y++) {
    vu16* row = &((vu16*)VRAM)[y * 240 + BOX_X];
    for (int x = 0; x < BOX; x++) row[x] = color;
  }
}

int main(void) {
  REG_DISPCNT = MODE_3 | BG2_ENABLE;

  // Fondo fijo: damero. Se pinta una sola vez.
  vu16* vram = (vu16*)VRAM;
  for (int y = 0; y < 160; y++) {
    for (int x = 0; x < 240; x++) {
      vram[y * 240 + x] = ((x + y) & 1) ? RGB5(4, 28, 4) : RGB5(4, 16, 4);
    }
  }

  u32 counter = 0;
  for (;;) {
    counter++;

    int pressed = ~REG_KEYINPUT & 0x3FF;
    // Pulsado = blanco (máximo). Libre = el rojo recorre 0..31, o sea el cuadro
    // va cambiando de brillo en cada frame.
    u16 color = (pressed & (KEY_A | KEY_B | KEY_START))
      ? RGB5(31, 31, 31)
      : RGB5(counter & 0x1F, 0, 0);

    drawBox(color);

    waitVBlank();
  }
}