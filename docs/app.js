// frontend/app.js
import { setupClouds, updateClouds } from "./threejs/clouds.js?v=4";
import { setupRain, updateRain } from "./threejs/rain.js?v=4";
import { setupSnow, updateSnow } from "./threejs/snow.js?v=4";
import { setupLightning, updateLightning } from "./threejs/lightning.js?v=4";
import { initCinematicFog } from "./threejs/cinematic_fog.js?v=4";

// Emergency fallback - hide loading screen after 6 seconds no matter what
setTimeout(() => {
  const ls = document.getElementById('loading-screen');
  if (ls && !ls.classList.contains('hidden')) {
    console.warn('Emergency fallback - forcing loading screen to hide');
    ls.classList.add('hidden');
  }
}, 6000);

// API Configuration
// When running on GitHub Pages, use your Cloudflare tunnel URL
// Update this URL if your tunnel changes
const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? "" // Local development - use same origin
  : "https://harbour-anderson-accessible-physics.trycloudflare.com"; // GitHub Pages - use Cloudflare tunnel

const DALARNA_LAT = 60.1496;
const DALARNA_LON = 15.1883;

// Expose API globally for overview-new.js
window.API = API;

// Tab Navigation
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      switchToTab(tabName);
    });
  });
}

// Function to switch to a specific tab
function switchToTab(tabName) {
  console.log('switchToTab called with:', tabName);
  
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(btn => btn.classList.remove('active'));
  tabContents.forEach(content => content.classList.remove('active'));
  
  // Add active class to clicked tab and corresponding content
  const activeButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
  if (activeButton) {
    activeButton.classList.add('active');
    console.log('Activated button for:', tabName);
  } else {
    console.error('Button not found for tab:', tabName);
  }
  
  const activeContent = document.getElementById(`${tabName}-content`);
  if (activeContent) {
    activeContent.classList.add('active');
    console.log('Activated content for:', tabName);
  } else {
    console.error('Content not found for tab:', tabName);
  }
  
  // Center the active tab button in the tab navigation (mobile-friendly)
  centerActiveTabButton();
  
  // Update page-specific content
  if (tabName === 'overview') {
    updateOverviewPage();
  } else if (tabName === 'compare') {
    updateComparisonPage();
  } else if (tabName === 'outdoor') {
    // Outdoor page is static (SMHI forecast displayed via chart)
  } else if (tabName === 'indoor') {
    // Indoor page is static (sensor data updated via main loop)
  } else if (tabName === 'analytics') {
    // Analytics page is static (charts updated via main loop)
  } else if (tabName === 'notifications') {
    // Ensure notifications page is initialized
    if (typeof initNotificationsPage === 'function') {
      initNotificationsPage();
    }
  }
}

// Ensure the active tab button is centered in the tab bar
function centerActiveTabButton() {
  const nav = document.querySelector('.tab-navigation');
  const active = document.querySelector('.tab-button.active');
  if (!nav || !active) return;
  // Only attempt scrolling if content overflows horizontally
  if (nav.scrollWidth <= nav.clientWidth) return;
  const targetLeft = active.offsetLeft + (active.offsetWidth / 2) - (nav.clientWidth / 2);
  nav.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
}

// Swipe Navigation
function setupSwipeNavigation() {
  let touchStartX = 0;
  let touchEndX = 0;
  let touchStartY = 0;
  let touchEndY = 0;
  let swipeDisabled = false;
  
  // Tab order must match the HTML tab-navigation order
  const tabs = ['overview', 'compare', 'outdoor', 'indoor', 'analytics', 'notifications'];
  
  function shouldDisableSwipe(target) {
    // Disable swipe when interacting with inputs on Notifications page
    const interactiveSelectors = 'input, select, textarea, button, label, .toggle, .switch, .slider, .range';
    if (target.closest(interactiveSelectors)) return true;
    // Also keep existing exclusions
    if (target.closest('.chart-container') || target.closest('canvas')) return true;
    return false;
  }
  
  function getCurrentTabIndex() {
    const activeTab = document.querySelector('.tab-button.active');
    if (!activeTab) return 0;
    const tabName = activeTab.getAttribute('data-tab');
    return tabs.indexOf(tabName);
  }
  
  function handleSwipe() {
    const swipeDistanceX = touchEndX - touchStartX;
    const swipeDistanceY = Math.abs(touchEndY - touchStartY);
    const minSwipeDistance = 50; // Minimum distance for swipe
    
    // Only trigger if horizontal swipe is dominant (not vertical scroll)
    if (Math.abs(swipeDistanceX) > minSwipeDistance && Math.abs(swipeDistanceX) > swipeDistanceY * 1.5) {
      const currentIndex = getCurrentTabIndex();
      
      console.log('Swipe detected:', swipeDistanceX > 0 ? 'RIGHT' : 'LEFT', 'from tab', tabs[currentIndex]);
      
      if (swipeDistanceX > 0 && currentIndex > 0) {
        // Swipe right - go to previous tab
        switchToTab(tabs[currentIndex - 1]);
      } else if (swipeDistanceX < 0 && currentIndex < tabs.length - 1) {
        // Swipe left - go to next tab
        switchToTab(tabs[currentIndex + 1]);
      }
    }
  }
  
  // Add touch event listeners to the body for full-page swipe
  document.body.addEventListener('touchstart', (e) => {
    const target = e.target;
    swipeDisabled = shouldDisableSwipe(target);
    if (swipeDisabled) {
      return;
    }
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });
  
  document.body.addEventListener('touchend', (e) => {
    if (swipeDisabled) {
      swipeDisabled = false; // reset for next gesture
      return;
    }
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
  }, { passive: true });
}

// Initialize tabs and swipe navigation on load
setupTabNavigation();
setupSwipeNavigation();

// Setup air quality alert click handler
document.addEventListener('DOMContentLoaded', () => {
  const airStatusEl = document.getElementById('overview-air-status');
  if (airStatusEl) {
    airStatusEl.addEventListener('click', () => {
      const warnings = JSON.parse(airStatusEl.dataset.warnings || '[]');
      
      if (warnings.length === 0) {
        alert('✓ All air quality parameters are within normal ranges!');
        return;
      }
      
      const warningMessages = {
        'high_co2': '🔴 CO₂ levels are high (>2000 ppm)!\nRecommendation: Open windows to ventilate immediately.',
        'elevated_co2': '⚠️ CO₂ levels are elevated (>1000 ppm).\nRecommendation: Consider ventilating the room.',
        'high_tvoc': '🔴 High volatile organic compounds detected (>500 ppb)!\nRecommendation: Check for sources like cleaning products or new furniture.',
        'elevated_tvoc': '⚠️ Elevated TVOC levels detected (>220 ppb).\nRecommendation: Increase ventilation.',
        'high_humidity': '💧 Humidity is high (≥65%).\nRisk: Mold growth and discomfort.\nRecommendation: Use a dehumidifier or increase ventilation.',
        'low_humidity': '🏜️ Low humidity (≤30%).\nEffects: Dry skin, irritated eyes, and respiratory discomfort.\nRecommendation: Use a humidifier or place water containers near heat sources.',
        'condensation_risk': '❄️ Condensation risk detected (temp - dew point ≤2°C).\nRisk: Water droplets on cold surfaces.\nRecommendation: Check windows and increase ventilation.'
      };
      
      const alertText = warnings.map(w => warningMessages[w] || w).join('\n\n');
      alert('🌬️ AIR QUALITY ALERTS\n\n' + alertText);
    });
  }
});

// New UI element references
const mainTempEl = document.getElementById("main-temp");
const mainConditionEl = document.getElementById("main-condition");
const weatherDescEl = document.getElementById("weather-desc");
const mainLocationEl = document.getElementById("main-location");
const windSpeedEl = document.getElementById("wind-speed");
const humidityPctEl = document.getElementById("humidity-pct");
const pressureValEl = document.getElementById("pressure-val");
const dewPointEl = document.getElementById("dew-point");
const dewConditionEl = document.getElementById("dew-condition");
const pressureTrendEl = document.getElementById("pressure-trend");
const trendIndicatorEl = document.getElementById("trend-indicator");
const sensorWarningsEl = document.getElementById("sensor-warnings-main");
const smhiWarningsEl = document.getElementById("smhi-warnings");
const smhiRegionEl = document.getElementById("smhi-region");
const sunriseEl = document.getElementById("sunrise-time");
const sunsetEl = document.getElementById("sunset-time");

let scene, camera, renderer;
let currentSmhiData = { warnings: [], count: 0 };
let lastCondition = null;

let weatherState = {
  condition: "clear",
  intensity: 0,
  temp: null,
  humidity: null,
  pressure: null,
  pressureTrend: "stable",
  hasSmhiWarning: false,
  smhiLevel: null
};

// -----------------------------
// ⭐ ADDED: Cinematic backgrounds
// -----------------------------
const backgrounds = {
  clear: "background/bg_clear_sky.png",
  fog: "background/bg_fog.png",
  night: "background/bg_night.png",
  rain: "background/bg_rain.png",
  snow: "background/bg_snow.png",
  storm: "background/bg_storm.png"
};

// Rain animation control
let rainInterval = null;
let rainIntensity = 1; // 1 = light, 2 = moderate, 3 = heavy

function createRaindrops() {
  const rainOverlay = document.getElementById("rain-overlay");
  if (!rainOverlay) return;
  
  // Optimized particle count: Light: 2 drops, Medium: 3 drops, Heavy: 5 drops
  const dropCount = rainIntensity === 1 ? 2 : (rainIntensity === 2 ? 3 : 5);
  for (let i = 0; i < dropCount; i++) {
    const drop = document.createElement("div");
    drop.className = "raindrop";
    drop.style.left = Math.random() * 100 + "%";
    drop.style.animationDuration = (Math.random() * 0.2 + 0.7) + "s";
    drop.style.opacity = Math.random() * 0.3 + 0.5;
    drop.style.animationDelay = (Math.random() * 0.2) + "s";
    
    rainOverlay.appendChild(drop);
    
    // Remove raindrop after animation completes (800ms base + random variation)
    setTimeout(() => {
      if (drop.parentNode) drop.remove();
    }, 1200);
  }
}

function startRain(intensity = 1) {
  rainIntensity = Math.max(1, Math.min(3, intensity)); // Clamp between 1-3
  if (rainInterval) return; // Already running
  
  // Optimized intervals: Light: 150ms, Medium: 120ms, Heavy: 80ms
  const intervalTime = intensity === 3 ? 80 : (intensity === 2 ? 120 : 150);
  rainInterval = setInterval(createRaindrops, intervalTime);
  createRaindrops(); // Create first batch immediately
}

function stopRain() {
  if (rainInterval) {
    clearInterval(rainInterval);
    rainInterval = null;
  }
  const rainOverlay = document.getElementById("rain-overlay");
  if (rainOverlay) rainOverlay.innerHTML = "";
}

// Smooth fading background function with weather animations
function setBackground(imagePath) {
  const bgImage = document.getElementById("bg-image");
  if (bgImage) {
    bgImage.style.backgroundImage = `url("${imagePath}")`;
  }
  
  // Control weather animations based on background and current conditions
  const rainOverlay = document.getElementById("rain-overlay");
  const snowOverlay = document.getElementById("snow-overlay");
  const fogOverlay = document.getElementById("fog-overlay");
  
  // Deactivate all animations first
  if (rainOverlay) rainOverlay.classList.remove("active");
  if (snowOverlay) snowOverlay.classList.remove("active");
  if (fogOverlay) fogOverlay.classList.remove("active");
  stopRain();
  
  // Determine current weather condition from SMHI or sensor data
  let hasRain = imagePath.includes("rain") || imagePath.includes("storm");
  let hasSnow = imagePath.includes("snow");
  let hasFog = imagePath.includes("fog");
  
  // Check SMHI forecast for weather conditions
  if (smhiForecast && smhiForecast.symbol) {
    const symbol = smhiForecast.symbol;
    const temp = typeof window.currentOutdoorTemp !== 'undefined' ? window.currentOutdoorTemp : 5;
    console.log(`Checking SMHI symbol: ${symbol}, visibility: ${smhiForecast.visibility}km, temp: ${temp}°C`);
    
    // Rain symbols: 5,6,10,18,19,20
    const smhiSaysRain = [5, 6, 10, 18, 19, 20].includes(symbol);
    // Snow symbols: 8,9,15,16,17
    const smhiSaysSnow = [8, 9, 15, 16, 17].includes(symbol);
    // Storm symbols: 21-27
    const smhiSaysStorm = [21, 22, 23, 24, 25, 26, 27].includes(symbol);
    
    // Temperature override: rain at freezing temps becomes snow
    if (smhiSaysSnow || (temp <= 1 && (smhiSaysRain || smhiSaysStorm))) {
      hasSnow = true;
      hasRain = false;
    } else if (smhiSaysRain || smhiSaysStorm) {
      hasRain = true;
    }
    
    // Fog symbol: 7 or low visibility
    if (symbol === 7 || (smhiForecast.visibility && smhiForecast.visibility < 2)) hasFog = true;
  }
  
  console.log(`Weather conditions - Rain: ${hasRain}, Snow: ${hasSnow}, Fog: ${hasFog}`);
  
  // Rain animation: CSS droplets only (angled streaks)
  if (hasRain) {
    let intensity = 1;
    if (smhiForecast && smhiForecast.precipitation) {
      const precip = smhiForecast.precipitation;
      if (precip > 10) intensity = 3;
      else if (precip > 5) intensity = 2;
      else intensity = 1;
      console.log(`Rain intensity ${intensity} based on precipitation: ${precip}mm`);
    } else if (imagePath.includes("storm")) {
      intensity = 3;
      console.log("Rain intensity 3 (storm)");
    }
    startRain(intensity);
  }
  
  // CSS snow overlay disabled - using 3D snow particles instead
  if (hasSnow && snowOverlay) {
    // snowOverlay.classList.add("active");
    console.log("Snow animation active - 3D particles");
  } else {
    console.log("Snow animation DISABLED");
  }
  
  if (hasFog && fogOverlay) {
    fogOverlay.classList.add("active");
    console.log("Fog overlay active (static)");
  } else {
    console.log("Fog overlay disabled");
  }
}


// -----------------------------
// INIT SCENE (DISABLED FOR PERFORMANCE)
// -----------------------------
let bgColor = { r: 0.01, g: 0.02, b: 0.09 };

function initScene() {
  const canvas = document.getElementById("bg");
  const THREE = window.THREE;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020617, 0.035);

  camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    80
  );
  camera.position.set(0, 1.8, 4.5);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true  // Enable transparency
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(1.5);
  renderer.setClearColor(0x000000, 0);  // Transparent background

  const ambient = new THREE.AmbientLight(0xffffff, 0.45);
  const dir = new THREE.DirectionalLight(0xffffff, 0.7);
  dir.position.set(-3, 6, 4);
  scene.add(ambient);
  scene.add(dir);

  // Effects modules
  // setupClouds(scene);
  setupRain(scene);
  // setupSnow(scene); // DISABLED - using Canvas 2D snow instead
  setupLightning(scene, camera);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Start animation loop for weather effects
  animationRunning = true;
  animate();
}


// -----------------------------
// ANIMATION LOOP
// -----------------------------
let animationRunning = false;

function animate() {
  if (!animationRunning) return;
  requestAnimationFrame(animate);

  const delta = 0.016;

  // Keep background transparent so bg-image shows through
  renderer.setClearColor(0x000000, 0);

  // Cinematic camera floating - disabled for performance
  // const t = performance.now() * 0.00015;
  // camera.position.x = Math.sin(t) * 0.25;
  // camera.position.y = 1.7 + Math.sin(t * 0.5) * 0.08;
  // camera.lookAt(0, 1.7, 0);

  // updateClouds(delta, weatherState);
  updateRain(delta, weatherState);
  // updateSnow(delta, weatherState); // DISABLED - using Canvas 2D snow instead
  updateLightning(delta, weatherState);

  renderer.render(scene, camera);
}


// ----------------------------------------------------
// ⭐ AI WEATHER BRAIN (This is the intelligence)
// ----------------------------------------------------
function getBackgroundForWeather(smhiSymbol, sensor) {
  const hour = new Date().getHours();
  const isNight = hour < 6 || hour > 20;

  if (isNight) return backgrounds.night;

  if (smhiSymbol === 12) return backgrounds.fog;      // fog
  if (smhiSymbol === 6 || smhiSymbol === 9) return backgrounds.rain;
  if (smhiSymbol === 7 || smhiSymbol === 10) return backgrounds.storm;
  if (smhiSymbol === 8 || smhiSymbol === 11) return backgrounds.snow;

  // Fog based on dewpoint
  if (sensor?.dew_point != null && sensor?.temperature != null) {
    if (Math.abs(sensor.temperature - sensor.dew_point) < 1.0) {
      return backgrounds.fog;
    }
  }

  return backgrounds.clear;
}


// ----------------------------------------------------
// CLASSIFICATION (weather → lighting, fog, effects)
// ----------------------------------------------------
function deriveWeatherState(sensor, smhi) {
  const ws = { ...weatherState };

  const temp = sensor.temperature;
  const hum = sensor.humidity;
  const press = sensor.pressure;
  const dew = sensor.dew_point;
  const trend = sensor.pressure_trend;

  const warnings = (smhi && smhi.warnings) || [];
  const precipEvents = warnings.filter(w =>
    /(rain|snow|thunder|storm)/i.test(w.event || "")
  );

  ws.temp = temp;
  ws.humidity = hum;
  ws.pressure = press;
  ws.pressureTrend = trend;
  ws.hasSmhiWarning = warnings.length > 0;

  // Check SMHI forecast first for accurate weather detection
  if (smhiForecast && smhiForecast.symbol) {
    const symbol = smhiForecast.symbol;
    const precip = smhiForecast.precipitation || 0;
    
    // Fog
    if (symbol === 7 || (smhiForecast.visibility && smhiForecast.visibility < 1)) {
      ws.condition = "fog";
      ws.intensity = 0.5;
      return ws;
    }
    
    // Rain symbols - but check if should be snow due to temp
    if ([5, 6, 10, 18, 19, 20].includes(symbol) || precip > 0) {
      if (temp < 0) {
        ws.condition = "snow";
        ws.intensity = 0.7;
        return ws;
      }
      ws.condition = "rain";
      ws.intensity = 0.7;
      return ws;
    }
    
    // Snow symbols
    if ([8, 9, 15, 16, 17].includes(symbol)) {
      ws.condition = "snow";
      ws.intensity = 0.7;
      return ws;
    }
    
    // Storm/thunder symbols
    if ([21, 22, 23, 24, 25, 26, 27].includes(symbol)) {
      if (temp < 0) {
        ws.condition = "snowstorm";
        ws.intensity = 1;
        return ws;
      }
      ws.condition = "storm";
      ws.intensity = 1;
      return ws;
    }
  }

  // Fallback: Strong storm logic based on sensor
  if (press < 985 && trend === "falling") {
    ws.condition = "storm";
    ws.intensity = 1;
    return ws;
  }

  if (temp <= 0 && hum > 80) {
    ws.condition = "snow";
    ws.intensity = 0.6;
    return ws;
  }

  if (hum > 85 || precipEvents.length > 0) {
    ws.condition = "rain";
    ws.intensity = 0.7;
    return ws;
  }

  if (Math.abs(temp - dew) < 1.0) {
    ws.condition = "fog";
    ws.intensity = 0.5;
    return ws;
  }

  ws.condition = "clear";
  ws.intensity = 0.1;
  return ws;
}


// ----------------------------------------------------
// APPLY VISUALS
// ----------------------------------------------------
function applyWeatherVisuals(ws) {
  if (ws.condition !== lastCondition) {
    lastCondition = ws.condition;

    const target = {
      storm: { r: 0.01, g: 0.01, b: 0.04 },
      rain: { r: 0.02, g: 0.03, b: 0.07 },
      snow: { r: 0.05, g: 0.07, b: 0.12 },
      fog: { r: 0.04, g: 0.05, b: 0.08 },
      clear: { r: 0.01, g: 0.02, b: 0.09 }
    }[ws.condition] || { r: 0.01, g: 0.02, b: 0.09 };

    gsap.to(bgColor, { duration: 2.0, ...target, ease: "power2.out" });
  }

  // Fog intensity adapts dynamically
  const base = 0.02;
  let extra = {
    storm: 0.03,
    rain: 0.02,
    snow: 0.015,
    fog: 0.04,
    clear: 0.005
  }[weatherState.condition];

  scene.fog.density = base + extra;
}


// ----------------------------------------------------
// FETCH SENSOR DATA
// ----------------------------------------------------
async function updateData() {
  try {
    const res = await fetch(`${API}/api/current`);
    const sensor = await res.json();
    
    // Fetch 24h min/max data
    const minmaxRes = await fetch(`${API}/api/minmax`);
    const minmax = await minmaxRes.json();

    // Update main temperature display
    if (mainTempEl) {
      mainTempEl.textContent = sensor.temperature?.toFixed(1) + "°C" || "--°C";
    }
    
    // Update 24h high/low
    const tempMaxEl = document.getElementById("temp-max-24h");
    const tempMinEl = document.getElementById("temp-min-24h");
    if (tempMaxEl && minmax.temperature?.max !== null) {
      tempMaxEl.textContent = minmax.temperature.max.toFixed(1);
    }
    if (tempMinEl && minmax.temperature?.min !== null) {
      tempMinEl.textContent = minmax.temperature.min.toFixed(1);
    }

    // Update weather stats
    if (windSpeedEl) windSpeedEl.textContent = "0 mph"; // No wind data yet
    if (humidityPctEl) humidityPctEl.textContent = sensor.humidity?.toFixed(0) + "%" || "--%";
    if (pressureValEl) pressureValEl.textContent = sensor.pressure?.toFixed(1) + " hPa" || "-- hPa";

    // Update dew point card
    if (dewPointEl) dewPointEl.textContent = sensor.dew_point?.toFixed(1) + "°C" || "--°C";
    if (dewConditionEl) {
      const dewDiff = Math.abs(sensor.temperature - sensor.dew_point);
      if (dewDiff < 1) {
        dewConditionEl.textContent = "Fog Risk";
      } else if (dewDiff < 3) {
        dewConditionEl.textContent = "High Humidity";
      } else {
        dewConditionEl.textContent = "Normal";
      }
    }

    // Update pressure trend card
    if (pressureTrendEl) pressureTrendEl.textContent = sensor.pressure_trend || "Stable";
    if (trendIndicatorEl) {
      const trend = sensor.pressure_trend?.toLowerCase() || "stable";
      trendIndicatorEl.textContent = trend === "rising" ? "↗ Rising" : 
                                       trend === "falling" ? "↘ Falling" : "→ Stable";
    }

    // Update main weather condition
    weatherState = deriveWeatherState(sensor, currentSmhiData);
    updateWeatherConditionText(weatherState, sensor);
    
    // Update background based on current weather
    updateBackgroundForCurrentWeather(sensor);

    // Update sensor warnings
    if (sensorWarningsEl) {
      sensorWarningsEl.innerHTML = "";
      (sensor.sensor_warnings || []).forEach(w => {
        const chip = document.createElement("div");
        chip.className = "warning-chip";
        // Format warning text: replace underscores with spaces and capitalize each word
        const formatted = w.split('_').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        chip.textContent = formatted;
        sensorWarningsEl.appendChild(chip);
      });
    }

  } catch (err) {
    console.error("Failed to fetch /api/current", err);
  }
}

let sunData = null;
let smhiForecast = null;

// Fetch sunrise/sunset data
async function updateSunTimes() {
  try {
    const res = await fetch(`${API}/api/sun`);
    sunData = await res.json();
    console.log("Sun times:", sunData);
    
    // Update UI with sunrise/sunset times
    if (sunriseEl && sunData.sunrise) {
      sunriseEl.textContent = sunData.sunrise;
    }
    if (sunsetEl && sunData.sunset) {
      sunsetEl.textContent = sunData.sunset;
    }
    
    // Update SVG time labels
    const sunriseLabel = document.getElementById('sunrise-time-label');
    const sunsetLabel = document.getElementById('sunset-time-label');
    if (sunriseLabel && sunData.sunrise) {
      sunriseLabel.textContent = sunData.sunrise;
    }
    if (sunsetLabel && sunData.sunset) {
      sunsetLabel.textContent = sunData.sunset;
    }
    
    // Update sun position animation
    updateSunPosition();
  } catch (err) {
    console.error("Failed to fetch sun times", err);
  }
}

// Global function to check if current time is after sunset
window.isAfterSunset = function() {
  if (!sunData || !sunData.sunset) return false;
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [sunsetHour, sunsetMin] = sunData.sunset.split(':').map(Number);
  const sunsetMinutes = sunsetHour * 60 + sunsetMin;
  
  return currentMinutes > sunsetMinutes;
};

// Update the sun's position along the arc based on current time
function updateSunPosition() {
  if (!sunData || !sunData.sunrise || !sunData.sunset) return;
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  // Parse sunrise and sunset times (format: "HH:MM")
  const [sunriseHour, sunriseMin] = sunData.sunrise.split(':').map(Number);
  const [sunsetHour, sunsetMin] = sunData.sunset.split(':').map(Number);
  
  const sunriseMinutes = sunriseHour * 60 + sunriseMin;
  const sunsetMinutes = sunsetHour * 60 + sunsetMin;
  
  const sunGroup = document.getElementById('sun-position-group');
  const sunIcon = document.getElementById('sun-position');
  const sunRays = document.getElementById('sun-rays');
  if (!sunGroup || !sunIcon) return;
  
  let progress = 0;
  let path = null;
  const minutesInDay = 24 * 60;
  
  // During daylight - move along day arc (above horizon)
  if (currentMinutes >= sunriseMinutes && currentMinutes <= sunsetMinutes) {
    const dayLength = sunsetMinutes - sunriseMinutes;
    const elapsed = currentMinutes - sunriseMinutes;
    progress = elapsed / dayLength;
    sunIcon.setAttribute('fill', '#FDB813');
    sunIcon.setAttribute('filter', 'url(#sun-glow)');
    if (sunRays) sunRays.style.opacity = '1';
    path = document.getElementById('day-arc');
  }
  // During night - move along night arc (below horizon)
  else {
    let nightMinutes;
    let totalNightLength;
    
    // After sunset (same day)
    if (currentMinutes > sunsetMinutes) {
      nightMinutes = currentMinutes - sunsetMinutes;
      totalNightLength = (minutesInDay - sunsetMinutes) + sunriseMinutes;
    }
    // Before sunrise (next day)
    else {
      nightMinutes = (minutesInDay - sunsetMinutes) + currentMinutes;
      totalNightLength = (minutesInDay - sunsetMinutes) + sunriseMinutes;
    }
    
    // Progress along night arc from sunset to sunrise
    progress = nightMinutes / totalNightLength;
    sunIcon.setAttribute('fill', '#B0BEC5');
    sunIcon.setAttribute('filter', 'url(#moon-glow)');
    if (sunRays) sunRays.style.opacity = '0';
    path = document.getElementById('night-arc');
  }
  
  // Animate sun/moon along the appropriate arc path
  if (path) {
    const pathLength = path.getTotalLength();
    const point = path.getPointAtLength(progress * pathLength);
    sunGroup.setAttribute('transform', `translate(${point.x}, ${point.y})`);
  }
}

// Calculate moon phase
function calculateMoonPhase() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  
  // Calculate days since known new moon (Jan 6, 2000)
  const knownNewMoon = new Date(2000, 0, 6, 18, 14);
  const daysSince = (now - knownNewMoon) / (1000 * 60 * 60 * 24);
  
  // Lunar cycle is 29.53059 days
  const lunarCycle = 29.53059;
  const phase = (daysSince % lunarCycle) / lunarCycle;
  
  // Calculate illumination percentage
  const illumination = Math.round((1 - Math.cos(phase * 2 * Math.PI)) * 50);
  
  // Determine phase name
  let phaseName;
  if (phase < 0.03 || phase > 0.97) phaseName = "New Moon";
  else if (phase < 0.22) phaseName = "Waxing Crescent";
  else if (phase < 0.28) phaseName = "First Quarter";
  else if (phase < 0.47) phaseName = "Waxing Gibbous";
  else if (phase < 0.53) phaseName = "Full Moon";
  else if (phase < 0.72) phaseName = "Waning Gibbous";
  else if (phase < 0.78) phaseName = "Last Quarter";
  else phaseName = "Waning Crescent";
  
  return { phase, illumination, phaseName };
}

// Update moon phase display
function updateMoonPhase() {
  const moonPhaseNameEl = document.getElementById('moon-phase-name');
  const moonIlluminationEl = document.getElementById('moon-illumination');
  const moonShadowEl = document.getElementById('moon-shadow');
  
  if (!moonPhaseNameEl || !moonIlluminationEl || !moonShadowEl) return;
  
  const { phase, illumination, phaseName } = calculateMoonPhase();
  
  moonPhaseNameEl.textContent = phaseName;
  moonIlluminationEl.textContent = `${illumination}% illuminated`;
  
  // Create shadow path based on phase
  const cx = 50, cy = 50, r = 35;
  
  if (illumination < 5) {
    // New moon - full circle shadow
    moonShadowEl.setAttribute('d', 
      `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
    );
  } else if (illumination > 95) {
    // Full moon - no shadow
    moonShadowEl.setAttribute('d', '');
  } else if (phase < 0.5) {
    // Waxing phases - shadow on left side
    const shadowPercent = (0.5 - phase) * 2; // 1 to 0
    const shadowX = cx - r + (shadowPercent * r * 2);
    
    moonShadowEl.setAttribute('d', 
      `M ${cx - r} ${cy - r}
       L ${shadowX} ${cy - r}
       A ${r * shadowPercent} ${r} 0 0 0 ${shadowX} ${cy + r}
       L ${cx - r} ${cy + r}
       A ${r} ${r} 0 0 1 ${cx - r} ${cy - r} Z`
    );
  } else {
    // Waning phases - shadow on right side
    const shadowPercent = (phase - 0.5) * 2; // 0 to 1
    const shadowX = cx + r - (shadowPercent * r * 2);
    
    moonShadowEl.setAttribute('d', 
      `M ${cx + r} ${cy - r}
       L ${shadowX} ${cy - r}
       A ${r * shadowPercent} ${r} 0 0 1 ${shadowX} ${cy + r}
       L ${cx + r} ${cy + r}
       A ${r} ${r} 0 0 0 ${cx + r} ${cy - r} Z`
    );
  }
}

// Fetch SMHI forecast
async function updateSMHIForecast() {
  try {
    const res = await fetch(`${API}/api/forecast`);
    smhiForecast = await res.json();
    console.log("SMHI forecast:", smhiForecast);
    
    // Trigger background and condition update after getting SMHI data
    const sensorRes = await fetch(`${API}/api/current`);
    const sensor = await sensorRes.json();
    
    updateBackgroundForCurrentWeather(sensor);
    weatherState = deriveWeatherState(sensor, currentSmhiData);
    updateWeatherConditionText(weatherState, sensor);
  } catch (err) {
    console.error("Failed to fetch SMHI forecast", err);
  }
}

// Update 6-hour forecast summary for Overview
async function updateForecastSummary() {
  try {
    // Fetch SMHI forecast for next few time periods
    const url = `https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/15.1883/lat/60.1496/data.json`;
    const response = await fetch(url, { cache: 'no-cache' });
    const data = await response.json();

    if (!data.timeSeries || data.timeSeries.length < 2) {
      document.getElementById('forecast-text').textContent = 'Forecast unavailable';
      return;
    }

    // Get next 6 hours (typically 2-3 time periods)
    const periods = data.timeSeries.slice(0, 3);
    
    // Extract key parameters
    let temps = [];
    let symbols = [];
    let winds = [];
    let precips = [];

    periods.forEach(period => {
      const params = {};
      period.parameters.forEach(p => {
        params[p.name] = p.values[0];
      });
      
      temps.push(params.t || 0);
      symbols.push(params.Wsymb2 || 1);
      winds.push(params.ws || 0);
      precips.push(params.pcat || 0);
    });

    // Determine dominant condition
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
    const maxWind = Math.max(...winds);
    const hasPrecip = precips.some(p => p > 0);
    const dominantSymbol = symbols[0]; // Use first period's symbol

    // Temperature trend
    const tempChange = temps[temps.length - 1] - temps[0];
    let tempTrend = '';
    if (tempChange > 1) tempTrend = 'warming';
    else if (tempChange < -1) tempTrend = 'cooling';
    else tempTrend = 'steady';

    // Map symbol to description - CHECK TEMPERATURE FIRST for precipitation
    let condition = '';
    let icon = '☁️';
    
    // SMHI symbols 21-27 are thunderstorm symbols, but need temp check
    // 25 = Light snow, 26 = Snow, 27 = Heavy snow when below freezing
    if ([21, 22, 23, 24, 25, 26, 27].includes(dominantSymbol)) {
      if (avgTemp < 0) {
        // Below freezing = snow (possibly heavy if wind is strong)
        if (maxWind > 10) {
          condition = 'heavy snow with wind';
          icon = '🌨️';
        } else {
          condition = 'snowing';
          icon = '🌨️';
        }
      } else {
        // Above freezing = actual storm
        condition = 'stormy';
        icon = '⛈️';
      }
    } else if ([8, 9, 15, 16, 17].includes(dominantSymbol)) {
      condition = 'snowing';
      icon = '🌨️';
    } else if ([5, 6, 10, 18, 19, 20].includes(dominantSymbol)) {
      // Rain symbols - check temp
      if (avgTemp < 0) {
        condition = 'snowing';
        icon = '🌨️';
      } else {
        condition = 'raining';
        icon = '🌧️';
      }
    } else if (dominantSymbol === 7) {
      condition = 'foggy';
      icon = '🌫️';
    } else if ([3, 4].includes(dominantSymbol)) {
      condition = 'partly cloudy';
      icon = '⛅';
    } else if ([1, 2].includes(dominantSymbol)) {
      condition = 'clear';
      icon = '☀️';
    } else {
      condition = 'cloudy';
      icon = '☁️';
    }

    // Build forecast text
    let forecastText = `Continues ${condition}`;
    
    if (maxWind > 8) {
      forecastText += `, wind picking up to ${maxWind.toFixed(0)} m/s`;
    } else if (maxWind > 4) {
      forecastText += `, light wind ${maxWind.toFixed(0)} m/s`;
    }

    if (tempTrend === 'cooling') {
      forecastText += `, temp dropping to ${avgTemp.toFixed(0)}°C`;
    } else if (tempTrend === 'warming') {
      forecastText += `, temp rising to ${avgTemp.toFixed(0)}°C`;
    } else {
      forecastText += `, temp around ${avgTemp.toFixed(0)}°C`;
    }

    forecastText += '.';

    // Update UI
    document.getElementById('forecast-icon').textContent = icon;
    document.getElementById('forecast-text').textContent = forecastText;

  } catch (err) {
    console.error('Failed to fetch forecast summary:', err);
    document.getElementById('forecast-text').textContent = 'Unable to load forecast';
  }
}

// Update background based on current sensor data and SMHI
// Update animated weather icon
function updateWeatherIcon(condition) {
  const iconContainer = document.getElementById('main-weather-icon');
  if (!iconContainer) return;
  
  console.log('Setting weather icon to:', condition);
  iconContainer.innerHTML = '';
  
  switch(condition) {
    case 'clear':
    case 'sun':
      iconContainer.innerHTML = '<img src="weather-icons/clear-day.svg" alt="Clear" style="width: 120px; height: 120px;">';
      break;
    
    case 'cloudy':
      iconContainer.innerHTML = '<img src="weather-icons/cloudy.svg" alt="Cloudy" style="width: 120px; height: 120px;">';
      break;
    
    case 'partly-cloudy':
      iconContainer.innerHTML = '<img src="weather-icons/partly-cloudy-day.svg" alt="Partly Cloudy" style="width: 120px; height: 120px;">';
      break;
    
    case 'rain':
      iconContainer.innerHTML = '<img src="weather-icons/rain-light.svg" alt="Rain" style="width: 120px; height: 120px;">';
      break;
    
    case 'snow':
      iconContainer.innerHTML = '<img src="weather-icons/snow.svg" alt="Snow" style="width: 120px; height: 120px;">';
      break;
    
    case 'fog':
      iconContainer.innerHTML = '<img src="weather-icons/fog.svg" alt="Fog" style="width: 120px; height: 120px;">';
      break;
    
    case 'storm':
      iconContainer.innerHTML = '<img src="weather-icons/thunderstorms.svg" alt="Thunderstorms" style="width: 120px; height: 120px;">';
      break;
    
    default:
      iconContainer.innerHTML = '<img src="weather-icons/cloudy.svg" alt="Cloudy" style="width: 120px; height: 120px;">';
  }
}

function updateBackgroundForCurrentWeather(sensor) {
  // Use actual sunrise/sunset if available, otherwise fallback to time-based
  let isNight = false;
  
  if (sunData && sunData.is_night !== undefined) {
    isNight = sunData.is_night;
  } else {
    // Fallback: simple time check
    const hour = new Date().getHours();
    isNight = hour < 6 || hour > 20;
  }
  
  // Toggle night mode class on body
  if (isNight) {
    document.body.classList.add('night-mode');
  } else {
    document.body.classList.remove('night-mode');
  }
  
  // Check weather conditions first (applies day and night)
  // Use SMHI forecast symbol if available
  if (smhiForecast && smhiForecast.symbol) {
    const symbol = smhiForecast.symbol;
    console.log('SMHI Symbol:', symbol, 'Visibility:', smhiForecast.visibility);
    
    // SMHI Weather Symbols:
    // 7 = Fog
    // 5,6 = Rain showers / Rain
    // 8,9 = Snow showers / Snow  
    // 21 = Thunder
    // 15-20 = Various snow/rain/sleet
    
    if (symbol === 7 || (smhiForecast.visibility && smhiForecast.visibility < 1)) {
      console.log('Weather: FOG detected');
      setBackground(isNight ? backgrounds.night : backgrounds.fog);
      updateWeatherIcon('fog');
      weatherState.condition = 'fog';
      return;
    }
    if ([5, 6, 10, 18, 19, 20].includes(symbol)) {
      // Rain symbols - but convert to snow if temp is below freezing
      const temp = Number(sensor.temperature || 5);
      if (temp < 0) {
        console.log('Weather: SNOW detected (rain symbol but temp < 0)');
        setBackground(isNight ? backgrounds.night : backgrounds.snow);
        updateWeatherIcon('snow');
        weatherState.condition = 'snow';
        return;
      }
      console.log('Weather: RAIN detected');
      setBackground(isNight ? backgrounds.night : backgrounds.rain);
      updateWeatherIcon('rain');
      weatherState.condition = 'rain';
      return;
    }
    if ([8, 9, 15, 16, 17].includes(symbol)) {
      console.log('Weather: SNOW detected from SMHI symbol');
      setBackground(isNight ? backgrounds.night : backgrounds.snow);
      updateWeatherIcon('snow');
      weatherState.condition = 'snow';
      return;
    }
    if ([21, 22, 23, 24, 25, 26, 27].includes(symbol)) {
      console.log('Weather: STORM detected');
      setBackground(isNight ? backgrounds.night : backgrounds.storm);
      updateWeatherIcon('storm');
      weatherState.condition = 'storm';
      return;
    }
  }
  
  // Fallback to sensor-based detection
  console.log('Sensor check - Temp:', sensor.temperature, 'Humidity:', sensor.humidity, 'Dew:', sensor.dew_point);
  
  // Check for fog conditions
  if (sensor.dew_point != null && sensor.temperature != null) {
    if (Math.abs(sensor.temperature - sensor.dew_point) < 1.0) {
      console.log('Weather: FOG detected (sensor)');
      setBackground(isNight ? backgrounds.night : backgrounds.fog);
      updateWeatherIcon('fog');
      weatherState.condition = 'fog';
      return;
    }
  }
  
  // Check for storm (low pressure + falling)
  if (sensor.pressure < 985 && sensor.pressure_trend === "falling") {
    console.log('Weather: STORM detected (sensor)');
    setBackground(isNight ? backgrounds.night : backgrounds.storm);
    updateWeatherIcon('storm');
    weatherState.condition = 'storm';
    return;
  }
  
  // Check for snow (cold + humid)
  if (sensor.temperature <= 0 && sensor.humidity > 80) {
    console.log('Weather: SNOW detected (sensor) - cold + humid');
    setBackground(isNight ? backgrounds.night : backgrounds.snow);
    updateWeatherIcon('snow');
    weatherState.condition = 'snow';
    return;
  }
  
  // Check for rain (high humidity)
  if (sensor.humidity > 85) {
    console.log('Weather: RAIN detected (sensor) - high humidity');
    setBackground(isNight ? backgrounds.night : backgrounds.rain);
    updateWeatherIcon('rain');
    weatherState.condition = 'rain';
    return;
  }
  
  // Default to clear (use night background if nighttime)
  console.log('Weather: CLEAR (default)');
  if (isNight) {
    setBackground(backgrounds.night);
  } else {
    setBackground(backgrounds.clear);
  }
  updateWeatherIcon('clear');
  weatherState.condition = 'clear';
}

// Helper function to update weather condition text
function updateWeatherConditionText(ws, sensor) {
  if (!mainConditionEl || !weatherDescEl) return;

  const actualCondition = computeActualCondition(sensor);

  const conditions = {
    storm: {
      title: "Storm with Heavy Rain",
      desc: `High pressure drop detected (${sensor.pressure?.toFixed(1)} hPa). Storm conditions with ${sensor.humidity?.toFixed(0)}% humidity. Strong weather system moving through the area.`
    },
    snowstorm: {
      title: "Snow Storm",
      desc: `Below freezing at ${sensor.temperature?.toFixed(1)}°C with severe weather. Heavy snow and strong winds. Pressure at ${sensor.pressure?.toFixed(1)} hPa.`
    },
    rain: {
      title: "Rainy Weather",
      desc: `Current conditions show rain with ${sensor.humidity?.toFixed(0)}% humidity. Temperature at ${sensor.temperature?.toFixed(1)}°C with precipitation expected.`
    },
    mixed: {
      title: "Mixed Precipitation",
      desc: `Temperature at freezing point (${sensor.temperature?.toFixed(1)}°C). Expect rain, sleet, or snow. Humidity at ${sensor.humidity?.toFixed(0)}%.`
    },
    snow: {
      title: "Snow Conditions",
      desc: `Below freezing at ${sensor.temperature?.toFixed(1)}°C with ${sensor.humidity?.toFixed(0)}% humidity. Snow expected or currently falling.`
    },
    fog: {
      title: "Foggy Conditions",
      desc: `Low visibility due to fog${smhiForecast?.visibility ? ` (${smhiForecast.visibility} km)` : ''}. Humidity at ${sensor.humidity?.toFixed(0)}% with temperature ${sensor.temperature?.toFixed(1)}°C.`
    },
    clear: {
      title: "Clear Conditions",
      desc: `Pleasant weather with ${sensor.temperature?.toFixed(1)}°C and ${sensor.humidity?.toFixed(0)}% humidity. Pressure ${sensor.pressure_trend || "stable"} at ${sensor.pressure?.toFixed(1)} hPa.`
    }
  };

  const condition = conditions[actualCondition] || conditions.clear;
  mainConditionEl.textContent = condition.title;
  weatherDescEl.textContent = condition.desc;
}

// Shared condition computation so Overview matches Outdoor rules
function computeActualCondition(sensor) {
  // Default from derived state
  let actualCondition = (weatherState && weatherState.condition) || 'clear';

  if (!smhiForecast) return actualCondition;

  const symbol = smhiForecast.symbol;
  const visibility = smhiForecast.visibility;
  const temp = Number(sensor.temperature || 0);
  const wind = Number(smhiForecast.wind_speed || 0);
  const pcat = Number(smhiForecast.precipitation || 0); // SMHI precipitation category
  const hasWarning = (currentSmhiData?.warnings || []).length > 0;

  // Fog / low visibility
  if (symbol === 7 || (visibility && visibility < 1)) return 'fog';

  // Rain group (but temp-aware)
  if ([5, 6, 10, 18, 19, 20].includes(symbol)) {
    if (temp < 0) return 'snow';
    if (temp === 0) return 'mixed';
    return 'rain';
  }

  // Snow group
  if ([8, 9, 15, 16, 17].includes(symbol)) return 'snow';

  // Thunder/storm symbols 21-27, temp + wind-aware
  if ([21, 22, 23, 24, 25, 26, 27].includes(symbol)) {
    const strongWind = wind >= 14; // ~50 km/h (near gale)
    if (temp < 0) return strongWind || hasWarning ? 'snowstorm' : 'snow';
    return strongWind || hasWarning ? 'storm' : (pcat > 0 ? 'rain' : 'clear');
  }

  return actualCondition;
}


// ----------------------------------------------------
// FETCH SMHI
// ----------------------------------------------------
async function updateSMHI() {
  try {
    const res = await fetch(`${API}/api/smhi`);
    const data = await res.json();
    currentSmhiData = data;

    if (smhiWarningsEl) {
      smhiWarningsEl.innerHTML = "";
      const warnings = data.warnings || [];

      if (!warnings.length) {
        smhiWarningsEl.innerHTML = `<div class="no-alerts">No active warnings</div>`;
      } else {
        warnings.forEach(w => {
          const alertDiv = document.createElement("div");
          alertDiv.className = "alert-item";
          const levelText = w.level ? w.level.charAt(0).toUpperCase() + w.level.slice(1) : 'Warning';
          alertDiv.innerHTML = `
            <div class="alert-level">${levelText}</div>
            <div class="alert-event">${w.event}</div>
            <div class="alert-time">${w.description || w.headline || ''}</div>
            <div class="alert-time">${w.area || 'Dalarna'} • ${w.from || ''}</div>
          `;
          smhiWarningsEl.appendChild(alertDiv);
        });
      }
    }

    // Update region - show Dalarna if warnings exist, otherwise show nothing or "Ludvika"
    if (smhiRegionEl) {
      const warnings = data.warnings || [];
      if (warnings.length > 0) {
        // Check if warnings are for Dalarna specifically
        smhiRegionEl.textContent = "Dalarna";
      } else {
        smhiRegionEl.textContent = "Ludvika";
      }
    }

    // Apply background based on SMHI symbol
    const symbol = data.symbol ?? 1;
    setBackground(getBackgroundForWeather(symbol, weatherState));

  } catch (err) {
    console.error("Failed /api/smhi", err);
  }
}


// ----------------------------------------------------
// FORECAST TIMELINE
// ----------------------------------------------------
let forecastTimelineChart = null;

async function updateForecastCards() {
  const forecastTimelineCanvas = document.getElementById('forecast-timeline-chart');
  console.log('updateForecastCards called, canvas:', forecastTimelineCanvas);
  if (!forecastTimelineCanvas) {
    console.warn('Forecast timeline canvas not found');
    return;
  }
  
  try {
    // Fetch from backend proxy - use forecast-24h which has timeSeries
    const response = await fetch('/api/forecast-24h');
    const data = await response.json();
    
    console.log('Forecast data fetched:', data.timeSeries ? `${data.timeSeries.length} entries` : 'no timeSeries');
    if (!data.timeSeries || data.timeSeries.length === 0) {
      console.warn('No timeSeries data in forecast response');
      return;
    }
    
    // Get next 24 hours
    const next24Hours = data.timeSeries.slice(0, 24);
    
    const labels = [];
    const temperatures = [];
    const precipitations = [];
    const weatherIcons = [];
    
    next24Hours.forEach(entry => {
      const time = new Date(entry.validTime);
      const hour = time.getHours();
      labels.push(`${hour.toString().padStart(2, '0')}:00`);
      
      // Use params directly (new format from /api/forecast-24h)
      const params = entry.params || {};
      
      temperatures.push(params.t || 0);
      precipitations.push(params.pmean || 0);
      weatherIcons.push(params.Wsymb2 || 1);
    });
    
    // Create or update chart
    if (forecastTimelineChart) {
      console.log('Updating existing chart');
      forecastTimelineChart.data.labels = labels;
      forecastTimelineChart.data.datasets[0].data = temperatures;
      forecastTimelineChart.data.datasets[1].data = precipitations;
      forecastTimelineChart.update();
    } else {
      console.log('Creating new chart with', temperatures.length, 'data points');
      
      // Destroy any existing chart on this canvas first
      const existingChart = Chart.getChart(forecastTimelineCanvas);
      if (existingChart) {
        console.log('Destroying existing chart instance');
        existingChart.destroy();
      }
      
      // Lock canvas dimensions to prevent Chart.js resize loops that blow up height
      forecastTimelineCanvas.height = 250;
      forecastTimelineCanvas.style.height = '250px';
      forecastTimelineCanvas.style.width = '100%';
      const ctx = forecastTimelineCanvas.getContext('2d');
      
      forecastTimelineChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Temperature (°C)',
              data: temperatures,
              borderColor: 'rgba(255, 180, 80, 1)',
              backgroundColor: function(context) {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 250);
                gradient.addColorStop(0, 'rgba(255, 150, 50, 0.4)');
                gradient.addColorStop(0.7, 'rgba(255, 200, 100, 0.15)');
                gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
                return gradient;
              },
              borderWidth: 3,
              tension: 0.4,
              fill: true,
              pointRadius: 5,
              pointHoverRadius: 8,
              pointBackgroundColor: 'rgba(255, 180, 80, 1)',
              pointBorderColor: 'rgba(255, 255, 255, 0.8)',
              pointBorderWidth: 2,
              yAxisID: 'y'
            },
            {
              label: 'Precipitation (mm/h)',
              data: precipitations,
              borderColor: 'rgba(100, 180, 255, 1)',
              backgroundColor: 'rgba(100, 180, 255, 0.2)',
              borderWidth: 2,
              tension: 0.4,
              fill: true,
              pointRadius: 3,
              pointHoverRadius: 6,
              pointBackgroundColor: 'rgba(100, 180, 255, 1)',
              pointBorderColor: 'rgba(255, 255, 255, 0.8)',
              pointBorderWidth: 1,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: 'rgba(255, 255, 255, 0.8)',
                font: {
                  size: 12,
                  weight: '500'
                },
                padding: 15,
                usePointStyle: true,
                pointStyle: 'circle'
              }
            },
            tooltip: {
              backgroundColor: 'rgba(20, 25, 35, 0.95)',
              titleFont: { size: 14, weight: '600' },
              bodyFont: { size: 13 },
              padding: 12,
              cornerRadius: 8,
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
              displayColors: true,
              callbacks: {
                label: function(context) {
                  let label = context.dataset.label || '';
                  if (label) {
                    label += ': ';
                  }
                  if (context.parsed.y !== null) {
                    if (context.datasetIndex === 0) {
                      label += context.parsed.y.toFixed(1) + '°C';
                    } else {
                      label += context.parsed.y.toFixed(1) + ' mm/h';
                    }
                  }
                  return label;
                }
              }
            }
          },
          scales: {
            x: {
              grid: {
                color: 'rgba(255, 255, 255, 0.05)',
                drawBorder: false
              },
              ticks: {
                color: 'rgba(255, 255, 255, 0.7)',
                font: {
                  size: 11
                },
                maxRotation: 0,
                autoSkip: true,
                autoSkipPadding: 10
              }
            },
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              grid: {
                color: 'rgba(255, 255, 255, 0.05)',
                drawBorder: false
              },
              ticks: {
                color: 'rgba(255, 180, 80, 0.9)',
                font: {
                  size: 11,
                  weight: '500'
                },
                callback: function(value) {
                  return value.toFixed(0) + '°';
                }
              },
              title: {
                display: true,
                text: 'Temperature',
                color: 'rgba(255, 180, 80, 0.9)',
                font: {
                  size: 12,
                  weight: '600'
                }
              }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              grid: {
                drawOnChartArea: false,
                drawBorder: false
              },
              ticks: {
                color: 'rgba(100, 180, 255, 0.9)',
                font: {
                  size: 11,
                  weight: '500'
                },
                callback: function(value) {
                  return value.toFixed(1) + ' mm';
                }
              },
              title: {
                display: true,
                text: 'Precipitation',
                color: 'rgba(100, 180, 255, 0.9)',
                font: {
                  size: 12,
                  weight: '600'
                }
              }
            }
          }
        }
      });
      console.log('Chart created successfully');
    }
    
  } catch (err) {
    console.error('Failed to fetch forecast', err);
  }
}

function getWeatherIcon(symbol) {
  // SMHI Weather Symbol mapping - using SVG for compatibility
  const iconMap = {
    1: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" fill="#FDB813"/><path d="M12 1v3m0 16v3M4.22 4.22l2.12 2.12m11.32 11.32l2.12 2.12M1 12h3m16 0h3M4.22 19.78l2.12-2.12m11.32-11.32l2.12-2.12" stroke="#FDB813" stroke-width="2" stroke-linecap="round"/></svg>',  // Clear sky
    2: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="10" r="4" fill="#FDB813"/><path d="M14 14c2 0 4 1 4 3v2H6v-2c0-2 2-3 4-3" fill="#E0E0E0"/></svg>',  // Nearly clear
    3: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#B0BEC5"/></svg>',  // Variable cloudiness
    4: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#90A4AE"/></svg>',  // Cloudy
    5: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#78909C"/></svg>',  // Cloudy sky
    6: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#607D8B"/><path d="M8 19v2m4-2v2m4-2v2" stroke="#5AA9E6" stroke-width="2" stroke-linecap="round"/></svg>',  // Overcast
    7: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><rect x="4" y="8" width="16" height="12" rx="2" fill="#B0BEC5" opacity="0.6"/><rect x="6" y="10" width="12" height="8" rx="1" fill="#CFD8DC" opacity="0.4"/></svg>',  // Fog
    8: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#90A4AE"/><path d="M10 18v3m4-3v3" stroke="#5AA9E6" stroke-width="2" stroke-linecap="round"/></svg>',  // Light rain
    9: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#90A4AE"/><path d="M8 18v3m4-3v3m4-3v3" stroke="#5AA9E6" stroke-width="2" stroke-linecap="round"/></svg>',  // Rain showers
    10: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#607D8B"/><path d="M7 18v4m3-3v4m3-3v4m3-3v4" stroke="#5AA9E6" stroke-width="2" stroke-linecap="round"/></svg>',  // Heavy rain
    11: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#546E7A"/><path d="M12 14l-2 4h2l-1 3 3-5h-2l1-2z" fill="#FFD700"/></svg>',  // Thunderstorm
    12: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#90A4AE"/><circle cx="9" cy="20" r="1" fill="#E0F7FA"/><circle cx="12" cy="20" r="1" fill="#E0F7FA"/><circle cx="15" cy="20" r="1" fill="#E0F7FA"/></svg>',  // Sleet
    13: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#90A4AE"/><circle cx="9" cy="20" r="1" fill="#E0F7FA"/><circle cx="12" cy="20" r="1" fill="#E0F7FA"/><circle cx="15" cy="20" r="1" fill="#E0F7FA"/></svg>',  // Sleet
    14: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#78909C"/><circle cx="9" cy="20" r="1.5" fill="#E0F7FA"/><circle cx="12" cy="20" r="1.5" fill="#E0F7FA"/><circle cx="15" cy="20" r="1.5" fill="#E0F7FA"/></svg>',  // Heavy sleet
    15: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#90A4AE"/><path d="M9 18l1 1.5-1 1.5m3-3l1 1.5-1 1.5m3-3l1 1.5-1 1.5" stroke="#E3F2FD" stroke-width="1.5"/></svg>',  // Light snow
    16: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#78909C"/><path d="M8 18l1.5 1.5L8 21m4-3l1.5 1.5L12 21m4-3l1.5 1.5L16 21" stroke="#E3F2FD" stroke-width="2"/></svg>',  // Snow showers
    17: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#607D8B"/><path d="M7 18l2 2-2 2m4-4l2 2-2 2m4-4l2 2-2 2" stroke="#E3F2FD" stroke-width="2"/></svg>',  // Heavy snow
    18: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#90A4AE"/><path d="M10 18v3m4-3v3" stroke="#5AA9E6" stroke-width="2" stroke-linecap="round"/></svg>',  // Light rain
    19: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#78909C"/><path d="M8 18v3m4-3v3m4-3v3" stroke="#5AA9E6" stroke-width="2" stroke-linecap="round"/></svg>',  // Moderate rain
    20: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#607D8B"/><path d="M7 18v4m3-3v4m3-3v4m3-3v4" stroke="#5AA9E6" stroke-width="2" stroke-linecap="round"/></svg>',  // Heavy rain
    21: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#546E7A"/><path d="M12 14l-2 4h2l-1 3 3-5h-2l1-2z" fill="#FFD700"/></svg>',  // Thunder
    22: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#90A4AE"/><circle cx="9" cy="20" r="1" fill="#E0F7FA"/><circle cx="12" cy="20" r="1" fill="#E0F7FA"/><circle cx="15" cy="20" r="1" fill="#E0F7FA"/></svg>',  // Light sleet
    23: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#78909C"/><circle cx="9" cy="20" r="1.2" fill="#E0F7FA"/><circle cx="12" cy="20" r="1.2" fill="#E0F7FA"/><circle cx="15" cy="20" r="1.2" fill="#E0F7FA"/></svg>',  // Moderate sleet
    24: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#607D8B"/><circle cx="8" cy="20" r="1.5" fill="#E0F7FA"/><circle cx="12" cy="20" r="1.5" fill="#E0F7FA"/><circle cx="16" cy="20" r="1.5" fill="#E0F7FA"/></svg>',  // Heavy sleet
    25: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#90A4AE"/><path d="M9 18l1 1.5-1 1.5m3-3l1 1.5-1 1.5m3-3l1 1.5-1 1.5" stroke="#E3F2FD" stroke-width="1.5"/></svg>',  // Light snowfall
    26: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#78909C"/><path d="M8 18l1.5 1.5L8 21m4-3l1.5 1.5L12 21m4-3l1.5 1.5L16 21" stroke="#E3F2FD" stroke-width="2"/></svg>',  // Moderate snowfall
    27: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#607D8B"/><path d="M7 18l2 2-2 2m4-4l2 2-2 2m4-4l2 2-2 2" stroke="#E3F2FD" stroke-width="2"/></svg>'  // Heavy snowfall
  };
  return iconMap[symbol] || '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#90A4AE" stroke-width="2" fill="none"/></svg>';
}

function getWeatherCondition(symbol) {
  const conditionMap = {
    1: 'Clear',
    2: 'Mostly Clear',
    3: 'Partly Cloudy',
    4: 'Cloudy',
    5: 'Cloudy',
    6: 'Overcast',
    7: 'Fog',
    8: 'Light Rain',
    9: 'Rain Showers',
    10: 'Heavy Rain',
    11: 'Thunderstorm',
    12: 'Light Sleet',
    13: 'Moderate Sleet',
    14: 'Heavy Sleet',
    15: 'Light Snow',
    16: 'Snow Showers',
    17: 'Heavy Snow',
    18: 'Light Rain',
    19: 'Rain',
    20: 'Heavy Rain',
    21: 'Thunder',
    22: 'Light Sleet',
    23: 'Moderate Sleet',
    24: 'Heavy Sleet',
    25: 'Light Snow',
    26: 'Snow',
    27: 'Heavy Snow'
  };
  return conditionMap[symbol] || 'Cloudy';
}

function initChart() {
  if (!weatherChartCanvas) return;
  
  const ctx = weatherChartCanvas.getContext('2d');
  
  // Create gradient for temperature line
  const gradient = ctx.createLinearGradient(0, 0, 0, 150);
  gradient.addColorStop(0, 'rgba(255, 150, 50, 0.6)');
  gradient.addColorStop(0.5, 'rgba(255, 200, 100, 0.3)');
  gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
  
  weatherChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Temperature',
          data: [],
          borderColor: 'rgba(255, 180, 80, 1)',
          backgroundColor: function(context) {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 150);
            gradient.addColorStop(0, 'rgba(255, 150, 50, 0.5)');
            gradient.addColorStop(0.7, 'rgba(255, 200, 100, 0.2)');
            gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
            return gradient;
          },
          borderWidth: 3,
          tension: 0.45,
          fill: true,
          pointRadius: 6,
          pointHoverRadius: 9,
          pointBackgroundColor: 'rgba(255, 180, 80, 1)',
          pointBorderColor: 'rgba(255, 255, 255, 1)',
          pointBorderWidth: 2,
          pointHoverBorderWidth: 3,
          pointShadowOffsetX: 0,
          pointShadowOffsetY: 2,
          pointShadowBlur: 8,
          pointShadowColor: 'rgba(255, 180, 80, 0.5)'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(20, 25, 35, 0.95)',
          titleFont: { size: 15, weight: '700' },
          bodyFont: { size: 14, weight: '600' },
          padding: 16,
          displayColors: false,
          cornerRadius: 12,
          borderColor: 'rgba(255, 180, 80, 0.6)',
          borderWidth: 2,
          callbacks: {
            title: function(context) {
              return context[0].label;
            },
            label: function(context) {
              return context.parsed.y.toFixed(1) + '°C';
            },
          }
        }
      },
      scales: {
        x: {
          display: true,
          grid: { 
            display: false
          },
          ticks: { 
            color: 'rgba(255, 255, 255, 0.95)', 
            font: { size: 12, weight: '700' },
            padding: 12,
            maxRotation: 0,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8
          },
          border: {
            display: false
          }
        },
        y: {
          display: true,
          position: 'left',
          grid: { 
            color: 'rgba(255, 255, 255, 0.08)',
            lineWidth: 1,
            drawBorder: false
          },
          ticks: { 
            color: 'rgba(255, 255, 255, 0.95)', 
            font: { size: 12, weight: '700' },
            padding: 12,
            count: 5,
            callback: function(value) {
              return value.toFixed(0) + '°';
            }
          },
          border: {
            display: false
          }
        }
      }
    }
  });
}

async function updateChart() {
  if (!weatherChart) return;
  
  try {
    const res = await fetch(`${API}/api/history`);
    const data = await res.json();
    
    if (data && data.timestamps && data.timestamps.length > 0) {
      // Convert timestamps to include day name
      const labels = data.timestamps.map((time, index) => {
        // Create a date from hours ago
        const hoursAgo = data.timestamps.length - 1 - index;
        const date = new Date();
        date.setHours(date.getHours() - hoursAgo);
        
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        return `${dayName} ${time}`;
      });
      
      weatherChart.data.labels = labels;
      const temps = data.temperature || [];
      weatherChart.data.datasets[0].data = temps;
      
      // Find min and max values
      if (temps.length > 0) {
        const minTemp = Math.min(...temps);
        const maxTemp = Math.max(...temps);
        const minIndex = temps.indexOf(minTemp);
        const maxIndex = temps.indexOf(maxTemp);
        
        // Update chart options with min/max labels
        weatherChart.options.plugins.tooltip.callbacks.afterTitle = function() {
          return `Min: ${minTemp.toFixed(1)}°C  |  Max: ${maxTemp.toFixed(1)}°C`;
        };
        
        // Add special styling to min/max points
        weatherChart.data.datasets[0].pointBackgroundColor = temps.map((temp, i) => {
          if (i === minIndex) return 'rgba(100, 180, 255, 1)'; // Blue for min
          if (i === maxIndex) return 'rgba(255, 100, 80, 1)'; // Red for max
          return 'rgba(255, 180, 80, 1)'; // Default orange
        });
        
        weatherChart.data.datasets[0].pointRadius = temps.map((temp, i) => {
          if (i === minIndex || i === maxIndex) return 8; // Larger for min/max
          return 6; // Default size
        });
        
        weatherChart.data.datasets[0].pointBorderWidth = temps.map((temp, i) => {
          if (i === minIndex || i === maxIndex) return 3; // Thicker border for min/max
          return 2; // Default border
        });
      }
      
      weatherChart.update('none'); // Update without animation for performance
    }
  } catch (err) {
    console.error("Failed to update chart", err);
  }
}

// ----------------------------------------------------
// STARTUP
// ----------------------------------------------------
async function initializeApp() {
  console.log('initializeApp called');
  
  const loadingScreen = document.getElementById('loading-screen');
  const loadingText = document.querySelector('.loading-text');
  
  const updateLoadingText = (text) => {
    if (loadingText) {
      loadingText.textContent = text;
      console.log('Loading step:', text);
    }
  };
  
  const hideLoading = () => {
    if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
      console.log('Hiding loading screen');
      loadingScreen.classList.add('hidden');
    }
  };
  
  // Fallback: ensure loading screen hides even if a fetch fails
  const fallbackTimeout = setTimeout(() => {
    console.warn('Loading timeout - hiding screen');
    hideLoading();
  }, 8000);

  try {
    updateLoadingText('Initializing...');
    initScene();
    // initCinematicFog(); // Disabled - conflicts with main scene renderer

    // Set default background immediately
    setBackground(backgrounds.clear);

    // Load critical data first before starting intervals
    updateLoadingText('Fetching weather data...');
    try {
      await Promise.race([
        Promise.all([
          updateSunTimes(),
          updateSMHIForecast(),
          updateSMHI()
        ]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Initial data fetch timeout')), 5000))
      ]);
    } catch (e) {
      console.error('Initial data fetch failed:', e);
      // Continue anyway with whatever we have
    }
    
    // Now update with current data
    updateLoadingText('Loading sensor data...');
    try {
      await Promise.race([
        updateData(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Sensor data timeout')), 5000))
      ]);
    } catch (e) {
      console.error('Sensor data fetch failed:', e);
    }
    
    updateLoadingText('Preparing forecast...');
    updateForecastCards();
    updateMoonPhase();
    updateAuroraData();
    
    // Update Overview page immediately since it's the default tab
    updateLoadingText('Finalizing...');
    try {
      await updateOverviewPage();
    } catch (e) {
      console.error('Overview page update failed:', e);
      // Continue anyway
    }
    
    // Clear the fallback timeout
    clearTimeout(fallbackTimeout);
    
    // Keep loading screen for a moment to show completion
    updateLoadingText('Ready!');
    setTimeout(hideLoading, 500);
  } catch (e) {
    console.error('Startup error', e);
    // Make sure we hide loading screen even on error
    setTimeout(hideLoading, 1000);
    clearTimeout(fallbackTimeout);
    updateLoadingText('Error loading data');
    setTimeout(hideLoading, 1000);
  }

  // Consolidated update loop - single interval with counters
  let updateCounter = 0;
  setInterval(() => {
    updateCounter++;
    
    // Every 10 seconds: sensor data
    if (updateCounter % 1 === 0) updateData();

    // Every 30 seconds: refresh Overview page (hero + comparisons + sparklines)
    if (updateCounter % 3 === 0) updateOverviewPage();
    
    // Every 1 minute: sun position
    if (updateCounter % 6 === 0) updateSunPosition();
    
    // Every 5 minutes: SMHI weather and aurora data
    if (updateCounter % 30 === 0) {
      updateSMHI();
      updateSMHIForecast();
      updateAuroraData();  // OVATION model updates every ~15 min, so check every 5 min
    }
    
    // Every 1 hour: forecasts, sun/moon
    if (updateCounter % 360 === 0) {
      updateForecastCards();
      updateSunTimes();
      updateMoonPhase();
      updateCounter = 0; // Reset to prevent overflow
    }
  }, 10000); // Base interval: 10 seconds
}

// Start the app when DOM is ready
console.log('app.js module loaded, document.readyState:', document.readyState);
if (document.readyState === 'loading') {
  console.log('Document still loading, adding DOMContentLoaded listener');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired');
    initializeApp();
  });
} else {
  // DOM is already loaded
  console.log('DOM already loaded, calling initializeApp immediately');
  initializeApp();
}

// Helper function to update semicircular gauge arc
function updateGaugeArc(arcId, percentage) {
  const arc = document.getElementById(arcId);
  if (!arc) return;
  
  // Arc length is 125.6 (half circle with radius 40)
  const circumference = 125.6;
  const offset = circumference - (percentage / 100) * circumference;
  arc.style.strokeDashoffset = offset;
}

// Update Northern Lights / Aurora data
async function updateAuroraData() {
  try {
    const response = await fetch(`${API}/api/aurora`);
    const data = await response.json();
    
    // KP Index Badge
    const kpElement = document.getElementById('kp-value');
    if (kpElement) {
      kpElement.textContent = data.kp_index;
      const kpBadge = kpElement.parentElement;
      kpBadge.className = 'aurora-kp-badge';
      if (data.kp_index >= 5) kpBadge.classList.add('kp-active');
      else if (data.kp_index >= 3) kpBadge.classList.add('kp-moderate');
      else kpBadge.classList.add('kp-quiet');
    }
    
    // Main Probability
    const probElement = document.getElementById('aurora-probability');
    if (probElement) probElement.textContent = `${Math.round(data.probability)}%`;
    
    // OVATION Model Probability
    const ovationElement = document.getElementById('ovation-probability');
    const ovationTimeElement = document.getElementById('ovation-update-time');
    if (ovationElement) {
      const ovationProb = data.ovation_probability || 0;
      ovationElement.textContent = `${Math.round(ovationProb)}%`;
      ovationElement.style.color = ovationProb >= 50 ? '#4ade80' : (ovationProb >= 25 ? '#fbbf24' : '#ffffff');
    }
    if (ovationTimeElement && data.ovation_forecast_time) {
      const forecastTime = new Date(data.ovation_forecast_time);
      const now = new Date();
      const minutesAgo = Math.floor((now - forecastTime) / 60000);
      ovationTimeElement.textContent = `Updated ${minutesAgo} min ago`;
    }
    
    // Probability Breakdown Bars
    const geomagBar = document.getElementById('geomag-bar');
    const geomagPercent = document.getElementById('geomag-percent');
    if (geomagBar && geomagPercent) {
      const geomagProb = data.geomagnetic_probability || 0;
      geomagBar.style.width = `${geomagProb}%`;
      geomagBar.className = 'breakdown-fill';
      if (geomagProb >= 50) geomagBar.classList.add('bar-high');
      else if (geomagProb >= 25) geomagBar.classList.add('bar-medium');
      else geomagBar.classList.add('bar-low');
      geomagPercent.textContent = `${Math.round(geomagProb)}%`;
    }
    
    const weatherBar = document.getElementById('weather-bar');
    const weatherPercent = document.getElementById('weather-percent');
    if (weatherBar && weatherPercent) {
      const weatherFactor = data.weather_factor || 0;
      weatherBar.style.width = `${weatherFactor}%`;
      weatherBar.className = 'breakdown-fill';
      if (weatherFactor >= 50) weatherBar.classList.add('bar-high');
      else if (weatherFactor >= 25) weatherBar.classList.add('bar-medium');
      else weatherBar.classList.add('bar-low');
      weatherPercent.textContent = `${Math.round(weatherFactor)}%`;
    }
    
    // Solar Wind Metric
    const solarWindValue = document.getElementById('solar-wind-value');
    const solarWindStatus = document.getElementById('solar-wind-status');
    if (solarWindValue && solarWindStatus) {
      const speed = data.solar_wind_speed;
      solarWindValue.textContent = `${Math.round(speed)} km/s`;
      if (speed >= 500) {
        solarWindStatus.textContent = 'Fast - Aurora likely';
        solarWindStatus.className = 'metric-status status-good';
      } else if (speed >= 400) {
        solarWindStatus.textContent = 'Moderate - Possible';
        solarWindStatus.className = 'metric-status status-ok';
      } else {
        solarWindStatus.textContent = 'Slow - Unlikely';
        solarWindStatus.className = 'metric-status status-bad';
      }
    }
    
    // Bz Component Metric
    const bzValue = document.getElementById('bz-value');
    const bzStatus = document.getElementById('bz-status');
    if (bzValue && bzStatus) {
      const bz = data.bz_component;
      const direction = bz < 0 ? '↓S' : '↑N';
      bzValue.textContent = `${bz.toFixed(1)} nT ${direction}`;
      if (bz < -5) {
        bzStatus.textContent = 'Strong South - Excellent!';
        bzStatus.className = 'metric-status status-good';
      } else if (bz < 0) {
        bzStatus.textContent = 'South - Good';
        bzStatus.className = 'metric-status status-ok';
      } else {
        bzStatus.textContent = 'North - Unfavorable';
        bzStatus.className = 'metric-status status-bad';
      }
    }
    
    // Cloud Cover Metric
    const cloudValue = document.getElementById('cloud-value');
    const cloudStatus = document.getElementById('cloud-status');
    if (cloudValue && cloudStatus) {
      const clouds = data.cloud_coverage;
      cloudValue.textContent = `${clouds}/8`;
      if (clouds <= 2) {
        cloudStatus.textContent = 'Clear - Excellent';
        cloudStatus.className = 'metric-status status-good';
      } else if (clouds <= 5) {
        cloudStatus.textContent = 'Partly Cloudy';
        cloudStatus.className = 'metric-status status-ok';
      } else {
        cloudStatus.textContent = 'Overcast - Blocked';
        cloudStatus.className = 'metric-status status-bad';
      }
    }
    
    // Visibility Metric
    const visValue = document.getElementById('visibility-value');
    const visStatus = document.getElementById('visibility-status');
    if (visValue && visStatus) {
      const vis = data.visibility_km;
      const clouds = data.cloud_coverage;
      visValue.textContent = `${vis.toFixed(1)} km`;
      
      // If overcast, visibility doesn't matter for aurora
      if (clouds >= 7) {
        visStatus.textContent = 'Sky Blocked by Clouds';
        visStatus.className = 'metric-status status-bad';
      } else if (vis >= 10) {
        visStatus.textContent = 'Excellent';
        visStatus.className = 'metric-status status-good';
      } else if (vis >= 5) {
        visStatus.textContent = 'Good';
        visStatus.className = 'metric-status status-ok';
      } else {
        visStatus.textContent = 'Poor - Fog/Haze';
        visStatus.className = 'metric-status status-bad';
      }
    }
    
    // Activity Description
    const activityDesc = document.getElementById('activity-description');
    if (activityDesc) {
      const kp = data.kp_index;
      const prob = data.probability;
      let desc = '';
      if (prob >= 50) {
        desc = `🎉 HIGH CHANCE! ${data.activity} geomagnetic activity with favorable viewing conditions. Go outside and look north!`;
      } else if (kp >= 5) {
        desc = `⚡ ${data.activity} geomagnetic storm detected! However, local weather is blocking visibility. Check back when skies clear.`;
      } else if (prob >= 10) {
        desc = `🌟 Possible aurora visibility. ${data.activity} space weather with ${Math.round(data.weather_factor)}% clear sky probability.`;
      } else if (data.cloud_coverage >= 7) {
        desc = `☁️ Space weather is ${data.activity.toLowerCase()} (KP ${kp}), but overcast conditions prevent any aurora viewing.`;
      } else {
        desc = `😴 ${data.activity} geomagnetic conditions (KP ${kp}). Aurora unlikely at this latitude. Check back during solar storms.`;
      }
      activityDesc.textContent = desc;
    }
    
  } catch (error) {
    console.error('Error fetching aurora data:', error);
  }
}

// ==========================================
// INDOOR PAGE UPDATE
// ==========================================
async function updateIndoorPage() {
  try {
    const response = await fetch(`${API}/api/indoor`);
    const data = await response.json();
    
    // Climate metrics
    if (document.getElementById('indoor-temp')) {
      document.getElementById('indoor-temp').textContent = `${data.temperature}°C`;
    }
    if (document.getElementById('indoor-humidity')) {
      document.getElementById('indoor-humidity').textContent = `${data.humidity}%`;
    }
    if (document.getElementById('indoor-dewpoint')) {
      document.getElementById('indoor-dewpoint').textContent = `${data.dew_point}°C`;
    }
    if (document.getElementById('indoor-pressure')) {
      document.getElementById('indoor-pressure').textContent = `${data.pressure} hPa`;
    }
    
    // CO2 levels
    const co2Value = document.getElementById('co2-value');
    const co2Status = document.getElementById('co2-status');
    const co2Bar = document.getElementById('co2-bar');
    if (co2Value && data.eco2 !== null) {
      co2Value.textContent = `${data.eco2} ppm`;
      const co2Percent = Math.min((data.eco2 / 5000) * 100, 100);
      co2Bar.style.width = `${co2Percent}%`;
      
      if (data.eco2 > 2000) {
        co2Status.textContent = 'Poor - Ventilate!';
        co2Status.className = 'air-metric-status danger';
      } else if (data.eco2 > 1000) {
        co2Status.textContent = 'Elevated';
        co2Status.className = 'air-metric-status warning';
      } else {
        co2Status.textContent = 'Good';
        co2Status.className = 'air-metric-status';
      }
    }
    
    // TVOC levels
    const tvocValue = document.getElementById('tvoc-value');
    const tvocStatus = document.getElementById('tvoc-status');
    const tvocBar = document.getElementById('tvoc-bar');
    if (tvocValue && data.tvoc !== null) {
      tvocValue.textContent = `${data.tvoc} ppb`;
      const tvocPercent = Math.min((data.tvoc / 1000) * 100, 100);
      tvocBar.style.width = `${tvocPercent}%`;
      
      if (data.tvoc > 500) {
        tvocStatus.textContent = 'Poor';
        tvocStatus.className = 'air-metric-status danger';
      } else if (data.tvoc > 220) {
        tvocStatus.textContent = 'Moderate';
        tvocStatus.className = 'air-metric-status warning';
      } else {
        tvocStatus.textContent = 'Good';
        tvocStatus.className = 'air-metric-status';
      }
    }
    
    // Warnings
    const warningsEl = document.getElementById('indoor-warnings');
    if (warningsEl && data.air_quality_warnings) {
      if (data.air_quality_warnings.length === 0) {
        warningsEl.innerHTML = '<div class="no-warnings">✓ All parameters normal</div>';
      } else {
        const warningMessages = {
          'high_co2': '🔴 CO₂ levels are high! Open windows to ventilate.',
          'elevated_co2': '⚠️ CO₂ levels are elevated. Consider ventilating.',
          'high_tvoc': '🔴 High volatile organic compounds detected!',
          'elevated_tvoc': '⚠️ Elevated TVOC levels detected.',
          'high_humidity': '💧 Humidity is high - risk of mold growth.',
          'low_humidity': '🏜️ Low humidity - may cause dry skin and irritation.',
          'condensation_risk': '❄️ Condensation risk - check windows.'
        };
        
        warningsEl.innerHTML = data.air_quality_warnings.map(warning => {
          const isDanger = warning.includes('high');
          const className = isDanger ? 'warning-item danger' : 'warning-item';
          return `<div class="${className}">${warningMessages[warning] || warning}</div>`;
        }).join('');
      }
    }
    
  } catch (error) {
    console.error('Error fetching indoor data:', error);
  }
}

// ==========================================
// WELCOME HEADER UPDATE
// ==========================================
function updateWelcomeHeader(outdoor, smhi) {
  // Update greeting based on time of day
  const now = new Date();
  const hour = now.getHours();
  let greeting = 'Good Evening';
  if (hour >= 5 && hour < 12) greeting = 'Good Morning';
  else if (hour >= 12 && hour < 18) greeting = 'Good Afternoon';
  
  const greetingEl = document.getElementById('welcome-greeting');
  if (greetingEl) greetingEl.textContent = greeting;
  
  // Update date and time
  const timeEl = document.getElementById('welcome-time');
  if (timeEl) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    timeEl.textContent = now.toLocaleDateString('en-US', options);
  }
  
  // Update hero weather icon based on unified condition
  const heroIcon = document.getElementById('hero-weather-icon');
  if (heroIcon) {
    const cond = computeActualCondition(outdoor);
    const iconMap = {
      clear: '☀️',
      fog: '🌫️',
      rain: '🌧️',
      mixed: '🌦️',
      snow: '❄️',
      snowstorm: '❄️',
      storm: '⛈️',
      cloudy: '☁️',
      overcast: '☁️'
    };
    heroIcon.textContent = iconMap[cond] || '🌤️';
  }
  
  // Store outdoor temperature globally for weather animation decisions
  if (typeof outdoor.temperature !== 'undefined') {
    window.currentOutdoorTemp = outdoor.temperature;
  }
  
  // Update hero temperature
  const heroTemp = document.getElementById('hero-temp');
  if (heroTemp) heroTemp.textContent = `${outdoor.temperature}°C`;
  
  // Update condition text
  const heroCondition = document.getElementById('hero-condition');
  if (heroCondition) {
    const key = computeActualCondition(outdoor);
    const mapText = {
      clear: 'Clear',
      fog: 'Fog',
      rain: 'Rain',
      mixed: 'Mixed Precipitation',
      snow: 'Snow',
      snowstorm: 'Snow Storm',
      storm: 'Storm',
      cloudy: 'Cloudy',
      overcast: 'Overcast'
    };
    heroCondition.textContent = mapText[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : '');
  }
  
  // Calculate and display feels like temperature
  const heroFeels = document.getElementById('hero-feels');
  if (heroFeels) {
    const temp = outdoor.temperature;
    const humidity = outdoor.humidity;
    const wind = outdoor.wind_speed || 0;
    
    // Simple feels-like calculation
    let feelsLike = temp;
    if (temp <= 10 && wind > 5) {
      // Wind chill for cold weather
      feelsLike = 13.12 + 0.6215 * temp - 11.37 * Math.pow(wind * 3.6, 0.16) + 
                  0.3965 * temp * Math.pow(wind * 3.6, 0.16);
    } else if (temp >= 27) {
      // Heat index for hot weather
      const rh = humidity;
      feelsLike = -8.78469475556 + 1.61139411 * temp + 2.33854883889 * rh +
                  -0.14611605 * temp * rh + -0.012308094 * temp * temp +
                  -0.0164248277778 * rh * rh + 0.002211732 * temp * temp * rh +
                  0.00072546 * temp * rh * rh + -0.000003582 * temp * temp * rh * rh;
    }
    heroFeels.textContent = `Feels like ${feelsLike.toFixed(1)}°C`;
  }
  
  // Update hero metrics
  const heroHumidity = document.getElementById('hero-humidity');
  if (heroHumidity) heroHumidity.textContent = `${outdoor.humidity}%`;
  
  const heroPressure = document.getElementById('hero-pressure');
  if (heroPressure) heroPressure.textContent = `${outdoor.pressure} hPa`;
  
  const heroWind = document.getElementById('hero-wind');
  if (heroWind) heroWind.textContent = `${(outdoor.wind_speed || 0).toFixed(1)} m/s`;
  
  // Show active alerts if any
  const alertsContainer = document.getElementById('active-alerts');
  const alertText = document.getElementById('alert-text');
  if (alertsContainer && alertText && smhi && smhi.warnings) {
    if (smhi.warnings.length > 0) {
      const highestWarning = smhi.warnings.sort((a, b) => b.severity - a.severity)[0];
      alertText.textContent = `${highestWarning.event}: ${highestWarning.description}`;
      alertsContainer.style.display = 'flex';
    } else {
      alertsContainer.style.display = 'none';
    }
  }
}

// ==========================================
// OVERVIEW PAGE UPDATE
// ==========================================
async function updateOverviewPage() {
  try {
    // Call the new overview update function (from overview-new.js)
    if (typeof updateNewOverviewPage === 'function') {
      await updateNewOverviewPage();
    } else {
      console.warn('updateNewOverviewPage function not found');
    }
    
  } catch (error) {
    console.error('Error updating overview page:', error);
  }
}

// ==========================================
// COMPARISON PAGE UPDATE
// ==========================================
async function updateComparisonPage() {
  try {
    // Fetch current indoor and outdoor data
    const [outdoorRes, indoorRes] = await Promise.all([
      fetch(`${API}/api/current`),
      fetch(`${API}/api/indoor`)
    ]);
    
    const outdoor = await outdoorRes.json();
    const indoor = await indoorRes.json();
    
    // Update temperature comparison
    const indoorTempEl = document.getElementById('overview-indoor-temp');
    const outdoorTempEl = document.getElementById('overview-outdoor-temp');
    if (indoorTempEl) indoorTempEl.textContent = `${indoor.temperature?.toFixed(1) || '--'}°C`;
    if (outdoorTempEl) outdoorTempEl.textContent = `${outdoor.temperature?.toFixed(1) || '--'}°C`;
    
    // Update humidity comparison
    const indoorHumEl = document.getElementById('overview-indoor-humidity');
    const outdoorHumEl = document.getElementById('overview-outdoor-humidity');
    if (indoorHumEl) indoorHumEl.textContent = `${indoor.humidity?.toFixed(0) || '--'}%`;
    if (outdoorHumEl) outdoorHumEl.textContent = `${outdoor.humidity?.toFixed(0) || '--'}%`;
    
    // Update pressure comparison
    const indoorPressEl = document.getElementById('overview-indoor-pressure');
    const outdoorPressEl = document.getElementById('overview-outdoor-pressure');
    if (indoorPressEl) indoorPressEl.textContent = `${indoor.pressure?.toFixed(0) || '--'} hPa`;
    if (outdoorPressEl) outdoorPressEl.textContent = `${outdoor.pressure?.toFixed(0) || '--'} hPa`;
    
    // Update trend arrows
    updateTrendArrow('trend-temp-indoor', 'trend-temp-outdoor', indoor.temperature, outdoor.temperature);
    updateTrendArrow('trend-hum-indoor', 'trend-hum-outdoor', indoor.humidity, outdoor.humidity);
    updateTrendArrow('trend-press-indoor', 'trend-press-outdoor', indoor.pressure, outdoor.pressure);
    
    // Draw sparklines
    await drawSparklines();
    
  } catch (error) {
    console.error('Error updating comparison page:', error);
  }
}

function updateTrendArrow(indoorId, outdoorId, indoorVal, outdoorVal) {
  const indoorEl = document.getElementById(indoorId);
  const outdoorEl = document.getElementById(outdoorId);
  if (!indoorEl || !outdoorEl) return;
  
  if (indoorVal > outdoorVal) {
    indoorEl.textContent = '▲';
    indoorEl.className = 'trend-arrow trend-up';
    outdoorEl.textContent = '▼';
    outdoorEl.className = 'trend-arrow trend-down';
  } else if (indoorVal < outdoorVal) {
    indoorEl.textContent = '▼';
    indoorEl.className = 'trend-arrow trend-down';
    outdoorEl.textContent = '▲';
    outdoorEl.className = 'trend-arrow trend-up';
  } else {
    indoorEl.textContent = '■';
    indoorEl.className = 'trend-arrow trend-flat';
    outdoorEl.textContent = '■';
    outdoorEl.className = 'trend-arrow trend-flat';
  }
}

// Draw mini sparkline charts
async function drawSparklines() {
  try {
    // Fetch 24h history for both indoor and outdoor
    const [outdoorRes, indoorRes] = await Promise.all([
      fetch(`${API}/api/history?range=24h`),
      fetch(`${API}/api/indoor-history?range=24h`)
    ]);
    
    const outdoor = await outdoorRes.json();
    const indoor = await indoorRes.json();
    
    // Helper to draw a sparkline
    const drawSparkline = (canvasId, data, color) => {
      const canvas = document.getElementById(canvasId);
      if (!canvas || !data || data.length === 0) return;
      
      const ctx = canvas.getContext('2d');
      
      // Use display size for actual rendering
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Set actual canvas size to match CSS size * device pixel ratio
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      // Scale context to match device pixel ratio
      ctx.scale(dpr, dpr);
      
      const width = rect.width;
      const height = rect.height;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Find min/max for scaling
      const values = data.filter(v => v !== null && v !== undefined);
      if (values.length === 0) return;
      
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min || 1;
      
      // Draw line
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      
      values.forEach((value, i) => {
        const x = (i / (values.length - 1)) * width;
        const y = height - ((value - min) / range) * (height - 4) - 2;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
      
      // Draw subtle fill
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = color + '20'; // 20% opacity
      ctx.fill();
    };
    
    // Draw outdoor sparklines
    drawSparkline('spark-temp-outdoor', outdoor.temperature, '#60a5fa');
    drawSparkline('spark-hum-outdoor', outdoor.humidity, '#34d399');
    drawSparkline('spark-press-outdoor', outdoor.pressure, '#a78bfa');
    
    // Draw indoor sparklines
    drawSparkline('spark-temp-indoor', indoor.temperature, '#f87171');
    drawSparkline('spark-hum-indoor', indoor.humidity, '#fbbf24');
    drawSparkline('spark-press-indoor', indoor.pressure, '#fb923c');
    
  } catch (error) {
    console.error('Error drawing sparklines:', error);
  }
}

// ============================================================
// HISTORY MODAL
// ============================================================
let currentChart = null;
let currentMetric = null;
let currentRange = '24h';

function setupHistoryModal() {
  const modal = document.getElementById('history-modal');
  const closeBtn = document.getElementById('modal-close-btn');
  
  // Close on X button
  closeBtn.addEventListener('click', () => {
    closeModal();
  });
  
  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });
  
  // Add click handlers to all metrics
  document.querySelectorAll('.clickable').forEach(element => {
    element.addEventListener('click', () => {
      const metric = element.getAttribute('data-metric');
      if (metric) {
        currentRange = '24h'; // Reset to 24h when opening
        showHistoryModal(metric, currentRange);
      }
    });
  });
  
  // Add click handlers to range buttons
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const range = btn.getAttribute('data-range');
      currentRange = range;
      
      // Update active state
      document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Reload chart with new range
      if (currentMetric) {
        showHistoryModal(currentMetric, range);
      }
    });
  });
}

function closeModal() {
  const modal = document.getElementById('history-modal');
  modal.classList.remove('active');
  
  // Destroy chart when closing
  if (currentChart) {
    currentChart.destroy();
    currentChart = null;
  }
  
  currentMetric = null;
  currentRange = '24h';
  
  // Reset range buttons
  document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.range-btn[data-range="24h"]').classList.add('active');
}

async function showHistoryModal(metric, range = '24h') {
  currentMetric = metric;
  currentRange = range;
  
  const modal = document.getElementById('history-modal');
  const title = document.getElementById('modal-title');
  const canvas = document.getElementById('history-chart');
  const averageValueEl = document.getElementById('average-value');
  
  // Range labels for title
  const rangeLabels = {
    '24h': '24 Hours',
    '2d': '2 Days',
    '4d': '4 Days',
    '1w': '1 Week',
    '1m': '1 Month'
  };
  
  // Metric configuration
  const metricConfig = {
    temperature: {
      title: 'Temperature',
      unit: '°C',
      color: 'rgb(96, 165, 250)',
      borderColor: 'rgba(96, 165, 250, 0.8)',
      backgroundColor: 'rgba(96, 165, 250, 0.1)',
      field: 'temperature'
    },
    humidity: {
      title: 'Humidity',
      unit: '%',
      color: 'rgb(34, 197, 94)',
      borderColor: 'rgba(34, 197, 94, 0.8)',
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      field: 'humidity',
      suggestedMin: 0,
      suggestedMax: 100
    },
    dewpoint: {
      title: 'Dew Point',
      unit: '°C',
      color: 'rgb(168, 85, 247)',
      borderColor: 'rgba(168, 85, 247, 0.8)',
      backgroundColor: 'rgba(168, 85, 247, 0.1)',
      field: 'temperature'  // Use temp for dew point calculation
    },
    pressure: {
      title: 'Pressure',
      unit: 'hPa',
      color: 'rgb(251, 191, 36)',
      borderColor: 'rgba(251, 191, 36, 0.8)',
      backgroundColor: 'rgba(251, 191, 36, 0.1)',
      field: 'pressure'
    },
    co2: {
      title: 'CO₂ Level',
      unit: 'ppm',
      color: 'rgb(239, 68, 68)',
      borderColor: 'rgba(239, 68, 68, 0.8)',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      field: 'eco2',
      thresholds: [
        { value: 1000, color: 'rgba(251, 191, 36, 0.3)', label: 'Elevated' },
        { value: 2000, color: 'rgba(239, 68, 68, 0.3)', label: 'High' }
      ]
    },
    tvoc: {
      title: 'TVOC',
      unit: 'ppb',
      color: 'rgb(236, 72, 153)',
      borderColor: 'rgba(236, 72, 153, 0.8)',
      backgroundColor: 'rgba(236, 72, 153, 0.1)',
      field: 'tvoc',
      thresholds: [
        { value: 220, color: 'rgba(251, 191, 36, 0.3)', label: 'Moderate' },
        { value: 500, color: 'rgba(239, 68, 68, 0.3)', label: 'High' }
      ]
    }
  };
  
  const config = metricConfig[metric];
  if (!config) return;
  
  title.textContent = `${config.title} - ${rangeLabels[range]}`;
  modal.classList.add('active');
  
  // Show loading state
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '16px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('Loading data...', canvas.width / 2, canvas.height / 2);
  
  try {
    // Fetch history data with range parameter
    const response = await fetch(`/api/indoor-history?range=${range}`);
    const data = await response.json();
    
    if (!data.timestamps || data.timestamps.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
      averageValueEl.textContent = '--';
      return;
    }
    
    // Prepare chart data
    const chartData = data[config.field] || [];
    
    // Calculate average
    const validValues = chartData.filter(v => v !== null && v !== undefined);
    const average = validValues.length > 0 
      ? (validValues.reduce((sum, v) => sum + v, 0) / validValues.length).toFixed(1)
      : '--';
    averageValueEl.textContent = `${average} ${config.unit}`;
    
    // Destroy previous chart
    if (currentChart) {
      currentChart.destroy();
    }
    
    // Create new chart
    currentChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.timestamps,
        datasets: [{
          label: config.unit,
          data: chartData,
          borderColor: config.borderColor,
          backgroundColor: config.backgroundColor,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: config.color,
          pointBorderColor: 'rgba(255, 255, 255, 0.8)',
          pointBorderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#60a5fa',
            bodyColor: '#fff',
            borderColor: 'rgba(96, 165, 250, 0.3)',
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: function(context) {
                return `${context.parsed.y} ${config.unit}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              drawBorder: false
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.6)',
              maxRotation: 45,
              minRotation: 0
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              drawBorder: false
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.6)',
              callback: function(value) {
                return value + ' ' + config.unit;
              }
            },
            suggestedMin: config.suggestedMin,
            suggestedMax: config.suggestedMax
          }
        }
      }
    });
    
    // Add threshold lines if configured
    if (config.thresholds && currentChart) {
      config.thresholds.forEach((threshold, index) => {
        const annotation = {
          type: 'line',
          yMin: threshold.value,
          yMax: threshold.value,
          borderColor: threshold.color.replace('0.3', '0.8'),
          borderWidth: 2,
          borderDash: [5, 5],
          label: {
            content: threshold.label,
            enabled: true,
            position: 'end',
            backgroundColor: threshold.color,
            color: '#fff'
          }
        };
        // Note: Chart.js annotations require the chartjs-plugin-annotation plugin
        // For now, thresholds are just color-coded in the config
      });
    }
    
  } catch (error) {
    console.error('Error loading history:', error);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText('Error loading data', canvas.width / 2, canvas.height / 2);
    averageValueEl.textContent = '--';
  }
}

// Add indoor data updates to the main interval
const originalInterval = setInterval;
window.setInterval = function(...args) {
  if (args[1] === 10000 && args[0].toString().includes('updateCounter')) {
    // Wrap the original function to also update indoor/overview
    const originalFn = args[0];
    args[0] = function() {
      originalFn();
      
      // Update active tab
      const activeTab = document.querySelector('.tab-content.active');
      if (activeTab) {
        const tabId = activeTab.id;
        if (tabId === 'indoor-content') {
          updateIndoorPage();
        } else if (tabId === 'overview-content') {
          updateOverviewPage();
        }
      }
    };
  }
  return originalInterval.apply(this, args);
};

// ============================================================
// ANALYTICS PAGE - Professional Dashboard
// ============================================================
let analyticsChart = null;
let currentAnalyticsSource = 'indoor';
let currentAnalyticsMetric = 'temperature';
let currentAnalyticsRange = '24h';

const metricConfigs = {
  temperature: {
    title: 'Temperature',
    icon: '🌡️',
    field: 'temperature',
    unit: '°C',
    color: 'rgba(96, 165, 250, 1)',
    bgColor: 'rgba(96, 165, 250, 0.15)',
    gradientStart: 'rgba(96, 165, 250, 0.4)',
    gradientEnd: 'rgba(96, 165, 250, 0.0)'
  },
  humidity: {
    title: 'Humidity',
    icon: '💧',
    field: 'humidity',
    unit: '%',
    color: 'rgba(34, 197, 94, 1)',
    bgColor: 'rgba(34, 197, 94, 0.15)',
    gradientStart: 'rgba(34, 197, 94, 0.4)',
    gradientEnd: 'rgba(34, 197, 94, 0.0)'
  },
  pressure: {
    title: 'Pressure',
    icon: '🎈',
    field: 'pressure',
    unit: 'hPa',
    color: 'rgba(251, 191, 36, 1)',
    bgColor: 'rgba(251, 191, 36, 0.15)',
    gradientStart: 'rgba(251, 191, 36, 0.4)',
    gradientEnd: 'rgba(251, 191, 36, 0.0)'
  },
  co2: {
    title: 'CO₂',
    icon: '🌬️',
    field: 'eco2',
    unit: 'ppm',
    color: 'rgba(239, 68, 68, 1)',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    gradientStart: 'rgba(239, 68, 68, 0.4)',
    gradientEnd: 'rgba(239, 68, 68, 0.0)'
  },
  tvoc: {
    title: 'TVOC',
    icon: '💨',
    field: 'tvoc',
    unit: 'ppb',
    color: 'rgba(168, 85, 247, 1)',
    bgColor: 'rgba(168, 85, 247, 0.15)',
    gradientStart: 'rgba(168, 85, 247, 0.4)',
    gradientEnd: 'rgba(168, 85, 247, 0.0)'
  }
};

const rangeLabels = {
  '24h': '24 Hours',
  '2d': '2 Days',
  '4d': '4 Days',
  '1w': '1 Week',
  '1m': '1 Month'
};

async function loadAnalyticsChart() {
  const config = metricConfigs[currentAnalyticsMetric];
  if (!config) return;
  
  // Update chart info text
  const sourceLabel = currentAnalyticsSource === 'indoor' ? 'Indoor' : 'Outdoor';
  const chartInfoEl = document.getElementById('chart-info-text');
  if (chartInfoEl) {
    chartInfoEl.textContent = `${config.icon} ${sourceLabel} ${config.title} • ${rangeLabels[currentAnalyticsRange]}`;
  }
  
  try {
    // Fetch history data for chart
    const historyEndpoint = currentAnalyticsSource === 'indoor' ? '/api/indoor-history' : '/api/history';
    const response = await fetch(`${historyEndpoint}?range=${currentAnalyticsRange}`);
    const data = await response.json();
    
    // Fetch current data for accurate "Current" value
    const currentEndpoint = currentAnalyticsSource === 'indoor' ? '/api/indoor' : '/api/current';
    const currentResponse = await fetch(currentEndpoint);
    const currentData = await currentResponse.json();
    
    const timestamps = data.timestamps || [];
    const values = data[config.field] || [];
    const validValues = values.filter(v => v !== null && v !== undefined);
    
    // Get actual current value from current endpoint
    const current = currentData[config.field] !== undefined ? currentData[config.field] : null;
    
    // Calculate statistics from history
    const avg = validValues.length > 0 ? validValues.reduce((a, b) => a + b, 0) / validValues.length : null;
    const min = validValues.length > 0 ? Math.min(...validValues) : null;
    const max = validValues.length > 0 ? Math.max(...validValues) : null;
    
    // Calculate trend (compare last 3 values with previous 3)
    let trend = '--';
    if (validValues.length >= 6) {
      const recent = validValues.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const previous = validValues.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
      const diff = recent - previous;
      if (Math.abs(diff) < 0.5) {
        trend = '→ Stable';
      } else if (diff > 0) {
        trend = `↑ +${diff.toFixed(1)}`;
      } else {
        trend = `↓ ${diff.toFixed(1)}`;
      }
    }
    
    // Update stats
    document.getElementById('stat-current').textContent = current !== null ? `${current.toFixed(1)} ${config.unit}` : '--';
    document.getElementById('stat-average').textContent = avg !== null ? `${avg.toFixed(1)} ${config.unit}` : '--';
    document.getElementById('stat-min').textContent = min !== null ? `${min.toFixed(1)} ${config.unit}` : '--';
    document.getElementById('stat-max').textContent = max !== null ? `${max.toFixed(1)} ${config.unit}` : '--';
    document.getElementById('stat-trend').textContent = trend;
    
    // Destroy existing chart
    if (analyticsChart) {
      analyticsChart.destroy();
    }
    
    // Create gradient
    const canvas = document.getElementById('main-analytics-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, config.gradientStart);
    gradient.addColorStop(1, config.gradientEnd);
    
    // Create new chart
    analyticsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: timestamps,
        datasets: [{
          label: `${sourceLabel} ${config.title}`,
          data: values,
          borderColor: config.color,
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 8,
          pointBackgroundColor: config.color,
          pointBorderColor: 'rgba(255, 255, 255, 0.9)',
          pointBorderWidth: 2,
          pointHitRadius: 20
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: config.color,
            bodyColor: '#fff',
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 16 },
            borderColor: config.color,
            borderWidth: 1,
            padding: 16,
            displayColors: false,
            callbacks: {
              title: function(context) {
                return context[0].label;
              },
              label: function(context) {
                return `${context.parsed.y.toFixed(1)} ${config.unit}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              drawBorder: false
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.5)',
              maxRotation: 45,
              minRotation: 0,
              font: { size: 11 }
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              drawBorder: false
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.5)',
              font: { size: 11 },
              callback: function(value) {
                return value.toFixed(1) + ' ' + config.unit;
              }
            }
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error loading analytics chart:', error);
  }
}

function setupAnalyticsPage() {
  // Source toggle buttons (Indoor/Outdoor)
  document.querySelectorAll('.source-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentAnalyticsSource = btn.getAttribute('data-source');
      
      // Show/hide indoor-only metrics (CO2, TVOC)
      const isIndoor = currentAnalyticsSource === 'indoor';
      document.querySelectorAll('.metric-pill.indoor-only').forEach(pill => {
        pill.classList.toggle('hidden', !isIndoor);
      });
      
      // If switching to outdoor and current metric is indoor-only, switch to temp
      if (!isIndoor && (currentAnalyticsMetric === 'eco2' || currentAnalyticsMetric === 'tvoc')) {
        document.querySelectorAll('.metric-pill').forEach(p => p.classList.remove('active'));
        document.querySelector('.metric-pill[data-metric="temperature"]').classList.add('active');
        currentAnalyticsMetric = 'temperature';
      }
      
      loadAnalyticsChart();
    });
  });
  
  // Metric pill buttons
  document.querySelectorAll('.metric-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.metric-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentAnalyticsMetric = pill.getAttribute('data-metric');
      loadAnalyticsChart();
    });
  });
  
  // Time range buttons
  document.querySelectorAll('.time-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentAnalyticsRange = btn.getAttribute('data-range');
      loadAnalyticsChart();
    });
  });
  
  // Initial load
  loadAnalyticsChart();
}

function updateAnalyticsPage() {
  loadAnalyticsChart();
}

// Initialize history modal after page load
// Initialize history modal after page load
document.addEventListener('DOMContentLoaded', () => {
  setupHistoryModal();
  setupAnalyticsPage();
  initNotificationsPage();
});

// ==========================================
// NOTIFICATIONS SETTINGS + LOGIC
// ==========================================
const defaultNotifySettings = {
  co2: { enabled: false, threshold: 800, cooldown: 3600, once: false },
  auroraChance: { enabled: false, threshold: 30, cooldown: 7200, once: false },
  kp: { enabled: false, threshold: 5, cooldown: 10800, once: false },
  smhi: { enabled: false, severity: 1, cooldown: 10800, once: false },
  lowHumidity: { enabled: false, threshold: 30, cooldown: 7200, once: false }
};

let notifySettings = { ...defaultNotifySettings };
let lastNotifyTimes = {}; // { key: timestamp }

function loadNotifySettings() {
  try {
    const raw = localStorage.getItem('notifySettings');
    if (raw) notifySettings = { ...defaultNotifySettings, ...JSON.parse(raw) };
  } catch (e) { console.warn('Failed to load notify settings', e); }
}

function saveNotifySettings() {
  localStorage.setItem('notifySettings', JSON.stringify(notifySettings));
  const status = document.getElementById('notify-status');
  if (status) {
    status.textContent = 'Settings saved';
    setTimeout(() => { status.textContent = ''; }, 2000);
  }
}

let notificationsInitialized = false;
let notificationInitRetries = 0;

function initNotificationsPage() {
  if (notificationsInitialized) return; // Only init once
  
  console.log('Initializing notifications page...');
  loadNotifySettings();
  
  // Check if elements exist before proceeding
  const setupBtn = document.getElementById('notify-setup');
  if (!setupBtn) {
    if (notificationInitRetries < 10) {
      notificationInitRetries++;
      console.log('Notification elements not ready, retrying...', notificationInitRetries);
      setTimeout(initNotificationsPage, 100);
    } else {
      console.error('Failed to initialize notifications - elements not found after retries');
    }
    return;
  }
  
  // Bind inputs
  const map = [
    { id: 'notify-co2-enabled', path: ['co2','enabled'] },
    { id: 'notify-co2-threshold', path: ['co2','threshold'] },
    { id: 'notify-co2-cooldown', path: ['co2','cooldown'] },
    { id: 'notify-co2-once', path: ['co2','once'] },
    { id: 'notify-aurora-enabled', path: ['auroraChance','enabled'] },
    { id: 'notify-aurora-threshold', path: ['auroraChance','threshold'] },
    { id: 'notify-aurora-cooldown', path: ['auroraChance','cooldown'] },
    { id: 'notify-aurora-once', path: ['auroraChance','once'] },
    { id: 'notify-kp-enabled', path: ['kp','enabled'] },
    { id: 'notify-kp-threshold', path: ['kp','threshold'] },
    { id: 'notify-kp-cooldown', path: ['kp','cooldown'] },
    { id: 'notify-kp-once', path: ['kp','once'] },
    { id: 'notify-smhi-enabled', path: ['smhi','enabled'] },
    { id: 'notify-smhi-severity', path: ['smhi','severity'] },
    { id: 'notify-smhi-cooldown', path: ['smhi','cooldown'] },
    { id: 'notify-smhi-once', path: ['smhi','once'] },
    { id: 'notify-lowhum-enabled', path: ['lowHumidity','enabled'] },
    { id: 'notify-lowhum-threshold', path: ['lowHumidity','threshold'] },
    { id: 'notify-lowhum-cooldown', path: ['lowHumidity','cooldown'] },
    { id: 'notify-lowhum-once', path: ['lowHumidity','once'] }
  ];

  map.forEach(m => {
    const el = document.getElementById(m.id);
    if (!el) return;
    // Set initial values
    let val = notifySettings;
    m.path.forEach(k => val = val[k]);
    if (el.type === 'checkbox') el.checked = !!val; else el.value = val;
    // Listen for changes
    el.addEventListener('change', () => {
      // Update nested setting
      let obj = notifySettings;
      for (let i = 0; i < m.path.length - 1; i++) obj = obj[m.path[i]];
      const isSelect = el.tagName === 'SELECT';
      const isNumber = el.type === 'number';
      obj[m.path[m.path.length - 1]] = (el.type === 'checkbox') ? el.checked : ((isNumber || isSelect) ? Number(el.value) : el.value);
      saveNotifySettings();
    });
  });

  // New simplified setup button (setupBtn already declared above)
  console.log('Setup button found:', !!setupBtn);
  if (setupBtn) {
    // Remove any existing listeners
    const newSetupBtn = setupBtn.cloneNode(true);
    setupBtn.parentNode.replaceChild(newSetupBtn, setupBtn);
    
    newSetupBtn.addEventListener('click', async () => {
      console.log('Setup button clicked');
      const status = document.getElementById('notify-status');
      
      try {
        // Check if service worker is supported
        if (!('serviceWorker' in navigator)) {
          throw new Error('Service Workers are not supported in this browser');
        }
        
        // Check if push notifications are supported
        if (!('PushManager' in window)) {
          throw new Error('Push notifications are not supported in this browser');
        }
        
        // First check if already enabled
        if (Notification.permission === 'granted') {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            if (status) status.innerHTML = '✅ <strong>Notifications are already enabled!</strong>';
            newSetupBtn.innerHTML = '✅ Notifications Active';
            newSetupBtn.style.background = '#22c55e';
            newSetupBtn.disabled = true;
            return;
          }
        }
        
        // Request permission
        newSetupBtn.innerHTML = '🔄 Requesting permission...';
        newSetupBtn.disabled = true;
        
        const res = await Notification.requestPermission();
        console.log('Permission result:', res);
        
        if (res === 'granted') {
          newSetupBtn.innerHTML = '🔄 Setting up notifications...';
          // Subscribe to push notifications
          await subscribeToPush();
          if (status) status.innerHTML = '✅ <strong>Notifications enabled successfully!</strong><br><small>You will receive alerts based on your settings above.</small>';
          newSetupBtn.innerHTML = '✅ Notifications Active';
          newSetupBtn.style.background = '#22c55e';
          // Refresh the active notifications list
          loadActiveNotifications();
        } else {
          if (status) status.innerHTML = '❌ <strong>Permission denied.</strong><br><small>Please enable notifications in your browser settings and try again.</small>';
          newSetupBtn.innerHTML = '🔔 Turn On Notifications';
          newSetupBtn.style.background = '';
          newSetupBtn.disabled = false;
        }
      } catch (e) { 
        console.error('Setup failed', e);
        if (status) status.innerHTML = '❌ <strong>Setup failed:</strong><br><small>' + e.message + '</small>';
        newSetupBtn.innerHTML = '🔔 Turn On Notifications';
        newSetupBtn.style.background = '';
        newSetupBtn.disabled = false;
      }
    });
  }

  const saveBtn = document.getElementById('notify-save');
  console.log('Save button found:', !!saveBtn);
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      console.log('Save button clicked');
      saveNotifySettings();
      
      // Also update subscription on server with new settings
      try {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          
          if (subscription) {
            await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subscription: subscription,
                settings: notifySettings
              })
            });
            console.log('Settings updated on server');
            const status = document.getElementById('notify-status');
            if (status) {
              status.textContent = 'Settings saved!';
              setTimeout(() => status.textContent = '', 2000);
            }
          }
        }
      } catch (e) {
        console.error('Failed to update settings on server', e);
      }
    });
  }
  
  const resetBtn = document.getElementById('notify-reset');
  console.log('Reset button found:', !!resetBtn);
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      console.log('Reset button clicked');
      const status = document.getElementById('notify-status');
      try {
        // Unsubscribe from all push subscriptions
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            await subscription.unsubscribe();
            console.log('Push subscription removed');
            if (status) status.textContent = 'Push reset! You can now re-enable.';
          }
        }
      } catch (e) {
        console.error('Reset failed:', e);
        if (status) status.textContent = 'Reset error: ' + e.message;
      }
    });
  }
  
  // Check current notification status and update button
  checkNotificationStatus();
  
  // Load active notifications list
  loadActiveNotifications();
  
  // Set up refresh button
  const refreshBtn = document.getElementById('refresh-notifications');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadActiveNotifications);
  }
  
  // Set up clear all button
  const clearAllBtn = document.getElementById('clear-all-notifications');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', clearAllNotifications);
  }
  
  notificationsInitialized = true;
  console.log('Notifications page initialized successfully');
}

// Check and update notification status
async function checkNotificationStatus() {
  const setupBtn = document.getElementById('notify-setup');
  const status = document.getElementById('notify-status');
  
  if (!setupBtn) return;
  
  try {
    if (Notification.permission === 'granted') {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        setupBtn.innerHTML = '✅ Notifications Active';
        setupBtn.style.background = '#22c55e';
        setupBtn.disabled = true;
        if (status) status.innerHTML = '✅ <strong>Notifications are enabled!</strong><br><small>You will receive alerts based on your settings above.</small>';
      } else {
        setupBtn.innerHTML = '🔔 Turn On Notifications';
        if (status) status.innerHTML = '🔕 <strong>Notifications not set up.</strong><br><small>Click the button above to enable alerts.</small>';
      }
    } else if (Notification.permission === 'denied') {
      setupBtn.innerHTML = '❌ Permission Denied';
      setupBtn.style.background = '#ef4444';
      setupBtn.disabled = true;
      if (status) status.innerHTML = '❌ <strong>Notifications blocked.</strong><br><small>Please enable notifications in your browser settings.</small>';
    } else {
      setupBtn.innerHTML = '🔔 Turn On Notifications';
      if (status) status.innerHTML = '🔕 <strong>Notifications not enabled.</strong><br><small>Click the button above to get started.</small>';
    }
  } catch (e) {
    console.error('Failed to check notification status:', e);
  }
}

// Load and display active notifications
async function loadActiveNotifications() {
  const container = document.getElementById('active-notifications-list');
  if (!container) return;
  
  container.innerHTML = '<div class="loading-message">Loading active notifications...</div>';
  
  try {
    const response = await fetch('/api/push/subscriptions');
    const data = await response.json();
    
    if (data.subscriptions && data.subscriptions.length > 0) {
      container.innerHTML = data.subscriptions.map((sub, index) => {
        const enabledCount = sub.enabled_notifications || 0;
        const types = sub.notification_types || [];
        
        let typesText = 'None enabled';
        let typesClass = 'none';
        if (types.length > 0) {
          const typeNames = {
            'co2': 'CO₂',
            'auroraChance': 'Aurora %',
            'kp': 'Aurora KP',
            'smhi': 'Weather Warnings',
            'lowHumidity': 'Low Humidity'
          };
          typesText = types.map(t => {
            // Handle "once" indicators
            if (t.includes(' (once)')) {
              const baseType = t.replace(' (once)', '');
              return (typeNames[baseType] || baseType) + ' (once)';
            }
            return typeNames[t] || t;
          }).join(', ');
          typesClass = '';
        }
        
        return `
          <div class="active-notification-item">
            <div class="notification-info">
              <div class="notification-device">${sub.device_name}</div>
              <div class="notification-types ${typesClass}">${typesText}</div>
            </div>
            <div class="notification-count ${enabledCount === 0 ? 'zero' : ''}">${enabledCount}</div>
            <button class="delete-notification-btn" onclick="deleteNotification(${sub.id})">🗑️ Remove</button>
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = '<div class="no-notifications">📭 No active notifications<br><small>Enable notifications above to see devices here</small></div>';
    }
  } catch (e) {
    console.error('Failed to load active notifications:', e);
    container.innerHTML = '<div class="no-notifications">❌ Failed to load notifications<br><small>Check your connection and try again</small></div>';
  }
}

// Delete a specific notification subscription
async function deleteNotification(subscriptionId) {
  if (!confirm('Remove this device from receiving notifications?')) return;
  
  try {
    const response = await fetch(`/api/push/subscriptions/${subscriptionId}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Notification subscription deleted successfully');
      loadActiveNotifications(); // Refresh the list
      checkNotificationStatus(); // Update status
    } else {
      alert('Failed to delete notification: ' + (data.error || 'Unknown error'));
    }
  } catch (e) {
    console.error('Failed to delete notification:', e);
    alert('Failed to delete notification. Please try again.');
  }
}

// Clear all notification subscriptions
async function clearAllNotifications() {
  if (!confirm('Remove ALL devices from receiving notifications? This cannot be undone.')) return;
  
  try {
    const response = await fetch('/api/push/subscriptions');
    const data = await response.json();
    
    if (!data.subscriptions || data.subscriptions.length === 0) {
      alert('No notifications to clear.');
      return;
    }
    
    // Delete all subscriptions one by one (from highest index to avoid shifting)
    for (let i = data.subscriptions.length - 1; i >= 0; i--) {
      await fetch(`/api/push/subscriptions/${i}`, { method: 'DELETE' });
    }
    
    console.log('All notification subscriptions cleared');
    loadActiveNotifications(); // Refresh the list
    checkNotificationStatus(); // Update status
  } catch (e) {
    console.error('Failed to clear all notifications:', e);
    alert('Failed to clear notifications. Please try again.');
  }
}

function canNotify(key, cooldownMinutes = 30) {
  const now = Date.now();
  const last = lastNotifyTimes[key] || 0;
  const cooldownMs = cooldownMinutes * 60 * 1000;
  if (now - last < cooldownMs) return false;
  lastNotifyTimes[key] = now;
  return true;
}

function triggerNotification(title, body) {
  if (!('serviceWorker' in navigator)) return;
  if (Notification.permission !== 'granted') return;
  try {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'show-notification', title, body });
    } else {
      // Fallback: direct notification
      new Notification(title, { body, icon: '/icon-192.png' });
    }
  } catch (e) { console.error('Failed to trigger notification', e); }
}

let notifyOnceState = {};
try { notifyOnceState = JSON.parse(localStorage.getItem('notifyOnceState') || '{}'); } catch {}
function markOnce(key) {
  notifyOnceState[key] = true;
  localStorage.setItem('notifyOnceState', JSON.stringify(notifyOnceState));
}

function checkNotifications(outdoor, indoor, aurora, smhi) {
  // CO2
  if (notifySettings.co2.enabled) {
    const co2 = indoor?.eco2 || indoor?.co2 || 0;
    if (!(notifySettings.co2.once && notifyOnceState.co2) && co2 >= notifySettings.co2.threshold && canNotify('co2', (notifySettings.co2.cooldown || 3600) / 60)) {
      triggerNotification('High CO₂', `Indoor CO₂ is ${Math.round(co2)} ppm (≥ ${notifySettings.co2.threshold}).`);
      if (notifySettings.co2.once) markOnce('co2');
    }
  }
  // Aurora chance
  if (notifySettings.auroraChance.enabled) {
    const chance = aurora?.probability || 0;
    if (!(notifySettings.auroraChance.once && notifyOnceState.auroraChance) && chance >= notifySettings.auroraChance.threshold && canNotify('auroraChance', (notifySettings.auroraChance.cooldown || 7200) / 60)) {
      triggerNotification('Aurora Opportunity', `Aurora chance is ${Math.round(chance)}% (≥ ${notifySettings.auroraChance.threshold}%).`);
      if (notifySettings.auroraChance.once) markOnce('auroraChance');
    }
  }
  // KP index
  if (notifySettings.kp.enabled) {
    const kp = aurora?.kp_index || aurora?.kp || 0;
    if (!(notifySettings.kp.once && notifyOnceState.kp) && kp >= notifySettings.kp.threshold && canNotify('kp', (notifySettings.kp.cooldown || 10800) / 60)) {
      triggerNotification('High KP Index', `KP index is ${kp} (≥ ${notifySettings.kp.threshold}).`);
      if (notifySettings.kp.once) markOnce('kp');
    }
  }
  // SMHI warnings
  if (notifySettings.smhi.enabled) {
    const warnings = smhi?.warnings || [];
    const min = Number(notifySettings.smhi.severity || 1);
    const severe = warnings.filter(w => Number(w.severity || 1) >= min);
    if (!(notifySettings.smhi.once && notifyOnceState.smhi) && severe.length && canNotify('smhi', (notifySettings.smhi.cooldown || 10800) / 60)) {
      const w = severe[0];
      const levelText = w.level ? `(${w.level})` : '';
      triggerNotification('SMHI Warning', `${w.event} ${levelText}: ${w.description || w.headline || ''} - ${w.area || 'Dalarna'}`);
      if (notifySettings.smhi.once) markOnce('smhi');
    }
  }
  // Low humidity
  if (notifySettings.lowHumidity.enabled) {
    const hum = indoor?.humidity || 0;
    if (!(notifySettings.lowHumidity.once && notifyOnceState.lowHumidity) && hum > 0 && hum <= notifySettings.lowHumidity.threshold && canNotify('lowHumidity', (notifySettings.lowHumidity.cooldown || 7200) / 60)) {
      triggerNotification('Low Indoor Humidity', `Indoor humidity is ${Math.round(hum)}% (≤ ${notifySettings.lowHumidity.threshold}%).`);
      if (notifySettings.lowHumidity.once) markOnce('lowHumidity');
    }
  }
}

// ==========================================
// PWA SERVICE WORKER REGISTRATION & PUSH
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registered:', registration.scope);
      })
      .catch(err => {
        console.log('ServiceWorker registration failed:', err);
      });
  });
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Subscribe to push notifications
async function subscribeToPush() {
  try {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker not supported');
    }
    
    const registration = await navigator.serviceWorker.ready;
    
    // Get VAPID public key from server
    const response = await fetch('/api/push/vapid-public-key');
    const vapidData = await response.json();
    const publicKey = vapidData.publicKey;
    
    // Subscribe
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
    
    console.log('Push subscription:', subscription);
    
    // Send subscription with current notification settings to server
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription,
        settings: notifySettings
      })
    });
    
    console.log('Push subscription saved to server');
    return true;
  } catch (error) {
    console.error('Failed to subscribe to push:', error);
    throw error;
  }
}


// PWA Install Prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  // Show install button/banner (optional - you can add UI for this)
  console.log('PWA install available');
});

window.addEventListener('appinstalled', () => {
  console.log('PWA was installed');
  deferredPrompt = null;
});
