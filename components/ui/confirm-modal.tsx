"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const CONFIRM_MODAL_EVENT = "birava:confirm-modal";

export type ConfirmModalOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as a destructive action. */
  danger?: boolean;
  /**
   * If set, the confirm button stays disabled until the user types this
   * exact text — the "type the name to confirm" pattern for actions severe
   * enough that a single tap isn't enough friction.
   */
  confirmText?: string;
};

type ConfirmModalRequest = ConfirmModalOptions & { resolve: (confirmed: boolean) => void };

/**
 * Awaitable replacement for window.confirm/window.prompt, styled to match
 * the app instead of the browser chrome. Only one can be open at a time.
 */
export function confirmModal(options: ConfirmModalOptions): Promise<boolean> {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<ConfirmModalRequest>(CONFIRM_MODAL_EVENT, { detail: { ...options, resolve } }));
  });
}

export function ConfirmModalHost() {
  const [request, setRequest] = useState<ConfirmModalRequest | null>(null);
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onRequest = (e: Event) => {
      setTyped("");
      setRequest((e as CustomEvent<ConfirmModalRequest>).detail);
    };
    window.addEventListener(CONFIRM_MODAL_EVENT, onRequest);
    return () => window.removeEventListener(CONFIRM_MODAL_EVENT, onRequest);
  }, []);

  useEffect(() => {
    if (!request) return;
    document.body.style.overflow = "hidden";
    (request.confirmText ? inputRef.current : cancelRef.current)?.focus();
    return () => {
      document.body.style.overflow = "";
    };
  }, [request]);

  if (!request) return null;

  const close = (confirmed: boolean) => {
    request.resolve(confirmed);
    setRequest(null);
  };

  const needsTyped = !!request.confirmText;
  const canConfirm = !needsTyped || typed === request.confirmText;

  return (
    <div
      className="modal-backdrop"
      onClick={() => close(false)}
      onKeyDown={(e) => e.key === "Escape" && close(false)}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-modal-title">{request.title}</h3>
        <p>{request.message}</p>
        {needsTyped && (
          <div className="field">
            <input
              ref={inputRef}
              type="text"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={request.confirmText}
              onKeyDown={(e) => e.key === "Enter" && canConfirm && close(true)}
            />
          </div>
        )}
        <div className="modal-actions">
          <button ref={cancelRef} className="btn btn-ghost" onClick={() => close(false)}>
            {request.cancelLabel ?? "Cancel"}
          </button>
          <button
            className={cn("btn", request.danger ? "btn-danger" : "btn-primary")}
            disabled={!canConfirm}
            onClick={() => close(true)}
          >
            {request.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
