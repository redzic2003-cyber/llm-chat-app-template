/** Retour haptique et sonore : succès court, erreur marquée. */
import { Capacitor } from "@capacitor/core";
import { Haptics, NotificationType } from "@capacitor/haptics";
import { state } from "./store";

let audio: AudioContext | null = null;

function beep(frequency: number, duration: number, type: OscillatorType = "sine") {
  if (!state.sound) return;
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.15, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration);
  } catch {
    // audio indisponible
  }
}

async function vibrate(type: NotificationType, fallback: number | number[]) {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.notification({ type });
    else navigator.vibrate?.(fallback);
  } catch {
    // haptique indisponible
  }
}

export function success() {
  void vibrate(NotificationType.Success, 60);
  beep(1320, 0.12);
}

export function failure() {
  void vibrate(NotificationType.Error, [80, 60, 80]);
  beep(220, 0.25, "square");
}

export function tick() {
  if (Capacitor.isNativePlatform()) void Haptics.selectionChanged().catch(() => undefined);
}
