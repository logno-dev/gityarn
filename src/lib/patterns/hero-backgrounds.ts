import type { CSSProperties } from 'react'

import type { NativeBackgroundPattern } from './native-document'

type HeroPattern = Exclude<NativeBackgroundPattern, 'none'>

// Curated from heropatterns.com. Original artwork by Steve Schoger, CC BY 4.0.
const patterns: Record<HeroPattern, { width: number; height: number; body: string }> = {
  architect: { width: 100, height: 199, body: '<path d="M0 199V0h1v1.99L100 199h-1.12L1 4.22V199H0zM100 2h-.12l-1-2H100v2z"/>' },
  hexagons: { width: 28, height: 49, body: '<path d="M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z"/>' },
  wiggle: { width: 52, height: 26, body: '<path d="M10 10c0-2.21-1.79-4-4-4-3.314 0-6-2.686-6-6h2c0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4v2c-3.314 0-6-2.686-6-6 0-2.21-1.79-4-4-4-3.314 0-6-2.686-6-6zm25.464-1.95l8.486 8.486-1.414 1.414-8.486-8.486 1.414-1.414z"/>' },
  fourPointStars: { width: 24, height: 24, body: '<path d="M8 4l4 2-4 2-2 4-2-4-4-2 4-2 2-4 2 4z"/>' },
  bubbles: { width: 100, height: 100, body: '<path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm48 25a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16 36a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm63 31a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM34 90a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm56-76a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 86a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm28-65a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm23-11a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm-6 60a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm29 22a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM32 63a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm57-13a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm-9-21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM60 91a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM35 41a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 60a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>' },
  polkaDots: { width: 20, height: 20, body: '<circle cx="3" cy="3" r="3"/><circle cx="13" cy="13" r="3"/>' },
  formalInvitation: { width: 100, height: 18, body: '<path d="M61.82 18c3.47-1.45 6.86-3.78 11.3-7.34C78 6.76 80.34 5.1 83.87 3.42 88.56 1.16 93.75 0 100 0v6.16C98.76 6.05 97.43 6 96 6c-9.59 0-14.23 2.23-23.13 9.34-1.28 1.03-2.39 1.9-3.4 2.66h-7.65zm-23.64 0H22.52c-1-.76-2.1-1.63-3.4-2.66C11.57 9.3 7.08 6.78 0 6.16V0c6.25 0 11.44 1.16 16.14 3.42 3.53 1.7 5.87 3.35 10.73 7.24 4.45 3.56 7.84 5.9 11.31 7.34zM61.82 0h7.66a39.57 39.57 0 0 1-7.34 4.58C57.44 6.84 52.25 8 46 8S34.56 6.84 29.86 4.58A39.57 39.57 0 0 1 22.52 0h15.66C41.65 1.44 45.21 2 50 2c4.8 0 8.35-.56 11.82-2z"/>' },
  tinyCheckers: { width: 8, height: 8, body: '<path d="M0 0h4v4H0V0zm4 4h4v4H4V4z"/>' },
  charlieBrown: { width: 20, height: 12, body: '<path d="M9.8 12L0 2.2V.8l10 10 10-10v1.4L10.2 12h-.4zm-4 0L0 6.2V4.8L7.2 12H5.8zm8.4 0L20 6.2V4.8L12.8 12h1.4zM9.8 0l.2.2.2-.2h-.4zm-4 0L10 4.2 14.2 0h-1.4L10 2.8 7.2 0H5.8z"/>' },
  diagonalLines: { width: 6, height: 6, body: '<path d="M5 0h1L0 6V5zM6 5v1H5z"/>' },
  diagonalStripes: { width: 40, height: 40, body: '<path d="M0 40L40 0H20L0 20zM40 40V20L20 40z"/>' },
  fallingTriangles: { width: 36, height: 72, body: '<path d="M2 6h12L8 18 2 6zm18 36h12l-6 12-6-12z"/>' },
  hideout: { width: 40, height: 40, body: '<path d="M0 38.59l2.83-2.83 1.41 1.41L1.41 40H0v-1.41zM0 1.4l2.83 2.83 1.41-1.41L1.41 0H0v1.41zM38.59 40l-2.83-2.83 1.41-1.41L40 38.59V40h-1.41zM40 1.41l-2.83 2.83-1.41-1.41L38.59 0H40v1.41zM20 18.6l2.83-2.83 1.41 1.41L21.41 20l2.83 2.83-1.41 1.41L20 21.41l-2.83 2.83-1.41-1.41L18.59 20l-2.83-2.83 1.41-1.41L20 18.59z"/>' },
  houndstooth: { width: 24, height: 24, body: '<path d="M0 18h6l6-6v6h6l-6 6H0zM24 18v6h-6zM24 0l-6 6h-6l6-6zM12 0v6L0 18v-6l6-6H0V0z"/>' },
  leaf: { width: 80, height: 40, body: '<path d="M2.011 39.976c.018-4.594 1.785-9.182 5.301-12.687.475-.474.97-.916 1.483-1.326v9.771L4.54 39.976H2.01zm5.373 0L23.842 23.57c.687 5.351-1.031 10.95-5.154 15.06-.483.483-.987.931-1.508 1.347H7.384zm-7.384 0c.018-5.107 1.982-10.208 5.89-14.104 5.263-5.247 12.718-6.978 19.428-5.192 1.783 6.658.07 14.053-5.137 19.296H.001zm10.806-15.41c3.537-2.116 7.644-2.921 11.614-2.415L10.806 33.73v-9.163zM65.25.75C58.578-1.032 51.164.694 45.93 5.929c-5.235 5.235-6.961 12.649-5.18 19.321 6.673 1.782 14.087.056 19.322-5.179 5.235-5.235 6.961-12.649 5.18-19.321zM43.632 23.783c5.338.683 10.925-1.026 15.025-5.126 4.1-4.1 5.809-9.687 5.126-15.025l-20.151 20.15zm7.186-19.156c3.518-2.112 7.602-2.915 11.55-2.41l-11.55 11.55v-9.14zm-3.475 2.716c-4.1 4.1-5.809 9.687-5.126 15.025l6.601-6.6V6.02c-.51.41-1.002.85-1.475 1.323zM.071 0C.065 1.766.291 3.533.75 5.25 7.422 7.032 14.836 5.306 20.07.071l.07-.071H.072zm17.086 0C13.25 3.125 8.345 4.386 3.632 3.783L7.414 0h9.743zM2.07 0c-.003.791.046 1.582.146 2.368L4.586 0H2.07z"/>' },
  moroccan: { width: 80, height: 88, body: '<path d="M22 21.91V26h-2.001C10.06 26 2 34.059 2 44c0 9.943 8.058 18 17.999 18H22v4.09c8.012.722 14.785 5.738 18 12.73 3.212-6.991 9.983-12.008 18-12.73V62h2.001C69.94 62 78 53.941 78 44c0-9.943-8.058-18-17.999-18H58v-4.09c-8.012-.722-14.785-5.738-18-12.73-3.212 6.991-9.983 12.008-18 12.73zM54 58v4.696c-5.574 1.316-10.455 4.428-14 8.69-3.545-4.262-8.426-7.374-14-8.69V58h-5.993C12.271 58 6 51.734 6 44c0-7.732 6.275-14 14.007-14H26v-4.696c5.574-1.316 10.455-4.428 14-8.69 3.545 4.262 8.426 7.374 14 8.69V30h5.993C67.729 30 74 36.266 74 44c0 7.732-6.275 14-14.007 14H54zM42 88c0-9.941 8.061-18 17.999-18H62v-4.09c8.016-.722 14.787-5.738 18-12.73v7.434c-3.545 4.262-8.426 7.374-14 8.69V74h-5.993C52.275 74 46 80.268 46 88h-4zm-4 0c0-9.943-8.058-18-17.999-18H18v-4.09c-8.012-.722-14.785-5.738-18-12.73v7.434c3.545 4.262 8.426 7.374 14 8.69V74h5.993C27.729 74 34 80.266 34 88h4zm4-88c0 9.943 8.058 18 17.999 18H62v4.09c8.012.722 14.785 5.738 18 12.73v-7.434c-3.545-4.262-8.426-7.374-14-8.69V14h-5.993C52.271 14 46 7.734 46 0h-4zM0 34.82c3.213-6.992 9.984-12.008 18-12.73V18h2.001C29.94 18 38 9.941 38 0h-4c0 7.732-6.275 14-14.007 14H14v4.696c-5.574 1.316-10.455 4.428-14 8.69v7.433z"/>' },
  rain: { width: 12, height: 16, body: '<path d="M4 .99C4 .445 4.444 0 5 0c.552 0 1 .451 1 .99v4.02C6 5.555 5.556 6 5 6c-.552 0-1-.451-1-.99V.99zm6 8c0-.546.444-.99 1-.99.552 0 1 .451 1 .99v4.02c0 .546-.444.99-1 .99-.552 0-1-.451-1-.99V8.99z"/>' },
  stripes: { width: 40, height: 1, body: '<path d="M0 0h20v1H0z"/>' },
  ticTacToe: { width: 64, height: 64, body: '<path d="M8 16c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8zm0-2c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6zm33.414-6l5.95-5.95L45.95.636 40 6.586 34.05.636 32.636 2.05 38.586 8l-5.95 5.95 1.414 1.414L40 9.414l5.95 5.95 1.414-1.414L41.414 8zM40 48c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8zm0-2c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6zM9.414 40l5.95-5.95-1.414-1.414L8 38.586l-5.95-5.95L.636 34.05 6.586 40l-5.95 5.95 1.414 1.414L8 41.414l5.95 5.95 1.414-1.414L9.414 40z"/>' },
}

export const nativeBackgroundPatternOptions: Array<{ value: NativeBackgroundPattern; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'architect', label: 'Architect' },
  { value: 'hexagons', label: 'Hexagons' },
  { value: 'wiggle', label: 'Wiggle' },
  { value: 'fourPointStars', label: 'Four-point stars' },
  { value: 'bubbles', label: 'Bubbles' },
  { value: 'polkaDots', label: 'Polka dots' },
  { value: 'formalInvitation', label: 'Formal invitation' },
  { value: 'tinyCheckers', label: 'Tiny checkers' },
  { value: 'charlieBrown', label: 'Charlie Brown' },
  { value: 'diagonalLines', label: 'Diagonal lines' },
  { value: 'diagonalStripes', label: 'Diagonal stripes' },
  { value: 'fallingTriangles', label: 'Falling triangles' },
  { value: 'hideout', label: 'Hideout' },
  { value: 'houndstooth', label: 'Houndstooth' },
  { value: 'leaf', label: 'Leaf' },
  { value: 'moroccan', label: 'Moroccan' },
  { value: 'rain', label: 'Rain' },
  { value: 'stripes', label: 'Stripes' },
  { value: 'ticTacToe', label: 'Tic-tac-toe' },
]

export function heroBackgroundStyle(pattern: NativeBackgroundPattern, foreground: string, background: string, opacity: number): CSSProperties {
  return {
    backgroundColor: background,
    backgroundImage: pattern === 'none' ? undefined : patternDataUrl(patterns[pattern], foreground, Math.max(0, Math.min(100, opacity)) / 100),
  }
}

function patternDataUrl(pattern: { width: number; height: number; body: string }, color: string, opacity: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pattern.width}" height="${pattern.height}" viewBox="0 0 ${pattern.width} ${pattern.height}" fill="${color}" fill-opacity="${opacity}">${pattern.body}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
