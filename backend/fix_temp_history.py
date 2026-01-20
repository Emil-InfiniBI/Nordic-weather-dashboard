#!/usr/bin/env python3
"""
Script to correct historical outdoor temperature data in InfluxDB.
Subtracts 2°C from all temperature_outdoor values recorded before a cutoff time.
Uses batched processing for large datasets.
"""

from datetime import datetime, timezone, timedelta
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
from config import INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET
import sys
import time

# Cutoff time - data BEFORE this will be corrected
# The jump happened at 10:11:49 UTC on 2026-01-02 (from -4.4C to -6.4C)
CUTOFF_TIME = "2026-01-02T10:11:36Z"
CORRECTION_OFFSET = -2.0

# Start from this date (for resuming)
START_FROM = sys.argv[1] if len(sys.argv) > 1 else "2025-12-04T11:35:44Z"

def apply_corrections_batched():
    """Process corrections in time-based batches"""
    
    print(f"Cutoff time: {CUTOFF_TIME}")
    print(f"Correction: {CORRECTION_OFFSET}°C")
    print(f"Starting from: {START_FROM}")
    
    # Parse times
    cutoff = datetime.fromisoformat(CUTOFF_TIME.replace('Z', '+00:00'))
    current_start = datetime.fromisoformat(START_FROM.replace('Z', '+00:00'))
    batch_delta = timedelta(hours=6)
    
    total_corrected = 0
    batch_num = 0
    
    client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
    query_api = client.query_api()
    write_api = client.write_api(write_options=SYNCHRONOUS)
    
    try:
        while current_start < cutoff:
            batch_num += 1
            current_end = min(current_start + batch_delta, cutoff)
            
            # Fetch batch
            flux = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: {current_start.isoformat()}, stop: {current_end.isoformat()})
  |> filter(fn: (r) => r._measurement == "mqtt_consumer")
  |> filter(fn: (r) => r._field == "temperature_outdoor")
'''
            tables = query_api.query(flux)
            
            points = []
            for table in tables:
                for record in table.records:
                    corrected = record.get_value() + CORRECTION_OFFSET
                    point = Point("mqtt_consumer") \
                        .field("temperature_outdoor", corrected) \
                        .time(record.get_time(), WritePrecision.NS)
                    points.append(point)
            
            if points:
                write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=points)
                total_corrected += len(points)
                print(f"  Batch {batch_num}: {current_start.strftime('%Y-%m-%d %H:%M')} - {len(points):,} points (total: {total_corrected:,})")
            
            current_start = current_end
            time.sleep(0.1)  # Small delay to avoid overwhelming the database
            
    except KeyboardInterrupt:
        print(f"\n\nInterrupted! To resume, run:")
        print(f"  python3 fix_temp_history.py {current_start.isoformat()}")
    finally:
        client.close()
    
    print(f"\n✅ Corrected {total_corrected:,} temperature readings!")

if __name__ == "__main__":
    print("=" * 60)
    print("TEMPERATURE CORRECTION SCRIPT")
    print("=" * 60)
    apply_corrections_batched()
