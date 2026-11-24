export type Language = 'en' | 'ar';

export interface SolverInfo {
  id: string;
  name: string;
  version: string;
  category: string;
  description: string;
  supports_continuous: boolean;
  supports_integer: boolean;
  supports_binary: boolean;
  supports_quadratic: boolean;
  supports_nonlinear: boolean;
  supports_duals: boolean;
  is_available: boolean;
}

export interface ValidationReport {
  is_valid: boolean;
  status_classification: string;
  objective_declared?: number;
  objective_recalculated?: number;
  objective_discrepancy?: number;
  max_constraint_violation: number;
  max_bound_violation: number;
  max_integrality_violation: number;
  is_feasible: boolean;
  is_optimal_proven: boolean;
  constraints_evaluated: Array<{
    name: string;
    expression: string;
    lhs_evaluated: number;
    rhs_value: number;
    relation: string;
    violation: number;
    is_satisfied: boolean;
    slack_or_surplus: number;
  }>;
  bounds_evaluated: Array<{
    name: string;
    value: number;
    lower_bound?: number;
    upper_bound?: number;
    is_satisfied: boolean;
    violation: number;
  }>;
  validation_messages: string[];
}

export interface LPResult {
  status: string;
  is_optimal: boolean;
  objective_value: number;
  variable_values: Record<string, number>;
  reduced_costs: Record<string, number>;
  variable_basis_status: Record<string, string>;
  slack_surplus_values: Record<string, number>;
  shadow_prices: Record<string, number>;
  constraint_basis_status: Record<string, string>;
  solver_name: string;
  solver_method: string;
  iterations: number;
  execution_time_sec: number;
  duality_gap: number;
  sensitivity_objective: Array<{
    name: string;
    current_value: number;
    allowable_increase?: number;
    allowable_decrease?: number;
    lower_limit?: number;
    upper_limit?: number;
  }>;
  sensitivity_rhs: Array<{
    name: string;
    current_value: number;
    allowable_increase?: number;
    allowable_decrease?: number;
    lower_limit?: number;
    upper_limit?: number;
  }>;
  validation_report: ValidationReport;
  graphical_data?: {
    is_applicable: boolean;
    var_x?: string;
    var_y?: string;
    feasible_vertices: number[][];
    lines: Array<{
      name: string;
      a: number;
      b: number;
      rhs: number;
      relation: string;
    }>;
    optimal_vertex?: number[];
    x_bounds: number[];
    y_bounds: number[];
  };
  mathematical_summary: string;
}

export interface BenchmarkCheck {
  id: string;
  name: string;
  category: string;
  reference_source: string;
  analytical_expected_value: number;
  solver_calculated_value: number;
  absolute_error: number;
  status: string;
  details: string;
}

export interface BenchmarkSuiteResponse {
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  all_passed: boolean;
  execution_time_sec: number;
  benchmarks: BenchmarkCheck[];
}
