import { getAudioContext } from './gba_audio';

// ── Conversión de audio a PCM de la GBA ─────────────────────────────────────
// La GBA no decodifica MP3/OGG/WAV: lo único nativo para muestras son los
// canales DMA de sonido (A/B), que reproducen PCM de 8 bits CON SIGNO en mono a
// una velocidad fija por un timer. Así que al importar se convierte el archivo a
// ese formato (downmix a mono + remuestreo + normalización) para que entre en la
// ROM y suene como en el editor.

export interface GbaPcm {
  base64: string;   // PCM 8-bit signed, mono, little-endian (bytes directos)
  bytes: number;
  rate: number;     // Hz de reproducción (el timer de la ROM)
  duration: number; // segundos
  peak: number;     // pico original (0-1) antes de normalizar
}

/** Velocidades típicas: menos Hz = menos ROM pero más "lo-fi". */
export const GBA_SAMPLE_RATES = [8000, 11025, 16000, 22050];

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]);
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Decodifica un archivo de audio y lo convierte a PCM 8-bit signed mono.
 * `filePath` es la ruta en disco; se lee por IPC.
 */
export async function convertAudioToGbaPcm(filePath: string, targetRate: number): Promise<GbaPcm | null> {
  const api = window.advanceAPI;
  const res = await api.file.readBinary(filePath);
  if (!res.success || !res.base64) return null;

  const raw = base64ToBytes(res.base64);
  const ctx = getAudioContext();
  // decodeAudioData consume el ArrayBuffer; se copia para no perder el original.
  const audioBuf = await ctx.decodeAudioData(raw.buffer.slice(0) as ArrayBuffer);

  const channels = audioBuf.numberOfChannels;
  const srcLen = audioBuf.length;
  const srcRate = audioBuf.sampleRate;
  const duration = audioBuf.duration;

  // Downmix a mono
  const chans: Float32Array[] = [];
  for (let c = 0; c < channels; c++) chans.push(audioBuf.getChannelData(c));
  const mono = new Float32Array(srcLen);
  let peak = 0;
  for (let i = 0; i < srcLen; i++) {
    let v = 0;
    for (let c = 0; c < channels; c++) v += chans[c][i];
    v /= channels;
    mono[i] = v;
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  if (peak <= 0) peak = 1;

  // Remuestreo lineal a targetRate
  const outLen = Math.max(1, Math.round(duration * targetRate));
  const bytes = new Uint8Array(outLen);
  const gain = 0.95 / peak; // normaliza para aprovechar el rango de 8 bits
  for (let i = 0; i < outLen; i++) {
    const srcPos = (i / targetRate) * srcRate;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, srcLen - 1);
    const frac = srcPos - i0;
    const s = mono[i0] * (1 - frac) + mono[i1] * frac;
    let v = Math.round(s * gain * 127);
    if (v > 127) v = 127;
    if (v < -128) v = -128;
    bytes[i] = v & 0xff; // complemento a dos
  }

  return {
    base64: toBase64(bytes),
    bytes: outLen,
    rate: targetRate,
    duration,
    peak,
  };
}

/** Crea un AudioBuffer con el PCM ya convertido (para previsualizar la versión GBA). */
export function pcmToAudioBuffer(base64: string, rate: number): AudioBuffer {
  const ctx = getAudioContext();
  const raw = base64ToBytes(base64);
  const buf = ctx.createBuffer(1, raw.length, rate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i] < 128 ? raw[i] : raw[i] - 256; // int8
    data[i] = v / 128;
  }
  return buf;
}

/** Bytes aproximados para una duración y velocidad dadas (para el aviso previo). */
export function estimatePcmBytes(duration: number, rate: number): number {
  return Math.max(1, Math.round(duration * rate));
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
