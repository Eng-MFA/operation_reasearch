import pytest
from app.api.routes_benchmarks import run_benchmark_suite

def test_complete_scientific_benchmark_suite():
    res = run_benchmark_suite()
    print(f"Benchmark Suite: {res.passed_tests}/{res.total_tests} passed in {res.execution_time_sec}s.")
    assert res.all_passed is True
    assert res.failed_tests == 0
    assert res.total_tests >= 8
