// ==================================================
// NEW OVERVIEW PAGE JAVASCRIPT - Integration Version
// ==================================================

// Use global API if available (from app.js), otherwise empty string
const API = typeof window !== 'undefined' && window.API ? window.API : "";

let overlayTestMode = 'auto';
let lastOutdoorData = null;
let lastForecastData = null;

async function updateNewOverviewPage() {
  try {
    console.log('updateNewOverviewPage called, API base:', API);
    
    // Fetch all needed data
    const [outdoorRes, indoorRes, auroraRes, forecastRes, smhiRes] = await Promise.all([
      fetch(`${API}/api/current`),
      fetch(`${API}/api/indoor`),
      fetch(`${API}/api/aurora`),
      fetch(`${API}/api/forecast`),
      fetch(`${API}/api/smhi`)
    ]);
    
    const outdoor = await outdoorRes.json();
    const indoor = await indoorRes.json();
    const aurora = await auroraRes.json();
    const forecast = await forecastRes.json();
    const smhi = await smhiRes.json();

    console.log('Fetched data - outdoor:', outdoor, 'indoor:', indoor, 'aurora:', aurora);

    lastOutdoorData = outdoor;
    lastForecastData = forecast;

    // Update greeting based on time
    updateGreeting();
    
    // Update main weather display
    updateHeroWeather(outdoor, forecast);

    // Update background overlays (rain/snow/fog) unless manually overridden
    if (overlayTestMode === 'auto') {
      updateWeatherOverlays(outdoor, forecast);
    }
    
    // Update precipitation if any
    updatePrecipitation(forecast);
    
    // Update quick stats
    console.log('Calling updateQuickStats with indoor:', indoor, 'aurora:', aurora);
    updateQuickStats(indoor, aurora, smhi);
    
  } catch (error) {
    console.error('Error updating new overview:', error);
  }
}

// Manual overlay test hook (kept for dev tools but no buttons on preview)
if (typeof window !== 'undefined') {
  window.setOverlayTestMode = function(mode) {
    overlayTestMode = mode;
    if (mode === 'auto') {
      if (lastOutdoorData && lastForecastData) {
        updateWeatherOverlays(lastOutdoorData, lastForecastData);
      }
      return;
    }
    applyOverlayMode(mode);
  };
}

function updateGreeting() {
  const now = new Date();
  const hour = now.getHours();
  const greetingEl = document.getElementById('hero-greeting');
  const dateEl = document.getElementById('hero-date');
  
  if (!greetingEl || !dateEl) return;
  
  // Set greeting based on time without emojis
  let greeting = 'Good Evening';
  if (hour >= 5 && hour < 12) greeting = 'Good Morning';
  else if (hour >= 12 && hour < 18) greeting = 'Good Afternoon';
  else if (hour >= 18 && hour < 22) greeting = 'Good Evening';
  else greeting = 'Good Night';
  
  greetingEl.textContent = greeting;
  
  // Format date
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  dateEl.textContent = now.toLocaleDateString('en-US', options);
}

function updateHeroWeather(outdoor, forecast) {
  // Temperature
  const tempEl = document.getElementById('hero-current-temp');
  if (tempEl && outdoor.temperature !== undefined) {
    tempEl.textContent = Math.round(outdoor.temperature) + '°';
  }
  
  // Feels like
  const feelsEl = document.getElementById('hero-feels-like-text');
  if (feelsEl && outdoor.dew_point !== undefined) {
    // Simple feels-like calculation
    const feelsLike = outdoor.temperature - (outdoor.dew_point - outdoor.temperature) * 0.3;
    feelsEl.textContent = `Feels like ${Math.round(feelsLike)}°C`;
  }
  
  // Weather icon and condition
  const iconEl = document.getElementById('hero-main-icon');
  const conditionEl = document.getElementById('hero-condition-text');
  const descEl = document.getElementById('hero-weather-desc');
  if (iconEl && conditionEl && forecast.symbol !== undefined) {
    const weatherInfo = getWeatherFromSymbol(forecast.symbol);
    iconEl.textContent = weatherInfo.icon;
    conditionEl.textContent = weatherInfo.text;
    
    // Generate weather description
    if (descEl) {
      descEl.textContent = generateWeatherDescription(outdoor, forecast);
    }
  }
  
  // Stats
  const humidityEl = document.getElementById('hero-stat-humidity');
  if (humidityEl && outdoor.humidity !== undefined) {
    humidityEl.textContent = Math.round(outdoor.humidity) + '%';
  }
  
  const windEl = document.getElementById('hero-stat-wind');
  if (windEl && forecast.wind_speed !== undefined) {
    windEl.textContent = forecast.wind_speed.toFixed(1) + ' m/s';
  }
  
  const pressureEl = document.getElementById('hero-stat-pressure');
  if (pressureEl && outdoor.pressure !== undefined) {
    pressureEl.textContent = Math.round(outdoor.pressure) + ' hPa';
  }
}

function updatePrecipitation(forecast) {
  const precipCard = document.getElementById('hero-precipitation-card');
  const precipAmount = document.getElementById('precip-amount');
  const precipLabel = document.getElementById('precip-label');
  const precipIcon = document.getElementById('precip-icon');
  
  if (!precipCard || !precipAmount || !precipLabel || !precipIcon) return;
  
  const precip = forecast.precipitation || 0;
  
  if (precip > 0) {
    precipCard.style.display = 'flex';
    precipAmount.textContent = precip.toFixed(1) + ' mm';
    
    // Determine if rain or snow based on temperature
    const temp = forecast.temperature || 0;
    if (temp < 0) {
      precipIcon.textContent = '❄️';
      precipLabel.textContent = 'Snow in last hour';
    } else {
      precipIcon.textContent = '🌧️';
      precipLabel.textContent = 'Rain in last hour';
    }
  } else {
    precipCard.style.display = 'none';
  }
}

function updateQuickStats(indoor, aurora, smhi) {
  console.log('updateQuickStats executing - looking for elements');
  
  // Indoor temperature
  const indoorTempEl = document.getElementById('quick-indoor-temp');
  console.log('quick-indoor-temp element:', indoorTempEl, 'indoor.temperature:', indoor?.temperature);
  if (indoorTempEl && indoor.temperature !== undefined) {
    indoorTempEl.textContent = indoor.temperature.toFixed(1) + '°C';
    console.log('Updated quick-indoor-temp to:', indoorTempEl.textContent);
  }
  
  // CO2 level
  const co2El = document.getElementById('quick-indoor-co2');
  console.log('quick-indoor-co2 element:', co2El, 'indoor.eco2:', indoor?.eco2);
  if (co2El && (indoor.eco2 || indoor.co2)) {
    const co2 = indoor.eco2 || indoor.co2;
    co2El.textContent = Math.round(co2) + ' ppm';
    console.log('Updated quick-indoor-co2 to:', co2El.textContent);
  }
  
  // Aurora chance
  const auroraEl = document.getElementById('quick-aurora');
  console.log('quick-aurora element:', auroraEl, 'aurora.probability:', aurora?.probability);
  if (auroraEl && aurora.probability !== undefined) {
    auroraEl.textContent = Math.round(aurora.probability) + '%';
    console.log('Updated quick-aurora to:', auroraEl.textContent);
  }
  
  // Update overview aurora card
  const overviewAuroraProbEl = document.getElementById('overview-aurora-probability');
  const overviewKpEl = document.getElementById('overview-kp-value');
  const overviewAuroraSummaryEl = document.getElementById('overview-aurora-summary');
  
  console.log('Aurora data for overview:', aurora);
  console.log('overview-kp-value element:', overviewKpEl);
  console.log('aurora.kp_index:', aurora?.kp_index);
  
  if (overviewAuroraProbEl && aurora.probability !== undefined) {
    overviewAuroraProbEl.textContent = Math.round(aurora.probability) + '%';
    console.log('Updated overview-aurora-probability to:', overviewAuroraProbEl.textContent);
  }
  if (overviewKpEl && aurora.kp_index !== undefined) {
    overviewKpEl.textContent = aurora.kp_index.toFixed(1);
    console.log('Updated overview-kp-value to:', overviewKpEl.textContent);
  }
  if (overviewAuroraSummaryEl) {
    // Build a summary based on aurora data
    const prob = aurora.probability || 0;
    const kp = aurora.kp_index || 0;
    let summary = aurora.description || '';
    
    // Add visibility info
    if (aurora.weather_condition) {
      summary += ` • ${aurora.weather_condition}`;
    }
    if (aurora.visibility_km && aurora.visibility_km < 10) {
      summary += ` • Visibility: ${aurora.visibility_km.toFixed(1)} km`;
    }
    
    overviewAuroraSummaryEl.textContent = summary || 'Analyzing space weather conditions...';
  }
  
  // Active warnings
  const warningsEl = document.getElementById('quick-warnings');
  console.log('quick-warnings element:', warningsEl, 'smhi.warnings:', smhi?.warnings);
  if (warningsEl && smhi.warnings) {
    warningsEl.textContent = smhi.warnings.length;
    console.log('Updated quick-warnings to:', warningsEl.textContent);
    
    // Store warnings globally for panel display
    window.currentWarnings = smhi.warnings;
    
    // Update warnings card appearance
    const warningsCard = document.getElementById('warnings-card');
    if (warningsCard) {
      if (smhi.warnings.length > 0) {
        warningsCard.style.borderColor = 'rgba(239, 68, 68, 0.5)';
        warningsCard.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.3)';
      } else {
        warningsCard.style.borderColor = '';
        warningsCard.style.boxShadow = '';
      }
    }
  }
}

window.toggleWarningsPanel = function toggleWarningsPanel() {
  const panel = document.getElementById('warnings-panel');
  const warningsCard = document.getElementById('warnings-card');
  
  if (!panel) return;
  
  if (panel.style.display === 'none' || panel.style.display === '') {
    // Show panel
    panel.style.display = 'block';
    populateWarningsList();
    
    // Highlight card
    if (warningsCard) {
      warningsCard.style.transform = 'scale(0.98)';
    }
  } else {
    // Hide panel
    panel.style.display = 'none';
    
    // Reset card
    if (warningsCard) {
      warningsCard.style.transform = '';
    }
  }
}

window.populateWarningsList = function populateWarningsList() {
  const listEl = document.getElementById('warnings-list');
  if (!listEl) return;
  
  const warnings = window.currentWarnings || [];
  
  if (warnings.length === 0) {
    listEl.innerHTML = '<div class="no-warnings-message">✓ No active warnings at this time</div>';
    return;
  }
  
  listEl.innerHTML = warnings.map((warning, index) => {
    const severityColors = {
      'Minor': 'rgba(251, 191, 36, 0.9)',
      'Moderate': 'rgba(249, 115, 22, 0.9)',
      'Severe': 'rgba(239, 68, 68, 0.9)',
      'Extreme': 'rgba(153, 27, 27, 0.9)'
    };
    
    const severityColor = severityColors[warning.severity] || 'rgba(239, 68, 68, 0.9)';
    const onset = warning.onset ? new Date(warning.onset).toLocaleString('sv-SE', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    }) : 'N/A';
    const expires = warning.expires ? new Date(warning.expires).toLocaleString('sv-SE', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    }) : 'N/A';
    
    return `
      <div class="warning-item-panel">
        <div class="warning-header-panel">
          <span class="warning-event-panel">${warning.event || 'Weather Warning'}</span>
          <span class="warning-severity-panel" style="color: ${severityColor}">${warning.severity || 'Unknown'}</span>
        </div>
        <div class="warning-headline-panel">${warning.headline || warning.description || 'Weather advisory in effect'}</div>
        ${warning.description ? `<div class="warning-description-panel">${warning.description}</div>` : ''}
        ${warning.instruction ? `<div class="warning-instruction-panel"><strong>⚠️ Instructions:</strong> ${warning.instruction}</div>` : ''}
        <div class="warning-time-panel">
          <div>📅 Starts: ${onset}</div>
          <div>⏰ Expires: ${expires}</div>
        </div>
      </div>
    `;
  }).join('');
}

function generateWeatherDescription(outdoor, forecast) {
  const temp = outdoor.temperature || 0;
  const humidity = outdoor.humidity || 0;
  const pressure = outdoor.pressure || 1013;
  const symbol = forecast.symbol || 1;
  const wind = forecast.wind_speed || 0;
  const visibility = forecast.visibility;
  const precip = forecast.precipitation || 0;
  
  // Determine pressure trend
  let pressureTrend = 'stable';
  if (outdoor.pressure_trend) {
    pressureTrend = outdoor.pressure_trend;
  } else if (pressure < 1000) {
    pressureTrend = 'falling';
  } else if (pressure > 1020) {
    pressureTrend = 'rising';
  }
  
  // Storm conditions (thunder symbols 21-27 or very low pressure)
  if ([21, 22, 23, 24, 25, 26, 27].includes(symbol) || pressure < 990) {
    if (temp < 0) {
      return `Stay safe indoors! It's ${temp.toFixed(1)}°C with severe winter storm conditions. Heavy snow and strong winds are expected. Bundle up if you need to go out!`;
    }
    return `Stormy weather ahead! Pressure has dropped to ${pressure.toFixed(1)} hPa with ${humidity.toFixed(0)}% humidity. Best to stay cozy inside and wait for this to pass.`;
  }
  
  // Fog (symbol 7 or low visibility)
  if (symbol === 7 || (visibility && visibility < 2)) {
    return `Foggy morning in Dalarna! Visibility is reduced${visibility ? ` to ${visibility} km` : ''}. Drive carefully if you're heading out. Temperature at ${temp.toFixed(1)}°C.`;
  }
  
  // Rain symbols: 5,6,10,18,19,20
  if ([5, 6, 10, 18, 19, 20].includes(symbol) || precip > 0) {
    if (temp < 0) {
      return `Winter wonderland! It's ${temp.toFixed(1)}°C with snow falling. Perfect weather for a warm cup of coffee indoors or a snowy walk if you're feeling adventurous!`;
    }
    if (temp === 0) {
      return `Right at the freezing point (${temp.toFixed(1)}°C)! We might see a mix of rain and snow. Stay warm and dry out there!`;
    }
    return `Rainy day ahead! It's ${temp.toFixed(1)}°C with ${humidity.toFixed(0)}% humidity. Don't forget your umbrella if you're going out!`;
  }
  
  // Snow symbols: 8,9,15,16,17
  if ([8, 9, 15, 16, 17].includes(symbol)) {
    return `Snow is falling! It's a chilly ${temp.toFixed(1)}°C outside. Great day for winter activities or staying warm indoors with a good book.`;
  }
  
  // Clear/cloudy conditions (default)
  let welcomeMsg = '';
  if (temp < -10) {
    welcomeMsg = `Quite cold at ${temp.toFixed(1)}°C! Make sure to dress warmly if you're heading outside.`;
  } else if (temp < 0) {
    welcomeMsg = `Crisp winter air at ${temp.toFixed(1)}°C. Perfect weather for a brisk walk if you bundle up!`;
  } else if (temp < 10) {
    welcomeMsg = `Cool and refreshing at ${temp.toFixed(1)}°C. A light jacket should keep you comfortable.`;
  } else if (temp < 20) {
    welcomeMsg = `Pleasant ${temp.toFixed(1)}°C outside! Great weather to enjoy the day.`;
  } else {
    welcomeMsg = `Lovely ${temp.toFixed(1)}°C! Perfect weather to be outdoors and soak up the sunshine.`;
  }
  
  const windDesc = wind > 10 ? ' A bit windy today, so hold onto your hat!' : wind > 5 ? ' Light breeze in the air.' : ' Calm and peaceful.';
  return `${welcomeMsg} Humidity at ${humidity.toFixed(0)}% with ${pressureTrend} pressure.${windDesc}`;
}

// -----------------------------
// Weather Overlays (rain/snow/fog)
// -----------------------------
let rainInterval = null;
let lastWeatherState = { isSnow: false, isRain: false, isFog: false };

function updateWeatherOverlays(outdoor, forecast) {
  const rainOverlay = document.getElementById('rain-overlay');
  const snowOverlay = document.getElementById('snow-overlay');
  const fogOverlay = document.getElementById('fog-overlay');
  if (!rainOverlay || !snowOverlay || !fogOverlay) return;

  const temp = Number(outdoor.temperature || 0);
  const precip = Number(forecast.precipitation || 0);
  const symbol = Number(forecast.symbol || 1);
  const visibility = forecast.visibility;

  const rainSymbols = [5, 6, 10, 18, 19, 20];
  const snowSymbols = [8, 9, 15, 16, 17];

  // If SMHI reports rain but temp is at or below freezing, treat as snow
  const smhiSaysRain = rainSymbols.includes(symbol);
  const smhiSaysSnow = snowSymbols.includes(symbol);
  
  // Temperature-based override: if it's cold enough, rain becomes snow
  const isSnow = smhiSaysSnow || (temp <= 1 && (smhiSaysRain || precip > 0.1));
  const isRain = (!isSnow && (smhiSaysRain || (temp > 1 && precip > 0.1)));
  const isFog = symbol === 7 || (visibility !== undefined && visibility < 2);

  console.log(`Weather overlay decision: temp=${temp}°C, precip=${precip}mm, symbol=${symbol}, isSnow=${isSnow}, isRain=${isRain}, isFog=${isFog}`);

  // Only update overlays if state actually changed
  const stateChanged = (isSnow !== lastWeatherState.isSnow) || 
                       (isRain !== lastWeatherState.isRain) || 
                       (isFog !== lastWeatherState.isFog);
  
  if (!stateChanged) {
    console.log('Weather state unchanged, skipping overlay update');
    return;
  }
  
  console.log('Weather state changed, updating overlays');
  lastWeatherState = { isSnow, isRain, isFog };

  // Rain handling
  if (isRain) {
    rainOverlay.classList.add('active');
    startRainOverlay(rainOverlay);
  } else {
    rainOverlay.classList.remove('active');
    stopRainOverlay(rainOverlay);
  }

  // Snow handling (Canvas 2D animation)
  if (isSnow) {
    snowOverlay.classList.add('active');
    if (typeof window.startSnowAnimation === 'function') {
      window.startSnowAnimation();
    }
  } else {
    snowOverlay.classList.remove('active');
    if (typeof window.stopSnowAnimation === 'function') {
      window.stopSnowAnimation();
    }
  }

  // Fog handling (static layer)
  if (isFog) {
    fogOverlay.classList.add('active');
    setFogClass(true);
  } else {
    fogOverlay.classList.remove('active');
    setFogClass(false);
  }
}

function applyOverlayMode(mode) {
  const rainOverlay = document.getElementById('rain-overlay');
  const snowOverlay = document.getElementById('snow-overlay');
  const fogOverlay = document.getElementById('fog-overlay');
  if (!rainOverlay || !snowOverlay || !fogOverlay) return;

  // Reset all
  rainOverlay.classList.remove('active');
  snowOverlay.classList.remove('active');
  fogOverlay.classList.remove('active');
  stopRainOverlay(rainOverlay);

  switch (mode) {
    case 'rain':
      rainOverlay.classList.add('active');
      startRainOverlay(rainOverlay);
      setFogClass(false);
      break;
    case 'snow':
      snowOverlay.classList.add('active');
      setFogClass(false);
      break;
    case 'fog':
      fogOverlay.classList.add('active');
      setFogClass(true);
      break;
    case 'clear':
    default:
      // nothing active
      setFogClass(false);
      break;
  }
}

function setFogClass(enabled) {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('fog-active', !!enabled);
}

function startRainOverlay(rainOverlay) {
  if (rainInterval) {
    console.log('Rain already running');
    return;
  }

  const createRaindrop = () => {
    if (!rainOverlay) return;
    
    const drop = document.createElement('div');
    drop.className = 'raindrop';
    drop.style.left = Math.random() * 100 + '%';
    drop.style.animationDelay = (Math.random() * 0.1) + 's';
    rainOverlay.appendChild(drop);
    
    // Remove after animation completes (800ms default duration)
    setTimeout(() => {
      if (drop && drop.parentNode) {
        drop.remove();
      }
    }, 1100);
  };

  // Create initial batch
  for (let i = 0; i < 5; i++) {
    setTimeout(() => createRaindrop(), i * 50);
  }
  
  // Continuous rain creation
  rainInterval = setInterval(createRaindrop, 100);
  console.log('Rain animation started');
}

function stopRainOverlay(rainOverlay) {
  if (rainInterval) {
    console.log('Stopping rain animation');
    clearInterval(rainInterval);
    rainInterval = null;
  }
  // Clear leftover drops
  if (rainOverlay) {
    while (rainOverlay.firstChild) {
      rainOverlay.removeChild(rainOverlay.firstChild);
    }
  }
}

function getWeatherFromSymbol(symbol) {
  const weatherMap = {
    1: { icon: '☀️', text: 'Clear Sky', dayOnly: true },
    2: { icon: '🌤️', text: 'Nearly Clear', dayOnly: true },
    3: { icon: '⛅', text: 'Variable Cloudiness' },
    4: { icon: '🌥️', text: 'Halfclear Sky' },
    5: { icon: '☁️', text: 'Cloudy Sky' },
    6: { icon: '⛅', text: 'Overcast' },
    7: { icon: '🌫️', text: 'Fog' },
    8: { icon: '🌦️', text: 'Light Rain Showers' },
    9: { icon: '🌧️', text: 'Moderate Rain Showers' },
    10: { icon: '🌧️', text: 'Heavy Rain Showers' },
    11: { icon: '⛈️', text: 'Thunderstorm' },
    12: { icon: '🌨️', text: 'Light Sleet Showers' },
    13: { icon: '🌨️', text: 'Moderate Sleet Showers' },
    14: { icon: '🌨️', text: 'Heavy Sleet Showers' },
    15: { icon: '🌨️', text: 'Light Snow Showers' },
    16: { icon: '🌨️', text: 'Moderate Snow Showers' },
    17: { icon: '❄️', text: 'Heavy Snow Showers' },
    18: { icon: '🌧️', text: 'Light Rain' },
    19: { icon: '🌧️', text: 'Moderate Rain' },
    20: { icon: '🌧️', text: 'Heavy Rain' },
    21: { icon: '⛈️', text: 'Thunder' },
    22: { icon: '🌨️', text: 'Light Sleet' },
    23: { icon: '🌨️', text: 'Moderate Sleet' },
    24: { icon: '🌨️', text: 'Heavy Sleet' },
    25: { icon: '🌨️', text: 'Light Snowfall' },
    26: { icon: '❄️', text: 'Moderate Snowfall' },
    27: { icon: '❄️', text: 'Heavy Snowfall' }
  };
  
  const weather = weatherMap[symbol] || { icon: '🌤️', text: 'Unknown' };
  
  // Check if it's after sunset and this is a day-only icon
  if (weather.dayOnly && typeof window !== 'undefined' && typeof window.isAfterSunset === 'function') {
    try {
      if (window.isAfterSunset()) {
        return {
          icon: weather.icon === '☀️' ? '🌙' : '🌛',
          text: weather.text
        };
      }
    } catch (e) {
      // If sunset check fails, just return regular weather
      console.warn('Sunset check failed:', e);
    }
  }
  
  return weather;
}

// Export for use in main app
if (typeof window !== 'undefined') {
  window.updateNewOverviewPage = updateNewOverviewPage;
  
  // Auto-call on DOM ready as a fallback
  document.addEventListener('DOMContentLoaded', () => {
    console.log('overview-new.js DOMContentLoaded - calling updateNewOverviewPage');
    setTimeout(() => {
      updateNewOverviewPage().catch(err => console.error('Auto-update failed:', err));
    }, 100);
  });
}
