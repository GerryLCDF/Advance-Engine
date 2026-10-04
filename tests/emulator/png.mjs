// Decodificador PNG mínimo (solo bitDepth 8, colorType 2/6) usando zlib de Node.
// Existe para no meter una dependencia de imagen solo para "leer píxeles".
import { inflateSync } from 'node:zlib';

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** @returns {{width:number,height:number,channels:number,pixels:Uint8Array}} */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('no es un PNG');

  let pos = 8;
  let ihdr = null;
  const idat = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        bitDepth: body[8],
        colorType: body[9],
      };
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }

  if (!ihdr) throw new Error('PNG sin IHDR');
  if (ihdr.bitDepth !== 8) throw new Error(`bitDepth ${ihdr.bitDepth} no soportado`);
  const channels = ihdr.colorType === 6 ? 4 : ihdr.colorType === 2 ? 3 : 0;
  if (!channels) throw new Error(`colorType ${ihdr.colorType} no soportado`);

  const raw = inflateSync(Buffer.concat(idat));
  const { width, height } = ihdr;
  const stride = width * channels;
  const out = new Uint8Array(stride * height);

  // Cada scanline lleva un byte de filtro inicial.
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    const up = dst - stride;
    for (let x = 0; x < stride; x++) {
      const rv = raw[src + x];
      const a = x >= channels ? out[dst + x - channels] : 0;
      const b = y > 0 ? out[up + x] : 0;
      const c = x >= channels && y > 0 ? out[up + x - channels] : 0;
      let v;
      switch (filter) {
        case 0: v = rv; break;
        case 1: v = rv + a; break;
        case 2: v = rv + b; break;
        case 3: v = rv + ((a + b) >> 1); break;
        case 4: v = rv + paeth(a, b, c); break;
        default: throw new Error(`filtro PNG desconocido: ${filter}`);
      }
      out[dst + x] = v & 0xff;
    }
  }

  return { width, height, channels, pixels: out };
}

/** Resumen útil para "¡esto dibuja o no dibuja?". */
export function analyze(img, step = 1) {
  const { width, height, channels, pixels } = img;
  const seen = new Set();
  let max = 0, sum = 0, n = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * channels;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      max = Math.max(max, lum);
      sum += lum;
      n++;
      seen.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
    }
  }

  return {
    width, height,
    colores: seen.size,
    lumMedia: sum / n,
    lumMax: max,
    negro: max === 0,
  };
}