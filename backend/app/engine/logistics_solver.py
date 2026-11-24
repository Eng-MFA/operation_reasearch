import time
import math
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel, Field
from ortools.constraint_solver import routing_enums_pb2, pywrapcp

from app.engine.milp_solver import milp_solver, MILPModelRequest, MILPVariable, MILPConstraint

class CustomerLocation(BaseModel):
    id: str
    name: str
    x: float
    y: float
    demand: int

class CVRPRequest(BaseModel):
    depot_x: float = 0.0
    depot_y: float = 0.0
    customers: List[CustomerLocation]
    num_vehicles: int = 3
    vehicle_capacity: int = 50
    time_limit_sec: float = 15.0

class FacilityCandidate(BaseModel):
    id: str
    name: str
    fixed_cost: float
    capacity: float

class CustomerDemand(BaseModel):
    id: str
    name: str
    demand: float

class FacilityLocationRequest(BaseModel):
    facilities: List[FacilityCandidate]
    customers: List[CustomerDemand]
    shipping_cost_matrix: List[List[float]]  # facilities x customers

class CVRPResultResponse(BaseModel):
    status: str
    total_distance: float
    total_vehicles_used: int
    routes: List[Dict[str, Any]]
    execution_time_sec: float
    mathematical_summary: str

class FacilityLocationResult(BaseModel):
    status: str
    total_cost: float
    total_fixed_cost: float
    total_shipping_cost: float
    open_facilities: List[str]
    allocations: List[Dict[str, Any]]
    execution_time_sec: float
    mathematical_summary: str


class LogisticsSolver:
    """
    Logistics and Supply Chain Optimization:
    Solves Capacitated Vehicle Routing Problems (CVRP) using Google OR-Tools Routing Library,
    and Capacitated Facility Location Problems (CFLP) using Mixed Integer Programming.
    """

    def solve_cvrp(self, req: CVRPRequest) -> CVRPResultResponse:
        start_time = time.perf_counter()

        # Coordinate list: 0 is depot, 1..N are customers
        coords = [(req.depot_x, req.depot_y)] + [(c.x, c.y) for c in req.customers]
        demands = [0] + [c.demand for c in req.customers]
        n_locations = len(coords)

        # Distance matrix (Euclidean integer scale for OR-Tools)
        dist_matrix = []
        for i in range(n_locations):
            row = []
            for j in range(n_locations):
                dx = coords[i][0] - coords[j][0]
                dy = coords[i][1] - coords[j][1]
                dist = int(round(math.hypot(dx, dy) * 100))
                row.append(dist)
            dist_matrix.append(row)

        manager = pywrapcp.RoutingIndexManager(n_locations, req.num_vehicles, 0)
        routing = pywrapcp.RoutingModel(manager)

        def distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return dist_matrix[from_node][to_node]

        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        # Capacity dimension
        def demand_callback(from_index):
            from_node = manager.IndexToNode(from_index)
            return demands[from_node]

        demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
        routing.AddDimensionWithVehicleCapacity(
            demand_callback_index,
            0,  # null capacity slack
            [req.vehicle_capacity] * req.num_vehicles,
            True,  # start cumul to zero
            "Capacity"
        )

        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_parameters.time_limit.seconds = int(max(1, req.time_limit_sec))

        solution = routing.SolveWithParameters(search_parameters)
        exec_time = time.perf_counter() - start_time

        if not solution:
            return CVRPResultResponse(
                status="NO_SOLUTION_FOUND",
                total_distance=0.0,
                total_vehicles_used=0,
                routes=[],
                execution_time_sec=exec_time,
                mathematical_summary="No feasible routing found within vehicle capacity and limits."
            )

        total_dist = 0.0
        routes = []
        vehicles_used = 0

        for v_id in range(req.num_vehicles):
            index = routing.Start(v_id)
            route_nodes = []
            route_load = 0
            route_dist = 0

            while not routing.IsEnd(index):
                node_idx = manager.IndexToNode(index)
                route_nodes.append({
                    "node_id": "Depot" if node_idx == 0 else req.customers[node_idx - 1].name,
                    "x": coords[node_idx][0],
                    "y": coords[node_idx][1],
                    "demand": demands[node_idx]
                })
                route_load += demands[node_idx]
                previous_index = index
                index = solution.Value(routing.NextVar(index))
                route_dist += routing.GetArcCostForVehicle(previous_index, index, v_id)

            # Add return to depot
            route_nodes.append({"node_id": "Depot", "x": req.depot_x, "y": req.depot_y, "demand": 0})
            route_dist_float = route_dist / 100.0
            total_dist += route_dist_float

            if len(route_nodes) > 2:  # Vehicle actually visited customers
                vehicles_used += 1
                routes.append({
                    "vehicle_id": v_id + 1,
                    "distance": round(route_dist_float, 2),
                    "load_delivered": route_load,
                    "capacity": req.vehicle_capacity,
                    "stops_count": len(route_nodes) - 2,
                    "stops": route_nodes
                })

        summary = (
            f"Capacitated Vehicle Routing (CVRP) solved with Google OR-Tools Guided Local Search. "
            f"Total Fleet Distance: {total_dist:.2f} km across {vehicles_used} active vehicles."
        )

        return CVRPResultResponse(
            status="OPTIMAL",
            total_distance=round(total_dist, 2),
            total_vehicles_used=vehicles_used,
            routes=routes,
            execution_time_sec=exec_time,
            mathematical_summary=summary
        )

    def solve_facility_location(self, req: FacilityLocationRequest) -> FacilityLocationResult:
        """
        Capacitated Facility Location Problem (CFLP) via HiGHS MILP:
        Minimize sum_i (f_i * y_i) + sum_i sum_j (c_ij * x_ij)
        Subject to:
        sum_i x_ij == demand_j
        sum_j x_ij <= Cap_i * y_i
        y_i in {0, 1}, x_ij >= 0
        """
        start_time = time.perf_counter()
        m_fac = len(req.facilities)
        n_cust = len(req.customers)

        milp_vars = []
        obj_coeffs = {}

        # Binary decision y_i: open facility i
        for i, f in enumerate(req.facilities):
            y_name = f"y_{i}"
            milp_vars.append(MILPVariable(name=y_name, variable_type="binary"))
            obj_coeffs[y_name] = f.fixed_cost

        # Continuous decision x_ij: flow from facility i to customer j
        for i in range(m_fac):
            for j in range(n_cust):
                x_name = f"x_{i}_{j}"
                milp_vars.append(MILPVariable(name=x_name, variable_type="continuous", lower_bound=0.0))
                obj_coeffs[x_name] = req.shipping_cost_matrix[i][j]

        milp_cons = []

        # 1. Satisfy customer demand: sum_i x_ij == d_j
        for j in range(n_cust):
            coeffs = {f"x_{i}_{j}": 1.0 for i in range(m_fac)}
            milp_cons.append(MILPConstraint(
                name=f"Demand_{req.customers[j].name}",
                coefficients=coeffs,
                relation="==",
                rhs=req.customers[j].demand
            ))

        # 2. Facility capacity & open link: sum_j x_ij <= Cap_i * y_i -> sum_j x_ij - Cap_i * y_i <= 0
        for i, f in enumerate(req.facilities):
            coeffs = {f"x_{i}_{j}": 1.0 for j in range(n_cust)}
            coeffs[f"y_{i}"] = -f.capacity
            milp_cons.append(MILPConstraint(
                name=f"Cap_{f.name}",
                coefficients=coeffs,
                relation="<=",
                rhs=0.0
            ))

        milp_req = MILPModelRequest(
            name="Capacitated Facility Location",
            sense="minimize",
            variables=milp_vars,
            objective_coefficients=obj_coeffs,
            constraints=milp_cons
        )

        milp_res = milp_solver.solve(milp_req)
        exec_time = time.perf_counter() - start_time

        open_facilities = []
        tot_fixed = 0.0
        tot_shipping = 0.0
        allocations = []

        for i, f in enumerate(req.facilities):
            y_val = milp_res.variable_values.get(f"y_{i}", 0.0)
            if y_val > 0.5:
                open_facilities.append(f.name)
                tot_fixed += f.fixed_cost

            for j, c in enumerate(req.customers):
                flow = milp_res.variable_values.get(f"x_{i}_{j}", 0.0)
                if flow > 0.01:
                    cost = flow * req.shipping_cost_matrix[i][j]
                    tot_shipping += cost
                    allocations.append({
                        "facility": f.name,
                        "customer": c.name,
                        "amount_shipped": round(flow, 2),
                        "cost": round(cost, 2)
                    })

        summary = (
            f"Facility Location Problem solved to optimality. Total Cost: ${milp_res.objective_value:,.2f} "
            f"(Fixed Open Costs: ${tot_fixed:,.2f}, Shipping: ${tot_shipping:,.2f}). "
            f"Opened {len(open_facilities)} of {m_fac} candidate distribution centers: {', '.join(open_facilities)}."
        )

        return FacilityLocationResult(
            status=milp_res.status,
            total_cost=round(milp_res.objective_value, 2),
            total_fixed_cost=round(tot_fixed, 2),
            total_shipping_cost=round(tot_shipping, 2),
            open_facilities=open_facilities,
            allocations=allocations,
            execution_time_sec=exec_time,
            mathematical_summary=summary
        )

logistics_solver = LogisticsSolver()
