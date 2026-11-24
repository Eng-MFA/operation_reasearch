import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { MathView } from '../utils/katex';
import { Play, Share2, CheckCircle2, AlertTriangle } from 'lucide-react';

export const NetworkOptimizationView: React.FC = () => {
  const { t } = useLanguage();
  const [algorithm, setAlgorithm] = useState<string>('dijkstra');
  const [sourceNode, setSourceNode] = useState('A');
  const [targetNode, setTargetNode] = useState('E');

  const nodes = [
    { id: 'A', label: 'Depot (A)', x: 60, y: 120 },
    { id: 'B', label: 'Node B', x: 180, y: 50 },
    { id: 'C', label: 'Node C', x: 180, y: 190 },
    { id: 'D', label: 'Node D', x: 320, y: 70 },
    { id: 'E', label: 'Sink (E)', x: 440, y: 120 }
  ];

  const edges = [
    { source: 'A', target: 'B', weight: 4, capacity: 10 },
    { source: 'A', target: 'C', weight: 2, capacity: 8 },
    { source: 'B', target: 'D', weight: 5, capacity: 7 },
    { source: 'C', target: 'D', weight: 8, capacity: 6 },
    { source: 'C', target: 'E', weight: 10, capacity: 10 },
    { source: 'D', target: 'E', weight: 2, capacity: 12 },
    { source: 'B', target: 'C', weight: 1, capacity: 4 }
  ];

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSolve = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.solveNetwork({
        name: "Distribution Network Flow",
        algorithm,
        is_directed: true,
        source_node: sourceNode,
        target_node: targetNode,
        nodes,
        edges
      });
      setResult(res);
    } catch (e: any) {
      setError(e.message || "Network solve failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Module E: Network Optimization</h1>
          <p className="text-xs text-slate-400 mt-1">
            Shortest Path (Dijkstra, Bellman-Ford, Floyd-Warshall), Minimum Spanning Tree (Kruskal, Prim), and Max Flow / Min Cut.
          </p>
        </div>

        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <select
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
          >
            <option value="dijkstra">Dijkstra Shortest Path</option>
            <option value="bellman-ford">Bellman-Ford (Negative Cycle Check)</option>
            <option value="kruskal">Kruskal Min Spanning Tree</option>
            <option value="prim">Prim Min Spanning Tree</option>
            <option value="max-flow">Edmonds-Karp Maximum Flow</option>
          </select>
          <button
            onClick={handleSolve}
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 flex items-center space-x-2 rtl:space-x-reverse"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{loading ? t('solving') : 'Solve Graph'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2 rtl:space-x-reverse">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SVG Interactive Topology Canvas */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Network Topology Graph</h3>
          <span className="text-xs text-slate-400 font-mono">
            {algorithm === 'dijkstra' ? `Route: ${sourceNode} -> ${targetNode}` : `Algorithm: ${algorithm.toUpperCase()}`}
          </span>
        </div>

        <div className="w-full h-72 bg-slate-950 rounded-xl border border-slate-800 relative overflow-hidden flex items-center justify-center p-4">
          <svg className="w-full h-full" viewBox="0 0 500 240">
            {/* Draw Edges */}
            {edges.map((e, idx) => {
              const src = nodes.find(n => n.id === e.source)!;
              const tgt = nodes.find(n => n.id === e.target)!;
              
              const isHighlighted = result?.shortest_path_result?.path_edges?.some(
                ([u, v]: string[]) => (u === e.source && v === e.target)
              ) || result?.spanning_tree_result?.tree_edges?.some(
                ([u, v]: any[]) => (u === e.source && v === e.target) || (v === e.source && u === e.target)
              );

              return (
                <g key={idx}>
                  <line
                    x1={src.x}
                    y1={src.y}
                    x2={tgt.x}
                    y2={tgt.y}
                    stroke={isHighlighted ? "#38bdf8" : "#334155"}
                    strokeWidth={isHighlighted ? 3 : 1.5}
                  />
                  {/* Weight label */}
                  <text
                    x={(src.x + tgt.x) / 2}
                    y={(src.y + tgt.y) / 2 - 5}
                    fill={isHighlighted ? "#38bdf8" : "#64748b"}
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    wt:{e.weight}
                  </text>
                </g>
              );
            })}

            {/* Draw Nodes */}
            {nodes.map((n) => {
              const isPath = result?.shortest_path_result?.path_nodes?.includes(n.id);
              return (
                <g key={n.id} className="cursor-pointer">
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r="16"
                    fill={isPath ? "#0284c7" : "#1e293b"}
                    stroke={isPath ? "#38bdf8" : "#475569"}
                    strokeWidth="2"
                  />
                  <text
                    x={n.x}
                    y={n.y + 4}
                    fill="#ffffff"
                    fontSize="11"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {n.id}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {result && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{result.status}</span>
          </div>

          {result.shortest_path_result && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">Shortest Path Distance</div>
                <div className="text-2xl font-bold text-white mt-0.5">{result.shortest_path_result.total_distance}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">Path Sequence</div>
                <div className="text-lg font-bold text-cyan-400 mt-1 font-mono">
                  {result.shortest_path_result.path_nodes.join(' -> ')}
                </div>
              </div>
            </div>
          )}

          {result.spanning_tree_result && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">MST Total Weight</div>
              <div className="text-2xl font-bold text-emerald-400 mt-0.5">{result.spanning_tree_result.total_weight}</div>
            </div>
          )}

          {result.max_flow_result && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">Max Flow Value</div>
              <div className="text-2xl font-bold text-emerald-400 mt-0.5">{result.max_flow_result.max_flow_value}</div>
            </div>
          )}

          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            {result.mathematical_summary}
          </p>
        </div>
      )}
    </div>
  );
};
