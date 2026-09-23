import { describe, expect, it } from 'vitest'
import { eventSettingsSchema } from '../schemas'

describe('event settings CLOSING status', () => {
  it('accepts CLOSING without changing the persisted schema', () => {
    expect(eventSettingsSchema.parse({
      status: 'CLOSING', event_name: 'Evento', points_per_correct: 100,
      wrong_answer_penalty: 10, hint_penalty: 5, minimum_expected_completion_minutes: 10,
    }).status).toBe('CLOSING')
  })
})
