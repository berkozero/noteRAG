"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Edit, Trash2 } from "lucide-react"
import type { Note } from "@/types/note"

interface NoteCardProps {
  note: Note
  onEdit?: () => void
  onDelete?: () => void
  showActions?: boolean
}

export function NoteCard({ note, onEdit, onDelete, showActions = true }: NoteCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date)
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{note.title || "Untitled Note"}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-line">{note.text}</p>
      </CardContent>
      <CardFooter className="flex justify-between pt-2 text-xs text-muted-foreground">
        <span>Updated {formatDate(note.updated_at)}</span>

        {showActions && (
          <div className="flex gap-1">
            {/* Edit button deferred */}
            {/* {onEdit && (
              <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 w-8 p-0">
                <Edit className="h-4 w-4" />
                <span className="sr-only">Edit</span>
              </Button>
            )} */}
            {onDelete && (
              <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0">
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete</span>
              </Button>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
