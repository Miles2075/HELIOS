import { useState } from "react";
import { BrainMapView } from "./BrainMapView";
import "./BrainMap.css";

// Brain Map page — Krishi's HELIOS design (BrainMapView + BrainMap3DCanvas),
// connected to Vipsa's Brain Map backend.
//
// This file does two jobs:
//   1. asks the backend for a document's concept graph (same API as before:
//      POST /api/brainmap/generate with {"document_id": <int>}), and
//   2. converts the backend's answer into the format Krishi's design expects.
// No API change: everything shown comes from the backend's real response.

const API_URL = "http://localhost:8001/api/brainmap/generate";

const EMPTY_GRAPH = {
  nodes: [],
  triples: [],
  focusTopic: "No document yet",
  generatedAt: "",
};

// Groups each concept by how connected it is (top third = core).
function tierOf(connections, maxConnections) {
  if (maxConnections === 0) return "outer";
  const share = connections / maxConnections;
  if (share >= 0.67) return "core";
  if (share >= 0.34) return "linked";
  return "outer";
}

// Converts the backend response into Krishi's graph format.
//
//   Backend:  nodes [{id, label, type}], edges [{source, target, relationship}]
//   Krishi:   nodes [{id, label, kind, summary, sources}],
//             triples [{id, sourceId, targetId, relation, fileName}]
//
// How the pieces map:
//   - the document itself    → one "document" node (the gold book)
//   - core concepts          → "bridge" nodes (the glowing spheres, shown as "Core")
//   - all other concepts     → "concept" nodes (the diamonds)
//   - backend edges          → triples, with the backend's real relationship label
//   - core concept → document links say "appears_in" (every concept comes from
//     this document; only core ones are linked to keep the map readable)
export function toKrishiGraph(data, documentId) {
  const docKey = String(documentId);
  const docName = `Document #${documentId}`;
  const docNodeId = `doc-${docKey}`; // Krishi's layout looks for this exact id
  const source = { documentId: docKey, fileName: docName, pageNumber: 1 };

  const connections = {};
  data.nodes.forEach((n) => (connections[n.id] = 0));
  data.edges.forEach((e) => {
    connections[e.source] += 1;
    connections[e.target] += 1;
  });
  const maxConnections = Math.max(0, ...Object.values(connections));
  const others = data.nodes.length - 1;

  const conceptNodes = data.nodes.map((n) => {
    const tier = tierOf(connections[n.id], maxConnections);
    return {
      id: n.id,
      label: n.label,
      kind: tier === "core" ? "bridge" : "concept",
      summary: `Connected to ${connections[n.id]} of ${others} other concepts in ${docName}.`,
      sources: [source],
    };
  });

  const documentNode = {
    id: docNodeId,
    label: docName,
    kind: "document",
    summary: `The uploaded document these ${data.nodes.length} concepts were extracted from.`,
    sources: [source],
  };

  const triples = data.edges.map((e, i) => ({
    id: `t${i}`,
    sourceId: e.source,
    targetId: e.target,
    relation: e.relationship,
    documentId: docKey,
    fileName: docName,
  }));

  conceptNodes
    .filter((n) => n.kind === "bridge")
    .forEach((n, i) =>
      triples.push({
        id: `d${i}`,
        sourceId: n.id,
        targetId: docNodeId,
        relation: "appears_in",
        documentId: docKey,
        fileName: docName,
      })
    );

  return {
    nodes: [documentNode, ...conceptNodes],
    triples,
    focusTopic: docName,
    generatedAt: new Date().toISOString(),
  };
}

// `theme` is optional: "sakura" | "nord" | "lavender" | "obsidian".
// Inside Krishi's dashboard, leave it out — the page picks up her active theme.
export default function BrainMap({ theme }) {
  const [graph, setGraph] = useState(EMPTY_GRAPH);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState(null);

  // Called by the "Generate Map" button. The box holds the document ID.
  async function handleGenerate(input) {
    const text = String(input ?? "").trim();
    const documentId = Number(text);
    if (!text || !Number.isInteger(documentId) || documentId <= 0) {
      setError("Please enter a document ID (a whole number, for example 4).");
      return;
    }

    setIsExtracting(true);
    setError(null);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: documentId }),
      });
      if (!res.ok) {
        // Show the backend's real validation message where possible.
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail?.[0]?.msg || "Failed to generate brain map.");
      }
      const data = await res.json();
      if (data.nodes.length === 0) {
        setError("No concepts found for this document. It may not exist or may be empty.");
        return;
      }
      setGraph(toKrishiGraph(data, documentId));
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Can't reach the Brain Map backend. Is it running on port 8001?"
          : err.message
      );
    } finally {
      setIsExtracting(false);
    }
  }

  return (
    <div className="hbm-root hbm-page" data-theme={theme}>
      <BrainMapView
        graph={graph}
        documents={[]}
        isExtracting={isExtracting}
        extractError={error}
        onExtractGraph={handleGenerate}
        onResetDefaultGraph={() => setError(null)}
        onOpenPageInSearch={() => {}}
      />
    </div>
  );
}