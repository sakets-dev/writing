import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Extension } from '@tiptap/core'
import { Color } from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CheckSquare,
  Download,
  FilePlus2,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Moon,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Pilcrow,
  Printer,
  Quote,
  Redo2,
  Save,
  Search,
  Sparkles,
  Strikethrough,
  Sun,
  Trash2,
  Type,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'

type Doc = {
  id: string
  title: string
  updatedAt: number
  content: string
  paperSize: PaperSizeId
}

type Theme = 'light' | 'dark'
type PaperSizeId = 'a4' | 'letter' | 'legal' | 'a5' | 'executive'
type ColorMenuId = 'text' | 'highlight' | null

const STORAGE_KEY = 'desq-docs'
const THEME_KEY = 'desq-theme'

const starterContent = `
  <h1>Untitled draft</h1>
  <p>Start writing here. Select text to style it, build lists, add links, or switch the whole editor into a calmer dark mode.</p>
  <p>This editor saves in your browser automatically, so your drafts stay here when you come back.</p>
`

const fontFamilies = [
  { label: 'Inter', value: 'Inter, ui-sans-serif, system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, Cambria, serif' },
  { label: 'Mono', value: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  { label: 'Clean', value: 'Arial, Helvetica, sans-serif' },
]

const fontSizes = ['12px', '14px', '16px', '18px', '22px', '28px', '36px']
const colors = ['#111827', '#334155', '#0f766e', '#2563eb', '#7c3aed', '#be123c']
const highlights = ['#fef08a', '#bfdbfe', '#bbf7d0', '#fbcfe8', '#fed7aa']
const paperSizes: Array<{
  id: PaperSizeId
  label: string
  width: number
  height: number
  print: string
}> = [
  { id: 'a4', label: 'A4', width: 794, height: 1123, print: 'A4' },
  { id: 'letter', label: 'Letter', width: 816, height: 1056, print: 'Letter' },
  { id: 'legal', label: 'Legal', width: 816, height: 1344, print: 'Legal' },
  { id: 'a5', label: 'A5', width: 559, height: 794, print: 'A5' },
  { id: 'executive', label: 'Executive', width: 696, height: 1008, print: 'Executive' },
]

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },
})

function createDoc(title = 'Untitled document'): Doc {
  return {
    id: crypto.randomUUID(),
    title,
    updatedAt: Date.now(),
    content: starterContent,
    paperSize: 'a4',
  }
}

function loadDocs(): Doc[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [createDoc('Project brief')]
    const parsed = JSON.parse(raw) as Doc[]
    return parsed.length
      ? parsed.map((doc) => ({ ...doc, paperSize: doc.paperSize ?? 'a4' }))
      : [createDoc('Project brief')]
  } catch {
    return [createDoc('Project brief')]
  }
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)
}

function downloadFile(filename: string, body: string, type: string) {
  const blob = new Blob([body], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function App() {
  const [docs, setDocs] = useState<Doc[]>(loadDocs)
  const [activeId, setActiveId] = useState(() => docs[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [openColorMenu, setOpenColorMenu] = useState<ColorMenuId>(null)
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const activeIdRef = useRef(activeId)
  const editorWrapRef = useRef<HTMLDivElement | null>(null)
  const loadedDocId = useRef<string | null>(null)

  const activeDoc = docs.find((doc) => doc.id === activeId) ?? docs[0]
  const activePaper = paperSizes.find((size) => size.id === activeDoc?.paperSize) ?? paperSizes[0]

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Underline,
        TextStyle,
        FontSize,
        Color,
        FontFamily,
        Highlight.configure({ multicolor: true }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Link.configure({
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
        }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Placeholder.configure({
          placeholder: 'Write something worth returning to...',
        }),
      ],
      content: activeDoc?.content ?? starterContent,
      editorProps: {
        attributes: {
          class: 'doc-surface',
        },
      },
      onUpdate: ({ editor }) => {
        const html = editor.getHTML()
        setDocs((current) =>
          current.map((doc) =>
            doc.id === activeIdRef.current ? { ...doc, content: html, updatedAt: Date.now() } : doc,
          ),
        )
      },
    },
    [],
  )

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs))
  }, [docs])

  useEffect(() => {
    if (editor && activeDoc && loadedDocId.current !== activeDoc.id) {
      editor.commands.setContent(activeDoc.content, { emitUpdate: false })
      loadedDocId.current = activeDoc.id
    }
  }, [activeDoc, activeDoc?.content, editor])

  const filteredDocs = useMemo(() => {
    return docs
      .filter((doc) => doc.title.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [docs, query])

  const stats = editor?.storage.characterCount
  const wordCount = stats?.words() ?? 0
  const characterCount = stats?.characters() ?? 0

  function updateActiveDoc(patch: Partial<Doc>) {
    setDocs((current) =>
      current.map((doc) =>
        doc.id === activeId ? { ...doc, ...patch, updatedAt: Date.now() } : doc,
      ),
    )
  }

  function addDoc() {
    const next = createDoc()
    setDocs((current) => [next, ...current])
    setActiveId(next.id)
    setSidebarOpen(true)
  }

  function selectDoc(id: string) {
    setActiveId(id)
    setOpenColorMenu(null)
    requestAnimationFrame(() => {
      editorWrapRef.current?.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
    })
  }

  function deleteDoc(id: string) {
    if (docs.length === 1) return
    const nextDocs = docs.filter((doc) => doc.id !== id)
    setDocs(nextDocs)
    if (activeId === id) setActiveId(nextDocs[0].id)
  }

  function setLink() {
    if (!editor) return
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Paste a link', previous ?? 'https://')
    if (url === null) return
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  function exportHtml() {
    if (!activeDoc) return
    downloadFile(`${activeDoc.title || 'document'}.html`, editor?.getHTML() ?? activeDoc.content, 'text/html')
  }

  function exportText() {
    if (!activeDoc) return
    downloadFile(`${activeDoc.title || 'document'}.txt`, editor?.getText() ?? '', 'text/plain')
  }

  if (!editor || !activeDoc) return null

  return (
    <main className="h-screen overflow-hidden bg-[var(--app-bg)] text-[var(--ink)]">
      <style>{`@page { size: ${activePaper.print}; margin: 0; }`}</style>
      <div className="flex h-screen overflow-hidden">
        <aside
          className={`sidebar ${sidebarOpen ? 'w-80 border-r border-[var(--line)]' : 'w-0 overflow-hidden'}`}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-4">
            <div className="flex items-center gap-2">
              <div className="grid size-9 place-items-center rounded-md bg-[var(--accent)] text-white">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">Desq Docs</p>
                <p className="text-xs text-[var(--muted)]">Private browser drafts</p>
              </div>
            </div>
            <button className="icon-button" type="button" onClick={addDoc} title="New document">
              <FilePlus2 size={18} />
            </button>
          </div>

          <div className="px-4 pb-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
              <input
                className="field pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search documents"
              />
            </label>
          </div>

          <nav className="doc-list space-y-2 px-3 pb-4">
            {filteredDocs.map((doc) => (
              <button
                className={`doc-tab ${doc.id === activeId ? 'active' : ''}`}
                key={doc.id}
                type="button"
                onClick={() => selectDoc(doc.id)}
              >
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium">{doc.title || 'Untitled document'}</span>
                  <span className="block text-xs text-[var(--muted)]">{formatDate(doc.updatedAt)}</span>
                </span>
                <span
                  className="delete-button"
                  onClick={(event) => {
                    event.stopPropagation()
                    deleteDoc(doc.id)
                  }}
                  title="Delete document"
                >
                  <Trash2 size={15} />
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex h-screen min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="topbar">
            <button
              className="icon-button"
              type="button"
              onClick={() => setSidebarOpen((value) => !value)}
              title={sidebarOpen ? 'Hide documents' : 'Show documents'}
            >
              {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>

            <input
              className="title-input"
              value={activeDoc.title}
              onChange={(event) => updateActiveDoc({ title: event.target.value })}
              aria-label="Document title"
            />

            <div className="ml-auto flex items-center gap-2">
              <button className="icon-button" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button className="command-button" type="button" onClick={exportText}>
                <Download size={16} /> TXT
              </button>
              <button className="command-button" type="button" onClick={exportHtml}>
                <Save size={16} /> HTML
              </button>
              <button className="icon-button" type="button" onClick={() => window.print()} title="Print">
                <Printer size={18} />
              </button>
            </div>
          </header>

          <div className="toolbar">
            <ToolbarButton label="Undo" active={false} onClick={() => editor.chain().focus().undo().run()} icon={<Undo2 size={17} />} />
            <ToolbarButton label="Redo" active={false} onClick={() => editor.chain().focus().redo().run()} icon={<Redo2 size={17} />} />
            <Divider />
            <select
              className="select compact"
              value={activeDoc.paperSize}
              onChange={(event) => updateActiveDoc({ paperSize: event.target.value as PaperSizeId })}
              aria-label="Paper size"
              title="Paper size"
            >
              {paperSizes.map((size) => (
                <option key={size.id} value={size.id}>{size.label}</option>
              ))}
            </select>
            <Divider />
            <select
              className="select"
              value={editor.getAttributes('textStyle').fontFamily ?? fontFamilies[0].value}
              onChange={(event) => editor.chain().focus().setFontFamily(event.target.value).run()}
              aria-label="Font family"
            >
              {fontFamilies.map((font) => (
                <option key={font.value} value={font.value}>{font.label}</option>
              ))}
            </select>
            <select
              className="select compact"
              value={editor.getAttributes('textStyle').fontSize ?? '16px'}
              onChange={(event) => editor.chain().focus().setMark('textStyle', { fontSize: event.target.value }).run()}
              aria-label="Font size"
            >
              {fontSizes.map((size) => (
                <option key={size} value={size}>{size.replace('px', '')}</option>
              ))}
            </select>
            <Divider />
            <ToolbarButton label="Paragraph" active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()} icon={<Pilcrow size={17} />} />
            <ToolbarButton label="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} icon={<Heading1 size={17} />} />
            <ToolbarButton label="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} icon={<Heading2 size={17} />} />
            <Divider />
            <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} icon={<Bold size={17} />} />
            <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} icon={<Italic size={17} />} />
            <ToolbarButton label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} icon={<UnderlineIcon size={17} />} />
            <ToolbarButton label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} icon={<Strikethrough size={17} />} />
            <Divider />
            <ColorMenu
              icon={<Palette size={17} />}
              label="Text color"
              open={openColorMenu === 'text'}
              options={colors}
              onToggle={() => setOpenColorMenu((current) => (current === 'text' ? null : 'text'))}
              onPick={(color) => {
                editor.chain().focus().setColor(color).run()
                setOpenColorMenu(null)
              }}
            />
            <ColorMenu
              icon={<Highlighter size={17} />}
              label="Highlight color"
              open={openColorMenu === 'highlight'}
              options={highlights}
              onToggle={() => setOpenColorMenu((current) => (current === 'highlight' ? null : 'highlight'))}
              onPick={(color) => {
                editor.chain().focus().toggleHighlight({ color }).run()
                setOpenColorMenu(null)
              }}
            />
            <ToolbarButton label="Link" active={editor.isActive('link')} onClick={setLink} icon={<Link2 size={17} />} />
            <Divider />
            <ToolbarButton label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} icon={<List size={17} />} />
            <ToolbarButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} icon={<ListOrdered size={17} />} />
            <ToolbarButton label="Checklist" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} icon={<CheckSquare size={17} />} />
            <ToolbarButton label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} icon={<Quote size={17} />} />
            <Divider />
            <ToolbarButton label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} icon={<AlignLeft size={17} />} />
            <ToolbarButton label="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} icon={<AlignCenter size={17} />} />
            <ToolbarButton label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} icon={<AlignRight size={17} />} />
            <Divider />
            <ToolbarButton label="Clear formatting" active={false} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} icon={<Type size={17} />} />
          </div>

          <div className="editor-wrap" ref={editorWrapRef}>
            <div
              className="paper-frame"
              style={
                {
                  '--paper-width': `${activePaper.width}px`,
                  '--paper-height': `${activePaper.height}px`,
                } as CSSProperties
              }
            >
              <EditorContent editor={editor} />
            </div>
          </div>

          <footer className="statusbar">
            <span>{activePaper.label}</span>
            <span>{wordCount} words</span>
            <span>{characterCount} characters</span>
            <span>Saved {formatDate(activeDoc.updatedAt)}</span>
          </footer>
        </section>
      </div>
    </main>
  )
}

function ToolbarButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button className={`tool-button ${active ? 'active' : ''}`} type="button" onClick={onClick} title={label} aria-label={label}>
      {icon}
    </button>
  )
}

function ColorMenu({
  icon,
  label,
  onToggle,
  onPick,
  open,
  options,
}: {
  icon: ReactNode
  label: string
  onToggle: () => void
  onPick: (color: string) => void
  open: boolean
  options: string[]
}) {
  return (
    <div className="relative">
      <button
        className={`tool-button ${open ? 'active' : ''}`}
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onClick={onToggle}
      >
        {icon}
      </button>
      <div className={`swatch-menu ${open ? 'open' : ''}`}>
        {options.map((color) => (
          <button
            className="swatch"
            key={color}
            type="button"
            onClick={() => onPick(color)}
            style={{ backgroundColor: color }}
            aria-label={`${label} ${color}`}
          />
        ))}
      </div>
    </div>
  )
}

function Divider() {
  return <span className="h-6 w-px bg-[var(--line)]" />
}

export default App
