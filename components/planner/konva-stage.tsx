"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { Stage, Layer, Rect } from "react-konva"
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import { KonvaTable, TABLE_RADIUS, SQ_W, RECT_W, RECT_H, snap } from "./konva-table"
import type { Table, Guest } from "@/types/planner"

const SCALE_BY = 1.06
const MIN_SCALE = 0.1
const MAX_SCALE = 3.0
const INITIAL_SCALE = 0.7
const GRID_SIZE = 160

/** Below this zoom individual guest names are too small to read, so tables show a count instead. */
const NAME_LOD_SCALE = 0.9

/** Padding around the content bounding box, in canvas units. */
const CONTENT_PAD = 60

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
  selectedIds: Set<string>
  stageRef: React.RefObject<Konva.Stage | null>
  controlsRef: React.RefObject<CanvasControls | null>
  onSelect: (id: string, shiftKey: boolean) => void
  onDragEnd: (moves: TableMove[]) => void
  onStageClick: () => void
  onMarqueeSelect: (ids: string[]) => void
  onDoubleClick: (id: string) => void
  onContextMenu: (id: string, clientX: number, clientY: number) => void
}

/** Bounding box of every table, padded, in canvas coordinates. */
function contentBBox(tables: Table[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const t of tables) {
    const w = t.shape === "rectangular" ? RECT_W : SQ_W
    const h = t.shape === "rectangular" ? RECT_H : SQ_W
    minX = Math.min(minX, t.x)
    minY = Math.min(minY, t.y)
    maxX = Math.max(maxX, t.x + w)
    maxY = Math.max(maxY, t.y + h)
  }
  return {
    x: minX - CONTENT_PAD,
    y: minY - CONTENT_PAD,
    width: (maxX - minX) + CONTENT_PAD * 2,
    height: (maxY - minY) + CONTENT_PAD * 2,
  }
}

export function KonvaStage({
  tables, guests, selectedIds, stageRef, controlsRef,
  onSelect, onDragEnd, onStageClick, onMarqueeSelect, onDoubleClick, onContextMenu,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [scale, setScale] = useState(INITIAL_SCALE)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [gridPattern, setGridPattern] = useState<HTMLCanvasElement | null>(null)

  // Export runs across a render: the flag strips selection/grid chrome, then an
  // effect captures the now-clean scene.
  const [isExporting, setIsExporting] = useState(false)
  const exportNameRef = useRef("seating-chart.png")

  // Marquee state
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null)
  const isMarqueeingRef = useRef(false)
  const spaceHeldRef = useRef(false)

  // Group drag refs
  const nodeRefs = useRef<Map<string, Konva.Group>>(new Map())
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map())

  // selectedIds ref so event handlers always see the current value
  const selectedIdsRef = useRef(selectedIds)
  useEffect(() => { selectedIdsRef.current = selectedIds }, [selectedIds])

  const showNames = scale >= NAME_LOD_SCALE

  // Measure container so Stage fills it exactly
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Build a tiny repeating grid tile once
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

  // Space key: hold to pan
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

  // ── Imperative controls exposed to the toolbar ────────────────────────────

  const zoomBy = useCallback((delta: number) => {
    const stage = stageRef.current
    if (!stage) return
    const oldScale = stage.scaleX()
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, oldScale + delta))
    // Keep the viewport centre fixed rather than the canvas origin
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
    if (tables.length === 0) {
      setScale(INITIAL_SCALE)
      setPos({ x: 0, y: 0 })
      return
    }
    const box = contentBBox(tables)
    const newScale = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, Math.min(stage.width() / box.width, stage.height() / box.height)),
    )
    setScale(newScale)
    setPos({
      x: (stage.width() - box.width * newScale) / 2 - box.x * newScale,
      y: (stage.height() - box.height * newScale) / 2 - box.y * newScale,
    })
  }, [tables, stageRef])

  const exportPNG = useCallback((filename = "seating-chart.png") => {
    if (tables.length === 0) return
    exportNameRef.current = filename
    setIsExporting(true)
  }, [tables])

  useEffect(() => {
    controlsRef.current = { zoomBy, fitToContent, exportPNG }
  }, [controlsRef, zoomBy, fitToContent, exportPNG])

  // Capture once the chrome-free render has committed
  useEffect(() => {
    if (!isExporting) return
    const stage = stageRef.current
    if (!stage) { setIsExporting(false); return }

    const box = contentBBox(tables)
    const prevScale = stage.scaleX()
    const prevPos = stage.position()

    let uri: string | null = null
    try {
      // Capture at 1:1 regardless of the current viewport transform
      stage.scale({ x: 1, y: 1 })
      stage.position({ x: -box.x, y: -box.y })
      stage.draw()
      uri = stage.toDataURL({
        x: 0, y: 0,
        width: box.width, height: box.height,
        pixelRatio: 2,
      })
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
  }, [isExporting, tables, stageRef])

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
    setPos({
      x: pointer.x - origin.x * newScale,
      y: pointer.y - origin.y * newScale,
    })
  }

  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current
    if (!stage) return
    if (e.target === stage) {
      if (spaceHeldRef.current) {
        stage.draggable(true)
      } else {
        stage.draggable(false)
        const p = stage.getRelativePointerPosition()
        if (p) {
          marqueeStartRef.current = p
          isMarqueeingRef.current = false
        }
      }
    } else {
      stage.draggable(false)
    }
  }

  const handleMouseMove = () => {
    if (!marqueeStartRef.current) return
    const stage = stageRef.current
    if (!stage) return
    const p = stage.getRelativePointerPosition()
    if (!p) return
    const start = marqueeStartRef.current
    const dx = p.x - start.x
    const dy = p.y - start.y
    if (!isMarqueeingRef.current && dx * dx + dy * dy > 25) {
      isMarqueeingRef.current = true
    }
    if (isMarqueeingRef.current) {
      setMarquee({ x1: start.x, y1: start.y, x2: p.x, y2: p.y })
    }
  }

  const handleMouseUp = useCallback(() => {
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
  }, [tables, onMarqueeSelect, onStageClick, stageRef])

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    // Ignore dragend events that bubbled up from table nodes
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

  return (
    <div ref={containerRef} className="w-full h-full">
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
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDragEnd={handleDragEnd}
        >
          {/* Background — grid on screen, flat white in exports */}
          <Layer listening={false}>
            {isExporting ? (
              <Rect x={-10000} y={-10000} width={20000} height={20000} fill="#ffffff" />
            ) : gridPattern ? (
              <Rect
                x={-10000}
                y={-10000}
                width={20000}
                height={20000}
                fillPatternImage={gridPattern}
                fillPatternRepeat="repeat"
              />
            ) : null}
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
                onSelect={onSelect}
                onDragEnd={handleTableDragEnd}
                onDoubleClick={onDoubleClick}
                onContextMenu={onContextMenu}
                nodeRef={getNodeRef(t.id)}
                onDragStart={handleTableDragStart}
                onDragMove={handleTableDragMove}
              />
            ))}

            {/* Marquee selection rectangle */}
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
        </Stage>
      )}
    </div>
  )
}
