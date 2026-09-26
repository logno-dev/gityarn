import { normalizeNativeGridLayout } from './native-layout'
import type { NativeGridItem } from './native-layout'

export const nativeBackgroundPatterns = ['none', 'architect', 'hexagons', 'wiggle', 'fourPointStars', 'bubbles', 'polkaDots', 'formalInvitation', 'tinyCheckers', 'charlieBrown', 'diagonalLines', 'diagonalStripes', 'fallingTriangles', 'hideout', 'houndstooth', 'leaf', 'moroccan', 'rain', 'stripes', 'ticTacToe'] as const
export type NativeBackgroundPattern = typeof nativeBackgroundPatterns[number]

export type NativePatternStyle = {
  isFinalized: boolean
  coverLayout: 'hero' | 'split' | 'minimal'
  headingFont: 'serif' | 'sans' | 'rounded' | 'fraunces' | 'playfair' | 'lora' | 'quicksand' | 'raleway' | 'fredoka' | 'pacifico' | 'caveat' | 'comfortaa' | 'balsamiq'
  bodyFont: 'sans' | 'serif' | 'mono' | 'dm-sans' | 'atkinson' | 'lora' | 'nunito' | 'raleway' | 'source-serif' | 'space-mono' | 'fredoka' | 'comfortaa' | 'balsamiq' | 'patrick-hand'
  backgroundColor: string
  coverBackgroundColor: string
  textColor: string
  accentColor: string
  noteColor: string
  rowDensity: 'comfortable' | 'compact' | 'spacious'
  imageTreatment: 'edge' | 'rounded' | 'framed'
  showStitchCounts: boolean
  backgroundPattern: NativeBackgroundPattern
  patternBackgroundColor: string
  patternColor: string
  patternOpacity: number
  gridLayout: NativeGridItem[]
  widgetStyles: Record<string, NativeBlockStyle>
}

export type NativeBlockStyle = {
  backgroundColor: string
  textColor: string
  borderColor: string
  borderWidth: 0 | 1 | 2 | 4
  borderRadius: number
  padding: number
  float: 'none' | 'left' | 'right'
  width: number
  textAlign: 'left' | 'center' | 'right'
  inheritBackground: boolean
  inheritText: boolean
  inheritBorder: boolean
  inheritPadding: boolean
  inheritRadius: boolean
  inheritWidth: boolean
  inheritAlignment: boolean
}

export const defaultNativePatternStyle: NativePatternStyle = {
  isFinalized: false,
  coverLayout: 'hero',
  headingFont: 'serif',
  bodyFont: 'sans',
  backgroundColor: '#FFFDF8',
  coverBackgroundColor: '#FFFDF8EB',
  textColor: '#2E2433',
  accentColor: '#8A5A9B',
  noteColor: '#FFF1C9',
  rowDensity: 'comfortable',
  imageTreatment: 'rounded',
  showStitchCounts: true,
  backgroundPattern: 'none',
  patternBackgroundColor: '#FFFDF8',
  patternColor: '#D9B9E3',
  patternOpacity: 28,
  gridLayout: [],
  widgetStyles: {},
}

export const defaultNativeBlockStyle: NativeBlockStyle = {
  backgroundColor: '#FFFFFF',
  textColor: '#2E2433',
  borderColor: '#D9CEDD',
  borderWidth: 0,
  borderRadius: 0,
  padding: 0,
  float: 'none',
  width: 100,
  textAlign: 'left',
  inheritBackground: false,
  inheritText: true,
  inheritBorder: false,
  inheritPadding: false,
  inheritRadius: false,
  inheritWidth: false,
  inheritAlignment: false,
}

export function normalizeNativePatternStyle(value: unknown): NativePatternStyle {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const backgroundColor = color(input.backgroundColor, defaultNativePatternStyle.backgroundColor)
  return {
    isFinalized: boolean(input.isFinalized, defaultNativePatternStyle.isFinalized),
    coverLayout: oneOf(input.coverLayout, ['hero', 'split', 'minimal'], defaultNativePatternStyle.coverLayout),
    headingFont: oneOf(input.headingFont, ['serif', 'sans', 'rounded', 'fraunces', 'playfair', 'lora', 'quicksand', 'raleway', 'fredoka', 'pacifico', 'caveat', 'comfortaa', 'balsamiq'], defaultNativePatternStyle.headingFont),
    bodyFont: oneOf(input.bodyFont, ['sans', 'serif', 'mono', 'dm-sans', 'atkinson', 'lora', 'nunito', 'raleway', 'source-serif', 'space-mono', 'fredoka', 'comfortaa', 'balsamiq', 'patrick-hand'], defaultNativePatternStyle.bodyFont),
    backgroundColor,
    coverBackgroundColor: color(input.coverBackgroundColor, `${backgroundColor.slice(0, 7)}EB`),
    textColor: color(input.textColor, defaultNativePatternStyle.textColor),
    accentColor: color(input.accentColor, defaultNativePatternStyle.accentColor),
    noteColor: color(input.noteColor, defaultNativePatternStyle.noteColor),
    rowDensity: oneOf(input.rowDensity, ['comfortable', 'compact', 'spacious'], defaultNativePatternStyle.rowDensity),
    imageTreatment: oneOf(input.imageTreatment, ['edge', 'rounded', 'framed'], defaultNativePatternStyle.imageTreatment),
    showStitchCounts: typeof input.showStitchCounts === 'boolean' ? input.showStitchCounts : defaultNativePatternStyle.showStitchCounts,
    backgroundPattern: normalizeBackgroundPattern(input.backgroundPattern),
    patternBackgroundColor: color(input.patternBackgroundColor, backgroundColor),
    patternColor: color(input.patternColor, defaultNativePatternStyle.patternColor),
    patternOpacity: boundedNumber(input.patternOpacity, 0, 100, defaultNativePatternStyle.patternOpacity),
    gridLayout: normalizeNativeGridLayout(input.gridLayout),
    widgetStyles: normalizeWidgetStyles(input.widgetStyles),
  }
}

function normalizeBackgroundPattern(value: unknown): NativeBackgroundPattern {
  const aliases: Record<string, NativeBackgroundPattern> = {
    dots: 'polkaDots',
    grid: 'architect',
    checks: 'tinyCheckers',
    hearts: 'formalInvitation',
    daisies: 'bubbles',
    yarn: 'wiggle',
    scallops: 'wiggle',
    stars: 'fourPointStars',
  }
  if (typeof value !== 'string') return defaultNativePatternStyle.backgroundPattern
  if (nativeBackgroundPatterns.includes(value as NativeBackgroundPattern)) return value as NativeBackgroundPattern
  return aliases[value] ?? defaultNativePatternStyle.backgroundPattern
}

function normalizeWidgetStyles(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 100).flatMap(([key, style]) => key.length <= 100 ? [[key, normalizeNativeBlockStyle(style)]] : []))
}

export function normalizeNativeBlockStyle(value: unknown): NativeBlockStyle {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    backgroundColor: color(input.backgroundColor, defaultNativeBlockStyle.backgroundColor),
    textColor: color(input.textColor, defaultNativeBlockStyle.textColor),
    borderColor: color(input.borderColor, defaultNativeBlockStyle.borderColor),
    borderWidth: numberChoice(input.borderWidth, [0, 1, 2, 4], defaultNativeBlockStyle.borderWidth),
    borderRadius: boundedNumber(input.borderRadius, 0, 40, defaultNativeBlockStyle.borderRadius),
    padding: boundedNumber(input.padding, 0, 64, defaultNativeBlockStyle.padding),
    float: oneOf(input.float, ['none', 'left', 'right'], defaultNativeBlockStyle.float),
    width: boundedNumber(input.width, 30, 100, defaultNativeBlockStyle.width),
    textAlign: oneOf(input.textAlign, ['left', 'center', 'right'], defaultNativeBlockStyle.textAlign),
    inheritBackground: boolean(input.inheritBackground, defaultNativeBlockStyle.inheritBackground),
    inheritText: boolean(input.inheritText, defaultNativeBlockStyle.inheritText),
    inheritBorder: boolean(input.inheritBorder, defaultNativeBlockStyle.inheritBorder),
    inheritPadding: boolean(input.inheritPadding, defaultNativeBlockStyle.inheritPadding),
    inheritRadius: boolean(input.inheritRadius, defaultNativeBlockStyle.inheritRadius),
    inheritWidth: boolean(input.inheritWidth, defaultNativeBlockStyle.inheritWidth),
    inheritAlignment: boolean(input.inheritAlignment, defaultNativeBlockStyle.inheritAlignment),
  }
}

export function resolveNativeBlockStyle(style: NativeBlockStyle | undefined, parent: NativeBlockStyle): NativeBlockStyle {
  const child = style ?? defaultNativeBlockStyle
  return {
    ...child,
    backgroundColor: child.inheritBackground ? parent.backgroundColor : child.backgroundColor,
    textColor: child.inheritText ? parent.textColor : child.textColor,
    borderColor: child.inheritBorder ? parent.borderColor : child.borderColor,
    borderWidth: child.inheritBorder ? parent.borderWidth : child.borderWidth,
    padding: child.inheritPadding ? parent.padding : child.padding,
    borderRadius: child.inheritRadius ? parent.borderRadius : child.borderRadius,
    width: child.inheritWidth ? parent.width : child.width,
    textAlign: child.inheritAlignment ? parent.textAlign : child.textAlign,
  }
}

function oneOf<const T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === 'string' && values.includes(value as T) ? value as T : fallback
}

function color(value: unknown, fallback: string) {
  return typeof value === 'string' && /^#[0-9A-F]{6}(?:[0-9A-F]{2})?$/i.test(value) ? value.toUpperCase() : fallback
}

function numberChoice<const T extends number>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === 'number' && values.includes(value as T) ? value as T : fallback
}

function boundedNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, Math.round(value))) : fallback
}

function boolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}
