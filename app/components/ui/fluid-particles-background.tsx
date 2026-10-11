"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/app/lib/utils";

interface FluidParticlesBackgroundProps {
  children?: ReactNode;
  particleCount?: number;
  noiseIntensity?: number;
  particleSize?: { min: number; max: number };
  paused?: boolean;
  className?: string;
}

function createNoise() {
  const permutation = [
    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140,
    36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120,
    234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33,
    88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71,
    134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133,
    230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161,
    1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130,
    116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250,
    124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227,
    47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44,
    154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98,
    108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34,
    242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14,
    239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121,
    50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243,
    141, 128, 195, 78, 66, 215, 61, 156, 180,
  ];
  const p = Array.from({ length: 512 }, (_, index) => permutation[index & 255]);
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (t: number, a: number, b: number) => a + t * (b - a);
  const grad = (hash: number, x: number, y: number, z: number) => {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  };

  return (x: number, y: number, z: number) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;

    return lerp(
      w,
      lerp(
        v,
        lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
        lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))
      ),
      lerp(
        v,
        lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
        lerp(
          u,
          grad(p[AB + 1], x, y - 1, z - 1),
          grad(p[BB + 1], x - 1, y - 1, z - 1)
        )
      )
    );
  };
}

interface Particle {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export function FluidParticlesBackground({
  children,
  particleCount = 1800,
  noiseIntensity = 0.003,
  particleSize = { min: 0.8, max: 2.2 },
  paused = false,
  className,
}: FluidParticlesBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { min, max } = particleSize;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!container || !canvas || !ctx) return;

    const noise = createNoise();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const color =
      getComputedStyle(container)
        .getPropertyValue("--fluid-particle-color")
        .trim() || "#202020";
    const pointer = { x: 0, y: 0, active: false };
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let frame = 0;
    let previousTime = 0;
    let lastInteraction = -Infinity;
    let visible = true;
    const settleTime = 1800;

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
    };
    const canAnimate = () =>
      !paused && !reducedMotion.matches && visible && !document.hidden;

    const drawParticle = (particle: Particle, opacity: number) => {
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    };

    const resize = () => {
      stop();
      width = container.clientWidth;
      height = container.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = color;
      const count = Math.min(particleCount, Math.ceil((width * height) / 650));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: min + Math.random() * (max - min),
        vx: 0,
        vy: 0,
        life: Math.random() * 120,
        maxLife: 160 + Math.random() * 100,
      }));
      particles.forEach((particle) => drawParticle(particle, 0.5));
      ctx.globalAlpha = 1;
    };

    const animate = (time: number) => {
      frame = 0;
      if (!canAnimate() || time - lastInteraction > settleTime) {
        previousTime = 0;
        return;
      }
      const step = previousTime
        ? Math.min((time - previousTime) / 16.667, 2)
        : 1;
      previousTime = time;
      const energy = Math.max(0, 1 - (time - lastInteraction) / settleTime);

      // Erase only the trails so the CSS background stays visible.
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1 - Math.pow(0.88, step);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = color;

      for (const particle of particles) {
        particle.life += step;
        if (particle.life > particle.maxLife) {
          particle.life = 0;
          particle.x = Math.random() * width;
          particle.y = Math.random() * height;
          particle.vx = 0;
          particle.vy = 0;
        }

        const angle =
          noise(
            particle.x * noiseIntensity,
            particle.y * noiseIntensity,
            time * 0.00006
          ) *
          Math.PI *
          4;
        let targetX = Math.cos(angle) * 0.6;
        let targetY = Math.sin(angle) * 0.6;
        if (pointer.active) {
          const dx = pointer.x - particle.x;
          const dy = pointer.y - particle.y;
          const distance = Math.hypot(dx, dy);
          const influence = Math.max(0, 1 - distance / 260) * energy;
          targetX += (dx * 0.018 - dy * 0.035) * influence;
          targetY += (dy * 0.018 + dx * 0.035) * influence;
        }
        const blend = 1 - Math.pow(0.92, step);
        particle.vx += (targetX - particle.vx) * blend;
        particle.vy += (targetY - particle.vy) * blend;
        particle.x = (particle.x + particle.vx * step * energy + width) % width;
        particle.y =
          (particle.y + particle.vy * step * energy + height) % height;
        drawParticle(
          particle,
          Math.sin((particle.life / particle.maxLife) * Math.PI) * 0.36
        );
      }
      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(animate);
    };

    const handlePointer = (event: PointerEvent) => {
      if (event.pointerType === "touch" || !canAnimate()) return;
      const rect = container.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
      lastInteraction = performance.now();
      if (!frame) frame = requestAnimationFrame(animate);
    };
    const handleLeave = () => {
      pointer.active = false;
    };
    const syncVisibility = () => {
      if (!canAnimate()) {
        pointer.active = false;
        lastInteraction = -Infinity;
        stop();
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncVisibility();
    });
    resize();
    resizeObserver.observe(container);
    intersectionObserver.observe(container);
    container.addEventListener("pointermove", handlePointer, { passive: true });
    container.addEventListener("pointerleave", handleLeave);
    reducedMotion.addEventListener("change", syncVisibility);
    document.addEventListener("visibilitychange", syncVisibility);

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      container.removeEventListener("pointermove", handlePointer);
      container.removeEventListener("pointerleave", handleLeave);
      reducedMotion.removeEventListener("change", syncVisibility);
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, [particleCount, noiseIntensity, min, max, paused]);

  return (
    <div
      ref={containerRef}
      className={cn("fluid-particles-background", className)}
    >
      <canvas
        ref={canvasRef}
        className="fluid-particles-canvas"
        aria-hidden="true"
      />
      {children}
    </div>
  );
}
