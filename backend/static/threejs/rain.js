// frontend/threejs/rain.js
import * as THREE from '../vendor/three.module.js';

let rainPoints = null;

// Create a circular raindrop texture
function createRainTexture() {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  const center = size / 2;
  const radius = size / 2;
  
  // Create elongated raindrop shape
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
  gradient.addColorStop(0, 'rgba(158, 197, 255, 1)');
  gradient.addColorStop(0.3, 'rgba(158, 197, 255, 0.8)');
  gradient.addColorStop(1, 'rgba(158, 197, 255, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function setupRain(scene) {
  const count = 400;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const ix = i * 3;
    positions[ix] = (Math.random() - 0.5) * 10;      // x
    positions[ix + 1] = Math.random() * 8 + 1;       // y
    positions[ix + 2] = -4 + Math.random() * 4;      // z
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const rainTexture = createRainTexture();

  const mat = new THREE.PointsMaterial({
    color: 0x9ec5ff,
    size: 0.5,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    map: rainTexture,
    alphaTest: 0.01,
    sizeAttenuation: false,
  });

  rainPoints = new THREE.Points(geo, mat);
  scene.add(rainPoints);
}

export function updateRain(delta, weather) {
  if (!rainPoints) return;
  if (!weather) weather = {};

  const cond = weather.condition || "clear";
  const intensity = weather.intensity ?? 0;

  const isRaining = cond === "rain" || cond === "storm";

  const mat = rainPoints.material;
  const targetOpacity = isRaining ? 0.5 + 0.4 * intensity : 0.0;
  mat.opacity += (targetOpacity - mat.opacity) * 0.15;

  const positions = rainPoints.geometry.attributes.position.array;
  const speed = 10 * (0.5 + intensity); // world units per second
  const wind = 1.0 * (0.3 + intensity);

  for (let i = 0; i < positions.length; i += 3) {
    positions[i] += wind * delta * 0.6;
    positions[i + 1] -= speed * delta;

    if (positions[i + 1] < -0.5) {
      positions[i + 1] = 7 + Math.random() * 3;
      positions[i] = (Math.random() - 0.5) * 10;
      positions[i + 2] = -4 + Math.random() * 4;
    }
  }

  rainPoints.geometry.attributes.position.needsUpdate = true;
}
