// frontend/threejs/clouds.js
import * as THREE from '../vendor/three.module.js';

let cloudGroup = null;

export function setupClouds(scene) {
  cloudGroup = new THREE.Group();

  const cloudColor = new THREE.Color(0xf5f7fb);

  for (let i = 0; i < 70; i++) {
    const geo = new THREE.SphereGeometry(0.6 + Math.random() * 0.8, 18, 18);
    const mat = new THREE.MeshPhongMaterial({
      color: cloudColor,
      transparent: true,
      opacity: 0.0,
      shininess: 10,
    });

    const mesh = new THREE.Mesh(geo, mat);

    mesh.position.set(
      (Math.random() - 0.5) * 14,      // x spread
      2.5 + Math.random() * 2.5,       // y height
      -3 + Math.random() * 4           // z depth
    );

    mesh.scale.setScalar(1.2 + Math.random() * 1.5);
    cloudGroup.add(mesh);
  }

  scene.add(cloudGroup);
}

export function updateClouds(delta, weather) {
  if (!cloudGroup) return;
  if (!weather) weather = {};

  const cond = weather.condition || "clear";
  const intensity = weather.intensity ?? 0;

  // Target opacity based on condition
  let targetOpacity = 0.08;

  if (cond === "clear") targetOpacity = 0.08;
  else if (cond === "cloudy") targetOpacity = 0.35 + 0.25 * intensity;
  else if (cond === "rain") targetOpacity = 0.55 + 0.25 * intensity;
  else if (cond === "snow") targetOpacity = 0.5 + 0.2 * intensity;
  else if (cond === "storm") targetOpacity = 0.75 + 0.2 * intensity;

  targetOpacity = Math.min(targetOpacity, 0.9);

  const driftSpeed = 0.15 + 0.6 * intensity;

  cloudGroup.children.forEach((mesh, idx) => {
    const m = mesh.material;

    // Smooth opacity transition
    m.opacity += (targetOpacity - m.opacity) * 0.05;

    // Slow horizontal drift only - no wobble
    mesh.position.x += driftSpeed * delta * 0.6;

    if (mesh.position.x > 8) mesh.position.x = -8 - Math.random() * 2;
  });
}
