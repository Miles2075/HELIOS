import { useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import "./BrainMap.css";

export default function BrainMap() {
  const [documentId, setDocumentId] = useState("");
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

    function handleGenerate() {
    if (!documentId) {
      setError("Please enter a document ID.");
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