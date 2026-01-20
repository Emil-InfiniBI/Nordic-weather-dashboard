"""
Web Push Handler - Wrapper for pywebpush with proper key handling
"""
import json
import base64
import sys
from pywebpush import webpush, WebPushException
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

def log(msg):
    """Print to stdout so Flask logs it"""
    print(msg, file=sys.stdout, flush=True)

def load_vapid_private_key(key_path):
    """Load VAPID private key from PEM file"""
    log(f"Loading VAPID key from {key_path}")
    with open(key_path, 'rb') as f:
        key_data = f.read()
    
    # Load the private key
    private_key = serialization.load_pem_private_key(
        key_data,
        password=None,
        backend=default_backend()
    )
    
    # Extract the raw private key bytes (for EC P-256)
    private_numbers = private_key.private_numbers()
    d_bytes = private_numbers.private_value.to_bytes(32, byteorder='big')
    
    log(f"VAPID key loaded successfully")
    return d_bytes

def send_web_push(subscription_info, title, body, private_key_path, vapid_subject):
    """Send web push notification with proper key handling"""
    try:
        log(f"Sending push: {title}")
        endpoint = subscription_info.get('endpoint', '')
        log(f"  Endpoint: {endpoint[:80]}...")
        
        # Convert private key bytes to URL-safe base64
        private_key_bytes = load_vapid_private_key(private_key_path)
        private_key_b64 = base64.urlsafe_b64encode(private_key_bytes).decode().rstrip('=')
        
        # Extract audience from endpoint URL
        try:
            from urllib.parse import urlparse
            parsed = urlparse(endpoint)
            aud = f"{parsed.scheme}://{parsed.netloc}"
        except:
            aud = "https://fcm.googleapis.com"
        
        log(f"  Audience: {aud}")
        
        # Prepare notification payload
        notification_data = json.dumps({
            "title": title,
            "body": body,
            "icon": "/icon-192.png"
        })
        
        log(f"  Payload: {notification_data}")
        
        # Send push notification
        webpush(
            subscription_info=subscription_info,
            data=notification_data,
            vapid_private_key=private_key_b64,
            vapid_claims={
                "sub": vapid_subject,
                "aud": aud
            }
        )
        
        log(f"✓ Push sent successfully")
        return True, "Push sent successfully"
    except WebPushException as e:
        log(f"✗ WebPushException: {e}")
        if e.response and e.response.status_code == 410:
            return False, "Subscription expired (410)"
        return False, f"Push failed: {str(e)}"
    except Exception as e:
        log(f"✗ Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False, f"Error: {str(e)}"

