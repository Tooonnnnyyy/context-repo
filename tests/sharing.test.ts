import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseNote, explicitTags } from '../src/lib/importer'
import { publicProjection, ideaMapDraft, ideaMapOrigin, redactLinks, PRIVATE_NOTE_LABEL, IDEAMAP_FALLBACK_ORIGIN, IDEAMAP_URL_LIMIT, DRAFT_TRUNCATION_NOTICE } from '../src/lib/exporter'
import type { Note } from '../src/types'

// Fictional notes written for these tests.
const selected = (note: Note): Note => ({ ...note, visibility: 'public' })
const plan = selected(parseNote('---\ntitle: Garden plan\ntags: [garden]\n---\n# Garden plan\n\nStart from [[Seed swap]] and [[Seed swap#Timing|the timing notes]]. Avoid [[Budget worries]] and [[Budget worries#Numbers]]. Ask [[Nobody wrote this]]. ![[Budget worries]] ![[scan of receipts.png]] See [[Budget worries|a private aside]] and [[Plans/Seed swap]].\n', 'Plans/Garden plan.md'))
const swap = selected(parseNote('# Seed swap\nBring labelled envelopes.', 'Plans/Seed swap.md'))
const secret = parseNote('# Budget worries\nNot for sharing.', 'Private/Budget worries.md')
const workspace = [plan, swap, secret]

test('shared bodies, summaries and titles never name notes outside the selection', () => {
  const projection = publicProjection(workspace)
  const json = JSON.stringify(projection)
  for (const hidden of ['Budget worries', 'Nobody wrote this', 'scan of receipts', 'Private/', 'Plans/']) assert.ok(!json.includes(hidden), hidden)
  const [shared] = projection.notes
  assert.ok(shared.body.includes('Start from Seed swap and the timing notes.'))
  assert.ok(shared.body.includes('Avoid [private note] and [private note]. Ask [private note].'))
  assert.ok(shared.body.includes('See a private aside and Seed swap.'))
  assert.ok(!shared.body.includes('![[') && !shared.body.includes('[['))
  // The private list keeps its own excerpt; the shared excerpt is computed after redaction.
  assert.ok(plan.summary.includes('Budget worries'))
  assert.ok(shared.summary.startsWith('Start from Seed swap and the timing notes. Avoid [private note]'))
  assert.equal(projection.links.length, 1)
})

test('unresolved and ambiguous links are treated as unselected', () => {
  const a = selected(parseNote('Compare [[Same]] with [[Gone]].', 'One/Source.md'))
  const b = selected(parseNote('One', 'Two/Same.md')), c = selected(parseNote('Two', 'Three/Same.md'))
  assert.equal(publicProjection([a, b, c]).notes[0].body, 'Compare [private note] with [private note].')
})

test('the private label is a parameter and titles are redacted too', () => {
  const heading = selected(parseNote('# Notes on [[Budget worries]]\nSee [[Budget worries]].', 'Plans/Heading.md'))
  const [shared] = publicProjection([heading, secret], { privateLabel: '(hidden)' }).notes
  assert.equal(shared.title, 'Notes on (hidden)')
  assert.ok(shared.body.endsWith('See (hidden).'))
  assert.equal(redactLinks('[[Elsewhere]]', () => false), PRIVATE_NOTE_LABEL)
})

test('local Markdown links and images follow the same rules; web links stay as written', () => {
  const note = selected(parseNote('[the budget](../Private/Budget%20worries.md), [swap](Seed%20swap.md), [site](https://example.org/a.md), ![chart](attachments/chart.png), ![logo](https://example.org/logo.png), [top](#top)', 'Plans/Links.md'))
  assert.equal(publicProjection([note, swap, secret]).notes[0].body, '[private note], swap, [site](https://example.org/a.md), , ![logo](https://example.org/logo.png), [top](#top)')
})

test('wikilinks inside code are redacted as well', () => {
  const note = selected(parseNote('```\n[[Budget worries]]\n```', 'Plans/Code.md'))
  assert.ok(!JSON.stringify(publicProjection([note, secret])).includes('Budget worries'))
})

test('exported tags are only explicit tags, never folder names', () => {
  const loose = parseNote('A note with no tags.', 'Clients confidential/Loose.md')
  const tagged = parseNote('---\ntags: [garden, "#soil"]\n---\nNotes about #compost here. `#not-a-tag`', 'Clients confidential/Tagged.md')
  assert.deepEqual(loose.tags, ['Clients confidential'], 'folder topic stays available in the private workspace')
  assert.deepEqual(explicitTags(tagged.original), ['garden', 'soil', 'compost'])
  assert.deepEqual(explicitTags('---\ntags: one, two\n---\nText'), ['one', 'two'])
  const projection = publicProjection([selected(loose), selected(tagged)])
  assert.deepEqual(projection.notes.map(n => n.tags), [[], ['garden', 'soil', 'compost']])
  assert.ok(!JSON.stringify(projection).includes('Clients confidential'))
  assert.equal(new URL(ideaMapDraft(selected(loose))).searchParams.get('tags'), '')
  assert.equal(new URL(ideaMapDraft(selected(tagged))).searchParams.get('tags'), 'garden,soil,compost')
})

test('IdeaMap draft: origin, from marker, title heading and redacted body', () => {
  const url = new URL(ideaMapDraft(plan, workspace))
  assert.equal(url.origin, IDEAMAP_FALLBACK_ORIGIN); assert.equal(url.pathname, '/new')
  assert.equal(url.searchParams.get('from'), 'context-repo')
  assert.equal(url.searchParams.get('title'), 'Garden plan')
  const body = url.searchParams.get('body')!
  assert.ok(body.startsWith('Start from Seed swap'), 'the heading that repeats the title is dropped')
  assert.ok(body.includes('Avoid [private note]') && !body.includes('Budget'))
  // Without the workspace, every other note counts as unselected.
  assert.ok(new URL(ideaMapDraft(plan)).searchParams.get('body')!.startsWith('Start from [private note]'))
  const different = selected(parseNote('---\ntitle: Short name\n---\n# A longer heading\nText', 'Plans/Different.md'))
  assert.ok(new URL(ideaMapDraft(different)).searchParams.get('body')!.startsWith('# A longer heading'))
  assert.equal(new URL(ideaMapDraft(plan, workspace, { origin: 'http://127.0.0.1:3000/ignored' })).origin, 'http://127.0.0.1:3000')
  assert.throws(() => ideaMapDraft(secret, workspace), /sharing/)
})

test('IdeaMap origin comes from configuration with a safe fallback', () => {
  assert.equal(ideaMapOrigin(), IDEAMAP_FALLBACK_ORIGIN, 'no VITE_IDEAMAP_ORIGIN outside a Vite build')
  assert.equal(ideaMapOrigin('https://preview.example.test/path/'), 'https://preview.example.test')
  for (const bad of ['javascript:alert(1)', 'not a url', '', 42]) assert.equal(ideaMapOrigin(bad), IDEAMAP_FALLBACK_ORIGIN)
})

test('a long CJK note becomes a capped draft link that decodes correctly', () => {
  const text = Array.from('社区种子交换让邻居分享收获，也让新手学会照顾土地。'.repeat(250)).slice(0, 5000).join('')
  assert.equal(Array.from(text).length, 5000)
  const note = selected(parseNote(`---\ntitle: 种子交换笔记\ntags: [社区]\n---\n# 种子交换笔记\n\n${text}`, 'Plans/种子交换笔记.md'))
  const href = ideaMapDraft(note)
  assert.ok(href.length <= IDEAMAP_URL_LIMIT, `${href.length}`)
  assert.ok(href.length > IDEAMAP_URL_LIMIT - 9, 'only as much text is cut as needed')
  const params = new URL(href).searchParams
  assert.equal(params.get('title'), '种子交换笔记'); assert.equal(params.get('tags'), '社区'); assert.equal(params.get('from'), 'context-repo')
  const body = params.get('body')!
  assert.ok(body.endsWith(DRAFT_TRUNCATION_NOTICE))
  const kept = body.slice(0, -DRAFT_TRUNCATION_NOTICE.length)
  assert.ok(kept.length > 500 && text.startsWith(kept))
})

test('draft truncation never splits a character', () => {
  const note = selected(parseNote('🌱'.repeat(5000), 'Plans/Sprouts.md'))
  const href = ideaMapDraft(note)
  assert.ok(href.length <= IDEAMAP_URL_LIMIT)
  const kept = new URL(href).searchParams.get('body')!.slice(0, -DRAFT_TRUNCATION_NOTICE.length)
  assert.ok(kept.length > 0 && Array.from(kept).every(char => char === '🌱'))
  assert.throws(() => ideaMapDraft(selected({ ...note, original: `---\ntags: [${'x'.repeat(8000)}]\n---\n` })), /too long/)
})
