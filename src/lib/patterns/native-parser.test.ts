import { describe, expect, it } from 'vitest'

import { parseCrochetInstruction, parsePatternStep } from './native-parser'

describe('parseCrochetInstruction', () => {
  it('counts a magic ring instruction', () => {
    expect(parseCrochetInstruction('6 sc in MR').stitchCount).toBe(6)
  })

  it('counts a foundation chain', () => {
    expect(parseCrochetInstruction('ch 21').stitchCount).toBe(21)
  })

  it('counts a chain declaration from a number alone', () => {
    expect(parsePatternStep('chain', '21').stitchCount).toBe(21)
  })

  it('counts stitches placed in a magic ring', () => {
    expect(parsePatternStep('magic-ring', '6 sc').stitchCount).toBe(6)
  })

  it('carries the previous count through sc around', () => {
    expect(parsePatternStep('round', 'sc around', 24).stitchCount).toBe(24)
  })

  it('counts repeated increases', () => {
    expect(parseCrochetInstruction('inc x 6').stitchCount).toBe(12)
  })

  it('counts a repeated stitch group', () => {
    expect(parseCrochetInstruction('(2 sc, inc) × 6').stitchCount).toBe(24)
  })

  it('accepts conventional shorthand without parentheses', () => {
    expect(parseCrochetInstruction('2 sc, inc × 6').stitchCount).toBe(24)
  })

  it('warns when a declared count is inconsistent', () => {
    const result = parseCrochetInstruction('(sc, inc) x 6 [17]')
    expect(result.stitchCount).toBe(18)
    expect(result.warning).toContain('declares 17')
  })

  it('returns a warning for prose it cannot calculate', () => {
    const result = parseCrochetInstruction('continue evenly around')
    expect(result.stitchCount).toBeNull()
    expect(result.warning).toContain('Could not calculate')
  })
})
