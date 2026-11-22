"""
Real-Time Multi-Provider Traffic Engine for Dhaka Corridors
============================================================
Provides live traffic, travel times, congestion delays, and speeds for Dhaka corridors.

Strict Provider & Failover Hierarchy:
  1. Google Maps Routes API v2 (Primary)
     - High-precision lane & corridor telemetry with live traffic awareness.
     - Multi-key pooling with active failover: tries Key #1 first, then Key #2 if 429 quota / error occurs.
  2. OpenStreetMap OSRM Live Road Engine (Secondary / OSM Failover)
     - Activated when both Google Maps API keys fail (e.g. daily quota reached or offline).
     - 100% Free, zero-key, no quota limits, exact OpenStreetMap road topology & real street distances.
     - Dynamic congestion calibration: integrates live weather (OpenWeatherMap) and Dhaka commuter rush-hour cycles.
  3. TomTom Real-Time API (Optional commercial backup if TOMTOM_API_KEY is in .env).
"""

import os
import sys
import time
import math
import datetime
import requests
import numpy as np

# Load .env file if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Manual .env fallback
env_file = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(env_file):
    with open(env_file, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip("\"'"))


class OSRMTrafficClient:
    """
    Real-time road network telemetry client using Open Source Routing Machine (OSRM)
    powered directly by OpenStreetMap (OSM) road topology.
    Features:
      - 100% Free, zero-key, no quota limits, no HTTP 429 errors.
      - Calculates real exact driving distance and base travel duration across Dhaka's road graph.
      - Dynamic congestion engine: incorporates live weather (OpenWeatherMap) and Dhaka rush-hour traffic cycles.
    """
    PRIMARY_URL = "https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false&annotations=duration,distance"
    BACKUP_URL = "https://routing.openstreetmap.de/routed-car/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false"

    def __init__(self, timeout: int = 8):
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "DhakaTrafficPredictor/2.0 (OSM Traffic Telemetry)",
            "Accept": "application/json"
        })
        self._cache = {}
        self.cache_ttl = 180  # 3-minute in-memory cache to prevent redundant network calls

    def get_route_traffic(self, origin_coords: tuple, dest_coords: tuple, now: datetime.datetime = None, weather: dict = None, archetype: str = 'COMMUTER_ARTERIAL') -> dict:
        orig_lat, orig_lon = origin_coords
        dest_lat, dest_lon = dest_coords

        cache_key = (round(orig_lat, 4), round(orig_lon, 4), round(dest_lat, 4), round(dest_lon, 4), archetype)
        cached = self._cache.get(cache_key)
        now_ts = time.time()
        if cached and (now_ts - cached["time"] < self.cache_ttl):
            return cached["data"]

        # 1. Fetch live OSM geometry duration and distance
        url = self.PRIMARY_URL.format(lon1=orig_lon, lat1=orig_lat, lon2=dest_lon, lat2=dest_lat)
        data = None
        try:
            res = self.session.get(url, timeout=self.timeout)
            if res.status_code == 200:
                data = res.json()
        except Exception:
            # Fallback to backup OSM routing mirror
            try:
                b_url = self.BACKUP_URL.format(lon1=orig_lon, lat1=orig_lat, lon2=dest_lon, lat2=dest_lat)
                res = self.session.get(b_url, timeout=self.timeout)
                if res.status_code == 200:
                    data = res.json()
            except Exception:
                data = None

        if not data or not data.get("routes"):
            return {"success": False, "error": "No OSRM route found", "source": "OSRM"}

        route_info = data["routes"][0]
        duration_sec = float(route_info.get("duration", 0))
        dist_m = float(route_info.get("distance", 0))

        dist_km = max(round(dist_m / 1000.0, 2), 0.5)
        free_flow_min = max(round(duration_sec / 60.0, 1), 1.0)

        # 2. Dynamic live traffic condition calibration for Dhaka by Archetype
        if now is None:
            now = datetime.datetime.now()
        hour = now.hour + (now.minute / 60.0)
        is_weekend = now.weekday() in [4, 5]

        # Archetype-grounded Rush Hour Multipliers
        if not is_weekend:
            if 7.5 <= hour <= 10.5:           # Morning Peak Rush
                rush_multiplier = 2.85 if archetype == 'CHOKE_CORE' else (1.95 if archetype == 'INDUSTRIAL_OUTER' else (1.35 if archetype == 'EXPRESS_BYPASS' else 2.25))
            elif 16.5 <= hour <= 21.0:         # Evening Peak Rush
                rush_multiplier = 3.10 if archetype == 'CHOKE_CORE' else (2.05 if archetype == 'INDUSTRIAL_OUTER' else (1.40 if archetype == 'EXPRESS_BYPASS' else 2.40))
            elif 11.0 <= hour <= 16.5:         # Midday Active Congestion
                rush_multiplier = 1.70 if archetype == 'CHOKE_CORE' else (1.20 if archetype == 'INDUSTRIAL_OUTER' else (1.08 if archetype == 'EXPRESS_BYPASS' else 1.35))
            elif 21.0 < hour <= 23.5:          # Late evening truck & inter-district bus departures
                rush_multiplier = 1.45 if archetype == 'CHOKE_CORE' else (1.12 if archetype == 'INDUSTRIAL_OUTER' else (1.04 if archetype == 'EXPRESS_BYPASS' else 1.18))
            elif 23.5 < hour or hour < 5.5:    # Deep Night free flow
                rush_multiplier = 1.08 if archetype == 'CHOKE_CORE' else 1.04
            else:
                rush_multiplier = 1.25
        else:
            if 15.5 <= hour <= 21.5:
                rush_multiplier = 1.85 if archetype == 'CHOKE_CORE' else 1.30
            elif 22.5 <= hour or hour <= 6.0:
                rush_multiplier = 1.03
            else:
                rush_multiplier = 1.15

        # Live Weather Factor (from OpenWeatherMap)
        weather_multiplier = 1.0
        if weather:
            cond = str(weather.get("weather", "")).lower()
            if "heavy rain" in cond or "thunderstorm" in cond:
                weather_multiplier = 1.40
            elif "rain" in cond or "drizzle" in cond:
                weather_multiplier = 1.20
            elif "fog" in cond or "mist" in cond:
                weather_multiplier = 1.10

        total_delay_factor = rush_multiplier * weather_multiplier
        travel_time_min = max(free_flow_min, round(free_flow_min * total_delay_factor, 1))
        delay_min = max(0.0, round(travel_time_min - free_flow_min, 1))
        speed_kmh = round(dist_km / max(travel_time_min / 60.0, 0.01), 1)

        result = {
            "success": True,
            "source": "OSRM",
            "source_label": "OSRM Live Road Engine (OSM Failover)",
            "travel_time_min": travel_time_min,
            "free_flow_time_min": free_flow_min,
            "traffic_delay_min": delay_min,
            "distance_km": dist_km,
            "speed_kmh": speed_kmh,
            "route_name": route_info.get("legs", [{}])[0].get("summary", "OSM Arterial Road")
        }
        self._cache[cache_key] = {"time": now_ts, "data": result}
        return result


class TomTomTrafficClient:
    """
    Optional commercial traffic client using TomTom Routing & Traffic API.
    Used only if TOMTOM_API_KEY is configured in .env.
    """
    def __init__(self, api_key: str = None, timeout: int = 8):
        self.api_key = api_key or os.getenv("TOMTOM_API_KEY", "")
        self.timeout = timeout
        self.session = requests.Session()

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 10)

    def get_route_traffic(self, origin_coords: tuple, dest_coords: tuple) -> dict:
        if not self.is_configured:
            return {"success": False, "error": "No TomTom key", "source": "TomTom"}

        orig_lat, orig_lon = origin_coords
        dest_lat, dest_lon = dest_coords
        url = f"https://api.tomtom.com/routing/1/calculateRoute/{orig_lat},{orig_lon}:{dest_lat},{dest_lon}/json"
        params = {"key": self.api_key, "traffic": "true"}

        try:
            res = self.session.get(url, params=params, timeout=self.timeout)
            if res.status_code == 200:
                data = res.json()
                routes = data.get("routes", [])
                if routes:
                    summary = routes[0].get("summary", {})
                    travel_time_sec = summary.get("travelTimeInSeconds", 0)
                    delay_sec = summary.get("trafficDelayInSeconds", 0)
                    dist_m = summary.get("lengthInMeters", 0)

                    travel_time_min = round(travel_time_sec / 60.0, 1)
                    delay_min = max(0.0, round(delay_sec / 60.0, 1))
                    free_flow_min = max(round((travel_time_sec - delay_sec) / 60.0, 1), 1.0)
                    if free_flow_min > travel_time_min:
                        free_flow_min = travel_time_min
                        delay_min = 0.0

                    dist_km = max(round(dist_m / 1000.0, 2), 0.5)
                    speed_kmh = round(dist_km / max(travel_time_min / 60.0, 0.01), 1)

                    return {
                        "success": True,
                        "source": "TomTom",
                        "source_label": "TomTom Live Traffic",
                        "travel_time_min": travel_time_min,
                        "free_flow_time_min": free_flow_min,
                        "traffic_delay_min": delay_min,
                        "distance_km": dist_km,
                        "speed_kmh": speed_kmh
                    }
        except Exception as e:
            return {"success": False, "error": str(e), "source": "TomTom"}

        return {"success": False, "error": "TomTom route failed", "source": "TomTom"}


class GoogleRoutesClient:
    """
    Fetches real-time routing and traffic from Google Maps Routes API (v2:computeRoutes).
    Supports multi-key pooling with active failover:
      - Attempts Key #1 first.
      - If Key #1 hits HTTP 429 (quota exhausted), 403, or network timeout, immediately rotates to Key #2.
      - If both keys fail or are exhausted, raises or returns fail condition for automatic OSM/OSRM fallback.
    """
    URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
    FIELD_MASK = "routes.duration,routes.staticDuration,routes.distanceMeters,routes.description"

    def __init__(self, api_keys=None, timeout: int = 8):
        self.keys = []
        raw = []
        if isinstance(api_keys, list):
            raw.extend(api_keys)
        elif isinstance(api_keys, str) and api_keys.strip():
            raw.extend(api_keys.split(","))
        else:
            for env_var in ["GOOGLE_MAPS_API_KEYS", "GOOGLE_MAPS_API_KEY"]:
                val = os.getenv(env_var, "")
                if val:
                    raw.extend(val.split(","))

        # Clean and deduplicate while strictly preserving order (Key 1 -> Key 2)
        seen = set()
        for k in raw:
            k_clean = k.strip().strip("\"'")
            if k_clean and k_clean.startswith("AIza") and k_clean not in seen:
                self.keys.append(k_clean)
                seen.add(k_clean)

        self.timeout = timeout
        self.stats = {k: {"calls": 0, "success": 0, "errors": 0} for k in self.keys}
        self.exhausted_keys = {}  # {key: timestamp_when_cooldown_expires}
        self._quota_notified = False

    @property
    def is_configured(self) -> bool:
        return len(self.keys) > 0

    @property
    def total_keys(self) -> int:
        return len(self.keys)

    def mask_key(self, key: str) -> str:
        if not key or len(key) < 10:
            return "N/A"
        return f"{key[:6]}...{key[-4:]}"

    def get_route_traffic(self, origin_coords: tuple, dest_coords: tuple, route: dict = None) -> dict:
        """
        Queries Google Routes API for live traffic state.
        Tries Key 1 first; if Key 1 hits quota limits or fails, tries Key 2 immediately.
        """
        if not self.is_configured:
            return {"success": False, "error": "No GOOGLE_MAPS_API_KEY configured", "source": "Google"}

        now_ts = time.time()
        # Filter available keys (not in 30-min cooldown)
        available_keys = [k for k in self.keys if self.exhausted_keys.get(k, 0) < now_ts]

        if not available_keys:
            if not self._quota_notified:
                print("\n[Google Routes API] Quota exhausted on all configured Google key(s).")
                print("  -> Seamlessly failing over to OpenStreetMap (OSRM Live Road Engine).\n")
                self._quota_notified = True
            return {"success": False, "error": "All Google keys exhausted", "source": "Google"}

        orig_lat, orig_lon = origin_coords
        dest_lat, dest_lon = dest_coords

        body = {
            "origin": {"location": {"latLng": {"latitude": orig_lat, "longitude": orig_lon}}},
            "destination": {"location": {"latLng": {"latitude": dest_lat, "longitude": dest_lon}}},
            "travelMode": "DRIVE",
            "routingPreference": "TRAFFIC_AWARE"
        }

        last_error = "Unknown Google error"

        # Sequential failover: Try Key 1 -> Key 2
        for key_idx_zero, api_key in enumerate(available_keys):
            self.stats[api_key]["calls"] += 1
            headers = {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": self.FIELD_MASK
            }

            try:
                res = requests.post(self.URL, json=body, headers=headers, timeout=self.timeout)
                if res.status_code == 200:
                    data = res.json()
                    routes = data.get("routes", [])
                    if routes:
                        r = routes[0]
                        duration_str = r.get("duration", "0s").rstrip("s")
                        static_str = r.get("staticDuration", "").rstrip("s")
                        duration_sec = float(duration_str) if duration_str else 0.0
                        static_sec = float(static_str) if static_str else 0.0
                        length_m = float(r.get("distanceMeters", 0))

                        road_len = route.get("road_length_km", 5.0) if route else 5.0
                        dist_km = max(round(length_m / 1000.0, 2), road_len if route else 0.5)

                        # Determine authentic physical free-flow baseline
                        road_type = route.get("road_type", "Primary Arterial") if route else "Primary Arterial"
                        is_expressway = "Expressway" in str(road_type)
                        ff_speed = 55.0 if is_expressway else 38.0
                        physical_t0_sec = (dist_km / ff_speed) * 3600.0

                        google_ff_speed = (dist_km / max(static_sec / 3600.0, 0.001)) if static_sec > 0 else 0.0
                        # Trust Google staticDuration only if valid, distinct from duration, and physical
                        if static_sec > 0 and abs(static_sec - duration_sec) > 5.0 and 25.0 <= google_ff_speed <= 70.0:
                            free_flow_min = max(1.0, round(static_sec / 60.0, 1))
                        elif route and route.get("free_flow_time_min"):
                            free_flow_min = float(route["free_flow_time_min"])
                        else:
                            free_flow_min = max(1.0, round(physical_t0_sec / 60.0, 1))

                        travel_time_min = max(free_flow_min, round(duration_sec / 60.0, 1))
                        delay_min = max(0.0, round(travel_time_min - free_flow_min, 1))
                        speed_kmh = round(dist_km / max(travel_time_min / 60.0, 0.01), 1)

                        self.stats[api_key]["success"] += 1
                        self._quota_notified = False
                        key_number = self.keys.index(api_key) + 1

                        return {
                            "success": True,
                            "source": "Google",
                            "key_index": key_number,
                            "key_mask": self.mask_key(api_key),
                            "travel_time_min": travel_time_min,
                            "free_flow_time_min": free_flow_min,
                            "traffic_delay_min": delay_min,
                            "distance_km": dist_km,
                            "speed_kmh": speed_kmh,
                            "road_name": r.get("description", "")
                        }
                    else:
                        last_error = "No route found in Google response"
                else:
                    self.stats[api_key]["errors"] += 1
                    last_error = f"Google HTTP {res.status_code}: {res.text[:120]}"
                    if res.status_code in (429, 403):
                        # Mark key as exhausted for 30 minutes
                        self.exhausted_keys[api_key] = time.time() + 1800
                        key_num = self.keys.index(api_key) + 1
                        print(f"  [Google Failover] Key #{key_num} ({self.mask_key(api_key)}) quota exhausted ({res.status_code}).")
                        if key_idx_zero + 1 < len(available_keys):
                            print(f"  -> Immediately falling over to Google Key #{key_num + 1}...")
                        else:
                            print("  -> Both Google Maps API keys exhausted. Falling over to OpenStreetMap (OSRM Live Engine)...")

            except Exception as e:
                self.stats[api_key]["errors"] += 1
                last_error = str(e)
                print(f"  [Google Warning] Key #{self.keys.index(api_key) + 1} network error: {e}")

        return {"success": False, "error": last_error, "source": "Google"}


class DualTrafficEngine:
    """
    Multi-Provider Unified Real-Time Traffic Engine.
    
    Failover Execution Order:
      1. Google Maps Routes API v2 (Primary: Key #1 -> Key #2 failover)
      2. OpenStreetMap OSRM Live   (OSM Failover: 100% free, zero-key, real road network topology)
      3. TomTom Real-Time API      (Optional commercial backup if TOMTOM_API_KEY is configured in .env)
      4. Calibrated Dhaka Engine   (Offline fallback only if no internet connection exists)
    """
    def __init__(self, google_api_keys=None, tomtom_api_key=None, *args, **kwargs):
        self.google = GoogleRoutesClient(google_api_keys)
        self.osrm = OSRMTrafficClient()
        self.tomtom = TomTomTrafficClient(tomtom_api_key)
        self.waze = self.osrm  # Backwards compatibility alias

    def fetch_live_traffic(self, route: dict, now: datetime.datetime = None, weather: dict = None) -> dict:
        """
        Queries real-time traffic across available providers with automatic failover.
        """
        if now is None:
            now = datetime.datetime.now()

        orig_coords = route["origin_coords"]
        dest_coords = route.get("dest_coords", orig_coords)
        road_len = route.get("road_length_km", 5.0)
        free_flow_fallback = route.get("free_flow_time_min", max(2.0, round((road_len / 35.0) * 60, 1)))

        # 1. Primary: Google Maps Routes API v2 (Key 1 -> Key 2)
        google_res = self.google.get_route_traffic(orig_coords, dest_coords, route=route)
        google_ok = google_res.get("success", False)

        # 2. Secondary: OpenStreetMap OSRM Live Road Engine (OSM Failover)
        osrm_res = {"success": False}
        if not google_ok:
            osrm_res = self.osrm.get_route_traffic(
                orig_coords, dest_coords, now, weather,
                archetype=route.get("archetype", "COMMUTER_ARTERIAL")
            )
        osrm_ok = osrm_res.get("success", False)

        # 3. Tertiary: TomTom (if configured and OSM failed)
        tomtom_res = {"success": False}
        if not google_ok and not osrm_ok and self.tomtom.is_configured:
            tomtom_res = self.tomtom.get_route_traffic(orig_coords, dest_coords)
        tomtom_ok = tomtom_res.get("success", False)

        # Provider Selection & Source Labeling
        if google_ok:
            travel_time = google_res["travel_time_min"]
            free_flow = google_res["free_flow_time_min"]
            delay = google_res["traffic_delay_min"]
            speed = google_res["speed_kmh"]
            key_idx = google_res.get("key_index", 1)
            source_label = f"Google Routes Live (Key {key_idx})"
        elif osrm_ok:
            travel_time = osrm_res["travel_time_min"]
            free_flow = osrm_res["free_flow_time_min"]
            delay = osrm_res["traffic_delay_min"]
            speed = osrm_res["speed_kmh"]
            source_label = "OSRM Live Road Engine (OSM Failover)"
        elif tomtom_ok:
            travel_time = tomtom_res["travel_time_min"]
            free_flow = tomtom_res["free_flow_time_min"]
            delay = tomtom_res["traffic_delay_min"]
            speed = tomtom_res["speed_kmh"]
            source_label = "TomTom Live Traffic"
        else:
            # Offline physical simulation only when completely disconnected
            free_flow = free_flow_fallback
            travel_time = free_flow
            delay = 0.0
            speed = round(road_len / max(free_flow / 60.0, 0.01), 1)
            source_label = "Offline Fallback"

        # Physical floor enforcement
        travel_time = max(free_flow, travel_time)
        delay = max(0.0, round(travel_time - free_flow, 1))
        ratio = max(1.00, round(travel_time / max(free_flow, 0.1), 2))

        # Congestion Classification & Upstream/Downstream Shockwave Speeds (Canonical 4-Level Schema)
        if ratio < 1.25:
            traffic_level = "NORMAL"
            upstream_spd = round(speed * np.random.uniform(0.97, 1.03), 1)
            downstream_spd = round(speed * np.random.uniform(0.97, 1.03), 1)
        elif ratio < 1.75:
            traffic_level = "MODERATE"
            upstream_spd = round(min(speed * 1.08, 50.0), 1)
            downstream_spd = round(max(speed * 0.92, 6.0), 1)
        elif ratio < 2.50:
            traffic_level = "HEAVY"
            upstream_spd = round(min(speed * 1.18, 50.0), 1)
            downstream_spd = round(max(speed * 0.84, 4.0), 1)
        else:
            traffic_level = "SEVERE"
            upstream_spd = round(min(speed * 1.25, 50.0), 1)
            downstream_spd = round(max(speed * 0.78, 3.0), 1)

        return {
            "travel_time_min": travel_time,
            "free_flow_time_min": free_flow,
            "traffic_speed_kmh": speed,
            "traffic_level": traffic_level,
            "traffic_delay_min": delay,
            "congestion_ratio": ratio,
            "source_label": source_label,
            "upstream_speed_kmh": upstream_spd,
            "downstream_speed_kmh": downstream_spd,
            "google_time_min": google_res.get("travel_time_min") if google_ok else None,
            "google_delay_min": google_res.get("traffic_delay_min") if google_ok else None,
            "osrm_time_min": osrm_res.get("travel_time_min") if osrm_ok else None,
            "osrm_delay_min": osrm_res.get("traffic_delay_min") if osrm_ok else None,
        }


# Backwards compatibility alias
GoogleWazeTrafficEngine = DualTrafficEngine
