import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const _projVec = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _toNode = new THREE.Vector3();
const _targetFocus = new THREE.Vector3();

function computeForceLayout3D(nodes, triples) {
  const pos = {};
  if (!nodes || nodes.length === 0) return pos;

  const docs = nodes.filter((n) => n.kind === 'document');
  const bridges = nodes.filter((n) => n.kind === 'bridge');
  const concepts = nodes.filter((n) => n.kind === 'concept');

  // 1. Place documents around a tilted 3D outer constellation
  docs.forEach((doc, idx) => {
    const angle = (idx / Math.max(docs.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const radius = docs.length <= 2 ? 12.5 : 14.5;
    const elev = Math.sin(idx * 2.1 + 0.6) * 5.2;
    pos[doc.id] = {
      x: Math.cos(angle) * radius,
      y: elev,
      z: Math.sin(angle) * radius,
    };
  });

  // 2. Place glowing bridge nodes near the 3D centroid of their linked documents
  bridges.forEach((bridge, idx) => {
    const linkedDocIds = Array.from(
      new Set(bridge.sources.map((s) => `doc-${s.documentId}`))
    ).filter((id) => Boolean(pos[id]));

    const phi = Math.acos(1 - (2 * (idx + 0.5)) / Math.max(bridges.length, 1));
    const theta = Math.PI * (1 + Math.sqrt(5)) * idx;

    if (linkedDocIds.length >= 2) {
      let ax = 0;
      let ay = 0;
      let az = 0;
      for (const did of linkedDocIds) {
        ax += pos[did].x;
        ay += pos[did].y;
        az += pos[did].z;
      }
      ax /= linkedDocIds.length;
      ay /= linkedDocIds.length;
      az /= linkedDocIds.length;
      pos[bridge.id] = {
        x: ax * 0.65 + Math.sin(phi) * Math.cos(theta) * 2.6,
        y: ay * 0.65 + Math.cos(phi) * 2.8,
        z: az * 0.65 + Math.sin(phi) * Math.sin(theta) * 2.6,
      };
    } else {
      pos[bridge.id] = {
        x: Math.sin(phi) * Math.cos(theta) * 5.2,
        y: Math.cos(phi) * 4.4,
        z: Math.sin(phi) * Math.sin(theta) * 5.2,
      };
    }
  });

  // 3. Place concept nodes around their neighbor in 3D Fibonacci directions
  concepts.forEach((concept, idx) => {
    const neighborTriple = triples.find(
      (t) => t.sourceId === concept.id || t.targetId === concept.id
    );
    const neighborId = neighborTriple
      ? neighborTriple.sourceId === concept.id
        ? neighborTriple.targetId
        : neighborTriple.sourceId
      : undefined;
    const anchor = (neighborId && pos[neighborId]) || { x: 0, y: 0, z: 0 };
    const phi = Math.acos(1 - (2 * (idx + 0.5)) / Math.max(concepts.length, 1));
    const theta = Math.PI * (1 + Math.sqrt(5)) * idx;
    pos[concept.id] = {
      x: anchor.x + Math.sin(phi) * Math.cos(theta) * 5.8,
      y: anchor.y + Math.cos(phi) * 5.2,
      z: anchor.z + Math.sin(phi) * Math.sin(theta) * 5.8,
    };
  });

  // 4. Deterministic 3D damped force simulation
  const vel = {};
  for (const n of nodes) vel[n.id] = { x: 0, y: 0, z: 0 };

  const iterations = 190;
  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations;
    const forces = {};
    for (const n of nodes) forces[n.id] = { x: 0, y: 0, z: 0 };

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = pos[a.id].x - pos[b.id].x;
        const dy = pos[a.id].y - pos[b.id].y;
        const dz = pos[a.id].z - pos[b.id].z;
        const distSq = Math.max(dx * dx + dy * dy + dz * dz, 0.8);
        const dist = Math.sqrt(distSq);

        const pairBoost =
          a.kind === 'document' && b.kind === 'document'
            ? 2.1
            : a.kind === 'bridge' || b.kind === 'bridge'
              ? 1.3
              : 1.0;

        const repulsion = (16.5 * pairBoost) / distSq;
        const fx = (dx / dist) * repulsion;
        const fy = (dy / dist) * repulsion;
        const fz = (dz / dist) * repulsion;

        forces[a.id].x += fx;
        forces[a.id].y += fy;
        forces[a.id].z += fz;
        forces[b.id].x -= fx;
        forces[b.id].y -= fy;
        forces[b.id].z -= fz;

        const minDist = a.kind === 'document' || b.kind === 'document' ? 6.8 : 5.2;
        if (dist < minDist) {
          const push = (minDist - dist) * 0.24;
          const px = (dx / dist) * push;
          const py = (dy / dist) * push;
          const pz = (dz / dist) * push;
          forces[a.id].x += px;
          forces[a.id].y += py;
          forces[a.id].z += pz;
          forces[b.id].x -= px;
          forces[b.id].y -= py;
          forces[b.id].z -= pz;
        }
      }
    }

    for (const t of triples) {
      const pA = pos[t.sourceId];
      const pB = pos[t.targetId];
      if (!pA || !pB) continue;

      const dx = pB.x - pA.x;
      const dy = pB.y - pA.y;
      const dz = pB.z - pA.z;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.1);
      const targetLen = 7.4;
      const spring = (dist - targetLen) * 0.055;
      const fx = (dx / dist) * spring;
      const fy = (dy / dist) * spring;
      const fz = (dz / dist) * spring;

      forces[t.sourceId].x += fx;
      forces[t.sourceId].y += fy;
      forces[t.sourceId].z += fz;
      forces[t.targetId].x -= fx;
      forces[t.targetId].y -= fy;
      forces[t.targetId].z -= fz;
    }

    for (const n of nodes) {
      const pull = n.kind === 'bridge' ? 0.036 : n.kind === 'document' ? 0.012 : 0.022;
      forces[n.id].x -= pos[n.id].x * pull;
      forces[n.id].y -= pos[n.id].y * pull;
      forces[n.id].z -= pos[n.id].z * pull;
    }

    const maxStep = 0.85 * (0.3 + 0.7 * cooling);
    for (const n of nodes) {
      const v = vel[n.id];
      v.x = (v.x + forces[n.id].x) * 0.66;
      v.y = (v.y + forces[n.id].y) * 0.66;
      v.z = (v.z + forces[n.id].z) * 0.66;

      const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      if (speed > maxStep) {
        v.x = (v.x / speed) * maxStep;
        v.y = (v.y / speed) * maxStep;
        v.z = (v.z / speed) * maxStep;
      }

      pos[n.id].x = Math.max(-22, Math.min(22, pos[n.id].x + v.x));
      pos[n.id].y = Math.max(-15, Math.min(15, pos[n.id].y + v.y));
      pos[n.id].z = Math.max(-22, Math.min(22, pos[n.id].z + v.z));
    }
  }

  return pos;
}

function readThemePalette() {
  const styles = getComputedStyle(document.documentElement);
  const read = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  return {
    bg: read('--h-card', read('--bg-card', '#1e131a')),
    elevated: read('--h-elevated', read('--bg-card-elevated', '#271922')),
    accent: read('--h-accent', read('--accent-bright', '#f9a8d4')),
    mint: read('--h-mint', read('--emerald', '#6ee7b7')),
    amber: read('--h-amber', read('--gold', '#fbbf24')),
    text: read('--h-text', read('--text-primary', '#faf4f8')),
    borderStrong: read('--h-border-strong', read('--border-strong', '#9f6b8a')),
  };
}

export function BrainMap3DCanvas({
  graph,
  kindFilter,
  searchLower,
  selectedNodeId,
  hoveredNodeId,
  showAllEdgeLabels,
  autoRotate,
  zoomStepSignal,
  resetViewSeq,
  relayoutSeq,
  onSelectNode,
  onHoverNode,
}) {
  const containerRef = useRef(null);
  const mountRef = useRef(null);
  const [contextLost, setContextLost] = useState(false);

  const positions3D = useMemo(
    () => computeForceLayout3D(graph.nodes, graph.triples),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph, relayoutSeq]
  );

  // Store latest interactive props in refs so WebGL scene never tears down on hover/select/filter
  const stateRef = useRef({
    kindFilter,
    searchLower,
    selectedNodeId,
    hoveredNodeId,
    showAllEdgeLabels,
    autoRotate,
  });
  stateRef.current = {
    kindFilter,
    searchLower,
    selectedNodeId,
    hoveredNodeId,
    showAllEdgeLabels,
    autoRotate,
  };

  const callbacksRef = useRef({ onSelectNode, onHoverNode });
  callbacksRef.current = { onSelectNode, onHoverNode };

  const labelDomRefs = useRef({});
  const edgeLabelDomRefs = useRef({});

  // Camera imperative refs for toolbar buttons
  const cameraControlsRef = useRef(null);
  const syncVisualEmphasisRef = useRef(() => {});

  // Rebuild 3D scene when graph or layout changes
  useEffect(() => {
    const container = containerRef.current;
    const mount = mountRef.current;
    if (!container || !mount) return;

    const palette = readThemePalette();

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 320);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.bg);
    scene.fog = new THREE.FogExp2(palette.bg, 0.013);

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 200);
    camera.position.set(0, 10.5, 31);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // 3-point lighting rig (warm key, cool hemisphere fill, crisp rim)
    const hemiLight = new THREE.HemisphereLight('#b8d4ff', '#1c1220', 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#fff2e6', 2.0);
    keyLight.position.set(16, 24, 18);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(palette.accent, 1.35);
    rimLight.position.set(-18, -8, -16);
    scene.add(rimLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 10;
    controls.maxDistance = 64;
    controls.autoRotate = !isSoftwareGl && stateRef.current.autoRotate;
    controls.autoRotateSpeed = 0.65;

    let hasActiveGlide = false;
    const glideTarget = new THREE.Vector3(0, 0, 0);

    const onControlStart = () => {
      hasActiveGlide = false;
    };
    controls.addEventListener('start', onControlStart);

    // Subtle spatial depth starfield
    const dustCount = 140;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const r = 24 + ((i * 73) % 26);
      const phi = Math.acos(1 - (2 * (i + 0.5)) / dustCount);
      const theta = i * 2.39996;
      dustPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      dustPositions[i * 3 + 1] = Math.cos(phi) * r * 0.72;
      dustPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: palette.accent,
      size: 0.16,
      transparent: true,
      opacity: 0.28,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPoints);

    // Subtle equatorial reference grid ring
    const ringGeo = new THREE.RingGeometry(15.2, 15.32, 96);
    const ringMat = new THREE.MeshBasicMaterial({
      color: palette.accent,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const horizonRing = new THREE.Mesh(ringGeo, ringMat);
    horizonRing.rotation.x = Math.PI / 2;
    horizonRing.position.y = -0.2;
    scene.add(horizonRing);

    const disposables = [
      envTarget,
      dustGeo,
      dustMat,
      ringGeo,
      ringMat,
    ];

    const raycastTargets = [];
    const nodeGroups = new Map();

    // Shared proxy hit geometry for effortless picking
    const hitGeo = new THREE.SphereGeometry(1.95, 10, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const haloGeo = new THREE.TorusGeometry(2.05, 0.055, 8, 40);
    disposables.push(hitGeo, hitMat, haloGeo);

    // Build Composite 3D Node Groups
    for (const node of graph.nodes) {
      const p = positions3D[node.id] ?? { x: 0, y: 0, z: 0 };
      const group = new THREE.Group();
      group.position.set(p.x, p.y, p.z);
      group.userData.nodeId = node.id;

      let primaryMat;
      let ringMesh;
      let ringMesh2;
      let shellMesh;

      if (node.kind === 'bridge') {
        const coreGeo = new THREE.IcosahedronGeometry(0.86, 0);
        primaryMat = new THREE.MeshStandardMaterial({
          color: palette.accent,
          emissive: palette.accent,
          emissiveIntensity: 0.65,
          roughness: 0.22,
          metalness: 0.48,
          transparent: true,
          opacity: 1,
        });
        const core = new THREE.Mesh(coreGeo, primaryMat);

        const shellGeo = new THREE.SphereGeometry(1.18, 22, 16);
        const shellMat = new THREE.MeshPhysicalMaterial({
          color: palette.accent,
          roughness: 0.12,
          metalness: 0.05,
          clearcoat: 1,
          transmission: isSoftwareGl ? 0 : 0.72,
          transparent: true,
          opacity: isSoftwareGl ? 0.34 : 0.85,
          depthWrite: false,
        });
        shellMesh = new THREE.Mesh(shellGeo, shellMat);
        shellMesh.renderOrder = 2;

        const r1Geo = new THREE.TorusGeometry(1.48, 0.045, 10, 44);
        const r1Mat = new THREE.MeshStandardMaterial({
          color: palette.accent,
          emissive: palette.accent,
          emissiveIntensity: 0.4,
          roughness: 0.25,
          metalness: 0.82,
          transparent: true,
          opacity: 0.95,
        });
        ringMesh = new THREE.Mesh(r1Geo, r1Mat);
        ringMesh.rotation.set(0.65, 0.2, 0.3);

        const r2Geo = new THREE.TorusGeometry(1.74, 0.032, 8, 44);
        const r2Mat = new THREE.MeshStandardMaterial({
          color: palette.mint,
          emissive: palette.mint,
          emissiveIntensity: 0.25,
          roughness: 0.3,
          metalness: 0.85,
          transparent: true,
          opacity: 0.85,
        });
        ringMesh2 = new THREE.Mesh(r2Geo, r2Mat);
        ringMesh2.rotation.set(-0.75, 0.5, 0);

        group.add(core, shellMesh, ringMesh, ringMesh2);
        disposables.push(coreGeo, primaryMat, shellGeo, shellMat, r1Geo, r1Mat, r2Geo, r2Mat);
      } else if (node.kind === 'document') {
        const bodyGeo = new THREE.BoxGeometry(1.48, 1.92, 0.34);
        primaryMat = new THREE.MeshStandardMaterial({
          color: palette.elevated,
          emissive: palette.amber,
          emissiveIntensity: 0.16,
          roughness: 0.36,
          metalness: 0.52,
          transparent: true,
          opacity: 1,
        });
        const body = new THREE.Mesh(bodyGeo, primaryMat);

        const spineGeo = new THREE.BoxGeometry(0.24, 1.98, 0.42);
        const spineMat = new THREE.MeshStandardMaterial({
          color: palette.amber,
          emissive: palette.amber,
          emissiveIntensity: 0.38,
          roughness: 0.28,
          metalness: 0.68,
          transparent: true,
          opacity: 1,
        });
        const spine = new THREE.Mesh(spineGeo, spineMat);
        spine.position.x = -0.66;

        const frameGeo = new THREE.TorusGeometry(1.42, 0.038, 8, 36);
        const frameMat = new THREE.MeshStandardMaterial({
          color: palette.amber,
          roughness: 0.3,
          metalness: 0.85,
          transparent: true,
          opacity: 0.85,
        });
        ringMesh = new THREE.Mesh(frameGeo, frameMat);
        ringMesh.rotation.set(Math.PI / 2.4, 0.2, 0);

        group.add(body, spine, ringMesh);
        disposables.push(bodyGeo, primaryMat, spineGeo, spineMat, frameGeo, frameMat);
      } else {
        const gemGeo = new THREE.OctahedronGeometry(0.74, 0);
        primaryMat = new THREE.MeshStandardMaterial({
          color: palette.mint,
          emissive: palette.mint,
          emissiveIntensity: 0.3,
          roughness: 0.26,
          metalness: 0.52,
          transparent: true,
          opacity: 1,
        });
        const gem = new THREE.Mesh(gemGeo, primaryMat);

        const eqGeo = new THREE.TorusGeometry(1.06, 0.034, 8, 32);
        const eqMat = new THREE.MeshStandardMaterial({
          color: palette.mint,
          roughness: 0.3,
          metalness: 0.84,
          transparent: true,
          opacity: 0.8,
        });
        ringMesh = new THREE.Mesh(eqGeo, eqMat);
        ringMesh.rotation.x = Math.PI / 2.2;

        const beadGeo = new THREE.SphereGeometry(0.24, 10, 8);
        const beadMat = new THREE.MeshStandardMaterial({
          color: '#ffffff',
          emissive: palette.mint,
          emissiveIntensity: 0.9,
          roughness: 0.15,
          metalness: 0.2,
          transparent: true,
          opacity: 1,
        });
        const bead = new THREE.Mesh(beadGeo, beadMat);
        bead.position.y = 0.92;

        group.add(gem, ringMesh, bead);
        disposables.push(gemGeo, primaryMat, eqGeo, eqMat, beadGeo, beadMat);
      }

      // Selection halo
      const haloMat = new THREE.MeshBasicMaterial({
        color: node.kind === 'document' ? palette.amber : node.kind === 'concept' ? palette.mint : palette.accent,
        transparent: true,
        opacity: 0,
      });
      const selectHalo = new THREE.Mesh(haloGeo, haloMat);
      group.add(selectHalo);
      disposables.push(haloMat);

      // Raycast hit proxy on layer 1
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.layers.set(1);
      hitMesh.userData.nodeId = node.id;
      group.add(hitMesh);
      raycastTargets.push(hitMesh);

      scene.add(group);
      nodeGroups.set(node.id, {
        group,
        kind: node.kind,
        primaryMat,
        ringMesh,
        ringMesh2,
        shellMesh,
        selectHalo,
        basePos: new THREE.Vector3(p.x, p.y, p.z),
      });
    }

    // Build Curved 3D Relationship Triple Tubes + Arrow Cones
    const edgeObjects = new Map();
    const pairCounts = new Map();
    const pairSeen = new Map();
    for (const t of graph.triples) {
      const pk = [t.sourceId, t.targetId].sort().join('::');
      pairCounts.set(pk, (pairCounts.get(pk) ?? 0) + 1);
    }

    const coneGeo = new THREE.ConeGeometry(0.19, 0.56, 10);
    disposables.push(coneGeo);

    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

    for (const triple of graph.triples) {
      const pA = positions3D[triple.sourceId];
      const pB = positions3D[triple.targetId];
      const nA = nodeById.get(triple.sourceId);
      const nB = nodeById.get(triple.targetId);
      if (!pA || !pB || !nA || !nB) continue;

      const start = new THREE.Vector3(pA.x, pA.y, pA.z);
      const end = new THREE.Vector3(pB.x, pB.y, pB.z);
      const dir = end.clone().sub(start);
      const dist = Math.max(dir.length(), 0.2);
      dir.normalize();

      const rStart = nA.kind === 'document' ? 1.35 : nA.kind === 'bridge' ? 1.45 : 1.05;
      const rEnd = nB.kind === 'document' ? 1.55 : nB.kind === 'bridge' ? 1.6 : 1.25;

      const sPt = start.clone().addScaledVector(dir, Math.min(rStart, dist * 0.35));
      const ePt = end.clone().addScaledVector(dir, -Math.min(rEnd, dist * 0.35));

      const pk = [triple.sourceId, triple.targetId].sort().join('::');
      const total = pairCounts.get(pk) ?? 1;
      const idx = pairSeen.get(pk) ?? 0;
      pairSeen.set(pk, idx + 1);

      const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const perp = new THREE.Vector3().crossVectors(dir, up).normalize();
      const perp2 = new THREE.Vector3().crossVectors(dir, perp).normalize();

      const offsetMag = total === 1 ? 1.15 : (idx % 2 === 0 ? 1 : -1) * (1.45 + Math.floor(idx / 2) * 0.9);
      const ctrl = sPt
        .clone()
        .add(ePt)
        .multiplyScalar(0.5)
        .addScaledVector(perp, offsetMag)
        .addScaledVector(perp2, total > 1 ? 0.6 : 0.35);

      const curve = new THREE.QuadraticBezierCurve3(sPt, ctrl, ePt);
      const involvesBridge = nA.kind === 'bridge' || nB.kind === 'bridge';
      const tubeGeo = new THREE.TubeGeometry(curve, 20, involvesBridge ? 0.055 : 0.04, 6, false);

      const tubeMat = new THREE.MeshStandardMaterial({
        color: involvesBridge ? palette.accent : palette.borderStrong,
        emissive: involvesBridge ? palette.accent : '#000000',
        emissiveIntensity: involvesBridge ? 0.2 : 0,
        roughness: 0.4,
        metalness: 0.5,
        transparent: true,
        opacity: 0.72,
      });

      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      scene.add(tube);

      // Arrow cone at target end
      const tangent = curve.getTangent(0.98).normalize();
      const coneMat = new THREE.MeshStandardMaterial({
        color: involvesBridge ? palette.accent : palette.borderStrong,
        emissive: involvesBridge ? palette.accent : '#000000',
        emissiveIntensity: 0.25,
        roughness: 0.35,
        metalness: 0.6,
        transparent: true,
        opacity: 0.85,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.copy(ePt);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      scene.add(cone);

      const midpoint = curve.getPoint(0.5);
      disposables.push(tubeGeo, tubeMat, coneMat);
      edgeObjects.set(triple.id, {
        triple,
        tubeMat,
        coneMat,
        midpoint,
        involvesBridge,
      });
    }

    // Apply focus / filter visual emphasis
    const syncVisualEmphasis = () => {
      const { kindFilter: kf, searchLower: sl, selectedNodeId: sel, hoveredNodeId: hov } = stateRef.current;
      const livePalette = readThemePalette();
      const activeFocus = hov ?? sel;

      const matchesNode = (n) => {
        const kindOk = kf === 'all' || n.kind === kf;
        const textOk =
          !sl || n.label.toLowerCase().includes(sl) || n.summary.toLowerCase().includes(sl);
        return kindOk && textOk;
      };

      const focusConnectedNodes = new Set();
      const focusConnectedEdges = new Set();
      if (activeFocus) {
        focusConnectedNodes.add(activeFocus);
        for (const t of graph.triples) {
          if (t.sourceId === activeFocus || t.targetId === activeFocus) {
            focusConnectedEdges.add(t.id);
            focusConnectedNodes.add(t.sourceId);
            focusConnectedNodes.add(t.targetId);
          }
        }
      }

      for (const node of graph.nodes) {
        const item = nodeGroups.get(node.id);
        if (!item) continue;
        const match = matchesNode(node);
        const isSel = sel === node.id;
        const isHov = hov === node.id;
        const inFocus = !activeFocus || focusConnectedNodes.has(node.id);

        const targetScale = isHov ? 1.24 : isSel ? 1.16 : match && inFocus ? 1.0 : 0.82;
        item.group.scale.setScalar(targetScale);

        const targetOpacity = !match ? 0.16 : activeFocus && !inFocus ? 0.22 : 1.0;
        item.primaryMat.opacity = targetOpacity;
        if (item.shellMesh) {
          item.shellMesh.material.opacity =
            targetOpacity * (isSoftwareGl ? 0.34 : 0.85);
        }
        if (item.ringMesh) {
          item.ringMesh.material.opacity = targetOpacity * 0.9;
        }
        if (item.ringMesh2) {
          item.ringMesh2.material.opacity = targetOpacity * 0.82;
        }
        const haloMat = item.selectHalo.material;
        haloMat.opacity = isSel ? 0.85 : isHov ? 0.45 : 0;
      }

      for (const [id, edge] of edgeObjects.entries()) {
        const nA = nodeById.get(edge.triple.sourceId);
        const nB = nodeById.get(edge.triple.targetId);
        const bothMatch = Boolean(nA && nB && matchesNode(nA) && matchesNode(nB));
        const focused = activeFocus ? focusConnectedEdges.has(id) : false;

        let op = 0.68;
        if (!bothMatch) op = 0.1;
        else if (activeFocus) op = focused ? 1 : 0.12;

        edge.tubeMat.opacity = op;
        edge.coneMat.opacity = Math.min(1, op + 0.12);

        const activeColor = focused
          ? livePalette.accent
          : edge.involvesBridge
            ? livePalette.accent
            : livePalette.borderStrong;
        edge.tubeMat.color.set(activeColor);
        edge.coneMat.color.set(activeColor);
        edge.tubeMat.emissiveIntensity = focused ? 0.72 : edge.involvesBridge ? 0.18 : 0;
      }
    };
    syncVisualEmphasisRef.current = syncVisualEmphasis;
    syncVisualEmphasis();

    // Update projected semantic DOM labels directly (zero React re-renders per frame)
    const updateProjectedLabels = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;

      const { kindFilter: kf, searchLower: sl, selectedNodeId: sel, hoveredNodeId: hov, showAllEdgeLabels: showEdges } =
        stateRef.current;
      const activeFocus = hov ?? sel;

      const matchesNode = (n) => {
        const kindOk = kf === 'all' || n.kind === kf;
        const textOk =
          !sl || n.label.toLowerCase().includes(sl) || n.summary.toLowerCase().includes(sl);
        return kindOk && textOk;
      };

      const focusConnectedNodes = new Set();
      const focusConnectedEdges = new Set();
      if (activeFocus) {
        focusConnectedNodes.add(activeFocus);
        for (const t of graph.triples) {
          if (t.sourceId === activeFocus || t.targetId === activeFocus) {
            focusConnectedEdges.add(t.id);
            focusConnectedNodes.add(t.sourceId);
            focusConnectedNodes.add(t.targetId);
          }
        }
      }

      camera.getWorldDirection(_camDir);

      for (const node of graph.nodes) {
        const el = labelDomRefs.current[node.id];
        const item = nodeGroups.get(node.id);
        if (!el || !item) continue;

        _toNode.copy(item.group.position).sub(camera.position);
        const inFront = _toNode.dot(_camDir) > 0;
        const dist = _toNode.length();

        _projVec.copy(item.group.position);
        _projVec.y -= node.kind === 'document' ? 1.55 : node.kind === 'bridge' ? 1.75 : 1.25;
        _projVec.project(camera);

        if (!inFront || _projVec.z > 1 || _projVec.x < -1.15 || _projVec.x > 1.15 || _projVec.y < -1.15 || _projVec.y > 1.15) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }

        const sx = ((_projVec.x + 1) / 2) * w;
        const sy = ((-_projVec.y + 1) / 2) * h;

        const match = matchesNode(node);
        const inFocus = !activeFocus || focusConnectedNodes.has(node.id);
        let alpha = Math.max(0.45, Math.min(1, 36 / Math.max(dist, 12)));
        if (!match) alpha = 0.14;
        else if (activeFocus && !inFocus) alpha = 0.16;
        else if (hov === node.id || sel === node.id) alpha = 1;

        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, 0)`;
        el.style.opacity = alpha.toFixed(2);
        el.style.pointerEvents = alpha > 0.25 ? 'auto' : 'none';
        el.style.zIndex = hov === node.id || sel === node.id ? '20' : node.kind === 'bridge' ? '12' : '10';
      }

      for (const [id, edge] of edgeObjects.entries()) {
        const el = edgeLabelDomRefs.current[id];
        if (!el) continue;

        const nA = nodeById.get(edge.triple.sourceId);
        const nB = nodeById.get(edge.triple.targetId);
        const bothMatch = Boolean(nA && nB && matchesNode(nA) && matchesNode(nB));
        const focused = activeFocus ? focusConnectedEdges.has(id) : false;
        const shouldShow = bothMatch && (focused || (showEdges && !activeFocus));

        if (!shouldShow) {
          el.style.opacity = '0';
          continue;
        }

        _projVec.copy(edge.midpoint).project(camera);
        if (_projVec.z > 1 || _projVec.x < -1 || _projVec.x > 1 || _projVec.y < -1 || _projVec.y > 1) {
          el.style.opacity = '0';
          continue;
        }

        const sx = ((_projVec.x + 1) / 2) * w;
        const sy = ((-_projVec.y + 1) / 2) * h;
        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%)`;
        el.style.opacity = '1';
      }
    };

    // Raycasting setup (layer 1 hit proxies only)
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    let lastHoverCheck = 0;

    const updatePointer = (ev) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
    };

    const handlePointerMove = (ev) => {
      const now = performance.now();
      if (now - lastHoverCheck < 45) return;
      lastHoverCheck = now;

      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(raycastTargets, false);
      const hitNodeId = hits[0]?.object?.userData?.nodeId ?? null;
      renderer.domElement.style.cursor = hitNodeId ? 'pointer' : 'grab';
      if (stateRef.current.hoveredNodeId !== hitNodeId) {
        callbacksRef.current.onHoverNode(hitNodeId);
      }
    };

    const handlePointerDown = (ev) => {
      downX = ev.clientX;
      downY = ev.clientY;
    };

    const handlePointerUp = (ev) => {
      const moved = Math.hypot(ev.clientX - downX, ev.clientY - downY);
      if (moved > 5) return;
      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(raycastTargets, false);
      const hitNodeId = hits[0]?.object?.userData?.nodeId ?? null;
      if (hitNodeId) {
        callbacksRef.current.onSelectNode(
          stateRef.current.selectedNodeId === hitNodeId ? null : hitNodeId
        );
      } else {
        callbacksRef.current.onSelectNode(null);
      }
    };

    const handleContextLost = (e) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('pointermove', handlePointerMove);
    domEl.addEventListener('pointerdown', handlePointerDown);
    domEl.addEventListener('pointerup', handlePointerUp);
    domEl.addEventListener('webglcontextlost', handleContextLost);
    domEl.addEventListener('webglcontextrestored', handleContextRestored);

    // Prevent wheel events on 3D canvas and container from scrolling the surrounding webpage
    const handleCanvasWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    domEl.addEventListener('wheel', handleCanvasWheel, { passive: false });
    container.addEventListener('wheel', handleCanvasWheel, { passive: false });

    // Theme observer so Helios 4-theme switcher updates 3D background/fog immediately
    const themeObserver = new MutationObserver(() => {
      const p = readThemePalette();
      scene.background = new THREE.Color(p.bg);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.set(p.bg);
      }
      rimLight.color.set(p.accent);
      dustMat.color.set(p.accent);
      ringMat.color.set(p.accent);
      syncVisualEmphasis();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // ResizeObserver for crisp responsive sizing
    const resizeObserver = new ResizeObserver(() => {
      const nw = Math.max(container.clientWidth, 320);
      const nh = Math.max(container.clientHeight, 320);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
    resizeObserver.observe(container);

    // Camera control helpers exposed to React props
    cameraControlsRef.current = {
      camera,
      controls,
      focusOnNode: (nodeId) => {
        if (!nodeId) {
          glideTarget.set(0, 0, 0);
          hasActiveGlide = true;
          return;
        }
        const item = nodeGroups.get(nodeId);
        if (item) {
          glideTarget.copy(item.basePos);
          hasActiveGlide = true;
        }
      },
      resetCamera: () => {
        glideTarget.set(0, 0, 0);
        hasActiveGlide = true;
        camera.position.set(0, 10.5, 31);
        controls.target.set(0, 0, 0);
        controls.update();
      },
      zoomBy: (factor) => {
        _targetFocus.copy(camera.position).sub(controls.target);
        const nextLen = THREE.MathUtils.clamp(_targetFocus.length() * factor, controls.minDistance, controls.maxDistance);
        _targetFocus.normalize().multiplyScalar(nextLen);
        camera.position.copy(controls.target).add(_targetFocus);
        controls.update();
      },
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Animation loop (paced via afterDraw on software WebGL)
    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    function afterDraw(cb) {
      if (disposed) return;
      const gl = renderer.getContext();
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.elapsedTime;

      controls.autoRotate = !isSoftwareGl && stateRef.current.autoRotate;

      if (hasActiveGlide) {
        controls.target.x = THREE.MathUtils.damp(controls.target.x, glideTarget.x, 5.5, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, glideTarget.y, 5.5, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, glideTarget.z, 5.5, delta);
        if (controls.target.distanceToSquared(glideTarget) < 0.002) {
          controls.target.copy(glideTarget);
          hasActiveGlide = false;
        }
      }

      // Living orbital motion on rings & bridge cores
      for (const [, item] of nodeGroups) {
        if (item.kind === 'bridge') {
          if (item.ringMesh) item.ringMesh.rotation.z += delta * 0.48;
          if (item.ringMesh2) item.ringMesh2.rotation.y -= delta * 0.36;
          item.group.position.y = item.basePos.y + Math.sin(elapsed * 1.3 + item.basePos.x) * 0.14;
        } else if (item.ringMesh) {
          item.ringMesh.rotation.z += delta * 0.22;
        }
        item.selectHalo.lookAt(camera.position);
      }

      controls.update();
      renderer.render(scene, camera);
      updateProjectedLabels();

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      cameraControlsRef.current = null;
      resizeObserver.disconnect();
      themeObserver.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.dispose();
      domEl.removeEventListener('pointermove', handlePointerMove);
      domEl.removeEventListener('pointerdown', handlePointerDown);
      domEl.removeEventListener('pointerup', handlePointerUp);
      domEl.removeEventListener('webglcontextlost', handleContextLost);
      domEl.removeEventListener('webglcontextrestored', handleContextRestored);
      domEl.removeEventListener('wheel', handleCanvasWheel);
      container.removeEventListener('wheel', handleCanvasWheel);
      for (const d of disposables) {
        d.dispose();
      }
      renderer.dispose();
    };
  }, [graph, positions3D]);

  // Sync visual highlights without rebuilding WebGL scene
  useEffect(() => {
    syncVisualEmphasisRef.current();
  }, [kindFilter, searchLower, selectedNodeId, hoveredNodeId, showAllEdgeLabels]);

  // Smoothly focus 3D camera target when user selects a node
  useEffect(() => {
    cameraControlsRef.current?.focusOnNode(selectedNodeId);
  }, [selectedNodeId]);

  // Toolbar Zoom +/- buttons
  useEffect(() => {
    if (zoomStepSignal.seq === 0) return;
    cameraControlsRef.current?.zoomBy(zoomStepSignal.factor);
  }, [zoomStepSignal]);

  // Toolbar Center button
  useEffect(() => {
    if (resetViewSeq === 0) return;
    cameraControlsRef.current?.resetCamera();
  }, [resetViewSeq]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[460px] xl:min-h-[580px] overflow-hidden overscroll-contain touch-none"
      style={{ overscrollBehavior: 'contain', touchAction: 'none' }}
    >
      {/* Dedicated isolated WebGL canvas container */}
      <div ref={mountRef} className="w-full h-full touch-none" aria-label="3D interactive Brain Map canvas" />

      {/* Projected Semantic DOM Node Labels */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {graph.triples.map((t) => (
          <div
            key={`edge-lbl-${t.id}`}
            ref={(el) => {
              edgeLabelDomRefs.current[t.id] = el;
            }}
            className="absolute top-0 left-0 px-1.5 py-0.5 rounded border text-[9.5px] font-semibold whitespace-nowrap transition-opacity duration-150"
            style={{
              opacity: 0,
              backgroundColor: 'var(--h-bg)',
              borderColor: 'var(--h-accent)',
              color: 'var(--h-accent)',
            }}
          >
            {t.relation}
          </div>
        ))}

        {graph.nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isHovered = hoveredNodeId === node.id;
          return (
            <button
              key={`lbl-${node.id}`}
              ref={(el) => {
                labelDomRefs.current[node.id] = el;
              }}
              type="button"
              onClick={() => onSelectNode(selectedNodeId === node.id ? null : node.id)}
              onMouseEnter={() => onHoverNode(node.id)}
              onMouseLeave={() => onHoverNode(null)}
              className="absolute top-0 left-0 px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-opacity duration-150 shadow-sm"
              style={{
                opacity: 0,
                backgroundColor: isSelected || isHovered ? 'var(--h-accent-soft)' : 'var(--h-bg)',
                borderColor:
                  isSelected || isHovered
                    ? 'var(--h-accent)'
                    : node.kind === 'bridge'
                      ? 'var(--h-border-strong)'
                      : 'var(--h-border)',
                color:
                  node.kind === 'bridge'
                    ? 'var(--h-accent)'
                    : node.kind === 'document'
                      ? 'var(--h-amber)'
                      : 'var(--h-text)',
              }}
            >
              {node.label}
            </button>
          );
        })}
      </div>

      {contextLost && (
        <div
          className="absolute inset-0 flex items-center justify-center text-xs font-medium"
          style={{ backgroundColor: 'var(--h-card)', color: 'var(--h-text-muted)' }}
        >
          Restoring 3D WebGL view…
        </div>
      )}
    </div>
  );
}

export default BrainMap3DCanvas;
