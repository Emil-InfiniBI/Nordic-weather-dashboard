# Advanced Aurora Visibility Algorithm

## Overview
This algorithm calculates the probability of seeing Northern Lights in Ludvika, Sweden (60.1°N, 15.2°E) by combining **space weather conditions** with **local weather conditions**.

## Formula
```
Final Probability = Geomagnetic Probability × Weather Factor
```

---

## 1. Geomagnetic Probability (Space Weather)

### Base Probability from KP Index
The KP index measures global geomagnetic activity on a scale of 0-9. For Ludvika's magnetic latitude (~57-58°N):

| KP Range | Base Probability | Description |
|----------|------------------|-------------|
| 0-1 | 5-15% | Very Low Activity |
| 1-2 | 15-20% | Low Activity |
| 2-3 | 20-30% | Low Activity |
| 3-4 | 30-45% | Minor Storm |
| 4-5 | 45-60% | Moderate Storm |
| 5-6 | 60-75% | Strong Storm |
| 6-7 | 75-85% | Severe Storm |
| 7-9 | 85-98% | Extreme Storm |

### Bz Component Factor
The **Bz component** of the interplanetary magnetic field (IMF) is critical:
- **Southward (negative)** Bz couples efficiently with Earth's magnetic field → aurora enhancement
- **Northward (positive)** Bz prevents coupling → aurora suppression

| Bz Value (nT) | Factor | Effect |
|---------------|--------|--------|
| < -5 | ×1.4 | Strong southward - Excellent |
| -5 to -3 | ×1.3 | Moderate southward - Very Good |
| -3 to -1 | ×1.15 | Weak southward - Good |
| -1 to 0 | ×1.05 | Slightly southward - Fair |
| 0 to +3 | ×0.85 | Northward - Reduced |
| > +3 | ×0.7 | Strong northward - Suppressed |

### Solar Wind Speed Factor
Higher solar wind speed delivers more energy to the magnetosphere:

| Speed (km/s) | Factor | Condition |
|--------------|--------|-----------|
| > 600 | ×1.35 | Very fast (likely CME) |
| 500-600 | ×1.2 | Fast stream |
| 450-500 | ×1.1 | Above average |
| 400-450 | ×1.05 | Slightly elevated |
| 300-400 | ×1.0 | Normal |
| < 300 | ×0.85 | Slow |

### Dynamic Pressure Factor
Dynamic pressure indicates solar wind shock strength:
```
P_dyn = ρ × v² / 100000
```
Where:
- ρ = particle density (particles/cm³)
- v = solar wind speed (km/s)

| Pressure (nPa) | Factor | Effect |
|----------------|--------|--------|
| > 8 | ×1.15 | Strong compression |
| 5-8 | ×1.08 | Moderate compression |
| 2-5 | ×1.0 | Normal |
| < 2 | ×0.95 | Weak |

### Combined Calculation
```
Geomagnetic Probability = Base_KP × Bz_Factor × Speed_Factor × Pressure_Factor
```

---

## 2. Weather Factor (Local Conditions)

Aurora visibility requires **clear skies**. This factor reduces probability based on real-time weather from SMHI.

### Cloud Coverage (0-8 oktas)
Oktas measure sky coverage in eighths:

| Cloud Coverage | Factor | Description |
|----------------|--------|-------------|
| 0-1 oktas | 100% | Clear skies |
| 2-3 oktas | 85% | Mostly clear |
| 4-5 oktas | 50% | Partly cloudy |
| 6-7 oktas | 20% | Mostly cloudy |
| 8 oktas | 5% | Completely overcast |

### Visibility Modifier
Poor visibility (fog) further reduces chances:

| Visibility | Modifier | Effect |
|------------|----------|--------|
| > 10 km | ×1.0 | Excellent |
| 5-10 km | ×1.0 | Good |
| 1-5 km | ×0.5 | Reduced |
| < 1 km | ×0.1 | Fog - severe impact |

### Precipitation Modifier
Any precipitation heavily blocks aurora visibility:

| Condition | Modifier | SMHI pcat |
|-----------|----------|-----------|
| No precipitation | ×1.0 | 0 |
| Snow | ×0.3 | 1 |
| Snow/sleet | ×0.3 | 2 |
| Sleet | ×0.3 | 3 |
| Drizzle | ×0.3 | 4 |
| Rain | ×0.3 | 5 |
| Heavy rain | ×0.3 | 6 |

### Combined Calculation
```
Weather Factor = Cloud_Coverage_Factor × Visibility_Modifier × Precipitation_Modifier
```

---

## Example Calculation

### Current Conditions (Real Data):
- **KP Index**: 0.3 (Very Low Activity)
- **Bz Component**: -0.3 nT (Slightly southward)
- **Solar Wind Speed**: 343 km/s (Normal)
- **Density**: 0.8 particles/cm³
- **Cloud Coverage**: 8 oktas (Overcast)
- **Visibility**: 6.2 km
- **Precipitation**: Sleet (pcat=3)

### Step-by-Step:

#### 1. Geomagnetic Probability
```
Base (KP 0.3): 5 + (0.3 × 10) = 8%
Bz Factor (-0.3 nT): ×1.05
Speed Factor (343 km/s): ×1.0
Pressure Factor (0.8 × 343² / 100000 = -2.82 nPa): ×0.95

Geomagnetic = 8% × 1.05 × 1.0 × 0.95 = 8%
```

Wait, the calculation shows 5% in the API. Let me recalculate:
```
For KP 0.3 (< 1): Base = 5%
Bz -0.3 (< 0): Factor = 1.05
Speed 343 (300-400): Factor = 1.0
Pressure -2.82 (< 2): Factor = 0.95

Geomagnetic = 5% × 1.05 × 1.0 × 0.95 ≈ 5%
```

#### 2. Weather Factor
```
Cloud Coverage (8 oktas): 5% = 0.05
Visibility (6.2 km): ×1.0 (no impact)
Precipitation (Sleet): ×0.3

Weather Factor = 0.05 × 1.0 × 0.3 = 0.015 = 1.5% ≈ 2%
```

#### 3. Final Probability
```
Final = 5% × 0.02 = 0.1% ≈ 0%
```

**Interpretation**: Despite low geomagnetic activity (5% space weather probability), the overcast skies with sleet make aurora visibility essentially impossible.

---

## Data Sources

### Space Weather (NOAA)
- **KP Index**: `https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json`
- **Solar Wind**: `https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json`
  - Data format: `[timestamp, bx, by, bz, speed, density, bt]`
  - Updated every minute

### Local Weather (SMHI)
- **Forecast API**: `https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/15.1883/lat/60.1496/data.json`
- Parameters used:
  - `tcc_mean`: Total cloud cover (oktas)
  - `vis`: Horizontal visibility (km)
  - `pcat`: Precipitation category (0-6)

---

## Update Frequency
- Aurora data refreshes every **10 minutes**
- SMHI forecast updates hourly
- NOAA space weather updates every minute (we fetch every 10 min)

---

## Scientific Notes

### Why Bz is Critical
When the IMF Bz component points south (negative), it opposes Earth's northward-pointing magnetic field. This allows **magnetic reconnection** at the magnetopause, transferring solar wind energy into the magnetosphere and driving auroral displays.

### Dynamic Pressure Impact
A sudden increase in dynamic pressure compresses the magnetosphere, potentially triggering **substorms** and intensifying aurora. This occurs during **Coronal Mass Ejections (CMEs)** or **Corotating Interaction Regions (CIRs)**.

### Magnetic vs Geographic Latitude
Ludvika is at 60.1°N geographic latitude but ~57-58°N magnetic latitude. Aurora probability calculations use magnetic latitude since auroral ovals follow geomagnetic field lines. At KP 5-6, the aurora reaches this latitude regularly.

---

## Future Enhancements

Potential improvements to the algorithm:
1. **3-hour KP forecast** - Use predicted KP instead of current
2. **IMF clock angle** - Combine Bz and By for reconnection efficiency
3. **Dst index** - Measure geomagnetic storm intensity
4. **Historical statistics** - Bayesian prior based on past observations
5. **Light pollution factor** - Reduce probability in urban areas
6. **Moon phase** - Bright moon reduces visibility (already tracked in dashboard)
7. **Substorm prediction** - Machine learning on solar wind patterns
