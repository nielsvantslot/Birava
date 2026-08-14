"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Beer, UserPlus, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PushSubscribeToggle } from "@/components/notifications/push-subscribe-toggle";
import { LocationPermissionToggle } from "@/components/location/location-permission-toggle";
import { PeopleClient } from "@/components/drink/people-client";
import { completeOnboarding } from "@/lib/controllers/onboardingController";

type Step = {
  icon: typeof Beer;
  title: string;
  description: string;
  extra?: "friends" | "permissions";
};

const STEPS: Step[] = [
  {
    icon: Beer,
    title: "What is Birava?",
    description: "Think Strava, but for a night out — log drinks with friends, never a drinking contest.",
  },
  {
    icon: UserPlus,
    title: "Find your friends",
    description: "Search for people you know — following them fills your dashboard with their sessions.",
    extra: "friends",
  },
  {
    icon: Bell,
    title: "Turn on the good stuff",
    description: "Get notified when your crew cheers a session, and skip typing the venue when you check in.",
    extra: "permissions",
  },
];

/**
 * Signup's redirect target (app/(auth)/signup/page.tsx) — a short, skippable
 * tour. app/onboarding/layout.tsx wraps it in the real sidebar/header/bottom
 * nav so a first-run user sees the real navigation the whole time. The
 * "friends" step renders the real PeopleClient (components/drink/people-client.tsx —
 * the same search-and-follow UI as /people) with this user's actual
 * followingIds, since following someone here has a real payoff: their
 * sessions populate the dashboard feed the moment onboarding finishes,
 * replacing its empty state. No sample data needed — search hits the live
 * User table and PeopleClient already renders its own empty-results state.
 * The last step asks for the two permissions the rest of the app depends on:
 * push (reused as-is from components/notifications/push-subscribe-toggle.tsx
 * — otherwise only reachable buried at the bottom of /profile) and location
 * (components/location/location-permission-toggle.tsx) so the check-in form
 * can prefill the venue. Granting either is optional — "Log your first
 * drink" still finishes the flow either way. `completeOnboarding` fires on
 * both Skip and the final step — either way there's nothing left to show,
 * so app/onboarding is never reached again from signup. Skipping lands on
 * the dashboard (its own empty state already nudges toward logging a first
 * drink); finishing goes straight to /log, since clicking through means
 * they're already bought in.
 */
export function OnboardingFlow({
  userId,
  username,
  followingIds,
}: {
  userId: string;
  username: string;
  followingIds: string[];
}) {
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
    <div className="mx-auto w-full max-w-sm space-y-6 px-4 pt-10 md:pt-16">
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
          {step.extra === "friends" && <PeopleClient followingIds={followingIds} currentUserId={userId} />}
          {step.extra === "permissions" && (
            <>
              <PushSubscribeToggle />
              <LocationPermissionToggle />
            </>
          )}
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
