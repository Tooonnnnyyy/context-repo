import { useRef, useState } from 'react'
import { FolderUp, Upload, Check, FileText, Folder, Loader2 } from 'lucide-react'
import { importFiles } from '../lib/importer'
import { Button } from './ui'
import type { Note } from '../types'

export function ImportPicker({ onImport }: { onImport: (notes: Note[]) => void }) {
  const fileInput = useRef<HTMLInputElement>(null), folderInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState('')
  async function load(files: File[]) {
    if (!files.length || busy) return
    setBusy(true); setError(''); setResult('')
    try {
      const imported = await importFiles(files)
      onImport(imported.notes)
      setResult(`${imported.notes.length} notes ready${imported.ignored ? ` · ${imported.ignored} unsupported or duplicate files skipped` : ''}. Originals are unchanged.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Import could not be completed.') }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ''; if (folderInput.current) folderInput.current.value = '' }
  }
  return <div>
    <div className={`import-zone${busy ? ' is-busy' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void load([...e.dataTransfer.files]) }}>
      <div className="source-icon">{busy ? <Loader2 className="spin" size={27} /> : <FolderUp size={29} />}</div>
      <h3>{busy ? 'Reading your notes…' : 'Bring your notes home'}</h3>
      <p>Drop Markdown files or a vault ZIP here.<br />Your notes are processed on this device.</p>
      <div className="button-row"><Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy}><Upload size={15} />Choose files</Button><Button variant="ghost" onClick={() => folderInput.current?.click()} disabled={busy}><Folder size={15} />Choose folder</Button></div>
      <small>.md or .zip · up to 1,000 notes · 20 MB of text</small>
      <input ref={fileInput} type="file" accept=".md,.zip" multiple hidden aria-label="Choose Markdown or ZIP files" onChange={e => void load([...(e.target.files || [])])} />
      <input ref={folderInput} type="file" multiple hidden aria-label="Choose Obsidian folder" {...{ webkitdirectory: '', directory: '' } as object} onChange={e => void load([...(e.target.files || [])])} />
    </div>
    {result && <div className="inline-success" role="status"><Check size={16} />{result}</div>}
    {error && <div className="inline-error" role="alert">{error}</div>}
    <p className="small-note"><FileText size={14} />Includes text, tags and links. Attachments and hidden app folders stay behind.</p>
  </div>
}
