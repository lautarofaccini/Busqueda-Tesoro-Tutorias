import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QrScannerSheet } from '../QrScannerSheet'
import * as client from '../../api/client'

vi.mock('../../api/client', () => ({ scanToken: vi.fn() }))

describe('QrScannerSheet', () => {
  const stop = vi.fn()
  const callbacks: FrameRequestCallback[] = []

  beforeEach(() => {
    vi.clearAllMocks(); callbacks.length = 0
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { callbacks.push(callback); return callbacks.length }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: vi.fn().mockResolvedValue(undefined) })
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) } })
  })

  afterEach(() => { delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector })

  it('opens the rear camera, scans through the authoritative token API, and stops the stream', async () => {
    const detect = vi.fn().mockResolvedValue([{ rawValue: 'https://tesoro.tutorias-frre.workers.dev/q/opaque-token' }])
    ;(window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class { detect = detect }
    const state = { state: 'CHALLENGE' as const, challengeId: 2, question: 'Q', stepNumber: 1, totalSteps: 5, playerName: 'Ada', score: 0 }
    vi.mocked(client.scanToken).mockResolvedValue(state)
    const onScanned = vi.fn()
    render(<QrScannerSheet open onClose={vi.fn()} onScanned={onScanned} onUseCode={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'No puedo escanear el QR' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Escanear QR' }).firstElementChild).toHaveClass('bg-surface-warm')
    await waitFor(() => expect(callbacks.length).toBeGreaterThan(0))
    await act(async () => { callbacks.shift()?.(0); await Promise.resolve(); await Promise.resolve() })
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ video: { facingMode: { ideal: 'environment' } }, audio: false })
    expect(client.scanToken).toHaveBeenCalledWith('opaque-token')
    expect(stop).toHaveBeenCalled()
    expect(onScanned).toHaveBeenCalledWith(state)
  })

  it('stops camera tracks when the sheet closes', async () => {
    const detect = vi.fn().mockResolvedValue([])
    ;(window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class { detect = detect }
    const user = userEvent.setup()
    const onClose = vi.fn()
    const view = render(<QrScannerSheet open onClose={onClose} onScanned={vi.fn()} onUseCode={vi.fn()} />)
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: 'Volver' }))
    view.rerender(<QrScannerSheet open={false} onClose={onClose} onScanned={vi.fn()} onUseCode={vi.fn()} />)
    expect(stop).toHaveBeenCalled()
  })

  it('offers the fallback only when native scanning is unavailable', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
    const onUseCode = vi.fn()
    const user = userEvent.setup()
    render(<QrScannerSheet open onClose={vi.fn()} onScanned={vi.fn()} onUseCode={onUseCode} />)
    expect(await screen.findByText(/escáner integrado no está disponible/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'No puedo escanear el QR' }))
    expect(onUseCode).toHaveBeenCalledOnce()
  })
})
