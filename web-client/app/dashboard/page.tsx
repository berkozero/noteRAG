"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import * as api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus } from "lucide-react"
import { NoteCard } from "@/components/note-card"
import { NoteDialog } from "@/components/note-dialog"
import type { Note } from "@/types/note"
import { useToast } from "@/components/ui/use-toast"

export default function DashboardPage() {
  const { token, isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoadingNotes, setIsLoadingNotes] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false)
  const [isSavingNote, setIsSavingNote] = useState(false)
  const { toast } = useToast()

  const fetchNotes = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setIsLoadingNotes(false)
      setNotes([])
      return
    }
    console.log("Dashboard: Fetching notes...")
    setIsLoadingNotes(true)
    try {
      const fetchedNotes = await api.getNotes()
      fetchedNotes.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      setNotes(fetchedNotes)
      console.log(`Dashboard: Fetched ${fetchedNotes.length} notes.`)
    } catch (error: any) {
      console.error("Dashboard: Failed to load notes:", error)
        toast({
        title: "Error Loading Notes",
        description: error.message || "Could not fetch notes. Please try again.",
          variant: "destructive",
        })
      setNotes([])
      } finally {
      setIsLoadingNotes(false)
    }
  }, [token, isAuthenticated, toast])

  useEffect(() => {
    if (!isAuthLoading) {
    fetchNotes()
    }
  }, [isAuthLoading, fetchNotes])

  const handleCreateNote = async (noteData: { title: string; content: string }) => {
    setIsSavingNote(true)
    try {
      const noteInput = {
        title: noteData.title || undefined,
        text: noteData.content
      }
      const newNote = await api.addNote(noteInput)
      await fetchNotes()
    setIsNoteDialogOpen(false)
    toast({
        title: "Note Created",
        description: `"${(newNote.title || newNote.text).substring(0, 30)}..." created successfully.`,
    })
    } catch (error: any) {
      console.error("Dashboard: Failed to create note:", error)
    toast({
        title: "Error Creating Note",
        description: error.message || "Could not save the note. Please try again.",
        variant: "destructive",
    })
    } finally {
      setIsSavingNote(false)
    }
  }

  const handleDeleteNote = async (id: string) => {
    const originalNotes = [...notes]
    setNotes(notes.filter((note) => note.id !== id))

    try {
      await api.deleteNote(id)
      toast({
        title: "Note Deleted",
        description: "Your note has been successfully deleted.",
      })
    } catch (error: any) {
      console.error("Dashboard: Failed to delete note:", error)
      setNotes(originalNotes)
    toast({
        title: "Error Deleting Note",
        description: error.message || "Could not delete the note. Please try again.",
        variant: "destructive",
    })
  }
  }

  const filteredNotes = notes.filter(
    (note) =>
      (note.title && note.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      note.text.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  if (isAuthLoading || (isAuthenticated && isLoadingNotes && notes.length === 0)) {
    return (
      <div className="container mx-auto py-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border rounded-lg p-4 h-48 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-1/2 mb-4 dark:bg-gray-700"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2 dark:bg-gray-700"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2 dark:bg-gray-700"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 dark:bg-gray-700"></div>
          </div>
        ))}
      </div>
    )
  }
  
  if (!isAuthLoading && !isAuthenticated) {
    return <div className="container mx-auto py-6"><p>Please log in to view notes.</p></div>
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">My Notes</h1>
        <Button onClick={() => setIsNoteDialogOpen(true)} disabled={isSavingNote}>
          <Plus className="mr-2 h-4 w-4" /> New Note
        </Button>
      </div>

      <div className="max-w-md">
        <Input
          placeholder="Filter notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
      </div>

      {isLoadingNotes && notes.length === 0 && (
        <div className="text-center py-12"><p>Loading notes...</p></div>
      )}
      
      {!isLoadingNotes && filteredNotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onDelete={() => handleDeleteNote(note.id)}
            />
          ))}
        </div>
      ) : !isLoadingNotes ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery ? "No notes match your filter" : "No notes yet. Create your first note!"}
          </p>
        </div>
      ) : null}

        <NoteDialog
        open={isNoteDialogOpen}
        onOpenChange={setIsNoteDialogOpen}
        onSave={handleCreateNote}
        isSaving={isSavingNote}
        />
    </div>
  )
}
