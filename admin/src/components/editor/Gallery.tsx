import { Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { GalleryNodeView, GalleryItemNodeView } from './GalleryView'

/**
 * Multi-image galleries.
 *
 * The stored shape is exactly the markup the site already renders and the
 * seeder already writes:
 *
 *   <div class="content-gallery" data-layout="grid" data-columns="3">
 *     <figure><img src alt loading><figcaption>…</figcaption></figure>
 *     …
 *   </div>
 *
 * Two things follow from that, and both are deliberate:
 *
 * 1. It is a FIX as much as a feature. Before this node existed the editor
 *    schema had no rule for div/figure/figcaption, so ProseMirror dropped all
 *    three and flattened a gallery into loose <img> tags with the captions
 *    demoted to paragraphs. One keystroke plus the 30-second autosave was
 *    enough to destroy a published gallery. Because parseHTML below claims the
 *    existing markup, every already-published gallery upgrades itself the first
 *    time it is opened — no migration.
 *
 * 2. Layout lives in `class` and `data-*`, never in `style`. The backend
 *    sanitiser (backend/src/utils/sanitizer.js) allows class and data-* and
 *    strips style, so a style-based layout would look right in the editor and
 *    silently vanish on save — the same trap ResizableImage documents for width.
 *    The frontend CSS keys off data-layout / data-columns / data-bleed.
 *
 * All three attributes default to null so a gallery parsed from existing
 * content re-serialises without them and stays byte-identical.
 */

export type GalleryLayout = 'grid' | 'pair' | 'carousel'

export interface GalleryImageInput {
  src: string
  full?: string | null
  alt?: string
  caption?: string
  publicId?: string | null
  width?: number | null
  height?: number | null
}

const intOrNull = (value: string | null) => {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

/** Read an attribute off the <img> inside a <figure>. */
const fromImg = (element: HTMLElement, name: string) =>
  element.querySelector('img')?.getAttribute(name) ?? null

/**
 * Where a figure's editable caption lives.
 *
 * This MUST be a function. Passing the string 'figcaption' makes
 * prosemirror-model throw "Cannot read properties of null (reading
 * 'firstChild')" on any figure that has no caption — which the seeder produces
 * routinely — and that is a white screen when the article loads.
 */
const captionElement = (dom: HTMLElement) =>
  dom.querySelector('figcaption') || dom.ownerDocument.createElement('figcaption')

export const Gallery = Node.create({
  name: 'gallery',
  group: 'block',
  content: 'galleryItem*',
  // `*` not `+`: with `+` an empty gallery is illegal, so ProseMirror helpfully
  // fills it with a default item that has no src and emits a broken <img>.
  // The plugin below removes empty galleries instead.
  isolating: true,
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      /** Called by the node view's "add pictures" button with the gallery's position. */
      onAddImages: null as null | ((pos: number) => void),
    }
  },

  addAttributes() {
    return {
      layout: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-layout'),
        renderHTML: (attributes) =>
          attributes.layout ? { 'data-layout': attributes.layout } : {},
      },
      columns: {
        default: null,
        parseHTML: (element) => intOrNull(element.getAttribute('data-columns')),
        renderHTML: (attributes) =>
          attributes.columns ? { 'data-columns': String(attributes.columns) } : {},
      },
      bleed: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-bleed'),
        renderHTML: (attributes) =>
          attributes.bleed ? { 'data-bleed': attributes.bleed } : {},
      },
      // How large each picture renders. Null keeps the original sizing, so
      // galleries published before this control keep looking the same.
      size: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-size'),
        renderHTML: (attributes) =>
          attributes.size ? { 'data-size': attributes.size } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div.content-gallery' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ class: 'content-gallery' }, HTMLAttributes), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(GalleryNodeView)
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('galleryHousekeeping'),
        // Deleting the last picture should take the empty shell with it, rather
        // than leaving an invisible div behind in the saved HTML.
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) return null

          const empties: Array<{ pos: number; size: number }> = []
          newState.doc.descendants((node, pos) => {
            if (node.type.name === 'gallery' && node.childCount === 0) {
              empties.push({ pos, size: node.nodeSize })
            }
          })
          if (!empties.length) return null

          const tr = newState.tr
          // Back to front, so earlier deletions don't shift later positions.
          empties.reverse().forEach(({ pos, size }) => tr.delete(pos, pos + size))
          return tr
        },
      }),
    ]
  },
})

export const GalleryItem = Node.create({
  name: 'galleryItem',
  // The caption IS the node's content, which buys rich text inside captions and
  // per-character undo for free.
  content: 'inline*',
  draggable: true,
  isolating: true,

  addAttributes() {
    // Every attribute renders to nothing: they belong on the inner <img>, which
    // renderHTML writes by hand. Without this they would land on the <figure>,
    // and the sanitiser would keep them there because its attribute allowlist
    // is global rather than per-tag.
    const hidden = { renderHTML: () => ({}) }
    return {
      src: { default: null, parseHTML: (el: HTMLElement) => fromImg(el, 'src'), ...hidden },
      alt: { default: '', parseHTML: (el: HTMLElement) => fromImg(el, 'alt') ?? '', ...hidden },
      full: { default: null, parseHTML: (el: HTMLElement) => fromImg(el, 'data-full'), ...hidden },
      publicId: { default: null, parseHTML: (el: HTMLElement) => fromImg(el, 'data-public-id'), ...hidden },
      width: { default: null, parseHTML: (el: HTMLElement) => intOrNull(fromImg(el, 'width')), ...hidden },
      height: { default: null, parseHTML: (el: HTMLElement) => intOrNull(fromImg(el, 'height')), ...hidden },
    }
  },

  parseHTML() {
    return [
      { tag: 'div.content-gallery > figure', contentElement: captionElement },
      {
        // A lone captioned <figure> — the seeder's non-gallery path — was being
        // destroyed the same way. Claim it too and let it become a one-picture
        // gallery. Below default priority so the rule above wins inside a
        // gallery, and guarded so figures wrapping a table or a pull-quote in
        // email-submitted HTML fall through untouched.
        tag: 'figure',
        priority: 45,
        contentElement: captionElement,
        getAttrs: (element: HTMLElement) => (element.querySelector('img') ? null : false),
      },
    ]
  },

  renderHTML({ node }) {
    const { src, alt, full, publicId, width, height } = node.attrs
    const img: Record<string, string> = { src, alt: alt || '', loading: 'lazy' }
    if (full) img['data-full'] = full
    if (publicId) img['data-public-id'] = publicId
    // Intrinsic dimensions reserve the space before the picture loads, which is
    // what keeps a lazily-loaded strip from reflowing under the reader.
    if (width) img.width = String(width)
    if (height) img.height = String(height)

    return ['figure', {}, ['img', img], ['figcaption', {}, 0]]
  },

  addNodeView() {
    return ReactNodeViewRenderer(GalleryItemNodeView)
  },
})

/** ProseMirror JSON for a fresh gallery, ready for `insertContent`. */
export function buildGalleryNode(images: GalleryImageInput[], layout: GalleryLayout | null = null) {
  return {
    type: Gallery.name,
    attrs: { layout, columns: null, bleed: null, size: null },
    content: images.map(buildGalleryItemNode),
  }
}

/** ProseMirror JSON for one picture. A caption becomes the item's content. */
export function buildGalleryItemNode(image: GalleryImageInput) {
  const caption = (image.caption || '').trim()
  return {
    type: GalleryItem.name,
    attrs: {
      src: image.src,
      alt: image.alt || '',
      full: image.full || null,
      publicId: image.publicId || null,
      width: image.width || null,
      height: image.height || null,
    },
    ...(caption ? { content: [{ type: 'text', text: caption }] } : {}),
  }
}
