import { describe, it, expect } from 'vitest'
import { normalizeAnswer, matchesAcceptedAnswers } from '../normalize.js'

describe('normalizeAnswer', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeAnswer('  naranja  ')).toBe('naranja')
  })

  it('converts to lowercase', () => {
    expect(normalizeAnswer('NARANJA')).toBe('naranja')
    expect(normalizeAnswer('Naranja')).toBe('naranja')
  })

  it('removes diacritics (accents)', () => {
    expect(normalizeAnswer('Árbol')).toBe('arbol')
    expect(normalizeAnswer('árbol')).toBe('arbol')
    expect(normalizeAnswer('ÁRBOL')).toBe('arbol')
    expect(normalizeAnswer('número')).toBe('numero')
    expect(normalizeAnswer('corazón')).toBe('corazon')
    expect(normalizeAnswer('ñoño')).toBe('nono')
  })

  it('collapses multiple spaces to single space', () => {
    expect(normalizeAnswer('dos   palabras')).toBe('dos palabras')
    expect(normalizeAnswer('  tres   cosas  aqui  ')).toBe('tres cosas aqui')
  })

  it('removes controlled punctuation', () => {
    expect(normalizeAnswer('hola.')).toBe('hola')
    expect(normalizeAnswer('¡hola!')).toBe('hola')
    expect(normalizeAnswer('¿dónde?')).toBe('donde')
    expect(normalizeAnswer('a,b;c:d')).toBe('abcd')
    expect(normalizeAnswer("it's")).toBe('its')
    expect(normalizeAnswer('"quoted"')).toBe('quoted')
    expect(normalizeAnswer('(paren)')).toBe('paren')
  })

  it('handles numeric strings', () => {
    expect(normalizeAnswer('40')).toBe('40')
    expect(normalizeAnswer(' 40 ')).toBe('40')
  })

  it('handles empty-after-normalization gracefully', () => {
    expect(normalizeAnswer('   ')).toBe('')
    expect(normalizeAnswer('...')).toBe('')
  })

  it('equivalent results for variant inputs', () => {
    const expected = 'arbol'
    expect(normalizeAnswer('Árbol')).toBe(expected)
    expect(normalizeAnswer('arbol')).toBe(expected)
    expect(normalizeAnswer(' ARBOL ')).toBe(expected)
    expect(normalizeAnswer(' árbol ')).toBe(expected)
  })
})

describe('matchesAcceptedAnswers', () => {
  it('matches canonical answer exactly', () => {
    expect(matchesAcceptedAnswers('naranja', 'naranja', [])).toBe(true)
  })

  it('matches canonical after normalization', () => {
    expect(matchesAcceptedAnswers('NARANJA', 'naranja', [])).toBe(true)
    expect(matchesAcceptedAnswers(' Naranja ', 'naranja', [])).toBe(true)
    expect(matchesAcceptedAnswers('Árbol', 'arbol', [])).toBe(true)
  })

  it('matches explicit alias', () => {
    // "cuarenta" is an explicit alias for "40"
    expect(matchesAcceptedAnswers('cuarenta', '40', ['cuarenta'])).toBe(true)
    expect(matchesAcceptedAnswers('CUARENTA', '40', ['cuarenta'])).toBe(true)
  })

  it('matches alias after normalization', () => {
    expect(matchesAcceptedAnswers('Cuarenta', '40', ['cuarenta'])).toBe(true)
  })

  it('rejects an unrelated answer', () => {
    expect(matchesAcceptedAnswers('azul', 'naranja', [])).toBe(false)
    expect(matchesAcceptedAnswers('39', '40', ['cuarenta'])).toBe(false)
    expect(matchesAcceptedAnswers('', 'naranja', [])).toBe(false)
  })

  it('does NOT accept substring matches', () => {
    // "naranjada" is NOT "naranja"
    expect(matchesAcceptedAnswers('naranjada', 'naranja', [])).toBe(false)
  })

  it('does NOT guess unlisted variants', () => {
    // "cincuenta" is not an alias of "40"
    expect(matchesAcceptedAnswers('cincuenta', '40', ['cuarenta'])).toBe(false)
  })

  it('empty aliases array only accepts canonical', () => {
    expect(matchesAcceptedAnswers('naranja', 'naranja', [])).toBe(true)
    expect(matchesAcceptedAnswers('orange', 'naranja', [])).toBe(false)
  })
})
