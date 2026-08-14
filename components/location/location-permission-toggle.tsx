"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/components/ui/toast-pill";

type Status = "checking" | "unsupported" | "denied" | "off" | "on";

const LOCATION_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Mirrors PushSubscribeToggle's status/timeout handling, but there's no
 * revoke API for geolocation like pushManager.unsubscribe() — once granted,
 * the switch renders "on" and disabled; turning it off is only ever possible
 * from the browser's own site settings.
 */
export function LocationPermissionToggle() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    if (!navigator.permissions?.query) {
      setStatus("off");
      return;
    }
    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        setStatus(result.state === "granted" ? "on" : result.state === "denied" ? "denied" : "off");
      })
      .catch(() => setStatus("off"));
  }, []);

  const handleEnable = async () => {
    setBusy(true);
    setTimedOut(false);
    try {
      await withTimeout(
        new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: LOCATION_TIMEOUT_MS,
            maximumAge: 60_000,
          })
        ),
        LOCATION_TIMEOUT_MS
      );
      setStatus("on");
    } catch (e) {
      if (e instanceof Error && e.message === "timeout") {
        setTimedOut(true);
      } else if ((e as GeolocationPositionError)?.code === 1) {
        setStatus("denied");
      } else {
        showToast("Couldn't get your location");
      }
    } finally {
      setBusy(false);
    }
  };

  if (status === "checking") return null;

  const description =
    status === "on"
      ? "Birava fills in the venue automatically when you check in."
      : "Skip typing the bar name — Birava fills it in from where you are.";

  return (
    <div id="location-permission">
      <div className="switch-row">
        <div className="rowmark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-6-5.686-6-10a6 6 0 1112 0c0 4.314-6 10-6 10z"></path>
            <circle cx="12" cy="11" r="2"></circle>
          </svg>
        </div>
        <div className="grow">
          <b>Allow location</b>
          <p>
            {status === "unsupported"
              ? "Not available in this browser."
              : status === "denied"
                ? "Blocked in your browser. Enable location for this site, then reload the page."
                : description}
          </p>
        </div>
        {status !== "unsupported" && status !== "denied" && (
          <button
            role="switch"
            aria-checked={status === "on"}
            aria-label="Location access"
            className={`switch${status === "on" ? " on" : ""}`}
            disabled={busy || status === "on"}
            onClick={handleEnable}
          />
        )}
      </div>
      {timedOut && (
        <div className="callout warn" style={{ marginTop: 14 }}>
          <div className="mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01"></path>
              <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"></path>
            </svg>
          </div>
          <div>
            <b>This is taking longer than expected</b>
            <p>Check that location is allowed for this app in your phone&apos;s system settings, then try again.</p>
          </div>
        </div>
      )}
    </div>
  );
}
