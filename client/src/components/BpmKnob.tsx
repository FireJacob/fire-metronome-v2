/* ============================================================
 * BpmKnob Component
 * Design: Theme-aware circular drag knob for BPM control
 * ============================================================ */

import { useCallback, useEffect, useRef, useState } from "react";

interface BpmKnobProps {
  bpm: number;
  onChange: (bpm: number) => void;
  min?: number;
  max?: number;
  accentColor?: string;
  accentGlow?: string;
}

export function BpmKnob({
  bpm,
  onChange,
  min = 20,
  max = 300,
  accentColor = "#FF4D1A",
  accentGlow = "rgba(255,77,26,",
}: BpmKnobProps) {
  const knobRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startBpmRef = useRef(bpm);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startBpmRef.current = bpm;
    setIsDragging(true);
    e.preventDefault();
  }, [bpm]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDraggingRef.current = true;
    startYRef.current = e.touches[0].clientY;
    startBpmRef.current = bpm;
    setIsDragging(true);
    e.preventDefault();
  }, [bpm]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = startYRef.current - e.clientY;
      const newBpm = Math.round(startBpmRef.current + delta * 0.5);
      onChange(Math.max(min, Math.min(max, newBpm)));
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      const delta = startYRef.current - e.touches[0].clientY;
      const newBpm = Math.round(startBpmRef.current + delta * 0.5);
      onChange(Math.max(min, Math.min(max, newBpm)));
    };

    const handleUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [min, max, onChange]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    onChange(Math.max(min, Math.min(max, bpm + delta)));
  }, [bpm, min, max, onChange]);

  // Calculate rotation angle for visual indicator
  const normalized = (bpm - min) / (max - min);
  const minAngle = -135;
  const maxAngle = 135;
  const angle = minAngle + normalized * (maxAngle - minAngle);

  // Arc progress
  const arcStart = (minAngle - 90) * (Math.PI / 180);
  const arcEnd = (angle - 90) * (Math.PI / 180);
  const arcFull = (maxAngle - 90) * (Math.PI / 180);

  const r = 38;
  const cx = 50;
  const cy = 50;

  // SVG arc path
  const describeArc = (startAngle: number, endAngle: number) => {
    const start = {
      x: cx + r * Math.cos(startAngle),
      y: cy + r * Math.sin(startAngle),
    };
    const end = {
      x: cx + r * Math.cos(endAngle),
      y: cy + r * Math.sin(endAngle),
    };
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  return (
    <div
      ref={knobRef}
      className="relative select-none"
      style={{ width: 100, height: 100, cursor: isDragging ? "ns-resize" : "grab" }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onWheel={handleWheel}
    >
      <svg width="100" height="100" viewBox="0 0 100 100">
        {/* Background track */}
        <path
          d={describeArc(arcStart, arcFull)}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* Active arc */}
        <path
          d={describeArc(arcStart, arcEnd)}
          fill="none"
          stroke={accentColor}
          strokeWidth="4"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${accentGlow}0.7))` }}
        />
        {/* Knob body */}
        <circle cx={cx} cy={cy} r="26" fill="url(#knobGrad)" />
        <defs>
          <radialGradient id="knobGrad" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="rgba(80, 70, 60, 0.95)" />
            <stop offset="60%" stopColor="rgba(35, 30, 25, 0.95)" />
            <stop offset="100%" stopColor="rgba(15, 12, 10, 0.98)" />
          </radialGradient>
        </defs>
        {/* Knob border */}
        <circle
          cx={cx}
          cy={cy}
          r="26"
          fill="none"
          stroke={isDragging ? `${accentGlow}0.5)` : "rgba(255,255,255,0.12)"}
          strokeWidth="1"
        />
        {/* Indicator dot */}
        <circle
          cx={cx + 18 * Math.cos((angle - 90) * (Math.PI / 180))}
          cy={cy + 18 * Math.sin((angle - 90) * (Math.PI / 180))}
          r="3"
          fill={isDragging ? accentColor : "rgba(255,255,255,0.7)"}
          style={{ filter: isDragging ? `drop-shadow(0 0 4px ${accentColor})` : "none" }}
        />
      </svg>
    </div>
  );
}
