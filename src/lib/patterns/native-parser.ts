export type ParsedStitchTerm = {
  abbreviation: string
  count: number
  outputPerStitch: number
}

export type ParsedInstruction = {
  stitchCount: number | null
  declaredCount: number | null
  repeatCount: number
  terms: ParsedStitchTerm[]
  warning: string | null
}

export type PatternStepType = 'chain' | 'magic-ring' | 'row' | 'round'

const stitchOutput: Record<string, number> = {
  ch: 1,
  sc: 1,
  hdc: 1,
  dc: 1,
  tr: 1,
  slst: 1,
  sl: 1,
  inc: 2,
  dec: 1,
}

export function parseCrochetInstruction(source: string): ParsedInstruction {
  const declaredMatch = source.match(/\[\s*(\d+)\s*\]\s*$/)
  const declaredCount = declaredMatch ? Number(declaredMatch[1]) : null
  let expression = source.replace(/\[\s*\d+\s*\]\s*$/, '').trim().toLowerCase()
  expression = expression.replace(/[×✕]/g, 'x').replace(/\bsl\s+st\b/g, 'slst')

  const repeatMatch = expression.match(/\s*x\s*(\d+)\s*$/)
  const repeatCount = repeatMatch ? Number(repeatMatch[1]) : 1
  if (repeatMatch) expression = expression.slice(0, repeatMatch.index).trim()
  if (expression.startsWith('(') && expression.endsWith(')')) expression = expression.slice(1, -1).trim()

  const terms: ParsedStitchTerm[] = []
  const unsupported: string[] = []
  for (const rawTerm of expression.split(',').map((term) => term.trim()).filter(Boolean)) {
    const cleaned = rawTerm.replace(/\s+(?:in\s+mr|around|in\s+each.*)$/i, '').trim()
    const match = cleaned.match(/^(?:(\d+)\s*)?([a-z]+)(?:\s*(\d+))?$/)
    if (!match) {
      unsupported.push(rawTerm)
      continue
    }
    const abbreviation = match[2] ?? ''
    const outputPerStitch = stitchOutput[abbreviation]
    if (!outputPerStitch) {
      unsupported.push(rawTerm)
      continue
    }
    const count = Number(match[1] ?? match[3] ?? 1)
    terms.push({ abbreviation, count, outputPerStitch })
  }

  const stitchCount = terms.length && !unsupported.length
    ? terms.reduce((total, term) => total + term.count * term.outputPerStitch, 0) * repeatCount
    : null
  let warning: string | null = null
  if (unsupported.length) warning = `Could not calculate: ${unsupported.join(', ')}`
  else if (declaredCount !== null && stitchCount !== declaredCount) warning = `Calculated ${stitchCount}, but the instruction declares ${declaredCount}.`

  return { stitchCount, declaredCount, repeatCount, terms, warning }
}

export function parsePatternStep(rowType: PatternStepType, source: string, previousStitchCount: number | null = null): ParsedInstruction {
  if (rowType !== 'chain') {
    const parsed = parseCrochetInstruction(source)
    if (!/^sc\s+around(?:\s*\[\s*\d+\s*\])?$/i.test(source.trim())) return parsed
    const stitchCount = previousStitchCount ?? parsed.declaredCount
    return {
      ...parsed,
      stitchCount,
      warning: stitchCount === null
        ? 'Add a stitch count to the previous step or declare this count in brackets.'
        : parsed.declaredCount !== null && stitchCount !== parsed.declaredCount
          ? `Previous step has ${stitchCount}, but the instruction declares ${parsed.declaredCount}.`
          : null,
    }
  }
  const cleaned = source.trim().toLowerCase().replace(/^ch\s*/, '')
  const count = /^\d+$/.test(cleaned) ? Number(cleaned) : null
  return {
    stitchCount: count,
    declaredCount: null,
    repeatCount: 1,
    terms: count === null ? [] : [{ abbreviation: 'ch', count, outputPerStitch: 1 }],
    warning: count === null && cleaned ? 'Enter the number of chains.' : null,
  }
}
