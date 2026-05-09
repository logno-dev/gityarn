import { and, eq, isNotNull, isNull } from 'drizzle-orm'

import { getDb } from '../src/lib/db/client'
import { generatePatternPdfPreview } from '../src/lib/patterns/pdf-preview'
import { patterns } from '../src/lib/db/schema'

async function main() {
  const db = getDb()
  const targets = await db
    .select({
      id: patterns.id,
      userId: patterns.userId,
      pdfR2Key: patterns.pdfR2Key,
      pdfPreviewR2Key: patterns.pdfPreviewR2Key,
    })
    .from(patterns)
    .where(and(isNull(patterns.coverR2Key), isNotNull(patterns.pdfR2Key)))

  if (!targets.length) {
    console.log('No patterns missing covers were found.')
    return
  }

  let updated = 0
  let skipped = 0
  let reusedPreview = 0
  let generatedPreview = 0
  for (const target of targets) {
    if (!target.pdfR2Key) {
      skipped += 1
      continue
    }

    const preview = target.pdfPreviewR2Key
      ? null
      : await generatePatternPdfPreview({ userId: target.userId, patternId: target.id, pdfR2Key: target.pdfR2Key })

    const coverKey = target.pdfPreviewR2Key ?? preview?.key ?? null
    const coverMimeType = preview?.mimeType ?? 'image/jpeg'
    if (target.pdfPreviewR2Key) {
      reusedPreview += 1
    }
    if (preview?.key) {
      generatedPreview += 1
    }
    if (!coverKey) {
      console.warn(`Skipped pattern ${target.id}: no existing preview and preview generation failed.`)
      skipped += 1
      continue
    }

    await db
      .update(patterns)
      .set({
        coverR2Key: coverKey,
        coverMimeType,
        pdfPreviewR2Key: preview?.key ?? undefined,
        pdfPreviewMimeType: preview?.mimeType ?? undefined,
        updatedAt: Date.now(),
      })
      .where(eq(patterns.id, target.id))
    updated += 1
  }

  console.log(`Backfill complete. Updated ${updated} pattern(s). Skipped ${skipped}. Reused previews: ${reusedPreview}. Generated previews: ${generatedPreview}.`)
}

void main()
