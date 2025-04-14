"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { FileText, Search, MessageSquareText, LogOut, User, Menu, Settings as SettingsIcon } from "lucide-react"
import { Button } from "./ui/button"

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter();
  const { isAuthenticated, userEmail, logout } = useAuth();

  const handleLogout = () => {
      logout();
      router.push("/login"); 
  };

  if (pathname === "/login" || !isAuthenticated) {
    return null
  }

  return (
    <Sidebar>
      <SidebarHeader className="flex items-center justify-between p-4">
        <div className="flex items-center">
          <Link href="/dashboard" className="text-xl font-bold">NoteRAG</Link>
        </div>
        <SidebarTrigger className="md:hidden">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/dashboard"} tooltip="Notes">
              <Link href="/dashboard">
                <FileText className="h-5 w-5" />
                <span>Notes</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/ask"} tooltip="Ask AI">
              <Link href="/ask">
                <MessageSquareText className="h-5 w-5" />
                <span>Ask AI</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {isAuthenticated && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/settings"} tooltip="Settings">
                  <Link href="/settings">
                    <SettingsIcon className="h-5 w-5" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <SidebarMenu>
          {isAuthenticated ? (
            <>
              {userEmail && (
                <SidebarMenuItem>
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground" title={userEmail}>
                      <User className="h-5 w-5 flex-shrink-0" />
                      <span className="truncate">{userEmail}</span>
                  </div>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout} tooltip="Logout">
                  <LogOut className="h-5 w-5" />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Login / Sign Up">
                <Link href="/login">
                  <Button variant="default" size="sm" className="w-full">
                    Login / Sign Up
                  </Button>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
