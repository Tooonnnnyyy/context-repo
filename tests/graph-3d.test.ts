import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildGraph } from '../src/lib/workspace'
import { sampleNotes } from '../src/lib/sample'

// A minimal DOM: just enough for the 3D view to reach WebGL context creation in Node.
class FakeElement {
  tagName: string; parentNode: FakeElement | null = null; children: FakeElement[] = []
  attributes: Record<string, string> = {}; contexts: string[] = []; width = 300; height = 150
  placement: string[] = []
  constructor(tag: string) { this.tagName = tag.toUpperCase() }
  setAttribute(name: string, value: string) { this.attributes[name] = String(value) }
  addEventListener() {}
  removeEventListener() {}
  // Like a browser canvas: once it has handed out one kind of context, it refuses the others.
  getContext(type: string) {
    this.contexts.push(type)
    this.placement = this.parentNode?.children.map(child => child.attributes.role || child.tagName) || []
    return type === '2d' && !this.contexts.some(t => t !== '2d') ? {} : null
  }
  get firstChild() { return this.children[0] ?? null }
  insertBefore(node: FakeElement, reference: FakeElement | null) {
    node.remove(); node.parentNode = this
    const index = reference ? this.children.indexOf(reference) : -1
    if (index < 0) this.children.push(node); else this.children.splice(index, 0, node)
    return node
  }
  appendChild(node: FakeElement) { return this.insertBefore(node, null) }
  remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null } }
  replaceChildren() { this.children = [] }
}

test('the 3D view asks for WebGL on its own canvas, never the 2D canvas, and cleans up', async () => {
  const created: FakeElement[] = []
  Object.assign(globalThis, {
    document: { createElement: (tag: string) => { const element = new FakeElement(tag); created.push(element); return element } },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  })
  const { KnowledgeGraph3D } = await import('../src/graph-3d.js')
  const stage = new FakeElement('div'), shared = new FakeElement('canvas'), layer = new FakeElement('div')
  shared.setAttribute('role', 'shared'); layer.setAttribute('role', 'layer')
  stage.appendChild(shared); stage.appendChild(layer)
  assert.ok(shared.getContext('2d'), 'the 2D view has drawn on the shared canvas')
  const logged = console.error
  console.error = () => {}
  try {
    // Node has no WebGL, so construction fails after asking; a browser gets a context here.
    assert.throws(() => new KnowledgeGraph3D({ stage, canvas: shared, layer, ...buildGraph(sampleNotes()), onSelect() {}, onFallback() {} }), /WebGL/)
  } finally { console.error = logged }
  assert.deepEqual(shared.contexts, ['2d'], 'the shared 2D canvas is never asked for WebGL')
  const surface = created.find(element => element.tagName === 'CANVAS')!
  assert.ok(surface.contexts.includes('webgl2'))
  assert.equal(surface.attributes['aria-hidden'], 'true')
  assert.deepEqual(surface.placement, ['shared', 'CANVAS', 'layer'], 'drawn below the node layer')
  assert.deepEqual(stage.children, [shared, layer], 'its canvas is removed when it is destroyed')
})
