# OptiVerse: Universal Operations Research & Mathematical Optimization Platform

OptiVerse is a full-stack, scientific-grade Operations Research (OR) and Mathematical Optimization platform. Designed for engineers, operations researchers, data scientists, and enterprise planners, OptiVerse combines verified exact solvers, interactive graphical modeling, an independent mathematical validation engine, and multi-industry decision workspaces.

---

## 🌟 Key Features

1. **Exact Mathematical Solvers (No Mocked Data)**:
   - **HiGHS (v1.16)**: Native Primal/Dual Simplex, Interior Point Method (IPM), Branch-and-Cut MILP with exact shadow prices, reduced costs, and basis statuses.
   - **SciPy (v1.18)**: Sequential Least Squares Quadratic Programming (SLSQP), BFGS, L-BFGS-B, Hungarian assignment algorithm ($O(n^3)$), and Differential Evolution.
   - **Google OR-Tools (v9.15)**: CP-SAT engine for combinatorial scheduling, Job Shop, Nurse Rostering, and Vehicle Routing (CVRP).
   - **NetworkX (v3.7)**: Shortest Path (Dijkstra, Bellman-Ford, Floyd-Warshall), Minimum Spanning Tree (Kruskal, Prim), Max Flow (Edmonds-Karp), and Min Cost Flow.
   - **Statsmodels (v0.15)**: Time series forecasting (ARIMA, Holt-Winters, Exponential Smoothing) integrated with downstream inventory and production models.
   - **SymPy (v1.14)**: Symbolic differentiation, automatic Jacobian/Hessian generation, and Karush-Kuhn-Tucker (KKT) stationarity verification.

2. **Independent Mathematical Validation Engine (`MathematicalValidator`)**:
   - Every result is independently verified before being returned:
     - Primal feasibility verification: $\|(Ax - b)^+\|_\infty \le 10^{-6}$
     - Variable bound satisfaction: $l_j \le x_j \le u_j$
     - Integrality tolerance checks: $|x_j - \text{round}(x_j)| \le 10^{-5}$
     - Objective recalculation discrepancy checks: $|f(x) - Z^*| \le 10^{-5}$
     - Complementary slackness & duality gap verification for LP/NLP.

3. **Bilingual & Responsive Interface (English & Arabic)**:
   - Dynamic RTL (Right-to-Left) and LTR layout switching.
   - Professional typography with Inter, Cairo (Arabic), and JetBrains Mono for mathematical formulas.
   - Mathematical rendering via KaTeX.

4. **Comprehensive Scientific Benchmark Suite**:
   - 8 canonical published test problems verified with 0-tolerance against published exact solutions (Dantzig Simplex, Pisinger Knapsack, Wood & Wollenberg 3-Gen Economic Dispatch, Hitchcock Transportation, Harris EOQ, Erlang M/M/1 Little's Law, Dijkstra).

5. **Certified Audit Reports**:
   - Single-click export of publication-quality PDF audit reports (ReportLab) and multi-tab Excel workbooks (OpenPyXL) containing solver logs, sensitivity bounds, and validation certificates.

---

## 🏗️ Architecture & Directory Structure

```text
operation_research/
├── backend/
│   ├── app/
│   │   ├── api/                     # 24 REST API routers (/api/v1/...)
│   │   │   ├── routes_lp.py
│   │   │   ├── routes_milp.py
│   │   │   ├── routes_nlp.py
│   │   │   ├── routes_dp.py
│   │   │   ├── routes_network.py
│   │   │   ├── routes_transportation.py
│   │   │   ├── routes_inventory.py
│   │   │   ├── routes_queuing.py
│   │   │   ├── routes_project_mgmt.py
│   │   │   ├── routes_forecasting.py
│   │   │   ├── routes_stochastic.py
│   │   │   ├── routes_metaheuristics.py
│   │   │   ├── routes_energy.py
│   │   │   ├── routes_manufacturing.py
│   │   │   ├── routes_agriculture.py
│   │   │   ├── routes_logistics.py
│   │   │   ├── routes_finance.py
│   │   │   ├── routes_healthcare.py
│   │   │   ├── routes_ai_assistant.py
│   │   │   ├── routes_solvers.py
│   │   │   ├── routes_benchmarks.py
│   │   │   ├── routes_reports.py
│   │   │   ├── routes_model_builder.py
│   │   │   └── routes_projects.py
│   │   ├── core/                    # Config, DB ORM, Validation Engine
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   ├── models_db.py
│   │   │   └── validation.py
│   │   ├── engine/                  # Pure scientific optimization engines
│   │   │   ├── lp_solver.py
│   │   │   ├── milp_solver.py
│   │   │   ├── nlp_solver.py
│   │   │   ├── dp_solver.py
│   │   │   ├── network_solver.py
│   │   │   ├── transport_solver.py
│   │   │   ├── inventory_solver.py
│   │   │   ├── queuing_solver.py
│   │   │   ├── project_mgmt_solver.py
│   │   │   ├── forecasting_solver.py
│   │   │   ├── stochastic_solver.py
│   │   │   ├── metaheuristics_solver.py
│   │   │   ├── energy_solver.py
│   │   │   ├── manufacturing_solver.py
│   │   │   ├── agriculture_solver.py
│   │   │   ├── logistics_solver.py
│   │   │   ├── finance_solver.py
│   │   │   ├── healthcare_solver.py
│   │   │   ├── expression_parser.py
│   │   │   ├── solver_registry.py
│   │   │   └── ai_assistant.py
│   │   ├── reports/                 # PDF and Excel generators
│   │   │   ├── pdf_generator.py
│   │   │   └── excel_generator.py
│   │   ├── tests/                   # Pytest automated test suite
│   │   │   ├── test_benchmarks.py
│   │   │   ├── test_solvers.py
│   │   │   └── test_validation.py
│   │   └── main.py                  # FastAPI application entry point
├── frontend/
│   ├── src/
│   │   ├── components/              # Navbar, Sidebar, Layout
│   │   ├── context/                 # Bilingual LanguageContext (EN/AR, RTL)
│   │   ├── pages/                   # 25 Interactive Module & Industry Workspaces
│   │   ├── services/                # Axios/Fetch API service client
│   │   ├── types/                   # TypeScript interfaces
│   │   ├── utils/                   # KaTeX math view rendering
│   │   ├── App.tsx                  # Main router and view switcher
│   │   └── main.tsx                 # Root React entry
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── docs/                            # Architectural & scientific specifications
├── run_backend.py                   # Backend launcher script
└── pytest.ini                       # Test configuration
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.12+ (tested on Python 3.14)
- Node.js 18+ and npm

### 2. Backend Setup & Startup
Navigate to the root directory and start the FastAPI server:
```bash
python run_backend.py
```
Or directly with uvicorn:
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The interactive API documentation (Swagger/OpenAPI) is available at:
`http://127.0.0.1:8000/docs`

### 3. Running Backend Tests
Execute the full scientific validation and benchmark test suite:
```bash
cd backend
python -m pytest -v
```

### 4. Frontend Setup & Startup
Navigate to the frontend directory and start the Vite development server:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

To build for production:
```bash
cd frontend
npm run build
```

---

## 📊 Modules & Industry Workspaces

| Module / Workspace | Mathematical Formulations & Capabilities | Primary Solver |
| :--- | :--- | :--- |
| **Linear Programming (LP)** | Simplex, Dual Simplex, IPM, Shadow Prices, Reduced Costs, Sensitivity, 2D Geometry | HiGHS 1.16 |
| **Mixed Integer LP (MILP)** | Branch-and-Cut, 0-1 Knapsack, Integrality relaxation, Node cuts | HiGHS / CP-SAT |
| **Nonlinear Programming (NLP)** | SLSQP, BFGS, L-BFGS-B, Lagrangian multipliers, Symbolic KKT check, Hessian | SciPy / SymPy |
| **Dynamic Programming (DP)** | Bellman recursion, Knapsack DP table, Wagner-Whitin dynamic inventory | Custom DP Engine |
| **Network Optimization** | Dijkstra, Bellman-Ford, Floyd-Warshall, Kruskal, Prim, Max-Flow, Min-Cost Flow | NetworkX 3.7 |
| **Transportation & Assignment** | NW Corner, VAM, MODI Stepping Stone, Hungarian Algorithm $O(n^3)$ | SciPy / HiGHS |
| **Inventory Optimization** | EOQ, EPQ, Quantity Discounts, Newsvendor Model, ABC Analysis, Safety Stock | SciPy / Analytical |
| **Queuing Theory** | M/M/1, M/M/c (Erlang-C), M/M/1/K, M/G/1 Pollaczek-Khinchine, Little's Law | Analytical Engine |
| **Project Management** | CPM (Critical Path), PERT (Beta distribution), Total/Free Float, SVG Gantt | Analytical Engine |
| **Forecasting & Time Series** | Moving Average, Holt, Holt-Winters Exponential Smoothing, ARIMA | Statsmodels 0.15 |
| **Stochastic Optimization** | Two-Stage Recourse LP, WS, RP, EEV, EVPI, VSS, Monte Carlo (VaR/CVaR) | HiGHS / NumPy |
| **Metaheuristics** | Genetic Algorithms (GA), Particle Swarm (PSO), Simulated Annealing (SA), Diff. Evolution | SciPy / Custom |
| **Energy & Power Systems** | Economic Dispatch with B-matrix transmission losses, 24h Microgrid Battery Storage | SciPy / HiGHS |
| **Manufacturing & Job Shop** | Multi-period Production Planning (LP), Disjunctive Job Shop Scheduling (CP-SAT) | HiGHS / CP-SAT |
| **Agriculture & Food Blending** | Stigler Diet / Least-cost Feed Blending, Crop Rotation & Water Allocation | HiGHS 1.16 |
| **Logistics & Fleet Routing** | Capacitated Vehicle Routing (CVRP with 2D routing map), Facility Location (MILP) | OR-Tools / HiGHS |
| **Financial Portfolio** | Markowitz Mean-Variance, Global Min Variance, Max Sharpe, Efficient Frontier | SciPy SLSQP |
| **Healthcare Rostering** | Multi-shift Nurse Rostering with fairness & coverage constraints, Resource Scheduling | CP-SAT / Greedy |
| **AI Problem Assistant** | NLP extraction of decision variables, objective sense, and constraint bounds | Heuristic / AI |
| **Universal Model Builder** | Custom variable, objective, and constraint builder with LP/MPS format export | HiGHS / SymPy |
| **Benchmark Suite** | Live execution and error auditing against published literature benchmarks | All Engines |
| **Educational Center** | Step-by-step algorithmic visualizer for Simplex, Branch-and-Bound, KKT, and Dispatch | Pedagogical Engine |
