import { useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import "./BrainMap.css";

// Brain Map page — lets a user enter a document ID, fetches its concept
// graph from the backend, and renders it as an interactive 3D graph.
// Standalone module: no dashboard/sidebar/routing — integration into the
// shared HELIOS shell is handled centrally.
export default function BrainMap() {
  const [documentId, setDocumentId] = useState("");
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  function handleGenerate() {
    if (!documentId) {
      setError("Please enter a document ID.");
      // Clears any leftover graph/selection from a previous successful
      // generate, so stale data never lingers on screen with this error.
      setGraphData({ nodes: [], links: [] });
      setSelectedNode(null);
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedNode(null);

    fetch("http://localhost:8001/api/brainmap/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: Number(documentId) }),
    })
      .then(async (res) => {
        if (!res.ok) {
          // Surfaces the backend's actual validation message (e.g. Pydantic
          // errors) instead of a generic failure string, where possible.
          const errorData = await res.json().catch(() => null);
          const detail = errorData?.detail?.[0]?.msg || "Failed to generate brain map.";
          throw new Error(detail);
        }
        return res.json();
      })
      .then((data) => {
        // A 200 OK with zero nodes is a valid response (e.g. an empty or
        // non-existent document), but it's still an error from the user's
        // point of view — so we treat it as one rather than rendering
        // nothing silently.
        if (data.nodes.length === 0) {
          setError("No concepts found for this document. It may not exist or may be empty.");
          setGraphData({ nodes: [], links: [] });
          setLoading(false);
          return;
        }

        const links = data.edges.map((e) => ({
          source: e.source,
          target: e.target,
          relationship: e.relationship,
        }));
        setGraphData({ nodes: data.nodes, links });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }

  return (
    <div className="brain-map">
      <div className="brain-map-controls">
        <input
          className={`brain-map-input ${error ? "brain-map-input-error" : ""}`}
          type="number"
          placeholder="Enter document ID"
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
        />
        <button className="brain-map-button" onClick={handleGenerate} disabled={loading}>
          {loading ? (
            <>
              <span className="brain-map-spinner"></span>
              Generating...
            </>
          ) : (
            "Generate Brain Map"
          )}
        </button>
      </div>

      {error && <p className="brain-map-error">{error}</p>}

      {selectedNode ? (
        <div className="brain-map-selected">
          <strong>Selected concept:</strong> {selectedNode.label} ({selectedNode.type})
        </div>
      ) : (
        graphData.nodes.length > 0 && (
          <p className="brain-map-hint">Click a node to see its details.</p>
        )
      )}

      <div className="brain-map-graph">
        <ForceGraph3D
          graphData={graphData}
          nodeLabel="label"
          nodeAutoColorBy="type"
          onNodeClick={(node) => setSelectedNode(node)}
        />
      </div>
    </div>
  );
}