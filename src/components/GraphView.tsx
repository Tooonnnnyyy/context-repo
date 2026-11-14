import { useEffect, useRef, useState } from 'react'
import { Plus, Minus, Maximize2, RotateCcw } from 'lucide-react'
import { KnowledgeGraph } from '../graph.js'
import { buildGraph } from '../lib/workspace'
import type { Note } from '../types'

export function GraphView({ notes, name, onSelect, compact = false }: { notes: Note[]; name: string; onSelect: (id: string) => void; compact?: boolean }) {
  const stage = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), layer = useRef<HTMLDivElement>(null)
  const renderer = useRef<any>(null), selection = useRef(onSelect)
  selection.current = onSelect
  const [mode, setMode] = useState<'2d' | '3d'>('2d'), [message, setMessage] = useState('')
  useEffect(() => {
    let cancelled = false
    const options: any = { stage: stage.current!, canvas: canvas.current!, layer: layer.current!, ...buildGraph(notes, name), onSelect: (id: string) => selection.current(id), onViewChange: () => {}, onBackgroundClick: () => {}, onRegionSelect: () => {}, onFallback: () => { setMode('2d'); setMessage('3D is unavailable here. Your graph is shown in 2D.') } }
    async function mount() {
      try {
        if (mode === '3d') {
          const { KnowledgeGraph3D } = await import('../graph-3d.js')
          if (!cancelled) renderer.current = new KnowledgeGraph3D(options)
        } else if (!cancelled) renderer.current = new KnowledgeGraph(options)
      } catch {
        if (!cancelled) { setMode('2d'); setMessage('Your graph is shown in 2D on this device.') }
      }
    }
    void mount()
    return () => { cancelled = true; renderer.current?.destroy(); renderer.current = null }
  }, [notes, name, mode])
  return <div className={`graph-viewport ${compact ? 'graph-compact' : ''}`}>
    <div className="graph-stage" ref={stage} data-mode={mode} aria-label="Interactive context graph"><canvas ref={canvas} aria-hidden="true" /><div className="node-layer" ref={layer} /></div>
    <div className="graph-topline"><span className="live-dot" />{notes.length} notes · {buildGraph(notes).links.length} connections<span className="graph-topline-detail">Click a note to explore</span></div>
    <div className="graph-legend"><span><i style={{ background: '#e96a4c' }} />Core</span><span><i style={{ background: '#8a79c5' }} />Topics</span><span><i style={{ background: '#6f9e90' }} />Notes</span></div>
    {!compact && <div className="graph-toolbar" role="toolbar" aria-label="Graph controls"><div className="segmented"><button className={mode === '2d' ? 'active' : ''} onClick={() => setMode('2d')}>2D</button><button className={mode === '3d' ? 'active' : ''} onClick={() => setMode('3d')}>3D</button></div><span /><button aria-label="Zoom out" onClick={() => renderer.current?.zoom(-1)}><Minus size={16} /></button><button aria-label="Zoom in" onClick={() => renderer.current?.zoom(1)}><Plus size={16} /></button><button aria-label="Fit graph" onClick={() => renderer.current?.fit()}><Maximize2 size={15} /></button><button aria-label="Reset layout" onClick={() => renderer.current?.arrange()}><RotateCcw size={15} /></button></div>}
    {message && <p className="graph-message" role="status">{message}</p>}
  </div>
}
