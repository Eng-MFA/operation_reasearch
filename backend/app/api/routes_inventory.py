from fastapi import APIRouter, HTTPException
from app.engine.inventory_solver import inventory_solver, InventoryModelRequest, InventoryPolicyResult

router = APIRouter(prefix="/inventory", tags=["Inventory Optimization"])

@router.post("/solve", response_model=InventoryPolicyResult)
def solve_inventory(req: InventoryModelRequest):
    try:
        return inventory_solver.solve(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Inventory Solver Error: {str(e)}")
