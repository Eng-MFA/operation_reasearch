import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.core.models_db import Project, OptimizationModel, OptimizationRun

router = APIRouter(prefix="/projects", tags=["Projects & Scenarios"])

class ProjectCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str

class ProjectOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    category: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SaveRunRequest(BaseModel):
    project_id: Optional[int] = None
    scenario_name: str = "Base Scenario"
    solver_name: str
    status: str
    objective_value: Optional[float] = None
    execution_time_sec: Optional[float] = None
    solution_data: Dict[str, Any]
    validation_report: Dict[str, Any]

@router.get("/", response_model=List[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.updated_at.desc()).all()

@router.post("/", response_model=ProjectOut)
def create_project(req: ProjectCreate, db: Session = Depends(get_db)):
    proj = Project(title=req.title, description=req.description, category=req.category)
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return proj

@router.get("/{project_id}")
def get_project_details(project_id: int, db: Session = Depends(get_db)):
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found.")
    runs = db.query(OptimizationRun).filter(OptimizationRun.project_id == project_id).all()
    return {
        "project": ProjectOut.model_validate(proj),
        "runs_count": len(runs),
        "runs": [
            {
                "id": r.id,
                "scenario_name": r.scenario_name,
                "solver_name": r.solver_name,
                "status": r.status,
                "objective_value": r.objective_value,
                "execution_time_sec": r.execution_time_sec,
                "created_at": r.created_at
            } for r in runs
        ]
    }

@router.post("/save-run")
def save_optimization_run(req: SaveRunRequest, db: Session = Depends(get_db)):
    run = OptimizationRun(
        project_id=req.project_id,
        scenario_name=req.scenario_name,
        solver_name=req.solver_name,
        status=req.status,
        objective_value=req.objective_value,
        execution_time_sec=req.execution_time_sec,
        solution_data=json.dumps(req.solution_data),
        validation_report=json.dumps(req.validation_report)
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return {"message": "Run saved successfully", "run_id": run.id}
