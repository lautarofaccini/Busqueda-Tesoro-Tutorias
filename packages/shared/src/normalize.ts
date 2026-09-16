/**
 * Answer normalization — busqueda-tesoro-tutorias.
 *
 * Rules applied in order:
 *  1. Trim leading/trailing whitespace.
 *  2. Lowercase.
 *  3. NFD Unicode decomposition → strip combining diacritic marks (U+0300–U+036F).
 *     Effect: "Árbol" → "arbol", "número" → "numero".
 *  4. Collapse any run of internal whitespace to a single ASCII space.
 *  5. Strip punctuation: . , ; : ! ? - ' " ( ) ¿ ¡
 *
 * This is NOT fuzzy matching.
 * Only explicit canonical answers + explicit aliases are accepted.
 * No Levenshtein, no AI, no substring guessing.
 */
export function normalizeAnswer(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritic combining marks
    .replace(/[.,;:!?'"()\-¿¡]/g, '') // strip controlled punctuation
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim() // trim again after punctuation removal may create edge spaces
}

/**
 * Check whether a raw submitted answer matches the canonical answer
 * or any of the explicitly configured aliases.
 *
 * All comparisons are done after normalization.
 * Accepted variants must be explicitly listed — no guessing.
 *
 * @param raw       - The raw string the player submitted.
 * @param canonical - The canonical correct answer (stored in DB).
 * @param aliases   - Explicitly accepted alternate forms (may be empty).
 */
export function matchesAcceptedAnswers(
  raw: string,
  canonical: string,
  aliases: string[]
): boolean {
  const normalizedInput = normalizeAnswer(raw)
  if (normalizedInput === normalizeAnswer(canonical)) return true
  return aliases.some((alias) => normalizedInput === normalizeAnswer(alias))
}
