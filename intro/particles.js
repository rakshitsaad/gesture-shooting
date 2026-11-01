// Fire, smoke, ground fog, ash and blood. All motion happens in the vertex
// shader from a time uniform, so a thousand particles cost one draw call each
// and no per-frame JavaScript.
import * as THREE from 'three';

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { return vnoise(p) * 0.55 + vnoise(p * 2.1 + 3.7) * 0.3 + vnoise(p * 4.3 + 7.1) * 0.15; }
`;

const BILLBOARD_VS = /* glsl */ `
  attribute vec3 aEmit;
  attribute vec4 aSeed;
  attribute float aScale;
  uniform float uTime, uRate, uRise, uSpread, uSize0, uSize1, uStretch, uSpin;
  uniform vec2 uWind;
  uniform float uFogDensity;
  varying vec2 vUv;
  varying float vLife, vSeed, vFog;
  void main() {
    float life = fract(uTime * uRate * (0.75 + aSeed.w * 0.5) + aSeed.x);
    vec3 p = aEmit;
    p.y += life * uRise * aScale;
    vec2 side = (aSeed.yz - 0.5) * uSpread * aScale;
    p.xz += side * (0.5 + life * 1.4);
    p.xz += uWind * life * life * aScale;
    p.x += sin(uTime * 1.7 + aSeed.x * 40.0) * 0.18 * life * aScale;
    float size = mix(uSize0, uSize1, life) * aScale * (0.7 + aSeed.w * 0.6);
    float a = (aSeed.y * 6.283 + uTime * (aSeed.z - 0.5) * 0.6) * uSpin;
    vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * (position.xy * vec2(1.0, uStretch)) * size;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    mv.xy += q;
    gl_Position = projectionMatrix * mv;
    vUv = uv;
    vLife = life;
    vSeed = aSeed.x;
    float d = length(mv.xyz) * uFogDensity;
    vFog = exp(-d * d);
  }
`;

const FIRE_FS = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vLife, vSeed, vFog;
  ${NOISE}
  void main() {
    vec2 c = vUv - 0.5;
    // Tongues: noise stretched upward and scrolling up eats into a narrow body
    float n = fbm(vec2(vUv.x * 4.5 + vSeed * 9.0, vUv.y * 1.8 - uTime * 2.3));
    float d = length(c * vec2(1.7, 0.95)) * 2.0 + (n - 0.5) * 1.5;
    float body = smoothstep(0.95, 0.3, d);
    float a = body * smoothstep(1.0, 0.35, vLife) * smoothstep(0.0, 0.08, vLife);
    // Stops the noise reaching the edge of the quad, which would show its shape
    a *= smoothstep(0.5, 0.36, length(c)) * 0.5;
    if (a < 0.01) discard;
    float heat = body * (1.0 - vLife * 0.8);
    vec3 col = mix(vec3(0.5, 0.05, 0.012), vec3(1.7, 0.42, 0.05), smoothstep(0.05, 0.45, heat));
    col = mix(col, vec3(2.6, 1.45, 0.5), smoothstep(0.5, 0.95, heat));
    gl_FragColor = vec4(col * a * vFog, 1.0);
  }
`;

const SMOKE_FS = /* glsl */ `
  uniform float uTime, uOpacity;
  uniform vec3 uColor, uGlow, uFogColor;
  varying vec2 vUv;
  varying float vLife, vSeed, vFog;
  ${NOISE}
  void main() {
    vec2 c = vUv - 0.5;
    float n = fbm(vUv * 2.4 + vec2(vSeed * 13.0 + uTime * 0.05, -uTime * 0.11));
    float a = smoothstep(0.5, 0.1, length(c)) * smoothstep(0.18, 0.72, n);
    a *= sin(3.1416 * pow(vLife, 0.7)) * uOpacity;
    if (a < 0.004) discard;
    vec3 col = mix(uColor * (0.6 + n * 0.8), uGlow, pow(1.0 - vLife, 3.0));
    col = mix(uFogColor, col, vFog);
    gl_FragColor = vec4(col, a);
  }
`;

function billboards(emitters, perEmitter, material) {
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setAttribute('uv', quad.getAttribute('uv'));
  const n = emitters.length * perEmitter;
  const emit = new Float32Array(n * 3), seed = new Float32Array(n * 4), scale = new Float32Array(n);
  let i = 0;
  for (const e of emitters) {
    for (let k = 0; k < perEmitter; k++, i++) {
      emit[i * 3] = e.x + (Math.random() - 0.5) * (e.w || 0);
      emit[i * 3 + 1] = e.y;
      emit[i * 3 + 2] = e.z + (Math.random() - 0.5) * (e.d || 0);
      for (let c = 0; c < 4; c++) seed[i * 4 + c] = Math.random();
      scale[i] = e.scale;
    }
  }
  // Shuffled so lowering instanceCount thins every emitter evenly
  for (let a = n - 1; a > 0; a--) {
    const b = Math.floor(Math.random() * (a + 1));
    for (let c = 0; c < 3; c++) { const t = emit[a * 3 + c]; emit[a * 3 + c] = emit[b * 3 + c]; emit[b * 3 + c] = t; }
    const t = scale[a]; scale[a] = scale[b]; scale[b] = t;
  }
  geo.setAttribute('aEmit', new THREE.InstancedBufferAttribute(emit, 3));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scale, 1));
  geo.instanceCount = n;
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.userData.fullCount = n;
  return mesh;
}

export function createFire(emitters, shared, perEmitter = 64) {
  const material = new THREE.ShaderMaterial({
    vertexShader: BILLBOARD_VS,
    fragmentShader: FIRE_FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: {
      uTime: shared.uTime, uFogDensity: shared.uFogDensity, uRate: { value: 0.95 }, uRise: { value: 2.5 }, uSpread: { value: 0.75 },
      uSize0: { value: 1.05 }, uSize1: { value: 0.42 }, uStretch: { value: 1.9 }, uSpin: { value: 0 }, uWind: { value: new THREE.Vector2(0.45, -0.1) }
    }
  });
  const mesh = billboards(emitters, perEmitter, material);
  mesh.renderOrder = 3;
  return mesh;
}

export function createSmoke(emitters, shared, opts = {}) {
  const material = new THREE.ShaderMaterial({
    vertexShader: BILLBOARD_VS,
    fragmentShader: SMOKE_FS,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uTime: shared.uTime, uFogDensity: shared.uFogDensity, uFogColor: shared.uFogColor,
      uRate: { value: opts.rate ?? 0.12 }, uRise: { value: opts.rise ?? 11 }, uSpread: { value: opts.spread ?? 3 },
      uSize0: { value: opts.size0 ?? 2 }, uSize1: { value: opts.size1 ?? 8 }, uStretch: { value: 1 }, uSpin: { value: 1 }, uWind: { value: new THREE.Vector2(opts.windX ?? 4.5, opts.windZ ?? -1) },
      uOpacity: { value: opts.opacity ?? 0.62 }, uColor: { value: new THREE.Color(opts.color ?? 0x2a211d) }, uGlow: { value: new THREE.Color(opts.glow ?? 0x7a2a0c) }
    }
  });
  const mesh = billboards(emitters, opts.perEmitter ?? 26, material);
  mesh.renderOrder = opts.order ?? 2;
  return mesh;
}

// Ash and embers drifting around the camera, wrapped inside a box that
// follows it, so the air never runs out
export function createAsh(shared, count = 1400) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) { pos[i] = Math.random(); seed[i] = Math.random(); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: shared.uTime, uCam: { value: new THREE.Vector3() }, uPx: shared.uPx },
    vertexShader: /* glsl */ `
      attribute vec3 aSeed;
      uniform float uTime, uPx;
      uniform vec3 uCam;
      varying float vEmber, vA;
      void main() {
        vec3 box = vec3(26.0, 14.0, 26.0);
        vec3 p = position * box;
        p += vec3(0.55 + sin(uTime * 0.3 + aSeed.x * 6.0) * 0.5, -0.32 - aSeed.y * 0.3, 0.25) * uTime * (0.5 + aSeed.z);
        p = mod(p - uCam + box * 0.5, box) - box * 0.5 + uCam;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vEmber = step(0.86, aSeed.z);
        float flick = 0.6 + 0.4 * sin(uTime * (3.0 + aSeed.y * 9.0) + aSeed.x * 20.0);
        vA = (vEmber > 0.5 ? flick : 0.35) * smoothstep(13.0, 5.0, -mv.z);
        gl_PointSize = uPx * (vEmber > 0.5 ? 0.034 : 0.044) * (0.5 + aSeed.x) / max(1.0, -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      varying float vEmber, vA;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.2, d) * vA;
        if (a < 0.01) discard;
        vec3 col = vEmber > 0.5 ? vec3(2.4, 0.75, 0.16) : vec3(0.34, 0.31, 0.29);
        gl_FragColor = vec4(col * a, 1.0);
      }`
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 4;
  points.userData.fullCount = count;
  return points;
}

// One-shot spray for the bullet hit: fire() replays it from a new spot
export function createBlood(shared, count = 90) {
  const pos = new Float32Array(count * 3), vel = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * 6.283, s = 0.6 + Math.random() * 3.2;
    vel[i * 3] = Math.cos(a) * s * 0.8;
    vel[i * 3 + 1] = 0.6 + Math.random() * 2.6;
    vel[i * 3 + 2] = -Math.random() * 3.8 + 0.8;
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const uniforms = { uAge: { value: -1 }, uOrigin: { value: new THREE.Vector3() }, uPx: shared.uPx };
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms,
    vertexShader: /* glsl */ `
      attribute vec3 aVel;
      attribute float aSeed;
      uniform float uAge, uPx;
      uniform vec3 uOrigin;
      varying float vA;
      void main() {
        float t = uAge * (0.7 + aSeed * 0.6);
        vec3 p = uOrigin + aVel * t + vec3(0.0, -6.5, 0.0) * t * t;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vA = uAge < 0.0 ? 0.0 : smoothstep(0.85, 0.2, uAge);
        gl_PointSize = uPx * (0.018 + aSeed * 0.05) / max(0.5, -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float a = smoothstep(1.0, 0.45, length(gl_PointCoord - 0.5) * 2.0) * vA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(0.33, 0.012, 0.012, a);
      }`
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 5;
  return { points, uniforms };
}
