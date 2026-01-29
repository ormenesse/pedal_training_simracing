/**
 * Simracing Telemetry — Gamepad mapping and telemetry graphs.
 */

const STORAGE_KEY_MAPPING = 'simracing-telemetry-mapping';
const STORAGE_KEY_SETTINGS = 'simracing-telemetry-settings';
const DEFAULT_SECONDS_PER_1080 = 10;
const DEFAULT_GRAPH_WIDTH = 1080;

// --- State ---
const gamepads = {};
let steeringGraph, brakeGraph, throttleGraph;
let mapping = { steering: null, brake: null, throttle: null };
let secondsPer1080px = DEFAULT_SECONDS_PER_1080;
let graphWidthPx = DEFAULT_GRAPH_WIDTH;
let rafId = null;

// --- DOM ---
const gamepadHint = document.getElementById('gamepad-hint');
const gamepadList = document.getElementById('gamepad-list');
const steeringSelect = document.getElementById('steering-select');
const brakeSelect = document.getElementById('brake-select');
const throttleSelect = document.getElementById('throttle-select');
const secondsInput = document.getElementById('seconds-per-1080');
const graphWidthInput = document.getElementById('graph-width');
const steeringCanvas = document.getElementById('steering-canvas');
const brakeCanvas = document.getElementById('brake-canvas');
const throttleCanvas = document.getElementById('throttle-canvas');

// --- Load persisted ---
function loadMapping() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MAPPING);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.steering) mapping.steering = parsed.steering;
      if (parsed.brake) mapping.brake = parsed.brake;
      if (parsed.throttle) mapping.throttle = parsed.throttle;
    }
  } catch (_) {}
}

function saveMapping() {
  localStorage.setItem(STORAGE_KEY_MAPPING, JSON.stringify(mapping));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.secondsPer1080px === 'number') secondsPer1080px = parsed.secondsPer1080px;
      if (typeof parsed.graphWidthPx === 'number') graphWidthPx = parsed.graphWidthPx;
    }
  } catch (_) {}
  secondsInput.value = secondsPer1080px;
  graphWidthInput.value = graphWidthPx;
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify({
    secondsPer1080px,
    graphWidthPx,
  }));
}

// --- Gamepad discovery and axis preview ---
function buildAxisOptionKey(gamepadIndex, axisIndex) {
  return `${gamepadIndex}:${axisIndex}`;
}

function parseAxisOptionKey(value) {
  if (!value) return null;
  const [g, a] = value.split(':').map(Number);
  if (isNaN(g) || isNaN(a)) return null;
  return { gamepadIndex: g, axisIndex: a };
}

function addGamepad(gamepad) {
  gamepads[gamepad.index] = gamepad;
  const card = document.createElement('div');
  card.className = 'gamepad-card';
  card.id = `gamepad-${gamepad.index}`;
  card.innerHTML = `
    <h4>Gamepad ${gamepad.index}</h4>
    <div class="gamepad-meta">${gamepad.id} · ${gamepad.axes.length} axes, ${gamepad.buttons.length} buttons</div>
    <div class="axis-list" id="gamepad-axes-${gamepad.index}"></div>
  `;
  const axisList = card.querySelector(`#gamepad-axes-${gamepad.index}`);
  for (let i = 0; i < gamepad.axes.length; i++) {
    const axisItem = document.createElement('div');
    axisItem.className = 'axis-item';
    axisItem.innerHTML = `
      <label>Axis ${i}</label>
      <div class="axis-bar"><div class="axis-bar-fill" data-axis="${i}" style="width: 50%"></div></div>
      <span class="axis-value" data-axis="${i}">0.00</span>
    `;
    axisList.appendChild(axisItem);
  }
  gamepadList.appendChild(card);
  refreshMappingOptions();
  updateHint();
}

function removeGamepad(gamepad) {
  delete gamepads[gamepad.index];
  const card = document.getElementById(`gamepad-${gamepad.index}`);
  if (card) card.remove();
  refreshMappingOptions();
  updateHint();
}

function updateAxisPreview() {
  const list = navigator.getGamepads();
  if (!list) return;
  for (let i = 0; i < list.length; i++) {
    const gp = list[i];
    if (!gp) continue;
    const axisListEl = document.getElementById(`gamepad-axes-${gp.index}`);
    if (!axisListEl) continue;
    const fills = axisListEl.querySelectorAll('.axis-bar-fill');
    const values = axisListEl.querySelectorAll('.axis-value');
    for (let a = 0; a < gp.axes.length; a++) {
      const v = gp.axes[a];
      const pct = ((v + 1) / 2) * 100;
      if (fills[a]) fills[a].style.width = `${pct}%`;
      if (values[a]) values[a].textContent = v.toFixed(2);
    }
  }
}

function refreshMappingOptions() {
  const options = [{ value: '', text: 'None' }];
  const list = navigator.getGamepads();
  if (list) {
    for (let i = 0; i < list.length; i++) {
      const gp = list[i];
      if (!gp) continue;
      for (let a = 0; a < gp.axes.length; a++) {
        options.push({
          value: buildAxisOptionKey(i, a),
          text: `Gamepad ${i} → Axis ${a}`,
        });
      }
    }
  }
  function setSelect(select, currentKey) {
    select.innerHTML = '';
    const current = currentKey ? buildAxisOptionKey(currentKey.gamepadIndex, currentKey.axisIndex) : '';
    let found = false;
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.text;
      if (o.value === current) {
        opt.selected = true;
        found = true;
      }
      select.appendChild(opt);
    }
    if (current && !found) select.value = '';
  }
  setSelect(steeringSelect, mapping.steering);
  setSelect(brakeSelect, mapping.brake);
  setSelect(throttleSelect, mapping.throttle);
}

function updateHint() {
  const count = Object.keys(gamepads).length;
  if (count === 0) {
    gamepadHint.textContent = 'Click anywhere on the page to detect gamepads (required in some browsers).';
    gamepadHint.classList.add('hint');
  } else {
    gamepadHint.textContent = `${count} gamepad(s) connected.`;
    gamepadHint.classList.remove('hint');
  }
}

// --- Read mapped values from gamepads ---
function getMappedValue(key) {
  if (!key) return null;
  const list = navigator.getGamepads();
  if (!list || key.gamepadIndex >= list.length) return null;
  const gp = list[key.gamepadIndex];
  if (!gp || key.axisIndex >= gp.axes.length) return null;
  return gp.axes[key.axisIndex];
}

function getSteeringValue() {
  const v = getMappedValue(mapping.steering);
  return v === null ? 0 : v;
}

function getBrakeValue() {
  const v = getMappedValue(mapping.brake);
  if (v === null) return 0;
  return (v + 1) / 2;
}

function getThrottleValue() {
  const v = getMappedValue(mapping.throttle);
  if (v === null) return 0;
  return (v + 1) / 2;
}

// --- TelemetryGraph instances and config ---
function createGraphs() {
  const opts = { secondsPer1080px, widthPx: graphWidthPx };
  steeringGraph = new TelemetryGraph(steeringCanvas, {
    ...opts,
    yMin: -180,
    yMax: 180,
  });
  brakeGraph = new TelemetryGraph(brakeCanvas, {
    ...opts,
    yMin: 0,
    yMax: 100,
  });
  throttleGraph = new TelemetryGraph(throttleCanvas, {
    ...opts,
    yMin: 0,
    yMax: 100,
  });
}

function applyGraphConfig() {
  const opts = { secondsPer1080px, widthPx: graphWidthPx };
  if (steeringGraph) steeringGraph.setConfig(opts);
  if (brakeGraph) brakeGraph.setConfig(opts);
  if (throttleGraph) throttleGraph.setConfig(opts);
  steeringCanvas.width = graphWidthPx;
  brakeCanvas.width = graphWidthPx;
  throttleCanvas.width = graphWidthPx;
}

// --- Main loop ---
function loop() {
  const now = performance.now();
  updateAxisPreview();

  const steeringRaw = getSteeringValue();
  const brakeRaw = getBrakeValue();
  const throttleRaw = getThrottleValue();

  const steeringValue = steeringRaw * 1080;
  const brakeValue = brakeRaw * 100;
  const throttleValue = throttleRaw * 100;

  steeringGraph.push(now, steeringValue);
  brakeGraph.push(now, brakeValue);
  throttleGraph.push(now, throttleValue);

  steeringGraph.draw();
  brakeGraph.draw();
  throttleGraph.draw();

  rafId = requestAnimationFrame(loop);
}

// --- Event listeners ---
window.addEventListener('gamepadconnected', (e) => {
  addGamepad(e.gamepad);
  if (!rafId) {
    rafId = requestAnimationFrame(loop);
  }
});

window.addEventListener('gamepaddisconnected', (e) => {
  removeGamepad(e.gamepad);
});

document.body.addEventListener('click', () => {
  const list = navigator.getGamepads();
  if (!list) return;
  for (let i = 0; i < list.length; i++) {
    if (list[i] && !gamepads[i]) {
      addGamepad(list[i]);
    }
  }
  if (!rafId && (steeringGraph || Object.keys(gamepads).length > 0)) {
    rafId = requestAnimationFrame(loop);
  }
});

steeringSelect.addEventListener('change', () => {
  mapping.steering = parseAxisOptionKey(steeringSelect.value);
  saveMapping();
});

brakeSelect.addEventListener('change', () => {
  mapping.brake = parseAxisOptionKey(brakeSelect.value);
  saveMapping();
});

throttleSelect.addEventListener('change', () => {
  mapping.throttle = parseAxisOptionKey(throttleSelect.value);
  saveMapping();
});

secondsInput.addEventListener('change', () => {
  const v = Number(secondsInput.value);
  if (v >= 1 && v <= 120) {
    secondsPer1080px = v;
    saveSettings();
    applyGraphConfig();
  }
});

graphWidthInput.addEventListener('change', () => {
  const v = Number(graphWidthInput.value);
  if (v >= 320 && v <= 1920) {
    graphWidthPx = v;
    saveSettings();
    applyGraphConfig();
  }
});

// --- Init ---
loadMapping();
loadSettings();
createGraphs();
applyGraphConfig();
refreshMappingOptions();
updateHint();

// Start loop (telemetry runs even without gamepads so time axis stays consistent)
rafId = requestAnimationFrame(loop);
