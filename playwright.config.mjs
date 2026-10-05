import { defineConfig } from '@playwright/test';

// Emulación servida por HTTP: es el camino del export web y el que Core usa el
// Chromium headless. Rápido y sin ventana de por medio.
export default defineConfig({
  testDir: './tests/emulator',
  testMatch: /.*\.spec\.mjs/,
  // Cargar el core (WASM de 1 MB) y compilar la ROM de prueba lleva su rato.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
});
