import { edgeSeed, pulseAt, pulseTint } from './edge-motion.js'
import { BASE, CHILD_KINDS, TITLED_KINDS, dotSize, computeGeometry, position2D, childOffset, detailFromZoom, isVisible, visibleAncestor, shellForce, seedNumber } from './layout.js'

const STORAGE_KEY = 'context-layout-v1'
const MIN_ZOOM = .12
const MAX_ZOOM = 2.4

export function clamp(value, min, max) { return Math.max(min, Math.min(max, value)) }
export function screenToWorld(point, camera) { return { x: (point.x - camera.x) / camera.zoom, y: (point.y - camera.y) / camera.zoom } }
export function zoomAt(camera, point, zoom) {
  const nextZoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM)
  const world = screenToWorld(point, camera)
  return { x: point.x - world.x * nextZoom, y: point.y - world.y * nextZoom, zoom: nextZoom }
}

// DOM hit boxes can overlap when the whole graph fits on a phone. Resolve the
// closest visible dot, so stacking order never decides which note opens.
export function nearestNodeAt(nodes, camera, point, maxDistance = 24) {
  let nearest = null
  let distance = maxDistance
  for (const node of nodes) {
    if (node.hidden) continue
    const candidate = Math.hypot(node.x * camera.zoom + camera.x - point.x, node.y * camera.zoom + camera.y - point.y)
    if (candidate < distance) { distance = candidate; nearest = node }
  }
  return nearest
}

function readSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
}
function kindVerb(node) { return node.kind === 'topic' ? 'Explore topic' : node.kind === 'post' ? 'Read note' : node.kind === 'self' ? 'Open the core' : node.kind === 'sealed' ? 'Private region' : node.kind === 'doc' ? 'Open document' : node.kind === 'focus' ? 'Open focus topic' : 'Open' }

export class KnowledgeGraph {
  constructor({ stage, canvas, layer, nodes, edges, regions = [], onSelect, onViewChange, onBackgroundClick, onRegionSelect }) {
    this.stage = stage
    this.canvas = canvas
    this.layer = layer
    this.context = canvas.getContext('2d')
    this.onSelect = onSelect
    this.onBackgroundClick = onBackgroundClick
    this.onRegionSelect = onRegionSelect
    this.onViewChange = onViewChange
    this.regions = regions
    this.nodes = nodes.map((node) => ({ ...node, vx: 0, vy: 0, fixed: false, hidden: false }))
    this.nodeMap = new Map(this.nodes.map((node) => [node.id, node]))
    this.geometry = computeGeometry(this.nodes, regions)
    this.anchors = this.geometry.anchors
    this.children = new Map()
    for (const node of this.nodes) if (node.parent && this.nodeMap.has(node.parent)) { if (!this.children.has(node.parent)) this.children.set(node.parent, []); this.children.get(node.parent).push(node) }
    // An undirected visual connection is drawn once, while article backlinks retain direction.
    const seen = new Map()
    for (const edge of edges) {
      if (!this.nodeMap.has(edge.source) || !this.nodeMap.has(edge.target) || edge.source === edge.target) continue
      const key = [edge.source, edge.target].sort().join('|')
      if (!seen.has(key) || edge.kind === 'link') seen.set(key, { ...edge, a: this.nodeMap.get(edge.source), b: this.nodeMap.get(edge.target) })
    }
    this.edges = [...seen.values()].map((edge) => ({ ...edge, pulseSeed: edgeSeed([edge.source, edge.target].sort().join('|')) }))
    this.neighbors = new Map(this.nodes.map((node) => [node.id, new Set()]))
    this.edges.forEach(({ source, target, kind }) => { if (kind === 'contains') return; this.neighbors.get(source).add(target); this.neighbors.get(target).add(source) })
    // The more links there are, the quieter each one is drawn.
    this.edgeDensity = clamp(Math.sqrt(900 / Math.max(this.edges.length, 1)), .4, 1)
    this.camera = { x: 0, y: 0, zoom: 1 }
    this.selected = null
    this.highlighted = null
    this.hovered = null
    this.expanded = new Set()
    this.pointers = new Map()
    this.gesture = null
    this.animation = null
    this.alpha = 0
    this.destroyed = false
    this.frame = null
    this.listeners = []
    this.visible = document.visibilityState !== 'hidden'
    this.motionQuery = matchMedia('(prefers-reduced-motion: reduce)')
    this.motionReduced = this.motionQuery.matches
    this.elements = new Map()
    this.createNodes()
    this.resetPositions(true)
    this.updateVisibility()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(stage)
    this.bindEvents()
    this.resize()
    // Calculate the initial layout before the first frame, then gently settle it in view.
    this.alpha = 1
    for (let i = 0; i < 160; i++) this.simulate()
    this.fit(false)
    this.alpha = this.motionReduced ? 0 : .08
    this.requestDraw()
  }

  listen(target, type, callback, options) {
    target.addEventListener(type, callback, options)
    this.listeners.push(() => target.removeEventListener(type, callback, options))
  }

  createNodes() {
    this.layer.replaceChildren()
    for (const node of this.nodes) {
      const button = document.createElement('button')
      button.className = `graph-node node-${node.kind} layer-${node.layer ?? 3}`
      button.type = 'button'
      button.dataset.node = node.id
      button.setAttribute('aria-label', node.aria || `${kindVerb(node)}: ${node.label}`)
      button.setAttribute('aria-pressed', 'false')
      button.title = node.tip || `${node.label} · Drag to move, click to open`
      button.style.setProperty('--node-color', node.color)
      button.style.setProperty('--dot-size', `${dotSize(node)}px`)
      const dot = document.createElement('span')
      dot.className = 'node-dot'
      const label = document.createElement('span')
      label.className = 'node-label'
      label.textContent = node.short || node.label
      button.append(dot, label)
      const childCount = this.children.get(node.id)?.length || 0
      if (childCount) {
        const badge = document.createElement('span')
        badge.className = 'node-badge'
        badge.textContent = String(childCount)
        badge.setAttribute('aria-hidden', 'true')
        button.append(badge)
        node.badgeElement = badge
      }
      this.listen(button, 'click', (event) => {
        // Pointer selection is handled at pointerup to distinguish a click from a drag.
        if (event.detail === 0) this.onSelect(node.id)
      })
      this.listen(button, 'mouseenter', () => { this.hovered = node.id; this.updateVisibility(); this.requestDraw() })
      this.listen(button, 'mouseleave', () => { this.hovered = null; this.updateVisibility(); this.requestDraw() })
      this.listen(button, 'focus', () => { this.hovered = node.id; this.updateVisibility(); this.requestDraw() })
      this.listen(button, 'blur', (event) => {
        // Focus moving to another node (a revealed section, say) must not hide it first.
        if (event.relatedTarget?.closest?.('.graph-node')) return
        this.hovered = null; this.updateVisibility(); this.requestDraw()
      })
      this.listen(button, 'keydown', (event) => {
        if (!event.altKey || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
        event.preventDefault()
        const offset = event.shiftKey ? 30 : 10
        const dx = event.key === 'ArrowRight' ? offset : event.key === 'ArrowLeft' ? -offset : 0
        const dy = event.key === 'ArrowDown' ? offset : event.key === 'ArrowUp' ? -offset : 0
        this.shiftDescendants(node, dx, dy)
        node.x += dx
        node.y += dy
        node.vx = node.vy = 0
        node.fixed = true
        this.savePositions()
        this.requestDraw()
      })
      node.labelElement = label
      this.elements.set(node.id, button)
      this.layer.append(button)
    }
  }

  resetPositions(restore = false) {
    for (const node of this.nodes) {
      const anchor = this.anchors.get(node.id)
      if (!anchor) { node.x = node.y = 0; continue }
      const point = position2D(anchor)
      if (anchor.child) {
        const parent = this.nodeMap.get(anchor.parent)
        const siblings = this.children.get(node.parent) || []
        const offset = childOffset(node, siblings.indexOf(node), siblings.length)
        node.x = (parent?.x ?? point.x) + offset.dx
        node.y = (parent?.y ?? point.y) + offset.dy
      } else {
        const jitter = (seedNumber(node.id) - .5) * (node.kind === 'post' ? 26 : 10)
        node.x = point.x + jitter
        node.y = point.y + jitter * .6
      }
      node.anchorX = point.x
      node.anchorY = point.y
    }
    const saved = restore ? readSaved() : {}
    for (const node of this.nodes) {
      node.vx = node.vy = 0
      const point = saved[node.id]
      if (point && Number.isFinite(point.x) && Number.isFinite(point.y) && Math.abs(point.x) < 20000 && Math.abs(point.y) < 20000) {
        node.x = point.x; node.y = point.y; node.fixed = Boolean(point.fixed)
      } else node.fixed = false
    }
  }

  resize() {
    if (this.destroyed) return
    const bounds = this.stage.getBoundingClientRect()
    const previous = { width: this.width, height: this.height }
    this.width = bounds.width
    this.height = bounds.height
    const ratio = Math.min(devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(this.width * ratio)
    this.canvas.height = Math.round(this.height * ratio)
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0)
    if (previous.width && previous.height) {
      this.camera.x += (this.width - previous.width) / 2
      this.camera.y += (this.height - previous.height) / 2
    }
    for (const node of this.nodes) {
      node.labelWidth = node.labelElement.offsetWidth
      node.labelHeight = node.labelElement.offsetHeight
    }
    this.requestDraw()
  }

  point(event) {
    const rect = this.stage.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  bindEvents() {
    this.listen(this.stage, 'pointerdown', (event) => {
      if (event.button !== 0 && event.pointerType !== 'touch') return
      event.preventDefault()
      if (this.pointers.size >= 2) return
      this.animation = null
      const point = this.point(event)
      this.pointers.set(event.pointerId, point)
      this.stage.setPointerCapture(event.pointerId)
      if (this.pointers.size === 2) {
        if (this.gesture?.node) { this.gesture.node.fixed = true; this.gesture.node.dragging = false }
        const [a, b] = [...this.pointers.values()]
        const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        this.gesture = { type: 'pinch', distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.camera.zoom, world: screenToWorld(middle, this.camera) }
        return
      }
      // A region label never blocks the map: dragging from it pans, a click opens the region.
      const node = nearestNodeAt(this.nodes, this.camera, point, event.pointerType === 'touch' ? 26 : 23)
      this.gesture = { type: node ? 'node' : 'pan', node, start: point, current: point, camera: { ...this.camera }, moved: false }
      if (node) { node.dragging = true; node.vx = node.vy = 0; this.gesture.offset = { x: node.x - screenToWorld(point, this.camera).x, y: node.y - screenToWorld(point, this.camera).y } }
      this.stage.classList.add('is-dragging')
    })
    this.listen(this.stage, 'pointermove', (event) => {
      if (!this.pointers.has(event.pointerId)) return
      const point = this.point(event)
      this.pointers.set(event.pointerId, point)
      const gesture = this.gesture
      if (!gesture) return
      if (gesture.type === 'pinch') {
        if (this.pointers.size < 2) return
        const [a, b] = [...this.pointers.values()]
        const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        const zoom = clamp(gesture.zoom * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(gesture.distance, 1), MIN_ZOOM, MAX_ZOOM)
        this.camera = { x: middle.x - gesture.world.x * zoom, y: middle.y - gesture.world.y * zoom, zoom }
        this.updateVisibility()
      } else {
        const dx = point.x - gesture.start.x, dy = point.y - gesture.start.y
        if (Math.hypot(dx, dy) > 4) gesture.moved = true
        if (gesture.type === 'node' && gesture.moved) {
          const world = screenToWorld(point, this.camera)
          const nextX = world.x + gesture.offset.x, nextY = world.y + gesture.offset.y
          this.shiftDescendants(gesture.node, nextX - gesture.node.x, nextY - gesture.node.y)
          gesture.node.x = nextX
          gesture.node.y = nextY
          gesture.node.fixed = true
          this.alpha = this.motionReduced ? 0 : Math.max(this.alpha, .08)
        } else if (gesture.type === 'pan') {
          this.camera.x = gesture.camera.x + dx
          this.camera.y = gesture.camera.y + dy
        }
      }
      this.requestDraw()
    })
    const end = (event) => {
      if (!this.pointers.has(event.pointerId)) return
      const gesture = this.gesture
      this.pointers.delete(event.pointerId)
      if (this.stage.hasPointerCapture(event.pointerId)) this.stage.releasePointerCapture(event.pointerId)
      if (gesture?.node) {
        gesture.node.dragging = false
        if (gesture.moved) this.savePositions()
        else if (event.type === 'pointerup') this.onSelect(gesture.node.id)
      }
      if (gesture?.type === 'pan' && !gesture.moved && event.type === 'pointerup') this.onBackgroundClick?.()
      if (this.pointers.size === 1) {
        const point = [...this.pointers.values()][0]
        this.gesture = { type: 'pan', start: point, camera: { ...this.camera }, moved: true }
      } else {
        this.gesture = null
        this.stage.classList.remove('is-dragging')
      }
      this.requestDraw()
    }
    this.listen(this.stage, 'pointerup', end)
    this.listen(this.stage, 'pointercancel', end)
    this.listen(this.stage, 'lostpointercapture', end)
    this.listen(window, 'blur', () => { this.cancelGesture(); this.requestDraw() })
    this.listen(document, 'visibilitychange', () => {
      this.visible = document.visibilityState !== 'hidden'
      if (!this.visible) {
        this.cancelGesture()
        if (this.frame) globalThis.cancelAnimationFrame?.(this.frame)
        this.frame = null
      } else this.requestDraw()
    })
    const motionChange = () => {
      this.motionReduced = this.motionQuery.matches
      if (this.motionReduced) {
        if (this.animation) this.camera = { ...this.animation.target }
        this.animation = null
        this.alpha = 0
      }
      this.requestDraw()
    }
    if (this.motionQuery.addEventListener) this.listen(this.motionQuery, 'change', motionChange)
    else if (this.motionQuery.addListener) {
      this.motionQuery.addListener(motionChange)
      this.listeners.push(() => this.motionQuery.removeListener(motionChange))
    }
    this.listen(this.stage, 'wheel', (event) => {
      event.preventDefault()
      this.animation = null
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.height : 1)
      const factor = Math.exp(-delta * (event.ctrlKey ? .008 : .0015))
      this.camera = zoomAt(this.camera, this.point(event), this.camera.zoom * factor)
      this.updateVisibility()
      this.requestDraw()
    }, { passive: false })
    this.listen(this.stage, 'dblclick', (event) => {
      if (event.target.closest('[data-node]')) return
      this.onBackgroundClick?.()
      this.fit()
    })
  }

  cancelGesture() {
    if (this.gesture?.node) { this.gesture.node.dragging = false; this.savePositions() }
    const pointers = [...this.pointers.keys()]
    this.pointers.clear()
    this.gesture = null
    for (const id of pointers) if (this.stage.hasPointerCapture?.(id)) this.stage.releasePointerCapture?.(id)
    this.stage.classList.remove('is-dragging')
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    if (this.frame) globalThis.cancelAnimationFrame?.(this.frame)
    this.frame = null
    this.resizeObserver.disconnect()
    for (const remove of this.listeners) remove()
    this.listeners.length = 0
    this.cancelGesture()
    this.savePositions()
    this.animation = null
    this.alpha = 0
    this.context.clearRect(0, 0, this.width, this.height)
    this.layer.replaceChildren()
    this.elements.clear()
    delete this.stage.dataset.ready
  }

  // Level of detail: documents are always drawn; their sections, entries and
  // fragments appear for the selected/hovered/expanded document, for search
  // matches, or once the view is zoomed in far enough.
  updateVisibility() {
    const detail = detailFromZoom(this.camera.zoom)
    const expanded = new Set(this.expanded)
    for (const id of [this.selected, this.hovered]) {
      const node = this.nodeMap.get(id)
      if (!node) continue
      expanded.add(id)
      if (CHILD_KINDS.has(node.kind) && node.parent) expanded.add(node.parent)
    }
    // A document unfolds all the way down: its sections and what they hold.
    for (const node of this.nodes) if (node.kind === 'section' && expanded.has(node.parent)) expanded.add(node.id)
    let changed = false
    for (const node of this.nodes) {
      const hidden = !isVisible(node, { detail, selectedId: this.selected, hoveredId: this.hovered, expanded, highlighted: this.highlighted })
      if (hidden !== node.hidden) {
        changed = true
        node.hidden = hidden
        const element = this.elements.get(node.id)
        element.hidden = hidden
        element.setAttribute('aria-hidden', String(hidden))
        if (!hidden) {
          // A revealed child starts beside its parent and relaxes outward.
          const parent = this.nodeMap.get(node.parent)
          // Placed beside the parent on first reveal, and again if the parent has since moved away.
          if (parent && !node.fixed && (!node.placed || Math.hypot(node.x - parent.x, node.y - parent.y) > 3 * BASE.childOrbit)) {
            const siblings = this.children.get(node.parent) || []
            const offset = childOffset(node, siblings.indexOf(node), siblings.length)
            node.x = parent.x + offset.dx
            node.y = parent.y + offset.dy
            node.placed = true
          }
        }
      }
    }
    this.visibleIds = new Set(this.nodes.filter((node) => !node.hidden).map((node) => node.id))
    for (const node of this.nodes) if (node.badgeElement) node.badgeElement.hidden = (this.children.get(node.id) || []).every((child) => !child.hidden) ? false : true
    if (changed) this.alpha = Math.max(this.alpha, this.motionReduced ? 0 : .35)
    return changed
  }

  setExpanded(ids) {
    this.expanded = new Set(ids || [])
    this.updateVisibility()
    this.requestDraw()
  }

  // What a document contains travels with it, shown or not.
  shiftDescendants(node, dx, dy, depth = 0) {
    if (depth > 6) return
    for (const child of this.children.get(node.id) || []) {
      if (!child.fixed) { child.x += dx; child.y += dy }
      this.shiftDescendants(child, dx, dy, depth + 1)
    }
  }

  simulate() {
    const alpha = this.alpha
    const movable = (node) => !node.fixed && !node.dragging && !node.hidden
    const active = this.nodes.filter((node) => !node.hidden)
    // Repulsion is local. A long-range push would inflate the rings as the
    // graph grows; nodes only need room from their neighbours.
    const RANGE = 240, RANGE2 = RANGE * RANGE
    const titled = (node) => TITLED_KINDS.has(node.kind)
    for (let i = 0; i < active.length; i++) {
      const a = active[i]
      for (let j = i + 1; j < active.length; j++) {
        const b = active[j]
        let dx = b.x - a.x, dy = b.y - a.y
        if (Math.abs(dx) > RANGE || Math.abs(dy) > RANGE) continue
        if (Math.abs(dx) + Math.abs(dy) < .01) { dx = .1; dy = .1 }
        const distance2 = dx * dx + dy * dy
        if (distance2 > RANGE2) continue
        const force = Math.min(170 / Math.max(distance2, 100), 4) * alpha
        if (movable(a)) { a.vx -= dx * force; a.vy -= dy * force * .55 }
        if (movable(b)) { b.vx += dx * force; b.vy += dy * force * .55 }
        if (titled(a) && titled(b)) {
          // Always-labelled nodes have a rectangular footprint: resolve both
          // node and text overlap. Other labels are culled at draw time.
          const width = 172, height = 70
          if (Math.abs(dx) < width && Math.abs(dy) < height) {
            const overlapX = width - Math.abs(dx), overlapY = height - Math.abs(dy)
            if (overlapX < overlapY * 2.1) {
              const push = Math.sign(dx) * overlapX * .08 * alpha
              if (movable(a)) a.vx -= push
              if (movable(b)) b.vx += push
            } else {
              const push = Math.sign(dy) * overlapY * .12 * alpha
              if (movable(a)) a.vy -= push
              if (movable(b)) b.vy += push
            }
          }
        } else {
          const gap = titled(a) || titled(b) || a.kind === 'doc' || b.kind === 'doc' ? 46 : 34
          if (distance2 < gap * gap) {
            const distance = Math.sqrt(distance2) || 1
            const push = (gap - distance) * .18 * alpha
            if (movable(a)) { a.vx -= dx / distance * push; a.vy -= dy / distance * push }
            if (movable(b)) { b.vx += dx / distance * push; b.vy += dy / distance * push }
          }
        }
      }
    }
    for (const edge of this.edges) {
      const { a, b } = edge
      if (a.hidden || b.hidden) continue
      const dx = b.x - a.x, dy = b.y - a.y
      const distance = Math.max(Math.hypot(dx, dy), 1)
      const desired = edge.kind === 'contains' ? BASE.childOrbit + 10 : edge.kind === 'hierarchy' ? 150 : edge.kind === 'topic' ? 120 : edge.kind === 'link' ? 200 : 300
      // Links tug neighbours together inside a ring; they never drag a node
      // off its layer, because the shell force below is far stronger.
      const strength = edge.kind === 'contains' ? .012 : edge.kind === 'topic' || edge.kind === 'hierarchy' ? .003 : edge.kind === 'link' ? .0007 * this.edgeDensity : 0
      if (!strength) continue
      const force = clamp((distance - desired) * strength, -6, 6) * alpha
      if (movable(a)) this.pull(a, dx / distance * force, dy / distance * force, edge.kind)
      if (movable(b)) this.pull(b, -dx / distance * force, -dy / distance * force, edge.kind)
    }
    for (const node of active) {
      if (!movable(node)) continue
      const anchor = this.anchors.get(node.id)
      if (anchor?.child) {
        const parent = this.nodeMap.get(anchor.parent)
        if (parent) { node.vx += (parent.x - node.x) * .004 * alpha; node.vy += (parent.y - node.y) * .004 * alpha }
      } else {
        const { fx, fy } = shellForce(node, anchor, alpha)
        node.vx += fx; node.vy += fy
        const pull = anchor?.core ? .02 : node.kind === 'topic' || node.kind === 'doc' || node.kind === 'sealed' ? .008 : .004
        node.vx += ((node.anchorX ?? 0) - node.x) * pull * alpha
        node.vy += ((node.anchorY ?? 0) - node.y) * pull * alpha
      }
      node.vx *= .67; node.vy *= .67
      node.x += clamp(node.vx, -18, 18)
      node.y += clamp(node.vy, -18, 18)
    }
    this.alpha *= .976
    if (this.alpha < .003) { this.alpha = 0; this.savePositions() }
  }

  // A link slides a node along its ring; most of the pull across the ring is
  // dropped, so links cluster neighbours without thickening or collapsing a layer.
  pull(node, fx, fy, kind) {
    const anchor = this.anchors.get(node.id)
    if (kind === 'contains' || !anchor || anchor.child || anchor.core) { node.vx += fx; node.vy += fy; return }
    const x = node.x, y = node.y / BASE.flatten
    const r = Math.hypot(x, y) || 1
    const ux = x / r, uy = y / r
    const fyFlat = fy / BASE.flatten
    const radial = fx * ux + fyFlat * uy
    node.vx += fx - ux * radial * .6
    node.vy += (fyFlat - uy * radial * .6) * BASE.flatten
  }

  setSelection(id) {
    this.selected = id
    this.updateVisibility()
    this.updateNodeStates()
    this.requestDraw()
  }
  highlight(ids) {
    this.highlighted = ids
    this.updateVisibility()
    this.updateNodeStates()
    this.requestDraw()
  }
  updateNodeStates() {
    for (const node of this.nodes) {
      const element = this.elements.get(node.id)
      const selected = node.id === this.selected
      const connected = this.selected && (this.neighbors.get(this.selected)?.has(node.id) || node.parent === this.selected || this.nodeMap.get(node.parent)?.parent === this.selected || this.nodeMap.get(this.selected)?.parent === node.id)
      // What the selected document contains is never dimmed, whatever the search says.
      const family = this.selected && (node.parent === this.selected || this.nodeMap.get(node.parent)?.parent === this.selected)
      const dimmed = !selected && !family && (this.highlighted ? !this.highlighted.has(node.id) : this.selected && !connected)
      element.classList.toggle('is-selected', selected)
      element.classList.toggle('is-connected', Boolean(connected))
      element.classList.toggle('is-dimmed', Boolean(dimmed))
      element.setAttribute('aria-pressed', String(selected))
    }
  }

  zoom(direction) {
    this.animation = null
    this.camera = zoomAt(this.camera, { x: this.width / 2, y: this.height / 2 }, this.camera.zoom * (direction > 0 ? 1.2 : 1 / 1.2))
    this.updateVisibility()
    this.requestDraw()
  }

  fit(animate = true, ids = null) {
    const nodes = (ids ? this.nodes.filter((node) => ids.has(node.id)) : this.nodes).filter((node) => !node.hidden)
    if (!nodes.length || !this.width) return
    const xs = nodes.map((node) => node.x), ys = nodes.map((node) => node.y)
    const minX = Math.min(...xs) - 100, maxX = Math.max(...xs) + 100
    const minY = Math.min(...ys) - 80, maxY = Math.max(...ys) + 80
    const zoom = clamp(Math.min((this.width - 80) / (maxX - minX), (this.height - 160) / (maxY - minY)), MIN_ZOOM, 1.15)
    this.moveCamera({ x: this.width / 2 - (minX + maxX) / 2 * zoom, y: this.height / 2 - (minY + maxY) / 2 * zoom, zoom }, animate)
  }

  focus(id, panelWidth = 0) {
    const node = this.nodeMap.get(id)
    if (!node) return
    if (node.hidden) { this.selected = id; this.updateVisibility() }
    const isMobile = this.width <= 800
    const availableWidth = this.width - (isMobile ? 0 : panelWidth)
    const zoom = clamp(Math.max(this.camera.zoom, .8), .8, 1.3)
    this.moveCamera({ x: availableWidth / 2 - node.x * zoom, y: (isMobile ? this.height * .13 : this.height * .48) - node.y * zoom, zoom }, true)
  }

  moveCamera(camera, animate) {
    if (!animate || this.motionReduced) { this.camera = camera; this.animation = null }
    else this.animation = { start: { ...this.camera }, target: camera, time: performance.now() }
    this.updateVisibility()
    this.requestDraw()
  }

  arrange() {
    this.resetPositions()
    for (const node of this.nodes) node.placed = false
    this.updateVisibility()
    this.alpha = 1
    for (let i = 0; i < 160; i++) this.simulate()
    this.alpha = this.motionReduced ? 0 : .2
    this.savePositions()
    this.fit()
    this.requestDraw()
  }

  savePositions() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(this.nodes.filter((node) => node.fixed || !CHILD_KINDS.has(node.kind)).map((node) => [node.id, { x: Math.round(node.x * 100) / 100, y: Math.round(node.y * 100) / 100, fixed: node.fixed }])))) } catch { /* Layout still works when storage is unavailable. */ }
  }

  requestDraw() {
    if (this.frame || this.destroyed || !this.visible || this.paused) return
    this.frame = requestAnimationFrame((time) => {
      this.frame = null
      if (this.destroyed || !this.visible) return
      if (this.alpha > 0) this.simulate()
      if (this.animation) {
        const progress = clamp((time - this.animation.time) / 360, 0, 1)
        const ease = 1 - (1 - progress) ** 3
        for (const key of ['x', 'y', 'zoom']) this.camera[key] = this.animation.start[key] + (this.animation.target[key] - this.animation.start[key]) * ease
        if (progress === 1) this.animation = null
        this.updateVisibility()
      }
      this.draw(time)
      if (this.alpha || this.animation || (!this.motionReduced && this.edges.length)) this.requestDraw()
    })
  }

  setPaused(paused) {
    this.paused = paused
    if (paused && this.frame) { globalThis.cancelAnimationFrame?.(this.frame); this.frame = null }
    if (!paused) this.requestDraw()
  }

  drawGuides(dark) {
    const { context: ctx, camera } = this
    // Test doubles implement only part of the canvas API; the guides are a
    // quiet reading aid: one circle where each layer ends.
    if (typeof ctx.ellipse !== 'function') return
    const { outer } = this.geometry
    ctx.setLineDash([])
    ctx.lineWidth = 1
    ctx.globalAlpha = 1
    ctx.strokeStyle = dark ? 'rgba(255,255,255,.075)' : 'rgba(17,17,17,.08)'
    for (const radius of [BASE.coreExtent - BASE.layerGap / 2, outer[1] + BASE.layerGap / 2, outer[2] + BASE.layerGap / 2, outer[3] + 16]) {
      ctx.beginPath()
      ctx.ellipse(camera.x, camera.y, radius * camera.zoom, radius * camera.zoom * BASE.flatten, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  draw(time = performance.now()) {
    const { context: ctx, camera } = this
    ctx.clearRect(0, 0, this.width, this.height)
    const dark = document.documentElement.dataset.theme === 'dark'
    this.drawGuides(dark)
    const focus = this.hovered || this.selected
    const visible = this.visibleIds || new Set(this.nodes.map((node) => node.id))
    const drawn = new Set()
    for (const edge of this.edges) {
      // Hidden children route their links through the nearest visible ancestor.
      const a = edge.a.hidden ? visibleAncestor(edge.a, visible, this.nodeMap) : edge.a
      const b = edge.b.hidden ? visibleAncestor(edge.b, visible, this.nodeMap) : edge.b
      if (!a || !b || a === b) continue
      const aggregated = a !== edge.a || b !== edge.b
      if (aggregated) {
        const key = [a.id, b.id].sort().join('|')
        if (drawn.has(key)) continue
        drawn.add(key)
      }
      const connected = focus && (edge.source === focus || edge.target === focus || a.id === focus || b.id === focus)
      const filtered = this.highlighted && (!this.highlighted.has(edge.source) || !this.highlighted.has(edge.target)) && !(this.highlighted.has(a.id) && this.highlighted.has(b.id))
      const faded = connected ? false : filtered || Boolean(focus)
      const contains = edge.kind === 'contains'
      ctx.strokeStyle = connected ? (dark ? '#87b4ff' : '#1f6fe5') : edge.mutual ? (dark ? '#c6b27a' : '#8a6d2f') : (dark ? '#a2aab6' : '#8291a6')
      // Long chords across the disc are drawn fainter than links between neighbours.
      const reach = clamp(240 / Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1), .3, 1)
      ctx.globalAlpha = faded ? .045 : connected ? .8 : contains ? .28 : edge.kind === 'core' ? .4 : (edge.kind === 'material' || edge.kind === 'digest' ? .16 : edge.kind === 'topic' ? .2 : edge.mutual ? .55 : .33) * this.edgeDensity * reach
      ctx.lineWidth = connected ? 1.3 : edge.mutual ? .9 : edge.kind === 'link' ? .6 : .5
      ctx.setLineDash(edge.kind === 'hierarchy' ? [4, 5] : contains ? [1.5, 3] : [])
      ctx.beginPath()
      ctx.moveTo(a.x * camera.zoom + camera.x, a.y * camera.zoom + camera.y)
      ctx.lineTo(b.x * camera.zoom + camera.x, b.y * camera.zoom + camera.y)
      ctx.stroke()
      if (!this.motionReduced && !contains && !aggregated) this.drawPulse(edge, time, { dark, connected, faded })
    }
    ctx.globalAlpha = 1
    ctx.setLineDash([])
    const nodeScale = clamp(camera.zoom, .84, 1.35)
    const occupied = []
    const prioritized = this.nodes.filter((node) => !node.hidden).sort((a, b) => {
      const priority = (node) => node.id === this.hovered ? 6 : node.id === this.selected ? 5 : node.kind === 'self' ? 4.5 : this.neighbors.get(this.selected)?.has(node.id) ? 4 : node.kind === 'focus' ? 3.5 : node.kind === 'topic' || node.kind === 'sealed' ? 3 : node.kind === 'doc' ? 2.5 : 1 + Math.min(node.degree || 0, 30) / 60
      return priority(b) - priority(a)
    })
    for (const node of prioritized) {
      const x = node.x * camera.zoom + camera.x, y = node.y * camera.zoom + camera.y
      const element = this.elements.get(node.id)
      const offscreen = x < -180 || y < -100 || x > this.width + 180 || y > this.height + 100
      element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${nodeScale})`
      element.style.visibility = offscreen ? 'hidden' : 'visible'
      element.classList.toggle('is-pinned', node.fixed)
      const width = (node.labelWidth || 168) * nodeScale
      const height = (node.labelHeight || 35) * nodeScale
      const above = TITLED_KINDS.has(node.kind) || node.kind === 'doc'
      const labelTop = above ? y - 15 * nodeScale - height : y + 12 * nodeScale
      const rect = { left: x - width / 2 - 5, right: x + width / 2 + 5, top: labelTop - 4, bottom: labelTop + height + 4 }
      const forced = node.id === this.hovered || node.id === this.selected
      // Like an Obsidian graph: hubs are named at any zoom, the rest fade in when close.
      const near = this.selected && this.neighbors.get(this.selected)?.has(node.id)
      const eligible = forced || near || TITLED_KINDS.has(node.kind) || (node.kind === 'doc' ? camera.zoom > .6 : CHILD_KINDS.has(node.kind) ? camera.zoom > .8 : camera.zoom > .95 - Math.min(node.degree || 0, 20) / 50)
      const collides = occupied.some((other) => rect.left < other.right && rect.right > other.left && rect.top < other.bottom && rect.bottom > other.top)
      const visibleLabel = !offscreen && eligible && (forced || !collides)
      element.classList.toggle('is-label-hidden', !visibleLabel)
      if (visibleLabel) occupied.push(rect)
    }
    this.stage.style.setProperty('--grid-size', `${Math.max(14, 28 * camera.zoom)}px`)
    this.stage.style.setProperty('--grid-x', `${camera.x}px`)
    this.stage.style.setProperty('--grid-y', `${camera.y}px`)
    this.stage.dataset.ready = 'true'
    this.onViewChange?.(Math.round(camera.zoom * 100))
  }

  drawPulse(edge, time, { dark, connected, faded }) {
    const { context: ctx, camera } = this
    // A few DOM test doubles do not implement gradients; static edges remain
    // fully testable there while real canvas renderers use the complete pulse.
    if (typeof ctx.createLinearGradient !== 'function') return
    const dx = edge.b.x - edge.a.x, dy = edge.b.y - edge.a.y
    const distance = Math.hypot(dx, dy)
    if (distance < 1) return
    const directional = edge.kind === 'link' && !edge.mutual
    const pulse = pulseAt(time, distance, edge.pulseSeed, directional)
    if (pulse.opacity <= .001) return
    const tail = clamp(pulse.t - pulse.direction * pulse.length / distance, 0, 1)
    const x = (edge.a.x + dx * pulse.t) * camera.zoom + camera.x
    const y = (edge.a.y + dy * pulse.t) * camera.zoom + camera.y
    const tailX = (edge.a.x + dx * tail) * camera.zoom + camera.x
    const tailY = (edge.a.y + dy * tail) * camera.zoom + camera.y
    if (Math.hypot(x - tailX, y - tailY) < .05) return
    const tint = pulseTint(edge.a.color, edge.b.color, dark)
    const gradient = ctx.createLinearGradient(tailX, tailY, x, y)
    gradient.addColorStop(0, `rgba(${tint},0)`)
    gradient.addColorStop(.62, `rgba(${tint},.35)`)
    gradient.addColorStop(1, `rgba(${tint},1)`)
    const opacity = pulse.opacity * (faded ? .065 : connected ? .85 : (dark ? .46 : .36) * this.edgeDensity)
    ctx.setLineDash([])
    ctx.lineCap = 'round'
    ctx.strokeStyle = gradient
    ctx.beginPath()
    ctx.moveTo(tailX, tailY)
    ctx.lineTo(x, y)
    ctx.globalAlpha = opacity * .16
    ctx.lineWidth = connected ? 4 : 3
    ctx.stroke()
    ctx.globalAlpha = opacity
    ctx.lineWidth = connected ? 1.5 : 1.1
    ctx.stroke()
    ctx.fillStyle = `rgb(${tint})`
    ctx.beginPath()
    ctx.arc(x, y, connected ? 1.15 : .85, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineCap = 'butt'
  }
}
