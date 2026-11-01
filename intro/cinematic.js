// The 12-second opening. The camera and overlays are a GSAP timeline; the hero
// zombie is posed directly from the timeline's clock, so every frame can be
// reached by seeking and nothing drifts if the machine hitches.
import * as THREE from 'three';

const gsap = window.gsap;

// Hero zombie's position along the street against time
const Z_KEYS = [[0, 27], [6.15, 27], [6.55, 27.7], [7.45, 34.8], [7.95, 40.4], [9.0, 40.85], [9.25, 40.45], [10.2, 40.05], [20, 40.05]];
const X_KEYS = [[0, -0.5], [6.6, -0.5], [7.95, 0.05], [20, 0.05]];

function keyed(keys, t) {
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
      return v0 + (v1 - v0) * ((t - t0) / (t1 - t0));
    }
  }
  return keys[keys.length - 1][1];
}
const ramp = (t, a, b) => THREE.MathUtils.smoothstep(t, a, b);

export const SHOT_TIME = 9.0;
export const MENU_POSE = { x: 0.9, y: 1.62, z: 41.5, tx: -0.3, ty: 2.3, tz: 18, fov: 50, roll: 0 };
export const INTRO_LENGTH = 12.3;

export function buildCinematic({ rig, hero, weapon, env, ui, audio }) {
  const r = ui.refs;
  const tl = gsap.timeline({ paused: true });

  // Camera: creep down the street, hold for the encounter, then crane back
  Object.assign(rig, { x: -0.7, y: 1.3, z: 68, tx: 0.7, ty: 2.4, tz: 30, fov: 52, roll: 0.012, shake: 0 });
  tl.to(rig, { x: 0.65, y: 1.5, z: 43, tx: -0.3, ty: 2.2, tz: 22, roll: -0.01, duration: 5, ease: 'sine.inOut' }, 0);
  tl.to(rig, { x: 0, y: 1.55, z: 42, tx: -0.2, ty: 1.55, tz: 27, fov: 40, roll: 0, duration: 2, ease: 'sine.inOut' }, 5);
  // Backs away as it closes in
  tl.to(rig, { z: 42.75, y: 1.5, tx: 0, ty: 1.44, tz: 40.4, fov: 48, duration: 0.55, ease: 'power2.in' }, 7.45);
  tl.to(rig, { ty: 1.3, duration: 0.8, ease: 'sine.inOut' }, 9.1);
  tl.to(rig, { x: 0.35, y: 9.5, z: 66, tx: 0, ty: 8.6, tz: 0, fov: 56, roll: 0.008, duration: 2.1, ease: 'power2.inOut' }, 10);

  // Shake: on the lunge, then the shot
  tl.fromTo(rig, { shake: 0 }, { shake: 1, duration: 0.14, ease: 'power2.out', immediateRender: false }, 7.72);
  tl.to(rig, { shake: 0.1, duration: 0.8, ease: 'power2.out' }, 7.86);
  tl.to(rig, { shake: 0.95, duration: 0.04, ease: 'none' }, SHOT_TIME);
  tl.to(rig, { shake: 0, duration: 0.8, ease: 'power3.out' }, SHOT_TIME + 0.05);

  // Scene 1: broadcast over black, the city fading up behind it
  tl.set(r.fade, { opacity: 1 }, 0);
  tl.fromTo(r.broadcast, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'steps(4)' }, 0.05);
  tl.to(r.broadcast, { opacity: 0, duration: 0.42, ease: 'power1.in' }, 1.72);
  tl.to(r.fade, { opacity: 0, duration: 0.65, ease: 'power1.inOut' }, 1.75);

  // Scene 4: weapon, crosshair, shot
  tl.fromTo(weapon.pose, { up: 0 }, { up: 1, duration: 0.46, ease: 'power3.out', immediateRender: false }, 8.05);
  tl.to(r.cross, { opacity: 1, duration: 0.14 }, 8.42);
  tl.to(weapon.pose, { up: 0, duration: 0.55, ease: 'power2.in' }, 9.95);
  tl.to(r.cross, { opacity: 0, duration: 0.2 }, 9.8);
  tl.fromTo(weapon.pose, { kick: 0 }, { kick: 1, duration: 0.05, ease: 'power4.out', immediateRender: false }, SHOT_TIME);
  tl.to(weapon.pose, { kick: 0, duration: 0.5, ease: 'power2.out' }, SHOT_TIME + 0.05);
  tl.fromTo(weapon.pose, { flash: 0 }, { flash: 1, duration: 0.012, ease: 'none', immediateRender: false }, SHOT_TIME);
  tl.to(weapon.pose, { flash: 0, duration: 0.1, ease: 'power2.out' }, SHOT_TIME + 0.02);
  tl.fromTo(r.flash, { opacity: 0 }, { opacity: 0.42, duration: 0.03, immediateRender: false }, SHOT_TIME);
  tl.to(r.flash, { opacity: 0, duration: 0.3, ease: 'power2.out' }, SHOT_TIME + 0.03);

  // Scene 5: darker wide shot, heavy title
  tl.to(r.fade, { opacity: 0.3, duration: 1.1, ease: 'power1.inOut' }, 10);
  tl.fromTo(r.title, { opacity: 0 }, { opacity: 1, duration: 0.09, immediateRender: false }, 10.85);
  tl.fromTo(r.titleArt, { scale: 1.62, filter: 'brightness(2.6) blur(3px)' }, { scale: 1, filter: 'brightness(1) blur(0px)', duration: 0.32, ease: 'power4.in', immediateRender: false }, 10.85);
  tl.fromTo(r.titleArt, { x: 0, y: 0 }, { keyframes: [{ x: -9, y: 5, duration: 0.03 }, { x: 7, y: -4, duration: 0.03 }, { x: -4, y: 2, duration: 0.04 }, { x: 0, y: 0, duration: 0.07 }], immediateRender: false }, 11.17);
  tl.fromTo(r.tagline, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', immediateRender: false }, 11.3);
  // Stop here; main.js crossfades to the menu
  tl.to({}, { duration: 0 }, INTRO_LENGTH);

  // Sound, on the Phase 12 timeline
  const at = (time, fn) => tl.call(fn, null, time);
  at(0, () => { audio.radioCall(); audio.drone(0.18); });
  at(2, () => { audio.wind(0.2); audio.loop('fire', 'fire', { gain: 0.42, fadeIn: 1.5 }); });
  at(4, () => { audio.loop('crowd', 'crowd', { gain: 0.2, fadeIn: 1.2, lowpass: 900 }); audio.play('growl', { gain: 0.32, rate: 0.75, lowpass: 900, pan: -0.5, wet: true }); });
  at(5.75, () => audio.play('growl', { gain: 0.95, rate: 0.85, wet: true }));
  at(6, () => audio.footsteps());
  at(7, () => audio.play('scream', { gain: 0.62, rate: 1, wet: true }));
  // The shot cuts the scream dead, so it lands as the loudest thing in the intro
  at(SHOT_TIME, () => {
    audio.stopOneShots(0.04);
    audio.play('gunshot', { gain: 2.4, wet: true, duration: 2.6, fadeOut: 0.5 });
  });
  at(SHOT_TIME + 0.08, () => audio.play('growl', { gain: 0.5, rate: 1.3, offset: 0.2, duration: 0.7, fadeOut: 0.2 }));
  at(10, () => audio.play('impact', { gain: 1.7, wet: true }));
  at(10.98, () => audio.play('impact', { gain: 1.2, rate: 1.5, highpass: 240, duration: 2.6, fadeOut: 0.6 }));

  // Hero pose from the clock
  const bloodFrom = new THREE.Vector3();
  const apply = (t) => {
    const z = keyed(Z_KEYS, t);
    hero.root.position.set(keyed(X_KEYS, t), 0, z);
    // Turned away at first: the head comes round, then the body follows it
    hero.root.rotation.y = THREE.MathUtils.lerp(-1.05, 0, ramp(t, 5.6, 6.2));
    const headTurn = ramp(t, 4.95, 5.45) * (1 - ramp(t, 5.6, 6.2));
    hero.look.yaw = hero.shownLook.yaw = headTurn * 0.95;
    hero.look.pitch = hero.shownLook.pitch = 0;

    const toGrowl = ramp(t, 5.45, 5.7), toWalk = ramp(t, 6.15, 6.4), toRun = ramp(t, 6.55, 6.75), toLunge = ramp(t, 7.4, 7.55), toHit = ramp(t, SHOT_TIME, SHOT_TIME + 0.05), toDeath = ramp(t, SHOT_TIME + 0.12, SHOT_TIME + 0.42);
    const left = (from) => (1 - from);
    const deathDur = hero.actions.death.getClip().duration;
    hero.pose([
      ['idle', left(toGrowl), t * 0.5],
      ['scream', toGrowl * left(toWalk), 0.7 + Math.max(0, t - 5.45) * 1.1],
      ['walk', toWalk * left(toRun), Math.max(0, t - 6.15) * 1.4],
      ['run', toRun * left(toLunge), Math.max(0, t - 6.55) * 1.6],
      // Slows almost to a hold while the rifle comes up
      ['attack', toLunge * left(toHit), 0.9 + Math.min(Math.max(0, t - 7.4), 0.6) * 1.2 + Math.max(0, t - 8) * 0.25],
      ['hit', toHit * left(toDeath), 0.2 + Math.max(0, t - SHOT_TIME) * 1.5],
      ['death', toDeath, Math.min(deathDur * 0.995, Math.max(0, t - SHOT_TIME - 0.12) * 1.3)]
    ]);
    hero.applyLook(0, 1);

    // Blood from the chest at the moment of the hit
    const age = t - SHOT_TIME - 0.03;
    env.blood.uniforms.uAge.value = age >= 0 && age < 1.1 ? age : -1;
    env.blood.uniforms.uOrigin.value.copy(bloodFrom.set(hero.root.position.x, 1.34, z + 0.1));
  };

  return { tl, apply };
}
