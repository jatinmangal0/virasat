// Sound effects, made in the browser (no audio files): noise and tones through the Web Audio API.
// They play only when the visitor has turned sound on; isOn() asks app.js.
export function makeSound(isOn) {
  let ctx;
  const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
  function noise(dur, freq, q, gain) {
    if (!isOn()) return;
    const c = ac(), len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
    src.connect(f).connect(g).connect(c.destination); src.start();
  }
  function tone(type, from, to, dur, gain = 0.12) {
    if (!isOn()) return;
    const c = ac(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = type; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur);
  }
  return {
    whoosh: () => noise(0.5, 900, 0.7, 0.5),
    paper: () => noise(0.35, 2400, 1.2, 0.35),
    thunk: () => { noise(0.12, 180, 1, 1.2); tone('sine', 120, 60, 0.18, 0.3); },
    tap: () => tone('triangle', 660, 520, 0.08, 0.1),
    crack: () => noise(0.18, 1400, 3, 0.8),
    toot: () => { tone('sawtooth', 260, 520, 0.35, 0.07); setTimeout(() => tone('sawtooth', 520, 700, 0.4, 0.06), 180); },
    ding: () => { tone('sine', 880, 880, 0.25, 0.12); setTimeout(() => tone('sine', 1320, 1320, 0.35, 0.1), 120); },
    buzz: () => tone('square', 160, 120, 0.22, 0.05),
    ctx: () => ac(),
  };
}
