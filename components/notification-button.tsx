"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

type AlertState =
  | "checking"
  | "install_required"
  | "unsupported"
  | "disabled"
  | "enabling"
  | "enabled"
  | "error";

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  const navigatorStandalone = "standalone" in navigator
    ? Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    : false;
  return navigatorStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

export function NotificationButton({ prominent = false }: { prominent?: boolean }) {
  const [state, setState] = useState<AlertState>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!publicKey || !("serviceWorker" in navigator) || !("Notification" in window)) {
        if (!cancelled) setState(isIos() && !isStandalone() ? "install_required" : "unsupported");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const pushManager = registration.pushManager;

        // Some mobile browsers do not expose window.PushManager even though
        // ServiceWorkerRegistration.pushManager works. Check the registration
        // directly instead of using `"PushManager" in window`.
        if (!pushManager || typeof pushManager.getSubscription !== "function") {
          if (!cancelled) setState(isIos() && !isStandalone() ? "install_required" : "unsupported");
          return;
        }

        const subscription = await pushManager.getSubscription();
        if (!cancelled) setState(subscription ? "enabled" : "disabled");
      } catch {
        if (!cancelled) setState(isIos() && !isStandalone() ? "install_required" : "disabled");
      }
    }

    void check();
    return () => { cancelled = true; };
  }, [publicKey]);

  async function enable() {
    if (state === "install_required") {
      setErrorMessage("On iPhone, add the tracker to your Home Screen in Safari, open the installed app, then enable alerts.");
      return;
    }
    if (!publicKey || state === "enabling") return;

    setErrorMessage(null);
    setState("enabling");

    try {
      if (!("serviceWorker" in navigator) || !("Notification" in window)) {
        throw new Error("Push notifications are not supported in this browser.");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("disabled");
        setErrorMessage("Notification permission was not granted. You can enable it later in your phone settings.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      if (!registration.pushManager) {
        if (isIos() && !isStandalone()) {
          setState("install_required");
          setErrorMessage("On iPhone, install the tracker to your Home Screen first, then enable alerts from the installed app.");
          return;
        }
        throw new Error("This browser does not provide web-push support.");
      }

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || `Unable to register alerts (${response.status}).`);
      }

      setState("enabled");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to enable strike alerts.");
      setState("error");
    }
  }

  async function disable() {
    setErrorMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager?.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("disabled");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to disable strike alerts.");
      setState("error");
    }
  }

  const enabled = state === "enabled";
  const unsupported = state === "unsupported";
  const installRequired = state === "install_required";
  const busy = state === "checking" || state === "enabling";

  const label =
    state === "enabled"
      ? "✓ Strike alerts enabled"
      : state === "checking"
        ? "Checking strike alerts…"
        : state === "enabling"
          ? "Enabling strike alerts…"
          : state === "error"
            ? "Retry strike alerts"
            : installRequired
              ? "Install app for strike alerts"
              : unsupported
                ? "Strike alerts unavailable"
                : "Enable strike alerts";

  const wrapperClass = prominent
    ? "flex w-full min-w-0 flex-col items-center gap-1.5"
    : "flex min-w-0 flex-col items-start gap-1.5";

  const compactProminent = prominent ? "w-full max-w-[20rem] min-h-11 text-sm" : "max-w-full text-xs sm:text-sm";
  const buttonClass = enabled
    ? `${compactProminent} rounded-xl border border-emerald-400/50 bg-emerald-400/15 px-4 py-2.5 font-black leading-4 text-emerald-100 shadow-lg shadow-emerald-950/20 hover:bg-emerald-400/20`
    : `${compactProminent} rounded-xl border border-amber-300/50 bg-amber-300/12 px-4 py-2.5 font-black leading-4 text-amber-100 shadow-lg shadow-amber-950/20 hover:bg-amber-300/20 disabled:cursor-wait disabled:opacity-80`;

  return (
    <div className={wrapperClass}>
      <button
        type="button"
        onClick={enabled ? disable : enable}
        disabled={busy || unsupported}
        aria-pressed={enabled}
        className={buttonClass}
      >
        <span aria-hidden="true" className="mr-2">🔔</span>
        {label}
      </button>
      {installRequired ? (
        <span className="max-w-[22rem] text-center text-[0.68rem] leading-4 text-amber-200 sm:text-xs">
          iPhone web push works from the Home Screen app. In Safari, choose Share → Add to Home Screen.
        </span>
      ) : null}
      {unsupported ? (
        <span className="max-w-[22rem] text-center text-[0.68rem] leading-4 text-slate-300 sm:text-xs">
          This browser does not expose web-push support, or the push key is not configured.
        </span>
      ) : null}
      {errorMessage ? (
        <span className="max-w-[22rem] text-center text-[0.68rem] leading-4 text-rose-300 sm:text-xs">
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}
