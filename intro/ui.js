// Everything drawn over the 3D scene: loading gate, broadcast, title, main
// menu, How to Survive, Survival Records and Settings.

const ICONS = {
  tower: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M32 22 20 60M32 22l12 38M25 44h14M23 52h18M28 32h8"/><circle cx="32" cy="17" r="3.2" fill="currentColor"/><path d="M22 8a14 14 0 0 0 0 19M42 8a14 14 0 0 1 0 19M15 3a24 24 0 0 0 0 29M49 3a24 24 0 0 1 0 29"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6"/></svg>',
  cog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7 3h10v7a5 5 0 0 1-10 0zM7 5H3v2a4 4 0 0 0 4 4M17 5h4v2a4 4 0 0 1-4 4M12 15v4M8 21h8l-1-2H9z"/></svg>',
  target: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3"><circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="3" fill="currentColor"/><path d="M24 2v12M24 34v12M2 24h12M34 24h12"/></svg>',
  skull: '<svg viewBox="0 0 48 48" fill="currentColor"><path d="M24 4C13 4 6 12 6 22c0 6 3 11 8 14v6c0 1 1 2 2 2h16c1 0 2-1 2-2v-6c5-3 8-8 8-14C42 12 35 4 24 4zM16 29a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm16 0a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm-8 6-3-5h6z"/></svg>',
  stopwatch: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="24" cy="28" r="16"/><path d="M24 28V17M18 4h12M24 4v8M37 13l3-3"/></svg>',
  bars: '<svg viewBox="0 0 48 48" fill="currentColor"><rect x="5" y="28" width="9" height="15"/><rect x="19" y="19" width="9" height="24"/><rect x="33" y="8" width="9" height="35"/></svg>',
  audio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4zM16 9a4 4 0 0 1 0 6"/></svg>',
  screen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="12"/><path d="M8 20h8M12 16v4"/></svg>',
  pad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 7h10a5 5 0 0 1 5 5l1 6a2 2 0 0 1-4 1l-2-3H7l-2 3a2 2 0 0 1-4-1l1-6a5 5 0 0 1 5-5zM7 10v4M5 12h4"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/></svg>'
};

// Illustrations of the gestures the game really reads. The fingers are thick
// round lines, so each pose is just a list of joints.
const HAND = { fill: '#d9c4ae', shade: '#a98f77' };
function fingers(list) {
  return list.map((pts) => `<polyline points="${pts}" fill="none" stroke="${HAND.fill}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
}
const palm = `<path d="M38 58c0-6 3-10 9-10h26c6 0 9 4 9 10v18c0 10-8 20-22 20S38 86 38 76z" fill="${HAND.fill}"/>`;
const OPEN = fingers(['43,52 37,18', '53,50 52,10', '64,50 67,12', '75,54 83,22', '40,70 22,52 17,42']) + palm;
const FIST = `<rect x="33" y="40" width="54" height="44" rx="13" fill="${HAND.fill}"/>${[40, 52, 64, 76].map((x) => `<line x1="${x}" y1="46" x2="${x}" y2="60" stroke="${HAND.shade}" stroke-width="2.4" stroke-linecap="round"/>`).join('')}<path d="M34 66h34" stroke="${HAND.shade}" stroke-width="10" stroke-linecap="round"/><path d="M44 84h32v12H44z" fill="${HAND.fill}"/>`;
const GUN = fingers(['52,56 92,44', '46,44 40,20']) + `<rect x="36" y="50" width="44" height="34" rx="12" fill="${HAND.fill}"/>${[58, 66, 74].map((y) => `<line x1="48" y1="${y}" x2="72" y2="${y}" stroke="${HAND.shade}" stroke-width="2.4" stroke-linecap="round"/>`).join('')}<path d="M46 84h26v12H46z" fill="${HAND.fill}"/>`;
const PINCH = fingers(['50,50 60,28 72,26', '40,66 48,42 70,28', '63,50 76,14', '73,52 88,22', '80,58 98,34']) + palm;

function handSvg(pose, extra = '') {
  return `<svg viewBox="0 0 120 104" aria-hidden="true"><g>${pose}</g>${extra}</svg>`;
}
const crosshairMark = `<g class="df-drift"><circle cx="92" cy="34" r="12" fill="none" stroke="#d52222" stroke-width="2.4"/><path d="M92 18v8M92 42v8M76 34h8M100 34h8" stroke="#d52222" stroke-width="2.4"/></g>`;
const fireMark = '<g class="df-pulse"><path d="M12 10l9 9M108 10l-9 9M60 0v8M4 34h10M116 34h-10" stroke="#d52222" stroke-width="3.4" stroke-linecap="round"/></g>';
const blastMark = '<g class="df-pulse"><path d="M60 4v16M28 14l9 13M92 14l-9 13M12 40h13M108 40H95" stroke="#fbbf24" stroke-width="3.6" stroke-linecap="round"/></g>';

const SHOOT_COPY = {
  palm: { label: 'Open hand', art: handSvg(OPEN, fireMark), text: 'Open all five fingers to <b>fire</b>. Relax your hand to stop.' },
  gun: { label: 'Finger gun', art: handSvg(GUN, fireMark), text: 'Point a finger gun, then <b>drop your thumb</b> to fire. Lift it to stop.' },
  pinch: { label: 'Pinch', art: handSvg(PINCH, fireMark), text: '<b>Touch your thumb</b> to your index fingertip to fire. Release to stop.' }
};
const GESTURE_NAMES = { palm: 'Open hand', gun: 'Finger gun', pinch: 'Pinch' };

// DEAD in worn steel, FRONT in blood red, with cracks, chips and scratches cut
// out of the letters. Drawn once at load; the animation only moves the canvas.
export function drawTitle(canvas) {
  const g = canvas.getContext('2d');
  const setFont = () => {
    g.textBaseline = 'alphabetic';
    g.font = '356px Anton';
    if ('letterSpacing' in g) g.letterSpacing = '6px';
  };
  setFont();
  const dead = 'DEAD', front = 'FRONT', gap = 64;
  const dw = g.measureText(dead).width, fw = g.measureText(front).width;
  // Sized from the measured text, so no letter can be cut off at the edge
  const W = Math.ceil(dw + gap + fw + 56), H = 430;
  canvas.width = W;
  canvas.height = H;
  setFont();
  const x0 = (W - dw - gap - fw) / 2, base = 376;

  const metal = (a, b, c, d) => {
    const l = g.createLinearGradient(0, 30, 0, 390);
    l.addColorStop(0, a); l.addColorStop(0.42, b); l.addColorStop(0.55, c); l.addColorStop(1, d);
    return l;
  };
  g.fillStyle = metal('#f0ece6', '#b9b5ae', '#8f8b85', '#c7c2bb');
  g.fillText(dead, x0, base);
  g.fillStyle = metal('#ef3a2c', '#b81a14', '#8e0f0c', '#c5231b');
  g.fillText(front, x0 + dw + gap, base);

  // Grain: thousands of small dark and light flecks, kept inside the letters
  g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 26000; i++) {
    const dark = Math.random() < 0.72;
    g.fillStyle = dark ? `rgba(0,0,0,${0.06 + Math.random() * 0.26})` : `rgba(255,245,235,${Math.random() * 0.16})`;
    const s = Math.random() < 0.97 ? 1 + Math.random() * 2.2 : 3 + Math.random() * 9;
    g.fillRect(Math.random() * W, Math.random() * H, s, s * (0.5 + Math.random()));
  }
  // Soot rising from the bottom edge
  const soot = g.createLinearGradient(0, 200, 0, 400);
  soot.addColorStop(0, 'rgba(10,6,4,0)');
  soot.addColorStop(1, 'rgba(10,6,4,0.62)');
  g.fillStyle = soot;
  g.fillRect(0, 0, W, H);
  // Scratches
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,235,220'},${0.1 + Math.random() * 0.3})`;
    g.lineWidth = 0.6 + Math.random() * 1.6;
    const x = Math.random() * W, y = Math.random() * H, a = -0.5 + Math.random();
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * (40 + Math.random() * 170), y + Math.sin(a) * (40 + Math.random() * 170));
    g.stroke();
  }

  // Cracks and chipped edges cut right through to transparent
  g.globalCompositeOperation = 'destination-out';
  g.strokeStyle = '#000';
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    let x = Math.random() * W, y = 30 + Math.random() * 350, a = Math.random() * 6.28;
    g.lineWidth = 1 + Math.random() * 2.6;
    g.beginPath();
    g.moveTo(x, y);
    const n = 4 + Math.floor(Math.random() * 7);
    for (let k = 0; k < n; k++) {
      a += -0.9 + Math.random() * 1.8;
      const step = 9 + Math.random() * 28;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 620; i++) {
    const edge = Math.random() < 0.5;
    const y = edge ? (Math.random() < 0.5 ? 40 + Math.random() * 26 : 352 + Math.random() * 28) : Math.random() * H;
    g.beginPath();
    g.arc(Math.random() * W, y, 0.6 + Math.random() * (edge ? 5.2 : 2.2), 0, 6.28);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  return canvas;
}

export function drawTitleCopy(target, source) {
  target.width = source.width;
  target.height = source.height;
  target.getContext('2d').drawImage(source, 0, 0);
}

export function createUI(root, game, settings, on) {
  root.innerHTML = `
    <div class="df-layer df-vignette"></div>
    <div class="df-layer df-cross" data-ref="cross"><i></i><i></i><i></i><i></i><b></b></div>
    <div class="df-layer df-fade" data-ref="fade"></div>
    <div class="df-layer df-title" data-ref="title">
      <canvas data-ref="titleArt" aria-label="DEAD FRONT"></canvas>
      <div class="df-tagline" data-ref="tagline">THE DEAD ARE COMING.<br>YOUR HANDS ARE YOUR ONLY WEAPON.</div>
    </div>
    <div class="df-layer df-broadcast" data-ref="broadcast">
      <div class="df-brackets"></div>
      ${ICONS.tower}
      <h1>EMERGENCY BROADCAST</h1>
      <h2>SECTOR 09 &mdash; CONTAINMENT LOST</h2>
      <canvas data-ref="wave" width="620" height="90"></canvas>
      <div class="df-scan"></div>
    </div>
    <div class="df-layer df-flash" data-ref="flash"></div>

    <div class="df-menu" data-ref="menu">
      <div class="df-menu-col">
        <canvas data-ref="menuTitle" aria-label="DEAD FRONT"></canvas>
        <div class="df-menu-tag">THE DEAD ARE COMING.<br>YOUR HANDS ARE YOUR ONLY WEAPON.</div>
        <button class="df-btn df-primary" data-ref="btnStart">START GAME</button>
        <button class="df-btn" data-ref="btnHow">HOW TO PLAY</button>
        <button class="df-btn" data-ref="btnRecords">SURVIVAL RECORDS</button>
        <button class="df-btn" data-ref="btnSettings">SETTINGS</button>
        <div class="df-protocol">SURVIVAL PROTOCOL // SECTOR 09</div>
      </div>
      <div class="df-status" data-ref="status"><i></i><span data-ref="statusText"></span></div>
    </div>

    <div class="df-panel" data-ref="panelHow"><div class="df-sheet">
      <button class="df-back" data-back>&lsaquo; BACK</button>
      <h2><span class="df-slash">//</span> HOW TO SURVIVE <span class="df-slash">//</span></h2>
      <div class="df-steps">
        <div class="df-step"><header><b>1</b>POSITION YOUR HAND</header>${handSvg(OPEN)}<p>Hold one hand up facing your camera, about an arm's length away, with the whole hand in the picture.</p></div>
        <div class="df-step"><header><b>2</b>AIM AT ZOMBIES</header>${handSvg(OPEN, crosshairMark)}<p>Move your hand to steer the crosshair. Aim follows your knuckles. Headshots do 3x damage.</p></div>
        <div class="df-step"><header><b>3</b>SHOOT</header><div data-ref="howShootArt"></div><p data-ref="howShootText"></p></div>
        <div class="df-step"><header><b>4</b>CALL AN AIRSTRIKE</header>${handSvg(FIST, blastMark)}<p>When the meter says READY, clench a tight fist to bring comets down on the horde.</p></div>
      </div>
      <div class="df-tips">
        <div><h3>TIPS FOR BETTER DETECTION</h3><ul>
          <li>Keep your hand well lit, with no bright window behind you.</li>
          <li>Keep your whole hand inside the camera frame.</li>
          <li>Use one hand, against a plain background if you can.</li>
          <li>If it loses you, bring your hand back to the middle of the frame.</li>
        </ul></div>
        <div><h3>STARTING THE FIGHT</h3><ul>
          <li>Press START GAME and allow the camera when your browser asks.</li>
          <li>No camera? Aim with the mouse, hold left-click to fire, and press <kbd>Space</kbd> for the airstrike.</li>
          <li><kbd>G</kbd> switches shooting gesture in game. <kbd>F</kbd> toggles the flashlight.</li>
          <li><kbd>[</kbd> and <kbd>]</kbd> adjust aim sensitivity. <kbd>F11</kbd> switches full screen.</li>
        </ul></div>
      </div>
    </div></div>

    <div class="df-panel" data-ref="panelRecords"><div class="df-sheet">
      <button class="df-back" data-back>&lsaquo; BACK</button>
      <h2>${ICONS.trophy} SURVIVAL RECORDS</h2>
      <div class="df-records">
        <div class="df-record">${ICONS.target}<div><span>HIGHEST SCORE</span><strong data-ref="recScore"></strong></div></div>
        <div class="df-record">${ICONS.skull}<div><span>ZOMBIES ELIMINATED</span><strong data-ref="recKills"></strong></div></div>
        <div class="df-record">${ICONS.stopwatch}<div><span>BEST SURVIVAL TIME</span><strong data-ref="recTime"></strong></div></div>
        <div class="df-record">${ICONS.bars}<div><span>TOTAL SESSIONS</span><strong data-ref="recSessions"></strong></div></div>
      </div>
      <p class="df-note">SAVED IN THIS BROWSER. ZOMBIE AND TIME RECORDS BEGIN WITH YOUR NEXT RUN.</p>
    </div></div>

    <div class="df-panel" data-ref="panelSettings"><div class="df-sheet">
      <button class="df-back" data-back>&lsaquo; BACK</button>
      <h2>${ICONS.cog} SETTINGS</h2>
      <div class="df-settings">
        <div class="df-tabs" role="tablist">
          <button class="df-tab" data-tab="audio">${ICONS.audio}AUDIO</button>
          <button class="df-tab" data-tab="graphics">${ICONS.screen}GRAPHICS</button>
          <button class="df-tab" data-tab="controls">${ICONS.pad}CONTROLS</button>
          <button class="df-tab" data-tab="camera">${ICONS.camera}CAMERA</button>
          <button class="df-tab" data-tab="general">${ICONS.cog}GENERAL</button>
        </div>
        <div class="df-rows">
          <section data-section="audio">
            <div class="df-row"><span>MASTER VOLUME</span><label class="df-slider"><input type="range" min="0" max="100" data-ref="setMaster"><output></output></label></div>
            <div class="df-row"><span>MUSIC VOLUME<small>The intro and menu score. The game itself has no music.</small></span><label class="df-slider"><input type="range" min="0" max="100" data-ref="setMusic"><output></output></label></div>
            <div class="df-row"><span>SOUND EFFECTS</span><label class="df-slider"><input type="range" min="0" max="100" data-ref="setSfx"><output></output></label></div>
          </section>
          <section data-section="graphics">
            <div class="df-row"><span>GRAPHICS QUALITY<small>The 3D intro and menu. Auto steps down if the frame rate falls.</small></span><div class="df-pick" data-pick="quality"></div></div>
          </section>
          <section data-section="controls">
            <div class="df-row"><span>MOUSE / AIM SENSITIVITY</span><label class="df-slider"><input type="range" min="0.3" max="2" step="0.05" data-ref="setSens"><output></output></label></div>
            <div class="df-row"><span>SHOOTING GESTURE</span><div class="df-pick" data-pick="gesture"></div></div>
            <div class="df-row"><span>DIFFICULTY</span><div class="df-pick" data-pick="difficulty"></div></div>
          </section>
          <section data-section="camera">
            <div class="df-row"><span>CAMERA INTERACTION<small>Hand tracking in game, and the menu's parallax. Off plays with the mouse.</small></span><div class="df-pick" data-pick="camera"></div></div>
            <div class="df-row"><span>TEST CAMERA NOW<small>Asks for permission if needed. Move your hand to steer the menu camera.</small></span><button class="df-action" data-ref="btnCamTest">ENABLE</button></div>
            <div class="df-row" data-ref="camPickRow" style="display:none"><span>WHICH CAMERA</span><select class="df-select" data-ref="camPick"></select></div>
          </section>
          <section data-section="general">
            <div class="df-row"><span>REPLAY INTRO</span><button class="df-action" data-ref="btnReplay">REPLAY</button></div>
            <div class="df-row"><span>PLAY IN FULL SCREEN<small>[F11] switches at any time.</small></span><div class="df-pick" data-pick="fullscreen"></div></div>
            <div class="df-credits">3D models: Quaternius, Pichuliru (CC0) and Quaternius, bachosoftdesign (CC-BY 3.0) via Poly Pizza. Textures: Poly Haven (CC0). Sound: SEF7, felix.blume, zazz.sound.design, lolamadeus, tonsil5, LegoCustomZone, mlsulli, YannSauvin via Freesound (CC0). Full list in ASSET_CREDITS.md.</div>
          </section>
        </div>
      </div>
    </div></div>

    <button class="df-skip" data-ref="skip" style="display:none">SKIP INTRO &rsaquo;</button>
    <button class="df-mute" data-ref="mute" title="Mute" style="display:none"></button>
    <div class="df-gate" data-ref="gate">
      <canvas data-ref="gateTitle" aria-label="DEAD FRONT"></canvas>
      <div class="df-bar" data-ref="bar"><i data-ref="barFill"></i></div>
      <button class="df-enter" data-ref="enter">ENTER DEAD FRONT</button>
      <div class="df-gate-note" data-ref="gateNote">LOADING SECTOR 09</div>
    </div>`;

  const refs = {};
  root.querySelectorAll('[data-ref]').forEach((el) => { refs[el.dataset.ref] = el; });

  const ui = { refs, openPanel: null };

  // Sliders
  const bindSlider = (input, value, format, onChange) => {
    const out = input.parentElement.querySelector('output');
    input.value = value;
    const show = () => { out.textContent = format(+input.value); };
    show();
    input.addEventListener('input', () => { show(); onChange(+input.value); });
  };
  const pct = (v) => `${Math.round(v)}%`;
  bindSlider(refs.setMaster, settings.master * 100, pct, (v) => on.setting('master', v / 100));
  bindSlider(refs.setMusic, settings.music * 100, pct, (v) => on.setting('music', v / 100));
  bindSlider(refs.setSfx, settings.sfx * 100, pct, (v) => on.setting('sfx', v / 100));
  bindSlider(refs.setSens, game.getAimSensitivity(), (v) => `${v.toFixed(2)}`, (v) => game.setAimSensitivity(v));

  // Left/right pickers
  const pickers = {
    quality: { options: [['auto', 'AUTO'], ['low', 'LOW'], ['medium', 'MEDIUM'], ['high', 'HIGH']], get: () => settings.quality, set: (v) => on.setting('quality', v) },
    gesture: { options: Object.entries(GESTURE_NAMES).map(([k, v]) => [k, v.toUpperCase()]), get: () => game.getShootGesture(), set: (v) => { game.setShootGesture(v); refreshHow(); } },
    difficulty: { options: [['easy', 'EASY'], ['normal', 'NORMAL'], ['hard', 'HARD']], get: () => game.getDifficulty(), set: (v) => game.setDifficulty(v) },
    camera: { options: [[true, 'ENABLED'], [false, 'DISABLED']], get: () => settings.camera, set: (v) => on.setting('camera', v) },
    fullscreen: {
      options: [[true, 'ON'], [false, 'OFF']],
      get: () => game.fullscreenStart.checked,
      set: (v) => {
        game.fullscreenStart.checked = v;
        game.fullscreenStart.dispatchEvent(new Event('change'));
        if (v !== !!document.fullscreenElement) game.toggleFullscreen();
      }
    }
  };
  root.querySelectorAll('[data-pick]').forEach((el) => {
    const p = pickers[el.dataset.pick];
    el.innerHTML = `<button aria-label="Previous">&lsaquo;</button><span></span><button aria-label="Next">&rsaquo;</button>`;
    const label = el.querySelector('span');
    const show = () => { label.textContent = (p.options.find(([k]) => k === p.get()) || p.options[0])[1]; };
    const move = (dir) => {
      const i = p.options.findIndex(([k]) => k === p.get());
      p.set(p.options[(i + dir + p.options.length) % p.options.length][0]);
      show();
    };
    el.children[0].addEventListener('click', () => move(-1));
    el.children[2].addEventListener('click', () => move(1));
    show();
  });

  // Tabs
  const tabs = [...root.querySelectorAll('.df-tab')];
  const showTab = (name) => {
    tabs.forEach((t) => t.classList.toggle('df-on', t.dataset.tab === name));
    root.querySelectorAll('[data-section]').forEach((s) => s.classList.toggle('df-on', s.dataset.section === name));
  };
  tabs.forEach((t) => t.addEventListener('click', () => { showTab(t.dataset.tab); if (t.dataset.tab === 'camera') on.refreshCamera(); }));
  showTab('audio');

  // How to survive follows the gesture the player has chosen
  function refreshHow() {
    const copy = SHOOT_COPY[game.getShootGesture()] || SHOOT_COPY.palm;
    refs.howShootArt.innerHTML = copy.art;
    refs.howShootText.innerHTML = `${copy.text} Or hold left-click in mouse mode.`;
  }
  refreshHow();

  function refreshRecords() {
    const r = game.records();
    const t = r.bestTime;
    refs.recScore.textContent = r.highScore ? r.highScore.toLocaleString('en-US') : '—';
    refs.recKills.textContent = r.kills ? r.kills.toLocaleString('en-US') : '—';
    refs.recTime.textContent = t ? `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` : '—';
    refs.recSessions.textContent = r.sessions ? String(r.sessions) : '—';
  }

  // Panels
  ui.open = (panel) => {
    if (ui.openPanel) ui.openPanel.classList.remove('df-open');
    ui.openPanel = panel;
    panel.classList.add('df-open');
    const back = panel.querySelector('[data-back]');
    if (back) back.focus({ preventScroll: true });
  };
  ui.closePanel = () => {
    if (!ui.openPanel) return;
    ui.openPanel.classList.remove('df-open');
    ui.openPanel = null;
    refs.btnStart.focus({ preventScroll: true });
  };
  root.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', ui.closePanel));
  refs.btnHow.addEventListener('click', () => { refreshHow(); ui.open(refs.panelHow); });
  refs.btnRecords.addEventListener('click', () => { refreshRecords(); ui.open(refs.panelRecords); });
  refs.btnSettings.addEventListener('click', () => { ui.open(refs.panelSettings); });
  refs.btnStart.addEventListener('click', () => on.start());
  refs.skip.addEventListener('click', () => on.skip());
  refs.enter.addEventListener('click', () => on.enter());
  refs.btnReplay.addEventListener('click', () => { ui.closePanel(); on.replay(); });
  refs.btnCamTest.addEventListener('click', () => on.testCamera());

  refs.mute.addEventListener('click', () => { game.toggleMute(); ui.syncMute(); });
  ui.syncMute = () => {
    refs.mute.innerHTML = game.audio.muted ? ICONS.soundOff : ICONS.soundOn;
    refs.mute.title = game.audio.muted ? 'Unmute' : 'Mute';
  };
  ui.syncMute();

  ui.setStatus = (text, active) => {
    refs.statusText.textContent = text;
    refs.status.classList.toggle('df-on', active);
  };

  // Which-camera list, shown once there is permission to read the names
  refs.camPick.addEventListener('change', () => {
    game.cameraSelect.value = refs.camPick.value;
    game.cameraSelect.dispatchEvent(new Event('change'));
  });
  ui.syncCameraPicker = () => {
    const opts = [...game.cameraSelect.options];
    refs.camPickRow.style.display = opts.length > 1 ? '' : 'none';
    refs.camPick.replaceChildren(...opts.map((o) => new Option(o.textContent, o.value)));
    refs.camPick.value = game.cameraSelect.value;
  };

  ui.onEscape = (e) => {
    if (e.key === 'Escape' && ui.openPanel) ui.closePanel();
  };
  window.addEventListener('keydown', ui.onEscape);
  ui.dispose = () => window.removeEventListener('keydown', ui.onEscape);

  // Radio waveform for the opening scene: follows the real audio when there is
  // some, and a small idle wobble when muted
  const waveCtx = refs.wave.getContext('2d');
  const waveData = new Uint8Array(128);
  ui.drawWave = (analyser, t) => {
    const W = refs.wave.width, H = refs.wave.height, mid = H / 2;
    waveCtx.clearRect(0, 0, W, H);
    if (analyser) analyser.getByteTimeDomainData(waveData);
    waveCtx.fillStyle = '#d52222';
    const bars = 124;
    for (let i = 0; i < bars; i++) {
      const window = Math.sin((i / bars) * Math.PI);
      const sample = analyser ? Math.abs(waveData[i] - 128) / 128 : 0;
      const idle = 0.05 + Math.abs(Math.sin(i * 0.9 + t * 11)) * 0.12;
      const h = Math.max(1.5, (idle + sample * 2.2) * window * window * H);
      waveCtx.fillRect((i / bars) * W, mid - h / 2, 2.6, h);
    }
  };

  return ui;
}
