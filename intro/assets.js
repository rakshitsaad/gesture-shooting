// Loads every model, texture and sound the intro uses. Sources and licences
// are listed in ASSET_CREDITS.md.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODELS = [
  'zombie_b', 'zombie_c', 'rifle',
  'car_broken', 'car_sedan', 'car_pickup', 'car_police', 'car_suv',
  'street_light', 'barrier_large', 'sandbags', 'barrel', 'bricks'
];
const TEXTURES = ['road_damaged', 'concrete_wall_004', 'dirty_concrete', 'rusty_metal_02', 'burned_ground_01', 'concrete_debris'];
const SOUNDS = {
  radioStatic: 'radio_static.mp3', radioVoice: 'radio_voice.wav', gunshot: 'gunshot.mp3', impact: 'impact.mp3',
  scream: 'zombie_scream.mp3', growl: 'zombie_growl.mp3', crowd: 'zombie_crowd.mp3', fire: 'fire.mp3', footsteps: 'footsteps_run.mp3'
};

let cached = null;

// Stays loaded after the intro ends, so returning to the menu is quick.
// Sounds are decoded here too, on an offline context, which needs no click and
// means pressing ENTER starts the intro at once.
export function loadAssets(onProgress) {
  if (cached) { onProgress(1); return cached; }
  let done = 0;
  const total = MODELS.length + TEXTURES.length * 3 + Object.keys(SOUNDS).length;
  const step = (value) => { onProgress(++done / total); return value; };
  const gltf = new GLTFLoader();
  const tex = new THREE.TextureLoader();
  const loadTex = (url, srgb) => tex.loadAsync(url).then((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return step(t);
  });
  cached = (async () => {
    const assets = { models: {}, textures: {}, sounds: {} };
    const decoder = new OfflineAudioContext(2, 1, 44100);
    await Promise.all([
      ...MODELS.map(async (name) => { assets.models[name] = step(await gltf.loadAsync(`assets/models/${name}.glb`)); }),
      ...TEXTURES.map(async (name) => {
        const base = `assets/textures/${name}`;
        const [map, normalMap, roughnessMap] = await Promise.all([
          loadTex(`${base}_diff_1k.jpg`, true), loadTex(`${base}_nor_gl_1k.jpg`), loadTex(`${base}_rough_1k.jpg`)
        ]);
        assets.textures[name] = { map, normalMap, roughnessMap };
      }),
      ...Object.entries(SOUNDS).map(async ([name, file]) => {
        const res = await fetch(`assets/audio/${file}`);
        if (!res.ok) throw new Error(`${file}: ${res.status}`);
        assets.sounds[name] = step(await decoder.decodeAudioData(await res.arrayBuffer()));
      })
    ]);
    return assets;
  })();
  return cached;
}
