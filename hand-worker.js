// Hand tracking off the main thread: the game loop never waits on the model.
// The page posts webcam frames as ImageBitmaps; this worker answers with the
// 21 normalized landmarks of one hand (or none).
// This is a classic worker (not type: 'module') because MediaPipe loads its
// WASM runtime with importScripts, which module workers don't support.
const BUNDLE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let landmarker = null;

async function init() {
  const { FilesetResolver, HandLandmarker } = await import(BUNDLE);
  const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT);
  // CPU, not GPU: on the GPU the model competes with the game's rendering and
  // causes dropped frames. On the CPU it runs on its own core, beside the game.
  landmarker = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
    runningMode: 'VIDEO',
    numHands: 1,
    minHandDetectionConfidence: 0.55,
    minHandPresenceConfidence: 0.55,
    minTrackingConfidence: 0.55
  });
  postMessage({ type: 'ready' });
}

let lastTs = 0;
onmessage = (e) => {
  const { frame } = e.data;
  let landmarks = [];
  try {
    // detectForVideo needs strictly increasing timestamps
    lastTs = Math.max(lastTs + 1, e.data.ts);
    landmarks = landmarker.detectForVideo(frame, lastTs).landmarks;
  } catch (err) {
    console.warn('Hand detection failed on a frame', err);
  }
  frame.close();
  postMessage({ type: 'result', landmarks });
};

init().catch((err) => postMessage({ type: 'error', message: String(err && err.message || err) }));
