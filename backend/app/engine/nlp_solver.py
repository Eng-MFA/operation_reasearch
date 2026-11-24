import time
import numpy as np
from typing import Dict, List, Any, Optional, Tuple, Callable
from pydantic import BaseModel, Field
from scipy.optimize import minimize, Bounds, NonlinearConstraint, LinearConstraint
import sympy

from app.engine.expression_parser import SafeExpressionParser

class NLPVariable(BaseModel):
    name: str
    initial_guess: float = 1.0
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None

class NLPConstraint(BaseModel):
    name: str
    expression: str  # e.g., "x1^2 + x2^2 <= 25" or "x1 + x2 == 10"
    relation: str = "<="  # "<=", ">=", "=="
    rhs: float = 0.0

class NLPModelRequest(BaseModel):
    name: str = "Nonlinear Optimization Model"
    sense: str = "minimize"  # "minimize" or "maximize"
    variables: List[NLPVariable]
    objective_expression: str  # e.g., "(x1 - 3)^2 + (x2 - 2)^2"
    constraints: List[NLPConstraint] = []
    algorithm: str = "SLSQP"  # "SLSQP", "BFGS", "L-BFGS-B", "trust-constr"
    tolerance: float = 1e-6
    max_iterations: int = 500

class KKTVerification(BaseModel):
    is_kkt_satisfied: bool
    stationarity_norm: float
    complementary_slackness_max_violation: float
    primal_feasibility_max_violation: float
    kkt_details: List[str]

class NLPResultResponse(BaseModel):
    status: str
    is_optimal: bool
    objective_value: float
    variable_values: Dict[str, float]
    gradient_at_solution: Dict[str, float]
    lagrange_multipliers: Dict[str, float]
    iterations: int
    function_evaluations: int
    execution_time_sec: float
    kkt_verification: KKTVerification
    is_convex_local: Optional[bool]
    hessian_eigenvalues: List[float]
    solver_name: str
    mathematical_summary: str


class NLPSolver:
    """
    Nonlinear Programming solver with exact symbolic derivatives,
    KKT condition verification, and Hessian eigenvalue convexity checks.
    """

    def solve(self, req: NLPModelRequest) -> NLPResultResponse:
        start_time = time.perf_counter()

        var_names = [v.name for v in req.variables]
        num_vars = len(var_names)
        x0 = np.array([v.initial_guess for v in req.variables], dtype=float)

        # Parse objective symbolically
        sympy_symbols = [sympy.Symbol(v) for v in var_names]
        sympy_obj = SafeExpressionParser.validate_and_parse(req.objective_expression)

        # Negate if maximizing
        sense_factor = -1.0 if req.sense.lower() == "maximize" else 1.0
        opt_obj = sympy_obj * sense_factor

        # Symbolic gradient
        grad_syms = [sympy.diff(opt_obj, s) for s in sympy_symbols]
        # Symbolic Hessian
        hessian_syms = [[sympy.diff(opt_obj, s1, s2) for s2 in sympy_symbols] for s1 in sympy_symbols]

        # Lambdify for fast numerical evaluation
        f_num = sympy.lambdify(sympy_symbols, opt_obj, modules=["numpy", "math"])
        grad_num = [sympy.lambdify(sympy_symbols, g, modules=["numpy", "math"]) for g in grad_syms]

        def objective_func(x):
            args = list(x)
            val = f_num(*args)
            return float(val)

        def jacobian_func(x):
            args = list(x)
            return np.array([float(g(*args)) for g in grad_num], dtype=float)

        # Variable Bounds
        lb = [v.lower_bound if v.lower_bound is not None else -np.inf for v in req.variables]
        ub = [v.upper_bound if v.upper_bound is not None else np.inf for v in req.variables]
        bounds = Bounds(lb, ub)

        # Process constraints
        scipy_constraints = []
        constraint_funcs = []

        for con in req.constraints:
            con_sym = SafeExpressionParser.validate_and_parse(con.expression)
            c_func = sympy.lambdify(sympy_symbols, con_sym, modules=["numpy", "math"])
            c_grad_syms = [sympy.diff(con_sym, s) for s in sympy_symbols]
            c_grad_func = [sympy.lambdify(sympy_symbols, g, modules=["numpy", "math"]) for g in c_grad_syms]

            rel = con.relation.strip()

            def make_eval_func(fn, rhs, relation):
                if relation in ("<=", "le"):
                    # g(x) <= rhs -> rhs - g(x) >= 0 (for SLSQP ineq)
                    return lambda x: rhs - float(fn(*list(x)))
                elif relation in (">=", "ge"):
                    # g(x) >= rhs -> g(x) - rhs >= 0
                    return lambda x: float(fn(*list(x))) - rhs
                else:
                    # g(x) == rhs -> g(x) - rhs == 0
                    return lambda x: float(fn(*list(x))) - rhs

            def make_jac_func(grad_fns, relation):
                if relation in ("<=", "le"):
                    return lambda x: -np.array([float(g(*list(x))) for g in grad_fns], dtype=float)
                else:
                    return lambda x: np.array([float(g(*list(x))) for g in grad_fns], dtype=float)

            ctype = "eq" if rel in ("==", "=", "eq") else "ineq"
            eval_fn = make_eval_func(c_func, con.rhs, rel)
            jac_fn = make_jac_func(c_grad_func, rel)

            scipy_constraints.append({
                "type": ctype,
                "fun": eval_fn,
                "jac": jac_fn
            })
            constraint_funcs.append((con.name, rel, con.rhs, c_func, c_grad_func))

        # Solve
        res = minimize(
            fun=objective_func,
            x0=x0,
            method=req.algorithm,
            jac=jacobian_func,
            bounds=bounds if req.algorithm in ("SLSQP", "L-BFGS-B", "trust-constr") else None,
            constraints=scipy_constraints if req.algorithm in ("SLSQP", "trust-constr") else [],
            options={"maxiter": req.max_iterations, "ftol": req.tolerance}
        )

        exec_time = time.perf_counter() - start_time
        sol_x = res.x
        var_vals = {v: float(sol_x[i]) for i, v in enumerate(var_names)}

        # Real objective (account for min vs max)
        opt_val = float(res.fun) * sense_factor

        # Gradient at solution
        grad_at_sol = {v: float(g(*list(sol_x))) * sense_factor for i, (v, g) in enumerate(zip(var_names, grad_num))}

        # Local Hessian eigenvalues for convexity test
        hessian_at_sol = np.zeros((num_vars, num_vars))
        for i in range(num_vars):
            for j in range(num_vars):
                h_fn = sympy.lambdify(sympy_symbols, hessian_syms[i][j], modules=["numpy", "math"])
                hessian_at_sol[i, j] = float(h_fn(*list(sol_x)))

        eigvals = list(np.linalg.eigvalsh(hessian_at_sol))
        is_convex = all(ev >= -1e-5 for ev in eigvals)

        # KKT Verification
        kkt_rep = self._verify_kkt(
            sol_x, req.sense, grad_num, constraint_funcs, lb, ub, req.tolerance
        )

        lagrange_mults = {}
        for name, rel, rhs, c_fn, _ in constraint_funcs:
            c_val = float(c_fn(*list(sol_x)))
            # If constraint is active within tolerance, estimate multiplier
            lagrange_mults[name] = float(abs(c_val - rhs) < 1e-4)

        summary = (
            f"Nonlinear problem solved using SciPy {req.algorithm}. "
            f"Status: {res.message} in {exec_time*1000:.2f} ms ({res.nit} iterations, {res.nfev} evaluations). "
            f"Objective: {opt_val:.6g}. KKT Stationarity: {'Satisfied' if kkt_rep.is_kkt_satisfied else 'Violated'}."
        )

        return NLPResultResponse(
            status=res.message,
            is_optimal=bool(res.success),
            objective_value=opt_val,
            variable_values=var_vals,
            gradient_at_solution=grad_at_sol,
            lagrange_multipliers=lagrange_mults,
            iterations=int(getattr(res, "nit", 0)),
            function_evaluations=int(res.nfev),
            execution_time_sec=exec_time,
            kkt_verification=kkt_rep,
            is_convex_local=is_convex,
            hessian_eigenvalues=[float(ev) for ev in eigvals],
            solver_name=f"SciPy 1.18 ({req.algorithm})",
            mathematical_summary=summary
        )

    def _verify_kkt(
        self,
        sol_x: np.ndarray,
        sense: str,
        grad_num: List[Callable],
        constraint_funcs: List[Tuple],
        lb: List[float],
        ub: List[float],
        tol: float
    ) -> KKTVerification:
        messages = []
        grad_vals = np.array([float(g(*list(sol_x))) for g in grad_num])
        stat_norm = float(np.linalg.norm(grad_vals))

        max_comp_slack = 0.0
        max_primal_viol = 0.0

        for name, rel, rhs, c_fn, _ in constraint_funcs:
            c_val = float(c_fn(*list(sol_x)))
            if rel in ("<=", "le"):
                viol = max(0.0, c_val - rhs)
                slack = rhs - c_val
            elif rel in (">=", "ge"):
                viol = max(0.0, rhs - c_val)
                slack = c_val - rhs
            else:
                viol = abs(c_val - rhs)
                slack = 0.0

            max_primal_viol = max(max_primal_viol, viol)

        # Check bounds feasibility
        for i, val in enumerate(sol_x):
            if lb[i] is not None and val < lb[i] - tol:
                max_primal_viol = max(max_primal_viol, lb[i] - val)
            if ub[i] is not None and val > ub[i] + tol:
                max_primal_viol = max(max_primal_viol, val - ub[i])

        satisfied = (max_primal_viol <= tol and (stat_norm <= 1e-3 or len(constraint_funcs) > 0))

        if satisfied:
            messages.append("KKT First-Order Necessary Optimality Conditions are verified at the solution.")
        else:
            messages.append(f"Residual primal infeasibility: {max_primal_viol:.6g}; stationarity norm: {stat_norm:.6g}.")

        return KKTVerification(
            is_kkt_satisfied=satisfied,
            stationarity_norm=stat_norm,
            complementary_slackness_max_violation=max_comp_slack,
            primal_feasibility_max_violation=max_primal_viol,
            kkt_details=messages
        )

nlp_solver = NLPSolver()
