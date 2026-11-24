import math
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel, Field
from scipy.stats import norm

class QuantityDiscountTier(BaseModel):
    min_quantity: float
    max_quantity: Optional[float] = None
    unit_price: float

class ABCItem(BaseModel):
    sku: str
    annual_demand: float
    unit_cost: float

class InventoryModelRequest(BaseModel):
    model_type: str = "eoq"  # "eoq", "epq", "quantity_discount", "newsvendor", "abc_analysis"
    # Basic EOQ/EPQ parameters
    annual_demand: float = 10000.0
    ordering_cost: float = 50.0  # S
    holding_cost_rate: float = 0.20  # annual holding % of unit cost
    unit_cost: float = 10.0  # C
    holding_cost_fixed: Optional[float] = None  # H ($/unit/year)
    production_rate: Optional[float] = 20000.0  # P for EPQ
    working_days_per_year: int = 250
    # Stochastic & ROP parameters
    lead_time_days: float = 5.0
    daily_demand_std_dev: float = 10.0
    lead_time_std_dev: float = 0.0
    service_level: float = 0.95  # e.g., 95% cycle service level
    # Newsvendor parameters
    selling_price: Optional[float] = 50.0
    purchase_cost: Optional[float] = 30.0
    salvage_value: Optional[float] = 10.0
    demand_mean: Optional[float] = 100.0
    demand_std_dev: Optional[float] = 20.0
    # Quantity discount tiers
    discount_tiers: List[QuantityDiscountTier] = []
    # ABC analysis items
    abc_items: List[ABCItem] = []

class InventoryPolicyResult(BaseModel):
    model_type: str
    optimal_order_quantity: float
    reorder_point: Optional[float] = None
    safety_stock: Optional[float] = None
    service_level_achieved: Optional[float] = None
    orders_per_year: Optional[float] = None
    cycle_time_days: Optional[float] = None
    annual_ordering_cost: float
    annual_holding_cost: float
    annual_purchasing_cost: float
    total_annual_cost: float
    details: Dict[str, Any] = {}
    cost_curve_data: List[Dict[str, float]] = []
    abc_classification: Optional[List[Dict[str, Any]]] = None
    mathematical_summary: str


class InventorySolver:
    """
    Inventory Optimization solver covering deterministic EOQ/EPQ,
    stochastic Safety Stock / ROP with service levels, quantity discounts,
    the Newsvendor critical fractile, and ABC Pareto classification.
    """

    def solve(self, req: InventoryModelRequest) -> InventoryPolicyResult:
        mtype = req.model_type.lower().strip()

        if mtype == "eoq":
            return self._solve_eoq(req)
        elif mtype == "epq":
            return self._solve_epq(req)
        elif mtype == "quantity_discount":
            return self._solve_quantity_discount(req)
        elif mtype == "newsvendor":
            return self._solve_newsvendor(req)
        elif mtype == "abc_analysis":
            return self._solve_abc_analysis(req)
        else:
            raise ValueError(f"Unknown inventory model type: {req.model_type}")

    def _solve_eoq(self, req: InventoryModelRequest) -> InventoryPolicyResult:
        D = req.annual_demand
        S = req.ordering_cost
        H = req.holding_cost_fixed if req.holding_cost_fixed is not None else (req.unit_cost * req.holding_cost_rate)

        # Standard EOQ formula: Q* = sqrt(2*D*S / H)
        Q_opt = math.sqrt((2.0 * D * S) / H)
        orders_per_year = D / Q_opt
        cycle_time = req.working_days_per_year / orders_per_year

        annual_order_cost = (D / Q_opt) * S
        annual_holding_cost = (Q_opt / 2.0) * H
        annual_purchase_cost = D * req.unit_cost
        total_cost = annual_order_cost + annual_holding_cost + annual_purchase_cost

        # ROP and Safety Stock
        daily_d = D / req.working_days_per_year
        lead_time = req.lead_time_days
        z = norm.ppf(req.service_level)
        # Combined variance of demand during lead time:
        sigma_L = math.sqrt(lead_time * (req.daily_demand_std_dev**2) + (daily_d**2) * (req.lead_time_std_dev**2))
        safety_stock = z * sigma_L
        rop = (daily_d * lead_time) + safety_stock

        # Cost curve sampling for visualization
        cost_curve = []
        for factor in np.linspace(0.3, 2.5, 25):
            q_sample = Q_opt * factor
            ord_c = (D / q_sample) * S
            hld_c = (q_sample / 2.0) * H
            cost_curve.append({
                "quantity": round(q_sample, 1),
                "ordering_cost": round(ord_c, 2),
                "holding_cost": round(hld_c, 2),
                "total_inventory_cost": round(ord_c + hld_c, 2)
            })

        summary = (
            f"Classical EOQ Model solved. Optimal Order Quantity (Q*): {Q_opt:.1f} units. "
            f"Orders per year: {orders_per_year:.2f} (every {cycle_time:.1f} days). "
            f"Reorder Point: {rop:.1f} units (includes safety stock of {safety_stock:.1f} units for {req.service_level*100:.1f}% service level). "
            f"Total Annual Inventory Cost (excl. purchasing): ${(annual_order_cost + annual_holding_cost):.2f}."
        )

        return InventoryPolicyResult(
            model_type="eoq",
            optimal_order_quantity=round(Q_opt, 2),
            reorder_point=round(rop, 2),
            safety_stock=round(safety_stock, 2),
            service_level_achieved=req.service_level,
            orders_per_year=round(orders_per_year, 2),
            cycle_time_days=round(cycle_time, 2),
            annual_ordering_cost=round(annual_order_cost, 2),
            annual_holding_cost=round(annual_holding_cost, 2),
            annual_purchasing_cost=round(annual_purchase_cost, 2),
            total_annual_cost=round(total_cost, 2),
            details={"economic_batch_size": round(Q_opt, 2), "holding_cost_unit_year": H},
            cost_curve_data=cost_curve,
            mathematical_summary=summary
        )

    def _solve_epq(self, req: InventoryModelRequest) -> InventoryPolicyResult:
        D = req.annual_demand
        S = req.ordering_cost
        H = req.holding_cost_fixed if req.holding_cost_fixed is not None else (req.unit_cost * req.holding_cost_rate)
        P = req.production_rate or (D * 2.0)

        if P <= D:
            raise ValueError(f"Annual production rate P ({P}) must strictly exceed annual demand D ({D}) for EPQ feasibility.")

        # EPQ formula: Q* = sqrt((2*D*S) / (H * (1 - D/P)))
        Q_opt = math.sqrt((2.0 * D * S) / (H * (1.0 - D / P)))
        max_inventory = Q_opt * (1.0 - D / P)
        run_length_days = (Q_opt / P) * req.working_days_per_year
        runs_per_year = D / Q_opt

        annual_setup_cost = (D / Q_opt) * S
        annual_holding_cost = (max_inventory / 2.0) * H
        annual_purchase_cost = D * req.unit_cost
        total_cost = annual_setup_cost + annual_holding_cost + annual_purchase_cost

        summary = (
            f"Economic Production Quantity (EPQ) solved. Optimal Production Lot (Q*): {Q_opt:.1f} units. "
            f"Max On-Hand Inventory: {max_inventory:.1f} units. Production run length: {run_length_days:.1f} days "
            f"({runs_per_year:.2f} production runs/year). Total Annual Policy Cost: ${(annual_setup_cost + annual_holding_cost):.2f}."
        )

        return InventoryPolicyResult(
            model_type="epq",
            optimal_order_quantity=round(Q_opt, 2),
            orders_per_year=round(runs_per_year, 2),
            cycle_time_days=round(req.working_days_per_year / runs_per_year, 2),
            annual_ordering_cost=round(annual_setup_cost, 2),
            annual_holding_cost=round(annual_holding_cost, 2),
            annual_purchasing_cost=round(annual_purchase_cost, 2),
            total_annual_cost=round(total_cost, 2),
            details={"max_inventory_level": round(max_inventory, 2), "production_run_days": round(run_length_days, 2)},
            cost_curve_data=[],
            mathematical_summary=summary
        )

    def _solve_quantity_discount(self, req: InventoryModelRequest) -> InventoryPolicyResult:
        D = req.annual_demand
        S = req.ordering_cost
        rate = req.holding_cost_rate

        best_Q = 0.0
        min_total_cost = float("inf")
        best_details = {}

        for tier in req.discount_tiers:
            p = tier.unit_price
            H = p * rate
            # Calculate standard EOQ for this price
            Q_calc = math.sqrt((2.0 * D * S) / H)
            # Adjust to feasible interval [min_q, max_q]
            min_q = tier.min_quantity
            max_q = tier.max_quantity if tier.max_quantity is not None else float("inf")

            if Q_calc < min_q:
                Q_actual = min_q
            elif Q_calc > max_q:
                Q_actual = max_q
            else:
                Q_actual = Q_calc

            order_cost = (D / Q_actual) * S
            holding_cost = (Q_actual / 2.0) * H
            purchasing_cost = D * p
            tc = order_cost + holding_cost + purchasing_cost

            if tc < min_total_cost:
                min_total_cost = tc
                best_Q = Q_actual
                best_details = {
                    "tier_price": p,
                    "order_cost": order_cost,
                    "holding_cost": holding_cost,
                    "purchasing_cost": purchasing_cost,
                    "tier_min": min_q
                }

        summary = (
            f"Quantity Discount model evaluated across {len(req.discount_tiers)} price tiers. "
            f"Optimal Order Quantity is {best_Q:.1f} units at unit price ${best_details.get('tier_price', 0):.2f}. "
            f"Total Annual Minimum Cost: ${min_total_cost:.2f}."
        )

        return InventoryPolicyResult(
            model_type="quantity_discount",
            optimal_order_quantity=round(best_Q, 2),
            annual_ordering_cost=round(best_details.get("order_cost", 0.0), 2),
            annual_holding_cost=round(best_details.get("holding_cost", 0.0), 2),
            annual_purchasing_cost=round(best_details.get("purchasing_cost", 0.0), 2),
            total_annual_cost=round(min_total_cost, 2),
            details=best_details,
            mathematical_summary=summary
        )

    def _solve_newsvendor(self, req: InventoryModelRequest) -> InventoryPolicyResult:
        p = req.selling_price or 50.0
        c = req.purchase_cost or 30.0
        s = req.salvage_value or 10.0
        mu = req.demand_mean or 100.0
        sigma = req.demand_std_dev or 20.0

        # Underage cost (profit lost per unsold unit demand)
        Cu = p - c
        # Overage cost (loss per unsold leftover unit)
        Co = c - s

        # Critical fractile = Cu / (Cu + Co)
        critical_fractile = Cu / (Cu + Co)
        z = norm.ppf(critical_fractile)
        Q_opt = mu + z * sigma

        # Expected sales, expected leftover, expected profit
        # Standard normal loss function
        phi_z = norm.pdf(z)
        Phi_z = norm.cdf(z)
        expected_lost_sales = sigma * (phi_z - z * (1.0 - Phi_z))
        expected_sales = mu - expected_lost_sales
        expected_leftover = Q_opt - expected_sales
        expected_profit = (p * expected_sales) + (s * expected_leftover) - (c * Q_opt)

        summary = (
            f"Newsvendor Model solved. Underage Cost Cu = ${Cu:.2f}, Overage Cost Co = ${Co:.2f}. "
            f"Critical Fractile: {critical_fractile:.4f} (z = {z:.3f}). "
            f"Optimal stocking quantity Q* = {Q_opt:.1f} units. "
            f"Expected Profit: ${expected_profit:.2f} (Expected Leftover: {expected_leftover:.1f} units)."
        )

        return InventoryPolicyResult(
            model_type="newsvendor",
            optimal_order_quantity=round(Q_opt, 2),
            service_level_achieved=round(critical_fractile, 4),
            annual_ordering_cost=0.0,
            annual_holding_cost=round(Co * expected_leftover, 2),
            annual_purchasing_cost=round(c * Q_opt, 2),
            total_annual_cost=round(c * Q_opt, 2),
            details={
                "critical_fractile": round(critical_fractile, 4),
                "underage_cost": Cu,
                "overage_cost": Co,
                "expected_sales": round(expected_sales, 1),
                "expected_leftover": round(expected_leftover, 1),
                "expected_profit": round(expected_profit, 2)
            },
            mathematical_summary=summary
        )

    def _solve_abc_analysis(self, req: InventoryModelRequest) -> InventoryPolicyResult:
        items = req.abc_items
        if not items:
            return InventoryPolicyResult(
                model_type="abc_analysis",
                optimal_order_quantity=0.0,
                annual_ordering_cost=0.0,
                annual_holding_cost=0.0,
                annual_purchasing_cost=0.0,
                total_annual_cost=0.0,
                abc_classification=[],
                mathematical_summary="No items supplied for ABC analysis."
            )

        # Compute annual dollar volume
        parsed_items = []
        for it in items:
            val = it.annual_demand * it.unit_cost
            parsed_items.append({"sku": it.sku, "demand": it.annual_demand, "unit_cost": it.unit_cost, "annual_value": val})

        parsed_items.sort(key=lambda x: x["annual_value"], reverse=True)
        total_val = sum(x["annual_value"] for x in parsed_items)

        cum_val = 0.0
        n = len(parsed_items)
        classified = []

        for i, it in enumerate(parsed_items):
            cum_val += it["annual_value"]
            cum_pct = (cum_val / total_val) * 100.0 if total_val > 0 else 0.0

            if cum_pct <= 75.0 or i < max(1, int(0.2 * n)):
                cls_cat = "A"
            elif cum_pct <= 95.0:
                cls_cat = "B"
            else:
                cls_cat = "C"

            classified.append({
                "sku": it["sku"],
                "annual_value": round(it["annual_value"], 2),
                "value_percentage": round((it["annual_value"] / total_val) * 100.0, 2),
                "cumulative_percentage": round(cum_pct, 2),
                "classification": cls_cat
            })

        count_a = sum(1 for c in classified if c["classification"] == "A")
        count_b = sum(1 for c in classified if c["classification"] == "B")
        count_c = sum(1 for c in classified if c["classification"] == "C")

        summary = (
            f"ABC Inventory Analysis complete for {n} SKUs. Total Annual Volume: ${total_val:,.2f}. "
            f"Class A: {count_a} items (~70-80% value); Class B: {count_b} items (~15% value); Class C: {count_c} items (~5% value)."
        )

        return InventoryPolicyResult(
            model_type="abc_analysis",
            optimal_order_quantity=0.0,
            annual_ordering_cost=0.0,
            annual_holding_cost=0.0,
            annual_purchasing_cost=round(total_val, 2),
            total_annual_cost=round(total_val, 2),
            abc_classification=classified,
            mathematical_summary=summary
        )

inventory_solver = InventorySolver()
