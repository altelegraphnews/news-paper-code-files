import { useCallback, useEffect, useRef, useState } from 'react'
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/core'
import {
  Images, LayoutGrid, Columns2, StretchHorizontal,
  GripVertical, ChevronRight, ChevronLeft, Type, Trash2, Plus,
} from 'lucide-react'
import { clsx } from 'clsx'

/**
 * Editing chrome for the gallery nodes.
 *
 * The element holding the pictures carries the same class and data attributes
 * the published article does, so the admin preview is laid out by the same CSS
 * rules as the site rather than approximating them.
 *
 * All chrome is contentEditable={false} and gated on editor.isEditable — the
 * same convention ResizableImage uses.
 */

/**
 * True while the caret sits anywhere inside this node.
 *
 * The `selected` prop TipTap hands a node view is only true for a whole-node
 * NodeSelection, so relying on it would hide the toolbar the moment someone
 * clicked into a caption — exactly when they need it.
 */
function useCaretInside({ editor, getPos, node }: NodeViewProps) {
  const [inside, setInside] = useState(false)
  const sizeRef = useRef(node.nodeSize)
  sizeRef.current = node.nodeSize

  useEffect(() => {
    // Every node view in the document listens here, so this runs N times per
    // keystroke. Compare before setting: React would otherwise be handed a
    // state update for every picture on every transaction.
    let last: boolean | null = null
    const update = () => {
      const pos = typeof getPos === 'function' ? getPos() : null
      let next = false
      if (typeof pos === 'number') {
        const { from, to } = editor.state.selection
        next = from >= pos && to <= pos + sizeRef.current
      }
      if (next === last) return
      last = next
      setInside(next)
    }
    update()
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
    }
  }, [editor, getPos])

  return inside
}

function ChromeButton({
  onClick, title, disabled, active, children,
}: {
  onClick: () => void
  title: string
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      // mousedown + preventDefault stops ProseMirror moving the caret out from
      // under us before the click lands.
      onMouseDown={(e) => { e.preventDefault(); if (!disabled) onClick() }}
      className={clsx('tiptap-gallery__btn', active && 'is-active')}
    >
      {children}
    </button>
  )
}

/* ── The gallery container ─────────────────────────────────────────── */

const LAYOUTS: Array<{ value: string | null; label: string; icon: React.ReactNode }> = [
  { value: null, label: 'تلقائي', icon: <Images className="w-3.5 h-3.5" /> },
  { value: 'grid', label: 'شبكة', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
  { value: 'pair', label: 'زوج', icon: <Columns2 className="w-3.5 h-3.5" /> },
  { value: 'carousel', label: 'شريط منزلق', icon: <StretchHorizontal className="w-3.5 h-3.5" /> },
]

/** Tile width in px. Dragging snaps to this step so the site CSS can enumerate it. */
export const SIZE_STEP = 20
export const SIZE_MIN = 100
export const SIZE_MAX = 400

const namedSizes: Record<string, number> = { small: 110, medium: 150, large: 260 }

/** Gallery `size` may be a px number or one of the original named sizes. */
export function sizeToPx(size: unknown): number {
  if (typeof size === 'number' && Number.isFinite(size)) return size
  if (typeof size === 'string') {
    if (namedSizes[size]) return namedSizes[size]
    const parsed = Number.parseInt(size, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return 150
}

/** What gets saved: a step the site can express as a CSS rule. */
const snap = (px: number) =>
  Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(px / SIZE_STEP) * SIZE_STEP))

/** What the writer sees while dragging: every pixel, so the gesture tracks the pointer. */
const clamp = (px: number) => Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(px)))

/** What the writer should see, matching the rules the site renders with. */
function previewStyle(layout: unknown, columns: unknown, size: unknown): React.CSSProperties {
  if (layout === 'carousel') {
    return {
      display: 'flex',
      overflowX: 'auto',
      gap: '0.75rem',
      ['--gal-slide' as any]: `${sizeToPx(size)}px`,
    }
  }
  const base: React.CSSProperties = { display: 'grid', gap: '1rem', alignItems: 'start' }
  if (layout === 'grid') {
    return { ...base, gridTemplateColumns: `repeat(${Number(columns) || 3}, 1fr)` }
  }
  if (layout === 'pair') {
    return { ...base, gridTemplateColumns: 'repeat(2, 1fr)' }
  }
  return {
    ...base,
    gridTemplateColumns: `repeat(auto-fill, minmax(${sizeToPx(size)}px, 1fr))`,
  }
}

export function GalleryNodeView(props: NodeViewProps) {
  const { node, updateAttributes, editor, getPos, extension } = props
  const active = useCaretInside(props)
  const editable = editor.isEditable
  const { layout, columns, bleed, size } = node.attrs
  const count = node.childCount

  const addImages = useCallback(() => {
    const pos = typeof getPos === 'function' ? getPos() : null
    const handler = extension.options?.onAddImages
    if (typeof pos === 'number' && typeof handler === 'function') handler(pos)
  }, [getPos, extension])

  const removeGallery = useCallback(() => {
    const pos = typeof getPos === 'function' ? getPos() : null
    if (typeof pos !== 'number') return
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
  }, [editor, getPos, node])

  return (
    <NodeViewWrapper
      className={clsx('tiptap-gallery', active && 'is-active')}
      data-active={active ? 'true' : undefined}
    >
      {editable && active && (
        <div className="tiptap-gallery__toolbar" contentEditable={false}>
          <span className="tiptap-gallery__label">
            معرض · {count} {count === 1 ? 'صورة' : 'صور'}
          </span>

          <span className="tiptap-gallery__group">
            {LAYOUTS.map((option) => (
              <ChromeButton
                key={option.label}
                title={option.label}
                active={(layout ?? null) === option.value}
                onClick={() => updateAttributes({
                  layout: option.value,
                  // A column count only means anything for the grid.
                  columns: option.value === 'grid' ? (columns || 3) : null,
                })}
              >
                {option.icon}
                <span>{option.label}</span>
              </ChromeButton>
            ))}
          </span>

          {layout === 'grid' && (
            <span className="tiptap-gallery__group">
              {[2, 3, 4].map((n) => (
                <ChromeButton
                  key={n}
                  title={`${n} أعمدة`}
                  active={(columns || 3) === n}
                  onClick={() => updateAttributes({ columns: n })}
                >
                  <span>{['٢', '٣', '٤'][n - 2]}</span>
                </ChromeButton>
              ))}
            </span>
          )}

          <span className="tiptap-gallery__group">
            <ChromeButton
              title={bleed === 'wide' ? 'إرجاع إلى عرض العمود' : 'توسيع خارج العمود'}
              active={bleed === 'wide'}
              onClick={() => updateAttributes({ bleed: bleed === 'wide' ? null : 'wide' })}
            >
              <span>{bleed === 'wide' ? 'أعرض' : 'داخل العمود'}</span>
            </ChromeButton>
          </span>

          <span className="tiptap-gallery__group tiptap-gallery__group--end">
            <ChromeButton title="إضافة صور" onClick={addImages}>
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة صور</span>
            </ChromeButton>
            <ChromeButton title="حذف المعرض" onClick={removeGallery}>
              <Trash2 className="w-3.5 h-3.5" />
            </ChromeButton>
          </span>
        </div>
      )}

      {/* The layout is driven by an inline style rather than the stylesheet.
          Only editor.getHTML() reaches the sanitiser, and that comes from the
          node's renderHTML — never from this element — so an inline style here
          is safe, and it beats every cascade question about what the preview
          should look like. The data attributes are still written so the admin
          and the published page share one vocabulary. */}
      <NodeViewContent
        className="content-gallery"
        style={previewStyle(layout, columns, size)}
        data-layout={layout || undefined}
        data-columns={columns ? String(columns) : undefined}
        data-bleed={bleed || undefined}
        data-size={size ?? undefined}
        // :only-child is useless here — the react-renderer wrapper makes every
        // figure an only child of something.
        data-single={count === 1 ? 'true' : undefined}
      />
    </NodeViewWrapper>
  )
}

/* ── One picture ───────────────────────────────────────────────────── */

export function GalleryItemNodeView(props: NodeViewProps) {
  const { node, updateAttributes, editor, getPos } = props
  const active = useCaretInside(props)
  const editable = editor.isEditable
  const [altOpen, setAltOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const figureRef = useRef<HTMLElement | null>(null)
  // The px readout is written straight to the DOM during a drag. Re-rendering
  // React on every pointermove is what made the gesture feel heavy.
  const labelRef = useRef<HTMLSpanElement | null>(null)
  // RichEditor can call setContent mid-drag and destroy this node view, which
  // would otherwise strand the gesture with its listeners and body class alive.
  const endRef = useRef<(() => void) | null>(null)
  useEffect(() => () => endRef.current?.(), [])

  /** Write a tile width onto the parent gallery, which is what sizes every picture. */
  const setGallerySize = useCallback((px: number) => {
    const pos = typeof getPos === 'function' ? getPos() : null
    if (typeof pos !== 'number') return
    const $pos = editor.state.doc.resolve(pos)
    const gallery = $pos.parent
    if (gallery.type.name !== 'gallery') return
    const galleryPos = $pos.before($pos.depth)
    // Only the auto and carousel layouts expose grips at all, so there is no
    // layout left to rewrite here. A size drag must never silently discard the
    // arrangement the toolbar is showing as chosen.
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(galleryPos, undefined, { ...gallery.attrs, size: px })
    )
  }, [editor, getPos])

  /* Drag either edge to resize, exactly like a single body image — except the
     width lands on the gallery, so every picture in the set stays consistent. */
  const beginResize = (event: React.PointerEvent, edge: 'left' | 'right') => {
    if (!editable) return
    event.preventDefault()
    event.stopPropagation()

    const figure = figureRef.current
    const image = figure?.querySelector('img')
    // Both wrappers between the figure and the gallery are `display: contents`,
    // so parentElement is the react-renderer div, not the container. The
    // container has to be looked up rather than walked to — writing the live
    // preview to the wrong element is what made the drag do nothing until it
    // was released.
    const container = figure?.closest('.content-gallery') as HTMLElement | null
    if (!image || !container) return

    // Under شبكة and زوج the column count decides the width, so a size drag has
    // nothing truthful to show. The grips are hidden there; this is the guard
    // for anything that reaches the handler anyway.
    const layoutAttr = container.getAttribute('data-layout')
    if (layoutAttr === 'grid' || layoutAttr === 'pair') return

    // Keeps the gesture alive when the pointer leaves the handle or the window.
    const handle = event.currentTarget as HTMLElement
    handle.setPointerCapture?.(event.pointerId)

    const startX = event.clientX
    const startWidth = image.getBoundingClientRect().width
    const carousel = container.getAttribute('data-layout') === 'carousel'
    let live = clamp(startWidth)
    let frame = 0
    let moved = false
    let done = false

    setDragging(true)
    // Suppresses every easing that would lag behind the pointer.
    container.setAttribute('data-resizing', 'true')
    // The pointer leaves the 9px grip on the first pixel of travel, so the
    // cursor and the selection guard have to live on the body.
    document.body.classList.add('is-resizing')

    // Fixed tracks, not minmax(…, 1fr). This is the whole reason the drag felt
    // chunky: with `1fr` the rendered tile is (container − gaps) / N, where N
    // is the integer column count auto-fill derives from the track MINIMUM — so
    // the width is a step function of the pointer, frozen for tens of pixels
    // and then jumping a full column. A fixed track resolves to exactly the
    // value dragged.
    if (!carousel) container.style.justifyContent = 'start'

    const paint = () => {
      frame = 0
      if (carousel) container.style.setProperty('--gal-slide', `${live}px`)
      else container.style.gridTemplateColumns = `repeat(auto-fill, ${live}px)`
      if (labelRef.current) labelRef.current.textContent = `${live} px`
    }
    paint()

    const move = (e: PointerEvent) => {
      // Dragging an edge outward widens the picture, whichever edge it is.
      const delta = edge === 'right' ? e.clientX - startX : startX - e.clientX
      // Continuous on screen. Only the committed value snaps to a step, because
      // that is a constraint of the site's CSS, not of the gesture.
      live = clamp(startWidth + delta)
      moved = true
      // One paint per frame, never one per event.
      if (!frame) frame = requestAnimationFrame(paint)
    }

    const end = () => {
      if (done) return
      done = true
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('lostpointercapture', end)
      container.removeAttribute('data-resizing')
      document.body.classList.remove('is-resizing')
      container.style.removeProperty('justify-content')
      setDragging(false)

      // A grab with no travel must not commit: the drag seeds from the RENDERED
      // width, which under minmax(…, 1fr) is wider than the stored minimum, so
      // committing it would inflate the gallery a little on every touch.
      if (!moved) {
        // Put back exactly what React believes it wrote, since it diffs props
        // against props and would not repaint an unchanged attribute.
        if (carousel) container.style.setProperty('--gal-slide', `${sizeToPx(container.getAttribute('data-size'))}px`)
        else container.style.gridTemplateColumns =
          `repeat(auto-fill, minmax(${sizeToPx(container.getAttribute('data-size'))}px, 1fr))`
        return
      }

      const committed = snap(live)
      // Never removeProperty here: React owns this inline style and compares
      // props to props, so on an unchanged attribute it writes nothing and the
      // stylesheet's 150px fallback would take over.
      if (carousel) container.style.setProperty('--gal-slide', `${committed}px`)
      else container.style.gridTemplateColumns = `repeat(auto-fill, minmax(${committed}px, 1fr))`
      // Handing back from fixed tracks to stretched ones changes the width by
      // up to one gap-share; eased, that reads as the value settling into place.
      container.classList.add('is-settling')
      const clear = () => container.classList.remove('is-settling')
      container.addEventListener('transitionend', clear, { once: true })
      window.setTimeout(clear, 200)

      // Committing per pointermove would flood the undo stack, so the node
      // attribute is written once, here.
      setGallerySize(committed)
    }

    endRef.current = end
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('lostpointercapture', end)
  }

  /** Rebuild the parent's child list in the new order. */
  const move = useCallback((direction: -1 | 1) => {
    const pos = typeof getPos === 'function' ? getPos() : null
    if (typeof pos !== 'number') return

    const $pos = editor.state.doc.resolve(pos)
    const parent = $pos.parent
    const index = $pos.index()
    const target = index + direction
    if (target < 0 || target >= parent.childCount) return

    const items: any[] = []
    parent.forEach((child) => items.push(child))
    const [moved] = items.splice(index, 1)
    items.splice(target, 0, moved)

    editor.view.dispatch(editor.state.tr.replaceWith($pos.start(), $pos.end(), items))
    editor.commands.focus()
  }, [editor, getPos])

  const remove = useCallback(() => {
    const pos = typeof getPos === 'function' ? getPos() : null
    if (typeof pos !== 'number') return
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
  }, [editor, getPos, node])

  return (
    <NodeViewWrapper
      as="figure"
      ref={figureRef as any}
      className={clsx('tiptap-gallery__item', active && 'is-active')}
      data-active={active || dragging ? 'true' : undefined}
    >
      {editable && (
        <span className="tiptap-gallery__chrome" contentEditable={false}>
          <span className="tiptap-gallery__grip" data-drag-handle title="اسحب لإعادة الترتيب">
            <GripVertical className="w-3.5 h-3.5" />
          </span>
          {/* RTL: the earlier picture sits to the right. */}
          <ChromeButton title="تحريك لليمين" onClick={() => move(-1)}>
            <ChevronRight className="w-3.5 h-3.5" />
          </ChromeButton>
          <ChromeButton title="تحريك لليسار" onClick={() => move(1)}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </ChromeButton>
          <ChromeButton
            title="النص البديل"
            active={altOpen || !!node.attrs.alt}
            onClick={() => setAltOpen((open) => !open)}
          >
            <Type className="w-3.5 h-3.5" />
          </ChromeButton>
          <ChromeButton title="حذف الصورة" onClick={remove}>
            <Trash2 className="w-3.5 h-3.5" />
          </ChromeButton>
        </span>
      )}

      <img src={node.attrs.src} alt={node.attrs.alt || ''} draggable={false} />

      {editable && (
        <>
          {/* draggable={false} matters: galleryItem is a draggable node, so
              without it the browser starts a native drag from the grip. */}
          <span
            className="tiptap-gallery__handle tiptap-gallery__handle--right"
            onPointerDown={(e) => beginResize(e, 'right')}
            onDragStart={(e) => e.preventDefault()}
            draggable={false}
            contentEditable={false}
            aria-hidden="true"
          />
          <span
            className="tiptap-gallery__handle tiptap-gallery__handle--left"
            onPointerDown={(e) => beginResize(e, 'left')}
            onDragStart={(e) => e.preventDefault()}
            draggable={false}
            contentEditable={false}
            aria-hidden="true"
          />
          {/* Always mounted so the ref is live before the first frame paints;
              the drag writes its text directly. */}
          <span
            ref={labelRef}
            className="tiptap-gallery__size"
            contentEditable={false}
            hidden={!dragging}
          />
        </>
      )}

      {editable && altOpen && (
        <span className="tiptap-gallery__alt" contentEditable={false}>
          <input
            type="text"
            value={node.attrs.alt || ''}
            placeholder="وصف الصورة لقارئ الشاشة"
            onChange={(e) => updateAttributes({ alt: e.target.value })}
            // ProseMirror swallows arrows and Backspace unless the input keeps
            // them to itself.
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Escape') setAltOpen(false)
            }}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </span>
      )}

      <NodeViewContent as="figcaption" />
    </NodeViewWrapper>
  )
}
