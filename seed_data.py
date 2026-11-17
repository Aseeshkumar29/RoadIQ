"""
RoadIQ Realistic Punjab Road Corridor Seed Generator
Based on Section 12 DPR: 12 km corridor across NH-44, Phagwara, LPU Campus, Jalandhar Cantt
"""

import math
import random
import uuid
from datetime import datetime, timezone, timedelta
from database import init_db, insert_or_deduplicate, get_connection
from severity import calculate_severity

# Corridors along 12 km Punjab Highway & Municipal Sector
LOCATIONS = [
    {
        "road_name": "NH-44 Grand Trunk Road (Chaheru Flyover Northbound)",
        "ward_id": "Ward 4 - GT Road NH-44 Highway Circle",
        "lat_center": 31.2505,
        "lon_center": 75.7112,
        "pothole_prob": 0.6
    },
    {
        "road_name": "LPU Campus Main Gate Expressway Feeder",
        "ward_id": "Ward 1 - LPU University Zone",
        "lat_center": 31.2536,
        "lon_center": 75.7042,
        "pothole_prob": 0.4
    },
    {
        "road_name": "Law Gate Student Boulevard (High Vibration Sector)",
        "ward_id": "Ward 2 - Law Gate Sub-District",
        "lat_center": 31.2582,
        "lon_center": 75.6985,
        "pothole_prob": 0.7
    },
    {
        "road_name": "NH-44 Phagwara Bypass (Sugar Mill Industrial Junction)",
        "ward_id": "Ward 5 - Phagwara Municipal Zone",
        "lat_center": 31.2295,
        "lon_center": 75.7685,
        "pothole_prob": 0.65
    },
    {
        "road_name": "Chaheru Railway Crossing Approach Road",
        "ward_id": "Ward 3 - Chaheru Rural/Rail Sector",
        "lat_center": 31.2440,
        "lon_center": 75.7220,
        "pothole_prob": 0.75
    },
    {
        "road_name": "Hardaspur PWD Link Highway (Heavy Truck Route)",
        "ward_id": "Ward 6 - Hardaspur PWD Circle",
        "lat_center": 31.2380,
        "lon_center": 75.7360,
        "pothole_prob": 0.6
    },
    {
        "road_name": "Jalandhar Cantt / Rama Mandi Access Corridor",
        "ward_id": "Ward 7 - Jalandhar Cantt Border",
        "lat_center": 31.2845,
        "lon_center": 75.6330,
        "pothole_prob": 0.5
    }
]

VEHICLE_FLEET = [
    "PB-08-BUS-402 (Punjab Roadways)",
    "PB-08-BUS-118 (LPU Transit 04)",
    "PB-09-PATROL-01 (NHAI Inspection)",
    "PB-36-TRUCK-88 (Municipal Logistics)",
    "PB-08-CAB-921 (Commercial Fleet)",
    "PB-02-PATROL-03 (PWD Flying Squad)"
]

def generate_svg_defect_image(anomaly_class: str, severity: int, speed: float, lat: float, lon: float, timestamp: str) -> str:
    """Generates an embedded SVG road camera dashcam snapshot with edge AI HUD overlay"""
    
    # Asphalt surface background tones
    surface_color = "#1E2229" if severity < 4 else "#181A20"
    
    # Defect visual representation based on class
    if anomaly_class == "Pothole":
        # Severity-scaled crater
        crater_rx = 40 + severity * 12
        crater_ry = 22 + severity * 7
        crater_fill = "#0B0C0E"
        edge_glow = "#EF4444" if severity >= 4 else ("#F59E0B" if severity == 3 else "#10B981")
        defect_svg = f"""
        <!-- Asphalt fissure & pothole cavity -->
        <ellipse cx="200" cy="180" rx="{crater_rx + 8}" ry="{crater_ry + 4}" fill="#111317" opacity="0.8" />
        <ellipse cx="200" cy="180" rx="{crater_rx}" ry="{crater_ry}" fill="{crater_fill}" stroke="{edge_glow}" stroke-width="2.5" stroke-dasharray="8 4" />
        <ellipse cx="196" cy="182" rx="{crater_rx * 0.7}" ry="{crater_ry * 0.65}" fill="#050607" />
        <!-- Edge AI detection bounding box -->
        <rect x="{200 - crater_rx - 14}" y="{180 - crater_ry - 12}" width="{(crater_rx + 14) * 2}" height="{(crater_ry + 12) * 2}" 
              fill="none" stroke="{edge_glow}" stroke-width="1.8" stroke-dasharray="6 3" />
        <text x="{200 - crater_rx - 10}" y="{180 - crater_ry - 16}" fill="{edge_glow}" font-family="monospace" font-size="11" font-weight="bold">
          POTHOLE [S={severity}] CONF: 94.3%
        </text>
        """
    elif anomaly_class == "Manhole Cover":
        edge_glow = "#F59E0B" if severity >= 3 else "#10B981"
        defect_svg = f"""
        <!-- Iron manhole casing and sunken rim -->
        <circle cx="200" cy="175" r="46" fill="#1C1F26" stroke="#4B5563" stroke-width="6" />
        <circle cx="200" cy="175" r="38" fill="#14171E" stroke="#374151" stroke-width="3" />
        <line x1="165" y1="175" x2="235" y2="175" stroke="#4B5563" stroke-width="2" />
        <line x1="200" y1="140" x2="200" y2="210" stroke="#4B5563" stroke-width="2" />
        <rect x="145" y="120" width="110" height="110" fill="none" stroke="{edge_glow}" stroke-width="1.8" stroke-dasharray="6 3" />
        <text x="148" y="114" fill="{edge_glow}" font-family="monospace" font-size="11" font-weight="bold">
          MANHOLE COVER [S={severity}]
        </text>
        """
    elif anomaly_class == "Speed Bump":
        defect_svg = """
        <!-- Asphalt hump with yellow warning stripes -->
        <path d="M 60 190 Q 200 135 340 190 L 350 205 Q 200 155 50 205 Z" fill="#282E3A" stroke="#EAB308" stroke-width="2" />
        <polygon points="120,185 140,165 155,165 135,185" fill="#EAB308" opacity="0.85" />
        <polygon points="180,175 200,150 215,150 195,175" fill="#EAB308" opacity="0.85" />
        <polygon points="245,185 265,165 280,165 260,185" fill="#EAB308" opacity="0.85" />
        <text x="130" y="140" fill="#EAB308" font-family="monospace" font-size="11" font-weight="bold">
          SPEED BUMP DETECTED
        </text>
        """
    else:  # Rough Patch
        defect_svg = """
        <!-- Asphalt degradation and alligator cracking -->
        <ellipse cx="200" cy="175" rx="75" ry="35" fill="#1F232B" stroke="#94A3B8" stroke-width="1" stroke-dasharray="4 2" />
        <path d="M 140 170 L 165 180 L 185 165 L 210 185 L 245 170" fill="none" stroke="#64748B" stroke-width="1.5" />
        <path d="M 165 180 L 175 195 L 200 190 L 225 175" fill="none" stroke="#64748B" stroke-width="1.5" />
        <text x="135" y="130" fill="#94A3B8" font-family="monospace" font-size="11" font-weight="bold">
          ROUGH PATCH (CORRUGATION)
        </text>
        """

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250" width="100%" height="100%">
      <!-- Road Surface Perspective Gradient -->
      <defs>
        <linearGradient id="roadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#2D333F" />
          <stop offset="60%" stop-color="{surface_color}" />
          <stop offset="100%" stop-color="#12141A" />
        </linearGradient>
      </defs>
      <rect width="400" height="250" fill="url(#roadGrad)" />
      
      <!-- Perspective Lane Markings -->
      <line x1="80" y1="250" x2="160" y2="40" stroke="#FFFFFF" stroke-width="3" stroke-dasharray="14 12" opacity="0.45" />
      <line x1="320" y1="250" x2="240" y2="40" stroke="#FFFFFF" stroke-width="3" stroke-dasharray="14 12" opacity="0.45" />
      <line x1="390" y1="250" x2="275" y2="40" stroke="#EAB308" stroke-width="2.5" opacity="0.5" />
      <line x1="10" y1="250" x2="125" y2="40" stroke="#EAB308" stroke-width="2.5" opacity="0.5" />
      
      <!-- Defect Feature -->
      {defect_svg}
      
      <!-- RoadIQ Edge AI Dashcam HUD Header -->
      <rect x="0" y="0" width="400" height="28" fill="#0A0E17" opacity="0.88" />
      <text x="12" y="18" fill="#38BDF8" font-family="monospace" font-size="10" font-weight="bold">
        ROADIQ EDGE-AI • CAM-1 FRONT (30fps)
      </text>
      <text x="270" y="18" fill="#94A3B8" font-family="monospace" font-size="9.5">
        INFER: 87ms • 200Hz SYNC
      </text>

      <!-- Bottom HUD Watermark (Speed, GPS, Timestamp) -->
      <rect x="0" y="222" width="400" height="28" fill="#0A0E17" opacity="0.88" />
      <text x="12" y="240" fill="#E2E8F0" font-family="monospace" font-size="10">
        SPD: {speed:.1f} km/h | {lat:.4f}°N, {lon:.4f}°E
      </text>
      <text x="275" y="240" fill="#94A3B8" font-family="monospace" font-size="9.5">
        {timestamp[:19]} UTC
      </text>
    </svg>"""

    # Return as inline SVG data URI
    import urllib.parse
    encoded = urllib.parse.quote(svg)
    return f"data:image/svg+xml;utf8,{encoded}"

def seed_database():
    """Generates ~45 realistic field events along the Punjab test corridor"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM alerts")
    conn.commit()
    conn.close()

    now = datetime.now(timezone.utc)
    seeded_count = 0

    print("Generating RoadIQ realistic seed dataset (12 km Punjab Corridor)...")

    # Generate 45 events across the 7 road sections
    for i in range(45):
        loc = random.choice(LOCATIONS)
        
        # Jitter coordinates slightly along the road corridor (~50-400m)
        lat = loc["lat_center"] + random.uniform(-0.0035, 0.0035)
        lon = loc["lon_center"] + random.uniform(-0.0035, 0.0035)
        
        is_pothole = random.random() < loc["pothole_prob"]
        if is_pothole:
            anomaly_class = "Pothole"
        else:
            anomaly_class = random.choice(["Manhole Cover", "Speed Bump", "Rough Patch"])

        # Timestamp distributed over past 5 days
        minutes_ago = random.randint(15, 5 * 24 * 60)
        timestamp_dt = now - timedelta(minutes=minutes_ago)
        timestamp_str = timestamp_dt.isoformat()
        
        speed = round(random.uniform(32.0, 68.0), 1)
        vehicle = random.choice(VEHICLE_FLEET)

        # Generate realistic sensor modalities based on Section 7 DPR
        if anomaly_class == "Pothole":
            # Potholes: peak freq 8-20 Hz, high kurtosis, deflection 6 - 28 mm, onset rate 0.5 - 2.2 mm/ms
            severity_target = random.choices([1, 2, 3, 4, 5], weights=[0.10, 0.20, 0.35, 0.25, 0.10])[0]
            
            if severity_target == 5:
                d_mm = round(random.uniform(22.0, 28.5), 1)
                r_mm_ms = round(random.uniform(1.6, 2.2), 2)
                imu_rms = round(random.uniform(1.8, 2.6), 2)
                kurtosis = round(random.uniform(6.0, 7.8), 2)
            elif severity_target == 4:
                d_mm = round(random.uniform(16.0, 21.5), 1)
                r_mm_ms = round(random.uniform(1.1, 1.55), 2)
                imu_rms = round(random.uniform(1.4, 1.9), 2)
                kurtosis = round(random.uniform(5.2, 6.5), 2)
            elif severity_target == 3:
                d_mm = round(random.uniform(11.0, 15.5), 1)
                r_mm_ms = round(random.uniform(0.7, 1.05), 2)
                imu_rms = round(random.uniform(1.0, 1.35), 2)
                kurtosis = round(random.uniform(4.5, 5.5), 2)
            elif severity_target == 2:
                d_mm = round(random.uniform(7.0, 10.5), 1)
                r_mm_ms = round(random.uniform(0.4, 0.65), 2)
                imu_rms = round(random.uniform(0.85, 1.05), 2)
                kurtosis = round(random.uniform(3.8, 4.6), 2)
            else:  # S = 1
                d_mm = round(random.uniform(4.0, 6.5), 1)
                r_mm_ms = round(random.uniform(0.2, 0.35), 2)
                imu_rms = round(random.uniform(0.80, 0.92), 2)
                kurtosis = round(random.uniform(3.2, 3.8), 2)

            peak_freq = round(random.uniform(10.5, 18.5), 1)
            gyro_x = round(random.uniform(14.0, 38.0), 1)
            vis_conf = round(random.uniform(0.88, 0.98), 3)

        elif anomaly_class == "Manhole Cover":
            d_mm = round(random.uniform(8.0, 16.0), 1)
            r_mm_ms = round(random.uniform(0.6, 1.1), 2)
            imu_rms = round(random.uniform(0.9, 1.4), 2)
            peak_freq = round(random.uniform(12.0, 16.0), 1)
            kurtosis = round(random.uniform(4.0, 5.2), 2)
            gyro_x = round(random.uniform(10.0, 25.0), 1)
            vis_conf = round(random.uniform(0.86, 0.96), 3)

        elif anomaly_class == "Speed Bump":
            # Speed bump: low freq 2-6 Hz, low kurtosis, high gyro tilt, gentle onset
            d_mm = round(random.uniform(12.0, 24.0), 1)
            r_mm_ms = round(random.uniform(0.18, 0.38), 2)
            imu_rms = round(random.uniform(0.7, 1.1), 2)
            peak_freq = round(random.uniform(2.5, 5.5), 1)
            kurtosis = round(random.uniform(1.8, 2.7), 2)
            gyro_x = round(random.uniform(45.0, 95.0), 1)  # Distinctive vehicle tilt
            vis_conf = round(random.uniform(0.92, 0.99), 3)

        else:  # Rough Patch
            d_mm = round(random.uniform(5.0, 9.0), 1)
            r_mm_ms = round(random.uniform(0.3, 0.6), 2)
            imu_rms = round(random.uniform(0.75, 1.05), 2)
            peak_freq = round(random.uniform(6.0, 24.0), 1)  # Spread broadband energy
            kurtosis = round(random.uniform(2.9, 3.8), 2)
            gyro_x = round(random.uniform(8.0, 18.0), 1)
            vis_conf = round(random.uniform(0.84, 0.94), 3)

        calc_s, label, action, auto_flag, depth_cm = calculate_severity(d_mm, r_mm_ms)

        # Status progression based on age
        if minutes_ago < 180:
            status = "New"
            crew = None
        elif minutes_ago < 1400:
            status = random.choice(["New", "Under Review", "Dispatched"])
            crew = "PWD Rapid Response Unit A-2" if status == "Dispatched" else None
        elif minutes_ago < 3500:
            status = random.choice(["Dispatched", "In Repair"])
            crew = "Municipal Asphalt Contractor Phagwara"
        else:
            status = random.choice(["In Repair", "Resolved"])
            crew = "Punjab PWD Circle 3 Maintenance"

        # Generate SVG proof image
        img_url = generate_svg_defect_image(anomaly_class, calc_s, speed, lat, lon, timestamp_str)

        alert_payload = {
            "event_id": f"RIQ-{1000 + i}",
            "timestamp": timestamp_str,
            "latitude": lat,
            "longitude": lon,
            "vehicle_id": vehicle,
            "vehicle_speed": speed,
            "anomaly_class": anomaly_class,
            "severity_score": calc_s,
            "priority_flag": auto_flag,
            "image_base64": img_url,
            "ward_id": loc["ward_id"],
            "road_name": loc["road_name"],
            "status": status,
            "notes": f"Detected during routine corridor scan on {loc['road_name']}.",
            "sensor_snapshot": {
                "imu_z_rms": imu_rms,
                "gyro_x_peak": gyro_x,
                "peak_frequency": peak_freq,
                "kurtosis": kurtosis,
                "suspension_deflection_d": d_mm,
                "suspension_onset_rate_r": r_mm_ms,
                "visual_confidence": vis_conf
            }
        }

        inserted, is_new = insert_or_deduplicate(alert_payload)
        seeded_count += 1

    # Simulate repeat vehicle sightings (Multi-vehicle confirmation for high-risk spots)
    # Re-report close to 4 critical potholes to demonstrate fleet de-duplication
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM alerts WHERE anomaly_class = 'Pothole' AND severity_score >= 4 LIMIT 4")
    critical_spots = cursor.fetchall()
    conn.close()

    print(f"Injecting repeat vehicle passes to test fleet de-duplication...")
    for spot in critical_spots:
        for repeat_pass in range(2):
            repeat_vehicle = random.choice([v for v in VEHICLE_FLEET if v != spot["vehicle_id"]])
            # Within 4 meters of original spot
            jitter_lat = spot["latitude"] + random.uniform(-0.00003, 0.00003)
            jitter_lon = spot["longitude"] + random.uniform(-0.00003, 0.00003)
            
            repeat_payload = {
                "event_id": str(uuid.uuid4()),
                "timestamp": (now - timedelta(minutes=random.randint(5, 60))).isoformat(),
                "latitude": jitter_lat,
                "longitude": jitter_lon,
                "vehicle_id": repeat_vehicle,
                "vehicle_speed": round(random.uniform(40.0, 55.0), 1),
                "anomaly_class": "Pothole",
                "severity_score": spot["severity_score"],
                "image_base64": spot["image_base64"],
                "ward_id": spot["ward_id"],
                "road_name": spot["road_name"],
                "status": spot["status"],
                "sensor_snapshot": {
                    "imu_z_rms": 1.75,
                    "gyro_x_peak": 22.0,
                    "peak_frequency": 14.2,
                    "kurtosis": 5.8,
                    "suspension_deflection_d": 19.5,
                    "suspension_onset_rate_r": 1.35,
                    "visual_confidence": 0.95
                }
            }
            insert_or_deduplicate(repeat_payload)

    print(f"Seed completed successfully! Generated {seeded_count} incidents with multi-vehicle confirmations.")

if __name__ == "__main__":
    init_db()
    seed_database()
