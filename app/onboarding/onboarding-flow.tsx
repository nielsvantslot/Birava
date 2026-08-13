"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Users, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { completeOnboarding } from "@/lib/controllers/onboardingController";

type Step = {
  icon: typeof Clock;
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    icon: Clock,
    title: "One evening, one session",
    description:
      "Log a drink and Birava starts a session automatically. Keep logging within a few hours and it all stays together — there's no manual start or stop.",
  },
  {
    icon: Users,
    title: "Bring your crew",
    description:
      "Create or join a crew to share a leaderboard with friends — ranked by sessions, never by who drinks the most.",
  },
  {
    icon: Award,
    title: "Badges reward variety",
    description:
      "Try new drinks, explore new venues, and become a regular somewhere. Birava celebrates variety, not volume — you won't find a drink-count badge here.",
  },
];

/**
 * Signup's redirect target (app/(auth)/signup/page.tsx) — a short, skippable
 * explainer for the three ideas a first-time user has no way to already
 * know: sessions group themselves, crews are the social/competitive layer,
 * and achievements track variety, never volume. `completeOnboarding` fires
 * on both Skip and the final step — either way there's nothing left to show,
 * so app/onboarding is never reached again from signup. Skipping lands on
 * the dashboard (its own empty state already nudges toward logging a first
 * drink); finishing goes straight to /log, since clicking through means
 * they're already bought in.
 */
export function OnboardingFlow({ username }: { username: string }) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const isLastStep = stepIndex === STEPS.length - 1;
  const step = STEPS[stepIndex];
  const Icon = step.icon;

  const finish = (destination: "/dashboard" | "/log") => {
    startTransition(async () => {
      await completeOnboarding();
      router.push(destination);
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary)] shadow-lg">
            <Icon className="h-8 w-8 text-[var(--accent-ink)]" />
          </div>
        </div>
        <h1 className="text-2xl font-black">Welcome, {username}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{step.title}</CardTitle>
          <CardDescription>{step.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center gap-2" role="img" aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-6 rounded-full"
                style={{ background: i <= stepIndex ? "var(--primary)" : "var(--border)" }}
              />
            ))}
          </div>

          {isLastStep ? (
            <Button className="w-full" size="lg" disabled={isPending} onClick={() => finish("/log")}>
              {isPending ? "Getting started…" : "Log your first drink"}
            </Button>
          ) : (
            <Button className="w-full" size="lg" onClick={() => setStepIndex((i) => i + 1)}>
              Next
            </Button>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-sm">
        <button
          type="button"
          className="text-[var(--muted-foreground)] hover:underline disabled:opacity-50"
          disabled={isPending}
          onClick={() => finish("/dashboard")}
        >
          Skip for now
        </button>
      </p>
    </div>
  );
}
