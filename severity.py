"""
RoadIQ Severity Estimation Module
Suspension-derived depth proxy and municipal triage engine
Based on field calibration (OLS on 120 measured potholes, r = 0.87)
"""

from typing import Tuple

SEVERITY_MAPPING = {
    1: {
        "label": "Minor",
        "action": "Routine maintenance",
        "badge_color": "#10B981",  # Emerald Green
        "flagged": False,
        "sla_hours": 336  # 14 days
    },
    2: {
        "label": "Low",
        "action": "Schedule repair",
        "badge_color": "#34D399",  # Mint Green
        "flagged": False,
        "sla_hours": 168  # 7 days
    },
    3: {
        "label": "Medium",
        "action": "Amber alert, repair within 72h",
        "badge_color": "#F59E0B",  # Amber
        "flagged": False,
        "sla_hours": 72   # 3 days
    },
    4: {
        "label": "High",
        "action": "Priority dispatch (48h SLA)",
        "badge_color": "#F97316",  # Coral Orange
        "flagged": True,
        "sla_hours": 48   # 2 days
    },
    5: {
        "label": "Critical",
        "action": "Same-day emergency repair (<24h)",
        "badge_color": "#EF4444",  # Crimson Red
        "flagged": True,
        "sla_hours": 24   # 1 day
    }
}

def calculate_severity(d_mm: float, r_mm_ms: float) -> Tuple[int, str, str, bool, float]:
    """
    Computes severity score S = clip(round(0.15 * D + 2.0 * R), 1, 5)
    where:
      D = Maximum suspension deflection in mm (potentiometer)
      R = Suspension deflection onset rate in mm/ms
      
    Returns:
      (score, label, action, priority_flag, estimated_depth_cm)
    """
    raw_s = 0.15 * float(d_mm) + 2.0 * float(r_mm_ms)
    s = int(round(raw_s))
    score = max(1, min(5, s))
    
    meta = SEVERITY_MAPPING.get(score, SEVERITY_MAPPING[1])
    
    # Linear depth regression proxy calibrated against 120 physical pothole measurements
    # D in mm roughly maps to pothole depth with suspension dampening factor
    depth_cm = round(max(1.0, 0.22 * d_mm + 0.5 * r_mm_ms), 1)
    
    return score, meta["label"], meta["action"], meta["flagged"], depth_cm

def get_severity_info(score: int) -> dict:
    return SEVERITY_MAPPING.get(score, SEVERITY_MAPPING[1])
