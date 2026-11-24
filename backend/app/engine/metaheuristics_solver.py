import time
import math
import numpy as np
from typing import Dict, List, Any, Optional, Tuple, Callable
from pydantic import BaseModel, Field
from scipy.optimize import differential_evolution

from app.engine.expression_parser import SafeExpressionParser

class MetaheuristicVariable(BaseModel):
    name: str
    lower_bound: float = 0.0
    upper_bound: float = 10.0

class MetaheuristicRequest(BaseModel):
    algorithm: str = "genetic_algorithm"  # "genetic_algorithm", "particle_swarm", "simulated_annealing", "differential_evolution"
    sense: str = "minimize"  # "minimize" or "maximize"
    variables: List[MetaheuristicVariable]
    objective_expression: str  # e.g., "x1^2 + x2^2 - 10*cos(2*pi*x1) - 10*cos(2*pi*x2) + 20" (Rastrigin)
    population_size: int = 50
    max_generations: int = 100
    mutation_rate: float = 0.1
    crossover_rate: float = 0.8
    temperature_initial: float = 1000.0
    cooling_rate: float = 0.95

class MetaheuristicResultResponse(BaseModel):
    status: str
    algorithm: str
    is_heuristic: bool = True
    optimality_guarantee: str = "None (Approximate Metaheuristic Search)"
    best_objective_value: float
    best_variables: Dict[str, float]
    convergence_history: List[Dict[str, Any]]
    generations_completed: int
    evaluations_count: int
    execution_time_sec: float
    mathematical_summary: str


class MetaheuristicsSolver:
    """
    Nature-inspired Metaheuristic Optimization Engine:
    Genetic Algorithms (GA), Particle Swarm Optimization (PSO),
    Simulated Annealing (SA), and Differential Evolution.
    """

    def solve(self, req: MetaheuristicRequest) -> MetaheuristicResultResponse:
        start_time = time.perf_counter()
        algo = req.algorithm.lower().strip()

        var_names = [v.name for v in req.variables]
        num_vars = len(var_names)
        bounds = [(v.lower_bound, v.upper_bound) for v in req.variables]

        # Parse objective safely into numerical function
        import sympy
        sympy_symbols = [sympy.Symbol(v) for v in var_names]
        sympy_obj = SafeExpressionParser.validate_and_parse(req.objective_expression)
        f_num = sympy.lambdify(sympy_symbols, sympy_obj, modules=["numpy", "math"])

        sense_factor = -1.0 if req.sense.lower() == "maximize" else 1.0

        def fitness_func(x):
            try:
                val = float(f_num(*list(x)))
                return val * sense_factor
            except Exception:
                return 1e12

        if algo == "differential_evolution":
            res = self._run_de(fitness_func, bounds, req, sense_factor)
        elif algo in ("particle_swarm", "pso"):
            res = self._run_pso(fitness_func, bounds, req, sense_factor)
        elif algo in ("simulated_annealing", "sa"):
            res = self._run_sa(fitness_func, bounds, req, sense_factor)
        else:
            res = self._run_ga(fitness_func, bounds, req, sense_factor)

        exec_time = time.perf_counter() - start_time
        res.execution_time_sec = exec_time

        res.mathematical_summary = (
            f"Metaheuristic ({req.algorithm.upper()}) completed {res.generations_completed} iterations ({res.evaluations_count} evaluations). "
            f"Best Objective: {res.best_objective_value:.6g}. "
            f"NOTE: As a metaheuristic, global mathematical optimality is NOT guaranteed."
        )

        return res

    def _run_ga(self, f: Callable, bounds: List[Tuple[float, float]], req: MetaheuristicRequest, sense_factor: float) -> MetaheuristicResultResponse:
        pop_size = req.population_size
        gens = req.max_generations
        n_vars = len(bounds)
        rng = np.random.default_rng(42)

        # Initialize population
        lbs = np.array([b[0] for b in bounds])
        ubs = np.array([b[1] for b in bounds])
        pop = rng.uniform(lbs, ubs, (pop_size, n_vars))
        fitness = np.array([f(ind) for ind in pop])

        best_idx = np.argmin(fitness)
        best_sol = pop[best_idx].copy()
        best_fit = fitness[best_idx]

        history = [{"iteration": 0, "best_value": round(float(best_fit * sense_factor), 4), "mean_value": round(float(np.mean(fitness) * sense_factor), 4)}]

        for gen in range(1, gens + 1):
            # Tournament selection
            new_pop = []
            for _ in range(pop_size):
                i1, i2 = rng.integers(0, pop_size, 2)
                winner = pop[i1] if fitness[i1] < fitness[i2] else pop[i2]
                new_pop.append(winner.copy())
            new_pop = np.array(new_pop)

            # Crossover (Arithmetic blending)
            for i in range(0, pop_size - 1, 2):
                if rng.random() < req.crossover_rate:
                    alpha = rng.random()
                    c1 = alpha * new_pop[i] + (1 - alpha) * new_pop[i + 1]
                    c2 = (1 - alpha) * new_pop[i] + alpha * new_pop[i + 1]
                    new_pop[i], new_pop[i + 1] = c1, c2

            # Mutation (Gaussian jitter)
            for i in range(pop_size):
                for j in range(n_vars):
                    if rng.random() < req.mutation_rate:
                        span = ubs[j] - lbs[j]
                        new_pop[i, j] += rng.normal(0, span * 0.1)

            # Clip to bounds
            new_pop = np.clip(new_pop, lbs, ubs)
            # Elitism: retain previous best
            new_pop[0] = best_sol

            pop = new_pop
            fitness = np.array([f(ind) for ind in pop])

            cur_best_idx = np.argmin(fitness)
            if fitness[cur_best_idx] < best_fit:
                best_fit = fitness[cur_best_idx]
                best_sol = pop[cur_best_idx].copy()

            if gen % max(1, gens // 25) == 0 or gen == gens:
                history.append({
                    "iteration": gen,
                    "best_value": round(float(best_fit * sense_factor), 4),
                    "mean_value": round(float(np.mean(fitness) * sense_factor), 4)
                })

        var_dict = {req.variables[j].name: round(float(best_sol[j]), 4) for j in range(n_vars)}

        return MetaheuristicResultResponse(
            status="FINISHED",
            algorithm="Genetic Algorithm (GA)",
            best_objective_value=float(best_fit * sense_factor),
            best_variables=var_dict,
            convergence_history=history,
            generations_completed=gens,
            evaluations_count=pop_size * (gens + 1),
            execution_time_sec=0.0,
            mathematical_summary=""
        )

    def _run_pso(self, f: Callable, bounds: List[Tuple[float, float]], req: MetaheuristicRequest, sense_factor: float) -> MetaheuristicResultResponse:
        pop_size = req.population_size
        gens = req.max_generations
        n_vars = len(bounds)
        rng = np.random.default_rng(42)

        lbs = np.array([b[0] for b in bounds])
        ubs = np.array([b[1] for b in bounds])

        X = rng.uniform(lbs, ubs, (pop_size, n_vars))
        V = rng.uniform(-(ubs - lbs) * 0.1, (ubs - lbs) * 0.1, (pop_size, n_vars))
        P_best = X.copy()
        P_best_fit = np.array([f(x) for x in X])

        g_best_idx = np.argmin(P_best_fit)
        G_best = P_best[g_best_idx].copy()
        G_best_fit = P_best_fit[g_best_idx]

        w = 0.7  # inertia weight
        c1, c2 = 1.5, 1.5  # cognitive and social acceleration

        history = [{"iteration": 0, "best_value": round(float(G_best_fit * sense_factor), 4)}]

        for it in range(1, gens + 1):
            r1 = rng.random((pop_size, n_vars))
            r2 = rng.random((pop_size, n_vars))

            V = w * V + c1 * r1 * (P_best - X) + c2 * r2 * (G_best - X)
            X = np.clip(X + V, lbs, ubs)

            for i in range(pop_size):
                fit = f(X[i])
                if fit < P_best_fit[i]:
                    P_best_fit[i] = fit
                    P_best[i] = X[i].copy()
                    if fit < G_best_fit:
                        G_best_fit = fit
                        G_best = X[i].copy()

            if it % max(1, gens // 25) == 0 or it == gens:
                history.append({"iteration": it, "best_value": round(float(G_best_fit * sense_factor), 4)})

        var_dict = {req.variables[j].name: round(float(G_best[j]), 4) for j in range(n_vars)}

        return MetaheuristicResultResponse(
            status="FINISHED",
            algorithm="Particle Swarm Optimization (PSO)",
            best_objective_value=float(G_best_fit * sense_factor),
            best_variables=var_dict,
            convergence_history=history,
            generations_completed=gens,
            evaluations_count=pop_size * (gens + 1),
            execution_time_sec=0.0,
            mathematical_summary=""
        )

    def _run_sa(self, f: Callable, bounds: List[Tuple[float, float]], req: MetaheuristicRequest, sense_factor: float) -> MetaheuristicResultResponse:
        gens = req.max_generations * 10
        n_vars = len(bounds)
        rng = np.random.default_rng(42)

        lbs = np.array([b[0] for b in bounds])
        ubs = np.array([b[1] for b in bounds])

        curr_x = rng.uniform(lbs, ubs)
        curr_fit = f(curr_x)
        best_x = curr_x.copy()
        best_fit = curr_fit

        T = req.temperature_initial
        alpha = req.cooling_rate
        history = [{"iteration": 0, "best_value": round(float(best_fit * sense_factor), 4)}]

        for it in range(1, gens + 1):
            # Propose neighbor
            step = rng.normal(0, (ubs - lbs) * 0.05)
            neighbor = np.clip(curr_x + step, lbs, ubs)
            neighbor_fit = f(neighbor)

            delta = neighbor_fit - curr_fit
            if delta < 0 or rng.random() < math.exp(-delta / max(1e-8, T)):
                curr_x = neighbor
                curr_fit = neighbor_fit
                if curr_fit < best_fit:
                    best_fit = curr_fit
                    best_x = curr_x.copy()

            T *= alpha
            if it % max(1, gens // 25) == 0 or it == gens:
                history.append({"iteration": it, "best_value": round(float(best_fit * sense_factor), 4)})

        var_dict = {req.variables[j].name: round(float(best_x[j]), 4) for j in range(n_vars)}

        return MetaheuristicResultResponse(
            status="FINISHED",
            algorithm="Simulated Annealing (SA)",
            best_objective_value=float(best_fit * sense_factor),
            best_variables=var_dict,
            convergence_history=history,
            generations_completed=gens,
            evaluations_count=gens,
            execution_time_sec=0.0,
            mathematical_summary=""
        )

    def _run_de(self, f: Callable, bounds: List[Tuple[float, float]], req: MetaheuristicRequest, sense_factor: float) -> MetaheuristicResultResponse:
        history = []

        def callback(xk, convergence):
            val = float(f(xk)) * sense_factor
            history.append({"iteration": len(history) + 1, "best_value": round(val, 4)})

        res = differential_evolution(
            func=f,
            bounds=bounds,
            maxiter=req.max_generations,
            popsize=req.population_size // len(bounds),
            callback=callback,
            seed=42
        )

        var_dict = {req.variables[j].name: round(float(res.x[j]), 4) for j in range(len(bounds))}

        return MetaheuristicResultResponse(
            status="FINISHED",
            algorithm="Differential Evolution (SciPy)",
            best_objective_value=float(res.fun * sense_factor),
            best_variables=var_dict,
            convergence_history=history,
            generations_completed=int(res.nit),
            evaluations_count=int(res.nfev),
            execution_time_sec=0.0,
            mathematical_summary=""
        )

metaheuristics_solver = MetaheuristicsSolver()
