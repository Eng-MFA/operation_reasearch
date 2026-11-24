from typing import Dict, Any, List, Optional
from pydantic import BaseModel

class SolverInfo(BaseModel):
    id: str
    name: str
    version: str
    category: str
    description: str
    supports_continuous: bool
    supports_integer: bool
    supports_binary: bool
    supports_quadratic: bool
    supports_nonlinear: bool
    supports_duals: bool
    is_available: bool

class SolverRegistry:
    """
    Central Solver Registry mapping optimization problem types to suitable solvers
    and tracking availability of installed mathematical solver libraries.
    """

    def __init__(self):
        self._solvers: Dict[str, SolverInfo] = {}
        self._detect_solvers()

    def _detect_solvers(self):
        # 1. HiGHS (via highspy)
        highs_available = False
        highs_ver = "Unknown"
        try:
            import highspy
            h = highspy.Highs()
            highs_ver = h.version()
            highs_available = True
        except Exception:
            pass

        self._solvers["highs"] = SolverInfo(
            id="highs",
            name="HiGHS C++ Optimization Engine",
            version=highs_ver,
            category="Linear & Mixed-Integer",
            description="State-of-the-art open-source solver for continuous linear, mixed-integer linear, and quadratic programs.",
            supports_continuous=True,
            supports_integer=True,
            supports_binary=True,
            supports_quadratic=True,
            supports_nonlinear=False,
            supports_duals=True,
            is_available=highs_available
        )

        # 2. SciPy Optimize
        scipy_available = False
        scipy_ver = "Unknown"
        try:
            import scipy
            scipy_ver = scipy.__version__
            scipy_available = True
        except Exception:
            pass

        self._solvers["scipy_linprog"] = SolverInfo(
            id="scipy_linprog",
            name="SciPy linprog (HiGHS Simplex & Interior Point)",
            version=scipy_ver,
            category="Linear Programming",
            description="SciPy's unified interface to HiGHS dual-simplex, interior point, and revised simplex.",
            supports_continuous=True,
            supports_integer=False,
            supports_binary=False,
            supports_quadratic=False,
            supports_nonlinear=False,
            supports_duals=True,
            is_available=scipy_available
        )

        self._solvers["scipy_minimize"] = SolverInfo(
            id="scipy_minimize",
            name="SciPy minimize (SLSQP, BFGS, Trust-Constr)",
            version=scipy_ver,
            category="Nonlinear Programming",
            description="Nonlinear optimization methods: Sequential Least Squares Programming, Quasi-Newton, and Trust-Region Interior Point.",
            supports_continuous=True,
            supports_integer=False,
            supports_binary=False,
            supports_quadratic=True,
            supports_nonlinear=True,
            supports_duals=False,
            is_available=scipy_available
        )

        # 3. Google OR-Tools
        ortools_available = False
        ortools_ver = "Unknown"
        try:
            import ortools
            ortools_ver = ortools.__version__
            ortools_available = True
        except Exception:
            pass

        self._solvers["ortools_cpsat"] = SolverInfo(
            id="ortools_cpsat",
            name="Google OR-Tools CP-SAT",
            version=ortools_ver,
            category="Constraint & Combinatorial Programming",
            description="Leading SAT-based finite domain constraint programming solver with lazy clause generation for scheduling and discrete optimization.",
            supports_continuous=False,
            supports_integer=True,
            supports_binary=True,
            supports_quadratic=False,
            supports_nonlinear=False,
            supports_duals=False,
            is_available=ortools_available
        )

        self._solvers["ortools_routing"] = SolverInfo(
            id="ortools_routing",
            name="Google OR-Tools Routing Library",
            version=ortools_ver,
            category="Routing & Logistics",
            description="Vehicle Routing Problem (VRP, CVRP, VRPTW) engine with metaheuristic local search.",
            supports_continuous=False,
            supports_integer=True,
            supports_binary=True,
            supports_quadratic=False,
            supports_nonlinear=False,
            supports_duals=False,
            is_available=ortools_available
        )

        # 4. NetworkX
        nx_available = False
        nx_ver = "Unknown"
        try:
            import networkx as nx
            nx_ver = nx.__version__
            nx_available = True
        except Exception:
            pass

        self._solvers["networkx"] = SolverInfo(
            id="networkx",
            name="NetworkX Graph Algorithms",
            version=nx_ver,
            category="Network Optimization",
            description="Pure Python graph theory algorithms for Shortest Path, Min Spanning Tree, and Max Flow / Min Cut.",
            supports_continuous=True,
            supports_integer=True,
            supports_binary=True,
            supports_quadratic=False,
            supports_nonlinear=False,
            supports_duals=False,
            is_available=nx_available
        )

        # 5. DEAP Metaheuristics
        deap_available = False
        deap_ver = "Unknown"
        try:
            import deap
            deap_ver = deap.__version__
            deap_available = True
        except Exception:
            pass

        self._solvers["deap"] = SolverInfo(
            id="deap",
            name="DEAP Evolutionary Computation",
            version=deap_ver,
            category="Metaheuristics",
            description="Distributed Evolutionary Algorithms in Python for Genetic Algorithms and Particle Swarm Optimization.",
            supports_continuous=True,
            supports_integer=True,
            supports_binary=True,
            supports_quadratic=True,
            supports_nonlinear=True,
            supports_duals=False,
            is_available=deap_available
        )

    def list_solvers(self) -> List[SolverInfo]:
        return list(self._solvers.values())

    def get_solver(self, solver_id: str) -> Optional[SolverInfo]:
        return self._solvers.get(solver_id)

    def select_best_solver(
        self,
        problem_type: str,
        has_integers: bool = False,
        is_nonlinear: bool = False,
        is_network: bool = False,
        is_routing: bool = False,
        is_scheduling: bool = False
    ) -> str:
        """Selects the mathematically most appropriate installed solver."""
        if is_routing:
            return "ortools_routing"
        if is_scheduling:
            return "ortools_cpsat"
        if is_network:
            return "networkx"
        if is_nonlinear:
            return "scipy_minimize"
        if has_integers:
            return "highs"
        # Continuous LP
        return "highs"

solver_registry = SolverRegistry()
