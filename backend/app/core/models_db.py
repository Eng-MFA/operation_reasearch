import json
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False)  # e.g., "linear_programming", "energy", "supply_chain"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    models = relationship("OptimizationModel", back_populates="project", cascade="all, delete-orphan")
    results = relationship("OptimizationRun", back_populates="project", cascade="all, delete-orphan")


class OptimizationModel(Base):
    __tablename__ = "optimization_models"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    name = Column(String(255), nullable=False)
    problem_type = Column(String(100), nullable=False)  # "lp", "milp", "nlp", "network", etc.
    model_definition = Column(Text, nullable=False)  # JSON serialized model definition
    solver_config = Column(Text, nullable=True)  # JSON serialized solver settings
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="models")
    runs = relationship("OptimizationRun", back_populates="model", cascade="all, delete-orphan")


class OptimizationRun(Base):
    __tablename__ = "optimization_runs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    model_id = Column(Integer, ForeignKey("optimization_models.id"), nullable=True)
    scenario_name = Column(String(255), default="Base Scenario")
    solver_name = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False)  # "OPTIMAL", "FEASIBLE", "INFEASIBLE", "UNBOUNDED", "ERROR"
    objective_value = Column(Float, nullable=True)
    execution_time_sec = Column(Float, nullable=True)
    iterations = Column(Integer, nullable=True)
    optimality_gap = Column(Float, nullable=True)
    solution_data = Column(Text, nullable=False)  # JSON string of variable values, slacks, duals
    validation_report = Column(Text, nullable=False)  # JSON string of independent validation checks
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="results")
    model = relationship("OptimizationModel", back_populates="runs")
