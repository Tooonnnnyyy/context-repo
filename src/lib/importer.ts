import { Unzip, UnzipInflate } from 'fflate'
import { parse } from 'yaml'
import type { Note } from '../types'
import { noteId, normalizePath } from './workspace'

export const LIMITS = { files: 1000, fileBytes: 1024 * 1024, totalBytes: 20 * 1024 * 1024, archiveBytes: 25 * 1024 * 1024 }
const encoder = new TextEncoder()
const excluded = (path: string) => path.split('/').some(part => part.startsWith('.') || part === '__MACOSX' || part === 'node_modules')

/** Splits YAML frontmatter from the body. Malformed frontmatter stays in the body, so no source text is lost. */
function splitFrontmatter(input: string): { fields: Record<string, unknown>; body: string } {
  let fields: Record<string, unknown> = {}, body = input.replace(/^\uFEFF/, '')
  const front = body.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (front) {
    try {
      const parsed: unknown = parse(front[1], { maxAliasCount: 0, uniqueKeys: true })
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) fields = parsed as Record<string, unknown>
      body = body.slice(front[0].length)
    } catch { /* Keep malformed frontmatter visible; never discard source text. */ }
  }
  return { fields, body }
}

/** Markdown without fenced or inline code: code is not prose, so it carries no tags or links. */
const proseOf = (body: string) => body.replace(/^```[\s\S]*?^```/gm, '').replace(/^~~~[\s\S]*?^~~~/gm, '').replace(/`[^`]+`/g, '')

function tagsFrom(fields: Record<string, unknown>, prose: string): string[] {
  const frontTags = Array.isArray(fields.tags) ? fields.tags.filter((v): v is string => typeof v === 'string') : typeof fields.tags === 'string' ? fields.tags.split(/[,\s]+/) : []
  const inline = [...prose.matchAll(/(?:^|\s)#([\p{L}\p{N}_/-]+)/gu)].map(m => m[1])
  return [...new Set([...frontTags, ...inline].map(t => t.replace(/^#/, '').trim()).filter(Boolean))].slice(0, 12)
}

/**
 * The tags an author wrote in a note's original Markdown: frontmatter `tags` plus inline #tags.
 * Never a folder name. These are the only tags that may leave the private workspace.
 */
export function explicitTags(markdown: string): string[] {
  const { fields, body } = splitFrontmatter(markdown)
  return tagsFrom(fields, proseOf(body))
}

/** A short plain-text excerpt of Markdown: no code, images, embeds, headings or link syntax. */
export function summarize(markdown: string, length = 180): string {
  const plain = proseOf(markdown)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/!\[\[[^\]]*\]\]/g, '')
    .replace(/^#+\s+.*$/gm, '')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target: string, alias?: string) => alias || target.replace(/#.*$/, '') || target.slice(1))
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[[ xX]\](?=\s)/g, '')
    .replace(/[*_>#`]/g, '')
    .replace(/\s+/g, ' ').trim()
  return Array.from(plain).slice(0, length).join('') || 'A note in your context base.'
}

export function parseNote(input: string, rawPath: string, source: Note['source'] = 'obsidian'): Note {
  const path = normalizePath(rawPath)
  if (encoder.encode(input).length > LIMITS.fileBytes) throw new Error('A note exceeds the 1 MB limit.')
  const { fields, body } = splitFrontmatter(input)
  const filename = path.split('/').at(-1)!.replace(/\.md$/i, '')
  const title = (typeof fields.title === 'string' ? fields.title : body.match(/^#\s+(.+)$/m)?.[1] || filename).slice(0, 160)
  const prose = proseOf(body)
  const folder = path.split('/').slice(0, -1).at(-1)
  const tags = tagsFrom(fields, prose)
  // A folder name is a private organizing topic inside this workspace only; exports use explicitTags().
  if (!tags.length && folder) tags.push(folder)
  const links = [...new Set([...prose.matchAll(/(?<!!)\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)].map(m => m[1].trim()))].slice(0, 100)
  return {
    id: noteId(path), path, title, body, original: input,
    summary: summarize(body), tags, links,
    tier: fields.tier === '3A' || fields.tier === '2A' ? fields.tier : '1A',
    kind: fields.type === 'project' ? 'project' : fields.type === 'blog' ? 'blog' : 'note',
    visibility: 'private', source,
  }
}

function unzipMarkdown(data: Uint8Array): { path: string; text: string }[] {
  const results: { path: string; text: string }[] = []
  let total = 0, count = 0, failure: Error | null = null
  const unzip = new Unzip(file => {
    if (failure || !file.name.toLowerCase().endsWith('.md')) return
    let path: string
    try { path = normalizePath(file.name) } catch { failure = new Error('The ZIP contains an unsafe note path.'); return }
    if (excluded(path)) return
    if (++count > LIMITS.files || (file.originalSize || 0) > LIMITS.fileBytes) { failure = new Error('The archive exceeds the import limits.'); return }
    const chunks: Uint8Array[] = []; let size = 0
    file.ondata = (error, chunk, final) => {
      if (error) { failure = new Error('A note in the archive could not be read.'); file.terminate(); return }
      size += chunk.length; total += chunk.length
      if (size > LIMITS.fileBytes || total > LIMITS.totalBytes) { failure = new Error('The archive expands beyond the 20 MB import limit.'); file.terminate(); return }
      if (failure) { file.terminate(); return }
      chunks.push(chunk)
      if (final) {
        const bytes = new Uint8Array(size); let offset = 0
        for (const part of chunks) { bytes.set(part, offset); offset += part.length }
        results.push({ path, text: new TextDecoder('utf-8', { fatal: false }).decode(bytes) })
      }
    }
    file.start()
  })
  unzip.register(UnzipInflate)
  try {
    for (let start = 0; start < data.length && !failure; start += 65536) unzip.push(data.subarray(start, start + 65536), start + 65536 >= data.length)
  } catch { throw new Error('This ZIP could not be read. Export a standard ZIP or select Markdown files instead.') }
  if (failure) throw failure
  return results
}

export async function importFiles(files: File[]): Promise<{ notes: Note[]; ignored: number }> {
  if (files.length > LIMITS.files + 500) throw new Error('Select up to 1,000 Markdown notes at a time.')
  const sources: { path: string; text: string }[] = []
  let total = 0, ignored = 0
  for (const file of files) {
    const rawPath = file.webkitRelativePath || file.name
    if (excluded(rawPath)) { ignored++; continue }
    if (file.name.toLowerCase().endsWith('.zip')) {
      if (file.size > LIMITS.archiveBytes) throw new Error('Choose a ZIP smaller than 25 MB.')
      const entries = unzipMarkdown(new Uint8Array(await file.arrayBuffer()))
      for (const entry of entries) { total += encoder.encode(entry.text).length; sources.push(entry) }
    } else if (file.name.toLowerCase().endsWith('.md')) {
      if (file.size > LIMITS.fileBytes) throw new Error('Each Markdown note must be smaller than 1 MB.')
      total += file.size
      sources.push({ path: normalizePath(rawPath), text: await file.text() })
    } else ignored++
    if (total > LIMITS.totalBytes || sources.length > LIMITS.files) throw new Error('Choose up to 1,000 notes, with 20 MB of text in total.')
  }
  if (!sources.length) throw new Error('No Markdown notes found. Choose .md files, a vault folder, or a ZIP containing notes.')
  const notes = sources.map(s => parseNote(s.text, s.path))
  const seen = new Set<string>()
  return { notes: notes.filter(n => { if (seen.has(n.id)) { ignored++; return false }; seen.add(n.id); return true }), ignored }
}
