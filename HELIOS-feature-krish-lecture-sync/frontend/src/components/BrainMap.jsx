import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  Brain,
  Globe,
  Loader2,
  Maximize2,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { generateBrainMap } from '../api/client'

const TYPE_COLORS = {
  core: '#f472b6',
  concept: '#38bdf8',
  mechanism: '#34d399',
  hardware: '#fbbf24',
  risk: '#fb7185',
}

function compute2DInitialPositions(nodes) {
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

function compute3DPositions(nodes) {
  const positions = {}
  const n = nodes.length
  if (n === 0) return positions
  positions[nodes[0].id] = { x: 0, y: 0, z: 0 }

  const radius = 210
  const phi = (1 + Math.sqrt(5)) / 2
  for (let i = 1; i < n; i++) {
    const y = 1 - ((i - 1) / Math.max(1, n - 1)) * 2
    const rad = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = (2 * Math.PI * (i - 1)) / phi
    const x = Math.cos(theta) * rad
    const z = Math.sin(theta) * rad
    const r = i <= 4 ? radius * 0.85 : radius * 1.15
    positions[nodes[i].id] = {
      x: x * r,
      y: y * r * 0.75,
      z: z * r,
    }
  }
  return positions
}

export default function BrainMap({ documents, activeDocId, onActivity, backendOnline }) {
  const [docId, setDocId] = useState(activeDocId || documents[0]?.document_id || 1)
  const [customDocId, setCustomDocId] = useState(String(activeDocId || documents[0]?.document_id || 1))
  const [graph, setGraph] = useState(null)
  const [positions2D, setPositions2D] = useState({})
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [viewMode, setViewMode] = useState('3d') // '3d' | '2d'
  const [autoRotate, setAutoRotate] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const arrowId = useId()
  const arrowActiveId = useId()

  const svgRef = useRef(null)
  const canvasRef = useRef(null)

  // 3D Camera & Simulation state refs
  const cameraRef = useRef({
    rotX: 0.35,
    rotY: 0.45,
    distance: 520,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    hoveredNodeId: null,
  })

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
      setPositions2D(compute2DInitialPositions(res.nodes || []))
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
        setPositions2D(compute2DInitialPositions(res.nodes || []))
        setSelectedNodeId(res.nodes?.[0]?.id || null)
      })
      .catch(() => {})
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 3D positions calculated when graph changes
  const positions3D = useMemo(() => {
    return compute3DPositions(graph?.nodes || [])
  }, [graph])

const STATIC_STARS = Array.from({ length: 60 }, (_, i) => {
  const seed = (i * 9301 + 49297) % 233280
  const rand1 = seed / 233280
  const rand2 = ((seed * 9301 + 49297) % 233280) / 233280
  const rand3 = ((seed * 49297 + 9301) % 233280) / 233280
  return {
    x: (rand1 - 0.5) * 1100,
    y: (rand2 - 0.5) * 700,
    z: (rand3 - 0.5) * 800,
    size: rand1 * 1.6 + 0.6,
    alpha: rand2 * 0.5 + 0.25,
  }
})

  // 3D Canvas Render Loop
  useEffect(() => {
    if (viewMode !== '3d') return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId
    let particleOffset = 0

    const render = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const width = rect.width
      const height = rect.height

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr
        canvas.height = height * dpr
      }

      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, height)

      const cam = cameraRef.current
      if (autoRotate && !cam.isDragging) {
        cam.rotY += 0.0055
      }

      particleOffset = (particleOffset + 0.012) % 1.0

      const cosY = Math.cos(cam.rotY)
      const sinY = Math.sin(cam.rotY)
      const cosX = Math.cos(cam.rotX)
      const sinX = Math.sin(cam.rotX)

      const cx = width / 2
      const cy = height / 2
      const fov = 460 * zoom

      // Transform point from 3D to 2D screen coordinates
      const project = (x, y, z) => {
        const x1 = x * cosY + z * sinY
        const z1 = -x * sinY + z * cosY
        const y2 = y * cosX - z1 * sinX
        const z2 = y * sinX + z1 * cosX

        const dist = cam.distance + z2
        if (dist <= 10) return null

        const scale = fov / dist
        return {
          screenX: cx + x1 * scale,
          screenY: cy + y2 * scale,
          scale,
          zDepth: z2,
        }
      }

      // 1. Draw 3D Stars background
      STATIC_STARS.forEach((star) => {
        const p = project(star.x, star.y, star.z)
        if (!p) return
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`
        ctx.beginPath()
        ctx.arc(p.screenX, p.screenY, star.size * Math.max(0.4, p.scale * 1.5), 0, Math.PI * 2)
        ctx.fill()
      })

      // 2. Project Nodes
      const projectedNodes = {}
      ;(graph?.nodes || []).forEach((node) => {
        const pos = positions3D[node.id] || { x: 0, y: 0, z: 0 }
        const proj = project(pos.x, pos.y, pos.z)
        if (proj) {
          projectedNodes[node.id] = { ...node, ...proj }
        }
      })

      // 3. Draw 3D Edges
      ;(graph?.edges || []).forEach((edge) => {
        const p1 = projectedNodes[edge.source]
        const p2 = projectedNodes[edge.target]
        if (!p1 || !p2) return

        const active = edge.source === selectedNodeId || edge.target === selectedNodeId
        const avgDepth = (p1.zDepth + p2.zDepth) / 2
        const depthAlpha = Math.min(1, Math.max(0.18, (avgDepth + 300) / 600))

        ctx.strokeStyle = active
          ? 'var(--accent)'
          : `rgba(148, 163, 184, ${depthAlpha * 0.35})`
        ctx.lineWidth = active ? 2.5 : Math.max(1, 1.6 * ((p1.scale + p2.scale) / 2))
        ctx.beginPath()
        ctx.moveTo(p1.screenX, p1.screenY)
        ctx.lineTo(p2.screenX, p2.screenY)
        ctx.stroke()

        // Relationship label on edge center
        const mx = (p1.screenX + p2.screenX) / 2
        const my = (p1.screenY + p2.screenY) / 2
        if (active || zoom >= 1) {
          ctx.font = '9.5px JetBrains Mono, monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = active ? 'var(--accent-bright)' : 'rgba(161, 161, 170, 0.75)'
          ctx.fillText(edge.relationship, mx, my - 6)
        }

        // 3D Flowing Signal Particle along the edge
        const t = (particleOffset + (edge.source.charCodeAt(0) % 5) * 0.2) % 1.0
        const px = p1.screenX + (p2.screenX - p1.screenX) * t
        const py = p1.screenY + (p2.screenY - p1.screenY) * t
        const pRadius = active ? 3.5 : 2.2
        ctx.fillStyle = active ? 'var(--accent-bright)' : 'var(--emerald)'
        ctx.beginPath()
        ctx.arc(px, py, pRadius, 0, Math.PI * 2)
        ctx.fill()
      })

      // 4. Sort Nodes by Depth (Painter's Algorithm: back to front)
      const sortedNodeList = Object.values(projectedNodes).sort(
        (a, b) => a.zDepth - b.zDepth
      )

      // 5. Draw 3D Nodes
      sortedNodeList.forEach((node) => {
        const isSelected = node.id === selectedNodeId
        const isHovered = node.id === cam.hoveredNodeId
        const color = TYPE_COLORS[node.type] || '#f472b6'

        const baseRadius = node.type === 'core' ? 22 : 16
        const radius = Math.max(8, baseRadius * node.scale * 1.3)

        // Depth fog / glow intensity
        const depthFactor = Math.min(1, Math.max(0.3, (node.zDepth + 320) / 640))

        // Outer glow
        if (isSelected || isHovered) {
          ctx.beginPath()
          ctx.arc(node.screenX, node.screenY, radius + 8, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.globalAlpha = 0.25
          ctx.fill()
          ctx.globalAlpha = 1
        }

        // Node Body
        ctx.beginPath()
        ctx.arc(node.screenX, node.screenY, radius, 0, Math.PI * 2)
        ctx.fillStyle = 'var(--bg-card)'
        ctx.fill()
        ctx.lineWidth = isSelected ? 3.2 : 2
        ctx.strokeStyle = color
        ctx.stroke()

        // Center Pip
        ctx.beginPath()
        ctx.arc(node.screenX, node.screenY, Math.max(3, radius * 0.35), 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()

        // Node Label
        ctx.font = `${Math.max(10, Math.min(13, 11.5 * node.scale * 1.2))}px Inter, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillStyle = isSelected
          ? 'var(--accent-bright)'
          : `rgba(244, 244, 246, ${depthFactor})`
        ctx.fillText(node.label, node.screenX, node.screenY + radius + 5)
      })

      ctx.restore()
      animId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animId)
    }
  }, [viewMode, autoRotate, zoom, graph, positions3D, selectedNodeId, STATIC_STARS])

  // 3D Canvas Pointer Handlers (Rotate Orbit & Node Click)
  const handleCanvasPointerDown = (e) => {
    const cam = cameraRef.current
    cam.isDragging = true
    cam.lastMouseX = e.clientX
    cam.lastMouseY = e.clientY
  }

  const handleCanvasPointerMove = (e) => {
    const cam = cameraRef.current
    const canvas = canvasRef.current
    if (!canvas) return

    if (cam.isDragging) {
      const dx = e.clientX - cam.lastMouseX
      const dy = e.clientY - cam.lastMouseY
      cam.rotY += dx * 0.008
      cam.rotX = Math.max(-1.4, Math.min(1.4, cam.rotX + dy * 0.008))
      cam.lastMouseX = e.clientX
      cam.lastMouseY = e.clientY
    }

    // Hit-testing for hovered node in 3D projection
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const cosY = Math.cos(cam.rotY)
    const sinY = Math.sin(cam.rotY)
    const cosX = Math.cos(cam.rotX)
    const sinX = Math.sin(cam.rotX)
    const cx = rect.width / 2
    const cy = rect.height / 2
    const fov = 460 * zoom

    let closestNode = null
    let minDist = 28

    ;(graph?.nodes || []).forEach((node) => {
      const pos = positions3D[node.id] || { x: 0, y: 0, z: 0 }
      const x1 = pos.x * cosY + pos.z * sinY
      const z1 = -pos.x * sinY + pos.z * cosY
      const y2 = pos.y * cosX - z1 * sinX
      const z2 = pos.y * sinX + z1 * cosX

      const dist = cam.distance + z2
      if (dist <= 10) return

      const scale = fov / dist
      const sx = cx + x1 * scale
      const sy = cy + y2 * scale
      const d = Math.hypot(mouseX - sx, mouseY - sy)
      if (d < minDist) {
        minDist = d
        closestNode = node.id
      }
    })

    cam.hoveredNodeId = closestNode
    canvas.style.cursor = closestNode ? 'pointer' : cam.isDragging ? 'grabbing' : 'grab'
  }

  const handleCanvasPointerUp = () => {
    const cam = cameraRef.current
    if (cam.isDragging && cam.hoveredNodeId) {
      setSelectedNodeId(cam.hoveredNodeId)
    }
    cam.isDragging = false
  }

  const handleCanvasWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom((z) => Math.max(0.6, Math.min(1.8, Number((z + delta).toFixed(2)))))
  }

  // 2D SVG drag
  const handle2DPointerMove = (e) => {
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
    setPositions2D((prev) => ({ ...prev, [draggingId]: { x, y } }))
  }

  const selectedNode = graph?.nodes?.find((n) => n.id === selectedNodeId) || null
  const connectedEdges =
    graph?.edges?.filter(
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
              Explore interactive 3D concept networks and directed relationships extracted from your study materials.
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
              background:
                graph?._mode === 'live' || backendOnline
                  ? 'var(--emerald-soft)'
                  : 'var(--accent-soft)',
              borderColor:
                graph?._mode === 'live' || backendOnline
                  ? 'rgba(52, 211, 153, 0.4)'
                  : 'var(--accent-border)',
              color:
                graph?._mode === 'live' || backendOnline
                  ? 'var(--emerald)'
                  : 'var(--accent-bright)',
            }}
          >
            {graph?._mode === 'live' || backendOnline ? 'Live NetworkX' : 'Preview'}
          </span>

          <input
            type="number"
            min="1"
            value={customDocId}
            onChange={(e) => setCustomDocId(e.target.value)}
            placeholder="Doc ID"
            aria-label="Document ID"
            className="w-20 px-2.5 py-2 rounded-xl text-xs font-mono-code border outline-none"
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
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
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
          {/* Top Canvas Toolbar */}
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-3 text-[11px] flex-wrap">
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1.5 capitalize"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  {type}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {/* View Mode Switcher: 3D vs 2D */}
              <div
                className="flex items-center p-0.5 rounded-xl border"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setViewMode('3d')}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  style={{
                    background: viewMode === '3d' ? 'var(--emerald-soft)' : 'transparent',
                    color: viewMode === '3d' ? 'var(--emerald)' : 'var(--text-muted)',
                  }}
                  title="3D Constellation Sphere View"
                >
                  <Orbit className="w-3.5 h-3.5" />
                  3D Cosmic Map
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('2d')}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  style={{
                    background: viewMode === '2d' ? 'var(--emerald-soft)' : 'transparent',
                    color: viewMode === '2d' ? 'var(--emerald)' : 'var(--text-muted)',
                  }}
                  title="2D Planar Diagram"
                >
                  <Globe className="w-3.5 h-3.5" />
                  2D Diagram
                </button>
              </div>

              {/* 3D Auto Rotate Toggle */}
              {viewMode === '3d' && (
                <button
                  type="button"
                  onClick={() => setAutoRotate((a) => !a)}
                  className="p-1.5 rounded-lg border cursor-pointer flex items-center gap-1 text-xs"
                  style={{
                    background: autoRotate ? 'var(--emerald-soft)' : 'var(--bg-card-elevated)',
                    borderColor: 'var(--border-subtle)',
                    color: autoRotate ? 'var(--emerald)' : 'var(--text-secondary)',
                  }}
                  title={autoRotate ? 'Pause Auto Orbit' : 'Enable Auto Orbit'}
                >
                  {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline text-[11px] font-medium">Auto-Orbit</span>
                </button>
              )}

              {/* Zoom Out */}
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.1).toFixed(2))))}
                className="p-1.5 rounded-lg border cursor-pointer"
                style={{
                  background: 'var(--bg-card-elevated)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              {/* Zoom In */}
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.1).toFixed(2))))}
                className="p-1.5 rounded-lg border cursor-pointer"
                style={{
                  background: 'var(--bg-card-elevated)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              {/* Reset Layout */}
              <button
                type="button"
                onClick={() => {
                  setZoom(1)
                  if (viewMode === '3d') {
                    cameraRef.current.rotX = 0.35
                    cameraRef.current.rotY = 0.45
                    cameraRef.current.distance = 520
                  } else if (graph?.nodes) {
                    setPositions2D(compute2DInitialPositions(graph.nodes))
                  }
                }}
                className="p-1.5 rounded-lg border cursor-pointer"
                style={{
                  background: 'var(--bg-card-elevated)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
                title="Reset View"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* VIEWPORT: 3D Canvas or 2D SVG */}
          <div
            className="rounded-xl border overflow-hidden relative select-none min-h-[460px] flex items-center justify-center"
            style={{
              background:
                'radial-gradient(circle at center, rgba(52, 211, 153, 0.08), transparent 70%), var(--bg-app)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {viewMode === '3d' ? (
              <canvas
                ref={canvasRef}
                className="w-full h-[460px] block cursor-grab active:cursor-grabbing"
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerLeave={handleCanvasPointerUp}
                onWheel={handleCanvasWheel}
              />
            ) : (
              <svg
                ref={svgRef}
                viewBox="0 0 840 480"
                className="w-full h-[460px] cursor-grab active:cursor-grabbing"
                onPointerMove={handle2DPointerMove}
                onPointerUp={() => setDraggingId(null)}
                onPointerLeave={() => setDraggingId(null)}
              >
                <defs>
                  <marker
                    id={arrowId}
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
                    id={arrowActiveId}
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
                    const p1 = positions2D[edge.source]
                    const p2 = positions2D[edge.target]
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
                          markerEnd={active ? `url(#${arrowActiveId})` : `url(#${arrowId})`}
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
                    const pos = positions2D[node.id]
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
                          <circle
                            r="30"
                            fill={color}
                            fillOpacity="0.18"
                            stroke={color}
                            strokeWidth="1.5"
                            strokeDasharray="4 3"
                          />
                        )}
                        <circle
                          r="22"
                          fill="var(--bg-card)"
                          stroke={color}
                          strokeWidth={isSelected ? 3 : 2}
                        />
                        <circle r="6" fill={color} />
                        <text
                          y="36"
                          textAnchor="middle"
                          fontSize="11.5"
                          fontWeight="700"
                          fill="var(--text-primary)"
                        >
                          {node.label}
                        </text>
                      </g>
                    )
                  })}
                </g>
              </svg>
            )}

            {/* Bottom Status Tip */}
            <div
              className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1.5 border backdrop-blur-sm"
              style={{
                background: 'rgba(18, 9, 14, 0.85)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-muted)',
              }}
            >
              <Maximize2 className="w-3 h-3" />
              {viewMode === '3d'
                ? '3D Orbit: Drag to tilt & rotate in 3D · Scroll to zoom · Click node to inspect'
                : '2D Layout: Drag any concept node to rearrange · Click to inspect'}
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
                <p
                  className="mt-1.5 text-xs leading-relaxed m-0"
                  style={{ color: 'var(--text-secondary)' }}
                >
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
                <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
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
                        <span
                          className="truncate font-semibold"
                          style={{ color: 'var(--text-primary)' }}
                        >
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
              Click a node on the 3D canvas to inspect its relationships.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
