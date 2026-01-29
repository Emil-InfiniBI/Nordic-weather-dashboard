import * as THREE from "../vendor/three.module.js";

let scene, camera, renderer;
let cloudLayers = [];

export function initCinematicFog() {
    const canvas = document.getElementById("bg");

    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene = new THREE.Scene();

    // MUCH LIGHTER fog, blue-tinted
    scene.fog = new THREE.FogExp2(0x0a1a2f, 0.012);

    camera = new THREE.PerspectiveCamera(
        55,
        window.innerWidth / window.innerHeight,
        0.1,
        2000
    );
    camera.position.set(0, 0, 60);

    /* STRONGER atmospheric light */
    const hemi = new THREE.HemisphereLight(0x88aaff, 0x080820, 0.8);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.45);
    dir.position.set(0, 80, 120);
    scene.add(dir);

    /* CLOUD TEXTURE */
    const loader = new THREE.TextureLoader();
    const cloudTex = loader.load("/threejs/textures/cloud_soft.png");

    /* CLOUD LAYERS WITH BETTER CONTRAST */
    addCloudLayer(cloudTex, -40, 0.25);
    addCloudLayer(cloudTex, -80, 0.35);
    addCloudLayer(cloudTex, -120, 0.45);

    window.addEventListener("resize", onResize, false);
    animate();
}

function addCloudLayer(texture, z, opacity) {
    const material = new THREE.MeshLambertMaterial({
        map: texture,
        transparent: true,
        opacity: opacity,
        depthWrite: false
    });

    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(250, 150),
        material
    );

    plane.position.z = z;
    plane.position.y = -10;
    plane.rotation.z = Math.random() * 0.2 - 0.1;

    cloudLayers.push(plane);
    scene.add(plane);
}

function animate() {
    // Static fog - no animation needed
    renderer.render(scene, camera);
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
