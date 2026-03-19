/* ============================================================
 * BeatVisualizer Component
 * Design: Jacob's Beat Keeper - Theme-aware circular beat indicator
 * All colors driven by accentColor / accentAltColor props
 * ============================================================ */

import { useEffect, useRef } from "react";

interface BeatVisualizerProps {
  currentBeat: number;
  beatsPerMeasure: number;
  subdivision: number;
  currentSubBeat: number;
  isPlaying: boolean;
  flashBeat: boolean;
  accentFirstBeat: boolean;
  bpm: number;
  muteBeats?: boolean[];
  accentColor?: string;    // e.g. "#FF4D1A"
  accentAltColor?: string; // e.g. "#FFB800"
}

// Hex to rgba helper
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Hex to rgb components
function hexRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function BeatVisualizer({
  currentBeat,
  beatsPerMeasure,
  subdivision,
  currentSubBeat,
  isPlaying,
  flashBeat,
  accentFirstBeat,
  bpm,
  muteBeats = [],
  accentColor = "#FF4D1A",
  accentAltColor = "#FFB800",
}: BeatVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const pulseRingsRef = useRef<Array<{ r: number; alpha: number; color: string }>>([]);
  const lastFlashRef = useRef<boolean>(false);
  const sizeRef = useRef<number>(300);
  const rotationRef = useRef<number>(0);
  const innerBarsRef = useRef<number[]>(Array(24).fill(0));
  const trailsRef = useRef<Array<{ x: number; y: number; alpha: number; color: string }>>([]);
  const lastTimeRef = useRef<number>(0);

  // Store colors in refs so animation loop always has latest
  const accentRef = useRef(accentColor);
  const accentAltRef = useRef(accentAltColor);
  accentRef.current = accentColor;
  accentAltRef.current = accentAltColor;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = canvas.parentElement?.offsetWidth || canvas.offsetWidth || 300;
    sizeRef.current = size;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    ctx.scale(dpr, dpr);

    const ac = accentRef.current;
    const alt = accentAltRef.current;

    // Spawn pulse rings on flash
    if (flashBeat && !lastFlashRef.current) {
      const isAccent = accentFirstBeat && currentBeat === 0 && currentSubBeat === 0;
      const color = isAccent ? alt : ac;
      const s = sizeRef.current;
      const radius = Math.min(s, s) * 0.38;
      pulseRingsRef.current.push(
        { r: radius + 2, alpha: 0.9, color },
        { r: radius + 2, alpha: 0.5, color: hexToRgba(isAccent ? alt : ac, 0.5) },
      );
      const totalDots = beatsPerMeasure * subdivision;
      const idx = currentBeat * subdivision + currentSubBeat;
      const angle = (idx / totalDots) * Math.PI * 2 - Math.PI / 2;
      const cx = s / 2;
      const cy = s / 2;
      trailsRef.current.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        alpha: 0.8,
        color,
      });
      const barCount = innerBarsRef.current.length;
      for (let i = 0; i < barCount; i++) {
        innerBarsRef.current[i] = Math.min(1, innerBarsRef.current[i] + (Math.random() * 0.6 + 0.3));
      }
    }
    lastFlashRef.current = flashBeat;

    let animId: number;

    const draw = (timestamp: number) => {
      const dt = lastTimeRef.current ? (timestamp - lastTimeRef.current) / 1000 : 0.016;
      lastTimeRef.current = timestamp;

      const ac = accentRef.current;
      const alt = accentAltRef.current;
      const [ar, ag, ab] = hexRgb(ac);

      const w = sizeRef.current;
      const h = sizeRef.current;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.38;

      ctx.clearRect(0, 0, w, h);

      if (isPlaying) {
        rotationRef.current += dt * (bpm / 60) * 0.04;
      }

      // ── Outer decorative tick ring
      const tickCount = 60;
      for (let i = 0; i < tickCount; i++) {
        const a = (i / tickCount) * Math.PI * 2 + rotationRef.current;
        const isLong = i % 5 === 0;
        const r1 = radius + 14;
        const r2 = radius + (isLong ? 22 : 18);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        ctx.strokeStyle = isLong ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)";
        ctx.lineWidth = isLong ? 1.5 : 0.8;
        ctx.stroke();
      }

      // ── Progress arc
      if (isPlaying) {
        const totalSteps = beatsPerMeasure * subdivision;
        const currentStep = currentBeat * subdivision + currentSubBeat;
        const progress = currentStep / totalSteps;
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + progress * Math.PI * 2;

        ctx.beginPath();
        ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.lineWidth = 3;
        ctx.stroke();

        if (progress > 0) {
          ctx.beginPath();
          ctx.arc(cx, cy, radius + 6, startAngle, endAngle);
          ctx.strokeStyle = accentFirstBeat && currentBeat === 0
            ? hexToRgba(alt, 0.6)
            : hexToRgba(ac, 0.6);
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.stroke();
          ctx.lineCap = "butt";
        }
      }

      // ── Pulse rings
      pulseRingsRef.current = pulseRingsRef.current.filter(ring => ring.alpha > 0.005);
      for (const ring of pulseRingsRef.current) {
        ctx.beginPath();
        ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
        const col = ring.color.startsWith("#")
          ? ring.color + Math.round(ring.alpha * 255).toString(16).padStart(2, "0")
          : ring.color;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2 * ring.alpha;
        ctx.stroke();
        ring.r += 1.8;
        ring.alpha *= 0.91;
      }

      // ── Trail dots
      trailsRef.current = trailsRef.current.filter(t => t.alpha > 0.01);
      for (const trail of trailsRef.current) {
        ctx.beginPath();
        ctx.arc(trail.x, trail.y, 6 * trail.alpha, 0, Math.PI * 2);
        ctx.fillStyle = trail.color + Math.round(trail.alpha * 180).toString(16).padStart(2, "0");
        ctx.fill();
        trail.alpha *= 0.85;
      }

      // ── Inner spectrum bars
      const barCount = innerBarsRef.current.length;
      const maxBarLen = radius * 0.32;
      const minBarLen = radius * 0.06;
      for (let i = 0; i < barCount; i++) {
        innerBarsRef.current[i] *= 0.88;
        const barLen = minBarLen + innerBarsRef.current[i] * (maxBarLen - minBarLen);
        const a = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        const innerR = radius * 0.18;
        const x1 = cx + Math.cos(a) * innerR;
        const y1 = cy + Math.sin(a) * innerR;
        const x2 = cx + Math.cos(a) * (innerR + barLen);
        const y2 = cy + Math.sin(a) * (innerR + barLen);
        const alpha = 0.15 + innerBarsRef.current[i] * 0.65;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(${ar}, ${Math.round(ag + innerBarsRef.current[i] * 100)}, ${ab}, ${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // ── Beat dots
      const totalDots = beatsPerMeasure * subdivision;
      for (let i = 0; i < totalDots; i++) {
        const beatIdx = Math.floor(i / subdivision);
        const subIdx = i % subdivision;
        const angle = (i / totalDots) * Math.PI * 2 - Math.PI / 2;

        const isCurrentDot = beatIdx === currentBeat && subIdx === currentSubBeat && isPlaying;
        const isSubDiv = subIdx !== 0;
        const isFirstBeat = beatIdx === 0 && subIdx === 0;
        const isMuted = muteBeats[beatIdx] === true;

        const dotRadius = isSubDiv ? 3 : (beatsPerMeasure <= 6 ? 7 : 5.5);
        const dotDist = isSubDiv ? radius - 16 : radius;

        const dx = cx + Math.cos(angle) * dotDist;
        const dy = cy + Math.sin(angle) * dotDist;

        ctx.beginPath();
        ctx.arc(dx, dy, dotRadius, 0, Math.PI * 2);

        if (isMuted && !isSubDiv) {
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fill();
          ctx.strokeStyle = hexToRgba(ac, 0.4);
          ctx.lineWidth = 1;
          ctx.stroke();
          const xSize = dotRadius * 0.6;
          ctx.beginPath();
          ctx.moveTo(dx - xSize, dy - xSize);
          ctx.lineTo(dx + xSize, dy + xSize);
          ctx.moveTo(dx + xSize, dy - xSize);
          ctx.lineTo(dx - xSize, dy + xSize);
          ctx.strokeStyle = hexToRgba(ac, 0.5);
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else if (isCurrentDot) {
          const isAccent = accentFirstBeat && isFirstBeat;
          const color = isAccent ? alt : ac;
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = isAccent ? 20 : 14;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(dx, dy, dotRadius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = color + "55";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (isFirstBeat && accentFirstBeat && !isSubDiv) {
          ctx.fillStyle = isPlaying ? hexToRgba(alt, 0.22) : hexToRgba(alt, 0.38);
          ctx.fill();
          ctx.strokeStyle = hexToRgba(alt, 0.55);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          const alpha = isSubDiv ? 0.12 : 0.28;
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.fill();
          if (!isSubDiv) {
            ctx.strokeStyle = "rgba(255,255,255,0.1)";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // ── Center circle
      const centerR = radius * 0.26;
      const isActive = isPlaying && flashBeat;
      const [acR, acG, acB] = hexRgb(ac);

      ctx.beginPath();
      ctx.arc(cx, cy, centerR + 4, 0, Math.PI * 2);
      ctx.strokeStyle = isActive ? hexToRgba(ac, 0.35) : "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const gradient = ctx.createRadialGradient(cx - centerR * 0.3, cy - centerR * 0.3, 1, cx, cy, centerR);
      if (isActive) {
        gradient.addColorStop(0, `rgba(${acR + 40}, ${acG + 40}, ${acB + 20}, 0.3)`);
        gradient.addColorStop(0.5, hexToRgba(ac, 0.12));
        gradient.addColorStop(1, hexToRgba(ac, 0.04));
      } else {
        gradient.addColorStop(0, "rgba(255, 255, 255, 0.06)");
        gradient.addColorStop(1, "rgba(255, 255, 255, 0.01)");
      }
      ctx.beginPath();
      ctx.arc(cx, cy, centerR, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Beat number in center
      if (isPlaying) {
        ctx.font = `bold ${Math.round(centerR * 0.9)}px 'Bebas Neue', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const isAccentBeat = accentFirstBeat && currentBeat === 0;
        ctx.fillStyle = isAccentBeat
          ? hexToRgba(alt, 0.5 + (isActive ? 0.4 : 0))
          : `rgba(255, 255, 255, ${0.3 + (isActive ? 0.4 : 0)})`;
        if (isActive) {
          ctx.shadowColor = isAccentBeat ? alt : ac;
          ctx.shadowBlur = 10;
        }
        ctx.fillText(String(currentBeat + 1), cx, cy + 1);
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    animFrameRef.current = animId;

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [currentBeat, beatsPerMeasure, subdivision, currentSubBeat, isPlaying, flashBeat, accentFirstBeat, bpm, muteBeats, accentColor, accentAltColor]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}
