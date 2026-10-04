import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/emulator',
  testMatch: /.*\.(spec|smoke)\.mjs/,
  // El emulador tarda en cargar el core (WASM de 1 MB) y compilar la ROM de
  // prueba con devkitARM. Por eso el timeout es holgado.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
});