// All of Virasat's sound. Effects and Gaju's footsteps are made in the browser (Web Audio: noise and tones, no
// files); the background music is one file, set in audio-settings.js. Everything goes through one master volume,
// so the speaker button mutes it all at once. Browsers allow sound only after the visitor clicks or taps, so
// nothing plays (and the music is not even downloaded) until unlock() is called from the first click.
import { MUSIC_URL, MUSIC_VOLUME, FOOTSTEP_VOLUME } from './audio-settings.js';

export function makeSound(isOn) {
  let ctx, master, unlocked = false, music, musicGain, musicTried = false;
  const ac = () => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = isOn() ? 1 : 0;
      master.connect(ctx.destination);
    }
    return ctx;
  };
  const ready = () => unlocked && isOn();
  function noise(dur, freq, q, gain, type = 'bandpass') {
    if (!ready()) return;
    const c = ac(), len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
    src.connect(f).connect(g).connect(master); src.start();
  }
  function tone(type, from, to, dur, gain = 0.12) {
    if (!ready()) return;
    const c = ac(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = type; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur);
  }

  // One heavy, soft footfall: a low thump with a little dusty scuff. Feet alternate, so every other one is a touch lighter.
  let foot = 0;
  function footstep() {
    if (!ready()) return;
    const v = FOOTSTEP_VOLUME * (foot++ % 2 ? 0.8 : 1), lift = foot % 2 ? 1 : 0.92;
    tone('sine', 78 * lift, 38, 0.26, 0.9 * v);
    noise(0.16, 140, 0.8, 1.6 * v, 'lowpass');
    noise(0.1, 900, 0.9, 0.12 * v);
  }

  // Background music: a looping <audio> element, made on first use. It goes through Web Audio so its volume can be
  // set on iPhones too (Safari ignores audio.volume). A file on another website must allow that (CORS); if it does
  // not, play it straight instead, at audio.volume, which works everywhere except iOS.
  function startMusic() {
    if (!MUSIC_URL || !ready() || document.hidden) return;
    if (!music && !musicTried) {
      musicTried = true;
      const crossSite = new URL(MUSIC_URL, location.href).origin !== location.origin;
      const make = (viaWebAudio) => {
        const a = new Audio();
        a.loop = true; a.preload = 'auto';
        if (viaWebAudio) {
          if (crossSite) a.crossOrigin = 'anonymous';
          musicGain = ctx.createGain();
          musicGain.gain.value = MUSIC_VOLUME;
          ctx.createMediaElementSource(a).connect(musicGain).connect(master);
        } else a.volume = MUSIC_VOLUME;
        a.src = MUSIC_URL;
        return a;
      };
      music = make(true);
      if (crossSite) music.addEventListener('error', () => { music = make(false); if (ready() && !document.hidden) music.play().catch(() => {}); }, { once: true });
    }
    music?.play().catch(() => {});
  }
  const stopMusic = () => music?.pause();

  // The first click or tap anywhere: browsers now let the page make sound.
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    ac().resume?.();
    startMusic();
  }
  // The speaker button: on or off for everything. The master volume fades so nothing clicks.
  function update() {
    if (!ctx) { if (isOn()) startMusic(); return; }
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(isOn() ? 1 : 0, t, 0.05);
    if (isOn()) { ctx.resume?.(); startMusic(); } else stopMusic();
  }
  // a hidden tab stays quiet
  document.addEventListener('visibilitychange', () => (document.hidden ? stopMusic() : startMusic()));

  return {
    unlock, update, footstep,
    whoosh: () => noise(0.5, 900, 0.7, 0.5),
    paper: () => noise(0.35, 2400, 1.2, 0.35),
    thunk: () => { noise(0.12, 180, 1, 1.2); tone('sine', 120, 60, 0.18, 0.3); },
    tap: () => tone('triangle', 660, 520, 0.08, 0.1),
    crack: () => noise(0.18, 1400, 3, 0.8),
    toot: () => { tone('sawtooth', 260, 520, 0.35, 0.07); setTimeout(() => tone('sawtooth', 520, 700, 0.4, 0.06), 180); },
    ding: () => { tone('sine', 880, 880, 0.25, 0.12); setTimeout(() => tone('sine', 1320, 1320, 0.35, 0.1), 120); },
    buzz: () => tone('square', 160, 120, 0.22, 0.05),
  };
}
