"use client"

import { useMemo } from "react"
import { Line } from "react-konva"
import { getStroke } from "perfect-freehand"
import type { Drawing } from "@/types/planner"

/** Default pencil colour — graphite, not pure black. */
export const PENCIL_COLOR = "#374151"
export const PENCIL_WIDTH = 5

/**
 * perfect-freehand options tuned for a pencil rather than a marker: strong
 * width variation (`thinning`), long tapers at both ends so strokes lift off
 * the page, and enough streamlining to absorb pointer jitter.
 */
function strokeOptions(size: number, simulatePressure: boolean) {
  return {
    size,
    thinning: 0.48,
    smoothing: 0.55,
    streamline: 0.45,
    simulatePressure,
    start: { taper: size * 1.4, cap: true },
    end: { taper: size * 1.4, cap: true },
  }
}

/** Flat [x,y,pressure,...] -> perfect-freehand's [[x,y,pressure],...] */
function toTriples(flat: number[]): number[][] {
  const out: number[][] = []
  for (let i = 0; i + 2 < flat.length; i += 3) out.push([flat[i], flat[i + 1], flat[i + 2]])
  return out
}

/**
 * A stylus reports varying pressure; a mouse reports a constant. When it's
 * constant we let perfect-freehand derive width from velocity instead.
 */
function hasRealPressure(flat: number[]): boolean {
  const seen = new Set<number>()
  for (let i = 2; i < flat.length; i += 3) {
    seen.add(Math.round(flat[i] * 100))
    if (seen.size > 2) return true
  }
  return false
}

/** Outline polygon for a stroke, flattened to Konva's [x,y,...] point list. */
export function strokeOutline(flat: number[], size: number): number[] {
  if (flat.length < 3) return []
  const outline = getStroke(toTriples(flat), strokeOptions(size, !hasRealPressure(flat)))
  const pts: number[] = []
  for (const p of outline) { pts.push(p[0], p[1]) }
  return pts
}

/** Raw input centreline as Konva [x,y,...], dropping the pressure channel. */
export function centreline(flat: number[]): number[] {
  const pts: number[] = []
  for (let i = 0; i + 1 < flat.length; i += 3) pts.push(flat[i], flat[i + 1])
  return pts
}

/** Axis-aligned bounds of a stroke's input points, for export / fit-to-content. */
export function strokeBounds(flat: number[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i + 1 < flat.length; i += 3) {
    minX = Math.min(minX, flat[i]); maxX = Math.max(maxX, flat[i])
    minY = Math.min(minY, flat[i + 1]); maxY = Math.max(maxY, flat[i + 1])
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Graphite speckle. Filling the stroke with a noisy tile instead of a flat
 * colour is what separates "pencil" from "smooth vector ink" — real graphite
 * only catches the tooth of the paper, so some of it is missing.
 * Cached per colour; tiles in canvas space so grain stays consistent.
 */
const grainCache = new Map<string, HTMLCanvasElement>()

/**
 * Konva paints any CanvasImageSource as a fill pattern, but its typings only
 * name HTMLImageElement. Narrowing cast so callers stay type-clean.
 */
export const asPatternImage = (c: HTMLCanvasElement | null | undefined) =>
  (c ?? undefined) as unknown as HTMLImageElement | undefined

export function grainTile(color: string): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null
  const cached = grainCache.get(color)
  if (cached) return cached

  const SIZE = 64
  const c = document.createElement("canvas")
  c.width = SIZE
  c.height = SIZE
  const ctx = c.getContext("2d")
  if (!ctx) return null

  ctx.fillStyle = color
  ctx.fillRect(0, 0, SIZE, SIZE)
  const img = ctx.getImageData(0, 0, SIZE, SIZE)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.random()
    // ~8% bare paper, ~27% partial deposit, rest solid. Heavier than a literal
    // pencil, but annotations have to stay legible against the grid.
    img.data[i + 3] = n < 0.08 ? 0 : n < 0.35 ? 185 : 255
  }
  ctx.putImageData(img, 0, 0)

  grainCache.set(color, c)
  return c
}

interface Props {
  drawing: Drawing
  /** Only hit-testable while erasing, so strokes never block table clicks. */
  erasable: boolean
  /** Current stage scale, so the erase target keeps a constant screen size. */
  scale: number
  onErase: (id: string) => void
}

export function KonvaDrawing({ drawing, erasable, scale, onErase }: Props) {
  const points = useMemo(
    () => strokeOutline(drawing.points, drawing.width),
    [drawing.points, drawing.width],
  )
  const grain = useMemo(() => grainTile(drawing.color), [drawing.color])
  const spine = useMemo(() => centreline(drawing.points), [drawing.points])

  if (points.length === 0) return null

  return (
    <>
      <Line
        points={points}
        closed
        fill={drawing.color}
        fillPatternImage={asPatternImage(grain)}
        fillPatternRepeat="repeat"
        // Konva defaults fillPriority to "color", which would silently ignore
        // the grain pattern. `fill` is the fallback when the tile is missing.
        fillPriority={grain ? "pattern" : "color"}
        // Slight transparency so overlapping passes build up, like real shading
        opacity={0.92}
        listening={false}
      />

      {/* Invisible hit target. The rendered stroke is a few px of tapered
          polygon — far too thin to click reliably — so erasing aims at a fat
          line along the original centreline instead. */}
      {erasable && (
        <Line
          points={spine}
          stroke={drawing.color}
          // ~24px of screen no matter the zoom — a rendered stroke is only a
          // few px wide, which is far too fine a target to click accurately.
          strokeWidth={Math.max(drawing.width * 3, 24 / scale)}
          lineCap="round"
          lineJoin="round"
          opacity={0}
          onPointerDown={() => onErase(drawing.id)}
          onMouseEnter={(e) => {
            const c = e.target.getStage()?.container()
            if (c) c.style.cursor = "pointer"
          }}
          onMouseLeave={(e) => {
            const c = e.target.getStage()?.container()
            if (c) c.style.cursor = "cell"
          }}
        />
      )}
    </>
  )
}
