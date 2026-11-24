# Operations Research & Mathematical Optimization Platform
## Technical Research, Library Discovery & Architecture Specification

### 1. Executive Summary & Optimization Taxonomy
This platform delivers a scientifically verified mathematical optimization engine integrating state-of-the-art computational algorithms across linear, integer, nonlinear, dynamic, stochastic, heuristic, and network optimization paradigms. Every result is computed using exact mathematical solvers with independent post-solution validation.

---

### 2. Evaluated Optimization Libraries & Solvers

| Library / Engine | Version | Algorithms & Paradigms | Role in Platform | Official Documentation Reference |
| :--- | :--- | :--- | :--- | :--- |
| **HiGHS (`highspy`)** | 1.16.0 | Primal Simplex, Dual Simplex, Interior Point Method (IPM), Branch-and-Cut MILP, QP | Core LP/MILP engine; provides exact shadow prices, reduced costs, simplex tableau status, basis status | [HiGHS Documentation](https://highs.dev/) |
| **SciPy (`scipy.optimize`)** | 1.18.1 | `linprog` (HiGHS dual simplex & IPM), `milp`, `minimize` (SLSQP, BFGS, L-BFGS-B, Trust-Region Constr, Newton-CG), `linear_sum_assignment` (Hungarian O(N^3)), `differential_evolution` | Core NLP, Assignment, Bound-constrained QP, and continuous global search | [SciPy Optimize Ref](https://docs.scipy.org/doc/scipy/reference/optimize.html) |
| **Google OR-Tools** | 9.15.6755 | CP-SAT (SAT-based Constraint Programming & lazy clause generation), PyWrapCP Routing (TSP, Capacitated VRP, VRPTW), Flow solvers | Job-Shop / Flow-Shop Scheduling, Vehicle Routing, Assembly line balancing | [Google OR-Tools Dev Guide](https://developers.google.com/optimization) |
| **NetworkX** | 3.7 | Dijkstra, Bellman-Ford, Floyd-Warshall, Kruskal, Prim, Ford-Fulkerson, Edmonds-Karp, Capacity Scaling Min-Cost Flow | Network optimization, minimum spanning tree, maximum flow, transshipment | [NetworkX Docs](https://networkx.org/documentation/stable/) |
| **Statsmodels** | 0.15.0 | ARIMA, SARIMAX, Holt-Winters Exponential Smoothing, Ordinary Least Squares | Time-series forecasting feeding inventory, supply chain, and demand scheduling | [Statsmodels Docs](https://www.statsmodels.org/stable/) |
| **DEAP** | 1.4.4 | Genetic Algorithms, Evolution Strategies, Particle Swarm Optimization | Complex non-convex metaheuristics, combinatorial multi-objective search | [DEAP Docs](https://deap.readthedocs.io/) |
| **SymPy** | 1.14.0 | Symbolic differentiation, symbolic Jacobian/Hessian computation, KKT system extraction, safe formula parsing | KKT condition validation, mathematical expression AST parsing | [SymPy Docs](https://docs.sympy.org/) |
| **ReportLab & OpenPyXL** | 5.1 / 3.1 | PDF rendering with tabular summaries and charts, Excel export with formatted formulas | Comprehensive audit and executive reports | [ReportLab Docs](https://docs.reportlab.com/) |

---

### 3. Solver Registry Architecture & Dispatch Strategy

The **Solver Registry** implements an adapter pattern:
- **Linear Programming (Continuous)**:
  - Default: `HiGHS` (Primal/Dual Simplex or IPM) via direct C++ bindings (`highspy`) or SciPy HiGHS wrapper.
  - Generates Primal Solution $x^*$, Dual Multipliers $\pi^*$, Reduced Costs $c^*_j$, Slacks $s^*_i$, and basis status (`BASIC`, `NONBASIC_AT_LOWER`, `NONBASIC_AT_UPPER`).
- **Mixed Integer Linear Programming (MILP)**:
  - Default: `HiGHS` Branch-and-Cut (with presolve, cutting planes: Gomory, MIR, Clique, flow cover).
  - Alternative: OR-Tools `CP-SAT` for combinatorial problems with complex logical implication or disjunctive constraints.
- **Nonlinear Programming (NLP)**:
  - Unconstrained / Smooth: `BFGS`, `L-BFGS-B`, `Newton-CG`.
  - Constrained: `SLSQP` (Sequential Least Squares Quadratic Programming) and `trust-constr` (Interior Point / Sequential Quadratic).
  - Analytical/symbolic gradient and Jacobian generated via `SymPy` or verified finite-difference.
- **Network Optimization**:
  - Shortest Path: Dijkstra (non-negative weights $O((V+E)\log V)$), Bellman-Ford (detects negative cycles), Floyd-Warshall ($O(V^3)$ all-pairs).
  - Min Spanning Tree: Kruskal ($O(E\log E)$) and Prim ($O(V^2)$).
  - Max Flow: Edmonds-Karp / Boykov-Kolmogorov.
  - Min Cost Flow: Successive Shortest Path / Network Simplex.
- **Routing & Scheduling**:
  - TSP and CVRP: Google OR-Tools Routing model with Guided Local Search metaheuristic.
  - Job Shop / Flow Shop: Google OR-Tools CP-SAT with Interval Variables and `AddNoOverlap` cumulative constraints.
- **Energy Systems & Power Optimization**:
  - Economic Dispatch: Quadratic cost function minimization $\sum (a_i P_i^2 + b_i P_i + c_i)$ with transmission loss penalty factors ($B$-matrix loss formula: $P_L = \sum_i \sum_j P_i B_{ij} P_j + \sum_i B_{0i} P_i + B_{00}$) and active power balance constraint $\sum P_i = P_D + P_L$.
  - Unit Commitment: Mixed-Integer Programming with generator min up/down time, start-up/shut-down costs, spinning reserve requirements, and ramp rate limits ($P_i(t) - P_i(t-1) \le R_{up, i}$).
  - Microgrid & Battery Energy Storage: Multi-period MILP with State-of-Charge (SoC) dynamics:
    $$SoC(t) = SoC(t-1) + \eta_{ch} P_{ch}(t) \Delta t - \frac{1}{\eta_{dis}} P_{dis}(t) \Delta t$$
    with degradation cost, time-of-use (ToU) arbitrage, peak shaving, and solar PV/wind curtailment limits.

---

### 4. Independent Mathematical Validation Engine

To enforce the non-negotiable requirement that **no result is returned without validation**, every solver adapter routes its raw solution through the `MathematicalValidator`:
1. **Feasibility Check**:
   - Computes residual vector $r = A x - b$ for equality and inequality constraints.
   - Verifies $\|r^+\|_\infty \le \epsilon_{feas}$ (default $\epsilon = 10^{-6}$).
2. **Variable Bounds Check**:
   - Verifies $l_j - \epsilon \le x_j \le u_j + \epsilon$ for all $j \in \{1,\dots,n\}$.
3. **Integrality Verification**:
   - For all integer/binary variables $j \in \mathcal{I}$, verifies $|x_j - \text{round}(x_j)| \le \epsilon_{int}$ (default $10^{-5}$).
4. **Independent Objective Recalculation**:
   - Evaluates $f(x)$ independently and compares with solver's reported objective $Z$:
     $$|f(x) - Z| \le \epsilon_{obj}$$
5. **Duality & Complementary Slackness (for LP)**:
   - Verifies duality gap $|c^T x - b^T y| \le \epsilon_{dual}$ where dual vector $y$ is available.
   - Verifies complementary slackness: $y_i \cdot (b_i - (Ax)_i) \approx 0$ and $x_j \cdot (c_j - (A^T y)_j) \approx 0$.
6. **Infeasibility Diagnostics (Conflict Refinement & IIS)**:
   - When a problem is infeasible, systematically detects conflicting constraint pairs through bound-relaxation and slack penalty analysis.

---

### 5. Benchmark Problems & Reference Solutions

The platform test suite implements canonical published benchmark problems:
- **Dantzig Simplex Benchmark**: Standard 2-variable and 3-variable manufacturing allocation with known exact vertices.
- **Klee-Minty Cube**: Simplex worst-case benchmark testing exponential vertex visitation vs interior point polynomial performance.
- **Knapsack Benchmark (Pisinger)**: 0-1 knapsack with exact dynamic programming and branch-and-bound verification.
- **Transportation Hitchcock Problem**: 3 sources $\times$ 4 destinations with known optimal cost of $Z^* = 285$.
- **Economic Dispatch 3-Generator Benchmark (Wood & Wollenberg)**: Known analytical lambda-iteration solution verifying economic dispatch generator setpoints to 4 decimal places.
- **Job Shop 3x3 Fisher-Thompson / Muth-Thompson Benchmark**: Exact makespan validation using OR-Tools CP-SAT.
- **Traveling Salesman (Oliver 30 & eil51)**: Optimal Hamiltonian tour verification.
