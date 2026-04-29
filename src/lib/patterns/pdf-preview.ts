import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

import { getServerEnv } from '#/lib/env'
import { getR2Client } from '#/lib/r2/client'

export async function generatePatternPdfPreview(params: {
  userId: string
  patternId: string
  pdfR2Key: string
}) {
  try {
    const client = getR2Client()
    const bucket = getServerEnv().R2_BUCKET
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: params.pdfR2Key }))
    const bytes = await object.Body?.transformToByteArray()
    if (!bytes) {
      return null
    }

    const sharpModule = await import('sharp')
    const sharp = sharpModule.default
    const jpegBuffer = await sharp(Buffer.from(bytes), { density: 150 }).resize({ width: 680, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()

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
  } catch {
    return null
  }
}
