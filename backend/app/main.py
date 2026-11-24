import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import Base, engine
from app.api import (
    routes_lp,
    routes_milp,
    routes_nlp,
    routes_dp,
    routes_network,
    routes_transportation,
    routes_inventory,
    routes_queuing,
    routes_project_mgmt,
    routes_forecasting,
    routes_stochastic,
    routes_metaheuristics,
    routes_energy,
    routes_manufacturing,
    routes_agriculture,
    routes_logistics,
    routes_finance,
    routes_healthcare,
    routes_ai_assistant,
    routes_solvers,
    routes_benchmarks,
    routes_reports,
    routes_model_builder,
    routes_projects,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables if not exist
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Universal Operations Research and Mathematical Optimization Engine with exact solvers and independent validation.",
    lifespan=lifespan
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all API routers
api_prefix = settings.API_V1_STR
app.include_router(routes_lp.router, prefix=api_prefix)
app.include_router(routes_milp.router, prefix=api_prefix)
app.include_router(routes_nlp.router, prefix=api_prefix)
app.include_router(routes_dp.router, prefix=api_prefix)
app.include_router(routes_network.router, prefix=api_prefix)
app.include_router(routes_transportation.router, prefix=api_prefix)
app.include_router(routes_inventory.router, prefix=api_prefix)
app.include_router(routes_queuing.router, prefix=api_prefix)
app.include_router(routes_project_mgmt.router, prefix=api_prefix)
app.include_router(routes_forecasting.router, prefix=api_prefix)
app.include_router(routes_stochastic.router, prefix=api_prefix)
app.include_router(routes_metaheuristics.router, prefix=api_prefix)
app.include_router(routes_energy.router, prefix=api_prefix)
app.include_router(routes_manufacturing.router, prefix=api_prefix)
app.include_router(routes_agriculture.router, prefix=api_prefix)
app.include_router(routes_logistics.router, prefix=api_prefix)
app.include_router(routes_finance.router, prefix=api_prefix)
app.include_router(routes_healthcare.router, prefix=api_prefix)
app.include_router(routes_ai_assistant.router, prefix=api_prefix)
app.include_router(routes_solvers.router, prefix=api_prefix)
app.include_router(routes_benchmarks.router, prefix=api_prefix)
app.include_router(routes_reports.router, prefix=api_prefix)
app.include_router(routes_model_builder.router, prefix=api_prefix)
app.include_router(routes_projects.router, prefix=api_prefix)

@app.get("/")
def root():
    return {
        "platform": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "OPERATIONAL",
        "solvers": ["HiGHS 1.16", "SciPy 1.18", "Google OR-Tools 9.15", "NetworkX 3.7", "Statsmodels 0.15", "DEAP 1.4"],
        "docs_url": "/docs"
    }

@app.get("/health")
def health_check():
    return {"status": "HEALTHY", "version": settings.VERSION}
