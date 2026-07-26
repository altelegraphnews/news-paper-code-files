import { useRef, useState } from 'react'
import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/core'

/**
 * The article image, resizable by dragging either side edge.
 *
 * The chosen size is stored in the plain `width` attribute (pixels) rather than
 * an inline style, because the backend sanitiser allows `width` on <img> but
 * strips `style` — a style-based size would look right in the editor and then
 * silently vanish on save. Both the editor and the site leave `width` alone on
 * sized images and only force full width on images that have none, so the
 * attribute is what actually decides how wide the picture renders.
 */

const MIN_WIDTH = 80

const PRESETS = [
  { label: '٢٥٪', fraction: 0.25 },
  { label: '٥٠٪', fraction: 0.5 },
  { label: '٧٥٪', fraction: 0.75 },
]

function ImageNodeView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const frameRef = useRef<HTMLSpanElement>(null)
  const [dragWidth, setDragWidth] = useState<number | null>(null)

  const editable = editor.isEditable
  const storedWidth: number | null = node.attrs.width ?? null
  const shownWidth = dragWidth ?? storedWidth
  const active = selected || dragWidth !== null

  /** Width of the text column — the ceiling for any image. */
  const columnWidth = () => frameRef.current?.parentElement?.clientWidth || 0

  const beginResize = (event: React.PointerEvent, edge: 'left' | 'right') => {
    if (!editable) return
    event.preventDefault()
    event.stopPropagation()

    const img = frameRef.current?.querySelector('img')
    if (!img) return

    const startX = event.clientX
    const startWidth = img.getBoundingClientRect().width
    const max = columnWidth() || startWidth
    let latest = Math.round(startWidth)

    const move = (e: PointerEvent) => {
      // Dragging an edge outward widens the picture, whichever edge it is.
      const delta = edge === 'right' ? e.clientX - startX : startX - e.clientX
      latest = Math.round(Math.min(max, Math.max(MIN_WIDTH, startWidth + delta)))
      setDragWidth(latest)
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      setDragWidth(null)
      updateAttributes({ width: latest })
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }

  const setFraction = (fraction: number) => {
    const column = columnWidth()
    if (column) updateAttributes({ width: Math.round(column * fraction) })
  }

  return (
    <NodeViewWrapper className="tiptap-image" data-active={active ? 'true' : undefined}>
      <span
        ref={frameRef}
        className="tiptap-image__frame"
        style={shownWidth ? { width: `${shownWidth}px` } : undefined}
      >
        <img
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          title={node.attrs.title || undefined}
          draggable={false}
        />

        {editable && (
          <>
            <span
              className="tiptap-image__handle tiptap-image__handle--right"
              onPointerDown={(e) => beginResize(e, 'right')}
              contentEditable={false}
              aria-hidden="true"
            />
            <span
              className="tiptap-image__handle tiptap-image__handle--left"
              onPointerDown={(e) => beginResize(e, 'left')}
              contentEditable={false}
              aria-hidden="true"
            />
            {active && (
              <span className="tiptap-image__size" contentEditable={false}>
                {Math.round(shownWidth || columnWidth())} px
              </span>
            )}
          </>
        )}
      </span>

      {editable && selected && dragWidth === null && (
        <span className="tiptap-image__bar" contentEditable={false}>
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setFraction(preset.fraction) }}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); updateAttributes({ width: null }) }}
          >
            ملء العرض
          </button>
        </span>
      )}
    </NodeViewWrapper>
  )
}

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const attr = element.getAttribute('width')
          if (attr) return Number.parseInt(attr, 10) || null
          // Content pasted from elsewhere may carry the size as a style instead.
          const styled = (element as HTMLElement).style?.width
          return styled?.endsWith('px') ? Number.parseInt(styled, 10) || null : null
        },
        renderHTML: (attributes) =>
          attributes.width ? { width: Math.round(attributes.width) } : {},
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  },
})

export default ResizableImage
