"""
Dhaka Special Events & National Holidays Marker
===============================================
Audits all timestamps and routes in data/traffic_data.csv and updates the
`special_event` column from 'No' to 'Yes' for legitimate national holidays,
religious festivals, major public processions, and official state events in Dhaka.

Events Identified & Mapped:
1. Shuvo Janmashtami (2026-09-04):
   - National public holiday. Grand Dhakeshwari Temple procession through Palashi,
     Shaheed Minar, Doyel Chattar, High Court, and Bahadur Shah Park.
2. Fateha-i-Yajdaham (2026-09-23):
   - Significant Islamic religious observance across Dhaka.
3. Madhu Purnima (2026-09-26):
   - Major Buddhist religious festival with congregations in Kamalapur & Mirpur temples.
4. Durga Puja - Maha Shasthi & Saptami (2026-10-06 & 2026-10-07):
   - Opening of 250+ puja mandaps across Dhaka (Dhakeshwari, Banani, Ramna Kali Mandir).
   - Massive evening footfall, traffic diversions around mandaps.
5. Special Compensatory Working Day (2026-10-17):
   - Official executive compensatory working Saturday for the extended 5-day Durga Puja break.
6. Durga Puja - Bijoya Dashami & Grand Immersion Procession (2026-10-21):
   - Citywide public holiday. Grand idol immersion (Bishorjon) processions to Sadarghat /
     Buriganga River, closing key roads in Old Dhaka, English Road, and Nawabpur.
7. Post-Miladunnabi Jashne Julus & Friday Congregations (2026-08-28):
   - Major religious processions around Baitul Mukarram, Motijheel, Kakrail, and Paltan.
8. IAUP International University Assembly (2026-11-19 & 2026-11-20):
   - Major international university summit at Daffodil International University (Ashulia / Savar corridor).
9. Armed Forces Day (2026-11-21):
   - Major national military observance. Official ISPR security and traffic restrictions
     in Dhaka Cantonment, Jahangir Gate to Staff Road, Mohakhali, and ECB Chattor.
"""

import os
import sys
import pandas as pd

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")
TARGET_CSV = os.path.join(DATA_DIR, "traffic_data.csv")
STANDALONE_CSV = os.path.join(DATA_DIR, "traffic_data_calibrated.csv")

def update_events():
    print("=" * 75)
    print("DHAKA SPECIAL EVENTS & NATIONAL HOLIDAYS AUDIT")
    print("=" * 75)

    if not os.path.exists(TARGET_CSV):
        print(f"Error: {TARGET_CSV} not found!")
        sys.exit(1)

    print(f"[1/4] Loading {TARGET_CSV}...")
    df = pd.read_csv(TARGET_CSV, low_memory=False)
    total_records = len(df)
    print(f"      Loaded {total_records:,} records.")

    df["timestamp"] = df["timestamp"].astype(str)
    df["date"] = df["timestamp"].str.split(" ").str[0]
    df["hour_float"] = df["hour"].astype(float)

    # Define Event Match Conditions
    # 1. Full-day citywide national holidays & major festivals
    full_day_dates = [
        "2026-09-04",  # Shuvo Janmashtami (National Public Holiday & Grand Procession)
        "2026-09-23",  # Fateha-i-Yajdaham (Religious Observance)
        "2026-09-26",  # Madhu Purnima (Buddhist Festival)
        "2026-10-07",  # Durga Puja - Maha Saptami
        "2026-10-17",  # Compensatory Government/Office Working Saturday
        "2026-10-21",  # Durga Puja - Bijoya Dashami & Immersion Procession
        "2026-11-21",  # Armed Forces Day (Cantonment & Capital VVIP Restrictions)
    ]
    mask_full_days = df["date"].isin(full_day_dates)

    # 2. Durga Puja Maha Shasthi evening pandal crowds & road diversions (16:00 to 23:59)
    mask_puja_shasthi = (df["date"] == "2026-10-06") & (df["hour_float"] >= 16.0)

    # 3. Post-Miladunnabi Jashne Julus & Rallies in Central Dhaka (Motijheel, Gulistan, Paltan, Kakrail, Shahbagh)
    mask_milad_rallies = (df["date"] == "2026-08-28") & (
        df["road_route_id"].str.contains(
            "Motijheel|Gulistan|Paltan|Kakrail|Shahbagh|Malibagh|Press Club|High Court",
            case=False,
            na=False
        )
    )

    # 4. International University Assembly at DIU (Ashulia / Savar / Airport corridor)
    mask_iaup_summit = (df["date"].isin(["2026-11-19", "2026-11-20"])) & (
        df["road_route_id"].str.contains(
            "Daffodil|Ashulia|Uttara|Airport|House Building|EPZ",
            case=False,
            na=False
        )
    )

    # Combine all event masks
    event_mask = mask_full_days | mask_puja_shasthi | mask_milad_rallies | mask_iaup_summit

    print(f"[2/4] Applying special event flags...")
    df["special_event"] = "No"
    df.loc[event_mask, "special_event"] = "Yes"

    yes_count = (df["special_event"] == "Yes").sum()
    no_count = (df["special_event"] == "No").sum()
    pct = (yes_count / total_records) * 100.0

    print(f"      Records with special_event == 'Yes': {yes_count:,} ({pct:.2f}%)")
    print(f"      Records with special_event == 'No' : {no_count:,} ({100.0 - pct:.2f}%)")

    # Detailed event breakdown
    print("\n[3/4] Event Breakdown by Category & Date:")
    event_rows = df[df["special_event"] == "Yes"]
    breakdown = event_rows.groupby("date").size()
    event_labels = {
        "2026-08-28": "Post-Miladunnabi Central Dhaka Jashne Julus / Rallies",
        "2026-09-04": "Shuvo Janmashtami (National Holiday & Grand Street Procession)",
        "2026-09-23": "Fateha-i-Yajdaham (Islamic Religious Observance)",
        "2026-09-26": "Madhu Purnima (Buddhist Religious Festival)",
        "2026-10-06": "Durga Puja - Maha Shasthi (Evening Pandal Festivities)",
        "2026-10-07": "Durga Puja - Maha Saptami (Mandap Celebrations & Prayers)",
        "2026-10-17": "Special Compensatory Working Saturday (Office & School Transit)",
        "2026-10-21": "Durga Puja - Bijoya Dashami (National Holiday & Grand Immersion)",
        "2026-11-19": "IAUP International Higher Education Assembly (DIU Corridor)",
        "2026-11-20": "IAUP International Higher Education Assembly (DIU Corridor)",
        "2026-11-21": "Armed Forces Day (ISPR Cantonment & Capital Traffic Restrictions)"
    }

    for d, count in breakdown.items():
        label = event_labels.get(d, "Special Public / Religious Event")
        print(f"   • {d}: {count:,} records -> {label}")

    # Clean temporary helper columns before saving
    df.drop(columns=["date", "hour_float"], inplace=True)

    # 4. Save to files
    print(f"\n[4/4] Writing updated records to disk...")
    df.to_csv(TARGET_CSV, index=False, encoding="utf-8")
    df.to_csv(STANDALONE_CSV, index=False, encoding="utf-8")

    size_mb = os.path.getsize(TARGET_CSV) / (1024 * 1024)
    print(f"      [OK] Updated: {TARGET_CSV} ({size_mb:.2f} MB)")
    print(f"      [OK] Updated: {STANDALONE_CSV}")
    print("=" * 75)
    print("SPECIAL EVENTS AUDIT & UPDATE COMPLETED SUCCESSFULLY!")
    print("=" * 75)

if __name__ == "__main__":
    update_events()
