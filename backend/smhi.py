import requests
from datetime import datetime, timezone
import math

SMHI_URL = "https://opendata-download-warnings.smhi.se/ibww/api/version/1/warning.json"

# Coordinates for Ludvika, Dalarna, Sweden
DALARNA_LAT = 60.1496
DALARNA_LON = 15.1883


def safe_parse_time(t):
    """Convert SMHI time format to ISO8601 (or None)"""
    try:
        if not t:
            return None
        return datetime.fromisoformat(t.replace("Z", "+00:00")).isoformat()
    except:
        return None


def get_smhi_warnings():
    """
    Robust SMHI warning parser for the current API format (2026).
    Parses warnings with warningAreas and filters for Dalarna region.
    """

    try:
        response = requests.get(SMHI_URL, timeout=10)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        return {
            "error": f"Failed to fetch SMHI warnings: {e}",
            "warnings": []
        }

    # Current SMHI format (2026): List of warning objects
    if not isinstance(data, list):
        return {"warnings": [], "count": 0}

    parsed = []

    for item in data:
        try:
            # Get event information
            event_obj = item.get("event", {})
            event_name = event_obj.get("sv", "Unknown") if isinstance(event_obj, dict) else str(event_obj)
            
            # Check warningAreas for Dalarna
            warning_areas = item.get("warningAreas", [])
            
            for area in warning_areas:
                # Check if this warning area affects Dalarna
                affected_areas = area.get("affectedAreas", [])
                is_dalarna = any(
                    "dalarna" in str(a.get("sv", "")).lower() or 
                    "dalarna" in str(a.get("en", "")).lower()
                    for a in affected_areas
                )
                
                if not is_dalarna:
                    continue
                
                # Extract warning level
                warning_level_obj = area.get("warningLevel", {})
                level = warning_level_obj.get("sv", "").lower() if isinstance(warning_level_obj, dict) else "yellow"
                
                # Map level to severity number for notifications
                severity_map = {"gul": 1, "yellow": 1, "orange": 2, "orange": 2, "röd": 3, "red": 3}
                severity = severity_map.get(level.lower(), 1)
                
                # Get time information
                from_time = safe_parse_time(area.get("approximateStart"))
                published = safe_parse_time(area.get("published"))
                
                # Get area name
                area_name_obj = area.get("areaName", {})
                area_name = area_name_obj.get("sv", "Dalarna") if isinstance(area_name_obj, dict) else "Dalarna"
                
                # Get event description
                event_desc_obj = area.get("eventDescription", {})
                event_description = event_desc_obj.get("sv", event_name) if isinstance(event_desc_obj, dict) else event_name
                
                parsed.append({
                    "event": event_name,
                    "description": event_description,
                    "level": level,
                    "severity": severity,
                    "from": from_time or published,
                    "to": from_time or published,  # SMHI doesn't always provide end time
                    "area": area_name,
                    "headline": event_description
                })

        except Exception as e:
            print(f"Error parsing SMHI warning: {e}")
            continue

    return {
        "warnings": parsed,
        "count": len(parsed)
    }


def calculate_sun_times(lat, lon):
    """
    Calculate approximate sunrise and sunset times for given coordinates.
    Uses simplified algorithm - good enough for weather dashboard.
    Returns times in local Swedish time (UTC+1/UTC+2 depending on DST).
    """
    now = datetime.now()
    
    # Day of year
    day_of_year = now.timetuple().tm_yday
    
    # Solar declination (simplified)
    declination = 23.45 * math.sin(math.radians((360/365) * (day_of_year - 81)))
    
    # Hour angle at sunrise/sunset
    lat_rad = math.radians(lat)
    dec_rad = math.radians(declination)
    
    try:
        cos_hour_angle = -math.tan(lat_rad) * math.tan(dec_rad)
        cos_hour_angle = max(-1, min(1, cos_hour_angle))  # Clamp to [-1, 1]
        hour_angle = math.degrees(math.acos(cos_hour_angle))
    except:
        # Polar day/night - use defaults
        return {
            "sunrise": "08:00",
            "sunset": "16:00",
            "is_night": now.hour < 8 or now.hour >= 16
        }
    
    # Convert to time (solar noon is approximately 12:00)
    sunrise_hour = 12 - (hour_angle / 15) - (lon / 15)
    sunset_hour = 12 + (hour_angle / 15) - (lon / 15)
    
    # Adjust for Swedish timezone (UTC+1, DST is UTC+2)
    # Simple check: DST roughly March-October
    tz_offset = 2 if 3 <= now.month <= 10 else 1
    sunrise_hour += tz_offset
    sunset_hour += tz_offset
    
    # Format as HH:MM
    sunrise_time = f"{int(sunrise_hour):02d}:{int((sunrise_hour % 1) * 60):02d}"
    sunset_time = f"{int(sunset_hour):02d}:{int((sunset_hour % 1) * 60):02d}"
    
    # Determine if it's currently night
    current_hour = now.hour + now.minute / 60
    is_night = current_hour < sunrise_hour or current_hour >= sunset_hour
    
    return {
        "sunrise": sunrise_time,
        "sunset": sunset_time,
        "is_night": is_night
    }


def get_sun_times():
    """Get sunrise/sunset times for Dalarna, Sweden"""
    return calculate_sun_times(DALARNA_LAT, DALARNA_LON)


def get_smhi_forecast():
    """
    Get current weather forecast from SMHI for Dalarna.
    Returns weather symbol and key parameters.
    """
    url = f"https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/{DALARNA_LON}/lat/{DALARNA_LAT}/data.json"
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        # Get the first (current) time period
        if not data.get('timeSeries') or len(data['timeSeries']) == 0:
            return {"error": "No forecast data available"}
        
        current = data['timeSeries'][0]
        params = {p['name']: p['values'][0] for p in current['parameters']}
        
        return {
            "symbol": params.get('Wsymb2', 1),  # Weather symbol
            "temperature": params.get('t'),
            "humidity": params.get('r'),
            "pressure": params.get('msl'),
            "visibility": params.get('vis'),
            "cloud_cover": params.get('tcc_mean'),
            "wind_speed": params.get('ws'),
            "precipitation": params.get('pcat', 0)
        }
        
    except Exception as e:
        return {"error": f"Failed to fetch SMHI forecast: {e}"}


def get_smhi_timeseries(limit=24):
    """
    Return SMHI raw time series for the given coordinates.
    Limits to the first `limit` entries (default 24 hours).
    Each entry is simplified to { validTime: str, params: { name: value } }.
    """
    url = f"https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/{DALARNA_LON}/lat/{DALARNA_LAT}/data.json"

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()

        series = data.get("timeSeries", [])
        trimmed = series[:limit] if limit and isinstance(limit, int) else series

        simplified = []
        for entry in trimmed:
            try:
                params = {p.get("name"): (p.get("values", [None])[0]) for p in entry.get("parameters", [])}
                simplified.append({
                    "validTime": entry.get("validTime"),
                    "params": params
                })
            except Exception:
                # Skip malformed entries
                continue

        return {"timeSeries": simplified, "count": len(simplified)}
    except Exception as e:
        return {"error": f"Failed to fetch SMHI timeseries: {e}", "timeSeries": [], "count": 0}
