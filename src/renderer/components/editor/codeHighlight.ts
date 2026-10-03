// Resaltador de sintaxis para el editor de C Directo.
// Tokenizador propio (sin dependencias): recorre el texto una vez y devuelve
// una lista de tokens para que el editor los pinte en un <pre> detrás del
// <textarea> transparente. Todas las reglas de GBA/C están cubiertas:
// comentarios, preprocesador, cadenas, caracteres, números, palabras clave,
// tipos de devkitARM, la API del motor y llamadas a función.

export type CodeTokenType =
  | 'comment'
  | 'preproc'
  | 'include'
  | 'string'
  | 'char'
  | 'number'
  | 'keyword'
  | 'type'
  | 'builtin'
  | 'func'
  | 'op'
  | 'text';

export interface CodeToken {
  text: string;
  type: CodeTokenType;
}

const KEYWORDS = new Set([
  'auto', 'break', 'case', 'const', 'continue', 'default', 'do', 'else', 'enum',
  'extern', 'for', 'goto', 'if', 'register', 'return', 'sizeof', 'static',
  'struct', 'switch', 'typedef', 'union', 'volatile', 'while', 'inline',
  'restrict', '_Noreturn',
]);

// Tipos de C + los de devkitARM (u8, s16, …) que usa la API del motor
const TYPES = new Set([
  'void', 'bool', 'char', 'short', 'int', 'long', 'float', 'double', 'signed',
  'unsigned', 'size_t', 'u8', 's8', 'u16', 's16', 'u32', 's32', 'u64', 's64',
  'fix16', 'fx16', 'fx32',
]);

// API del motor + libs de devkitARM que solemos usar
const BUILTINS = new Set([
  'gActors', 'gSelf', 'PLAYER_INDEX', 'REG_KEYINPUT', 'REG_DISPSTAT', 'REG_VCOUNT',
  'moveActorCollide', 'movePlayer', 'moveActor', 'noteOn', 'soundPlay', 'waitVSync',
  'printf', 'memcpy', 'memset', 'sprintf',
]);

const isIdentStart = (ch: string) => /[A-Za-z_$]/.test(ch);
const isIdentPart = (ch: string) => /[A-Za-z0-9_$]/.test(ch);
const isDigit = (ch: string) => ch >= '0' && ch <= '9';
const isSpace = (ch: string) => ch === ' ' || ch === '\t';

export function highlightCode(src: string): CodeToken[] {
  const out: CodeToken[] = [];
  const push = (text: string, type: CodeTokenType) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ text, type });
  };

  let i = 0;
  const n = src.length;
  // True si en esta línea solo hubo espacios/tabs antes (para el '#include')
  let lineStart = true;

  while (i < n) {
    const ch = src[i];
    const next = src[i + 1] ?? '';

    // ── Comentarios ─────────────────────────────────────────────────────
    if (ch === '/' && next === '/') {
      const end = src.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      push(src.slice(i, stop), 'comment');
      i = stop;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      push(src.slice(i, stop), 'comment');
      i = stop;
      continue;
    }

    // ── Preprocesador: #include <gba.h> / #define X 5 ───────────────────
    if (ch === '#' && lineStart) {
      let j = i + 1;
      while (j < n && /[A-Za-z]/.test(src[j])) j++;
      push(src.slice(i, j), 'preproc');
      i = j;
      // El resto de la línea: separador + cabecera entre <> o ""
      while (i < n && isSpace(src[i])) { push(src[i], 'text'); i++; }
      if (src[i] === '<' || src[i] === '"') {
        const open = src[i];
        const close = open === '<' ? '>' : '"';
        const end = src.indexOf(close, i + 1);
        const stop = end === -1 ? n : end + 1;
        push(src.slice(i, stop), 'include');
        i = stop;
      }
      lineStart = false;
      continue;
    }

    // ── Cadenas y caracteres ─────────────────────────────────────────────
    if (ch === '"') {
      let j = i + 1;
      while (j < n && src[j] !== '"') {
        if (src[j] === '\\') j++;
        if (src[j] === '\n') break;
        j++;
      }
      const stop = Math.min(j + 1, n);
      push(src.slice(i, stop), 'string');
      i = stop;
      lineStart = false;
      continue;
    }
    if (ch === "'") {
      let j = i + 1;
      while (j < n && src[j] !== "'") {
        if (src[j] === '\\') j++;
        if (src[j] === '\n') break;
        j++;
      }
      const stop = Math.min(j + 1, n);
      push(src.slice(i, stop), 'char');
      i = stop;
      lineStart = false;
      continue;
    }

    // ── Números (dec, hex 0x, bin 0b, sufijos u/l/f) ────────────────────
    if (isDigit(ch) || (ch === '.' && isDigit(next))) {
      let j = i;
      if (ch === '0' && (next === 'x' || next === 'X' || next === 'b' || next === 'B')) {
        j = i + 2;
        while (j < n && /[0-9a-fA-F]/.test(src[j])) j++;
      } else {
        while (j < n && (isDigit(src[j]) || src[j] === '.')) j++;
        if (src[j] === 'e' || src[j] === 'E') {
          j++;
          if (src[j] === '+' || src[j] === '-') j++;
          while (j < n && isDigit(src[j])) j++;
        }
      }
      while (j < n && /[uUlLfF]/.test(src[j])) j++;
      push(src.slice(i, j), 'number');
      i = j;
      lineStart = false;
      continue;
    }

    // ── Identificadores: palabra clave / tipo / API / función ────────────
    if (isIdentStart(ch)) {
      let j = i;
      while (j < n && isIdentPart(src[j])) j++;
      const word = src.slice(i, j);
      let k = j;
      while (k < n && isSpace(src[k])) k++;
      const isCall = src[k] === '(';
      let type: CodeTokenType = 'text';
      if (KEYWORDS.has(word)) type = 'keyword';
      else if (TYPES.has(word)) type = 'type';
      else if (BUILTINS.has(word)) type = 'builtin';
      else if (isCall) type = 'func';
      push(word, type);
      i = j;
      lineStart = false;
      continue;
    }

    // ── Operadores y puntuación ─────────────────────────────────────────
    if (/[+\-*/%=<>!&|^~?:;,.(){}[\]\\]/.test(ch)) {
      push(ch, 'op');
      i++;
      lineStart = false;
      continue;
    }

    // ── Espacios y saltos ───────────────────────────────────────────────
    push(ch, 'text');
    if (ch === '\n') lineStart = true;
    i++;
  }

  return out;
}
