"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

export function NotificationButton() {
  const [state, setState] = useState<"checking" | "unsupported" | "disabled" | "enabled">("checking");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !publicKey) {
      setState("unsupported");
      return;
    }
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setState(subscription ? "enabled" : "disabled"))
      .catch(() => setState("disabled"));
  }, [publicKey]);

  async function enable() {
    if (!publicKey) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    const response = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
    if (response.ok) setState("enabled");
  }

  async function disable() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await fetch("/api/push/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
      await subscription.unsubscribe();
    }
    setState("disabled");
  }

  if (state === "unsupported") return null;
  return (
    <button
      type="button"
      onClick={state === "enabled" ? disable : enable}
      disabled={state === "checking"}
      className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-sky-200 hover:bg-white/10 disabled:opacity-50"
    >
      {state === "enabled" ? "🔔 Strike alerts on" : state === "checking" ? "Checking alerts…" : "🔕 Enable strike alerts"}
    </button>
  );
}
