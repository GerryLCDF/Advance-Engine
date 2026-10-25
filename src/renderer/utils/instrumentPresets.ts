import type { Instrument, InstrumentPreset, PresetGroup, Song } from '../types/editor';

// ── Biblioteca de presets de instrumento (pestaña Music) ────────────────────
// Antes vivían como constantes de módulo en MusicTab: los ajustes que cambiaba
// el usuario en el inspector se perdían al recargar y nunca llegaban a la ROM.
// Ahora son estado del proyecto: se editan en el inspector (updateInstrumentPreset),
// se guardan en editor-state.json y el export deriva de aquí la tabla de
// instrumentos que va al main.c (songInstrumentsForExport).

const makePreset = (
  id: string, name: string, type: InstrumentPreset['type'], group: PresetGroup, color: string,
  overrides?: Partial<InstrumentPreset>,
): InstrumentPreset => ({
  id, name, type, group, color,
  lengthEnabled: false, length: 32, initialVolume: 8, change: 0,
  dutyCycleValue: 50, sweepShift: 0, sweepTime: 1,
  ...overrides,
});

export const DUTY_PRESETS: InstrumentPreset[] = [
  makePreset('preset-duty-1', 'Fade Out 25% Pulse', 'duty', 'DUTY', '#57E4B3', { initialVolume: 11, change: -3, dutyCycleValue: 25 }),
  makePreset('preset-duty-2', 'Fade Out 50% Pulse', 'duty', 'DUTY', '#00A9CC', { initialVolume: 11, change: -3, dutyCycleValue: 50 }),
  makePreset('preset-duty-3', 'Fade In 12,5% Pulse', 'duty', 'DUTY', '#6C7A8E', { lengthEnabled: true, length: 64, initialVolume: 0, change: 7, dutyCycleValue: 12.5 }),
  makePreset('preset-duty-4', 'Short 12,5% Pulse', 'duty', 'DUTY', '#4A4579', { lengthEnabled: true, length: 16, initialVolume: 11, dutyCycleValue: 12.5 }),
  makePreset('preset-duty-5', 'Short 25% Pulse', 'duty', 'DUTY', '#1B8C7A', { lengthEnabled: true, length: 16, initialVolume: 11, dutyCycleValue: 25 }),
  makePreset('preset-duty-6', 'Short 50% Pulse', 'duty', 'DUTY', '#6CC459', { lengthEnabled: true, length: 16, initialVolume: 11, dutyCycleValue: 50 }),
  makePreset('preset-duty-7', '12,5% Pulse', 'duty', 'DUTY', '#A9E464', { initialVolume: 11, dutyCycleValue: 12.5 }),
  makePreset('preset-duty-8', '25% Pulse', 'duty', 'DUTY', '#F5E873', { initialVolume: 11, dutyCycleValue: 25 }),
  makePreset('preset-duty-9', '50% Pulse', 'duty', 'DUTY', '#F38D56', { initialVolume: 11, dutyCycleValue: 50 }),
  makePreset('preset-duty-10', '75% Pulse Custom Vibrato', 'duty', 'DUTY', '#D65576', { initialVolume: 11, dutyCycleValue: 75 }),
  makePreset('preset-duty-11', 'Bass Drum 50% Pulse (Duty 1 Only)', 'duty', 'DUTY', '#793D85', { lengthEnabled: true, length: 64, initialVolume: 11, change: -6, dutyCycleValue: 50, sweepShift: 1, sweepTime: 1 }),
  makePreset('preset-duty-12', 'Soft Sweep 50% Pulse (Duty 1 Only)', 'duty', 'DUTY', '#D63475', { initialVolume: 11, change: -3, dutyCycleValue: 50, sweepShift: 1, sweepTime: 1 }),
  makePreset('preset-duty-13', 'Sweep 12,5% Pulse (Duty 1 Only)', 'duty', 'DUTY', '#F3B0C3', { initialVolume: 11, change: -1, dutyCycleValue: 12.5, sweepShift: 2, sweepTime: 4 }),
  makePreset('preset-duty-14', 'Sweep 25% Pulse (Duty 1 Only)', 'duty', 'DUTY', '#F3BD9D', { lengthEnabled: true, length: 32, initialVolume: 11, change: -1, dutyCycleValue: 25, sweepShift: 2, sweepTime: 1 }),
  makePreset('preset-duty-15', '(empty)', 'duty', 'DUTY', '#A9A57E', {}),
];

export const WAVE_PRESETS: InstrumentPreset[] = [
  makePreset('preset-wave-1', '12,5% Pulse', 'wave', 'WAVE', '#57E4B3', { dutyCycleValue: 12.5 }),
  makePreset('preset-wave-2', '25% Pulse', 'wave', 'WAVE', '#00A9CC', { dutyCycleValue: 25 }),
  makePreset('preset-wave-3', '31.25% Pulse', 'wave', 'WAVE', '#6C7A8E', { dutyCycleValue: 31.25 }),
  makePreset('preset-wave-4', '37,50% Pulse', 'wave', 'WAVE', '#4A4579', { dutyCycleValue: 37.5 }),
  makePreset('preset-wave-5', '43,75% Pulse', 'wave', 'WAVE', '#1B8C7A', { dutyCycleValue: 43.75 }),
  makePreset('preset-wave-6', '50% Pulse', 'wave', 'WAVE', '#6CC459', { dutyCycleValue: 50 }),
  makePreset('preset-wave-7', '50% Pulse (Volume 5)', 'wave', 'WAVE', '#A9E464', { initialVolume: 5 }),
  makePreset('preset-wave-8', '50% Pulse (Volume 3)', 'wave', 'WAVE', '#F5E873', { initialVolume: 3 }),
  makePreset('preset-wave-9', '50% Pulse (Volume 1)', 'wave', 'WAVE', '#F38D56', { initialVolume: 1 }),
  makePreset('preset-wave-10', 'Square Wave with added Square Wave (2 Oktaves high...)', 'wave', 'WAVE', '#D65576'),
  makePreset('preset-wave-11', 'Triangular Wave', 'wave', 'WAVE', '#793D85'),
  makePreset('preset-wave-12', 'Triangular with added Square Wave (2 Oktaves higher)', 'wave', 'WAVE', '#D63475'),
  makePreset('preset-wave-13', 'Saw Wave', 'wave', 'WAVE', '#F3B0C3'),
  makePreset('preset-wave-14', 'Distorted Saw Wave', 'wave', 'WAVE', '#F3BD9D'),
  makePreset('preset-wave-15', '(empty)', 'wave', 'WAVE', '#A9A57E'),
];

export const NOISE_PRESETS: InstrumentPreset[] = [
  makePreset('preset-noise-1', 'White Noise', 'noise', 'NOISE', '#57E4B3', { dutyCycleValue: 12.5, initialVolume: 12 }),
  makePreset('preset-noise-2', 'Bright Hiss', 'noise', 'NOISE', '#00A9CC', { dutyCycleValue: 25, initialVolume: 10, change: -2 }),
  makePreset('preset-noise-3', 'Metallic 7-bit', 'noise', 'NOISE', '#6C7A8E', { dutyCycleValue: 37.5, initialVolume: 10, sweepShift: 1 }),
  makePreset('preset-noise-4', 'Snare', 'noise', 'NOISE', '#4A4579', { dutyCycleValue: 50, initialVolume: 14, change: -6, length: 24, lengthEnabled: true }),
  makePreset('preset-noise-5', 'Hi-Hat', 'noise', 'NOISE', '#1B8C7A', { dutyCycleValue: 12.5, initialVolume: 10, change: -3, length: 12, lengthEnabled: true }),
  makePreset('preset-noise-6', 'Low Rumble', 'noise', 'NOISE', '#6CC459', { dutyCycleValue: 75, initialVolume: 14, change: -2 }),
  makePreset('preset-noise-7', 'Tiny Click', 'noise', 'NOISE', '#A9E464', { dutyCycleValue: 12.5, initialVolume: 8, length: 4, lengthEnabled: true }),
  makePreset('preset-noise-8', 'Noise Pop', 'noise', 'NOISE', '#F5E873', { dutyCycleValue: 25, initialVolume: 12, change: -4, length: 16, lengthEnabled: true }),
  makePreset('preset-noise-9', 'Gritty 7-bit', 'noise', 'NOISE', '#F38D56', { dutyCycleValue: 62.5, initialVolume: 11, sweepShift: 1 }),
  makePreset('preset-noise-10', 'Short Burst', 'noise', 'NOISE', '#D65576', { dutyCycleValue: 37.5, initialVolume: 10, length: 8, lengthEnabled: true }),
  makePreset('preset-noise-11', 'Deep Noise', 'noise', 'NOISE', '#793D85', { dutyCycleValue: 87.5, initialVolume: 14, change: -1 }),
  makePreset('preset-noise-12', 'Static', 'noise', 'NOISE', '#D63475', { dutyCycleValue: 50, initialVolume: 9 }),
  makePreset('preset-noise-13', 'Crisp Tap', 'noise', 'NOISE', '#F3B0C3', { dutyCycleValue: 12.5, initialVolume: 11, length: 6, lengthEnabled: true }),
  makePreset('preset-noise-14', 'Metal Hit', 'noise', 'NOISE', '#F3BD9D', { dutyCycleValue: 37.5, initialVolume: 13, change: -3, sweepShift: 1, length: 20, lengthEnabled: true }),
  makePreset('preset-noise-15', 'Rising Noise', 'noise', 'NOISE', '#A9A57E', { dutyCycleValue: 25, initialVolume: 4, change: 5 }),
];

// Instrumentos PCM: la muestra viene de un sonido importado en Sound y el motor
// la reproduce a distintas alturas por el canal DMA (como los juegos comerciales).
export const PCM_PRESETS: InstrumentPreset[] = [
  makePreset('preset-pcm-1', 'Sample 1', 'pcm', 'PCM', '#7DD3FC'),
  makePreset('preset-pcm-2', 'Sample 2', 'pcm', 'PCM', '#38BDF8'),
  makePreset('preset-pcm-3', 'Sample 3', 'pcm', 'PCM', '#0EA5E9'),
  makePreset('preset-pcm-4', 'Sample 4', 'pcm', 'PCM', '#0284C7'),
];

export const ALL_PRESETS: InstrumentPreset[] = [
  ...DUTY_PRESETS, ...WAVE_PRESETS, ...NOISE_PRESETS, ...PCM_PRESETS,
];

export const PRESET_GROUP_ORDER: PresetGroup[] = ['DUTY', 'WAVE', 'NOISE', 'PCM'];

export const defaultInstrumentPresets = (): InstrumentPreset[] =>
  ALL_PRESETS.map((p) => ({ ...p }));

/**
 * Sobre los presets por defecto, aplica los guardados por id (proyectos viejos
 * sin `instrumentPresets` → todos los defaults; proyectos nuevos → sus ajustes;
 * ids desconocidos en el fichero se añaden al final).
 */
export function mergeInstrumentPresets(saved: unknown): InstrumentPreset[] {
  if (!Array.isArray(saved) || saved.length === 0) return defaultInstrumentPresets();
  const base = defaultInstrumentPresets();
  for (const s of saved as InstrumentPreset[]) {
    if (!s || typeof s.id !== 'string') continue;
    if (s.id.startsWith('preset-surdo-')) continue; // grupo retirado
    const i = base.findIndex((b) => b.id === s.id);
    if (i >= 0) base[i] = { ...base[i], ...s, id: base[i].id, group: base[i].group };
    else base.push({ ...s });
  }
  return base;
}

/**
 * Tabla de instrumentos que va a la ROM: los presets USADOS de verdad por las
 * notas de la canción (en orden de primera aparición), con su volumen/duty/
 * envolvente/sweep reales. Es lo que hace que la ROM suene igual que el editor,
 * que siempre ha sonado con los presets aunque `song.instruments` solo tuviera
 * el instrumento default.
 */
export function songInstrumentsForExport(song: Song, presets: InstrumentPreset[]): Instrument[] {
  const usedIds: string[] = [];
  for (const pat of song.patterns ?? []) {
    for (const row of pat.rows ?? []) {
      for (const chId of Object.keys(row)) {
        const id = row[chId]?.instrumentId;
        if (id && !usedIds.includes(id)) usedIds.push(id);
      }
    }
  }

  const out: Instrument[] = [];
  const seen = new Set<string>();
  const pushInst = (inst: Instrument) => {
    if (!inst || seen.has(inst.id)) return;
    seen.add(inst.id);
    out.push(inst);
  };

  for (const id of usedIds) {
    const p = presets.find((pr) => pr.id === id);
    if (p) {
      const c = p.change;
      pushInst({
        id: p.id,
        name: p.name,
        type: p.type,
        dutyCycle: p.dutyCycleValue / 100,
        waveData: [],
        envelope: {
          attack: c > 0 ? Math.abs(c) / 7 : 0,
          decay: c < 0 ? Math.abs(c) / 7 : 0,
          sustain: p.initialVolume / 15,
          release: 0,
        },
        sweepShift: p.sweepShift ?? 0,
        sweepTime: p.sweepTime ?? 1,
        lengthEnabled: p.lengthEnabled,
        length: p.length,
        sampleId: p.sampleId,
        baseNote: p.baseNote,
        visible: true, muted: false, solo: false,
      });
    } else {
      // id que no es de la biblioteca (proyecto viejo con instrumentos propios):
      // se respeta tal cual si existe en song.instruments
      const si = (song.instruments ?? []).find((i) => i.id === id);
      if (si) pushInst(si);
    }
  }

  // La tabla no puede quedar vacía (playStep comprueba instIdx < length, pero
  // un array C de tamaño 0 no compila)
  if (out.length === 0) {
    out.push(
      (song.instruments ?? [])[0] ?? {
        id: 'inst-default', name: 'Pulse 1', type: 'duty', dutyCycle: 0.5,
        waveData: [], envelope: { attack: 0, decay: 0, sustain: 1, release: 0 },
        visible: true, muted: false, solo: false,
      },
    );
  }
  return out;
}
