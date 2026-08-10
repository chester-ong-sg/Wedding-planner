"use client"

import { Group, Circle, Rect, Text } from "react-konva"
import type { KonvaEventObject } from "konva/lib/Node"
import type Konva from "konva"
import type { Table } from "@/types/planner"

export const TABLE_RADIUS = 75
export const SQ_W = 150
export const RECT_W = 200
export const RECT_H = 100
export const SNAP = 40

export const snap = (v: number) => Math.round(v / SNAP) * SNAP

const FONT = "Inter, system-ui, sans-serif"

// Text layout metrics (canvas units, before stage scale)
const HEADER_FS = 12
const NAME_FS = 10
const FOOTER_FS = 10
const HEADER_H = 17
const LINE_H = 12
const FOOTER_H = 12

// Inner box each shape can safely fit text into. For round tables this is the
// inscribed square, inset a little so names never touch the stroke.
const CONTENT_BOX: Record<Table["shape"], { x: number; y: number; w: number; h: number }> = {
  round: { x: 22, y: 24, w: 106, h: 102 },
  square: { x: 14, y: 14, w: 122, h: 122 },
  rectangular: { x: 12, y: 12, w: 176, h: 76 },
}

/** How many guest lines fit inside a shape between the header and the footer. */
function maxLinesFor(shape: Table["shape"]) {
  const box = CONTENT_BOX[shape]
  return Math.max(0, Math.floor((box.h - HEADER_H - FOOTER_H) / LINE_H))
}

/** Fit guest names into the available lines, collapsing the overflow into "+N more". */
function fitNames(names: string[], maxLines: number): string[] {
  if (maxLines <= 0) return []
  if (names.length <= maxLines) return names
  const shown = names.slice(0, maxLines - 1)
  return [...shown, `+${names.length - shown.length} more`]
}

interface Props {
  table: Table
  guestNames: string[]
  isSelected: boolean
  /** Zoomed in far enough that individual guest names are legible. */
  showNames: boolean
  onSelect: (id: string, shiftKey: boolean) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onDoubleClick: (id: string) => void
  onContextMenu: (id: string, clientX: number, clientY: number) => void
  nodeRef?: (node: Konva.Group | null) => void
  onDragStart?: (id: string) => void
  onDragMove?: (id: string, x: number, y: number) => void
}

export function KonvaTable({
  table, guestNames, isSelected, showNames,
  onSelect, onDragEnd, onDoubleClick, onContextMenu, nodeRef, onDragStart, onDragMove,
}: Props) {
  const fill = isSelected ? "#eff6ff" : "#ffffff"
  const stroke = isSelected ? "#3b82f6" : "#1f2937"
  const strokeWidth = isSelected ? 2.5 : 2

  const sharedShape = {
    fill,
    stroke,
    strokeWidth,
    shadowColor: "black",
    shadowBlur: isSelected ? 10 : 4,
    shadowOpacity: isSelected ? 0.18 : 0.08,
    shadowOffsetX: 0,
    shadowOffsetY: 2,
  }

  const isRect = table.shape === "rectangular"
  const w = isRect ? RECT_W : SQ_W
  const h = isRect ? RECT_H : SQ_W
  const cy = isRect ? RECT_H / 2 : SQ_W / 2

  const box = CONTENT_BOX[table.shape]
  const lines = showNames ? fitNames(guestNames, maxLinesFor(table.shape)) : []
  const countLabel = `${guestNames.length} / ${table.capacity}`

  return (
    <Group
      ref={nodeRef}
      x={table.x}
      y={table.y}
      draggable
      onClick={(e: KonvaEventObject<MouseEvent>) => onSelect(table.id, e.evt.shiftKey)}
      onDblClick={() => onDoubleClick(table.id)}
      onContextMenu={(e: KonvaEventObject<MouseEvent>) => {
        e.evt.preventDefault()
        onContextMenu(table.id, e.evt.clientX, e.evt.clientY)
      }}
      onDragStart={() => onDragStart?.(table.id)}
      onDragMove={(e: KonvaEventObject<DragEvent>) => {
        const sx = snap(e.target.x())
        const sy = snap(e.target.y())
        e.target.position({ x: sx, y: sy })
        onDragMove?.(table.id, sx, sy)
      }}
      onDragEnd={(e: KonvaEventObject<DragEvent>) => {
        onDragEnd(table.id, snap(e.target.x()), snap(e.target.y()))
      }}
    >
      {table.shape === "round" ? (
        <Circle x={TABLE_RADIUS} y={TABLE_RADIUS} radius={TABLE_RADIUS} {...sharedShape} />
      ) : (
        <Rect width={w} height={h} cornerRadius={8} {...sharedShape} />
      )}

      {showNames ? (
        <>
          {/* Table name pinned to the top of the content box */}
          <Text
            text={table.name}
            fontSize={HEADER_FS}
            fontStyle="bold"
            fontFamily={FONT}
            fill="#111827"
            x={box.x}
            y={box.y}
            width={box.w}
            align="center"
            wrap="none"
            ellipsis
          />

          {/* Guest names — one Text per line so `ellipsis` only fires on genuine
              overflow. A single multi-line Text appends "…" at every newline. */}
          {lines.map((line, i) => (
            <Text
              key={i}
              text={line}
              fontSize={NAME_FS}
              fontFamily={FONT}
              fill={line.startsWith("+") ? "#9ca3af" : "#374151"}
              x={box.x}
              y={box.y + HEADER_H + i * LINE_H}
              width={box.w}
              align="center"
              wrap="none"
              ellipsis
            />
          ))}

          {/* Count pinned to the bottom of the content box */}
          <Text
            text={countLabel}
            fontSize={FOOTER_FS}
            fontFamily={FONT}
            fill="#9ca3af"
            x={box.x}
            y={box.y + box.h - FOOTER_H}
            width={box.w}
            align="center"
          />
        </>
      ) : (
        <>
          {/* Zoomed out — name + count only, centred */}
          <Text
            text={table.name}
            fontSize={13}
            fontStyle="bold"
            fontFamily={FONT}
            fill="#111827"
            width={w}
            align="center"
            y={cy - 14}
          />
          <Text
            text={countLabel}
            fontSize={11}
            fontFamily={FONT}
            fill="#6b7280"
            width={w}
            align="center"
            y={cy + 3}
          />
        </>
      )}
    </Group>
  )
}
