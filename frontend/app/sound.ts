// Tiny Web Audio sound kit — no asset files, everything synthesized.
let ctx: AudioContext | null = null;
let muted = true;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
  if (!m) ac()?.resume();
}
export function getMuted() {
  return muted;
}

function blip(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.08, when = 0) {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + dur);
}

function swish(dur: number, vol = 0.04) {
  const c = ac();
  if (!c || muted) return;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 1500;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(c.destination);
  src.start();
}

export const sfx = {
  chip: () => {
    blip(1300, 0.05, "square", 0.05);
    blip(950, 0.06, "square", 0.04, 0.02);
  },
  card: () => swish(0.12, 0.045),
  turn: () => {
    blip(660, 0.12, "sine", 0.1);
    blip(990, 0.16, "sine", 0.08, 0.08);
  },
  win: () => [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.2, "triangle", 0.09, i * 0.09)),
  fold: () => blip(320, 0.14, "sawtooth", 0.05),
};
