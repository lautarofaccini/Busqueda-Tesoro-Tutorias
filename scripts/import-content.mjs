import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const args = process.argv.slice(2)
const remote = args.includes('--remote')
const databaseIndex = args.indexOf('--database')
const database = databaseIndex >= 0 ? args[databaseIndex + 1] : undefined
if (!remote || !database) throw new Error('Refusing import: use --remote --database <production-db>. This script never defaults to remote and never resets a database.')

const escape = (value) => `'${String(value).replaceAll("'", "''")}'`
const normalize = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
const reviewReason = (question) => {
  if (!question.confirmed) return 'Fuente marcada como no confirmada.'
  const canonicalWords = new Set(normalize(question.canonicalAnswer).split(' ').filter(Boolean))
  const fragment = (question.aliases ?? []).find((alias) => {
    const words = normalize(alias).split(' ').filter(Boolean)
    return words.length > 0 && words.length < canonicalWords.size && words.every(word => canonicalWords.has(word))
  })
  return fragment ? `Alias abreviado o fragmentario: ${JSON.stringify(fragment)}.` : null
}

const content = JSON.parse(readFileSync(join(__dirname, 'content_v1.json'), 'utf8'))
let sql = "-- One-shot non-destructive content import. Production remains DRAFT.\nUPDATE event_settings SET status = 'DRAFT' WHERE id = 1;\n"
for (const checkpoint of content.checkpoints) {
  const token = crypto.randomUUID()
  sql += `INSERT INTO checkpoints (token, sequence_order, label, is_start, active, instruction, primary_clue) VALUES (${escape(token)}, (SELECT COALESCE(MAX(sequence_order), 0) + 1 FROM checkpoints), ${escape(checkpoint.name)}, ${checkpoint.is_start ? 1 : 0}, 1, ${checkpoint.instruction ? escape(checkpoint.instruction) : 'NULL'}, ${checkpoint.navigation_riddle ? escape(checkpoint.navigation_riddle) : 'NULL'});\n`
  for (const question of checkpoint.questions) {
    const note = reviewReason(question)
    const answers = JSON.stringify([question.canonicalAnswer, ...(question.aliases ?? [])])
    sql += `INSERT INTO challenges (checkpoint_id, question_text, accepted_answers, hint_text, active, needs_review, review_note) VALUES ((SELECT id FROM checkpoints WHERE token = ${escape(token)}), ${escape(question.text)}, ${escape(answers)}, ${question.hint ? escape(question.hint) : 'NULL'}, ${note ? 0 : 1}, ${note ? 1 : 0}, ${note ? escape(note) : 'NULL'});\n`
  }
}
const tempSql = join(__dirname, 'content-import.generated.sql')
writeFileSync(tempSql, sql)
try {
  execFileSync('npx', ['wrangler', 'd1', 'execute', database, '--remote', '--file', tempSql], { cwd: join(__dirname, '..', 'apps', 'api'), stdio: 'inherit' })
} finally {
  unlinkSync(tempSql)
}
