import { useSettings } from "../store/settings";

let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(freq: number, type: OscillatorType, duration: number, volume: number, sweep: boolean = false) {
  if (!useSettings.getState().soundEnabled) return;

  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (sweep) {
    osc.frequency.exponentialRampToValueAtTime(freq / 2, ctx.currentTime + duration);
  }

  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export const sound = {
  click: () => {
    // Un clic court et sec
    playTone(1200, "sine", 0.05, 0.08, true);
  },
  success: () => {
    // Arpège majeur (C5, E5, G5)
    playTone(523.25, "sine", 0.2, 0.06); // C5
    setTimeout(() => playTone(659.25, "sine", 0.2, 0.06), 80); // E5
    setTimeout(() => playTone(783.99, "sine", 0.3, 0.06), 160); // G5
  },
  error: () => {
    // Son grave et un peu sourd
    playTone(180, "triangle", 0.3, 0.1);
    setTimeout(() => playTone(140, "triangle", 0.3, 0.1), 50);
  },
  notify: () => {
    // Carillon doux
    playTone(880, "sine", 0.2, 0.05);
    setTimeout(() => playTone(1108.73, "sine", 0.2, 0.05), 100);
  },
  toggleOn: () => {
    // Montée rapide
    playTone(600, "sine", 0.1, 0.04);
    setTimeout(() => {
        const osc = getAudioContext().createOscillator();
        const gain = getAudioContext().createGain();
        osc.frequency.setValueAtTime(600, getAudioContext().currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, getAudioContext().currentTime + 0.1);
        gain.gain.setValueAtTime(0.04, getAudioContext().currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, getAudioContext().currentTime + 0.1);
        osc.connect(gain);
        gain.connect(getAudioContext().destination);
        osc.start();
        osc.stop(getAudioContext().currentTime + 0.1);
    }, 20);
  },
  toggleOff: () => {
    // Descente rapide
    playTone(1200, "sine", 0.1, 0.04);
    setTimeout(() => {
        const osc = getAudioContext().createOscillator();
        const gain = getAudioContext().createGain();
        osc.frequency.setValueAtTime(1200, getAudioContext().currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, getAudioContext().currentTime + 0.1);
        gain.gain.setValueAtTime(0.04, getAudioContext().currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, getAudioContext().currentTime + 0.1);
        osc.connect(gain);
        gain.connect(getAudioContext().destination);
        osc.start();
        osc.stop(getAudioContext().currentTime + 0.1);
    }, 20);
  }
};
