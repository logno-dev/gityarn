export const SHARE_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
export const SHARE_PDF_MIME_TYPE = 'application/pdf'

export function normalizeShareMimeType(mimeType: string) {
  if (SHARE_IMAGE_MIME_TYPES.has(mimeType)) return mimeType
  if (mimeType === SHARE_PDF_MIME_TYPE) return mimeType
  return null
}

export function extensionForMimeType(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/heic') return 'heic'
  if (mimeType === 'image/heif') return 'heif'
  if (mimeType === SHARE_PDF_MIME_TYPE) return 'pdf'
  return 'bin'
}
