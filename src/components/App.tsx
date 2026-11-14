import { useCallback, useEffect, useRef, useState } from 'react'
import { LayoutDashboard, Network, FileText, Send, Settings2, Search, ChevronRight, ChevronDown, ArrowUpRight, LockKeyhole, Plus, FolderOpen, X, ArrowRight, LogOut, Menu, HelpCircle, Check, Loader2 } from 'lucide-react'
import { Brand, Button } from './ui'
import { Entry } from './Entry'
import { Onboarding } from './Onboarding'
import { Overview } from './Overview'
import { NotesView } from './NotesView'
import { SharingView } from './SharingView'
import { SettingsView } from './SettingsView'
import { GraphView } from './GraphView'
import { NoteReader } from './NoteReader'
import { ImportPicker } from './ImportPicker'
import { useDialog } from './useDialog'
import { authClient } from '../lib/auth'
import { emptyWorkspace, mergeNotes } from '../lib/workspace'
import { loadWorkspace, saveWorkspace } from '../lib/storage'
import { sampleNotes } from '../lib/sample'
import { parseNote } from '../lib/importer'
import type { Workspace, Account, View } from '../types'

const navItems = [
  { id: 'overview', title: 'Overview', icon: LayoutDashboard },
  { id: 'graph', title: 'Knowledge graph', icon: Network },
  { id: 'notes', title: 'My notes', icon: FileText },
  { id: 'sharing', title: 'Share & connect', icon: Send },
] as const

function NoteComposer({ onClose, onSave, initialText = '' }: { onClose: () => void; onSave: (title: string, body: string, tags: string) => void; initialText?: string }) {
  const [title, setTitle] = useState(''), [body, setBody] = useState(initialText), [tags, setTags] = useState('')
  useDialog(true, onClose)
  return <div className="modal-backdrop"><section className="modal note-composer" role="dialog" aria-modal="true" aria-labelledby="composer-title"><div className="modal-heading"><div><h2 id="composer-title">A thought worth keeping.</h2><p>It doesn’t have to be finished to belong here.</p></div><button className="icon-button" aria-label="Close new note" onClick={onClose}><X size={19} /></button></div><form onSubmit={e => { e.preventDefault(); onSave(title, body, tags) }}><label className="field-label">Title<input autoFocus required maxLength={160} className="text-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="What’s on your mind?" /></label><label className="field-label">Your note<textarea required className="text-input composer-body" maxLength={200000} value={body} onChange={e => setBody(e.target.value)} placeholder="Write freely. Use [[note titles]] to make connections." /></label><label className="field-label">Topics <span className="optional">optional, separated by commas</span><input className="text-input" value={tags} onChange={e => setTags(e.target.value)} placeholder="Ideas, Learning…" maxLength={300} /></label><footer className="modal-footer"><span className="small-note"><LockKeyhole size={13} />Saved privately on this device</span><Button type="submit" disabled={!title.trim() || !body.trim()}>Save note<Check size={15} /></Button></footer></form></section></div>
}

function ImportDialog({ onClose, onImport }: { onClose: () => void; onImport: (notes: Workspace['notes']) => void }) {
  useDialog(true, onClose)
  return <div className="modal-backdrop"><section className="modal import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title"><div className="modal-heading"><div><h2 id="import-title">Bring your own thinking.</h2><p>Import notes without changing your original vault.</p></div><button className="icon-button" aria-label="Close import" onClick={onClose}><X size={19} /></button></div><ImportPicker onImport={onImport} /><div className="import-instructions"><h3>From Obsidian, in three steps</h3><ol><li>Open your vault folder from Obsidian’s vault menu.</li><li>Select the Markdown files you want, or ZIP that folder.</li><li>Choose those files above. Notes, tags and links are organized locally.</li></ol><p>Your vault is not continuously connected. Re-importing skips existing note paths and preserves your current notes.</p></div></section></div>
}

export function App() {
  const [loading, setLoading] = useState(true), [available, setAvailable] = useState(false), [googleAvailable, setGoogleAvailable] = useState(false)
  const [workspace, setWorkspace] = useState<Workspace | null>(null), [owner, setOwner] = useState(''), [account, setAccount] = useState<Account | null>(null)
  const [view, setView] = useState<View>('overview'), [onboarding, setOnboarding] = useState(false), [importing, setImporting] = useState(false), [composing, setComposing] = useState(false)
  const [selected, setSelected] = useState<string | null>(null), [toast, setToast] = useState(''), [search, setSearch] = useState(''), [mobileNav, setMobileNav] = useState(false), [accountMenu, setAccountMenu] = useState(false), [saving, setSaving] = useState(false)
  const [deletePrompt, setDeletePrompt] = useState(false), [deletePassword, setDeletePassword] = useState(''), [deleteBusy, setDeleteBusy] = useState(false)
  const initialCapture = useRef(new URLSearchParams(location.search).get('text')?.slice(0, 100000) || '')
  const notify = useCallback((message: string) => setToast(message), [])
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(''), 6500); return () => clearTimeout(timeout) }, [toast])
  async function openOwner(key: string, user: Account | null, example = false) {
    const existing = await loadWorkspace(key)
    const next = existing || emptyWorkspace()
    if (example && !existing) { next.name = 'Example workspace'; next.notes = sampleNotes(); next.onboarding = { step: 0, completed: true, source: 'sample' } }
    setAccount(user); setOwner(key); setWorkspace(next); setView('overview'); setOnboarding(!next.onboarding.completed)
    try { localStorage.setItem('context-active-workspace', user ? 'account' : key) } catch { /* Browser storage error is shown by the workspace save. */ }
    if (initialCapture.current) { setComposing(true); setOnboarding(false) }
  }
  useEffect(() => {
    async function boot() {
      try {
        const health = await fetch('/api/health').then(r => r.ok ? r.json() as Promise<{ accounts: boolean; google: boolean }> : null).catch(() => null)
        setAvailable(Boolean(health?.accounts)); setGoogleAvailable(Boolean(health?.google))
        const session = health?.accounts ? await authClient.getSession() : null
        if (session?.data?.user) await openOwner(`account:${session.data.user.id}`, session.data.user)
        else {
          let local = ''; try { local = localStorage.getItem('context-active-workspace') || '' } catch { /* Start at the entry page. */ }
          if (local === 'local' || local === 'example') await openOwner(local, null, local === 'example')
        }
      } catch (e) { notify((e as Error).message) }
      finally { setLoading(false) }
    }
    void boot()
  }, [])
  useEffect(() => {
    if (!workspace || !owner) return
    let active = true
    setSaving(true)
    const timer = setTimeout(() => { void saveWorkspace(owner, workspace).then(() => { if (active) setSaving(false) }).catch(e => { if (active) { setSaving(false); notify((e as Error).message) } }) }, 100)
    return () => { active = false; clearTimeout(timer) }
  }, [workspace, owner, notify])
  const change = (next: Workspace) => setWorkspace({ ...next, updatedAt: new Date().toISOString() })
  const navigate = (next: View) => { setView(next); setMobileNav(false); setAccountMenu(false) }
  const select = (id: string) => {
    if (id === 'core') navigate('settings')
    else if (id.startsWith('topic:')) { setSearch(id.slice(6)); navigate('notes') }
    else setSelected(id)
  }
  async function signOut() {
    try {
      if (workspace) await saveWorkspace(owner, workspace)
      if (account) { const result = await authClient.signOut(); if (result.error) throw new Error(result.error.message) }
      localStorage.removeItem('context-active-workspace'); setAccount(null); setWorkspace(null); setAccountMenu(false); setOwner('')
    } catch { notify('Could not close this workspace. Please try again.') }
  }
  useDialog(deletePrompt, () => { setDeletePrompt(false); setDeletePassword('') })
  async function deleteAccount() {
    if (deleteBusy) return
    setDeleteBusy(true)
    try {
      const result = await authClient.deleteUser({ password: deletePassword })
      if (result.error) throw new Error(result.error.message || 'Account could not be deleted.')
      setDeletePrompt(false); setDeletePassword(''); setAccount(null); setWorkspace(null); setOwner(''); localStorage.removeItem('context-active-workspace')
      notify('Account deleted. Your local note copy was preserved; it was never stored on the server.')
    } catch (e) { notify((e as Error).message) }
    finally { setDeleteBusy(false) }
  }
  if (loading) return <div className="app-loading"><Brand /><Loader2 className="spin" size={22} /><p>Making room for your thoughts…</p></div>
  if (location.pathname === '/privacy') return <div className="privacy-page"><Brand /><h1>Your notes are your business.</h1><p>Context stores imported note text, tags, paths and links in this browser’s IndexedDB. Your original vault is never changed. No note content is sent to an AI model, analytics service, or our account database.</p><h2>Accounts</h2><p>When you sign up we store the name and email you provide, a password hash, and session records, including technical IP and user-agent information for account security. Authentication uses secure HTTP-only cookies on HTTPS deployments. Account recovery and email verification are not available in this beta. Delete your account from the workspace account menu. Local notes are preserved, not silently deleted.</p><h2>Sharing</h2><p>Selecting a note does not publish it. Exporting a public projection downloads the reviewed text. Opening an IdeaMap draft sends that one note’s title, text and tags to IdeaMap in a URL. That service has its own account and publication controls. Continuous account sync is not available yet.</p><h2>Backups and device storage</h2><p>Export a private context ZIP before clearing site storage or moving devices. Imported images and attachments are not loaded. Account signup is separate from cloud note backup. Access to this browser profile can also allow access to locally saved notes.</p><Button onClick={() => { location.href = '/' }}>Back to Context<ArrowRight size={16} /></Button></div>
  if (!workspace) return <><Entry googleAvailable={googleAvailable} available={available} onLocal={example => { void openOwner(example ? 'example' : 'local', null, example).catch(e => notify((e as Error).message)) }} onAccount={user => { void openOwner(`account:${user.id}`, user).catch(e => notify((e as Error).message)) }} />{toast && <div className="toast" role="status">{toast}</div>}</>
  const selectedNote = workspace.notes.find(n => n.id === selected)
  const currentTitle = view === 'settings' ? 'Settings' : navItems.find(n => n.id === view)?.title || 'Overview'
  return <div className="app-shell"><aside className={`sidebar ${mobileNav ? 'is-open' : ''}`}><Brand small /><button className="workspace-picker" onClick={() => navigate('settings')}><span className="workspace-monogram">{workspace.name.slice(0, 1).toUpperCase() || 'C'}</span><span><strong>{workspace.name || 'My context'}</strong><small>Personal workspace</small></span><ChevronDown size={14} /></button><div className="nav-label">YOUR SPACE</div><nav className="primary-nav">{navItems.map(item => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><item.icon size={18} /><span>{item.title}</span>{item.id === 'notes' && <small>{workspace.notes.length}</small>}</button>)}</nav><div className="sidebar-source"><span className="nav-label">CONNECTED SOURCES</span><div><span className="obsidian-gem">◆</span><span>Obsidian<small>{workspace.notes.some(n => n.source === 'obsidian') ? 'Imported locally' : 'Ready to import'}</small></span><button className="icon-button" aria-label="Import Obsidian notes" onClick={() => setImporting(true)}><Plus size={14} /></button></div><button className="sidebar-add-source" onClick={() => setImporting(true)}><Plus size={14} />Import a source</button></div><div className="sidebar-bottom"><div className="sidebar-context-note"><span className="sidebar-tiny-mark"><Network size={16} /></span><strong>Less collecting.<br />More connecting.</strong><span>A little room for your next idea.</span></div><button onClick={() => setOnboarding(true)}><HelpCircle size={16} />Setup guide</button><button className={view === 'settings' ? 'active' : ''} onClick={() => navigate('settings')}><Settings2 size={16} />Settings & export</button><a href="https://github.com/Tooonnnnyyy/context-repo" target="_blank" rel="noopener noreferrer"><FileText size={15} />Use the template<ArrowUpRight size={13} /></a></div></aside>
    {mobileNav && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <div className="main-column"><header className="app-header"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(!mobileNav)}><Menu size={19} /></button><span>My space</span><ChevronRight size={13} /><strong>{currentTitle}</strong></div><div className="header-actions"><form className="global-search" onSubmit={e => { e.preventDefault(); navigate('notes') }}><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a thought…" aria-label="Find a thought" /><kbd>↵</kbd></form><span className="local-status"><span className={`live-dot${saving ? ' is-saving' : ''}`} />{saving ? 'Saving…' : 'On this device'}</span><div className="account-control"><button className="avatar" aria-label="Open account menu" aria-expanded={accountMenu} onClick={() => setAccountMenu(!accountMenu)}>{account?.name.slice(0, 1).toUpperCase() || 'C'}</button>{accountMenu && <div className="account-menu"><strong>{account?.name || 'Local workspace'}</strong><span>{account ? 'Account beta · notes on this device' : 'No account connected'}</span><button onClick={() => navigate('settings')}><Settings2 size={15} />Workspace settings</button><button onClick={() => void signOut()}><LogOut size={15} />{account ? 'Sign out' : 'Close workspace'}</button>{account && <button onClick={() => { setAccountMenu(false); setDeletePrompt(true) }}>Delete account</button>}<a href="/privacy">Privacy & data<ArrowUpRight size={14} /></a></div>}</div></div></header>
      <main className={`page-content ${view === 'graph' ? 'graph-page' : ''}`}>
        {view === 'overview' && <Overview workspace={workspace} onView={navigate} onImport={() => setImporting(true)} onNew={() => setComposing(true)} onSelect={select} onOnboard={() => setOnboarding(true)} />}
        {view === 'graph' && <><div className="page-heading"><div><h1>Follow your thinking.</h1><p>Core at the center. Topics and notes, connected in layers.</p></div><Button variant="secondary" onClick={() => setImporting(true)}><FolderOpen size={16} />Import notes</Button></div><GraphView notes={workspace.notes} name={workspace.name} onSelect={select} /></>}
        {view === 'notes' && <NotesView key={search} search={search} notes={workspace.notes} onSelect={select} onNew={() => setComposing(true)} onImport={() => setImporting(true)} />}
        {view === 'sharing' && <SharingView notes={workspace.notes} onChange={notes => change({ ...workspace, notes })} notify={notify} />}
        {view === 'settings' && <SettingsView workspace={workspace} onChange={change} onOnboard={() => { change({ ...workspace, onboarding: { ...workspace.onboarding, step: 0 } }); setOnboarding(true) }} account={account} notify={notify} />}
      </main><footer className="workspace-footer"><span><LockKeyhole size={12} />Your notes stay yours.</span><span>Context beta <span>·</span> <a href="/privacy">Privacy</a></span></footer>
    </div>
    {onboarding && <Onboarding workspace={workspace} onChange={change} onFinish={() => { change({ ...workspace, name: workspace.name.trim() || 'My context', onboarding: { ...workspace.onboarding, completed: true } }); setOnboarding(false); notify('Your space is ready. Make yourself at home.') }} onClose={() => setOnboarding(false)} />}
    {selectedNote && <NoteReader note={selectedNote} notes={workspace.notes} onClose={() => setSelected(null)} onSelect={setSelected} />}
    {importing && <ImportDialog onClose={() => setImporting(false)} onImport={incoming => { const result = mergeNotes(workspace.notes, incoming); change({ ...workspace, notes: result.notes }); notify(`${result.added} notes added${result.duplicates ? `; ${result.duplicates} existing paths kept unchanged` : ''}. All imports are private.`) }} />}
    {composing && <NoteComposer initialText={initialCapture.current} onClose={() => setComposing(false)} onSave={(title, body, rawTags) => { const tags = rawTags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 12); const filename = title.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 120) || 'Untitled'; const source = `---\ntitle: ${JSON.stringify(title.trim())}\ntags: ${JSON.stringify(tags)}\n---\n# ${title.trim()}\n\n${body}\n`; const note = parseNote(source, `Captures/${filename}-${crypto.randomUUID().slice(0, 8)}.md`, 'capture'); change({ ...workspace, notes: [...workspace.notes, note] }); setComposing(false); initialCapture.current = ''; if (location.search) history.replaceState({}, '', location.pathname); notify('Thought saved, privately.'); setSelected(note.id) }} />}
    {deletePrompt && <div className="modal-backdrop"><section className="modal delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">Delete your account?</h2><p>This removes the account and server sessions. It does not remove notes from this browser. Export them from Settings first if you need a backup.</p><label className="field-label">Confirm your password<input className="text-input" type="password" autoComplete="current-password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} /></label><div className="button-row"><Button variant="secondary" onClick={() => { setDeletePrompt(false); setDeletePassword('') }}>Keep my account</Button><Button disabled={!deletePassword || deleteBusy} onClick={() => void deleteAccount()}>{deleteBusy ? 'Deleting…' : 'Delete account'}</Button></div></section></div>}
    {toast && <div className="toast" role="status"><Check size={16} /><span>{toast}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={14} /></button></div>}
  </div>
}
