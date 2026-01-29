// frontend/threejs/snow.js
import * as THREE from '../vendor/three.module.js';

let snowPoints = null;

// Create a simple circular texture for snowflakes
function createSnowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  const center = size / 2;
  const radius = size / 2;
  
  // Create radial gradient for soft circular snowflake
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function setupSnow(scene) {
  console.log('Setting up snow particles...');
  const count = 400; // More particles for continuous effect
  const positions = new Float32Array(count * 3);

  // Distribute snowflakes throughout the falling area
  for (let i = 0; i < count; i++) {
    const ix = i * 3;
    positions[ix] = (Math.random() - 0.5) * 12; // Horizontal spread
    positions[ix + 1] = Math.random() * 14 - 2; // From above screen to below screen
    positions[ix + 2] = -5 + Math.random() * 5; // Depth
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const snowTexture = createSnowTexture();
  
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 5,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    sizeAttenuation: false,
    map: snowTexture,
    alphaTest: 0.01,
  });

  snowPoints = new THREE.Points(geo, mat);
  scene.add(snowPoints);
  console.log('Snow system initialized:', count, 'particles');
}

export function updateSnow(delta, weather) {
  if (!snowPoints) {
    console.warn('Snow: snowPoints not initialized');
    return;
  }
  if (!weather) weather = {};

  const cond = weather.condition || "clear";
  const intensity = weather.intensity ?? 0;
  const isSnow = cond === "snow";

  const mat = snowPoints.material;
  const targetOpacity = isSnow ? (0.7 + intensity * 0.2) : 0.0;
  mat.opacity += (targetOpacity - mat.opacity) * 0.12;
  
  if (Math.random() < 0.01) {
    console.log(`Snow: opacity=${mat.opacity.toFixed(2)}, condition=${cond}, isSnow=${isSnow}`);
  }

  const positions = snowPoints.geometry.attributes.position.array;
  const fallSpeed = 0.8 * (0.6 + intensity * 0.4);

  for (let i = 0; i < positions.length; i += 3) {
    // Snow falls down
    positions[i + 1] -= fallSpeed * delta;
    
    // Gentle horizontal drift
    positions[i] += Math.sin(positions[i + 1] * 0.5 + i * 0.1) * 0.012;
    
    // Only reset when snowflake exits the bottom of the screen
    // Screen roughly goes from y=8 (top) to y=-3 (bottom)
    if (positions[i + 1] < -3.0) {
      // Respawn just above the top of screen with random horizontal position
      positions[i] = (Math.random() - 0.5) * 12;
      positions[i + 1] = 8.5 + Math.random() * 1; // Just above visible area
      positions[i + 2] = -5 + Math.random() * 5;
    }
  }

  snowPoints.geometry.attributes.position.needsUpdate = true;
}
