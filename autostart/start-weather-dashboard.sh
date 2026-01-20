#!/bin/bash

# Wait for network to be ready
sleep 10

# Start Flask backend
cd /home/admin/weather-cinematic-dashboard/backend
source ../venv/bin/activate
python app.py &

# Wait for Flask to start
sleep 5

# Hide mouse cursor after 1 second of inactivity
DISPLAY=:0 unclutter -idle 1 &

# Start Chromium in kiosk mode (fullscreen) with 85% zoom
# Added flags to disable caching and ensure fresh content on each reload
DISPLAY=:0 chromium --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --disable-restore-session-state --force-device-scale-factor=0.85 --password-store=basic --disable-application-cache --disable-cache --disk-cache-size=1 --media-cache-size=1 http://localhost:5000 &
