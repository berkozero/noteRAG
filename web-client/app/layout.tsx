import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/contexts/AuthContext"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "NoteRAG - Your AI-Powered Notes",
  description: "Manage your notes with AI-powered semantic search and question-answering",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <SidebarProvider>
              <div className="flex min-h-screen">
                <AppSidebar />
                <main className="flex-1 overflow-auto">{children}</main>
              </div>
              <Toaster />
            </SidebarProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}


import './globals.css'