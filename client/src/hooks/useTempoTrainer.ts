/* ============================================================
 * useTempoTrainer Hook
 * Design: 暗夜音乐厅 - Speed trainer for gradual tempo increase
 * ============================================================ */

import { useCallback, useEffect, useRef, useState } from "react";

export interface TrainerConfig {
  startBpm: number;
  targetBpm: number;
  barsPerStep: number;     // How many bars before increasing tempo
  bpmIncrement: number;    // How much to increase each step
  enabled: boolean;
}

export interface TrainerState {
  config: TrainerConfig;
  currentStep: number;
  barsElapsed: number;
  isActive: boolean;
}

export function useTempoTrainer(
  currentBpm: number,
  beatsPerMeasure: number,
  currentBeat: number,
  isPlaying: boolean,
  onBpmChange: (bpm: number) => void
) {
  const [trainerState, setTrainerState] = useState<TrainerState>({
    config: {
      startBpm: 80,
      targetBpm: 160,
      barsPerStep: 4,
      bpmIncrement: 5,
      enabled: false,
    },
    currentStep: 0,
    barsElapsed: 0,
    isActive: false,
  });

  const prevBeatRef = useRef<number>(-1);
  const barCountRef = useRef<number>(0);

  // Track bar completions
  useEffect(() => {
    if (!isPlaying || !trainerState.isActive || !trainerState.config.enabled) return;

    // Detect when beat wraps from last beat to beat 0 (new bar)
    if (currentBeat === 0 && prevBeatRef.current === beatsPerMeasure - 1) {
      barCountRef.current++;

      setTrainerState(prev => {
        const newBarsElapsed = prev.barsElapsed + 1;
        if (newBarsElapsed >= prev.config.barsPerStep) {
          const nextBpm = currentBpm + prev.config.bpmIncrement;
          if (nextBpm <= prev.config.targetBpm) {
            onBpmChange(nextBpm);
            return {
              ...prev,
              barsElapsed: 0,
              currentStep: prev.currentStep + 1,
            };
          } else {
            // Reached target
            return {
              ...prev,
              barsElapsed: newBarsElapsed,
              isActive: false,
            };
          }
        }
        return { ...prev, barsElapsed: newBarsElapsed };
      });
    }

    prevBeatRef.current = currentBeat;
  }, [currentBeat, isPlaying, trainerState.isActive, trainerState.config.enabled, beatsPerMeasure, currentBpm, onBpmChange]);

  const startTrainer = useCallback(() => {
    barCountRef.current = 0;
    onBpmChange(trainerState.config.startBpm);
    setTrainerState(prev => ({
      ...prev,
      currentStep: 0,
      barsElapsed: 0,
      isActive: true,
    }));
  }, [trainerState.config.startBpm, onBpmChange]);

  const stopTrainer = useCallback(() => {
    setTrainerState(prev => ({ ...prev, isActive: false, currentStep: 0, barsElapsed: 0 }));
  }, []);

  const updateConfig = useCallback((config: Partial<TrainerConfig>) => {
    setTrainerState(prev => ({
      ...prev,
      config: { ...prev.config, ...config },
    }));
  }, []);

  return { trainerState, startTrainer, stopTrainer, updateConfig };
}
