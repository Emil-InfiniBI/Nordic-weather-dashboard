#!/usr/bin/env python3
"""
Background notification checker for Weather Dashboard
Runs periodically to check thresholds and send push notifications
"""
import time
import json
import os
import sys
import requests
from datetime import datetime
from influx import get_current_values, get_indoor_values
from smhi import get_smhi_warnings

# Default notification settings
DEFAULT_SETTINGS = {
    "co2": {"enabled": False, "threshold": 800, "cooldown": 3600, "once": False},
    "auroraChance": {"enabled": False, "threshold": 30, "cooldown": 7200, "once": False},
    "kp": {"enabled": False, "threshold": 5, "cooldown": 10800, "once": False},
    "smhi": {"enabled": False, "severity": 1, "cooldown": 10800, "once": False},
    "lowHumidity": {"enabled": False, "threshold": 30, "cooldown": 7200, "once": False}
}

# Per-subscription notification tracking: { endpoint: { key: timestamp } }
last_notification_times = {}
BACKEND_URL = "http://localhost:5000"

def _subscriptions_path():
    return os.path.join(os.path.dirname(__file__), 'push_subscriptions.json')

def _load_subscriptions():
    path = _subscriptions_path()
    if not os.path.exists(path):
        return []
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except Exception:
        return []

def _save_subscriptions(data):
    path = _subscriptions_path()
    try:
        with open(path, 'w') as f:
            json.dump(data, f, indent=2)
        return True
    except Exception as e:
        print(f"✗ Failed to save subscriptions: {e}")
        return False

def _update_subscription_state(endpoint, key, once_flag=False, last_sent_ts=None):
    data = _load_subscriptions()
    updated = False
    for i, entry in enumerate(data):
        sub = entry.get('subscription', entry) if isinstance(entry, dict) else entry
        ep = sub.get('endpoint', '') if isinstance(sub, dict) else ''
        if ep == endpoint:
            if isinstance(entry, dict):
                state = entry.get('state', {})
                node = state.get(key, {})
                if last_sent_ts is not None:
                    node['lastSent'] = float(last_sent_ts)
                if once_flag:
                    node['once'] = True
                state[key] = node
                entry['state'] = state
                data[i] = entry
                updated = True
            else:
                # Convert old format to new with minimal state
                data[i] = {
                    'subscription': sub,
                    'settings': DEFAULT_SETTINGS,
                    'state': { key: { 'lastSent': float(last_sent_ts or time.time()), 'once': bool(once_flag) } }
                }
                updated = True
            break
    if updated:
        _save_subscriptions(data)

def can_notify(endpoint, key, cooldown_seconds, settings, state):
    """Decide whether to notify, respecting 'once' and cooldowns, and persist state"""
    now = time.time()
    # Respect one-time notifications
    if settings.get(key, {}).get('once'):
        if isinstance(state, dict) and state.get(key, {}).get('once'):
            return False
    
    if endpoint not in last_notification_times:
        last_notification_times[endpoint] = {}
    
    persisted_last = 0
    if isinstance(state, dict):
        persisted_last = float(state.get(key, {}).get('lastSent', 0) or 0)
    mem_last = float(last_notification_times[endpoint].get(key, 0) or 0)
    last_time = max(persisted_last, mem_last)
    
    if now - last_time >= float(cooldown_seconds or 0):
        last_notification_times[endpoint][key] = now
        # Persist lastSent; if once is enabled, mark once on send site
        _update_subscription_state(endpoint, key, once_flag=False, last_sent_ts=now)
        return True
    return False

def send_push_notification(title, body):
    """Send push notification via backend API"""
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/push/send",
            json={"title": title, "body": body},
            timeout=10
        )
        if response.status_code == 200:
            result = response.json()
            print(f"✓ Push sent: {title} - {result.get('sent', 0)} recipients")
            return True
        else:
            print(f"✗ Push failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Push error: {e}")
        return False

def load_user_settings():
    """Load notification settings + state per subscription"""
    data = _load_subscriptions()
    result = []
    try:
        for entry in data:
            if not isinstance(entry, dict):
                # Old format: subscription only
                sub = entry
                endpoint = sub.get('endpoint', '')
                settings = DEFAULT_SETTINGS.copy()
                state = {}
            else:
                sub = entry.get('subscription', {})
                endpoint = sub.get('endpoint', '')
                raw_settings = entry.get('settings', {})
                # Deep-merge defaults
                settings = json.loads(json.dumps(DEFAULT_SETTINGS))
                for k, v in raw_settings.items():
                    if isinstance(v, dict) and k in settings:
                        settings[k].update(v)
                    else:
                        settings[k] = v
                state = entry.get('state', {}) or {}
            result.append({ 'endpoint': endpoint, 'settings': settings, 'state': state })
        return result
    except Exception as e:
        print(f"✗ Error loading subscriptions: {e}")
        return []

def check_co2(endpoint, settings, state, indoor_data):
    """Check CO2 levels for a specific user"""
    if not settings["co2"]["enabled"]:
        return
    
    co2 = indoor_data.get("eco2") or indoor_data.get("co2") or 0
    threshold = settings["co2"]["threshold"]
    cooldown = settings["co2"].get("cooldown", 3600)
    
    if co2 >= threshold and can_notify(endpoint, "co2", cooldown, settings, state):
        send_push_notification(
            "High CO₂ Detected",
            f"Indoor CO₂ is {int(co2)} ppm (≥ {threshold} ppm). Open windows to ventilate."
        )
        if settings["co2"].get("once"):
            _update_subscription_state(endpoint, "co2", once_flag=True, last_sent_ts=time.time())

def check_aurora(endpoint, settings, state, aurora_data):
    """Check aurora probability for a specific user"""
    if not settings["auroraChance"]["enabled"]:
        return
    
    chance = aurora_data.get("probability", 0)
    threshold = settings["auroraChance"]["threshold"]
    cooldown = settings["auroraChance"].get("cooldown", 7200)
    
    if chance >= threshold and can_notify(endpoint, "auroraChance", cooldown, settings, state):
        send_push_notification(
            "Aurora Opportunity!",
            f"Aurora chance is {int(chance)}% (≥ {threshold}%). Good viewing conditions!"
        )
        if settings["auroraChance"].get("once"):
            _update_subscription_state(endpoint, "auroraChance", once_flag=True, last_sent_ts=time.time())

def check_kp(endpoint, settings, state, aurora_data):
    """Check KP index for a specific user"""
    if not settings["kp"]["enabled"]:
        return
    
    kp = aurora_data.get("kp_index") or aurora_data.get("kp") or 0
    threshold = settings["kp"]["threshold"]
    cooldown = settings["kp"].get("cooldown", 10800)
    
    if kp >= threshold and can_notify(endpoint, "kp", cooldown, settings, state):
        send_push_notification(
            "High KP Index",
            f"KP index is {kp} (≥ {threshold}). Increased aurora activity expected."
        )
        if settings["kp"].get("once"):
            _update_subscription_state(endpoint, "kp", once_flag=True, last_sent_ts=time.time())

def check_smhi(endpoint, settings, state):
    """Check SMHI warnings for a specific user"""
    if not settings["smhi"]["enabled"]:
        return
    
    try:
        smhi_data = get_smhi_warnings()
        warnings = smhi_data.get("warnings", [])
        min_severity = int(settings["smhi"].get("severity", 1))
        cooldown = settings["smhi"].get("cooldown", 10800)
        
        severe_warnings = [w for w in warnings if int(w.get("severity", 1)) >= min_severity]
        
        if severe_warnings and can_notify(endpoint, "smhi", cooldown, settings, state):
            w = severe_warnings[0]
            send_push_notification(
                "SMHI Weather Warning",
                f"{w.get('event', 'Weather alert')}: {w.get('description', w.get('headline', ''))} from {w.get('area', 'Dalarna')}"
            )
            if settings["smhi"].get("once"):
                _update_subscription_state(endpoint, "smhi", once_flag=True, last_sent_ts=time.time())
    except Exception as e:
        print(f"SMHI check error: {e}")

def check_humidity(endpoint, settings, state, indoor_data):
    """Check low humidity for a specific user"""
    if not settings["lowHumidity"]["enabled"]:
        return
    
    humidity = indoor_data.get("humidity", 0)
    threshold = settings["lowHumidity"]["threshold"]
    cooldown = settings["lowHumidity"].get("cooldown", 7200)
    
    if humidity > 0 and humidity <= threshold and can_notify(endpoint, "lowHumidity", cooldown, settings, state):
        send_push_notification(
            "Low Indoor Humidity",
            f"Indoor humidity is {int(humidity)}% (≤ {threshold}%). Consider using a humidifier."
        )
        if settings["lowHumidity"].get("once"):
            _update_subscription_state(endpoint, "lowHumidity", once_flag=True, last_sent_ts=time.time())

def check_all():
    """Run all checks for all subscribed users"""
    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Running notification checks...")
    
    try:
        # Load all user subscriptions with their settings
        user_subscriptions = load_user_settings()
        
        if not user_subscriptions:
            print("No subscriptions found")
            return
        
        print(f"Checking notifications for {len(user_subscriptions)} subscription(s)")
        
        # Get current data once for all users
        outdoor_data = get_current_values()
        indoor_data = get_indoor_values()
        
        # Fetch aurora data from backend
        try:
            aurora_response = requests.get(f"{BACKEND_URL}/api/aurora", timeout=10)
            aurora_data = aurora_response.json() if aurora_response.status_code == 200 else {}
        except:
            aurora_data = {}
        
        # Check each user's notifications based on their settings
        for user in user_subscriptions:
            endpoint = user['endpoint']
            settings = user['settings']
            state = user.get('state', {})
            
            # Run checks for this user
            check_co2(endpoint, settings, state, indoor_data)
            check_aurora(endpoint, settings, state, aurora_data)
            check_kp(endpoint, settings, state, aurora_data)
            check_smhi(endpoint, settings, state)
            check_humidity(endpoint, settings, state, indoor_data)
        
        print("✓ Checks complete")
        
    except Exception as e:
        print(f"✗ Check failed: {e}")
        import traceback
        traceback.print_exc()

def main():
    """Main loop - check every 5 minutes"""
    print("=" * 60)
    print("Weather Dashboard - Background Notification Checker")
    print("=" * 60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("Checking every 5 minutes...")
    print("Press Ctrl+C to stop")
    print("=" * 60)
    
    while True:
        try:
            check_all()
            time.sleep(300)  # 5 minutes
        except KeyboardInterrupt:
            print("\n\nStopping notification checker...")
            sys.exit(0)
        except Exception as e:
            print(f"Unexpected error: {e}")
            time.sleep(60)  # Wait 1 minute before retry

if __name__ == "__main__":
    main()
