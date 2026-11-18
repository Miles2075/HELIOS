import { useEffect, useRef, useState } from 'react'
import { Brain, Loader2, Maximize2, RotateCcw, Sparkles, ZoomIn, ZoomOut } from 'lucide-react'
import { generateBrainMap } from '../api/client'

const TYPE_COLORS = {
  core: '#f472b6',
  concept: '#38bdf8',
  mechanism: '#34d399',
  hardware: '#fbbf24',
  risk: '#fb7185',
}

function computeInitialPositions(nodes) {
  const cx = 420
  const cy = 240
  const positions = {}
  nodes.forEach((node, idx) => {
    if (idx === 0) {
      positions[node.id] = { x: cx, y: cy }
    } else {
      const ring = idx <= 4 ? 145 : 225
      const countInRing = idx <= 4 ? Math.min(4, nodes.length - 1) : Math.max(1, nodes.length - 5)
      const indexInRing = idx <= 4 ? idx - 1 : idx - 5
      const angle = (indexInRing / countInRing) * Math.PI * 2 - Math.PI / 2 + (idx > 4 ? 0.35 : 0)
      positions[node.id] = {
        x: cx + Math.cos(angle) * ring * 1.25,
        y: cy + Math.sin(angle) * ring * 0.85,
      }
    }
  })
  return positions
}

export default function BrainMap({ documents, activeDocId, onActivity, backendOnline }) {
  const [docId, setDocId] = useState(activeDocId || documents[0]?.document_id || 1)
  const [customDocId, setCustomDocId] = useState(String(activeDocId || documents[0]?.document_id || 1))
  const [graph, setGraph] = useState(null)
  const [positions, setPositions] = useState({})
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const svgRef = useRef(null)

  const loadMap = async (targetDocId) => {
    const parsedId = Number(targetDocId)
    if (!parsedId || parsedId < 1) {
      setError('Please enter a valid positive Document ID.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await generateBrainMap(parsedId, documents)
      setGraph(res)
      setPositions(computeInitialPositions(res.nodes || []))
      setSelectedNodeId(res.nodes?.[0]?.id || null)
      const docName =
        documents.find((d) => d.document_id === parsedId)?.filename || `Doc #${parsedId}`
      onActivity?.(`Generated Brain Map for ${docName}`, 'brain', 'brain-map')
    } catch (err) {
      setError(err.message || 'Failed to generate Brain Map.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    generateBrainMap(Number(docId), documents)
      .then((res) => {
        if (!active) return
        setGraph(res)
        setPositions(computeInitialPositions(res.nodes || []))
        setSelectedNodeId(res.nodes?.[0]?.id || null)
      })
      .catch(() => {})
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePointerMove = (e) => {
    if (!draggingId || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const scaleX = 840 / rect.width
    const scaleY = 480 / rect.height
    const rawX = (e.clientX - rect.left) * scaleX
    const rawY = (e.clientY - rect.top) * scaleY
    const worldX = (rawX - 420 * (1 - zoom)) / zoom
    const worldY = (rawY - 240 * (1 - zoom)) / zoom
    const x = Math.max(50, Math.min(790, worldX))
    const y = Math.max(36, Math.min(444, worldY))
    setPositions((prev) => ({ ...prev, [draggingId]: { x, y } }))
  }

  const selectedNode = graph?.nodes?.find((n) => n.id === selectedNodeId) || null
  const connectedEdges = graph?.edges?.filter(
    (e) => e.source === selectedNodeId || e.target === selectedNodeId
  ) || []

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center border"
            style={{
              background: 'var(--emerald-soft)',
              borderColor: 'rgba(52, 211, 153, 0.4)',
              color: 'var(--emerald)',
            }}
          >
            <Brain className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold m-0">Brain Map</h1>
            <p className="text-xs sm:text-sm m-0" style={{ color: 'var(--text-secondary)' }}>
              Explore interactive concept networks and directed relationships extracted from your study materials.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={docId}
            onChange={(e) => {
              const val = Number(e.target.value)
              setDocId(val)
              setCustomDocId(String(val))
              loadMap(val)
            }}
            className="px-3 py-2 rounded-xl text-xs border outline-none"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)',
            }}
          >
            {documents.map((d) => (
              <option key={d.document_id} value={d.document_id}>
                {d.filename} (#{d.document_id})
              </option>
            ))}
          </select>

          <span
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold border"
            style={{
              background: (graph?._mode === 'live' || backendOnline) ? 'var(--emerald-soft)' : 'var(--accent-soft)',
              borderColor: (graph?._mode === 'live' || backendOnline) ? 'rgba(52, 211, 153, 0.4)' : 'var(--accent-border)',
              color: (graph?._mode === 'live' || backendOnline) ? 'var(--emerald)' : 'var(--accent-bright)',
            }}
          >
            {(graph?._mode === 'live' || backendOnline) ? 'Live NetworkX' : 'Preview'}
          </span>

          <input
            type="number"
            min="1"
            value={customDocId}
            onChange={(e) => setCustomDocId(e.target.value)}
            placeholder="Doc ID"
            aria-label="Document ID"
            className="w-24 px-2.5 py-2 rounded-xl text-xs font-mono-code border outline-none"
            style={{
              background: 'var(--bg-input)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)',
            }}
          />

          <button
            type="button"
            disabled={loading}
            onClick={() => loadMap(customDocId)}
            className="helios-btn-primary px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate Map
          </button>

          <a
            href={`/api/brainmap/${customDocId || docId}/pyvis`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-strong)',
              color: 'var(--emerald)',
            }}
          >
            PyVis Physics View ↗
          </a>
        </div>
      </div>

      {error && (
        <div
          className="p-3.5 rounded-xl border text-xs sm:text-sm"
          style={{
            background: 'rgba(251, 113, 133, 0.12)',
            borderColor: 'rgba(251, 113, 133, 0.4)',
            color: 'var(--danger)',
          }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_310px] gap-5">
        {/* Interactive Graph Canvas */}
        <div className="helios-card p-4 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-3 text-[11px] flex-wrap">
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <span key={type} className="inline-flex items-center gap-1.5 capitalize" style={{ color: 'var(--text-secondary)' }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  {type}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.1).toFixed(2))))}
                className="p-1.5 rounded-lg border cursor-pointer"
                style={{ background: 'var(--bg-card-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
                className="p-1.5 rounded-lg border cursor-pointer"
                style={{ background: 'var(--bg-card-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1)
                  if (graph?.nodes) setPositions(computeInitialPositions(graph.nodes))
                }}
                className="p-1.5 rounded-lg border cursor-pointer"
                style={{ background: 'var(--bg-card-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                title="Reset Layout"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div
            className="rounded-xl border overflow-hidden relative select-none"
            style={{
              background:
                'radial-gradient(circle at center, rgba(52, 211, 153, 0.06), transparent 70%), var(--bg-app)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <svg
              ref={svgRef}
              viewBox="0 0 840 480"
              className="w-full h-[460px] cursor-grab active:cursor-grabbing"
              onPointerMove={handlePointerMove}
              onPointerUp={() => setDraggingId(null)}
              onPointerLeave={() => setDraggingId(null)}
            >
              <defs>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="26"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--text-muted)" />
                </marker>
                <marker
                  id="arrow-active"
                  viewBox="0 0 10 10"
                  refX="26"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--accent)" />
                </marker>
              </defs>

              <g transform={`translate(${420 * (1 - zoom)}, ${240 * (1 - zoom)}) scale(${zoom})`}>
                {/* Edges */}
                {(graph?.edges || []).map((edge, idx) => {
                  const p1 = positions[edge.source]
                  const p2 = positions[edge.target]
                  if (!p1 || !p2) return null
                  const active = edge.source === selectedNodeId || edge.target === selectedNodeId
                  const mx = (p1.x + p2.x) / 2
                  const my = (p1.y + p2.y) / 2
                  return (
                    <g key={idx}>
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke={active ? 'var(--accent)' : 'var(--border-strong)'}
                        strokeWidth={active ? 2.4 : 1.4}
                        strokeOpacity={active ? 0.95 : 0.65}
                        markerEnd={active ? 'url(#arrow-active)' : 'url(#arrow)'}
                      />
                      <rect
                        x={mx - 40}
                        y={my - 9}
                        width={80}
                        height={18}
                        rx={6}
                        fill="var(--bg-app)"
                        stroke={active ? 'var(--accent)' : 'var(--border-subtle)'}
                        strokeWidth={0.8}
                      />
                      <text
                        x={mx}
                        y={my + 3.5}
                        textAnchor="middle"
                        fontSize="9.5"
                        fill={active ? 'var(--accent-bright)' : 'var(--text-secondary)'}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {edge.relationship}
                      </text>
                    </g>
                  )
                })}

                {/* Nodes */}
                {(graph?.nodes || []).map((node) => {
                  const pos = positions[node.id]
                  if (!pos) return null
                  const color = TYPE_COLORS[node.type] || '#f472b6'
                  const isSelected = node.id === selectedNodeId
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        setSelectedNodeId(node.id)
                        setDraggingId(node.id)
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {isSelected && (
                        <circle r="30" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.5" strokeDasharray="4 3" />
                      )}
                      <circle
                        r="22"
                        fill="#1d1017"
                        stroke={color}
                        strokeWidth={isSelected ? 3 : 2}
                      />
                      <circle r="6" fill={color} />
                      <text
                        y="36"
                        textAnchor="middle"
                        fontSize="11.5"
                        fontWeight="700"
                        fill="#f8eff4"
                      >
                        {node.label}
                      </text>
                    </g>
                  )
                })}
              </g>
            </svg>

            <div
              className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1.5 border"
              style={{
                background: 'rgba(18, 9, 14, 0.85)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-muted)',
              }}
            >
              <Maximize2 className="w-3 h-3" /> Drag any concept node to rearrange · Click to inspect
            </div>
          </div>
        </div>

        {/* Right Concept Inspector */}
        <div className="helios-card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] font-bold tracking-[0.14em] uppercase"
              style={{ color: 'var(--emerald)' }}
            >
              CONCEPT INSPECTOR
            </span>
            {graph?.map_id && (
              <span className="font-mono-code text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Map #{graph.map_id}
              </span>
            )}
          </div>

          {selectedNode ? (
            <>
              <div
                className="p-4 rounded-xl border"
                style={{
                  background: 'var(--bg-card-elevated)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    background: 'var(--bg-app)',
                    color: TYPE_COLORS[selectedNode.type] || 'var(--accent)',
                  }}
                >
                  {selectedNode.type}
                </span>
                <h3 className="mt-2 text-lg font-bold m-0">{selectedNode.label}</h3>
                <p className="mt-1.5 text-xs leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>
                  {selectedNode.summary || 'Key extracted concept node in the knowledge graph.'}
                </p>
              </div>

              <div>
                <div
                  className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  RELATIONSHIPS ({connectedEdges.length})
                </div>
                <div className="flex flex-col gap-2">
                  {connectedEdges.map((edge, idx) => {
                    const isOutgoing = edge.source === selectedNode.id
                    const otherId = isOutgoing ? edge.target : edge.source
                    const otherNode = graph?.nodes?.find((n) => n.id === otherId)
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedNodeId(otherId)}
                        className="p-2.5 rounded-xl border text-left text-xs flex items-center justify-between gap-2 cursor-pointer hover:border-emerald-400/50"
                        style={{
                          background: 'var(--bg-card-elevated)',
                          borderColor: 'var(--border-subtle)',
                        }}
                      >
                        <span className="truncate font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {isOutgoing ? '→' : '←'} {otherNode?.label || otherId}
                        </span>
                        <span
                          className="font-mono-code text-[10px] px-2 py-0.5 rounded shrink-0"
                          style={{ background: 'var(--emerald-soft)', color: 'var(--emerald)' }}
                        >
                          {edge.relationship}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div
                className="mt-auto pt-3 border-t text-[11px] flex items-center justify-between"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
              >
                <span>{graph?.nodes?.length || 0} Nodes</span>
                <span>{graph?.edges?.length || 0} Validated Edges</span>
              </div>
            </>
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Click a node on the canvas to inspect its relationships.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
