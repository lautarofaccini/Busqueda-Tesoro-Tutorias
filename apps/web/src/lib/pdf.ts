import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import QRCode from 'qrcode'

export interface CheckpointQRData {
  label: string;
  token: string;
  fallback_code: string;
}

const generatePage = async (pdfDoc: PDFDocument, data: CheckpointQRData) => {
  const page = pdfDoc.addPage([595.28, 841.89]) // A4
  const { width, height } = page.getSize()

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const targetUrl = `https://tesoro.tutorias-frre.workers.dev/q/${data.token}`
  
  const qrDataUrl = await QRCode.toDataURL(targetUrl, {
    width: 600,
    margin: 2,
    errorCorrectionLevel: 'H'
  })
  
  const qrImage = await pdfDoc.embedPng(qrDataUrl)
  const logoBytes = await fetch('/tutorias-frre-logo.jpg').then(response => response.arrayBuffer())
  const logo = await pdfDoc.embedJpg(logoBytes)
  
  const logoWidth = 150
  const logoHeight = logo.height * (logoWidth / logo.width)
  page.drawImage(logo, { x: width / 2 - logoWidth / 2, y: height - 85, width: logoWidth, height: logoHeight })

  // Title
  page.drawText('Búsqueda del Tesoro', {
    x: width / 2 - font.widthOfTextAtSize('Búsqueda del Tesoro', 32) / 2,
    y: height - 135,
    size: 28,
    font,
    color: rgb(0.1, 0.1, 0.1),
  })

  // Physical cards intentionally hide their checkpoint identity.
  page.drawText('ESTACIÓN', {
    x: width / 2 - font.widthOfTextAtSize('ESTACIÓN', 24) / 2,
    y: height - 180,
    size: 24,
    font,
    color: rgb(0.8, 0.3, 0),
  })

  // QR Size: 10cm x 10cm is approx 283.46 points. We'll use 300 points.
  const qrSize = 300
  page.drawImage(qrImage, {
    x: width / 2 - qrSize / 2,
    y: height - 210 - qrSize,
    width: qrSize,
    height: qrSize,
  })

  // Escaneá acá
  page.drawText('Escaneá acá', {
    x: width / 2 - font.widthOfTextAtSize('Escaneá acá', 28) / 2,
    y: height - 210 - qrSize - 50,
    size: 28,
    font,
    color: rgb(0, 0, 0),
  })

  // ¿No podés escanear?
  page.drawText('¿No podés escanear?', {
    x: width / 2 - fontNormal.widthOfTextAtSize('¿No podés escanear?', 18) / 2,
    y: height - 210 - qrSize - 120,
    size: 18,
    font: fontNormal,
    color: rgb(0.3, 0.3, 0.3),
  })

  // Código
  const codeText = `Código: ${data.fallback_code}`
  page.drawText(codeText, {
    x: width / 2 - font.widthOfTextAtSize(codeText, 24) / 2,
    y: height - 210 - qrSize - 160,
    size: 24,
    font,
    color: rgb(0.1, 0.1, 0.1),
  })
}

export const generateBulkQRPdf = async (checkpoints: CheckpointQRData[]) => {
  const pdfDoc = await PDFDocument.create()
  for (const cp of checkpoints) {
    await generatePage(pdfDoc, cp)
  }
  const pdfBytes = await pdfDoc.save()
  
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'busqueda-tesoro-tutorias-qrs.pdf'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const generateSingleQRPdf = async (checkpoint: CheckpointQRData) => {
  const pdfDoc = await PDFDocument.create()
  await generatePage(pdfDoc, checkpoint)
  const pdfBytes = await pdfDoc.save()
  
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const slug = checkpoint.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
  a.download = `qr-${slug}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
