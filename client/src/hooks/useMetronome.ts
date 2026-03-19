/* ============================================================
 * useMetronome Hook
 * Design: Jacob's Beat Keeper - Precise Web Audio API scheduling
 * Uses the "lookahead scheduler" pattern for accurate timing
 * Features:
 *   - voice count (musical pitched tones mapped to 1-2-3-4)
 *   - per-beat 4-level volume: strong / medium-strong / weak / mute
 *   - multiple instrument sound types
 *   - fixed cowbell synthesis with accurate metallic frequencies
 * ============================================================ */

import { useCallback, useEffect, useRef, useState } from "react";

export type SoundType = "click" | "woodblock" | "beep" | "cowbell" | "hihat" | "voice";
export type SubdivisionType = 1 | 2 | 3 | 4;

// 四级音量等级: 0=静音, 1=弱, 2=次强, 3=强
export type BeatLevel = 0 | 1 | 2 | 3;
export const BEAT_LEVEL_VOLUMES: Record<BeatLevel, number> = {
  3: 1.0,    // 强
  2: 0.65,   // 次强
  1: 0.35,   // 弱
  0: 0,      // 静音
};
export const BEAT_LEVEL_LABELS: Record<BeatLevel, string> = {
  3: "强",
  2: "次强",
  1: "弱",
  0: "静音",
};

export type MuteBeats = boolean[];
// Per-beat volume: 0-1, undefined means use global volume
export type BeatVolumes = (number | undefined)[];
// Per-beat level: 0-3
export type BeatLevels = (BeatLevel | undefined)[];

export interface BeatState {
  currentBeat: number;
  currentSubBeat: number;
  isPlaying: boolean;
  bpm: number;
  beatsPerMeasure: number;
  beatUnit: number;
  subdivision: SubdivisionType;
  soundType: SoundType;
  volume: number;
  accentFirstBeat: boolean;
  flashBeat: boolean;
  tapTempoHistory: number[];
  muteBeats: MuteBeats;
  beatVolumes: BeatVolumes;  // per-beat volume multipliers (computed from beatLevels)
  beatLevels: BeatLevels;    // per-beat 4-level indicator
}

const LOOKAHEAD_MS = 25.0;
const SCHEDULE_AHEAD_SEC = 0.1;

// ─── Voice Count: Musical Pitched Tones ─────────────────────────────────────
function createVoiceCount(
  ctx: AudioContext,
  time: number,
  beatIndex: number,
  isAccent: boolean,
  volume: number
) {
  const pitches = [523.25, 440.0, 392.0, 329.63]; // C5, A4, G4, E4
  const idx = beatIndex % 4;
  const freq = pitches[idx];
  const vol = isAccent ? Math.min(volume * 1.35, 1.0) : volume * 0.82;

  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const modGain = ctx.createGain();
  const masterGain = ctx.createGain();

  carrier.type = "sine";
  modulator.type = "sine";

  const modRatio = isAccent ? 2.0 : 1.5;
  carrier.frequency.value = freq;
  modulator.frequency.value = freq * modRatio;

  modGain.gain.setValueAtTime(freq * 3.5, time);
  modGain.gain.exponentialRampToValueAtTime(freq * 0.1, time + 0.04);
  modGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

  masterGain.gain.setValueAtTime(0, time);
  masterGain.gain.linearRampToValueAtTime(vol, time + 0.006);
  masterGain.gain.exponentialRampToValueAtTime(vol * 0.4, time + 0.05);
  masterGain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

  const clickOsc = ctx.createOscillator();
  const clickGain = ctx.createGain();
  clickOsc.type = "triangle";
  clickOsc.frequency.value = freq * 4;
  clickGain.gain.setValueAtTime(vol * 0.25, time);
  clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.018);

  const tailOsc = ctx.createOscillator();
  const tailGain = ctx.createGain();
  tailOsc.type = "sine";
  tailOsc.frequency.value = freq * 0.5;
  tailGain.gain.setValueAtTime(0, time);
  tailGain.gain.linearRampToValueAtTime(vol * 0.12, time + 0.01);
  tailGain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

  modulator.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(masterGain);
  masterGain.connect(ctx.destination);

  clickOsc.connect(clickGain);
  clickGain.connect(ctx.destination);

  tailOsc.connect(tailGain);
  tailGain.connect(ctx.destination);

  const stopTime = time + 0.32;
  carrier.start(time);   carrier.stop(stopTime);
  modulator.start(time); modulator.stop(stopTime);
  clickOsc.start(time);  clickOsc.stop(time + 0.025);
  tailOsc.start(time);   tailOsc.stop(stopTime);
}

// ─── Cowbell: Accurate metallic synthesis ────────────────────────────────────
// Real cowbell uses two square-wave oscillators at specific inharmonic ratios.
// Standard cowbell frequencies: ~562 Hz and ~845 Hz (ratio ≈ 1:1.5)
// The Roland TR-808 cowbell uses 540 Hz + 800 Hz.
// We use 562 Hz + 845 Hz with proper bandpass + highpass shaping.
function createCowbellSound(
  ctx: AudioContext,
  time: number,
  isAccent: boolean,
  volume: number
) {
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);

  // Two square oscillators at inharmonic metallic frequencies
  const freq1 = 562;   // fundamental metallic partial
  const freq2 = 845;   // second partial (ratio ~1.5)
  const decayTime = isAccent ? 0.55 : 0.38;
  const vol = isAccent ? Math.min(volume * 1.3, 1.0) : volume * 0.85;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = "square";
  osc2.type = "square";
  osc1.frequency.value = freq1;
  osc2.frequency.value = freq2;

  // Bandpass filter to shape metallic timbre (center ~700 Hz, moderate Q)
  const bpFilter = ctx.createBiquadFilter();
  bpFilter.type = "bandpass";
  bpFilter.frequency.value = 700;
  bpFilter.Q.value = 1.8;

  // High-pass to remove low rumble
  const hpFilter = ctx.createBiquadFilter();
  hpFilter.type = "highpass";
  hpFilter.frequency.value = 300;
  hpFilter.Q.value = 0.5;

  osc1.connect(bpFilter);
  osc2.connect(bpFilter);
  bpFilter.connect(hpFilter);
  hpFilter.connect(masterGain);

  // Sharp attack, exponential metallic decay
  masterGain.gain.setValueAtTime(0, time);
  masterGain.gain.linearRampToValueAtTime(vol * 0.6, time + 0.003);
  masterGain.gain.exponentialRampToValueAtTime(vol * 0.25, time + 0.05);
  masterGain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);

  // Metallic "ping" transient using a brief sine burst
  const pingOsc = ctx.createOscillator();
  const pingGain = ctx.createGain();
  pingOsc.type = "sine";
  pingOsc.frequency.value = freq1 * 2.5;
  pingGain.gain.setValueAtTime(vol * 0.3, time);
  pingGain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
  pingOsc.connect(pingGain);
  pingGain.connect(ctx.destination);

  const stopTime = time + decayTime + 0.02;
  osc1.start(time); osc1.stop(stopTime);
  osc2.start(time); osc2.stop(stopTime);
  pingOsc.start(time); pingOsc.stop(time + 0.03);
}

// ─── Instrument Sound Synthesis ──────────────────────────────────────────────
function createClickSound(
  ctx: AudioContext,
  time: number,
  isAccent: boolean,
  soundType: SoundType,
  volume: number,
  beatIndex: number
) {
  if (soundType === "voice") {
    createVoiceCount(ctx, time, beatIndex, isAccent, volume);
    return;
  }

  if (soundType === "cowbell") {
    createCowbellSound(ctx, time, isAccent, volume);
    return;
  }

  const gainNode = ctx.createGain();
  gainNode.connect(ctx.destination);
  const vol = isAccent ? Math.min(volume * 1.4, 1.0) : volume;

  switch (soundType) {
    case "click": {
      const osc = ctx.createOscillator();
      osc.connect(gainNode);
      const freq = isAccent ? 1800 : 1200;
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, time + 0.03);
      gainNode.gain.setValueAtTime(vol, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
      osc.start(time);
      osc.stop(time + 0.1);
      break;
    }
    case "woodblock": {
      const bufferSize = Math.floor(ctx.sampleRate * 0.05);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = isAccent ? 1400 : 900;
      filter.Q.value = 8;
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.gain.setValueAtTime(vol, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
      source.start(time);
      break;
    }
    case "beep": {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.connect(gainNode);
      osc.frequency.value = isAccent ? 880 : 660;
      gainNode.gain.setValueAtTime(vol, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
      osc.start(time);
      osc.stop(time + 0.15);
      break;
    }
    case "hihat": {
      const bufferSize = Math.floor(ctx.sampleRate * 0.04);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = isAccent ? 8000 : 6000;
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.gain.setValueAtTime(vol, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
      source.start(time);
      break;
    }
  }
}

export function useMetronome() {
  const [state, setState] = useState<BeatState>({
    currentBeat: 0,
    currentSubBeat: 0,
    isPlaying: false,
    bpm: 120,
    beatsPerMeasure: 4,
    beatUnit: 4,
    subdivision: 1,
    soundType: "click",
    volume: 0.8,
    accentFirstBeat: true,
    flashBeat: false,
    tapTempoHistory: [],
    muteBeats: [],
    beatVolumes: [],
    beatLevels: [],
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const schedulerTimerRef = useRef<number | null>(null);
  const nextBeatTimeRef = useRef<number>(0);
  const currentBeatRef = useRef<number>(0);
  const currentSubBeatRef = useRef<number>(0);
  const stateRef = useRef(state);

  const beatVolumesRef = useRef<BeatVolumes>([]);
  const muteBeatsRef = useRef<MuteBeats>([]);
  const globalVolumeRef = useRef<number>(0.8);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const scheduleNote = useCallback((beatIndex: number, subBeatIndex: number, time: number) => {
    const s = stateRef.current;
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const isFirstBeat = beatIndex === 0 && subBeatIndex === 0;
    const isDownbeat = subBeatIndex === 0;
    const isAccent = s.accentFirstBeat && isFirstBeat;

    const isMuted = muteBeatsRef.current[beatIndex] === true;

    if (!isMuted && (isDownbeat || s.subdivision > 1)) {
      const beatVol = beatVolumesRef.current[beatIndex];
      const effectiveVol = beatVol !== undefined ? beatVol : globalVolumeRef.current;
      const subVol = isDownbeat ? effectiveVol : effectiveVol * 0.5;

      if (s.soundType === "voice" && !isDownbeat) {
        // Voice only on downbeats
      } else {
        createClickSound(ctx, time, isAccent, s.soundType, subVol, beatIndex);
      }
    }

    const now = ctx.currentTime;
    const delay = Math.max(0, (time - now) * 1000);
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        currentBeat: beatIndex,
        currentSubBeat: subBeatIndex,
        flashBeat: true,
      }));
      setTimeout(() => {
        setState(prev => ({ ...prev, flashBeat: false }));
      }, 80);
    }, delay);
  }, []);

  const scheduler = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const s = stateRef.current;
    const secondsPerBeat = 60.0 / s.bpm;
    const secondsPerSubBeat = secondsPerBeat / s.subdivision;

    while (nextBeatTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      scheduleNote(currentBeatRef.current, currentSubBeatRef.current, nextBeatTimeRef.current);
      nextBeatTimeRef.current += secondsPerSubBeat;

      currentSubBeatRef.current++;
      if (currentSubBeatRef.current >= s.subdivision) {
        currentSubBeatRef.current = 0;
        currentBeatRef.current = (currentBeatRef.current + 1) % s.beatsPerMeasure;
      }
    }
  }, [scheduleNote]);

  const start = useCallback(() => {
    const ctx = getAudioContext();
    currentBeatRef.current = 0;
    currentSubBeatRef.current = 0;
    nextBeatTimeRef.current = ctx.currentTime + 0.05;
    schedulerTimerRef.current = window.setInterval(scheduler, LOOKAHEAD_MS);
    setState(prev => {
      const newBeatVolumes = Array.from({ length: prev.beatsPerMeasure }, (_, i) =>
        prev.beatVolumes[i] !== undefined ? prev.beatVolumes[i]! : prev.volume
      );
      beatVolumesRef.current = newBeatVolumes;
      muteBeatsRef.current = prev.muteBeats;
      globalVolumeRef.current = prev.volume;
      return { ...prev, isPlaying: true, currentBeat: 0, currentSubBeat: 0, beatVolumes: newBeatVolumes };
    });
  }, [getAudioContext, scheduler]);

  const stop = useCallback(() => {
    if (schedulerTimerRef.current !== null) {
      clearInterval(schedulerTimerRef.current);
      schedulerTimerRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isPlaying: false,
      currentBeat: 0,
      currentSubBeat: 0,
      flashBeat: false,
    }));
  }, []);

  const toggle = useCallback(() => {
    if (stateRef.current.isPlaying) stop();
    else start();
  }, [start, stop]);

  const setBpm = useCallback((bpm: number) => {
    const clamped = Math.max(20, Math.min(300, Math.round(bpm)));
    setState(prev => ({ ...prev, bpm: clamped }));
  }, []);

  const setBeatsPerMeasure = useCallback((beats: number) => {
    setState(prev => {
      const newBeatVolumes = Array.from({ length: beats }, (_, i) =>
        prev.beatVolumes[i] !== undefined ? prev.beatVolumes[i]! : prev.volume
      );
      const newBeatLevels = Array.from({ length: beats }, (_, i) =>
        prev.beatLevels[i] !== undefined ? prev.beatLevels[i]! : 3 as BeatLevel
      );
      return { ...prev, beatsPerMeasure: beats, muteBeats: [], beatVolumes: newBeatVolumes, beatLevels: newBeatLevels };
    });
    currentBeatRef.current = 0;
    currentSubBeatRef.current = 0;
  }, []);

  const setBeatUnit = useCallback((unit: number) => {
    setState(prev => ({ ...prev, beatUnit: unit }));
  }, []);

  const setSubdivision = useCallback((sub: SubdivisionType) => {
    setState(prev => ({ ...prev, subdivision: sub }));
    currentSubBeatRef.current = 0;
  }, []);

  const setSoundType = useCallback((sound: SoundType) => {
    setState(prev => ({ ...prev, soundType: sound }));
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    globalVolumeRef.current = clamped;
    setState(prev => ({ ...prev, volume: clamped }));
  }, []);

  const setAccentFirstBeat = useCallback((accent: boolean) => {
    setState(prev => ({ ...prev, accentFirstBeat: accent }));
  }, []);

  const toggleMuteBeat = useCallback((beatIndex: number) => {
    muteBeatsRef.current = [...muteBeatsRef.current];
    muteBeatsRef.current[beatIndex] = !muteBeatsRef.current[beatIndex];
    setState(prev => {
      const newMute = [...prev.muteBeats];
      newMute[beatIndex] = !newMute[beatIndex];
      muteBeatsRef.current = newMute;
      return { ...prev, muteBeats: newMute };
    });
  }, []);

  // Set per-beat volume as ABSOLUTE value (0-1)
  const setBeatVolume = useCallback((beatIndex: number, vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    beatVolumesRef.current = [...beatVolumesRef.current];
    beatVolumesRef.current[beatIndex] = clamped;
    setState(prev => {
      const newVols = [...prev.beatVolumes];
      newVols[beatIndex] = clamped;
      beatVolumesRef.current = newVols;
      return { ...prev, beatVolumes: newVols };
    });
  }, []);

  // Set per-beat level (0=mute, 1=weak, 2=medium, 3=strong)
  const setBeatLevel = useCallback((beatIndex: number, level: BeatLevel) => {
    const vol = BEAT_LEVEL_VOLUMES[level];
    // Update volume ref synchronously
    beatVolumesRef.current = [...beatVolumesRef.current];
    beatVolumesRef.current[beatIndex] = vol;
    // Update mute ref synchronously
    muteBeatsRef.current = [...muteBeatsRef.current];
    muteBeatsRef.current[beatIndex] = level === 0;
    setState(prev => {
      const newVols = [...prev.beatVolumes];
      newVols[beatIndex] = vol;
      const newLevels = [...prev.beatLevels] as BeatLevels;
      newLevels[beatIndex] = level;
      const newMute = [...prev.muteBeats];
      newMute[beatIndex] = level === 0;
      beatVolumesRef.current = newVols;
      muteBeatsRef.current = newMute;
      return { ...prev, beatVolumes: newVols, beatLevels: newLevels, muteBeats: newMute };
    });
  }, []);

  // Cycle beat level: 3 → 2 → 1 → 0 → 3
  const cycleBeatLevel = useCallback((beatIndex: number) => {
    setState(prev => {
      const cur = (prev.beatLevels[beatIndex] ?? 3) as BeatLevel;
      const next = ((cur - 1 + 4) % 4) as BeatLevel;
      const vol = BEAT_LEVEL_VOLUMES[next];
      const newVols = [...prev.beatVolumes];
      newVols[beatIndex] = vol;
      const newLevels = [...prev.beatLevels] as BeatLevels;
      newLevels[beatIndex] = next;
      const newMute = [...prev.muteBeats];
      newMute[beatIndex] = next === 0;
      beatVolumesRef.current = newVols;
      muteBeatsRef.current = newMute;
      return { ...prev, beatVolumes: newVols, beatLevels: newLevels, muteBeats: newMute };
    });
  }, []);

  // Load a full preset state (for preset loading)
  const loadPreset = useCallback((preset: Partial<BeatState>) => {
    setState(prev => {
      const merged = { ...prev, ...preset };
      // Sync refs
      if (preset.beatVolumes) beatVolumesRef.current = preset.beatVolumes as number[];
      if (preset.muteBeats) muteBeatsRef.current = preset.muteBeats;
      if (preset.volume !== undefined) globalVolumeRef.current = preset.volume;
      return merged;
    });
  }, []);

  const tapTempo = useCallback(() => {
    const now = Date.now();
    setState(prev => {
      const history = [...prev.tapTempoHistory, now].filter(t => now - t < 3000).slice(-8);
      if (history.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < history.length; i++) intervals.push(history[i] - history[i - 1]);
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const newBpm = Math.round(60000 / avgInterval);
        const clamped = Math.max(20, Math.min(300, newBpm));
        return { ...prev, bpm: clamped, tapTempoHistory: history };
      }
      return { ...prev, tapTempoHistory: history };
    });
  }, []);

  useEffect(() => {
    if (state.isPlaying) {
      if (schedulerTimerRef.current !== null) clearInterval(schedulerTimerRef.current);
      schedulerTimerRef.current = window.setInterval(scheduler, LOOKAHEAD_MS);
    }
  }, [state.bpm, state.subdivision, state.beatsPerMeasure, state.isPlaying, scheduler]);

  useEffect(() => {
    return () => {
      if (schedulerTimerRef.current !== null) clearInterval(schedulerTimerRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  return {
    state,
    toggle,
    start,
    stop,
    setBpm,
    setBeatsPerMeasure,
    setBeatUnit,
    setSubdivision,
    setSoundType,
    setVolume,
    setAccentFirstBeat,
    toggleMuteBeat,
    setBeatVolume,
    setBeatLevel,
    cycleBeatLevel,
    loadPreset,
    tapTempo,
  };
}
