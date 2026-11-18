import { useState, useRef, useEffect, useMemo } from "react";
import ForceGraph3D from "react-force-graph-3d";
import "./BrainMap.css";

// Brain Map page — the user enters a document ID, the backend returns that
// document's key concepts and their links, and we draw them as a concept
// network. Two views: a labelled 2D map (default) and a 3D network.
// Standalone module: no dashboard/sidebar/routing. It uses Krishi's HELIOS
// theme variables, so it matches whichever theme is active.

// ---------- Small helpers ----------

// A link's end as an id. The 3D library swaps ids for node objects once it
// starts, so we handle both.
const endId = (end) => (typeof end === "object" ? end.id : end);

// Groups each concept by how connected it is, using only backend data:
// top third = "core", middle = "linked", the rest = "outer".
function tierOf(connections, maxConnections) {
  if (maxConnections === 0) return "outer";
  const share = connections / maxConnections;
  if (share >= 0.67) return "core";
  if (share >= 0.34) return "linked";
  return "outer";
}

const TIER_LABELS = { core: "Core", linked: "Linked", outer: "Outer" };

// Node ring size on screen, in pixels, per group.
const TIER_RADIUS = { core: 17, linked: 14, outer: 12 };

// Shortens long concept names so labels don't pile on top of each other.
const shorten = (text, max = 24) => (text.length > max ? text.slice(0, max - 1) + "…" : text);

// ---------- 2D layout ----------

// Works out where each concept sits on the 2D map, like a tiny physics
// simulation: every concept pushes the others away, every link pulls its
// two ends together, and a light pull keeps everything near the centre.
// Starting from a circle makes the result the same every time.
function computeLayout(nodes, links, hubId) {
  const positions = {};
  const count = nodes.length;
  if (count === 0) return positions;
  if (count === 1) {
    positions[nodes[0].id] = { x: 0, y: 0 };
    return positions;
  }

  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / count;
    positions[node.id] = { x: Math.cos(angle) * 300, y: Math.sin(angle) * 300 };
  });
  // The central concept sits in the middle and never moves.
  if (positions[hubId]) positions[hubId] = { x: 0, y: 0 };

  const ideal = 170; // preferred distance between linked concepts
  let step = 60; // how far a concept may move per round; shrinks over time

  for (let round = 0; round < 300; round++) {
    const move = {};
    nodes.forEach((n) => (move[n.id] = { x: 0, y: 0 }));

    // Push every pair apart.
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const a = positions[nodes[i].id];
        const b = positions[nodes[j].id];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.max(Math.hypot(dx, dy), 1);
        const push = (ideal * ideal) / dist;
        move[nodes[i].id].x += (dx / dist) * push;
        move[nodes[i].id].y += (dy / dist) * push;
        move[nodes[j].id].x -= (dx / dist) * push;
        move[nodes[j].id].y -= (dy / dist) * push;
      }
    }

    // Pull linked concepts together.
    links.forEach((link) => {
      const s = endId(link.source);
      const t = endId(link.target);
      const a = positions[s];
      const b = positions[t];
      if (!a || !b) return;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.max(Math.hypot(dx, dy), 1);
      const pull = (dist * dist) / ideal;
      move[s].x -= (dx / dist) * pull;
      move[s].y -= (dy / dist) * pull;
      move[t].x += (dx / dist) * pull;
      move[t].y += (dy / dist) * pull;
    });

    // Gently pull everything toward the centre, then take the step.
    nodes.forEach((n) => {
      if (n.id === hubId) return; // the centre stays put
      const p = positions[n.id];
      const m = move[n.id];
      m.x -= p.x * 0.12;
      m.y -= p.y * 0.12;
      const length = Math.hypot(m.x, m.y);
      if (length > 0) {
        const distance = Math.min(length, step);
        p.x += (m.x / length) * distance;
        p.y += (m.y / length) * distance;
      }
    });

    step = Math.max(step * 0.97, 1);
  }

  // Keep a clear space around the central concept, so nothing sits on top
  // of the brain badge.
  nodes.forEach((n, i) => {
    if (n.id === hubId) return;
    const p = positions[n.id];
    const dist = Math.hypot(p.x, p.y);
    const minDist = 150;
    if (dist < minDist) {
      const angle = dist > 1 ? Math.atan2(p.y, p.x) : (2 * Math.PI * i) / count;
      p.x = Math.cos(angle) * minDist;
      p.y = Math.sin(angle) * minDist;
    }
  });

  return positions;
}

// The area that holds every concept, plus a margin, as {cx, cy, w, h}.
function boundsOf(positions) {
  const points = Object.values(positions);
  if (points.length === 0) return { cx: 0, cy: 0, w: 800, h: 500 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = Math.max(maxX - minX, 200);
  const h = Math.max(maxY - minY, 200);
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: w * 1.12 + 80, h: h * 1.12 + 80 };
}

// ---------- 3D colours (the 3D library needs real colour values) ----------

const FALLBACK_COLORS = { core: "#f58bd5", linked: "#83cbe7", outer: "#9bd3b0", muted: "#bd91aa" };

function readColors(element) {
  const read = (name, fallback) => {
    if (!element) return fallback;
    return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
  };
  return {
    core: read("--bm-core", FALLBACK_COLORS.core),
    linked: read("--bm-linked", FALLBACK_COLORS.linked),
    outer: read("--bm-outer", FALLBACK_COLORS.outer),
    muted: read("--bm-muted", FALLBACK_COLORS.muted),
  };
}

// ---------- Icons ----------

const BrainIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 4.5A3.5 3.5 0 0 0 5.5 8v.5A3.5 3.5 0 0 0 4 11.5 3.5 3.5 0 0 0 7.5 15H8v1a3 3 0 0 0 3 3h1V5a3 3 0 0 0-3-3" />
    <path d="M15 4.5A3.5 3.5 0 0 1 18.5 8v.5a3.5 3.5 0 0 1 1.5 3 3.5 3.5 0 0 1-3.5 3H16v1a3 3 0 0 1-3 3h-1V5a3 3 0 0 1 3-3" />
  </svg>
);

// ======================================================================

export default function BrainMap() {
  const [documentId, setDocumentId] = useState("");
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [mapId, setMapId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [view, setView] = useState("3d"); // "2d" or "3d"
  const [hubId, setHubId] = useState(null); // the central concept

  // Can this browser draw 3D right now? Chrome turns 3D off for a page after
  // repeated graphics crashes, until the browser is restarted.
  const [webglOk, setWebglOk] = useState(() => {
    try {
      const test = document.createElement("canvas");
      return Boolean(test.getContext("webgl2") || test.getContext("webgl"));
    } catch {
      return false;
    }
  });
  const activeView = webglOk ? view : "2d";

  // 2D map state
  const [positions, setPositions] = useState({}); // where each concept sits
  const [frame, setFrame] = useState({ cx: 0, cy: 0, w: 800, h: 500 }); // area that fits the map
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef(null); // what the mouse is dragging right now

  const pageRef = useRef(null);
  const canvasRef = useRef(null); // the graph area, measured for its size
  const svgRef = useRef(null);
  const graph3dRef = useRef(null);
  const fitPending3d = useRef(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [colors, setColors] = useState(FALLBACK_COLORS);

  // Measure the graph area (and re-measure when the window resizes).
  useEffect(() => {
    const box = canvasRef.current;
    if (!box) return;
    const measure = () => setSize({ width: box.clientWidth, height: box.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    measure();
    return () => observer.disconnect();
  }, []);

  // Re-read theme colours after each render, for the 3D view.
  useEffect(() => {
    const next = readColors(pageRef.current);
    if (JSON.stringify(next) !== JSON.stringify(colors)) setColors(next);
  });

  // Mouse-wheel zoom on the 2D map. Added by hand so the page itself
  // doesn't scroll while zooming.
  useEffect(() => {
    const box = canvasRef.current;
    if (!box) return;
    const onWheel = (e) => {
      if (graphData.nodes.length === 0) return;
      // Stops the whole browser window from zooming or scrolling while the
      // mouse is over the map (including touchpad pinch).
      e.preventDefault();
      if (activeView === "2d") {
        setZoom((z) => Math.min(Math.max(z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.4), 5));
      }
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, [activeView, graphData]);

  // ---------- Derived data ----------

  const nodesById = useMemo(() => {
    const map = {};
    graphData.nodes.forEach((n) => (map[n.id] = n));
    return map;
  }, [graphData]);

  const neighbours = useMemo(() => {
    const map = {};
    graphData.nodes.forEach((n) => (map[n.id] = new Set()));
    graphData.links.forEach((l) => {
      const a = endId(l.source);
      const b = endId(l.target);
      map[a]?.add(b);
      map[b]?.add(a);
    });
    return map;
  }, [graphData]);

  const ranked = useMemo(
    () => [...graphData.nodes].sort((a, b) => b.connections - a.connections),
    [graphData]
  );

  const selectedNode = selectedId ? nodesById[selectedId] : null;
  const focusId = selectedId || hoveredId;
  const isLit = (id) => !focusId || id === focusId || neighbours[focusId]?.has(id);
  const touchesFocus = (link) =>
    focusId && (endId(link.source) === focusId || endId(link.target) === focusId);

  // 3D spacing: concepts push each other apart ("charge") and links have a
  // preferred length ("distance"). Small maps get more room per concept.
  useEffect(() => {
    const graph = graph3dRef.current;
    const count = graphData.nodes.length;
    if (activeView !== "3d" || !graph || count === 0) return;
    graph.d3Force("charge").strength(count < 15 ? -500 : -450);
    graph.d3Force("link").distance(count < 15 ? 140 : 160);
    graph.d3ReheatSimulation();
    fitPending3d.current = true;
  }, [graphData, activeView]);

  // Floating name tags for the 3D view. Every frame, each tag is moved to
  // its concept's position on screen. Tags further from the camera fade, so
  // the map has depth. These are plain HTML, so no extra package is needed.
  const labelLayerRef = useRef(null);
  useEffect(() => {
    if (activeView !== "3d" || graphData.nodes.length === 0) return;
    let frameId;
    const update = () => {
      const graph = graph3dRef.current;
      const layer = labelLayerRef.current;
      if (graph && layer) {
        const cam = graph.camera().position;
        const distances = graphData.nodes.map((n) =>
          Math.hypot(cam.x - (n.x || 0), cam.y - (n.y || 0), cam.z - (n.z || 0))
        );
        const near = Math.min(...distances);
        const far = Math.max(...distances);
        for (const tag of layer.children) {
          const node = nodesById[tag.dataset.id];
          if (!node || node.x === undefined) continue;
          const { x, y } = graph.graph2ScreenCoords(node.x, node.y, node.z);
          const d = Math.hypot(cam.x - node.x, cam.y - node.y, cam.z - node.z);
          const depth = far > near ? (d - near) / (far - near) : 0; // 0 = closest
          tag.style.transform = `translate(${x}px, ${y}px)`;
          tag.style.opacity = tag.dataset.lit === "1" ? String(1 - depth * 0.55) : "0.12";
          tag.style.zIndex = String(1000 - Math.round(depth * 900));
        }
      }
      frameId = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frameId);
  }, [activeView, graphData, nodesById]);

  // Calmer 3D controls, and a safety net: if the browser's 3D graphics
  // (WebGL) crash, switch to the 2D map instead of showing a black box.
  useEffect(() => {
    const graph = graph3dRef.current;
    if (activeView !== "3d" || !graph) return;
    const controls = graph.controls();
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.6;
    controls.panSpeed = 0.6;
    const canvas = graph.renderer().domElement;
    const onLost = (e) => {
      e.preventDefault();
      setWebglOk(false);
      setView("2d");
    };
    canvas.addEventListener("webglcontextlost", onLost);
    return () => canvas.removeEventListener("webglcontextlost", onLost);
  }, [activeView, graphData]);

  // ---------- Generate ----------

  function handleGenerate() {
    if (!documentId) {
      setError("Please enter a document ID.");
      setGraphData({ nodes: [], links: [] });
      setSelectedId(null);
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedId(null);
    setHoveredId(null);

    fetch("http://localhost:8001/api/brainmap/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: Number(documentId) }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          const detail = errorData?.detail?.[0]?.msg || "Failed to generate brain map.";
          throw new Error(detail);
        }
        return res.json();
      })
      .then((data) => {
        if (data.nodes.length === 0) {
          setError("No concepts found for this document. It may not exist or may be empty.");
          setGraphData({ nodes: [], links: [] });
          setLoading(false);
          return;
        }

        // Count each concept's connections from the edges sent (no API change).
        const connections = {};
        data.nodes.forEach((n) => (connections[n.id] = 0));
        data.edges.forEach((e) => {
          connections[e.source] += 1;
          connections[e.target] += 1;
        });
        const maxConnections = Math.max(...Object.values(connections));

        const nodes = data.nodes.map((n) => ({
          ...n,
          connections: connections[n.id],
          tier: tierOf(connections[n.id], maxConnections),
          // 3D dot size: grows slowly, so busy concepts don't become giant balls.
          val: 1 + Math.sqrt(connections[n.id]),
        }));

        // The central concept = the most connected one. The API sends no
        // document title, so this is the concept the document revolves around.
        const hub = nodes.reduce((best, n) => (n.connections > best.connections ? n : best), nodes[0]);
        // Fix it at the centre of the 3D space too.
        hub.fx = 0;
        hub.fy = 0;
        hub.fz = 0;
        const links = data.edges.map((e) => ({
          source: e.source,
          target: e.target,
          relationship: e.relationship,
        }));

        const layout = computeLayout(nodes, links, hub.id);
        setPositions(layout);
        setFrame(boundsOf(layout));
        setZoom(1);
        setPan({ x: 0, y: 0 });
        fitPending3d.current = true;

        setHubId(hub.id);
        setMapId(data.map_id);
        setGraphData({ nodes, links });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }

  // ---------- 2D map: view, drag, select ----------

  // The visible part of the map, after zoom and pan.
  const viewW = frame.w / zoom;
  const viewH = frame.h / zoom;
  const viewX = frame.cx + pan.x - viewW / 2;
  const viewY = frame.cy + pan.y - viewH / 2;

  // Map units per screen pixel. Used to keep rings and labels the same size
  // on screen at any zoom level.
  const scale = size.width > 0 ? Math.min(size.width / viewW, size.height / viewH) : 1;
  const px = (pixels) => pixels / scale;

  // Turns a mouse position on screen into a position on the map.
  function toMapPoint(e) {
    const svg = svgRef.current;
    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }

  function startNodeDrag(e, id) {
    e.stopPropagation();
    svgRef.current.setPointerCapture(e.pointerId);
    drag.current = { type: "node", id, sx: e.clientX, sy: e.clientY, moved: false };
  }

  function startPan(e) {
    svgRef.current.setPointerCapture(e.pointerId);
    drag.current = { type: "pan", sx: e.clientX, sy: e.clientY, start: pan, moved: false };
  }

  function handlePointerMove(e) {
    const d = drag.current;
    if (!d) return;
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 3) d.moved = true;
    if (!d.moved) return;

    if (d.type === "node") {
      // A dragged concept stays wherever you drop it.
      const p = toMapPoint(e);
      setPositions((prev) => ({ ...prev, [d.id]: { x: p.x, y: p.y } }));
    } else {
      setPan({
        x: d.start.x - (e.clientX - d.sx) / scale,
        y: d.start.y - (e.clientY - d.sy) / scale,
      });
    }
  }

  function handlePointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    // A click without dragging: select the concept, or clear on empty space.
    if (d.type === "node") focusOn(d.id);
    else setSelectedId(null);
  }

  // Selects a concept and centres the view on it.
  function focusOn(id) {
    setSelectedId(id);
    if (activeView === "2d") {
      const p = positions[id];
      if (p) {
        setPan({ x: p.x - frame.cx, y: p.y - frame.cy });
        setZoom((z) => Math.max(z, 1.4));
      }
    } else {
      const node = nodesById[id];
      const graph = graph3dRef.current;
      if (!node || !graph) return;
        const { x = 0, y = 0, z = 0 } = node;
      // Fly toward the concept from the side we're already looking from,
      // so the central brain badge doesn't end up in front of it.
      const cam = graph.camera().position;
      const dx = cam.x - x;
      const dy = cam.y - y;
      const dz = cam.z - z;
      const length = Math.hypot(dx, dy, dz) || 1;
      const distance = 380; // close enough to read, far enough to see its links
      const camera = { x: x + (dx / length) * distance, y: y + (dy / length) * distance, z: z + (dz / length) * distance };
      graph3dRef.current.cameraPosition(camera, { x, y, z }, 1000);
    }
  }

  function zoomBy(factor) {
    if (activeView === "2d") {
      setZoom((z) => Math.min(Math.max(z * factor, 0.4), 5));
      return;
    }
    // 3D: move the camera closer to (or further from) the point it looks at.
    const graph = graph3dRef.current;
    if (!graph) return;
    const cam = graph.camera().position;
    const target = graph.controls().target;
    const scaleBy = 1 / factor;
    graph.cameraPosition(
      {
        x: target.x + (cam.x - target.x) * scaleBy,
        y: target.y + (cam.y - target.y) * scaleBy,
        z: target.z + (cam.z - target.z) * scaleBy,
      },
      undefined,
      300
    );
  }



  function resetView() {
    setSelectedId(null);
    if (activeView === "2d") {
      setFrame(boundsOf(positions));
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      graph3dRef.current?.zoomToFit(700, 10);
    }
  }

  // ---------- Render ----------

  const hasGraph = graphData.nodes.length > 0;
  const relationships = selectedNode
    ? [...(neighbours[selectedNode.id] || [])]
        .map((id) => nodesById[id])
        .filter(Boolean)
        .sort((a, b) => b.connections - a.connections)
    : [];

  return (
    <div className="brain-map" ref={pageRef}>
      {/* ---------- Header ---------- */}
      <header className="bm-header">
        <div className="bm-heading">
          <div className="bm-heading-icon">
            <BrainIcon />
          </div>
          <div>
            <h1 className="bm-title">Brain Map</h1>
            <p className="bm-subtitle">
              Explore the key concepts in your study materials as an interactive network.
            </p>
          </div>
        </div>

        <div className="bm-controls">
          <input
            className={`bm-input ${error ? "bm-input-error" : ""}`}
            type="number"
            placeholder="Document ID"
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          />
          <button className="bm-button bm-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? (
              <>
                <span className="bm-spinner"></span>
                Mapping...
              </>
            ) : (
              "✦ Generate Map"
            )}
          </button>
        </div>
      </header>

      {error && <p className="bm-error">{error}</p>}
      {!webglOk && (
        <p className="bm-notice">
          3D view is turned off in this browser right now, so the 2D map is shown. Fully close and
          reopen the browser to turn 3D back on.
        </p>
      )}

      <div className="bm-main">
        {/* ---------- Graph panel ---------- */}
        <section className="bm-panel bm-graph-panel">
          <div className="bm-toolbar">
            <div className="bm-legend">
              <span>
                <span className="bm-dot hub" /> Central
              </span>
              {["core", "linked", "outer"].map((tier) => (
                <span key={tier}>
                  <span className={`bm-dot ${tier}`} /> {TIER_LABELS[tier]}
                </span>
              ))}
            </div>

            <div className="bm-tools">
              <div className="bm-switch">
                <button className={activeView === "2d" ? "active" : ""} onClick={() => setView("2d")}>
                  2D
                </button>
                <button
                  className={activeView === "3d" ? "active" : ""}
                  onClick={() => setView("3d")}
                  disabled={!webglOk}
                  title={webglOk ? "3D view" : "3D is turned off in this browser — restart the browser"}
                >
                  3D
                </button>
              </div>
              <button className="bm-icon-button" onClick={() => zoomBy(1 / 1.25)} title="Zoom out">
                −
              </button>
              <button className="bm-icon-button" onClick={() => zoomBy(1.25)} title="Zoom in">
                +
              </button>
              <button className="bm-icon-button" onClick={resetView} title="Reset view">
                ↺
              </button>
            </div>
          </div>

          <div className="bm-canvas" ref={canvasRef}>
            {/* The stage is pinned to the box's edges, so what's drawn inside
                can never make the box grow. */}
            <div className="bm-stage">
            {/* ----- 2D map ----- */}
            {hasGraph && activeView === "2d" && size.width > 0 && (
              <svg
                ref={svgRef}
                className="bm-svg"
                width={size.width}
                height={size.height}
                viewBox={`${viewX} ${viewY} ${viewW} ${viewH}`}
                // Empty space anywhere on the map: drag to move, click to clear.
                onPointerDown={startPan}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                {/* Empty space: drag to move the map, click to clear selection */}
                <rect
                  x={viewX}
                  y={viewY}
                  width={viewW}
                  height={viewH}
                  fill="transparent"
                />

                {/* Links */}
                {graphData.links.map((link, i) => {
                  const a = positions[endId(link.source)];
                  const b = positions[endId(link.target)];
                  if (!a || !b) return null;
                  const lit = touchesFocus(link);
                  return (
                    <line
                      key={i}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      className={`bm-link ${lit ? "lit" : ""} ${focusId && !lit ? "faded" : ""}`}
                      strokeWidth={px(lit ? 1.6 : 1)}
                    />
                  );
                })}

                {/* Relationship labels, only on the selected concept's links,
                    and only when there are few enough to stay readable */}
                {selectedNode &&
                  selectedNode.connections <= 8 &&
                  graphData.links.filter(touchesFocus).map((link, i) => {
                    const a = positions[endId(link.source)];
                    const b = positions[endId(link.target)];
                    if (!a || !b) return null;
                    return (
                      <text
                        key={`label-${i}`}
                        x={(a.x + b.x) / 2}
                        y={(a.y + b.y) / 2}
                        className="bm-link-label"
                        fontSize={px(10)}
                        strokeWidth={px(4)}
                      >
                        {link.relationship}
                      </text>
                    );
                  })}

                {/* Concepts */}
                {graphData.nodes.map((node) => {
                  const p = positions[node.id];
                  if (!p) return null;
                  const r = TIER_RADIUS[node.tier];
                  const selected = node.id === selectedId;

                  // The central concept: a glowing brain badge in the middle.
                  if (node.id === hubId) {
                    return (
                      <g
                        key={node.id}
                        className={`bm-node bm-hub2d ${isLit(node.id) ? "" : "faded"}`}
                        transform={`translate(${p.x} ${p.y})`}
                        onPointerDown={(e) => startNodeDrag(e, node.id)}
                        onPointerEnter={() => setHoveredId(node.id)}
                        onPointerLeave={() => setHoveredId(null)}
                      >
                        <title>{node.label}</title>
                        <circle className="bm-hub-glow" r={px(46)} />
                        {selected && (
                          <circle className="bm-node-orbit" r={px(38)} strokeWidth={px(1.5)} strokeDasharray={`${px(4)} ${px(4)}`} />
                        )}
                        <circle className="bm-hub-ring" r={px(30)} strokeWidth={px(2.5)} />
                        <g
                          className="bm-hub-brain"
                          transform={`scale(${px(1.6)}) translate(-12 -12)`}
                          strokeWidth="1.5"
                        >
                          <path d="M9 4.5A3.5 3.5 0 0 0 5.5 8v.5A3.5 3.5 0 0 0 4 11.5 3.5 3.5 0 0 0 7.5 15H8v1a3 3 0 0 0 3 3h1V5a3 3 0 0 0-3-3" />
                          <path d="M15 4.5A3.5 3.5 0 0 1 18.5 8v.5a3.5 3.5 0 0 1 1.5 3 3.5 3.5 0 0 1-3.5 3H16v1a3 3 0 0 1-3 3h-1V5a3 3 0 0 1 3-3" />
                        </g>
                        <text className="bm-node-label bm-hub-label" y={px(50)} fontSize={px(14)} strokeWidth={px(4)}>
                          {shorten(node.label, 30)}
                        </text>
                      </g>
                    );
                  }

                  return (
                    <g
                      key={node.id}
                      className={`bm-node ${node.tier} ${isLit(node.id) ? "" : "faded"}`}
                      transform={`translate(${p.x} ${p.y})`}
                      onPointerDown={(e) => startNodeDrag(e, node.id)}
                      onPointerEnter={() => setHoveredId(node.id)}
                      onPointerLeave={() => setHoveredId(null)}
                    >
                      <title>{node.label}</title>
                      {selected && (
                        <circle className="bm-node-orbit" r={px(r + 7)} strokeWidth={px(1.5)} strokeDasharray={`${px(4)} ${px(4)}`} />
                      )}
                      <circle className="bm-node-ring" r={px(r)} strokeWidth={px(2)} />
                      <circle className="bm-node-core" r={px(5)} />
                      <text className="bm-node-label" y={px(r + 16)} fontSize={px(12)} strokeWidth={px(4)}>
                        {shorten(node.label)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}

            {/* ----- 3D network ----- */}
            {hasGraph && activeView === "3d" && size.width > 0 && (
              <ForceGraph3D
                ref={graph3dRef}
                width={size.width}
                height={size.height}
                graphData={graphData}
                backgroundColor="rgba(0,0,0,0)"
                showNavInfo={false}
                controlType="orbit"
                warmupTicks={60}
                cooldownTicks={90}
                nodeRelSize={3.2}
                nodeResolution={20}
                nodeOpacity={0.95}
                nodeLabel={() => ""}
                // The central concept is drawn as the brain badge instead.
                nodeVisibility={(node) => node.id !== hubId}
                nodeColor={(node) => (isLit(node.id) ? colors[node.tier] : colors.muted)}
                linkColor={(link) => (touchesFocus(link) ? colors.core : colors.muted)}
                // While a concept is selected, only its own links are shown.
                linkVisibility={(link) => !focusId || touchesFocus(link)}
                linkOpacity={focusId ? 0.75 : 0.28}
                linkWidth={(link) => (touchesFocus(link) ? 0.8 : 0)}
                // Small pulses travel only along the selected concept's links.
                linkDirectionalParticles={(link) => (touchesFocus(link) ? 2 : 0)}
                linkDirectionalParticleSpeed={0.006}
                linkDirectionalParticleWidth={1.8}
                linkDirectionalParticleColor={() => colors.core}
                onNodeClick={(node) => focusOn(node.id)}
                onNodeHover={(node) => setHoveredId(node ? node.id : null)}
                onNodeDragEnd={(node) => {
                  node.fx = node.x;
                  node.fy = node.y;
                  node.fz = node.z;
                }}
                onBackgroundClick={() => setSelectedId(null)}
                onEngineStop={() => {
                  if (fitPending3d.current) {
                    graph3dRef.current?.zoomToFit(800, 10);
                    fitPending3d.current = false;
                                }
                }}
              />
            )}

            {/* ----- 3D name tags + central brain badge ----- */}
            {hasGraph && activeView === "3d" && (
              <div className="bm-tags3d" ref={labelLayerRef}>
                {graphData.nodes.map((node) =>
                  node.id === hubId ? (
                    <button
                      key={node.id}
                      data-id={node.id}
                      data-lit={isLit(node.id) ? "1" : "0"}
                      className={`bm-hub3d ${selectedId === node.id ? "selected" : ""}`}
                      onClick={() => focusOn(node.id)}
                    >
                      <span className="bm-hub-icon">
                        <BrainIcon />
                      </span>
                      <span className="bm-hub-name">{shorten(node.label, 28)}</span>
                    </button>
                  ) : (
                    <span
                      key={node.id}
                      data-id={node.id}
                      data-lit={isLit(node.id) ? "1" : "0"}
                      className={`bm-tag3d ${node.tier} ${selectedId === node.id ? "selected" : ""}`}
                      onClick={() => focusOn(node.id)}
                      onMouseEnter={() => setHoveredId(node.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      {shorten(node.label)}
                    </span>
                  )
                )}
              </div>
            )}

            </div>

            {/* ----- Empty state ----- */}
            {!hasGraph && !loading && (
              <div className="bm-empty">
                <div className="bm-heading-icon large">
                  <BrainIcon />
                </div>
                <h2>No map yet</h2>
                <p>Enter the ID of an uploaded document and click Generate Map.</p>
              </div>
            )}

            {hasGraph && (
              <div className="bm-hint">
                {activeView === "2d"
                  ? "Drag a concept to rearrange · Drag empty space to move · Click to inspect"
                  : "Drag to rotate · Right-drag to move · Scroll to zoom · Click to inspect"}
              </div>
            )}
          </div>
        </section>

        {/* ---------- Concept Inspector ---------- */}
        <aside className="bm-panel bm-inspector">
          <div className="bm-inspector-top">
            <span className="bm-section-title">CONCEPT INSPECTOR</span>
            {mapId && <span className="bm-map-id">Map #{mapId.slice(0, 6)}</span>}
          </div>

          {selectedNode ? (
            <>
              <div className="bm-card">
                <span className={`bm-badge ${selectedNode.id === hubId ? "hub" : selectedNode.tier}`}>
                  {selectedNode.id === hubId ? "CENTRAL CONCEPT" : TIER_LABELS[selectedNode.tier].toUpperCase()}
                </span>
                <h2 className="bm-card-title">{selectedNode.label}</h2>
                <p className="bm-card-text">
                  Connected to {selectedNode.connections} of {graphData.nodes.length - 1} other
                  concepts in this map.
                </p>
              </div>

              <span className="bm-section-title">RELATIONSHIPS ({relationships.length})</span>
              <ul className="bm-list">
                {relationships.map((n) => (
                  <li key={n.id}>
                    <button
                      className="bm-row"
                      onClick={() => focusOn(n.id)}
                      onMouseEnter={() => setHoveredId(n.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <span className="bm-row-label">→ {n.label}</span>
                      <span className={`bm-chip ${n.tier}`}>related_to</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <div className="bm-card">
                <h2 className="bm-card-title">{hasGraph ? "Select a concept" : "No concept selected"}</h2>
                <p className="bm-card-text">
                  {hasGraph
                    ? "Click any concept on the map, or pick one below, to see what it connects to."
                    : "Generate a map to inspect its concepts."}
                </p>
              </div>

              {hasGraph && (
                <>
                  <span className="bm-section-title">KEY CONCEPTS ({ranked.length})</span>
                  <ul className="bm-list">
                    {ranked.map((n) => (
                      <li key={n.id}>
                        <button
                          className="bm-row"
                          onClick={() => focusOn(n.id)}
                          onMouseEnter={() => setHoveredId(n.id)}
                          onMouseLeave={() => setHoveredId(null)}
                        >
                          <span className={`bm-dot ${n.tier}`} />
                          <span className="bm-row-label">{n.label}</span>
                          <span className="bm-row-count">{n.connections}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          <div className="bm-inspector-footer">
            <span>{graphData.nodes.length} Nodes</span>
            <span>{graphData.links.length} Edges</span>
          </div>
        </aside>
      </div>
    </div>
  );
}