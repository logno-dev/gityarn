type ResizeOptions = {
  maxWidth: number
}

type ProcessedImage = {
  bytes: Uint8Array
  mimeType: string
  extension: string
}

export async function processUploadedImage(file: File, options: ResizeOptions): Promise<ProcessedImage> {
  const originalBytes = new Uint8Array(await file.arrayBuffer())
  const originalMimeType = normalizeImageMimeType(file.type)

  if (!originalMimeType) {
    return {
      bytes: originalBytes,
      mimeType: file.type || 'application/octet-stream',
      extension: extensionFromMime(file.type || 'application/octet-stream'),
    }
  }

  if (originalMimeType === 'image/gif') {
    return {
      bytes: originalBytes,
      mimeType: originalMimeType,
      extension: extensionFromMime(originalMimeType),
    }
  }

  try {
    const sharpModule = await import('sharp')
    const sharp = sharpModule.default
    const pipeline = sharp(Buffer.from(originalBytes))
    const metadata = await pipeline.metadata()

    if (!metadata.width || metadata.width <= options.maxWidth) {
      return {
        bytes: originalBytes,
        mimeType: originalMimeType,
        extension: extensionFromMime(originalMimeType),
      }
    }

    const resizedBuffer = await pipeline
      .resize({
        width: options.maxWidth,
        withoutEnlargement: true,
      })
      .toFormat(formatFromMime(originalMimeType))
      .toBuffer()

    return {
      bytes: new Uint8Array(resizedBuffer),
      mimeType: originalMimeType,
      extension: extensionFromMime(originalMimeType),
    }
  } catch {
    return {
      bytes: originalBytes,
      mimeType: originalMimeType,
      extension: extensionFromMime(originalMimeType),
    }
  }
}

function normalizeImageMimeType(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'image/jpeg'
  if (mimeType === 'image/png') return 'image/png'
  if (mimeType === 'image/webp') return 'image/webp'
  if (mimeType === 'image/gif') return 'image/gif'
  if (mimeType === 'image/heic') return 'image/heic'
  if (mimeType === 'image/heif') return 'image/heif'
  return null
}

function extensionFromMime(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/heic') return 'heic'
  if (mimeType === 'image/heif') return 'heif'
  return 'bin'
}

function formatFromMime(mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/heic' | 'image/heif') {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/heic' || mimeType === 'image/heif') return 'jpeg'
  return 'jpeg'
}
