import { useEffect, useRef } from "react";

interface GlyphMatrixProps {
  /** Characters to randomly pick from. */
  glyphs?: string;
  /** Cell size in pixels, which also controls the font size. */
  cellSize?: number;
  /** Probability from 0 to 1 that a cell mutates on each tick. */
  mutationRate?: number;
  /** Tick interval in milliseconds. */
  interval?: number;
  /** Fade amount toward the bottom of the canvas (0 = none, 1 = full). */
  fadeBottom?: number;
  /** Glyph color. Pass a theme-aware CSS color value. */
  color?: string;
  /** Brightness multiplier for the glyph color. */
  boost?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function GlyphMatrix({
  glyphs = "01·•+*/\\<>=",
  cellSize = 14,
  mutationRate = 0.04,
  interval = 90,
  fadeBottom = 0.6,
  color,
  boost = 1.2,
  className = "",
  style,
}: GlyphMatrixProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cellsRef = useRef<string[][]>([]);
  const dimsRef = useRef({ cols: 0, rows: 0 });
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cols = Math.ceil(width / cellSize);
      const rows = Math.ceil(height / cellSize);

      const prev = cellsRef.current;
      const prevDims = dimsRef.current;
      const next: string[][] = [];

      for (let c = 0; c < cols; c++) {
        next[c] = [];
        for (let r = 0; r < rows; r++) {
          if (prev[c]?.[r] !== undefined) {
            next[c]![r] = prev[c]![r]!;
          } else {
            next[c]![r] = glyphs[Math.floor(Math.random() * glyphs.length)]!;
          }
        }
      }
      cellsRef.current = next;
      dimsRef.current = { cols, rows };
      draw();
    };

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      const { cols, rows } = dimsRef.current;

      ctx.clearRect(0, 0, width, height);

      let resolvedColor = color;
      if (!resolvedColor) {
        resolvedColor = getComputedStyle(canvas).getPropertyValue("--muted-foreground").trim() || "#6B7280";
      }

      // Convert simple hex to rgb so we can apply alpha/brightness.
      const rgb = parseColor(resolvedColor);
      const boosted = rgb.map((c) => Math.min(255, Math.round(c * boost)));

      ctx.font = `${cellSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x = c * cellSize + cellSize / 2;
          const y = r * cellSize + cellSize / 2;
          const fade = 1 - fadeBottom * (r / Math.max(1, rows - 1));
          ctx.fillStyle = `rgba(${boosted[0]}, ${boosted[1]}, ${boosted[2]}, ${Math.max(0, fade).toFixed(3)})`;
          ctx.fillText(cellsRef.current[c]?.[r] ?? "", x, y);
        }
      }
    };

    const tick = () => {
      const { cols, rows } = dimsRef.current;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (Math.random() < mutationRate) {
            cellsRef.current[c]![r] = glyphs[Math.floor(Math.random() * glyphs.length)]!;
          }
        }
      }
      draw();
    };

    resize();
    window.addEventListener("resize", resize);

    timerRef.current = window.setInterval(tick, interval);

    return () => {
      window.removeEventListener("resize", resize);
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [glyphs, cellSize, mutationRate, interval, fadeBottom, color, boost]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none block ${className}`}
      style={{ width: "100%", height: "100%", ...style }}
    />
  );
}

function parseColor(input: string): [number, number, number] {
  // Try hex.
  if (input.startsWith("#")) {
    const hex = input.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0]! + hex[0]!, 16);
      const g = parseInt(hex[1]! + hex[1]!, 16);
      const b = parseInt(hex[2]! + hex[2]!, 16);
      return [r, g, b];
    }
    if (hex.length === 6) {
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    }
  }

  // Try rgb/rgba.
  const rgbMatch = input.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1]!), parseInt(rgbMatch[2]!), parseInt(rgbMatch[3]!)];
  }

  // Try oklch by painting to a temporary canvas and sampling.
  if (typeof document !== "undefined") {
    const tmp = document.createElement("canvas");
    tmp.width = 1;
    tmp.height = 1;
    const tctx = tmp.getContext("2d");
    if (tctx) {
      tctx.fillStyle = input;
      tctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = tctx.getImageData(0, 0, 1, 1).data;
      return [r!, g!, b!];
    }
  }

  return [107, 114, 128]; // fallback gray-500
}
