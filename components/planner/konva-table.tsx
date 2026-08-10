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

interface Props {
  table: Table
  guestCount: number
  isSelected: boolean
  onSelect: (id: string, shiftKey: boolean) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onDoubleClick: (id: string) => void
  onContextMenu: (id: string, clientX: number, clientY: number) => void
  nodeRef?: (node: Konva.Group | null) => void
  onDragStart?: (id: string) => void
  onDragMove?: (id: string, x: number, y: number) => void
}

export function KonvaTable({ table, guestCount, isSelected, onSelect, onDragEnd, onDoubleClick, onContextMenu, nodeRef, onDragStart, onDragMove }: Props) {
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
  const cx = isRect ? RECT_W / 2 : SQ_W / 2
  const cy = isRect ? RECT_H / 2 : SQ_W / 2

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

      {/* Table name */}
      <Text
        text={table.name}
        fontSize={13}
        fontStyle="bold"
        fontFamily="Inter, system-ui, sans-serif"
        fill="#111827"
        width={w}
        align="center"
        y={cy - 14}
      />

      {/* Guest count */}
      <Text
        text={`${guestCount} / ${table.capacity}`}
        fontSize={11}
        fontFamily="Inter, system-ui, sans-serif"
        fill="#6b7280"
        width={w}
        align="center"
        y={cy + 3}
      />
    </Group>
  )
}
