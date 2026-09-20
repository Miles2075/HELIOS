"""
Converts a filtered NetworkX graph into the exact JSON shape defined by the
Brain Map API contract.
"""

import uuid


def serialize_graph(graph) -> dict:
    """
    Serializes a graph into {success, map_id, nodes, edges}, matching the
    confirmed API response schema exactly.
    """
    # NetworkX nodes are plain concept strings (e.g. "mitochondria"); the API
    # contract needs short ids instead, so this maps each name to one.
    node_id_map = {name: f"n{i}" for i, name in enumerate(graph.nodes())}

    nodes = [
        {"id": node_id_map[name], "label": name, "type": data.get("type", "concept")}
        for name, data in graph.nodes(data=True)
    ]

    edges = [
        {
            "source": node_id_map[u],
            "target": node_id_map[v],
            "relationship": data["relationship"],
        }
        for u, v, data in graph.edges(data=True)
        # Note: "weight" is intentionally left out here — it's an internal
        # scoring field used only by filter_graph, and must never appear in
        # the API response, per the confirmed contract.
    ]

    return {
        "success": True,
        "map_id": str(uuid.uuid4()),
        "nodes": nodes,
        "edges": edges,
    }