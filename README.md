# Weather Cinematic Dashboard

A beautiful, cinematic weather dashboard for Raspberry Pi with real-time sensor data, SMHI forecasts, and aurora borealis predictions.

![Weather Dashboard](docs/screenshot.png)

## 🌐 Live Demo

**GitHub Pages**: [https://emil-infinibi.github.io/Nordic-weather-dashboard/](https://emil-infinibi.github.io/Nordic-weather-dashboard/)

The frontend is hosted on GitHub Pages and connects to the backend API via Cloudflare Tunnel.

## Features

- 🌡️ **Real-time sensor data** from indoor and outdoor sensors via InfluxDB
- 🌦️ **SMHI Weather Forecasts** with 24-hour timeline
- 🌌 **Aurora Borealis Predictions** using NOAA OVATION model and space weather data
- ⚠️ **Weather Warnings** from SMHI with expandable details
- 🎬 **Cinematic Effects** - dynamic rain, snow, and fog animations based on weather
- 📱 **PWA Support** - installable on mobile devices
- 🔔 **Push Notifications** for weather alerts and aurora activity
- 📊 **Analytics** with historical data charts
- 🌙 **Day/Night Mode** with automatic background changes

## Tech Stack

- **Backend**: Python Flask
- **Database**: InfluxDB 2.x
- **Frontend**: Vanilla JavaScript with ES6 modules
- **Charts**: Chart.js
- **Animations**: CSS + Canvas 2D
- **Weather Data**: SMHI Open API
- **Aurora Data**: NOAA SWPC APIs

## Installation

### Prerequisites

- Python 3.8+
- InfluxDB 2.x server
- Raspberry Pi (or any Linux server)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/Emil-InfiniBI/nordic-weather-dashboard.git
cd nordic-weather-dashboard
```

2. Install Python dependencies:
```bash
pip install flask influxdb-client requests
```

3. Create configuration file:
```bash
cp backend/config.example.py backend/config.py
# Edit config.py with your InfluxDB credentials and settings
```

4. Run the server:
```bash
cd backend
python app.py
```

5. Access the dashboard at `http://localhost:5000`

## Configuration

Create `backend/config.py` with your settings:

```python
# InfluxDB Configuration
INFLUX_URL = "http://your-influxdb-server:8086"
INFLUX_TOKEN = "your-token"
INFLUX_ORG = "your-org"
INFLUX_BUCKET = "your-bucket"

# Location for weather data
LATITUDE = 60.1234
LONGITUDE = 15.1234

# Sensor field names
FIELD_TEMP = "temperature_outdoor"
FIELD_HUMIDITY = "humidity_outdoor"
```

## API Endpoints

- `GET /api/current` - Current outdoor sensor data
- `GET /api/indoor` - Current indoor sensor data
- `GET /api/forecast` - SMHI weather forecast
- `GET /api/smhi` - Extended SMHI data with warnings
- `GET /api/aurora` - Aurora probability and space weather

## Project Structure

```
weather-cinematic-dashboard/
├── backend/
│   ├── app.py              # Flask server
│   ├── config.py           # Configuration (not in repo)
│   ├── influx.py           # InfluxDB queries
│   ├── smhi.py             # SMHI API integration
│   └── static/             # Source files
│       ├── index.html      # Main HTML
│       ├── app.js          # Main JavaScript
│       └── styles.css      # Main styles
├── docs/                   # GitHub Pages deployment
│   └── (same as static/)
├── autostart/
│   └── start-weather-dashboard.sh
└── README.md
```

## GitHub Pages Deployment

The dashboard is hosted on GitHub Pages with the backend running on a Raspberry Pi:

1. **Frontend** (GitHub Pages): Static files in `/docs` folder
2. **Backend** (Raspberry Pi): Flask API accessible via Cloudflare Tunnel

### Updating Cloudflare Tunnel URL

If your Cloudflare tunnel URL changes, update it in `docs/app.js`:

```javascript
const API = "https://your-new-tunnel-url.trycloudflare.com";
```

Then commit and push the changes to update GitHub Pages.

### Enable GitHub Pages

1. Go to your repository settings
2. Navigate to "Pages" section
3. Set source to "Deploy from a branch"
4. Select branch: `main`, folder: `/docs`
5. Save and wait for deployment

Your site will be available at: `https://emil-infinibi.github.io/Nordic-weather-dashboard/`

## Screenshots

### Overview
The main dashboard showing current weather, temperature, and quick stats.

### Aurora Card
Real-time aurora probability based on solar wind, Bz component, and local visibility.

### Weather Animations
Dynamic snow, rain, and fog effects based on current conditions.

## License

MIT License - feel free to use and modify for your own projects!

## Credits

Created by Emil Dybeck

Weather data provided by [SMHI](https://www.smhi.se/)
Aurora data provided by [NOAA SWPC](https://www.swpc.noaa.gov/)
