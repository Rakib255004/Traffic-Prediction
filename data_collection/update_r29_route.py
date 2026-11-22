"""
Update R29 Route in Traffic Telemetry Datasets
=============================================
Updates Route 29 definition from:
  'R29: ECB Chattor -> ECB Chattor'
To:
  'R29: ECB Chattor -> Kalshi' (Path: ECB Chattor -> Mirpur DOHS -> Pallabi -> Mirpur 12 -> Kalshi)

Fields updated for all R29 records:
- road_route_id: 'R29: ECB Chattor -> Kalshi'
- dest_latitude: 23.8241
- dest_longitude: 90.3780
- road_length_km: 8.25
- free_flow_time_min: 13.8
- travel_time_min: (8.25 / traffic_speed_kmh) * 60
- traffic_delay_min: max(0, travel_time_min - 13.8)
- congestion_ratio: travel_time_min / 13.8
"""

import os
import sys
import pandas as pd

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")

TARGET_FILES = [
    os.path.join(DATA_DIR, "traffic_data.csv"),
    os.path.join(DATA_DIR, "traffic_data_calibrated.csv"),
]

def update_r29_records(file_path):
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    print(f"\nProcessing {file_path}...")
    df = pd.read_csv(file_path, low_memory=False)
    
    # Mask for R29
    mask_r29 = df["road_route_id"].str.startswith("R29", na=False)
    count = mask_r29.sum()
    print(f"Found {count:,} records for R29.")

    if count == 0:
        print("No R29 records found to update.")
        return

    # Update metadata
    df.loc[mask_r29, "road_route_id"] = "R29: ECB Chattor -> Kalshi"
    df.loc[mask_r29, "dest_latitude"] = 23.8241
    df.loc[mask_r29, "dest_longitude"] = 90.3780
    df.loc[mask_r29, "road_length_km"] = 8.25
    df.loc[mask_r29, "free_flow_time_min"] = 13.8

    # Re-calculate kinematics to guarantee 100% mathematical consistency
    speeds = df.loc[mask_r29, "traffic_speed_kmh"].astype(float)
    new_travel_time = ((8.25 / speeds.clip(lower=1.0)) * 60.0).round(1)
    new_delays = (new_travel_time - 13.8).clip(lower=0.0).round(1)
    new_ratios = (new_travel_time / 13.8).round(2)

    df.loc[mask_r29, "travel_time_min"] = new_travel_time
    df.loc[mask_r29, "traffic_delay_min"] = new_delays
    df.loc[mask_r29, "congestion_ratio"] = new_ratios

    # Update traffic_level based on new ratio
    def get_level(ratio):
        if ratio < 1.25:
            return "NORMAL"
        elif ratio < 1.75:
            return "MODERATE"
        elif ratio < 2.50:
            return "HEAVY"
        else:
            return "SEVERE"

    df.loc[mask_r29, "traffic_level"] = new_ratios.apply(get_level)

    # Save cleanly
    df.to_csv(file_path, index=False, encoding="utf-8")
    size_mb = os.path.getsize(file_path) / (1024 * 1024)
    print(f"[OK] Successfully updated {count:,} R29 records in {file_path} ({size_mb:.2f} MB)")

def main():
    print("=" * 70)
    print("ROUTE 29 (ECB Chattor -> Kalshi) TELEMETRY UPDATE")
    print("=" * 70)
    for f in TARGET_FILES:
        update_r29_records(f)
    print("=" * 70)
    print("R29 DATASET UPDATE FINISHED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    main()
