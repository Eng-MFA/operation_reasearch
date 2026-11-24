import math
from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel, Field

class QueuingModelRequest(BaseModel):
    model_type: str = "M/M/1"  # "M/M/1", "M/M/c", "M/M/1/K", "M/G/1"
    arrival_rate: float = 8.0  # lambda (customers/time unit)
    service_rate: float = 10.0  # mu (customers/time unit/server)
    servers: int = 1  # c
    system_capacity: Optional[int] = None  # K for M/M/1/K
    service_time_std_dev: Optional[float] = None  # sigma_s for M/G/1

class QueuingResultResponse(BaseModel):
    model_type: str
    is_stable: bool
    arrival_rate: float
    service_rate: float
    servers: int
    traffic_intensity: float  # rho
    p0_idle_probability: float
    average_number_in_queue_lq: float
    average_number_in_system_l: float
    average_wait_in_queue_wq: float
    average_time_in_system_w: float
    effective_arrival_rate: float
    blocking_probability: Optional[float] = None
    state_probabilities: List[Dict[str, Any]] = []
    mathematical_summary: str


class QueuingSolver:
    """
    Exact Queuing Theory solver implementing M/M/1, M/M/c (Erlang-C), M/M/1/K,
    and M/G/1 Pollaczek-Khinchine formula with stability verification and Little's Law.
    """

    def solve(self, req: QueuingModelRequest) -> QueuingResultResponse:
        mtype = req.model_type.upper().strip()
        lam = req.arrival_rate
        mu = req.service_rate
        c = max(1, req.servers)

        if mtype == "M/M/1":
            return self._solve_mm1(lam, mu)
        elif mtype == "M/M/C":
            return self._solve_mmc(lam, mu, c)
        elif mtype == "M/M/1/K":
            K = req.system_capacity or 10
            return self._solve_mm1k(lam, mu, K)
        elif mtype == "M/G/1":
            std_s = req.service_time_std_dev if req.service_time_std_dev is not None else (1.0 / mu)
            return self._solve_mg1(lam, mu, std_s)
        else:
            raise ValueError(f"Unsupported queuing model: {mtype}")

    def _solve_mm1(self, lam: float, mu: float) -> QueuingResultResponse:
        rho = lam / mu
        if rho >= 1.0:
            return QueuingResultResponse(
                model_type="M/M/1",
                is_stable=False,
                arrival_rate=lam,
                service_rate=mu,
                servers=1,
                traffic_intensity=rho,
                p0_idle_probability=0.0,
                average_number_in_queue_lq=float("inf"),
                average_number_in_system_l=float("inf"),
                average_wait_in_queue_wq=float("inf"),
                average_time_in_system_w=float("inf"),
                effective_arrival_rate=lam,
                mathematical_summary=f"UNSTABLE / OVERLOADED: Arrival rate lambda ({lam}) >= service rate mu ({mu}). Traffic intensity rho = {rho:.2f} >= 1. Queue grows unbounded."
            )

        p0 = 1.0 - rho
        L = rho / (1.0 - rho)
        Lq = (rho**2) / (1.0 - rho)
        W = 1.0 / (mu - lam)
        Wq = rho / (mu - lam)

        states = []
        for n in range(11):
            pn = (1.0 - rho) * (rho**n)
            states.append({"state_n": n, "probability": round(pn, 4)})

        summary = (
            f"M/M/1 Queue is STABLE (rho = {rho:.3f} < 1). "
            f"Server Utilization: {rho*100:.1f}%. Idle Probability P0 = {p0*100:.1f}%. "
            f"Average in Queue Lq = {Lq:.2f} customers (Wait in Queue Wq = {Wq:.3f} time units). "
            f"Average in System L = {L:.2f} customers (Total Time W = {W:.3f} time units). "
            f"Little's Law verified: L = lambda*W ({lam * W:.4f} == {L:.4f})."
        )

        return QueuingResultResponse(
            model_type="M/M/1",
            is_stable=True,
            arrival_rate=lam,
            service_rate=mu,
            servers=1,
            traffic_intensity=round(rho, 4),
            p0_idle_probability=round(p0, 4),
            average_number_in_queue_lq=round(Lq, 4),
            average_number_in_system_l=round(L, 4),
            average_wait_in_queue_wq=round(Wq, 4),
            average_time_in_system_w=round(W, 4),
            effective_arrival_rate=lam,
            state_probabilities=states,
            mathematical_summary=summary
        )

    def _solve_mmc(self, lam: float, mu: float, c: int) -> QueuingResultResponse:
        rho = lam / (c * mu)
        if rho >= 1.0:
            return QueuingResultResponse(
                model_type=f"M/M/{c}",
                is_stable=False,
                arrival_rate=lam,
                service_rate=mu,
                servers=c,
                traffic_intensity=rho,
                p0_idle_probability=0.0,
                average_number_in_queue_lq=float("inf"),
                average_number_in_system_l=float("inf"),
                average_wait_in_queue_wq=float("inf"),
                average_time_in_system_w=float("inf"),
                effective_arrival_rate=lam,
                mathematical_summary=f"UNSTABLE / OVERLOADED: Total arrival rate lambda ({lam}) >= total service capacity ({c} * {mu} = {c*mu}). rho = {rho:.2f} >= 1."
            )

        # Calculate P0 (Erlang-C idle probability)
        r = lam / mu
        sum_terms = sum((r**n) / math.factorial(n) for n in range(c))
        c_term = ((r**c) / math.factorial(c)) * (1.0 / (1.0 - rho))
        p0 = 1.0 / (sum_terms + c_term)

        # Erlang C probability of delay
        P_delay = c_term * p0
        Lq = P_delay * (rho / (1.0 - rho))
        Wq = Lq / lam
        W = Wq + (1.0 / mu)
        L = lam * W

        states = []
        for n in range(c + 8):
            if n < c:
                pn = ((r**n) / math.factorial(n)) * p0
            else:
                pn = ((r**n) / (math.factorial(c) * (c**(n - c)))) * p0
            states.append({"state_n": n, "probability": round(pn, 4)})

        summary = (
            f"Multi-Server M/M/{c} Queue is STABLE (rho = {rho:.3f} < 1). "
            f"Server Utilization: {rho*100:.1f}%. Erlang Delay Probability: {P_delay*100:.1f}%. "
            f"Average Queue Length Lq = {Lq:.2f} (Queue Wait Wq = {Wq:.3f}). "
            f"Total System L = {L:.2f} customers (Total Time W = {W:.3f})."
        )

        return QueuingResultResponse(
            model_type=f"M/M/{c}",
            is_stable=True,
            arrival_rate=lam,
            service_rate=mu,
            servers=c,
            traffic_intensity=round(rho, 4),
            p0_idle_probability=round(p0, 4),
            average_number_in_queue_lq=round(Lq, 4),
            average_number_in_system_l=round(L, 4),
            average_wait_in_queue_wq=round(Wq, 4),
            average_time_in_system_w=round(W, 4),
            effective_arrival_rate=lam,
            state_probabilities=states,
            mathematical_summary=summary
        )

    def _solve_mm1k(self, lam: float, mu: float, K: int) -> QueuingResultResponse:
        """Finite capacity M/M/1/K queue (always stable due to blocking)."""
        rho = lam / mu

        if abs(rho - 1.0) < 1e-6:
            p0 = 1.0 / (K + 1)
            pn_list = [p0] * (K + 1)
            L = K / 2.0
        else:
            p0 = (1.0 - rho) / (1.0 - (rho**(K + 1)))
            pn_list = [p0 * (rho**n) for n in range(K + 1)]
            L = (rho * (1.0 - (K + 1) * (rho**K) + K * (rho**(K + 1)))) / ((1.0 - rho) * (1.0 - (rho**(K + 1))))

        p_blocking = pn_list[K]
        lam_eff = lam * (1.0 - p_blocking)
        W = L / lam_eff
        Wq = W - (1.0 / mu)
        Lq = lam_eff * Wq

        states = [{"state_n": n, "probability": round(p, 4)} for n, p in enumerate(pn_list)]

        summary = (
            f"Finite Capacity M/M/1/{K} solved. Blocking Probability P_K = {p_blocking*100:.2f}%. "
            f"Effective Arrival Rate = {lam_eff:.2f} (Lost rate: {lam * p_blocking:.2f}). "
            f"Average System L = {L:.2f}, System Wait W = {W:.3f}."
        )

        return QueuingResultResponse(
            model_type=f"M/M/1/{K}",
            is_stable=True,
            arrival_rate=lam,
            service_rate=mu,
            servers=1,
            traffic_intensity=round(rho, 4),
            p0_idle_probability=round(p0, 4),
            average_number_in_queue_lq=round(Lq, 4),
            average_number_in_system_l=round(L, 4),
            average_wait_in_queue_wq=round(Wq, 4),
            average_time_in_system_w=round(W, 4),
            effective_arrival_rate=round(lam_eff, 4),
            blocking_probability=round(p_blocking, 4),
            state_probabilities=states,
            mathematical_summary=summary
        )

    def _solve_mg1(self, lam: float, mu: float, std_s: float) -> QueuingResultResponse:
        """Pollaczek-Khinchine (P-K) formula for general service distributions."""
        rho = lam / mu
        if rho >= 1.0:
            return QueuingResultResponse(
                model_type="M/G/1",
                is_stable=False,
                arrival_rate=lam,
                service_rate=mu,
                servers=1,
                traffic_intensity=rho,
                p0_idle_probability=0.0,
                average_number_in_queue_lq=float("inf"),
                average_number_in_system_l=float("inf"),
                average_wait_in_queue_wq=float("inf"),
                average_time_in_system_w=float("inf"),
                effective_arrival_rate=lam,
                mathematical_summary=f"UNSTABLE: Traffic intensity rho = {rho:.2f} >= 1."
            )

        var_s = std_s**2
        # P-K formula for Lq:
        Lq = ((lam**2) * var_s + (rho**2)) / (2.0 * (1.0 - rho))
        Wq = Lq / lam
        W = Wq + (1.0 / mu)
        L = lam * W
        p0 = 1.0 - rho

        summary = (
            f"M/G/1 Queue solved via Pollaczek-Khinchine Formula. "
            f"Service time std dev: {std_s:.4f} (CV = {std_s * mu:.2f}). "
            f"Server Utilization rho = {rho*100:.1f}%. "
            f"Average Queue Lq = {Lq:.2f}, System L = {L:.2f}, Wait Time W = {W:.3f}."
        )

        return QueuingResultResponse(
            model_type="M/G/1",
            is_stable=True,
            arrival_rate=lam,
            service_rate=mu,
            servers=1,
            traffic_intensity=round(rho, 4),
            p0_idle_probability=round(p0, 4),
            average_number_in_queue_lq=round(Lq, 4),
            average_number_in_system_l=round(L, 4),
            average_wait_in_queue_wq=round(Wq, 4),
            average_time_in_system_w=round(W, 4),
            effective_arrival_rate=lam,
            mathematical_summary=summary
        )

queuing_solver = QueuingSolver()
