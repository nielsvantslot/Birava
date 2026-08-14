"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestAccountDeletion } from "@/lib/controllers/accountController";
import { queueToast, showToast } from "@/components/ui/toast-pill";
import { confirmModal } from "@/components/ui/confirm-modal";
import { clearSessionCaches } from "@/lib/swCache";

/**
 * Starts the GDPR-erasure grace period (see lib/commands/userCommands.ts's
 * requestAccountDeletion doc comment) — modeled directly on DeleteCrewButton
 * (components/drink/crews-forms.tsx), same typed-confirmation pattern. Uses
 * queueToast, not showToast, since the redirect below leaves this layout
 * entirely (unlike crew deletion, which stays within (app)) — see
 * toast-pill.tsx and app/(auth)/layout.tsx's ToastPill.
 */
export function DeleteAccountButton({ username }: { username: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = async () => {
    const confirmed = await confirmModal({
      title: "Delete your account?",
      message:
        "This schedules your account and all its data for permanent deletion in 7 days. Log back in before then to cancel. Any crew you own passes to another member.",
      confirmLabel: "Delete account",
      danger: true,
      confirmText: username,
    });
    if (!confirmed) return;

    startTransition(async () => {
      const result = await requestAccountDeletion();
      if (result.error) {
        showToast(result.error);
        return;
      }
      queueToast("Account scheduled for deletion in 7 days — log back in to cancel.");
      clearSessionCaches();
      router.push("/login");
      router.refresh();
    });
  };

  return (
    <button className="btn btn-ghost" style={{ color: "var(--destructive)" }} onClick={handleClick} disabled={isPending}>
      {isPending ? "Deleting…" : "Delete account"}
    </button>
  );
}
