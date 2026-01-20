// frontend/threejs/lightning.js
import * as THREE from '../vendor/three.module.js';

let lightningLight = null;
let flashTimer = 0;

export function setupLightning(scene, camera) {
  lightningLight = new THREE.PointLight(0xaed9ff, 0, 30);
  lightningLight.position.set(-1, 5, 1);
  scene.add(lightningLight);
}

export function updateLightning(delta, weather) {
  if (!lightningLight) return;
  if (!weather) weather = {};

  const cond = weather.condition || "clear";
  const intensity = weather.intensity ?? 0;

  const isStorm = cond === "storm";

  // If no storm, fade out light
  if (!isStorm) {
    lightningLight.intensity += (0 - lightningLight.intensity) * 0.2;
    flashTimer = 0;
    return;
  }

  // Randomly trigger flashes when stormy
  if (flashTimer <= 0 && Math.random() < 0.004 * (0.6 + intensity)) {
    lightningLight.intensity = 9 + Math.random() * 6;
    flashTimer = 0.12 + Math.random() * 0.15;
  }

  if (flashTimer > 0) {
    flashTimer -= delta;

    if (flashTimer <= 0) {
      lightningLight.intensity = 0;
    } else {
      // Slight flicker during flash
      lightningLight.intensity *= 0.9 + Math.random() * 0.2;
    }
  }
}
