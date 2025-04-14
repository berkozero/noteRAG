"use client"

import type React from "react"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SearchIcon } from "lucide-react"
import type { Note } from "@/types/note"
import { NoteCard } from "@/components/note-card"
import { useToast } from "@/components/ui/use-toast"

interface SearchResult extends Note {
  score: number
}

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const { toast } = useToast()

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!searchQuery.trim()) {
      toast({
        title: "Empty search",
        description: "Please enter a search term",
        variant: "destructive",
      })
      return
    }

    setIsSearching(true)
    setHasSearched(true)

    try {
      // Simulate API call for semantic search
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Mock search results
      const mockResults: SearchResult[] = [
        {
          id: "2",
          title: "Research on AI Models",
          content: "GPT-4 shows promising results for text generation. Need to explore RAG implementations further.",
          createdAt: new Date(2023, 3, 10).toISOString(),
          updatedAt: new Date(2023, 3, 12).toISOString(),
          score: 0.92,
        },
        {
          id: "5",
          title: "AI Project Ideas",
          content: "1. Text summarization tool\n2. Semantic search engine\n3. Question-answering system with RAG",
          createdAt: new Date(2023, 2, 5).toISOString(),
          updatedAt: new Date(2023, 2, 5).toISOString(),
          score: 0.85,
        },
        {
          id: "7",
          title: "Learning Resources",
          content: "Check out the new course on implementing Retrieval Augmented Generation (RAG) systems.",
          createdAt: new Date(2023, 1, 20).toISOString(),
          updatedAt: new Date(2023, 1, 20).toISOString(),
          score: 0.78,
        },
      ]

      setResults(mockResults)
    } catch (error) {
      toast({
        title: "Search failed",
        description: "An error occurred while searching. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleClearSearch = () => {
    setSearchQuery("")
    setResults([])
    setHasSearched(false)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-6">Semantic Search</h1>
        <p className="text-muted-foreground mb-6">
          Search your notes using natural language. Our semantic search understands the meaning behind your query.
        </p>

        <form onSubmit={handleSearch} className="flex gap-2 max-w-2xl">
          <Input
            placeholder="Search your notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={isSearching}>
            {isSearching ? (
              "Searching..."
            ) : (
              <>
                <SearchIcon className="mr-2 h-4 w-4" />
                Search
              </>
            )}
          </Button>
          {hasSearched && (
            <Button variant="outline" onClick={handleClearSearch}>
              Clear
            </Button>
          )}
        </form>
      </div>

      {isSearching ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="border rounded-lg p-4 h-48 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : hasSearched ? (
        results.length > 0 ? (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Found {results.length} results for &quot;{searchQuery}&quot;
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {results.map((result) => (
                <div key={result.id} className="relative">
                  <div className="absolute right-3 top-3 bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded-full">
                    {Math.round(result.score * 100)}% match
                  </div>
                  <NoteCard note={result} showActions={false} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No results found for &quot;{searchQuery}&quot;</p>
          </div>
        )
      ) : null}
    </div>
  )
}
