/* ============================================================
 * Home Page — Jacob's Beat Keeper
 * Design: Wide-screen layout with controls flanking the visualizer
 * - Left flank: Beat level ring buttons (4-level: strong/medium/weak/mute)
 * - Center: Visualizer (full size, unobstructed)
 * - Right flank: BPM knob + controls
 * - Right panel: Status / Quick BPM / Tempo Guide / Practice Timer / Records / Presets
 * ============================================================ */

import { BeatVisualizer } from "@/components/BeatVisualizer";
import { BpmKnob } from "@/components/BpmKnob";
import { Pendulum } from "@/components/Pendulum";
import { useMetronome, BEAT_LEVEL_LABELS, BEAT_LEVEL_VOLUMES, type BeatLevel, type BeatState } from "@/hooks/useMetronome";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  Minus,
  Music2,
  Palette,
  Play,
  Plus,
  Save,
  Settings,
  Square,
  Trash2,
  Zap,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

// ─── Constants ──────────────────────────────────────────────────────────────
const TEMPO_MARKINGS = [
  { name: "Larghissimo", min: 20, max: 24 },
  { name: "Grave", min: 25, max: 45 },
  { name: "Largo", min: 46, max: 60 },
  { name: "Larghetto", min: 61, max: 66 },
  { name: "Adagio", min: 67, max: 76 },
  { name: "Andante", min: 77, max: 108 },
  { name: "Moderato", min: 109, max: 120 },
  { name: "Allegretto", min: 121, max: 156 },
  { name: "Allegro", min: 157, max: 176 },
  { name: "Vivace", min: 177, max: 200 },
  { name: "Presto", min: 201, max: 240 },
  { name: "Prestissimo", min: 241, max: 300 },
];

function getTempoMarking(bpm: number): string {
  return TEMPO_MARKINGS.find(t => bpm >= t.min && bpm <= t.max)?.name ?? "Allegro";
}

const SOUND_OPTIONS = [
  { value: "click", label: "Click" },
  { value: "woodblock", label: "Wood" },
  { value: "beep", label: "Beep" },
  { value: "cowbell", label: "Cowbell" },
  { value: "hihat", label: "Hi-Hat" },
  { value: "voice", label: "1-2-3-4" },
] as const;

const SUBDIVISION_OPTIONS = [
  { value: 1, label: "1×", desc: "Beat" },
  { value: 2, label: "2×", desc: "8th" },
  { value: 3, label: "3×", desc: "Triplet" },
  { value: 4, label: "4×", desc: "16th" },
] as const;

// ─── Beat Level Colors ───────────────────────────────────────────────────────
// 四级颜色：强=主题强调色, 次强=主题次色, 弱=蓝灰, 静音=暗红/灰
const BEAT_LEVEL_COLORS = (theme: Theme): Record<BeatLevel, string> => ({
  3: theme.beatAccent,          // 强 - 主题强调色（最亮）
  2: theme.beatActive,          // 次强 - 主题活跃色
  1: "#6B8CAE",                 // 弱 - 蓝灰色
  0: "rgba(120,40,40,0.7)",     // 静音 - 暗红
});

const BEAT_LEVEL_RING_COLORS = (theme: Theme): Record<BeatLevel, string> => ({
  3: theme.beatAccent,
  2: theme.beatActive,
  1: "#4A6A8A",
  0: "rgba(100,30,30,0.5)",
});

// ─── Theme System ───────────────────────────────────────────────────────────
type ThemeId = "wildfire" | "midnight" | "aurora" | "steel";

interface Theme {
  id: ThemeId;
  name: string;
  nameEn: string;
  subtitle: string;
  accent: string;
  accentAlt: string;
  accentGlow: string;
  bg: string;
  panelBg: string;
  panelBorder: string;
  beatActive: string;
  beatAccent: string;
  selectedBg: string;
  selectedBorder: string;
  switchBg: string;
}

const THEMES: Theme[] = [
  {
    id: "wildfire",
    name: "野火燎原",
    nameEn: "Prairie Fire",
    subtitle: "Prairie Fire · Professional Metronome",
    accent: "#FF4D1A",
    accentAlt: "#FF8C00",
    accentGlow: "rgba(255,77,26,",
    bg: "radial-gradient(ellipse at 50% 30%, rgba(40,12,5,0.6) 0%, rgba(12,8,18,1) 60%)",
    panelBg: "rgba(20,8,4,0.5)",
    panelBorder: "rgba(255,77,26,0.06)",
    beatActive: "#FF4D1A",
    beatAccent: "#FFB800",
    selectedBg: "rgba(255,77,26,0.18)",
    selectedBorder: "rgba(255,77,26,0.45)",
    switchBg: "rgba(255,77,26,0.7)",
  },
  {
    id: "midnight",
    name: "深夜极光",
    nameEn: "Midnight Aurora",
    subtitle: "Midnight Aurora · Professional Metronome",
    accent: "#00C9FF",
    accentAlt: "#7B2FBE",
    accentGlow: "rgba(0,201,255,",
    bg: "radial-gradient(ellipse at 50% 30%, rgba(5,15,40,0.7) 0%, rgba(8,5,20,1) 65%)",
    panelBg: "rgba(5,10,30,0.5)",
    panelBorder: "rgba(0,201,255,0.06)",
    beatActive: "#00C9FF",
    beatAccent: "#7B2FBE",
    selectedBg: "rgba(0,201,255,0.18)",
    selectedBorder: "rgba(0,201,255,0.45)",
    switchBg: "rgba(0,201,255,0.7)",
  },
  {
    id: "aurora",
    name: "翠影流光",
    nameEn: "Jade Aurora",
    subtitle: "Jade Aurora · Professional Metronome",
    accent: "#00E5A0",
    accentAlt: "#00B4D8",
    accentGlow: "rgba(0,229,160,",
    bg: "radial-gradient(ellipse at 50% 30%, rgba(5,30,20,0.6) 0%, rgba(6,12,15,1) 65%)",
    panelBg: "rgba(4,18,14,0.5)",
    panelBorder: "rgba(0,229,160,0.06)",
    beatActive: "#00E5A0",
    beatAccent: "#00B4D8",
    selectedBg: "rgba(0,229,160,0.18)",
    selectedBorder: "rgba(0,229,160,0.45)",
    switchBg: "rgba(0,229,160,0.7)",
  },
  {
    id: "steel",
    name: "钢铁意志",
    nameEn: "Iron Will",
    subtitle: "Iron Will · Professional Metronome",
    accent: "#A8B2C0",
    accentAlt: "#6B7A8D",
    accentGlow: "rgba(168,178,192,",
    bg: "radial-gradient(ellipse at 50% 30%, rgba(20,22,28,0.7) 0%, rgba(10,10,14,1) 65%)",
    panelBg: "rgba(14,16,22,0.5)",
    panelBorder: "rgba(168,178,192,0.06)",
    beatActive: "#A8B2C0",
    beatAccent: "#6B7A8D",
    selectedBg: "rgba(168,178,192,0.15)",
    selectedBorder: "rgba(168,178,192,0.35)",
    switchBg: "rgba(168,178,192,0.6)",
  },
];

// ─── Preset Types ────────────────────────────────────────────────────────────
interface MetronomePreset {
  id: string;
  name: string;
  bpm: number;
  beatsPerMeasure: number;
  beatUnit: number;
  subdivision: number;
  soundType: string;
  volume: number;
  accentFirstBeat: boolean;
  beatLevels: (BeatLevel | undefined)[];
  createdAt: number;
}

// ─── Practice Record Types ───────────────────────────────────────────────────
interface PracticeRecord {
  id: string;
  date: string;
  duration: number; // seconds
  bpm: number;
  timeSignature: string;
  soundType: string;
  sessionIndex?: number; // 练习次数序号
}

const STORAGE_KEY_PRESETS = "metronome_presets_v1";
const STORAGE_KEY_RECORDS = "metronome_records_v1";

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  return fallback;
}

function saveToStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type ActivePanel = "settings" | "trainer" | null;
type RightTab = "status" | "records" | "presets";

export default function Home() {
  const {
    state,
    toggle,
    setBpm,
    setBeatsPerMeasure,
    setBeatUnit,
    setSubdivision,
    setSoundType,
    setVolume,
    setAccentFirstBeat,
    toggleMuteBeat,
    setBeatVolume,
    cycleBeatLevel,
    setBeatLevel,
    loadPreset,
    tapTempo,
  } = useMetronome();

  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [trainerConfig, setTrainerConfig] = useState({
    startBpm: 80,
    targetBpm: 160,
    barsPerStep: 4,
    bpmIncrement: 5,
  });
  const [trainerActive, setTrainerActive] = useState(false);
  const [trainerBarsElapsed, setTrainerBarsElapsed] = useState(0);
  const [trainerStep, setTrainerStep] = useState(0);
  const [viewMode, setViewMode] = useState<"circle" | "pendulum">("circle");
  const [themeId, setThemeId] = useState<ThemeId>("wildfire");
  const theme = THEMES.find(t => t.id === themeId) ?? THEMES[0];
  const levelColors = BEAT_LEVEL_COLORS(theme);
  const levelRingColors = BEAT_LEVEL_RING_COLORS(theme);

  // ─── Right panel tab ────────────────────────────────────────────────────
  const [rightTab, setRightTab] = useState<RightTab>("status");

  // ─── Practice Timer ──────────────────────────────────────────────────────
  const [practiceSeconds, setPracticeSeconds] = useState(0);
  const practiceTimerRef = useRef<number | null>(null);
  const practiceStartRef = useRef<number>(0);

  useEffect(() => {
    if (state.isPlaying) {
      practiceStartRef.current = Date.now() - practiceSeconds * 1000;
      practiceTimerRef.current = window.setInterval(() => {
        setPracticeSeconds(Math.floor((Date.now() - practiceStartRef.current) / 1000));
      }, 1000);
    } else {
      if (practiceTimerRef.current !== null) {
        clearInterval(practiceTimerRef.current);
        practiceTimerRef.current = null;
      }
    }
    return () => {
      if (practiceTimerRef.current !== null) clearInterval(practiceTimerRef.current);
    };
  }, [state.isPlaying]);

  // ─── Practice Records ────────────────────────────────────────────────────
  const [records, setRecords] = useState<PracticeRecord[]>(() =>
    loadFromStorage<PracticeRecord[]>(STORAGE_KEY_RECORDS, [])
  );
  const prevIsPlayingRef = useRef(false);

  useEffect(() => {
    // When stopping, save record if practiced >= 5 seconds
    if (prevIsPlayingRef.current && !state.isPlaying && practiceSeconds >= 5) {
      setRecords(prev => {
        // 计算练习次数：已有记录中最大序号 + 1
        const maxIndex = prev.reduce((max, r) => Math.max(max, r.sessionIndex ?? 0), 0);
        const record: PracticeRecord = {
          id: Date.now().toString(),
          date: new Date().toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
          duration: practiceSeconds,
          bpm: state.bpm,
          timeSignature: `${state.beatsPerMeasure}/${state.beatUnit}`,
          soundType: SOUND_OPTIONS.find(s => s.value === state.soundType)?.label ?? state.soundType,
          sessionIndex: maxIndex + 1,
        };
        const updated = [record, ...prev].slice(0, 50);
        saveToStorage(STORAGE_KEY_RECORDS, updated);
        return updated;
      });
      setPracticeSeconds(0);
    }
    prevIsPlayingRef.current = state.isPlaying;
  }, [state.isPlaying]);

  const deleteRecord = useCallback((id: string) => {
    setRecords(prev => {
      const updated = prev.filter(r => r.id !== id);
      saveToStorage(STORAGE_KEY_RECORDS, updated);
      return updated;
    });
  }, []);

  const clearAllRecords = useCallback(() => {
    setRecords([]);
    saveToStorage(STORAGE_KEY_RECORDS, []);
  }, []);

  // ─── Presets ─────────────────────────────────────────────────────────────
  const [presets, setPresets] = useState<MetronomePreset[]>(() =>
    loadFromStorage<MetronomePreset[]>(STORAGE_KEY_PRESETS, [])
  );
  const [presetName, setPresetName] = useState("");
  const [showPresetInput, setShowPresetInput] = useState(false);

  const savePreset = useCallback(() => {
    const name = presetName.trim() || `${state.bpm}BPM ${state.beatsPerMeasure}/${state.beatUnit}`;
    const preset: MetronomePreset = {
      id: Date.now().toString(),
      name,
      bpm: state.bpm,
      beatsPerMeasure: state.beatsPerMeasure,
      beatUnit: state.beatUnit,
      subdivision: state.subdivision,
      soundType: state.soundType,
      volume: state.volume,
      accentFirstBeat: state.accentFirstBeat,
      beatLevels: [...state.beatLevels],
      createdAt: Date.now(),
    };
    setPresets(prev => {
      const updated = [preset, ...prev].slice(0, 20);
      saveToStorage(STORAGE_KEY_PRESETS, updated);
      return updated;
    });
    setPresetName("");
    setShowPresetInput(false);
  }, [state, presetName]);

  const applyPreset = useCallback((preset: MetronomePreset) => {
    const beatLevels = preset.beatLevels ?? [];
    const beatVolumes = Array.from({ length: preset.beatsPerMeasure }, (_, i) => {
      const lvl = (beatLevels[i] ?? 3) as BeatLevel;
      return BEAT_LEVEL_VOLUMES[lvl];
    });
    const muteBeats = Array.from({ length: preset.beatsPerMeasure }, (_, i) =>
      (beatLevels[i] ?? 3) === 0
    );
    loadPreset({
      bpm: preset.bpm,
      beatsPerMeasure: preset.beatsPerMeasure,
      beatUnit: preset.beatUnit as 2 | 4 | 8 | 16,
      subdivision: preset.subdivision as 1 | 2 | 3 | 4,
      soundType: preset.soundType as any,
      volume: preset.volume,
      accentFirstBeat: preset.accentFirstBeat,
      beatLevels: beatLevels as any,
      beatVolumes,
      muteBeats,
    });
  }, [loadPreset]);

  const deletePreset = useCallback((id: string) => {
    setPresets(prev => {
      const updated = prev.filter(p => p.id !== id);
      saveToStorage(STORAGE_KEY_PRESETS, updated);
      return updated;
    });
  }, []);

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") { e.preventDefault(); toggle(); }
      else if (e.code === "ArrowUp") { e.preventDefault(); setBpm(state.bpm + 1); }
      else if (e.code === "ArrowDown") { e.preventDefault(); setBpm(state.bpm - 1); }
      else if (e.code === "KeyT") { tapTempo(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [toggle, setBpm, state.bpm, tapTempo]);

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel(prev => prev === panel ? null : panel);
  };

  // ─── Trainer ─────────────────────────────────────────────────────────────
  const startTrainer = useCallback(() => {
    setBpm(trainerConfig.startBpm);
    setTrainerActive(true);
    setTrainerStep(0);
    setTrainerBarsElapsed(0);
  }, [trainerConfig.startBpm, setBpm]);

  const stopTrainer = useCallback(() => {
    setTrainerActive(false);
    setTrainerStep(0);
    setTrainerBarsElapsed(0);
  }, []);

  const [prevBeatForTrainer, setPrevBeatForTrainer] = useState(-1);
  useEffect(() => {
    if (!trainerActive || !state.isPlaying) return;
    if (state.currentBeat === 0 && prevBeatForTrainer === state.beatsPerMeasure - 1) {
      setTrainerBarsElapsed(b => {
        const next = b + 1;
        if (next >= trainerConfig.barsPerStep) {
          const nextBpm = state.bpm + trainerConfig.bpmIncrement;
          if (nextBpm <= trainerConfig.targetBpm) {
            setBpm(nextBpm);
            setTrainerStep(s => s + 1);
          } else {
            setTrainerActive(false);
          }
          return 0;
        }
        return next;
      });
    }
    setPrevBeatForTrainer(state.currentBeat);
  }, [state.currentBeat, state.isPlaying, trainerActive, prevBeatForTrainer, state.beatsPerMeasure, state.bpm, trainerConfig]);

  const tempoMarking = getTempoMarking(state.bpm);

  // ─── Helper: themed button style ─────────────────────────────────────────
  const themedBtn = (active: boolean) => ({
    background: active ? theme.selectedBg : "rgba(255,255,255,0.04)",
    border: active ? `1px solid ${theme.selectedBorder}` : "1px solid rgba(255,255,255,0.06)",
    boxShadow: active ? `0 0 12px ${theme.accentGlow}0.15)` : "none",
  });

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: theme.bg }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-3"
        style={{ borderBottom: `1px solid ${theme.panelBorder}` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentAlt})` }}
          >
            <Music2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-white/90">{theme.name}</h1>
            <p className="text-xs text-white/35 font-mono-tech">{theme.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Practice timer display in header */}
          {state.isPlaying && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: `${theme.accentGlow}0.12)`, border: `1px solid ${theme.accentGlow}0.25)` }}>
              <Clock className="w-3.5 h-3.5" style={{ color: theme.accent }} />
              <span className="text-sm font-mono-tech" style={{ color: theme.accent }}>{formatDuration(practiceSeconds)}</span>
            </div>
          )}
          <button
            onClick={() => setViewMode(v => v === "circle" ? "pendulum" : "circle")}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {viewMode === "circle" ? "Pendulum" : "Circle"}
          </button>
          <div className="hidden md:flex items-center gap-1 text-xs text-white/25">
            <kbd className="px-1.5 py-0.5 rounded text-xs bg-white/5 border border-white/10">Space</kbd>
            <span>Play</span>
            <kbd className="px-1.5 py-0.5 rounded text-xs bg-white/5 border border-white/10 ml-2">T</kbd>
            <span>Tap</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden min-h-0">

        {/* ═══════ Left Panel (settings) ═══════ */}
        <aside
          className="lg:w-64 xl:w-72 flex flex-col gap-0 overflow-y-auto shrink-0"
          style={{
            background: theme.panelBg,
            borderRight: `1px solid ${theme.panelBorder}`,
          }}
        >
          {/* Time Signature */}
          <div className="p-4" style={{ borderBottom: `1px solid ${theme.panelBorder}` }}>
            <span className="text-xs font-semibold uppercase tracking-widest text-white/40 block mb-3">Time Signature</span>
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <button onClick={() => setBeatsPerMeasure(Math.min(12, state.beatsPerMeasure + 1))} className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-white/10 text-white/50 hover:text-white">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <div className="w-14 h-14 rounded-xl flex items-center justify-center font-bpm text-3xl text-white" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {state.beatsPerMeasure}
                </div>
                <button onClick={() => setBeatsPerMeasure(Math.max(1, state.beatsPerMeasure - 1))} className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-white/10 text-white/50 hover:text-white">
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <span className="text-2xl text-white/20 font-light">/</span>
              <div className="flex flex-col items-center gap-1">
                <button onClick={() => { const idx = [2,4,8,16].indexOf(state.beatUnit); if (idx < 3) setBeatUnit([2,4,8,16][idx+1] as 2|4|8|16); }} className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-white/10 text-white/50 hover:text-white">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <div className="w-14 h-14 rounded-xl flex items-center justify-center font-bpm text-3xl text-white" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {state.beatUnit}
                </div>
                <button onClick={() => { const idx = [2,4,8,16].indexOf(state.beatUnit); if (idx > 0) setBeatUnit([2,4,8,16][idx-1] as 2|4|8|16); }} className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-white/10 text-white/50 hover:text-white">
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Subdivision */}
          <div className="p-4" style={{ borderBottom: `1px solid ${theme.panelBorder}` }}>
            <span className="text-xs font-semibold uppercase tracking-widest text-white/40 block mb-3">Subdivision</span>
            <div className="grid grid-cols-4 gap-1.5">
              {SUBDIVISION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSubdivision(opt.value as 1|2|3|4)}
                  className={cn("flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl text-xs font-medium transition-all", state.subdivision === opt.value ? "text-white" : "text-white/40 hover:text-white/70")}
                  style={themedBtn(state.subdivision === opt.value)}
                >
                  <span className="text-sm leading-none">{opt.value}x</span>
                  <span className="text-white/40 text-[9px]">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sound */}
          <div className="p-4" style={{ borderBottom: `1px solid ${theme.panelBorder}` }}>
            <span className="text-xs font-semibold uppercase tracking-widest text-white/40 block mb-3">Sound</span>
            <div className="flex flex-wrap gap-1.5">
              {SOUND_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSoundType(opt.value)}
                  className={cn("px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all", state.soundType === opt.value ? "text-white" : "text-white/40 hover:text-white/70")}
                  style={themedBtn(state.soundType === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Volume */}
          <div className="p-4" style={{ borderBottom: `1px solid ${theme.panelBorder}` }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-white/40">Volume</span>
              <span className="text-xs font-mono-tech text-white/50">{Math.round(state.volume * 100)}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.01" value={state.volume} onChange={e => setVolume(parseFloat(e.target.value))} className="w-full" style={{ accentColor: theme.accent }} />
          </div>

          {/* Accent toggle */}
          <div className="p-4" style={{ borderBottom: `1px solid ${theme.panelBorder}` }}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-white/40 block">Accent Beat 1</span>
                <span className="text-[10px] text-white/25 mt-0.5">Emphasize the first beat</span>
              </div>
              <button
                onClick={() => setAccentFirstBeat(!state.accentFirstBeat)}
                className="relative w-11 h-6 rounded-full transition-all duration-300"
                style={{
                  background: state.accentFirstBeat ? theme.switchBg : "rgba(255,255,255,0.1)",
                  boxShadow: state.accentFirstBeat ? `0 0 10px ${theme.accentGlow}0.3)` : "none",
                }}
              >
                <div className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-300", state.accentFirstBeat ? "left-[22px]" : "left-0.5")} />
              </button>
            </div>
          </div>

          {/* Theme Selector */}
          <div className="p-4" style={{ borderBottom: `1px solid ${theme.panelBorder}` }}>
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-3.5 h-3.5 text-white/40" />
              <span className="text-xs font-semibold uppercase tracking-widest text-white/40">Theme</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setThemeId(t.id)}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: themeId === t.id ? `linear-gradient(135deg, ${t.accent}22, ${t.accentAlt}11)` : "rgba(255,255,255,0.04)",
                    border: themeId === t.id ? `1px solid ${t.accent}55` : "1px solid rgba(255,255,255,0.07)",
                    boxShadow: themeId === t.id ? `0 0 10px ${t.accent}22` : "none",
                  }}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accentAlt})` }} />
                  <div className="text-left min-w-0">
                    <div className="text-[11px] font-semibold leading-tight truncate" style={{ color: themeId === t.id ? t.accent : "rgba(255,255,255,0.5)" }}>{t.name}</div>
                    <div className="text-[9px] text-white/25 leading-tight truncate">{t.nameEn}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Panel toggles */}
          <div className="p-3 flex gap-2">
            <button
              onClick={() => togglePanel("settings")}
              className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all", activePanel === "settings" ? "text-white" : "text-white/40 hover:text-white/70")}
              style={{ background: activePanel === "settings" ? theme.selectedBg : "rgba(255,255,255,0.04)", border: activePanel === "settings" ? `1px solid ${theme.selectedBorder}` : "1px solid rgba(255,255,255,0.08)" }}
            >
              <Settings className="w-3.5 h-3.5" /> Settings
            </button>
            <button
              onClick={() => togglePanel("trainer")}
              className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all", activePanel === "trainer" ? "text-white" : "text-white/40 hover:text-white/70")}
              style={{ background: activePanel === "trainer" ? theme.selectedBg : "rgba(255,255,255,0.04)", border: activePanel === "trainer" ? `1px solid ${theme.selectedBorder}` : "1px solid rgba(255,255,255,0.08)" }}
            >
              <Zap className="w-3.5 h-3.5" /> Trainer
            </button>
          </div>

          {/* Trainer panel */}
          <AnimatePresence>
            {activePanel === "trainer" && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="px-4 pb-4 space-y-3">
                  <div className="p-3 rounded-xl" style={{ background: `${theme.accentGlow}0.06)`, border: `1px solid ${theme.accentGlow}0.15)` }}>
                    <div className="text-xs text-white/50 mb-1">Tempo Trainer</div>
                    <div className="text-[10px] text-white/30">Gradually increases BPM every N bars</div>
                  </div>
                  {[
                    { label: "Start BPM", key: "startBpm", min: 20, max: 200 },
                    { label: "Target BPM", key: "targetBpm", min: 40, max: 300 },
                    { label: "Bars per Step", key: "barsPerStep", min: 1, max: 32 },
                    { label: "BPM Increment", key: "bpmIncrement", min: 1, max: 20 },
                  ].map(field => (
                    <div key={field.key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-white/50">{field.label}</span>
                        <span className="text-xs font-mono-tech text-white/70">{trainerConfig[field.key as keyof typeof trainerConfig]}</span>
                      </div>
                      <input type="range" min={field.min} max={field.max} value={trainerConfig[field.key as keyof typeof trainerConfig]} onChange={e => setTrainerConfig(prev => ({ ...prev, [field.key]: parseInt(e.target.value) }))} className="w-full" style={{ accentColor: theme.accent }} />
                    </div>
                  ))}
                  {trainerActive && (
                    <div className="p-3 rounded-xl" style={{ background: `${theme.accentGlow}0.06)`, border: `1px solid ${theme.accentGlow}0.2)` }}>
                      <div className="text-xs" style={{ color: theme.accentAlt }}>Step {trainerStep + 1} · {trainerBarsElapsed}/{trainerConfig.barsPerStep} bars</div>
                      <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${(trainerBarsElapsed / trainerConfig.barsPerStep) * 100}%`, background: `linear-gradient(90deg, ${theme.accent}, ${theme.accentAlt})` }} />
                      </div>
                    </div>
                  )}
                  <button
                    onClick={trainerActive ? stopTrainer : startTrainer}
                    className="w-full py-2 rounded-xl text-sm font-medium transition-all text-white"
                    style={{ background: trainerActive ? `${theme.accentGlow}0.15)` : `linear-gradient(135deg, ${theme.accentGlow}0.3), ${theme.accentGlow}0.15))`, border: `1px solid ${theme.selectedBorder}` }}
                  >
                    {trainerActive ? "Stop Trainer" : "Start Trainer"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>

        {/* ═══════ Center: Main Metronome Display ═══════ */}
        <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden min-h-0">

          {/* Background texture */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(https://d2xsxph8kpxj0f.cloudfront.net/310519663438453918/nboUVQGK9KphELCqdZx4Tn/sound-wave-pattern-7MnNXACQgWFesAmR6kcAQL.webp)`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: 0.04,
              mixBlendMode: "screen",
            }}
          />
          {/* Radial glow when playing */}
          {state.isPlaying && (
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-500"
              style={{ background: `radial-gradient(ellipse 60% 50% at 50% 45%, ${theme.accentGlow}0.08) 0%, transparent 70%)` }}
            />
          )}

          {/* ── Wide layout: BPM + Visualizer + Controls spread horizontally ── */}
          <div className="relative z-10 flex flex-col items-center w-full max-w-5xl px-4 py-4 gap-3">

            {/* BPM Display — top center */}
            <div className="text-center">
              <div className="relative inline-block">
                <motion.div
                  key={state.bpm}
                  initial={{ opacity: 0.7, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.1 }}
                  className="font-bpm leading-none select-none"
                  style={{
                    fontSize: "clamp(64px, 10vw, 120px)",
                    color: state.flashBeat ? theme.accent : "white",
                    textShadow: state.flashBeat
                      ? `0 0 40px ${theme.accentGlow}0.6), 0 0 80px ${theme.accentGlow}0.3)`
                      : "0 0 20px rgba(255,255,255,0.08)",
                    transition: "color 0.08s ease, text-shadow 0.08s ease",
                  }}
                >
                  {state.bpm}
                </motion.div>
                {state.isPlaying && (
                  <motion.div
                    className="absolute -right-3 top-2 w-2 h-2 rounded-full"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 60 / state.bpm, repeat: Infinity }}
                    style={{ background: theme.accent, boxShadow: `0 0 8px ${theme.accent}` }}
                  />
                )}
              </div>
              <div className="flex items-center justify-center gap-3 mt-0.5">
                <span className="text-sm text-white/30 font-mono-tech tracking-widest">BPM</span>
                <span className="text-sm italic transition-colors duration-300" style={{ color: state.isPlaying ? theme.accentAlt : "rgba(255,255,255,0.4)" }}>
                  {tempoMarking}
                </span>
              </div>
            </div>

            {/* ── Middle row: Beat controls | Visualizer | BPM knob ── */}
            <div className="flex items-center justify-center gap-6 lg:gap-10 w-full">

              {/* Left flank: Beat level buttons (vertical stack) */}
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Beats</span>
                {Array.from({ length: state.beatsPerMeasure }).map((_, i) => {
                  const isActive = i === state.currentBeat && state.isPlaying;
                  const level = (state.beatLevels[i] ?? 3) as BeatLevel;
                  const isMuted = level === 0;
                  const dotColor = levelColors[level];
                  const ringColor = levelRingColors[level];
                  const ringR = 16;
                  const ringC = 2 * Math.PI * ringR;
                  // Ring fill: 强=100%, 次强=75%, 弱=40%, 静音=0%
                  const ringFillPct = [0, 40, 75, 100][level];
                  const ringOffset = ringC - (ringC * ringFillPct / 100);
                  const levelLabel = BEAT_LEVEL_LABELS[level];

                  return (
                    <div key={i} className="relative group" style={{ width: 44, height: 44 }}>
                      {/* SVG ring */}
                      <svg width={44} height={44} className="absolute inset-0">
                        <circle cx={22} cy={22} r={ringR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={2.5} />
                        <circle
                          cx={22} cy={22} r={ringR} fill="none"
                          stroke={isActive && !isMuted ? dotColor : ringColor}
                          strokeWidth={2.5}
                          strokeDasharray={ringC}
                          strokeDashoffset={ringOffset}
                          strokeLinecap="round"
                          transform={`rotate(-90 22 22)`}
                          style={{
                            transition: "stroke-dashoffset 0.15s, stroke 0.15s",
                            filter: isActive && !isMuted ? `drop-shadow(0 0 5px ${dotColor})` : "none",
                            opacity: isMuted ? 0.3 : 1,
                          }}
                        />
                      </svg>
                      {/* Center button */}
                      <motion.button
                        onClick={() => cycleBeatLevel(i)}
                        animate={isActive && !isMuted ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                        transition={{ duration: 0.12 }}
                        className="absolute inset-0 m-auto flex items-center justify-center rounded-full cursor-pointer"
                        style={{
                          width: 30, height: 30,
                          background: isMuted
                            ? "rgba(80,20,20,0.4)"
                            : isActive
                              ? dotColor
                              : `${dotColor}22`,
                          boxShadow: isActive && !isMuted ? `0 0 14px ${dotColor}` : "none",
                          border: `1px solid ${isMuted ? "rgba(120,40,40,0.4)" : dotColor + "55"}`,
                          transition: "background 0.2s, box-shadow 0.15s",
                        }}
                        title={`拍 ${i+1}: ${levelLabel} · 点击切换等级`}
                      >
                        <span style={{
                          fontFamily: "'Bebas Neue', sans-serif",
                          fontSize: 11,
                          lineHeight: 1,
                          color: isMuted ? "rgba(200,80,80,0.7)" : isActive ? "white" : "rgba(255,255,255,0.7)",
                        }}>
                          {isMuted ? "✕" : i + 1}
                        </span>
                      </motion.button>
                      {/* Level label tooltip on hover */}
                      <div className="absolute -right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <div className="px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap" style={{ background: "rgba(0,0,0,0.8)", color: dotColor, border: `1px solid ${dotColor}44` }}>
                          {levelLabel}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* Level legend */}
                <div className="mt-1 flex flex-col gap-0.5">
                  {([3, 2, 1, 0] as BeatLevel[]).map(lvl => (
                    <div key={lvl} className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: levelColors[lvl], opacity: lvl === 0 ? 0.4 : 1 }} />
                      <span className="text-[8px] text-white/25">{BEAT_LEVEL_LABELS[lvl]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Center: Visualizer (full size, unobstructed) */}
              <div className="relative" style={{ width: "min(340px, 50vw)", height: "min(340px, 50vw)" }}>
                {viewMode === "circle" ? (
                  <BeatVisualizer
                    currentBeat={state.currentBeat}
                    beatsPerMeasure={state.beatsPerMeasure}
                    subdivision={state.subdivision}
                    currentSubBeat={state.currentSubBeat}
                    isPlaying={state.isPlaying}
                    flashBeat={state.flashBeat}
                    accentFirstBeat={state.accentFirstBeat}
                    bpm={state.bpm}
                    muteBeats={state.muteBeats}
                    accentColor={theme.accent}
                    accentAltColor={theme.accentAlt}
                  />
                ) : (
                  <Pendulum
                    bpm={state.bpm}
                    isPlaying={state.isPlaying}
                    flashBeat={state.flashBeat}
                    currentBeat={state.currentBeat}
                    beatsPerMeasure={state.beatsPerMeasure}
                    accentFirstBeat={state.accentFirstBeat}
                    accentColor={theme.accent}
                    accentAltColor={theme.accentAlt}
                  />
                )}
              </div>

              {/* Right flank: BPM knob + fine controls */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Tempo</span>
                <button
                  onClick={() => setBpm(state.bpm + 1)}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-white/10 text-white/50 hover:text-white"
                  style={{ border: `1px solid ${theme.panelBorder}` }}
                >
                  <Plus className="w-4 h-4" />
                </button>
                <BpmKnob bpm={state.bpm} onChange={setBpm} accentColor={theme.accent} accentGlow={theme.accentGlow} />
                <button
                  onClick={() => setBpm(state.bpm - 1)}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-white/10 text-white/50 hover:text-white"
                  style={{ border: `1px solid ${theme.panelBorder}` }}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="flex flex-col gap-1 mt-1">
                  <button onClick={() => setBpm(state.bpm + 5)} className="px-2 py-1 rounded-md text-[10px] font-mono-tech transition-all hover:bg-white/10 text-white/40 hover:text-white" style={{ border: `1px solid ${theme.panelBorder}` }}>+5</button>
                  <button onClick={() => setBpm(state.bpm - 5)} className="px-2 py-1 rounded-md text-[10px] font-mono-tech transition-all hover:bg-white/10 text-white/40 hover:text-white" style={{ border: `1px solid ${theme.panelBorder}` }}>−5</button>
                </div>
              </div>
            </div>

            {/* BPM Slider — full width below */}
            <div className="w-full max-w-lg">
              <div className="flex justify-between text-[10px] text-white/20 mb-1 font-mono-tech px-1">
                <span>20</span>
                <span>160</span>
                <span>300</span>
              </div>
              <input type="range" min="20" max="300" value={state.bpm} onChange={e => setBpm(parseInt(e.target.value))} className="w-full" style={{ accentColor: theme.accent }} />
            </div>

            {/* Control Buttons — bottom row */}
            <div className="flex items-center gap-5">
              {/* Tap Tempo */}
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={tapTempo}
                className="px-5 py-3 rounded-2xl text-sm font-semibold transition-all"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${theme.panelBorder}`,
                  color: "rgba(255,255,255,0.8)",
                  minWidth: 100,
                }}
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Tap
                </div>
              </motion.button>

              {/* Play/Stop */}
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={toggle}
                className="relative w-18 h-18 rounded-full flex items-center justify-center transition-all"
                style={{
                  width: 72, height: 72,
                  background: state.isPlaying
                    ? `linear-gradient(135deg, ${theme.accent}, ${theme.accentAlt})`
                    : `linear-gradient(135deg, ${theme.accent}cc, ${theme.accentAlt}bb)`,
                  boxShadow: state.isPlaying
                    ? `0 0 30px ${theme.accentGlow}0.5), 0 0 60px ${theme.accentGlow}0.25), inset 0 1px 0 rgba(255,255,255,0.2)`
                    : `0 0 15px ${theme.accentGlow}0.3), inset 0 1px 0 rgba(255,255,255,0.15)`,
                }}
              >
                {state.isPlaying ? (
                  <Square className="w-6 h-6 text-white fill-white" />
                ) : (
                  <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                )}
                {state.isPlaying && (
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 60 / state.bpm, repeat: Infinity, ease: "easeOut" }}
                    style={{ border: `2px solid ${theme.accentGlow}0.5)` }}
                  />
                )}
              </motion.button>

              {/* Tap BPM display */}
              <div className="text-center" style={{ minWidth: 100 }}>
                <div className="text-[10px] uppercase tracking-widest text-white/25 mb-1">Status</div>
                <div className="text-xs font-mono-tech" style={{ color: state.isPlaying ? theme.accent : "rgba(255,255,255,0.4)" }}>
                  {state.isPlaying ? `Beat ${state.currentBeat + 1}/${state.beatsPerMeasure}` : "Stopped"}
                </div>
                {state.isPlaying && (
                  <div className="text-[10px] font-mono-tech mt-0.5" style={{ color: `${theme.accentGlow}0.6)` }}>
                    {formatDuration(practiceSeconds)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════ Right Panel ═══════ */}
        <aside
          className="lg:w-56 xl:w-64 flex flex-col overflow-y-auto shrink-0"
          style={{
            background: theme.panelBg,
            borderLeft: `1px solid ${theme.panelBorder}`,
          }}
        >
          {/* Tab switcher */}
          <div className="flex border-b" style={{ borderColor: theme.panelBorder }}>
            {([
              { id: "status" as RightTab, label: "状态", icon: <Activity className="w-3 h-3" /> },
              { id: "records" as RightTab, label: "记录", icon: <BookOpen className="w-3 h-3" /> },
              { id: "presets" as RightTab, label: "预设", icon: <Save className="w-3 h-3" /> },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setRightTab(tab.id)}
                className="flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-all"
                style={{
                  color: rightTab === tab.id ? theme.accent : "rgba(255,255,255,0.3)",
                  borderBottom: rightTab === tab.id ? `2px solid ${theme.accent}` : "2px solid transparent",
                  background: rightTab === tab.id ? `${theme.accentGlow}0.06)` : "transparent",
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Status Tab ── */}
          {rightTab === "status" && (
            <>
              {/* Current status */}
              <div className="p-4" style={{ borderBottom: `1px solid ${theme.panelBorder}` }}>
                <div className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Status</div>
                <div className="space-y-2">
                  {[
                    { label: "Time Sig.", value: `${state.beatsPerMeasure}/${state.beatUnit}` },
                    { label: "Subdiv.", value: `${state.subdivision}x ${["","Beat","8th","Triplet","16th"][state.subdivision]}` },
                    { label: "Sound", value: SOUND_OPTIONS.find(s => s.value === state.soundType)?.label ?? "" },
                    { label: "Beat", value: state.isPlaying ? `${state.currentBeat + 1} / ${state.beatsPerMeasure}` : "—" },
                    { label: "Tempo", value: tempoMarking },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-[11px] text-white/35">{item.label}</span>
                      <span className="text-[11px] font-mono-tech text-white/70">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Common BPM presets */}
              <div className="p-4" style={{ borderBottom: `1px solid ${theme.panelBorder}` }}>
                <div className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">Quick BPM</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[60, 72, 80, 96, 100, 108, 120, 132, 140, 152, 160, 176].map(preset => (
                    <button
                      key={preset}
                      onClick={() => setBpm(preset)}
                      className={cn("py-1.5 rounded-lg text-[11px] font-mono-tech transition-all", state.bpm === preset ? "text-white" : "text-white/40 hover:text-white/70")}
                      style={themedBtn(state.bpm === preset)}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
              {/* Tempo markings reference */}
              <div className="p-4 flex-1 overflow-y-auto">
                <div className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">Tempo Guide</div>
                <div className="space-y-1">
                  {TEMPO_MARKINGS.map(t => {
                    const isActive = state.bpm >= t.min && state.bpm <= t.max;
                    return (
                      <div
                        key={t.name}
                        className="flex items-center justify-between px-2 py-1 rounded-lg transition-all"
                        style={{
                          background: isActive ? theme.selectedBg : "transparent",
                          border: isActive ? `1px solid ${theme.selectedBorder}` : "1px solid transparent",
                        }}
                      >
                        <span className="text-[11px] italic" style={{ color: isActive ? theme.accent : "rgba(255,255,255,0.3)" }}>{t.name}</span>
                        <span className="text-[10px] font-mono-tech" style={{ color: isActive ? `${theme.accent}cc` : "rgba(255,255,255,0.2)" }}>{t.min}–{t.max}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── Records Tab ── */}
          {rightTab === "records" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${theme.panelBorder}` }}>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-white/40">练习记录</div>
                  <div className="text-[10px] text-white/25 mt-0.5">
                    共 {records.length} 次
                    {records.length > 0 && (
                      <span className="ml-1.5">· 累计 {formatDuration(records.reduce((sum, r) => sum + r.duration, 0))}</span>
                    )}
                  </div>
                </div>
                {records.length > 0 && (
                  <button
                    onClick={clearAllRecords}
                    className="p-1.5 rounded-lg transition-all hover:bg-red-500/20 text-white/30 hover:text-red-400"
                    title="清空所有记录"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {/* Current session timer */}
              {state.isPlaying && (
                <div className="mx-4 mt-3 p-3 rounded-xl" style={{ background: `${theme.accentGlow}0.08)`, border: `1px solid ${theme.accentGlow}0.2)` }}>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                    <span className="text-xs text-white/60">本次练习</span>
                  </div>
                  <div className="text-2xl font-mono-tech mt-1" style={{ color: theme.accent }}>{formatDuration(practiceSeconds)}</div>
                  <div className="text-[10px] text-white/35 mt-0.5">{state.bpm} BPM · {state.beatsPerMeasure}/{state.beatUnit}</div>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {records.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-white/15" />
                    <div className="text-xs text-white/25">暂无练习记录</div>
                    <div className="text-[10px] text-white/15 mt-1">练习 5 秒以上将自动保存</div>
                  </div>
                ) : (
                  records.map(record => (
                    <div
                      key={record.id}
                      className="p-3 rounded-xl group relative"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          {/* 练习次数序号 */}
                          <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono-tech font-bold mt-0.5" style={{ background: `${theme.accentGlow}0.12)`, color: theme.accent, border: `1px solid ${theme.accentGlow}0.25)` }}>
                            {record.sessionIndex ?? '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono-tech font-semibold" style={{ color: theme.accent }}>{formatDuration(record.duration)}</span>
                              <span className="text-[10px] text-white/40">{record.bpm} BPM</span>
                            </div>
                            <div className="text-[10px] text-white/30 mt-0.5">{record.timeSignature} · {record.soundType}</div>
                            <div className="text-[9px] text-white/20 mt-0.5">{record.date}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteRecord(record.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all hover:bg-red-500/20 text-white/30 hover:text-red-400 flex-shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── Presets Tab ── */}
          {rightTab === "presets" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4" style={{ borderBottom: `1px solid ${theme.panelBorder}` }}>
                <div className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">预设管理</div>
                {showPresetInput ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={presetName}
                      onChange={e => setPresetName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") savePreset(); if (e.key === "Escape") setShowPresetInput(false); }}
                      placeholder={`${state.bpm}BPM ${state.beatsPerMeasure}/${state.beatUnit}`}
                      className="w-full px-3 py-2 rounded-lg text-xs text-white bg-transparent outline-none"
                      style={{ border: `1px solid ${theme.selectedBorder}`, background: `${theme.accentGlow}0.06)` }}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={savePreset}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white transition-all"
                        style={{ background: `linear-gradient(135deg, ${theme.accentGlow}0.35), ${theme.accentGlow}0.2))`, border: `1px solid ${theme.selectedBorder}` }}
                      >
                        保存
                      </button>
                      <button
                        onClick={() => { setShowPresetInput(false); setPresetName(""); }}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white/50 transition-all hover:text-white"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowPresetInput(true)}
                    className="w-full py-2 rounded-xl text-xs font-medium text-white/70 hover:text-white transition-all flex items-center justify-center gap-2"
                    style={{ background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.08)` }}
                  >
                    <Save className="w-3.5 h-3.5" />
                    保存当前配置为预设
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {presets.length === 0 ? (
                  <div className="text-center py-8">
                    <Save className="w-8 h-8 mx-auto mb-2 text-white/15" />
                    <div className="text-xs text-white/25">暂无预设</div>
                    <div className="text-[10px] text-white/15 mt-1">保存常用配置，一键加载</div>
                  </div>
                ) : (
                  presets.map(preset => (
                    <div
                      key={preset.id}
                      className="p-3 rounded-xl group relative cursor-pointer transition-all hover:bg-white/5"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                      onClick={() => applyPreset(preset)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-white/80 truncate">{preset.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-mono-tech" style={{ color: theme.accent }}>{preset.bpm} BPM</span>
                            <span className="text-[10px] text-white/30">{preset.beatsPerMeasure}/{preset.beatUnit}</span>
                            <span className="text-[10px] text-white/30">{SOUND_OPTIONS.find(s => s.value === preset.soundType)?.label}</span>
                          </div>
                          {/* Beat level indicators */}
                          <div className="flex gap-0.5 mt-1.5">
                            {Array.from({ length: preset.beatsPerMeasure }).map((_, i) => {
                              const lvl = (preset.beatLevels?.[i] ?? 3) as BeatLevel;
                              return (
                                <div
                                  key={i}
                                  className="w-2 h-2 rounded-sm"
                                  style={{
                                    background: levelColors[lvl],
                                    opacity: lvl === 0 ? 0.2 : [0.4, 0.6, 0.8, 1][lvl],
                                  }}
                                />
                              );
                            })}
                          </div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); deletePreset(preset.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all hover:bg-red-500/20 text-white/30 hover:text-red-400 flex-shrink-0 ml-2"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </aside>
      </main>

      {/* Footer */}
      <footer className="px-6 py-2 flex items-center justify-between" style={{ borderTop: `1px solid ${theme.panelBorder}` }}>
        <div className="flex items-center gap-4 text-[10px] text-white/20">
          <span>Space: Play/Stop</span>
          <span>↑↓: ±1 BPM</span>
          <span>T: Tap Tempo</span>
          <span>点击节拍: 切换强/次强/弱/静音</span>
        </div>
        <div className="text-[10px] text-white/15">{theme.name} · {theme.nameEn}</div>
      </footer>
    </div>
  );
}
