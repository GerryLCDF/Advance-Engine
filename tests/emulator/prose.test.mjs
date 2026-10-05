// ─────────────────────────────────────────────────────────────────────────────
// El script de C se pega tal cual al main.c, así que si el usuario pega la
// explicación que rodea a un ejemplo, el gcc responde con veinte líneas de
// warnings y un error críptico tipo "unknown type name 'Y'".
//
// Estos tests fijan el detector de texto pegado: tiene que encontrar el texto y,
// sobre todo, NO dar falsos positivos con C de verdad (que sería peor: un aviso
// falso en un script correcto enseña a desconfiar del aviso).
//
// Uso: npx tsx tests/emulator/prose.test.mjs   (o el runner que prefieras)
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, '..', '..', 'src', 'renderer', 'utils', 'gba_export.ts'), 'utf-8');

// Se extrae la función del código real (sin compilarla) quitando los tipos.
const cuerpo = SRC
  .slice(SRC.indexOf('function lineasDeTextoPegado'), SRC.indexOf('export function generateGBAProject'))
  .replace('(code: string): number[]', '(code)')
  .replace('const sospechosas: number[]', 'const sospechosas');
const lineasDeTextoPegado = new Function(`${cuerpo}; return lineasDeTextoPegado;`)();

let fallos = 0;
function comprobar(nombre, codigo, esperado) {
  const got = lineasDeTextoPegado(codigo);
  const ok = JSON.stringify(got) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${nombre}${ok ? '' : ` → esperado ${JSON.stringify(esperado)}, dio ${JSON.stringify(got)}`}`);
}

console.log('detecta texto pegado:');
comprobar(
  'explicación pegada (el caso real)',
  `void script_init(void) {
}

void script_update(void) {
  u16 keys = ~REG_KEYINPUT & 0x3FF;
  moveTopDown(gSelf, keys);
}

Y el variante que además mira dónde estás mirando para ir más rápido (útil para que el sprite no se deslice de lado):

void script_update(void) {
  gSelf->animSpeed = 2;
}`,
  [9]
);
comprobar(
  'frase larga al final',
  `void script_update(void) {
  moveTopDown(gSelf, keys);
}

Recuerda que para que esto funcione hay que activar la colisión en el inspector del actor`,
  [5]
);

console.log('\nno debe dar falsos positivos:');
comprobar('script normal', `// Topdown: 4 direcciones con aceleración, sin gravedad.
void script_update(void) {
  u16 keys = ~REG_KEYINPUT & 0x3FF;
  moveTopDown(gSelf, keys);
}`, []);
comprobar('comentario de bloque multilínea', `/*
  Esta explicación tiene más de seis palabras y sigue siendo
  un comentario, así que no hay que avisar de nada aquí.
*/
void script_update(void) {
  gSelf->frame = 0;
}`, []);
comprobar('condicional sin llaves', `void script_update(void) {
  if (gSelf->x > 100 && gSelf->y < 200 && onFloor(gSelf) && (keys & KEY_UP))
    gSelf->vx = 2;
}`, []);
comprobar('firma partida en dos líneas', `static int actorAreaRect(const GBAActor* a, s16* ox, s16* oy,
                         s16* ow, s16* oh, u16* inside) {
  return 1;
}`, []);
comprobar('firma larga con parámetros', `static void inicializaAlgoMuyLargoConParametros(int uno, int dos) {
  u16 total = uno + dos;
}`, []);
comprobar('bucle sin llaves', `void script_update(void) {
  while (gSelf->timer < 60 && !gSelf->frame) gSelf->timer++;
}`, []);

console.log(fallos === 0 ? '\nTodo correcto.' : `\n${fallos} fallo(s).`);
process.exit(fallos === 0 ? 0 : 1);