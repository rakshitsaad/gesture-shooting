// DEAD FRONT intro and main menu. Sits on top of the existing game: it owns the
// screen until START GAME, then hands over to the game's own startGame() and
// shuts its 3D scene down. The game's camera and hand tracker are reused, never
// duplicated. See window.DeadFrontGame at the bottom of the game's script.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { loadAssets } from './assets.js';
import { buildEnvironment } from './environment.js';
import { Horde, ZombieRig } from './zombies.js';
import { IntroAudio } from './audio.js';
import { createUI, drawTitle, drawTitleCopy } from './ui.js';
import { buildCinematic, INTRO_LENGTH, MENU_POSE, SHOT_TIME } from './cinematic.js';

const gsap = window.gsap;
const game = window.DeadFrontGame;
const root = document.getElementById('deadFrontRoot');

const PROFILES = {
  low: { name: 'low', pixelRatio: 0.75, post: false, msaa: 0, shadows: 0, particles: 0.38, horde: 3, fireLights: 2 },
  medium: { name: 'medium', pixelRatio: 1, post: true, msaa: 0, shadows: 1, particles: 0.7, horde: 7, fireLights: 3 },
  high: { name: 'high', pixelRatio: 1.5, post: true, msaa: 4, shadows: 2, particles: 1, horde: 12, fireLights: 4 }
};
const STEP_DOWN = { high: 'medium', medium: 'low' };

const settings = { master: 1, music: 0.7, sfx: 1, quality: 'auto', camera: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem('deadfront_settings') || '{}')); } catch (e) { /* storage unavailable */ }
const saveSettings = () => { try { localStorage.setItem('deadfront_settings', JSON.stringify(settings)); } catch (e) { /* storage unavailable */ } };
game.audio.setVolumes(settings.master, settings.music, settings.sfx);

let session = null;
const titleSource = document.createElement('canvas');

function glInfo(renderer) {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
}

function startingProfile(renderer) {
  if (settings.quality !== 'auto') return PROFILES[settings.quality];
  const gpu = glInfo(renderer);
  if (/swiftshader|llvmpipe|software/i.test(gpu)) return PROFILES.low;
  if (/intel|uhd|iris|vega \d|radeon graphics/i.test(gpu)) return PROFILES.medium;
  return PROFILES.high;
}

const GRADE = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uChroma: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uChroma;
    varying vec2 vUv;
    float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 7.0) * 43758.5453); }
    void main() {
      vec2 d = (vUv - 0.5) * (0.0016 + uChroma);
      vec3 c = vec3(texture2D(tDiffuse, vUv + d).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d).b);
      // Crushed, slightly teal shadows against warm highlights
      float l = dot(c, vec3(0.3, 0.59, 0.11));
      c = mix(c * vec3(0.9, 0.98, 1.04), c * vec3(1.07, 0.98, 0.9), smoothstep(0.1, 0.6, l));
      c = mix(vec3(l), c, 1.08);
      c = pow(max(c, 0.0), vec3(1.07));
      c += (h(vUv) - 0.5) * 0.028;
      gl_FragColor = vec4(c, 1.0);
    }`
};

// The rifle and the arms holding it, carried by the camera
function buildWeapon(camera, assets, grime) {
  const pose = { up: 0, kick: 0, flash: 0 };
  const group = new THREE.Group();
  camera.add(group);
  const inner = cloneSkinned(assets.models.rifle.scene);
  inner.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(inner);
  const size = bb.getSize(new THREE.Vector3()), mid = bb.getCenter(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  const pivot = new THREE.Group();
  inner.position.sub(mid);
  pivot.add(inner);
  pivot.scale.setScalar(0.92 / longest);
  // Whichever axis the model's barrel lies on, turn it to point down the view
  if (longest === size.x) pivot.rotation.y = Math.PI / 2;
  else if (longest === size.y) pivot.rotation.x = Math.PI / 2;
  const materials = [];
  inner.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.material;
    const mat = new THREE.MeshStandardMaterial({ color: src.color.clone().multiplyScalar(0.72), roughness: 0.48, metalness: 0.7 });
    materials.push(mat);
    o.material = mat;
    o.frustumCulled = false;
  });
  group.add(pivot);

  // Sleeves and gloves: simple forms, mostly out of frame and in shadow
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x16170f, roughness: 0.95 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x0f0f0e, roughness: 0.72 });
  materials.push(sleeve, glove);
  const up = new THREE.Vector3(0, 1, 0);
  const limb = (mat, r, a, b) => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), along = to.clone().sub(from);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, along.length(), 6, 12), mat);
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(up, along.normalize());
    m.frustumCulled = false;
    group.add(m);
    return m;
  };
  // Right hand on the grip, left hand under the handguard; elbows out of frame
  limb(glove, 0.034, [0.012, -0.06, 0.05], [0.012, -0.05, 0.12]);
  limb(sleeve, 0.047, [0.02, -0.09, 0.13], [0.2, -0.42, 0.48]);
  limb(glove, 0.03, [-0.032, 0.012, -0.25], [0.032, 0.012, -0.25]);
  limb(sleeve, 0.034, [-0.035, -0.02, -0.22], [-0.34, -0.46, 0.3]);

  // Muzzle flash and the light it throws
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 60);
  grad.addColorStop(0, 'rgba(255,255,235,1)');
  grad.addColorStop(0.3, 'rgba(255,190,90,0.85)');
  grad.addColorStop(1, 'rgba(255,90,10,0)');
  g.fillStyle = grad;
  g.translate(64, 64);
  for (let i = 0; i < 6; i++) {
    g.rotate(Math.PI / 3);
    g.beginPath();
    g.moveTo(-13, 0);
    g.lineTo(0, -62);
    g.lineTo(13, 0);
    g.fill();
  }
  g.beginPath();
  g.arc(0, 0, 28, 0, 6.3);
  g.fill();
  const flashTex = new THREE.CanvasTexture(c);
  const flashMat = new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true, opacity: 0 });
  const flash = new THREE.Sprite(flashMat);
  flash.position.set(0, 0.012, -0.57);
  flash.scale.setScalar(0.6);
  group.add(flash);
  const light = new THREE.PointLight(0xffc27a, 0, 14, 1.6);
  light.position.set(0.1, 0.02, -0.75);
  group.add(light);

  const REST = new THREE.Vector3(0.155, -0.19, -0.42);
  const update = (t) => {
    // Parked far out of view rather than hidden: hiding it would remove a light
    // and showing it again would recompile every shader, freezing the shot
    if (pose.up <= 0.001) { group.position.y = -50; light.intensity = 0; return; }
    const sway = Math.sin(t * 1.4) * 0.002;
    group.position.set(REST.x + sway + (1 - pose.up) * 0.1, REST.y - (1 - pose.up) * 0.55 + pose.kick * 0.014, REST.z + pose.kick * 0.085);
    group.rotation.set((1 - pose.up) * -0.75 + pose.kick * 0.13, (1 - pose.up) * 0.25 + 0.05, (1 - pose.up) * -0.3);
    flashMat.opacity = pose.flash;
    flash.material.rotation = t * 37;
    flash.scale.setScalar(0.42 + pose.flash * 0.34);
    light.intensity = pose.flash * 14;
  };
  const dispose = () => {
    materials.forEach((m) => m.dispose());
    flashMat.dispose();
    flashTex.dispose();
  };
  return { pose, update, dispose };
}

async function run({ skipCinematic = false } = {}) {
  window.deadFrontIntroActive = true;
  root.classList.remove('df-hidden');
  root.style.background = '';
  document.getElementById('startModal').classList.add('hidden');

  const on = {
    setting: changeSetting,
    start: () => session && session.start(),
    skip: () => session && session.skip(),
    enter: () => session && session.enter(),
    replay: () => session && session.replay(),
    refreshCamera: () => session && session.refreshCamera(),
    testCamera: () => session && session.testCamera()
  };
  const ui = createUI(root, game, settings, on);
  const r = ui.refs;
  gsap.set(r.titleArt, { transformOrigin: '50% 50%' });

  await document.fonts.load('356px Anton').catch(() => {});
  await document.fonts.load('20px "Bebas Neue"').catch(() => {});
  if (!titleSource.width || titleSource.width === 300) drawTitle(titleSource);
  for (const c of [r.titleArt, r.menuTitle, r.gateTitle]) drawTitleCopy(c, titleSource);

  // WebGL. If there is none, the menu still works over a painted backdrop.
  let renderer = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.className = 'df-gl';
    root.prepend(canvas);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    if (!renderer.getContext()) throw new Error('no context');
  } catch (err) {
    console.warn('WebGL unavailable: showing the menu without the 3D scene', err);
    root.querySelectorAll('canvas.df-gl').forEach((c) => c.remove());
    renderer = null;
  }
  if (new URLSearchParams(location.search).has('nowebgl') && renderer) {
    renderer.dispose();
    root.querySelectorAll('canvas.df-gl').forEach((c) => c.remove());
    renderer = null;
  }

  const assets = await loadAssets((p) => { r.barFill.style.width = `${Math.round(p * 100)}%`; }).catch((err) => {
    console.error('DEAD FRONT assets failed to load', err);
    return null;
  });

  session = (renderer && assets) ? buildSession(renderer, assets, ui) : plainSession(ui, assets);
  r.bar.style.display = 'none';
  if (skipCinematic) {
    r.gate.style.display = 'none';
    session.enterMenuDirect();
  } else {
    r.gateNote.textContent = 'SOUND ON. HANDS UP.';
    r.enter.style.display = 'block';
    r.enter.focus({ preventScroll: true });
  }
}

function changeSetting(key, value) {
  settings[key] = value;
  saveSettings();
  if (key === 'master' || key === 'music' || key === 'sfx') game.audio.setVolumes(settings.master, settings.music, settings.sfx);
  if (session) session.onSetting(key, value);
}

// No WebGL (or missing files): same menu, same buttons, no cinematic
function plainSession(ui, assets) {
  const r = ui.refs;
  root.classList.add('df-nogl');
  r.fade.style.display = 'none';
  const showMenu = () => {
    gsap.set(r.menu, { autoAlpha: 1 });
    r.gate.style.display = 'none';
    r.mute.style.display = 'flex';
    ui.setStatus(settings.camera ? 'CAMERA ASKED FOR AT START' : 'MOUSE CONTROLS', false);
    r.btnStart.focus({ preventScroll: true });
  };
  return {
    enter() { game.audio.init(); showMenu(); },
    enterMenuDirect: showMenu,
    skip() {},
    replay() {},
    onSetting() {},
    refreshCamera() { ui.syncCameraPicker(); },
    testCamera() { game.initCamera().then(() => ui.syncCameraPicker()); },
    start() {
      if (game.fullscreenStart.checked && !document.fullscreenElement) game.toggleFullscreen();
      window.deadFrontIntroActive = false;
      ui.dispose();
      root.classList.add('df-hidden');
      root.classList.remove('df-nogl');
      game.startGame(settings.camera);
    }
  };
}

function buildSession(renderer, assets, ui) {
  const r = ui.refs;
  let profile = startingProfile(renderer);
  let alive = true;
  let mode = 'gate';   // gate, cinematic, menu, leaving

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(Math.min(profile.pixelRatio, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.05, 700);
  scene.add(camera);
  const env = buildEnvironment(scene, renderer, assets, profile);

  // Hero for the cinematic; a second zombie watches the cursor on the menu
  const grime = env.grime;
  const hero = new ZombieRig(assets.models.zombie_c, grime);
  scene.add(hero.root);
  const watcher = new ZombieRig(assets.models.zombie_c, grime, { height: 1.86 });
  watcher.root.position.set(-1.9, 0, 36.2);
  watcher.root.rotation.y = 0.12;
  watcher.loop('idle', 0.9);
  watcher.root.visible = false;
  scene.add(watcher.root);
  const horde = new Horde(scene, assets, grime, profile.horde);
  const weapon = buildWeapon(camera, assets, grime);
  // Soft moonlight on the zombie's front, so it isn't only a silhouette up close
  const fill = new THREE.PointLight(0x9aa6c8, 0, 8, 1.5);
  scene.add(fill);

  const audio = new IntroAudio(game.audio, assets.sounds);
  const rig = {};
  const { tl, apply } = buildCinematic({ rig, hero, weapon, env, ui, audio });
  apply(0);

  // Post
  let composer = null, grade = null;
  const buildComposer = () => {
    if (composer) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); composer = null; }
    if (!profile.post) return;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: profile.msaa });
    composer = new EffectComposer(renderer, target);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(window.innerWidth, window.innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.2, 0.5, 1.0));
    composer.addPass(new OutputPass());
    grade = new ShaderPass(GRADE);
    composer.addPass(grade);
  };
  buildComposer();

  let resScale = 1;
  const applyResolution = () => {
    renderer.setPixelRatio(Math.min(profile.pixelRatio, window.devicePixelRatio || 1) * resScale);
    buildComposer();
    onResize();
  };
  const setProfile = (next) => {
    profile = next;
    resScale = 1;
    renderer.setPixelRatio(Math.min(profile.pixelRatio, window.devicePixelRatio || 1));
    env.applyProfile(profile);
    horde.setCount(profile.horde);
    buildComposer();
    onResize();
  };

  const onResize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
    env.shared.uPx.value = renderer.domElement.height / 2;
  };
  window.addEventListener('resize', onResize);

  // Pointer and hand steer the camera a little, and the watcher's head
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const onPointer = (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer);

  const refreshStatus = () => {
    if (game.isCameraActive()) ui.setStatus('HAND TRACKING ACTIVE', true);
    else if (!settings.camera) ui.setStatus('CAMERA OFF · MOUSE CONTROLS', false);
    else if (camStarting) ui.setStatus('STARTING CAMERA', false);
    else if (camDenied) ui.setStatus('CAMERA BLOCKED · MOUSE CONTROLS', false);
    else ui.setStatus('MOUSE ACTIVE · CAMERA ASKED FOR AT START', false);
  };
  let camStarting = false, camDenied = false;
  const startCamera = async () => {
    if (game.isCameraActive() || camStarting) return;
    camStarting = true;
    refreshStatus();
    await game.initCamera();
    camStarting = false;
    camDenied = !game.isCameraActive();
    refreshStatus();
    ui.syncCameraPicker();
  };
  // Only switches the camera on here if the browser already has permission,
  // so the menu never causes a surprise prompt
  const cameraIfAllowed = async () => {
    if (!settings.camera || !navigator.permissions) return refreshStatus();
    try {
      const state = await navigator.permissions.query({ name: 'camera' });
      if (state.state === 'granted') startCamera();
      if (state.state === 'denied') camDenied = true;
    } catch (err) { /* this browser can't report camera permission */ }
    refreshStatus();
  };

  // Builds every shader now, behind the loading screen, not during the cinematic
  watcher.root.visible = true;
  weapon.update(0);
  env.update(0, 0, camera);
  if (composer) composer.render(); else renderer.render(scene, camera);
  watcher.root.visible = false;

  // Render loop
  let last = performance.now(), clock = 0, sampleFrames = 0, sampleTime = 0, slowSamples = 0, raf = 0;
  const shakeV = new THREE.Vector3();
  const frame = (now) => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    clock += dt;
    if (mode === 'cinematic') {
      const time = tl.time();
      apply(time);
      fill.position.set(0.5, 2.3, hero.root.position.z + 1.6);
      fill.intensity = 3 * THREE.MathUtils.smoothstep(time, 6.8, 7.8);
      if (tl.time() < 2.1) ui.drawWave(audio.analyser, clock);
      if (tl.time() >= INTRO_LENGTH) enterMenu();
    }
    if (mode === 'menu' || mode === 'leaving') {
      fill.position.set(-0.6, 2.3, 39.5);
      fill.intensity = 3.5;
      watcher.mixer.update(dt);
      const hand = settings.camera ? game.handAim() : null;
      const aimX = hand ? hand.x * 2 - 1 : pointer.x, aimY = hand ? hand.y * 2 - 1 : pointer.y;
      const k = 1 - Math.exp(-4 * dt);
      pointer.sx += (aimX - pointer.sx) * k;
      pointer.sy += (aimY - pointer.sy) * k;
      // The cursor is seen from the watcher: its head follows, within limits
      watcher.look.yaw = THREE.MathUtils.clamp(pointer.sx + 0.28, -0.85, 0.85);
      watcher.look.pitch = THREE.MathUtils.clamp(pointer.sy * 0.4 - 0.04, -0.3, 0.35);
      watcher.applyLook(dt, 6);
    }
    horde.update(dt, camera.position.z);

    // Camera, with parallax on the menu and noise-driven shake
    const px = mode === 'menu' ? pointer.sx : 0, py = mode === 'menu' ? pointer.sy : 0;
    const s = rig.shake * 0.085;
    shakeV.set(Math.sin(clock * 67) * s + Math.sin(clock * 113) * s * 0.5, Math.sin(clock * 83 + 1) * s, 0);
    camera.position.set(rig.x + px * 0.42 + shakeV.x, rig.y - py * 0.17 + shakeV.y, rig.z);
    camera.lookAt(rig.tx + px * 0.5, rig.ty - py * 0.25, rig.tz);
    camera.rotateZ(rig.roll + shakeV.x * 0.4);
    if (Math.abs(camera.fov - rig.fov) > 1e-3) {
      camera.fov = rig.fov;
      camera.updateProjectionMatrix();
    }
    weapon.update(clock);
    env.update(clock, dt, camera);

    if (composer) {
      grade.uniforms.uTime.value = clock % 10;
      grade.uniforms.uChroma.value = rig.shake * 0.006;
      composer.render();
    } else {
      renderer.render(scene, camera);
    }

    // Auto quality steps down if the frame rate stays low
    sampleFrames++;
    sampleTime += dt;
    if (sampleTime >= 1.5) {
      const fps = sampleFrames / sampleTime;
      session.fps = fps;
      slowSamples = fps < 50 && mode !== 'gate' ? slowSamples + 1 : 0;
      sampleFrames = 0;
      sampleTime = 0;
      // Lowers the resolution a little first, then the whole profile
      if (slowSamples >= 2 && settings.quality === 'auto') {
        slowSamples = 0;
        if (resScale === 1) {
          resScale = 0.8;
          applyResolution();
        } else if (STEP_DOWN[profile.name]) {
          setProfile(PROFILES[STEP_DOWN[profile.name]]);
        }
      }
    }
  };
  raf = requestAnimationFrame(frame);

  const showSkipAndMute = () => {
    r.skip.style.display = 'block';
    r.mute.style.display = 'flex';
    gsap.to(r.skip, { opacity: 1, duration: 0.3, delay: 0.5 });
  };

  const placeMenuCamera = () => {
    Object.assign(rig, MENU_POSE, { shake: 0 });
    hero.root.visible = false;
    watcher.root.visible = true;
    weapon.pose.up = 0;
    env.blood.uniforms.uAge.value = -1;
    gsap.set(r.broadcast, { opacity: 0 });
    gsap.set(r.cross, { opacity: 0 });
    gsap.set(r.flash, { opacity: 0 });
    gsap.set(r.title, { opacity: 0 });
    gsap.set(r.menu, { autoAlpha: 1 });
  };

  // Crossfade through black from wherever the intro is
  const enterMenu = () => {
    if (mode !== 'cinematic') return;
    mode = 'menu';
    tl.pause();
    r.skip.style.display = 'none';
    audio.menuAmbience();
    gsap.to([r.title, r.broadcast], { opacity: 0, duration: 0.4 });
    gsap.to(r.fade, {
      opacity: 1, duration: 0.45, ease: 'power1.in',
      onComplete() {
        placeMenuCamera();
        gsap.to(r.fade, { opacity: 0, duration: 0.8, ease: 'power1.out' });
        r.btnStart.focus({ preventScroll: true });
        cameraIfAllowed();
      }
    });
  };

  const self = {
    fps: 0,
    enter() {
      if (mode !== 'gate') return;
      if (game.fullscreenStart.checked && !document.fullscreenElement) game.toggleFullscreen();
      audio.unlock();
      ui.syncMute();
      gsap.to(r.gate, { opacity: 0, duration: 0.3, onComplete: () => { r.gate.style.display = 'none'; } });
      mode = 'cinematic';
      showSkipAndMute();
      tl.play(0);
    },
    enterMenuDirect() {
      audio.unlock();
      mode = 'menu';
      tl.pause();
      r.mute.style.display = 'flex';
      placeMenuCamera();
      audio.menuAmbience();
      gsap.fromTo(r.fade, { opacity: 1 }, { opacity: 0, duration: 0.9 });
      r.btnStart.focus({ preventScroll: true });
      cameraIfAllowed();
    },
    skip() {
      if (mode !== 'cinematic') return;
      audio.stopOneShots();
      enterMenu();
    },
    replay() {
      if (mode !== 'menu') return;
      audio.stopAll(0.25);
      gsap.killTweensOf(r.fade);
      gsap.set(r.menu, { autoAlpha: 0 });
      hero.root.visible = true;
      watcher.root.visible = false;
      mode = 'cinematic';
      showSkipAndMute();
      gsap.set(r.skip, { opacity: 1 });
      tl.play(0);
    },
    refreshCamera() { ui.syncCameraPicker(); refreshStatus(); },
    testCamera() {
      if (!settings.camera) changeSetting('camera', true);
      return startCamera();
    },
    onSetting(key, value) {
      if (key === 'quality') {
        setProfile(value === 'auto' ? startingProfile(renderer) : PROFILES[value]);
        slowSamples = 0;
      }
      if (key === 'camera') {
        if (!value && game.isCameraActive()) game.stopCamera();
        if (value) cameraIfAllowed();
        camDenied = false;
        refreshStatus();
        ui.syncCameraPicker();
      }
    },
    // START GAME: menu fades, camera drops down the street to the barricade's
    // eye-line, black, then the existing game takes over.
    start() {
      if (mode !== 'menu') return;
      mode = 'leaving';
      if (game.fullscreenStart.checked && !document.fullscreenElement) game.toggleFullscreen();
      ui.closePanel();
      gsap.to(r.menu, { autoAlpha: 0, duration: 0.35 });
      r.mute.style.display = 'none';
      audio.stopAll(1.1);
      audio.play('growl', { gain: 0.5, rate: 0.8, wet: true });
      const tlOut = gsap.timeline({
        onComplete: () => {
          // Hand over behind the black, then let it clear to the game
          const useCamera = settings.camera;
          if (!useCamera && game.isCameraActive()) game.stopCamera();
          window.deadFrontIntroActive = false;
          game.startGame(useCamera);
          shutdown();
          root.style.background = 'transparent';
          root.querySelector('.df-vignette').style.display = 'none';
          gsap.to(r.fade, {
            opacity: 0, duration: 0.7, ease: 'power1.out',
            onComplete() { root.classList.add('df-hidden'); root.innerHTML = ''; session = null; }
          });
        }
      });
      tlOut.to(rig, { x: 0, y: 1.2, z: 24, tx: 0, ty: 1.6, tz: 0, fov: 62, duration: 1.45, ease: 'power2.in' }, 0);
      tlOut.to(r.fade, { opacity: 1, duration: 0.55, ease: 'power1.in' }, 0.95);
    },
    profile: () => `${profile.name}@${resScale}`,
    debug: { rig, tl, hero, watcher, weapon, apply, camera, scene, renderer, setProfile, SHOT_TIME, glInfo: () => glInfo(renderer) }
  };

  // Frees the GPU and stops all per-frame work; the game now has the machine
  function shutdown() {
    alive = false;
    cancelAnimationFrame(raf);
    tl.kill();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onPointer);
    ui.dispose();
    env.dispose();
    hero.dispose();
    watcher.dispose();
    horde.dispose();
    weapon.dispose();
    if (composer) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); }
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }
  return self;
}

// Main Menu button on the game over screen
document.getElementById('btnMainMenu').addEventListener('click', () => {
  game.leaveGame();
  run({ skipCinematic: true });
});

window.deadFrontIntro = { get session() { return session; } };
// If the intro itself breaks, the game's plain start screen is still there
run().catch((err) => {
  console.error('DEAD FRONT intro failed', err);
  window.deadFrontIntroFailed();
});
