import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { MathView } from '../utils/katex';
import { 
  Play, 
  Layers, 
  Plus, 
  Trash2, 
  Download, 
  Code, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';

export const ModelBuilderView: React.FC = () => {
  const { t } = useLanguage();

  const [name, setName] = useState("Universal Custom Model");
  const [problemType, setProblemType] = useState("linear_programming");
  const [sense, setSense] = useState<"maximize" | "minimize">("maximize");
  const [objExpr, setObjExpr] = useState("40*x1 + 30*x2");
  
  const [variables, setVariables] = useState([
    { name: "x1", variable_type: "continuous", lower_bound: 0, upper_bound: null as number | null },
    { name: "x2", variable_type: "continuous", lower_bound: 0, upper_bound: null as number | null }
  ]);

  const [constraints, setConstraints] = useState([
    { name: "Constraint_1", expression: "2*x1 + x2 <= 100" },
    { name: "Constraint_2", expression: "x1 + 3*x2 <= 90" }
  ]);

  const [exportedLP, setExportedLP] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addVariable = () => {
    const nextIdx = variables.length + 1;
    setVariables([...variables, {
      name: `x${nextIdx}`,
      variable_type: "continuous",
      lower_bound: 0,
      upper_bound: null
    }]);
  };

  const removeVariable = (idx: number) => {
    setVariables(variables.filter((_, i) => i !== idx));
  };

  const addConstraint = () => {
    const nextIdx = constraints.length + 1;
    setConstraints([...constraints, {
      name: `Constraint_${nextIdx}`,
      expression: `x1 + x2 <= 100`
    }]);
  };

  const removeConstraint = (idx: number) => {
    setConstraints(constraints.filter((_, i) => i !== idx));
  };

  const handleExportLP = async () => {
    try {
      const res = await api.exportModelFormat({
        name,
        problem_type: problemType,
        sense,
        variables,
        objective_expression: objExpr,
        constraints
      });
      setExportedLP(res.lp_format);
    } catch (err: any) {
      setError(err.message || "Failed to generate LP format");
    }
  };

  const handleSolve = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.solveModelBuilder({
        name,
        problem_type: problemType,
        sense,
        variables,
        objective_expression: objExpr,
        constraints
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Model Builder solve failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Universal Mathematical Model Builder</h1>
          <p className="text-xs text-slate-400 mt-1">
            Construct linear and mixed-integer models visually, parse equations with safe AST grammar, and export to LP/MPS format.
          </p>
        </div>
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <button
            onClick={handleExportLP}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 rtl:space-x-reverse"
          >
            <Code className="w-3.5 h-3.5 text-cyan-400" />
            <span>Generate LP Format</span>
          </button>
          <button
            onClick={handleSolve}
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 flex items-center space-x-2 rtl:space-x-reverse"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{loading ? t('solving') : 'Solve Model'}</span>
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
        {/* Left Builder Column */}
        <div className="lg:col-span-6 space-y-5">
          {/* Objective & Meta */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Model Definition</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400">Problem Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Optimization Goal</label>
                <select
                  value={sense}
                  onChange={(e) => setSense(e.target.value as any)}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-semibold"
                >
                  <option value="maximize">Maximize (Z)</option>
                  <option value="minimize">Minimize (Z)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400">Objective Algebraic Expression</label>
              <input
                type="text"
                value={objExpr}
                onChange={(e) => setObjExpr(e.target.value)}
                placeholder="e.g., 40*x1 + 30*x2 - 15"
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-cyan-300 font-mono text-xs"
              />
            </div>
          </div>

          {/* Decision Variables List */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Decision Variables ({variables.length})</h3>
              <button
                onClick={addVariable}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold flex items-center space-x-1 rtl:space-x-reverse"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Variable</span>
              </button>
            </div>

            <div className="space-y-2">
              {variables.map((v, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3">
                    <input
                      type="text"
                      value={v.name}
                      onChange={(e) => {
                        const newV = [...variables];
                        newV[idx].name = e.target.value;
                        setVariables(newV);
                      }}
                      className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white text-xs font-mono font-bold"
                    />
                  </div>
                  <div className="col-span-4">
                    <select
                      value={v.variable_type}
                      onChange={(e) => {
                        const newV = [...variables];
                        newV[idx].variable_type = e.target.value;
                        setVariables(newV);
                      }}
                      className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 text-xs"
                    >
                      <option value="continuous">Continuous</option>
                      <option value="integer">Integer</option>
                      <option value="binary">Binary</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      placeholder="LB"
                      value={v.lower_bound ?? 0}
                      onChange={(e) => {
                        const newV = [...variables];
                        newV[idx].lower_bound = parseFloat(e.target.value);
                        setVariables(newV);
                      }}
                      className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 text-xs font-mono text-center"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      placeholder="UB"
                      value={v.upper_bound ?? ''}
                      onChange={(e) => {
                        const newV = [...variables];
                        newV[idx].upper_bound = e.target.value ? parseFloat(e.target.value) : null;
                        setVariables(newV);
                      }}
                      className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 text-xs font-mono text-center"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button
                      onClick={() => removeVariable(idx)}
                      disabled={variables.length <= 1}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Constraints List */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Constraints ({constraints.length})</h3>
              <button
                onClick={addConstraint}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold flex items-center space-x-1 rtl:space-x-reverse"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Constraint</span>
              </button>
            </div>

            <div className="space-y-2">
              {constraints.map((c, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center space-x-2 rtl:space-x-reverse">
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) => {
                      const newC = [...constraints];
                      newC[idx].name = e.target.value;
                      setConstraints(newC);
                    }}
                    className="w-1/3 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 text-xs"
                  />
                  <input
                    type="text"
                    value={c.expression}
                    onChange={(e) => {
                      const newC = [...constraints];
                      newC[idx].expression = e.target.value;
                      setConstraints(newC);
                    }}
                    placeholder="e.g. 2*x1 + x2 <= 100"
                    className="w-2/3 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-xs"
                  />
                  <button
                    onClick={() => removeConstraint(idx)}
                    disabled={constraints.length <= 1}
                    className="text-slate-500 hover:text-rose-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Output Column: LP Format & Real Results */}
        <div className="lg:col-span-6 space-y-5">
          {result && (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{result.status}</span>
                </div>
                <span className="text-xs font-mono text-slate-400">{result.solver_name}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Optimal Objective</div>
                  <div className="text-2xl font-bold text-white mt-0.5">{result.objective_value?.toFixed(4)}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Solve Time</div>
                  <div className="text-2xl font-bold text-cyan-400 mt-0.5">{(result.execution_time_sec * 1000).toFixed(2)} ms</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold uppercase text-slate-400">Solution Vector</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(result.variable_values || {}).map(([v, val]: any) => (
                    <div key={v} className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between font-mono text-xs">
                      <span className="text-slate-400">{v}:</span>
                      <span className="text-white font-bold">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                {result.mathematical_summary}
              </p>
            </div>
          )}

          {exportedLP && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5 rtl:space-x-reverse">
                  <Code className="w-4 h-4 text-cyan-400" />
                  <span>Standard Mathematical Modeling LP Format</span>
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">CPLEX/HiGHS Compatible</span>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-xs overflow-x-auto max-h-72 leading-relaxed">
                {exportedLP}
              </pre>
            </div>
          )}

          {!result && !exportedLP && (
            <div className="p-12 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
              <Layers className="w-10 h-10 text-slate-600" />
              <div className="text-sm font-semibold text-slate-300">Formulation Canvas</div>
              <p className="text-xs text-slate-500 max-w-sm">
                Add decision variables and constraints on the left. Click "Solve Model" or "Generate LP Format" to inspect the exact mathematical program.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
