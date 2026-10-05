import { defineConfig } from '@playwright/test';

// Humo de la app Electron real (esquema app://, IPC, ventana y botones).
//
// Va en su propia configuración a propósito: lanza la aplicación completa, que
// carga un Chromium por cada test. Si compartiese pasada con los tests de HTTP
// los dos perfiles se pelean por la CPU y ambos se vuelven intermitentes.
export default defineConfig({
  testDir: './tests/emulator',
  testMatch: /.*\.smoke\.mjs/,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
});
