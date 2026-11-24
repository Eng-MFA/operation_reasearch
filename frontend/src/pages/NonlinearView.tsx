import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { MathView } from '../utils/katex';
import { Play, TrendingUp, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

export const NonlinearView: React.FC = () => {
  const { t } = useLanguage();
  const [algorithm, setAlgorithm] = useState<string>('SLSQP');
  const [objectiveExpr, setObjectiveExpr] = useState('(x1 - 1)**2 + (x2 - 2.5)**2');
  const [constraintExpr, setConstraintExpr] = useState('x1 - 2*x2 + 2');
  const [conRelation, setConRelation] = useState('>=');
  const [conRhs, setConRhs] = useState(0.0);
  
  const [guessX1, setGuessX1] = useState(2.0);
  const [guessX2, setGuessX2] = useState(0.0);

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSolve = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.solveNLP({
        name: 'Constrained Nonlinear Optimization',
        sense: 'minimize',
        algorithm,
        variables: [
          { name: 'x1', initial_guess: guessX1 },
          { name: 'x2', initial_guess: guessX2 }
        ],
        objective_expression: objectiveExpr,
        constraints: [
          { name: 'C1', expression: constraintExpr, relation: conRelation, rhs: conRhs }
        ]
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'NLP Solver Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Module C: Nonlinear Programming (NLP)</h1>
          <p className="text-xs text-slate-400 mt-1">
            Sequential Quadratic Programming (SLSQP), Quasi-Newton (BFGS), Symbolic KKT Verification, and Local Convexity Analysis.
          </p>
        </div>
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <select
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
          >
            <option value="SLSQP">SLSQP (Constrained Sequential QP)</option>
            <option value="trust-constr">Trust-Region Interior Point</option>
            <option value="BFGS">BFGS (Quasi-Newton)</option>
            <option value="L-BFGS-B">L-BFGS-B (Bounded)</option>
          </select>
          <button
            onClick={handleSolve}
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 flex items-center space-x-2 rtl:space-x-reverse"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{loading ? t('solving') : t('solve')}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2 rtl:space-x-reverse">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Parameters */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Nonlinear Objective Expression</h3>
            <input
              type="text"
              value={objectiveExpr}
              onChange={(e) => setObjectiveExpr(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs"
            />
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
              <MathView math={`\\min f(x_1, x_2) = (x_1 - 1)^2 + (x_2 - 2.5)^2`} block />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400">Initial Guess x1</label>
                <input
                  type="number"
                  value={guessX1}
                  onChange={(e) => setGuessX1(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Initial Guess x2</label>
                <input
                  type="number"
                  value={guessX2}
                  onChange={(e) => setGuessX2(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Nonlinear Constraint</h3>
            <div className="grid grid-cols-6 gap-2">
              <input
                type="text"
                value={constraintExpr}
                onChange={(e) => setConstraintExpr(e.target.value)}
                className="col-span-3 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
              />
              <select
                value={conRelation}
                onChange={(e) => setConRelation(e.target.value)}
                className="col-span-1 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs text-center font-bold"
              >
                <option value=">=">&ge;</option>
                <option value="<=">&le;</option>
                <option value="==">==</option>
              </select>
              <input
                type="number"
                value={conRhs}
                onChange={(e) => setConRhs(parseFloat(e.target.value) || 0)}
                className="col-span-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono text-center"
              />
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-7 space-y-4">
          {result ? (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{result.status}</span>
                </div>
                <span className="text-xs font-mono text-slate-400">{result.solver_name}</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Min Objective f(x*)</div>
                  <div className="text-xl font-bold text-white mt-0.5">{result.objective_value.toFixed(4)}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Optimal Coordinates</div>
                  <div className="text-lg font-bold text-cyan-400 mt-0.5">
                    ({result.variable_values['x1']?.toFixed(4)}, {result.variable_values['x2']?.toFixed(4)})
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Local Convexity</div>
                  <div className={`text-sm font-bold mt-1 ${result.is_convex_local ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {result.is_convex_local ? 'Strictly Convex (Positive Semi-Definite)' : 'Non-Convex / Indefinite'}
                  </div>
                </div>
              </div>

              {/* KKT Verification Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase text-slate-300">KKT Necessary Optimality Audit</h4>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${result.kkt_verification.is_kkt_satisfied ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                    {result.kkt_verification.is_kkt_satisfied ? 'KKT CONDITIONS SATISFIED' : 'KKT VIOLATED'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">Stationarity Norm ||&nabla;L||: </span>
                    <span className="text-slate-200">{result.kkt_verification.stationarity_norm.toExponential(3)}</span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">Primal Infeasibility: </span>
                    <span className="text-slate-200">{result.kkt_verification.primal_feasibility_max_violation.toExponential(3)}</span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400">
                  Hessian Eigenvalues at x*: [{result.hessian_eigenvalues.map((ev: number) => ev.toFixed(2)).join(', ')}]
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                {result.mathematical_summary}
              </p>
            </div>
          ) : (
            <div className="p-12 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
              <TrendingUp className="w-10 h-10 text-slate-600" />
              <div className="text-sm font-semibold text-slate-300">Run Nonlinear Solver</div>
              <p className="text-xs text-slate-500 max-w-sm">
                Compute the local minimum using Sequential Quadratic Programming and verify KKT optimality.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
