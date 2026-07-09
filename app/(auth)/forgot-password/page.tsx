"use client";

import { useState } from "react";
import Link from "next/link";
import { Beer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debugResetUrl, setDebugResetUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setDebugResetUrl(null);

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const result = (await response.json().catch(() => null)) as
      | { error?: string; resetUrl?: string }
      | null;

    if (!response.ok) {
      setError(result?.error ?? "Unable to process request.");
      setLoading(false);
      return;
    }

    setSuccess("If this email exists, a password reset link has been sent.");
    if (result?.resetUrl) {
      setDebugResetUrl(result.resetUrl);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary)] shadow-lg">
            <Beer className="h-8 w-8 text-[var(--accent-ink)]" />
          </div>
        </div>
        <h1 className="text-3xl font-black">Birava</h1>
        <p className="text-[var(--muted-foreground)] text-sm">
          Reset your password
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Forgot password</CardTitle>
          <CardDescription>Enter your email to receive a reset link</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {error && (
              <p className="text-sm text-[var(--destructive)] bg-[var(--destructive)]/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {success && (
              <p className="text-sm text-emerald-600 bg-emerald-500/10 rounded-lg px-3 py-2">
                {success}
              </p>
            )}

            {debugResetUrl && (
              <p className="text-xs text-[var(--muted-foreground)] rounded-lg bg-[var(--muted)] px-3 py-2 break-all">
                Dev reset link: {debugResetUrl}
              </p>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Sending link..." : "Send reset link"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-[var(--muted-foreground)]">
        Remembered your password?{" "}
        <Link href="/login" className="text-[var(--primary)] font-semibold hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
