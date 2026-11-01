// Rigged zombies: the hero of the cinematic, the one that watches the menu's
// cursor, and a background horde walking in the distance.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const HEIGHT = 1.82;
const q = new THREE.Quaternion(), e = new THREE.Euler();

// Weathers a zombie's flat colours with dirt and blood patterns that stick to
// the body (they use the pose-free mesh position, not the world)
function rottenMaterial(src, grime, bodyScale) {
  const mat = new THREE.MeshStandardMaterial({
    map: src.map || null, color: src.color.clone().multiplyScalar(0.8), roughness: 0.78, metalness: 0.02
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uGrime = { value: grime };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBody;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvBody = position * ${bodyScale.toFixed(4)};`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBody;\nuniform sampler2D uGrime;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 gp = vec2(vBody.x + vBody.z * 0.6, vBody.y);
        float dirt = texture2D(uGrime, gp * 0.9).g;
        float wounds = texture2D(uGrime, gp * 0.37 + 0.31).r;
        float g = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
        diffuseColor.rgb = mix(vec3(g), diffuseColor.rgb, 0.68) * mix(0.6, 1.05, smoothstep(0.02, 0.42, dirt));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.008, 0.006), smoothstep(0.2, 0.34, wounds) * 0.88);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.58, smoothstep(0.2, 0.34, texture2D(uGrime, vec2(vBody.x + vBody.z * 0.6, vBody.y) * 0.37 + 0.31).r));');
  };
  mat.customProgramCacheKey = () => `rot${bodyScale.toFixed(4)}`;
  return mat;
}

function findClip(clips, name) {
  const re = new RegExp(`(^|\\|)${name}$`, 'i');
  return clips.find((c) => re.test(c.name));
}

export class ZombieRig {
  constructor(gltf, grime, opts = {}) {
    this.root = new THREE.Group();
    const inner = cloneSkinned(gltf.scene);
    inner.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(inner);
    const height = Math.max(1e-3, bb.max.y - bb.min.y);
    const s = (opts.height || HEIGHT) / height;
    inner.scale.multiplyScalar(s);
    inner.position.y -= bb.min.y * s;
    this.root.add(inner);
    this.materials = [];
    const cache = new Map();
    inner.traverse((o) => {
      if (!o.isMesh) return;
      let mat = cache.get(o.material);
      if (!mat) {
        mat = rottenMaterial(o.material, grime, 1.0 / Math.max(1e-3, Math.abs(height)) * 1.8);
        cache.set(o.material, mat);
        this.materials.push(mat);
      }
      o.material = mat;
      o.castShadow = true;
      o.frustumCulled = false;
    });
    inner.traverse((o) => {
      if (!this.head && o.isBone && /head/i.test(o.name) && !/end|top/i.test(o.name)) this.head = o;
    });

    this.mixer = new THREE.AnimationMixer(inner);
    this.actions = {};
    const names = { idle: ['Idle', 'ZombieIdle'], walk: ['Walk'], run: ['Run', 'Walk2'], scream: ['Scream', 'Idle_Attack'], attack: ['Run_Attack', 'Attack', 'Idle_Attack'], punch: ['Punch', 'Idle_Attack', 'Attack'], hit: ['HitReact', 'Hit_reaction'], death: ['Death', 'Die'] };
    for (const [key, tries] of Object.entries(names)) {
      for (const name of tries) {
        const clip = findClip(gltf.animations, name);
        if (!clip) continue;
        const action = this.mixer.clipAction(clip);
        action.play();
        action.setEffectiveWeight(0);
        this.actions[key] = action;
        break;
      }
    }
    // Fallbacks for models missing a clip
    const a = this.actions;
    a.run = a.run || a.walk;
    a.attack = a.attack || a.punch;
    a.punch = a.punch || a.attack;
    this.look = { yaw: 0, pitch: 0 };
    this.shownLook = { yaw: 0, pitch: 0 };
  }

  // Sets the whole pose directly from a time and weight per clip. The
  // cinematic drives this from its timeline, so it can be scrubbed.
  pose(entries) {
    for (const action of Object.values(this.actions)) action.setEffectiveWeight(0);
    for (const [key, weight, time] of entries) {
      const action = this.actions[key];
      if (!action || weight <= 0) continue;
      action.paused = true;
      action.setEffectiveWeight(weight);
      action.time = time % action.getClip().duration;
    }
    this.mixer.update(0);
  }

  // Plain playback for menu and background zombies
  loop(key, timeScale = 1, offset = 0) {
    for (const action of Object.values(this.actions)) action.setEffectiveWeight(0);
    const action = this.actions[key];
    if (!action) return;
    action.paused = false;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(timeScale);
    action.time = offset * action.getClip().duration;
  }

  // Turns the head on top of the animation, eased, and limited so it stays
  // within what a neck can do
  applyLook(dt = 0.016, rate = 7) {
    if (!this.head) return;
    const k = 1 - Math.exp(-rate * dt);
    this.shownLook.yaw += (this.look.yaw - this.shownLook.yaw) * k;
    this.shownLook.pitch += (this.look.pitch - this.shownLook.pitch) * k;
    e.set(this.shownLook.pitch, this.shownLook.yaw, 0, 'YXZ');
    this.head.quaternion.multiply(q.setFromEuler(e));
  }

  dispose() {
    this.mixer.stopAllAction();
    this.materials.forEach((m) => m.dispose());
  }
}

// Background horde: walks up the street out of the fog and loops
export class Horde {
  constructor(scene, assets, grime, count) {
    const sources = [assets.models.zombie_c, assets.models.zombie_c, assets.models.zombie_c, assets.models.zombie_b];
    this.members = [];
    for (let i = 0; i < 12; i++) {
      const rig = new ZombieRig(sources[i % sources.length], grime, { height: 1.72 + Math.random() * 0.2 });
      rig.loop('walk', 0.75 + Math.random() * 0.35, Math.random());
      const member = { rig, x: (Math.random() - 0.5) * 11, z: -40 + Math.random() * 62, speed: 0.55 + Math.random() * 0.5, phase: Math.random() * 6, clock: Math.random() * 0.1 };
      rig.root.position.set(member.x, 0, member.z);
      scene.add(rig.root);
      this.members.push(member);
    }
    this.setCount(count);
  }

  setCount(count) {
    this.members.forEach((m, i) => { m.rig.root.visible = i < count; });
  }

  update(dt, cameraZ) {
    for (const m of this.members) {
      if (!m.rig.root.visible) continue;
      m.z += m.speed * dt;
      // Always stays well ahead of the camera, out in the fog
      if (m.z > cameraZ - 15 || m.z > 24) m.z = -44 + Math.random() * 12;
      m.rig.root.position.set(m.x + Math.sin(m.z * 0.3 + m.phase) * 0.8, 0, m.z);
      m.rig.root.rotation.y = Math.cos(m.z * 0.3 + m.phase) * 0.18;
      // Animate at about 20 Hz: at this distance nobody can tell, and it
      // saves most of the skinning work
      m.clock += dt;
      if (m.clock >= 0.05) {
        m.rig.mixer.update(m.clock);
        m.clock = 0;
      }
    }
  }

  dispose() {
    this.members.forEach((m) => m.rig.dispose());
  }
}
