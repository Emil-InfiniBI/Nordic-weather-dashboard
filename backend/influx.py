from datetime import datetime, timezone, timedelta
from influxdb_client import InfluxDBClient
from config import (
    INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET,
    MEASUREMENT_OUTDOOR, FIELD_TEMP, FIELD_HUMID, FIELD_PRESS
)
import math


def _client():
    return InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)


def _magnus_dewpoint(temp_c: float, rh: float) -> float:
    if temp_c is None or rh is None or rh <= 0:
        return None
    a, b = 17.62, 243.12
    gamma = (a * temp_c / (b + temp_c)) + math.log(rh / 100.0)
    dew = (b * gamma) / (a - gamma)
    return round(dew, 1)


# ------------------------------------------------------------
# GET CURRENT VALUES
# ------------------------------------------------------------
def get_current_values():

    # Last values (within last 24 hours - outdoor sensor may update infrequently)
    flux = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "{MEASUREMENT_OUTDOOR}")
  |> filter(fn: (r) => 
       r._field == "{FIELD_TEMP}" or
       r._field == "{FIELD_HUMID}" or
       r._field == "{FIELD_PRESS}")
  |> last()
'''

    # Pressure trend (last 2 hours)
    trend_flux = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -2h)
  |> filter(fn: (r) => r._measurement == "{MEASUREMENT_OUTDOOR}")
  |> filter(fn: (r) => r._field == "{FIELD_PRESS}")
  |> keep(columns: ["_time", "_value"])
  |> sort(columns: ["_time"])
'''

    data = {
        "temperature": None,
        "humidity": None,
        "pressure": None,
        "dew_point": None,
        "timestamp": None,
        "pressure_trend": "stable",
    }

    with _client() as client:
        q = client.query_api()

        # ---------- Latest values ----------
        tables = q.query(flux)

        for table in tables:
            for record in table.records:
                field = record["_field"]
                value = float(record["_value"])
                timestamp = record["_time"].isoformat()

                if field == FIELD_TEMP:
                    # Validate: outdoor temp should be -50 to 50°C
                    if -50 <= value <= 50:
                        data["temperature"] = round(value, 1)
                        data["timestamp"] = timestamp
                elif field == FIELD_HUMID:
                    # Validate: humidity should be 0-100%
                    if 0 <= value <= 100:
                        data["humidity"] = round(value, 1)
                elif field == FIELD_PRESS:
                    # Validate: pressure should be 900-1100 hPa
                    if 900 <= value <= 1100:
                        data["pressure"] = round(value, 1)

        # ---------- Dew point ----------
        data["dew_point"] = _magnus_dewpoint(
            data["temperature"], data["humidity"]
        )

        # ---------- Pressure trend ----------
        trend_tables = q.query(trend_flux)
        pressures = [rec["_value"] for table in trend_tables for rec in table.records]

        if len(pressures) >= 2:
            delta = pressures[-1] - pressures[0]
            if delta > 0.5:
                data["pressure_trend"] = "rising"
            elif delta < -0.5:
                data["pressure_trend"] = "falling"

    # ---------------------------------------------------------
    # LOCAL WARNINGS
    # ---------------------------------------------------------
    warnings = []
    temp = data["temperature"]
    hum = data["humidity"]
    press = data["pressure"]
    dew = data["dew_point"]

    if temp is not None and temp <= 0:
        warnings.append("frost")
    if hum is not None and hum >= 85:
        warnings.append("high_humidity")
    if hum is not None and hum <= 25:
        warnings.append("low_humidity")
    if press is not None and press <= 980:
        warnings.append("low_pressure")
    if press is not None and press >= 1030:
        warnings.append("high_pressure")
    if temp is not None and dew is not None and (temp - dew) <= 1.5:
        warnings.append("condensation_risk")

    data["sensor_warnings"] = warnings
    return data


# ------------------------------------------------------------
# 24-HOUR MIN/MAX
# ------------------------------------------------------------
def get_minmax_24h():
    # Note: After temperature correction, there may be duplicate values at same timestamp
    # For temperature, use min() to get corrected values (2C lower than uncorrected)
    # For humidity/pressure, use last() as they weren't changed
    
    # Temperature min/max (using min to deduplicate - corrected values are lower)
    temp_flux = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "{MEASUREMENT_OUTDOOR}")
  |> filter(fn: (r) => r._field == "{FIELD_TEMP}")
  |> aggregateWindow(every: 10s, fn: min, createEmpty: false)
  |> keep(columns: ["_value"])
'''

    # Humidity and pressure (using last)
    other_flux = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "{MEASUREMENT_OUTDOOR}")
  |> filter(fn: (r) => 
       r._field == "{FIELD_HUMID}" or
       r._field == "{FIELD_PRESS}")
  |> aggregateWindow(every: 10s, fn: last, createEmpty: false)
  |> keep(columns: ["_field", "_value"])
'''

    result = {
        "temperature": {"min": None, "max": None},
        "humidity": {"min": None, "max": None},
        "pressure": {"min": None, "max": None},
    }

    with _client() as client:
        q = client.query_api()
        
        # Get temperature (using min-deduplication for corrected values)
        temp_tables = q.query(temp_flux)
        temps = []
        for table in temp_tables:
            for r in table.records:
                temps.append(float(r["_value"]))
        
        # Get humidity and pressure
        other_tables = q.query(other_flux)
        hums, presses = [], []
        for table in other_tables:
            for r in table.records:
                field = r["_field"]
                value = float(r["_value"])
                if field == FIELD_HUMID:
                    hums.append(value)
                elif field == FIELD_PRESS:
                    presses.append(value)

    if temps:
        result["temperature"]["min"] = round(min(temps), 1)
        result["temperature"]["max"] = round(max(temps), 1)

    if hums:
        result["humidity"]["min"] = round(min(hums), 1)
        result["humidity"]["max"] = round(max(hums), 1)

    if presses:
        result["pressure"]["min"] = round(min(presses), 1)
        result["pressure"]["max"] = round(max(presses), 1)

    return result


# ------------------------------------------------------------
# 24-HOUR HISTORY (for charts)
# ------------------------------------------------------------
def get_24h_history(days=1):
    """Get aggregated outdoor data with configurable time range
    
    Args:
        days: Number of days to fetch (1 = 24h, 2 = 2 days, etc.)
    """
    
    # Calculate start time and aggregation window
    if days <= 1:
        # 24 hours or less: hourly aggregation
        window = "1h"
        start = f"-{int(days * 24)}h"
    elif days <= 4:
        # 2-4 days: 2-hour aggregation
        window = "2h"
        start = f"-{days}d"
    elif days <= 7:
        # 1 week: 4-hour aggregation
        window = "4h"
        start = f"-{days}d"
    else:
        # 1 month: 12-hour aggregation
        window = "12h"
        start = f"-{days}d"
    
    # For temperature: use min to deduplicate (corrected values are 2C lower)
    temp_flux = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: {start})
  |> filter(fn: (r) => r._measurement == "{MEASUREMENT_OUTDOOR}")
  |> filter(fn: (r) => r._field == "{FIELD_TEMP}")
  |> aggregateWindow(every: 10s, fn: min, createEmpty: false)
  |> aggregateWindow(every: {window}, fn: mean, createEmpty: false)
  |> keep(columns: ["_time", "_field", "_value"])
'''
    
    # For humidity/pressure: use last to deduplicate
    other_flux = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: {start})
  |> filter(fn: (r) => r._measurement == "{MEASUREMENT_OUTDOOR}")
  |> filter(fn: (r) => 
       r._field == "{FIELD_HUMID}" or
       r._field == "{FIELD_PRESS}")
  |> aggregateWindow(every: 10s, fn: last, createEmpty: false)
  |> aggregateWindow(every: {window}, fn: mean, createEmpty: false)
  |> keep(columns: ["_time", "_field", "_value"])
'''

    history = {
        "timestamps": [],
        "temperature": [],
        "humidity": [],
        "pressure": []
    }

    with _client() as client:
        q = client.query_api()
        
        # Run both queries
        temp_tables = q.query(temp_flux)
        other_tables = q.query(other_flux)

        data_points = {}
        
        def process_records(tables):
            for table in tables:
                for r in table.records:
                    # Use full datetime for sorting, but format for display
                    timestamp = r["_time"]
                    now = datetime.now(timezone.utc)
                    
                    # Format timestamp based on time range
                    if days <= 1:
                        # 24h: show date for yesterday, time only for today
                        if timestamp.date() < now.date():
                            time_str = timestamp.strftime("%d %b %H:%M")
                        else:
                            time_str = timestamp.strftime("%H:%M")
                    elif days <= 7:
                        # Up to 1 week: show date and time
                        time_str = timestamp.strftime("%d %b %H:%M")
                    else:
                        # 1 month: show date only
                        time_str = timestamp.strftime("%d %b")
                    
                    # Use full timestamp as key to maintain uniqueness
                    timestamp_key = timestamp.isoformat()
                    field = r["_field"]
                    value = float(r["_value"])

                    if timestamp_key not in data_points:
                        data_points[timestamp_key] = {"display_time": time_str}
                    
                    if field == FIELD_TEMP:
                        data_points[timestamp_key]["temperature"] = round(value, 1)
                    elif field == FIELD_HUMID:
                        data_points[timestamp_key]["humidity"] = round(value, 1)
                    elif field == FIELD_PRESS:
                        data_points[timestamp_key]["pressure"] = round(value, 1)
        
        process_records(temp_tables)
        process_records(other_tables)

        # Sort by timestamp key (ISO format) and convert to arrays
        sorted_keys = sorted(data_points.keys())
        
        for key in sorted_keys:
            point = data_points[key]
            history["timestamps"].append(point["display_time"])
            history["temperature"].append(point.get("temperature"))
            history["humidity"].append(point.get("humidity"))
            history["pressure"].append(point.get("pressure"))

    return history

# ------------------------------------------------------------
# GET INDOOR VALUES
# ------------------------------------------------------------
def get_indoor_values():
    """Get current indoor sensor values"""
    
    flux = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -20m)
  |> filter(fn: (r) => r._measurement == "{MEASUREMENT_OUTDOOR}")
  |> filter(fn: (r) => 
       r._field == "temperature_indoor" or
       r._field == "humidity_indoor" or
       r._field == "pressure_indoor" or
       r._field == "eco2" or
       r._field == "tvoc")
  |> last()
'''

    data = {
        "temperature": None,
        "humidity": None,
        "pressure": None,
        "eco2": None,
        "tvoc": None,
        "dew_point": None,
        "timestamp": None
    }

    with _client() as client:
        q = client.query_api()
        tables = q.query(flux)

        for table in tables:
            for record in table.records:
                field = record["_field"]
                value = float(record["_value"])
                timestamp = record["_time"].isoformat()

                if field == "temperature_indoor":
                    # Validate: indoor temp should be 10-40°C
                    if 10 <= value <= 40:
                        data["temperature"] = round(value, 1)
                        data["timestamp"] = timestamp
                elif field == "humidity_indoor":
                    # Validate: humidity should be 0-100%
                    if 0 <= value <= 100:
                        data["humidity"] = round(value, 1)
                elif field == "pressure_indoor":
                    # Validate: pressure should be 900-1100 hPa
                    if 900 <= value <= 1100:
                        data["pressure"] = round(value, 1)
                elif field == "eco2":
                    # Validate: eCO2 should be 400-10000 ppm
                    if 400 <= value <= 10000:
                        data["eco2"] = round(value, 0)
                elif field == "tvoc":
                    # Validate: TVOC should be 0-5000 ppb
                    if 0 <= value <= 5000:
                        data["tvoc"] = round(value, 0)

        # Calculate dew point
        data["dew_point"] = _magnus_dewpoint(
            data["temperature"], data["humidity"]
        )

    # Air quality assessment
    warnings = []
    
    if data["eco2"] is not None:
        if data["eco2"] > 2000:
            warnings.append("high_co2")
        elif data["eco2"] > 1000:
            warnings.append("elevated_co2")
    
    if data["tvoc"] is not None:
        if data["tvoc"] > 500:
            warnings.append("high_tvoc")
        elif data["tvoc"] > 220:
            warnings.append("elevated_tvoc")
    
    if data["humidity"] is not None:
        if data["humidity"] >= 65:
            warnings.append("high_humidity")
        elif data["humidity"] <= 30:
            warnings.append("low_humidity")
    
    if data["temperature"] is not None and data["dew_point"] is not None:
        if (data["temperature"] - data["dew_point"]) <= 2:
            warnings.append("condensation_risk")
    
    data["air_quality_warnings"] = warnings
    
    return data


# ------------------------------------------------------------
# GET INDOOR 24H HISTORY
# ------------------------------------------------------------
def get_indoor_24h_history(days=1):
    """Get history for indoor sensors with configurable time range
    
    Args:
        days: Number of days to fetch (0.04 = 1 hour, 1 = 24h, 2 = 2 days, etc.)
    """
    
    # Calculate start time and aggregation window
    if days <= 1:
        # 24 hours or less: hourly aggregation
        window = "1h"
        start = f"-{int(days * 24)}h"
    elif days <= 4:
        # 2-4 days: 2-hour aggregation
        window = "2h"
        start = f"-{days}d"
    elif days <= 7:
        # 1 week: 4-hour aggregation
        window = "4h"
        start = f"-{days}d"
    else:
        # 1 month: 12-hour aggregation
        window = "12h"
        start = f"-{days}d"
    
    flux = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: {start})
  |> filter(fn: (r) => r._measurement == "{MEASUREMENT_OUTDOOR}")
  |> filter(fn: (r) => 
       r._field == "temperature_indoor" or
       r._field == "humidity_indoor" or
       r._field == "pressure_indoor" or
       r._field == "temperature" or
       r._field == "humidity" or
       r._field == "pressure" or
       r._field == "eco2" or
       r._field == "tvoc")
  |> aggregateWindow(every: {window}, fn: mean, createEmpty: false)
  |> sort(columns: ["_time"])
'''

    history = {
        "timestamps": [],
        "temperature": [],
        "humidity": [],
        "pressure": [],
        "eco2": [],
        "tvoc": []
    }

    with _client() as client:
        q = client.query_api()
        tables = q.query(flux)

        data_points = {}

        for table in tables:
            for r in table.records:
                # Use full datetime for sorting, but format for display
                timestamp = r["_time"]
                now = datetime.now(timezone.utc)
                
                # Format timestamp based on time range
                if days <= 1:
                    # 24h: show date for yesterday, time only for today
                    if timestamp.date() < now.date():
                        time_str = timestamp.strftime("%d %b %H:%M")
                    else:
                        time_str = timestamp.strftime("%H:%M")
                elif days <= 7:
                    # Up to 1 week: show date and time
                    time_str = timestamp.strftime("%d %b %H:%M")
                else:
                    # 1 month: show date only
                    time_str = timestamp.strftime("%d %b")
                
                # Use full timestamp as key to maintain uniqueness
                timestamp_key = timestamp.isoformat()
                field = r["_field"]
                value = float(r["_value"])

                if timestamp_key not in data_points:
                    data_points[timestamp_key] = {"display_time": time_str}
                
                # Support both old field names (temperature, humidity, pressure) 
                # and new field names (temperature_indoor, humidity_indoor, pressure_indoor)
                if field == "temperature_indoor" or field == "temperature":
                    data_points[timestamp_key]["temperature"] = round(value, 1)
                elif field == "humidity_indoor" or field == "humidity":
                    data_points[timestamp_key]["humidity"] = round(value, 1)
                elif field == "pressure_indoor" or field == "pressure":
                    data_points[timestamp_key]["pressure"] = round(value, 1)
                elif field == "eco2":
                    data_points[timestamp_key]["eco2"] = round(value, 0)
                elif field == "tvoc":
                    data_points[timestamp_key]["tvoc"] = round(value, 0)

        # Sort by timestamp key (ISO format) and convert to arrays
        sorted_keys = sorted(data_points.keys())
        
        for key in sorted_keys:
            point = data_points[key]
            history["timestamps"].append(point["display_time"])
            history["temperature"].append(point.get("temperature"))
            history["humidity"].append(point.get("humidity"))
            history["pressure"].append(point.get("pressure"))
            history["eco2"].append(point.get("eco2"))
            history["tvoc"].append(point.get("tvoc"))

    return history
