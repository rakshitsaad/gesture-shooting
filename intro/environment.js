// The ruined street: real geometry, Poly Haven PBR materials, burnt props,
// fire, smoke, flickering lights and a wet road. The street runs along Z and
// the camera looks toward -Z; one unit is one metre.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createAsh, createBlood, createFire, createSmoke } from './particles.js';

export const FOG_COLOR = 0x120b0a;
const FOG_DENSITY = 0.021;
const ROAD_HALF = 7.5;
const WALK_HALF = 11;
const Z_NEAR = 96, Z_FAR = -92;

const rand = (a, b) => a + Math.random() * (b - a);

// Dirt and soot baked in from world position, so props without proper UVs
// still get surface detail. Also adds wetness to anything near the ground.
function addGrime(material, grimeMap, scale = 0.28, strength = 1) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGrime = { value: grimeMap };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        #ifdef USE_INSTANCING
          vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform sampler2D uGrime;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float grime = texture2D(uGrime, (vWPos.xz + vWPos.yy * 0.71) * ${scale.toFixed(3)}).g;
        diffuseColor.rgb *= mix(1.0, smoothstep(0.02, 0.5, grime) * 1.15 + 0.1, ${strength.toFixed(3)});`);
  };
  material.customProgramCacheKey = () => `grime${scale}${strength}`;
  return material;
}

// The road: real asphalt with puddles picked out by low-frequency noise. In a
// puddle the surface goes darker and glossy, and reflects the fires around it.
function roadMaterial(t) {
  const mat = new THREE.MeshStandardMaterial({
    map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap,
    color: 0x8e8a86, roughness: 0.82, metalness: 0.0, normalScale: new THREE.Vector2(0.8, 0.8), envMapIntensity: 1.3
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        float rhash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        float rnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(rhash(i), rhash(i + vec2(1, 0)), f.x), mix(rhash(i + vec2(0, 1)), rhash(i + vec2(1, 1)), f.x), f.y); }
        float wetness() { float n = rnoise(vWPos.xz * 0.22) * 0.65 + rnoise(vWPos.xz * 0.61) * 0.35; return smoothstep(0.44, 0.6, n); }`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(1.0, 0.42, wetness());')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.2, wetness());')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, wetness() * 0.9));');
  };
  return mat;
}

// A facade tile: real concrete with rows of black, broken windows and soot
// running down from them. A matching glow map lights a few windows from inside.
function facadeTextures(concrete) {
  const S = 1024, COLS = 4, ROWS = 4;
  const color = document.createElement('canvas'), glow = document.createElement('canvas');
  color.width = color.height = glow.width = glow.height = S;
  const c = color.getContext('2d'), g = glow.getContext('2d');
  c.drawImage(concrete.map.image, 0, 0, S, S);
  c.fillStyle = 'rgba(30,27,25,0.55)';
  c.fillRect(0, 0, S, S);
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  const cw = S / COLS, ch = S / ROWS;
  for (let y = 0; y < ROWS; y++) {
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.fillRect(0, y * ch, S, 7);
    for (let x = 0; x < COLS; x++) {
      const wx = x * cw + cw * 0.2, wy = y * ch + ch * 0.2, ww = cw * 0.6, wh = ch * 0.6;
      c.fillStyle = '#050505';
      c.fillRect(wx, wy, ww, wh);
      const lit = Math.random();
      if (lit < 0.11) {
        const grad = g.createLinearGradient(0, wy + wh, 0, wy);
        grad.addColorStop(0, '#ff7a22');
        grad.addColorStop(1, '#5a1404');
        g.fillStyle = grad;
        g.fillRect(wx, wy, ww, wh);
      } else if (lit < 0.2) {
        c.fillStyle = 'rgba(60,70,80,0.5)';
        c.fillRect(wx + 3, wy + 3, ww * 0.5, wh * 0.7);
      }
      c.strokeStyle = 'rgba(22,20,18,0.9)';
      c.lineWidth = 7;
      c.strokeRect(wx, wy, ww, wh);
      // Scorch and streaks below and above the frame
      const soot = c.createLinearGradient(0, wy - ch * 0.3, 0, wy);
      soot.addColorStop(0, 'rgba(0,0,0,0)');
      soot.addColorStop(1, `rgba(0,0,0,${rand(0.25, 0.85).toFixed(2)})`);
      c.fillStyle = soot;
      c.fillRect(wx - 10, wy - ch * 0.3, ww + 20, ch * 0.3);
      c.fillStyle = `rgba(0,0,0,${rand(0.1, 0.3).toFixed(2)})`;
      c.fillRect(wx + rand(0, ww), wy + wh, rand(5, 26), ch * rand(0.1, 0.35));
    }
  }
  const make = (canvas, srgb) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { color: make(color, true), glow: make(glow, true) };
}

// One box whose UVs are in metres, so windows stay the same size on every
// building and line up from floor to floor
function box(x, y, z, w, h, d, tint, floorOffset = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal'), uv = geo.getAttribute('uv');
  const TILE_W = 16, TILE_H = 14;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i) + x, py = pos.getY(i) + y, pz = pos.getZ(i) + z;
    const u = Math.abs(nor.getX(i)) > 0.5 ? pz : px;
    uv.setXY(i, Math.round(u / 4) * 4 / TILE_W + (Math.abs(nor.getY(i)) > 0.5 ? 0 : 0), (py + floorOffset) / TILE_H);
    if (Math.abs(nor.getY(i)) > 0.5) uv.setXY(i, 0.02, 0.02);
  }
  geo.translate(x, y, z);
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const shade = tint * (0.9 + Math.random() * 0.1);
    colors[i * 3] = shade; colors[i * 3 + 1] = shade * 0.97; colors[i * 3 + 2] = shade * 0.94;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

// Bottom floors solid; above that the block breaks up into jagged columns,
// with some exposed floor slabs where the walls have gone
function ruin(parts, side, zc, width, depth, height) {
  const tint = rand(0.4, 0.95);
  const solid = height * rand(0.55, 0.75);
  const x = side * (WALK_HALF + depth / 2);
  const offset = Math.round(rand(0, 4)) * 3.5;
  parts.push(box(x, solid / 2, zc, depth, solid, width, tint, offset));
  const cols = 2 + Math.floor(Math.random() * 4);
  const cw = width / cols;
  for (let i = 0; i < cols; i++) {
    const h = (height - solid) * Math.random() * Math.random() * 1.6;
    if (h < 0.8) continue;
    const z = zc - width / 2 + cw * (i + 0.5);
    parts.push(box(x + side * rand(0, 2), solid + h / 2, z, depth - rand(0, 4), h, cw * rand(0.7, 1), tint, offset));
    if (Math.random() < 0.5) parts.push(box(x - side * rand(1, 3), solid + h * rand(0.3, 0.9), z, depth + rand(0, 2), 0.3, cw * 0.9, tint * 0.6));
  }
  // A blown-out corner lets the sky show through the skyline
  if (Math.random() < 0.45) parts.push(box(x - side * depth * 0.3, solid * 0.85, zc + width * 0.3, depth * 0.3, 0.35, width * 0.32, tint * 0.5));
}

function buildCity(scene, assets, facade, materials) {
  const parts = [];
  for (const side of [-1, 1]) {
    let z = Z_NEAR;
    while (z > Z_FAR) {
      const w = rand(11, 20), gap = Math.random() < 0.14 ? rand(3, 6) : rand(0, 0.6);
      ruin(parts, side, z - w / 2, w, rand(12, 18), rand(13, 38));
      z -= w + gap;
    }
    // A second, taller row breaks the skyline behind
    z = Z_NEAR;
    while (z > Z_FAR - 40) {
      const w = rand(16, 28);
      const h = rand(30, 62);
      parts.push(box(side * (WALK_HALF + rand(26, 38)), h / 2, z - w / 2, 18, h, w, rand(0.3, 0.55)));
      z -= w + rand(1, 8);
    }
  }
  // Across the far end of the street, lost in the fog
  for (let i = 0; i < 7; i++) {
    const h = rand(26, 60), w = rand(14, 24);
    parts.push(box(-48 + i * 16 + rand(-3, 3), h / 2, Z_FAR - rand(5, 28), w, h, 16, rand(0.3, 0.5)));
  }
  const geometry = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  const material = new THREE.MeshStandardMaterial({
    map: facade.color, emissiveMap: facade.glow, emissive: 0xffffff, emissiveIntensity: 1.5,
    normalMap: assets.textures.concrete_wall_004.normalMap, roughness: 0.95, metalness: 0, vertexColors: true
  });
  materials.push(material);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return material;
}

function buildGround(scene, assets, materials) {
  const len = Z_NEAR - Z_FAR + 80, zMid = (Z_NEAR + Z_FAR) / 2;
  const road = roadMaterial(assets.textures.road_damaged);
  materials.push(road);
  const roadTex = assets.textures.road_damaged;
  for (const t of [roadTex.map, roadTex.normalMap, roadTex.roughnessMap]) t.repeat.set(3, len / 5);
  const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, len), road);
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.position.z = zMid;
  roadMesh.receiveShadow = true;
  scene.add(roadMesh);

  const walkTex = assets.textures.dirty_concrete;
  for (const t of [walkTex.map, walkTex.normalMap, walkTex.roughnessMap]) t.repeat.set(1, len / 3.5);
  const walkMat = new THREE.MeshStandardMaterial({ map: walkTex.map, normalMap: walkTex.normalMap, roughnessMap: walkTex.roughnessMap, color: 0x77726e });
  materials.push(walkMat);
  for (const side of [-1, 1]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(WALK_HALF - ROAD_HALF, 0.18, len), walkMat);
    walk.position.set(side * (WALK_HALF + ROAD_HALF) / 2, 0.09, zMid);
    walk.receiveShadow = true;
    scene.add(walk);
  }

  // Faded lane paint, some of it missing
  const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 3), new THREE.MeshStandardMaterial({ color: 0x8c8676, roughness: 0.9, transparent: true, opacity: 0.45 }), 26);
  materials.push(dashes.material);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  for (let i = 0; i < 26; i++) {
    const on = Math.random() > 0.25 ? 1 : 0.001;
    m.compose(new THREE.Vector3(0, 0.012, Z_NEAR - 6 - i * 7), q, new THREE.Vector3(1, on, 1));
    dashes.setMatrixAt(i, m);
  }
  scene.add(dashes);

  // Burnt scars under wrecks and rubble piles along the kerbs
  const burn = assets.textures.burned_ground_01;
  const scorch = new THREE.MeshStandardMaterial({ map: burn.map, normalMap: burn.normalMap, roughness: 0.95, transparent: true, alphaMap: radialAlpha(), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  materials.push(scorch);
  scene.userData.scorch = scorch;

  const debris = assets.textures.concrete_debris;
  const rubbleMat = new THREE.MeshStandardMaterial({ map: debris.map, normalMap: debris.normalMap, roughnessMap: debris.roughnessMap, color: 0x8a8580 });
  materials.push(rubbleMat);
  const COUNT = 620;
  const chunks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), rubbleMat, COUNT);
  const pos = new THREE.Vector3(), rot = new THREE.Quaternion(), scl = new THREE.Vector3(), e = new THREE.Euler();
  const color = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    const pile = i % 3 !== 0;
    const side = Math.random() < 0.5 ? -1 : 1;
    const s = pile ? rand(0.08, 0.55) : rand(0.03, 0.14);
    // Piles hug the walls and kerbs; loose chunks lie anywhere but the camera's lane
    const x = pile ? side * rand(ROAD_HALF - 2.2, WALK_HALF - 0.4) : side * rand(1.8, ROAD_HALF);
    pos.set(x, s * 0.45, rand(Z_FAR, Z_NEAR));
    e.set(rand(0, 6), rand(0, 6), rand(0, 6));
    scl.set(s * rand(0.8, 1.7), s * rand(0.5, 1.1), s * rand(0.8, 1.6));
    chunks.setMatrixAt(i, m.compose(pos, rot.setFromEuler(e), scl));
    chunks.setColorAt(i, color.setScalar(rand(0.45, 1)));
  }
  chunks.castShadow = chunks.receiveShadow = true;
  scene.add(chunks);
}

function radialAlpha() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.55, '#aaa');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// Scales a model to a target length or height, standing on the ground
function placed(model, size, axis, x, y, z, rotY, tilt = 0) {
  const root = new THREE.Group();
  const inner = model.scene.clone(true);
  const bb = new THREE.Box3().setFromObject(inner);
  const dim = bb.getSize(new THREE.Vector3());
  const s = size / Math.max(1e-4, axis === 'len' ? Math.max(dim.x, dim.z) : dim.y);
  inner.scale.multiplyScalar(s);
  inner.position.y -= bb.min.y * s;
  root.add(inner);
  root.position.set(x, y, z);
  root.rotation.set(0, rotY, tilt);
  return root;
}

// Burnt-out versions of whatever the model's materials were. Shared per
// source material, so a dozen wrecks stay cheap.
function burntMaterials(root, grime, cache, materials, keep = 0.3) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.material;
    let mat = cache.get(src);
    if (!mat) {
      const name = (src.name || '').toLowerCase();
      const glassy = /window|glass/.test(name);
      const col = src.color.clone().multiplyScalar(glassy ? 0.05 : keep).lerp(new THREE.Color(0x1a1512), glassy ? 0.2 : 0.55);
      mat = new THREE.MeshStandardMaterial({ color: col, map: src.map || null, roughness: glassy ? 0.25 : 0.82, metalness: glassy ? 0.2 : 0.45 });
      if (!glassy) addGrime(mat, grime);
      cache.set(src, mat);
      materials.push(mat);
    }
    o.material = mat;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return root;
}

export const BURNING_WRECKS = [
  { x: -4.3, z: 72, r: 0.5 }, { x: 4.4, z: 52, r: 2.5 }, { x: -3.8, z: 33, r: -0.45 }, { x: 4.7, z: 14, r: 1.9 }, { x: -4.6, z: -14, r: 0.9 }, { x: 3.8, z: -38, r: 2.2 }
];

export function buildEnvironment(scene, renderer, assets, profile) {
  const materials = [];
  const shared = {
    uTime: { value: 0 },
    uFogDensity: { value: FOG_DENSITY },
    uFogColor: { value: new THREE.Color(FOG_COLOR) },
    uPx: { value: renderer.domElement.height / 2 }
  };
  scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);
  scene.background = new THREE.Color(FOG_COLOR);

  const sky = buildSky(shared);
  scene.add(sky);

  const facade = facadeTextures(assets.textures.concrete_wall_004);
  const facadeMat = buildCity(scene, assets, facade, materials);
  buildGround(scene, assets, materials);

  const grime = assets.textures.burned_ground_01.map;
  const cache = new Map();
  const M = assets.models;
  const props = new THREE.Group();
  scene.add(props);
  const add = (obj) => { props.add(obj); return obj; };
  const carPick = [M.car_sedan, M.car_suv, M.car_pickup];

  const fireEmitters = [], smokeEmitters = [];
  const scorchGeo = new THREE.PlaneGeometry(1, 1);
  for (const w of BURNING_WRECKS) {
    add(burntMaterials(placed(M.car_broken, 4.5, 'len', w.x, 0, w.z, w.r), grime, cache, materials, 0.45));
    fireEmitters.push({ x: w.x, y: 0.55, z: w.z, w: 3, d: 1.5, scale: 1.25 });
    smokeEmitters.push({ x: w.x, y: 1.6, z: w.z, w: 2, d: 1.2, scale: 1 });
    const s = new THREE.Mesh(scorchGeo, scene.userData.scorch);
    s.rotation.x = -Math.PI / 2;
    s.position.set(w.x, 0.02, w.z);
    s.scale.setScalar(9);
    add(s);
  }
  // Abandoned traffic, burnt but not burning, keeps the lane clear down the middle
  const cars = [
    [5.2, 84, 1.4], [-5, 60, -0.2], [5.7, 42, 3.0], [5.1, 28, 1.5], [-5.2, 22, 2.9], [5.4, 4, 0.2], [-5.4, 2, 1.25],
    [-4.9, -26, 0.3], [5.2, -22, 2.9], [-5.2, -48, 1.7], [5, -58, 0.4]
  ];
  cars.forEach(([x, z, r], i) => {
    const model = z === 28 ? M.car_police : carPick[i % carPick.length];
    add(burntMaterials(placed(model, z === 28 ? 4.6 : rand(4.2, 5), 'len', x, 0, z, r, rand(-0.03, 0.03)), grime, cache, materials, 0.55));
  });

  // Street lights, a few of them knocked sideways
  const poles = [];
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1;
    const z = Z_NEAR - 8 - i * 14;
    const bent = Math.random() < 0.3 ? rand(0.12, 0.28) * (Math.random() < 0.5 ? -1 : 1) : 0;
    const pole = burntMaterials(placed(M.street_light, 6.4, 'h', side * (ROAD_HALF + 0.9), 0.1, z, side > 0 ? Math.PI / 2 : -Math.PI / 2), grime, cache, materials, 0.7);
    pole.rotation.z = bent;
    add(pole);
    poles.push({ x: side * (ROAD_HALF - 0.4), z, side });
  }

  // Military barricades: concrete barriers and sandbags closing off the sides
  for (const [x, z, r] of [[-5.5, 47, 0.08], [5.9, 47, -0.1], [-5.1, 10, 0.15], [5.7, 9.3, -0.05], [-5.5, -32, 0.05], [5.4, -32, 0]]) {
    add(burntMaterials(placed(M.barrier_large, 4.4, 'len', x, 0, z, r), grime, cache, materials, 0.8));
    add(burntMaterials(placed(M.sandbags, 2.7, 'len', x > 0 ? x - 1.5 : x + 1.5, 0, z + 0.9, r + 0.2), grime, cache, materials, 0.7));
  }
  for (const [x, z] of [[-6.5, 56], [6.5, 37], [-6.8, 30], [6.8, 19], [-6.4, 5]]) {
    add(burntMaterials(placed(M.barrel, 1, 'h', x, 0, z, rand(0, 6), rand(-0.05, 0.05)), grime, cache, materials, 0.5));
  }
  // Kept out of the stretch of road where the zombie is seen up close
  for (let i = 0; i < 14; i++) {
    const z = Math.random() < 0.5 ? rand(-30, 30) : rand(47, 80);
    add(burntMaterials(placed(M.bricks, rand(1, 2), 'len', (Math.random() < 0.5 ? -1 : 1) * rand(2.5, 7), 0, z, rand(0, 6)), grime, cache, materials, 0.6));
  }

  // Fire and smoke
  const fire = createFire(fireEmitters, shared);
  const smoke = createSmoke(smokeEmitters, shared);
  // Big columns from fires deeper in the city
  const columns = createSmoke([
    { x: -30, y: 6, z: -30, w: 8, d: 8, scale: 4.5 }, { x: 34, y: 8, z: -10, w: 8, d: 8, scale: 4 }, { x: -24, y: 14, z: 30, w: 6, d: 6, scale: 3.4 },
    { x: 8, y: 4, z: -74, w: 8, d: 8, scale: 5 }, { x: 26, y: 8, z: 58, w: 6, d: 6, scale: 3 }
  ], shared, { perEmitter: 24, rate: 0.045, rise: 13, size0: 3.2, size1: 11, windX: 7, windZ: -2, opacity: 0.75, color: 0x3a2d28, glow: 0x8a2c0c, order: 1 });
  // Low fog drifting along the road
  const fogEmit = [];
  for (let i = 0; i < 30; i++) fogEmit.push({ x: rand(-9, 9), y: 0.5, z: rand(-60, 90), w: 4, d: 4, scale: 1 });
  const groundFog = createSmoke(fogEmit, shared, { perEmitter: 3, rate: 0.03, rise: 1.3, spread: 8, size0: 8, size1: 13, windX: 6, windZ: 2, opacity: 0.2, color: 0x362624, glow: 0x362624, order: 1 });
  const ash = createAsh(shared);
  const blood = createBlood(shared);
  scene.add(columns, groundFog, smoke, fire, ash, blood.points);

  // Lighting
  scene.add(new THREE.HemisphereLight(0x4a4660, 0x2a160e, 1.25));
  const moon = new THREE.DirectionalLight(0x8496c8, 1.5);
  moon.position.set(-26, 50, 30);
  moon.target.position.set(0, 0, 25);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -44, right: 44, top: 60, bottom: -60, near: 1, far: 160 });
  moon.shadow.bias = -0.0008;
  moon.shadow.autoUpdate = false;
  moon.shadow.needsUpdate = true;
  scene.add(moon, moon.target);

  // A fixed set of lights slid along to whichever fires are nearest the camera
  const fireLights = [];
  for (let i = 0; i < 4; i++) {
    const l = new THREE.PointLight(0xff6a1e, 0, 34, 1.8);
    scene.add(l);
    fireLights.push(l);
  }
  // Red emergency beacon on the police car
  const beacon = new THREE.PointLight(0xd52222, 0, 26, 1.7);
  beacon.position.set(5.1, 2, 28);
  scene.add(beacon);
  // The flickering street lamp the zombie stands under; casts the moving shadow
  const lamp = new THREE.SpotLight(0xc8d4ff, 0, 34, 0.72, 0.65, 1.3);
  lamp.position.set(-3, 7.6, 27.5);
  lamp.target.position.set(-0.4, 0, 27.5);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  lamp.shadow.camera.near = 1;
  lamp.shadow.camera.far = 22;
  lamp.shadow.bias = -0.002;
  scene.add(lamp, lamp.target);

  // Glowing lamp heads plus their smeared reflection on the wet road
  const glowTex = softGlowTexture();
  const lampGlows = [];
  const makeSprite = (color, sx, sy) => {
    const mat = new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(sx, sy, 1);
    materials.push(mat);
    return s;
  };
  poles.forEach((p, i) => {
    if (i % 3 === 2) return;   // dead lamps
    const head = makeSprite(0x3f4766, 0.7, 0.7);
    head.position.set(p.x, 6.2, p.z);
    scene.add(head);
    const smear = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 9), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x4a5270, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
    smear.rotation.x = -Math.PI / 2;
    smear.position.set(p.x, 0.03, p.z);
    materials.push(smear.material);
    scene.add(smear);
    lampGlows.push({ head, smear, seed: Math.random() * 50 });
  });
  // Orange smears under each fire, and the red beacon's
  for (const w of BURNING_WRECKS) {
    const smear = new THREE.Mesh(new THREE.PlaneGeometry(5, 15), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x34130a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
    smear.rotation.x = -Math.PI / 2;
    smear.position.set(w.x * 0.82, 0.035, w.z + 4.5);
    materials.push(smear.material);
    scene.add(smear);
  }

  // Reflections come from a small map of the fires and sky, not the real
  // scene, so the wet road costs nothing extra per frame
  scene.environment = bakeEnvironment(renderer);
  scene.environmentIntensity = 0.55;

  const sparse = [fire, smoke, columns, groundFog];
  const v = new THREE.Vector3();
  const update = (t, dt, camera) => {
    shared.uTime.value = t;
    ash.material.uniforms.uCam.value.copy(camera.position);

    // Fire lights jump to the nearest wrecks ahead of the camera
    const near = BURNING_WRECKS
      .map((w) => ({ w, d: Math.abs(w.z - camera.position.z + 6) }))
      .sort((a, b) => a.d - b.d);
    fireLights.forEach((l, i) => {
      if (!l.visible) return;
      const w = near[i].w;
      const flick = 0.72 + 0.28 * Math.sin(t * 13 + i * 3) * Math.sin(t * 7.3 + i) + Math.sin(t * 29 + i * 5) * 0.08;
      l.position.set(w.x + Math.sin(t * 5 + i) * 0.25, 2.1 + Math.sin(t * 9 + i) * 0.25, w.z);
      l.intensity = 42 * flick;
    });
    beacon.intensity = 4.5 * Math.pow(Math.max(0, Math.sin(t * 5.2)), 3);
    // The lamp stutters like a failing tube
    const stutter = Math.sin(t * 2.3) + Math.sin(t * 7.1) * 0.5 > 1.05 ? 0.12 : 1;
    lamp.intensity = 150 * stutter * (0.93 + Math.sin(t * 91) * 0.07);
    for (const g of lampGlows) {
      const on = Math.sin(t * 1.3 + g.seed) + Math.sin(t * 6.1 + g.seed * 2) * 0.35 > -0.95 ? 1 : 0.1;
      g.head.material.opacity = on;
      g.smear.material.opacity = on * 0.6;
    }
    facadeMat.emissiveIntensity = 0.8 + Math.sin(t * 2.7) * 0.18 * Math.sin(t * 11.3);
    sky.material.uniforms.uTime.value = t;
    v.copy(camera.position);
    sky.position.copy(v);
  };

  const applyProfile = (p) => {
    for (const m of sparse) m.geometry.instanceCount = Math.ceil(m.userData.fullCount * p.particles);
    ash.geometry.setDrawRange(0, Math.ceil(ash.userData.fullCount * p.particles));
    moon.castShadow = p.shadows > 0;
    lamp.castShadow = p.shadows > 1;
    moon.shadow.needsUpdate = true;
    fireLights.forEach((l, i) => { l.visible = i < p.fireLights; if (!l.visible) l.intensity = 0; });
    shared.uPx.value = renderer.domElement.height / 2;
  };
  applyProfile(profile);

  const dispose = () => {
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of materials) m.dispose();
    facade.color.dispose();
    facade.glow.dispose();
    glowTex.dispose();
    for (const set of Object.values(assets.textures)) for (const t of Object.values(set)) t.dispose();
    if (scene.environment) scene.environment.dispose();
    sky.material.dispose();
    [fire, smoke, columns, groundFog, ash, blood.points].forEach((m) => m.material.dispose());
  };

  return { update, applyProfile, dispose, blood, grime, lamp, shared };
}

function softGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function buildSky(shared) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    uniforms: { uTime: { value: 0 }, uFogColor: shared.uFogColor },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uFogColor;
      varying vec3 vDir;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + 11.0; a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float up = clamp(d.y, 0.0, 1.0);
        vec2 p = d.xz / (0.18 + up) * 1.25;
        float c = fbm(p + vec2(uTime * 0.012, uTime * 0.005));
        float c2 = fbm(p * 2.1 - vec2(uTime * 0.02, 0.0));
        vec3 top = vec3(0.012, 0.012, 0.018);
        vec3 lit = vec3(0.27, 0.07, 0.03);
        vec3 col = mix(top, lit, smoothstep(0.34, 0.8, c) * exp(-up * 2.6));
        col += vec3(0.6, 0.12, 0.03) * pow(c2, 2.0) * exp(-up * 5.5);
        col = mix(uFogColor * 1.35, col, smoothstep(0.0, 0.2, up));
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16), material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

function bakeEnvironment(renderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x07060a);
  const glow = (color, x, y, z, s) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 16, 12), new THREE.MeshBasicMaterial({ color }));
    mesh.position.set(x, y, z);
    env.add(mesh);
  };
  const orange = new THREE.Color(0xff5a14).multiplyScalar(2.6);
  glow(orange, -30, 10, -40, 12);
  glow(orange, 34, 8, -18, 10);
  glow(orange, -24, 7, 35, 9);
  glow(orange, 28, 9, 36, 8);
  glow(new THREE.Color(0x8ea0ff).multiplyScalar(2), -6, 60, -12, 16);
  glow(new THREE.Color(0xff8a40).multiplyScalar(2.2), 0, 4, -90, 26);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(env, 0.02);
  pm.dispose();
  env.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return rt.texture;
}
