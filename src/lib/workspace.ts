import type { Note, Workspace } from '../types'

export function emptyWorkspace(): Workspace {
  return { schema: 1, name: 'My context', notes: [], onboarding: { step: 0, completed: false, source: 'empty' }, updatedAt: new Date().toISOString() }
}

export function noteId(path: string): string {
  // A stable path identifier, not a security hash. Never exported in public projections.
  return 'note:' + encodeURIComponent(path.normalize('NFC').toLowerCase())
}

export function normalizePath(path: string): string {
  const clean = path.replace(/\\/g, '/').normalize('NFC')
  if (clean.startsWith('/') || /^[a-z]:/i.test(clean) || clean.split('/').some(part => part === '..' || part === '.')) throw new Error('Only relative note paths can be imported.')
  return clean.replace(/\/{2,}/g, '/').replace(/^\/+/, '')
}

/** The note part of a link target: no `#heading` / `#^block` suffix and no `.md` extension. */
export function linkName(target: string): string {
  return target.split('#')[0].replace(/\.md$/i, '')
}

/**
 * Resolves a wikilink target written in `source` to exactly one note: a path relative to the
 * source's folder first, then a vault path, title or file name. Missing or ambiguous targets
 * resolve to null, and so does a bare `#heading` link (it names no other note).
 */
export function createLinkResolver(notes: Note[]): (source: Note, target: string) => Note | null {
  const byName = new Map<string, Note[]>()
  const lookup = (name: string) => name.normalize('NFC').toLocaleLowerCase()
  const add = (name: string, note: Note) => {
    const key = lookup(name).replace(/\.md$/i, '')
    const found = byName.get(key) || []
    if (!found.some(n => n.id === note.id)) byName.set(key, [...found, note])
  }
  for (const note of notes) {
    add(note.path, note)
    add(note.title, note)
    add(note.path.split('/').at(-1) || note.title, note)
  }
  return (source, target) => {
    const stripped = linkName(target)
    if (!stripped) return null
    const folder = source.path.split('/').slice(0, -1).join('/')
    const relative = folder ? byName.get(lookup(`${folder}/${stripped}`)) : undefined
    const found = relative?.length === 1 ? relative : byName.get(lookup(stripped))
    return found?.length === 1 ? found[0] : null
  }
}

export function resolveLinks(notes: Note[]) {
  const resolve = createLinkResolver(notes)
  const resolved: { source: string; target: string }[] = []
  const missing: { note: string; target: string }[] = []
  for (const note of notes) for (const target of note.links) {
    if (!linkName(target)) continue
    const found = resolve(note, target)
    if (!found) missing.push({ note: note.id, target })
    else if (found.id !== note.id) resolved.push({ source: note.id, target: found.id })
  }
  return { resolved, missing }
}

export function mergeNotes(current: Note[], incoming: Note[]) {
  const notes = new Map(current.map(n => [n.id, n]))
  let added = 0, duplicates = 0
  for (const note of incoming) {
    if (notes.has(note.id)) { duplicates++; continue }
    notes.set(note.id, note); added++
  }
  return { notes: [...notes.values()], added, duplicates }
}

export function buildGraph(notes: Note[], name = 'My context') {
  const palette = ['#8a79c5', '#d5a05e', '#6f9e90', '#7395b6', '#cb8799', '#9c9a6a']
  const tags = [...new Set(notes.flatMap(n => n.tags))].sort().slice(0, 24)
  const regions = [{ id: 'core', label: 'Core', color: '#e96a4c', order: 0 }, ...tags.map((tag, i) => ({ id: tag, label: tag, color: palette[i % palette.length], order: i + 1 })), { id: 'unfiled', label: 'Unfiled', color: '#91a2ae', order: 30 }]
  const region = (note: Note) => tags.includes(note.tags[0]) ? note.tags[0] : 'unfiled'
  const nodes = [
    { id: 'core', label: name, short: name, kind: 'self', region: 'core', layer: 0, color: '#e96a4c', tags: [] },
    ...tags.map((tag, i) => ({ id: `topic:${tag}`, label: tag, short: tag, kind: 'topic', region: tag, layer: 2, color: palette[i % palette.length], tags: [tag] })),
    ...notes.map(note => ({ id: note.id, label: note.title, short: note.title.length > 28 ? note.title.slice(0, 26) + '…' : note.title, kind: 'note', region: region(note), layer: note.tier === '3A' ? 1 : note.tier === '2A' ? 2 : 3, color: regions.find(r => r.id === region(note))?.color || '#91a2ae', tags: note.tags, path: note.path })),
  ]
  const links = resolveLinks(notes).resolved.map(link => ({ ...link, kind: 'link' }))
  const edges = [
    ...tags.map(tag => ({ source: 'core', target: `topic:${tag}`, kind: 'core' })),
    ...notes.map(note => ({ source: tags.includes(note.tags[0]) ? `topic:${note.tags[0]}` : 'core', target: note.id, kind: 'topic' })),
    ...links,
  ]
  return { nodes, edges, regions, links }
}
