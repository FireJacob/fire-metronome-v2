/* ============================================================
 * Pendulum Component
 * Design: Jacob's Beat Keeper - Theme-aware pendulum visual
 * All colors driven by accentColor / accentAltColor props
 * ============================================================ */

import { useEffect, useRef } from "react";

interface PendulumProps {
  bpm: number;
  isPlaying: boolean;
  flashBeat: boolean;
  currentBeat: number;
  beatsPerMeasure?: number;
  accentFirstBeat?: boolean;
  accentColor?: string;
  accentAltColor?: string;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function hexRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// Darken a hex color
function darkenHex(hex: string, factor: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}

export function Pendulum({
  bpm,
  isPlaying,
  flashBeat,
  currentBeat,
  beatsPerMeasure = 4,
  accentFirstBeat = true,
  accentColor = "#FF4D1A",
  accentAltColor = "#FFB800",
}: PendulumProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const phaseRef = useRef<number>(0);
  const directionRef = useRef<number>(1);
  const lastTimeRef = useRef<number>(0);
  const flashIntensityRef = useRef<number>(0);
  const particlesRef = useRef<Array<{
    x: number; y: number; vx: number; vy: number; life: number; color: string; size: number;
  }>>([]);
  const trailRef = useRef<Array<{ x: number; y: number; alpha: number }>>([]);

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
    const w = canvas.parentElement?.offsetWidth || canvas.offsetWidth || 300;
    const h = canvas.parentElement?.offsetHeight || canvas.offsetHeight || 300;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.scale(dpr, dpr);

    const maxAngle = 30;
    const pivotX = w / 2;
    const pivotY = h * 0.06;
    const armLength = h * 0.76;
    const bobRadius = 16;

    if (flashBeat) {
      flashIntensityRef.current = 1.0;
      const ac = accentRef.current;
      const alt = accentAltRef.current;
      const isAccentBeat = accentFirstBeat && currentBeat === 0;
      const color = isAccentBeat ? alt : ac;
      const angle = maxAngle * Math.sin(phaseRef.current * Math.PI) * directionRef.current;
      const angleRad = (angle * Math.PI) / 180;
      const bx = pivotX + Math.sin(angleRad) * armLength;
      const by = pivotY + Math.cos(angleRad) * armLength;
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 3;
        particlesRef.current.push({
          x: bx, y: by,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 1,
          life: 1.0,
          color,
          size: 1.5 + Math.random() * 2.5,
        });
      }
    }

    let animId: number;

    const draw = (timestamp: number) => {
      const dt = lastTimeRef.current ? Math.min((timestamp - lastTimeRef.current) / 1000, 0.05) : 0.016;
      lastTimeRef.current = timestamp;

      const ac = accentRef.current;
      const alt = accentAltRef.current;
      const [acR, acG, acB] = hexRgb(ac);

      ctx.clearRect(0, 0, w, h);
      flashIntensityRef.current *= 0.84;

      if (isPlaying) {
        const beatsPerSec = bpm / 60;
        phaseRef.current += beatsPerSec * dt;
        if (phaseRef.current >= 1) {
          phaseRef.current -= 1;
          directionRef.current *= -1;
        }
      }

      const easedPhase = Math.sin(phaseRef.current * Math.PI);
      const angle = maxAngle * easedPhase * directionRef.current;
      const angleRad = (angle * Math.PI) / 180;
      const bobX = pivotX + Math.sin(angleRad) * armLength;
      const bobY = pivotY + Math.cos(angleRad) * armLength;

      // ── Decorative arc frame
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, armLength + bobRadius + 8, 0.2, Math.PI - 0.2);
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const tickAngles = [-maxAngle, -maxAngle * 0.66, -maxAngle * 0.33, 0, maxAngle * 0.33, maxAngle * 0.66, maxAngle];
      for (const ta of tickAngles) {
        const tr = (ta * Math.PI) / 180;
        const isCenter = ta === 0;
        const tickR1 = armLength + bobRadius + 4;
        const tickR2 = armLength + bobRadius + (isCenter ? 18 : 12);
        ctx.beginPath();
        ctx.moveTo(pivotX + Math.sin(tr) * tickR1, pivotY + Math.cos(tr) * tickR1);
        ctx.lineTo(pivotX + Math.sin(tr) * tickR2, pivotY + Math.cos(tr) * tickR2);
        ctx.strokeStyle = isCenter ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)";
        ctx.lineWidth = isCenter ? 2 : 1;
        ctx.stroke();
      }

      // ── Shadow on base
      const shadowX = pivotX + Math.sin(angleRad) * armLength;
      const shadowScaleX = Math.abs(Math.cos(angleRad)) * 0.6 + 0.1;
      ctx.save();
      ctx.translate(shadowX, pivotY + armLength + bobRadius + 6);
      ctx.scale(shadowScaleX, 0.3);
      ctx.beginPath();
      ctx.arc(0, 0, bobRadius * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fill();
      ctx.restore();

      // ── Motion trail
      const fi = flashIntensityRef.current;
      const isAccentBeat = accentFirstBeat && currentBeat === 0;
      trailRef.current.push({ x: bobX, y: bobY, alpha: 0.5 });
      if (trailRef.current.length > 18) trailRef.current.shift();
      for (let i = 0; i < trailRef.current.length; i++) {
        const t = trailRef.current[i];
        const trailColor = fi > 0.3
          ? (isAccentBeat ? alt : ac)
          : "rgba(255,255,255,0.5)";
        const alpha = (i / trailRef.current.length) * 0.3 * t.alpha;
        ctx.beginPath();
        ctx.arc(t.x, t.y, (i / trailRef.current.length) * bobRadius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = trailColor.startsWith("#")
          ? trailColor + Math.round(alpha * 255).toString(16).padStart(2, "0")
          : trailColor;
        ctx.fill();
        t.alpha *= 0.92;
      }

      // ── Arm
      const armGrad = ctx.createLinearGradient(pivotX, pivotY, bobX, bobY);
      armGrad.addColorStop(0, "rgba(255,255,255,0.08)");
      armGrad.addColorStop(0.7, fi > 0.3
        ? `rgba(${acR}, ${Math.round(acG + fi * 100)}, ${acB}, ${0.3 + fi * 0.4})`
        : "rgba(255,255,255,0.22)");
      armGrad.addColorStop(1, fi > 0.3
        ? (isAccentBeat ? hexToRgba(alt, 0.8) : hexToRgba(ac, 0.8))
        : "rgba(255,255,255,0.35)");

      if (fi > 0.2) {
        ctx.beginPath();
        ctx.moveTo(pivotX, pivotY);
        ctx.lineTo(bobX, bobY);
        ctx.strokeStyle = isAccentBeat
          ? hexToRgba(alt, fi * 0.2)
          : hexToRgba(ac, fi * 0.2);
        ctx.lineWidth = 8;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(bobX, bobY);
      ctx.strokeStyle = armGrad;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // ── Particles
      particlesRef.current = particlesRef.current.filter(p => p.life > 0.02);
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.life *= 0.88;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color.startsWith("#")
          ? p.color + Math.round(p.life * 200).toString(16).padStart(2, "0")
          : p.color;
        ctx.fill();
      }

      // ── Bob outer glow
      if (fi > 0.05) {
        ctx.beginPath();
        ctx.arc(bobX, bobY, bobRadius + 6 + fi * 10, 0, Math.PI * 2);
        ctx.fillStyle = isAccentBeat
          ? hexToRgba(alt, fi * 0.18)
          : hexToRgba(ac, fi * 0.18);
        ctx.fill();
      }

      // ── Bob body
      const bobGrad = ctx.createRadialGradient(
        bobX - bobRadius * 0.3, bobY - bobRadius * 0.3, 1,
        bobX, bobRadius, bobRadius
      );
      if (fi > 0.35) {
        const color = isAccentBeat ? alt : ac;
        const colorDim = darkenHex(color, 0.65);
        bobGrad.addColorStop(0, color);
        bobGrad.addColorStop(0.6, colorDim);
        bobGrad.addColorStop(1, "rgba(10, 20, 18, 0.9)");
      } else {
        bobGrad.addColorStop(0, "rgba(200, 230, 220, 0.95)");
        bobGrad.addColorStop(0.5, "rgba(130, 160, 150, 0.85)");
        bobGrad.addColorStop(1, "rgba(35, 50, 45, 0.95)");
      }

      ctx.beginPath();
      ctx.arc(bobX, bobY, bobRadius, 0, Math.PI * 2);
      ctx.fillStyle = bobGrad;
      if (fi > 0.35) {
        ctx.shadowColor = isAccentBeat ? alt : ac;
        ctx.shadowBlur = 18 * fi;
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      // Bob highlight
      ctx.beginPath();
      ctx.arc(bobX - bobRadius * 0.28, bobY - bobRadius * 0.28, bobRadius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fill();

      // Bob border
      ctx.beginPath();
      ctx.arc(bobX, bobY, bobRadius, 0, Math.PI * 2);
      ctx.strokeStyle = fi > 0.3
        ? (isAccentBeat ? hexToRgba(alt, 0.7) : hexToRgba(ac, 0.7))
        : "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Beat number on bob
      if (isPlaying) {
        ctx.font = `bold ${Math.round(bobRadius * 1.1)}px 'Bebas Neue', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = fi > 0.35
          ? "rgba(255,255,255,0.95)"
          : "rgba(255,255,255,0.6)";
        ctx.fillText(String(currentBeat + 1), bobX, bobY + 1);
      }

      // ── Pivot
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 9, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(30,25,20,0.9)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fill();

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    animRef.current = animId;

    return () => cancelAnimationFrame(animId);
  }, [bpm, isPlaying, flashBeat, currentBeat, beatsPerMeasure, accentFirstBeat, accentColor, accentAltColor]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}
