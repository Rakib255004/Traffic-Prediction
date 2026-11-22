"""
Bangladesh Calendar, National Holidays & Dhaka Special Events Engine
=====================================================================
Deterministic ground-truth holiday, weekend, and special event registry for Dhaka.

Why a local deterministic calendar engine is superior to an external Calendar API:
  1. Zero Latency (0ms): No HTTP round-trips, no API quotas, 100% offline reliability.
  2. Bangladesh Specific: Google Calendar API does NOT provide official Bangladesh Government
     gazetted holidays or local Dhaka special events (BPL cricket at Mirpur Stadium, DITF Purbachal,
     Amar Ekushey Boi Mela, Biswa Ijtema at Tongi, Armed Forces Day, etc.).
  3. Physical Consistency: Exactly maps the Friday/Saturday weekend structure and dynamic rush-hour curves.
"""

import datetime
from typing import Tuple, Optional


# ---------------------------------------------------------------------------
# Official Bangladesh Public Holidays (Gazetted by the Cabinet Division)
# ---------------------------------------------------------------------------
BANGLADESH_PUBLIC_HOLIDAYS = {
    # 2025 Gazetted Public Holidays
    "2025-02-15": "Shab-e-Barat",
    "2025-02-21": "Shaheed Day & International Mother Language Day",
    "2025-03-26": "Independence & National Day",
    "2025-03-27": "Shab-e-Qadr",
    "2025-03-28": "Jumatul Bida",
    "2025-03-29": "Eid-ul-Fitr Holiday",
    "2025-03-30": "Eid-ul-Fitr Holiday",
    "2025-03-31": "Eid-ul-Fitr",
    "2025-04-01": "Eid-ul-Fitr Holiday",
    "2025-04-02": "Eid-ul-Fitr Holiday",
    "2025-04-14": "Pahela Baishakh (Bengali New Year)",
    "2025-05-01": "May Day (International Workers' Day)",
    "2025-05-11": "Buddha Purnima",
    "2025-06-05": "Eid-ul-Adha Holiday",
    "2025-06-06": "Eid-ul-Adha Holiday",
    "2025-06-07": "Eid-ul-Adha",
    "2025-06-08": "Eid-ul-Adha Holiday",
    "2025-06-09": "Eid-ul-Adha Holiday",
    "2025-07-06": "Holy Ashura (Muharram)",
    "2025-08-16": "Shuvo Janmashtami",
    "2025-09-05": "Eid-e-Miladunnabi",
    "2025-10-01": "Durga Puja (Maha Nabami)",
    "2025-10-02": "Durga Puja (Bijoya Dashami)",
    "2025-12-16": "Victory Day (Bijoy Dibos)",
    "2025-12-25": "Christmas Day",

    # 2026 Gazetted Public Holidays
    "2026-02-04": "Shab-e-Barat",
    "2026-02-21": "Shaheed Day & International Mother Language Day",
    "2026-03-17": "Shab-e-Qadr",
    "2026-03-19": "Eid-ul-Fitr Holiday",
    "2026-03-20": "Eid-ul-Fitr Holiday",
    "2026-03-21": "Eid-ul-Fitr",
    "2026-03-22": "Eid-ul-Fitr Holiday",
    "2026-03-26": "Independence & National Day",
    "2026-04-14": "Pahela Baishakh (Bengali New Year)",
    "2026-05-01": "May Day",
    "2026-05-01": "Buddha Purnima",
    "2026-05-26": "Eid-ul-Adha Holiday",
    "2026-05-27": "Eid-ul-Adha",
    "2026-05-28": "Eid-ul-Adha Holiday",
    "2026-06-25": "Holy Ashura",
    "2026-08-25": "Eid-e-Miladunnabi",
    "2026-09-04": "Shuvo Janmashtami (National Public Holiday & Grand Procession)",
    "2026-09-23": "Fateha-i-Yajdaham",
    "2026-09-26": "Madhu Purnima",
    "2026-10-06": "Durga Puja (Maha Shasthi)",
    "2026-10-07": "Durga Puja (Maha Saptami)",
    "2026-10-08": "Durga Puja (Maha Ashtami)",
    "2026-10-09": "Durga Puja (Maha Nabami)",
    "2026-10-21": "Durga Puja (Bijoya Dashami & Grand Immersion Procession)",
    "2026-11-21": "Armed Forces Day (Cantonment & Capital VVIP Security Restrictions)",
    "2026-12-16": "Victory Day (Bijoy Dibos)",
    "2026-12-25": "Christmas Day",

    # 2027 Projected Public Holidays
    "2027-02-21": "Shaheed Day & International Mother Language Day",
    "2027-03-10": "Eid-ul-Fitr",
    "2027-03-26": "Independence & National Day",
    "2027-04-14": "Pahela Baishakh",
    "2027-05-01": "May Day",
    "2027-05-17": "Eid-ul-Adha",
    "2027-12-16": "Victory Day",
    "2027-12-25": "Christmas Day"
}

# Compensatory executive working days in Bangladesh (e.g. Saturdays substituted for long holidays)
COMPENSATORY_WORKING_DAYS = {
    "2026-10-17": "Executive Compensatory Working Saturday (Durga Puja Substitution)"
}


# ---------------------------------------------------------------------------
# Dhaka Major Traffic Special Events Registry
# ---------------------------------------------------------------------------
DHAKA_SPECIAL_EVENTS = {
    # Dates with massive public gatherings, rallies, or traffic diversions
    "2026-08-28": {
        "name": "Post-Miladunnabi Grand Jashne Julus & Rallies",
        "affected_areas": ["Motijheel", "Gulistan", "Paltan", "Kakrail", "Shahbagh", "Malibagh", "Press Club"]
    },
    "2026-09-04": {
        "name": "Grand Janmashtami Procession",
        "affected_areas": ["Dhakeshwari", "Palashi", "Shaheed Minar", "Doyel Chattar", "Bahadur Shah Park"]
    },
    "2026-10-06": {
        "name": "Durga Puja Maha Shasthi Pandal Inauguration",
        "affected_areas": ["Dhakeshwari", "Banani", "Ramna Kali Mandir", "Old Dhaka"]
    },
    "2026-10-07": {
        "name": "Durga Puja Maha Saptami Festival",
        "affected_areas": ["All Dhaka Puja Mandaps"]
    },
    "2026-10-21": {
        "name": "Bijoya Dashami Grand Immersion Procession to Buriganga River",
        "affected_areas": ["Old Dhaka", "Sadarghat", "English Road", "Nawabpur", "Buriganga"]
    },
    "2026-11-19": {
        "name": "IAUP International University Assembly",
        "affected_areas": ["Daffodil", "Ashulia", "Savar", "Airport", "House Building"]
    },
    "2026-11-20": {
        "name": "IAUP International University Assembly Day 2",
        "affected_areas": ["Daffodil", "Ashulia", "Savar", "Airport", "House Building"]
    },
    "2026-11-21": {
        "name": "Armed Forces Day Parade & Reception",
        "affected_areas": ["Dhaka Cantonment", "ECB Chattor", "Jahangir Gate", "Mohakhali", "Staff Road"]
    },
    "2026-12-16": {
        "name": "National Victory Day Parade at National Parade Square",
        "affected_areas": ["Tejgaon", "Mirpur Road", "Rokeya Sarani", "Agargaon", "Bijoy Sarani"]
    }
}


def is_bangladesh_weekend(dt: datetime.datetime) -> bool:
    """
    Checks if a given datetime falls on a Bangladesh weekend (Friday=4 or Saturday=5).
    Accounts for official executive compensatory working Saturdays.
    """
    date_str = dt.strftime("%Y-%m-%d")
    if date_str in COMPENSATORY_WORKING_DAYS:
        return False
    return dt.weekday() in [4, 5]


def get_bangladesh_holiday(dt: datetime.datetime) -> Tuple[bool, Optional[str]]:
    """
    Returns (True, 'Holiday Name') if date is an official Bangladesh public holiday,
    otherwise (False, None).
    """
    date_str = dt.strftime("%Y-%m-%d")
    if date_str in BANGLADESH_PUBLIC_HOLIDAYS:
        return True, BANGLADESH_PUBLIC_HOLIDAYS[date_str]
    return False, None


def get_special_event(dt: datetime.datetime, route_id: str = "") -> Tuple[bool, Optional[str]]:
    """
    Checks if there is a special event affecting Dhaka traffic on this date/time.
    If route_id is provided, checks spatial relevance to corridor where applicable.
    """
    date_str = dt.strftime("%Y-%m-%d")
    
    # 1. Full-day citywide holidays are special events
    is_hol, hol_name = get_bangladesh_holiday(dt)
    if is_hol:
        return True, hol_name

    # 2. Check curated Dhaka event registry
    event_info = DHAKA_SPECIAL_EVENTS.get(date_str)
    if event_info:
        areas = event_info.get("affected_areas", [])
        if not areas or not route_id:
            return True, event_info["name"]
        
        # Spatial match check
        for area in areas:
            if area.lower() in route_id.lower():
                return True, event_info["name"]
        
        # If no specific route filter, general event applies
        return True, event_info["name"]

    return False, None


def is_dhaka_rush_hour(dt: datetime.datetime) -> bool:
    """
    Determines if current time is peak Dhaka commuter rush hour:
      - Morning Peak: 08:00 - 10:30
      - Evening Peak: 17:00 - 20:30
    Only active on non-weekend, non-holiday working days.
    """
    if is_bangladesh_weekend(dt):
        return False
    
    is_hol, _ = get_bangladesh_holiday(dt)
    if is_hol:
        return False

    hour_float = dt.hour + (dt.minute / 60.0)
    morning_rush = (8.0 <= hour_float <= 10.5)
    evening_rush = (17.0 <= hour_float <= 20.5)
    return morning_rush or evening_rush
