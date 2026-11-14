import { useMemo } from 'react'
import MarkdownIt from 'markdown-it'
import { X, ArrowUpRight, LockKeyhole, Link2, FileText } from 'lucide-react'
import { resolveLinks } from '../lib/workspace'
import type { Note } from '../types'
import { useDialog } from './useDialog'

export function NoteReader({ note, notes, onClose, onSelect }: { note: Note; notes: Note[]; onClose: () => void; onSelect: (id: string) => void }) {
  useDialog(true, onClose)
  const rendered = useMemo(() => {
    const md = new MarkdownIt({ html: false, linkify: false, breaks: true })
    // No remote images or embedded media: importing Markdown must not contact third parties.
    md.renderer.rules.image = () => '<span class="attachment-omitted">[Image not loaded]</span>'
    const defaultLink = md.renderer.rules.link_open || ((tokens, idx, opts, env, self) => self.renderToken(tokens, idx, opts))
    md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
      tokens[idx].attrSet('target', '_blank'); tokens[idx].attrSet('rel', 'noopener noreferrer'); return defaultLink(tokens, idx, opts, env, self)
    }
    return md.render(note.body.replace(/!\[\[[^\]]+\]\]/g, '[Attachment not loaded]').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, alias) => alias || target))
  }, [note])
  const { resolved } = resolveLinks(notes)
  const linkedIds = new Set(resolved.filter(l => l.source === note.id || l.target === note.id).flatMap(l => [l.source, l.target]))
  const linked = notes.filter(n => n.id !== note.id && linkedIds.has(n.id))
  return <div className="reader-backdrop" onClick={onClose}><aside className="note-reader" role="dialog" aria-modal="true" aria-labelledby="reader-title" onClick={e => e.stopPropagation()}><div className="reader-toolbar"><span><FileText size={15} />{note.kind}</span><button className="icon-button" onClick={onClose} aria-label="Close note"><X size={19} /></button></div><div className="reader-scroll"><div className="reader-privacy"><LockKeyhole size={13} />{note.visibility === 'private' ? 'Private note' : 'Selected for sharing · not published'}</div><h1 id="reader-title">{note.title}</h1><div className="tag-row">{note.tags.map(tag => <span key={tag}>{tag}</span>)}</div><div className="markdown-content" dangerouslySetInnerHTML={{ __html: rendered }} /><div className="reader-source">Source · {note.path}<br />Original Markdown preserved</div>{linked.length > 0 && <section className="reader-connections"><h3><Link2 size={16} />Connected notes <span>{linked.length}</span></h3>{linked.map(n => <button key={n.id} onClick={() => onSelect(n.id)}><span>{n.title}</span><ArrowUpRight size={15} /></button>)}</section>}</div></aside></div>
}
