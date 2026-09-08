import networkx as nx

def build_graph(concepts: list[str], relationships: list[tuple[str, str, str]]) -> nx.Graph:
    graph = nx.Graph()
    for concept in concepts:
        graph.add_node(concept, type="concept")

    for source, target, relationship in relationships:
        weight = 1.0  # placeholder scoring — see note below
        graph.add_edge(source, target, relationship=relationship, weight=weight)

    return graph