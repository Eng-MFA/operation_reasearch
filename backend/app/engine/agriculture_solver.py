import time
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field

from app.engine.lp_solver import lp_solver, LPModelRequest, VariableDefinition, ConstraintDefinition

class FeedIngredient(BaseModel):
    name: str
    cost_per_kg: float
    min_inclusion_kg: float = 0.0
    max_inclusion_kg: Optional[float] = None
    nutrients: Dict[str, float]  # nutrient_id -> concentration (e.g. protein %, fiber %)

class NutrientRequirement(BaseModel):
    id: str
    name: str
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    unit: str = "%"

class DietBlendingRequest(BaseModel):
    name: str = "Animal Feed Diet Optimization"
    batch_size_kg: float = 1000.0  # Total blend weight
    ingredients: List[FeedIngredient]
    nutrient_requirements: List[NutrientRequirement]

class DietBlendingResult(BaseModel):
    status: str
    total_cost: float
    cost_per_kg: float
    ingredient_allocation: List[Dict[str, Any]]
    nutrient_breakdown: List[Dict[str, Any]]
    execution_time_sec: float
    mathematical_summary: str

class CropPlanItem(BaseModel):
    crop_name: str
    revenue_per_hectare: float
    water_req_m3_per_hectare: float
    labor_hours_per_hectare: float
    max_market_hectares: Optional[float] = None

class CropPlanningRequest(BaseModel):
    total_land_hectares: float
    available_water_m3: float
    available_labor_hours: float
    crops: List[CropPlanItem]

class CropPlanningResult(BaseModel):
    status: str
    total_net_revenue: float
    allocated_hectares: Dict[str, float]
    resource_utilization: Dict[str, Any]
    execution_time_sec: float
    mathematical_summary: str


class AgricultureSolver:
    """
    Agricultural and Food Production Optimization:
    Implements Stigler Diet / Animal Feed Least-Cost Formulation with nutritional constraints,
    and Agricultural Resource Allocation (land, water, labor) for multi-crop planning.
    """

    def solve_feed_blending(self, req: DietBlendingRequest) -> DietBlendingResult:
        start_time = time.perf_counter()

        lp_vars = []
        obj_coeffs = {}
        for ing in req.ingredients:
            lp_vars.append(VariableDefinition(
                name=ing.name,
                lower_bound=ing.min_inclusion_kg,
                upper_bound=ing.max_inclusion_kg
            ))
            obj_coeffs[ing.name] = ing.cost_per_kg

        lp_cons = []
        # Total batch mass constraint: sum(x_i) == batch_size
        batch_coeffs = {ing.name: 1.0 for ing in req.ingredients}
        lp_cons.append(ConstraintDefinition(
            name="Total_Batch_Mass",
            coefficients=batch_coeffs,
            relation="==",
            rhs=req.batch_size_kg
        ))

        # Nutritional requirements
        for nut in req.nutrient_requirements:
            coeffs = {ing.name: ing.nutrients.get(nut.id, 0.0) for ing in req.ingredients}
            if nut.min_amount is not None:
                # sum(nut_val * x_i) >= (min_pct / 100) * batch_size (or absolute min)
                req_val = (nut.min_amount / 100.0) * req.batch_size_kg if nut.unit == "%" else nut.min_amount
                lp_cons.append(ConstraintDefinition(
                    name=f"Min_{nut.name}",
                    coefficients=coeffs,
                    relation=">=",
                    rhs=req_val
                ))
            if nut.max_amount is not None:
                req_val = (nut.max_amount / 100.0) * req.batch_size_kg if nut.unit == "%" else nut.max_amount
                lp_cons.append(ConstraintDefinition(
                    name=f"Max_{nut.name}",
                    coefficients=coeffs,
                    relation="<=",
                    rhs=req_val
                ))

        lp_req = LPModelRequest(
            name="Feed Formulation (Stigler LP)",
            sense="minimize",
            variables=lp_vars,
            objective_coefficients=obj_coeffs,
            constraints=lp_cons
        )

        lp_res = lp_solver.solve(lp_req)
        exec_time = time.perf_counter() - start_time

        ing_alloc = []
        for ing in req.ingredients:
            qty = lp_res.variable_values.get(ing.name, 0.0)
            pct = (qty / req.batch_size_kg) * 100.0 if req.batch_size_kg > 0 else 0.0
            cost = qty * ing.cost_per_kg
            ing_alloc.append({
                "ingredient": ing.name,
                "amount_kg": round(qty, 2),
                "percentage": round(pct, 2),
                "cost": round(cost, 2)
            })

        nut_breakdown = []
        for nut in req.nutrient_requirements:
            actual_mass = sum(ing.nutrients.get(nut.id, 0.0) * lp_res.variable_values.get(ing.name, 0.0) for ing in req.ingredients)
            actual_pct = (actual_mass / req.batch_size_kg) * 100.0 if req.batch_size_kg > 0 else 0.0
            nut_breakdown.append({
                "nutrient": nut.name,
                "actual_level": round(actual_pct if nut.unit == "%" else actual_mass, 2),
                "min_target": nut.min_amount,
                "max_target": nut.max_amount,
                "unit": nut.unit
            })

        tot_cost = lp_res.objective_value
        cost_kg = tot_cost / req.batch_size_kg if req.batch_size_kg > 0 else 0.0

        summary = (
            f"Diet Formulation optimized for {req.batch_size_kg:,.0f} kg batch. "
            f"Total Cost: ${tot_cost:,.2f} (${cost_kg:.4f}/kg). All nutritional constraints satisfied."
        )

        return DietBlendingResult(
            status=lp_res.status,
            total_cost=round(tot_cost, 2),
            cost_per_kg=round(cost_kg, 4),
            ingredient_allocation=ing_alloc,
            nutrient_breakdown=nut_breakdown,
            execution_time_sec=exec_time,
            mathematical_summary=summary
        )

    def solve_crop_planning(self, req: CropPlanningRequest) -> CropPlanningResult:
        start_time = time.perf_counter()

        lp_vars = []
        obj_coeffs = {}
        for c in req.crops:
            lp_vars.append(VariableDefinition(
                name=c.crop_name,
                lower_bound=0.0,
                upper_bound=c.max_market_hectares
            ))
            obj_coeffs[c.crop_name] = c.revenue_per_hectare

        lp_cons = [
            ConstraintDefinition(
                name="Total_Land_Limit",
                coefficients={c.crop_name: 1.0 for c in req.crops},
                relation="<=",
                rhs=req.total_land_hectares
            ),
            ConstraintDefinition(
                name="Water_Availability",
                coefficients={c.crop_name: c.water_req_m3_per_hectare for c in req.crops},
                relation="<=",
                rhs=req.available_water_m3
            ),
            ConstraintDefinition(
                name="Labor_Availability",
                coefficients={c.crop_name: c.labor_hours_per_hectare for c in req.crops},
                relation="<=",
                rhs=req.available_labor_hours
            )
        ]

        lp_req = LPModelRequest(
            name="Crop Planning & Irrigation",
            sense="maximize",
            variables=lp_vars,
            objective_coefficients=obj_coeffs,
            constraints=lp_cons
        )

        lp_res = lp_solver.solve(lp_req)
        exec_time = time.perf_counter() - start_time

        land_used = sum(lp_res.variable_values.get(c.crop_name, 0.0) for c in req.crops)
        water_used = sum(c.water_req_m3_per_hectare * lp_res.variable_values.get(c.crop_name, 0.0) for c in req.crops)
        labor_used = sum(c.labor_hours_per_hectare * lp_res.variable_values.get(c.crop_name, 0.0) for c in req.crops)

        res_util = {
            "land_hectares": {"used": round(land_used, 2), "limit": req.total_land_hectares, "pct": round(land_used/req.total_land_hectares*100, 1)},
            "water_m3": {"used": round(water_used, 1), "limit": req.available_water_m3, "pct": round(water_used/req.available_water_m3*100, 1)},
            "labor_hours": {"used": round(labor_used, 1), "limit": req.available_labor_hours, "pct": round(labor_used/req.available_labor_hours*100, 1)}
        }

        summary = (
            f"Crop Allocation optimized. Maximum Agricultural Revenue: ${lp_res.objective_value:,.2f} "
            f"across {land_used:.1f} hectares planted. Water utilization: {res_util['water_m3']['pct']}%."
        )

        return CropPlanningResult(
            status=lp_res.status,
            total_net_revenue=round(lp_res.objective_value, 2),
            allocated_hectares={c.crop_name: round(lp_res.variable_values.get(c.crop_name, 0.0), 2) for c in req.crops},
            resource_utilization=res_util,
            execution_time_sec=exec_time,
            mathematical_summary=summary
        )

agriculture_solver = AgricultureSolver()
