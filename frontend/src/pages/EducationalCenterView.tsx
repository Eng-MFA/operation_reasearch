import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { MathView } from '../utils/katex';
import { BookOpen, Search, ArrowRight, Lightbulb, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

interface Topic {
  id: string;
  title: string;
  category: string;
  complexity: string;
  definition: string;
  mathematicalFormulation: string;
  howItWorks: string[];
  example: string;
  advantages: string[];
  limitations: string[];
  applications: string[];
}

export const EducationalCenterView: React.FC = () => {
  const { t } = useLanguage();
  const [selectedTopicId, setSelectedTopicId] = useState<string>('simplex');
  const [searchQuery, setSearchQuery] = useState('');

  const topics: Topic[] = [
    {
      id: 'simplex',
      title: 'Simplex & Dual Simplex Methods',
      category: 'Linear Programming',
      complexity: 'Worst-case exponential O(2^n), Average polynomial O(n)',
      definition: 'The Simplex algorithm, introduced by George Dantzig in 1947, traverses the adjacent extreme points (vertices) of a convex polyhedral feasible region along edges that strictly improve the objective function value until reaching the optimal vertex.',
      mathematicalFormulation: '\\max \\; c^T x \\quad \\text{subject to} \\quad A x + s = b, \\quad x \\ge 0, \\; s \\ge 0',
      howItWorks: [
        'Transform constraints into standard equality form by adding slack/surplus variables.',
        'Establish an initial basic feasible solution (IBFS) where slack variables form the identity basis B.',
        'Compute reduced costs c_j - c_B^T B^{-1} A_j for all non-basic variables.',
        'Select the entering variable with the most positive (for max) reduced cost (Dantzig rule).',
        'Perform the minimum ratio test theta = min(x_Bi / y_ik for y_ik > 0) to determine the leaving basic variable.',
        'Pivot the tableau using elementary row operations and repeat until all reduced costs are non-positive.'
      ],
      example: 'Max Z = 40x1 + 30x2 s.t. 2x1 + x2 <= 100, x1 + 3x2 <= 90. Optimal at vertex (42, 16) with Z = 2160.',
      advantages: [
        'Extremely fast in practice for sparse industrial models.',
        'Naturally generates shadow prices and basis status for sensitivity analysis.',
        'Dual Simplex permits hot-starting after adding new constraints without re-solving from scratch.'
      ],
      limitations: [
        'Worst-case exponential time on pathological geometries like Klee-Minty cubes.',
        'Can stall in degenerate pivots if cycling is not prevented (Bland rule).'
      ],
      applications: [
        'Oil refinery blending and production scheduling',
        'Agricultural diet formulation',
        'Airline crew pairing and fleet assignment'
      ]
    },
    {
      id: 'branch_and_bound',
      title: 'Branch-and-Bound / Branch-and-Cut',
      category: 'Integer Programming',
      complexity: 'NP-Hard (O(2^n) search tree in worst case)',
      definition: 'Branch-and-Bound systematically searches the discrete solution space by solving continuous LP relaxations, partitioning fractional variables into subproblems (branching), and pruning subtrees whose continuous bounds cannot beat the best known integer solution (bounding).',
      mathematicalFormulation: '\\min \\; c^T x \\quad \\text{s.t.} \\quad A x \\le b, \\quad x_j \\in \\mathbb{Z} \\; \\forall j \\in \\mathcal{I}',
      howItWorks: [
        'Solve the continuous LP relaxation where integer restrictions are relaxed.',
        'If the solution is fully integer, it is optimal; terminate.',
        'Pick a variable x_k with fractional value f_k. Branch into two child nodes: x_k <= floor(f_k) and x_k >= ceil(f_k).',
        'Add valid cutting planes (Gomory cuts, MIR cuts) at the root and child nodes (Branch-and-Cut).',
        'Prune any node whose LP relaxation is infeasible or whose lower bound exceeds the current best incumbent.'
      ],
      example: '0-1 Knapsack capacity 50 kg with items (10kg, $60), (20kg, $100), (30kg, $120). Continuous relaxation picks fractional item 3; branch-and-cut proves items 2 and 3 yield optimal $220.',
      advantages: [
        'Guaranteed to find global mathematical optimum if allowed to terminate.',
        'Provides a provable optimality gap (MIP Gap) at any time during execution.'
      ],
      limitations: [
        'Memory consumption can grow rapidly if the branch-and-bound queue expands exponentially.'
      ],
      applications: [
        'Capacitated facility location and supply chain network design',
        'Hospital nurse rostering and shift scheduling',
        'Telecommunication wavelength allocation'
      ]
    },
    {
      id: 'kkt',
      title: 'Karush-Kuhn-Tucker (KKT) Optimality Conditions',
      category: 'Nonlinear Programming',
      complexity: 'First-order necessary conditions for local optimality',
      definition: 'The KKT conditions generalize Lagrange multipliers to inequality-constrained optimization. For a local optimum of a continuously differentiable nonlinear program satisfying constraint qualification, there exist multiplier vectors lambda and mu satisfying stationarity, primal feasibility, dual feasibility, and complementary slackness.',
      mathematicalFormulation: '\\nabla f(x^*) + \\sum_{i=1}^m \\mu_i^* \\nabla g_i(x^*) + \\sum_{j=1}^p \\lambda_j^* \\nabla h_j(x^*) = 0',
      howItWorks: [
        'Stationarity: The gradient of the Lagrangian with respect to x equals zero at the solution.',
        'Primal Feasibility: All equality h_j(x) = 0 and inequality g_i(x) <= 0 constraints are satisfied.',
        'Dual Feasibility: Multipliers for inequality constraints must be non-negative (mu_i >= 0).',
        'Complementary Slackness: For each inequality constraint, either the multiplier is zero or the constraint is active (mu_i * g_i(x) = 0).'
      ],
      example: 'Min (x1-1)^2 + (x2-2.5)^2 s.t. x1 - 2x2 + 2 >= 0. Optimal solution x* = (1.4, 1.7) lies on the boundary with active multiplier mu = 0.4.',
      advantages: [
        'Provides an exact mathematical certificate of local optimality.',
        'Sufficient for global optimality when the objective and constraint functions are convex.'
      ],
      limitations: [
        'Requires constraint qualifications (e.g., LICQ, Slater condition) to hold.',
        'Only guarantees local optimality for non-convex functions.'
      ],
      applications: [
        'Optimal Power Flow (OPF) in electrical transmission networks',
        'Markowitz mean-variance portfolio allocation',
        'Aerospace trajectory and structural optimization'
      ]
    },
    {
      id: 'economic_dispatch',
      title: 'Economic Dispatch & Transmission Losses',
      category: 'Energy Systems',
      complexity: 'Quadratic Program with Lagrange lambda iteration O(N log N)',
      definition: 'Economic Dispatch allocates active power generation across available generating units to meet system load at minimum fuel cost while respecting generator operating limits and transmission line loss penalties.',
      mathematicalFormulation: '\\min \\sum_{i=1}^N (a_i P_i^2 + b_i P_i + c_i) \\quad \\text{s.t.} \\quad \\sum_{i=1}^N P_i = P_D + P_L, \\quad P_i^{\\min} \\le P_i \\le P_i^{\\max}',
      howItWorks: [
        'Compute incremental fuel costs dC_i/dP_i = 2 a_i P_i + b_i.',
        'In an unconstrained network without losses, the equal incremental cost principle requires lambda_1 = lambda_2 = ... = lambda_N.',
        'With transmission losses P_L calculated via Kron B-matrix, apply penalty factors L_i = 1 / (1 - dP_L/dP_i).',
        'Adjust setpoints iteratively until active generation strictly equals total demand plus losses.'
      ],
      example: '3-generator system meeting 850 MW demand: Steam 1 produces 393.17 MW, Steam 2 produces 334.60 MW, Gas Peaker produces 122.23 MW with system lambda = $9.148/MWh.',
      advantages: [
        'Guarantees minimum fuel consumption and lowest emissions for power utilities.',
        'Extensible to wind, solar, and battery storage units.'
      ],
      limitations: [
        'Requires accurate quadratic heat rate curves and B-matrix network impedance data.'
      ],
      applications: [
        'National grid dispatch centers (ISO / RTO)',
        'Islanded and grid-connected microgrid energy management',
        'Industrial co-generation plants'
      ]
    }
  ];

  const selectedTopic = topics.find((t) => t.id === selectedTopicId) || topics[0];

  const filteredTopics = topics.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <BookOpen className="w-6 h-6 text-cyan-400" />
          <h1 className="text-2xl font-extrabold text-white">Operations Research Educational Center</h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Interactive textbook and algorithmic reference explaining definitions, mathematical formulations, step-by-step mechanics, and complexity theory.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Navigation Topics */}
        <div className="lg:col-span-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 rtl:right-3 rtl:left-auto text-slate-500" />
            <input
              type="text"
              placeholder="Search algorithm or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 rtl:pr-9 rtl:pl-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="space-y-1.5">
            {filteredTopics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => setSelectedTopicId(topic.id)}
                className={`w-full text-left rtl:text-right p-3 rounded-xl border transition-all ${
                  selectedTopicId === topic.id
                    ? 'bg-blue-600/15 border-blue-500/40 text-white shadow-sm'
                    : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <div className="text-xs font-bold">{topic.title}</div>
                <div className="text-[10px] text-cyan-400 font-mono mt-0.5">{topic.category}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Topic Details */}
        <div className="lg:col-span-8 space-y-5">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {selectedTopic.category}
              </span>
              <h2 className="text-xl font-extrabold text-white mt-2">{selectedTopic.title}</h2>
              <div className="text-xs font-mono text-slate-400 mt-1">
                Computational Complexity: <span className="text-amber-400">{selectedTopic.complexity}</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              {selectedTopic.definition}
            </p>

            {/* Mathematical Formulation */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Mathematical Formulation</h3>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                <MathView math={selectedTopic.mathematicalFormulation} block />
              </div>
            </div>

            {/* How it works */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">How the Algorithm Works (Step-by-Step)</h3>
              <div className="space-y-2">
                {selectedTopic.howItWorks.map((step, idx) => (
                  <div key={idx} className="flex items-start space-x-2 rtl:space-x-reverse text-xs text-slate-300">
                    <span className="w-5 h-5 rounded-full bg-blue-600/20 text-cyan-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Benchmark Example */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-xs font-bold text-white flex items-center space-x-1.5 rtl:space-x-reverse">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <span>Standard Numerical Example</span>
              </div>
              <p className="text-xs text-slate-300 font-mono">{selectedTopic.example}</p>
            </div>

            {/* Advantages & Limitations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                <div className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5 rtl:space-x-reverse">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Key Advantages</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-1">
                  {selectedTopic.advantages.map((adv, i) => (
                    <li key={i}>&bull; {adv}</li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
                <div className="text-xs font-bold text-rose-400 flex items-center space-x-1.5 rtl:space-x-reverse">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Limitations & Bottlenecks</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-1">
                  {selectedTopic.limitations.map((lim, i) => (
                    <li key={i}>&bull; {lim}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
