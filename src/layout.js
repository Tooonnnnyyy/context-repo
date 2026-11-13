// Shared geometry for the layered graph: layers (distance from the core) are
// concentric bands, regions (folders, vault, public notes) are spans inside
// each band, grades are documents that unfold into sections, entries and
// fragments. Both renderers read the same geometry: the 2D disc is the 3D
// shells unfolded.
//
// The disc is filled evenly, the way an Obsidian graph settles: every band is
// as thick as its load needs and is populated all the way round, so no side of
// the map is empty and none is crowded.

export const BASE = {
  spacing: 46,                     // world units an anchor node gets in each direction
  coreRadius: 78,                  // L0 documents orbit the self node here
  focusRadius: 150,                // focus topics ring the core
  satelliteRadius: 222,            // core-region documents that are not L0
  coreExtent: 272,                 // where the first layer begins
  layerGap: 30,                    // clear space between two layers
  minThickness: 92,                // a layer never gets thinner than this
  regionGap: .03,                  // radians kept clear between regions in a layer
  shellScale: 1.12,                // 3D shells are slightly roomier than rings
  childOrbit: 52,                  // expanded children bloom around their parent
  flatten: 1,                      // the 2D map is a true disc
  maxLatitude: 1.05,               // 3D: keep the poles sparse (about 60°)
}
export const GOLDEN_ANGLE = 2.399963229728653
export const ANCHOR_KINDS = new Set(['self', 'focus', 'doc', 'note', 'post', 'topic', 'sealed'])
export const CHILD_KINDS = new Set(['section', 'entry', 'fragment'])
export const TITLED_KINDS = new Set(['self', 'focus', 'topic', 'sealed'])
const DOT = { self: 22, topic: 13, sealed: 12, focus: 11, doc: 10, post: 6, note: 5.5, section: 5, entry: 4.5, fragment: 4.5 }
const SPHERE = { self: 24, topic: 12, sealed: 11, focus: 10, doc: 9, post: 5.5, note: 5, section: 4.5, entry: 4, fragment: 4 }
// Well-linked notes are drawn larger, so hubs stand out without a label.
function weight(node) { return node.kind === 'post' || node.kind === 'note' || node.kind === 'doc' ? 1 + Math.min(node.degree || 0, 24) / 24 * .9 : 1 }
export function dotSize(node) { return Math.round((DOT[node.kind] || 6) * weight(node) * 10) / 10 }
export function sphereScale(node) { return (SPHERE[node.kind] || 5.5) * weight(node) }

export function seedNumber(text) {
  let value = 2166136261
  for (const letter of String(text)) value = Math.imul(value ^ letter.charCodeAt(0), 16777619)
  return (value >>> 0) / 4294967296
}
export function clamp(value, min, max) { return Math.max(min, Math.min(max, value)) }
const TAU = Math.PI * 2
const frac = (value) => value - Math.floor(value)
export function normalizeAngle(angle) { return ((angle % TAU) + TAU) % TAU }
export function angleInRange(angle, range) { return range.width >= TAU - 1e-6 || normalizeAngle(angle - range.start) <= normalizeAngle(range.end - range.start) + 1e-9 }

// Each layer is an annulus whose area matches its load, so density is the same
// everywhere and the map grows outward by the square root of what it holds.
export function ringRadii(nodes) {
  const counts = [0, 0, 0, 0]
  for (const node of nodes) if (ANCHOR_KINDS.has(node.kind) && node.kind !== 'self' && node.region !== 'core') counts[clamp(node.layer ?? 3, 0, 3)]++
  const inner = [0], outer = [BASE.coreExtent - BASE.layerGap], ring = [0], band = [0]
  for (let layer = 1; layer <= 3; layer++) {
    inner[layer] = outer[layer - 1] + BASE.layerGap
    const area = Math.max(counts[layer], 1) * BASE.spacing * BASE.spacing
    outer[layer] = Math.round(Math.max(Math.sqrt(inner[layer] * inner[layer] + area / Math.PI), inner[layer] + BASE.minThickness))
    ring[layer] = (inner[layer] + outer[layer]) / 2
    band[layer] = (outer[layer] - inner[layer]) / 2
  }
  return { ring, band, inner, outer, shell: ring.map((radius) => Math.round(radius * BASE.shellScale)), counts }
}

// Split an angular range among keys in proportion to their load.
export function shareRange(range, entries, gap = 0, floor = .08) {
  const total = entries.reduce((sum, [, count]) => sum + count, 0) || 1
  const usable = range.width - gap * (range.width >= TAU - 1e-6 ? entries.length : Math.max(entries.length - 1, 0))
  const raw = entries.map(([, count]) => Math.max(count / total, Math.min(floor, 1 / entries.length)))
  const scale = raw.reduce((sum, value) => sum + value, 0)
  const result = new Map()
  let cursor = range.start
  entries.forEach(([key, count], index) => {
    const width = usable * raw[index] / scale
    result.set(key, { start: cursor, end: cursor + width, center: cursor + width / 2, width, count })
    cursor += width + gap
  })
  return result
}

// Geometry: every anchor node gets an angle, a radius inside its layer band
// and a spread (its place across the band, which becomes latitude in 3D).
// Children inherit their document's anchor and bloom around it when expanded.
export function computeGeometry(nodes, regions) {
  const radii = ringRadii(nodes)
  const anchors = new Map()
  const spans = new Map()
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const order = new Map(regions.map((region) => [region.id, region.order ?? 0]))
  const topics = new Map(nodes.filter((node) => node.kind === 'topic').map((node) => [node.id, node]))
  const rootTopic = (id) => { let node = topics.get(id); let guard = 0; while (node?.parent && topics.has(node.parent) && guard++ < 10) node = topics.get(node.parent); return node?.id || id }
  const circle = (count, radius, offset) => (index) => ({ angle: offset + index / Math.max(count, 1) * TAU, radius })

  // The core: self at the centre, L0 documents, then focus topics, then the
  // core-region documents that are not themselves L0 (the map, product memory).
  const core = nodes.filter((node) => node.region === 'core' && ANCHOR_KINDS.has(node.kind) && node.kind !== 'self')
  const coreRings = [core.filter((node) => node.kind === 'doc' && node.layer === 0), core.filter((node) => node.kind === 'focus'), core.filter((node) => node.kind !== 'focus' && node.layer > 0)]
  const coreRadii = [BASE.coreRadius, BASE.focusRadius, BASE.satelliteRadius]
  coreRings.forEach((group, level) => {
    const place = circle(group.length, coreRadii[level], -Math.PI / 2 + level * .45)
    group.sort((a, b) => a.id.localeCompare(b.id)).forEach((node, index) => anchors.set(node.id, { ...place(index), layer: 0, spread: (index + .5) / Math.max(group.length, 1), core: true }))
  })
  for (const node of nodes) if (node.kind === 'self') anchors.set(node.id, { angle: 0, radius: 0, layer: 0, spread: .5, core: true })

  const regionCounts = new Map()
  for (let layer = 1; layer <= 3; layer++) {
    const members = nodes.filter((node) => ANCHOR_KINDS.has(node.kind) && node.kind !== 'self' && node.region !== 'core' && clamp(node.layer ?? 3, 0, 3) === layer)
    if (!members.length) continue
    const byRegion = new Map()
    for (const node of members) { if (!byRegion.has(node.region)) byRegion.set(node.region, []); byRegion.get(node.region).push(node) }
    const regionIds = [...byRegion.keys()].sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99) || a.localeCompare(b))
    const full = { start: -Math.PI / 2, end: -Math.PI / 2 + TAU, width: TAU }
    const regionRanges = shareRange(full, regionIds.map((id) => [id, byRegion.get(id).length]), regionIds.length > 1 ? BASE.regionGap : 0)
    const lo = radii.inner[layer], hi = radii.outer[layer], pad = Math.min(16, (hi - lo) / 5)
    for (const regionId of regionIds) {
      const range = { ...regionRanges.get(regionId), id: regionId, layer, inner: lo, outer: hi }
      spans.set(`${regionId}|${layer}`, range)
      regionCounts.set(regionId, (regionCounts.get(regionId) || 0) + range.count)
      const group = byRegion.get(regionId)
      const keyOf = regionId === 'notes' ? (node) => node.kind === 'topic' ? rootTopic(node.id) : rootTopic(`topic:${node.tags?.[0] || ''}`) : (node) => node.group || ''
      const keys = [...new Set(group.map(keyOf))].sort((a, b) => String(topics.get(a)?.label || a).localeCompare(String(topics.get(b)?.label || b)))
      const groupRanges = shareRange(range, keys.map((key) => [key, group.filter((node) => keyOf(node) === key).length]), 0, .02)
      for (const key of keys) {
        const sub = groupRanges.get(key)
        const cell = group.filter((node) => keyOf(node) === key)
        // Topic hubs sit in the middle of their family, like a map of content.
        const hubs = cell.filter((node) => node.kind === 'topic').sort((a, b) => Number(Boolean(a.parent)) - Number(Boolean(b.parent)) || a.label.localeCompare(b.label))
        hubs.forEach((topic, index) => anchors.set(topic.id, { angle: sub.start + sub.width * (index + 1) / (hubs.length + 1), radius: (lo + hi) / 2 + (index % 2 ? 1 : -1) * Math.min(18, (hi - lo) / 6) * (index ? 1 : 0), layer, sector: range, spread: .5 + (index % 2 ? .12 : -.12) * (index ? 1 : 0) }))
        const row = cell.filter((node) => node.kind !== 'topic').sort((a, b) => (a.tags?.[0] || '').localeCompare(b.tags?.[0] || '') || (a.path || a.label || a.id).localeCompare(b.path || b.label || b.id))
        row.forEach((node, index) => {
          // A low-discrepancy fill of the (angle × band) cell: even density
          // however many nodes share the band.
          const spread = row.length === 1 ? .5 : frac((index + 1) * 0.6180339887)
          anchors.set(node.id, { angle: sub.start + sub.width * (index + .5) / row.length, radius: lo + pad + spread * (hi - lo - pad * 2), layer, sector: range, spread })
        })
      }
    }
  }
  for (const node of nodes) {
    if (!CHILD_KINDS.has(node.kind)) continue
    let parent = byId.get(node.parent)
    let guard = 0
    while (parent && CHILD_KINDS.has(parent.kind) && guard++ < 6) parent = byId.get(parent.parent)
    const base = anchors.get(parent?.id) || { angle: 0, radius: radii.ring[node.layer] || 0, layer: node.layer, spread: .5 }
    anchors.set(node.id, { ...base, parent: parent?.id, child: true })
  }
  return { anchors, spans, regionCounts, ...radii }
}

export function childOffset(node, index, count) {
  // Phyllotaxis around the parent: a handful of sections make a ring, dozens of
  // entries make a soft disc that the force layout then relaxes.
  const angle = index * GOLDEN_ANGLE + seedNumber(node.id) * .4
  const radius = count <= 8 ? BASE.childOrbit : BASE.childOrbit * .6 + 10 * Math.sqrt(index + 1)
  return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius, dz: Math.sin(angle * 1.7 + index) * radius * .6, angle, radius }
}

export function position2D(anchor) { return { x: Math.cos(anchor.angle) * anchor.radius, y: Math.sin(anchor.angle) * anchor.radius * BASE.flatten } }

// 3D: longitude is the 2D angle, latitude is the node's place across the band,
// so each layer reads as a shell around the core. The core stays a tight cluster.
export function position3D(node, anchor, geometry) {
  if (node.kind === 'self') return { x: 0, y: 0, z: 0 }
  const radius = anchor.core ? anchor.radius * 1.05 : geometry.shell[anchor.layer] + (seedNumber(`${node.id}:r`) - .5) * Math.min(geometry.band[anchor.layer], 60)
  const latitude = node.kind === 'topic' ? (anchor.spread - .5) * .7 : (anchor.spread - .5) * 2 * (anchor.core ? .9 : BASE.maxLatitude)
  const longitude = anchor.angle
  return { x: Math.cos(latitude) * Math.cos(longitude) * radius, y: Math.sin(latitude) * radius, z: Math.cos(latitude) * Math.sin(longitude) * radius }
}

// Level of detail: anchors are always drawn; children appear for the selected
// or hovered parent, for search matches, or when the view is close enough.
export function detailFromZoom(zoom) { return clamp((zoom - .9) / .9, 0, 1) }
export function detailFromRadius(radius, overview) { return clamp((overview / Math.max(radius, 1) - 1.6) / 1.6, 0, 1) }
export function isVisible(node, { detail = 0, selectedId = null, hoveredId = null, expanded = null, highlighted = null } = {}) {
  if (!CHILD_KINDS.has(node.kind)) return true
  if (node.id === selectedId || node.id === hoveredId) return true
  if (expanded && (expanded.has(node.parent) || expanded.has(node.id))) return true
  if (highlighted && highlighted.has(node.id)) return true
  return detail >= .75
}
export function visibleAncestor(node, visible, byId) {
  let current = node
  let guard = 0
  while (current && !visible.has(current.id) && current.parent && byId.has(current.parent) && guard++ < 8) current = byId.get(current.parent)
  return current && visible.has(current.id) ? current : null
}

// Constraint for the 2D force layout: a node may wander anywhere inside its
// layer band and its region span; leaving either pushes it back.
export function shellForce(node, anchor, alpha) {
  if (!anchor || node.kind === 'self') return { fx: -node.x * .2 * alpha, fy: -node.y * .2 * alpha }
  const x = node.x, y = node.y / BASE.flatten
  const r = Math.hypot(x, y) || 1
  const ux = x / r, uy = y / r
  let radial
  if (anchor.core || !anchor.sector) radial = (anchor.radius - r) * .06
  else if (r < anchor.sector.inner + 6) radial = (anchor.sector.inner + 6 - r) * .12
  else if (r > anchor.sector.outer - 6) radial = (anchor.sector.outer - 6 - r) * .12
  else radial = (anchor.radius - r) * .004
  let fx = ux * radial * alpha
  let fy = uy * radial * alpha * BASE.flatten
  if (anchor.sector && !angleInRange(Math.atan2(y, x), anchor.sector)) {
    const angle = Math.atan2(y, x)
    const toStart = normalizeAngle(anchor.sector.start - angle), toEnd = normalizeAngle(angle - anchor.sector.end)
    const direction = toStart < toEnd ? 1 : -1
    fx += -uy * direction * r * .012 * alpha
    fy += ux * direction * r * .012 * alpha * BASE.flatten
  }
  return { fx, fy }
}
