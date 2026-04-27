import Soundfont from "soundfont-player";

let audioContext: AudioContext | null = null;
let instrumentPromise: Promise<Soundfont.Player> | null = null;
let instrumentInstance: Soundfont.Player | null = null;
let preloadPromise: Promise<void> | null = null;
let samplesReady = false;

export type AudioDebugState = {
  path: "idle" | "fallback" | "sample" | "warming" | "error";
  noteLabel: string | null;
  contextState: AudioContextState | "none";
  samplesReady: boolean;
  timestampMs: number | null;
};

const audioDebugListeners = new Set<(state: AudioDebugState) => void>();

let audioDebugState: AudioDebugState = {
  path: "idle",
  noteLabel: null,
  contextState: "none",
  samplesReady: false,
  timestampMs: null
};

function updateAudioDebug(partial: Partial<AudioDebugState>) {
  audioDebugState = {
    ...audioDebugState,
    ...partial,
    samplesReady
  };
  audioDebugListeners.forEach((listener) => listener(audioDebugState));
}

export function subscribeAudioDebug(listener: (state: AudioDebugState) => void) {
  audioDebugListeners.add(listener);
  listener(audioDebugState);
  return () => {
    audioDebugListeners.delete(listener);
  };
}

const PRELOAD_NOTES = [
  "G2",
  "A2",
  "B2",
  "C3",
  "D3",
  "E3",
  "F3",
  "G3",
  "A3",
  "E4",
  "F4",
  "G4",
  "A4",
  "B4",
  "C5",
  "D5",
  "E5",
  "F5"
] as const;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new window.AudioContext();
    updateAudioDebug({ contextState: audioContext.state });
  }
  return audioContext;
}

async function getInstrument() {
  const context = getAudioContext();
  if (context.state === "suspended") {
    await context.resume();
  }

  if (!instrumentPromise) {
    instrumentPromise = Soundfont.instrument(context, "acoustic_grand_piano", {
      soundfont: "MusyngKite",
      nameToUrl: (name: string, soundfont: string) =>
        `https://gleitz.github.io/midi-js-soundfonts/${soundfont}/${name}-mp3.js`
    });
  }

  const loadedInstrument = await instrumentPromise;
  instrumentInstance = loadedInstrument;
  return loadedInstrument;
}

function noteToFrequency(noteLabel: string) {
  const match = noteLabel.match(/^([A-G])(#|b)?(\d)$/);
  if (!match) {
    return 440;
  }

  const [, letter, accidental = "", octaveText] = match;
  const octave = Number(octaveText);
  const semitoneMap: Record<string, number> = {
    C: 0,
    "C#": 1,
    Db: 1,
    D: 2,
    "D#": 3,
    Eb: 3,
    E: 4,
    F: 5,
    "F#": 6,
    Gb: 6,
    G: 7,
    "G#": 8,
    Ab: 8,
    A: 9,
    "A#": 10,
    Bb: 10,
    B: 11
  };

  const semitone = semitoneMap[`${letter}${accidental}`];
  const midiNumber = 12 * (octave + 1) + semitone;
  return 440 * 2 ** ((midiNumber - 69) / 12);
}

function playFallbackTone(noteLabel: string) {
  const context = getAudioContext();
  const now = context.currentTime;
  const frequency = noteToFrequency(noteLabel);

  const oscillator = context.createOscillator();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, now);

  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.68);
}

export async function warmPianoSamples() {
  if (samplesReady) {
    return;
  }

  if (!preloadPromise) {
    updateAudioDebug({ path: "warming", contextState: getAudioContext().state });
    preloadPromise = (async () => {
      const context = getAudioContext();
      if (context.state === "suspended") {
        await context.resume();
        updateAudioDebug({ contextState: context.state });
      }

      const instrument = await getInstrument();
      const start = context.currentTime + 0.05;

      PRELOAD_NOTES.forEach((noteLabel, index) => {
        instrument.play(noteLabel, start + index * 0.03, {
          gain: 0.00001,
          duration: 0.02
        });
      });

      samplesReady = true;
      updateAudioDebug({ path: "idle", contextState: context.state, timestampMs: Date.now() });
    })().catch(() => {
      preloadPromise = null;
      updateAudioDebug({ path: "error", contextState: getAudioContext().state, timestampMs: Date.now() });
    });
  }

  await preloadPromise;
}

export async function playPianoNote(noteLabel: string) {
  const context = getAudioContext();
  if (context.state === "suspended") {
    void context.resume().then(() => {
      updateAudioDebug({ contextState: context.state });
    });
  }

  // Always play something immediately; keep sample loading fully async.
  if (!instrumentInstance || !samplesReady) {
    playFallbackTone(noteLabel);
    updateAudioDebug({
      path: "fallback",
      noteLabel,
      contextState: context.state,
      timestampMs: Date.now()
    });
    void warmPianoSamples();
    return;
  }

  try {
    instrumentInstance.play(noteLabel, 0, { gain: 0.8 });
    updateAudioDebug({
      path: "sample",
      noteLabel,
      contextState: context.state,
      timestampMs: Date.now()
    });
  } catch {
    // Reset promise so the next call retries remote sample loading.
    instrumentInstance = null;
    instrumentPromise = null;
    samplesReady = false;
    preloadPromise = null;
    playFallbackTone(noteLabel);
    updateAudioDebug({
      path: "error",
      noteLabel,
      contextState: context.state,
      timestampMs: Date.now()
    });
    void warmPianoSamples();
  }
}
