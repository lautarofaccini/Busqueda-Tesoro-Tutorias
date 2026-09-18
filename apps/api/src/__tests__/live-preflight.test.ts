import { describe, expect, it } from 'vitest'
import { getLivePreflightIssues } from '../db/queries.js'

function preflightDb(options: { clue?: string | null; activeQuestion?: boolean; reviewActive?: boolean; hasStart?: boolean } = {}) {
  const checkpoint = { id: 2, label: 'Biblioteca', is_start: 0, primary_clue: 'clue' in options ? options.clue : 'Una pista válida' }
  return {
    prepare(sql: string) {
      const statement = {
        bind: () => statement,
        first: async () => {
          if (sql.includes('event_settings')) return { event_name: 'Evento', points_per_correct: 100, wrong_answer_penalty: 10, hint_penalty: 5 }
          if (sql.includes('is_start = 1')) return options.hasStart === false ? null : { id: 1 }
          if (sql.includes('needs_review = 0 LIMIT 1')) return options.activeQuestion === false ? null : { id: 10 }
          return null
        },
        all: async () => {
          if (sql.includes('FROM checkpoints WHERE active = 1')) return { results: [checkpoint] }
          if (sql.includes('WHERE ch.active = 1 AND ch.needs_review = 1')) return { results: options.reviewActive ? [{ id: 10, question_text: 'Pendiente', label: 'Biblioteca' }] : [] }
          return { results: [] }
        },
      }
      return statement
    },
  } as unknown as D1Database
}

describe('LIVE preflight', () => {
  it('permits a complete configuration', async () => {
    await expect(getLivePreflightIssues(preflightDb())).resolves.toEqual([])
  })

  it('blocks missing navigation riddles, questions, reviews, and start checkpoint', async () => {
    const issues = await getLivePreflightIssues(preflightDb({ clue: null, activeQuestion: false, reviewActive: true, hasStart: false }))
    expect(issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      'MISSING_START_CHECKPOINT',
      'MISSING_PRIMARY_CLUE',
      'MISSING_ACTIVE_QUESTION',
      'ACTIVE_NEEDS_REVIEW_QUESTION',
    ]))
  })
})
