import { useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { clsx } from 'clsx'
import {
  Bold, Italic, UnderlineIcon, Strikethrough,
  Heading2, Heading3, Heading4,
  List, ListOrdered, Quote, Code, Minus,
  AlignRight, AlignCenter, AlignLeft, AlignJustify,
  LinkIcon, ImageIcon, TableIcon,
  Undo, Redo, RemoveFormatting,
} from 'lucide-react'

interface RichEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  onImageInsert?: () => void
}

function ToolbarButton({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      className={clsx(
        'p-1.5 rounded transition-colors flex-shrink-0',
        active
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100',
        disabled && 'opacity-30 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5 flex-shrink-0" />
}

export default function RichEditor({ value, onChange, placeholder, onImageInsert }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-red-600 underline' },
      }),
      Image.configure({
        HTMLAttributes: { class: 'max-w-full rounded-md my-4' },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({
        placeholder: placeholder || 'ابدأ الكتابة هنا...',
      }),
      CharacterCount,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'min-h-[400px] focus:outline-none prose prose-sm dark:prose-invert max-w-none p-5 rtl',
        dir: 'rtl',
        lang: 'ar',
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
  })

  // Sync external value changes (e.g. loading article)
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== value && value !== undefined) {
      editor.commands.setContent(value || '', false)
    }
  }, [value, editor])

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string
    const url = window.prompt('أدخل الرابط:', prev || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }, [editor])

  const insertTable = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  if (!editor) return null

  const charCount = editor.storage.characterCount?.characters?.() || 0
  const wordCount = editor.storage.characterCount?.words?.() || 0

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-surface dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center flex-wrap gap-0.5 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        {/* Undo / Redo */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="تراجع">
          <Undo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="إعادة">
          <Redo className="w-4 h-4" />
        </ToolbarButton>
        <Divider />

        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="عنوان 2"
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="عنوان 3"
        >
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          active={editor.isActive('heading', { level: 4 })}
          title="عنوان 4"
        >
          <Heading4 className="w-4 h-4" />
        </ToolbarButton>
        <Divider />

        {/* Inline */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="عريض"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="مائل"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="تسطير"
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="يتوسطه خط"
        >
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          title="كود"
        >
          <Code className="w-4 h-4" />
        </ToolbarButton>
        <Divider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="قائمة نقطية"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="قائمة مرقمة"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="اقتباس"
        >
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="فاصل"
        >
          <Minus className="w-4 h-4" />
        </ToolbarButton>
        <Divider />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })}
          title="محاذاة لليمين"
        >
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
          title="توسيط"
        >
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
          title="محاذاة لليسار"
        >
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          active={editor.isActive({ textAlign: 'justify' })}
          title="ضبط الفقرة"
        >
          <AlignJustify className="w-4 h-4" />
        </ToolbarButton>
        <Divider />

        {/* Insert */}
        <ToolbarButton onClick={setLink} active={editor.isActive('link')} title="إدراج رابط">
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>
        {onImageInsert && (
          <ToolbarButton onClick={onImageInsert} title="إدراج صورة">
            <ImageIcon className="w-4 h-4" />
          </ToolbarButton>
        )}
        <ToolbarButton onClick={insertTable} title="إدراج جدول">
          <TableIcon className="w-4 h-4" />
        </ToolbarButton>
        <Divider />

        {/* Clear formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          title="مسح التنسيق"
        >
          <RemoveFormatting className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* Content */}
      <EditorContent editor={editor} />

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 text-xs text-gray-400 dark:text-gray-500">
        <span>{wordCount} كلمة</span>
        <span>{charCount} حرف</span>
      </div>
    </div>
  )
}
