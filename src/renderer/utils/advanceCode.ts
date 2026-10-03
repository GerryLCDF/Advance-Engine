// ── AdvanceCode → C (transpilador 1:1) ────────────────────────────────────
// Lectura de la gramática: /home/gerardo/Documentos/advance-engine/advanceCode.md
//
// Concreto (esta primera versión):
//   - mutable var: T = expr      →  static T var = expr;          (RAM, global)
//   - static var: T = expr       →  static const T var = expr;    (ROM)
//   - entity Nombre { campo: T } →  typedef struct { T campo; } Nombre;
//   - logic Nombre for Entidad {
//       on start { ... }         →  void script_init(void)  (contrato del motor)
//       on update { ... }        →  void script_update(void)
//       function fn(args) {...}  →  static Tfn <Entidad>_fn(args) {...}
//     }
//   - function nombre(mutable this, x: u8) -> s16 { ... }
//       this → GBAActor* this (puntero); this.campo → this->campo
//   - if (cond) { } / else if (cond) { } / else { }, while (cond) { }
//   - for (i in 0..10) { }                    →  for (i = 0; i <= 10; i++)
//   - for (mutable i: u8 = 10, i > 0, i -= 2) →  for (u8 i = 10; i > 0; i -= 2)
//   - input.is_pressed(BUTTON_A)              →  tecla pulsada AHORA
//   - input.is_released(BUTTON_A)             →  tecla NO pulsada ahora
//   - input.pressed(BUTTON_A)                 →  flanco de pulsación (gJp)
//   - actor_in_area(actor) / actor_entered(actor) / actor_exit(actor) / actor_out_area(actor)
//   - Todo lo demás se transpila VERBATIM: la API C del motor (switchScene,
//     moveTopDown, gActors, REG_KEYINPUT, ...) se puede usar tal cual.
//   - Sin ; al final de línea (el transpilador los pone en C).
//
// Regla de oro (nada de código basura): lo que no se reconoce emite un error
// de transpilación listado en `errors` y el script NO entra a la ROM.

export interface ACodScriptLike {
  mode?: string;
  cCode?: string;
  language?: string;
}

export interface ACodTranspileResult {
  ok: boolean;
  code: string;
  errors: string[];
  warnings: string[];
  hasInit: boolean;
  hasUpdate: boolean;
  needsAreas: boolean;
  needsEdge: boolean;
}

const TYPES = new Set(['u8', 's8', 'u16', 's16', 'u32', 's32', 'fixed', 'bool']);
// bool → u8, fixed → s16 (matemáticas de punto fijo a mano sobre enteros)
const TYPE_MAP: Record<string, string> = { bool: 'u8', fixed: 's16' };
const BUTTONS: Record<string, string> = {
  BUTTON_A: '0x0001', BUTTON_B: '0x0002', BUTTON_SELECT: '0x0004', BUTTON_START: '0x0008',
  BUTTON_RIGHT: '0x0010', BUTTON_LEFT: '0x0020', BUTTON_UP: '0x0040', BUTTON_DOWN: '0x0080',
  BUTTON_R: '0x0100', BUTTON_L: '0x0200',
};
const AREA_HOOKS: Record<string, string> = {
  actor_entered: 'actorEnteredArea',
  actor_exit: 'actorExitedArea',
  actor_in_area: 'actorInArea',
  actor_out_area: 'actorOutArea',
};

type Tok =
  | { t: 'word'; v: string }
  | { t: 'num'; v: string }
  | { t: 'str'; v: string }
  | { t: 'op'; v: string }
  | { t: 'comment'; v: string }
  | { t: 'nl' }
  | { t: 'eof' };

const OPS = [
  '&&', '||', '==', '!=', '<=', '>=', '<<', '>>', '++', '--', '+=', '-=', '*=', '/=', '%=',
  '..', '->', '{', '}', '(', ')', '[', ']', ',', '.', ':', '=', '+', '-', '*', '/', '%',
  '!', '<', '>', '~', '&', '|', '^',
];

class Tokenizer {
  private src: string;
  pos = 0;
  constructor(src: string) { this.src = src; }
  next(): Tok {
    const s = this.src;
    let i = this.pos;
    while (i < s.length) {
      const c = s[i];
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '\n') { this.pos = i + 1; return { t: 'nl' }; }
      if (c === '/' && s[i + 1] === '/') {
        const j = s.indexOf('\n', i);
        const end = j === -1 ? s.length : j;
        this.pos = end;
        return { t: 'comment', v: s.slice(i, end) };
      }
      if (c === '/' && s[i + 1] === '*') {
        const j = s.indexOf('*/', i + 2);
        const end = j === -1 ? s.length : j + 2;
        this.pos = end;
        return { t: 'comment', v: s.slice(i, end) };
      }
      if (c === '"') {
        let j = i + 1;
        while (j < s.length && s[j] !== '"') {
          if (s[j] === '\\') j++;
          j++;
        }
        this.pos = Math.min(j + 1, s.length);
        return { t: 'str', v: s.slice(i + 1, Math.min(j, s.length)) };
      }
      if (/[0-9]/.test(c)) {
        let j = i;
        if (c === '0' && (s[i + 1] === 'x' || s[i + 1] === 'X')) { j += 2; while (j < s.length && /[0-9a-fA-F]/.test(s[j])) j++; }
        else if (c === '0' && (s[i + 1] === 'b' || s[i + 1] === 'B')) { j += 2; while (j < s.length && /[01]/.test(s[j])) j++; }
        else { while (j < s.length && /[0-9]/.test(s[j])) j++; }
        this.pos = j;
        return { t: 'num', v: s.slice(i, j) };
      }
      if (/[A-Za-z_]/.test(c)) {
        let j = i;
        while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
        this.pos = j;
        return { t: 'word', v: s.slice(i, j) };
      }
      const two = s.slice(i, i + 2);
      if (OPS.includes(two)) { this.pos = i + 2; return { t: 'op', v: two }; }
      const one = c;
      if (OPS.includes(one)) { this.pos = i + 1; return { t: 'op', v: one }; }
      // carácter desconocido: se pasa tal cual como op token
      this.pos = i + 1;
      return { t: 'op', v: c };
    }
    return { t: 'eof' };
  }
}

class Parser {
  private toks: Tok[];
  private pos = 0;
  errors: string[] = [];
  warnings: string[] = [];
  srcName: string;
  // resultado
  chunks: string[] = [];
  initBody: string[] = [];
  updateBody: string[] = [];
  hasInit = false;
  hasUpdate = false;
  needsAreas = false;
  needsEdge = false;
  private indent = 0;
  // dentro de un logic: prefijo de función y función this→gSelf
  private thisIsParam = false;
  private logicPrefix = '';
  private logicFns = new Set<string>();

  constructor(src: string, srcName: string) {
    const tz = new Tokenizer(src);
    this.toks = [];
    for (let t = tz.next(); t.t !== 'eof'; t = tz.next()) this.toks.push(t);
    this.toks.push({ t: 'eof' });
    this.srcName = srcName;
  }

  private peek(off = 0): Tok { return this.toks[this.pos + off] ?? { t: 'eof' }; }
  private at(t: Tok['t']): boolean { return this.peek().t === t; }
  private isWord(w: string): boolean { return this.at('word') && (this.peek() as { v: string }).v === w; }
  private isOp(o: string): boolean {
    const p = this.peek();
    return (p.t === 'op' || p.t === 'comment') && (p as unknown as { v: string }).v === o;
  }
  private eat(): Tok { return this.toks[this.pos++]; }
  private skipNl() { while (this.at('nl')) this.pos++; }
  private expectOp(o: string, what: string) {
    const p = this.peek();
    if ((p.t === 'op') && p.v === o) { this.pos++; return; }
    this.error(`se esperaba '${o}' ${what}`, p);
  }
  private error(msg: string, tok?: Tok) {
    const tk = tok ?? this.peek();
    const at = tk.t === 'eof' ? 'final del archivo' : `'${(tk as unknown as { v: string }).v}'`;
    this.errors.push(`${this.srcName}: ${msg} (en ${at})`);
  }

  // ── niveles de indentación ──────────────────────────────────────────────
  private line(...parts: string[]) { this.chunks.push('  '.repeat(this.indent) + parts.join(' ').trimEnd()); }

  // ── programa ────────────────────────────────────────────────────────────
  run(): void {
    for (;;) {
      this.skipNl();
      const p = this.peek();
      if (p.t === 'eof') break;
      if (p.t === 'comment') { this.chunks.push(p.v); this.pos++; continue; }
      if (p.t === 'word') {
        const w = p.v;
        if (w === 'entity') this.parseEntity();
        else if (w === 'logic') this.parseLogic();
        else if (w === 'function') this.parseFunction(undefined);
        else if (w === 'mutable' || w === 'static') this.parseGlobalVar();
        else {
          this.error(`'${w}' no se reconoce a nivel de archivo (usa entity, logic, function, mutable o static)`, p);
          this.line();
          this.pos++;
          this.skipToLineEnd();
        }
        continue;
      }
      this.error(`no se esperaba '${(p as unknown as { v: string }).v}' a nivel de archivo`, p);
      this.pos++;
      this.skipToLineEnd();
    }
    // contrato del motor
    if (this.hasInit) this.emitContract('script_init', this.initBody);
    if (this.hasUpdate) this.emitContract('script_update', this.updateBody);
  }

  private skipToLineEnd() {
    while (this.pos < this.toks.length && !this.at('nl') && !this.at('eof')) this.pos++;
  }

  private parseType(): string {
    const p = this.peek();
    if (p.t !== 'word') { this.error('se esperaba un tipo (u8, s16, fixed, bool, ...)', p); return 'u16'; }
    this.pos++;
    if (TYPES.has(p.v)) return TYPE_MAP[p.v] ?? p.v;
    // tipo de entidad (typedef) o desconocido → se usa tal cual
    if (this.knownEntities.has(p.v)) return p.v;
    return p.v;
  }
  private knownEntities = new Set<string>();

  // ── variables globales ──────────────────────────────────────────────────
  private parseGlobalVar() {
    const kind = (this.eat() as { v: string }).v; // mutable | static
    this.skipNl();
    const p = this.peek();
    if (p.t !== 'word') { this.error('se esperaba el nombre de la variable', p); this.skipToLineEnd(); return; }
    this.pos++;
    this.skipNl();
    this.expectOp(':', `después del nombre '${p.v}'`);
    const type = this.parseType();
    let init = '';
    this.skipNl();
    if (this.at('op') && (this.peek() as { v: string }).v === '=') {
      this.pos++;
      init = ' = ' + this.parseExpr();
    }
    const storage = kind === 'static' ? 'static const' : 'static';
    this.line(`${storage} ${type} ${p.v}${init};`);
  }

  // ── entity → typedef struct ─────────────────────────────────────────────
  private parseEntity() {
    this.pos++; // entity
    const n = this.eatWord('nombre de la entidad');
    this.knownEntities.add(n);
    this.expectOp('{', `para abrir ${n}`);
    const fields: string[] = [];
    for (;;) {
      this.skipNl();
      const p = this.peek();
      if (p.t === 'eof') { this.error(`entidad ${n} sin cerrar: falta '}'`); return; }
      if (p.t === 'comment') { fields.push(`${'  '}${p.v}`); this.pos++; continue; }
      if (p.t === 'op' && p.v === '}') { this.pos++; break; }
      if (p.t === 'word' && (p.v === 'mutable' || p.v === 'static')) {
        this.pos++;
        const fn = this.eatWord('nombre del campo');
        this.expectOp(':', `después de '${fn}'`);
        const type = this.parseType();
        this.skipNl();
        if (this.at('op') && (this.peek() as { v: string }).v === '=') {
          this.pos++;
          this.parseExpr();
          this.warnings.push(`entidad ${n}: el valor inicial del campo '${fn}' se ignora por ahora (sin instanciación); inicializa las variables en 'on start'`);
        }
        fields.push(`  ${type} ${fn};`);
      } else {
        this.error(`campo de entidad no válido (usa mutable o static)`, p);
        this.pos++;
        this.skipToLineEnd();
      }
    }
    if (fields.length === 0) {
      this.warnings.push(`entidad ${n}: sin campos — no se emite struct vacío`);
      return;
    }
    const clean = fields.filter((f) => !f.trimStart().startsWith('//') && !f.trimStart().startsWith('/*'));
    if (clean.length === 0) return;
    this.chunks.push(`typedef struct ${n} {`);
    this.chunks.push(...fields);
    this.chunks.push(`} ${n};`);
  }

  // ── logic ───────────────────────────────────────────────────────────────
  private parseLogic() {
    this.pos++; // logic
    const logicName = this.eatWord('nombre del bloque logic');
    if (!this.isWord('for')) this.error('el bloque logic debe declararse como "logic <Nombre> for <Entidad>"');
    else this.pos++;
    const entity = this.eatWord('nombre de la entidad (for <Entidad>)');
    this.expectOp('{', `para abrir ${logicName}`);
    this.line(`// ── ${logicName} (para ${entity}) ──`);
    const savedPrefix = this.logicPrefix;
    const savedFns = this.logicFns;
    this.logicPrefix = entity + '_';
    this.logicFns = new Set(this.scanLogicFns());
    for (;;) {
      this.skipNl();
      const p = this.peek();
      if (p.t === 'eof') { this.error(`logic ${logicName} sin cerrar: falta '}'`); break; }
      if (p.t === 'comment') { this.chunks.push(p.v); this.pos++; continue; }
      if (p.t === 'op' && p.v === '}') { this.pos++; break; }
      if (p.t === 'word' && p.v === 'on') this.parseOn();
      else if (p.t === 'word' && p.v === 'function') this.parseFunction(savedPrefix);
      else {
        this.error(`dentro de logic solo se admite 'on', 'function' o comentarios`, p);
        this.pos++;
        this.skipToLineEnd();
      }
    }
    this.logicPrefix = savedPrefix;
    this.logicFns = savedFns;
  }

  private scanLogicFns(): string[] {
    // pre-escaneo: nombres de functions dentro del logic (para prefijar las llamadas)
    const names: string[] = [];
    let depth = 1;
    for (let i = this.pos; i < this.toks.length; i++) {
      const t = this.toks[i];
      if (t.t === 'op' && t.v === '{') depth++;
      else if (t.t === 'op' && t.v === '}') {
        depth--;
        if (depth === 0) break;
      } else if (t.t === 'word' && t.v === 'function') {
        const nameTok = this.toks[i + 1];
        if (nameTok && nameTok.t === 'word') names.push(nameTok.v);
      }
    }
    return names;
  }

  private parseOn() {
    this.pos++; // on
    const kind = this.eatWord('on <start|update>');
    if (kind !== 'start' && kind !== 'update') { this.error(`'on' espera 'start' o 'update' (se recibió '${kind}')`); return; }
    const target = kind === 'start' ? this.initBody : this.updateBody;
    if (kind === 'start') this.hasInit = true; else this.hasUpdate = true;
    this.parseBlockInto(target, false);
  }

  private parseBlockInto(target: string[], thisIsParam: boolean) {
    this.skipNl();
    // llaves obligatorias
    if (!(this.at('op') && (this.peek() as { v: string }).v === '{')) {
      this.error("los bloques usan llaves { }");
      this.skipToLineEnd();
      return;
    }
    this.pos++;
    this.skipNl();
    const savedThis = this.thisIsParam;
    this.thisIsParam = thisIsParam;
    this.parseBlockContents(target);
    this.thisIsParam = savedThis;
  }

  private parseBlockContents(target: string[]) {
    const saved = this.chunks;
    const savedIndent = this.indent;
    this.chunks = target;
    this.indent = savedIndent + 1;
    for (;;) {
      this.skipNl();
      const p = this.peek();
      if (p.t === 'eof' || (p.t === 'op' && p.v === '}')) { if (p.t === 'op') this.pos++; break; }
      if (p.t === 'comment') { this.line(p.v); this.pos++; continue; }
      this.parseStmt();
    }
    this.chunks = saved;
    this.indent = savedIndent;
  }

  private emitContract(name: string, body: string[]) {
    // define void script_init(void) / script_update(void) con el cuerpo recogido
    const saved = this.chunks;
    this.chunks = [];
    this.indent = 0;
    this.skipNl();
    this.line(`static void ${name}(void) {`);
    this.chunks.push(...body);
    // nivelador: todo cuerpo cerró su propio nivel
    this.line('}');
    this.chunks.push('');
    saved.push(...this.chunks);
    this.chunks = saved;
  }

  // ── function ────────────────────────────────────────────────────────────
  private parseFunction(prefix: string | undefined) {
    this.pos++; // function
    const name = this.eatWord('nombre de la función');
    this.expectOp('(', `después de ${name}`);
    const params: string[] = [];
    let hasThis = false;
    this.skipNl();
    if (!(this.at('op') && (this.peek() as { v: string }).v === ')')) {
      for (;;) {
        this.skipNl();
        const p = this.peek();
        if (p.t !== 'word') { this.error('parámetro no válido', p); this.pos++; continue; }
        if (p.v === 'this' || (p.v === 'mutable' && (this.toks[this.pos + 1] as Tok)?.t === 'word' && (this.toks[this.pos + 1] as { v: string }).v === 'this')) {
          if (p.v === 'mutable') this.pos++;
          this.pos++; // this
          hasThis = true;
          params.push('GBAActor* this');
        } else if (p.v === 'mutable' || p.v === 'static') {
          this.pos++;
          const pn = this.eatWord('nombre del parámetro');
          this.expectOp(':', `después de '${pn}'`);
          const pt = this.parseType();
          params.push(`${pt} ${pn}`);
        } else {
          const pn = p.v;
          this.pos++;
          this.expectOp(':', `después de '${pn}'`);
          const pt = this.parseType();
          params.push(`${pt} ${pn}`);
        }
        this.skipNl();
        if (this.at('op') && (this.peek() as { v: string }).v === ',') { this.pos++; continue; }
        break;
      }
    }
    this.expectOp(')', 'para cerrar los parámetros');
    let ret = 'void';
    this.skipNl();
    if (this.at('op') && (this.peek() as { v: string }).v === '->') {
      this.pos++;
      ret = this.parseType();
    }
    const fnName = (prefix ?? '') + name;
    const body: string[] = [];
    this.skipNl();
    if (!(this.at('op') && (this.peek() as { v: string }).v === '{')) {
      this.error(`la función ${name} necesita un bloque { }`);
      this.skipToLineEnd();
      return;
    }
    const savedThis = this.thisIsParam;
    this.thisIsParam = hasThis;
    this.parseBlockInto(body, hasThis);
    this.thisIsParam = savedThis;
    this.line(`static ${ret} ${fnName}(${params.join(', ')}) {`);
    this.chunks.push(...body);
    this.line('}');
    this.chunks.push('');
    if (prefix) this.logicFns.add(name);
  }

  // ── declaraciones / sentencias ──────────────────────────────────────────
  private parseStmt() {
    const p = this.peek();
    if (p.t === 'word') {
      const w = p.v;
      if (w === 'mutable' || w === 'static') { this.parseLocalVar(); return; }
      if (w === 'if') { this.parseIf(); return; }
      if (w === 'while') { this.parseWhile(); return; }
      if (w === 'for') { this.parseFor(); return; }
      if (w === 'return') { this.pos++; this.skipNl(); if (this.stmtEnds()) { this.line('return;'); } else this.line('return', this.parseExpr() + ';'); return; }
      if (w === 'break') { this.pos++; this.line('break;'); return; }
      if (w === 'continue') { this.pos++; this.line('continue;'); return; }
    }
    // expresión → asignación o llamada
    const lhs = this.parseExpr();
    this.skipNl();
    const q = this.peek();
    if (q.t === 'op' && ['=', '+=', '-=', '*=', '/=', '%=', '++', '--'].includes(q.v)) {
      if (q.v === '=') {
        this.pos++;
        const rhs = this.parseExpr();
        this.line(`${lhs} = ${rhs};`);
      } else if (q.v === '++' || q.v === '--') {
        this.pos++;
        this.line(`${lhs}${q.v};`);
      } else {
        this.pos++;
        const rhs = this.parseExpr();
        this.line(`${lhs} ${q.v} ${rhs};`);
      }
      return;
    }
    if (q.t === 'eof' || (q.t === 'op' && q.v === '}') || q.t === 'nl') {
      this.chunks.push('  '.repeat(this.indent) + lhs + ';');
      return;
    }
    this.error(`flujo no válido tras '${(q as unknown as { v: string }).v}'`);
  }

  private stmtEnds(): boolean {
    return this.at('nl') || this.at('eof') || (this.at('op') && (this.peek() as { v: string }).v === '}');
  }

  // Expresión con asignación: para el update del for manual (i -= 1) y para
  // sentencias sueltas. Devuelve la cadena C.
  private parseAssignExpr(): string {
    const lhs = this.parseExpr();
    this.skipNl();
    const q = this.peek();
    if (q.t === 'op' && ['=', '+=', '-=', '*=', '/=', '%=', '++', '--'].includes(q.v)) {
      this.pos++;
      if (q.v === '++' || q.v === '--') return `${lhs}${q.v}`;
      const rhs = this.parseExpr();
      return `${lhs} ${q.v} ${rhs}`;
    }
    return lhs;
  }

  private parseLocalVar() {
    const kind = (this.eat() as { v: string }).v;
    const name = this.eatWord('nombre de la variable');
    this.expectOp(':', `después de '${name}'`);
    const type = this.parseType();
    let init = ' = 0';
    this.skipNl();
    if (this.at('op') && (this.peek() as { v: string }).v === '=') {
      this.pos++;
      init = ' = ' + this.parseExpr();
    }
    this.line(`${kind === 'static' ? 'static ' : ''}${type} ${name}${init};`);
  }

  // Condición con paréntesis opcionales: 'if (a && b)' o 'if a && b' → el C
// generado es idéntico, así que el paréntesis sobra pero no estorba.
  private parseCond(kw: string): string {
    let close = false;
    this.skipNl();
    if (this.at('op') && (this.peek() as { v: string }).v === '(') { this.pos++; close = true; }
    const cond = this.parseExpr();
    if (close) this.expectOp(')', `para cerrar la condición del ${kw}`);
    return cond;
  }

  private parseIf() {
    this.pos++; // if
    const cond = this.parseCond('if');
    const body: string[] = [];
    this.parseBlockInto(body, this.thisIsParam);
    this.saveBlock(`if (${cond})`, body);
    // else / else if
    for (;;) {
      this.skipNl();
      if (this.isWord('else')) {
        this.pos++;
        this.skipNl();
        if (this.isWord('if')) {
          this.pos++;
          const c2 = this.parseCond('else if');
          const b2: string[] = [];
          this.parseBlockInto(b2, this.thisIsParam);
          this.saveBlock(`else if (${c2})`, b2);
          continue;
        }
        const b3: string[] = [];
        this.parseBlockInto(b3, this.thisIsParam);
        this.saveBlock('else', b3);
      }
      break;
    }
  }

  private saveBlock(header: string, body: string[]) {
    this.line(`${header} {`);
    this.chunks.push(...body);
    this.line('}');
    this.skipNl();
  }

  private parseWhile() {
    this.pos++; // while
    const cond = this.parseCond('while');
    const body: string[] = [];
    this.parseBlockInto(body, this.thisIsParam);
    this.saveBlock(`while (${cond})`, body);
  }

  private parseFor() {
    this.pos++; // for
    // 'for' siempre lleva paréntesis obligatorios (rango o control manual)
    this.expectOp('(', 'para abrir el for');
    // rango: for (i in A..B)
    if (this.at('word') && this.isWordAfter('in')) {
      const iv = this.eatWord('nombre de la variable del bucle');
      this.pos++; // in
      const lo = this.parseExpr();
      this.expectOp('..', 'en el rango del for');
      const hi = this.parseExpr();
      this.expectOp(')', 'para cerrar el for');
      const body: string[] = [];
      this.parseBlockInto(body, this.thisIsParam);
      this.saveBlock(`for (${iv} = ${lo}; ${iv} <= ${hi}; ${iv}++)`, body);
      return;
    }
    // manual: for (init, cond, update)
    let init = '';
    const p = this.peek();
    if (p.t === 'word' && (p.v === 'mutable' || p.v === 'static')) {
      const kind = this.eatWord('mutable|static');
      const name = this.eatWord('nombre de la variable');
      this.expectOp(':', `después de '${name}'`);
      const type = this.parseType();
      let val = '0';
      this.skipNl();
      if (this.at('op') && (this.peek() as { v: string }).v === '=') { this.pos++; val = this.parseExpr(); }
      init = `${kind === 'static' ? 'static ' : ''}${type} ${name} = ${val}`;
    } else {
      init = this.parseExpr();
    }
    this.expectOp(',', 'entre las cláusulas del for');
    const cond = this.parseExpr();
    this.expectOp(',', 'entre las cláusulas del for');
    const upd = this.parseAssignExpr();
    this.expectOp(')', 'para cerrar el for');
    const body: string[] = [];
    this.parseBlockInto(body, this.thisIsParam);
    this.saveBlock(`for (${init}; ${cond}; ${upd})`, body);
  }

  private isWordAfter(w: string): boolean {
    // comprueba la palabra after posibles nl
    for (let o = 1; o < 4; o++) {
      const t = this.toks[this.pos + o];
      if (!t || t.t === 'eof') return false;
      if (t.t === 'nl') continue;
      return t.t === 'word' && t.v === w;
    }
    return false;
  }

  // ── expresión ───────────────────────────────────────────────────────────
  private parseExpr(): string { return this.parseOr(); }
  private parseOr(): string {
    let l = this.parseAnd();
    for (;;) { this.skipNl(); if (this.isOp('||')) { this.pos++; l = `(${l} || ${this.parseAnd()})`; } else break; }
    return l;
  }
  private parseAnd(): string {
    let l = this.parseBitOr();
    for (;;) { this.skipNl(); if (this.isOp('&&')) { this.pos++; l = `(${l} && ${this.parseBitOr()})`; } else break; }
    return l;
  }
  private parseBitOr(): string {
    let l = this.parseBitXor();
    for (;;) { this.skipNl(); const q = this.peek(); if (q.t === 'op' && q.v === '|') { this.pos++; l = `(${l} | ${this.parseBitXor()})`; } else break; }
    return l;
  }
  private parseBitXor(): string {
    let l = this.parseBitAnd();
    for (;;) { this.skipNl(); const q = this.peek(); if (q.t === 'op' && q.v === '^') { this.pos++; l = `(${l} ^ ${this.parseBitAnd()})`; } else break; }
    return l;
  }
  private parseBitAnd(): string {
    let l = this.parseEq();
    for (;;) { this.skipNl(); const q = this.peek(); if (q.t === 'op' && q.v === '&') { this.pos++; l = `(${l} & ${this.parseEq()})`; } else break; }
    return l;
  }
  private parseEq(): string {
    let l = this.parseRel();
    for (;;) { this.skipNl(); const q = this.peek(); if (q.t === 'op' && (q.v === '==' || q.v === '!=')) { this.pos++; l = `(${l} ${q.v} ${this.parseRel()})`; } else break; }
    return l;
  }
  private parseRel(): string {
    let l = this.parseShift();
    for (;;) { this.skipNl(); const q = this.peek(); if (q.t === 'op' && ['<', '>', '<=', '>='].includes(q.v)) { this.pos++; l = `(${l} ${q.v} ${this.parseShift()})`; } else break; }
    return l;
  }
  private parseShift(): string {
    let l = this.parseAdd();
    for (;;) { this.skipNl(); const q = this.peek(); if (q.t === 'op' && (q.v === '<<' || q.v === '>>')) { this.pos++; l = `(${l} ${q.v} ${this.parseAdd()})`; } else break; }
    return l;
  }
  private parseAdd(): string {
    let l = this.parseMul();
    for (;;) { this.skipNl(); const q = this.peek(); if (q.t === 'op' && (q.v === '+' || q.v === '-')) { this.pos++; l = `(${l} ${q.v} ${this.parseMul()})`; } else break; }
    return l;
  }
  private parseMul(): string {
    let l = this.parseUnary();
    for (;;) { this.skipNl(); const q = this.peek(); if (q.t === 'op' && (q.v === '*' || q.v === '/' || q.v === '%')) { this.pos++; l = `(${l} ${q.v} ${this.parseUnary()})`; } else break; }
    return l;
  }
  private parseUnary(): string {
    this.skipNl();
    const q = this.peek();
    if (q.t === 'op' && (q.v === '!' || q.v === '-' || q.v === '~')) { this.pos++; return `(${q.v}${this.parseUnary()})`; }
    return this.parsePostfix();
  }
  private parsePostfix(): string {
    const base = this.parsePrimary();
    return this.parseCont(base);
  }
  private parseCont(base: string): string {
    for (;;) {
      this.skipNl();
      const q = this.peek();
      if (q.t === 'op' && q.v === '.') {
        this.pos++;
        const m = this.eatWord('nombre de miembro');
        base = this.memberAccess(base, m);
        continue;
      }
      if (q.t === 'op' && q.v === '[') {
        this.pos++;
        const idx = this.parseExpr();
        this.expectOp(']', 'para cerrar el índice');
        base = `${base}[${idx}]`;
        continue;
      }
      if (q.t === 'op' && q.v === '(') {
        this.pos++;
        const args: string[] = [];
        this.skipNl();
        if (!(this.at('op') && (this.peek() as { v: string }).v === ')')) {
          for (;;) {
            args.push(this.parseExpr());
            this.skipNl();
            if (this.at('op') && (this.peek() as { v: string }).v === ',') { this.pos++; continue; }
            break;
          }
        }
        this.expectOp(')', 'para cerrar la llamada');
        base = this.callEmit(base, args);
        continue;
      }
      break;
    }
    return base;
  }

  private memberAccess(base: string, member: string): string {
    // this.campo → gSelf->campo / this->campo
    if (base === 'gSelf' || base === 'this') return `${base}->${member}`;
    // input.is_x(...) se resuelve en callEmit con base="input.is_x"
    return `${base}.${member}`;
  }

  private callEmit(callee: string, args: string[]): string {
    // input.is_pressed / is_released / pressed
    if (callee.startsWith('input.')) {
      const m = callee.slice('input.'.length);
      if (m === 'is_pressed') {
        this.skipNl();
        if (args.length !== 1) return `/* input.is_pressed espera 1 botón */`;
        return `((u16)(~REG_KEYINPUT & 0x3FF) & ${args[0]})`;
      }
      if (m === 'is_released') {
        if (args.length !== 1) return `/* input.is_released espera 1 botón */`;
        return `!((u16)(~REG_KEYINPUT & 0x3FF) & ${args[0]})`;
      }
      if (m === 'pressed') {
        this.needsEdge = true;
        if (args.length !== 1) return `/* input.pressed espera 1 botón */`;
        return `(gJp & ${args[0]})`;
      }
      return `/* input.${m} no se reconoce */`;
    }
    // hooks de área: el argumento es el ÍNDICE del otro actor (p.ej. PLAYER_INDEX)
    const hook = AREA_HOOKS[callee];
    if (hook) {
      this.needsAreas = true;
      const actor = this.thisIsParam ? 'this' : 'gSelf';
      if (args.length !== 1) return `/* ${callee} espera el índice del otro actor (p.ej. PLAYER_INDEX) */`;
      return `${hook}(${actor}, &gActors[${args[0]}])`;
    }
    // funciones del mismo logic → prefijo de entidad
    if (this.logicFns.has(callee) && this.logicPrefix) return `${this.logicPrefix}${callee}(${args.join(', ')})`;
    return `${callee}(${args.join(', ')})`;
  }

  private parsePrimary(): string {
    this.skipNl();
    const p = this.peek();
    if (p.t === 'num') { this.pos++; return p.v; }
    if (p.t === 'str') {
      this.pos++;
      return `"${p.v}"`;
    }
    if (p.t === 'op' && p.v === '(') {
      this.pos++;
      const e = this.parseExpr();
      this.expectOp(')', 'para cerrar el paréntesis');
      return e;
    }
    if (p.t === 'word') {
      const w = p.v;
      this.pos++;
      if (w === 'true') return '1';
      if (w === 'false') return '0';
      if (w === 'this') return this.thisIsParam ? 'this' : 'gSelf';
      if (w === 'keys') return '((u16)(~REG_KEYINPUT & 0x3FF))';
      if (w in BUTTONS) return BUTTONS[w];
      return w; // cualquier identificador / API C pasa verbatim
    }
    this.error(
      p.t === 'eof' ? 'expresión incompleta (falta un valor)' : `no se esperaba '${(p as unknown as { v: string }).v}'`,
      p
    );
    if (p.t !== 'eof') this.pos++;
    return '0';
  }

  private eatWord(what: string): string {
    const p = this.peek();
    if (p.t !== 'word') { this.error(`se esperaba ${what}`, p); this.pos++; return '_'; }
    this.pos++;
    return p.v;
  }
}

// ── API pública ───────────────────────────────────────────────────────────
export function transpileAdvanceCode(src: string, srcName = 'AdvanceCode'): ACodTranspileResult {
  const parser = new Parser(src, srcName);
  parser.run();
  const ok = parser.errors.length === 0;
  const code = ok ? parser.chunks.join('\n') + '\n' : '';
  return {
    ok,
    code,
    errors: parser.errors,
    warnings: parser.warnings,
    hasInit: parser.hasInit,
    hasUpdate: parser.hasUpdate,
    needsAreas: parser.needsAreas,
    needsEdge: parser.needsEdge,
  };
}

// Hielo fino para el exportador: dado UN script (mode 'language' o 'c'),
// devuelve el C efectivo que entra en la ROM + metadatos para el soporte.
export function scriptEffectiveCCode(s: ACodScriptLike): ACodTranspileResult {
  if (s.mode === 'language') {
    return transpileAdvanceCode(s.language ?? '');
  }
  const code = (s.cCode ?? '').trim();
  return {
    ok: true,
    code,
    errors: [],
    warnings: [],
    hasInit: /void\s+script_init\s*\(\s*(?:void)?\s*\)/.test(code),
    hasUpdate: /void\s+script_update\s*\(\s*(?:void)?\s*\)/.test(code),
    needsAreas: false,
    needsEdge: false,
  };
}

export function acodSkeleton(): string {
  return `// AdvanceCode → transpila 1:1 a C. this = el actor al que asignas el script.
// on start  = script_init  (una vez al entrar a la escena)
// on update = script_update (cada frame)
//
// APIs listas: moveTopDown(this, keys), movePlatformer(this, keys),
// switchScene(n), near(this, actor, dist), gJp, REG_KEYINPUT,
// actor_in_area(actor) / actor_entered(actor) / actor_exit(actor): ¿está ese
// actor (índice, p.ej. PLAYER_INDEX) dentro del área de este? (área = Inspector).

mutable pasos: s16 = 0

logic MiLogica for Protagonista {
  on start {
    pasos = 0
  }

  on update {
    pasos = pasos + 1

    if (input.is_pressed(BUTTON_LEFT) || input.is_pressed(BUTTON_RIGHT)) {
      moveTopDown(this, ~REG_KEYINPUT & 0x3FF)
    }

    if actor_entered(PLAYER_INDEX) {
      switchScene(1)
    }
  }
}
`;
}