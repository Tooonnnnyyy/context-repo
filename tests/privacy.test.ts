import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate'
import { parseNote, importFiles, LIMITS } from '../src/lib/importer'
import { resolveLinks, mergeNotes, emptyWorkspace } from '../src/lib/workspace'
import { publicProjection, templateArchive, contextPack, ideaMapDraft } from '../src/lib/exporter'

test('import never trusts public frontmatter and preserves original source', () => {
  const source = '---\ntitle: A fictional note\nvisibility: public\npublic: true\ntags: [garden]\n---\n# Note\nHello [[Next]].'
  const note = parseNote(source, 'Ideas/Note.md')
  assert.equal(note.visibility, 'private'); assert.equal(note.original, source)
  assert.deepEqual(note.links, ['Next']); assert.deepEqual(note.tags, ['garden'])
})
test('unsafe absolute and traversal paths are rejected', () => {
  for (const path of ['../x.md', '/tmp/x.md', 'C:\\x.md', 'a/../x.md']) assert.throws(() => parseNote('# x', path))
})
test('malformed frontmatter remains visible without losing text', () => {
  const source = '---\ntitle: [broken\n---\nHello'
  assert.equal(parseNote(source, 'note.md').body, source)
})
test('reimport preserves existing text and explicit privacy selection', () => {
  const old = { ...parseNote('Original', 'note.md'), visibility: 'public' as const }
  const merged = mergeNotes([old], [parseNote('Changed', 'note.md')])
  assert.equal(merged.duplicates, 1); assert.equal(merged.notes[0].original, 'Original'); assert.equal(merged.notes[0].visibility, 'public')
})
test('ambiguous links stay unresolved; relative note path wins', () => {
  const a = parseNote('[[Same]]', 'A/Source.md'), b = parseNote('One', 'A/Same.md'), c = parseNote('Two', 'B/Same.md')
  assert.equal(resolveLinks([a,b,c]).resolved[0].target, b.id)
  assert.equal(resolveLinks([{...a,path:'Source.md'},b,c]).missing.length, 1)
})
test('ZIP import excludes hidden files and rejects traversal', async () => {
  const archive = zipSync({'Folder/Note.md':strToU8('# Example'),'.obsidian/settings.md':strToU8('private settings')})
  const result = await importFiles([new File([archive], 'notes.zip')])
  assert.equal(result.notes.length,1); assert.equal(result.notes[0].visibility,'private')
  await assert.rejects(importFiles([new File([zipSync({'../escape.md':strToU8('no')})],'bad.zip')]),/unsafe/)
})
test('decompression and individual note limits reject oversized content', async () => {
  const huge = 'a'.repeat(LIMITS.fileBytes + 1)
  assert.throws(() => parseNote(huge, 'large.md'), /1 MB/)
  await assert.rejects(importFiles([new File([zipSync({'large.md':strToU8(huge)})], 'large.zip')]), /limits|limit/)
})
test('public projection contains only selected notes and selected graph edges', () => {
  const a = {...parseNote('Public text', 'private-folder/a.md'),visibility:'public' as const}, b=parseNote('Private text','secret.md')
  const value=JSON.stringify(publicProjection([a,b]))
  assert.ok(!value.includes(b.title)); assert.ok(!value.includes(b.path)); assert.ok(!value.includes(a.path)); assert.ok(!value.includes(a.id))
  assert.equal(publicProjection([a,b]).notes.length,1)
})
test('private export preserves Markdown and empty template contains no notes', () => {
  const source='---\ntitle: Example\n---\n# Example\nOriginal content.'
  const ws={...emptyWorkspace(),notes:[parseNote(source,'Ideas/a.md')]}
  const archive=unzipSync(templateArchive(ws))
  assert.equal(strFromU8(archive['my-context/notes/Ideas/a.md']),source)
  assert.ok(!Object.keys(unzipSync(templateArchive(ws,false))).some(p=>p.includes('/notes/')))
})
test('context pack obeys its character budget and private notes cannot open public drafts', () => {
  const note=parseNote('a'.repeat(10000),'Long.md')
  assert.ok(contextPack([note],'',100).length<=400)
  assert.throws(()=>ideaMapDraft(note),/sharing/)
})
