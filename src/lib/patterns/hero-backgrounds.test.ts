import { describe, expect, it } from 'vitest'

import { heroBackgroundStyle, nativeBackgroundPatternOptions } from './hero-backgrounds'

describe('Hero Pattern backgrounds', () => {
  it('combines independent foreground, background, and opacity values', () => {
    const style = heroBackgroundStyle('wiggle', '#123456', '#ABCDEF', 35)

    expect(style.backgroundColor).toBe('#ABCDEF')
    expect(style.backgroundImage).toContain('data:image/svg+xml')
    expect(style.backgroundImage).toContain('123456')
    expect(style.backgroundImage).toContain('0.35')
  })

  it('renders no image for the none option', () => {
    expect(heroBackgroundStyle('none', '#123456', '#ABCDEF', 35)).toEqual({ backgroundColor: '#ABCDEF', backgroundImage: undefined })
  })

  it('offers the expanded pattern catalog', () => {
    expect(nativeBackgroundPatternOptions).toHaveLength(20)
    expect(nativeBackgroundPatternOptions).toContainEqual({ value: 'moroccan', label: 'Moroccan' })
    expect(heroBackgroundStyle('ticTacToe', '#123456', '#ABCDEF', 35).backgroundImage).toContain('data:image/svg+xml')
  })
})
