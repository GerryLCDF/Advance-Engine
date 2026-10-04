# Assets de EmulatorJS (vendorizados)

Estos archivos **no** se editan a mano. Se regeneran con:

```sh
node scripts/fetch-emulatorjs.mjs --force
```

| | |
|---|---|
| Origen | https://cdn.emulatorjs.org/stable/data/ |
| Canal | `stable` |
| Versión | 4.2.3 (current_version=999999) |
| Licencia del frontend | **GPLv3** — https://github.com/EmulatorJS/EmulatorJS |
| Core | `mgba` (mGBA compilado a WebAssembly) |
| Variante | `mgba-wasm.data` — **sin hilos** |
| Motivo de sin hilos | los hilos exigen cabeceras COOP/COEP: imposibles en `file://` y caprichosas en itch.io |

## Nota de licencia

EmulatorJS es GPLv3. Distribuir el export web o el `.exe` con estos assets dentro
obliga a ofrecer también el código fuente de EmulatorJS. La forma de cumplirlo en
la práctica es subir su `LICENSE` (https://github.com/EmulatorJS/EmulatorJS/blob/main/LICENSE)
junto al juego exportado y enlazar al proyecto original.

## Nota de `loader.js`

El `loader.js` original hace un `fetch` a `raw.githack.com` para comprobar si hay
una versión nueva. Ese chequeo está anulado desde el shell con
`EJS_paths['version.json']` apuntando al `version.json` local de esta carpeta.
