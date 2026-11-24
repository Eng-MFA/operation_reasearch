import { BenchmarkSuiteResponse, LPResult, SolverInfo } from '../types';

const BASE_URL = '/api/v1';

async function post<T>(endpoint: string, body: any): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Optimization Solver Error');
  }
  return res.json();
}

async function get<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`);
  if (!res.ok) {
    throw new Error('Network error');
  }
  return res.json();
}

export const api = {
  // Solvers
  listSolvers: () => get<SolverInfo[]>('/solvers/list'),
  
  // Benchmarks
  runBenchmarks: () => post<BenchmarkSuiteResponse>('/benchmarks/run-all', {}),

  // Core OR Solvers
  solveLP: (data: any) => post<LPResult>('/lp/solve', data),
  solveMILP: (data: any) => post<any>('/milp/solve', data),
  solveNLP: (data: any) => post<any>('/nlp/solve', data),
  solveDP: (data: any) => post<any>('/dp/solve', data),
  solveNetwork: (data: any) => post<any>('/network/solve', data),
  solveTransportation: (data: any) => post<any>('/transport/transportation', data),
  solveAssignment: (data: any) => post<any>('/transport/assignment', data),
  solveInventory: (data: any) => post<any>('/inventory/solve', data),
  solveQueuing: (data: any) => post<any>('/queuing/solve', data),
  solveProjectMgmt: (data: any) => post<any>('/project-mgmt/solve', data),

  // Forecasting — routes to /forecasting/forecast
  solveForecast: (data: any) => post<any>('/forecasting/forecast', data),
  solveForecasting: (data: any) => post<any>('/forecasting/forecast', data),

  // Stochastic — two-stage or monte-carlo via problem_type
  solveStochastic: (data: any) => {
    if (data.problem_type === 'monte_carlo') {
      return post<any>('/stochastic/monte-carlo', data);
    }
    return post<any>('/stochastic/two-stage', data);
  },

  // Metaheuristics
  solveMetaheuristics: (data: any) => post<any>('/metaheuristics/optimize', data),

  // Industry Suites — explicit endpoints
  solveEconomicDispatch: (data: any) => post<any>('/energy/economic-dispatch', data),
  solveMicrogrid: (data: any) => post<any>('/energy/microgrid-dispatch', data),

  // Manufacturing — unified via problem_type
  solveManufacturing: (data: any) => {
    if (data.problem_type === 'job_shop') {
      return post<any>('/manufacturing/job-shop', data);
    }
    return post<any>('/manufacturing/production-plan', data);
  },
  solveProductionPlan: (data: any) => post<any>('/manufacturing/production-plan', data),
  solveJobShop: (data: any) => post<any>('/manufacturing/job-shop', data),

  // Agriculture — unified via problem_type
  solveAgriculture: (data: any) => {
    if (data.problem_type === 'crop_planning') {
      return post<any>('/agriculture/crop-planning', data);
    }
    return post<any>('/agriculture/feed-blending', data);
  },
  solveFeedBlending: (data: any) => post<any>('/agriculture/feed-blending', data),
  solveCropPlanning: (data: any) => post<any>('/agriculture/crop-planning', data),

  // Logistics — unified via problem_type
  solveLogistics: (data: any) => {
    if (data.problem_type === 'facility_location') {
      return post<any>('/logistics/facility-location', data);
    }
    return post<any>('/logistics/cvrp', data);
  },
  solveCVRP: (data: any) => post<any>('/logistics/cvrp', data),
  solveFacilityLocation: (data: any) => post<any>('/logistics/facility-location', data),

  // Finance — unified via problem_type
  solveFinance: (data: any) => {
    if (data.problem_type === 'efficient_frontier') {
      return post<any>('/finance/efficient-frontier', data);
    }
    return post<any>('/finance/portfolio', data);
  },
  solvePortfolio: (data: any) => post<any>('/finance/portfolio', data),
  solveEfficientFrontier: (data: any) => post<any>('/finance/efficient-frontier', data),

  // Healthcare — unified via problem_type
  solveHealthcare: (data: any) => {
    if (data.problem_type === 'resource_scheduling') {
      return post<any>('/healthcare/resource-scheduling', data);
    }
    return post<any>('/healthcare/nurse-rostering', data);
  },
  solveNurseRostering: (data: any) => post<any>('/healthcare/nurse-rostering', data),

  // Model Builder
  exportModelFormat: (data: any) => post<any>('/model-builder/export-format', data),
  solveModelBuilder: (data: any) => post<any>('/model-builder/solve', data),

  // AI Assistant
  analyzeProblemAI: (data: { problem_description: string }) => post<any>('/ai-assistant/formulate', data),

  // Reports
  exportPDF: async (data: any) => {
    const res = await fetch(`${BASE_URL}/reports/export-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.blob();
  },
  exportExcel: async (data: any) => {
    const res = await fetch(`${BASE_URL}/reports/export-excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.blob();
  }
};
