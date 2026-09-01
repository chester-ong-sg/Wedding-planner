"use client"

import { useEffect, useRef } from "react"
import { Text } from "react-konva"
import type { KonvaEventObject } from "konva/lib/Node"
import type Konva from "konva"
import type { TextNote } from "@/types/planner"

export const TEXT_COLOR = "#374151"
export const TEXT_SIZE = 16
export const TEXT_WIDTH = 220
export const TEXT_LINE_HEIGHT = 1.35
export const TEXT_FONT = "Inter, system-ui, sans-serif"

/** Shown in place of an empty note so it stays findable while not being edited. */
export const EMPTY_PLACEHOLDER = "Empty note"

interface Props {
  note: TextNote
  /** Hidden while its DOM editor is open, so the two don't double up. */
  isEditing: boolean
  interactive: boolean
  erasable: boolean
  scale: number
  onEdit: (id: string) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onErase: (id: string) => void
}

export function KonvaTextNote({
  note, isEditing, interactive, erasable, scale, onEdit, onDragEnd, onErase,
}: Props) {
  const isEmpty = note.text.trim().length === 0

  return (
    <Text
      x={note.x}
      y={note.y}
      text={isEmpty ? EMPTY_PLACEHOLDER : note.text}
      fontSize={note.font_size}
      fontFamily={TEXT_FONT}
      lineHeight={TEXT_LINE_HEIGHT}
      fill={isEmpty ? "#9ca3af" : note.color}
      width={note.width}
      visible={!isEditing}
      listening={interactive || erasable}
      draggable={interactive}
      // Text glyphs alone are a thin hit target; pad the box out so notes are
      // easy to grab and to click with the eraser.
      hitStrokeWidth={Math.max(12, 12 / scale)}
      onDblClick={interactive ? () => onEdit(note.id) : undefined}
      onPointerDown={erasable ? () => onErase(note.id) : undefined}
      onDragEnd={(e: KonvaEventObject<DragEvent>) => onDragEnd(note.id, e.target.x(), e.target.y())}
      onMouseEnter={(e) => {
        const c = e.target.getStage()?.container()
        if (c) c.style.cursor = erasable ? "pointer" : interactive ? "move" : ""
      }}
      onMouseLeave={(e) => {
        const c = e.target.getStage()?.container()
        if (c) c.style.cursor = erasable ? "cell" : ""
      }}
    />
  )
}

interface EditorProps {
  note: TextNote
  stage: Konva.Stage
  onCommit: (id: string, text: string) => void
}

/**
 * Konva has no text input, so editing happens in a real <textarea> laid over
 * the canvas and transformed to match the stage. Sized in screen units from the
 * note's canvas geometry so the text keeps its position and size while zoomed.
 */
export function TextNoteEditor({ note, stage, onCommit }: EditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  // The editor mounts during pointerdown, so the click's own mouseup lands on
  // the canvas and immediately blurs it. Committing then would discard the note
  // as empty before a key is ever pressed, so ignore blur until settled.
  const readyRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    const id = requestAnimationFrame(() => { readyRef.current = true })
    return () => cancelAnimationFrame(id)
  }, [])

  const scale = stage.scaleX()
  const left = note.x * scale + stage.x()
  const top = note.y * scale + stage.y()

  const commit = () => onCommit(note.id, ref.current?.value ?? "")

  return (
    <textarea
      ref={ref}
      defaultValue={note.text}
      onBlur={() => {
        // Spurious blur from the creating click — take focus back
        if (!readyRef.current) { ref.current?.focus(); return }
        commit()
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === "Escape") {
          e.preventDefault()
          commit()
        }
      }}
      spellCheck={false}
      style={{
        position: "absolute",
        left,
        top,
        width: note.width * scale,
        // Grows with content rather than scrolling inside a fixed box
        height: "auto",
        minHeight: note.font_size * TEXT_LINE_HEIGHT * scale,
        fontSize: note.font_size * scale,
        lineHeight: TEXT_LINE_HEIGHT,
        fontFamily: TEXT_FONT,
        color: note.color,
        background: "transparent",
        border: "none",
        outline: "1px dashed #9ca3af",
        outlineOffset: 2,
        padding: 0,
        margin: 0,
        resize: "none",
        overflow: "hidden",
        zIndex: 10,
      }}
      onInput={(e) => {
        // Auto-grow so long notes stay fully visible while typing
        const el = e.currentTarget
        el.style.height = "auto"
        el.style.height = `${el.scrollHeight}px`
      }}
    />
  )
}
