import { describe, expect, it } from 'vitest'
import { getAssistanceFeed } from '../lib/assistance.js'

function dbWith(reviews: any[], support: any[]) {
  return {
    prepare(sql: string) {
      return { all: async () => ({ results: sql.includes('answer_review_requests') ? reviews : support }) }
    },
  } as unknown as D1Database
}

describe('unified assistance feed', () => {
  it('prioritizes actionable items then sorts every type newest first', async () => {
    const feed = await getAssistanceFeed(dbWith([
      { id: 1, status: 'PENDING', created_at: '2026-09-21T17:20:00Z', accepted_answers: '["A","Alias"]' },
      { id: 2, status: 'REJECTED', created_at: '2026-09-21T17:30:00Z', accepted_answers: '["B"]' },
    ], [
      { id: 3, status: 'PENDING', category: 'QR_DAMAGED', created_at: '2026-09-21T17:24:00Z' },
      { id: 4, status: 'RESOLVED', category: 'OTHER', created_at: '2026-09-21T17:40:00Z' },
    ]))
    expect(feed.items.map(item => `${item.kind}-${item.id}`)).toEqual(['SUPPORT-3', 'ANSWER_REVIEW-1', 'SUPPORT-4', 'ANSWER_REVIEW-2'])
    expect(feed.pendingCount).toBe(2)
    expect(feed.items[1]).toMatchObject({ canonical_answer: 'A', accepted_aliases: ['Alias'] })
  })
})
