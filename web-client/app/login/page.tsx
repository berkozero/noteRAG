"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import * as api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSignUpMode, setIsSignUpMode] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (isSignUpMode) {
      if (password !== confirmPassword) {
        setError("Passwords do not match.")
        setIsLoading(false)
        return
      }
      try {
        const data = await api.register(email, password)
        console.log('Registration successful, attempting auto-login...', data)
        await login(email, password)
        router.push("/dashboard")
      } catch (err: any) {
        console.error("Registration page caught error:", err)
        setError(err.message || "Failed to sign up. Please try again.")
      } finally {
        setIsLoading(false)
      }
    } else {
      try {
        await login(email, password)
        console.log('Login successful on page, redirecting...')
        router.push('/dashboard')
      } catch (err: any) {
        console.error('Login page caught error:', err)
        setError(err.message || 'Failed to login. Please check your credentials.')
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleGoogleSignIn = () => {
    console.warn('Google Sign-in not implemented yet.')
  }

  const cardTitle = isSignUpMode ? 'Create Account' : 'NoteRAG'
  const cardDescription = isSignUpMode ? 'Enter details to create your account' : 'Sign in to access your AI-powered notes'
  const submitButtonText = isSignUpMode ? (isLoading ? 'Creating Account...' : 'Sign Up') : (isLoading ? 'Signing in...' : 'Sign In')
  const toggleModeText = isSignUpMode ? 'Already have an account? Sign In' : 'Don\'t have an account? Sign Up'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">{cardTitle}</CardTitle>
          <CardDescription className="text-center">{cardDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={isSignUpMode ? 12 : undefined}
                disabled={isLoading}
              />
              {isSignUpMode && (
                <p className="text-xs text-muted-foreground">
                  Must be at least 12 characters long.
                </p>
              )}
            </div>
            {isSignUpMode && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={12}
                  disabled={isLoading}
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {submitButtonText}
            </Button>
          </form>
          {!isSignUpMode && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isLoading}>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                  <path d="M1 1h22v22H1z" fill="none" />
                </svg>
                Google
              </Button>
            </>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button variant="link" onClick={() => setIsSignUpMode(!isSignUpMode)} disabled={isLoading}>
            {toggleModeText}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
