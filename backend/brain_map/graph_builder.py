"""
Builds a NetworkX graph from concepts/relationships, and trims it down to a
readable size (cap/filter) before it gets serialized for the API response.
"""

import networkx as nx


def build_graph(concepts: list[str], relationships: list[tuple[str, str, str]]) -> nx.Graph:
    """
    Builds a graph where every concept is a node, and every relationship
    tuple becomes an edge between two nodes.
    """
    graph = nx.Graph()

    for concept in concepts:
        graph.add_node(concept, type="concept")

    for source, target, relationship in relationships:
        # weight is a placeholder (always 1.0) for the MVP — every edge is
        # currently treated as equally important. Real scoring (e.g.
        # co-occurrence or embedding similarity) is a future improvement.
        # This field is internal only and must never reach the API response.
        weight = 1.0
        graph.add_edge(source, target, relationship=relationship, weight=weight)

    return graph


def filter_graph(graph, max_nodes: int = 50, max_edges: int = 150) -> "nx.Graph":
    """
    Trims a graph down to at most max_nodes nodes and max_edges edges, so
    large documents don't produce unreadable graphs.
    """
    # Keep only the top-weighted edges (currently arbitrary, see note above).
    edges_sorted = sorted(
        graph.edges(data=True), key=lambda e: e[2]["weight"], reverse=True
    )
    top_edges = edges_sorted[:max_edges]

    filtered = graph.__class__()

    # All original nodes are added upfront, before any edges. Without this,
    # a node with zero edges (e.g. a document with only one concept, or
    # concepts with no connections) would be silently dropped — since the
    # edge loop below is the only other way nodes get added.
    filtered.add_nodes_from(graph.nodes(data=True))

    for source, target, data in top_edges:
        filtered.add_edge(source, target, **data)

    # If there are still too many nodes after edge-filtering, keep only the
    # most-connected ones (highest degree).
    if filtered.number_of_nodes() > max_nodes:
        degree_sorted = sorted(filtered.degree, key=lambda x: x[1], reverse=True)
        keep_nodes = {n for n, _ in degree_sorted[:max_nodes]}
        filtered = filtered.subgraph(keep_nodes).copy()

    return filtered