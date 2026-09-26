import { describe, expect, it } from 'vitest'

import { normalizeNativeBlockStyle, normalizeNativePatternStyle } from './native-document'

describe('native document colors', () => {
  it('preserves alpha in a page background', () => {
    expect(normalizeNativePatternStyle({ backgroundColor: '#12345680' }).backgroundColor).toBe('#12345680')
  })

  it('preserves alpha in the title background', () => {
    expect(normalizeNativePatternStyle({ coverBackgroundColor: '#65432100' }).coverBackgroundColor).toBe('#65432100')
  })

  it('derives the legacy title background from the page color', () => {
    expect(normalizeNativePatternStyle({ backgroundColor: '#123456' }).coverBackgroundColor).toBe('#123456EB')
  })

  it('preserves alpha in a block background', () => {
    expect(normalizeNativeBlockStyle({ backgroundColor: '#abcdef33' }).backgroundColor).toBe('#ABCDEF33')
  })

  it('rejects malformed alpha colors', () => {
    expect(normalizeNativeBlockStyle({ backgroundColor: '#1234567' }).backgroundColor).toBe('#FFFFFF')
  })

  it('normalizes persisted built-in widget styles', () => {
    const style = normalizeNativePatternStyle({ widgetStyles: { palette: { backgroundColor: '#123456', textAlign: 'right', padding: 18 } } })

    expect(style.widgetStyles.palette?.backgroundColor).toBe('#123456')
    expect(style.widgetStyles.palette?.textAlign).toBe('right')
    expect(style.widgetStyles.palette?.padding).toBe(18)
  })

  it('defaults text alignment to left instead of using legacy horizontal positioning', () => {
    expect(normalizeNativeBlockStyle({ horizontalAlign: 'right' }).textAlign).toBe('left')
  })

  it('persists private finalization independently in the native document', () => {
    expect(normalizeNativePatternStyle({ isFinalized: true }).isFinalized).toBe(true)
    expect(normalizeNativePatternStyle({ isFinalized: false }).isFinalized).toBe(false)
  })

  it('normalizes Hero Pattern colors and opacity', () => {
    const style = normalizeNativePatternStyle({ backgroundColor: '#EEEEEE', patternBackgroundColor: '#112233', patternColor: '#AABBCC', patternOpacity: 47 })

    expect(style.patternBackgroundColor).toBe('#112233')
    expect(style.patternColor).toBe('#AABBCC')
    expect(style.patternOpacity).toBe(47)
  })

  it('maps legacy background patterns to Hero Patterns equivalents', () => {
    expect(normalizeNativePatternStyle({ backgroundPattern: 'dots' }).backgroundPattern).toBe('polkaDots')
    expect(normalizeNativePatternStyle({ backgroundPattern: 'stars' }).backgroundPattern).toBe('fourPointStars')
  })
})
