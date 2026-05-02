import { and, eq } from 'drizzle-orm'

import { getDb } from '../src/lib/db/client'
import { manufacturers, yarnColorways, yarnLines } from '../src/lib/db/schema'

type Hit = {
  productName?: string
  productKey?: string
  pdpUrl?: string
  picker?: Array<{ color?: string; variantKey?: string }>
}

type RecordRow = {
  lineName: string
  productUrl: string | null
  colorName: string | null
  colorCode: string | null
  barcode: string | null
}

const MANUFACTURER = 'Hobby Lobby'
const BASE_URL = 'https://www.hobbylobby.com'

async function main() {
  const args = parseArgs(process.argv)
  const records = await scrapePages(args.maxPages, args.verbose)
  if (!records.length) {
    throw new Error('No Hobby Lobby records scraped.')
  }

  const normalized = dedupe(records)
  console.log(`Scraped ${normalized.length} normalized Hobby Lobby record(s).`)

  if (!args.seed) {
    return
  }

  await seedDatabase(normalized, args.verbose)
  console.log('Seeded Hobby Lobby records to database.')
}

function parseArgs(argv: string[]) {
  const seed = !argv.includes('--no-seed')
  const verbose = argv.includes('--verbose')
  const maxPagesArg = argv.find((arg) => arg.startsWith('--max-pages='))
  const maxPages = Number(maxPagesArg?.split('=')[1] ?? 8)
  return {
    seed,
    verbose,
    maxPages: Number.isFinite(maxPages) && maxPages > 0 ? Math.floor(maxPages) : 8,
  }
}

async function scrapePages(maxPages: number, verbose: boolean) {
  const rows: RecordRow[] = []
  const seenProductKeys = new Set<string>()

  for (let page = 1; page <= maxPages; page += 1) {
    const url = `${BASE_URL}/yarn-needle-art/yarn-tools/yarn/c/5-126-1001?p=${page}`
    const html = await fetchHtml(url)
    const hits = extractHitsFromNextData(html)
    if (verbose) {
      console.log(`Page ${page}: ${hits.length} hit(s)`)
    }
    if (!hits.length) {
      break
    }

    let addedOnPage = 0
    for (const hit of hits) {
      const lineName = cleanText(hit.productName)
      if (!lineName) continue

      const productKey = cleanText(hit.productKey)
      if (productKey && seenProductKeys.has(productKey)) continue
      if (productKey) seenProductKeys.add(productKey)

      const productUrl = normalizeUrl(cleanText(hit.pdpUrl))
      const picker = Array.isArray(hit.picker) ? hit.picker : []

      if (!picker.length) {
        rows.push({ lineName, productUrl, colorName: null, colorCode: null, barcode: extractBarcodeCandidate(hit) })
        addedOnPage += 1
        continue
      }

      for (const item of picker) {
        const parsed = parseColorLabel(cleanText(item.color))
        rows.push({
          lineName,
          productUrl,
          colorName: parsed.colorName,
          colorCode: parsed.colorCode,
          barcode: extractBarcodeCandidate(hit),
        })
        addedOnPage += 1
      }
    }

    if (addedOnPage === 0) {
      break
    }
  }

  return rows
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; GITYarnHobbyLobbyBot/1.0)',
    },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }
  return response.text()
}

function extractHitsFromNextData(html: string): Hit[] {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match) return []

  const data = JSON.parse(match[1]) as any
  const hits =
    data?.props?.pageProps?.serverState?.initialResults?.HLNextGenEcommIndex_prd?.results?.[0]?.hits ?? []
  return Array.isArray(hits) ? (hits as Hit[]) : []
}

function parseColorLabel(label: string | null) {
  if (!label) return { colorName: null, colorCode: null }
  const trimmed = label.trim()
  const m = trimmed.match(/^(\d{2,6})\s+(.+)$/)
  if (m) {
    return { colorCode: m[1], colorName: cleanText(m[2]) }
  }
  return { colorCode: null, colorName: trimmed }
}

function normalizeUrl(url: string | null) {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${BASE_URL}${url}`
  return `${BASE_URL}/${url}`
}

function cleanText(value: string | null | undefined) {
  if (!value) return null
  const cleaned = value.replace(/\s+/g, ' ').trim()
  return cleaned || null
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function dedupe(rows: RecordRow[]) {
  const map = new Map<string, RecordRow>()
  for (const row of rows) {
    const key = `${slugify(row.lineName)}|${slugify(row.colorName ?? '')}|${slugify(row.colorCode ?? '')}`
    if (!map.has(key)) {
      map.set(key, row)
    }
  }
  return [...map.values()]
}

async function seedDatabase(rows: RecordRow[], verbose: boolean) {
  const db = getDb()
  const manufacturerSlug = slugify(MANUFACTURER)

  let manufacturer = await db.query.manufacturers.findFirst({ where: eq(manufacturers.slug, manufacturerSlug) })
  if (!manufacturer) {
    const id = crypto.randomUUID()
    await db.insert(manufacturers).values({ id, name: MANUFACTURER, slug: manufacturerSlug })
    manufacturer = { id, slug: manufacturerSlug, name: MANUFACTURER } as typeof manufacturers.$inferSelect
  }

  for (const row of rows) {
    const lineSlug = slugify(`${MANUFACTURER}-${row.lineName}`)
    let line = await db.query.yarnLines.findFirst({ where: eq(yarnLines.slug, lineSlug) })
    if (!line) {
      const lineId = crypto.randomUUID()
      await db.insert(yarnLines).values({
        id: lineId,
        manufacturerId: manufacturer.id,
        name: row.lineName,
        slug: lineSlug,
        productUrl: row.productUrl,
      })
      line = { id: lineId } as typeof yarnLines.$inferSelect
      if (verbose) console.log(`+ line ${row.lineName}`)
    }

    if (!row.colorName) {
      continue
    }

    let color = await db.query.yarnColorways.findFirst({
      where: and(eq(yarnColorways.yarnLineId, line.id), eq(yarnColorways.name, row.colorName)),
    })
    if (!color && row.colorCode) {
      color = await db.query.yarnColorways.findFirst({
        where: and(eq(yarnColorways.yarnLineId, line.id), eq(yarnColorways.colorCode, row.colorCode)),
      })
    }

    if (!color) {
      await db.insert(yarnColorways).values({
        id: crypto.randomUUID(),
        yarnLineId: line.id,
        name: row.colorName,
        colorCode: row.colorCode,
      })
    } else if (!color.colorCode && row.colorCode) {
      await db.update(yarnColorways).set({ colorCode: row.colorCode, updatedAt: Date.now() }).where(eq(yarnColorways.id, color.id))
    }

    // Barcode enrichment attempt intentionally omitted here because Hobby Lobby
    // public payload typically does not expose UPC/EAN values reliably.
  }
}

function extractBarcodeCandidate(hit: Hit) {
  const asAny = hit as any
  const direct = [asAny.upc, asAny.barcode, asAny.ean, asAny.gtin]
    .map((value) => normalizeBarcode(String(value ?? '')))
    .find(Boolean)
  if (direct) return direct

  const details = typeof asAny.details === 'string' ? asAny.details : ''
  if (!details) return null
  const m = details.match(/(?:UPC|EAN|GTIN|Barcode)\s*:?\s*([0-9\-\s]{8,20})/i)
  return normalizeBarcode(m?.[1] ?? '')
}

function normalizeBarcode(value: string) {
  const digits = value.replace(/\D+/g, '')
  if (digits.length === 8 || digits.length === 12 || digits.length === 13) {
    return digits
  }
  return null
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
