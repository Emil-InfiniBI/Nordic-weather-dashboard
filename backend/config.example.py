# Example configuration - copy to config.py and fill in your values

# InfluxDB Configuration
INFLUX_URL = "http://localhost:8086"
INFLUX_TOKEN = "your-influxdb-token-here"
INFLUX_ORG = "your-org"
INFLUX_BUCKET = "your-bucket"

# Location for weather data (Ludvika, Sweden example)
LATITUDE = 60.1495
LONGITUDE = 15.1870

# Sensor field names in InfluxDB
FIELD_TEMP = "temperature_outdoor"
FIELD_HUMIDITY = "humidity_outdoor"
FIELD_PRESSURE = "pressure"
FIELD_DEW_POINT = "dew_point"

# Indoor sensor fields
FIELD_TEMP_INDOOR = "temperature"
FIELD_HUMIDITY_INDOOR = "humidity"
FIELD_CO2 = "eco2"
FIELD_TVOC = "tvoc"
