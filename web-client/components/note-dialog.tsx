"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { Note } from "@/types/note"

interface NoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (noteData: { title: string; content: string }) => Promise<void>
  defaultValues?: Partial<Pick<Note, "title" | "text">>
  isSaving?: boolean
}

export function NoteDialog({
  open,
  onOpenChange,
  onSave,
  defaultValues = { title: "", text: "" },
  isSaving = false,
}: NoteDialogProps) {
  const [title, setTitle] = useState(defaultValues.title ?? "")
  const [content, setContent] = useState(defaultValues.text ?? "")

  console.log('[NoteDialog] Rendering - isSaving prop:', isSaving);

  // *** TEMPORARILY COMMENT OUT this useEffect ***
  /*
  useEffect(() => {
    setTitle(defaultValues.title ?? "")
    setContent(defaultValues.text ?? "")
  }, [defaultValues])
  */
  // *******************************************

  const handleInternalSave = async () => {
    if (!content.trim()) return

    try {
      await onSave({
        title: title.trim() || "",
        content: content.trim(),
      })
      onOpenChange(false)
    } catch (error) {
      console.error("Error during save operation (passed up from dialog):", error)
    }
  }

  const dialogTitle = defaultValues.text ? "Edit Note" : "Create Note"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title (optional)</Label>
            <Input 
                id="title" 
                placeholder="Enter a title..." 
                value={title} 
                onChange={(e) => {
                    console.log("[NoteDialog] Title onChange fired. New value:", e.target.value);
                    setTitle(e.target.value);
                }} 
                disabled={isSaving} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              placeholder="Write your note here..."
              value={content}
              onChange={(e) => {
                  console.log("[NoteDialog] Content onChange fired. New value:", e.target.value);
                  setContent(e.target.value);
              }}
              className="min-h-[200px]"
              disabled={isSaving}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleInternalSave} disabled={!content.trim() || isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
