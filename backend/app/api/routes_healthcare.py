from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import time

from app.engine.healthcare_solver import healthcare_solver, NurseRosteringRequest, NurseRosteringResult

router = APIRouter(prefix="/healthcare", tags=["Healthcare Optimization"])

@router.post("/nurse-rostering", response_model=NurseRosteringResult)
def solve_nurse_rostering(req: NurseRosteringRequest):
    try:
        return healthcare_solver.solve_nurse_rostering(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Nurse Rostering Error: {str(e)}")


class ResourceSchedulingRequest(BaseModel):
    resources: List[Dict[str, Any]]  # [{name, type, available_hours_per_day}]
    appointment_types: List[Dict[str, Any]]  # [{name, duration_min, priority, daily_demand}]
    operating_hours: Dict[str, int] = {"start": 8, "end": 18}
    num_days: int = 5


class ResourceSchedulingResult(BaseModel):
    status: str
    daily_schedule: List[Dict[str, Any]]
    total_appointments: int
    resource_utilization: Dict[str, float]
    unscheduled_demand: int
    execution_time_sec: float
    mathematical_summary: str


@router.post("/resource-scheduling", response_model=ResourceSchedulingResult)
def solve_resource_scheduling(req: ResourceSchedulingRequest):
    """
    Greedy priority-based appointment scheduling across multiple resources and days.
    HIGH priority appointments scheduled first, then MEDIUM, then LOW.
    """
    try:
        start = time.perf_counter()
        priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
        hours_per_day = req.operating_hours.get("end", 18) - req.operating_hours.get("start", 8)
        minutes_per_day = hours_per_day * 60

        # Sort appointment types by priority
        appts = sorted(req.appointment_types,
                       key=lambda a: priority_order.get(a.get("priority", "LOW"), 2))

        total_resource_capacity = {}  # resource -> total minutes available
        for r in req.resources:
            cap = r.get("available_hours_per_day", 8) * 60 * req.num_days
            total_resource_capacity[r["name"]] = cap

        resource_used = {r["name"]: 0 for r in req.resources}
        daily_schedule = []
        total_scheduled = 0
        total_unscheduled = 0

        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

        for day_idx in range(req.num_days):
            day_name = day_names[day_idx % 7]
            day_entries = []
            day_resource_minutes = {r["name"]: r.get("available_hours_per_day", 8) * 60
                                     for r in req.resources}

            for appt in appts:
                dur = appt.get("duration_min", 30)
                demand = appt.get("daily_demand", 10)
                scheduled_today = 0

                for _ in range(demand):
                    # Find first resource with capacity
                    assigned = None
                    for r in req.resources:
                        rname = r["name"]
                        if day_resource_minutes[rname] >= dur:
                            day_resource_minutes[rname] -= dur
                            resource_used[rname] += dur
                            assigned = rname
                            scheduled_today += 1
                            total_scheduled += 1
                            break
                    if assigned is None:
                        total_unscheduled += 1

                if scheduled_today > 0:
                    day_entries.append({
                        "appointment_type": appt.get("name", "Appointment"),
                        "priority": appt.get("priority", "LOW"),
                        "duration_min": dur,
                        "scheduled_count": scheduled_today
                    })

            daily_schedule.append({"day": day_name, "appointments": day_entries})

        # Utilization: used_minutes / total_capacity_minutes
        utilization = {}
        for r in req.resources:
            rname = r["name"]
            cap = total_resource_capacity[rname]
            utilization[rname] = round(resource_used[rname] / cap * 100, 1) if cap > 0 else 0.0

        elapsed = time.perf_counter() - start
        return ResourceSchedulingResult(
            status="scheduled",
            daily_schedule=daily_schedule,
            total_appointments=total_scheduled,
            resource_utilization=utilization,
            unscheduled_demand=total_unscheduled,
            execution_time_sec=round(elapsed, 4),
            mathematical_summary=(
                f"Priority-based greedy scheduling: {total_scheduled} appointments assigned across "
                f"{len(req.resources)} resources over {req.num_days} days. "
                f"{total_unscheduled} appointments unscheduled (capacity exceeded)."
            )
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Resource Scheduling Error: {str(e)}")
