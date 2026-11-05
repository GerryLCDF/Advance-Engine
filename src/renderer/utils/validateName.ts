/**
 * Valida un nombre de elemento (escena, script, canción, diálogo…).
 * Devuelve null si es válido o el mensaje de error si no.
 *
 * `others` son los nombres de los demás elementos (sin contar el propio).
 */
export function validateItemName(name: string, others: string[]): string | null {
  const v = (name ?? '').trim();
  if (!v) return 'El nombre no puede estar vacío.';
  if (others.includes(v)) return 'Ya existe un elemento con ese nombre.';
  return null;
}
