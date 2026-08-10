"use client"

import { useRef, useEffect, useState } from "react"
import { Stage, Layer, Rect } from "react-konva"
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import { KonvaTable } from "./konva-table"
import type { Table, Guest } from "@/types/planner"

const SCALE_BY = 1.06
const MIN_SCALE = 0.1
const MAX_SCALE = 3.0
const INITIAL_SCALE = 0.7
const GRID_SIZE = 160

interface Props {
  tables: Table[]
  guests: Guest[]
  selectedIds: Set<string>
  stageRef: React.RefObject<Konva.Stage | null>
  onSelect: (id: string, shiftKey: boolean) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onStageClick: () => void
  onDoubleClick: (id: string) => void
  onContextMenu: (id: string, clientX: number, clientY: number) => void
}

export function KonvaStage({
  tables, guests, selectedIds, stageRef,
  onSelect, onDragEnd, onStageClick, onDoubleClick, onContextMenu,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [scale, setScale] = useState(INITIAL_SCALE)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [gridPattern, setGridPattern] = useState<HTMLCanvasElement | null>(null)

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
    const newPos = {
      x: pointer.x - origin.x * newScale,
      y: pointer.y - origin.y * newScale,
    }
    setScale(newScale)
    setPos(newPos)
  }

  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current
    if (!stage) return
    // Only pan when clicking on the stage background (not a shape)
    if (e.target === stage) {
      stage.draggable(true)
      onStageClick()
    } else {
      stage.draggable(false)
    }
  }

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    setPos({ x: e.target.x(), y: e.target.y() })
    const stage = stageRef.current
    if (stage) stage.draggable(false)
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
          onDragEnd={handleDragEnd}
        >
          {/* Non-interactive grid background */}
          <Layer listening={false}>
            {gridPattern && (
              <Rect
                x={-10000}
                y={-10000}
                width={20000}
                height={20000}
                fillPatternImage={gridPattern}
                fillPatternRepeat="repeat"
              />
            )}
          </Layer>

          {/* Table nodes */}
          <Layer>
            {tables.map(t => (
              <KonvaTable
                key={t.id}
                table={t}
                guestCount={guests.filter(g => g.table_id === t.id).length}
                isSelected={selectedIds.has(t.id)}
                onSelect={onSelect}
                onDragEnd={onDragEnd}
                onDoubleClick={onDoubleClick}
                onContextMenu={onContextMenu}
              />
            ))}
          </Layer>
        </Stage>
      )}
    </div>
  )
}
