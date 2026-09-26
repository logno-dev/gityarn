import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { NativePatternWidgetContent } from './native-pattern-renderer'
import { defaultNativeBlockStyle, defaultNativePatternStyle } from '#/lib/patterns/native-document'
import type { NativeGridItem } from '#/lib/patterns/native-layout'

const pattern = {
  title: 'Test pattern',
  description: null,
  difficulty: null,
  coverSrc: null,
  style: defaultNativePatternStyle,
}

const pageStyle = { ...defaultNativeBlockStyle, backgroundColor: pattern.style.backgroundColor, textColor: pattern.style.textColor }

describe('NativePatternWidgetContent', () => {
  it('includes reader instructions in the editable color legend', () => {
    const widget: NativeGridItem = { i: 'palette', kind: 'palette', sectionId: null, x: 0, y: 0, w: 12, h: 3 }
    const html = renderToStaticMarkup(<NativePatternWidgetContent colors={[{ id: 'color-a', key: 'A', label: 'Main', hexColor: '#123456' }]} onColorChange={() => undefined} pageStyle={pageStyle} pattern={pattern} widget={widget} />)

    expect(html).toContain('Your yarn colors')
    expect(html).toContain('Change a swatch to update every row using that color.')
    expect(html).toContain('type="color"')
  })

  it('renders pattern rows with the published row structure and numbering', () => {
    const widget: NativeGridItem = { i: 'section-one', kind: 'section', sectionId: 'section-one', x: 0, y: 0, w: 12, h: 5 }
    const html = renderToStaticMarkup(<NativePatternWidgetContent colors={[]} pageStyle={pageStyle} pattern={pattern} rowNumberStart={3} section={{ id: 'section-one', sectionType: 'pattern', title: 'Body', notes: null, rows: [{ id: 'row-one', blockType: 'row', rowType: 'round', instruction: 'Single crochet around.', computedStitchCount: 12, colorKey: null }] }} widget={widget} />)

    expect(html).toContain('native-pattern-view-row')
    expect(html).toContain('Round 4')
    expect(html).toContain('Single crochet around.')
    expect(html).toContain('[12]')
  })
})
