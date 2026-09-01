"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { Stage, Layer, Rect, Line } from "react-konva"
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import { KonvaTable, TABLE_RADIUS, SQ_W, RECT_W, RECT_H, snap } from "./konva-table"
import { KonvaDrawing, strokeOutline, strokeBounds, grainTile, asPatternImage, PENCIL_COLOR, PENCIL_WIDTH } from "./konva-drawing"
import { KonvaTextNote, TextNoteEditor, TEXT_SIZE, TEXT_LINE_HEIGHT } from "./konva-text-note"
import type { Table, Guest, Drawing, TextNote } from "@/types/planner"

const SCALE_BY = 1.06
const MIN_SCALE = 0.1
const MAX_SCALE = 3.0
const INITIAL_SCALE = 0.7
const GRID_SIZE = 160

/** Below this zoom individual guest names are too small to read, so tables show a count instead. */
const NAME_LOD_SCALE = 0.9

/** Padding around the content bounding box, in canvas units. */
const CONTENT_PAD = 60

/** Minimum pointer travel (screen px) before a new sample is recorded. */
const SAMPLE_DIST = 2

export type PlannerTool = "select" | "pencil" | "text" | "eraser"

interface TableMove {
  id: string
  x: number
  y: number
}

export interface CanvasControls {
  zoomBy: (delta: number) => void
  fitToContent: () => void
  exportPNG: (filename?: string) => void
}

interface Props {
  tables: Table[]
  guests: Guest[]
  drawings: Drawing[]
  textNotes: TextNote[]
  editingTextId: string | null
  selectedIds: Set<string>
  tool: PlannerTool
  stageRef: React.RefObject<Konva.Stage | null>
  controlsRef: React.RefObject<CanvasControls | null>
  onSelect: (id: string, shiftKey: boolean) => void
  onDragEnd: (moves: TableMove[]) => void
  onStageClick: () => void
  onMarqueeSelect: (ids: string[]) => void
  onDoubleClick: (id: string) => void
  onContextMenu: (id: string, clientX: number, clientY: number) => void
  onDrawEnd: (points: number[]) => void
  onErase: (id: string) => void
  onTextCreate: (x: number, y: number) => void
  onTextEdit: (id: string) => void
  onTextCommit: (id: string, text: string) => void
  onTextMove: (id: string, x: number, y: number) => void
  onTextErase: (id: string) => void
}

/** Bounding box of all canvas content, padded, in canvas coordinates. */
function contentBBox(tables: Table[], drawings: Drawing[], textNotes: TextNote[] = []) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const t of tables) {
    const w = t.shape === "rectangular" ? RECT_W : SQ_W
    const h = t.shape === "rectangular" ? RECT_H : SQ_W
    minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x + w)
    minY = Math.min(minY, t.y); maxY = Math.max(maxY, t.y + h)
  }
  for (const d of drawings) {
    const b = strokeBounds(d.points)
    if (!Number.isFinite(b.minX)) continue
    minX = Math.min(minX, b.minX - d.width); maxX = Math.max(maxX, b.maxX + d.width)
    minY = Math.min(minY, b.minY - d.width); maxY = Math.max(maxY, b.maxY + d.width)
  }
  for (const n of textNotes) {
    // Height is approximated from the wrapped line count; exact metrics would
    // need the Konva node, and the padding below absorbs the difference.
    const lines = Math.max(1, n.text.split("\n").length)
    const h = lines * n.font_size * TEXT_LINE_HEIGHT
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x + n.width)
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y + h)
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 }
  return {
    x: minX - CONTENT_PAD,
    y: minY - CONTENT_PAD,
    width: (maxX - minX) + CONTENT_PAD * 2,
    height: (maxY - minY) + CONTENT_PAD * 2,
  }
}

export function KonvaStage({
  tables, guests, drawings, textNotes, editingTextId, selectedIds, tool, stageRef, controlsRef,
  onSelect, onDragEnd, onStageClick, onMarqueeSelect, onDoubleClick, onContextMenu,
  onDrawEnd, onErase, onTextCreate, onTextEdit, onTextCommit, onTextMove, onTextErase,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [scale, setScale] = useState(INITIAL_SCALE)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [gridPattern, setGridPattern] = useState<HTMLCanvasElement | null>(null)

  const [isExporting, setIsExporting] = useState(false)
  const exportNameRef = useRef("seating-chart.png")

  // Marquee state
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null)
  const isMarqueeingRef = useRef(false)
  const spaceHeldRef = useRef(false)

  // Live pencil stroke. Kept in refs and pushed straight onto the Konva node —
  // routing 60fps pointer samples through setState would stutter badly.
  const drawLayerRef = useRef<Konva.Layer>(null)
  const liveLineRef = useRef<Konva.Line>(null)
  const livePointsRef = useRef<number[]>([])
  const isDrawingRef = useRef(false)

  // Group drag refs
  const nodeRefs = useRef<Map<string, Konva.Group>>(new Map())
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map())

  const selectedIdsRef = useRef(selectedIds)
  useEffect(() => { selectedIdsRef.current = selectedIds }, [selectedIds])
  const toolRef = useRef(tool)
  useEffect(() => { toolRef.current = tool }, [tool])

  const showNames = scale >= NAME_LOD_SCALE

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const c = document.createElement("canvas")
    c.width = GRID_SIZE
    c.height = GRID_SIZE
    const ctx = c.getContext("2d")!
    ctx.strokeStyle = "#e5e7eb"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(GRID_SIZE, 0); ctx.lineTo(GRID_SIZE, GRID_SIZE)
    ctx.moveTo(0, GRID_SIZE); ctx.lineTo(GRID_SIZE, GRID_SIZE)
    ctx.stroke()
    setGridPattern(c)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault()
        spaceHeldRef.current = true
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceHeldRef.current = false
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [])

  // Cursor reflects the active tool
  useEffect(() => {
    const c = stageRef.current?.container()
    if (!c) return
    c.style.cursor =
      tool === "pencil" ? "crosshair" : tool === "eraser" ? "cell" : tool === "text" ? "text" : ""
    return () => { c.style.cursor = "" }
  }, [tool, size.width, stageRef])

  // ── Imperative controls ───────────────────────────────────────────────────

  const zoomBy = useCallback((delta: number) => {
    const stage = stageRef.current
    if (!stage) return
    const oldScale = stage.scaleX()
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, oldScale + delta))
    const centre = { x: stage.width() / 2, y: stage.height() / 2 }
    const origin = {
      x: (centre.x - stage.x()) / oldScale,
      y: (centre.y - stage.y()) / oldScale,
    }
    setScale(newScale)
    setPos({ x: centre.x - origin.x * newScale, y: centre.y - origin.y * newScale })
  }, [stageRef])

  const fitToContent = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    if (tables.length === 0 && drawings.length === 0 && textNotes.length === 0) {
      setScale(INITIAL_SCALE)
      setPos({ x: 0, y: 0 })
      return
    }
    const box = contentBBox(tables, drawings, textNotes)
    const newScale = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, Math.min(stage.width() / box.width, stage.height() / box.height)),
    )
    setScale(newScale)
    setPos({
      x: (stage.width() - box.width * newScale) / 2 - box.x * newScale,
      y: (stage.height() - box.height * newScale) / 2 - box.y * newScale,
    })
  }, [tables, drawings, textNotes, stageRef])

  const exportPNG = useCallback((filename = "seating-chart.png") => {
    if (tables.length === 0 && drawings.length === 0 && textNotes.length === 0) return
    exportNameRef.current = filename
    setIsExporting(true)
  }, [tables, drawings, textNotes])

  useEffect(() => {
    controlsRef.current = { zoomBy, fitToContent, exportPNG }
  }, [controlsRef, zoomBy, fitToContent, exportPNG])

  useEffect(() => {
    if (!isExporting) return
    const stage = stageRef.current
    if (!stage) { setIsExporting(false); return }

    const box = contentBBox(tables, drawings, textNotes)
    const prevScale = stage.scaleX()
    const prevPos = stage.position()

    let uri: string | null = null
    try {
      stage.scale({ x: 1, y: 1 })
      stage.position({ x: -box.x, y: -box.y })
      stage.draw()
      uri = stage.toDataURL({ x: 0, y: 0, width: box.width, height: box.height, pixelRatio: 2 })
    } catch (err) {
      console.error("PNG export failed:", err)
    } finally {
      stage.scale({ x: prevScale, y: prevScale })
      stage.position(prevPos)
      stage.draw()
      setIsExporting(false)
    }

    if (uri) {
      const a = document.createElement("a")
      a.href = uri
      a.download = exportNameRef.current
      a.click()
    }
  }, [isExporting, tables, drawings, textNotes, stageRef])

  // ── Pencil ────────────────────────────────────────────────────────────────

  const pressureOf = (e: KonvaEventObject<PointerEvent>) => {
    const p = e.evt.pressure
    // Mice report 0 or a constant 0.5; treat anything falsy as neutral.
    return typeof p === "number" && p > 0 ? p : 0.5
  }

  const redrawLive = useCallback(() => {
    const line = liveLineRef.current
    if (!line) return
    line.points(strokeOutline(livePointsRef.current, PENCIL_WIDTH))
    drawLayerRef.current?.batchDraw()
  }, [])

  const finishStroke = useCallback(() => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    const pts = livePointsRef.current
    livePointsRef.current = []
    liveLineRef.current?.points([])
    drawLayerRef.current?.batchDraw()
    // Need at least two samples to be a stroke rather than a stray click
    if (pts.length >= 6) onDrawEnd(pts)
  }, [onDrawEnd])

  // ── Pointer handling ──────────────────────────────────────────────────────

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const origin = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }
    const newScale = e.evt.deltaY < 0
      ? Math.min(oldScale * SCALE_BY, MAX_SCALE)
      : Math.max(oldScale / SCALE_BY, MIN_SCALE)
    setScale(newScale)
    setPos({ x: pointer.x - origin.x * newScale, y: pointer.y - origin.y * newScale })
  }

  const handlePointerDown = (e: KonvaEventObject<PointerEvent>) => {
    const stage = stageRef.current
    if (!stage) return
    if (e.evt.button && e.evt.button !== 0) return

    // Space-drag pans regardless of the active tool
    if (spaceHeldRef.current && e.target === stage) {
      stage.draggable(true)
      return
    }
    stage.draggable(false)

    if (tool === "pencil") {
      const p = stage.getRelativePointerPosition()
      if (!p) return
      isDrawingRef.current = true
      livePointsRef.current = [p.x, p.y, pressureOf(e)]
      redrawLive()
      return
    }

    if (tool === "text") {
      // Clicking an existing note edits it; clicking blank canvas makes one.
      // Konva reports the Stage as target only when nothing was hit.
      if (e.target !== stage) return
      const p = stage.getRelativePointerPosition()
      if (p) onTextCreate(p.x, p.y - TEXT_SIZE / 2)
      return
    }

    // Eraser: individual strokes handle their own hit; empty space does nothing
    if (tool === "eraser") return

    if (e.target === stage) {
      const p = stage.getRelativePointerPosition()
      if (p) {
        marqueeStartRef.current = p
        isMarqueeingRef.current = false
      }
    }
  }

  const handlePointerMove = () => {
    const stage = stageRef.current
    if (!stage) return

    if (isDrawingRef.current) {
      const p = stage.getRelativePointerPosition()
      if (!p) return
      const pts = livePointsRef.current
      const lastX = pts[pts.length - 3]
      const lastY = pts[pts.length - 2]
      // Threshold in screen space so sampling stays even across zoom levels
      const min = SAMPLE_DIST / stage.scaleX()
      if (Math.hypot(p.x - lastX, p.y - lastY) < min) return
      pts.push(p.x, p.y, 0.5)
      redrawLive()
      return
    }

    if (!marqueeStartRef.current) return
    const p = stage.getRelativePointerPosition()
    if (!p) return
    const start = marqueeStartRef.current
    const dx = p.x - start.x
    const dy = p.y - start.y
    if (!isMarqueeingRef.current && dx * dx + dy * dy > 25) isMarqueeingRef.current = true
    if (isMarqueeingRef.current) setMarquee({ x1: start.x, y1: start.y, x2: p.x, y2: p.y })
  }

  const handlePointerUp = useCallback(() => {
    if (isDrawingRef.current) { finishStroke(); return }

    const stage = stageRef.current
    if (isMarqueeingRef.current && stage && marqueeStartRef.current) {
      const p = stage.getRelativePointerPosition()
      if (p) {
        const start = marqueeStartRef.current
        const mx = Math.min(start.x, p.x)
        const my = Math.min(start.y, p.y)
        const mw = Math.abs(p.x - start.x)
        const mh = Math.abs(p.y - start.y)
        const selected = tables
          .filter(t => {
            const tw = t.shape === "rectangular" ? RECT_W : SQ_W
            const th = t.shape === "rectangular" ? RECT_H : SQ_W
            return !(t.x + tw < mx || t.x > mx + mw || t.y + th < my || t.y > my + mh)
          })
          .map(t => t.id)
        onMarqueeSelect(selected)
      }
    } else if (!isMarqueeingRef.current && marqueeStartRef.current) {
      onStageClick()
    }
    marqueeStartRef.current = null
    isMarqueeingRef.current = false
    setMarquee(null)
  }, [tables, onMarqueeSelect, onStageClick, stageRef, finishStroke])

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    if (e.target !== stageRef.current) return
    setPos({ x: e.target.x(), y: e.target.y() })
    stageRef.current!.draggable(false)
  }

  // ── Group drag coordination ───────────────────────────────────────────────

  const handleTableDragStart = useCallback((id: string) => {
    const starts = new Map<string, { x: number; y: number }>()
    const all = new Set([...selectedIdsRef.current, id])
    all.forEach(sid => {
      const node = nodeRefs.current.get(sid)
      if (node) starts.set(sid, { x: node.x(), y: node.y() })
    })
    dragStartPositions.current = starts
  }, [])

  const handleTableDragMove = useCallback((id: string, sx: number, sy: number) => {
    if (!selectedIdsRef.current.has(id)) return
    const start = dragStartPositions.current.get(id)
    if (!start) return
    const dx = sx - start.x
    const dy = sy - start.y
    selectedIdsRef.current.forEach(sid => {
      if (sid === id) return
      const node = nodeRefs.current.get(sid)
      const nodeStart = dragStartPositions.current.get(sid)
      if (!node || !nodeStart) return
      node.position({ x: snap(nodeStart.x + dx), y: snap(nodeStart.y + dy) })
    })
  }, [])

  const handleTableDragEnd = useCallback((id: string, x: number, y: number) => {
    const moves: TableMove[] = []
    if (selectedIdsRef.current.has(id) && selectedIdsRef.current.size > 1) {
      selectedIdsRef.current.forEach(sid => {
        const node = nodeRefs.current.get(sid)
        if (node) moves.push({ id: sid, x: snap(node.x()), y: snap(node.y()) })
      })
    } else {
      moves.push({ id, x, y })
    }
    onDragEnd(moves)
  }, [onDragEnd])

  const getNodeRef = (id: string) => (node: Konva.Group | null) => {
    if (node) nodeRefs.current.set(id, node)
    else nodeRefs.current.delete(id)
  }

  const editingNote = editingTextId ? textNotes.find(n => n.id === editingTextId) ?? null : null

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {size.width > 0 && (
        <Stage
          ref={stageRef as React.RefObject<Konva.Stage>}
          width={size.width}
          height={size.height}
          scaleX={scale}
          scaleY={scale}
          x={pos.x}
          y={pos.y}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onDragEnd={handleDragEnd}
        >
          {/* Background — grid on screen, flat white in exports */}
          <Layer listening={false}>
            {isExporting ? (
              <Rect x={-10000} y={-10000} width={20000} height={20000} fill="#ffffff" />
            ) : gridPattern ? (
              <Rect
                x={-10000} y={-10000} width={20000} height={20000}
                fillPatternImage={asPatternImage(gridPattern)}
                fillPatternRepeat="repeat"
              />
            ) : null}
          </Layer>

          {/* Pencil strokes, under the tables so they read as annotations */}
          <Layer ref={drawLayerRef}>
            {drawings.map(d => (
              <KonvaDrawing
                key={d.id}
                drawing={d}
                erasable={tool === "eraser" && !isExporting}
                scale={scale}
                onErase={onErase}
              />
            ))}
            {/* In-progress stroke, driven imperatively */}
            <Line
              ref={liveLineRef}
              points={[]}
              closed
              fill={PENCIL_COLOR}
              fillPatternImage={asPatternImage(grainTile(PENCIL_COLOR))}
              fillPatternRepeat="repeat"
              fillPriority="pattern"
              opacity={0.92}
              listening={false}
            />
          </Layer>

          {/* Table nodes */}
          <Layer>
            {tables.map(t => (
              <KonvaTable
                key={t.id}
                table={t}
                guestNames={guests.filter(g => g.table_id === t.id).map(g => g.name)}
                isSelected={!isExporting && selectedIds.has(t.id)}
                showNames={showNames || isExporting}
                interactive={tool === "select" && !isExporting}
                onSelect={onSelect}
                onDragEnd={handleTableDragEnd}
                onDoubleClick={onDoubleClick}
                onContextMenu={onContextMenu}
                nodeRef={getNodeRef(t.id)}
                onDragStart={handleTableDragStart}
                onDragMove={handleTableDragMove}
              />
            ))}

            {marquee && (
              <Rect
                x={Math.min(marquee.x1, marquee.x2)}
                y={Math.min(marquee.y1, marquee.y2)}
                width={Math.abs(marquee.x2 - marquee.x1)}
                height={Math.abs(marquee.y2 - marquee.y1)}
                fill="rgba(59,130,246,0.08)"
                stroke="#3b82f6"
                strokeWidth={1 / scale}
                dash={[4 / scale, 4 / scale]}
                listening={false}
              />
            )}
          </Layer>

          {/* Text annotations sit above tables so notes are never obscured */}
          <Layer>
            {textNotes.map(n => (
              <KonvaTextNote
                key={n.id}
                note={n}
                isEditing={n.id === editingTextId}
                interactive={(tool === "select" || tool === "text") && !isExporting}
                erasable={tool === "eraser" && !isExporting}
                scale={scale}
                onEdit={onTextEdit}
                onDragEnd={onTextMove}
                onErase={onTextErase}
              />
            ))}
          </Layer>
        </Stage>
      )}

      {/* DOM editor overlaid on the canvas — Konva has no text input */}
      {editingNote && stageRef.current && (
        <TextNoteEditor
          key={editingNote.id}
          note={editingNote}
          stage={stageRef.current}
          onCommit={onTextCommit}
        />
      )}
    </div>
  )
}
