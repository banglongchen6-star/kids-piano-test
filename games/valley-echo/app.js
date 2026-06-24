(() => {
  "use strict";

  const PAD_COLORS = ["#ef7180", "#f5a13d", "#f1ce47", "#8bc84e", "#42badb", "#7779d8"];
  const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const KEY_MAP = ["z", "s", "x", "d", "c", "v", "g", "b", "h", "n", "j", "m", "q", "2", "w", "3", "e", "r", "5", "t", "6", "y", "7", "u"];
  const WHITE_KEY_COLORS = ["#f6bec8", "#f7cfa7", "#f8e7a3", "#d8eba7", "#bde7cb", "#b4e4e4", "#b8dff0", "#b8d7f5", "#c3cdf4", "#d8c6f1", "#e4c7ef", "#efd0ea", "#e3c7ee", "#c9bce9"];
  const SAMPLE_PATTERNS = [
    [0, 2, 4], [2, 3, 2], [5, 4, 1], [0, 0, 4], [3, 5, 2],
    [1, 4, 5], [5, 2, 0], [4, 1, 3]
  ];
  const PIANO_PATTERNS = [
    [0, 2, 4, 7, 4, 2], [7, 9, 11, 12, 11, 9, 7], [4, 5, 7, 9, 7, 5],
    [12, 11, 9, 7, 9, 11, 12], [0, 4, 7, 12, 7, 4], [5, 7, 9, 10, 9, 7, 5],
    [9, 7, 5, 4, 2, 4, 5], [12, 14, 16, 19, 16, 14]
  ];

  const state = {
    mode: "kids",
    audio: null,
    master: null,
    question: 0,
    score: 0,
    results: [],
    correct: [],
    options: [],
    correctTrack: 0,
    input: [],
    inputTimes: [],
    isPlaying: false,
    acceptingInput: false,
    midi: null,
    midiOutput: null,
    heldKeys: new Set(),
    timers: new Set()
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const els = {
    scene: $("#scene"), cave: $("#caveButton"), playLabel: $("#playLabel"),
    floatingNotes: $("#floatingNotes"), tracks: $("#tracks"), speech: $("#speechBubble"),
    pads: $$(".pad"), padsPanel: $("#padsPanel"), pianoPanel: $("#pianoPanel"), piano: $("#piano"),
    score: $("#score"), dots: $("#progressDots"), submit: $("#submitBtn"), replay: $("#replayBtn"),
    instruction: $("#instruction"), keyboardTip: $("#keyboardTip"), midi: $("#midiBtn"),
    particles: $("#particles"), mascots: $$(".mascot"), welcome: $("#welcome"), start: $("#startBtn")
  };

  function later(fn, ms) {
    const id = setTimeout(() => { state.timers.delete(id); fn(); }, ms);
    state.timers.add(id);
    return id;
  }

  function clearTimers() {
    state.timers.forEach(clearTimeout);
    state.timers.clear();
  }

  function initAudio() {
    if (state.audio) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    state.audio = new AudioContext();
    state.master = state.audio.createGain();
    state.master.gain.value = 0.36;
    state.master.connect(state.audio.destination);
  }

  function tone(frequency, duration = .35, type = "sine", volume = .26, when = 0) {
    initAudio();
    const now = state.audio.currentTime + when;
    const osc = state.audio.createOscillator();
    const gain = state.audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + .018);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    osc.connect(gain).connect(state.master);
    osc.start(now);
    osc.stop(now + duration + .03);
    return { osc, gain };
  }

  function noise(duration = .35, volume = .08, when = 0, cutoff = 1400) {
    initAudio();
    const length = state.audio.sampleRate * duration;
    const buffer = state.audio.createBuffer(1, length, state.audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = state.audio.createBufferSource();
    const filter = state.audio.createBiquadFilter();
    const gain = state.audio.createGain();
    const now = state.audio.currentTime + when;
    src.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + .03);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    src.connect(filter).connect(gain).connect(state.master);
    src.start(now);
  }

  function playPadSound(index, when = 0) {
    const sounds = [
      () => {
        const a = tone(1050, .18, "sine", .18, when);
        a.osc.frequency.exponentialRampToValueAtTime(1700, state.audio.currentTime + when + .08);
        tone(1340, .14, "sine", .12, when + .13);
      },
      () => { noise(.52, .07, when, 850); tone(240, .5, "sine", .04, when); },
      () => { tone(1320, .65, "sine", .13, when); tone(1980, .75, "sine", .07, when + .04); },
      () => { tone(180, .16, "square", .09, when); tone(145, .2, "square", .08, when + .15); },
      () => { tone(820, .14, "sine", .1, when); tone(620, .23, "sine", .07, when + .08); },
      () => { tone(740, .75, "sine", .16, when); tone(1110, .65, "sine", .08, when); }
    ];
    sounds[index]();
  }

  function midiToFrequency(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  function playPiano(index, duration = .42, when = 0) {
    const midi = 60 + index;
    const f = midiToFrequency(midi);
    tone(f, duration, "triangle", .2, when);
    tone(f * 2, duration * .8, "sine", .045, when);
  }

  function buildPiano() {
    const whiteSemitones = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23];
    whiteSemitones.forEach((noteIndex, whiteIndex) => {
      const key = document.createElement("button");
      key.className = "white-key";
      key.dataset.note = noteIndex;
      key.style.setProperty("--key-color", WHITE_KEY_COLORS[whiteIndex]);
      const octave = noteIndex < 12 ? 4 : 5;
      key.innerHTML = `<span class="key-label">${NOTE_NAMES[noteIndex % 12]}${octave}<br>${KEY_MAP[noteIndex].toUpperCase()}</span>`;
      els.piano.appendChild(key);
    });

    const blackSemitones = [1, 3, 6, 8, 10, 13, 15, 18, 20, 22];
    blackSemitones.forEach((noteIndex) => {
      const previousWhites = whiteSemitones.filter(n => n < noteIndex).length;
      const key = document.createElement("button");
      key.className = "black-key";
      key.dataset.note = noteIndex;
      key.style.setProperty("--left", `${previousWhites / 14 * 100}%`);
      key.innerHTML = `<span class="key-label">${KEY_MAP[noteIndex].toUpperCase()}</span>`;
      els.piano.appendChild(key);
    });
  }

  function buildProgress() {
    els.dots.innerHTML = "";
    for (let i = 0; i < 5; i++) {
      const dot = document.createElement("span");
      dot.className = `progress-dot ${state.results[i] || ""}`;
      els.dots.appendChild(dot);
    }
    els.score.textContent = state.score;
  }

  function randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  function mutatePattern(pattern, range) {
    const result = [...pattern];
    const edits = Math.random() > .5 ? 1 : 2;
    for (let i = 0; i < edits; i++) {
      const pos = Math.floor(Math.random() * result.length);
      const delta = randomChoice([-3, -2, -1, 1, 2, 3]);
      result[pos] = (result[pos] + delta + range) % range;
    }
    return result;
  }

  function makeQuestion() {
    clearTimers();
    clearAllLights();
    state.input = [];
    state.inputTimes = [];
    state.acceptingInput = false;
    state.isPlaying = false;
    els.submit.disabled = true;
    $$(".track").forEach(t => t.classList.remove("correct", "wrong"));
    $$(".player-stream, .answer-stream").forEach(el => el.innerHTML = "");

    const library = state.mode === "kids" ? SAMPLE_PATTERNS : PIANO_PATTERNS;
    const range = state.mode === "kids" ? 6 : 24;
    state.correct = [...randomChoice(library)];
    if (state.mode === "kids" && Math.random() > .5) state.correct = state.correct.slice(0, 2);
    state.correctTrack = Math.floor(Math.random() * 3);
    state.options = [mutatePattern(state.correct, range), mutatePattern(state.correct, range), mutatePattern(state.correct, range)];
    state.options[state.correctTrack] = [...state.correct];
    renderOptions();
    showSpeech("山洞准备好啦，点它听回声！");
    els.instruction.textContent = state.mode === "kids"
      ? "听 2–3 个山谷音效，再按彩色打击垫复刻顺序。"
      : "听星光钢琴旋律，再用两个八度的键盘弹回来。";
  }

  function renderOptions() {
    $$(".track").forEach((track, trackIndex) => {
      const stream = track.querySelector(".answer-stream");
      const option = state.options[trackIndex];
      option.forEach((note, i) => {
        const el = document.createElement("span");
        el.className = "stream-note entering";
        el.style.setProperty("--x", `${state.mode === "kids" ? 22 + note * 11 : 16 + (note % 7) * 11}%`);
        el.style.setProperty("--bottom", `${17 + i * (66 / Math.max(option.length - 1, 1))}%`);
        el.style.setProperty("--note-color", state.mode === "kids" ? PAD_COLORS[note] : "#fff09d");
        el.style.animationDelay = `${trackIndex * .12 + i * .08}s`;
        el.textContent = state.mode === "kids" ? "♪" : "";
        stream.appendChild(el);
      });
    });
  }

  function addFloatingNote() {
    const note = document.createElement("span");
    note.textContent = randomChoice(["♪", "♫", "♩", "✦"]);
    note.style.left = `${20 + Math.random() * 60}%`;
    note.style.top = `${35 + Math.random() * 35}%`;
    note.style.setProperty("--dx", `${(Math.random() - .5) * 10}cqw`);
    els.floatingNotes.appendChild(note);
    later(() => note.remove(), 1900);
  }

  function playQuestion() {
    if (state.isPlaying) return;
    initAudio();
    if (state.audio.state === "suspended") state.audio.resume().catch(() => {});
    clearAllLights();
    state.input = [];
    state.inputTimes = [];
    els.submit.disabled = true;
    $$(".player-stream").forEach(el => el.innerHTML = "");
    state.isPlaying = true;
    state.acceptingInput = false;
    els.cave.classList.add("playing");
    els.playLabel.textContent = "回声中…";
    showSpeech("嘘——仔细听山谷的回声…");

    const interval = state.mode === "kids" ? 650 : 390;
    state.correct.forEach((note, i) => {
      later(() => {
        addFloatingNote();
        flashControl(note, interval * .7);
        if (state.mode === "kids") playPadSound(note);
        else playPiano(note, .34);
        sendMidiLight(note, 82, interval * .7);
      }, i * interval);
    });
    later(() => {
      state.isPlaying = false;
      state.acceptingInput = true;
      els.cave.classList.remove("playing");
      els.playLabel.textContent = "再听回声";
      showSpeech(state.mode === "kids" ? "轮到你啦！按出刚才的颜色顺序。" : "轮到你啦！把星光旋律弹回来。");
      clearAllLights();
    }, state.correct.length * interval + 420);
  }

  function flashControl(note, duration = 260) {
    const selector = state.mode === "kids" ? `.pad[data-pad="${note}"]` : `[data-note="${note}"]`;
    const el = $(selector);
    if (!el) return;
    el.classList.add("active");
    later(() => el.classList.remove("active"), duration);
  }

  function handleInput(note, source = "virtual") {
    if (!state.acceptingInput || state.isPlaying) return;
    initAudio();
    if (state.audio.state === "suspended") state.audio.resume();
    const max = state.mode === "kids" ? 5 : 23;
    note = Math.max(0, Math.min(max, Number(note)));
    if (state.mode === "kids") playPadSound(note);
    else playPiano(note);
    flashControl(note, 220);
    sendMidiLight(note, 100, 230);
    state.input.push(note);
    state.inputTimes.push(performance.now());
    createPlayerNote(note);
    els.submit.disabled = false;
    showSpeech(`${state.input.length} 个音符 ${state.input.length >= state.correct.length ? "— 可以完成演奏啦！" : "— 继续听着心里的回声…"}`);

    if (state.mode === "kids" && state.input.length >= state.correct.length) later(checkAnswer, 300);
    if (state.input.length > state.correct.length + 3) checkAnswer();
  }

  function createPlayerNote(note) {
    const track = $$(".track")[state.correctTrack];
    const stream = track.querySelector(".player-stream");
    const el = document.createElement("span");
    el.className = "stream-note";
    el.style.setProperty("--x", `${state.mode === "kids" ? 22 + note * 11 : 16 + (note % 7) * 11}%`);
    el.style.setProperty("--note-color", state.mode === "kids" ? PAD_COLORS[note] : "#fff09d");
    el.textContent = state.mode === "kids" ? "♪" : "";
    stream.appendChild(el);
    later(() => el.remove(), 2900);
  }

  function checkAnswer() {
    if (!state.acceptingInput) return;
    state.acceptingInput = false;
    clearAllLights();
    const pitchMatches = state.input.map((n, i) => n === state.correct[i]);
    const exact = state.input.length === state.correct.length && pitchMatches.every(Boolean);
    const matchingCount = pitchMatches.filter(Boolean).length;

    if (exact) {
      state.score++;
      state.results[state.question] = "right";
      const track = $$(".track")[state.correctTrack];
      track.classList.add("correct");
      reward();
      showSpeech("太棒啦！山谷把你的旋律记住了 ✨", true);
      rewardLights();
      later(nextQuestion, 2400);
    } else {
      state.results[state.question] = "wrong";
      $$(".track").forEach((t, i) => { if (i !== state.correctTrack) t.classList.add("wrong"); });
      const firstWrong = pitchMatches.findIndex(v => !v);
      if (matchingCount > 0) {
        const position = firstWrong === -1 ? Math.min(state.input.length, state.correct.length) : firstWrong;
        showSpeech(`前面已经很接近啦！第 ${position + 1} 个音再听一听。`);
      } else {
        showSpeech("再听听山谷的回声吧，它会温柔地再唱一次。");
      }
      softWhiteHint();
      fadePlayerNotes();
      later(() => {
        state.input = [];
        state.inputTimes = [];
        els.submit.disabled = true;
        playQuestion();
      }, 1500);
      buildProgress();
      return;
    }
    buildProgress();
  }

  function nextQuestion() {
    state.question++;
    clearAllLights();
    if (state.question >= 5) {
      const passed = state.score >= 3;
      showSpeech(passed ? `本关完成！答对 ${state.score} 题，下一片山谷解锁啦！` : `完成啦！答对 ${state.score} 题，我们再听一轮就会更熟练。`, true);
      reward();
      later(() => {
        state.question = 0;
        state.score = 0;
        state.results = [];
        buildProgress();
        makeQuestion();
      }, 3300);
      return;
    }
    buildProgress();
    makeQuestion();
    later(playQuestion, 500);
  }

  function fadePlayerNotes() {
    $$(".player-stream").forEach(el => {
      el.style.transition = "opacity .8s, transform .8s";
      el.style.opacity = "0";
      el.style.transform = "translateY(-2cqw)";
      later(() => {
        el.innerHTML = "";
        el.removeAttribute("style");
      }, 850);
    });
  }

  function showSpeech(text, success = false) {
    els.speech.textContent = text;
    els.speech.classList.toggle("success", success);
  }

  function reward() {
    els.mascots.forEach(m => {
      m.classList.add("celebrate");
      later(() => m.classList.remove("celebrate"), 2600);
    });
    const colors = ["#ffd74f", "#ff7f91", "#6dd2ff", "#8ed75d", "#c99af2", "#ffffff"];
    for (let i = 0; i < 44; i++) {
      const p = document.createElement("span");
      p.className = "particle";
      p.style.setProperty("--x", `${35 + Math.random() * 30}%`);
      p.style.setProperty("--y", `${32 + Math.random() * 28}%`);
      p.style.setProperty("--s", `${.25 + Math.random() * .55}cqw`);
      p.style.setProperty("--c", randomChoice(colors));
      p.style.setProperty("--dx", `${(Math.random() - .5) * 48}cqw`);
      p.style.setProperty("--dy", `${-5 - Math.random() * 25}cqw`);
      els.particles.appendChild(p);
      later(() => p.remove(), 1700);
    }
    [523, 659, 784, 1046].forEach((f, i) => tone(f, .7, "sine", .09, i * .11));
  }

  function setMode(mode) {
    if (mode === state.mode) return;
    clearTimers();
    clearAllLights();
    state.mode = mode;
    els.scene.classList.toggle("piano-mode", mode === "piano");
    els.padsPanel.classList.toggle("disabled", mode === "piano");
    els.pianoPanel.classList.toggle("disabled", mode !== "piano");
    $$(".mode-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
    els.keyboardTip.textContent = mode === "kids"
      ? "鼠标点彩垫，或按数字 1–6"
      : "鼠标点琴键，或用 Z–M / Q–U 两排键，也支持 MIDI";
    state.question = 0;
    state.score = 0;
    state.results = [];
    buildProgress();
    makeQuestion();
  }

  async function connectMidi() {
    if (!navigator.requestMIDIAccess) {
      showSpeech("这台设备暂不支持 Web MIDI，虚拟键盘仍然可以正常玩！");
      return;
    }
    try {
      state.midi = await navigator.requestMIDIAccess({ sysex: true });
      const inputs = [...state.midi.inputs.values()];
      const outputs = [...state.midi.outputs.values()];
      inputs.forEach(input => input.onmidimessage = onMidiMessage);
      PP29.attach(state.midi);                                   // 接入 PartyKeys 36 控灯
      state.midiOutput = PP29.outs[0] || outputs[0] || null;
      els.midi.classList.toggle("connected", inputs.length > 0 || !!state.midiOutput);
      els.midi.innerHTML = `<span class="midi-light"></span>${state.midiOutput ? "PartyKeys" : inputs.length ? "MIDI 输入" : "未发现设备"}`;
      showSpeech(inputs.length || outputs.length ? "MIDI 已连接，山谷听得到实体键盘啦！" : "没有发现 MIDI 设备，虚拟键盘仍然可以正常玩。");
      state.midi.onstatechange = connectMidi;
    } catch {
      showSpeech("MIDI 连接没有开启，没关系，屏幕键盘照样可以玩！");
    }
  }

  function onMidiMessage(event) {
    const [status, note, velocity] = event.data;
    const command = status & 0xf0;
    if (command === 0x90 && velocity > 0) {
      const index = note - 48;          // PartyKeys 36 最左键 MIDI48 → index0
      if (state.mode === "piano" && index >= 0 && index < 24) handleInput(index, "midi");
    }
  }

  const VE_KIDS_LAMP = [2, 7, 12, 17, 22, 27];   // 低幼 6 垫映射到 29 键上 6 个分散的灯
  function sendMidiLight(index, velocity = 80, duration = 250) {
    if (!state.midiOutput) return;
    const lamp = state.mode === "kids" ? VE_KIDS_LAMP[index] : index;  // 钢琴：lamp = index(0-23)
    if (lamp == null) return;
    const slot = state.mode === "kids" ? (index % 7) + 1 : 3;
    PP29.set(lamp, slot);
    later(() => PP29.clear(lamp), duration);
  }

  function clearAllLights() {
    if (!state.midiOutput) return;
    PP29.allOff();
  }

  function rewardLights() {
    if (!state.midiOutput) return;
    const lamps = state.mode === "kids" ? VE_KIDS_LAMP : Array.from({length:24}, (_,i) => i);
    lamps.forEach((lamp, i) => later(() => {
      PP29.set(lamp, 3);
      later(() => PP29.clear(lamp), 180);
    }, i * 55));
    later(clearAllLights, lamps.length * 55 + 350);
  }

  function softWhiteHint() {
    if (!state.midiOutput) return;
    const lamps = state.mode === "kids" ? VE_KIDS_LAMP : [0,2,4,5,7,9,11,12,14,16,17,19,21,23];
    PP29.setMany(lamps, 7);
    later(clearAllLights, 500);
  }

  function bindEvents() {
    els.start.addEventListener("click", () => {
      els.welcome.classList.add("hidden");
      try {
        initAudio();
      } catch {
        showSpeech("声音暂时没有打开，界面仍然可以正常体验。");
        return;
      }
      if (state.audio.state === "suspended") state.audio.resume().catch(() => {});
      playQuestion();
    });
    els.cave.addEventListener("click", playQuestion);
    els.replay.addEventListener("click", playQuestion);
    els.submit.addEventListener("click", checkAnswer);
    els.midi.addEventListener("click", connectMidi);
    $$(".mode-btn").forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode)));
    els.pads.forEach(pad => pad.addEventListener("pointerdown", () => handleInput(Number(pad.dataset.pad))));
    els.piano.addEventListener("pointerdown", event => {
      const key = event.target.closest("[data-note]");
      if (key) handleInput(Number(key.dataset.note));
    });

    window.addEventListener("keydown", event => {
      if (event.repeat || state.heldKeys.has(event.key.toLowerCase())) return;
      const key = event.key.toLowerCase();
      state.heldKeys.add(key);
      if (state.mode === "kids" && /^[1-6]$/.test(key)) handleInput(Number(key) - 1, "keyboard");
      if (state.mode === "piano") {
        const index = KEY_MAP.indexOf(key);
        if (index >= 0) handleInput(index, "keyboard");
      }
      if (key === " ") { event.preventDefault(); playQuestion(); }
      if (key === "enter" && !els.submit.disabled) checkAnswer();
    });
    window.addEventListener("keyup", event => state.heldKeys.delete(event.key.toLowerCase()));
    window.addEventListener("blur", () => { state.heldKeys.clear(); clearAllLights(); });
    window.addEventListener("beforeunload", clearAllLights);
  }

  buildPiano();
  buildProgress();
  bindEvents();
  makeQuestion();
})();
