from flask import Flask, jsonify, send_from_directory, make_response, request
from flask_cors import CORS
import os
import json
from influx import get_current_values, get_minmax_24h, get_24h_history, get_indoor_values, get_indoor_24h_history
from smhi import get_smhi_warnings, get_sun_times, get_smhi_forecast, get_smhi_timeseries
from config import BACKEND_HOST, BACKEND_PORT
from push_config import VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY_PATH, VAPID_CLAIMS, SUBSCRIPTIONS_FILE
from push_handler import send_web_push

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = Flask(
    __name__,
    static_folder=STATIC_DIR,      # <-- Serve index.html, CSS, JS from here
    static_url_path=""             # <-- Makes /styles.css reachable
)

CORS(app)

# Add cache control headers to prevent aggressive browser caching
@app.after_request
def add_header(response):
    # Prevent caching of all responses to ensure fresh content
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

# ---------------------------------------------
# Serve index.html
# ---------------------------------------------
@app.route("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")

# ---------------------------------------------
# PWA FILES
# ---------------------------------------------
@app.route("/manifest.json")
def manifest():
    response = make_response(send_from_directory(STATIC_DIR, "manifest.json"))
    response.headers['Content-Type'] = 'application/manifest+json'
    return response

@app.route("/service-worker.js")
def service_worker():
    response = make_response(send_from_directory(STATIC_DIR, "service-worker.js"))
    response.headers['Content-Type'] = 'application/javascript'
    response.headers['Service-Worker-Allowed'] = '/'
    return response

# ---------------------------------------------
# API ENDPOINTS
# ---------------------------------------------
@app.route("/api/current")
def api_current():
    return jsonify(get_current_values())

@app.route("/api/minmax")
def api_minmax():
    return jsonify(get_minmax_24h())

@app.route("/api/smhi")
def api_smhi():
    return jsonify(get_smhi_warnings())

@app.route("/api/sun")
def api_sun():
    return jsonify(get_sun_times())

@app.route("/api/forecast")
def api_forecast():
    return jsonify(get_smhi_forecast())

@app.route("/api/forecast-24h")
def api_forecast_24h():
    # Return simplified SMHI time series (24 entries)
    return jsonify(get_smhi_timeseries(limit=24))

@app.route("/api/history")
def api_history():
    from flask import request
    # Get range parameter (default to 1 day)
    range_param = request.args.get('range', '24h')
    
    # Convert range to days
    range_map = {
        '24h': 1,
        '2d': 2,
        '4d': 4,
        '1w': 7,
        '1m': 30
    }
    
    days = range_map.get(range_param, 1)
    return jsonify(get_24h_history(days))

@app.route("/api/indoor")
def api_indoor():
    return jsonify(get_indoor_values())

@app.route("/api/indoor-history")
def api_indoor_history():
    from flask import request
    # Get range parameter (default to 1 day)
    range_param = request.args.get('range', '24h')
    
    # Convert range to days
    range_map = {
        '24h': 1,
        '2d': 2,
        '4d': 4,
        '1w': 7,
        '1m': 30
    }
    
    days = range_map.get(range_param, 1)
    return jsonify(get_indoor_24h_history(days))

@app.route("/api/aurora")
def api_aurora():
    import requests
    import math
    try:
        # Check if it's daylight - aurora cannot be seen during daytime
        sun_times = get_sun_times()
        is_daylight = not sun_times.get('is_night', True)  # If not night, it's daylight
        
        # Fetch NOAA OVATION aurora forecast (updates every ~15 minutes)
        ovation_response = requests.get('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json', timeout=10)
        ovation_data = ovation_response.json()
        
        # Find aurora probability for Ludvika (60.1°N, 15.2°E)
        target_lat, target_lon = 60.1, 15.2
        ovation_probability = 0
        ovation_forecast_time = ovation_data.get('Forecast Time', '')
        
        # Find closest coordinate in OVATION model
        if 'coordinates' in ovation_data:
            closest = min(ovation_data['coordinates'], key=lambda c: abs(c[0]-target_lat) + abs(c[1]-target_lon))
            ovation_probability = closest[2]  # Aurora probability percentage
        
        # Fetch NOAA space weather data
        response = requests.get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', timeout=10)
        kp_data = response.json()
        
        # Get latest KP index (last entry in the data)
        if len(kp_data) > 1:
            latest = kp_data[-1]
            kp_index = float(latest[1])
        else:
            kp_index = 0
        
        # Fetch solar wind magnetic field data
        mag_response = requests.get('https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json', timeout=10)
        mag_data = mag_response.json()
        
        # Fetch solar wind plasma data (speed and density)
        plasma_response = requests.get('https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json', timeout=10)
        plasma_data = plasma_response.json()
        
        solar_wind_speed = 0
        bz_component = 0
        bt_component = 0
        density = 0
        
        # Get Bz and Bt from magnetic field data
        # Format: ['time_tag', 'bx_gsm', 'by_gsm', 'bz_gsm', 'lon_gsm', 'lat_gsm', 'bt']
        if len(mag_data) > 1:
            latest_mag = mag_data[-1]
            try:
                bz_component = float(latest_mag[3]) if len(latest_mag) > 3 else 0  # bz_gsm
                bt_component = float(latest_mag[6]) if len(latest_mag) > 6 else 0  # bt
            except (ValueError, IndexError):
                pass
        
        # Get speed and density from plasma data
        # Format: ['time_tag', 'density', 'speed', 'temperature']
        if len(plasma_data) > 1:
            latest_plasma = plasma_data[-1]
            try:
                density = float(latest_plasma[1]) if len(latest_plasma) > 1 else 0      # density
                solar_wind_speed = float(latest_plasma[2]) if len(latest_plasma) > 2 else 0  # speed
            except (ValueError, IndexError):
                pass
        
        # Get current weather conditions from SMHI
        smhi_response = requests.get('https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/15.1883/lat/60.1496/data.json', timeout=10)
        smhi_data = smhi_response.json()
        
        cloud_coverage = 0
        visibility_km = 10
        precipitation = 0
        
        if smhi_data and 'timeSeries' in smhi_data and len(smhi_data['timeSeries']) > 0:
            current_forecast = smhi_data['timeSeries'][0]
            for param in current_forecast.get('parameters', []):
                if param['name'] == 'tcc_mean':  # Total cloud cover (0-8 oktas)
                    cloud_coverage = param['values'][0]
                elif param['name'] == 'vis':  # Visibility in km
                    visibility_km = param['values'][0]
                elif param['name'] == 'pcat':  # Precipitation category
                    precipitation = param['values'][0]
        
        # ADVANCED AURORA VISIBILITY CALCULATION
        # Ludvika coordinates: 60.1°N, 15.2°E
        # Magnetic latitude approximately 57-58°N
        
        # 1. Base probability from KP index (adjusted for magnetic latitude ~57°N)
        if kp_index < 1:
            base_prob = 5
        elif kp_index < 2:
            base_prob = 10 + (kp_index - 1) * 10
        elif kp_index < 3:
            base_prob = 20 + (kp_index - 2) * 10
        elif kp_index < 4:
            base_prob = 30 + (kp_index - 3) * 15
        elif kp_index < 5:
            base_prob = 45 + (kp_index - 4) * 15
        elif kp_index < 6:
            base_prob = 60 + (kp_index - 5) * 15
        elif kp_index < 7:
            base_prob = 75 + (kp_index - 6) * 10
        else:
            base_prob = min(98, 85 + (kp_index - 7) * 5)
        
        # 2. Bz component factor (southward Bz greatly increases probability)
        bz_factor = 1.0
        if bz_component < -5:
            bz_factor = 1.4  # Strong southward, excellent
        elif bz_component < -3:
            bz_factor = 1.3
        elif bz_component < -1:
            bz_factor = 1.15
        elif bz_component < 0:
            bz_factor = 1.05
        elif bz_component > 3:
            bz_factor = 0.7  # Northward, suppresses aurora
        elif bz_component > 0:
            bz_factor = 0.85
        
        # 3. Solar wind speed factor (faster = more energy)
        speed_factor = 1.0
        if solar_wind_speed > 600:
            speed_factor = 1.35  # Very fast, CME likely
        elif solar_wind_speed > 500:
            speed_factor = 1.2
        elif solar_wind_speed > 450:
            speed_factor = 1.1
        elif solar_wind_speed > 400:
            speed_factor = 1.05
        elif solar_wind_speed < 300:
            speed_factor = 0.85  # Slow, less energy
        
        # 4. Calculate dynamic pressure (indicates shock strength)
        # P = ρ * v^2 (where ρ is density, v is speed)
        dynamic_pressure = density * (solar_wind_speed ** 2) / 100000
        pressure_factor = 1.0
        if dynamic_pressure > 8:
            pressure_factor = 1.15  # Strong compression
        elif dynamic_pressure > 5:
            pressure_factor = 1.08
        elif dynamic_pressure < 2:
            pressure_factor = 0.95
        
        # 5. Calculate geomagnetic probability
        geomagnetic_prob = base_prob * bz_factor * speed_factor * pressure_factor
        geomagnetic_prob = min(99, max(0, geomagnetic_prob))
        
        # 6. Weather visibility factor (clear skies needed!)
        weather_factor = 1.0
        weather_condition = "Unknown"
        
        # Check cloud coverage (0-8 oktas, where 8 = completely overcast)
        if cloud_coverage <= 1:
            weather_factor = 1.0
            weather_condition = "Clear skies"
        elif cloud_coverage <= 3:
            weather_factor = 0.85
            weather_condition = "Mostly clear"
        elif cloud_coverage <= 5:
            weather_factor = 0.5
            weather_condition = "Partly cloudy"
        elif cloud_coverage <= 7:
            weather_factor = 0.2
            weather_condition = "Mostly cloudy"
        else:
            weather_factor = 0.05
            weather_condition = "Overcast"
        
        # Check visibility (fog, precipitation)
        if visibility_km < 1:
            weather_factor *= 0.1
            weather_condition = "Fog/poor visibility"
        elif visibility_km < 5:
            weather_factor *= 0.5
        
        if precipitation > 0:  # Any precipitation
            weather_factor *= 0.3
            if precipitation == 1:
                weather_condition = "Snow"
            elif precipitation == 2:
                weather_condition = "Snow/sleet mix"
            elif precipitation == 3:
                weather_condition = "Sleet"
            elif precipitation == 4:
                weather_condition = "Drizzle"
            elif precipitation == 5:
                weather_condition = "Rain"
            elif precipitation == 6:
                weather_condition = "Heavy rain"
        
        # Apply daylight factor (aurora cannot be seen during daytime)
        if is_daylight:
            weather_factor = 0.0
            weather_condition = "Daylight (aurora not visible)"
        
        # 7. Final probability combining space weather and local weather
        final_probability = geomagnetic_prob * weather_factor
        final_probability = round(min(99, max(0, final_probability)), 0)
        
        # Determine activity level
        if kp_index < 3:
            activity = "Quiet"
        elif kp_index < 5:
            activity = "Unsettled"
        elif kp_index < 7:
            activity = "Active"
        else:
            activity = "Storm"
        
        # KP description
        if kp_index < 2:
            description = "Very Low Activity"
        elif kp_index < 3:
            description = "Low Activity"
        elif kp_index < 4:
            description = "Minor Storm"
        elif kp_index < 5:
            description = "Moderate Storm"
        elif kp_index < 6:
            description = "Strong Storm"
        elif kp_index < 7:
            description = "Severe Storm"
        else:
            description = "Extreme Storm"
        
        return jsonify({
            'kp_index': round(kp_index, 1),
            'description': description,
            'probability': final_probability,
            'ovation_probability': round(ovation_probability, 0),
            'ovation_forecast_time': ovation_forecast_time,
            'geomagnetic_probability': round(geomagnetic_prob, 0),
            'weather_factor': round(weather_factor * 100, 0),
            'weather_condition': weather_condition,
            'activity': activity,
            'solar_wind_speed': round(solar_wind_speed, 0),
            'bz_component': round(bz_component, 1),
            'cloud_coverage': cloud_coverage,
            'visibility_km': round(visibility_km, 1),
            'dynamic_pressure': round(dynamic_pressure, 2)
        })
    except Exception as e:
        print(f"Error fetching aurora data: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'kp_index': 0,
            'description': 'Data Unavailable',
            'probability': 0,
            'ovation_probability': 0,
            'ovation_forecast_time': '',
            'geomagnetic_probability': 0,
            'weather_factor': 0,
            'weather_condition': 'Unknown',
            'activity': 'Unknown',
            'solar_wind_speed': 0,
            'bz_component': 0,
            'cloud_coverage': 0,
            'visibility_km': 0,
            'dynamic_pressure': 0
        })

# ---------------------------------------------
# WEB PUSH ENDPOINTS
# ---------------------------------------------
@app.route("/api/push/vapid-public-key", methods=["GET"])
def get_vapid_public_key():
    """Return VAPID public key for push subscription"""
    return jsonify({"publicKey": VAPID_PUBLIC_KEY})

@app.route("/api/push/subscribe", methods=["POST"])
def push_subscribe():
    """Save push subscription with notification settings"""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        subscription = data.get('subscription')
        settings = data.get('settings', {})
        
        if not subscription:
            return jsonify({"error": "No subscription data"}), 400
        
        # Load existing subscriptions
        subscriptions = []
        if os.path.exists(SUBSCRIPTIONS_FILE):
            with open(SUBSCRIPTIONS_FILE, 'r') as f:
                subscriptions = json.load(f)
        
        # Check if subscription already exists (by endpoint)
        endpoint = subscription.get('endpoint')
        existing_idx = None
        for idx, sub in enumerate(subscriptions):
            if sub.get('subscription', {}).get('endpoint') == endpoint:
                existing_idx = idx
                break
        
        # Create subscription entry with settings
        entry = {
            'subscription': subscription,
            'settings': settings
        }
        
        if existing_idx is not None:
            # Update existing subscription with new settings
            subscriptions[existing_idx] = entry
        else:
            # Add new subscription
            subscriptions.append(entry)
            
        # Save updated subscriptions
        with open(SUBSCRIPTIONS_FILE, 'w') as f:
            json.dump(subscriptions, f, indent=2)
        
        return jsonify({"success": True, "message": "Subscription saved"})
    except Exception as e:
        print(f"Error saving subscription: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/push/subscriptions", methods=["GET"])
def push_list_subscriptions():
    """List all active push subscriptions with their settings"""
    try:
        if not os.path.exists(SUBSCRIPTIONS_FILE):
            return jsonify({"subscriptions": []})
        
        with open(SUBSCRIPTIONS_FILE, 'r') as f:
            subscriptions = json.load(f)
        
        # Create simplified list with subscription info and settings
        subscription_list = []
        for i, entry in enumerate(subscriptions):
            subscription = entry.get('subscription', entry) if isinstance(entry, dict) else entry
            settings = entry.get('settings', {}) if isinstance(entry, dict) else {}
            
            # Count enabled notifications and include "once" info
            enabled_count = 0
            enabled_types = []
            for setting_key, setting_value in settings.items():
                if isinstance(setting_value, dict) and setting_value.get('enabled'):
                    enabled_count += 1
                    # Add "once" indicator if applicable
                    if setting_value.get('once'):
                        enabled_types.append(f"{setting_key} (once)")
                    else:
                        enabled_types.append(setting_key)
            
            # Generate a friendly device name from endpoint
            endpoint = subscription.get('endpoint', '')
            device_name = f"Device {i+1}"
            if 'fcm.googleapis.com' in endpoint:
                device_name = f"Android Device {i+1}"
            elif 'push.mozilla.org' in endpoint:
                device_name = f"Firefox Device {i+1}"
            elif 'push.apple.com' in endpoint:
                device_name = f"Safari Device {i+1}"
            elif 'wns.windows.com' in endpoint:
                device_name = f"Edge Device {i+1}"
            
            subscription_list.append({
                "id": i,
                "device_name": device_name,
                "endpoint_preview": subscription.get('endpoint', '')[-50:] if subscription.get('endpoint') else 'unknown',
                "enabled_notifications": enabled_count,
                "notification_types": enabled_types,
                "settings": settings
            })
        
        return jsonify({"subscriptions": subscription_list})
    except Exception as e:
        print(f"Error listing subscriptions: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/push/subscriptions/<int:subscription_id>", methods=["DELETE"])
def push_delete_subscription(subscription_id):
    """Delete a specific push subscription"""
    try:
        if not os.path.exists(SUBSCRIPTIONS_FILE):
            return jsonify({"error": "No subscriptions found"}), 404
        
        with open(SUBSCRIPTIONS_FILE, 'r') as f:
            subscriptions = json.load(f)
        
        if subscription_id >= len(subscriptions) or subscription_id < 0:
            return jsonify({"error": "Subscription not found"}), 404
        
        # Remove the subscription
        removed_subscription = subscriptions.pop(subscription_id)
        
        # Save updated list
        with open(SUBSCRIPTIONS_FILE, 'w') as f:
            json.dump(subscriptions, f, indent=2)
        
        return jsonify({
            "success": True, 
            "message": f"Subscription deleted successfully",
            "remaining_count": len(subscriptions)
        })
    except Exception as e:
        print(f"Error deleting subscription: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/push/send", methods=["POST"])
def push_send():
    """Send push notification to all subscribers"""
    try:
        data = request.json
        title = data.get('title', 'Weather Alert')
        body = data.get('body', 'Check your dashboard')
        
        if not os.path.exists(SUBSCRIPTIONS_FILE):
            return jsonify({"error": "No subscriptions"}), 404
        
        with open(SUBSCRIPTIONS_FILE, 'r') as f:
            subscriptions = json.load(f)
        
        sent_count = 0
        failed_endpoints = []
        
        for entry in subscriptions:
            # Support both old format (just subscription) and new format (with settings)
            subscription = entry.get('subscription', entry) if isinstance(entry, dict) else entry
            
            try:
                success, message = send_web_push(
                    subscription_info=subscription,
                    title=title,
                    body=body,
                    private_key_path=VAPID_PRIVATE_KEY_PATH,
                    vapid_subject=VAPID_CLAIMS["sub"]
                )
                
                if success:
                    sent_count += 1
                    print(f"✓ Push sent: {title}")
                else:
                    print(f"✗ {message}")
                    if "expired" in message.lower():
                        failed_endpoints.append(subscription.get('endpoint'))
            except Exception as e:
                print(f"Push failed for {subscription.get('endpoint')}: {e}")
        
        # Remove expired subscriptions
        if failed_endpoints:
            subscriptions = [s for s in subscriptions if s.get('endpoint') not in failed_endpoints]
            with open(SUBSCRIPTIONS_FILE, 'w') as f:
                json.dump(subscriptions, f, indent=2)
        
        return jsonify({
            "success": True,
            "sent": sent_count,
            "failed": len(failed_endpoints)
        })
    except Exception as e:
        print(f"Error sending push: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host=BACKEND_HOST, port=BACKEND_PORT, debug=False)
