import time
import networkx as nx
from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel, Field

class NetworkNode(BaseModel):
    id: str
    label: Optional[str] = None
    demand: float = 0.0  # Positive for sink/demand, negative for source/supply, 0 for transshipment
    x: Optional[float] = None
    y: Optional[float] = None

class NetworkEdge(BaseModel):
    source: str
    target: str
    weight: float = 1.0  # cost or distance
    capacity: Optional[float] = None
    lower_bound: float = 0.0

class NetworkModelRequest(BaseModel):
    name: str = "Network Optimization Problem"
    algorithm: str = "dijkstra"  # "dijkstra", "bellman-ford", "floyd-warshall", "kruskal", "prim", "max-flow", "min-cost-flow"
    is_directed: bool = True
    nodes: List[NetworkNode]
    edges: List[NetworkEdge]
    source_node: Optional[str] = None
    target_node: Optional[str] = None

class ShortestPathResult(BaseModel):
    total_distance: float
    path_nodes: List[str]
    path_edges: List[Tuple[str, str]]
    has_negative_cycle: bool = False

class SpanningTreeResult(BaseModel):
    total_weight: float
    tree_edges: List[Tuple[str, str, float]]

class MaxFlowResult(BaseModel):
    max_flow_value: float
    edge_flows: List[Dict[str, Any]]
    min_cut_source_partition: List[str]
    min_cut_sink_partition: List[str]
    cut_capacity: float

class NetworkResultResponse(BaseModel):
    status: str
    algorithm: str
    execution_time_sec: float
    shortest_path_result: Optional[ShortestPathResult] = None
    all_pairs_distances: Optional[Dict[str, Dict[str, float]]] = None
    spanning_tree_result: Optional[SpanningTreeResult] = None
    max_flow_result: Optional[MaxFlowResult] = None
    min_cost_flow_total_cost: Optional[float] = None
    graph_elements: Dict[str, Any]
    mathematical_summary: str


class NetworkSolver:
    """
    Network Optimization solver using NetworkX and exact graph algorithms:
    Dijkstra, Bellman-Ford, Floyd-Warshall, Kruskal, Prim, Edmonds-Karp, and Min-Cost Flow.
    """

    def solve(self, req: NetworkModelRequest) -> NetworkResultResponse:
        start_time = time.perf_counter()

        algo = req.algorithm.lower().strip()

        # Build Graph
        if req.is_directed:
            G = nx.DiGraph()
        else:
            G = nx.Graph()

        for n in req.nodes:
            G.add_node(n.id, demand=n.demand, label=n.label or n.id, x=n.x, y=n.y)

        for e in req.edges:
            cap = e.capacity if e.capacity is not None else float("inf")
            G.add_edge(e.source, e.target, weight=e.weight, capacity=cap, weight_cost=e.weight)

        sp_result = None
        all_pairs = None
        mst_result = None
        flow_result = None
        min_cost = None
        highlighted_edges = []
        highlighted_nodes = []

        if algo == "dijkstra":
            if not req.source_node or not req.target_node:
                raise ValueError("Source and target nodes are required for Dijkstra algorithm.")
            path = nx.dijkstra_path(G, req.source_node, req.target_node, weight="weight")
            dist = nx.dijkstra_path_length(G, req.source_node, req.target_node, weight="weight")
            path_edges = list(zip(path[:-1], path[1:]))
            sp_result = ShortestPathResult(total_distance=float(dist), path_nodes=path, path_edges=path_edges)
            highlighted_edges = path_edges
            highlighted_nodes = path
            summary = f"Dijkstra shortest path from {req.source_node} to {req.target_node}: distance = {dist:.4g}, path: {' -> '.join(path)}."

        elif algo == "bellman-ford":
            if not req.source_node or not req.target_node:
                raise ValueError("Source and target nodes are required for Bellman-Ford algorithm.")
            try:
                dist, path = nx.single_source_bellman_ford(G, req.source_node, req.target_node, weight="weight")
                path_edges = list(zip(path[:-1], path[1:]))
                sp_result = ShortestPathResult(total_distance=float(dist), path_nodes=path, path_edges=path_edges)
                highlighted_edges = path_edges
                highlighted_nodes = path
                summary = f"Bellman-Ford shortest path from {req.source_node} to {req.target_node}: distance = {dist:.4g}. No negative cycle."
            except nx.NetworkXUnbounded:
                sp_result = ShortestPathResult(total_distance=-float("inf"), path_nodes=[], path_edges=[], has_negative_cycle=True)
                summary = f"Bellman-Ford detected a negative weight cycle reachable from {req.source_node}."

        elif algo == "floyd-warshall":
            dist_dict = dict(nx.floyd_warshall(G, weight="weight"))
            all_pairs = {u: {v: float(d) for v, d in row.items()} for u, row in dist_dict.items()}
            summary = f"Floyd-Warshall all-pairs shortest distances computed for {len(G.nodes)} nodes."

        elif algo in ("kruskal", "prim"):
            # MST requires undirected graph
            G_undir = G.to_undirected() if req.is_directed else G
            algo_type = "kruskal" if algo == "kruskal" else "prim"
            mst = nx.minimum_spanning_tree(G_undir, weight="weight", algorithm=algo_type)
            total_wt = float(sum(d["weight"] for u, v, d in mst.edges(data=True)))
            tree_edges = [(u, v, float(d["weight"])) for u, v, d in mst.edges(data=True)]
            mst_result = SpanningTreeResult(total_weight=total_wt, tree_edges=tree_edges)
            highlighted_edges = [(u, v) for u, v, _ in tree_edges]
            summary = f"Minimum Spanning Tree computed via {algo.capitalize()}: Total weight = {total_wt:.4g} ({len(tree_edges)} edges)."

        elif algo in ("max-flow", "edmonds-karp"):
            if not req.source_node or not req.target_node:
                raise ValueError("Source and target nodes are required for Maximum Flow.")
            flow_val, flow_dict = nx.maximum_flow(G, req.source_node, req.target_node, flow_func=nx.algorithms.flow.edmonds_karp)
            cut_val, partition = nx.minimum_cut(G, req.source_node, req.target_node, flow_func=nx.algorithms.flow.edmonds_karp)

            edge_flows = []
            for u in flow_dict:
                for v, fl in flow_dict[u].items():
                    if fl > 0:
                        cap = G[u][v].get("capacity", float("inf"))
                        edge_flows.append({"source": u, "target": v, "flow": float(fl), "capacity": float(cap) if cap != float("inf") else -1})
                        highlighted_edges.append((u, v))

            s_partition = list(partition[0])
            t_partition = list(partition[1])
            flow_result = MaxFlowResult(
                max_flow_value=float(flow_val),
                edge_flows=edge_flows,
                min_cut_source_partition=s_partition,
                min_cut_sink_partition=t_partition,
                cut_capacity=float(cut_val)
            )
            summary = f"Maximum Flow from {req.source_node} to {req.target_node} = {flow_val:.4g}. Max-Flow Min-Cut capacity = {cut_val:.4g}."

        elif algo == "min-cost-flow":
            flow_dict = nx.min_cost_flow(G, demand="demand", capacity="capacity", weight="weight")
            min_cost = float(nx.cost_of_flow(G, flow_dict, weight="weight"))
            edge_flows = []
            for u in flow_dict:
                for v, fl in flow_dict[u].items():
                    if fl > 0:
                        cap = G[u][v].get("capacity", float("inf"))
                        edge_flows.append({"source": u, "target": v, "flow": float(fl), "capacity": float(cap) if cap != float("inf") else -1})
                        highlighted_edges.append((u, v))

            flow_result = MaxFlowResult(
                max_flow_value=0.0,
                edge_flows=edge_flows,
                min_cut_source_partition=[],
                min_cut_sink_partition=[],
                cut_capacity=0.0
            )
            summary = f"Minimum Cost Flow optimal total cost = {min_cost:.4g} satisfying all node supply/demand balances."

        else:
            raise ValueError(f"Unknown network algorithm: {algo}")

        exec_time = time.perf_counter() - start_time

        # Build graph elements for UI rendering
        pos = nx.spring_layout(G, seed=42)
        nodes_ui = []
        for n_id in G.nodes:
            coord = pos.get(n_id, [0.0, 0.0])
            nodes_ui.append({
                "id": n_id,
                "label": G.nodes[n_id].get("label", n_id),
                "is_highlighted": n_id in highlighted_nodes,
                "x": float(coord[0]) * 300 + 350,
                "y": float(coord[1]) * 200 + 250
            })

        edges_ui = []
        for u, v, d in G.edges(data=True):
            is_hl = (u, v) in highlighted_edges or (v, u) in highlighted_edges
            edges_ui.append({
                "source": u,
                "target": v,
                "weight": float(d.get("weight", 1.0)),
                "capacity": float(d.get("capacity", -1)),
                "is_highlighted": is_hl
            })

        return NetworkResultResponse(
            status="SUCCESS",
            algorithm=req.algorithm,
            execution_time_sec=exec_time,
            shortest_path_result=sp_result,
            all_pairs_distances=all_pairs,
            spanning_tree_result=mst_result,
            max_flow_result=flow_result,
            min_cost_flow_total_cost=min_cost,
            graph_elements={"nodes": nodes_ui, "edges": edges_ui},
            mathematical_summary=summary
        )

network_solver = NetworkSolver()
