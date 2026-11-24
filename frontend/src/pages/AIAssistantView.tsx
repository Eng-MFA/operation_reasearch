import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { MathView } from '../utils/katex';
import { 
  Sparkles, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle, 
  ArrowRight,
  ShieldAlert,
  Cpu
} from 'lucide-react';

interface AIAssistantProps {
  onNavigate: (section: string) => void;
}

export const AIAssistantView: React.FC<AIAssistantProps> = ({ onNavigate }) => {
  const { t } = useLanguage();

  const [inputPrompt, setInputPrompt] = useState(
    "I own a manufacturing plant that produces two items: Product A and Product B. " +
    "Product A requires 2 hours on Machine 1 and yields $40 profit. " +
    "Product B requires 1 hour on Machine 1 and yields $30 profit. " +
    "Machine 1 has 100 available hours. Also, we have a raw material constraint of 90 kg where " +
    "Product A uses 1 kg and Product B uses 3 kg. How many units should we make to maximize profit?"
  );

  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!inputPrompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.analyzeProblemAI({ problem_description: inputPrompt });
      setAnalysis(res);
    } catch (err: any) {
      setError(err.message || "Failed to analyze problem");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <Sparkles className="w-6 h-6 text-amber-400" />
          <h1 className="text-2xl font-extrabold text-white">Intelligent Optimization Problem Assistant</h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Describe your real-world industrial or operational challenge in natural language. The AI assistant extracts variables, identifies parameters, rigorously flags missing data without fabrication, and constructs the mathematical program.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2 rtl:space-x-reverse">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Input Text Box */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2 rtl:space-x-reverse">
            <span>Natural Language Problem Description</span>
          </label>
          <span className="text-[11px] text-slate-400">English & Arabic supported</span>
        </div>

        <textarea
          rows={4}
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="Describe your optimization goal, resources, machines, supply, costs, or restrictions..."
          className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs leading-relaxed focus:outline-none focus:border-blue-500"
        />

        <div className="flex justify-end">
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-90 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 flex items-center space-x-2 rtl:space-x-reverse transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{loading ? "Analyzing Mathematical Structure..." : "Analyze & Formulate Model"}</span>
          </button>
        </div>
      </div>

      {/* Analysis & Model Formulation Output */}
      {analysis && (
        <div className="space-y-6">
          {/* Classification & Summary */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-3 rtl:space-x-reverse">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white capitalize">
                    {analysis.identified_category.replace(/_/g, ' ')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Confidence: {(analysis.confidence_score * 100).toFixed(0)}% • Recommended Solver: <span className="text-cyan-400 font-mono font-semibold">{analysis.recommended_solver}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => onNavigate('lp')}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md flex items-center space-x-1.5 rtl:space-x-reverse"
              >
                <span>Launch in Interactive LP Solver</span>
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </button>
            </div>

            <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800 leading-relaxed">
              {analysis.problem_summary}
            </p>
          </div>

          {/* Variables and Draft Objective */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Identified Decision Variables ({analysis.decision_variables.length})
              </h4>
              <div className="space-y-2">
                {analysis.decision_variables.map((v: any, i: number) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono font-bold text-cyan-400">{v.name}</span>
                      <p className="text-[11px] text-slate-400">{v.description}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      {v.variable_type} &ge; 0
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Objective Formulation Draft
              </h4>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-200">{analysis.objective_description}</div>
                <div className="text-xs font-mono text-cyan-300">
                  {analysis.objective_expression_draft}
                </div>
              </div>
            </div>
          </div>

          {/* Missing Parameters & Explicit Assumptions Check */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5 rtl:space-x-reverse">
                <AlertCircle className="w-4 h-4" />
                <span>Missing Parameters Check (No Silent Assumptions)</span>
              </h4>
              <div className="space-y-2">
                {analysis.missing_parameters.length > 0 ? (
                  analysis.missing_parameters.map((p: string, i: number) => (
                    <div key={i} className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                      &bull; {p}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-emerald-400 font-semibold p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    All required numeric parameters were extracted from the prompt.
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5 rtl:space-x-reverse">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Explicit Mathematical Assumptions</span>
              </h4>
              <div className="space-y-2">
                {analysis.explicit_assumptions.map((asm: string, i: number) => (
                  <div key={i} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300">
                    &bull; {asm}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
