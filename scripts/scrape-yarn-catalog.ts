import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { and, eq } from 'drizzle-orm'
import { load } from 'cheerio'
import { z } from 'zod'

import { getDb } from '../src/lib/db/client'
import { barcodes, manufacturers, yarnColorways, yarnLines } from '../src/lib/db/schema'

const selectorFieldSchema = z.string().min(1)

const selectorsSchema = z.object({
  card: selectorFieldSchema,
  lineName: selectorFieldSchema,
  colorName: selectorFieldSchema.optional(),
  productUrl: selectorFieldSchema.optional(),
  fiberContent: selectorFieldSchema.optional(),
  weightClass: selectorFieldSchema.optional(),
  yardageMeters: selectorFieldSchema.optional(),
  needleOrHookRange: selectorFieldSchema.optional(),
  barcode: selectorFieldSchema.optional(),
  colorCode: selectorFieldSchema.optional(),
})

const detailSelectorsSchema = z
  .object({
    fiberContent: selectorFieldSchema.optional(),
    weightClass: selectorFieldSchema.optional(),
    yardageMeters: selectorFieldSchema.optional(),
    needleOrHookRange: selectorFieldSchema.optional(),
    barcode: selectorFieldSchema.optional(),
  })
  .optional()

const detailRecordSelectorsSchema = z
  .object({
    card: selectorFieldSchema,
    colorName: selectorFieldSchema.optional(),
    colorCode: selectorFieldSchema.optional(),
    barcode: selectorFieldSchema.optional(),
    productUrl: selectorFieldSchema.optional(),
  })
  .optional()

const productJsonSchema = z
  .object({
    template: z.string().url(),
    colorOptionNames: z.array(z.string().min(1)).default(['color', 'colour']),
    skuAsColorCode: z.boolean().default(true),
  })
  .optional()

const productFeedSchema = z
  .object({
    urlTemplate: z.string().url(),
    start: z.number().int().min(1).default(1),
    end: z.number().int().min(1).default(1),
    step: z.number().int().min(1).default(1),
    includeProductTypes: z.array(z.string()).default([]),
    excludeProductTypes: z.array(z.string()).default([]),
  })
  .optional()

const sourceConfigSchema = z.object({
  manufacturer: z.string().min(1),
  websiteUrl: z.string().url(),
  pages: z.array(z.string().url()).default([]),
  pagination: z
    .object({
      template: z.string().url(),
      start: z.number().int().min(1).default(1),
      end: z.number().int().min(1),
      step: z.number().int().min(1).default(1),
    })
    .optional(),
  selectors: selectorsSchema,
  productFeed: productFeedSchema,
  productJson: productJsonSchema,
  detailSelectors: detailSelectorsSchema,
  detailRecordSelectors: detailRecordSelectorsSchema,
  splitColorsBy: z.array(z.string().min(1)).default([',', '/', '|']),
  requestDelayMs: z.number().int().min(0).max(10000).default(0),
  disabled: z.boolean().default(false),
})

const sourceConfigListSchema = z.array(sourceConfigSchema)

type SourceConfig = z.infer<typeof sourceConfigSchema>

type ScrapedRecord = {
  manufacturer: string
  lineName: string
  colorName: string | null
  colorCode: string | null
  barcode: string | null
  productUrl: string | null
  fiberContent: string | null
  weightClass: string | null
  yardageMeters: number | null
  needleOrHookRange: string | null
  sourcePage: string
}

type CliOptions = {
  seed: boolean
  verbose: boolean
  sourceFilter: string | null
  limitPagesPerSource: number | null
}

const sourcesFilePath = path.resolve(process.cwd(), 'data/sources/manufacturers.json')

async function main() {
  const options = parseCliOptions(process.argv)
  const sourceConfigs = await loadSourceConfigs()

  const eligibleSources = sourceConfigs.filter((source) => {
    if (source.disabled) {
      return false
    }
    if (!options.sourceFilter) {
      return true
    }
    return slugify(source.manufacturer) === options.sourceFilter
  })

  if (!eligibleSources.length) {
    throw new Error('No eligible sources found. Check disabled flags and --source filter.')
  }

  const records: ScrapedRecord[] = []
  const detailPageCache = new Map<string, string>()
  const productJsonCache = new Map<string, unknown>()

  for (const source of eligibleSources) {
    const sourcePages = buildPageList(source)
    const pagesToRun =
      options.limitPagesPerSource === null ? sourcePages : sourcePages.slice(0, options.limitPagesPerSource)

    if (options.verbose) {
      console.log(`Scraping source: ${source.manufacturer} (${pagesToRun.length} page(s))`)
    }

    const feedItems = source.productFeed
      ? await fetchProductFeedItems(source, options, source.requestDelayMs)
      : null

    if (feedItems) {
      if (options.verbose) {
        console.log(`  feed -> ${feedItems.length} product(s)`)
      }

      for (const item of feedItems) {
        const baseRecord: ScrapedRecord = {
          manufacturer: source.manufacturer,
          lineName: item.lineName,
          colorName: null,
          colorCode: null,
          barcode: null,
          productUrl: item.productUrl,
          fiberContent: item.fiberContent,
          weightClass: item.weightClass,
          yardageMeters: null,
          needleOrHookRange: null,
          sourcePage: item.sourcePage,
        }

        const detailValues = await extractDetailValues(source, detailPageCache, item.productUrl, options.verbose)
        const hydrated = mergeDetailValues(baseRecord, detailValues)
        const productJsonRecords = await extractProductJsonRecords(source, productJsonCache, item.productUrl, options.verbose)

        if (productJsonRecords.length) {
          for (const jsonRecord of productJsonRecords) {
            records.push(mergeDetailValues(hydrated, jsonRecord))
          }
        } else {
          records.push(hydrated)
        }
      }

      continue
    }

    for (const pageUrl of pagesToRun) {
      if (source.requestDelayMs > 0) {
        await sleep(source.requestDelayMs)
      }

      const response = await fetch(pageUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; GITYarnCatalogBot/1.0; +https://gityarn.com/catalog-bot)',
        },
      })

      if (!response.ok) {
        console.warn(`Skipping ${pageUrl}: ${response.status}`)
        continue
      }

      const html = await response.text()
      const $ = load(html)

      const cards = $(source.selectors.card).toArray()
      if (options.verbose) {
        console.log(`  ${pageUrl} -> ${cards.length} card(s)`)
      }

      for (const cardNode of cards) {
        const card = $(cardNode)
        const lineName = cleanText(extractFromNode($, card, source.selectors.lineName))
        if (!lineName) {
          continue
        }

        const productUrlRaw = cleanText(extractFromNode($, card, source.selectors.productUrl))
        const productUrl = normalizeUrl(productUrlRaw, source.websiteUrl)

        const colorNames = extractColorNames(
          cleanText(extractFromNode($, card, source.selectors.colorName)),
          source.splitColorsBy,
        )

        const baseRecord: ScrapedRecord = {
          manufacturer: source.manufacturer,
          lineName,
          colorName: null,
          colorCode: cleanText(extractFromNode($, card, source.selectors.colorCode)),
          barcode: normalizeBarcode(cleanText(extractFromNode($, card, source.selectors.barcode))),
          productUrl,
          fiberContent: cleanText(extractFromNode($, card, source.selectors.fiberContent)),
          weightClass: cleanText(extractFromNode($, card, source.selectors.weightClass)),
          yardageMeters: parseYardageToMeters(cleanText(extractFromNode($, card, source.selectors.yardageMeters))),
          needleOrHookRange: cleanText(extractFromNode($, card, source.selectors.needleOrHookRange)),
          sourcePage: pageUrl,
        }

        const detailValues = await extractDetailValues(source, detailPageCache, productUrl, options.verbose)
        const hydrated = mergeDetailValues(baseRecord, detailValues)
        const productJsonRecords = await extractProductJsonRecords(source, productJsonCache, productUrl, options.verbose)
        if (productJsonRecords.length) {
          for (const jsonRecord of productJsonRecords) {
            records.push(mergeDetailValues(hydrated, jsonRecord))
          }
          continue
        }

        const detailDerived = await extractDetailDerivedRecords(source, detailPageCache, productUrl, options.verbose)

        if (detailDerived.length) {
          for (const detailRecord of detailDerived) {
            records.push(mergeDetailValues(hydrated, detailRecord))
          }
          continue
        }

        if (!colorNames.length) {
          records.push(hydrated)
          continue
        }

        for (const colorName of colorNames) {
          records.push({ ...hydrated, colorName })
        }
      }
    }
  }

  const normalized = deduplicate(records)
  await persistJson(normalized, eligibleSources, options)

  if (options.seed) {
    await seedDatabase(normalized, options.verbose)
  }

  console.log(
    `Scraped ${normalized.length} normalized record(s) from ${eligibleSources.length} source(s).${
      options.seed ? ' Seeded to database.' : ''
    }`,
  )
}

async function loadSourceConfigs() {
  const rawSourceData = await readFile(sourcesFilePath, 'utf-8')
  const parsed = sourceConfigListSchema.safeParse(JSON.parse(rawSourceData))
  if (!parsed.success) {
    throw new Error(`Invalid source config: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`)
  }
  return parsed.data
}

function parseCliOptions(argv: string[]): CliOptions {
  const seed = argv.includes('--seed')
  const verbose = argv.includes('--verbose')

  const sourceArg = argv.find((item) => item.startsWith('--source='))
  const limitArg = argv.find((item) => item.startsWith('--limit-pages='))

  const sourceFilter = sourceArg ? slugify(sourceArg.slice('--source='.length)) : null
  const limitPagesPerSource = limitArg ? Number(limitArg.slice('--limit-pages='.length)) : null

  return {
    seed,
    verbose,
    sourceFilter,
    limitPagesPerSource: Number.isFinite(limitPagesPerSource) && (limitPagesPerSource ?? 0) > 0 ? limitPagesPerSource : null,
  }
}

function buildPageList(source: SourceConfig) {
  const pages = [...source.pages]
  if (!source.pagination) {
    return pages
  }

  const { template, start, end, step } = source.pagination
  for (let page = start; page <= end; page += step) {
    pages.push(template.replace('{page}', String(page)))
  }
  return dedupeStrings(pages)
}

type FeedItem = {
  lineName: string
  productUrl: string
  sourcePage: string
  fiberContent: string | null
  weightClass: string | null
}

async function fetchProductFeedItems(source: SourceConfig, options: CliOptions, delayMs: number): Promise<FeedItem[]> {
  if (!source.productFeed) {
    return []
  }

  const feed = source.productFeed
  const pages: number[] = []
  for (let page = feed.start; page <= feed.end; page += feed.step) {
    pages.push(page)
  }

  const limitedPages = options.limitPagesPerSource === null ? pages : pages.slice(0, options.limitPagesPerSource)
  const items: FeedItem[] = []

  for (const pageNumber of limitedPages) {
    if (delayMs > 0) {
      await sleep(delayMs)
    }

    const url = feed.urlTemplate.replace('{page}', String(pageNumber))
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (compatible; GITYarnCatalogBot/1.0; +https://gityarn.com/catalog-bot)',
      },
    })

    if (!response.ok) {
      console.warn(`Skipping feed ${url}: ${response.status}`)
      continue
    }

    const payload = (await response.json()) as {
      products?: Array<{ title?: string; handle?: string; product_type?: string; tags?: string[] }>
    }

    for (const product of payload.products ?? []) {
      const title = cleanText(product.title)
      const handle = cleanText(product.handle)
      if (!title || !handle) {
        continue
      }

      const productType = cleanText(product.product_type)?.toLowerCase()
      if (feed.includeProductTypes.length && (!productType || !feed.includeProductTypes.map((t) => t.toLowerCase()).includes(productType))) {
        continue
      }
      if (feed.excludeProductTypes.length && productType && feed.excludeProductTypes.map((t) => t.toLowerCase()).includes(productType)) {
        continue
      }

      const tags = product.tags ?? []
      const weightTag = tags.find((tag) => tag.startsWith('Weight_')) ?? null
      const fiberTag = tags.find((tag) => tag.startsWith('Fiber_')) ?? null

      items.push({
        lineName: title,
        productUrl: normalizeUrl(`/products/${handle}`, source.websiteUrl) ?? `${source.websiteUrl}/products/${handle}`,
        sourcePage: url,
        fiberContent: fiberTag?.replace('Fiber_', '').replace(/-/g, ' ') ?? null,
        weightClass: weightTag?.replace('Weight_', '').replace(/-/g, ' ') ?? null,
      })
    }
  }

  return deduplicateFeedItems(items)
}

function deduplicateFeedItems(items: FeedItem[]) {
  const byUrl = new Map<string, FeedItem>()
  for (const item of items) {
    if (!byUrl.has(item.productUrl)) {
      byUrl.set(item.productUrl, item)
    }
  }
  return [...byUrl.values()]
}

async function extractDetailValues(
  source: SourceConfig,
  cache: Map<string, string>,
  productUrl: string | null,
  verbose: boolean,
): Promise<Partial<ScrapedRecord>> {
  if (!source.detailSelectors || !productUrl) {
    return {}
  }

  const html = await getDetailHtml(cache, productUrl, verbose)
  if (!html) {
    return {}
  }

  const $ = load(html)

  return {
    fiberContent: cleanText(extractFromNode($, null, source.detailSelectors.fiberContent)),
    weightClass: cleanText(extractFromNode($, null, source.detailSelectors.weightClass)),
    yardageMeters: parseYardageToMeters(cleanText(extractFromNode($, null, source.detailSelectors.yardageMeters))),
    needleOrHookRange: cleanText(extractFromNode($, null, source.detailSelectors.needleOrHookRange)),
    barcode: normalizeBarcode(cleanText(extractFromNode($, null, source.detailSelectors.barcode))),
  }
}

async function extractDetailDerivedRecords(
  source: SourceConfig,
  cache: Map<string, string>,
  productUrl: string | null,
  verbose: boolean,
): Promise<Array<Partial<ScrapedRecord>>> {
  if (!source.detailRecordSelectors || !productUrl) {
    return []
  }

  const html = await getDetailHtml(cache, productUrl, verbose)
  if (!html) {
    return []
  }

  const $ = load(html)
  const detailCards = $(source.detailRecordSelectors.card).toArray()
  const detailRecords: Array<Partial<ScrapedRecord>> = []

  for (const detailCardNode of detailCards) {
    const detailCard = $(detailCardNode)

    detailRecords.push({
      colorName: cleanText(extractFromNode($, detailCard, source.detailRecordSelectors.colorName)),
      colorCode: cleanText(extractFromNode($, detailCard, source.detailRecordSelectors.colorCode)),
      barcode: normalizeBarcode(cleanText(extractFromNode($, detailCard, source.detailRecordSelectors.barcode))),
      productUrl: normalizeUrl(
        cleanText(extractFromNode($, detailCard, source.detailRecordSelectors.productUrl)) ?? productUrl,
        source.websiteUrl,
      ),
    })
  }

  return detailRecords.filter((record) => Boolean(record.colorName || record.colorCode || record.barcode))
}

async function extractProductJsonRecords(
  source: SourceConfig,
  cache: Map<string, unknown>,
  productUrl: string | null,
  verbose: boolean,
): Promise<Array<Partial<ScrapedRecord>>> {
  if (!source.productJson || !productUrl) {
    return []
  }

  const handle = extractProductHandle(productUrl)
  if (!handle) {
    return []
  }

  const endpoint = source.productJson.template.replace('{handle}', handle)
  let payload = cache.get(endpoint)

  if (!payload) {
    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (compatible; GITYarnCatalogBot/1.0; +https://gityarn.com/catalog-bot)',
      },
    })

    if (!response.ok) {
      if (verbose) {
        console.warn(`  Product JSON skipped ${endpoint}: ${response.status}`)
      }
      return []
    }

    payload = await response.json()
    cache.set(endpoint, payload)
  }

  const data = payload as {
    options?: Array<string | { name?: string }>
    variants?: Array<{ option1?: string; option2?: string; option3?: string; barcode?: string; sku?: string; featured_image?: { src?: string } }>
  }

  if (!data.variants?.length) {
    return []
  }

  const optionNames = (data.options ?? [])
    .map((item) => {
      if (typeof item === 'string') {
        return item
      }
      return item.name ?? ''
    })
    .map((item) => item.trim().toLowerCase())
  const preferred = source.productJson.colorOptionNames.map((item) => item.toLowerCase())
  const colorOptionIndex = optionNames.findIndex((optionName) => preferred.includes(optionName))

  return data.variants.map((variant) => {
    const variantOptions = [variant.option1, variant.option2, variant.option3]
    const colorName = cleanText(
      colorOptionIndex >= 0 ? variantOptions[colorOptionIndex] ?? null : variant.option1 ?? null,
    )

    return {
      colorName,
      barcode: normalizeBarcode(cleanText(variant.barcode ?? null)),
      colorCode: source.productJson?.skuAsColorCode ? cleanText(variant.sku ?? null) : null,
      productUrl,
    } as Partial<ScrapedRecord>
  })
}

function extractProductHandle(productUrl: string) {
  try {
    const pathname = new URL(productUrl).pathname
    const segments = pathname.split('/').filter(Boolean)
    const productsIndex = segments.findIndex((segment) => segment === 'products')
    if (productsIndex < 0) {
      return null
    }
    return segments[productsIndex + 1] ?? null
  } catch {
    return null
  }
}

async function getDetailHtml(cache: Map<string, string>, productUrl: string, verbose: boolean) {
  let html = cache.get(productUrl)
  if (html) {
    return html
  }

  const response = await fetch(productUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; GITYarnCatalogBot/1.0; +https://gityarn.com/catalog-bot)',
    },
  })

  if (!response.ok) {
    if (verbose) {
      console.warn(`  Detail page skipped ${productUrl}: ${response.status}`)
    }
    return null
  }

  html = await response.text()
  cache.set(productUrl, html)
  return html
}

function mergeDetailValues(record: ScrapedRecord, detail: Partial<ScrapedRecord>): ScrapedRecord {
  return {
    ...record,
    colorName: record.colorName ?? detail.colorName ?? null,
    colorCode: record.colorCode ?? detail.colorCode ?? null,
    productUrl: record.productUrl ?? detail.productUrl ?? null,
    fiberContent: record.fiberContent ?? detail.fiberContent ?? null,
    weightClass: record.weightClass ?? detail.weightClass ?? null,
    yardageMeters: record.yardageMeters ?? detail.yardageMeters ?? null,
    needleOrHookRange: record.needleOrHookRange ?? detail.needleOrHookRange ?? null,
    barcode: record.barcode ?? detail.barcode ?? null,
  }
}

function extractFromNode(
  $: ReturnType<typeof load>,
  root: ReturnType<ReturnType<typeof load>> | null,
  query: string | undefined,
) {
  if (!query) {
    return null
  }

  const [selectorPart, modePart] = query.split('|').map((value) => value.trim())
  const target = selectorPart === ':self' ? root : root ? root.find(selectorPart).first() : $(selectorPart).first()

  if (!target || !target.length) {
    return null
  }

  if (modePart?.startsWith('attr:')) {
    return target.attr(modePart.slice(5)) ?? null
  }

  if (modePart === 'html') {
    return target.html()
  }

  return target.text()
}

function extractColorNames(rawColorName: string | null, delimiters: string[]) {
  if (!rawColorName) {
    return []
  }

  let working = rawColorName
  for (const delimiter of delimiters) {
    working = working.split(delimiter).join('|||')
  }

  return dedupeStrings(
    working
      .split('|||')
      .map((item) => cleanText(item))
      .filter((item): item is string => Boolean(item)),
  )
}

function parseYardageToMeters(rawValue: string | null) {
  if (!rawValue) {
    return null
  }

  const value = rawValue.toLowerCase().replace(/,/g, '')
  const metersMatch = value.match(/(\d+(?:\.\d+)?)\s*m\b/)
  if (metersMatch) {
    return Math.round(Number(metersMatch[1]))
  }

  const yardsMatch = value.match(/(\d+(?:\.\d+)?)\s*yd\b/)
  if (yardsMatch) {
    return Math.round(Number(yardsMatch[1]) * 0.9144)
  }

  return null
}

function normalizeBarcode(value: string | null) {
  if (!value) {
    return null
  }

  const normalized = value.replace(/[^0-9]/g, '')
  return normalized.length >= 8 ? normalized : null
}

function normalizeUrl(url: string | null, websiteUrl: string) {
  if (!url) {
    return null
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  return new URL(url, websiteUrl).toString()
}

function deduplicate(records: ScrapedRecord[]) {
  const map = new Map<string, ScrapedRecord>()

  for (const record of records) {
    const key = [
      slugify(record.manufacturer),
      slugify(record.lineName),
      slugify(record.colorName ?? ''),
      record.productUrl ?? '',
      record.barcode ?? '',
    ].join('::')

    if (!map.has(key)) {
      map.set(key, record)
      continue
    }

    const current = map.get(key)
    if (!current) {
      continue
    }

    map.set(key, {
      ...current,
      fiberContent: current.fiberContent ?? record.fiberContent,
      weightClass: current.weightClass ?? record.weightClass,
      yardageMeters: current.yardageMeters ?? record.yardageMeters,
      needleOrHookRange: current.needleOrHookRange ?? record.needleOrHookRange,
      colorCode: current.colorCode ?? record.colorCode,
      barcode: current.barcode ?? record.barcode,
    })
  }

  return [...map.values()]
}

async function persistJson(records: ScrapedRecord[], sources: SourceConfig[], options: CliOptions) {
  const now = new Date().toISOString().replace(/[:.]/g, '-')
  const outputDir = path.resolve(process.cwd(), 'data/catalog')
  await mkdir(outputDir, { recursive: true })

  const metadata = {
    generatedAt: new Date().toISOString(),
    sourceCount: sources.length,
    scrapedRecordCount: records.length,
    options,
    sources: sources.map((source) => source.manufacturer),
  }

  await writeFile(path.join(outputDir, 'latest.json'), JSON.stringify(records, null, 2))
  await writeFile(path.join(outputDir, 'latest.meta.json'), JSON.stringify(metadata, null, 2))
  await writeFile(path.join(outputDir, `${now}.json`), JSON.stringify(records, null, 2))
}

async function seedDatabase(records: ScrapedRecord[], verbose: boolean) {
  const db = getDb()

  for (const rawRecord of records) {
    const record = normalizeScrapedRecord(rawRecord)
    const manufacturerSlug = slugify(record.manufacturer)
    const lineSlug = slugify(`${record.manufacturer}-${record.lineName}`)

    let manufacturer = await db.query.manufacturers.findFirst({
      where: eq(manufacturers.slug, manufacturerSlug),
    })

    if (!manufacturer) {
      const manufacturerId = crypto.randomUUID()
      await db.insert(manufacturers).values({
        id: manufacturerId,
        name: record.manufacturer,
        slug: manufacturerSlug,
      })
      manufacturer = { id: manufacturerId } as typeof manufacturers.$inferSelect
      if (verbose) {
        console.log(`  + manufacturer: ${record.manufacturer}`)
      }
    }

    let yarnLine = await db.query.yarnLines.findFirst({
      where: eq(yarnLines.slug, lineSlug),
    })

    if (!yarnLine) {
      const yarnLineId = crypto.randomUUID()
      await db.insert(yarnLines).values({
        id: yarnLineId,
        manufacturerId: manufacturer.id,
        name: record.lineName,
        slug: lineSlug,
        productUrl: record.productUrl,
        fiberContent: record.fiberContent,
        weightClass: record.weightClass,
        yardageMeters: record.yardageMeters,
        needleOrHookRange: record.needleOrHookRange,
      })
      yarnLine = { id: yarnLineId } as typeof yarnLines.$inferSelect
      if (verbose) {
        console.log(`  + yarn line: ${record.lineName}`)
      }
    }

    let colorwayId: string | null = null

    if (record.colorName) {
      let existingColorway = await db.query.yarnColorways.findFirst({
        where: and(eq(yarnColorways.yarnLineId, yarnLine.id), eq(yarnColorways.name, record.colorName)),
      })

      if (!existingColorway && record.colorCode) {
        existingColorway = await db.query.yarnColorways.findFirst({
          where: and(eq(yarnColorways.yarnLineId, yarnLine.id), eq(yarnColorways.colorCode, record.colorCode)),
        })
      }

      if (!existingColorway) {
        colorwayId = crypto.randomUUID()
        await db.insert(yarnColorways).values({
          id: colorwayId,
          yarnLineId: yarnLine.id,
          name: record.colorName,
          colorCode: record.colorCode,
        })
      } else {
        colorwayId = existingColorway.id
        if (!existingColorway.colorCode && record.colorCode) {
          await db
            .update(yarnColorways)
            .set({ colorCode: record.colorCode, updatedAt: Date.now() })
            .where(eq(yarnColorways.id, existingColorway.id))
        }
      }
    }

    if (record.barcode) {
      const existingBarcode = await db.query.barcodes.findFirst({ where: eq(barcodes.barcodeValue, record.barcode) })
      if (!existingBarcode) {
        await db.insert(barcodes).values({
          id: crypto.randomUUID(),
          barcodeValue: record.barcode,
          format: inferBarcodeFormat(record.barcode),
          yarnLineId: yarnLine.id,
          yarnColorwayId: colorwayId,
        })
      } else if (!existingBarcode.yarnColorwayId && colorwayId) {
        await db
          .update(barcodes)
          .set({
            yarnLineId: existingBarcode.yarnLineId ?? yarnLine.id,
            yarnColorwayId: colorwayId,
            updatedAt: Date.now(),
          })
          .where(eq(barcodes.id, existingBarcode.id))
      }
    }
  }
}

function normalizeScrapedRecord(record: ScrapedRecord): ScrapedRecord {
  const normalizedBarcode = normalizeBarcode(record.barcode)
  let colorCode = cleanText(record.colorCode)
  let colorName = cleanText(record.colorName)
  let barcode = normalizedBarcode

  if (colorName) {
    const parsed = extractColorCodeFromName(colorName)
    colorName = parsed.colorName
    colorCode = colorCode ?? parsed.colorCode
  }

  const colorCodeAsBarcode = normalizeBarcode(colorCode)
  if (!barcode && colorCodeAsBarcode) {
    barcode = colorCodeAsBarcode
    colorCode = null
  }

  return {
    ...record,
    colorName,
    colorCode,
    barcode,
  }
}

function extractColorCodeFromName(colorName: string): { colorName: string; colorCode: string | null } {
  const parenthesesMatch = colorName.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  if (parenthesesMatch) {
    const code = normalizeColorCodeCandidate(parenthesesMatch[2])
    if (code) {
      return {
        colorName: cleanText(parenthesesMatch[1]) ?? colorName,
        colorCode: code,
      }
    }
  }

  const suffixMatch = colorName.match(/^(.*?)[\s-]+(?:#|code\s*)?([a-z0-9-]{2,16})\s*$/i)
  if (suffixMatch) {
    const code = normalizeColorCodeCandidate(suffixMatch[2])
    if (code) {
      return {
        colorName: cleanText(suffixMatch[1]) ?? colorName,
        colorCode: code,
      }
    }
  }

  return { colorName, colorCode: null }
}

function normalizeColorCodeCandidate(value: string) {
  const candidate = cleanText(value)?.replace(/^#/, '') ?? null
  if (!candidate) {
    return null
  }
  if (candidate.length < 2 || candidate.length > 16) {
    return null
  }
  if (!/[0-9]/.test(candidate)) {
    return null
  }
  if (!/^[a-z0-9-]+$/i.test(candidate)) {
    return null
  }
  return candidate.toUpperCase()
}

function inferBarcodeFormat(value: string) {
  if (value.length === 8) {
    return 'ean_8'
  }
  if (value.length === 12) {
    return 'upc_a'
  }
  if (value.length === 13) {
    return 'ean_13'
  }
  return 'unknown'
}

function dedupeStrings(values: string[]) {
  return [...new Set(values)]
}

function cleanText(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const cleaned = value.replace(/\s+/g, ' ').trim()
  return cleaned.length ? cleaned : null
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
