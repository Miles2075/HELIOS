import networkx as nx

def build_graph(concepts: list[str], relationships: list[tuple[str, str, str]]) -> nx.Graph:
    graph = nx.Graph()
    for concept in concepts:
        graph.add_node(concept, type="concept")

    for source, target, relationship in relationships:
        weight = 1.0  # placeholder scoring — see note below
        graph.add_edge(source, target, relationship=relationship, weight=weight)

    return graph

def filter_graph(graph, max_nodes: int = 50, max_edges: int = 150) -> "nx.Graph":
    edges_sorted = sorted(
        graph.edges(data=True), key=lambda e: e[2]["weight"], reverse=True
    )
    top_edges = edges_sorted[:max_edges]

    filtered = graph.__class__()
    for source, target, data in top_edges:
        filtered.add_edge(source, target, **data)

    if filtered.number_of_nodes() > max_nodes:
        degree_sorted = sorted(filtered.degree, key=lambda x: x[1], reverse=True)
        keep_nodes = {n for n, _ in degree_sorted[:max_nodes]}
        filtered = filtered.subgraph(keep_nodes).copy()

    return filtered