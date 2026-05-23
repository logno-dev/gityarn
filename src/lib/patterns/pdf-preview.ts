import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { getServerEnv } from '#/lib/env'
import { getR2Client } from '#/lib/r2/client'

const execFileAsync = promisify(execFile)
const PDF_FETCH_RETRY_DELAYS_MS = [0, 250, 600, 1200]

type PdfImageResult = {
  key: string
  mimeType: 'image/jpeg'
}

export async function generatePatternPdfPreview(params: {
  userId: string
  patternId: string
  pdfR2Key: string
}) {
  return generatePatternPdfImageAsset(params)
}

async function generatePatternPdfImageAsset(params: {
  userId: string
  patternId: string
  pdfR2Key: string
}): Promise<PdfImageResult | null> {
  try {
    const client = getR2Client()
    const bucket = getServerEnv().R2_BUCKET
    const bytes = await fetchPdfBytesWithRetry({ bucket, key: params.pdfR2Key })
    if (!bytes) {
      return null
    }

    const jpegBuffer = await renderPdfFirstPageToJpeg(Buffer.from(bytes))

    const previewKey = `users/${params.userId}/patterns/${params.patternId}/preview-${crypto.randomUUID()}.jpg`
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: previewKey,
        Body: new Uint8Array(jpegBuffer),
        ContentType: 'image/jpeg',
      }),
    )

    return {
      key: previewKey,
      mimeType: 'image/jpeg' as const,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown PDF preview error'
    console.error(`[patterns] PDF preview generation failed for pattern ${params.patternId}: ${message}`)
    return null
  }
}

async function fetchPdfBytesWithRetry(params: { bucket: string; key: string }) {
  const client = getR2Client()

  for (let index = 0; index < PDF_FETCH_RETRY_DELAYS_MS.length; index += 1) {
    const delayMs = PDF_FETCH_RETRY_DELAYS_MS[index]
    if (delayMs > 0) {
      await wait(delayMs)
    }

    try {
      const object = await client.send(new GetObjectCommand({ Bucket: params.bucket, Key: params.key }))
      const bytes = await object.Body?.transformToByteArray()
      if (bytes?.length) {
        return bytes
      }
    } catch (error) {
      if (index === PDF_FETCH_RETRY_DELAYS_MS.length - 1) {
        throw error
      }
    }
  }

  return null
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function renderPdfFirstPageToJpeg(pdfBuffer: Buffer): Promise<Buffer> {
  try {
    const sharpModule = await import('sharp')
    const sharp = sharpModule.default
    return await sharp(pdfBuffer, { density: 150 }).resize({ width: 680, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()
  } catch (sharpError) {
    try {
      return await renderPdfWithPdftoppm(pdfBuffer)
    } catch (pdfToPpmError) {
      const sharpMessage = sharpError instanceof Error ? sharpError.message : 'unknown sharp error'
      const pdfToPpmMessage = pdfToPpmError instanceof Error ? pdfToPpmError.message : 'unknown pdftoppm error'
      throw new Error(`sharp failed: ${sharpMessage}; pdftoppm failed: ${pdfToPpmMessage}`)
    }
  }
}

async function renderPdfWithPdftoppm(pdfBuffer: Buffer): Promise<Buffer> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gityarn-pdf-'))
  const inputPath = path.join(tempDir, 'input.pdf')
  const outputPrefix = path.join(tempDir, 'page')
  const outputPath = `${outputPrefix}.jpg`

  try {
    await writeFile(inputPath, pdfBuffer)
    await execFileAsync('pdftoppm', ['-f', '1', '-singlefile', '-jpeg', '-scale-to', '680', inputPath, outputPrefix])
    return await readFile(outputPath)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
