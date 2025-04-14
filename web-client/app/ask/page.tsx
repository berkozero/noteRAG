"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext";
import * as api from "@/lib/api";
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Send, User, Bot, FileText } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: {
    id: string
    score?: number
    title: string | null
  }[]
}

export default function AskPage() {
  const { isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return;

    if (!isAuthenticated) {
        toast({
          title: "Authentication Required",
          description: "Please log in to ask questions.",
          variant: "destructive",
        });
        return;
    }

    const userQuestion = input.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userQuestion,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await api.queryNotes(userQuestion);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.response,
        sources: response.source_nodes?.map(source => ({
            id: source.id,
            title: source.title, 
            score: source.score,
        })) || [],
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch (error: any) {
      console.error("Ask AI Error:", error);
      toast({
        title: "Error Getting Answer",
        description: error.message || "Failed to get a response. Please try again.",
        variant: "destructive",
      });
      const errorMessage: Message = {
           id: (Date.now() + 1).toString(),
           role: "assistant",
           content: "Sorry, I encountered an error trying to get an answer.",
       };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-6 flex flex-col h-[calc(100vh-2rem)]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Ask AI</h1>
        <p className="text-muted-foreground mt-2">
          Ask questions about your notes and get AI-powered answers based on your knowledge base.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <Bot className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Ask anything about your notes</h3>
              <p className="text-muted-foreground mt-2">
                The AI will search through your notes and provide answers based on your personal knowledge base.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex flex-col">
              <div className={`flex items-start gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
                <div
                  className={`rounded-full p-2 ${message.role === "user" ? "bg-primary text-primary-foreground order-2" : "bg-muted"}`}
                >
                  {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <Card className={`p-4 max-w-[80%] ${message.role === "user" ? "order-1" : ""}`}>
                  <div className="whitespace-pre-wrap">{message.content}</div>

                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Sources:</p>
                      <div className="space-y-2">
                        {message.sources.map((source) => (
                          <div key={source.id} className="flex items-start gap-2 bg-muted/50 p-2 rounded text-sm">
                            <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium">{source.title || `Note: ${source.id.substring(0, 8)}...`}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="rounded-full p-2 bg-muted">
              <Bot className="h-4 w-4" />
            </div>
            <Card className="p-4 max-w-[80%]">
              <div className="flex space-x-2 items-center">
                <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce"></div>
                <div
                  className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
                <div
                  className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce"
                  style={{ animationDelay: "0.4s" }}
                ></div>
              </div>
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          placeholder="Ask a question about your notes..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          className="flex-1"
        />
        <Button type="submit" disabled={isLoading || !input.trim()}>
          <Send className="h-4 w-4" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  )
}
