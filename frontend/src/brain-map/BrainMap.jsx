import { useState, useEffect } from "react";
import ForceGraph3D from "react-force-graph-3d";

export default function BrainMap() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });

  useEffect(() => {
    fetch("http://localhost:8001/api/brainmap/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: "test123" }),
    })
      .then((res) => res.json())
      .then((data) => {
        const links = data.edges.map((e) => ({
          source: e.source,
          target: e.target,
          relationship: e.relationship,
        }));
        setGraphData({ nodes: data.nodes, links });
      });
  }, []);

  return (
    <div style={{ height: "600px" }}>
      <ForceGraph3D
        graphData={graphData}
        nodeLabel="label"
        nodeAutoColorBy="type"
      />
    </div>
  );
}