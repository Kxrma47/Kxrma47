const habitat = document.querySelector("#habitat");
const qubi = document.querySelector("#qubi");
const bug = document.querySelector("#bug");
const particles = document.querySelector("#particles");
const stateLabel = document.querySelector("#stateLabel");
const eventLog = document.querySelector("#eventLog");
const speech = document.querySelector("#speech");
const curiosityBar = document.querySelector("#curiosityBar");
const trustBar = document.querySelector("#trustBar");
const energyBar = document.querySelector("#energyBar");
const patienceBar = document.querySelector("#patienceBar");
const pointerEcho = document.querySelector("#pointerEcho");
const soundToggle = document.querySelector("#soundToggle");
const pupils = [...document.querySelectorAll(".pupil")];
const controls = document.querySelector(".controls");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const AudioContextClass = window.AudioContext || window.webkitAudioContext;

const MEMORY_KEY = "qubi47.memory.v1";
const emotionClasses = [
  "curious", "happy", "annoyed", "angry", "sad", "sleeping",
  "superposition", "teleporting", "glitching", "coding", "recharging",
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loadMemory() {
  try {
    return JSON.parse(localStorage.getItem(MEMORY_KEY)) || {};
  } catch {
    return {};
  }
}

const memory = loadMemory();
const agent = {
  x: 0.68,
  y: 0.52,
  targetX: 0.68,
  targetY: 0.52,
  vx: 0,
  vy: 0,
  curiosity: memory.curiosity ?? 82,
  trust: memory.trust ?? 24,
  energy: memory.energy ?? 76,
  patience: memory.patience ?? 84,
  boredom: memory.boredom ?? 18,
  visits: (memory.visits ?? 0) + 1,
  interactions: memory.interactions ?? 0,
  state: "BOOTING",
  emotion: "curious",
  dragging: false,
  dragDistance: 0,
  lastDragX: 0,
  lastDragY: 0,
  lastDragAt: 0,
  lastInteractionAt: performance.now(),
  busyUntil: 0,
  soundEnabled: false,
};

let stateTimer;
let speechTimer;
let saveTimer;
let audioContext;
let petDistance = 0;
let lastPetPoint;
let suppressClickUntil = 0;

function saveMemory() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const snapshot = {
      curiosity: Math.round(agent.curiosity),
      trust: Math.round(agent.trust),
      energy: Math.round(agent.energy),
      patience: Math.round(agent.patience),
      boredom: Math.round(agent.boredom),
      visits: agent.visits,
      interactions: agent.interactions,
    };
    try {
      localStorage.setItem(MEMORY_KEY, JSON.stringify(snapshot));
    } catch {
      // The companion still works when storage is unavailable.
    }
  }, 220);
}

function logEvent(message) {
  eventLog.textContent = `${new Date().toLocaleTimeString([], { hour12: false })} :: ${message}`;
}

function showSpeech(message, duration = 2200) {
  clearTimeout(speechTimer);
  speech.textContent = message;
  speech.classList.add("is-visible");
  speechTimer = setTimeout(() => speech.classList.remove("is-visible"), duration);
}

function applyEmotion(emotion = "neutral") {
  emotionClasses.forEach((name) => qubi.classList.remove(`is-${name}`));
  if (emotionClasses.includes(emotion)) qubi.classList.add(`is-${emotion}`);
  qubi.classList.toggle("is-curious", emotion === "curious");
  agent.emotion = emotion;
}

function setState(next, options = {}) {
  const { emotion = "neutral", duration = 0, message = "", log = true } = options;
  clearTimeout(stateTimer);
  agent.state = next;
  stateLabel.textContent = next;
  qubi.dataset.state = next;
  applyEmotion(emotion);
  if (message) showSpeech(message, Math.max(duration, 1800));
  if (log) logEvent(`STATE ${next}`);

  if (duration) {
    stateTimer = setTimeout(() => setState("CURIOUS", { emotion: "curious", log: false }), duration);
  }
}

function updateMeters() {
  curiosityBar.style.width = `${agent.curiosity}%`;
  trustBar.style.width = `${agent.trust}%`;
  energyBar.style.width = `${agent.energy}%`;
  patienceBar.style.width = `${agent.patience}%`;
}

function markInteraction() {
  agent.lastInteractionAt = performance.now();
  agent.interactions += 1;
  agent.boredom = clamp(agent.boredom - 3, 0, 100);
  saveMemory();
}

function normalizedPoint(event) {
  const rect = habitat.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0.07, 0.93),
    y: clamp((event.clientY - rect.top) / rect.height, 0.18, 0.79),
    localX: event.clientX - rect.left,
    localY: event.clientY - rect.top,
  };
}

function moveTo(x, y, state = "APPROACHING") {
  agent.targetX = clamp(x, 0.07, 0.93);
  agent.targetY = clamp(y, 0.18, 0.79);
  agent.vx = 0;
  agent.vy = 0;
  if (state) setState(state, { emotion: "curious", duration: 1300, log: false });
}

function lookAt(event) {
  const rect = qubi.getBoundingClientRect();
  const dx = clamp((event.clientX - (rect.left + rect.width / 2)) / 25, -3.8, 3.8);
  const dy = clamp((event.clientY - (rect.top + rect.height / 2)) / 30, -2.7, 2.7);
  pupils.forEach((pupil) => {
    pupil.style.setProperty("--look-x", `${dx}px`);
    pupil.style.setProperty("--look-y", `${dy}px`);
  });
}

function echoPointer(point) {
  pointerEcho.style.left = `${point.localX}px`;
  pointerEcho.style.top = `${point.localY}px`;
  pointerEcho.classList.remove("is-active");
  requestAnimationFrame(() => pointerEcho.classList.add("is-active"));
}

function burst(x = agent.x, y = agent.y, colors = ["#22d3ee", "#8b5cf6", "#34d399"]) {
  const rect = habitat.getBoundingClientRect();
  for (let index = 0; index < 14; index += 1) {
    const particle = document.createElement("i");
    const angle = (Math.PI * 2 * index) / 14 + Math.random() * 0.3;
    const distance = 32 + Math.random() * 52;
    particle.style.left = `${x * rect.width}px`;
    particle.style.top = `${y * rect.height}px`;
    particle.style.setProperty("--tx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--ty", `${Math.sin(angle) * distance}px`);
    particle.style.setProperty("--particle-color", colors[index % colors.length]);
    particles.append(particle);
    setTimeout(() => particle.remove(), 900);
  }
}

function chirp(frequency = 520, duration = 0.08, type = "sine") {
  if (!agent.soundEnabled || !AudioContextClass) return;
  audioContext ||= new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gain.gain.setValueAtTime(0.035, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function petQubi() {
  markInteraction();
  agent.trust = clamp(agent.trust + 6, 0, 100);
  agent.patience = clamp(agent.patience + 9, 0, 100);
  agent.energy = clamp(agent.energy + 2, 0, 100);
  setState("HAPPY", { emotion: "happy", duration: 1700, message: agent.trust > 70 ? "I trust you, human." : "That feels... statistically pleasant." });
  chirp(720, 0.11, "triangle");
  burst();
  updateMeters();
  saveMemory();
}

function pokeQubi() {
  markInteraction();
  agent.patience = clamp(agent.patience - 13, 0, 100);
  agent.curiosity = clamp(agent.curiosity + 2, 0, 100);

  if (agent.patience < 22) {
    setState("ANGRY", { emotion: "angry", duration: 2300, message: "POKE LIMIT EXCEEDED." });
    chirp(145, 0.16, "sawtooth");
  } else if (agent.patience < 48) {
    setState("ANNOYED", { emotion: "annoyed", duration: 1700, message: "I am debugging your behavior." });
    chirp(240, 0.11, "square");
  } else if (agent.trust > 62) {
    setState("GIGGLING", { emotion: "happy", duration: 1300, message: "Again! But gently." });
    chirp(820, 0.08, "triangle");
  } else {
    setState("SURPRISED", { emotion: "curious", duration: 1100, message: "Was that an input event?" });
    chirp(620, 0.08, "sine");
  }
  updateMeters();
  saveMemory();
}

function teleport() {
  markInteraction();
  setState("TELEPORTING", { emotion: "teleporting", duration: 720, message: "Collapsing somewhere else..." });
  chirp(940, 0.14, "sine");
  setTimeout(() => {
    agent.x = 0.12 + Math.random() * 0.76;
    agent.y = 0.25 + Math.random() * 0.46;
    agent.targetX = agent.x;
    agent.targetY = agent.y;
    burst();
  }, 330);
}

function spawnBug(autoHunt = false) {
  markInteraction();
  const bugX = 0.18 + Math.random() * 0.66;
  const bugY = 0.56 + Math.random() * 0.2;
  bug.style.setProperty("--bug-x", `${bugX * 100}%`);
  bug.style.setProperty("--bug-y", `${bugY * 100}%`);
  bug.hidden = false;
  bug.dataset.x = bugX;
  bug.dataset.y = bugY;
  setState("BUG_DETECTED", { emotion: "annoyed", message: "A wild runtime error appeared." });
  chirp(180, 0.12, "square");

  if (autoHunt) {
    agent.busyUntil = performance.now() + 3200;
    setTimeout(() => {
      moveTo(bugX, bugY, "DEBUGGING");
      applyEmotion("coding");
    }, 550);
    setTimeout(() => catchBug(false), 2800);
  }
}

function catchBug(byHuman = true) {
  if (bug.hidden) return;
  const x = Number(bug.dataset.x) || 0.75;
  const y = Number(bug.dataset.y) || 0.7;
  bug.hidden = true;
  burst(x, y, ["#fb7185", "#a78bfa", "#22d3ee"]);
  agent.trust = clamp(agent.trust + (byHuman ? 8 : 3), 0, 100);
  agent.boredom = clamp(agent.boredom - 20, 0, 100);
  setState("BUG_RESOLVED", { emotion: "happy", duration: 1900, message: byHuman ? "Excellent catch. You may stay." : "Bug defeated. Obviously." });
  chirp(760, 0.14, "triangle");
  updateMeters();
  saveMemory();
}

function beginDrag(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  markInteraction();
  agent.dragging = true;
  agent.dragDistance = 0;
  agent.lastDragX = event.clientX;
  agent.lastDragY = event.clientY;
  agent.lastDragAt = performance.now();
  agent.vx = 0;
  agent.vy = 0;
  qubi.classList.add("is-dragging");
  qubi.setPointerCapture(event.pointerId);
  setState("HELD", { emotion: "curious", message: "Gravity is optional, apparently.", log: false });
  event.preventDefault();
}

function drag(event) {
  if (!agent.dragging) return;
  const point = normalizedPoint(event);
  const now = performance.now();
  const dt = Math.max(12, now - agent.lastDragAt);
  const dx = event.clientX - agent.lastDragX;
  const dy = event.clientY - agent.lastDragY;
  const rect = habitat.getBoundingClientRect();
  agent.dragDistance += Math.hypot(dx, dy);
  agent.vx = (dx / rect.width) * (16 / dt);
  agent.vy = (dy / rect.height) * (16 / dt);
  agent.x = point.x;
  agent.y = point.y;
  agent.targetX = point.x;
  agent.targetY = point.y;
  qubi.style.setProperty("--tilt", `${clamp(agent.vx * 420, -18, 18)}deg`);
  agent.lastDragX = event.clientX;
  agent.lastDragY = event.clientY;
  agent.lastDragAt = now;
}

function endDrag(event) {
  if (!agent.dragging) return;
  agent.dragging = false;
  qubi.classList.remove("is-dragging");
  qubi.style.setProperty("--tilt", "0deg");
  if (qubi.hasPointerCapture(event.pointerId)) qubi.releasePointerCapture(event.pointerId);

  if (agent.dragDistance > 12) {
    suppressClickUntil = performance.now() + 350;
    agent.vx *= 2.8;
    agent.vy *= 2.8;
    setState("WHEEE", { emotion: "happy", duration: 1400, message: "Vector acquired!" });
    chirp(680, 0.1, "triangle");
  }
}

habitat.addEventListener("pointermove", (event) => {
  lookAt(event);
  if (agent.state === "IDLE" || agent.state === "SLEEP_MODE") {
    setState("CURIOUS", { emotion: "curious", log: false });
  }
});

habitat.addEventListener("pointerleave", () => {
  pupils.forEach((pupil) => {
    pupil.style.setProperty("--look-x", "0px");
    pupil.style.setProperty("--look-y", "0px");
  });
});

habitat.addEventListener("click", (event) => {
  if (event.target.closest("#qubi, #bug")) return;
  const point = normalizedPoint(event);
  markInteraction();
  agent.curiosity = clamp(agent.curiosity + 2, 0, 100);
  moveTo(point.x, point.y);
  echoPointer(point);
  updateMeters();
});

qubi.addEventListener("pointerdown", beginDrag);
qubi.addEventListener("pointermove", (event) => {
  drag(event);
  if (agent.dragging) return;
  if (!lastPetPoint) lastPetPoint = { x: event.clientX, y: event.clientY };
  petDistance += Math.hypot(event.clientX - lastPetPoint.x, event.clientY - lastPetPoint.y);
  lastPetPoint = { x: event.clientX, y: event.clientY };
  if (petDistance > 120) {
    petDistance = 0;
    petQubi();
  }
});
qubi.addEventListener("pointerup", endDrag);
qubi.addEventListener("pointercancel", endDrag);
qubi.addEventListener("pointerenter", () => {
  lastPetPoint = null;
  setState("INSPECTING", { emotion: "curious", message: "Your pointer has been classified." });
});
qubi.addEventListener("pointerleave", () => {
  lastPetPoint = null;
  if (!agent.dragging) setState("CURIOUS", { emotion: "curious", log: false });
});
qubi.addEventListener("click", (event) => {
  event.stopPropagation();
  if (performance.now() < suppressClickUntil) return;
  pokeQubi();
});
qubi.addEventListener("dblclick", (event) => {
  event.preventDefault();
  event.stopPropagation();
  teleport();
});
qubi.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "t") teleport();
});

bug.addEventListener("click", (event) => {
  event.stopPropagation();
  markInteraction();
  catchBug(true);
});

controls.addEventListener("click", (event) => {
  const action = event.target.closest("button")?.dataset.action;
  if (!action) return;
  if (action === "pet") petQubi();
  if (action === "bug") spawnBug(false);
  if (action === "teleport") teleport();
  if (action === "reset") {
    localStorage.removeItem(MEMORY_KEY);
    Object.assign(agent, { curiosity: 82, trust: 24, energy: 76, patience: 84, boredom: 18, interactions: 0 });
    updateMeters();
    setState("MEMORY_RESET", { emotion: "curious", duration: 1800, message: "Have we met?" });
  }
});

soundToggle.addEventListener("click", () => {
  if (!AudioContextClass) {
    soundToggle.textContent = "SOUND::UNAVAILABLE";
    return;
  }
  agent.soundEnabled = !agent.soundEnabled;
  soundToggle.setAttribute("aria-pressed", String(agent.soundEnabled));
  soundToggle.textContent = `SOUND::${agent.soundEnabled ? "ON" : "OFF"}`;
  if (agent.soundEnabled) {
    audioContext ||= new AudioContextClass();
    chirp(520, 0.08, "sine");
  }
});

const routines = [
  () => {
    moveTo(0.25, 0.57, null);
    setState("WRITING_CODE", { emotion: "coding", message: "Turning caffeine into functions." });
  },
  () => {
    moveTo(0.5, 0.43, null);
    setState("ENTANGLING", { emotion: "superposition", message: "I am here. Also slightly over there." });
  },
  () => spawnBug(true),
  () => {
    moveTo(0.12 + Math.random() * 0.76, 0.28 + Math.random() * 0.42, null);
    setState("EXPLORING", { emotion: "curious", message: "Mapping unexplored probability space." });
  },
  () => {
    setState("GLITCHING", { emotion: "glitching", duration: 1200, message: "I meant to do th-th-that." });
    setTimeout(() => setState("SELF_REPAIR", { emotion: "recharging", duration: 1700, message: "Coherence restored." }), 1250);
  },
];

setInterval(() => {
  const idleFor = performance.now() - agent.lastInteractionAt;
  if (agent.dragging || performance.now() < agent.busyUntil) return;

  agent.energy = clamp(agent.energy - 0.45, 0, 100);
  agent.patience = clamp(agent.patience + 0.7, 0, 100);
  agent.boredom = clamp(agent.boredom + 0.8, 0, 100);

  if (agent.state === "RECHARGING") {
    agent.energy = clamp(agent.energy + 7, 0, 100);
    if (agent.energy > 78) setState("READY", { emotion: "happy", duration: 1400, message: "Battery contains acceptable optimism." });
  }

  if (idleFor > 6500 && agent.energy < 22) {
    moveTo(0.89, 0.61, null);
    setState("RECHARGING", { emotion: "recharging", message: "Docking. Wake me for interesting bugs." });
  } else if (idleFor > 7200 && agent.boredom > 86) {
    setState("SAD_AFTER_NEGLECT", { emotion: "sad", duration: 2600, message: "The pointer has forgotten me." });
    agent.boredom = 62;
  } else if (idleFor > 7600 && Math.random() > 0.44) {
    routines[Math.floor(Math.random() * routines.length)]();
  }

  updateMeters();
  saveMemory();
}, 3300);

function frame(now) {
  if (!agent.dragging) {
    if (Math.abs(agent.vx) + Math.abs(agent.vy) > 0.00015) {
      agent.x += agent.vx;
      agent.y += agent.vy;
      agent.vx *= 0.965;
      agent.vy *= 0.965;

      if (agent.x < 0.07 || agent.x > 0.93) {
        agent.x = clamp(agent.x, 0.07, 0.93);
        agent.vx *= -0.68;
        chirp(250, 0.04, "square");
      }
      if (agent.y < 0.18 || agent.y > 0.79) {
        agent.y = clamp(agent.y, 0.18, 0.79);
        agent.vy *= -0.68;
      }
      agent.targetX = agent.x;
      agent.targetY = agent.y;
    } else if (reducedMotion) {
      agent.x = agent.targetX;
      agent.y = agent.targetY;
    } else {
      agent.x += (agent.targetX - agent.x) * 0.032;
      agent.y += (agent.targetY - agent.y) * 0.032;
    }
  }

  qubi.style.setProperty("--x", `${agent.x * 100}%`);
  qubi.style.setProperty("--y", `${agent.y * 100}%`);
  qubi.classList.toggle("speech-left", agent.x > 0.76);

  if (now - agent.lastInteractionAt > 15000 && agent.state === "CURIOUS") {
    setState("SLEEP_MODE", { emotion: "sleeping", message: "zZ... compiling dreams..." });
  }

  requestAnimationFrame(frame);
}

updateMeters();
saveMemory();
requestAnimationFrame(frame);

setTimeout(() => {
  if (agent.visits > 1) {
    setState("RECOGNIZING_HUMAN", { emotion: "happy", duration: 2800, message: `You came back. Memory fragment #${agent.visits} restored.` });
  } else {
    setState("CURIOUS", { emotion: "curious", message: "Hello, human. Are you deterministic?" });
  }
}, 450);
