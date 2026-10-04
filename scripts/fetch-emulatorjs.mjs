#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Descarga los assets de EmulatorJS para servirlos SELF-HOSTEADOS.
//
// El emulador del editor, el export web y el .exe usan la misma copia local,
// así que nada del runtime depende de cdn.emulatorjs.org.
//
// Uso:
//   node scripts/fetch-emulatorjs.mjs           # descarga si falta o cambia el tamaño
//   node scripts/fetch-emulatorjs.mjs --force   # vuelve a descargar todo
//
// Ver también public/emulator/ejs/PROVENANCE.md (generado por este script).
// ─────────────────────────────────────────────────────────────────────────────

import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'public', 'emulator', 'ejs');

// Canal estable del CDN. 'stable' resuelve a la última versión publicada.
// Ojo: usar un número de versión viejo (p.ej. 0.4.26) NO sirve — ese layout solo
// trae nes/snes y sus rutas emu-main.js/emulator.js son de otra generación.
const CHANNEL = 'stable';
const BASE = `https://cdn.emulatorjs.org/${CHANNEL}/data/`;

// El core de GBA. Sin hilos a propósito: los hilos exigen cabeceras
// COOP/COEP, imposibles en file:// y caprichosas en itch.io.
// mgba-thread-wasm.data sería el equivalente con hilos (otros ~1 MB).
const FILES = [
  { url: 'loader.js', out: 'loader.js' },
  { url: 'emulator.min.js', out: 'emulator.min.js' },
  { url: 'emulator.min.css', out: 'emulator.min.css' },
  { url: 'version.json', out: 'version.json' },
  { url: 'localization/es-ES.json', out: 'localization/es-ES.json' },
  { url: 'localization/en-US.json', out: 'localization/en-US.json' },

  // Core de GBA. Los tres se piden sí o sí:
  //  - mgba-wasm.data         → WebGL2 (el camino normal)
  //  - mgba-legacy-wasm.data  → WebGL1, lo intenta como compatibilidad
  //  - reports/mgba.json      → sin esto EJS avisa "Core caching will be
  //                             disabled"; con EJS_cacheConfig apagado da igual,
  //                             pero el aviso ensucia la consola
  { url: 'cores/mgba-wasm.data', out: 'cores/mgba-wasm.data' },
  { url: 'cores/mgba-legacy-wasm.data', out: 'cores/mgba-legacy-wasm.data' },
  { url: 'cores/reports/mgba.json', out: 'cores/reports/mgba.json' },

  // Descompresores. No los usamos (la ROM siempre es un .gba pelado), pero EJS
  // los pide al arrancar y si no están busca en el CDN — que es justo lo que
  // queremos evitar.
  { url: 'compression/extract7z.js', out: 'compression/extract7z.js' },
  { url: 'compression/extractzip.js', out: 'compression/extractzip.js' },
];

const force = process.argv.includes('--force');
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

async function alreadyThere(out, expected) {
  if (force || expected == null) return false;
  try {
    const s = await stat(join(OUT, out));
    return s.size === expected;
  } catch {
    return false;
  }
}

async function main() {
  console.log(`EmulatorJS → ${OUT}`);
  console.log(`Canal: ${CHANNEL}  (${BASE})\n`);

  // 1. Resolver la versión concrete para dejar constancia en PROVENANCE.md.
  let version = 'desconocida';
  try {
    const res = await fetch(`${BASE}version.json`);
    const json = await res.json();
    version = json.version ? `${json.version} (current_version=${json.current_version})` : String(json.current_version);
  } catch (err) {
    console.warn(`  ! no se pudo leer version.json: ${err.message}`);
  }
  console.log(`Versión resuelta: ${version}\n`);

  // 2. Descargar lo que falte.
  let total = 0;
  for (const file of FILES) {
    let expected = null;
    try {
      const head = await fetch(BASE + file.url, { method: 'HEAD' });
      if (head.ok) expected = Number(head.headers.get('content-length')) || null;
    } catch { /* sin HEAD: se descarga siempre */ }

    if (await alreadyThere(file.out, expected)) {
      total += expected ?? 0;
      console.log(`  = ${file.out.padEnd(28)} ya está (${kb(expected ?? 0)})`);
      continue;
    }

    const res = await fetch(BASE + file.url);
    if (!res.ok) throw new Error(`${file.url} → HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) throw new Error(`${file.url} → respuesta vacía`);
    if (expected != null && buf.length !== expected) {
      throw new Error(`${file.url} → tamaño ${buf.length}, esperado ${expected}`);
    }

    const dest = join(OUT, file.out);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    total += buf.length;
    console.log(`  + ${file.out.padEnd(28)} ${kb(buf.length)}`);
  }

  // 3. Dejar constancia de qué es esto y de dónde salió.
  const provenance = `# Assets de EmulatorJS (vendorizados)

Estos archivos **no** se editan a mano. Se regeneran con:

\`\`\`sh
node scripts/fetch-emulatorjs.mjs --force
\`\`\`

| | |
|---|---|
| Origen | ${BASE} |
| Canal | \`${CHANNEL}\` |
| Versión | ${version} |
| Licencia del frontend | **GPLv3** — https://github.com/EmulatorJS/EmulatorJS |
| Core | \`mgba\` (mGBA compilado a WebAssembly) |
| Variante | \`mgba-wasm.data\` — **sin hilos** |
| Motivo de sin hilos | los hilos exigen cabeceras COOP/COEP: imposibles en \`file://\` y caprichosas en itch.io |

## Nota de licencia

EmulatorJS es GPLv3. Distribuir el export web o el \`.exe\` con estos assets dentro
obliga a ofrecer también el código fuente de EmulatorJS. La forma de cumplirlo en
la práctica es subir su \`LICENSE\` (https://github.com/EmulatorJS/EmulatorJS/blob/main/LICENSE)
junto al juego exportado y enlazar al proyecto original.

## Nota de \`loader.js\`

El \`loader.js\` original hace un \`fetch\` a \`raw.githack.com\` para comprobar si hay
una versión nueva. Ese chequeo está anulado desde el shell con
\`EJS_paths['version.json']\` apuntando al \`version.json\` local de esta carpeta.
`;

  await writeFile(join(OUT, 'PROVENANCE.md'), provenance);

  console.log(`\nTotal: ${kb(total)} en ${OUT}`);
  console.log('Licencias y versión en public/emulator/ejs/PROVENANCE.md');
}

main().catch((err) => {
  console.error('\nFALLO:', err.message);
  process.exit(1);
});