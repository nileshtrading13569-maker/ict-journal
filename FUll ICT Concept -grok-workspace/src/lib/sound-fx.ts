// Zero-dependency Web Audio API mechanical switch & UI sound synthesis
// High-fidelity synthesis for Clicky (Blue), Tactile (Brown), Smooth (Red), and Crisp (Liquid) switches.

export type SoundProfile = "blue" | "brown" | "red" | "liquid";

export interface SoundProfileMeta {
  id: SoundProfile;
  name: string;
  type: string;
  colorDot: string;
  description: string;
}

export const SOUND_PROFILES: readonly SoundProfileMeta[] = [
  { id: "blue", name: "Blue", type: "Clicky", colorDot: "#3b82f6", description: "Crisp metallic snap with tactile click leaf" },
  { id: "brown", name: "Brown", type: "Tactile", colorDot: "#b45309", description: "Warm rounded bump with gentle bottom-out" },
  { id: "red", name: "Red", type: "Smooth", colorDot: "#ef4444", description: "Smooth linear glide with cushioned acoustic thud" },
  { id: "liquid", name: "Liquid", type: "Crisp", colorDot: "#0f172a", description: "Glassy hydraulic acoustic ping with sub-bass drop" },
] as const;

export const SOUND_CLICK_STORAGE_KEY = "first-payout-sound-click-enabled-v1";
export const SOUND_TYPING_STORAGE_KEY = "first-payout-sound-typing-enabled-v1";
export const SOUND_PROFILE_STORAGE_KEY = "first-payout-sound-profile-v1";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxClass) return null;

  if (!audioCtx) {
    try {
      audioCtx = new AudioCtxClass();
    } catch {
      return null;
    }
  }

  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

export function getClickSoundEnabled(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  const val = window.localStorage.getItem(SOUND_CLICK_STORAGE_KEY);
  return val === "true";
}

export function setClickSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(SOUND_CLICK_STORAGE_KEY, enabled ? "true" : "false");
}

export function getTypingSoundEnabled(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  const val = window.localStorage.getItem(SOUND_TYPING_STORAGE_KEY);
  return val === "true";
}

export function setTypingSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(SOUND_TYPING_STORAGE_KEY, enabled ? "true" : "false");
}

export function getSoundProfile(): SoundProfile {
  if (typeof window === "undefined" || !window.localStorage) return "liquid";
  const val = window.localStorage.getItem(SOUND_PROFILE_STORAGE_KEY) as SoundProfile | null;
  if (val && ["blue", "brown", "red", "liquid"].includes(val)) {
    return val;
  }
  return "liquid";
}

export function setSoundProfile(profile: SoundProfile): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(SOUND_PROFILE_STORAGE_KEY, profile);
}

// Synthesize mechanical keyboard switch press using Web Audio API
export function synthesizeSwitchSound(profile: SoundProfile, pitchMultiplier = 1.0): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  try {
    switch (profile) {
      case "blue": {
        // High frequency crisp metallic leaf snap (Clicky)
        const snapOsc = ctx.createOscillator();
        const snapGain = ctx.createGain();
        snapOsc.type = "triangle";
        snapOsc.frequency.setValueAtTime(2600 * pitchMultiplier, now);
        snapOsc.frequency.exponentialRampToValueAtTime(1400 * pitchMultiplier, now + 0.012);

        snapGain.gain.setValueAtTime(0.24, now);
        snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.016);

        snapOsc.connect(snapGain);
        snapGain.connect(ctx.destination);
        snapOsc.start(now);
        snapOsc.stop(now + 0.02);

        // Followed 6ms later by switch bottom-out thud
        const thudOsc = ctx.createOscillator();
        const thudGain = ctx.createGain();
        thudOsc.type = "sine";
        thudOsc.frequency.setValueAtTime(700 * pitchMultiplier, now + 0.006);
        thudOsc.frequency.exponentialRampToValueAtTime(180 * pitchMultiplier, now + 0.035);

        thudGain.gain.setValueAtTime(0.001, now);
        thudGain.gain.setValueAtTime(0.18, now + 0.006);
        thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);

        thudOsc.connect(thudGain);
        thudGain.connect(ctx.destination);
        thudOsc.start(now + 0.006);
        thudOsc.stop(now + 0.04);
        break;
      }

      case "brown": {
        // Tactile bump with medium acoustic weight
        const bumpOsc = ctx.createOscillator();
        const bumpGain = ctx.createGain();
        bumpOsc.type = "sine";
        bumpOsc.frequency.setValueAtTime(650 * pitchMultiplier, now);
        bumpOsc.frequency.exponentialRampToValueAtTime(280 * pitchMultiplier, now + 0.03);

        bumpGain.gain.setValueAtTime(0.22, now);
        bumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);

        bumpOsc.connect(bumpGain);
        bumpGain.connect(ctx.destination);
        bumpOsc.start(now);
        bumpOsc.stop(now + 0.035);
        break;
      }

      case "red": {
        // Linear smooth cushioned acoustic landing
        const thudOsc = ctx.createOscillator();
        const thudGain = ctx.createGain();
        thudOsc.type = "sine";
        thudOsc.frequency.setValueAtTime(340 * pitchMultiplier, now);
        thudOsc.frequency.exponentialRampToValueAtTime(120 * pitchMultiplier, now + 0.035);

        thudGain.gain.setValueAtTime(0.19, now);
        thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);

        thudOsc.connect(thudGain);
        thudGain.connect(ctx.destination);
        thudOsc.start(now);
        thudOsc.stop(now + 0.04);
        break;
      }

      case "liquid":
      default: {
        // Crystalline hydraulic waterdrop glass pop
        const chimeOsc = ctx.createOscillator();
        const chimeGain = ctx.createGain();
        chimeOsc.type = "triangle";
        chimeOsc.frequency.setValueAtTime(2200 * pitchMultiplier, now);
        chimeOsc.frequency.exponentialRampToValueAtTime(1200 * pitchMultiplier, now + 0.015);

        chimeGain.gain.setValueAtTime(0.26, now);
        chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

        chimeOsc.connect(chimeGain);
        chimeGain.connect(ctx.destination);
        chimeOsc.start(now);
        chimeOsc.stop(now + 0.025);

        // Sub bass hydraulic droplet drop
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = "sine";
        subOsc.frequency.setValueAtTime(420 * pitchMultiplier, now + 0.002);
        subOsc.frequency.exponentialRampToValueAtTime(90 * pitchMultiplier, now + 0.028);

        subGain.gain.setValueAtTime(0.18, now + 0.002);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        subOsc.connect(subGain);
        subGain.connect(ctx.destination);
        subOsc.start(now + 0.002);
        subOsc.stop(now + 0.035);
        break;
      }
    }
  } catch {
    // Graceful silence on audio device failure
  }
}

// Play switch preview sound regardless of toggle state
export function previewSwitchSound(profile: SoundProfile): void {
  synthesizeSwitchSound(profile, 1.0);
}

// Play button click sound if enabled
export function playClickSound(profileOverride?: SoundProfile): void {
  if (!getClickSoundEnabled() && !profileOverride) return;
  const profile = profileOverride ?? getSoundProfile();
  synthesizeSwitchSound(profile, 1.0);
}

// Play typing sound with humanized micro-variations if enabled
export function playTypingSound(): void {
  if (!getTypingSoundEnabled()) return;
  const profile = getSoundProfile();
  // Random variation of ±7% pitch creates realistic keyboard acoustics
  const variance = 0.93 + Math.random() * 0.14;
  synthesizeSwitchSound(profile, variance);
}

// Initialize global user-action acoustic listeners
let listenersAttached = false;
export function initGlobalSoundListeners(): void {
  if (typeof window === "undefined" || listenersAttached) return;
  listenersAttached = true;

  window.addEventListener(
    "click",
    (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const clickable = target.closest(
        "button, [role='button'], a, input[type='checkbox'], input[type='radio'], input[type='submit'], select, [data-clickable='true']",
      );
      if (clickable) {
        playClickSound();
      }
    },
    { capture: true },
  );

  window.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.getAttribute("role") === "textbox";

      if (isInput) {
        // Disregard raw modifiers
        if (!["Shift", "Control", "Alt", "Meta", "CapsLock", "Tab"].includes(e.key)) {
          playTypingSound();
        }
      }
    },
    { capture: true },
  );
}

// Auto-run in browser environment
if (typeof window !== "undefined") {
  initGlobalSoundListeners();
}
