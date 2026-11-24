import time
import math
from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel, Field
from scipy.stats import norm

class ProjectActivity(BaseModel):
    id: str
    name: str
    predecessors: List[str] = []
    # CPM deterministic duration
    duration: Optional[float] = None
    # PERT 3-point estimates
    optimistic_a: Optional[float] = None
    most_likely_m: Optional[float] = None
    pessimistic_b: Optional[float] = None

class ProjectModelRequest(BaseModel):
    name: str = "Project Schedule"
    method: str = "cpm"  # "cpm" or "pert"
    target_deadline: Optional[float] = None
    activities: List[ProjectActivity]

class ActivityScheduleResult(BaseModel):
    id: str
    name: str
    predecessors: List[str]
    expected_duration: float
    duration_variance: float
    earliest_start: float
    earliest_finish: float
    latest_start: float
    latest_finish: float
    total_float: float
    free_float: float
    is_critical: bool

class ProjectResultResponse(BaseModel):
    status: str
    method: str
    project_duration: float
    critical_path: List[str]
    activities_schedule: List[ActivityScheduleResult]
    gantt_chart_data: List[Dict[str, Any]]
    pert_completion_probability: Optional[float] = None
    target_deadline: Optional[float] = None
    variance_critical_path: float = 0.0
    std_dev_critical_path: float = 0.0
    execution_time_sec: float
    mathematical_summary: str


class ProjectManagementSolver:
    """
    Project Management solver implementing the Critical Path Method (CPM)
    and Program Evaluation and Review Technique (PERT) with topological passes,
    float computations, and completion probability estimation.
    """

    def solve(self, req: ProjectModelRequest) -> ProjectResultResponse:
        start_time = time.perf_counter()
        is_pert = (req.method.lower() == "pert")

        # 1. Compute duration and variance for each activity
        act_dict = {}
        durations = {}
        variances = {}

        for act in req.activities:
            act_dict[act.id] = act
            if is_pert and act.optimistic_a is not None and act.most_likely_m is not None and act.pessimistic_b is not None:
                a, m, b = act.optimistic_a, act.most_likely_m, act.pessimistic_b
                te = (a + 4.0 * m + b) / 6.0
                var = ((b - a) / 6.0) ** 2
            else:
                te = float(act.duration if act.duration is not None else 1.0)
                var = 0.0

            durations[act.id] = te
            variances[act.id] = var

        # Build adjacency graph
        all_ids = [act.id for act in req.activities]
        successors = {act_id: [] for act_id in all_ids}
        predecessors = {act.id: list(act.predecessors) for act in req.activities}

        for act in req.activities:
            for pred in act.predecessors:
                if pred in successors:
                    successors[pred].append(act.id)

        # Topological sort (Kahn's algorithm)
        in_degree = {act_id: len(predecessors[act_id]) for act_id in all_ids}
        queue = [act_id for act_id, deg in in_degree.items() if deg == 0]
        topo_order = []

        while queue:
            curr = queue.pop(0)
            topo_order.append(curr)
            for succ in successors[curr]:
                in_degree[succ] -= 1
                if in_degree[succ] == 0:
                    queue.append(succ)

        if len(topo_order) < len(all_ids):
            raise ValueError("Cyclic dependency detected in project activity network.")

        # 2. Forward Pass: Earliest Start (ES) and Earliest Finish (EF)
        ES = {act_id: 0.0 for act_id in all_ids}
        EF = {act_id: 0.0 for act_id in all_ids}

        for act_id in topo_order:
            preds = predecessors[act_id]
            if preds:
                ES[act_id] = max(EF[p] for p in preds)
            else:
                ES[act_id] = 0.0
            EF[act_id] = ES[act_id] + durations[act_id]

        project_duration = max(EF.values()) if EF else 0.0

        # 3. Backward Pass: Latest Finish (LF) and Latest Start (LS)
        LF = {act_id: project_duration for act_id in all_ids}
        LS = {act_id: 0.0 for act_id in all_ids}

        for act_id in reversed(topo_order):
            succs = successors[act_id]
            if succs:
                LF[act_id] = min(LS[s] for s in succs)
            else:
                LF[act_id] = project_duration
            LS[act_id] = LF[act_id] - durations[act_id]

        # 4. Total Float, Free Float, and Critical Path
        TF = {}
        FF = {}
        critical_activities = []

        for act_id in all_ids:
            tf = round(LS[act_id] - ES[act_id], 4)
            succs = successors[act_id]
            if succs:
                ff = round(min(ES[s] for s in succs) - EF[act_id], 4)
            else:
                ff = round(project_duration - EF[act_id], 4)

            TF[act_id] = tf
            FF[act_id] = max(0.0, ff)
            if abs(tf) < 1e-4:
                critical_activities.append(act_id)

        # Critical path ordering
        critical_path = [act_id for act_id in topo_order if act_id in critical_activities]

        # PERT probability
        pert_prob = None
        var_cp = sum(variances[act_id] for act_id in critical_path)
        std_cp = math.sqrt(var_cp) if var_cp > 0 else 0.0

        if is_pert and req.target_deadline is not None:
            if std_cp > 1e-6:
                z = (req.target_deadline - project_duration) / std_cp
                pert_prob = float(norm.cdf(z))
            else:
                pert_prob = 1.0 if req.target_deadline >= project_duration else 0.0

        # Results table & Gantt chart
        schedule_res = []
        gantt_data = []

        for act in req.activities:
            act_id = act.id
            is_crit = act_id in critical_activities
            item = ActivityScheduleResult(
                id=act_id,
                name=act.name,
                predecessors=act.predecessors,
                expected_duration=round(durations[act_id], 2),
                duration_variance=round(variances[act_id], 4),
                earliest_start=round(ES[act_id], 2),
                earliest_finish=round(EF[act_id], 2),
                latest_start=round(LS[act_id], 2),
                latest_finish=round(LF[act_id], 2),
                total_float=TF[act_id],
                free_float=FF[act_id],
                is_critical=is_crit
            )
            schedule_res.append(item)

            gantt_data.append({
                "id": act_id,
                "name": act.name,
                "start": round(ES[act_id], 2),
                "duration": round(durations[act_id], 2),
                "end": round(EF[act_id], 2),
                "is_critical": is_crit,
                "slack": TF[act_id]
            })

        exec_time = time.perf_counter() - start_time

        summary = (
            f"Project Schedule ({req.method.upper()}) computed. Total Expected Duration: {project_duration:.2f} time units. "
            f"Critical Path: {' -> '.join(critical_path)}. "
        )
        if is_pert and pert_prob is not None:
            summary += f"Probability of meeting target deadline ({req.target_deadline}): {pert_prob*100:.1f}% (sigma_CP = {std_cp:.2f})."

        return ProjectResultResponse(
            status="SUCCESS",
            method=req.method.upper(),
            project_duration=round(project_duration, 2),
            critical_path=critical_path,
            activities_schedule=schedule_res,
            gantt_chart_data=gantt_data,
            pert_completion_probability=round(pert_prob, 4) if pert_prob is not None else None,
            target_deadline=req.target_deadline,
            variance_critical_path=round(var_cp, 4),
            std_dev_critical_path=round(std_cp, 4),
            execution_time_sec=exec_time,
            mathematical_summary=summary
        )

project_mgmt_solver = ProjectManagementSolver()
