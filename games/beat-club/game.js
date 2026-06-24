const BPM = 112;
const BEAT_MS = 60000 / BPM;
const PERFECT_WINDOW = 90;
const GOOD_WINDOW = 190;
const PARTYKEYS_MIN_NOTE = 48;
const PARTYKEYS_MAX_NOTE = 83;
const PARTYKEYS_HEADER = [0xF0, 0x05, 0x30, 0x7F, 0x7F, 0x20, 0x00];

const CHORDS = [
  { name: "C", notes: [48, 52, 55], key: "a", rgb: [255, 222, 45] },
  { name: "Dm", notes: [50, 53, 57], key: "s", rgb: [255, 100, 150] },
  { name: "Em", notes: [52, 55, 59], key: "d", rgb: [75, 205, 255] },
  { name: "F", notes: [53, 57, 60], key: "f", rgb: [65, 235, 120] },
  { name: "G", notes: [55, 59, 62], key: "g", rgb: [110, 125, 255] },
  { name: "Am", notes: [57, 60, 64], key: "h", rgb: [255, 135, 45] }
];

const LEVELS = [
  ["校长的假发危机", "01-principal-toupee.png"],
  ["复印机打喷嚏", "02-sneezing-copier.png"],
  ["牛油果合唱团", "03-avocado-choir.png"],
  ["企鹅果冻服务生", "04-penguin-jelly-waiter.png"],
  ["外星海关盖章", "05-alien-customs.png"],
  ["牙刷交响团", "06-toothbrush-orchestra.png"],
  ["电梯眼神大赛", "07-elevator-eye-contact.png"],
  ["猫咪揉面夜班", "08-cat-bakery.png"],
  ["长颈鹿理发师", "09-giraffe-barber.png"],
  ["打嗝自动售货机", "10-hiccup-vending-machine.png"],
  ["蜗牛快递冲刺", "11-snail-express.png"],
  ["袜子越狱", "12-sock-escape.png"],
  ["办公椅花样赛", "13-synchronized-office-chairs.png"],
  ["河马珍珠质检员", "14-hippo-bubble-tea.png"],
  ["月亮清洁工", "15-moon-janitor.png"],
  ["鸽子交通指挥", "16-pigeon-traffic-officer.png"],
  ["仙人掌美发屋", "17-cactus-salon.png"],
  ["午夜冰箱合唱团", "18-midnight-fridge-choir.png"],
  ["雨伞开花候车队", "19-umbrella-bloom.png"],
  ["面条长度检查", "20-noodle-inspector.png"]
].map(([title, file]) => ({ title, image: `./assets/scenes/${file}` }));

const el = Object.fromEntries([
  "connectScreen", "readyScreen", "gameScreen", "resultScreen", "connectMessage",
  "deviceStep", "lightStep", "successStep", "connectButton", "gameStartButton",
  "levelNumber", "score", "combo", "levelIntro", "levelTitle", "chordName",
  "countdown", "sceneViewport", "sceneImage", "beatPip", "judgement",
  "phaseLabel", "targetChord", "keyboard", "resultTitle", "finalScore",
  "resultComment", "resultStats", "retryButton"
].map(id => [id, document.getElementById(id)]));

let audio;
let noiseBuffer;
let musicTimer;
let nextMusicAt = 0;
let musicStep = 0;
let midiAccess;
let midiInputs = [];
let midiOutputs = [];
let verified = false;
let running = false;
let timers = [];
let levelIndex = 0;
let currentChord = CHORDS[0];
let lastChordIndex = -1;
let heldNotes = new Set();
let expectedAt = 0;
let accepting = false;
let beatResolved = false;
let score = 0;
let combo = 0;
let stats = { perfect: 0, good: 0, miss: 0 };

function buildKeyboard() {
  for (let midi = PARTYKEYS_MIN_NOTE; midi <= PARTYKEYS_MAX_NOTE; midi++) {
    const key = document.createElement("i");
    key.className = `key ${[1, 3, 6, 8, 10].includes(midi % 12) ? "black" : "white"}`;
    key.dataset.note = midi;
    el.keyboard.appendChild(key);
  }
}

function showScreen(screen) {
  [el.connectScreen, el.readyScreen, el.gameScreen, el.resultScreen]
    .forEach(item => item.classList.toggle("hidden", item !== screen));
}

function setStep(step, state) {
  step.className = `check-row ${state || ""}`.trim();
}

function wait(ms) {
  return new Promise(resolve => {
    const id = setTimeout(resolve, ms);
    timers.push(id);
  });
}

function schedule(fn, time) {
  const id = setTimeout(fn, Math.max(0, time - performance.now()));
  timers.push(id);
}

function clearSchedules() {
  timers.forEach(clearTimeout);
  timers = [];
}

function initAudio() {
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === "suspended") audio.resume();
  if (!noiseBuffer) {
    noiseBuffer = audio.createBuffer(1, audio.sampleRate * .15, audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
}

function synth(midi, at, duration = .1, type = "square", volume = .025) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(.001, at + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(at);
  osc.stop(at + duration);
}

function drum(kind, at) {
  if (kind === "kick") {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.setValueAtTime(145, at);
    osc.frequency.exponentialRampToValueAtTime(48, at + .12);
    gain.gain.setValueAtTime(.14, at);
    gain.gain.exponentialRampToValueAtTime(.001, at + .14);
    osc.connect(gain).connect(audio.destination);
    osc.start(at);
    osc.stop(at + .15);
    return;
  }
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  source.buffer = noiseBuffer;
  filter.type = "highpass";
  filter.frequency.value = kind === "snare" ? 850 : 5200;
  gain.gain.setValueAtTime(kind === "snare" ? .075 : .025, at);
  gain.gain.exponentialRampToValueAtTime(.001, at + (kind === "snare" ? .1 : .035));
  source.connect(filter).connect(gain).connect(audio.destination);
  source.start(at);
  source.stop(at + .12);
}

function scheduleMusicStep(step, at) {
  const s = step % 32;
  if (s % 4 === 0) drum("kick", at);
  if (s % 8 === 4) drum("snare", at);
  if (s % 2 === 0) drum("hat", at);
  const bass = [36, 36, 43, 36, 41, 41, 43, 43];
  if (s % 4 === 0) synth(bass[Math.floor(s / 4)], at, .18, "square", .035);
  const melody = [72, 76, 79, 76, 74, 77, 81, 77];
  if (s % 4 === 2) {
    const note = melody[Math.floor(s / 4)];
    synth(note, at, .08, "square", .02);
    if (s === 14 || s === 30) synth(note + 7, at + .07, .08, "triangle", .018);
  }
}

function startMusic() {
  stopMusic();
  initAudio();
  musicStep = 0;
  const delay = .12;
  nextMusicAt = audio.currentTime + delay;
  const visualAnchor = performance.now() + delay * 1000;
  const sixteenth = BEAT_MS / 4000;
  musicTimer = setInterval(() => {
    while (nextMusicAt < audio.currentTime + .13) {
      scheduleMusicStep(musicStep++, nextMusicAt);
      nextMusicAt += sixteenth;
    }
  }, 25);
  return visualAnchor;
}

function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}

function encodeColor(value) {
  return [Math.floor(value / 128), value % 128];
}

function enterLedMode() {
  // PartyKeys 36 无需进入 LED 模式；调色板由 PP29.setOuts 自动上传
}

function setHardwareLeds(groups) {
  if (!groups || !groups.length) { PP29.allOff(); return; }
  const lamps = [];
  groups.forEach(group => group.notes.forEach(note => lamps.push(note - PARTYKEYS_MIN_NOTE)));
  PP29.lightRGB(lamps, groups[0].rgb);    // 用和弦颜色点亮对应 lamp
}

function lightsOff() {
  document.querySelectorAll(".key").forEach(key =>
    key.classList.remove("lit", "test-lit")
  );
  PP29.allOff();
}

function lightChord(chord) {
  lightsOff();
  chord.notes.forEach(note =>
    document.querySelector(`.key[data-note="${note}"]`)?.classList.add("lit")
  );
  setHardwareLeds([{ notes: chord.notes, rgb: chord.rgb }]);
}

function refreshMidi() {
  const allInputs = [...midiAccess.inputs.values()];
  const allOutputs = [...midiAccess.outputs.values()];
  midiInputs = allInputs.filter(input => /partykey/i.test(input.name || ""));
  midiOutputs = allOutputs.filter(output => /partykey/i.test(output.name || ""));
  if (!midiInputs.length && allInputs.length === 1) midiInputs = allInputs;
  if (!midiOutputs.length && allOutputs.length === 1) midiOutputs = allOutputs;
  PP29.setOuts(midiOutputs);              // 接入 PartyKeys 36 控灯
  midiInputs.forEach(input => input.onmidimessage = handleMidi);
  if (midiInputs.length && midiOutputs.length) enterLedMode();
  return midiInputs.length > 0 && midiOutputs.length > 0;
}

async function connectKeyboard() {
  if (!navigator.requestMIDIAccess) {
    el.connectMessage.textContent = "这个浏览器不会说 MIDI 语言。请使用最新版 Chrome 或 Edge。";
    return;
  }
  el.connectButton.disabled = true;
  el.connectMessage.textContent = "正在呼叫 PartyKeys……";
  try {
    midiAccess = midiAccess || await navigator.requestMIDIAccess({ sysex: true });
    midiAccess.onstatechange = refreshMidi;
    if (!refreshMidi()) {
      el.connectMessage.textContent = "还没找到同时支持输入和灯光的键盘，请检查 USB 连接后重试。";
      el.connectButton.disabled = false;
      return;
    }
    setStep(el.deviceStep, "done");
    setStep(el.lightStep, "active");
    el.connectMessage.textContent = "看键盘！36个按键现在应该全部变绿。";
    document.querySelectorAll(".key").forEach(key => key.classList.add("test-lit"));
    setHardwareLeds([{
      notes: Array.from({ length: 36 }, (_, i) => i + PARTYKEYS_MIN_NOTE),
      rgb: [0, 255, 70]
    }]);
    await wait(1000);
    lightsOff();
    setStep(el.lightStep, "done");
    setStep(el.successStep, "done");
    el.connectMessage.textContent = "连接成功！绿灯已经熄灭。";
    verified = true;
    await wait(450);
    showScreen(el.readyScreen);
  } catch {
    el.connectMessage.textContent = "MIDI 权限没有打开。请在浏览器地址栏重新允许 MIDI 和 SysEx。";
    el.connectButton.disabled = false;
  }
}

function chooseChord() {
  let index;
  do index = Math.floor(Math.random() * CHORDS.length);
  while (index === lastChordIndex);
  lastChordIndex = index;
  return CHORDS[index];
}

function updateHud() {
  el.score.textContent = score;
  el.combo.textContent = combo;
  el.levelNumber.textContent = `${Math.min(levelIndex + 1, LEVELS.length)}/${LEVELS.length}`;
}

function animateCountdown(text) {
  el.countdown.textContent = text;
  el.countdown.style.animation = "none";
  void el.countdown.offsetWidth;
  el.countdown.style.animation = "";
}

function preloadScenes() {
  LEVELS.forEach(level => {
    const image = new Image();
    image.src = level.image;
  });
}

async function startGame() {
  if (!verified || running) return;
  clearSchedules();
  running = true;
  levelIndex = 0;
  score = 0;
  combo = 0;
  stats = { perfect: 0, good: 0, miss: 0 };
  showScreen(el.gameScreen);
  updateHud();
  const firstBeatAt = startMusic();
  runLevel(firstBeatAt);
}

function runLevel(introAt) {
  if (!running) return;
  if (levelIndex >= LEVELS.length) {
    schedule(finishGame, introAt);
    return;
  }

  const level = LEVELS[levelIndex];
  currentChord = chooseChord();
  el.levelTitle.textContent = level.title;
  el.chordName.textContent = currentChord.name;
  el.targetChord.textContent = currentChord.name;
  el.levelIntro.classList.remove("hidden");
  el.sceneViewport.classList.add("hidden");
  el.phaseLabel.textContent = "四拍记忆时间";
  el.sceneImage.style.backgroundImage = `url("${level.image}")`;
  el.sceneImage.classList.remove("frame-b");
  lightChord(currentChord);
  updateHud();

  ["记住", "3", "2", "1"].forEach((text, beat) => {
    schedule(() => animateCountdown(text), introAt + beat * BEAT_MS);
  });

  const playAt = introAt + 4 * BEAT_MS;
  schedule(() => {
    lightsOff();
    el.levelIntro.classList.add("hidden");
    el.sceneViewport.classList.remove("hidden");
    el.phaseLabel.textContent = "照着画面 · 每拍弹奏";
  }, playAt);

  for (let beat = 0; beat < 4; beat++) {
    const beatAt = playAt + beat * BEAT_MS;
    schedule(() => beginBeat(beat, beatAt), beatAt - GOOD_WINDOW);
    schedule(() => showBeatFrame(beat), beatAt);
    schedule(() => {
      if (!beatResolved) resolveBeat("miss");
    }, beatAt + GOOD_WINDOW);
  }

  const nextAt = playAt + 4 * BEAT_MS;
  schedule(() => {
    accepting = false;
    levelIndex++;
    runLevel(nextAt);
  }, nextAt);
}

function beginBeat(beat, beatAt) {
  expectedAt = beatAt;
  accepting = true;
  beatResolved = false;
  el.beatPip.textContent = beat + 1;
}

function showBeatFrame(beat) {
  el.sceneImage.classList.toggle("frame-b", beat % 2 === 1);
  el.sceneImage.classList.remove("beat-pop");
  void el.sceneImage.offsetWidth;
  el.sceneImage.classList.add("beat-pop");
}

function tryChord(notes, simulatedChord = null) {
  if (!running || !accepting || beatResolved) return;
  if (!simulatedChord && notes.size < currentChord.notes.length) return;
  const correct = simulatedChord
    ? simulatedChord.name === currentChord.name
    : currentChord.notes.every(note => notes.has(note));
  if (!correct) {
    resolveBeat("miss");
    return;
  }
  const delta = Math.abs(performance.now() - expectedAt);
  resolveBeat(delta <= PERFECT_WINDOW ? "perfect" : delta <= GOOD_WINDOW ? "good" : "miss");
}

function resolveBeat(verdict) {
  if (beatResolved) return;
  beatResolved = true;
  accepting = false;
  if (verdict === "perfect") {
    score += 1000 + combo * 20;
    combo++;
    stats.perfect++;
  } else if (verdict === "good") {
    score += 600 + combo * 10;
    combo++;
    stats.good++;
  } else {
    combo = 0;
    stats.miss++;
  }
  updateHud();
  showJudgement(verdict);
}

function showJudgement(verdict) {
  el.judgement.className = `judgement ${verdict}`;
  el.judgement.textContent = verdict.toUpperCase();
  void el.judgement.offsetWidth;
  el.judgement.classList.add("show");
}

function finishGame() {
  running = false;
  accepting = false;
  stopMusic();
  lightsOff();
  const total = LEVELS.length * 4;
  const rating = Math.round(((stats.perfect + stats.good * .65) / total) * 100);
  el.finalScore.textContent = rating;
  el.resultTitle.textContent = rating >= 85
    ? "荒唐得很有节奏！"
    : rating >= 60 ? "笑着笑着就跟上了！" : "再荒唐一遍吧！";
  el.resultComment.textContent = `最终得分 ${score}。每关四拍，共完成 ${total} 次和弦动作。`;
  el.resultStats.innerHTML = `
    <span>PERFECT ${stats.perfect}</span>
    <span>GOOD ${stats.good}</span>
    <span>MISS ${stats.miss}</span>
  `;
  showScreen(el.resultScreen);
}

function handleMidi(event) {
  const [status, note, velocity] = event.data;
  const command = status & 0xF0;
  const key = document.querySelector(`.key[data-note="${note}"]`);
  if (command === 0x90 && velocity > 0) {
    heldNotes.add(note);
    key?.classList.add("pressed");
    tryChord(heldNotes);
  } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
    heldNotes.delete(note);
    key?.classList.remove("pressed");
  }
}

window.addEventListener("keydown", event => {
  if (event.repeat) return;
  const chord = CHORDS.find(item => item.key === event.key.toLowerCase());
  if (!chord) return;
  chord.notes.forEach(note =>
    document.querySelector(`.key[data-note="${note}"]`)?.classList.add("pressed")
  );
  tryChord(new Set(chord.notes), chord);
});

window.addEventListener("keyup", event => {
  const chord = CHORDS.find(item => item.key === event.key.toLowerCase());
  chord?.notes.forEach(note =>
    document.querySelector(`.key[data-note="${note}"]`)?.classList.remove("pressed")
  );
});

el.connectButton.addEventListener("click", connectKeyboard);
el.gameStartButton.addEventListener("click", startGame);
el.retryButton.addEventListener("click", () => {
  showScreen(el.readyScreen);
});
window.addEventListener("beforeunload", lightsOff);

buildKeyboard();
preloadScenes();
showScreen(el.connectScreen);
