"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/lib/supabase-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { CalendarHeart } from "lucide-react"

export default function RegisterPage() {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastAttemptTime, setLastAttemptTime] = useState<number>(0)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    // Check if we're within the rate limit window (5 seconds)
    const now = Date.now()
    if (now - lastAttemptTime < 5000) {
      setError("Please wait a few seconds before trying again")
      return
    }
    
    setIsLoading(true)
    setLastAttemptTime(now)
    
    try {
      // First check if user exists
      const { data: existingUser, error: checkError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (checkError && !checkError.message.includes("rate limit")) {
        // User doesn't exist, create new account
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })

        if (signUpError) {
          if (signUpError.message.includes("rate limit")) {
            setError("Too many attempts. Please wait a few minutes before trying again.")
          } else {
            setError(signUpError.message)
          }
          return
        }

        toast.success("Registration successful", {
          description: "Please check your email to verify your account.",
        })
        router.push("/login")
      } else if (existingUser) {
        // User exists, redirect to planner
        router.push("/planner")
      }
    } catch (err) {
      console.error("Registration error:", err)
      setError("An unexpected error occurred. Please try again later.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-6">
            <Link href="/" className="flex items-center">
              <CalendarHeart className="h-8 w-8 mr-2" />
              <span className="font-bold text-2xl">Wedding Planner</span>
            </Link>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Register</CardTitle>
          <CardDescription className="text-center">Create an account to start planning your wedding</CardDescription>
        </CardHeader>
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Registering..." : "Register"}
            </Button>
            <div className="text-center text-sm">
              Already have an account?{" "}
              <Link href="/login" className="underline">
                Login
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

