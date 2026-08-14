"use client";

import { useEffect, useRef, useState } from "react";

const TOAST_EVENT = "birava:toast";
const PENDING_TOAST_KEY = "birava:toast:pending";

export function showToast(message: string) {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}

/**
 * For a toast that needs to survive a redirect to a page ToastPill isn't
 * mounted on yet (e.g. the (auth) login page, which has no ToastPill of its
 * own) — stashed here and picked up by the next ToastPill to mount, instead
 * of firing showToast() into a page with no listener.
 */
export function queueToast(message: string) {
  sessionStorage.setItem(PENDING_TOAST_KEY, message);
}

export function ToastPill() {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const pending = sessionStorage.getItem(PENDING_TOAST_KEY);
    if (pending) {
      sessionStorage.removeItem(PENDING_TOAST_KEY);
      setMessage(pending);
      setVisible(true);
      timer.current = setTimeout(() => setVisible(false), 2200);
    }

    const onToast = (e: Event) => {
      setMessage((e as CustomEvent<string>).detail);
      setVisible(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setVisible(false), 2200);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return <div className={`toast ${visible ? "show" : ""}`}>{message}</div>;
}
