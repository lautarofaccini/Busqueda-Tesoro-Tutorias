import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import QRCode from 'qrcode'

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const secret = Array.from(randomBytes(20), (byte) => alphabet[byte & 31]).join('')
const issuer = 'UTN FRRe Tutorías'
const account = 'Búsqueda del Tesoro Admin'
const uri = `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
const outputDir = resolve('.local-totp')
const qrPath = resolve(outputDir, 'organizer-totp-enrollment.png')

await mkdir(outputDir, { recursive: true })
await QRCode.toFile(qrPath, uri, { width: 512, margin: 2, errorCorrectionLevel: 'M' })
await writeFile(resolve(outputDir, 'README.txt'), [
  'Temporary TOTP enrollment material. Delete this directory after enrollment.',
  'Never commit this file or share it.',
  `otpauth URI: ${uri}`,
  '',
].join('\n'), { mode: 0o600 })

console.log('\nEscaneá este QR desde Authy u otra app compatible:')
console.log(qrPath)
console.log('\nLuego configurá manualmente este valor como ORGANIZER_TOTP_SECRET en Cloudflare:')
console.log(secret)
console.log('\nNo subas ni compartas la carpeta .local-totp. Eliminála después de comprobar el código de seis dígitos.')
