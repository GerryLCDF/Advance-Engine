// ── GBA Sound Chip Emulator (DMG + Wave + Noise) ──────────────────────────
// Emula los 4 canales del chip de sonido de Game Boy Advance con precisión.

const SAMPLE_RATE = 44100;
const TICK_RATE = 4194304; // GBA APU clock

// –––‑‑‑ Frecuencia ─────────────────────────────────────────────────────────
function hzToGBAFreq(hz: number): number {
  if (hz <= 0) return 0;
  const f = Math.round(2048 - 131072 / hz);
  return Math.max(0, Math.min(2047, f));
}

function gbaFreqToHz(gbaFreq: number): number {
  if (gbaFreq >= 2048) return 0;
  return 131072 / (2048 - gbaFreq);
}

// Mapeo duty: GBA 0=12.5%, 1=25%, 2=50%, 3=75%
const DUTY_MAP: Record<number, number> = { 12.5: 0, 25: 1, 50: 2, 75: 3 };

function dutyToGBA(duty: number): number {
  const closest = [12.5, 25, 50, 75].reduce((a, b) => Math.abs(b - duty) < Math.abs(a - duty) ? b : a);
  return DUTY_MAP[closest] ?? 2;
}

// Formas de onda pulse (8 pasos, 1=high)
const DUTY_WAVES: number[][] = [
  [0,0,0,0,0,0,0,1], // 12.5%
  [0,0,0,0,0,0,1,1], // 25%
  [0,0,0,0,1,1,1,1], // 50%
  [0,0,1,1,1,1,1,1], // 75%
];

// –––‑‑‑ polyBLEP (anti-alias para onda cuadrada) ───────────────────────────
function polyBLEP(t: number, dt: number): number {
  if (t < dt) {
    const r = t / dt;
    return 2 * r - r * r - 1;
  }
  if (t > 1 - dt) {
    const r = (t - 1) / dt;
    return -2 * r - r * r + 1;
  }
  return 0;
}

// –––‑‑‑ Envelope GBA ──────────────────────────────────────────────────────
// El envelope GBA cambia cada N/64 segundos donde N = sweepCount (1-7)
// Si sweepCount=0, el volumen es estático.
function envelopeVol(initial: number, direction: number, sweepCount: number, elapsedEnvs: number): number {
  if (sweepCount === 0) return initial;
  let vol = initial;
  for (let i = 0; i < elapsedEnvs; i++) {
    if (direction === 0) vol--; else vol++;
    if (vol < 0) vol = 0;
    if (vol > 15) vol = 15;
  }
  return vol;
}

// –––‑‑‑ Sweep de frecuencia (Pulse 1) ─────────────────────────────────────
function sweepFreq(gbaFreq: number, shift: number, direction: number, elapsed: number): number {
  if (shift === 0) return gbaFreq;
  for (let i = 0; i < elapsed; i++) {
    const offset = Math.floor(gbaFreq / Math.pow(2, shift));
    if (direction === 0) gbaFreq += offset; else gbaFreq -= offset;
    if (gbaFreq < 0) gbaFreq = 0;
    if (gbaFreq > 2047) gbaFreq = 2047;
  }
  return gbaFreq;
}

// –––‑‑‑ Generador Pulse ───────────────────────────────────────────────────
function generatePulse(
  gbaFreq: number,
  dutyIdx: number,
  vol: number,
  direction: number,
  envCount: number,
  sweepShift: number,
  sweepTime: number,
  totalSamples: number,
): Float32Array {
  const out = new Float32Array(totalSamples);
  if (gbaFreq === 0) return out;

  const wave = DUTY_WAVES[dutyIdx];
  const envSamples = Math.round(SAMPLE_RATE * (64 / 256)); // N/64 segundos → samples
  const sweepSamples = Math.round(SAMPLE_RATE * (128 / 256)); // sweeps cada N/128 seg

  for (let s = 0; s < totalSamples; s++) {
    // Envelope step
    const envIdx = Math.floor(s / Math.max(1, envSamples));
    const currentVol = envelopeVol(vol, direction, envCount, envIdx);

    // Sweep step (solo Pulse 1)
    const sweepIdx = sweepTime > 0 ? Math.floor(s / Math.max(1, sweepSamples * sweepTime)) : 0;
    const sweepF = sweepFreq(gbaFreq, sweepShift, direction, sweepIdx);
    const period = Math.max(1, Math.round(SAMPLE_RATE / gbaFreqToHz(sweepF)));

    // polyBLEP phase
    const phase = (s % period) / period;
    const dt = 1 / period;

    // Encontrar el cruce del duty
    const highLen = Math.round(wave.reduce((a, b) => a + b, 0));
    const dutyPhase = highLen / 8;

    // Square wave base con BLEP
    let value = phase < dutyPhase ? 1 : 0;
    value += polyBLEP(phase, dt);
    value -= polyBLEP((phase - dutyPhase + 1) % 1, dt);

    // DAC 4-bit: mapeo a ~linear con cuantización
    const dacLevel = currentVol / 15;
    out[s] = (value * 2 - 1) * dacLevel * 0.3;
  }

  return out;
}

// –––‑‑‑ Generador Wave ────────────────────────────────────────────────────
function generateWave(
  gbaFreq: number,
  waveBuffer: number[], // 32 nibbles 0-15
  vol: number,
  totalSamples: number,
): Float32Array {
  const out = new Float32Array(totalSamples);
  if (gbaFreq === 0 || waveBuffer.length < 32) return out;

  // GBA wave volume: 0=mute, 1=100%, 2=50%, 3=25%
  const volScale = [0, 1, 0.5, 0.25][Math.min(3, Math.max(0, Math.round(vol / 5)))];

  const period = Math.round(SAMPLE_RATE / gbaFreqToHz(gbaFreq));

  for (let s = 0; s < totalSamples; s++) {
    const pos = Math.floor((s % Math.max(1, period)) / Math.max(1, period) * 32);
    const nibble = waveBuffer[Math.min(31, pos)];
    out[s] = ((nibble - 7.5) / 7.5) * 0.25 * volScale;
  }

  return out;
}

// –––‑‑‑ Generador Noise (LFSR 15-bit) ──────────────────────────────────────
function generateNoise(
  dividingRatio: number,
  counterStep: number,
  envVol: number,
  direction: number,
  envCount: number,
  totalSamples: number,
): Float32Array {
  const out = new Float32Array(totalSamples);

  let lfsr = 0x7FFF;
  const bitWidth = counterStep === 0 ? 15 : 7;

  // Clock del LFSR: base = 524288 Hz, dividido por (dividingRatio * 2) o 0.5 si ratio=0
  const lfsrFreq = dividingRatio > 0 ? 524288 / (dividingRatio * 2) : 524288;
  const samplesPerClock = Math.round(SAMPLE_RATE / lfsrFreq);
  const envSamples = Math.round(SAMPLE_RATE * (64 / 256));

  for (let s = 0; s < totalSamples; s++) {
    // Envelope
    const envIdx = Math.floor(s / Math.max(1, envSamples));
    const cv = envelopeVol(envVol, direction, envCount, envIdx);

    // LFSR
    if (s % Math.max(1, samplesPerClock) === 0) {
      const xorBit = ((lfsr >> 0) & 1) ^ ((lfsr >> 1) & 1);
      lfsr = (lfsr >> 1) | (xorBit << (bitWidth - 1));
    }

    const bitOn = (lfsr & 1) === 0;
    out[s] = bitOn ? (cv / 15) * 0.3 : 0;
  }

  return out;
}

// –––‑‑‑ Public API ─────────────────────────────────────────────────────────
export interface GBAInstrumentParams {
  type: 'duty' | 'wave' | 'noise';
  freq: number;
  volume: number;
  dutyCycleValue: number;
  change: number;
  sweepShift: number;
  sweepTime: number;
  lengthEnabled: boolean;
  length: number;
  waveBuffer?: number[];
  duration: number;
}

export function generateGBABuffer(params: GBAInstrumentParams): Float32Array {
  const totalSamples = Math.round(SAMPLE_RATE * params.duration);
  const gbaFreq = hzToGBAFreq(params.freq);
  const absChange = Math.abs(params.change);
  const direction = params.change >= 0 ? 1 : 0;

  if (params.type === 'duty') {
    const dutyIdx = dutyToGBA(params.dutyCycleValue);
    return generatePulse(
      gbaFreq, dutyIdx,
      params.volume, direction, absChange,
      params.sweepShift, params.sweepTime,
      totalSamples,
    );
  }

  if (params.type === 'wave') {
    const wb = params.waveBuffer ?? defaultWaveBuffer();
    return generateWave(gbaFreq, wb, params.volume, totalSamples);
  }

  const baseRatio = Math.max(0, Math.min(7, Math.round(params.dutyCycleValue / 12.5) - 1));
  const octaveShift = Math.max(0, Math.min(7, 7 - Math.floor(Math.log2(Math.max(1, params.freq) / 50))));
  const dividingRatio = Math.max(0, Math.min(7, Math.round((baseRatio + octaveShift) / 2)));
  const cs = params.sweepShift > 0 ? 1 : 0;
  return generateNoise(dividingRatio, cs, params.volume, direction, absChange, totalSamples);
}

function defaultWaveBuffer(): number[] {
  const buf: number[] = [];
  for (let i = 0; i < 32; i++) {
    buf.push(Math.round((Math.sin(i / 32 * Math.PI * 2) + 1) / 2 * 15));
  }
  return buf;
}

// –––‑‑‑ AudioContext singleton ────────────────────────────────────────────
let sharedCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (sharedCtx.state === 'suspended') sharedCtx.resume();
  return sharedCtx;
}

// –––‑‑‑ Buffer cache ──────────────────────────────────────────────────────
const bufferCache = new Map<string, AudioBuffer>();
const CACHE_MAX = 256;

function cacheKey(params: GBAInstrumentParams): string {
  return `${params.type}|${Math.round(params.freq)}|${params.volume}|${params.dutyCycleValue}|${params.change}|${params.sweepShift}|${params.sweepTime}|${params.duration.toFixed(3)}`;
}

function getOrCreateBuffer(params: GBAInstrumentParams): AudioBuffer {
  const ctx = getAudioContext();
  const key = cacheKey(params);
  const cached = bufferCache.get(key);
  if (cached && cached.length === Math.round(SAMPLE_RATE * params.duration)) return cached;

  const totalSamples = Math.round(SAMPLE_RATE * params.duration);
  const buf = ctx.createBuffer(1, totalSamples, SAMPLE_RATE);
  const data = buf.getChannelData(0);
  const samples = generateGBABuffer(params);
  for (let i = 0; i < totalSamples && i < samples.length; i++) data[i] = samples[i];

  if (bufferCache.size >= CACHE_MAX) {
    const firstKey = bufferCache.keys().next().value;
    if (firstKey) bufferCache.delete(firstKey);
  }
  bufferCache.set(key, buf);
  return buf;
}

export function playGBASound(params: GBAInstrumentParams): void {
  try {
    const ctx = getAudioContext();
    const buf = getOrCreateBuffer(params);

    const gain = ctx.createGain();
    gain.gain.value = 1;
    gain.connect(ctx.destination);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(gain);
    src.start(ctx.currentTime);
    src.stop(ctx.currentTime + params.duration);
  } catch { /* audio not available */ }
}
