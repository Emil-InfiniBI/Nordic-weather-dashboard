# Web Push Configuration
VAPID_PUBLIC_KEY = "BB9CB6E6gY-x8iMC6EwD1fgJT97pUI9kXktQJOD6OwAseLlROf_i8LDq7rcxfvsOX3FBB-2Vp2A1VpDBw7_ats8"
VAPID_PRIVATE_KEY_PATH = "private_key.pem"
VAPID_CLAIMS = {
    "sub": "mailto:admin@weather-dashboard.local"
}

# Push subscriptions storage (in production, use a database)
SUBSCRIPTIONS_FILE = "push_subscriptions.json"
