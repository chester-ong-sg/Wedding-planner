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

export default function LoginPage() {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        toast({
          variant: "destructive",
          title: "Login failed",
          description: error.message,
        })
        return
      }

      if (data?.session) {
        toast({ title: "Success", description: "Logged in successfully" })
        // Check onboarding status — new users go to /onboarding, existing to /dashboard
        let dest = "/onboarding"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: prof } = await (supabase as any).from("user_profiles")
          .select("onboarding_completed")
          .eq("id", data.session.user.id)
          .single()
        if (prof?.onboarding_completed) dest = "/dashboard"
        router.push(dest)
      } else {
        toast({
          variant: "destructive",
          title: "Login Error",
          description: "No session created after login",
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Login Error",
        description: "An error occurred during login",
      })
    } finally {
      setLoading(false)
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
          <CardTitle className="text-2xl font-bold text-center">Login</CardTitle>
          <CardDescription className="text-center">
            Enter your email and password to access your account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={async () => {
                if (!supabase) return
                setLoading(true)
                try {
                  let session = null

                  // Try signing in first
                  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email: "guest@gmail.com",
                    password: "guest123",
                  })

                  if (signInError) {
                    // Account doesn't exist — create it
                    const { error: signUpError } = await supabase.auth.signUp({
                      email: "guest@gmail.com",
                      password: "guest123",
                    })
                    if (signUpError) {
                      toast({ variant: "destructive", title: "Guest login failed", description: signUpError.message })
                      return
                    }
                    // Sign in after creating
                    const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
                      email: "guest@gmail.com",
                      password: "guest123",
                    })
                    if (retryError) {
                      toast({ variant: "destructive", title: "Guest login failed", description: retryError.message })
                      return
                    }
                    session = retryData?.session
                  } else {
                    session = signInData?.session
                  }

                  if (session) {
                    toast({ title: "Success", description: "Logged in as guest" })
                    let dest = "/onboarding"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { data: prof } = await (supabase as any).from("user_profiles")
                      .select("onboarding_completed").eq("id", session.user.id).single()
                    if (prof?.onboarding_completed) dest = "/dashboard"
                    router.push(dest)
                  }
                } finally {
                  setLoading(false)
                }
              }}
              disabled={loading}
            >
              Login as Guest
            </Button>
            <div className="text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="underline">
                Register
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

