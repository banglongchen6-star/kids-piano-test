const NOTE_DATA = {
  C4: { midi: 60, color: "#ff5656", name: "红色", key: "A" },
  D4: { midi: 62, color: "#ffd84f", name: "黄色", key: "S" },
  E4: { midi: 64, color: "#58dc85", name: "绿色", key: "D" },
  F4: { midi: 65, color: "#55bfff", name: "蓝色", key: "F" },
  G4: { midi: 67, color: "#a775ff", name: "紫色", key: "G" },
  A4: { midi: 69, color: "#ff9a4e", name: "橙色", key: "H" },
  B4: { midi: 71, color: "#ff82bd", name: "粉色", key: "J" },
  C5: { midi: 72, color: "#ff6b68", name: "高音红色", key: "K" },
  D5: { midi: 74, color: "#ffe36a", name: "高音黄色", key: "L" }
};

const LEVELS = [
  { count: 8, interval: 3.1, pool: [["C4"]], desc: "红色小鸟 · 慢速练习" },
  { count: 10, interval: 2.9, pool: [["C4"],["D4"]], desc: "红色与黄色小鸟" },
  { count: 12, interval: 2.7, pool: [["C4"],["D4"],["E4"]], desc: "认识三个音高" },
  { count: 12, interval: 2.55, pool: [["C4"],["D4"],["E4"],["F4"]], desc: "加入蓝色小鸟" },
  { count: 14, interval: 2.4, pool: [["C4"],["D4"],["E4"],["F4"],["G4"]], desc: "五色小鸟森林" },
  { count: 14, interval: 2.25, pool: [["C4"],["D4"],["E4"],["F4"],["G4"],["A4"],["B4"]], desc: "七只音符小鸟" },
  { count: 10, interval: 3.0, pool: [["C4","E4"],["D4","F4"],["E4","G4"],["C4"],["G4"]], desc: "双音小鸟组合" },
  { count: 12, interval: 2.75, pool: [["C4","E4"],["D4","F4"],["E4","G4"],["F4","A4"],["G4","B4"]], desc: "双音一起回家" },
  { count: 9, interval: 3.3, pool: [["C4","E4","G4"],["F4","A4","C5"],["G4","B4","D5"],["C4","E4"]], desc: "三音和弦小队" },
  { count: 10, interval: 3.05, pool: [["C4","E4","G4"],["F4","A4","C5"],["G4","B4","D5"]], desc: "星光和弦大派对" }
];

const els = Object.fromEntries([
  "playfield","birdsLayer","judgeLine","stars","judgement","guideBubble","keyboard",
  "levelLabel","progressLabel","midiStatus","midiBtn","startScreen","completeScreen",
  "pickerLevel","pickerDesc","completeTitle","unlockText","startBtn","prevLevel",
  "nextLevel","replayBtn","continueBtn","settingsBtn","settings","closeSettings",
  "volume","speed"
].map(id => [id, document.getElementById(id)]));

const state = {
  level: 0,
  groups: [],
  running: false,
  startTime: 0,
  homeCount: 0,
  settledCount: 0,
  pressed: new Set(),
  midi: null,
  midiOutputs: [],
  litNotes: new Map(),
  raf: 0,
  audio: null,
  lastFrame: 0
};

const keyToNote = Object.fromEntries(Object.entries(NOTE_DATA).map(([note, d]) => [d.key.toLowerCase(), note]));
const midiToNote = Object.fromEntries(Object.entries(NOTE_DATA).map(([note, d]) => [d.midi, note]));

function buildKeyboard() {
  els.keyboard.innerHTML = "";
  Object.entries(NOTE_DATA).forEach(([note, data]) => {
    const key = document.createElement("button");
    key.className = "key";
    key.dataset.note = note;
    key.style.setProperty("--key", data.color);
    key.innerHTML = `<small>${data.key}</small>${note}`;
    key.addEventListener("pointerdown", e => {
      e.preventDefault();
      pressNote(note);
      key.classList.add("hit");
    });
    ["pointerup","pointerleave","pointercancel"].forEach(type => key.addEventListener(type, () => {
      releaseNote(note);
      key.classList.remove("hit");
    }));
    els.keyboard.appendChild(key);
  });
}

function updatePicker() {
  const level = LEVELS[state.level];
  els.pickerLevel.textContent = `第 ${state.level + 1} 关`;
  els.pickerDesc.textContent = level.desc;
}

function makeSchedule() {
  const config = LEVELS[state.level];
  const speed = Number(els.speed.value);
  const firstTarget = 3.1;
  state.groups = Array.from({ length: config.count }, (_, i) => {
    const notes = config.pool[(i * 3 + state.level * 2) % config.pool.length];
    return {
      id: `${Date.now()}-${i}`,
      notes: [...notes],
      target: firstTarget + i * config.interval / speed,
      spawn: firstTarget + i * config.interval / speed - 2.7,
      state: "waiting",
      judged: false,
      lightStarted: false,
      el: null,
      held: new Set(),
      holdStarted: 0
    };
  });
}

function startGame() {
  cancelAnimationFrame(state.raf);
  clearAllLights();
  els.birdsLayer.innerHTML = "";
  els.stars.innerHTML = "";
  state.homeCount = 0;
  state.settledCount = 0;
  state.pressed.clear();
  makeSchedule();
  state.startTime = performance.now();
  state.running = true;
  els.startScreen.classList.remove("show");
  els.completeScreen.classList.remove("show");
  els.levelLabel.textContent = `第 ${state.level + 1} 关`;
  updateProgress();
  setGuide("小鸟们出发啦，看看哪个琴键会亮！");
  initAudio();
  state.raf = requestAnimationFrame(loop);
}

function createBirdGroup(group) {
  const wrap = document.createElement("div");
  wrap.className = "bird-group";
  const spacing = Math.min(62, 150 / group.notes.length);
  group.notes.forEach((note, index) => {
    const bird = document.createElement("div");
    bird.className = "bird";
    bird.style.setProperty("--bird", NOTE_DATA[note].color);
    bird.style.left = `${(index - (group.notes.length - 1) / 2) * spacing}px`;
    bird.innerHTML = `<span class="note-name">${note}</span><span class="beak"></span><span class="sad">⌒</span>`;
    wrap.appendChild(bird);
  });
  els.birdsLayer.appendChild(wrap);
  group.el = wrap;
  group.state = "flying";
}

function loop(now) {
  if (!state.running) return;
  const elapsed = (now - state.startTime) / 1000;
  const fieldHeight = els.playfield.clientHeight;
  const judgeY = fieldHeight * .64;

  for (const group of state.groups) {
    if (group.state === "waiting" && elapsed >= group.spawn) createBirdGroup(group);
    if (group.state === "flying") {
      const progress = (elapsed - group.spawn) / (group.target - group.spawn);
      const y = -30 + progress * (judgeY + 30);
      const laneDrift = Math.sin(Number(group.id.split("-").pop()) * 1.7) * Math.min(innerWidth * .18, 180);
      group.el.style.transform = `translate(${laneDrift}px, ${y}px)`;

      const until = group.target - elapsed;
      if (until <= 2 && !group.lightStarted) {
        group.lightStarted = true;
        group.notes.forEach(note => setLight(note, .28));
        const names = group.notes.map(n => NOTE_DATA[n].name.replace("高音", "")).join("和");
        setGuide(group.notes.length > 1 ? `准备好，${group.notes.length}只小鸟要一起回家！` : `${names}小鸟来啦，按${names}亮灯键！`);
      }
      if (group.lightStarted && until > -.51) {
        const power = Math.max(.25, Math.min(1, 1 - until / 2));
        group.notes.forEach(note => setLight(note, power));
      }
      if (elapsed > group.target + .5) judge(group, "miss");
    } else if (group.state === "perfect" || group.state === "good") {
      const t = (now - group.animStart) / 1000;
      const x = group.animX * (1 - Math.min(1, t / .7));
      const y = judgeY + Math.min(1, t / .7) * fieldHeight * .18;
      group.el.style.transform = `translate(${x}px, ${y}px) scale(${1 - t * .55})`;
      group.el.style.opacity = String(Math.max(0, 1 - t / .72));
      if (t > .75) finishGroup(group);
    } else if (group.state === "miss") {
      const t = Math.max(0, (now - group.animStart - 100) / 1000);
      const x = group.animX + t * innerWidth * .58;
      const y = judgeY - t * fieldHeight * .75;
      group.el.style.transform = `translate(${x}px, ${y}px) rotate(${t * 22}deg)`;
      group.el.style.opacity = String(Math.max(0, .55 - t / 1.15));
      if (t > .8) finishGroup(group);
    }
  }

  state.raf = requestAnimationFrame(loop);
}

function getCurrentTarget() {
  return state.groups
    .filter(g => !g.judged && (g.state === "flying" || g.state === "waiting"))
    .sort((a, b) => a.target - b.target)[0] || null;
}

function pressNote(note) {
  const key = getKey(note);
  key?.classList.add("hit");
  if (!state.running || state.pressed.has(note)) return;
  state.pressed.add(note);
  playPiano(note);
  const target = getCurrentTarget();
  if (!target) return;

  const elapsed = (performance.now() - state.startTime) / 1000;
  const diff = Math.abs(elapsed - target.target);
  if (target.state === "waiting") createBirdGroup(target);
  if (diff > .5 || !target.notes.includes(note)) {
    judge(target, "miss");
    return;
  }

  if (target.notes.length === 1) {
    judge(target, diff <= .15 ? "perfect" : "good");
    return;
  }

  if (!target.holdStarted) target.holdStarted = performance.now();
  target.held.add(note);
  const allHeld = target.notes.every(n => state.pressed.has(n));
  if (allHeld) {
    const chordSpread = performance.now() - target.holdStarted;
    if (chordSpread > 180) judge(target, "miss");
    else judge(target, diff <= .15 && chordSpread <= 150 ? "perfect" : "good");
  }
}

function pressUnknownNote() {
  if (!state.running) return;
  const target = getCurrentTarget();
  if (!target) return;
  if (target.state === "waiting") createBirdGroup(target);
  judge(target, "miss");
}

function releaseNote(note) {
  state.pressed.delete(note);
  getKey(note)?.classList.remove("hit");
}

function judge(group, result) {
  if (!group || group.judged) return;
  group.judged = true;
  group.state = result;
  group.animStart = performance.now();
  group.animX = extractX(group.el?.style.transform);
  clearGroupLights(group);
  group.held.clear();
  state.settledCount++;

  if (group.el) {
    group.el.classList.add(result);
    if (result !== "miss") {
      const ring = document.createElement("div");
      ring.className = "ring";
      group.el.appendChild(ring);
    }
  }

  if (result === "perfect") {
    state.homeCount += group.notes.length;
    addStars(group.notes.length);
    showJudgement("Perfect", "perfect");
    setGuide("太棒了，小鸟开心回家啦！");
    playReward(true);
    group.notes.forEach(note => flashKey(note, "rainbow"));
  } else if (result === "good") {
    state.homeCount += group.notes.length;
    addStars(group.notes.length);
    showJudgement("Good", "good");
    setGuide("接到啦！小鸟安全回家！");
    playReward(false);
    group.notes.forEach(note => flashKey(note, "white-flash"));
  } else {
    showJudgement("没关系，再来一次", "miss");
    setGuide("没关系，我们轻轻再试一次！");
    playSoftMiss();
  }
  updateProgress();
}

function finishGroup(group) {
  if (group.state === "finished") return;
  group.state = "finished";
  group.el?.remove();
  group.el = null;
  if (state.groups.every(g => g.state === "finished")) finishLevel();
}

function finishLevel() {
  state.running = false;
  clearAllLights();
  cancelAnimationFrame(state.raf);
  els.completeTitle.textContent = `今天有 ${state.homeCount} 只小鸟回家啦！`;
  els.unlockText.textContent = state.level % 2 ? "你解锁了新的键盘灯效！" : "你解锁了新的小鸟皮肤！";
  els.continueBtn.textContent = state.level === LEVELS.length - 1 ? "回到第 1 关" : "下一关";
  setTimeout(() => els.completeScreen.classList.add("show"), 350);
}

function updateProgress() {
  els.progressLabel.textContent = `${state.settledCount} / ${LEVELS[state.level].count}`;
}

function setLight(note, power) {
  const key = getKey(note);
  if (!key) return;
  const velocity = Math.round(25 + power * 102);
  const previous = state.litNotes.get(note);
  state.litNotes.set(note, velocity);
  key.classList.add("lit");
  key.style.setProperty("--power", power.toFixed(2));
  key.style.setProperty("--pulse", `${Math.max(.16, 1.05 - power * .82)}s`);
  if (previous == null || Math.abs(previous - velocity) >= 4) sendMidiLight(note, velocity);
}

function clearGroupLights(group) {
  group.notes.forEach(note => clearLight(note));
}

function clearLight(note) {
  state.litNotes.delete(note);
  const key = getKey(note);
  key?.classList.remove("lit");
  key?.style.removeProperty("--power");
  sendMidiLight(note, 0);
}

function clearAllLights() {
  Object.keys(NOTE_DATA).forEach(clearLight);
  state.litNotes.clear();
}

function sendMidiLight(note, velocity) {
  const data = NOTE_DATA[note];
  if (!data) return;
  state.midiOutputs.forEach(output => {
    try { output.send([velocity ? 0x90 : 0x80, data.midi, velocity]); } catch (_) {}
  });
}

async function connectMidi() {
  if (!navigator.requestMIDIAccess) {
    els.midiStatus.textContent = "当前浏览器不支持 Web MIDI，可用 A–L 试玩";
    return;
  }
  try {
    state.midi = await navigator.requestMIDIAccess({ sysex: false });
    attachMidiDevices();
    state.midi.onstatechange = attachMidiDevices;
  } catch (_) {
    els.midiStatus.textContent = "未获得 MIDI 权限，可继续用电脑键盘试玩";
  }
}

function attachMidiDevices() {
  const inputs = [...state.midi.inputs.values()];
  state.midiOutputs = [...state.midi.outputs.values()];
  inputs.forEach(input => {
    input.onmidimessage = ({ data }) => {
      const [status, midi, velocity] = data;
      const note = midiToNote[midi];
      if ((status & 0xf0) === 0x90 && velocity > 0 && !note) pressUnknownNote();
      if ((status & 0xf0) === 0x90 && velocity > 0 && note) pressNote(note);
      if ((status & 0xf0) === 0x80 || ((status & 0xf0) === 0x90 && velocity === 0)) releaseNote(note);
    };
  });
  const name = inputs[0]?.name || state.midiOutputs[0]?.name;
  els.midiStatus.textContent = name ? `已连接：${name}` : "等待 PartyKeys 36 接入…";
  els.midiBtn.textContent = name ? "MIDI 已连接" : "重新检测 MIDI";
}

function getKey(note) { return els.keyboard.querySelector(`[data-note="${note}"]`); }
function extractX(transform = "") { return Number(transform.match(/translate\(([-.\d]+)px/)?.[1] || 0); }

function flashKey(note, className) {
  const key = getKey(note);
  if (!key) return;
  key.classList.remove(className);
  void key.offsetWidth;
  key.classList.add(className);
  setTimeout(() => key.classList.remove(className), 500);
}

function addStars(count) {
  for (let i = 0; i < count; i++) {
    const star = document.createElement("span");
    star.className = "star";
    star.textContent = "★";
    els.stars.appendChild(star);
  }
}

function showJudgement(text, type) {
  els.judgement.className = `judgement ${type}`;
  els.judgement.textContent = text;
  void els.judgement.offsetWidth;
  els.judgement.classList.add("pop");
}

function setGuide(text) {
  els.guideBubble.style.opacity = "0";
  setTimeout(() => {
    els.guideBubble.textContent = text;
    els.guideBubble.style.opacity = "1";
  }, 120);
}

function initAudio() {
  state.audio ||= new (window.AudioContext || window.webkitAudioContext)();
  if (state.audio.state === "suspended") state.audio.resume();
}

function tone(freq, start, duration, volume, type = "sine") {
  if (!state.audio || Number(els.volume.value) === 0) return;
  const osc = state.audio.createOscillator();
  const gain = state.audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(volume * Number(els.volume.value), start);
  gain.gain.exponentialRampToValueAtTime(.001, start + duration);
  osc.connect(gain).connect(state.audio.destination);
  osc.start(start); osc.stop(start + duration);
}

function playPiano(note) {
  initAudio();
  const freq = 440 * Math.pow(2, (NOTE_DATA[note].midi - 69) / 12);
  tone(freq, state.audio.currentTime, .45, .2, "triangle");
}

function playReward(perfect) {
  const t = state.audio.currentTime;
  if (perfect) {
    tone(880, t, .18, .22);
    tone(1318.5, t + .09, .35, .18);
  } else {
    tone(659.3, t, .25, .16);
    tone(987.8, t + .1, .35, .13);
  }
}

function playSoftMiss() {
  const t = state.audio.currentTime;
  tone(440, t, .3, .08, "sine");
  tone(392, t + .12, .4, .06, "sine");
}

document.addEventListener("keydown", e => {
  if (e.repeat || !keyToNote[e.key.toLowerCase()]) return;
  e.preventDefault();
  pressNote(keyToNote[e.key.toLowerCase()]);
});
document.addEventListener("keyup", e => {
  const note = keyToNote[e.key.toLowerCase()];
  if (note) releaseNote(note);
});
window.addEventListener("blur", () => {
  state.pressed.forEach(releaseNote);
  state.pressed.clear();
});

els.startBtn.addEventListener("click", startGame);
els.replayBtn.addEventListener("click", startGame);
els.continueBtn.addEventListener("click", () => {
  state.level = (state.level + 1) % LEVELS.length;
  updatePicker();
  startGame();
});
els.prevLevel.addEventListener("click", () => {
  state.level = (state.level + LEVELS.length - 1) % LEVELS.length;
  updatePicker();
});
els.nextLevel.addEventListener("click", () => {
  state.level = (state.level + 1) % LEVELS.length;
  updatePicker();
});
els.midiBtn.addEventListener("click", connectMidi);
els.settingsBtn.addEventListener("click", () => els.settings.showModal());
els.closeSettings.addEventListener("click", () => els.settings.close());

buildKeyboard();
updatePicker();
connectMidi();
