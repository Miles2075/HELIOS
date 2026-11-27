import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Brain,
  Sparkles,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RefreshCw,
  FileText,
  GitMerge,
  ArrowRight,
  ExternalLink,
  X,
  Eye,
  Loader2,
  AlertCircle,
  Compass,
  Box,
  Layers,
  Orbit,
} from 'lucide-react';
import { BrainMap3DCanvas } from './BrainMap3DCanvas';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 600;

function computeForceLayout(nodes, triples) {
  const pos = {};
  if (!nodes || nodes.length === 0) return pos;

  const cx = CANVAS_WIDTH / 2;
  const cy = CANVAS_HEIGHT / 2;

  const docs = nodes.filter((n) => n.kind === 'document');
  const bridges = nodes.filter((n) => n.kind === 'bridge');
  const concepts = nodes.filter((n) => n.kind === 'concept');

  // 1. Place document hubs on a wide outer ring
  docs.forEach((doc, idx) => {
    const angle = (idx / Math.max(docs.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const rx = docs.length <= 2 ? 310 : 325;
    const ry = docs.length <= 2 ? 150 : 215;
    pos[doc.id] = {
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
    };
  });

  // 2. Place glowing bridge nodes near the centroid of the documents they link
  bridges.forEach((bridge, idx) => {
    const linkedDocIds = Array.from(
      new Set(bridge.sources.map((s) => `doc-${s.documentId}`))
    ).filter((id) => Boolean(pos[id]));

    if (linkedDocIds.length >= 2) {
      let avgX = 0;
      let avgY = 0;
      for (const did of linkedDocIds) {
        avgX += pos[did].x;
        avgY += pos[did].y;
      }
      avgX /= linkedDocIds.length;
      avgY /= linkedDocIds.length;
      const offsetAngle = (idx * 2.39996) % (Math.PI * 2);
      pos[bridge.id] = {
        x: avgX * 0.72 + cx * 0.28 + Math.cos(offsetAngle) * 44,
        y: avgY * 0.72 + cy * 0.28 + Math.sin(offsetAngle) * 44,
      };
    } else {
      const angle = (idx / Math.max(bridges.length, 1)) * Math.PI * 2;
      pos[bridge.id] = {
        x: cx + Math.cos(angle) * 115,
        y: cy + Math.sin(angle) * 95,
      };
    }
  });

  // 3. Place concept nodes around their primary adjacent node
  concepts.forEach((concept, idx) => {
    const neighborTriple = triples.find(
      (t) => t.sourceId === concept.id || t.targetId === concept.id
    );
    const neighborId = neighborTriple
      ? neighborTriple.sourceId === concept.id
        ? neighborTriple.targetId
        : neighborTriple.sourceId
      : undefined;
    const anchor = (neighborId && pos[neighborId]) || { x: cx, y: cy };
    const angle = (idx / Math.max(concepts.length, 1)) * Math.PI * 2 + 0.4;
    pos[concept.id] = {
      x: anchor.x + Math.cos(angle) * 125,
      y: anchor.y + Math.sin(angle) * 105,
    };
  });

  // 4. Deterministic damped force-directed settle pass (no overlap, crisp spacing)
  const vel = {};
  for (const n of nodes) {
    vel[n.id] = { x: 0, y: 0 };
  }

  const iterations = 180;
  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations;
    const forces = {};
    for (const n of nodes) {
      forces[n.id] = { x: 0, y: 0 };
    }

    // Repulsion between all pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = pos[a.id].x - pos[b.id].x;
        const dy = pos[a.id].y - pos[b.id].y;
        const distSq = Math.max(dx * dx + dy * dy, 25);
        const dist = Math.sqrt(distSq);

        // Keep document hubs spaced further apart
        const pairBoost =
          a.kind === 'document' && b.kind === 'document'
            ? 2.2
            : a.kind === 'bridge' || b.kind === 'bridge'
              ? 1.25
              : 1.0;

        const repulsion = (9200 * pairBoost) / distSq;
        const fx = (dx / dist) * repulsion;
        const fy = (dy / dist) * repulsion;

        forces[a.id].x += fx;
        forces[a.id].y += fy;
        forces[b.id].x -= fx;
        forces[b.id].y -= fy;

        // Hard minimum-distance separation so labels never stack
        const minDist = a.kind === 'document' || b.kind === 'document' ? 132 : 108;
        if (dist < minDist) {
          const push = (minDist - dist) * 0.22;
          const px = (dx / dist) * push;
          const py = (dy / dist) * push;
          forces[a.id].x += px;
          forces[a.id].y += py;
          forces[b.id].x -= px;
          forces[b.id].y -= py;
        }
      }
    }

    // Spring attraction along relationship triples
    for (const t of triples) {
      const pA = pos[t.sourceId];
      const pB = pos[t.targetId];
      if (!pA || !pB) continue;

      const dx = pB.x - pA.x;
      const dy = pB.y - pA.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const targetLength = 152;
      const spring = (dist - targetLength) * 0.045;
      const fx = (dx / dist) * spring;
      const fy = (dy / dist) * spring;

      forces[t.sourceId].x += fx;
      forces[t.sourceId].y += fy;
      forces[t.targetId].x -= fx;
      forces[t.targetId].y -= fy;
    }

    // Gentle gravity toward center (stronger for bridges, weaker for documents)
    for (const n of nodes) {
      const pull = n.kind === 'bridge' ? 0.028 : n.kind === 'document' ? 0.008 : 0.016;
      forces[n.id].x += (cx - pos[n.id].x) * pull;
      forces[n.id].y += (cy - pos[n.id].y) * pull;
    }

    // Integrate & clamp within viewBox padding
    const maxStep = 14 * (0.35 + 0.65 * cooling);
    for (const n of nodes) {
      const v = vel[n.id];
      v.x = (v.x + forces[n.id].x) * 0.68;
      v.y = (v.y + forces[n.id].y) * 0.68;

      const speed = Math.sqrt(v.x * v.x + v.y * v.y);
      if (speed > maxStep) {
        v.x = (v.x / speed) * maxStep;
        v.y = (v.y / speed) * maxStep;
      }

      pos[n.id].x = Math.max(84, Math.min(CANVAS_WIDTH - 84, pos[n.id].x + v.x));
      pos[n.id].y = Math.max(66, Math.min(CANVAS_HEIGHT - 74, pos[n.id].y + v.y));
    }
  }

  return pos;
}

function splitLabelLines(label, maxCharsPerLine = 17) {
  if (!label) return [''];
  const words = label.trim().split(/\s+/);
  const lines = [];
  let current = '';

  for (const w of words) {
    if (!current) {
      current = w;
    } else if (current.length + 1 + w.length <= maxCharsPerLine) {
      current = `${current} ${w}`;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);

  if (lines.length > 2) {
    return [lines[0], `${lines.slice(1).join(' ').slice(0, maxCharsPerLine - 1)}…`];
  }
  return lines;
}

const TOPIC_LENSES = [
  'Concurrency & Locks',
  'Crash Recovery & Logging',
  'Memory & Paging',
  'Distributed Consensus',
];

export function BrainMapView({
  graph,
  documents = [],
  isExtracting = false,
  extractError = null,
  onExtractGraph,
  onResetDefaultGraph,
  onOpenPageInSearch,
}) {
  const [focusInput, setFocusInput] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [nodeSearch, setNodeSearch] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [viewMode, setViewMode] = useState('2d');
  const [autoRotate3D, setAutoRotate3D] = useState(true);
  const [zoomStepSignal, setZoomStepSignal] = useState({ seq: 0, factor: 1 });
  const [resetViewSeq, setResetViewSeq] = useState(0);
  const [relayoutSeq, setRelayoutSeq] = useState(0);
  const [showAllEdgeLabels, setShowAllEdgeLabels] = useState(false);

  const [positions, setPositions] = useState(() =>
    computeForceLayout(graph.nodes, graph.triples)
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const svgRef = useRef(null);
  const dragStateRef = useRef(null);

  useEffect(() => {
    setPositions(computeForceLayout(graph.nodes, graph.triples));
    setSelectedNodeId((prev) =>
      prev && graph.nodes.some((n) => n.id === prev) ? prev : null
    );
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [graph]);

  const nodeById = useMemo(
    () => new Map(graph.nodes.map((n) => [n.id, n])),
    [graph.nodes]
  );

  const activeFocusId = hoveredNodeId ?? selectedNodeId;

  const connectedToFocus = useMemo(() => {
    const nodeIds = new Set();
    const tripleIds = new Set();
    if (!activeFocusId) return { nodeIds, tripleIds };
    nodeIds.add(activeFocusId);
    for (const t of graph.triples) {
      if (t.sourceId === activeFocusId || t.targetId === activeFocusId) {
        tripleIds.add(t.id);
        nodeIds.add(t.sourceId);
        nodeIds.add(t.targetId);
      }
    }
    return { nodeIds, tripleIds };
  }, [activeFocusId, graph.triples]);

  const searchLower = nodeSearch.trim().toLowerCase();

  const matchesFilterAndSearch = (node) => {
    const kindOk = kindFilter === 'all' || node.kind === kindFilter;
    const textOk =
      !searchLower ||
      node.label.toLowerCase().includes(searchLower) ||
      (node.summary && node.summary.toLowerCase().includes(searchLower));
    return kindOk && textOk;
  };

  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) ?? null : null;

  const selectedNodeTriples = useMemo(() => {
    if (!selectedNode) return [];
    return graph.triples.filter(
      (t) => t.sourceId === selectedNode.id || t.targetId === selectedNode.id
    );
  }, [selectedNode, graph.triples]);

  const bridgeNodes = useMemo(
    () => graph.nodes.filter((n) => n.kind === 'bridge'),
    [graph.nodes]
  );

  // Pair curve offsets so bidirectional or parallel triples don't overlap
  const edgeCurveOffsets = useMemo(() => {
    const counts = new Map();
    const seen = new Map();
    const offsets = {};

    for (const t of graph.triples) {
      const pairKey = [t.sourceId, t.targetId].sort().join('::');
      counts.set(pairKey, (counts.get(pairKey) ?? 0) + 1);
    }

    for (const t of graph.triples) {
      const pairKey = [t.sourceId, t.targetId].sort().join('::');
      const total = counts.get(pairKey) ?? 1;
      const idx = seen.get(pairKey) ?? 0;
      seen.set(pairKey, idx + 1);

      if (total === 1) {
        offsets[t.id] = 18;
      } else {
        const direction = t.sourceId < t.targetId ? 1 : -1;
        offsets[t.id] = (idx % 2 === 0 ? 1 : -1) * (24 + Math.floor(idx / 2) * 16) * direction;
      }
    }
    return offsets;
  }, [graph.triples]);

  const clientToSvgDelta = (dx, dy) => {
    const svg = svgRef.current;
    if (!svg) return { sx: dx / zoom, sy: dy / zoom };
    const rect = svg.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / Math.max(rect.width, 1);
    const scaleY = CANVAS_HEIGHT / Math.max(rect.height, 1);
    return {
      sx: (dx * scaleX) / zoom,
      sy: (dy * scaleY) / zoom,
    };
  };

  const handleSvgPointerDown = (e) => {
    if (e.button !== 0) return;
    dragStateRef.current = {
      type: 'pan',
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: pan.x,
      origY: pan.y,
      moved: false,
    };
  };

  const handleNodePointerDown = (e, nodeId) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const p = positions[nodeId] ?? { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    dragStateRef.current = {
      type: 'node',
      nodeId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: p.x,
      origY: p.y,
      moved: false,
    };
  };

  const handleSvgPointerMove = (e) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    const rawDx = e.clientX - drag.startClientX;
    const rawDy = e.clientY - drag.startClientY;
    if (Math.abs(rawDx) > 3 || Math.abs(rawDy) > 3) {
      drag.moved = true;
    }

    if (drag.type === 'pan') {
      const svg = svgRef.current;
      const rect = svg?.getBoundingClientRect();
      const scaleX = rect ? CANVAS_WIDTH / Math.max(rect.width, 1) : 1;
      const scaleY = rect ? CANVAS_HEIGHT / Math.max(rect.height, 1) : 1;
      setPan({
        x: drag.origX + rawDx * scaleX,
        y: drag.origY + rawDy * scaleY,
      });
    } else if (drag.type === 'node' && drag.nodeId) {
      const { sx, sy } = clientToSvgDelta(rawDx, rawDy);
      const targetId = drag.nodeId;
      setPositions((prev) => ({
        ...prev,
        [targetId]: {
          x: Math.max(54, Math.min(CANVAS_WIDTH - 54, drag.origX + sx)),
          y: Math.max(54, Math.min(CANVAS_HEIGHT - 54, drag.origY + sy)),
        },
      }));
    }
  };

  const handleSvgPointerUp = () => {
    const drag = dragStateRef.current;
    if (drag && drag.type === 'pan' && !drag.moved) {
      setSelectedNodeId(null);
    }
    dragStateRef.current = null;
  };

  // Dedicated native non-passive wheel listener on 2D SVG canvas
  // Modern browsers ignore e.preventDefault() in React's synthetic onWheel because it's registered as passive
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleNativeWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY < 0 ? 1.1 : 0.91;
      setZoom((z) => Math.max(0.55, Math.min(2.1, Number((z * factor).toFixed(2)))));
    };
    svg.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      svg.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  const handleExtractSubmit = (e) => {
    e.preventDefault();
    if (onExtractGraph) {
      onExtractGraph(focusInput.trim() || undefined);
    }
  };

  const handleRelayout = () => {
    if (viewMode === '3d') {
      setRelayoutSeq((s) => s + 1);
      setResetViewSeq((s) => s + 1);
    } else {
      setPositions(computeForceLayout(graph.nodes, graph.triples));
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  };

  const handleResetView = () => {
    if (viewMode === '3d') {
      setResetViewSeq((s) => s + 1);
    } else {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  };

  const getKindBadge = (kind) => {
    if (kind === 'bridge') {
      return {
        label: 'Cross-Doc Bridge',
        color: 'var(--h-accent)',
        bg: 'var(--h-accent-soft)',
        border: 'var(--h-accent)',
      };
    }
    if (kind === 'document') {
      return {
        label: 'Document Source',
        color: 'var(--h-amber)',
        bg: 'var(--h-elevated)',
        border: 'var(--h-border-strong)',
      };
    }
    return {
      label: 'Sub-Topic Concept',
      color: 'var(--h-mint)',
      bg: 'var(--h-elevated)',
      border: 'var(--h-border-strong)',
    };
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-4 gap-4">
      {/* Top Brain Map Control Bar */}
      <section
        className="rounded-xl border p-4 flex flex-col gap-3.5"
        style={{
          backgroundColor: 'var(--h-card)',
          borderColor: 'var(--h-border)',
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--h-accent-soft)',
                borderColor: 'var(--h-border-strong)',
                color: 'var(--h-accent)',
              }}
            >
              <Brain className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight" style={{ color: 'var(--h-text)' }}>Brain Map</h1>
                <span
                  className="text-[11px] font-mono px-2 py-0.5 rounded-md border"
                  style={{
                    backgroundColor: 'var(--h-elevated)',
                    borderColor: 'var(--h-border)',
                    color: 'var(--h-text-muted)',
                  }}
                >
                  {graph.focusTopic}
                </span>
              </div>
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--h-text-muted)' }}>
                Spider-web knowledge graph of relationship triples &amp; glowing cross-document bridges across {documents.length || 3} files.
              </p>
            </div>
          </div>

          {/* AI Triple Extraction Form */}
          <form onSubmit={handleExtractSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <div className="relative flex-1 sm:w-64">
              <Compass
                className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--h-text-dim)' }}
              />
              <input
                type="text"
                value={focusInput}
                onChange={(e) => setFocusInput(e.target.value)}
                placeholder="Focus topic (or leave blank for all)..."
                aria-label="Focus topic for AI graph extraction"
                className="w-full h-9 pl-8 pr-3 rounded-lg border text-xs focus:outline-none"
                style={{
                  backgroundColor: 'var(--h-elevated)',
                  borderColor: 'var(--h-border)',
                  color: 'var(--h-text)',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={isExtracting}
              className="h-9 px-3.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{
                backgroundColor: 'var(--h-accent)',
                color: 'var(--h-accent-fg)',
              }}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Mapping Triples…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Extract AI Graph</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Filter, Search & Graph View Controls */}
        <div
          className="pt-3 border-t flex flex-wrap items-center justify-between gap-2.5"
          style={{ borderColor: 'var(--h-border)' }}
        >
          <div className="flex flex-wrap items-center gap-2">
            {/* Kind Filter Tabs */}
            <div
              role="group"
              aria-label="Filter graph nodes"
              className="inline-flex rounded-lg border p-0.5"
              style={{
                backgroundColor: 'var(--h-elevated)',
                borderColor: 'var(--h-border)',
              }}
            >
              {[
                { id: 'all', label: 'All' },
                { id: 'bridge', label: 'Bridges' },
                { id: 'concept', label: 'Concepts' },
                { id: 'document', label: 'Documents' },
              ].map((tab) => {
                const active = kindFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setKindFilter(tab.id)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    style={{
                      backgroundColor: active ? 'var(--h-accent-soft)' : 'transparent',
                      color: active ? 'var(--h-accent)' : 'var(--h-text-muted)',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Find Node Input */}
            <div className="relative w-44 sm:w-52">
              <Search
                className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--h-text-dim)' }}
              />
              <input
                type="text"
                value={nodeSearch}
                onChange={(e) => setNodeSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && nodeSearch.trim()) {
                    const first = graph.nodes.find((n) =>
                      n.label.toLowerCase().includes(nodeSearch.trim().toLowerCase())
                    );
                    if (first) setSelectedNodeId(first.id);
                  }
                }}
                placeholder="Highlight a node…"
                aria-label="Highlight matching node"
                className="w-full h-8 pl-8 pr-7 rounded-lg border text-xs focus:outline-none"
                style={{
                  backgroundColor: 'var(--h-elevated)',
                  borderColor: 'var(--h-border)',
                  color: 'var(--h-text)',
                }}
              />
              {nodeSearch && (
                <button
                  type="button"
                  onClick={() => setNodeSearch('')}
                  aria-label="Clear node filter"
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
                  style={{ color: 'var(--h-text-dim)' }}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* 2D / 3D Switcher & Canvas Controls */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* 2D vs 3D Mode Toggle */}
            <div
              role="group"
              aria-label="Brain Map dimension mode"
              className="inline-flex rounded-lg border p-0.5 h-8 items-center"
              style={{
                backgroundColor: 'var(--h-elevated)',
                borderColor: 'var(--h-border)',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('2d')}
                className="px-2.5 h-full rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: viewMode === '2d' ? 'var(--h-accent-soft)' : 'transparent',
                  color: viewMode === '2d' ? 'var(--h-accent)' : 'var(--h-text-muted)',
                }}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>2D</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('3d')}
                className="px-2.5 h-full rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: viewMode === '3d' ? 'var(--h-accent-soft)' : 'transparent',
                  color: viewMode === '3d' ? 'var(--h-accent)' : 'var(--h-text-muted)',
                }}
              >
                <Box className="w-3.5 h-3.5" />
                <span>3D</span>
              </button>
            </div>

            {viewMode === '3d' && (
              <button
                type="button"
                onClick={() => setAutoRotate3D((v) => !v)}
                className="h-8 px-2.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                style={{
                  backgroundColor: autoRotate3D ? 'var(--h-accent-soft)' : 'var(--h-elevated)',
                  borderColor: autoRotate3D ? 'var(--h-accent)' : 'var(--h-border)',
                  color: autoRotate3D ? 'var(--h-accent)' : 'var(--h-text-muted)',
                }}
                title="Toggle smooth 3D orbital rotation"
              >
                <Orbit className="w-3.5 h-3.5" />
                <span>{autoRotate3D ? 'Orbit: On' : 'Orbit: Off'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAllEdgeLabels((v) => !v)}
              className="h-8 px-2.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              style={{
                backgroundColor: showAllEdgeLabels ? 'var(--h-accent-soft)' : 'var(--h-elevated)',
                borderColor: showAllEdgeLabels ? 'var(--h-accent)' : 'var(--h-border)',
                color: showAllEdgeLabels ? 'var(--h-accent)' : 'var(--h-text-muted)',
              }}
              title="Toggle relationship verb labels on all edges"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showAllEdgeLabels ? 'Labels: Always' : 'Labels: Focus'}</span>
            </button>

            <div
              className="inline-flex items-center rounded-lg border h-8 overflow-hidden"
              style={{
                backgroundColor: 'var(--h-elevated)',
                borderColor: 'var(--h-border)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (viewMode === '3d') {
                    setZoomStepSignal((s) => ({ seq: s.seq + 1, factor: 1.22 }));
                  } else {
                    setZoom((z) => Math.max(0.55, Number((z - 0.15).toFixed(2))));
                  }
                }}
                aria-label="Zoom out"
                className="h-full px-2 hover:opacity-80 cursor-pointer"
                style={{ color: 'var(--h-text-muted)' }}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span
                className="px-2 text-[11px] font-mono tabular-nums border-x"
                style={{ borderColor: 'var(--h-border)', color: 'var(--h-text)' }}
              >
                {viewMode === '3d' ? '3D' : `${Math.round(zoom * 100)}%`}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (viewMode === '3d') {
                    setZoomStepSignal((s) => ({ seq: s.seq + 1, factor: 0.82 }));
                  } else {
                    setZoom((z) => Math.min(2.1, Number((z + 0.15).toFixed(2))));
                  }
                }}
                aria-label="Zoom in"
                className="h-full px-2 hover:opacity-80 cursor-pointer"
                style={{ color: 'var(--h-text-muted)' }}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetView}
              title="Reset zoom and camera"
              className="h-8 px-2.5 rounded-lg border text-[11px] font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: 'var(--h-elevated)',
                borderColor: 'var(--h-border)',
                color: 'var(--h-text-muted)',
              }}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Center</span>
            </button>

            <button
              type="button"
              onClick={handleRelayout}
              title="Re-run spider-web layout physics"
              className="h-8 px-2.5 rounded-lg border text-[11px] font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: 'var(--h-elevated)',
                borderColor: 'var(--h-border)',
                color: 'var(--h-text-muted)',
              }}
            >
              <RefreshCw className="w-3 h-3" />
              <span>Re-layout</span>
            </button>
          </div>
        </div>
      </section>

      {extractError && (
        <div
          role="alert"
          className="rounded-xl border px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
          style={{
            backgroundColor: 'var(--h-card)',
            borderColor: 'var(--h-amber)',
            color: 'var(--h-text)',
          }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--h-amber)' }} />
            <span>{extractError}</span>
          </div>
          <button
            type="button"
            onClick={onResetDefaultGraph}
            className="text-xs font-semibold hover:underline cursor-pointer shrink-0"
            style={{ color: 'var(--h-accent)' }}
          >
            Restore Default Map
          </button>
        </div>
      )}

      {/* Main Split: Interactive Spider-Web Canvas + Concept & Triple Inspector */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
        {/* Left/Center Spider-Web Graph Viewport (2D SVG or 3D Three.js) */}
        <section
          className="relative rounded-xl border overflow-hidden min-h-[460px] xl:min-h-[580px] select-none overscroll-contain touch-none"
          style={{
            backgroundColor: 'var(--h-card)',
            borderColor: 'var(--h-border)',
            overscrollBehavior: 'contain',
            touchAction: 'none',
          }}
        >
          {viewMode === '3d' ? (
            <BrainMap3DCanvas
              graph={graph}
              kindFilter={kindFilter}
              searchLower={searchLower}
              selectedNodeId={selectedNodeId}
              hoveredNodeId={hoveredNodeId}
              showAllEdgeLabels={showAllEdgeLabels}
              autoRotate={autoRotate3D}
              zoomStepSignal={zoomStepSignal}
              resetViewSeq={resetViewSeq}
              relayoutSeq={relayoutSeq}
              onSelectNode={setSelectedNodeId}
              onHoverNode={setHoveredNodeId}
            />
          ) : (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
              className="w-full h-full block cursor-grab active:cursor-grabbing touch-none overscroll-contain"
              onPointerDown={handleSvgPointerDown}
              onPointerMove={handleSvgPointerMove}
              onPointerUp={handleSvgPointerUp}
              onPointerLeave={handleSvgPointerUp}
              role="img"
              aria-label="Interactive Brain Map knowledge graph"
            >
              <defs>
                {/* Architectural dot matrix pattern */}
                <pattern
                  id="brain-grid-dots"
                  width="28"
                  height="28"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="14" cy="14" r="1" fill="var(--h-border-strong)" opacity="0.45" />
                </pattern>

                {/* Ambient glow for cross-document bridge nodes */}
                <radialGradient id="bridge-aura-grad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="var(--h-accent)" stopOpacity="0.46" />
                  <stop offset="55%" stopColor="var(--h-accent)" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="var(--h-accent)" stopOpacity="0" />
                </radialGradient>

                <filter id="bridge-soft-glow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                <marker
                  id="arrow-default"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="5.5"
                  markerHeight="5.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--h-border-strong)" />
                </marker>

                <marker
                  id="arrow-active"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--h-accent)" />
                </marker>
              </defs>

              {/* Subtle Background */}
              <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#brain-grid-dots)" />

              {/* Pan & Zoom World Transform */}
              <g
                transform={`translate(${CANVAS_WIDTH / 2 + pan.x}, ${
                  CANVAS_HEIGHT / 2 + pan.y
                }) scale(${zoom}) translate(${-CANVAS_WIDTH / 2}, ${-CANVAS_HEIGHT / 2})`}
              >
                {/* Relationship Triple Edges */}
                {graph.triples.map((triple) => {
                  const pA = positions[triple.sourceId];
                  const pB = positions[triple.targetId];
                  const sourceNode = nodeById.get(triple.sourceId);
                  const targetNode = nodeById.get(triple.targetId);
                  if (!pA || !pB || !sourceNode || !targetNode) return null;

                  const bothVisible =
                    matchesFilterAndSearch(sourceNode) && matchesFilterAndSearch(targetNode);
                  const isEdgeFocused = activeFocusId
                    ? connectedToFocus.tripleIds.has(triple.id)
                    : false;

                  let edgeOpacity = 0.65;
                  if (!bothVisible) edgeOpacity = 0.12;
                  else if (activeFocusId) edgeOpacity = isEdgeFocused ? 1 : 0.14;

                  const dx = pB.x - pA.x;
                  const dy = pB.y - pA.y;
                  const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
                  const nx = -dy / dist;
                  const ny = dx / dist;
                  const curveOffset = edgeCurveOffsets[triple.id] ?? 18;

                  // Trim endpoints slightly outside node radii so arrowheads sit cleanly on node borders
                  const rStart =
                    sourceNode.kind === 'document' ? 25 : sourceNode.kind === 'bridge' ? 23 : 17;
                  const rEnd =
                    targetNode.kind === 'document' ? 27 : targetNode.kind === 'bridge' ? 25 : 19;

                  const startX = pA.x + (dx / dist) * rStart;
                  const startY = pA.y + (dy / dist) * rStart;
                  const endX = pB.x - (dx / dist) * rEnd;
                  const endY = pB.y - (dy / dist) * rEnd;

                  const midX = (startX + endX) / 2 + nx * curveOffset;
                  const midY = (startY + endY) / 2 + ny * curveOffset;
                  // Quadratic bezier midpoint at t=0.5
                  const labelX = 0.25 * startX + 0.5 * midX + 0.25 * endX;
                  const labelY = 0.25 * startY + 0.5 * midY + 0.25 * endY;

                  const involvesBridge =
                    sourceNode.kind === 'bridge' || targetNode.kind === 'bridge';

                  const showLabel =
                    bothVisible && (isEdgeFocused || (showAllEdgeLabels && !activeFocusId));

                  return (
                    <g key={triple.id} style={{ opacity: edgeOpacity, transition: 'opacity 160ms ease' }}>
                      <path
                        d={`M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`}
                        fill="none"
                        stroke={
                          isEdgeFocused
                            ? 'var(--h-accent)'
                            : involvesBridge
                              ? 'var(--h-border-strong)'
                              : 'var(--h-border)'
                        }
                        strokeWidth={isEdgeFocused ? 2.2 : involvesBridge ? 1.5 : 1.2}
                        markerEnd={isEdgeFocused ? 'url(#arrow-active)' : 'url(#arrow-default)'}
                      />
                      {showLabel && (
                        <g transform={`translate(${labelX}, ${labelY})`} className="pointer-events-none">
                          <rect
                            x={-(triple.relation.length * 3.2 + 8)}
                            y={-9}
                            width={triple.relation.length * 6.4 + 16}
                            height={18}
                            rx={5}
                            fill="var(--h-bg)"
                            stroke={isEdgeFocused ? 'var(--h-accent)' : 'var(--h-border-strong)'}
                            strokeWidth={1}
                          />
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize="9.5"
                            fontWeight="600"
                            fill={isEdgeFocused ? 'var(--h-accent)' : 'var(--h-text-muted)'}
                          >
                            {triple.relation}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Graph Nodes */}
                {graph.nodes.map((node) => {
                  const pos = positions[node.id];
                  if (!pos) return null;

                  const visibleMatch = matchesFilterAndSearch(node);
                  const isSelected = selectedNodeId === node.id;
                  const isHovered = hoveredNodeId === node.id;
                  const isNeighbor = activeFocusId
                    ? connectedToFocus.nodeIds.has(node.id)
                    : true;

                  let nodeOpacity = 1;
                  if (!visibleMatch) nodeOpacity = 0.16;
                  else if (activeFocusId && !isNeighbor) nodeOpacity = 0.22;

                  const lines = splitLabelLines(node.label);
                  const distinctDocsCount = new Set((node.sources || []).map((s) => s.documentId)).size;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                      onPointerEnter={() => setHoveredNodeId(node.id)}
                      onPointerLeave={() =>
                        setHoveredNodeId((prev) => (prev === node.id ? null : prev))
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
                      }}
                      className="cursor-pointer"
                      style={{ opacity: nodeOpacity, transition: 'opacity 160ms ease' }}
                    >
                      {/* Glowing Bridge Node */}
                      {node.kind === 'bridge' && (
                        <>
                          <circle r={42} fill="url(#bridge-aura-grad)" />
                          <circle
                            r={27}
                            fill="none"
                            stroke="var(--h-accent)"
                            strokeOpacity={isSelected || isHovered ? 0.9 : 0.45}
                            strokeWidth={isSelected ? 2 : 1.2}
                            strokeDasharray="4 3"
                          />
                          <circle
                            r={20}
                            fill="var(--h-accent)"
                            stroke="var(--h-bg)"
                            strokeWidth={2.5}
                            filter="url(#bridge-soft-glow)"
                          />
                          {/* Merge/bridge glyph */}
                          <circle cx="-4" cy="-4" r="2.2" fill="var(--h-accent-fg)" />
                          <circle cx="4" cy="-4" r="2.2" fill="var(--h-accent-fg)" />
                          <circle cx="0" cy="5" r="2.2" fill="var(--h-accent-fg)" />
                          <path
                            d="M -4 -2 L 0 3 L 4 -2"
                            fill="none"
                            stroke="var(--h-accent-fg)"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                          {distinctDocsCount >= 2 && (
                            <g transform="translate(15, -15)">
                              <circle
                                r={8.5}
                                fill="var(--h-bg)"
                                stroke="var(--h-accent)"
                                strokeWidth={1.4}
                              />
                              <text
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontSize="8.5"
                                fontWeight="700"
                                fill="var(--h-accent)"
                              >
                                {distinctDocsCount}
                              </text>
                            </g>
                          )}
                        </>
                      )}

                      {/* Document Hub Node */}
                      {node.kind === 'document' && (
                        <>
                          {isSelected && (
                            <rect
                              x={-27}
                              y={-27}
                              width={54}
                              height={54}
                              rx={14}
                              fill="none"
                              stroke="var(--h-amber)"
                              strokeWidth={2}
                              strokeOpacity={0.75}
                            />
                          )}
                          <rect
                            x={-21}
                            y={-21}
                            width={42}
                            height={42}
                            rx={11}
                            fill="var(--h-elevated)"
                            stroke={isSelected || isHovered ? 'var(--h-amber)' : 'var(--h-border-strong)'}
                            strokeWidth={isSelected ? 2.2 : 1.6}
                          />
                          {/* Document sheet icon */}
                          <path
                            d="M -6 -8 H 2 L 6 -4 V 8 H -6 Z"
                            fill="none"
                            stroke="var(--h-amber)"
                            strokeWidth="1.7"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M -3 -1 H 3 M -3 3 H 3"
                            stroke="var(--h-amber)"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </>
                      )}

                      {/* Sub-Topic Concept Node */}
                      {node.kind === 'concept' && (
                        <>
                          {isSelected && (
                            <circle
                              r={22}
                              fill="none"
                              stroke="var(--h-mint)"
                              strokeWidth={2}
                              strokeOpacity={0.75}
                            />
                          )}
                          <circle
                            r={15}
                            fill="var(--h-elevated)"
                            stroke={isSelected || isHovered ? 'var(--h-mint)' : 'var(--h-border-strong)'}
                            strokeWidth={isSelected ? 2.2 : 1.5}
                          />
                          <circle r={5.5} fill="var(--h-mint)" />
                        </>
                      )}

                      {/* Haloed Node Label */}
                      <g transform={`translate(0, ${node.kind === 'document' ? 34 : node.kind === 'bridge' ? 35 : 28})`}>
                        {lines.map((line, i) => (
                          <text
                            key={i}
                            y={i * 13}
                            textAnchor="middle"
                            fontSize={node.kind === 'concept' ? '10.5' : '11.5'}
                            fontWeight={node.kind === 'bridge' ? '700' : '600'}
                            fill={
                              node.kind === 'bridge'
                                ? 'var(--h-accent)'
                                : 'var(--h-text)'
                            }
                            stroke="var(--h-bg)"
                            strokeWidth={4}
                            paintOrder="stroke"
                            strokeLinejoin="round"
                          >
                            {line}
                          </text>
                        ))}
                      </g>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}

          {/* Top-left extraction overlay badge while AI is building */}
          {isExtracting && (
            <div
              className="absolute top-3 left-3 px-3 py-2 rounded-lg border flex items-center gap-2 text-xs font-medium shadow-lg z-30"
              style={{
                backgroundColor: 'var(--h-card)',
                borderColor: 'var(--h-accent)',
                color: 'var(--h-text)',
              }}
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--h-accent)' }} />
              <span>Extracting entity relationship triples across your documents…</span>
            </div>
          )}

          {/* Bottom-left Legend & Interaction Guide */}
          <div
            className="absolute bottom-3 left-3 right-3 sm:right-auto rounded-lg border px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] z-30"
            style={{
              backgroundColor: 'var(--h-sidebar)',
              borderColor: 'var(--h-border)',
              color: 'var(--h-text-muted)',
            }}
          >
            <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: 'var(--h-accent)' }}>
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: 'var(--h-accent)',
                  boxShadow: '0 0 8px var(--h-accent)',
                }}
              />
              Glowing Bridge (2+ docs)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm border"
                style={{
                  backgroundColor: 'var(--h-elevated)',
                  borderColor: 'var(--h-amber)',
                }}
              />
              Document
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: 'var(--h-mint)' }}
              />
              Sub-Topic
            </span>
            <span className="hidden md:inline" style={{ color: 'var(--h-text-dim)' }}>
              {viewMode === '3d'
                ? '· Drag to orbit · Scroll to zoom · Right-drag to pan · Click node to focus'
                : '· Drag nodes · Scroll to zoom · Click to inspect'}
            </span>
          </div>
        </section>

        {/* Right Inspector Panel */}
        <aside
          className="rounded-xl border flex flex-col min-h-[420px] xl:min-h-[580px] overflow-hidden"
          style={{
            backgroundColor: 'var(--h-card)',
            borderColor: 'var(--h-border)',
          }}
        >
          {selectedNode ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4 overscroll-contain">
              {/* Node Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {(() => {
                    const badge = getKindBadge(selectedNode.kind);
                    return (
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold"
                        style={{
                          backgroundColor: badge.bg,
                          borderColor: badge.border,
                          color: badge.color,
                        }}
                      >
                        {selectedNode.kind === 'bridge' ? (
                          <GitMerge className="w-3 h-3" />
                        ) : selectedNode.kind === 'document' ? (
                          <FileText className="w-3 h-3" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        {badge.label}
                      </span>
                    );
                  })()}
                  <h2 className="mt-2 text-base font-bold leading-snug" style={{ color: 'var(--h-text)' }}>
                    {selectedNode.label}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNodeId(null)}
                  aria-label="Back to graph overview"
                  className="p-1.5 rounded-lg border cursor-pointer shrink-0"
                  style={{
                    backgroundColor: 'var(--h-elevated)',
                    borderColor: 'var(--h-border)',
                    color: 'var(--h-text-muted)',
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs leading-relaxed" style={{ color: 'var(--h-text-muted)' }}>
                {selectedNode.summary}
              </p>

              {/* Quick Ask Smart Search CTA */}
              {selectedNode.sources && selectedNode.sources[0] && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenPageInSearch &&
                    onOpenPageInSearch(
                      selectedNode.sources[0].documentId,
                      selectedNode.sources[0].pageNumber,
                      `Explain "${selectedNode.label}" and how it connects across my documents.`
                    )
                  }
                  className="w-full h-9 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: 'var(--h-accent)',
                    color: 'var(--h-accent-fg)',
                  }}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Ask Smart Search About This Node</span>
                </button>
              )}

              {/* Connected Relationship Triples */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3
                    className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: 'var(--h-text-dim)' }}
                  >
                    Relationship Triples ({selectedNodeTriples.length})
                  </h3>
                </div>
                <div className="space-y-1.5">
                  {selectedNodeTriples.map((triple) => {
                    const isOutgoing = triple.sourceId === selectedNode.id;
                    const partnerId = isOutgoing ? triple.targetId : triple.sourceId;
                    const partner = nodeById.get(partnerId);
                    if (!partner) return null;

                    return (
                      <button
                        key={triple.id}
                        type="button"
                        onClick={() => setSelectedNodeId(partner.id)}
                        className="w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer hover:opacity-95"
                        style={{
                          backgroundColor: 'var(--h-elevated)',
                          borderColor: 'var(--h-border)',
                        }}
                      >
                        <div className="flex items-center flex-wrap gap-1.5 text-xs">
                          <span className="font-semibold" style={{ color: 'var(--h-text)' }}>
                            {isOutgoing ? selectedNode.label : partner.label}
                          </span>
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                            style={{
                              backgroundColor: 'var(--h-accent-soft)',
                              color: 'var(--h-accent)',
                            }}
                          >
                            {triple.relation}
                          </span>
                          <ArrowRight className="w-3 h-3 shrink-0" style={{ color: 'var(--h-text-dim)' }} />
                          <span
                            className="font-semibold"
                            style={{
                              color:
                                partner.kind === 'bridge'
                                  ? 'var(--h-accent)'
                                  : partner.kind === 'document'
                                    ? 'var(--h-amber)'
                                    : 'var(--h-mint)',
                            }}
                          >
                            {isOutgoing ? partner.label : selectedNode.label}
                          </span>
                        </div>
                        {triple.fileName && (
                          <div className="mt-1 text-[10px] font-mono" style={{ color: 'var(--h-text-dim)' }}>
                            {triple.fileName} · Page {triple.pageNumber ?? 1}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cited Source Pages */}
              <div className="space-y-2 pt-1">
                <h3
                  className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: 'var(--h-text-dim)' }}
                >
                  Source Pages ({(selectedNode.sources || []).length})
                </h3>
                <div className="space-y-1.5">
                  {(selectedNode.sources || []).map((src, idx) => (
                    <button
                      key={`${src.documentId}-${src.pageNumber}-${idx}`}
                      type="button"
                      onClick={() => onOpenPageInSearch && onOpenPageInSearch(src.documentId, src.pageNumber)}
                      className="w-full p-2.5 rounded-lg border flex items-center justify-between gap-2 text-left cursor-pointer transition-colors hover:opacity-95"
                      style={{
                        backgroundColor: 'var(--h-elevated)',
                        borderColor: 'var(--h-border-strong)',
                      }}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate" style={{ color: 'var(--h-text)' }}>{src.fileName}</div>
                        <div className="text-[11px] font-mono" style={{ color: 'var(--h-mint)' }}>
                          Page {src.pageNumber}
                        </div>
                      </div>
                      <span
                        className="text-[11px] font-semibold inline-flex items-center gap-1 shrink-0"
                        style={{ color: 'var(--h-accent)' }}
                      >
                        Open <ExternalLink className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 space-y-5 overscroll-contain">
              {/* Overview Stats */}
              <div>
                <h2 className="text-sm font-bold" style={{ color: 'var(--h-text)' }}>Knowledge Web Overview</h2>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--h-text-muted)' }}>
                  Click any node in the spider-web—or select a glowing bridge below—to trace how topics connect across your files.
                </p>

                <div
                  className="mt-3 rounded-lg border grid grid-cols-3 divide-x text-center py-2.5"
                  style={{
                    backgroundColor: 'var(--h-elevated)',
                    borderColor: 'var(--h-border)',
                  }}
                >
                  <div className="px-2" style={{ borderColor: 'var(--h-border)' }}>
                    <div className="font-mono text-base font-bold tabular-nums" style={{ color: 'var(--h-text)' }}>
                      {graph.nodes.length}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--h-text-dim)' }}>
                      Nodes
                    </div>
                  </div>
                  <div className="px-2" style={{ borderColor: 'var(--h-border)' }}>
                    <div className="font-mono text-base font-bold tabular-nums" style={{ color: 'var(--h-mint)' }}>
                      {graph.triples.length}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--h-text-dim)' }}>
                      Triples
                    </div>
                  </div>
                  <div className="px-2" style={{ borderColor: 'var(--h-border)' }}>
                    <div className="font-mono text-base font-bold tabular-nums" style={{ color: 'var(--h-accent)' }}>
                      {bridgeNodes.length}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--h-text-dim)' }}>
                      Bridges
                    </div>
                  </div>
                </div>
              </div>

              {/* Glowing Cross-Document Bridges List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3
                    className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: 'var(--h-accent)' }}
                  >
                    Glowing Cross-Document Bridges
                  </h3>
                </div>
                {bridgeNodes.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--h-text-dim)' }}>
                    No cross-document bridges matched yet. Try extracting with a broader focus topic.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {bridgeNodes.map((bridge) => {
                      const docNames = Array.from(new Set((bridge.sources || []).map((s) => s.fileName)));
                      return (
                        <button
                          key={bridge.id}
                          type="button"
                          onClick={() => setSelectedNodeId(bridge.id)}
                          className="w-full text-left p-3 rounded-lg border transition-colors cursor-pointer hover:opacity-95"
                          style={{
                            backgroundColor: 'var(--h-elevated)',
                            borderColor: 'var(--h-border-strong)',
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--h-accent)' }}>
                              <GitMerge className="w-3.5 h-3.5 shrink-0" />
                              <span>{bridge.label}</span>
                            </span>
                            <span
                              className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: 'var(--h-accent-soft)',
                                color: 'var(--h-accent)',
                              }}
                            >
                              {docNames.length} files
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] line-clamp-2" style={{ color: 'var(--h-text-muted)' }}>
                            {bridge.summary}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {docNames.map((name) => (
                              <span
                                key={name}
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                                style={{
                                  backgroundColor: 'var(--h-card)',
                                  borderColor: 'var(--h-border)',
                                  color: 'var(--h-text-dim)',
                                }}
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick AI Topic Lenses */}
              <div className="space-y-2 pt-1">
                <h3
                  className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: 'var(--h-text-dim)' }}
                >
                  Generate Focused AI Map
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {TOPIC_LENSES.map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      disabled={isExtracting}
                      onClick={() => {
                        setFocusInput(topic);
                        if (onExtractGraph) onExtractGraph(topic);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors hover:opacity-90 disabled:opacity-50"
                      style={{
                        backgroundColor: 'var(--h-elevated)',
                        borderColor: 'var(--h-border)',
                        color: 'var(--h-text)',
                      }}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default BrainMapView;
