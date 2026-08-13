"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Beer, Clock, Newspaper, Users, Award, Bell, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PushSubscribeToggle } from "@/components/notifications/push-subscribe-toggle";
import { completeOnboarding } from "@/lib/controllers/onboardingController";

type Step = {
  icon: typeof Clock;
  title: string;
  description: string;
  /** Steps that need more than an icon + description: a mini illustration of the feed, or the real notifications toggle. */
  extra?: "feed" | "notifications";
};

const STEPS: Step[] = [
  {
    icon: Beer,
    title: "What is Birava?",
    description:
      "Think Strava, but for a night out. Log the drinks you have with friends, and Birava turns them into sessions, a shared feed, and some friendly competition — never a drinking contest.",
  },
  {
    icon: Clock,
    title: "One evening, one session",
    description:
      "Log a drink and Birava starts a session automatically. Add another within a few hours — same bar or three stops later — and it joins the same one. There's no manual start or stop; a session just ends itself once things go quiet for a while.",
  },
  {
    icon: Newspaper,
    title: "See what your friends are up to",
    description:
      "Your dashboard shows sessions from people you follow, newest first — cheer one on or drop a comment. Switch to the “You” tab any time to see just your own nights.",
    extra: "feed",
  },
  {
    icon: Users,
    title: "Bring your crew",
    description:
      "Create or join a crew to share a private leaderboard with friends — ranked by sessions since each person joined, never by who drinks the most.",
  },
  {
    icon: Award,
    title: "Badges reward variety, not volume",
    description:
      "Try new drink types, explore new venues, and become a regular somewhere. Your stats page tracks it all, including a streak of active weeks — one quiet week won't break it, but two in a row will.",
  },
  {
    icon: Bell,
    title: "Stay in the loop",
    description: "Turn on notifications so you know when your crew cheers a session, or when it's time to log again.",
    extra: "notifications",
  },
];

/** A static preview of a dashboard feed row — the one concept in this flow worth showing, not just describing, since it's the first thing a new user actually sees after finishing. */
function FeedPreview() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-3 text-left">
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--muted)] text-sm font-bold">
        S
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">Sarah &middot; Evening session</p>
        <p className="truncate text-xs text-[var(--muted-foreground)]">3 check-ins &middot; The Local Taphouse</p>
      </div>
      <Heart className="h-4 w-4 flex-none text-[var(--muted-foreground)]" />
    </div>
  );
}

/**
 * Signup's redirect target (app/(auth)/signup/page.tsx) — a short, skippable
 * explainer for the ideas a first-time user has no way to already know: what
 * Birava actually is, that sessions group themselves, that the dashboard is a
 * shared feed (not just your own log), that crews are the social/competitive
 * layer, that achievements/stats track variety never volume, and — the last
 * step — that push notifications exist and are worth turning on. That last
 * step reuses PushSubscribeToggle as-is
 * (components/notifications/push-subscribe-toggle.tsx) rather than
 * duplicating its subscribe/timeout/permission-state handling; it's
 * otherwise only reachable buried at the bottom of /profile, so surfacing it
 * here doubles as the fix for that discoverability gap. Toggling it is
 * optional — "Log your first drink" still finishes the flow whether or not
 * the user enabled it. `completeOnboarding` fires on both Skip and the final
 * step — either way there's nothing left to show, so app/onboarding is never
 * reached again from signup. Skipping lands on the dashboard (its own empty
 * state already nudges toward logging a first drink); finishing goes straight
 * to /log, since clicking through means they're already bought in.
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
          {step.extra === "feed" && <FeedPreview />}
          {step.extra === "notifications" && <PushSubscribeToggle />}
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
