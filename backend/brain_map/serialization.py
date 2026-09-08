import uuid

def serialize_graph(graph) -> dict:
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
    ]

    return {
        "success": True,
        "map_id": str(uuid.uuid4()),
        "nodes": nodes,
        "edges": edges,
    }