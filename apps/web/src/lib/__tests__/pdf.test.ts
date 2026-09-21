import { beforeEach, describe, expect, it, vi } from 'vitest'

const drawText = vi.fn()
const addPage = vi.fn(() => ({ getSize: () => ({ width: 595, height: 842 }), drawText, drawImage: vi.fn() }))
const save = vi.fn(async () => new Uint8Array([1, 2, 3]))

vi.mock('pdf-lib', () => ({
  PDFDocument: { create: vi.fn(async () => ({ addPage, embedFont: vi.fn(async () => ({ widthOfTextAtSize: (text: string) => text.length * 10 })), embedPng: vi.fn(async () => ({})), save })) },
  StandardFonts: { Helvetica: 'Helvetica', HelveticaBold: 'HelveticaBold' },
  rgb: vi.fn(),
}))
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async (url: string) => `data:image/png;base64,${url}`) } }))

import QRCode from 'qrcode'
import { generateBulkQRPdf, generateSingleQRPdf } from '../pdf'

const checkpoint = { label: 'Biblioteca', token: 'stable-token', fallback_code: 'ABC12345' }

describe('QR poster PDFs', () => {
  beforeEach(() => {
    drawText.mockClear()
    addPage.mockClear()
    vi.mocked(QRCode.toDataURL).mockClear()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:poster'), revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('downloads one PDF poster using the stable token and fallback code', async () => {
    await generateSingleQRPdf(checkpoint)
    expect(QRCode.toDataURL).toHaveBeenCalledWith('https://tesoro.tutorias-frre.workers.dev/q/stable-token', expect.any(Object))
    expect(drawText).toHaveBeenCalledWith('Código: ABC12345', expect.any(Object))
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled()
  })

  it('creates one printable page per checkpoint in the bulk PDF', async () => {
    await generateBulkQRPdf([checkpoint, { ...checkpoint, label: 'Cantina', token: 'other-token', fallback_code: 'ZXCV9876' }])
    expect(addPage).toHaveBeenCalledTimes(2)
    expect(QRCode.toDataURL).toHaveBeenCalledWith('https://tesoro.tutorias-frre.workers.dev/q/other-token', expect.any(Object))
  })
})
